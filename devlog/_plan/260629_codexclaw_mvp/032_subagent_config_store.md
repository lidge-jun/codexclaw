# 032 — Subagent Config Store

Status: TODO  ·  Phase 2

## Goal
Persist per-role subagent config (model + prompt override).

## Store
`.codexclaw/subagents.json`:
```json
{
  "roles": {
    "explorer": { "mode": "default", "model": null, "promptOverride": null },
    "reviewer": { "mode": "model", "model": "openai/small-model", "promptOverride": "..." },
    "executor": { "mode": "default", "model": null, "promptOverride": null }
  }
}
```
`mode`: `default` (main model) | `model` (explicit pick).

## Component
`components/subagent-config/` — read/write API + optional MCP tool for codex.

## Verify
- Write a mapping; spawned role honors model + prompt.
