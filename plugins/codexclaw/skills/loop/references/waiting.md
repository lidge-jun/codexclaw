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

- Prefer bounded waits (`wait_agent` with `timeout_ms` <= 120000) over one
  long blocking wait; between waits, emit a one-line progress update naming
  what is being waited on and the elapsed time.
- Know which wait you are calling. V1's `wait_agent` may carry the child's final
  message in its result; V2's is a no-content mailbox and the answer arrives
  separately. Reading the answer out of the wait result works on V1 and silently
  returns nothing on V2, which looks like a stalled agent rather than a schema
  mismatch. Threads are different again: `wait_threads` takes per-target cursors.
  See `cxc-pabcd` `references/delegation.md`.
- Never end the turn just because a wait timed out — re-wait or poll, and keep
  the user informed each cycle.

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
- **Confirmed failure** — an actual terminal error, or stagnation evidenced at
  the stated review point. A wait timeout alone is a normal outcome, and a
  healthy long command may emit sparse output — inspect command state before
  treating silence as failure. Missing edits alone do not prove a stall.
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
