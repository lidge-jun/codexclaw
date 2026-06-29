# L1 (Decade 010) -- IPABCD State Engine

Status: DONE
Cluster: 1 - Phase: 1 - Shorthand: cxc
Source-of-record: 018_pass1_P_plan.md; 022.1_pabcd_state_files.md; STATUS.md

## Goal (one slice)
Ship the file-backed IPABCD state core for one Codex session: phase state, gate predicates, and an
append-only audit ledger, without wiring hooks or skills yet.

## Why now / dependencies
This is the first executable Phase 1 slice because every later loop needs a durable place to read and
write the current IPABCD phase. L2 uses the session state for injection idempotency, L3 adds goal-gate
fields beside it, and L7 verifies the compiled state path.

## Scope (decision-complete)
- Files added/edited:
  - `plugins/codexclaw/components/pabcd-state/src/state.ts`
  - `plugins/codexclaw/components/pabcd-state/src/fsm.ts`
  - `plugins/codexclaw/components/pabcd-state/test/state.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/fsm.test.ts`
  - `plugins/codexclaw/components/pabcd-state/package.json`
- State layout:
  - `<cwd>/.codexclaw/sessions/<sanitize(sessionId)>.json`
  - `<cwd>/.codexclaw/ledger.jsonl`
- Phase enum: `I`, `P`, `A`, `B`, `C`, `D`.
- Session scope is mandatory: parallel sessions in one working tree must not clobber each other.
- `readState` is fail-safe: missing, corrupt, or unknown-phase state returns a default `I` state.
- `writeState` writes through a temporary file and atomic rename, with orphan tmp cleanup on failure.
- `appendLedger` appends JSONL entries tagged with `sessionId`.
- FSM is pure:
  - `P` requires `flags.interview`.
  - `B` requires `flags.auditPassed`.
  - `D` requires `flags.checkPassed`.
- Must-NOT-Have:
  - No hook registration.
  - No directive injection.
  - No goal gate.
  - No config writes.
  - No shared per-cwd singleton state.

## IPABCD micro-cycle
- I (if interview-bearing): no runtime interview feature in L1; the interview flag is only stored and
  gate-tested as data.
- P: planned `state.ts` as owner of `Phase` and `PHASES`; `fsm.ts` imports one-way from state to avoid
  the ORDER cycle found during Pass 1 audit.
- A: independent plan/code audit checked Codex hook session-id grounding, omo-style state parity, and
  cyclic import risk; blocker fixed by moving `PHASES` to `state.ts`.
- B: implemented `sanitizeKey`, `defaultState`, `readState`, `writeState`, `appendLedger`, `canEnter`,
  `nextPhase`, `isAuditGateOpen`, `isBuildGateOpen`, and `isDone`.
- C: `node --test` for pabcd-state reached the Pass 1 gate at 16/16; later Phase 1 regression totals
  include pabcd-state 52/52 and total `npm test` 73/73.
- D: done = session-isolated state and pure FSM were green and became the base for L2-L7.

## Acceptance (1-3 testable criteria)
- Two distinct `sessionId` values in one cwd read and write distinct session files.
- Missing/corrupt/unknown-phase state never throws and returns the safe default `I` state.
- FSM gates enforce interview/audit/check flags exactly as shipped.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test` in `plugins/codexclaw/components/pabcd-state` at Pass 1: 16/16 pass.
- Final Phase 1 regression: root `npm test` 73/73, with pabcd-state 52/52.
- Data dump shape: `.codexclaw/sessions/<session>.json` plus `.codexclaw/ledger.jsonl`.

## Commit unit (one atomic conventional commit)
One state-engine commit: add pabcd-state file store, FSM predicates, and node:test coverage.

## Blocked-on (jun decision id, if any)
None.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/018_pass1_P_plan.md`
- `devlog/_plan/260629_codexclaw_mvp/022.1_pabcd_state_files.md`
- `devlog/_plan/260629_codexclaw_mvp/016_session_scope_finding.md`
- `plugins/codexclaw/components/pabcd-state/src/state.ts`
- `plugins/codexclaw/components/pabcd-state/src/fsm.ts`
- codex-rs hook events: `user_prompt_submit.rs`, `stop.rs`, `pre_tool_use.rs` session_id field.
