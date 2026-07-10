---
title: How It Works
description: How the codexclaw plugin manifest wires skills, hooks, MCP, and the CLI to the .codexclaw file state.
---

codexclaw is one plugin manifest that registers four kinds of surface with the Codex runtime,
mostly backed by project-local state under `.codexclaw/`.

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
  F --> L["component CLIs"]
  L --> M["optional loopback messenger bridge"]
```

## Skills

Skills carry the development discipline. Eight skills are implicit-visible in the shipped
`agents/openai.yaml` files: `dev`, `search`, `interview`, `pabcd`, `recall`, `loop`,
`dev-frontend`, and `dev-uiux-design`.
Everything else (`dev-backend`, `dev-testing`, `qa`, `repo-map`, `ast-grep`, ...) loads on
demand by explicit mention, trigger match, or `cxc-dev` routing. The skill hub is a catalog, not
a runtime loader. See the [Skills guide](/codexclaw/guides/skills/).

## Hooks

Twelve hooks connect Codex lifecycle events to codexclaw state, covering session start,
orchestration, pre/post-tool guards, subagent evidence, and compaction recovery:

| Event | Hooks | Role |
|---|---|---|
| `SessionStart` (x2) | provider-bridge, map-affordance | Detect `ocx` status; announce `cxc map` availability. |
| `UserPromptSubmit` (x1) | pabcd-trigger | Parse orchestrate grammar and inject phase directives. |
| `Stop` | pabcd-continuation | Keep an in-flight cycle advancing under an active goal. |
| `PreToolUse` (x4) | goal-budget, interview-in-goal, skill-attach, edit-lint | Guard goals, deny interview in goal mode, attach skills to spawns, lint edits. |
| `PostToolUse` (x2) | interview-capture, render-observations | Capture interview answers; track render observations. |
| `SubagentStop` | evidence-verify | Verify subagent evidence bundles. |
| `PostCompact` (x1) | reinject-cursor | Recover PABCD state after context compaction. |

Full matchers and timeouts are in the [Hooks reference](/codexclaw/reference/hooks/).

## MCP server

The subagent-config MCP server exposes `subagents_get`, `subagents_set`, and `catalog_list`. It
reads and writes role → model/prompt config in `.codexclaw/subagents.json`. See the
[MCP Tools reference](/codexclaw/reference/api-mcp/).

## CLI

The `cxc` / `codexclaw` binary is a thin delegator over the compiled component CLIs:
`enable` / `disable` / `uninstall` / `status` route to config-guard, `doctor` / `reset` to
cxc-ops, `orchestrate` / `freeze` / `metric` / `divergence` / `loop` / `goalplan` to
pabcd-state, `chat` / `memory` to recall, `skill search` / `skill show` to skill-search, `map`
to the repo-map skill, `subagents` to subagent-config, `provider` to provider-bridge,
`serve` / `service` to messenger-bridge, and `gui` to the Vite dashboard. See the
[Commands reference](/codexclaw/reference/commands/).

## Components

Eight component packages provide the CLI, hook, MCP, search, and bridge implementations. The
dashboard GUI is a separate workspace package.

| Component | Role |
|---|---|
| `config-guard` | Enable/disable/status for declared Codex feature flags. |
| `cxc-ops` | `doctor` and scoped `.codexclaw/` reset helpers. |
| `pabcd-state` | IPABCD state machine, hooks, goal gates, and phase CLI. |
| `provider-bridge` | Read-only `ocx` provider detection. |
| `subagent-config` | MCP tools and per-role model/prompt store. |
| `recall` | Read-only past chat/memory search over Codex-owned artifacts. |
| `messenger-bridge` | Optional loopback GUI/API relay from Telegram/Discord to stock `codex exec`. |
| `skill-search` | Remote dormant-skill search/show over jaw, hermes, clawhub, and GitHub sources. |

## File state

All durable state lives under the project `.codexclaw/` directory — session JSON, the append-only
transition ledger, the interview scan-evidence ledger, subagent config, and, when `cxc serve` is
opted in, `.codexclaw/bridge.db`. Recall also keeps a rebuildable user-level search cache under
`~/.codexclaw`. See the [State Model](/codexclaw/concepts/state-model/).
