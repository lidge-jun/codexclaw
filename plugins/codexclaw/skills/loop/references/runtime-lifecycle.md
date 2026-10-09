# Loop runtime lifecycle

Read only for authorized HOTL entry/resume or continuation/completion diagnosis.
Mode selection belongs to [cxc-loop](../SKILL.md); follow the live host tool contract.

## Entry and resume

Before claiming loop progress, apply ORCH-MANDATE-01 in
[cxc-loop](../SKILL.md#execution-invariants) and the binding, status and artifact procedure in
[phase control](../../pabcd/references/phase-control.md)
(SESSION-IDENTITY-01, ORCH-ARTIFACT-01, ATTEST-SHAPE-01).
A phase without a persisted transition and real artifact did not happen.

For a new authorized HOTL goal, create the host goal, initialize and register its
[durable plan](durable-goalplan.md), then enter P. On resume, inspect and reuse
the matching active goal and plan; resolve scope mismatches instead of overwriting
them. HITL enters only within its requested scope and without a host goal.
After D closes to IDLE, read goalplan and ledger, then apply the
[next-work-phase rule](../SKILL.md) before another P.

Work outside the FSM must be reconciled and genuinely attested before it counts
as loop progress. Prompt-time arming and GOAL-IDLE-CONTINUE-01 can name the needed
command; neither moves a phase for the agent.

## Completion gate (GOAL-COMPLETE-GATE-01, shipped)

The shipped guard in
[goal-gate.ts](../../../components/pabcd-state/src/goal-gate.ts)
owns the completion predicate, including cycle closure, resolved child evidence,
source integrity and complete bound-plan validation. Never weaken criteria or
shrink a plan to pass (LOOP-CONTINUE-01).

On denial, inspect the reason: restore verified unreadable state or a missing/
malformed bound plan; re-verify unresolved child work with
`cxc evidence resolve --session <id> --agent <agent-id> --receipt <path>`;
validate the same source-bound plan with `cxc loop validate --session <id>`.
Clear an unrecordable-evidence marker only after re-verification. Close an active
cycle through real D evidence; reset is a separately authorized control action.
The guard leaves blocked status available, subject to the host's own conditions.
Unexpected guard errors fail open; absent delivery or an allowed call proves
neither completion nor fresh verification.

Before waiting on dispatched work or long external processes, read
[Waiting on work](waiting.md), the mode-neutral owner of wait and retirement rules.
It also owns the cross-turn preflight: the Stop-continuation bounds below mean a
dispatch expected to outlive this turn needs a verified wake arranged BEFORE the turn
yields, not an assumption that something will resume the coordinator.

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
| Active goal + IDLE with an executable remaining phase | Block with arming command |
| IDLE with a missing plan or all remaining work awaiting user decisions | Release; goal remains active and completion is still gated |
| Context pressure or stagnation cap exhausted | Release (not a success signal) |
