# 070 — Packaging & Marketplace (cross-phase)

Status: TODO

## Goal
Make codexclaw installable as one plugin via the marketplace path.

## Behavior
- `scripts/build.mjs`: compile each component src→dist; aggregate skills/hooks/agents into the
  plugin root so it installs as one plugin (omo build pattern).
- Validate (note: bundled validator has a stale `hooks` false-positive; omo hits the same one —
  codex ingestion accepts hooks).
- Install:
  - `codex plugin marketplace add https://github.com/lidge-jun/codexclaw`
  - `codex plugin add codexclaw@personal`

## Verify
- Fresh `codex plugin add` installs + loads hooks/skills.
- No `[TODO]` placeholders in manifest.
