# 023 — Goal Convention Port (cli-jaw → codex)

Status: TODO  ·  Phase 1

## Goal
Map cli-jaw's goal system onto codex's native `create_goal` tool + hook gates.

## cli-jaw side (source)
- `cli-jaw goal set/update/done/pause` — server-backed persistent goal.
- Goal-mode rules injected every turn ([goal-continuation]).

## codex side (target)
- Native `create_goal` tool exists; omo intercepts it via `PreToolUse matcher: ^create_goal$`
  (e.g. to enforce unlimited budget).
- codexclaw approach: do NOT reimplement a goal server. Use codex `create_goal`, and use a
  `PreToolUse` hook only to apply codexclaw conventions (e.g. require an objective, link goal to
  PABCD slug, optionally block a premature budget).

## Decisions to confirm with jun
- Q-GOAL-1: Should codexclaw enforce any goal policy via PreToolUse deny, or stay advisory in phase 1?
- Q-GOAL-2: Link goal ↔ PABCD state file (goal references slug)?

## Verify
- `create_goal` works unchanged when codexclaw adds no gate.
- If a gate is added, it denies only the intended shape and reports a clear reason.
