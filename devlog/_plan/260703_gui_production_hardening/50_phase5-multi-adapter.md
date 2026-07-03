# 50 — Phase 5: multi-adapter runtime — N agents live concurrently (DOD 3)

- Class: C3 (runtime architecture + legacy API semantics) · A: employee audit required.
- Depends on slice 40 (agents/agent_allowlist/bindings v4, seeded parity with channels).

## Part 1 — plain

The bridge runs one adapter PER ENABLED AGENT (each with its own bot token), all
concurrently — telegram-1, telegram-2, discord-1 side by side. Agents become the
single runtime source of truth; the old single-channel API keeps working as a thin
shim over agent "<kind>-1", so the current GUI stays functional until slice 60.

## Part 2 — diff-level

### 1. `telegram-adapter.ts` — agent scoping
- `TelegramAdapterOptions` gains `agent?: { id: number }`. When present:
  - poll offset: `db.getAgent(id).poll_offset` / `db.setAgentPollOffset` (else legacy channel offset).
  - `/start`: `db.isAgentHandshakeOpen(id)` → `db.addAgentAllowlist(id, chat)` → `db.closeAgentHandshake(id)`.
  - gate: `db.isAgentAllowed(id, chatId)`.
  - group mention gate: read the agent row per message (cheap sqlite) —
    `mention_only=1` → require @botusername (current behavior); `0` → respond to any
    allowlisted group message. DMs always respond.
  - dispatch: `agentService.handleIncoming({ …, agentId: id })`.
- No `agent` → byte-identical legacy behavior (all existing tests must stay green).

### 2. `discord-adapter.ts` — agent scoping (same contract)
- `agent?: { id: number }`: `!cxc start` pairs into agent_allowlist via agent
  handshake; gate via `isAgentAllowed`; dispatch with `agentId`.
- mention gate: gateway READY carries the bot user id — `mention_only=1` requires
  `<@botId>` in content for guild channels (respond-all when 0). If the ready
  payload lacks the id, fall back to respond-all + log once (documented).

### 3. `agent-service.ts` — agent-aware binding
- `IncomingRequest.agentId?: number` → `runOne` resolves the binding via
  `getOrCreateAgentBinding(agentId, kind, chatId, workdir)` when present, else the
  legacy `getOrCreateBinding`. Queue key stays `binding.id` (per-agent-per-chat
  serialization for free; distinct agents on one chat = distinct bindings = parallel).

### 4. `bridge-controller.ts` — N adapters
- `adapters: Map<agentId, { adapter, kind, token }>`; ONE shared AgentService.
- `reload()`: enabled+token agents = desired set; stop adapters that vanished /
  got disabled / changed token or kind; start missing ones. Adapter starts stay
  sequential (simple, deterministic logs).
- `stop()`: stop all + agentService.shutdown().
- `agentStatuses(): Array<{agentId, name, kind, status}>` (new API surface for 60).
- Legacy `BridgeControllerLike` compat shims: `activeKind()` = kind of the first
  running adapter (null if none); `adapterStatus()` = single adapter → its status,
  else `"N running"`; `openHandshake(kind, s)` / `handshakeState(kind)` → routed to
  the FIRST enabled agent of that kind (db fallback unchanged signature).

### 5. `connect-routes.ts` — legacy API as a shim over agents
- validate: unchanged behavior + upsert agent `"<kind>-1"`: create (disabled) with
  the token if no agent of that kind exists; else update the FIRST agent-of-kind's
  token.
- activate: `setActiveChannel(kind)` (legacy table stays coherent) + enable that
  kind's first agent + `controller.reload()`.
- deactivate: `setActiveChannel(null)` + disable ALL agents + reload (legacy
  semantic: "turn the messenger off").
- GET /api/channels: `active` = any enabled agent of the kind; `allowlistCount` =
  sum of that kind's agents' allowlist counts (falls back to legacy count when the
  kind has no agents); `activeKind`/`adapterStatus` from the controller shims.
- POST /api/agents/enable + delete + update(token) now call `controller.reload()`?
  NO — reload() is now agent-diff-based and no longer bounces unrelated adapters,
  so enable/delete DO call `ctx.controller?.reload()` (revisits the slice-40
  flag-only decision — the objection was legacy-bounce, which the diff-based
  reload removes; token update while enabled also reloads).

### 6. `cli.ts` — unchanged (`controller.reload()` on boot starts every enabled agent).

## Tests
- NEW `test/bridge-controller.test.ts`: fake telegram fetch + fake discord ws
  (reuse fixtures from telegram-adapter/discord-gateway tests): 2 tg agents + 1
  dc agent enabled → 3 adapters running with distinct tokens; disable one →
  reload stops exactly it; token change → restart; stop() kills all.
- MODIFY `test/telegram-adapter.test.ts`: add agent-scoped cases — /start pairs
  into agent_allowlist + closes the agent window; mention_only=0 group responds
  without mention; agent binding created with agent_id.
- MODIFY `test/discord-adapter.test.ts`: agent-scoped `!cxc start` + mention gate.
- MODIFY `test/connect-routes.test.ts`: activate enables the kind's agent;
  deactivate disables all; channels GET reflects agent state.
- MODIFY `test/agent-routes.test.ts`: enable/delete now reload (stub controller
  call count).

## Verification
- Full suite; throwaway serve e2e: create 2 agents via /api/agents (stub-token
  impossible against real Telegram — use validate stub? No: e2e uses the REAL
  telegram token only for the seeded agent; concurrency e2e with fake tokens is
  covered by unit tests. Throwaway serve asserts: /api/agents lists seeded agent,
  /api/channels synthesizes from agents, health OK).
- The LIVE serve (user terminal) keeps the old dist until user restart —
  documented; no behavior risk (v4 file + v3 code verified in slice 40).

## Risks
- Two adapters with the SAME token would 409-fight on getUpdates — the runtime
  key is per-agent; guard: reload() logs+skips a second agent whose token equals
  an already-running same-kind adapter's token.
- Shared AgentService child-process registry now spans agents — shutdown() kills
  everything (intended for serve shutdown).
