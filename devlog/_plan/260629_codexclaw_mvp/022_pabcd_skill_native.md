# 022 — IPABCD as a Codex-Native Skill

Status: TODO  ·  Phase 1

## Goal
PABCD runs with no orchestrator server. Skill = human guide; hooks = trigger + continuation;
files = state.

> **IPABCD (not PABCD):** the workflow includes an **Interview** phase (I) before Plan.
> See 022.2 for the Interview phase, feature-flag activation, and `request_user_input` mechanism.

## Pieces
- `skills/pabcd/SKILL.md` (exists) — phase guide + trigger description.
- `components/pabcd-state/` — hook CLI: UserPromptSubmit (detect + inject directive),
  Stop (evaluate FSM, continuation).
- State files: see 022.1.

## Behavior
- UserPromptSubmit: if prompt matches a PABCD/interview trigger and not already injected this
  transcript (idempotent, skip post-compact), inject the matching phase directive via
  `additionalContext`.
- Stop: read state; if current phase's exit condition met, advance and record to ledger.

## Reference
`devlog/.lazycodex/plugins/omo/components/ulw-loop` (codex-hook injection + goal-status FSM).

## Verify
- Trigger phrase → directive injected once (not duplicated on repeat prompts).
- Phase advances P→A→B→C→D with ledger entries.
