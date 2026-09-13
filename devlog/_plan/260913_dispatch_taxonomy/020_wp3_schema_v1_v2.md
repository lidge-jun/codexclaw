# wp3 — Delegation tool-schema split into V1 and V2

## Why the current section fails

`pabcd/references/delegation.md` has one heading, "Live tool schema and role
transport", that mixes three things: how to read the live schema, what V1 looks
like, and what V2 looks like. The V1/V2 content is two bullets at the bottom:

> - **V1:** `wait_agent` returns final status plus content; `send_input` reuses an agent;
>   `close_agent` retires it and `resume_agent` restores it.
> - **V2:** `wait_agent` is a no-content mailbox; `followup_task` triggers more work;
>   `send_message` is context-only, and `interrupt_agent` stops a runaway turn.

Two bullets cannot tell an agent which family it is holding. They describe the
difference in wait semantics and say nothing about how to detect the family, how
the spawn call differs, or what the handle is. An agent that reads this and then
calls `followup_task` on a V1 host gets a missing-tool error mid-dispatch.

## Target shape

Replace the single heading with three:

### 1. Detect the family first (DISPATCH-SCHEMA-DETECT-01, STRICT)

Name the exposed namespace before the first dispatch, from the live tool catalog
rather than from a remembered version. In code mode the catalog is readable
directly; otherwise the tool list in context is the source. Record which family
was found in the dispatch note, because a later reader cannot re-derive it.

If neither family is exposed, that is a capability gap to report, not a reason to
fall back to the thread surface — the two surfaces are not substitutes
(cross-reference to `dispatch-surfaces.md`).

### 2. V1 — `multi_agent_v1`

Measured live in this session, so the table is written from the loaded schema:

| Concern | V1 |
|---|---|
| spawn | `spawn_agent({ message \| items, model?, reasoning_effort?, fork_context? })` |
| handle | returns `{ agent_id, nickname }`; address everything by `agent_id` |
| wait | `wait_agent({ targets[], timeout_ms })` returns final status **and the final message content**; `timed_out` is a normal outcome |
| follow-up | `send_input({ target, message \| items, interrupt? })` |
| stop | `close_agent({ target })` returns the previous status; completed agents hold a concurrency slot until closed |
| restore | `resume_agent({ id })` |
| history | `fork_context: true` copies the parent's history into the child; default is prompt-only |

The `nickname` is a display label. Never address an agent by it.

### 3. V2 — the task-shaped family

Written as conditional guidance because it is not exposed in this session:

| Concern | V2 |
|---|---|
| handle | a caller-supplied canonical `task_name` rather than a returned id |
| wait | `wait_agent` is a **no-content mailbox** — the final text is not in the wait result, so it must be retrieved separately |
| follow-up | `followup_task` triggers more work; `send_message` only adds context and does not start a turn |
| interrupt | `interrupt_agent` stops a runaway turn |

The single most damaging V1→V2 assumption is the wait result. On V1 the agent
reads the answer out of `wait_agent`; on V2 the same code path yields nothing and
looks like a silent failure. The section says this in one sentence.

### 4. The thread surface's own schema

A short table so the reader is not left to improvise: `create_thread`
(`target.environment` selects `local` or `worktree`, and `worktree` takes a
`startingState` of working-tree or branch), `wait_threads` with per-target
cursors, `send_message_to_thread`, `fork_thread`, `handoff_thread`. Marked as
Codex Desktop names that must be confirmed live, with the reminder that creating
a thread is user-visible and needs an explicit user request.

## Code strings that teach the wrong V2 tool

The wp1 inventory found `components/subagent-config/src/capabilities.ts` and
`capability-lock.ts` describing V2 spawn as `create_task`. If the Codex source
shows V2 spawn is still `spawn_agent`, those strings are actively teaching a tool
name that does not exist and are one token away from `create_thread`.

**This is gated on source proof.** Without a file:line quotation from the Codex
checkout the strings stay as they are and the discrepancy is recorded as a
follow-up. Documentation may not overwrite a capability declaration on the
strength of a subagent's summary.

The prompt strings in `spawn-attach-hook.ts` are different: `LEAF_GUARD` and
`CXC-SUBAGENT-SCOPE` are injected into every spawned child and say "delegated
task" and "thread-spawn" where they mean a collab leaf on the parent's tree.
That is prose, it is in scope, and it is the highest-leverage place to state the
shared-worktree fact, because every child reads it.

## Acceptance

- Criterion c-2: labelled V1 and V2 sections plus a detection rule that runs
  before the first dispatch.
- The V1 table matches the schema actually loaded in this session.
- Every V2 claim is marked as not-live-verified here.
