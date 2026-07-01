# 015 — Confirmed Decisions (Interview)

Date: 2026-06-29
Source: Interview rounds with jun.

## D-DEV (scope)
Port **all 13 active dev skills** from `/Users/jun/.cli-jaw-3459/skills/`:
dev, dev-architecture, dev-backend, dev-code-reviewer, dev-data, dev-debugging, dev-devops,
dev-frontend, dev-pabcd, dev-scaffolding, dev-security, dev-testing, dev-uiux-design.
→ This is the canonical source set (not skills_ref). 024/060 updated to reflect "all 13".

## D-PHASE (units)
Each phase is an **independently shippable MVP** (1차/2차/3차 MVP). Phase 3 (scheduling) is a
real release unit, NOT optional post-MVP. Every phase must be runnable on its own.

## D-GOAL (gate) — omo pattern adopted
codexclaw adopts omo's `create_goal` gate exactly:
- Hook: `PreToolUse`, matcher `^create_goal$`.
- Logic: if `tool_input` carries `token_budget` (invalid input) → `permissionDecision: "deny"`
  with reason "use objective only; omit token_budget so the goal stays unlimited; put lifecycle
  status changes on update_goal".
- Otherwise pass through. Lifecycle delegated to codex-native `update_goal`.
- Rationale: matches cli-jaw process-protection / unlimited-goal philosophy; tiny implementation.
- Lands in step 023 (Phase 1).

## D-SUBAGENT (mechanism) — blind spot flagged
`multi_agent_v1.*` (spawn_agent/wait_agent) is a codex **runtime tool**, not a CLI command.
omo drives subagents through it. Phase 1 step 025 must verify the exact exposure path
(runtime tool availability + how agent .toml roles are registered for spawn) before relying on it.

## Still open (carry into planning)
- Q-P2-1: GUI reuse opencodex components vs build fresh against subagent-config.
- Q-P2-2: ocx-absent multi-model behavior (default-only vs alternate source).
- Q-P3-2: scheduled-job result delivery target (stdout/file/channel).
