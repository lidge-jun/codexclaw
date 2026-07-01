# 035 — GUI Subagent Page + 10100 Link Bar

Status: TODO  ·  Phase 2

## Goal
The core GUI surface: configure subagents + prompt tuning + ocx link bar.

## Page: Subagents
- For each role (explorer/reviewer/executor):
  - model selector populated from the catalog (033): default/main or a specific model.
  - per-role prompt override editor.
- Persist to `.codexclaw/subagents.json` (032).

## Link bar
- When ocx detected: show a link to `http://localhost:10100` (opencodex dashboard).
- When ocx absent: hide the bar; show model selector limited to default.

## Verify
- Edits persist and apply on spawn.
- Link bar visibility tracks ocx detection.
