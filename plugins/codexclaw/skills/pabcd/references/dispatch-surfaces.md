# Dispatch surfaces — thread or subagent

Read before choosing how to fan work out. This file owns the choice between
surfaces. [Delegation](delegation.md) owns what a subagent packet contains once
the choice is made, and its V1/V2 section owns the tool schemas.

## DISPATCH-SURFACE-01 (STRICT) — name the surface before dispatching

"파견", "dispatch", "delegate", "lane" and "agent" do not select a surface. Two
different mechanisms answer to those words and they are not substitutes:

- A **subagent** is a leaf spawned with the collab tools (`spawn_agent` in the
  `multi_agent_v1` or `collaboration` namespace). Its native cwd inherits the
  parent's working directory. It has no session state, no host goal and no PABCD FSM.
- A **thread** is a separate Codex task created with the desktop task tools
  (`create_thread` and its family). With `environment: worktree` it gets its own
  checkout; with `environment: local` it shares the project checkout. Either way
  it is an independent task with its own conversation, its own session binding and
  its own goal and PABCD state, because codexclaw keys those to the task.

Isolation comes from the environment, not from being a task. A `local` thread is
an independent owner sharing one checkout; a `worktree` thread is an independent
owner with its own. An independent task lane needs the second.

An **independent task lane** owns a goal, PABCD cycle or long-running branch/CI
lifecycle: use one worktree thread per lane. A **bounded checkout worker** needs
only a disjoint checkout and returns a patch or evidence to the coordinator:
create a managed worktree, then give its absolute path to a subagent. The
subagent's native cwd still inherits the coordinator's; the packet must require
that path as the shell workdir on every command. Workers do not acquire their
own goal or PABCD state. Different workers must use different worktrees.

Say which one you are creating, in those words, before you create it.

## What actually differs

| | Subagent (`spawn_agent`) | Thread (`create_thread`) |
|---|---|---|
| Working directory | native cwd inherits the parent's; a bounded worker must pass its assigned managed-worktree path as the shell workdir on every command | its own, with `environment: worktree`; the shared project checkout with `local` |
| Git branch and HEAD | native cwd points at the parent's; commands run in an assigned managed worktree see that worktree's branch and HEAD | its own under `worktree`; shared under `local` |
| Edits visible to the parent | immediately in the selected checkout; a managed worktree has its own branch and files | only through git |
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

## DISPATCH-SHARED-TREE-01 (STRICT) — subagents inherit your cwd

A spawned child inherits the parent's cwd; conversation forks do not fork the filesystem.
**DISPATCH-ISOLATION-01 (STRICT).** Assign each concurrent worker the isolation and
write boundaries below.

- Write scopes across concurrent subagents must not overlap. A coordinator
  assigning separate managed worktrees must give each worker a different path.
- **Never** run concurrent branch-level git operations in one checkout.
  `checkout`, `switch`, `branch`, `stash`, `reset`, `rebase`, `merge` and `pull`
  change that checkout's HEAD or index; a per-file write scope does not separate
  them. Operations in different worktrees do not share one HEAD, but each branch
  still needs one owner and an explicit integration order.
- Tell the child that its native cwd is the parent's tree; `fork_context` and
  `fork_turns` copy history only, regardless of contrary tool-description wording.
- For a managed-worktree worker, instruct the subagent to pass the absolute
  worktree path as the shell tool's workdir on **every** command, including
  `git status`, tests and reads. Use absolute paths for file edits. Its native
  cwd and relative-path defaults do not move when the worktree is created.

## DISPATCH-ROUTE-01 (STRICT) — routing the work

Route by what the work needs to own, not by how parallel it is:

- Needs its own goal, PABCD cycle, user-visible task, or long-running
  merge/CI lifecycle -> **thread**, one per independent task lane, with
  `environment: worktree` for an isolated checkout. A `local` thread shares
  the checkout.
- Needs an isolated checkout for a bounded, coordinator-owned write packet
  while the coordinator is full-access -> call `create_worktree`, wait for its
  completed absolute workspace path, then spawn a **subagent** with that path
  and an instruction to pass it as the shell workdir on every command. Give
  concurrent workers disjoint worktrees and prohibit concurrent branch
  operations in one checkout. The coordinator owns goal/PABCD and integration.
- Is a bounded slice inside a thread lane that already owns its checkout ->
  **subagent** of that thread.
- Is a bounded slice of the checkout you are already editing, returning
  evidence or a patch -> **subagent** with disjoint file scope.
- Is read-only research -> **subagent**, by default. Read-only fan-out is not
  a template for parallel writes.

`create_thread` children may start with reduced approval permission, including
projectless targets. Confirm their actual permission state before planning an
unattended write lane. The bounded worktree/subagent route does not grant new
permissions; it uses the coordinator's inherited subagent permission and an
explicit checkout path. When a lane needs independent goal/PABCD ownership,
keep the thread route and handle its actual permission state; DISPATCH-FORK-LANE-01
below is one way to do that.

## DISPATCH-FORK-LANE-01 — a fork as the thread route when created threads lose permission

A same-directory `fork_thread({})` is an independent task with its own session,
goal and FSM. Confirm its actual permission before unattended writes; the
PermissionRequest auto-allow hook does not cover forks. Prefer a worktree thread
when its permission is intact.

A same-directory fork inherits history and the parent model, but shares the
checkout. Assign one lane and its boundaries explicitly. Keep the shared checkout
read-only to the fork: no edits, branch switches or commits. Before lane work:

1. Create one worktree per lane in a gitignored or sibling directory:
   `git -C <shared> worktree add -b <branch> <absolute lane path> origin/<base>`.
2. Run `cxc session bind`, then `cxc session source <absolute lane path> --json`
   before `loop init`. This pins SOURCE-DELTA-01 evidence and WORKTREE-GUARD-04
   protection to the lane's checkout; follow [source worktrees](phase-control.md#source-worktrees).
3. Use the lane path as every shell workdir and `git -C <lane path> ...` in every
   git command, since hooks see command text.

### A worktree fork that never registers

Keep a queued fork pending under [lane dispatch](../../loop/references/lane-dispatch.md).
Do not message its provisional ID or repeat its creation. If it provably has no
assignment, the lane may be routed another way: a fork receives its assignment
only in a follow-up. A queued `create_thread` already carries its assignment in
the prompt, so another route could duplicate work. Report any orphaned worktree
path; do not delete it. [Dispatch observations](../../../../../devlog/_plan/261009_prompt_reduction/evidence/dispatch-observations.md)
records the evidence behind this distinction.

## DISPATCH-AUTHORITY-01 — asking for lane work is asking for the lanes

Creating a thread is user-visible, so it needs a user request. A request for
independent task lanes **is** that request: the lanes are the mechanism the work
needs, not a separate deliverable the user forgot to ask for. Bounded checkout
workers stay under the coordinator and follow DISPATCH-ROUTE-01. Do not read
the general "create a task only when the user explicitly asks" rule as a reason
to put independent task lanes onto the shared tree — that trades a visible
question for a silent collision.

Where the shape is genuinely unclear, ask once and name what you would create
("seven lane tasks, one worktree each"), then continue. Do not ask repeatedly and
do not treat silence as a refusal of the surface the work requires.

## Parallel lanes, and the shape that works

N independent task lanes mean N `worktree` threads, N checkouts and N FSMs.
The coordinator uses `wait_threads` and integrates; neither side advances the
other's FSM. N bounded checkout workers mean N managed worktrees and N
subagents, with one coordinator goal/FSM. The coordinator uses the returned
subagent handles and checks each worktree's files before integration.

### Record the lane before you need it (DISPATCH-LANE-ID-01, DEFAULT)

Record the canonical `threadId` and `hostId` as soon as creation returns them;
keep a provisional handle separate and never pass it to a canonical-ID tool.
Listings may be filtered or paginated: an absent listing does not invalidate a
known canonical address or authorize recreating a lane.

Before addressing, validating or recovering a lane, read the packet modes and
identity procedure in [lane dispatch](../../loop/references/lane-dispatch.md).

### Arm the wake before you yield the turn

Before yielding with dispatched work running, follow
[the wake contract](../../loop/references/waiting.md#wake-before-yielding)
(DISPATCH-WAKE-01).

### The observer shares the lanes' quota

Before sustained polling, read [observer budget](../../loop/references/waiting.md#observer-budget)
(DISPATCH-POLL-BUDGET-01).

### Fan-out width is a lane property (DISPATCH-FANOUT-CAP-01, DEFAULT)

Bounded checkout workers share their session's subagent capacity even in separate
worktrees. Before choosing waves, read the single host envelope in
[lane dispatch](../../loop/references/lane-dispatch.md); its V1 default comes from
the host fixture, not a grant of unlimited fan-out. Independent tasks still need
isolated worktrees; separate IDs do not isolate two local tasks.

### The lane manifest (DISPATCH-LANE-MANIFEST-01, DEFAULT)

Independent task lanes are separate tasks, so nothing in the system knows two were handed the
same issue until their pull requests collide. One shared record makes that visible before
the branches diverge. Per lane: repository, lane id, task and host id, worktree, branch,
base ref and sha, head sha, issue, owner, scope and status.
A bounded worktree worker remains under its coordinator and does not invent a
thread id or its own FSM. Record its worktree path and assigned scope in the
coordinator's packet or progress record instead.

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
   [hosted CI evidence](../../dev/references/hosted-ci-evidence.md)
   (DEV-CI-EVIDENCE-01).
4. Land lanes serially. Shared surfaces — published counts, generated inventories, lock
   files — conflict in every lane at once, so parallel landing turns one rebase into N.

After a timeout or a compaction, recover from the manifest: reopen the recorded task and
worktree, refresh git and PR state, reconcile drift, and resume. A timeout alone never
authorizes replacing a lane and never proves one finished.

## What neither surface grants

**LEAF-TOPOLOGY-01 (STRICT).** Subagents are leaves unless recursion is explicitly granted.
A subagent may not create a goal, run `cxc orchestrate`, or bind a session; the
parent owns all of it. A thread owns its own goal and FSM, and the parent may not
advance them — messaging a task is not commanding it. Neither surface inherits
permission the parent does not have.
