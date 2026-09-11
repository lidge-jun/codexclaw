/**
 * hook.ts — pure hook logic. No process IO; cli.ts owns stdin/stdout.
 *
 * Stop:              {"decision":"block","reason":...} ONLY when an undelivered
 *                    completion exists. Everything else returns "" (release).
 * UserPromptSubmit:  hookSpecificOutput.additionalContext only. A block here would
 *                    reject the user's prompt (codex-rs events/user_prompt_submit.rs).
 * SessionStart:      adopt orphaned completions into this session, then inject.
 *
 * FAIL-OPEN everywhere: any throw becomes "". An empty stdout with exit 0 is the only
 * safe "do nothing" — malformed JSON is a Failed hook and exit 2 is read as a BLOCK.
 */
import {
  adoptOrphans,
  describeRecord,
  hasAnyTask,
  markDelivered,
  selectWake,
  wakeSuppressed,
  type BgRecord,
} from "./registry.ts";

export type HookPayload = {
  session_id?: unknown;
  cwd?: unknown;
  source?: unknown;
  stop_hook_active?: unknown;
};

/**
 * Falls back to CODEX_THREAD_ID: a payload without session_id would otherwise leave
 * every completion permanently undelivered, since the wake requires an owner match.
 */
export function payloadSessionId(payload: HookPayload, env: NodeJS.ProcessEnv = process.env): string | null {
  if (typeof payload.session_id === "string" && payload.session_id.length > 0) return payload.session_id;
  const fromEnv = (env.CODEX_THREAD_ID ?? "").trim();
  return fromEnv.length > 0 ? fromEnv : null;
}

export function payloadCwd(payload: HookPayload, fallback: string): string {
  return typeof payload.cwd === "string" && payload.cwd.length > 0 ? payload.cwd : fallback;
}

const AFFORDANCE = "[codexclaw bg] 백그라운드 작업은 `cxc bg list`로 보고 `cxc bg get <id> --tail 40`으로 출력을 읽습니다.";

export function completionText(records: BgRecord[]): string {
  const head = "[codexclaw bg] 백그라운드 작업 " + records.length + "건이 끝났습니다.";
  const body = records.map(describeRecord).join("\n");
  const tail = "출력은 `cxc bg get <id> --tail 40`으로 봅니다. 전체 목록은 `cxc bg list`.\n결과를 확인하고 필요한 후속 작업을 이어가세요.";
  return [head, body, tail].join("\n");
}

function contextEnvelope(eventName: string, text: string): string {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } });
}

/** Stop. Returns "" (release) or the block envelope. Never throws. */
export function handleStop(payload: HookPayload, fallbackCwd: string, env: NodeJS.ProcessEnv = process.env): string {
  try {
    const cwd = payloadCwd(payload, fallbackCwd);
    if (wakeSuppressed(cwd, env)) return "";
    const sessionId = payloadSessionId(payload, env);
    const due = selectWake(cwd, sessionId);
    if (due.length === 0) return "";
    const reason = completionText(due);
    if (reason.trim().length === 0) return "";
    // Stamp BEFORE emitting: a second Stop must not block on the same records.
    // The cost is an accepted loss if the runtime discards this block (000_plan "허용 손실").
    markDelivered(due);
    return JSON.stringify({ decision: "block", reason });
  } catch {
    return "";
  }
}

/**
 * Manual collection for `cxc bg drain`. Deliberately does NOT consult the off switch:
 * the switch silences automatic wakes, and a human or agent asking for the results
 * explicitly should still get them.
 */
export function drainNow(cwd: string, sessionId: string | null): string {
  try {
    const due = selectWake(cwd, sessionId);
    if (due.length === 0) return "";
    const text = completionText(due);
    markDelivered(due);
    return text;
  } catch {
    return "";
  }
}

/** UserPromptSubmit. Injection only — never a decision. */
export function handleUserPromptSubmit(payload: HookPayload, fallbackCwd: string, env: NodeJS.ProcessEnv = process.env): string {
  try {
    const cwd = payloadCwd(payload, fallbackCwd);
    if (wakeSuppressed(cwd, env)) return "";
    const sessionId = payloadSessionId(payload, env);
    const due = selectWake(cwd, sessionId);
    if (due.length === 0) return "";
    const text = completionText(due);
    markDelivered(due);
    return contextEnvelope("UserPromptSubmit", text);
  } catch {
    return "";
  }
}

/**
 * SessionStart. Adoption happens even when the wake is switched off, because it only
 * re-points ownership; without it a restart strands every undelivered completion.
 * The injection itself still respects the switch.
 */
export function handleSessionStart(payload: HookPayload, fallbackCwd: string, env: NodeJS.ProcessEnv = process.env): string {
  try {
    const cwd = payloadCwd(payload, fallbackCwd);
    const sessionId = payloadSessionId(payload, env);
    const adopted = adoptOrphans(cwd, sessionId);
    if (wakeSuppressed(cwd, env)) return "";
    if (!hasAnyTask(cwd, sessionId)) return "";
    const lines: string[] = [];
    if (adopted.length > 0) {
      lines.push("[codexclaw bg] 이전 세션에서 끝난 백그라운드 작업 " + adopted.length + "건이 아직 전달되지 않았습니다.");
      lines.push(adopted.slice(0, 5).map(describeRecord).join("\n"));
    }
    lines.push(AFFORDANCE);
    return contextEnvelope("SessionStart", lines.join("\n"));
  } catch {
    return "";
  }
}

