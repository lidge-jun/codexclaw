# 00 — GUI production hardening: investigation (pre-interview research)

- Date: 2026-07-03
- Trigger: user report against the live GUI (screenshot 2026-07-02 17:52, Channels page,
  telegram active, footer `ocx :10100 · v0.1`) + request to raise the GUI to production grade.
- Method: source read + LIVE probe of the running bridge (`http://127.0.0.1:7717`, curl +
  CDP browser). All findings below are evidence-backed, not speculation.

## Live-instance baseline (verified 2026-07-03 ~02:00)

- `GET /api/health` → `{ok:true, version:"0.1.0", activeChannel:"telegram"}`
- `GET /api/subagents` → 3 roles, all `mode:"default"`
- `GET /api/catalog` → `state:"unsupported-ocx-catalog"`, 4 native entries only
  (gpt-5.5 / gpt-5.4 / gpt-5.4-mini / gpt-5.3-codex-spark) — NO ocx-routed models
- `GET /api/provider` → `{mode:"provider", port:10100}` (ocx detected)
- `GET /api/channels` → telegram active/running (1 allowlisted chat), discord no token
- `GET /api/bindings` → 1 binding: telegram chat 8231528245 → codex thread,
  `workdir:/Users/jun/Developer/new/700_projects/jawcode`, `model:"default"`
- CDP: clicking sidebar → Subagents RENDERS correctly today (3 role cards, 4-model
  dropdown each). GUI dist was rebuilt 2026-07-03 01:54 — AFTER the user's screenshot
  (07-02 17:52), so the "blank subagent list" report may have hit a stale/broken build,
  OR means something else (needs interview).

## Issue-by-issue findings

### 1. "Subagent list doesn't show"

- Page renders now (CDP-verified). Three candidate meanings, each with a real gap behind it:
  a) Blank page at report time → likely stale gui/dist; static files are served
     per-request (`server.ts:serveStatic` readFileSync) so rebuilds land without restart.
  b) ocx models missing from the dropdown → REAL, two stacked causes:
     - `api-compat.ts:56` hardcodes `ocxModels: undefined` ("detect-only bridge") →
       `buildCatalog` returns `unsupported-ocx-catalog` (catalog.ts:~130).
     - The intended fallback channel — reading ocx-synced slugs from the Codex config
       cache — needs `CODEX_MODELS_CACHE_PATH` env (catalog.ts `readNativeCacheDefault`),
       which nothing in `cxc serve` (cli.ts) ever sets → always falls back to the 4
       hardcoded natives.
  c) Expected a LIST OF LIVE SUBAGENTS (cli-jaw-employee-style) → the page is a per-role
     CONFIG editor only (Subagents.tsx renders exactly 3 fixed role cards); no runtime
     subagent visibility exists anywhere in the GUI.
- Also: deep link `/subagents` serves the SPA shell but the router lands on Channels
  (default route) — cosmetic, but breaks link sharing/refresh.

### 2. Telegram connect wizard (/start handshake) never completes

- ROOT CAUSE (UI state precedence, `gui/src/pages/Channels.tsx`):
  `connect()` does validate → `activateChannel` → `openHandshake(180s)` → `await
  onChanged()` → `setStep("awaiting-start")` (Channels.tsx:97-112). `onChanged()`
  refetches `/api/channels` where the channel is now `active:true`, and the card's
  render puts the `active` branch FIRST (`Channels.tsx:154`): `active ? "This channel
  is live" : step === "awaiting-start" ? …`. So the "Waiting for the handshake… press
  /start" view is UNREACHABLE — the card claims "live" immediately, even with 0 paired
  chats (messages from unpaired chats are silently dropped by the allowlist gate,
  telegram-adapter.ts:106).
- Server side is fine: window opens (connect-routes.ts:79-88), `/start` inside the
  window pairs + closes atomically (telegram-adapter.ts:114-129), pairing detection via
  allowlist baseline works (bridge-controller.ts:104-120). It's the GUI flow that hides it.
- There is also no modal "popup" at all — the wizard is inline card state; the user's
  expectation ("팝업이 떠서") implies a modal pairing dialog.

### 3. Per-chat behavior options (auto-send on/off, mention-only on/off) — ABSENT

- telegram-adapter.ts:131-138 hardcodes: group/supergroup → respond ONLY on @mention;
  DM → always respond. No per-chat/per-channel toggle, no settings storage (db.ts schema
  has no options column/table), no GUI surface, no API route.
- Whatever "자동 전송" (auto-send) should mean here (cli-jaw analog: auto-forward of
  results/heartbeat to the channel) does not exist as a concept in this codebase yet.

### 4. Multiple agents × multiple channels simultaneously — BLOCKED BY DESIGN (MVP)

- Single-active enforced in three layers:
  - DB: `setActiveChannel()` zeroes every other channel in one tx (db.ts:196-213).
  - Runtime: `BridgeController` holds exactly ONE adapter (bridge-controller.ts:43-52,
    reload() stops the previous adapter).
  - GUI copy: "Connect one messenger. Only one channel is active at a time."
- "Agent" today = a chat↔codex-thread binding (bindings table, UNIQUE channel+chat),
  auto-created on first message; all bindings share the serve process's single
  `--cwd` workdir. There is NO named-agent entity, no per-agent channel assignment,
  no per-agent workdir/model/effort. (bindings.workdir is set once at creation from
  serve cwd — current live binding points at `jawcode`.)

### 5. Model / reasoning-effort change — PARTIALLY WIRED / ABSENT

- Subagent roles (explorer/reviewer/executor): model selection WORKS end-to-end —
  GUI saves `.codexclaw/subagents.json` (store.ts), spawn-wrapper.ts consumes it via
  `resolveSpawnConfig` at spawn time. Caveat: the store is per-cwd; the GUI writes to
  the SERVE cwd, which may not be the project codex actually runs in.
- Main agent (per-chat binding): `bindings.model` column exists (db.ts:91, default
  'default') but NOTHING writes it — no API route, no GUI control; the adapter never
  passes model (telegram-adapter.ts:184-190 → agent-service.ts:117 `req.model ??
  opts.model ?? null` → runner omits `-m`). So per-chat model change is dead schema.
- Reasoning effort: NO field anywhere (RoleConfig has mode/model/promptOverride only;
  `buildExecArgs` runner.ts:60-84 has no effort flag). Codex CLI supports effort via
  config override (`-c model_reasoning_effort=…`) — unimplemented here.

## Production-grade gap summary (candidate work-phases)

| # | Gap | Layer | Size |
|---|-----|-------|------|
| 1 | Connect wizard state precedence + modal pairing UX | GUI | S |
| 2 | Catalog: set/resolve Codex models cache path + ocx model surfacing | serve+component | M |
| 3 | Per-chat options (mention-only, auto-send) — schema + API + adapter gate + GUI | full stack | M |
| 4 | Multi-adapter controller (concurrent telegram+discord) + per-agent channel model | full stack | L |
| 5 | Named-agent entity (workdir/model/effort/options) + per-binding model/effort wiring | full stack | L |
| 6 | Runtime subagent visibility in GUI (if that's what "subagent list" meant) | GUI+API | M |

Open questions for the interview: what "subagent list" actually meant (a/b/c above);
the agent ontology (named agents vs chat-bindings); what "auto-send" should mean;
whether concurrent channels should be per-agent exclusive or fan-out; success criteria.
