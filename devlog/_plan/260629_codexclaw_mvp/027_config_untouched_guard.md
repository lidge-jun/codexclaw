# 027 — Config Policy: Controlled Feature-Flag Activation

Status: TODO  ·  Phase 1  ·  REVISED (see 022.2)

## Goal
Define exactly what codexclaw may write to `~/.codex/config.toml`, and guarantee nothing else
changes.

## Revised policy (was "never touch config")
codexclaw DOES need specific feature flags on (multi_agent, goals, hooks,
default_mode_request_user_input). These are activated the OFFICIAL way:
- `codex features enable <name>` (writes `[features].<name>=true`), at install/enable time.
- This is sanctioned, documented, user-aware — NOT silent mutation.

## Guard rules
- Allowed writes: ONLY the specific `[features]` keys codexclaw declares it needs (documented list
  in 022.2) + its own plugin registration. Nothing else.
- Back up `config.toml` before flipping (timestamped .bak, mirroring codex's own bak convention).
- `codexclaw uninstall` reverts EXACTLY the flags it set, restoring prior values.
- Test: diff config.toml before/after install → only the declared feature keys changed; every
  other line byte-identical.
- Without ocx (Phase 1), no provider/model keys are touched (that stays opencodex's domain).

## Verify
- Install flips only declared flags; backup created.
- Uninstall restores prior flag values; rest of config byte-identical throughout.
