/**
 * cli.ts — `cxc bg` entry. Both dispatchers strip the leading command word, so the
 * argv this CLI receives is [<verb>, ...rest] — same shape skill-search gets.
 *
 * Two callers with opposite failure rules:
 *   hook <event>  — reads the payload on stdin. NEVER writes to stderr and NEVER exits
 *                   non-zero: exit 2 with stderr is read by Codex as a Stop block.
 *   everything else — an ordinary CLI for the human and the model.
 */
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  describeRecord,
  disabledState,
  envDisabled,
  listRecords,
  readRecord,
  reconcile,
  type BgRecord,
} from "./registry.ts";
import { cancel, runBackground } from "./spawn.ts";
import { drainNow, handleSessionStart, handleStop, handleUserPromptSubmit, type HookPayload } from "./hook.ts";
import { atomicWrite, appendLedger, disabledPath, enabledAtPath, ensureDir, outPath, readTextOrNull, removePath } from "./store.ts";
import { removalText } from "./removal.ts";

const USAGE = [
  "cxc bg run [--note \"...\"] -- <command...>   백그라운드로 실행하고 id를 반환",
  "cxc bg list [--json]                        이 디렉터리의 백그라운드 작업",
  "cxc bg get <id> [--tail N]                  상태와 출력 꼬리",
  "cxc bg cancel <id>                          중지",
  "cxc bg off | on | status                    완료 웨이크 스위치 (이 워크트리)",
  "cxc bg drain --session <id> [--json]        미전달 완료를 받아가고 전달 표시",
  "cxc bg removal                              제거 체크리스트",
].join("\n");

const MAX_STDIN_BYTES = 1024 * 1024;

function readStdin(): string {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.length > MAX_STDIN_BYTES ? "" : raw;
  } catch {
    return "";
  }
}

function parsePayload(raw: string): HookPayload {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as HookPayload) : {};
  } catch {
    return {};
  }
}

/** Hook path. Any failure degrades to silence, which is the only safe release. */
function runHook(event: string): number {
  let out = "";
  try {
    const payload = parsePayload(readStdin());
    const cwd = process.cwd();
    if (event === "stop") out = handleStop(payload, cwd);
    else if (event === "user-prompt-submit") out = handleUserPromptSubmit(payload, cwd);
    else if (event === "session-start") out = handleSessionStart(payload, cwd);
  } catch {
    out = "";
  }
  try {
    if (out.length > 0) process.stdout.write(out + "\n");
  } catch {
    // A broken stdout must not surface as a stack trace on stderr: Codex reads
    // exit 2 + stderr as a Stop BLOCK, which is the opposite of failing open.
  }
  return 0;
}

function flagValue(args: string[], name: string): string | null {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1] ?? null;
}

function formatList(records: BgRecord[]): string {
  if (records.length === 0) return "백그라운드 작업 없음";
  return records
    .map((r) => {
      const delivered = r.deliveredAt === null ? "미전달" : "전달됨";
      return describeRecord(r) + (r.status === "running" ? "" : "  [" + delivered + "]");
    })
    .join("\n");
}

export function run(argv: string[], cwd: string): { out: string; code: number } {
  const verb = argv[0] ?? "";
  const args = argv.slice(1);

  if (verb === "run") {
    const sep = args.indexOf("--");
    if (sep < 0 || sep === args.length - 1) return { out: USAGE, code: 1 };
    const note = flagValue(args.slice(0, sep), "--note");
    const command = args.slice(sep + 1);
    const rec = runBackground({ cwd, sessionId: process.env.CODEX_THREAD_ID ?? null, command, note });
    if (args.includes("--json")) return { out: JSON.stringify(rec), code: 0 };
    return { out: rec.id, code: 0 };
  }

  if (verb === "list") {
    const records = listRecords(cwd);
    if (args.includes("--json")) return { out: JSON.stringify(records), code: 0 };
    return { out: formatList(records), code: 0 };
  }

  if (verb === "get") {
    const id = args[0] ?? "";
    const rec = readRecord(cwd, id);
    if (rec === null) return { out: "없는 id: " + id, code: 1 };
    const fresh = reconcile(rec);
    const tailArg = flagValue(args, "--tail");
    const tail = tailArg === null ? 20 : Math.max(0, Number.parseInt(tailArg, 10) || 0);
    const body = readTextOrNull(outPath(cwd, id)) ?? "";
    const lines = body.split("\n");
    const shown = tail > 0 ? lines.slice(-tail).join("\n") : "";
    return { out: [describeRecord(fresh), "", shown].join("\n").trimEnd(), code: 0 };
  }

  if (verb === "cancel") {
    const rec = readRecord(cwd, args[0] ?? "");
    // Cancelling something already gone is not an error; contract 010 pins this to 0.
    if (rec === null) return { out: "없는 id: " + (args[0] ?? ""), code: 0 };
    const next = cancel(rec);
    return { out: next.id + " " + next.status, code: 0 };
  }

  if (verb === "off") {
    ensureDir(cwd);
    atomicWrite(disabledPath(cwd), new Date().toISOString() + "\n");
    appendLedger(cwd, { event: "disabled" });
    return { out: "bg wake OFF (이 워크트리). 다시 켜려면: cxc bg on", code: 0 };
  }

  if (verb === "on") {
    ensureDir(cwd);
    // Re-running `on` while already on must not move the gate forward, or it would
    // swallow completions that were waiting to be delivered.
    if (!disabledState(cwd).disabled) return { out: "bg wake 이미 ON", code: 0 };
    removePath(disabledPath(cwd));
    // Everything that finished while the switch was off stays in the list but does not
    // stampede the next Stop (contract 010, wake condition 4).
    atomicWrite(enabledAtPath(cwd), new Date().toISOString() + "\n");
    appendLedger(cwd, { event: "enabled" });
    return { out: "bg wake ON. 꺼져 있는 동안 끝난 작업은 웨이크하지 않고 cxc bg list 에만 남습니다.", code: 0 };
  }

  if (verb === "status") {
    const state = disabledState(cwd);
    const envOff = envDisabled();
    const lines = [
      "wake: " + (state.disabled || envOff ? "OFF" : "ON"),
      state.disabled ? "  파일 플래그: off (" + (state.since ?? "?") + ")" : "  파일 플래그: on",
      "  CXC_BGWAKE: " + (envOff ? "off" : "unset/on"),
      "  작업 " + listRecords(cwd).length + "건",
    ];
    return { out: lines.join("\n"), code: 0 };
  }

  if (verb === "drain") {
    const session = flagValue(args, "--session");
    if (session === null) return { out: USAGE, code: 1 };
    const text = drainNow(cwd, session);
    if (args.includes("--json")) return { out: JSON.stringify({ delivered: text.length > 0, text }), code: 0 };
    return { out: text.length > 0 ? text : "미전달 완료 없음", code: 0 };
  }

  if (verb === "removal") return { out: removalText(), code: 0 };

  return { out: USAGE, code: 0 };
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv[0] === "hook") {
    process.exit(runHook(argv[1] ?? ""));
  }
  const { out, code } = run(argv, process.cwd());
  if (out.length > 0) process.stdout.write(out + "\n");
  process.exit(code);
}

// Entry guard mirrors skill-search/src/cli.ts: importing this module from a test must
// not execute main(), and a symlinked bin path must still match.
function realOrSelf(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const invokedPath = process.argv[1] ? realOrSelf(resolve(process.argv[1])) : "";
if (invokedPath === realOrSelf(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch {
    // An unhandled throw would reach stderr with a non-zero code, and Codex reads
    // exit 2 + stderr as a Stop BLOCK. Silence is the only safe failure here.
    process.exit(process.argv[2] === "hook" ? 0 : 1);
  }
}
