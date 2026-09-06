# Hook guidance implementation

Dependencies: existing common hook emitters, current async recipe, unchanged
goal guard/Interview ledger. No new field/enum, serialization or permission surface.

| File | Change |
|---|---|
| `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts` | Add a private question-pointer renderer; append its output in both existing common emitters |
| `plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts` | Extend existing output/compiled CLI cases to observe question pointer, optional continuation and main/child boundary without increasing test counts |
| `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts` | Clarify GOAL_MODE_DENY_REASON: blocking Interview tool is denied; exposed async mid-work questions remain subject to host rules and expect no answer |
| `plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts` | Extend existing guard cases to distinguish async passthrough for all goal states from synchronous denial |
| Corresponding two `dist/*.js` files | Regenerate via repository build, keep source/dist parity |
| `plugins/codexclaw/skills/interview/SKILL.md` | Explicit transport exception: use synchronous request_user_input; no async replacement for persisted Interview rounds |
| `plugins/codexclaw/skills/dev/references/async-questions.md` | State phase/goal-independent permission when exposed/host-allowed, no reply expectation, and actual common-hook discovery boundary |
| `structure/60_native_capabilities.md` | Replace prior docs-only statement with common-hook delivery plus unchanged permission/capture limitations |

## Pointer contract

Private renderer returns a single paragraph beginning `[codexclaw] User questions:`:
main agents may leave useful questions during work, including active goals;
outside Interview prefer exposed/allowed request_user_input_async; do not expect
replies or wait; continue authorized work, make reasonable assumptions, incorporate
late replies, ask distinct useful questions without reminders; Interview uses
request_user_input only; absent tools remain absent, silence grants no approval;
subagents send question candidates to main; route details to the existing dev recipe.

Both `runMapAffordanceSessionStart` and `runPostCompactAffordance` add the same
renderer to their `lines` arrays. No hook JSON, model probing, goal IO or FSM
transition is added. Existing handlers determine their own event envelopes.

GOAL_MODE_DENY_REASON changes from a generic `interview / request_user_input is
denied` statement to a blocking/synchronous-specific reason plus permitted async
continuation guidance. Keep its callers and all decision branches unchanged.

## Verification

Baseline already executed: `node --test` with the two named test files → 47 pass,
0 fail. They directly import the changed TS owners; the map suite also executes
dist CLI entrypoints. Extend existing cases, verify their new runtime-output
assertions fail before implementation, then build and rerun. New checks are required
contract extensions; no assertion deletion or test-count/badge adjustment is planned.

`node plugins/codexclaw/scripts/build.mjs` compiles all component src files via
`compileSource`, writes corresponding dist files, and validates manifest targets.
Baseline build is not needed to mutate generated output during P; its verified
call chain is `build → compileComponent → compileSource`. Run after implementation.
Run the existing dist-freshness suite, docs gate and diff whitespace check. No broad
local repository suite; inspect PR CI for the configured platform matrix.
