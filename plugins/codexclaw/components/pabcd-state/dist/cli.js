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
import { handleStop, handleUserPromptSubmit } from "./hook.js";
import { parseStop, parseUserPromptSubmit } from "./parse.js";
import { applyGoalBudgetGuard, applyGoalModeInterviewGuard, parsePreToolUse } from "./goal-gate.js";
import { parseFreezeArgs, runFreeze } from "./freeze-cli.js";

function readStdin()         {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main()       {
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

  // Fail-safe: any handler/state IO failure must not block codex. Swallow the
  // error, emit nothing, and exit 0 (matches the docstring guarantee).
  try {
    if (event === "user-prompt-submit") {
      const payload = parseUserPromptSubmit(raw);
      if (payload) output = handleUserPromptSubmit(payload);
    } else if (event === "stop") {
      const payload = parseStop(raw);
      if (payload) output = handleStop(payload);
    } else if (event === "pre-tool-use") {
      const payload = parsePreToolUse(raw);
      if (payload) {
        // goal-budget guard (create_goal) OR goal-mode interview deny
        // (request_user_input). Each is tool-name-scoped, so at most one fires.
        output = applyGoalBudgetGuard(payload) || applyGoalModeInterviewGuard(payload);
      }
    }
  } catch {
    output = "";
  }

  if (output) process.stdout.write(output);
  process.exit(0);
}

main();
