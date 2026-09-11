/**
 * spawn.ts — detached background start, with no watcher process of our own.
 *
 * POSIX: the spawned shell records its own exit code.
 *   `( cmd ) > out 2>&1; printf %s $? > exit.tmp && mv exit.tmp exit`
 * A reader can then tell "finished with code N" from "shell vanished" without ever
 * having watched the process (registry.reconcile).
 *
 * Windows: a shell cannot do that job here. Measured on Windows 10.0.26200
 * (devlog/_plan/260909_bg_wake_component/030_windows_validation.md): a first hop launched
 * by libuv with detached + stdio "ignore" leaves its external children with no usable
 * stdout, so the batch redirect captured nothing (probe v3). A second hop that owns a
 * real handle does work (v4, v5). Making that hop Node also removes cmd quoting entirely.
 *
 * The helper is not there for capture — one detached hop with an inherited fd already
 * captures (v1). It is there because SOMETHING has to record the exit code after the
 * parent CLI is gone, which on POSIX is the shell itself.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { appendLedger, ensureDir, exitPath, outPath, removePath } from "./store.ts";
import { pidAlive, processStartToken, readRecord, reconcile, recordExists, writeRecord, type BgRecord } from "./registry.ts";

/** Short, human-quotable id. Collisions are re-rolled against the registry. */
export function newId(cwd: string, seed?: string): string {
  for (let i = 0; i < 20; i += 1) {
    const candidate = seed && i === 0 ? seed : "bg" + randomBytes(3).toString("hex");
    if (!recordExists(cwd, candidate)) return candidate;
  }
  return "bg" + Date.now().toString(36);
}

function shellQuotePosix(arg: string): string {
  return "'" + arg.split("'").join("'\\''") + "'";
}

/**
 * The Windows second hop. Written to disk next to the task's output so a failure is
 * inspectable rather than hidden inside an argv blob.
 */
export function buildWindowsHelper(): string {
  const L = [
    "'use strict';",
    "const { spawn } = require('node:child_process');",
    "const fs = require('node:fs');",
    "const [outPath, exitPath, ...cmd] = process.argv.slice(2);",
    "function record(code) {",
    "  try {",
    "    fs.writeFileSync(exitPath + '.tmp', String(code));",
    "    fs.renameSync(exitPath + '.tmp', exitPath);",
    "  } catch (err) {}",
    "}",
    "let fd = null;",
    "try { fd = fs.openSync(outPath, 'a'); } catch (err) {}",
    "const sink = fd === null ? 'ignore' : fd;",
    "let child = null;",
    "try {",
    "  child = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', sink, sink], windowsHide: true });",
    "} catch (err) {",
    "  // A synchronous throw would otherwise kill the helper before any listener runs,",
    "  // leaving no exit file at all.",
    "  record(127);",
    "  process.exit(0);",
    "}",
    "if (fd !== null) { try { fs.closeSync(fd); } catch (err) {} }",
    "let done = false;",
    "function finish(code) { if (done) return; done = true; record(code); process.exit(0); }",
    "// ENOENT arrives here. A cmd builtin is not an executable, but Windows does not",
    "// always report it as ENOENT: the measured `echo` came back as a normal exit 1.",
    "child.on('error', function () { finish(127); });",
    "child.on('exit', function (code, signal) { finish(code === null ? (signal ? 129 : 1) : code); });",
    "",
  ];
  return L.join("\n");
}

export function buildShell(command: string[], out: string, exit: string, helperPath?: string): { file: string; args: string[] } {
  if (process.platform === "win32") {
    const helper = helperPath ?? out + ".helper.cjs";
    writeFileSync(helper, buildWindowsHelper(), "utf8");
    // argv goes straight to CreateProcess, so there are no cmd quoting rules to get wrong.
    return { file: process.execPath, args: [helper, out, exit, ...command] };
  }
  const joined = command.map(shellQuotePosix).join(" ");
  // tmp + mv so a reader never sees a half-written exit code.
  const tmp = shellQuotePosix(exit + ".tmp");
  // A SUBSHELL, not a brace group: 'cxc bg run -- exit 3' inside { } would exit the
  // wrapper itself and the exit code would never be written.
  const script =
    "( " + joined + " ) > " + shellQuotePosix(out) + " 2>&1; printf %s $? > " + tmp + " && mv " + tmp + " " + shellQuotePosix(exit);
  return { file: "/bin/sh", args: ["-c", script] };
}

export type RunOptions = {
  cwd: string;
  sessionId: string | null;
  command: string[];
  note?: string | null;
  id?: string;
};

export function runBackground(opts: RunOptions): BgRecord {
  ensureDir(opts.cwd);
  const id = newId(opts.cwd, opts.id);
  const out = outPath(opts.cwd, id);
  const exit = exitPath(opts.cwd, id);
  // A stale exit file from a reused id would be read as an instant completion, and a
  // stale output file would be appended to on Windows (the helper opens with 'a')
  // while POSIX truncates. Clearing both keeps the two platforms saying the same thing.
  removePath(exit);
  removePath(out);
  const { file, args } = buildShell(opts.command, out, exit);
  const child = spawn(file, args, { cwd: opts.cwd, detached: true, stdio: "ignore", windowsHide: true });
  // Two jobs here. Swallowing the event keeps an ENOENT on the shell itself from
  // becoming an unhandled 'error' (stderr + non-zero exit, which a hook must never
  // produce). Marking the record failed keeps it from sitting at "running" forever,
  // since a shell that never started will never write an exit file either.
  child.on("error", () => {
    const current = readRecord(opts.cwd, id);
    if (current !== null && current.status === "running") {
      writeRecord({ ...current, status: "failed", exitCode: null, endedAt: new Date().toISOString() });
      appendLedger(opts.cwd, { event: "completed", id, exitCode: null, detail: "spawn failed" });
    }
  });
  child.unref();
  const pid = typeof child.pid === "number" ? child.pid : null;
  const rec: BgRecord = {
    id,
    sessionId: opts.sessionId,
    adoptedBy: null,
    cwd: opts.cwd,
    command: opts.command,
    note: opts.note ?? null,
    pid,
    startToken: pid === null ? null : processStartToken(pid),
    status: "running",
    exitCode: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    deliveredAt: null,
  };
  writeRecord(rec);
  appendLedger(opts.cwd, { event: "registered", id, pid, command: opts.command });
  return rec;
}

/**
 * Cancel is only meaningful for something still running, and only for the process we
 * actually started. Reconciling first stops us from overwriting a finished job's real
 * outcome; the start-token check stops us from signalling a recycled PID's group.
 */
export function cancel(input: BgRecord, now: string = new Date().toISOString()): BgRecord {
  const rec = reconcile(input);
  if (rec.status !== "running") return rec;
  // On Windows startToken is always null (no cheap start-time probe). Killing the helper
  // also stopped its child in the measured run, but that ran under an OpenSSH session
  // where a job object may have done the work, so an interactive session is not proven
  // (030_windows_validation.md section 3).
  const ours = rec.pid !== null && pidAlive(rec.pid) && (rec.startToken === null || processStartToken(rec.pid) === rec.startToken);
  if (ours && rec.pid !== null) {
    try {
      // Negative pid targets the detached process group, so children die with the shell.
      process.kill(-rec.pid, "SIGTERM");
    } catch {
      try {
        process.kill(rec.pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  }
  const next: BgRecord = { ...rec, status: "cancelled", endedAt: rec.endedAt ?? now };
  writeRecord(next);
  appendLedger(rec.cwd, { event: "cancelled", id: rec.id });
  return next;
}

