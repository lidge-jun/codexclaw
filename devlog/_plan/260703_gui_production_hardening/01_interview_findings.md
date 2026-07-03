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

## Remaining unknowns (round 2 targets)

- Agent↔bot mapping: dedicated bot token per agent vs shared bot per messenger with
  chat→agent routing (drives adapter architecture: N pollers vs 1 poller + router).
- "Auto-send on/off" semantics (unanswered in round 1).
- Testable success criteria / priority ordering of work-phases.
