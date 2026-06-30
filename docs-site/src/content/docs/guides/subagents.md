---
title: Subagents
description: Configure per-role subagent models and prompts through codexclaw's MCP tools.
---

codexclaw lets you assign a model and prompt override to each subagent role, persisted in
`.codexclaw/subagents.json` and exposed over MCP.

## Roles

Three roles cover the common subagent workflow:

- **explorer** — broad codebase investigation and research.
- **reviewer** — adversarial audit and review.
- **executor** — focused implementation.

## MCP tools

| Tool | Purpose |
|---|---|
| `subagents_get` | Read the per-role config: `mode`, `model`, `promptOverride`. |
| `subagents_set` | Update one role's config. |
| `catalog_list` | List selectable models — Codex-native first, then `ocx`-backed when active. |

### subagents_set

```jsonc
{
  "role": "reviewer",           // explorer | reviewer | executor
  "mode": "model",              // "default" (main model) or "model" (needs a model id)
  "model": "gpt-5.5",           // required when mode is "model"
  "promptOverride": "..."       // optional per-role prompt, or null
}
```

Only `role` is required. `mode: "default"` uses the main model; `mode: "model"` requires a
`model` id from `catalog_list`.

## Configuring from the GUI

The [GUI dashboard](/codexclaw/guides/gui/) wraps these tools with model pickers and prompt
editors so you can set roles without hand-editing JSON.

:::note[Live spawn-wrapper is planned]
codexclaw persists role config and exposes a resolver today. Wiring that resolver into live
`spawn_agent` calls — so the configured model is actually used at spawn time — is planned
(L9 on the [parity roadmap](/codexclaw/development/parity-roadmap/)). Until then, treat the
config as the source of truth that a future spawn-wrapper will consume.
:::
