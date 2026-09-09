/**
 * memory-cli.ts — `cxc memory allow-write` (MEMORY-WRITE-GATE-01, 260909 wp1-A).
 *
 * The operator-issued half of the gate's authorization. The other half reads the
 * user's own prompt, which is the right default but is unavailable to a script, to a
 * replayed automation, or to a subagent (UserPromptSubmit no-ops on child turns —
 * cli.ts:339-341 — so a delegated worker is otherwise always denied). This command
 * is how those callers say yes ONCE, on the record.
 *
 * The grant is single-use: the gate spends it on the next memory write. A standing
 * "always allowed" flag would be the surface the gate exists to close, so there is
 * deliberately no such flag and no `--force` on the write itself.
 *
 * There is no `--revoke`, because an unspent grant is cleared by the write it
 * authorizes and a session state file is removable directly.
 */
import { isCanonicalSessionId, readState, withSessionLock, writeState } from "./state.ts";

export interface MemoryAllowWriteArgs {
  verb: "allow-write";
  sessionId: string;
  cwd: string;
}

export const MEMORY_USAGE = [
  "Usage:",
  "  cxc memory allow-write --session <id>",
  "",
  "Authorizes exactly ONE memory write (memories.add_ad_hoc_note, or an edit under",
  "~/.codex/memories) for that session. The grant is consumed by the next write.",
  "",
  "The ordinary path needs no command: when the user asks in their own words to",
  "remember something, the session records that request and the next write passes.",
].join("\n");

export function parseMemoryCliArgs(argv: string[], cwd: string): MemoryAllowWriteArgs | { error: string } {
  const verb = argv[0];
  if (verb !== "allow-write") {
    return { error: `unknown memory verb '${verb ?? ""}' (expected allow-write)` };
  }
  const i = argv.indexOf("--session");
  const sessionId = i >= 0 ? argv[i + 1] : undefined;
  if (!sessionId || !isCanonicalSessionId(sessionId)) {
    return { error: "missing required argument: --session <id> (must be a canonical session id)" };
  }
  return { verb: "allow-write", sessionId, cwd };
}

export function runMemoryCli(args: MemoryAllowWriteArgs): { output: string; code: number } {
  try {
    // Locked read-modify-write: writeState publishes a whole snapshot, so an
    // unsynchronized grant can be erased by a concurrent hook writing its own field
    // (the reasoning state.ts:604-620 records for verdicts applies to an
    // authorization too).
    withSessionLock(args.cwd, args.sessionId, () => {
      const state = readState(args.cwd, args.sessionId);
      writeState(args.cwd, { ...state, memoryWriteGrant: true });
    });
  } catch (err) {
    return {
      output: `memory allow-write: could not record the grant (${err instanceof Error ? err.message : String(err)})`,
      code: 1,
    };
  }
  return {
    output: `memory allow-write: session ${args.sessionId} may perform ONE memory write; the next write consumes this grant.`,
    code: 0,
  };
}
