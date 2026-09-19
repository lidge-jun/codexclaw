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
  (`create_thread` and its family). With `environment: worktree` it gets its own
  checkout; with `environment: local` it shares the project checkout. Either way
  it is an independent task with its own conversation, its own session binding and
  its own goal and PABCD state, because codexclaw keys those to the task.

Isolation comes from the environment, not from being a task. A `local` thread is
an independent owner sharing one checkout; a `worktree` thread is an independent
owner with its own. Lane work needs the second.

A **lane** is thread work; a **worker inside a lane** is subagent work. N lanes
means N worktree threads, and the workers inside each lane are that lane's
subagents — they cannot collide across lanes because the worktrees differ.

Say which one you are creating, in those words, before you create it.

## What actually differs

| | Subagent (`spawn_agent`) | Thread (`create_thread`) |
|---|---|---|
| Working directory | the parent's, unchanged; never a copy | its own, with `environment: worktree`; the shared project checkout with `local` |
| Git branch and HEAD | the parent's | its own under `worktree`; shared under `local` |
| Edits visible to the parent | immediately, as the parent's own uncommitted changes | only through git |
| Thread id | yes, its own | yes, its own |
| `.codexclaw` session state | none | its own |
| Host goal | none; it must not call `create_goal` | its own, keyed to the task |
| PABCD FSM | none; it must not run `cxc orchestrate` | its own, keyed to the task |
| Who owns the result | the parent integrates it | the task owns it, and the user owns the task |
| Visible in the app sidebar | no | yes |
| Creation authority | delegation authority | an explicit or clearly implied user request |
| Addressing | the returned handle | canonical `threadId` plus `hostId`; a creation still settling is not yet addressable |
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
  one per lane, created with `environment: worktree`. A `local` thread does not
  give the lane a checkout of its own.
- Needs its own goal or its own PABCD cycle -> **thread**.
- Is a bounded slice inside a lane that already owns its checkout -> **subagent**
  of that lane's thread.
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

N independent lanes means N `worktree` threads, N checkouts, N FSMs. The parent
coordinates with `wait_threads` and integrates; it does not advance any child's
FSM, and a child does not advance the parent's.

### Record the lane before you need it (DISPATCH-LANE-ID-01, DEFAULT)

Thread creation can return a canonical id, or a provisional handle while the checkout is
still being set up. Record the canonical id and host the moment they exist, keep any
provisional handle in a separate field, and never pass a provisional handle to a tool
that wants a canonical id.

The trap is the inverse: a lane missing from a listing is not a lane that does not
exist. Listings are filtered and paginated, and a started thread is addressable from the
moment it starts. So if you already hold the canonical id, use it — do not make presence
in a listing a precondition for addressing a lane you created.

Addressing has one canonical form: `threadId` plus `hostId`. The user-facing mention the
app builds is `[@Title](thread://<threadId>?hostId=<encoded hostId>)`, and several lanes
can be referenced in one turn. A queued worktree instead returns a provisional
`clientThreadId` that no tool accepts; keep it in its own field.
[Lane dispatch](../../loop/references/lane-dispatch.md) carries the packet contract and
the measured bounds.

When the id really is lost, recovery is bounded and host-specific: identify the same
host, worktree and branch, then inspect candidate session metadata — matching cwd,
creation time, parent identity — and read the recorded session id rather than guessing
one from a filename. A shared cwd alone cannot separate a lane from its own subagents,
because a subagent runs in its parent's directory. Confirm a candidate through a
read-only task read before steering it, and leave ambiguity unresolved. Do not recreate
a lane because discovery failed; that is how one task becomes two writers.

### Arm the wake before you yield the turn (DISPATCH-WAKE-01, DEFAULT)

Lane work outlives a turn, and nothing resumes a parent automatically. Stop-continuation
is bounded on purpose: it releases under context pressure and at the stagnation cap. A
parent that dispatches lanes, yields, and expects to wake up later has arranged nothing,
and every lane then sits finished and unmerged.

Before yielding a turn with work still running, name the continuation owner and the
mechanism, verify the wake is actually active, and keep its identifier. With no wake
mechanism available, either keep handling the work inside the turn or report the
limitation — do not yield and hope. Deleting a wake removes the trigger and nothing else:
it does not complete the goal, and it is not permission to reinstate one later. Muting
notifications is not the same as stopping monitoring, and a scheduled run is not merge
authority.

### The observer shares the lanes' quota (DISPATCH-POLL-BUDGET-01, DEFAULT)

### Fan-out width is a lane property (DISPATCH-FANOUT-CAP-01, DEFAULT)

The intuition is usually backwards. Parallel *branches* are cheap to the host: no
host-wide cap on concurrently running tasks was found in the searched paths, and turns
queue per thread. Subagents are the capped resource — spawning past the session limit
fails outright with `agent thread limit reached`, at six per session by default
(`agents.max_threads`; on V2 `max_concurrent_threads_per_session` minus one for the
session itself).

So cross-branch fan-out belongs to lanes, and concurrency inside one lane's tree belongs
to that lane's subagents — run them in waves, say the wave size, and close finished
agents, because a completed agent holds its slot until it is closed. "Unlimited parallel
subagents" is not a shape the host offers.

Lanes and the parent watching them usually draw on the same credentials and the same
API budget, so observation competes with the work it is observing. The parent owns that
aggregate: one coordination observer, deduplicated snapshots, one fetch per PR per
scheduled observation by default, and intervals of minutes rather than seconds for long
hosted jobs. Communication cadence is a separate decision from API cadence — telling the
user what is happening does not require asking the API again.

Before sustained polling, read the relevant budget (for example `gh api rate_limit`) and
reserve headroom for the workers. Back off on evidenced limit responses. Do not assume
every 403 is exhaustion, that every account has the same allowance, or that rate-limit
categories are interchangeable. This is guidance for the coordinator, not a limiter.

Threads and subagents then compose. A lane thread spawns its own subagents inside
its own worktree, and subagents belonging to different lanes cannot collide
**because those worktrees differ** — not because their parents are different
tasks. Two `local` threads on one checkout collide exactly like two subagents do.
The shape that scales is worktrees for isolation and subagents for concurrency
within an isolated tree.

### The lane manifest (DISPATCH-LANE-MANIFEST-01, DEFAULT)

Lanes are independent tasks, so nothing in the system knows two of them were handed the
same issue until their pull requests collide. One shared record makes that visible before
the branches diverge. Per lane: repository, lane id, task and host id, worktree, branch,
base ref and sha, head sha, issue, owner, scope and status.

```json
{
  "repository": "owner/repo",
  "lanes": [
    {
      "id": "lane-1", "taskId": "<threadId>", "hostId": "local",
      "worktree": "/path/to/worktree", "branch": "codex/one",
      "owner": "task:<threadId>", "scope": "validator",
      "base": { "ref": "dev", "sha": "abc1234" }, "head": "def5678",
      "issue": "owner/repo#184", "status": "running"
    }
  ]
}
```

Validate it with `node plugins/codexclaw/scripts/check-lane-manifest.mjs <manifest.json>`.

Two rules the validator enforces because they are the ones people get wrong. An issue
reference must name its repository — a bare number is ambiguous the moment lanes span
repositories. And two ACTIVE lanes may share an issue only if each names a **different**
scope; silence means both believe they own all of it, which is precisely the collision
worth catching. A finished lane never blocks a new one.

**A manifest is evidence, not a lock.** It is a file. It cannot know whether a lane is
still running, whether a recorded head is current, or whether CI evidence is fresh, and
recording an owner authorizes nobody to rewrite that lane's branch or message its task.
A pass means the records are coherent, never that merging is safe.

### Merge handoff across tasks (DISPATCH-LANE-MERGE-01, DEFAULT)

The coordinating task decides sequencing; each lane executes only inside its own
checkout; no subagent ever manages another lane's branch. Before landing a lane:

1. Refresh the integration ref and re-read the manifest. A lane based on a stale ref is
   the usual source of a conflict that looks like a code disagreement.
2. Compare open PRs, worktrees and manifest entries for a duplicate issue, a duplicate
   branch, or overlapping scope. Resolve by giving one lane the issue or by partitioning
   it explicitly — not by merging and hoping.
3. Carry hosted evidence for the lane's PR: head sha, the sha actually tested, workflow
   event, run and check ids, attempt, conclusion, and required-shard coverage. Apply
   `cxc-dev` §3 DEV-CI-EVIDENCE-01; a green summary is not the same as the expected jobs
   having run.
4. Land lanes serially. Shared surfaces — published counts, generated inventories, lock
   files — conflict in every lane at once, so parallel landing turns one rebase into N.

After a timeout or a compaction, recover from the manifest: reopen the recorded task and
worktree, refresh git and PR state, reconcile drift, and resume. A timeout alone never
authorizes replacing a lane and never proves one finished.

## What neither surface grants

A subagent may not create a goal, run `cxc orchestrate`, or bind a session; the
parent owns all of it. A thread owns its own goal and FSM, and the parent may not
advance them — messaging a task is not commanding it. Neither surface inherits
permission the parent does not have.
