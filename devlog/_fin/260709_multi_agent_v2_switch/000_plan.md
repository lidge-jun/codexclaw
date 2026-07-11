# 260709 — multi_agent_v2 full switch (dev2)

## Objective

Switch codexclaw from the stable `multi_agent` (V1) assumption to `multi_agent_v2`
(V2) end to end: runtime flag, config-guard declaration, spawn payload builders,
and skill/structure doctrine. User accepted the known upstream encrypted-schema
HTTP 400 risk (openai/codex#26753) and asked for a full conversion.

## Loop-spec (C3)

- Archetype: spec-satisfaction repair (verifier = test suites + `codex features list` + rg residual scan).
- Trigger: user request "dev2로 완전 전환".
- Goal: new codex sessions run the V2 collab toolset and codexclaw dispatch doctrine matches it.
- Non-goals: codex-rs changes, opencodex changes, retroactive history/backup edits.
- Verifier: `bun test` per component; `codex features list | rg multi_agent`; rg scan for stale v1 lifecycle instructions.
- Stop: all criteria in goalplan `codexclaw-multi-agent-v2-dev2-full-switch-runtim` met.
- Memory artifact: this unit + goalplan ledger.
- Terminal outcomes: DONE, or NEEDS_HUMAN if live smoke reproduces the 400.
- Escalation: session-boot failure after config flip -> immediate rollback path documented in 010.

## Verified ground facts (read from code)

- Version resolution: `multi_agent_v2` on -> V2, else `multi_agent` on -> V1
  (codex-rs `config/mod.rs multi_agent_version_from_features`, model catalog
  `model_info.multi_agent_version` can override per model; session pins version
  once resolved).
- V2 on + `[agents] max_threads` set = startup validation ERROR
  (`validate_multi_agent_v2_config`: "agents.max_threads cannot be set when
  features.multi_agent_v2 is enabled"). Current `~/.codex/config.toml` HAS
  `[agents] max_threads = 1000` -> must be removed in the same edit.
- V2 toolset: `spawn_agent` (task_name+message required, encrypted message,
  `deny_unknown_fields` -> `items` rejected, `fork_turns` none|all|N),
  `send_message`, `followup_task`, `wait_agent` (mailbox semantics),
  `interrupt_agent`, `list_agents`. No `send_input`/`resume_agent`/`close_agent`.
- V2 tools are Direct exposure (not deferred behind tool_search) —
  spec_plan.rs `add_collaboration_tools`.
- Ultra + V2: `effective_multi_agent_mode` -> Proactive; non-Ultra -> ExplicitRequestOnly.
- spawn-attach-hook is already v1+v2 safe (message mention channel, full-fork
  guard covers v2 `fork_turns`); only the `items`-based E5 builder path is v1-only.

## Work-phase map (dependency-ordered)

1. **010 runtime + config-guard** — flip the flag safely, declare it in config-guard.
2. **020 subagent-config v2 payloads** — builder emits v2-legal spawns.
3. **030 doctrine docs** — skills + structure lifecycle rewrite.
4. **040 verification** — suites, residual scan, smoke.

Each phase has its own decade doc in this unit at diff level.

## Steering log

- 260709 (user): wp5 (opencodex v2-gated ultra + ocx toggle) DESCOPED from this
  unit — ocx is being patched on a separate track with its own goalplan
  (`opencodex-v2-gated-ultra-...`, opencodex repo, design doc moved to
  opencodex/devlog/260709_v2_gated_ultra/000_design.md). This unit stays
  codexclaw-only: wp4 verification closes the goal.
