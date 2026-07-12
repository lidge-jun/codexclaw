<!-- Purpose: agent-executable Telegram setup ladder for the codexclaw messenger bridge. -->

# Telegram Bridge Setup

Human-facing overview: the bridge README, served at http://127.0.0.1:7717/readme while the bridge runs.

Use for "텔레그램 연결해줘" or "connect Telegram". Base URL:
`http://127.0.0.1:7717`. Use the named-agent API. Mention `/api/connect/*`
only as a legacy shim over the first agent of each kind; do not teach it as a
validation path because `/api/connect/validate` stores tokens as a side effect.

Every mutating API call must include both guard headers or it returns 403:

```bash
-H 'content-type: application/json' -H 'x-codexclaw-local: 1'
```

## 1. Start Bridge
Foreground:
```bash
cxc serve --port 7717 --cwd "$PWD"
curl -sS http://127.0.0.1:7717/api/health
```
macOS service: `cd` to the target project first. Install binds the current
working directory as `--cwd`.
```bash
cd /path/to/project
cxc service install
cxc service status
curl -sS http://127.0.0.1:7717/api/health
```
Service is launchd-only: plist
`~/Library/LaunchAgents/com.codexclaw.serve.plist`, logs
`~/.codexclaw/serve.out.log` and `~/.codexclaw/serve.err.log`. There is no
`cxc serve status`.

**Linux:** create a `codexclaw-serve` systemd user unit, then run
`systemctl --user enable --now codexclaw-serve` (or `enable` and `start` separately).
**Windows:** configure Task Scheduler manually or create the task with `schtasks`.

## 2. Create Or Update Agent
Human step in Telegram BotFather:
```text
/newbot
```
Choose a display name, choose a username ending in `bot`, and copy the token.
`POST /api/agents` validates the token server-side by Telegram `getMe`; 400
means bad token, 200 returns `username` and `botId`.
```bash
read -rsp 'Telegram bot token: ' TG_TOKEN; echo
curl -sS -X POST http://127.0.0.1:7717/api/agents \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"name\":\"telegram-main\",\"kind\":\"telegram\",\"token\":\"$TG_TOKEN\"}"
curl -sS http://127.0.0.1:7717/api/agents
```
Expected create shape:
```json
{"ok":true,"agent":{"id":1,"kind":"telegram","hasToken":true},"username":"...","botId":"..."}
```
If the agent exists, update its token; update re-validates too:
```bash
AGENT_ID=1
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"token\":\"$TG_TOKEN\"}"
```

## 3. Enable And Pair
Enable body is id-based:
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/enable \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"enabled\":true}"
curl -sS http://127.0.0.1:7717/api/agents/statuses
```

Preferred pairing: mint a one-tap deep link. The code is single-use,
TTL-bounded (default 600s, cap 3600), stored server-side only as a sha256
hash, and needs NO open window — tapping the link makes Telegram send
`/start <code>` for the user. Do not paste the code anywhere else.
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/pairing-link \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"seconds\":600}"
```
Response: `{"ok":true,"url":"https://t.me/<bot>?start=<code>","code":"...",
"expiresAt":<epoch-ms>}`. Send `url` to the user, then poll handshake status
below until `allowlistCount` grows. Expired? Mint a fresh link.

Window fallback (plain `/start`, no code):
Snapshot `allowlistCount` before opening. Pairing is detected when it grows.
```bash
curl -sS "http://127.0.0.1:7717/api/agents/handshake/status?id=$AGENT_ID"
curl -sS -X POST http://127.0.0.1:7717/api/agents/handshake/open \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"seconds\":120}"
curl -sS "http://127.0.0.1:7717/api/agents/handshake/status?id=$AGENT_ID"
```
`seconds` defaults to 120 and caps at 600. The status fields are exactly
`open` and `allowlistCount`; expect `open:true` and `allowlistCount` equal to
the pre-open baseline (an already-paired agent starts above 0):
```text
{"open":true,"allowlistCount":<baseline>}
```
There is no `pairedChatId` on `/api/agents/handshake/status`.
Human step: send this to the bot:
```text
/start
```
Poll until `allowlistCount` is greater than the baseline. Smoke test:
```text
/status
```
Or drive the smoke test from the API (`chatId` optional; an explicit one must
already be paired):
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/test-send \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID}"
```

## 4. Commands And Session Scope
Telegram commands:
```text
start, id, status, sessions, jobs, agent, context, new, reset, cwd, model,
effort, mode, stop, retry, approve, pause, resume, kick, delete, help
```
Use as slash commands, for example `/model list` or
`/approve <id> allow-once`. `/start` and `/id` are allowed unpaired.
Forum-topic sessions are scoped by `message_thread_id ?? 1` for Telegram
supergroup forum messages. Set `threadMode:"plain"` to flatten topics into one
chat session, or `threadMode:"thread"` to keep topic scoping:
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"threadMode\":\"plain\"}"
curl -sS http://127.0.0.1:7717/api/agents
```

## 5. Optional Webhook
Default transport is long-poll. To use webhook mode, set `webhookUrl` to an
HTTPS URL with path `/webhook/telegram/<secret>`. Empty string disables webhook;
non-HTTPS returns 400. Token/webhook changes on a running agent trigger a
diff-based adapter reload.
Generate the secret; never paste it into chat or logs.
PowerShell equivalent: `$env:WEBHOOK_SECRET = (openssl rand -hex 24)` and
`$env:WEBHOOK_URL = "https://example.com/webhook/telegram/$env:WEBHOOK_SECRET"`.
```bash
WEBHOOK_SECRET="$(openssl rand -hex 24)"
WEBHOOK_URL="https://example.com/webhook/telegram/$WEBHOOK_SECRET"
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"webhookUrl\":\"$WEBHOOK_URL\"}"
curl -sS http://127.0.0.1:7717/api/agents/statuses
```
Telegram sends `x-telegram-bot-api-secret-token`; the bridge also checks the
path secret. If registration fails, it logs and auto-falls back to long-poll.
In groups, normal messages must mention `@BotUsername` when `mentionOnly` is on.
