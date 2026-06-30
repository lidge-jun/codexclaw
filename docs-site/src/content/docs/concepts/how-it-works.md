---
title: How It Works
description: How the codexclaw plugin manifest wires skills, hooks, MCP, and the CLI to the .codexclaw file state.
---

codexclaw is one plugin manifest that registers four kinds of surface with the Codex runtime,
all backed by a small file state under `.codexclaw/`.

```mermaid
flowchart LR
  A["Codex runtime"] --> B["codexclaw plugin manifest"]
  B --> C["Skills"]
  B --> D["Hooks"]
  B --> E["MCP server"]
  B --> F["cxc CLI"]
  D --> G[".codexclaw/sessions/&lt;id&gt;.json"]
  D --> H[".codexclaw/ledger.jsonl"]
  E --> I[".codexclaw/subagents.json"]
  J["optional opencodex"] --> K["detect-only provider status"]
  K --> D
```

## Skills

Skills carry the development discipline. `cxc-dev` is the implicit, always-on classifier; the
rest (`dev-frontend`, `dev-testing`, `pabcd`, `loop`, `interview`, `ast-grep`, ...) load on
demand. The skill hub is a catalog, not a runtime loader. See the
[Skills guide](/codexclaw/guides/skills/).

## Hooks

Five hooks connect Codex lifecycle events to codexclaw state:

| Event | Hook | Role |
|---|---|---|
| `SessionStart` | provider-bridge | Detect `ocx` status (detect-only). |
| `UserPromptSubmit` | pabcd-trigger | Parse orchestrate grammar and inject phase directives. |
| `Stop` | pabcd-continuation | Keep an in-flight cycle advancing under an active goal. |
| `PreToolUse` (`create_goal`) | goal-budget | Guard goal creation. |
| `PreToolUse` (`request_user_input`) | interview-in-goal | Deny interview prompts in goal mode. |

Full matchers and commands are in the [Hooks reference](/codexclaw/reference/hooks/).

## MCP server

The subagent-config MCP server exposes `subagents_get`, `subagents_set`, and `catalog_list`. It
reads and writes role → model/prompt config in `.codexclaw/subagents.json`. See the
[MCP Tools reference](/codexclaw/reference/api-mcp/).

## CLI

The `cxc` / `codexclaw` binary is a thin delegator over the compiled component CLIs:
`enable` / `disable` route to config-guard, `doctor` / `reset` to cxc-ops, and `orchestrate` to
pabcd-state. See the [Commands reference](/codexclaw/reference/commands/).

## File state

All durable state lives under the project `.codexclaw/` directory — session JSON, the append-only
transition ledger, the interview scan-evidence ledger, and subagent config. There is no separate
server or database. See the [State Model](/codexclaw/concepts/state-model/).
