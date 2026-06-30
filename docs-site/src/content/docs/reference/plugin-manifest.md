---
title: Plugin Manifest
description: The codexclaw .codex-plugin/plugin.json manifest — skills, hooks, MCP, and interface metadata.
---

codexclaw is declared by a single manifest at `plugins/codexclaw/.codex-plugin/plugin.json`. It
tells Codex which skills, hooks, and MCP servers to load.

## Top-level fields

| Field | Value |
|---|---|
| `name` | `codexclaw` |
| `version` | `0.1.0` |
| `license` | `MIT` |
| `skills` | `./skills/` — the skill directory root. |
| `hooks` | Five hook JSON files (see [Hooks](/codexclaw/reference/hooks/)). |
| `mcpServers` | `./.mcp.json` — the subagent-config MCP server. |

## Registered hooks

```json
"hooks": [
  "./hooks/session-start-ensuring-provider-bridge.json",
  "./hooks/user-prompt-submit-checking-pabcd-trigger.json",
  "./hooks/stop-checking-pabcd-continuation.json",
  "./hooks/pre-tool-use-guarding-goal-budget.json",
  "./hooks/pre-tool-use-guarding-interview-in-goal.json"
]
```

## Interface metadata

The manifest's `interface` block drives how codexclaw appears in Codex:

| Field | Value |
|---|---|
| `displayName` | Codexclaw |
| `category` | Developer Tools |
| `capabilities` | Skills, Hooks, Workflow, Subagents, Context Injection |
| `defaultPrompt` | "Plan this with codexclaw PABCD and use multi-model subagents." |

## Namespacing

Because the plugin is named `codexclaw`, plugin-native skill mentions take the form
`$codexclaw:cxc-dev`. The `$cxc-*` shorthand is the project's preferred name; how each form
resolves is covered in the [Skills guide](/codexclaw/guides/skills/).
