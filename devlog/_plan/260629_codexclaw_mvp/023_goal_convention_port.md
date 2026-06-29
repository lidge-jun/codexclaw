# 023 — Goal Convention Port (cli-jaw → codex)

Status: TODO  ·  Phase 1  ·  Decision: omo pattern adopted (see 015); gate SPLIT (see 019.2)

## Goal
Map cli-jaw's goal system onto codex's native `create_goal`/`update_goal` + a PreToolUse gate.

## Decision (confirmed) — SPLIT into two gates
### A. create_goal budget gate — SHIPS IN PHASE 1 (omo-proven, stateless)
Adopt omo's gate exactly:
- Hook: `PreToolUse`, matcher `^create_goal$`.
- `applyPreToolUseGoalBudgetGuard`: if `tool_input` includes `token_budget` → deny with reason
  "use create_goal with objective only; omit token_budget so the goal stays unlimited; put
  lifecycle status changes on update_goal". Else pass through.
- Stateless, pure function; no thread-store read needed → Phase 1 safe.

### B. interview-in-goal HARD deny — DEFERRED (post-Phase1, see 022.3 / 019.2)
- A true PreToolUse deny on `request_user_input` while a goal is active requires a thread-store
  goal-read path that is NOT yet proven. Deferred (A3 hybrid; Q-GM-1-followup).
- Phase 1 enforcement for "no interview in goal mode" = advisory `ipabcd` skill text +
  codex-native goal-continuation suppression (`core/src/goals.rs`). See 022.3.

## Lifecycle
- status/checkpoints delegated to codex-native `update_goal` — no goal server.

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
- (Deferred B) interview-in-goal hard deny tracked separately; advisory rule present in `ipabcd`.
