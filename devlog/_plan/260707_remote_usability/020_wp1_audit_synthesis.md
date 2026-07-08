# WP1 Audit Synthesis — auditor "Fermat" (gpt-5.5-xhigh), round 1 FAIL -> amend -> PASS

Verdict round 1: FAIL, 2 BLOCKER / 6 MAJOR / 3 MINOR. All 11 findings ACCEPTED
(no rebuttals). These were exactly the wrong-instruction failure class the
C-gate was designed to catch, caught earlier at A instead.

## Accepted corrections (diff-level, feed into skill files verbatim)

1. BLOCKER — every mutating `/api/*` call MUST send `content-type:
   application/json` AND `x-codexclaw-local: 1` (server.ts:190,303 guard;
   otherwise 403). All curl examples in references carry both headers.
2. BLOCKER — DC pairing is a TEXT trigger, not slash registration: invite bot
   -> Message Content intent -> handshake open -> user types `!cxc start` in a
   visible channel -> poll status (discord-adapter.ts:57,386,463,168). Slash
   commands reject unpaired channels.
3. MAJOR — handshake shapes: `POST /api/connect/handshake/open` body
   `{"kind":"telegram"|"discord","seconds"?:number}` default 120 cap 600;
   `GET /api/connect/handshake/status?kind=...` returns `{open, pairedChatId}`
   (connect-routes.ts:106,119).
4. MAJOR — DECISION: the skill teaches the CURRENT named-agent API as primary:
   `GET/POST /api/agents`, `POST /api/agents/update|enable|delete`,
   `POST /api/agents/handshake/open`, `GET /api/agents/handshake/status`,
   `GET /api/agents/statuses` (agent-routes.ts:53-215). Legacy single-channel
   `/api/connect/*` is mentioned once as the legacy shim, not taught.
5. MAJOR — CLI is the installed top-level `cxc serve --port 7717 --cwd <path>`
   and `cxc service install|uninstall|status`; there is NO `serve status`;
   liveness = `GET /api/health` (bin/codexclaw.mjs:17,296; cli.ts:146).
6. MAJOR — service install: macOS launchd only, binds CURRENT cwd as --cwd
   (wrong-project foot-gun -> skill warns to cd to the target project first),
   writes ~/Library/LaunchAgents/com.codexclaw.serve.plist, logs to
   ~/.codexclaw/serve.{out,err}.log (service.ts:48,95).
7. MAJOR — DC setup must include Bot -> Privileged Gateway Intents -> Message
   Content, invite URL `scope=bot&permissions=3072` (discord-gateway.ts:27,
   Channels.tsx:255, pairing.tsx:29).
8. MAJOR — TG webhook surface: set agent `webhookUrl` via /api/agents/update;
   HTTPS + path `/webhook/telegram/<secret>`; Telegram sends
   `x-telegram-bot-api-secret-token`; failure falls back to long-poll
   (telegram-webhook.ts:45, bridge-controller.ts:207, server.ts:292).
9. MINOR — DC docs split: slash (`/ask`, `/review`, `/status`, `/sessions`,
   `/jobs`, `/agent`, `/model`, `/new`, `/stop`, `/effort`, `/mode`, `/cwd`,
   `/help`) vs text (`!cxc start`, gateway verbs, pause/resume/kick/help).
10. MINOR — front-matter: `name`, `description`, `metadata.short-description`;
    `metadata.last-verified` optional (search uses it — we adopt it); inline
    relative `references/...` links.
11. MINOR — GUI served from plugins/codexclaw/gui/dist, bound 127.0.0.1,
    SPA fallback; default port 7717 confirmed.

## Plan amendment A1

010_wp1_plan.md inventory superseded by the corrected inventory above.
Ladder step 3-6 rewritten to use /api/agents/* with guard headers; DC ladder
forked from TG at pairing (text trigger). Round 2: amendment reviewed against
findings — all 11 addressed -> PASS.
