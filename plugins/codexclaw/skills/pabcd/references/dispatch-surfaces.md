# Dispatch surfaces — thread or subagent

Read before choosing how to fan work out. This file owns the choice between
surfaces. [Delegation](delegation.md) owns what a subagent packet contains once
the choice is made, and its V1/V2 section owns the tool schemas.

## DISPATCH-SURFACE-01 (STRICT) — name the surface before dispatching

"파견", "dispatch", "delegate", "lane" and "agent" do not select a surface. Two
different mechanisms answer to those words and they are not substitutes:

- A **subagent** is a leaf spawned with the collab tools (`spawn_agent` in the
  `multi_agent_v1` or `collaboration` namespace). It runs **in the parent's own
  working directory**. It has no session state, no host goal and no PABCD FSM.
- A **thread** is a separate Codex task created with the desktop task tools
  (`create_thread` and its family). It gets its own worktree, its own session
  binding, its own host goal and its own PABCD cycle.

Say which one you are creating, in those words, before you create it.

## What actually differs

| | Subagent (`spawn_agent`) | Thread (`create_thread`) |
|---|---|---|
| Working directory | the parent's, unchanged | its own worktree, or the project checkout |
| Git branch and HEAD | the parent's | its own |
| Edits visible to the parent | immediately, as the parent's own uncommitted changes | only through git |
| Thread id | yes, its own | yes, its own |
| `.codexclaw` session state | none | its own |
| Host goal | none; it must not call `create_goal` | its own |
| PABCD FSM | none; it must not run `cxc orchestrate` | its own |
| Who owns the result | the parent integrates it | the task owns it, and the user owns the task |
| Visible in the app sidebar | no | yes |
| Creation authority | delegation authority | an explicit or clearly implied user request |
| Addressing | the returned handle | `threadId` plus `hostId` |
| Waiting | `wait_agent` | `wait_threads` |

A distinct thread id is the trap. A subagent has one, which is why "thread" feels
like the right word for it. It proves nothing about the filesystem.

## DISPATCH-SHARED-TREE-01 (STRICT) — subagents share your checkout

A spawned child inherits the parent's cwd. Measured on 2026-09-13: a probe
subagent reported the parent's `pwd`, the parent's `git rev-parse --show-toplevel`,
the parent's branch and HEAD, and a file it created appeared as an untracked entry
in the parent's `git status`. In `codex-rs`, `apply_spawn_agent_runtime_overrides`
assigns the parent turn's cwd to the child config and is called from both spawn
paths; no worktree is created anywhere on that path.

Therefore:

- Write scopes across concurrent subagents must not overlap.
- **Never** run two subagents that perform branch-level git operations at the
  same time. `checkout`, `switch`, `branch`, `stash`, `reset`, `rebase`, `merge`
  and `pull` act on one shared HEAD; two children doing that corrupt each other's
  work regardless of how their file scopes were divided. A per-file write scope
  does not make concurrent branch work safe.
- Tell the child it shares your tree. It cannot infer this: on V1 the host tool
  description says the opposite, instructing the caller to have the child "edit
  files directly in its forked workspace". There is no forked workspace.
  `fork_context` and `fork_turns` fork conversation history, not the filesystem.
  Only the V2 usage hint states the shared directory, so a V1 session is never
  told it by the runtime.

## DISPATCH-ROUTE-01 (STRICT) — routing the work

Route by what the work needs to own, not by how parallel it is:

- Needs its own branch, checkout, or long-running merge/CI lane -> **thread**,
  one per lane.
- Needs its own goal or its own PABCD cycle -> **thread**.
- Is a bounded slice of the tree you are already editing, returning evidence or a
  patch rather than owning a branch -> **subagent**.
- Is read-only research -> **subagent**, by default. It cannot collide because it
  writes nothing, which is also why read-only fan-out is not a template for
  parallel write work.

"Merge these lanes in parallel", "prepare N stacks at once", "run these branches
concurrently" are thread work. Spawning N subagents for N branches puts N writers
on one HEAD.

## DISPATCH-AUTHORITY-01 — asking for lane work is asking for the lanes

Creating a thread is user-visible, so it needs a user request. A request for
parallel branch or worktree lanes **is** that request: the lanes are the
mechanism the work needs, not a separate deliverable the user forgot to ask for.
Do not read the general "create a task only when the user explicitly asks" rule
as a reason to downgrade lane work onto the shared tree — that trades a visible
question for a silent collision.

Where the shape is genuinely unclear, ask once and name what you would create
("seven lane tasks, one worktree each"), then continue. Do not ask repeatedly and
do not treat silence as a refusal of the surface the work requires.

## Parallel lanes, and the shape that works

N independent lanes means N threads, N worktrees, N FSMs. The parent coordinates
with `wait_threads` and integrates; it does not advance any child's FSM, and a
child does not advance the parent's.

Threads and subagents compose. Each lane thread spawns its own subagents inside
its own worktree. Subagents of different threads cannot collide, because their
parents' checkouts differ. That is the shape that scales: threads for isolation,
subagents for concurrency within an isolated tree.

## What neither surface grants

A subagent may not create a goal, run `cxc orchestrate`, or bind a session; the
parent owns all of it. A thread owns its own goal and FSM, and the parent may not
advance them — messaging a task is not commanding it. Neither surface inherits
permission the parent does not have.
