## Hardcoded Spawn Path (no catalog probe)

The session surface is pinned on its first turn. V1 is the default unless the model
catalog selects V2 (sol/terra; luna stays V1) or `features.multi_agent_v2` selects it
for a fallback model. If `spawn_agent` is not visible on V1, `tool_search` for it first
(`structure/60_native_capabilities.md` §1). Fan the lanes out as N spawns before
waiting; V1 `wait_agent` returns final status plus content, while V2 `wait_agent` is a
no-content mailbox. Reuse a lane with V1 `send_input(agent_id)` or V2
`followup_task(task_name)`. V1 also has `close_agent`/`resume_agent`; V2 has only
`interrupt_agent`. The concurrency limits are V1 `agents.max_threads` (default 6) and
V2 `max_concurrent_threads_per_session` (default 4, root included).

Those lanes are subagents, not separate Codex tasks: every one of them runs in
this session's own working directory on this branch. Luna lanes are safe to fan
out because discovery writes nothing, which is exactly why this shape does not
transfer to parallel write work. Branch or worktree lanes need one task each —
see `cxc-pabcd` [dispatch-surfaces.md](../../pabcd/references/dispatch-surfaces.md).

