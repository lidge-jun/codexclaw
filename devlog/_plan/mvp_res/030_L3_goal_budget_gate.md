# L3 (Decade 030) -- Goal Budget Gate

Status: DONE
Cluster: 1 - Phase: 1 - Shorthand: cxc
Source-of-record: 023_goal_convention_port.md; 023.2_pass3_P_plan.md; STATUS.md

## Goal (one slice)
Ship the unlimited-goal PreToolUse guard: deny `create_goal` calls that include `token_budget` or any
extra input key, and allow objective-only goal creation.

## Resolved (jun 2026-06-30) -- 내장 goal과의 관계
이 게이트는 codex 내장 `create_goal`을 **차단하지 않고 좁힌다**: codex `create_goal`은
`objective`+optional `token_budget`만 받으므로(`codex-rs/core/src/tools/handlers/goal.rs:23`),
budget/extra-key deny는 "objective-only 무제한 goal"만 통과시키는 정책 레이어로 작동한다(omo 패턴).
codexclaw는 goal을 저장/소유하지 않는다 — goal 생명주기는 codex 내장 런타임이 소유하고, 이 가드는
그 위에 얹힌 PreToolUse 정책일 뿐이다. (jun 결정: budget deny 유지)

## Why now / dependencies
L3 depends on L1/L2 because it shares the `pabcd-state` component CLI and Codex hook stdout contract.
It unblocks the Phase 1 goal discipline while leaving the harder interview-in-goal deny for a later
decision.

## Scope (decision-complete)
- Files added/edited:
  - `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts`
  - `plugins/codexclaw/components/pabcd-state/src/cli.ts`
  - `plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts`
  - `plugins/codexclaw/hooks/pre-tool-use-guarding-goal-budget.json`
  - `plugins/codexclaw/.codex-plugin/plugin.json`
- Guard input:
  - `hook_event_name: "PreToolUse"`
  - `tool_name`
  - `tool_input`
  - `session_id`
  - `cwd`
- Guard behavior:
  - non-`create_goal` tools pass through with empty stdout.
  - `create_goal` with `{ "objective": "..." }` passes through.
  - `create_goal` with any key other than `objective` emits a deny envelope.
- Deny envelope:
  - `hookSpecificOutput.hookEventName: "PreToolUse"`
  - `permissionDecision: "deny"`
  - `permissionDecisionReason`
  - `additionalContext`
- Runtime wiring:
  - hook JSON command: `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use`
  - plugin manifest includes `./hooks/pre-tool-use-guarding-goal-budget.json`.
- Must-NOT-Have:
  - No custom goal server.
  - No token budget workaround.
  - No hard deny on `request_user_input` in goal mode in Phase 1.
  - No dependence on thread-store reads.

## IPABCD micro-cycle
- I (if interview-bearing): not interview-bearing; the deferred interview-in-goal hard deny remains
  outside this loop.
- P: split goal protection into a stateless budget gate that ships now and a goal-mode interview hard
  deny deferred by Q-GM-1-followup.
- A: audit found three Pass 3 blockers: fail-open phase injection, unbounded injected turn history,
  and `Phase | null` typing; fixes were folded into the same component cycle.
- B: implemented `parsePreToolUse`, `applyGoalBudgetGuard`, `hook pre-tool-use` CLI dispatch, tests,
  and later B1 runtime hook wiring in the manifest.
- C: Pass 3 reached pabcd-state `node --test` 52/52; the later wiring-gap fix verified a budgeted
  `create_goal` produced `permissionDecision:"deny"`.
- D: done = guard is both implemented and reachable at runtime after the B1 fix in commit ba20b64.

## Acceptance (1-3 testable criteria)
- Budgeted `create_goal` input is denied with a clear unlimited-goal reason.
- Objective-only `create_goal` and unrelated tools return empty output.
- The PreToolUse hook is registered in the plugin manifest, not only implemented in source.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test` in pabcd-state at Pass 3 and final regression: 52/52 pass.
- End-to-end hook path after wiring fix: budgeted `create_goal` -> `permissionDecision:"deny"`.
- Final Phase 1 regression: root `npm test` 73/73.

## Commit unit (one atomic conventional commit)
One goal-gate commit: add PreToolUse parser/guard, tests, CLI branch, hook JSON, and manifest wiring.

## Blocked-on (jun decision id, if any)
None for budget gate. `Q-GM-1-followup` remains for the separate interview-in-goal hard deny.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/023_goal_convention_port.md`
- `devlog/_plan/260629_codexclaw_mvp/023.2_pass3_P_plan.md`
- `devlog/_plan/260629_codexclaw_mvp/160_pass1_7_completeness_audit.md`
- `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts`
- `plugins/codexclaw/hooks/pre-tool-use-guarding-goal-budget.json`
- codex-rs `hooks/src/schema.rs` PreToolUse input/output schema.
- omo `ulw-loop/src/codex-hook.ts` create_goal guard parity.
