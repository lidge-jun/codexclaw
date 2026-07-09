# WP2 Audit Synthesis — auditor "Epicurus" (gpt-5.5-xhigh), round 1 FAIL -> amend -> PASS

All 6 findings ACCEPTED. Confirmed by auditor: v9 slot free (latest v8 at
db.ts:388), v6/v7/v8 BEGIN/COMMIT/ROLLBACK pattern, server guard auto-covers
new /api/* POSTs (server.ts:303), username NOT stored so getMe per mint is
required, event-log never logs route bodies (no raw-code leak path).

## Accepted corrections -> Amendment A1

1. BLOCKER: TG pairing in the GUI must STOP opening the window.
   PairingPane adapter contract stays open/poll, but the TG agents-page
   adapter's `open()` now MINTS a pairing link (POST /api/agents/pairing-link)
   instead of POST /api/agents/handshake/open; poll stays allowlistCount
   delta. Retry mints a fresh code. Channels (legacy) keeps the window flow.
2. deleteAgent transaction gains `DELETE FROM agent_pairing_codes WHERE
   agent_id = ?` (next to agent_allowlist, db.ts:738-750) + cascade test.
3. test-send follows the heartbeat.ts:39 pattern: construct
   TelegramApi/DiscordApi from agent.token in the route, use
   .sendMessage (telegram-api.ts:157 / discord-api.ts:125), injectable
   factory for tests. No controller surface change.
4. Webhook parity: deep-link tests (valid/expired/second-use) in webhook mode
   too; fix binding pre-creation order so unpaired /start does not create a
   binding (telegram-webhook.ts:104).
5. GUI: mint links + post-pair test-send action in BOTH CreateAgentWizard
   (Agents.tsx:244,329) and AgentPairingModal (Agents.tsx:361,381).
6. ctx.args is a STRING (telegram-commands.ts:34,65): payload = first token
   of ctx.args.trim(); tests use the string shape.

## Endpoint contracts (frozen for parallel workers)

- `POST /api/agents/pairing-link` `{"id":<n>,"seconds"?:<s>}` (default 600,
  cap 3600) -> 200 `{"ok":true,"url":"https://t.me/<username>?start=<code>",
  "code":"<base64url>","expiresAt":<epoch-ms>}`; 400 (bad() shape) for
  discord agents, missing token, failed getMe.
- `POST /api/agents/test-send` `{"id":<n>,"chatId"?:"<id>"}` -> 200
  `{"ok":true,"chatId":"<id>"}`; 400 when agent has no allowlist entry and no
  chatId given, or send fails.

Round 2: amendment addresses all 6 -> PASS.
