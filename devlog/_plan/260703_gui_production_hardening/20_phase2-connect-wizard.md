# 20 — Phase 2: Connect wizard shows the /start handshake (DOD 2)

- Class: C2 (single GUI file, confirmed root cause) · Audit: micro (self, root cause
  already live-verified in 00/01) · B verification: CLI sub-agent (read-only)
- Root cause (00_research §2): `ChannelCard` render puts `active` first
  (`Channels.tsx:154`), and `connect()` activates + refetches BEFORE setting
  `awaiting-start`, so the "Waiting for the handshake… press /start" view is
  unreachable; the card claims "live" even with 0 paired chats (unpaired messages are
  silently dropped by the allowlist).

## Part 1 — plain

After Connect, the card actually shows "waiting for /start" until pairing is detected,
then a paired confirmation. An active channel with zero paired chats stops pretending
to be fine: it shows a warning and a button to open a new pairing window.

## Part 2 — diff-level (single file: `plugins/codexclaw/gui/src/pages/Channels.tsx`)

1. Render precedence: wizard state wins over `active`:
   `step === "awaiting-start" ? wait : step === "paired" ? paired : active ? live : form`.
2. Unpaired-active warning: in the live branch, when `allowlistCount === 0` show
   hint "active but no chat paired — open a pairing window and send /start" +
   button `Open pairing window` → `api.openHandshake(kind, 180)` → `setStep("awaiting-start")`
   → `startPolling()`. (Reuses existing poll/pair detection; recoverable after expiry.)
3. Paired view: add a `Done` button → `setStep("idle")` (falls through to live view).
4. `ChannelsPage` passes `allowlistCount` already — no parent change.

No server change. `startPolling` already closes the window one-shot server-side via
`handshakeState` (bridge-controller.ts:109-120).

## Verification

- Full `npm test` (no GUI component rig exists — render logic is exercised live).
- gui vite build + CDP: Channels page renders; telegram (active, 1 paired) shows live
  view WITHOUT the unpaired warning; discord (no token) shows the token form.
- Full pairing e2e (real /start from a second chat) is NOT reproducible without a
  second Telegram account — documented limitation; state-machine correctness covered
  by code review (B verification sub-agent) + the live-verified server semantics.
