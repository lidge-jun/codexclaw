# 040 — Verification

## Gates

1. `codex features list | rg "multi_agent"` -> `multi_agent_v2 ... true`.
2. Fresh-session boot smoke: `codex exec` one-shot after the config flip completes
   without the agents.max_threads validation error. If feasible, ask it to name its
   collab tools to confirm the v2 surface (send_message/followup_task/list_agents);
   if the harness blocks that, record config-level evidence + limitation note.
3. Component suites: config-guard, subagent-config, pabcd-state (`bun test` or the
   repo's runner per package.json) — all pass, output captured.
4. Residual scan: `rg -n "multi_agent_v1|send_input|resume_agent|close_agent"`
   over `plugins/codexclaw/skills`, `structure/`, `plugins/codexclaw/agents`,
   `components/*/src` -> zero instruction-bearing hits (historical/marked quotes OK).
5. Live 400 watch: if smoke reproduces upstream HTTP 400 on spawn, terminal outcome
   NEEDS_HUMAN with rollback offer (010 rollback section), not silent DONE.

## Evidence routing

All outputs land in the goalplan criteria (c1-c5) `capturedEvidence` and the C-phase
attest `checkOutput`.
