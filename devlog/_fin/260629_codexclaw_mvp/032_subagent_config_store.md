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

## 접점 — 5-Mind 주입 (Pass 8)
- 인터뷰 5-Mind(Contrarian/Socratic/Ontologist/Evaluator/Simplifier)를 `roles`에 등록해
  per-role 모델 차등 지정. 설계: [034.5_mind_model_injection.md](034.5_mind_model_injection.md).
