# wp1: Change the retirement decision at its existing owners

Depends on `000_plan.md` D1-D5. One C2 work-phase; no production code or new types.

## Exact edit map

| File | Before | After | Owner |
| --- | --- | --- | --- |
| `plugins/codexclaw/skills/loop/references/waiting.md` | final bullet retires after about three waits | Replace that bullet with compact progress/checkpoint/retirement sections. Keep existing peer boundary and V1/V2 wait visibility. | executor |
| `structure/20_pabcd_dispatch_doctrine.md` | DISPATCH-RETIRE-01 treats bare timeout as failure and implies unconditional replacement/reclaim | Refer to waiting's evidence rule; qualify timeout as actual terminal error only; keep bounded recovery but defer managed replacement/reclaim to protocol result. | executor |
| `plugins/codexclaw/skills/pabcd/references/delegation.md` | wait route and normal-timeout table; generic failure recovery | Clarify non-interrupting checkpoint delivery and timeout observation. Preserve transport schemas and existing first-fallback gates. | executor |
| `CHANGELOG.md` | empty Unreleased | One concise Fixed entry for #178, explicitly agent-followed guidance. | executor |

The waiting rule must distinguish substantive progress, suspected stagnation,
confirmed failure and unavailable observation. Refresh task-scoped observations
just before retiring. Liveness alone and file timestamps alone do not prove
semantic progress; no edits alone do not prove a stall. A healthy long command
may have sparse output and must be inspected before cancellation.

For suspected stagnation, request one non-interrupting checkpoint where supported,
then compare new evidence with the prior observation at a stated, task-appropriate
next review point. Repeated/no-op work must not reset that review point forever.
That review point is not a new cancellation budget. An unread queued message and
silence with missing visibility do not confirm a stall. If an opaque task cannot
be assessed within authorized limits, report the observation gap and seek direction
without claiming failure or silently replacing it.

Explicit cancellation, actual terminal failures and stated user/host resource
limits take precedence over progress. Keep cancellations/exhausted limits separate
from provider errors. Record pre-stop reason and last meaningful activity, then
post-stop terminal state, owned processes/partial edits, retained results and
remaining work. If termination is unknown, no overlapping writer may be started.
Managed `ready` requires a new claim; `main-direct` permits reclaim;
`reconcile`/`stop` permit neither. Never manufacture an OCX error code for a stall.

## Acceptance scenarios

These are semantic review cases, not executable runtime tests. A fresh C reviewer
must derive actions from the final policy and name ambiguities before acceptance.

| ID | Activation | Expected observable decision |
| --- | --- | --- |
| S1 | Four waits, no edits, nine meaningful reads; last read seconds ago | keep active; no retirement from polls/clean Git |
| S2 | A long build is running with sparse output and no expired limit | inspect command state; sparse output alone cannot retire |
| S3 | Same unchanged reads/status repeatedly; delivered checkpoint and later comparable observations show no advancement | eligible to retire once stagnation is evidenced at the stated review point; repeats alone only prompt investigation |
| S4 | No child log access; clean Git; checkpoint may still be queued | observation unavailable; no invented failure or unanswered-message deadline |
| S5 | Native V2 wait reports updates without final text | obtain the separately delivered answer before judging |
| S6 | Actual terminal error | preserve original error and use managed failure/reconciliation path |
| S7 | User cancels or an explicit resource bound expires despite progress | stop within authority; report cancellation/bound, not provider failure |
| S8 | Stop call returns previous status `running` | verify current terminal state and owned jobs before handoff |
| S9 | Failure report returns `reconcile` or `stop` | neither direct implementation nor replacement spawn |
| S10 | New irrelevant reads or identical heartbeats keep arriving | liveness only; do not postpone reassessment forever |
| S11 | Reviewer produces no files while making new findings | treat review artifacts as progress; never require an edit |
| S12 | Finished child still has a queued checkpoint response/turn | reconcile actual current status; a checkpoint request is not permission to duplicate work |

## Verification and delivery

Run `npm run gate`, the existing manifest-policy test command in `000_plan.md`,
and `git diff --check`. Review links and all active retirement-rule references.
The first two checks already ran successfully at baseline; whitespace check is
mechanical only. No typecheck/build is claimed for prose. Record per-scenario
review and limitations in `011_verification.md`, archive this unit at completion,
and publish an ordinary fork PR to upstream `dev` with `Closes #178`.
