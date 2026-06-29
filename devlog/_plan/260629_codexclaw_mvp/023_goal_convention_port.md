# 023 — Goal Convention Port (cli-jaw → codex)

Status: TODO  ·  Phase 1  ·  Decision: omo pattern adopted (see 015)

## Goal
Map cli-jaw's goal system onto codex's native `create_goal`/`update_goal` + a PreToolUse gate.

## Decision (confirmed)
Adopt omo's gate exactly:
- Hook: `PreToolUse`, matcher `^create_goal$`.
- `applyPreToolUseGoalBudgetGuard`: if `tool_input` includes `token_budget` → deny with reason
  "use create_goal with objective only; omit token_budget so the goal stays unlimited; put
  lifecycle status changes on update_goal". Else pass through.
- Lifecycle (status/checkpoints) delegated to codex-native `update_goal` — no goal server.

## Why
- Matches cli-jaw process-protection / unlimited-goal philosophy.
- Tiny, pure function; easy to unit-test (mirror omo `codex-hook.test.ts`).

## Files
- `components/pabcd-state/` (or a small `goal-gate` part) — PreToolUse hook CLI.
- New hook json: `pre-tool-use-enforcing-unlimited-goal.json` (matcher `^create_goal$`).

## Verify
- create_goal WITH token_budget → denied, clear reason.
- create_goal with objective only → allowed.
- Pure guard function unit-tested.
