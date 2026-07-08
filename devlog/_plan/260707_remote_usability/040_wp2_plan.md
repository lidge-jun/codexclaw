# WP2 Plan — TG deep-link code pairing + test-send + wizard wiring

Date: 2026-07-07. Phase: P (cycle 2).

## Reality check (pre-plan exploration)

- GUI already ships a shared pairing wizard: `gui/src/components/pairing.tsx`
  (PairingPane, botDeepLink, countdown, copy chip, expiry+retry), used by BOTH
  Channels (legacy pairedChatId poll) and Agents (allowlistCount-delta poll).
  DC invite URL generator already exists (`botDeepLink`:
  `discord.com/oauth2/authorize?client_id=<botId>&scope=bot&permissions=3072`).
- TG deep link today is bare `https://t.me/<username>` — pairing still depends
  on the 180s window race (`HANDSHAKE_SECONDS = 180`).
- `handleStart` (telegram-commands.ts:108) ignores the /start payload
  entirely: window open -> admit, else null.
- Hermes-level gap: one-tap `t.me/<bot>?start=<code>` pairing (code carries
  authorization; no window race; works cross-device) + a "send test message"
  completion step.

## Deliverables (delta only)

### Bridge (worker A)
1. db.ts: migration v9 — `agent_pairing_codes` table
   `(id, agent_id, code_hash, created_at, expires_at, consumed_at)`.
   BEGIN/COMMIT/ROLLBACK-guarded like v6/v7/v8. Methods:
   `createAgentPairingCode(agentId, code_hash, ttlSeconds)`,
   `consumeAgentPairingCode(agentId, code_hash)` (single-use CAS:
   `UPDATE ... SET consumed_at = ? WHERE agent_id = ? AND code_hash = ? AND
   consumed_at IS NULL AND expires_at > ?`), `sweepExpiredPairingCodes()`.
2. agent-routes.ts: `POST /api/agents/pairing-link` body
   `{"id":<n>,"seconds"?:number}` (default 600, cap 3600 — deep links travel
   to phones; longer than the window default is intentional). Generates
   crypto-random code (>=16 bytes base64url), stores sha256(code), calls TG
   `getMe` for the username, returns
   `{ok, url:"https://t.me/<username>?start=<code>", code, expiresAt}`.
   TG-only: 400 for discord agents (DC has no start payload; text trigger
   stays).
3. telegram-commands.ts handleStart: parse payload (`/start <code>`); when a
   payload exists, try `consumeAgentPairingCode` — valid: admit + log
   `deep-link paired`; invalid/expired/consumed: fall through to the window
   path (window open -> admit; else null). No payload = current behavior.
4. `POST /api/agents/test-send` body `{"id":<n>,"chatId"?:string}` — sends a
   short greeting through the agent adapter to `chatId` or the most recent
   `agent_allowlist` row; 400 when none. Returns `{ok, chatId}`. Works for TG
   and DC (both have sendMessage-capable APIs).
5. Tests (bridge suite): code mint shape + hash-only storage; consume ok;
   expiry rejected; second consume rejected (single-use); wrong-agent code
   rejected; deep-link /start admits without open window; bare /start
   unchanged; pairing-link 400 for DC agent; test-send happy path + no-target
   400 + guard headers 403.

### GUI (worker B)
6. api.ts: `mintPairingLink(id, seconds?)`, `testSend(id)` typed wrappers.
7. pairing.tsx: PairingPane accepts optional `deepLinkUrl` override (falls
   back to botDeepLink); TG instructions mention one-tap link.
8. Agents.tsx: when opening the pairing pane for a TG agent, mint a pairing
   link first and pass it; after `onPaired`, show a "Send test message"
   action driving `POST /api/agents/test-send` with success/error toast.
   Channels page (legacy) untouched.

## Security notes (C-gate focus)

- Only sha256(code) at rest; raw code appears once in the mint response.
- Single-use enforced by CAS UPDATE; TTL enforced in the same statement.
- Mint/test-send endpoints inherit the local guard (content-type +
  x-codexclaw-local) automatically via server.ts middleware — tests assert.
- Deep-link admit bypasses the window BY DESIGN (the code IS the
  authorization); document in code comment + skill reference later (wp3).

## Out of scope

- DC deep-link codes (no platform support), Channels-page changes, binding
  auto-creation on pairing (bindings still form on first gateway command).

## Verification

- `node --test 'test/*.test.ts'` (bridge), `npm run build`, `npm run gate`,
  GUI vite build. Criteria c2 (pairing round-trip tests), c3 (wizard drives
  real endpoints + vite build), c5 partial.
