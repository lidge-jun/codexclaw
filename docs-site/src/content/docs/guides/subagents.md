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

The `pre-tool-use-attaching-skills` hook wires into live `spawn_agent` calls, but it does
not choose skills. Dispatchers explicitly attach each required skill with preferred
`[$cxc-<name>](skill://<abs SKILL.md>)` links or the plugin-native
`$codexclaw:cxc-<name>` fallback. The hook normalizes known broken/bare mentions, applies
v1 model routing, and adds the v2 leaf guard; it never invents role baselines or inferred
surface skills. Role config, resolver, and spawn-wrapper are all shipped (L9).
