#!/usr/bin/env node
/**
 * pabcd-state — UserPromptSubmit + Stop hook entry.
 *
 * Responsibility:
 *  - UserPromptSubmit: detect PABCD/interview triggers in the prompt and
 *    inject the matching phase directive as additionalContext (idempotent).
 *  - Stop: evaluate the FSM and decide whether to continue to the next phase.
 *
 * State lives in files (no orchestrator server):
 *  - .codexclaw/state.json   (current phase + derived flags)
 *  - .codexclaw/ledger.jsonl (audit trail of transitions)
 *
 * Phases: Plan -> Audit -> Build -> Check -> Done.
 *
 * MVP stub: real FSM + injection lands in MVP plan step 03.
 */
const [, , kind, event] = process.argv;
if (kind === "hook" && (event === "user-prompt-submit" || event === "stop")) {
  // TODO(mvp-03): read state, evaluate FSM, emit additionalContext/decision.
  process.exit(0);
}
process.exit(0);
