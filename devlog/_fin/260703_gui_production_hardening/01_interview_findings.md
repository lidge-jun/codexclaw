# 01 — Interview round 1: answers + confirmed root causes

- Date: 2026-07-03

## User decisions (round 1)

1. **"Subagent list not showing" = the model dropdown itself doesn't work.**
   The roles are listed; the dropdown is dead regardless of ocx.
2. **Agent ontology: named agents, NO per-agent workdir.** One shared cwd for all
   agents; codex owns workspace management. Agent = {name, channel assignment,
   model, effort, options} — workdir intentionally excluded.
3. **Channel concurrency: N agents across channel kinds** ("telegram-1, telegram-2,
   discord-1..3"), each agent with its own settings card in the GUI.
   Open sub-question: per-agent bot token vs shared bot per messenger (round 2).

## Root cause CONFIRMED live (dropdown bug)

Reproduced against the running bridge (127.0.0.1:7717, 2026-07-03):

- `POST /api/subagents {"role":"explorer","mode":"model"}` → **400**
  `mode "model" requires a non-empty model id`.
- This is exactly what the GUI sends when the "use a specific model" checkbox is
  ticked (Subagents.tsx:65 → `save(role, { mode: "model" })`, no model field).
- `validateRolePatch` (subagent-config/src/store.ts) rejects `mode:"model"` without
  a model id **in the same patch** — it never falls back to the role's existing or
  first-catalog model.
- GUI failure handling compounds it: `setSubagentRole` (api.ts:65-81) swallows the
  400 and returns the old config → checkbox visually reverts; `save()`
  (Subagents.tsx:33-40) toasts `"<role> updated"` unconditionally → **lying toast**.
- Net effect: checkbox can never turn on → `ModelSelect` stays `disabled` forever →
  "dropdown doesn't work". Selecting a model directly is impossible because the
  control is disabled until the checkbox succeeds. Deadlock by design flaw.
- Sanity check: `POST {"role":"explorer","mode":"model","model":"gpt-5.4"}` → 200 and
  persists (verified, then reverted to default).

Fix directions (for P): (a) checkbox-on should send `mode:"model"` + a default model
(first catalog entry or current selection); or (b) store accepts `mode:"model"` with
existing model retained; plus (c) GUI must surface API errors instead of the
unconditional success toast.

## User decisions (round 2) — interview CLOSED

1. **Agent↔bot mapping: dedicated bot token per agent** (BotFather bot per agent;
   N independent pollers; no routing table). Isolation over token convenience.
2. **Auto-send semantics: cli-jaw parity — two toggles per agent.**
   - `auto-send`: forward heartbeat/async results to the paired chat.
   - `mention-only`: response gate (group @mention requirement), independent toggle.
3. **DOD confirmed as proposed (5 items)** + user asked feasibility of per-agent
   heartbeat tasks → assessed FEASIBLE (M): turn path (`AgentService.handleIncoming`)
   is caller-agnostic, per-binding serial queue prevents overlap, adapters already
   send proactively, `cxc service` daemon exists. Needs: per-agent schedule store
   (interval + prompt), a timer scheduler in serve, a silence convention
   (HEARTBEAT_OK-style suppression), card UI field. Included as work-phase ⑥.

## Final DOD (testable)

1. Subagents page: checkbox+dropdown work; API errors surfaced (no lying toast);
   selection persists and reaches the actual spawn payload.
2. Connect wizard: "waiting for /start" state actually renders; pairing detected →
   paired state shown; "live" claimed only when adapter running.
3. ≥2 named agents on different messengers active simultaneously, routing
   independently (dedicated bot token each).
4. Per-agent card: model / reasoning effort / auto-send / mention-only changes
   apply on the next turn.
5. ocx detected → ocx-routed models appear in the model catalog.
6. Per-agent heartbeat: interval + prompt configurable on the card; silent when
   nothing to report; result forwarded only when auto-send is on.

## Slice map (multi-pass PABCD, decade numbering — to concretize in P)

- 10 — Subagents dropdown fix + error surfacing (S) — DOD 1
- 20 — Connect wizard state machine + pairing UX (S/M) — DOD 2
- 30 — Catalog: ocx model surfacing (cache path resolution) (M) — DOD 5
- 40 — Named-agent entity + schema migration (bindings→agents, per-agent token) (L) — DOD 3 prereq
- 50 — Multi-adapter controller (N concurrent pollers) (L) — DOD 3
- 60 — Per-agent card: model/effort/options wiring into runner (M) — DOD 4
- 70 — Per-agent heartbeat scheduler (M) — DOD 6
