# messenger_bridge — GUI channels + agents pages

Status: PENDING (scaffolded 2026-07-03; P for this phase fills diff-level detail)
Parent: 00_plan.md slice map

## Scope / exit criteria

connect wizard (token -> Connect -> press-/start spinner -> pass/fail retry/close); agents view of chat<->session bindings with status; channel switch UI

## Carried-in requirement (from Phase 2 D)

Add reasoning-effort handling to the runner's buildExecArgs when the per-agent
model picker lands: gpt-5.3-codex-luna rejects runs with "Unsupported value:
'none'" unless effort config is set correctly (cli-jaw: omit reasoning args for
luna + pin model_context_window=128000 / model_auto_compact_token_limit=110000;
for non-luna pass `-c model_reasoning_effort="<effort>"`). Model+effort become
per-binding columns editable in the Agents view.

## D record (2026-07-03) — SHIPPED

- Built `pages/Channels.tsx`: the connect wizard the user specified — per-channel
  Card, paste token → Connect (validates via /api/connect/validate) → activate +
  open handshake → "Waiting for the handshake…" spinner with the press-/start
  hint → polls /api/connect/handshake/status every 1.5s → paired ✅ or
  expired/error with retry; Disconnect on the active channel; one-active-channel
  enforced in the UI (other channel's token field disabled with an explanation).
  Discord card surfaces the MESSAGE CONTENT intent + `!cxc start` requirement
  (Phase 4 operator note).
- Built `pages/Agents.tsx`: live table of chat↔codex-session bindings
  (channel, chat id, short thread id, status dot, relative updated-at), polling
  /api/bindings every 4s, with an empty state guiding first connection.
- api.ts extended with the bridge client (getChannels/getBindings/validateToken/
  activate/deactivate/openHandshake/handshakeStatus) using a postJson helper.
- Verification: covered by the Phase 6 build+render checks (Channels/Agents are
  in the same bundle; vite 40-module transform + SSR render pass). Live API the
  pages consume verified in Phase 5 (channels/bindings/handshake curl).
- CARRY-IN (from Phase 2): per-agent model/effort editing (luna effort fix) is
  noted above; the Agents table is the surface for it — deferred as it needs
  per-binding model columns + a runner effort param (not in the first cut).
