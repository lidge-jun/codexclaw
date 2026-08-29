# 001 root cause — why a brand-new goalplan cannot be completed

Research doc. No diffs here; the change map lives in `010`/`020`.

## The chain

1. `buildGoalplan()` (`pabcd-state/src/goalplan.ts:897`) sets
   `schemaVersion: SUPPORTED_MAX_SCHEMA_VERSION`, and that constant is `3`
   (`:53`). Every plan created by `cxc loop init` therefore declares v3.
   Introduced by `d9259ca6` ("schema v3 stores and preserves dependsOn and task
   outcome"); `git log -L` on that range shows the line did not exist before.
2. `finalGateReasons()` (`:1499`) returns early only for `version < 2`. v3 is
   not < 2, so the v2 rules apply to every new plan.
3. With no `plan.finalGate`, it pushes
   `schemaVersion 2 requires a finalGate - open a final-gate review round with
   \`cxc review-round open --lane final_gate --session <id>\`` (`:1526-1529`).
4. `validateGoalplan` is what `GOAL-COMPLETE-GATE-01` consults, so
   `update_goal {status:"complete"}` is denied.

## Why the suggested escape does not exist

- `review-round-cli.ts:236` hardcodes `purpose: "plan_audit"`.
- Its parser (`:103-126`) handles `--session`, `--cwd`, `--plan-path`,
  `--reason`, `--json`. No `--lane`.
- `rg '"--lane"'` across the repo: zero hits.
- No `final-gate` verb in `cli.ts`, `goalplan-cli.ts`, or `orchestrate-cli.ts`.
- `finalGate` outside tests appears only as a type field, a reviver read, and
  validation reads. Nothing writes it.
- `review-observer.ts` watches `plan_audit` rounds only (`:99`, `:113`, `:147`),
  so even a hand-made `final_gate` round would never receive a verdict.

So the remediation text names a flag that has never existed, and the state it
asks for is unreachable. `goalplan.ts:1523` admits as much in a comment.

## The codebase already works around it

`test/work-phase-states.test.ts:36-39` overrides `schemaVersion: 1` after calling
`buildGoalplan()`, with the comment: "since wp2 (260829) buildGoalplan() declares
v3, whose final-gate rule would add unrelated reasons to every
validateGoalplan() assertion here." Other suites do the same. When tests must
downgrade the default to stay meaningful, the default is wrong — the tests found
this before any user did.

## Scope of the blast radius

Not just `update_goal`. Any surface that calls `validateGoalplan` on a freshly
created plan inherits a permanent failure reason. This session's own goalplan
reproduces it live: `.codexclaw/goalplans/make-the-v1-goalplan-flow-the-working-default-in/goalplan.json`
declares `"schemaVersion": 3` and `cxc loop validate` reports the finalGate
reason alongside the genuine open work.

## What v3 actually buys, and why keeping it matters

v3 adds exactly ONE rule pair (`:1304-1312`): a `done` task must carry a
non-empty `outcome`, and a `pending` task must not have one. That is reachable —
`cxc loop complete-task --outcome <text>` always writes an outcome (`:1154`), so
the rule is satisfied by the normal command.

Correction from the plan audit: an earlier draft of this doc also credited v3 with
dependency-graph validation. That is wrong. The reviewer probed v1 and v3 with a
cycle and with an unknown reference and got identical failures — the graph checks
at `:1274-1302` and `:1316-1320` are NOT version-gated. So v1 gives up strictly
less than the first draft claimed: one task-outcome rule, which `complete-task`
satisfies incidentally anyway.

v3 is not the problem; forcing it on every new plan while one of its sibling
rules is unreachable is the problem.
