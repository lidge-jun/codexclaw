# 040 — Verification

## Gates

1. `codex features list | rg "multi_agent"` -> `multi_agent_v2 ... true`.
2. Fresh-session boot smoke: `codex exec` one-shot after the config flip completes
   without the agents.max_threads validation error. If feasible, ask it to name its
   collab tools to confirm the v2 surface (send_message/followup_task/list_agents);
   if the harness blocks that, record config-level evidence + limitation note.
3. Component suites — runner is per-component (audit Fix 3: bun 1.3.14 lacks
   `node:sqlite`, so `bun test` false-fails pabcd-state):
   config-guard `node --test`, subagent-config `bun test`, pabcd-state
   `node --test` — all pass, output captured.
4. Residual scan (audit Blocker 1: corrected path; Fix 2: corrected criterion):
   `rg -n "multi_agent_v1|send_input|resume_agent|close_agent"` over
   `plugins/codexclaw/skills`, `structure/`, `plugins/codexclaw/agents`,
   `plugins/codexclaw/components/*/src` -> zero hits presenting v1 as
   CURRENT-SESSION doctrine; scoped v1-pinned-session fallback notes and
   "v2 has no X" explanations are compliant survivors (audit baseline: 6 hits,
   0 stale).
5. Live 400 watch: if smoke reproduces upstream HTTP 400 on spawn, terminal outcome
   NEEDS_HUMAN with rollback offer (010 rollback section), not silent DONE.
6. Config table preservation (audit Fix 4): `rg -n "max_concurrent" ~/.codex/config.toml`
   still shows `max_concurrent_threads_per_session = 1000` inside the
   `[features.multi_agent_v2]` table — guards against a scalar clobber that
   gate 1 alone cannot distinguish.

## Evidence routing

All outputs land in the goalplan criteria (c1-c5) `capturedEvidence` and the C-phase
attest `checkOutput`.
