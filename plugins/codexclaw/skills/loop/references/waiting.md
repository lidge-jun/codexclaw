# Waiting on work

Read while awaiting dispatched work or long external processes in either HITL or HOTL.

These continuation/dispatch rules concern this goal's own work and delegated
subagents, not independent peer advice. Peer timeouts do not authorize retirement,
replacement, forced wakeups, or an unconditional wait; use
[peer collaboration](../../dev/references/peer-collaboration.md). Do not send
unsolicited progress notices or nudges to independent tasks while waiting. Contact requires
an explicit user request or necessary confirmed blocking CI/merge collision
coordination, plus host permission and wake checks.

## Wait visibility (LOOP-WAIT-VISIBILITY-01, DEFAULT)

Long silent waits read as a dead loop to the user and invite interrupts that
kill the work-phase (019f4456: a 6-minute silent `wait_agent` stretch looked
like "stopped after one work-phase"). While waiting on subagents or long
external processes inside a loop:

- `wait_threads` watches **1-8 targets** with `timeoutMs` **0-120000** (default 120000),
  so more than eight lanes means deliberate batching: watch the batch whose result changes
  your next decision, carry each target's `afterCursor`, and never read an unwatched lane
  as idle. A wait that times out returns progress for every target and is a normal
  outcome. See [Lane dispatch](lane-dispatch.md).
- Prefer bounded waits (`wait_agent` with `timeout_ms` <= 120000) over one
  long blocking wait; between waits, emit a one-line progress update naming
  what is being waited on and the elapsed time. Keep the two cadences separate:
  how often you tell the user something is not how often you may ask an external
  API. When lanes and the observer share one quota, the polling budget belongs to
  the coordinator — see `cxc-pabcd` `references/dispatch-surfaces.md`
  (DISPATCH-POLL-BUDGET-01).
- Know which wait you are calling. V1's `wait_agent` may carry the child's final
  message in its result; V2's is a no-content mailbox and the answer arrives
  separately. Reading the answer out of the wait result works on V1 and silently
  returns nothing on V2, which looks like a stalled agent rather than a schema
  mismatch. Threads are different again: `wait_threads` takes per-target cursors.
  See `cxc-pabcd` `references/delegation.md`.
- On V1 the same completed report can reach you through the notification, the wait
  result and the close result. Consume it once per child task per turn and do not
  issue an extra wait to re-fetch something you already have
  (DISPATCH-CONSUME-ONCE-01 in `references/delegation.md`). Closing is still
  required: a completed child holds a concurrency slot until it is closed.
- A timed-out wait is not a reason to end the turn — but it is also not a licence to
  poll forever. Either keep waiting within this turn, or yield with a verified,
  authorized wake already armed for the work that will outlive it
  (DISPATCH-WAKE-01). If no wake mechanism is available, say so instead of yielding
  and assuming something will resume you.

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

Recovery from confirmed failure follows the bounded lifecycle
(DISPATCH-RETIRE-01): at most one retry on the same handle, then a fresh spawn
with the failure folded into the new packet. When the configured
first-fallback protocol manages the dispatch its result owns the next step
instead — `ready` means claim the next attempt, `main-direct` means main
reclaims the work, and `reconcile`/`stop` authorize neither a replacement
spawn nor direct execution. Cancellation or an exhausted bound grants no
continuation: stop within authority and report the cancellation or bound,
never as a provider failure.

For managed stagnation or unusable final output, report `outcome:task_failed`
with the matching `taskFailure.kind`, concrete `taskFailure.evidence`, the
recorded child ID, `executionState:stopped` and termination/partial-work
`reconciliation`. Follow the [report contract](../../pabcd/references/delegation.md#configured-first-fallback).
Provider errors use `outcome:failed`; do not invent a provider code for a task
failure or label cancellation or exhausted bounds as stagnation. Validate the
final work before reporting `outcome:complete`, which closes the dispatch.

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
