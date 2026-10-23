# 261023 Link criteria to the phase that waits on a decision (#314)

## Problem

`durable-goalplan.md` promises that at IDLE, Stop releases when every remaining
phase and unmet criterion waits on an open user decision. `remainingWorkAwaitsDecisions`
counts a criterion as waiting only when a waiting phase lists it in `criteriaIds`.
No verb could set that list: `add-work-phase` and the steering op always wrote
`criteriaIds: []`, and `ask` only set `awaitsDecision`. A criterion that needed
the user's answer (a PR merged before its exact-head CI) kept Stop blocking forever.

## Design

- `linkGoalplanCriteria(plan, phaseId, ids)`: pure, validates the phase exists and
  is pending or in progress and every id is a known criterion; unchanged when all
  are already listed.
- CLI: `loop link-criterion --session --work-phase --criterion...`,
  `add-work-phase --criterion...`, `ask --criterion...` (requires `--work-phase`).
  All write under the goalplan lock through the existing paths.
- Steering `add-work-phase` accepts `criteriaIds`; the integrity check already
  rejects unknown ids.
- `decisionWait(plan)` returns the waiting phases and the unmet criteria none of
  them list. The IDLE Stop block uses it to name those criteria and print the
  `link-criterion` command. Explicit linking was chosen over treating unowned
  criteria as waiting, which would let a goal rest while work nobody owns is open.

## Verification

- `test/criterion-decision-link.test.ts` drives the CLI and the Stop hook: the
  issue's repro blocks and names the command; each linking route releases Stop;
  `decide` resumes the loop; bad ids and phases are refused without a write.
  Four of five fail on dev (the refusal case passes there because the verbs do not exist).

