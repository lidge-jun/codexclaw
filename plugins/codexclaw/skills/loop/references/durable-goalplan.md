# Durable goalplan

Read when creating, registering, amending, or inspecting a goalplan.
Mode selection and external permission scope remain in ../SKILL.md.

## HOTL Goal-Setting Rule

When entering HOTL mode, the main agent MUST create a host goal with
`create_goal` before relying on Stop-continuation. The objective should be
detailed, concrete, and approach the host limit of 4000 characters.

The objective must include:

- The concrete outcome to achieve.
- The file change scope and explicit out-of-scope boundaries.
- Acceptance criteria, including what counts as `DONE`, `NOOP`, `BLOCKED`,
  `UNSAFE`, `NEEDS_HUMAN`, or `BUDGET_EXHAUSTED`.
- Verification commands or evidence artifacts expected before each completion claim.
- The expected terminal outcome and the first work-phase to run.

A vague or short objective under 500 characters is a discipline violation for
HOTL mode. After `create_goal`, run `cxc loop init --objective "<same text>"
--session <id>` to create the durable local plan bound to the session.

After `loop init`, REGISTER the plan: fill `workPhases[]` (with tasks) and
`criteria[]` in the goalplan file before the first work-phase. An init-only
empty plan now FAILS `cxc loop validate` (E8), and `update_goal
{status:"complete"}` is hook-denied while the bound goalplan fails that gate
(GOAL-COMPLETE-GATE-01) — an unregistered plan cannot certify completion.

## Durable Goalplan

Use a durable goalplan when a Codexclaw loop needs more than a chat-local
checklist: goals, work phases, success criteria, checkpoints, evidence,
Interview OPEN ASSUMPTIONS, steering decisions, and quality gates.

### Contract

- Represent goals, work phases, success criteria, checkpoints, and evidence.
- Carry Interview OPEN ASSUMPTIONS into Plan/Audit instead of dropping them.
- Record steering decisions with rationale and evidence.
- Reject steering that weakens completion criteria or verification.
- Require a quality gate before final completion.

### Shipped schema

This is the on-disk shape under `.codexclaw/goalplans/<slug>/goalplan.json`
(+ `ledger.jsonl`). Fill these fields; do not invent parallel ones:

- `objective`, `slug`, `createdAt`, `updatedAt`.
- `workPhases[]` — each `{ id, title, status: pending|in_progress|done, dependsOn?, tasks[], criteriaIds[] }`.
  `workPhase.dependsOn` names prerequisite work phases. `activeWorkPhaseId` marks the current one.
  `workPhases[]` is APPEND-friendly mid-loop: when a new independent unit is discovered
  (LOOP-UNIT-CHAIN-01), add its work-phase (+ criteria) as a P-phase amendment instead of
  treating the plan as frozen at init or ending the goal.
  `tasks[]` are `{ id, title, status: pending|done, dependsOn?, outcome? }`.
  Task ids and task dependency references are phase-local: `task.dependsOn` names existing task ids in
  the same work phase, never a task in another phase. A done task carries a non-empty `outcome`; a pending
  task has no outcome.
- `criteria[]` — each `{ id, scenario, expectedEvidence, capturedEvidence, status: open|met }`.
  A criterion only reaches `met` when `capturedEvidence` is non-empty (fresh proof, not memory).
- `host` — `GoalplanHostLink { armed, armedAt, source: freeze|none }`. `armed` is provenance,
  intended to read true only after a freeze-boundary arm (the MAIN session created a host goal).
  No shipped CLI flips it automatically and codexclaw never writes the goal DB itself; treat it
  as the slot that records that boundary, not an auto-managed flag.

### CLI surface

- `cxc loop init --objective "<text>" [--session <id>]` — creates the local
  artifact and binds it to the session when a session id is supplied; it never
  writes the host goal DB.
- `cxc loop show --slug "<text>"` — renders the current plan summary.
- `cxc loop validate --slug "<text>"` — runs the E8 quality gate; it FAILS
  unless the plan is complete and every `met` criterion carries `capturedEvidence`.
- `cxc loop ready (--slug <slug> | --objective <text> | --session <id>) [--json]`
- `cxc loop add-work-phase --session <id> --id <id> --title <text> [--depends-on <id>]...`
- `cxc loop add-task --session <id> --work-phase <id> --id <id> --title <text> [--depends-on <task-id>]...`
- `cxc loop complete-task --session <id> --work-phase <id> --id <id> --outcome <text>`
- `cxc loop meet-criterion --session <id> --id <id> --evidence <text>`
- `cxc goalplan *` — deprecated alias for the same behavior during migration.

Repeat `--depends-on` once per prerequisite; comma-separated values are one id. Existing dependencies are
not edited after creation. `complete-task` and `meet-criterion` require non-empty proof text.

Ledger events are `created`, `workphase_started`, `workphase_done`, `task_done`, `criterion_met`,
`dependency_registered`, and `host_armed`. `dependency_registered` records only accepted definitions.

### Goal state

The host owns goal state in `goals_1.sqlite`; codexclaw reads it read-only to decide
HITL vs HOTL. A goalplan records work phases, criteria, evidence, and assumptions; it
is not another goal database.

## HOTL resource bounds

Goal-mode loops are unattended. The P-phase loop-spec for each HOTL work-phase must
state the tool/credential scope, write scope, token/cost budget, and wall-clock bound.
For C4 surfaces, an unstated unattended scope is an ESCALATE-class omission: stop and
ask before starting or continuing the loop. Hitting a resource bound is
`BUDGET_EXHAUSTED`, not `DONE`.
