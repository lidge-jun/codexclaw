---
title: Messenger Bridge
description: Run the optional loopback bridge that relays Telegram or Discord messages to stock codex exec.
---

The messenger bridge is an opt-in local relay. It connects allowlisted Telegram or Discord chats
to stock `codex exec` / `codex exec resume`, persists chat-session bindings in
`.codexclaw/bridge.db`, and serves the bridge GUI plus JSON API from the same loopback origin.

It is not an orchestrator. It does not dispatch subagents, write the native goal DB, proxy
providers, or replace Codex runtime behavior.

## Start

```bash
cxc serve
```

```bash
cxc serve --port 7717 --cwd /path/to/project
```

`serve` binds `127.0.0.1`, opens the project-scoped bridge DB, serves the built GUI, exposes
`/api/*`, starts enabled adapters, and starts the heartbeat scheduler.

For a background macOS launchd service:

```bash
cxc service install
cxc service status
cxc service uninstall
```

`cxc service install` runs `cxc serve` for the current working directory.

## Connect Flow

| Step | Telegram | Discord |
|---|---|---|
| Create token | Bot token from BotFather. | Bot token from the Discord Developer Portal. |
| Validate | Paste token in the GUI; `/api/connect/validate` checks it. | Paste token in the GUI; `/api/connect/validate` checks it. |
| Activate | GUI starts the adapter through `cxc serve`. | GUI starts the adapter through `cxc serve`. |
| Open pairing | GUI opens a short handshake window. | GUI opens a short handshake window. |
| Pair chat | Send `/start` to the bot. | Send `!cxc start` in the channel. |
| Allowlist | First chat during the open window is stored. | First channel during the open window is stored. |

Messages from non-allowlisted chats are ignored. Telegram groups require the bot mention; named
agents can also enforce mention-only behavior for Discord guild channels.

## Named Agents

The Agents tab creates one bot-token-backed agent per card:

| Setting | Effect |
|---|---|
| `enabled` | Starts or stops that agent's adapter. |
| `model` | Uses a specific Codex model, or `default` to inherit. |
| `reasoning effort` | Sets `model_reasoning_effort` for the agent's turns when not `default`. |
| `auto-send` | Controls whether successful results are forwarded back to chat. |
| `mention-only` | Requires mention in group/guild contexts when supported. |
| `heartbeat minutes` / prompt | Runs the prompt periodically when enabled, paired, due, and idle. |

All enabled named agents can run concurrently. The legacy Channels tab is still one-active-channel
oriented.

## Session Binding

Each paired chat gets a 1:1 binding to a Codex session:

| Binding field | Meaning |
|---|---|
| `chat_id` | Telegram chat id or Discord channel id. |
| `agent_id` | Named agent owner, or legacy channel binding. |
| `thread_id` | Captured Codex thread id from `thread.started`. |
| `workdir` | Project directory passed to `cxc serve`. |
| `status` | `idle` or `running`. |

The first message starts `codex exec --json`. Later messages resume with
`codex exec resume <thread_id>`. If the saved rollout is gone, the bridge starts a fresh thread
once and prefixes a context re-seed block built from recent job previews.

Codex auto-compact is enabled through the runner's config arguments, so long chats can continue
through normal Codex compaction behavior.

## Security Boundary

Bridge turns run Codex with full permissions:

```text
--dangerously-bypass-approvals-and-sandbox
```

The boundary is therefore operational, not sandbox-based:

| Boundary | Detail |
|---|---|
| Loopback port | `cxc serve` listens on `127.0.0.1`; remote access is through the messenger APIs. |
| Host and mutation guard | Local API rejects non-loopback Host headers and requires JSON plus `x-codexclaw-local: 1` for mutating requests. |
| Allowlist | Only chats admitted during an open handshake window can run turns. |
| Token custody | Bot tokens live in `.codexclaw/bridge.db`; the API returns token presence, not raw tokens. |
| Mention gates | Group/guild traffic can require explicit bot mention. |

Telegram persists the polling offset before dispatch, avoiding replay of a started full-permission
turn after a crash. Discord also keeps a bounded in-memory duplicate-message guard; the accepted
residual is that Discord gateway redelivery after a process crash can still replay a recent
`MESSAGE_CREATE` because there is no persisted per-message offset.

## API Shape

The GUI uses local JSON routes:

| Route | Purpose |
|---|---|
| `GET /api/health` | Version and active-channel status. |
| `POST /api/connect/validate` | Validate and store a Telegram/Discord token. |
| `POST /api/connect/activate` | Enable the selected legacy channel. |
| `POST /api/connect/handshake/open` | Open a legacy pairing window. |
| `GET /api/connect/handshake/status` | Poll pairing status. |
| `GET /api/channels` | Channel cards. |
| `GET /api/bindings` | Chat-session bindings. |
| `GET /api/agents` | Named agent cards. |
| `POST /api/agents` | Create a named agent. |
| `POST /api/agents/update` | Change model, effort, token, heartbeat, or toggles. |
| `POST /api/agents/enable` | Start or stop an agent adapter. |
| `POST /api/agents/handshake/open` | Open an agent pairing window. |
