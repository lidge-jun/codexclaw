# 03 — PABCD State Machine

Status: TODO

## Goal
File-based FSM driving Plan/Audit/Build/Check/Done, with hook-driven triggers.

## Behavior
- `UserPromptSubmit`: detect PABCD/interview triggers; inject phase directive as
  additionalContext (idempotent — skip if already injected or post-compact).
- `Stop`: evaluate FSM, decide continuation to next phase.
- State: `.codexclaw/state.json` (phase + derived flags), `.codexclaw/ledger.jsonl`
  (append-only transition audit).

## Reference
`devlog/.lazycodex/plugins/omo/components/ulw-loop` (goal-status FSM, codex-hook injection).

## Verify
- Trigger phrase moves state P→A; ledger records transition.
- Idempotent injection (no duplicate directive across same transcript).
