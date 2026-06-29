# 04 — Subagent Config

Status: TODO

## Goal
Persist and serve per-role subagent configuration (default vs multi-model + prompt overrides).

## Behavior
- Config store: `.codexclaw/subagents.json`.
- Schema: per role (explorer/reviewer/executor) → { mode: "default"|"model", model?, promptOverride? }.
- Model catalog: when ocx present, source available models from it; else default model only.
- Expose read/write to GUI; optionally expose as MCP tool (`subagent-config/src/mcp.ts`).

## Verify
- Write a model mapping; spawned subagent honors it.
- With ocx absent, only default model is selectable.
