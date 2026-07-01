# Pass 2 (P) — WP0: L1–L7 doc<->impl reconcile plan

Status: P · Goal ea226d1d-2cd · 2026-06-30 · cxc
Scope: find and fix every mismatch between the L1–L7 loop docs (claimed DONE) and the actual
shipped component source/tests, BEFORE advancing to L8+. Code-bearing where gaps are real.

## Baseline (measured)
- `npm test` = 73/73 green; build idempotent; hook e2e + MCP handshake pass.
- Components present: pabcd-state (state/fsm/goal-gate/hook/parse/cli + 4 tests),
  config-guard (activate/deactivate/features/cli + 2 tests), provider-bridge (cli.ts only),
  subagent-config (mcp.ts only).
- Hooks present: pre-tool-use-guarding-goal-budget, session-start-ensuring-provider-bridge,
  stop-checking-pabcd-continuation, user-prompt-submit-checking-pabcd-trigger.
- Skills: dev + 11 dev-* + pabcd. Agents: explorer/reviewer/executor .toml.

## Audit questions (A-gate, parallel gpt-5.5 subagents)
- AQ1 (L1-L3): does pabcd-state src match each doc's Scope/Acceptance exactly? state.ts session
  scope + fail-safe read + atomic write + ledger; fsm.ts pure gates (P needs interview, B needs
  auditPassed, D needs checkPassed); goal-gate.ts create_goal deny on extra keys.
- AQ2 (L4-L5): are the 13 dev-* router skills + 3 agent roles spec-complete vs L4/L5 docs
  (recipe=dev-debugging, B-opt2 inline roles)? openai.yaml implicit policy correct?
- AQ3 (L6-L7): config-guard activate/deactivate idempotent + revertible vs L6; build.mjs
  aggregation + S1-S5 gate vs L7. Any DONE claim not backed by a test?
- AQ4 (cross-ref): compare against cli-jaw (principle), lazycodex (.lazycodex clone, practice),
  jawcode (api-level) for contradictions the docs missed.

## Plan (diff-level, after audit returns)
1. For each confirmed gap: either fix code to match doc, or harden doc to match shipped reality
   (whichever is correct) — never leave a DONE doc lying.
2. Keep npm test green (extend tests if a gap had no coverage).
3. Atomic commit per gap class.

## Acceptance (WP0 D)
1. Every L1-L7 doc's Acceptance criteria has a corresponding passing test or CLI evidence.
2. No DONE doc references a file/behavior that does not exist in src.
3. npm test still green (>=73); any newly covered gap adds a test.

## QA channel
- `npm test` tail; per-component test counts.
- grep: doc "Files added/edited" paths all resolve in src.

## Commit unit
one atomic commit per reconciled gap class: `fix(<comp>): ...` or `docs(plan): reconcile L<n> ...`
