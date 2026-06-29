---
name: pabcd
description: Use for any non-trivial multi-step development task that benefits from disciplined planning before execution. Triggers include "plan this", "let's build X properly", "interview me", "be thorough", "도와줘 제대로", "기획부터", or any feature/refactor large enough to need explore-first planning, an audit gate, staged build, and verification before done. Reimplements cli-jaw PABCD (Plan/Audit/Build/Check/Done) as a Codex-native workflow with no external orchestrator.
---

# PABCD Workflow

A Codex-native reimplementation of cli-jaw's PABCD development loop. No orchestrator server, no `cli-jaw orchestrate` calls — state lives in `.codexclaw/state.json` and phase transitions are driven by hooks + this skill.

## Phases

1. **P — Plan**: Explore first (read code, configs, docs). Produce a concrete plan. If requirements are unclear, enter interview mode and ask before building.
2. **A — Audit**: Read-only review of the plan against the real codebase. Surface rollback gaps, missing callers, phantom constants, risky assumptions. No code changes in this phase.
3. **B — Build**: Implement the audited plan. Small atomic commits per logical change.
4. **C — Check**: Run the project's build, typecheck, and targeted tests. Fix what verification reveals before claiming done.
5. **D — Done**: Confirm completion, record outcome, return to idle.

## State

- `.codexclaw/state.json` — current phase + derived flags.
- `.codexclaw/ledger.jsonl` — append-only audit trail of transitions.

## Notes

- This skill is the human-readable guide; the hook (`pabcd-state` component) handles trigger detection and continuation.
- MVP: directives are text-only. Forced gates (deny on premature transition) land in a later step.
