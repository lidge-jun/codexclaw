# Messenger Bridge Native Command Surface

Status: PLANNED
Date: 2026-07-07
Source-of-record:
- `.codexclaw/goalplans/codexclaw-messenger-bridge-telegram-discord-diff/goalplan.json`
- `.codexclaw/goalplans/codexclaw-messenger-bridge-telegram-discord-diff/diff-specs.md`

## Purpose

Record the post-research decisions for the Telegram/Discord messenger bridge
upgrade at diff level.

This unit is a decision log, not an implementation patch. It captures why the
next implementation should expose messenger-native command surfaces instead of
trying to pipe Codex TUI slash commands through `codex exec --json`.

## Files

- `010_gap_decision.md` -- whether this is a user-choice decision or a pure gap.
- `020_codex_slash_command_mapping.md` -- command-surface decision and diff-level
  implementation map.
- `030_impl_audit_synthesis.md` -- cycle-1 (wp1+wp2+wp8) A-gate synthesis (4 blockers -> AMENDMENT A1).
- `040_competitor_mechanism_research.md` -- OpenClaw/Hermes mechanism parameters feeding wp4/5/6/9.
- `050_impl_batch1_build_record.md` -- cycle-1 build record: per-file diff map + verification.
- `060_impl_batch1_check_synthesis.md` -- cycle-1 C-gate synthesis (security callback gate, defer-order, syspolicyd incident).
- `070_impl_cycle2_audit_synthesis.md` -- cycle-2 (wp3+wp9) audit synthesis + db v6 pre-work record.

## Implementation status (HOTL loop, goalplan `codexclaw-messenger-bridge-telegram-discord-diff`)

- Cycle 1 DONE: wp1 Telegram interactive surface, wp2 Discord interaction engine,
  wp8 GUI observability/sessions. Suite 194/0, gui build OK.
- Cycle 2 IN FLIGHT: wp3 gateway command unification + wp9 Telegram webhook mode.
- Remaining: wp5+wp7 (streaming + media I/O), wp4+wp6 (thread routing + approval relay).

## Terminal Decision

No product fork is currently required from Jun. The researched gap is clear:
codexclaw should move from a text-only remote bridge toward
platform-native Telegram/Discord controls.

The implementation should not attempt to pass Codex TUI slash commands through
unchanged. The bridge should implement equivalent messenger-native commands on
top of the existing `codex exec --json` runner and DB binding model.
