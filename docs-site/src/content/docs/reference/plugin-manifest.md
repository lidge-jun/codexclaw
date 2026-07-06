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
| `repository` | `https://github.com/lidge-jun/codexclaw` |
| `homepage` | `https://lidge-jun.github.io/codexclaw/` |
| `license` | `MIT` |
| `skills` | `./skills/` — the skill directory root. |
| `hooks` | Twelve hook JSON files (see [Hooks](/codexclaw/reference/hooks/)). |
| `mcpServers` | `./.mcp.json` — the subagent-config MCP server. |

## Registered hooks

```json
"hooks": [
  "./hooks/session-start-ensuring-provider-bridge.json",
  "./hooks/session-start-announcing-map-affordance.json",
  "./hooks/user-prompt-submit-checking-pabcd-trigger.json",
  "./hooks/stop-checking-pabcd-continuation.json",
  "./hooks/pre-tool-use-guarding-goal-budget.json",
  "./hooks/pre-tool-use-guarding-interview-in-goal.json",
  "./hooks/post-tool-use-capturing-interview-answers.json",
  "./hooks/subagent-stop-verifying-evidence.json",
  "./hooks/pre-tool-use-attaching-skills.json",
  "./hooks/post-compact-resetting-reinject-cursor.json",
  "./hooks/pre-tool-use-linting-apply-patch.json",
  "./hooks/post-tool-use-tracking-render-observations.json"
]
```

The plugin currently contains eight component packages under `components/` (including
`skill-search`) and 25 skill directories under `skills/`. The GUI is a separate workspace
package under `plugins/codexclaw/gui/`.

## Interface metadata

The manifest's `interface` block drives how codexclaw appears in Codex:

| Field | Value |
|---|---|
| `displayName` | Codexclaw |
| `category` | Developer Tools |
| `websiteURL` | `https://lidge-jun.github.io/codexclaw/` |
| `capabilities` | Skills, Hooks, Workflow, Subagents, Context Injection |
| `defaultPrompt` | Three prompts: "Plan this with codexclaw PABCD and use multi-model subagents."; "Run cxc map to get the shape of this repo before we dive in."; "Interview me first, then draft a diff-level plan." |

## Namespacing

Because the plugin is named `codexclaw`, plugin-native skill mentions take the form
`$codexclaw:cxc-dev`. The `$cxc-*` shorthand is the project's preferred name; how each form
resolves is covered in the [Skills guide](/codexclaw/guides/skills/).
