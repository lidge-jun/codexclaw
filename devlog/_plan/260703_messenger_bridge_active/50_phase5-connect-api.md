# messenger_bridge — Phase 5: connect/manage API

Status: SHIPPED (D closed 2026-07-03; 59/59 suite, gate OK, live curl verified)
· class C3

## D record (2026-07-03)

- Built: `bridge-controller.ts` (owns live adapter lifecycle; `reload()`
  start/stops the active channel's adapter without a server restart; tracks
  handshake pairing via an allowlist baseline), `connect-routes.ts` (8 routes):
  POST validate (getMe/@me token check + save), activate (reload), deactivate,
  handshake/open, GET handshake/status (polling — pairedChatId when a chat
  joins), GET channels, GET bindings, GET bindings/jobs. server.ts ApiCtx now
  carries a structural `BridgeControllerLike` (avoids a controller↔server import
  cycle). cli.ts serve uses the controller, so activating a channel from the
  GUI hot-swaps the bot live.
- Discord token validation added (`DiscordApi.getMe` → GET /users/@me).
- Handshake progress is POLLING, not SSE (plan deviation): simpler, testable,
  window is short-lived; GUI polls status ~1s. Phase 7 wires a poller.
- Tests: connect-routes (6). Suite 59/59; gate OK.
- Live curl (running serve): /api/channels lists both kinds + activeKind;
  validate rejects bad kind; handshake/open then status → open:true.
- FIX found via live check: openHandshake before a token is saved matched zero
  rows (silent no-op); now upserts a channel stub row first.

---
(original stub)
token validate (getMe / Discord REST); handshake wait via SSE; channel
activate/deactivate; bindings list/detail; curl-driveable end to end
