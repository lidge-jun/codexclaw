# 030 — Doctrine conversion (skills + structure)

## Scope

IN (current SoT docs only): `plugins/codexclaw/skills/{pabcd,dev,search,lunasearch,qa,loop}/SKILL.md`,
`plugins/codexclaw/components/pabcd-state/src/hook.ts` directive strings (+ its tests),
`structure/10_subagent_skill_routing.md`, `structure/20_pabcd_dispatch_doctrine.md`,
`structure/60_native_capabilities.md`, `plugins/codexclaw/agents/README.md`.
OUT: `devlog/_fin/**` archives, backup files, historical quotes (may keep v1 wording
as history when clearly marked).

## Rewrite table (v1 -> v2)

| v1 assumption | v2 replacement |
|---|---|
| tools are `multi_agent_v1.*`, deferred behind tool_search | tools are flat direct functions (`spawn_agent`, `send_message`, `followup_task`, `wait_agent`, `interrupt_agent`, `list_agents`); tool_search fallback wording kept as a defensive note only |
| reviewer reuse: `send_input` if alive, `resume_agent` if closed (DISPATCH-ACTOR-01) | reviewer reuse: `followup_task` to the same task_name (triggers a turn); `send_message` for context-only delivery; no resume — a completed agent stays addressable until closed by runtime; liveness check via `list_agents` |
| lifecycle: spawn -> send_input/wait -> close_agent (DISPATCH-RETIRE-01) | lifecycle: spawn(task_name) -> wait_agent (mailbox) -> followup_task / interrupt_agent; no close verb — retire = stop addressing it; concurrency budget governed by max_concurrent_threads_per_session |
| spawn returns agent_id | spawn returns task_name (address by task name) |
| `items` skill attachment (E5 builder) on v1 | message mention block is THE channel (E3 hook + builder both) |
| wait_agent returns final status/message | wait_agent returns mailbox update summaries; content arrives as messages — bounded waits + re-poll doctrine (LOOP-WAIT-VISIBILITY-01 unchanged) |
| `[agents] max_threads` tuning | `features.multi_agent_v2.max_concurrent_threads_per_session` |
| structure/60: "multi_agent_v2 off, keep v1 assumptions" row | row flips: v2 ON (260709 dev2 switch), 400 risk accepted + watch note |

Also update `~/.codex/config.toml` comment (done in 010) and pabcd-state hook.ts
injected directive strings that say "multi_agent_v1.* collab tools are deferred".

## Method

`rg -n "multi_agent_v1|send_input|resume_agent|close_agent|agent_id" <targets>` and
patch each hit per the table. pabcd-state tests asserting directive text get the
same string update.
