#!/usr/bin/env node
/**
 * pabcd-state — UserPromptSubmit + Stop hook entry.
 *
 * Reads the codex hook JSON payload from stdin, dispatches by event kind, and
 * writes any additionalContext envelope to stdout. Fail-safe: unknown events,
 * empty stdin, or unparseable payloads exit 0 with no output (never block codex).
 *
 *  - UserPromptSubmit: detect IPABCD/interview trigger → inject phase directive
 *    (idempotent per session+turn). See hook.ts/handleUserPromptSubmit.
 *  - Stop: PASSIVE in Pass 2 (no output, no ledger). See hook.ts/handleStop.
 *
 * State lives in files (no orchestrator server):
 *  - .codexclaw/sessions/<session>.json  (per-session phase + injectedTurns)
 *  - .codexclaw/ledger.jsonl             (audit trail; unused by passive Stop)
 *
 * argv: [node, cli.ts, kind, event] e.g. ["...", "...", "hook", "user-prompt-submit"].
 */
import { readFileSync } from "node:fs";
import { handleStop, handleUserPromptSubmit } from "./hook.ts";
import { parseStop, parseUserPromptSubmit } from "./parse.ts";
import { handlePreToolUseFailClosed } from "./goal-gate.ts";
import { parseFreezeArgs, runFreeze } from "./freeze-cli.ts";

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main(): void {
  const [, , kind, event] = process.argv;

  // `freeze` command path (L10.3 runtime wiring): build/preview the freeze
  // manifest + run a stale check. Separate from the hook stdin path.
  if (kind === "freeze") {
    try {
      const out = runFreeze(parseFreezeArgs(process.argv.slice(3)));
      process.stdout.write(`${out}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`freeze failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }

  if (kind !== "hook") {
    process.exit(0);
  }

  const raw = readStdin();
  let output = "";

  // pre-tool-use is handled by a dedicated FAIL-CLOSED dispatcher: a thrown
  // error on a request_user_input call must DENY (R-9), never fail open. It is
  // outside the generic fail-open try below so the swallow cannot reopen the
  // interview in goal mode.
  if (event === "pre-tool-use") {
    process.stdout.write(handlePreToolUseFailClosed(raw));
    process.exit(0);
  }

  // Fail-safe: any handler/state IO failure for the remaining events must not
  // block codex. Swallow the error, emit nothing, and exit 0.
  try {
    if (event === "user-prompt-submit") {
      const payload = parseUserPromptSubmit(raw);
      if (payload) output = handleUserPromptSubmit(payload);
    } else if (event === "stop") {
      const payload = parseStop(raw);
      if (payload) output = handleStop(payload);
    }
  } catch {
    output = "";
  }

  if (output) process.stdout.write(output);
  process.exit(0);
}

main();
