# wp3 — P revalidation and diff-level plan

## Revalidation of 020

wp2's D left the surface choice settled in the always-read bodies. wp3 is the
other half: once an agent knows it wants a subagent, which schema is it holding?

020's design survives, with the corrections the two audits produced. The live
section at `delegation.md:56-99` is worse than 020 described: the V1/V2 content
is two bullets at the end of a heading that also covers role transport, executor
registration and the `CXC-ROLE` header. A reader looking for "what does wait
return here" has to read past four unrelated paragraphs to find it.

## Changes

### `pabcd/references/delegation.md`

Split "Live tool schema and role transport" so the schema is separable from the
role transport, and replace the two trailing bullets with three subsections.

**Detect the family first (DISPATCH-SCHEMA-DETECT-01).** Name the exposed
namespace from the live catalog before the first dispatch, and record it. The
namespaces are `multi_agent_v1` and, for V2, a configurable default of
`collaboration` — `multi_agent_v2` is a feature-flag name and never appears as a
namespace, so it cannot be used to detect anything. `spawn_agent` exists in both
families and does not discriminate; `followup_task`, `send_message`,
`interrupt_agent` and `list_agents` are V2-only, while `send_input`,
`close_agent` and `resume_agent` are V1-only. `wait_agent` is present on V1 and
optional on V2, so its presence proves nothing.

**V1 — `multi_agent_v1`.** A table: spawn args and the `{agent_id, nickname}`
return; `wait_agent(targets[], timeout_ms)` returning final status that may carry
the final message; `send_input(target, ...)` with `interrupt`; `close_agent`;
`resume_agent`; `fork_context` as a history fork. Two notes: the schema marks
nothing required but the runtime still rejects a spawn with neither `message` nor
`items`, and `nickname` is a display label that must never be used as an address.

**V2 — the task-shaped family.** A table: spawn requires `task_name` and
`message` and returns `task_name`; the handle is a canonical path; `fork_turns`
takes `none`/`all`/N instead of a boolean; `followup_task` starts a turn while
`send_message` only queues; `interrupt_agent` stops a turn; there is no close or
resume. The one sentence that matters most: **V2's `wait_agent` is a no-content
mailbox.** Code that reads the answer out of the wait result works on V1 and
silently returns nothing on V2.

**The thread surface's schema.** A short table for `create_thread`,
`wait_threads`, `send_message_to_thread`, `fork_thread` and `handoff_thread`,
marked as Codex Desktop names confirmed live rather than from source, with
`create_thread`'s `environment` of `local` or `worktree` and `startingState` of
`working-tree` or `branch`. It is here because an agent that correctly routes
lane work to threads should not then have to improvise the call.

### `components/subagent-config/src/capabilities.ts` and `capability-lock.ts`

Replace the `create_task` capability with `followup_task`. `create_task` is not a
tool in either family; both register `spawn_agent`, and the audits confirmed it
against `spec_plan.rs`. Its comment becomes accurate: V1 and V2 both spawn with
`spawn_agent`, V2 requiring `task_name`, and `followup_task` is the V2-only
discriminator. Consumers are two tests, updated with it.

`detectSpawnSurface` gains an optional exposed-tool list. With a list it decides
from evidence, matching namespace-prefixed names. Without one it keeps returning
`v2`, and `CODEXCLAW_SPAWN_V1 === "1"` keeps forcing `v1` with an exact
comparison, so every existing caller and test keeps its meaning.

**This is a declaration correction, not a behavior change.** `resolveCapabilities`
is not wired into the spawn hook; live surface detection is `isV2SpawnInput` and
`isCollaborationToolName` in `spawn-attach-hook.ts` and is untouched. The D
summary must say this rather than implying spawn routing improved.

### `components/subagent-config/src/spawn-attach-hook.ts`

The leaf-guard and scope blocks are injected into every spawned child and are the
only text some children ever read about their own situation. They say "one
bounded delegated task" and describe a "thread-spawn child session" without
saying the child is in the parent's checkout. Both blocks gain that fact and the
branch-operation ban; the surrounding comments get the same correction. Control
flow, the recursion grant and the deny path are untouched.

The blocks are asserted by tests. Any assertion on their exact text is updated
with them, and an assertion is added for the shared-tree sentence so it cannot
regress.

## Check

`npm run gate` under `cxc receipt test`, plus `npm test`. The
`subagent-config` suite is the one that matters here; the expected residual is
the pre-existing `gui/router.test.ts` react resolution failure.
