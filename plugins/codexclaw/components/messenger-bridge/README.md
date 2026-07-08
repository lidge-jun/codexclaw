# codexclaw messenger bridge

Control codexclaw from Telegram or Discord. The bridge runs a local HTTP
server (GUI + JSON API, default `http://127.0.0.1:7717`), connects bot
accounts as named agents, and relays chat messages to codex runs — with
streaming progress, media I/O, thread/topic-scoped sessions, and a pre-turn
permission gate.

This file is served live at `http://127.0.0.1:7717/readme` and is the single
human-facing doc. The agent-facing setup ladder lives in the `cxc-remote`
skill (`plugins/codexclaw/skills/remote/`).

## Quick start

```bash
cxc serve --port 7717 --cwd /path/to/project   # foreground
curl -s http://127.0.0.1:7717/api/health        # {"ok":true,...}
```

Run as a daemon (macOS launchd only):

```bash
cd /path/to/project     # install binds the CURRENT directory as --cwd
cxc service install --port 7717
cxc service status      # uninstall with: cxc service uninstall
```

The plist lands at `~/Library/LaunchAgents/com.codexclaw.serve.plist`; logs at
`~/.codexclaw/serve.out.log` and `~/.codexclaw/serve.err.log`. There is no
`cxc serve status` — check `/api/health`.

## Connect a messenger

Everything below can be done visually on the GUI **Agents** page, or by an
agent via the `cxc-remote` skill. All mutating API calls need BOTH headers
(`403` otherwise):

```bash
-H 'content-type: application/json' -H 'x-codexclaw-local: 1'
```

1. Create a bot: Telegram — BotFather `/newbot`; Discord — Developer Portal
   app + bot, enable **Privileged Gateway Intents > Message Content**.
2. Register the agent (validates the token server-side; 400 = bad token):

   ```bash
   curl -sS -X POST http://127.0.0.1:7717/api/agents \
     -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
     --data '{"name":"telegram-main","kind":"telegram","token":"<token>"}'
   ```

   Enable it: `POST /api/agents/enable` with `{"id":<n>,"enabled":true}`.
3. Pair a chat.
   - Telegram one-tap: `POST /api/agents/pairing-link` with
     `{"id":<n>,"seconds":600}` returns
     `{"ok":true,"url":"https://t.me/<bot>?start=<code>","code":...,"expiresAt":...}`.
     The user taps the link; Telegram sends `/start <code>`; the code is
     single-use, TTL-bounded, and stored only as a sha256 hash. Telegram only.
   - Window pairing (both platforms): `POST /api/agents/handshake/open`
     (`{"id":<n>,"seconds":120}`, cap 600), then the user sends `/start` (TG)
     or types `!cxc start` in a visible channel (DC — pairing is a text
     trigger; slash commands reject unpaired channels). Poll
     `GET /api/agents/handshake/status?id=<n>` until `allowlistCount` grows
     past its pre-open baseline.
   - Discord invite URL:
     `https://discord.com/oauth2/authorize?client_id=<botId>&scope=bot&permissions=3072`.
4. Smoke test: `POST /api/agents/test-send` with `{"id":<n>}` messages the
   newest paired chat (an explicit `"chatId"` must already be paired; 400
   otherwise). Then send `/status` (TG) or `!cxc status` (DC) in the chat —
   the first gateway command also creates the session binding shown by
   `GET /api/bindings`.

## Command surface

Shared gateway verbs (Telegram slash commands, Discord `!cxc <verb>` text):
`status`, `sessions`, `jobs`, `agent`, `context`, `new`, `reset`, `cwd`,
`model`, `effort`, `mode`, `stop`, `retry`, `approve`, `help`.

- Telegram extras: `/start`, `/id` (work unpaired), `/pause`, `/resume`,
  `/kick`, `/delete`.
- Discord registered slash commands (subset with native options): `/ask
  prompt:`, `/review target:`, `/status`, `/sessions`, `/jobs limit:`,
  `/agent`, `/model value:`, `/new`, `/stop`, `/effort value:`,
  `/mode value:`, `/cwd path:`, `/help`. Other gateway verbs (`context`,
  `reset`, `retry`, `approve`, ...) are available as `!cxc <verb>` text.
- Examples: `/model list`, `/mode value:plain` (DC) or `/mode plain` (TG),
  `/approve <id> allow-once` (TG) / `!cxc approve <id> allow-once` (DC).

## Sessions

Telegram forum supergroups scope sessions per topic
(`message_thread_id ?? 1`); Discord defaults to auto-threads per task
(archive on completion, 24h idle sweep) — switch with `mode thread|plain`.
Per-binding `/model` and `/effort` overrides beat the agent card, which beats
the default.

## Security model

- Server binds `127.0.0.1` only; mutating routes additionally require the
  `x-codexclaw-local: 1` + JSON content-type guard headers.
- Chats must be paired (allowlist) before any command besides TG `/start`,
  TG `/id`, and DC `!cxc start`; pairing needs an open window or a valid
  single-use deep-link code (sha256 at rest, TTL enforced in the consume
  statement).
- Agents with `fullAccess` off get a pre-turn permission gate
  (allow-once / allow-always / deny, 10-minute fail-closed timeout,
  `/approve` fallback).
- Telegram webhook mode (optional, HTTPS `webhookUrl` ending in
  `/webhook/telegram/<secret>`) validates both the path secret and
  Telegram's `x-telegram-bot-api-secret-token` timing-safely, and falls back
  to long-poll if registration fails.
- Raw bot tokens never leave the server (`hasToken` only in API responses);
  pairing codes appear once, in the mint response.

## Troubleshooting

Symptom -> cause -> fix recipes live in
[the cxc-remote skill references](../../skills/remote/references/troubleshooting.md):
403 guard failures, invalid tokens, TG 429 backoff, webhook silence, DC
Message Content intent, expired pairing windows, permission-gate denials,
wrong service cwd, port conflicts.
