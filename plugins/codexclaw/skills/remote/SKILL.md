---
name: cxc-remote
description: "MUST USE for messenger-bridge remote setup and channel onboarding — connecting Telegram or Discord to codexclaw, pairing a chat, validating bot tokens, registering agents, webhook mode, and remote-control troubleshooting. The agent performs setup end-to-end; the user only supplies tokens and taps pairing triggers. Triggers: remote, bridge setup, messenger, pairing, connect telegram, connect discord, 텔레그램 연결, 디스코드 연결, 메신저 연결, 봇 연결, 원격, 페어링."
metadata:
  last-verified: "2026-07-07"
  short-description: "Agent-run messenger-bridge onboarding ladder: serve -> token -> agent -> pair -> smoke."
---

# remote — Messenger Bridge Setup Ladder

Use this skill when the user wants codexclaw reachable from Telegram or
Discord ("텔레그램 연결해줘", "connect discord", "set up remote"). The agent
runs every step below itself and verifies each one; the user is only needed
for the two steps a bot platform requires a human for (creating the bot and
tapping the pairing trigger).

All API calls target the local bridge at `http://127.0.0.1:7717`. Every
mutating request MUST send BOTH headers, or the server answers 403:

```bash
-H 'content-type: application/json' -H 'x-codexclaw-local: 1'
```

## Ladder (both platforms)

1. **Preflight — is the bridge up?**
   `curl -s http://127.0.0.1:7717/api/health` -> `{"ok":true,...}`.
   Not running? Foreground: `cxc serve --port 7717 --cwd <project>`.
   Daemon (macOS launchd): `cd <project>` FIRST (install binds the current
   working directory as `--cwd`), then `cxc service install --port 7717`.
   Check with `cxc service status`; logs at `~/.codexclaw/serve.{out,err}.log`.
   There is no `serve status` subcommand.
   On Linux, use systemd user units. On Windows, use Task Scheduler. See
   platform-specific sections in `references/telegram.md` and `references/discord.md`.
2. **Token (human step).** Walk the user through bot creation — exact steps in
   [references/telegram.md](references/telegram.md) /
   [references/discord.md](references/discord.md). Never echo the token into
   logs, commit it, or paste it back in chat responses.
3. **Create the named agent (validates the token).** `GET /api/agents` to see
   existing ones. New: `POST /api/agents` with
   `{"name":"...","kind":"telegram"|"discord","token":"..."}` — the server
   validates via TG `getMe` / DC `users/@me` and answers 400 on a bad token
   (stop and re-ask), 200 with `username`/`botId` on success. Existing agent:
   `POST /api/agents/update` with `{"id":<n>,"token":"..."}` (same
   validation). Then `POST /api/agents/enable` with `{"id":<n>,"enabled":true}`.
4. **Pair the chat (human tap).** Snapshot the baseline first:
   `GET /api/agents/handshake/status?id=<n>` -> note `allowlistCount`.
   - TG preferred — one-tap deep link: `POST /api/agents/pairing-link` with
     `{"id":<n>,"seconds":600}` (default 600, cap 3600) returns
     `{"ok":true,"url":"https://t.me/<bot>?start=<code>","code":...,
     "expiresAt":...}`. Send the `url` to the user; tapping it makes Telegram
     send `/start <code>` — the code is single-use and TTL-bounded, no open
     window needed. Never paste the code anywhere else.
   - Window fallback (and the only DC path):
     `POST /api/agents/handshake/open` with `{"id":<n>,"seconds":120}`
     (default 120, cap 600); the user sends `/start` (TG) or types
     `!cxc start` in a channel the bot can read (DC — pairing is a text
     trigger; slash commands reject unpaired channels).
   Either way, poll the status endpoint: pairing succeeded when
   `allowlistCount` grows past the baseline; on expiry mint a fresh link or
   reopen the window.
5. **Smoke test.** `POST /api/agents/test-send` with `{"id":<n>}` messages
   the newest paired chat (an explicit `"chatId"` must already be paired;
   400 otherwise). Then have the user send `/status` (TG) or `!cxc status`
   (DC) — the first gateway command creates the binding row, and only THEN
   does `GET /api/bindings` show it.
6. **Anything wrong** -> [references/troubleshooting.md](references/troubleshooting.md)
   (symptom -> cause -> fix, all distilled from real incidents).

## Platform references

Human-facing overview: the bridge README (served at
`http://127.0.0.1:7717/readme` while the bridge runs).

- [references/telegram.md](references/telegram.md) — BotFather steps, TG
  command surface, forum-topic sessions, optional webhook mode
  (HTTPS `/webhook/telegram/<secret>`, auto-fallback to long-poll).
- [references/discord.md](references/discord.md) — Developer Portal steps,
  Message Content intent, invite URL (`scope=bot&permissions=3072`), slash vs
  text command split, thread mode (slash: `/mode value:thread|plain`; text:
  `!cxc mode thread|plain`).

## Scope guard

- The GUI at `http://127.0.0.1:7717` can do this visually: the **Agents** page
  is the named-agent setup flow (same `/api/agents/*` surface); the Channels
  page is the legacy single-channel shim. Offer the Agents page when the user
  prefers clicking over chat.
- `/api/connect/*` is the legacy single-channel shim (its `validate` even
  stores the token as a side effect); teach and use the `/api/agents/*`
  surface.
- This skill configures the bridge only. Bridge behavior changes (commands,
  adapters, gates) are `cxc-dev` territory, not setup.
