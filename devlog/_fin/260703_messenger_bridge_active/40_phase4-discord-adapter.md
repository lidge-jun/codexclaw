# messenger_bridge — Phase 4: Discord adapter

Status: SHIPPED (D closed 2026-07-03; 53/53 suite, gate OK) · class C3 · zero
deps: global WebSocket gateway + REST over fetch (discord.js from the stub
dropped)

## D record (2026-07-03)

- Built: `discord-api.ts` (REST send/typing/gateway-url over fetch, `Bot`
  auth, 2000-char chunking), `discord-gateway.ts` (v10 gateway client:
  Hello→jittered heartbeat, Identify with intents, READY, MESSAGE_CREATE,
  Reconnect→resume / Invalid-Session→re-identify, injectable WsFactory),
  `discord-adapter.ts` (same contract as Telegram: own-bot skip → allowlist →
  `!cxc start` handshake; typing + chunked reply). Serve wiring routes the
  active channel to the right adapter.
- Gateway constants DOC-VERIFIED (discord.com/developers/docs, 2026-07-03):
  WSS `wss://gateway.discord.gg/?v=10&encoding=json`; opcodes 0/1/2/6/7/9/10/11;
  intents GUILD_MESSAGES 1<<9, DIRECT_MESSAGES 1<<12, MESSAGE_CONTENT 1<<15
  (privileged — must be enabled in the dev portal or the gateway closes 4014);
  identify properties os/browser/device; REST `Authorization: Bot <token>`.
- Tests: discord-gateway (5, fake WebSocket driving the opcode lifecycle incl.
  resume + re-identify), discord-adapter (4, injected fetch/ws). Suite 53/53.
- KEY LEARNING: a fake WebSocket fires `close` synchronously, re-entering
  reconnect(). Fixed with a `reconnecting` guard + null-ref-before-close, so one
  disconnect yields exactly one reconnect (real async sockets were unaffected,
  but the invariant is now explicit).
- OPERATOR NOTE (surface in Phase 7 connect wizard): Discord requires enabling
  the MESSAGE_CONTENT privileged intent in the bot's Developer Portal settings,
  else no message text arrives. Discord uses `!cxc start` (no native /start).

---
(original stub)
discord.js gateway; DM + guild channel; same adapter contract as Telegram;
message-content intent documented; one-active-channel rule enforced at serve level
