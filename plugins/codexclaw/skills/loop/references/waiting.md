# Waiting on work

Read while awaiting dispatched work or long external processes in either HITL or HOTL.

These rules concern this task's work and delegated children. Independent peer
timeouts grant no retirement, replacement or forced wake authority; before peer
contact, read [peer collaboration](../../dev/references/peer-collaboration.md).

## Wait visibility (LOOP-WAIT-VISIBILITY-01, DEFAULT)

While awaiting children or long external processes, keep waits bounded by the
live host contract and give a short progress update between waits naming the work
and elapsed time. Communication cadence does not require another API call.

- For `wait_threads` bounds, batching and cursors, read [lane dispatch](lane-dispatch.md).
- For V1/V2 wait shapes and DISPATCH-CONSUME-ONCE-01, read
  [delegation](../../pabcd/references/delegation.md#detect-the-family-first-dispatch-schema-detect-01-strict).
- A timeout is not a reason to end the turn or to poll forever. Continue within
  authority, or apply the wake contract below before yielding.

## Observer budget

**DISPATCH-POLL-BUDGET-01 (DEFAULT).** Lanes and the observer may share credentials
and API quota. Main owns the aggregate: use one coordination observer,
deduplicate snapshots, fetch each PR once per scheduled observation by default,
and use minutes rather than seconds for long hosted jobs.
Before sustained polling, inspect the relevant budget (for example
`gh api rate_limit`) and reserve headroom for workers. Back off on evidenced
limit responses; a 403 alone does not prove exhaustion, accounts may differ,
and rate-limit categories are not interchangeable. This guidance is not a limiter.

## Wake before yielding

**DISPATCH-WAKE-01 (DEFAULT).** Before yielding with work running, name its
continuation owner and mechanism, verify the wake is active and retain its ID.
If no wake is available, continue in the turn within authority or report the
limitation; never assume automatic resumption. Deleting a wake removes only the
trigger, neither completes a goal nor authorizes reinstating it. Muting
notifications leaves monitoring active; a scheduled run grants no merge authority.

## Progress, stagnation, failure, unobservable (LOOP-WAIT-EVIDENCE-01, DEFAULT)

Wait count and elapsed time are not the retirement signal; evidence is. Before
retiring a dispatched agent, refresh task-scoped observations (VCS diff, owned
processes, recent output) and classify what you actually see:

- **Progress** — new evidence advancing the packet: edits, findings, reads,
  command events, delivered artifacts. A read-only reviewer produces findings,
  not edits; never require a file change from one. Liveness alone — identical
  heartbeats, repeated no-op reads or messages — is not semantic progress and
  does not postpone reassessment forever. On V2, a wait reporting updates is
  not the answer: obtain the separately delivered final message first.
- **Suspected stagnation** — comparable observations show no advancement.
  Where supported, send one non-interrupting checkpoint asking for findings,
  remaining work and the next artifact; a queued-but-unread checkpoint is not
  proof of a stall. Compare new evidence with the prior observation at one
  stated, task-appropriate next review point. That point fixes when you look
  again; it is not a new cancellation budget, and repeated no-op activity does
  not reset it.
- **Confirmed failure** — an actual terminal error, final output demonstrably
  nonsensical or unusable for the task packet, or stagnation evidenced at the
  stated review point. Record concrete output evidence for an output-failure
  judgment; interim updates and supported disagreement alone are not failures.
  A wait timeout alone is a normal outcome, and a healthy long command may emit
  sparse output — inspect command state before treating silence as failure.
  Missing edits alone do not prove a stall.
- **Unobservable** — available observations cannot establish progress or
  failure; for example, child state is inaccessible and the only signals are
  a clean tree and a checkpoint that may still be queued. Report the observation
  gap and seek direction within authorized limits; never manufacture a failure
  or an OCX error code for a stall.

Explicit cancellation, actual terminal failures and stated user/host resource
limits outrank progress evidence; report cancellations and exhausted bounds as
what they are, separate from provider errors, and preserve the original error.

## Retirement and handoff

Retire on confirmed failure or an explicit cancellation/bound, not on a wait
count. Record the pre-stop reason and last meaningful activity; after the stop
call, verify the actual terminal state, owned processes and partial edits — a
returned *previous* status of `running` is not proof of termination. If
termination is unknown, start no overlapping writer. A finished child may still
hold a queued checkpoint response; reconcile its real status, and never treat a
checkpoint request as permission to duplicate its work.

**DISPATCH-RETIRE-01 (DEFAULT).** For confirmed failure without managed dispatch,
allow at most one retry on the same handle, then a fresh context carrying the
failure and plan. If two distinct contexts fail the same packet, main reclaims
only after prior work has stopped and partial results are inspected. Transport
failures stop equivalent retries; see [failure classes](../../pabcd/references/delegation.md#failure-classes).
Managed recovery replaces this retry allowance; follow
[configured first fallback](../../pabcd/references/delegation.md#configured-first-fallback).
Cancellation or an exhausted bound grants no
continuation: stop within authority and report the cancellation or bound,
never as a provider failure.

For managed stagnation, unusable output and provider failures, follow the
[report contract](../../pabcd/references/delegation.md#configured-first-fallback).
Do not invent provider codes or report unvalidated work complete.

## Automation ownership before mutation

Automation IDs are host-global. Before updating or deleting one, read its exact
`automation.toml` and verify the heartbeat's `target_thread_id` matches the task
being operated on. A shared repository name, numeric suffix, nearby timestamp or
list position does not establish ownership or a duplicate. Use a task-specific
name and retain the confirmed ID. Prefer supported in-place updates; do not
assume an older delete-and-recreate workaround is still necessary.

Codexclaw's automation hook can deny foreign or unknown ownership on matching
native tool calls when the hook is loaded and trusted. Inner Code Mode calls
without hook delivery, app UI, direct file writes and host-side races remain
outside that safeguard. Read-only views stay available. An observation record
shows invocation only; it does not prove the mutation guard was effective.
