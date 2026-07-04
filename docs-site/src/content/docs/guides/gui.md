---
title: GUI Dashboard
description: The codexclaw local dashboard for channels, named agents, subagent model selection, and prompt tuning.
---

codexclaw ships a local dashboard for messenger channels, named bridge agents, and subagent
configuration.

## Launch

```bash
cxc gui
```

`gui` starts the Vite dev server (it prints the local URL). If dependencies are not installed,
run `npm install` in `plugins/codexclaw/gui` first.

For the messenger bridge runtime, use:

```bash
cxc serve
```

`serve` binds `127.0.0.1`, serves the built GUI and `/api/*` from the same origin, and runs the
enabled messenger adapters. `cxc gui` is the dashboard dev-server path; `cxc serve` is the
loopback bridge path.

:::caution[Local-only, unauthenticated]
The GUI is a local development dashboard with no authentication. It is meant for `localhost`
use on your own machine. Do not expose it on a shared network or bind it to a public interface.
:::

## Tabs

- **Channels** — connect Telegram or Discord, validate the bot token, activate the channel, open
  the pairing window, and wait for `/start` (Telegram) or `!cxc start` (Discord). Only one legacy
  channel is active at a time.
- **Agents** — create named Telegram/Discord agents, enable or disable them, choose model and
  reasoning effort, set auto-send and mention-only behavior, open pairing windows, and configure
  heartbeat minutes plus heartbeat prompt. The sessions table shows chat ↔ Codex session bindings.
- **Subagents** — pick a mode (default model vs a specific model) and model per role, and edit
  per-role prompt overrides inline. Writes through the
  [subagent MCP tools](/codexclaw/guides/subagents/).

## Channel and agent state

The bridge dashboard talks to `cxc serve` through local JSON routes:

| Surface | Backing state |
|---|---|
| Channels | bot token presence, active channel, adapter status, paired-chat count |
| Agents | name, messenger kind, token presence, enabled flag, model, effort, auto-send, mention-only, heartbeat settings |
| Sessions | `bindings` rows: messenger, chat id, Codex thread id, status, updated time |

Tokens are not returned by the API; the UI only displays `hasToken`.

## OpenCodex link bar

The dashboard shows a provider link bar reflecting [bridge](/codexclaw/guides/opencodex-bridge/)
state: `native` when `ocx` is absent, or the detected provider/port when `ocx` is active. The bar
reflects detection only — it does not start or configure a provider.
