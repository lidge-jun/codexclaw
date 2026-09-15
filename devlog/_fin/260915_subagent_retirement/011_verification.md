# Verification of the retirement guidance

The changed artifact is coordinator guidance. Structural checks and semantic
review are separate evidence; neither is a guarantee of future model compliance.

## Independent review

A fresh C reviewer received the four changed source documents and twelve
observation-only scenarios, without the plan or its expected-answer matrix.
It independently derived the following actions and returned PASS, no blockers.
Main compared the results with the pre-written acceptance rows.

| Scenario | Derived action | Result |
| --- | --- | --- |
| S1 meaningful reads, no edits | continue bounded waiting | matches |
| S2 healthy long command | inspect state; sparse output alone is not failure | matches |
| S3 evidenced stagnation | retire only after evidence, then verify shutdown and permitted recovery | matches |
| S4 unavailable observations | report the gap; queued input/timeouts do not prove failure | matches |
| S5 V2 mailbox | obtain separately delivered answer | matches |
| S6 terminal error | preserve error and follow managed reconciliation | matches |
| S7 cancellation/explicit limit | stop; do not automatically continue | matches |
| S8 previous status running | withhold overlapping work until current state and owned jobs are checked | matches |
| S9 reconcile/stop result | no replacement or direct implementation | matches |
| S10 irrelevant activity | keep reassessment point; noise is not progress | matches |
| S11 reviewer findings | continue without requiring edits | matches |
| S12 queued checkpoint after completion | reconcile current state before handoff | matches |

The reviewer briefly stumbled over the Unobservable bullet's comma list and
the changelog's verb "retired". Main clarified insufficient observations as
the condition and changed the historical mechanism to "instructed coordinators
to retire". These are readability fixes, not new runtime behavior. The same
reviewer checked those two edits and returned PASS with no remaining notes;
all twelve independently derived actions were unchanged.

## Checks observed by the independent reviewer

- `npm run gate`: exit 0; no status/claim/count/inventory drift.
- `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/manifest-policy.test.mjs`:
  exit 0, 7 pass, 0 fail.
- `git diff --check`: exit 0.
- Source hashes were stable during the initial four-file review.

The existing route test reads the waiting reference's routing path. The gate
walks skill references and structure documents for claim hygiene. These checks
do not execute a model's retirement decisions. The scenario matrix is a semantic
review, not a deterministic unit test or an instrumented lifecycle replay.

## Initial policy revision: limits and retained evidence

At the initial policy revision, no runtime code, model routing, installed plugin
bytes, configuration or tests were changed. No phrase-presence test or unused helper was introduced. Source
tests cannot establish cross-model compliance or delivery timing on every host.
A future coordinator ignoring substantive progress despite reading this policy
would falsify the assumption that clearer guidance alone is sufficient.

Raw native dispatch handles, reviewer responses and check receipts remain in
untracked session evidence. Public evidence is summarized here; no private
session transcript or host-specific path is published. The contribution is
tracked by [issue #178](https://github.com/lidge-jun/codexclaw/issues/178).

## PR review follow-up: plan template recovery

[Review comment](https://github.com/lidge-jun/codexclaw/pull/179#discussion_r4009201474)
identified an unconditional two-failure reclaim instruction still present in
`pabcd/references/plan-output.md`. The earlier review treated it as shorthand;
that was insufficient because coordinators use the template to write plans.

The escalation row now distinguishes unmanaged recovery from configured first
fallback and links to the existing recovery owner. Main reclaims only on
`main-direct` under managed dispatch; `reconcile` and `stop` authorize neither
reclaim nor replacement, even after two failures. Unmanaged reclaim requires
prior work to have stopped. The P-phase amendment requirement is retained.

Manual comparison with `delegation.md` and DISPATCH-RETIRE-01 confirmed the
`main-direct`, `reconcile`, `stop`, and unmanaged-recovery cases. Fresh checks:
`npm run gate` passed; manifest-policy tests passed 7/7; `git diff --check`
was clean. These remain document checks and semantic review, not runtime proof.

## PR review follow-up: architect recovery

[Review comment](https://github.com/lidge-jun/codexclaw/pull/179#discussion_r4012925635)
found the same incomplete propagation in the architect-specific recovery clause.
Accepted: a role-specific instruction must not bypass the common recovery owner.
The clause now defers managed retries and reclaim to the returned action, and
limits the same-handle/two-context rule to unmanaged dispatch. Prior work must
be stopped and inspected before unmanaged recovery. Missing architect consultation
still blocks dependent completion, including when main reclaims planning.

Reviewed recovery references in the active skills and structure doctrine. Manual
comparison covered managed `ready`, `main-direct`, `reconcile`, `stop`, unmanaged
recovery, and the unmet-consultation constraint. Fresh `npm run gate`, all 7
manifest-policy tests, and `git diff --check` passed. These are document checks
and main's semantic review; the initial independent scenario review is unchanged.

## PR review follow-up: unusable final output

[Review comment](https://github.com/lidge-jun/codexclaw/pull/179#discussion_r4012960563)
identified another owner mismatch: the doctrine includes nonsense output as a
failure, but the waiting classification only named terminal errors and stagnation.
Accepted: a transport-successful final response can still fail the task packet.
The waiting reference now includes demonstrably nonsensical or unusable final
output and requires concrete evidence. Interim updates and supported disagreement
alone do not count as failure. Existing shutdown and managed recovery rules apply.

Fresh `npm run gate`, all 7 manifest-policy tests, and `git diff --check` passed.
These checks cover document hygiene and routes, not the output-quality judgment.

## Later review: managed recovery reachability

[Review comment](https://github.com/lidge-jun/codexclaw/pull/179#discussion_r4013017929)
found that recognizing task failures did not make managed recovery executable:
descriptive stagnation or unusable-output reports remained `reconcile` even after
termination was confirmed. A source review at `20e50485` correctly verified that
unknown error prose cannot rotate providers, but missed the need for a separate
task-failure path. Main reproduced that gap with the real state machine.

The follow-up cycle is recorded in `devlog/_fin/260915_task_failure_recovery/`.
Its runtime/CLI evidence supersedes the initial policy-only scope above; it must
not be inferred from the earlier semantic scenario review.
