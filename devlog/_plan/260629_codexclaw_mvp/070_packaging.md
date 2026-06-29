# 070 — Packaging & Marketplace

Status: TODO

## Goal
Make codexclaw installable as one plugin via the marketplace path.

## Behavior
- `scripts/build.mjs`: compile each component src→dist; aggregate skills/hooks/agents
  into the plugin root so it installs as one plugin.
- Validate with `validate_plugin.py`.
- Install flow:
  - `codex plugin marketplace add https://github.com/lidge-jun/codexclaw`
  - `codex plugin add codexclaw@personal`

## Verify
- Fresh `codex plugin add` installs and loads hooks/skills.
- No `[TODO]` placeholders in manifest.
