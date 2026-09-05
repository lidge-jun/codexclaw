# Loop runtime lifecycle

Read only for authorized HOTL entry/resume or continuation/completion diagnosis.
Mode selection belongs to ../SKILL.md; phase control belongs to
../../pabcd/references/phase-control.md. Follow the live host tool contract.

## Orchestrate mandate (ORCH-MANDATE-01, STRICT)

A loop claim without persisted FSM evidence is INVALID. Narrating phases ("now I'm in
B", "audit passed") without their `cxc orchestrate` transitions is the exact
failure mode this rule exists to stop: the Stop hook never arms, the ledger stays
empty, and the "loop" is one ordinary turn wearing a loop costume. Mandatory sequence
for EVERY loop entry or re-entry:

1. Session id from YOUR most recent SessionStart binding line only (SESSION-IDENTITY-01).
2. `cxc orchestrate status --session <id>` — read the real phase before claiming any.
3. For a new authorized HOTL goal: create_goal, cxc loop init, register the plan,
   then enter P. On resume, inspect and reuse the matching active goal and bound
   plan; do not recreate or overwrite them. Resolve a mismatched goal/scope first.
   HITL enters I or P only within the requested scope and without a host goal.
4. Advance the four gated work edges (P>A, A>B, B>C, C>D) with
   `cxc orchestrate <phase> --attest <json>` — or `--attest-file <path>`, which is
   REQUIRED on Windows because PowerShell cannot pass inline JSON as one argument —
   carrying the phase's real artifact
   (ORCH-ARTIFACT-01). Every attest names the edge it advances with `from`/`to`,
   plus that edge's own keys (`planUnit` on P>A, `workPhaseId` on every gated edge
   under a bound goalplan, `testReceiptPath` on C>D) — canonical table and
   copy-paste objects: [Phase control](../../pabcd/references/phase-control.md) (ATTEST-SHAPE-01).
   Entry edges (IDLE→P, I→P) are explicit commands without an
   attest JSON — the shipped gate (`dist/attest.js` GATED_TRANSITIONS) gates exactly
   those four. A phase without its persisted transition did not happen — the
   footer/ledger is the only proof of phase.
5. After D closes to IDLE, read durable state (goalplan + ledger) to confirm remaining
   work, then re-enter P for the next work-phase with
   `cxc orchestrate P --session <id>`.

Work performed outside the FSM does not count as loop progress: re-enter and attest
it before building on it. Runtime companions (shipped): a loop/goalplan/
continue-until-done request hitting an UN-ARMED FSM gets the arming mandate injected
at prompt time (`LOOP_ARM_DIRECTIVE`, hook `UserPromptSubmit`), and an active goal
with no in-flight cycle gets the Stop-time block naming the arming command
(GOAL-IDLE-CONTINUE-01) — but neither companion moves a phase for you; the commands
remain yours to run.

## Completion gate (GOAL-COMPLETE-GATE-01, shipped)

`update_goal {status:"complete"}` is gated by a deterministic PreToolUse hook,
not just discipline text. The hook DENIES the call when:

- a PABCD cycle is in flight (`orchestrationActive`, phase not IDLE/I) — close
  the cycle through D (or `cxc orchestrate reset`) first; or
- the session-bound goalplan fails the E8 gate (`cxc loop validate`): undone
  work phases, unmet criteria, `met` marks without `capturedEvidence`, or an
  empty unregistered plan.

The plugin's completion gate does not deny blocked status; this does not override
the host tool's blocked-status conditions or authorize an early stop. The gate is
fail-open on IO errors and does not fire without state or a bound goalplan.
Do not shrink the goalplan to pass the gate (LOOP-CONTINUE-01).

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

## Stop-continuation (shipped, L6)

The active Stop hook (`handleStop`) returns `{"decision":"block","reason":...}` under
an ACTIVE goal, including at IDLE when GOAL-IDLE-CONTINUE-01 names the next arming
command and remaining work. Termination remains bounded by:

- **Goal/phase guard** — no active goal → release (a plain interactive session never enters
  the loop; it pauses for the human at P/A/B, and IDLE without a goal stays silent).
  Phase `I` always releases (the Interview is HITL-only).
- **Context-pressure bail** — don't pile on during compaction recovery.
- **Stagnation cap** — a bounded `stopBlockCount` per phase; after `MAX_STOP_BLOCKS`
  consecutive blocks at the same phase with no transition, the loop releases so it can
  never trap a session. A real transition (chat or CLI) resets the counter, so each
  phase of a healthy P→A→B→C→D gets a fresh budget. This is the runtime companion to
  LOOP-DOOM-01, not a success signal; after release, apply the no-progress discipline
  before retrying the same phase.
- **Objective plateau block** — for active maximize goals with session-scoped metrics,
  two non-improving same-metric rows switch the block reason from plain continuation
  to "step back and re-plan with divergence." This still uses the same bounded
  `MAX_STOP_BLOCKS` release path and never asks the user inside goal mode.

### Stop decision matrix

| Condition | Decision |
|-----------|----------|
| No active goal, or phase I | Release |
| Active goal + in-flight cycle | Bounded block (continue phase) |
| Active goal + IDLE with remaining work | Block with arming command |
| Context pressure or stagnation cap exhausted | Release (not a success signal) |
