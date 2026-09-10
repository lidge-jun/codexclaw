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

Twenty-eight registered hook files provide 29 event handlers connecting Codex lifecycle events to state, covering session start,
orchestration, recall injection, pre/post-tool guards, subagent evidence, and compaction
recovery:

| Event | Hooks | Role |
|---|---|---|
| `SessionStart` (x8) | provider-bridge, pabcd-bootstrap, feature-healing, map-affordance, subagent-fallback, recall-context, session-start-detecting-managed-worktree, bg-wake-adopt | Detect `ocx` status; bootstrap session state; heal declared soft flags (hard flags require `cxc enable`); announce affordances; announce the subagent fallback protocol; inject recall context; check managed-worktree identity; adopt background completions. |
| `UserPromptSubmit` (x5) | pabcd-trigger, recall-intent, user-prompt-submit-guiding-worktree-rename, compact-affordance recovery, bg-wake-deliver | Parse orchestrate grammar and inject phase directives; detect recall phrasing; guide managed-worktree renames; consume a queued compact hint once for the root session. |
| `Stop` (x2) | pabcd-continuation, bg-wake-stop | Keep an in-flight cycle advancing under an active goal; wake on background task completion. |
| `PreToolUse` (x7) | goal-budget, interview-in-goal, goal-complete, skill-attach, edit-lint, pre-tool-use-guarding-managed-worktree-deletion, pre-tool-use-guarding-memory-write | Guard goals, deny interview in goal mode, gate goal completion, attach skills to spawns, lint edits, guard managed-worktree deletion, deny unsolicited writes under the Codex memories directory. |
| `PostToolUse` (x2) | interview-capture, render-observations | Capture interview answers; track render observations. |
| `SubagentStop` (x2) | evidence-verify, review-observer | Verify evidence bundles and record review verdicts. |
| `PostCompact` (x3) | reinject-cursor, recall-context, bg-terminal-affordance | Reset the PABCD reinjection cursor; emit nothing from recall PostCompact (recovery rides SessionStart `source=compact`); queue an affordance marker for a later root prompt. |

The compact-affordance file registers both `PostCompact` and `UserPromptSubmit`.
`PostCompact` itself emits no affordance context: the next root prompt consumes its
workspace/session marker once. Child events cannot consume the parent's marker;
without another prompt there is no same-turn or Stop recovery guarantee.

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

The CLI has two tiers for v0.1.1. The marketplace payload ships its own dispatcher at
`bin/cxc.mjs`, so every install can run `node "<pluginRoot>/bin/cxc.mjs" <command>` — the
SessionStart banner prints the exact resolved invocation when `cxc` is not on `PATH`. Placing
`cxc` itself on `PATH` remains a repo-checkout convenience (npm link or a shell alias).

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
