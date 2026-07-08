<!-- Purpose: real-behavior troubleshooting entries for the codexclaw messenger bridge. -->

# Messenger Bridge Troubleshooting

Human-facing overview: the bridge README, served at
http://127.0.0.1:7717/readme while the bridge runs.

Use only behavior verified in source. Base URL: `http://127.0.0.1:7717`.
Mutating API calls need both guard headers:

```bash
-H 'content-type: application/json' -H 'x-codexclaw-local: 1'
```

## 403 On API
Symptom: POST returns `{"error":"forbidden: ..."}`. Cause: missing JSON content
type or missing `x-codexclaw-local: 1`. Fix:
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/handshake/open \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data '{"id":1,"seconds":120}'
curl -sS http://127.0.0.1:7717/api/health
```

## Invalid Token
Symptom: create/update returns `{"ok":false,"error":"..."}`. Cause: Telegram
`getMe` or Discord `users/@me` failed. Fix:
```bash
read -rsp 'New bot token: ' BOT_TOKEN; echo
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":1,\"token\":\"$BOT_TOKEN\"}"
curl -sS http://127.0.0.1:7717/api/agents
```
`POST /api/agents` also validates and creates in one step.

## Telegram 429
Symptom: Telegram replies delay or private-chat draft progress stops. Cause:
Telegram returned `retry_after`; normal calls wait and retry once. Draft progress
suspends until `retry_after` and repeated draft failures disable draft progress
for that turn. Fix:
```bash
tail -n 80 ~/.codexclaw/serve.err.log
curl -sS http://127.0.0.1:7717/api/agents/statuses
```
Wait the indicated window, then smoke test `/status`.

## Webhook Not Receiving
Symptom: Telegram webhook mode receives nothing. Cause: `webhookUrl` must be
HTTPS or empty, path must be `/webhook/telegram/<secret>`, and Telegram must
send matching `x-telegram-bot-api-secret-token`. Groups are mention-gated when
`mentionOnly` is true. Registration failure auto-falls back to long-poll. Fix:
```bash
WEBHOOK_SECRET="$(openssl rand -hex 24)"
WEBHOOK_URL="https://example.com/webhook/telegram/$WEBHOOK_SECRET"
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":1,\"webhookUrl\":\"$WEBHOOK_URL\"}"
curl -sS http://127.0.0.1:7717/api/agents/statuses
tail -n 120 ~/.codexclaw/serve.out.log
```
In Telegram groups, mention `@BotUsername` or disable mention-only:
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data '{"id":1,"mentionOnly":false}'
```

## Discord Slash Commands Missing Or Rejecting
Symptom: slash commands do not appear or say to connect first. Cause: commands
register after gateway READY and can take time; slash commands reject unpaired
channels. Fix:
```bash
curl -sS http://127.0.0.1:7717/api/agents/statuses
curl -sS -X POST http://127.0.0.1:7717/api/agents/handshake/open \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data '{"id":1,"seconds":120}'
```
Then type `!cxc start` in the visible channel and verify with `!cxc status`.

## Discord Message Content Missing
Symptom: bot is online but `!cxc start` does nothing. Cause: Message Content
Intent is disabled in Developer Portal, so gateway message text is empty. Fix:
enable Bot > Privileged Gateway Intents > Message Content Intent, save, reopen
pairing, then type `!cxc start`.
Verify:
```bash
curl -sS "http://127.0.0.1:7717/api/agents/handshake/status?id=1"
curl -sS -X POST http://127.0.0.1:7717/api/agents/handshake/open \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data '{"id":1,"seconds":120}'
```
Note the baseline `allowlistCount`, have the user type `!cxc start`, poll the
status endpoint until `allowlistCount` grows past the baseline, then confirm
with `!cxc status` in the channel.

## Pairing Window Expired
Symptom: `/start` or `!cxc start` does not connect. Cause: default window is
120s, cap is 600s. Fix:
```bash
curl -sS 'http://127.0.0.1:7717/api/agents/handshake/status?id=1'
curl -sS -X POST http://127.0.0.1:7717/api/agents/handshake/open \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data '{"id":1,"seconds":600}'
curl -sS 'http://127.0.0.1:7717/api/agents/handshake/status?id=1'
```
Snapshot `allowlistCount` before opening and poll until it grows. There is no
`pairedChatId` on the agent status endpoint.

## Permission Gate For fullAccess=false
Symptom: chat receives an approval card. Cause: `fullAccess:false`; choices are
`allow-once`, `allow-always`, or `deny`. Approval waits fail closed after 10min.
`allow-always` flips the agent to `fullAccess:true`. Fix:
```text
/approve list
/approve <id> allow-once
!cxc approve list
!cxc approve <id> allow-once
```
API override:
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data '{"id":1,"fullAccess":true}'
curl -sS http://127.0.0.1:7717/api/agents
```

## Wrong Project Cwd From Service
Symptom: `/status` or `!cxc status` shows the wrong `cwd`. Cause:
`cxc service install` writes current cwd into launchd plist. Fix:
```bash
cxc service uninstall
cd /path/to/correct/project
cxc service install
cxc service status
curl -sS http://127.0.0.1:7717/api/health
```

## Port Conflict On 7717
Symptom: `cxc serve` cannot listen or health fails. Cause: another process owns
the default port. Fix:
```bash
lsof -nP -iTCP:7717 -sTCP:LISTEN
cxc serve --port 7727 --cwd "$PWD"
curl -sS http://127.0.0.1:7727/api/health
```
