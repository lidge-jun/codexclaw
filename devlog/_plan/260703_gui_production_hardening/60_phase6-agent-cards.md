# 60 — Phase 6: per-agent cards — model/effort/options applied next turn (DOD 4)

- Class: C2/C3 (conventional slice over the audited effort contract + GUI page).
  The runner/effort contract was already twice-audited (40 rev-3 + Backend
  confirmation of exact call sites runner.ts:252-277) — micro-audit here;
  employee verification in B.

## Part 2 — diff-level

### `runner.ts` (the audited contract, verbatim)
- `BuildArgsInput.effort?: string | null`; `RunTurnOptions.effort?: string | null`.
- `buildExecArgs`: `effort && effort !== "default"` → append
  `["-c", "model_reasoning_effort=<effort>"]` (both resume and new-run branches).
- `runTurn`: forwards `opts.effort` into BOTH buildExecArgs calls (initial + re-seed).

### `agent-service.ts` — the card applies on the NEXT turn
- `runOne`: `binding.agent_id != null` → read the agent row fresh (live card edit
  applies to the next turn without adapter restart):
  `model = req.model ?? (agent.model !== 'default' ? agent.model : null) ?? opts.model ?? null`;
  `effort = agent.effort !== 'default' ? agent.effort : null` → runTurn.

### `gui/src/api.ts` — agent endpoints
- `AgentInfo` type (public shape from agent-routes) + `api.getAgents/createAgent/
  updateAgent(id, patch)/enableAgent(id, enabled)/deleteAgent(id)/
  openAgentHandshake(id)/agentHandshakeStatus(id)` — same error-surfacing result
  shape as `setSubagentRole` ({ok, error}).

### `gui/src/pages/Agents.tsx` — rewrite to agent cards
- Top: create form (name, kind select, bot token) → POST /api/agents → error toast on
  failure (invalid token shows the real reason).
- One card per agent: status badge (enabled + paired count), Enable/Disable,
  ModelSelect (existing component + catalog), effort select (6 enum values),
  auto-send / mention-only checkboxes, heartbeat minutes+prompt inputs (stored now,
  scheduler = slice 70 — labeled as such), "Open pairing window" (agent handshake
  open + poll allowlistCount growth → paired state), Delete (disabled while enabled).
- Sessions (bindings) table stays below the cards.

### Tests
- `test/runner.test.ts` (MODIFY): buildExecArgs effort cases (default omitted, high
  appended, resume branch, re-seed pass-through via runTurn is covered by arg spy?
  keep to buildExecArgs pure cases + one runTurn spawn-arg assertion if a hook exists).
- `test/agent-service.test.ts` (MODIFY): agent-bound run uses the agent's model/effort;
  bare binding unchanged.
- GUI has no component rig — CDP render check on a throwaway serve (agents page
  renders create form + empty state; live serve still runs the old dist until the
  user restarts, so /api/agents is not live-testable there — documented).

## Verification
Full suite + gui build + CDP throwaway-serve render check + employee B verification.
