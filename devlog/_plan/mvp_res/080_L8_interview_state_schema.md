# L8 (Decade 080) -- Interview State Schema

Status: FROZEN
Cluster: 1 - IPABCD Interview completion - Phase: 1 - Shorthand: cxc
Source-of-record: 080_pass8_interview_hardening_plan.md, 022.2, 022.3

## Goal (one slice)
Ship the interview tracker state model and readiness FSM contract that lets
codexclaw know when the I phase is complete enough to enter P.

This loop does not implement Mind dispatch or user-question generation. It
only creates durable state, reconstruction rules, readiness logic, and the
minimal FSM integration used by later loops.

## Why now / dependencies
L1-L7 must already be at D because this loop extends the Phase 1 state engine,
directive hook contract, and test harness instead of replacing them.

L8 unblocks L9 by giving contradiction dispatch a place to record findings,
L10 by giving auto-mode and freeze a readiness predicate, and L11 by giving
goal-mode hard-deny tests a clear "no interview state mutation" invariant.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/components/pabcd-state/src/state.ts`
  - `plugins/codexclaw/components/pabcd-state/src/fsm.ts`
  - `plugins/codexclaw/components/pabcd-state/test/state.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/fsm.test.ts`
- Add `Dimension`, `DimensionScore`, `Contradiction`, `Assumption`, and
  `InterviewTracker` types.
- Add `interview: InterviewTracker | null` by extending the live `State`
  shape. Do not replace the current state literal.
- Add `defaultInterview()`, reconstruct helpers, and `isInterviewReady()`.
- Preserve strict reconstruct: unknown fields are not passed through.
- Bound state growth for T2: cap in-state arrays and keep overflow out of the
  hot session JSON, or document the ledger follow-up if externalized.
- T1: extend live state fields only; do not regress existing fields such as
  injection or orchestration markers.
- T3: corrupted tracker data must fail closed for readiness instead of silently
  becoming a ready tracker.
- T6: do not rely on the existing 50-turn injection cap as the only operation
  idempotency horizon.
- Exact behavior:
  - Fresh sessions read `interview: null`.
  - Readiness requires all four dimensions at `max`.
  - `contradictions[]` must be empty before ready.
  - Every assumption must have `recorded: true`.
  - `flags.interview` remains the FSM gate for entering P.
  - `flags.interview` is derived from `isInterviewReady(tracker)`, not from a
    loose user trigger.
- Must-NOT-Have:
  - No Mind dispatch.
  - No `request_user_input` calls.
  - No freeze manifest format.
  - No goal-mode PreToolUse gate.
  - No config writes or feature-flag writes.

## IPABCD micro-cycle
- I (if interview-bearing): Trigger when the user requests interview or when
  the current task is vague and large. Initialize `state.interview` only outside
  goal mode.
- P: Extend state schema and reconstruct helpers, then wire the existing FSM P
  gate to the derived ready flag without changing the phase model.
- A: Reviewer checks strict reconstruct drift, live-field preservation, bounded
  arrays, and fail-closed handling for malformed tracker data.
- B: Add types, defaults, reconstruct helpers, readiness predicate, FSM comments
  or minimal glue, and focused tests.
- C: Run targeted node tests for state and FSM plus `cxc doctor` if that command
  already exists in the Phase 1 CLI surface.
- D: Done = malformed or incomplete tracker data cannot enter P, complete
  tracker data can enter P through the existing `flags.interview` gate, and no
  existing state fields are dropped.

## Acceptance (1-3 testable criteria)
1. `readState()` preserves existing Phase 1 fields while round-tripping a full
   `InterviewTracker` and dropping unknown nested keys.
2. `isInterviewReady()` returns true only for all-max dimensions, empty
   contradictions, and all recorded assumptions.
3. `canEnter("P")` still gates on `flags.interview`, with tests proving false
   blocks and true passes.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test plugins/codexclaw/components/pabcd-state/test/state.test.ts`
- `node --test plugins/codexclaw/components/pabcd-state/test/fsm.test.ts`
- Optional CLI stdout: `cxc status` should not show a ready interview for a
  malformed or partial tracker.

## Commit unit (one atomic conventional commit)
`feat(pabcd-state): add interview tracker readiness state`

## Blocked-on (jun decision id, if any)
None. T1, T2, T3, and T6 are implementation constraints in this loop, not open
product decisions.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/080_pass8_interview_hardening_plan.md`
- `devlog/_plan/260629_codexclaw_mvp/080.1_interview_contradiction_register.md`
- `devlog/_plan/260629_codexclaw_mvp/022.2_ipabcd_and_feature_flags.md`
- `devlog/_plan/260629_codexclaw_mvp/022.3_interview_goalmode_rules.md`
- `plugins/codexclaw/components/pabcd-state/src/state.ts`
- `plugins/codexclaw/components/pabcd-state/src/fsm.ts`
