<!-- Purpose: agent-executable Discord setup ladder for the codexclaw messenger bridge. -->

# Discord Bridge Setup

Human-facing overview: the bridge README, served at http://127.0.0.1:7717/readme while the bridge runs.

Use for "connect discord". Base URL: `http://127.0.0.1:7717`. Use the
named-agent API.

Every mutating API call must include both guard headers or it returns 403:

```bash
-H 'content-type: application/json' -H 'x-codexclaw-local: 1'
```

## 1. Start Bridge
```bash
cxc serve --port 7717 --cwd "$PWD"
curl -sS http://127.0.0.1:7717/api/health
```
macOS service: `cd` to the target project first. Install binds current cwd.
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

## 2. Create Discord Bot
Human step in Discord Developer Portal:
1. Create/select an application.
2. Bot > add/reset bot token.
3. Bot > Privileged Gateway Intents > enable Message Content Intent.
4. Save changes.
Message Content is required because pairing is a text trigger and the gateway
must receive message text.
`POST /api/agents` validates the token server-side by Discord `users/@me`; 400
means bad token, 200 returns `username` and `botId`.
```bash
read -rsp 'Discord bot token: ' DC_TOKEN; echo
curl -sS -X POST http://127.0.0.1:7717/api/agents \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"name\":\"discord-main\",\"kind\":\"discord\",\"token\":\"$DC_TOKEN\"}"
curl -sS http://127.0.0.1:7717/api/agents
```
Expected create shape:
```json
{"ok":true,"agent":{"id":1,"kind":"discord","hasToken":true},"username":"...","botId":"..."}
```
If the agent exists, update its token; update re-validates too:
```bash
AGENT_ID=1
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"token\":\"$DC_TOKEN\"}"
```

## 3. Invite, Enable, Pair
Invite URL uses scope `bot` and permissions `3072`:
```bash
BOT_ID='replace-with-botId-from-create'
printf 'https://discord.com/oauth2/authorize?client_id=%s&scope=bot&permissions=3072\n' "$BOT_ID"
```
Open the URL and authorize the bot into the target server. Then enable:
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/enable \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"enabled\":true}"
curl -sS http://127.0.0.1:7717/api/agents/statuses
```
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
Human step: in a visible text channel, type exactly:
```text
!cxc start
```
Pairing is a text trigger. Slash commands reject unpaired channels. Poll until
`allowlistCount` is greater than the baseline. Smoke test:
```text
!cxc status
```

## 4. Commands
Slash commands:
```text
/ask prompt, /review target, /status, /sessions, /jobs limit, /agent,
/model value, /new, /stop, /effort value, /mode value, /cwd path, /help
```
Text commands:
```text
!cxc start
!cxc status, context, new, reset, cwd, model, effort, mode, stop, retry,
approve, sessions, jobs, agent, pause, resume, kick, help
```
Only `!cxc start` pairs an unpaired channel. Other text commands and all slash
commands require pairing.

## 5. Thread Mode
Discord agents default to `thread` mode. In guild channels, a normal message
creates a task thread, admits that thread, sends progress/result there, then
archives it on completion. A 24h idle sweep archives and removes old task-thread
bindings. Use `plain` mode to reply in the origin channel.
```bash
curl -sS -X POST http://127.0.0.1:7717/api/agents/update \
  -H 'content-type: application/json' -H 'x-codexclaw-local: 1' \
  --data "{\"id\":$AGENT_ID,\"threadMode\":\"plain\"}"
curl -sS http://127.0.0.1:7717/api/agents
```
Users can also run:
```text
!cxc mode thread
!cxc mode plain
/mode value:thread
/mode value:plain
```
