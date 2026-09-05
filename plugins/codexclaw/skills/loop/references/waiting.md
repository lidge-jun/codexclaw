# Waiting on work

Read while awaiting dispatched work or long external processes in either HITL or HOTL.

## Wait visibility (LOOP-WAIT-VISIBILITY-01, DEFAULT)

Long silent waits read as a dead loop to the user and invite interrupts that
kill the work-phase (019f4456: a 6-minute silent `wait_agent` stretch looked
like "stopped after one work-phase"). While waiting on subagents or long
external processes inside a loop:

- Prefer bounded waits (`wait_agent` with `timeout_ms` <= 120000) over one
  long blocking wait; between waits, emit a one-line progress update naming
  what is being waited on and the elapsed time.
- Never end the turn just because a wait timed out — re-wait or poll, and keep
  the user informed each cycle.
- If a reviewer/worker has produced nothing after ~3 wait cycles, treat it as
  a failed dispatch (DISPATCH-RETIRE-01) rather than waiting silently forever.
  That retirement CONSUMES the DISPATCH-RETIRE-01 same-agent retry: go straight
  to a fresh spawn with the failure folded into the new packet — the silent
  agent does not get a second retry.
