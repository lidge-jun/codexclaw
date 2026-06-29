# 025 — Subagent as Employee

Status: TODO  ·  Phase 1

## Phase 1 implementation = B-opt2 (inline instructions, see 019.2)
- Plugin-provided agent-role file pickup is NOT proven (plugin.json has no `agents` field).
- Phase 1 spawns subagents WITHOUT a registered role: pass full role/specialty instructions INLINE in
  `spawn_agent({message:"TASK: ... DELIVERABLE/SCOPE/VERIFY"})` — omo's proven pattern.
- `agents/*.toml` remain the SOURCE of those inline prompts (and future role files via B-opt1 once
  config-layer plugin role discovery is confirmed — Q-PORT-1b).

## codex ground truth (role.rs, source-verified)
- A codex subagent IS an "agent role": role file loaded by the SAME machinery as config.toml
  (`core/src/agent/role.rs`). Built-ins: explorer, awaiter (`core/src/agent/builtins/`).
- Spawn: `multi_agent_v1.spawn_agent({agent_type, message:"TASK:..."})`; orchestration owned by
  the multi-agent tool handler. `wait_agent`/`close_agent` for lifecycle.
- Role layer = session-flag precedence; caller `model_provider`/`service_tier` sticky unless role
  sets them → per-role model override works (Phase 2 multi-model basis).
- Parser: `AgentRoleConfig` + `parse_agent_role_file_contents`. Verify role-file PICKUP location
  in this build (config agent_roles dir vs plugin-provided) — Q-PORT-1.
- Mapping: cli-jaw worker/employee/dispatch → this. See 015.1 porting map.

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
