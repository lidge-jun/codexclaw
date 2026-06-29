# 025 — Subagent as Employee

Status: TODO  ·  Phase 1

## Decision / blind spot (see 015)
`multi_agent_v1.*` (spawn_agent/wait_agent) is a codex RUNTIME TOOL, not a CLI command.
Step 025 MUST first verify: (a) the runtime tool is available in target codex, (b) how agent
.toml roles get registered so spawn can target them by role. Do this before building on it.

## Goal
Make codex subagents behave like cli-jaw employees: named roles with their own
instructions (and, in phase 2, their own models).

## Format (from omo)
`components/<comp>/agents/<role>.toml`:
```toml
name = "plan"
description = "..."
nickname_candidates = ["Planner"]
model = "default"               # phase 1: default; phase 2: per-role override
model_reasoning_effort = "..."  # optional
developer_instructions = """ ... role system prompt ... """
```

## Phase 1 roles
- explorer — read-only investigation.
- reviewer — diff/plan review.
- executor — bounded code changes.

(codexclaw already has stub `plugins/codexclaw/agents/*.toml` — migrate to this richer shape.)

## Injection path to confirm
- How codex exposes these agents to `multi_agent_v1.spawn_agent` (omo uses it).
- Whether agent files live under `components/.../agents/` or `skills/.../agents/` for codex pickup.

## Phase 1 scope boundary
- Default model only. Multi-model selection is PHASE 2 (GUI-driven, ocx catalog).

## Verify
- A role spawns with its developer_instructions on the default model.
