# wp3 — Dispatch guidance and optional worker checkpoint

A Codex Desktop thread created through `create_thread` may begin with approval prompts even when its full-access coordinator and user Codex config do not. For bounded work that needs an isolated checkout but not its own goal or PABCD state, the coordinator can create a managed worktree and give its absolute path to a subagent, which passes that path as the shell workdir on every command. Keep separate threads for lanes that must own their own goal, PABCD cycle, or user-visible task. This is a guidance change, not a new dispatcher or permission guarantee.

## Phase contract

- Binding decisions: AD-6 in `devlog/_plan/260927_issue_train/002_architect_consultation.md:14`; #265 is an optional worker progress checkpoint.
- Scope: edit only the two skill references below. The permission hook and advisory are specified in `020_wp3_agent_thread_permissions.md`.
- Completion: the two references give the same choice rule, state that the subagent's native cwd still inherits the coordinator's, require disjoint worktrees and an explicit per-command shell workdir, forbid concurrent branch operations in one checkout, and give a replacement worker enough on-disk state to resume an interrupted write packet.
- Existing evidence: `dispatch-surfaces.md:53-58` records inherited cwd; `delegation.md:227-236` records the shared-tree hazard. The permission issue also affects projectless `create_thread` targets; do not describe it as specific to worktree threads. `020` cites the Codex hook/rollout ownership source.

## File change map

Anchors are current at `codex/issue-train-0927` / `958441a9` on 2026-09-27. Each diff below is an exact text replacement against the current file. No source or test file changes in this unit.

### 1. MODIFY `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md`

At lines 21-29, distinguish an independent task lane from a bounded checkout worker:

```diff
 Isolation comes from the environment, not from being a task. A `local` thread is
 an independent owner sharing one checkout; a `worktree` thread is an independent
-owner with its own. Lane work needs the second.
+owner with its own. An independent task lane needs the second.

-A **lane** is thread work; a **worker inside a lane** is subagent work. N lanes
-means N worktree threads, and the workers inside each lane are that lane's
-subagents — they cannot collide across lanes because the worktrees differ.
+An **independent task lane** owns a goal, PABCD cycle or long-running branch/CI
+lifecycle: use one worktree thread per lane. A **bounded checkout worker** needs
+only a disjoint checkout and returns a patch or evidence to the coordinator:
+create a managed worktree, then give its absolute path to a subagent. The
+subagent's native cwd still inherits the coordinator's; the packet must require
+that path as the shell workdir on every command. Workers do not acquire their
+own goal or PABCD state. Different workers must use different worktrees.
```

At table lines 35-37, make the cwd and edit visibility precise for the new subagent pattern:

```diff
-| Working directory | the parent's, unchanged; never a copy | its own, with `environment: worktree`; the shared project checkout with `local` |
+| Working directory | native cwd inherits the parent's; a bounded worker must pass its assigned managed-worktree path as the shell workdir on every command | its own, with `environment: worktree`; the shared project checkout with `local` |
-| Git branch and HEAD | the parent's | its own under `worktree`; shared under `local` |
+| Git branch and HEAD | native cwd points at the parent's; commands run in an assigned managed worktree see that worktree's branch and HEAD | its own under `worktree`; shared under `local` |
-| Edits visible to the parent | immediately, as the parent's own uncommitted changes | only through git |
+| Edits visible to the parent | immediately in the selected checkout; a managed worktree has its own branch and files | only through git |
```

At lines 60-73, replace the first two rules and append the explicit workdir rule after the fork-context paragraph:

```diff
-- Write scopes across concurrent subagents must not overlap.
-- **Never** run two subagents that perform branch-level git operations at the
-  same time. `checkout`, `switch`, `branch`, `stash`, `reset`, `rebase`, `merge`
-  and `pull` act on one shared HEAD; two children doing that corrupt each other's
-  work regardless of how their file scopes were divided. A per-file write scope
-  does not make concurrent branch work safe.
+- Write scopes across concurrent subagents must not overlap. A coordinator
+  assigning separate managed worktrees must give each worker a different path.
+- **Never** run concurrent branch-level git operations in one checkout.
+  `checkout`, `switch`, `branch`, `stash`, `reset`, `rebase`, `merge` and `pull`
+  change that checkout's HEAD or index; a per-file write scope does not separate
+  them. Operations in different worktrees do not share one HEAD, but each branch
+  still needs one owner and an explicit integration order.
@@
   Only the V2 usage hint states the shared directory, so a V1 session is never
   told it by the runtime.
+- For a managed-worktree worker, instruct the subagent to pass the absolute
+  worktree path as the shell tool's workdir on **every** command, including
+  `git status`, tests and reads. Use absolute paths for file edits. Its native
+  cwd and relative-path defaults do not move when the worktree is created.
```

At lines 75-93, replace the route list with the following complete list. It states the `create_worktree` then `spawn_agent` sequence only for bounded checkout work; the independent-task route remains a thread:

```diff
 Route by what the work needs to own, not by how parallel it is:

-- Needs its own branch, checkout, or long-running merge/CI lane -> **thread**,
-  one per lane, created with `environment: worktree`. A `local` thread does not
-  give the lane a checkout of its own.
-- Needs its own goal or its own PABCD cycle -> **thread**.
-- Is a bounded slice inside a lane that already owns its checkout -> **subagent**
-  of that lane's thread.
-- Is a bounded slice of the tree you are already editing, returning evidence or a
-  patch rather than owning a branch -> **subagent**.
-- Is read-only research -> **subagent**, by default. It cannot collide because it
-  writes nothing, which is also why read-only fan-out is not a template for
-  parallel write work.
-
-"Merge these lanes in parallel", "prepare N stacks at once", "run these branches
-concurrently" are thread work. Spawning N subagents for N branches puts N writers
-on one HEAD.
+- Needs its own goal, PABCD cycle, user-visible task, or long-running
+  merge/CI lifecycle -> **thread**, one per independent task lane, with
+  `environment: worktree` for an isolated checkout. A `local` thread shares
+  the checkout.
+- Needs an isolated checkout for a bounded, coordinator-owned write packet
+  while the coordinator is full-access -> call `create_worktree`, wait for its
+  completed absolute workspace path, then spawn a **subagent** with that path
+  and an instruction to pass it as the shell workdir on every command. Give
+  concurrent workers disjoint worktrees and prohibit concurrent branch
+  operations in one checkout. The coordinator owns goal/PABCD and integration.
+- Is a bounded slice inside a thread lane that already owns its checkout ->
+  **subagent** of that thread.
+- Is a bounded slice of the checkout you are already editing, returning
+  evidence or a patch -> **subagent** with disjoint file scope.
+- Is read-only research -> **subagent**, by default. Read-only fan-out is not
+  a template for parallel writes.
+
+`create_thread` children may start with reduced approval permission, including
+projectless targets. Confirm their actual permission state before planning an
+unattended write lane. The bounded worktree/subagent route does not grant new
+permissions; it uses the coordinator's inherited subagent permission and an
+explicit checkout path. When a lane needs independent goal/PABCD ownership,
+keep the thread route and handle its actual permission state.
```

At lines 108-112, make the parallel-lane statement apply to independent tasks and add the bounded variant:

```diff
-N independent lanes means N `worktree` threads, N checkouts, N FSMs. The parent
-coordinates with `wait_threads` and integrates; it does not advance any child's
-FSM, and a child does not advance the parent's.
+N independent task lanes mean N `worktree` threads, N checkouts and N FSMs.
+The coordinator uses `wait_threads` and integrates; neither side advances the
+other's FSM. N bounded checkout workers mean N managed worktrees and N
+subagents, with one coordinator goal/FSM. The coordinator uses the returned
+subagent handles and checks each worktree's files before integration.
```

At lines 201-206, keep the two composition forms distinct:

```diff
-Threads and subagents then compose. A lane thread spawns its own subagents inside
-its own worktree, and subagents belonging to different lanes cannot collide
-**because those worktrees differ** — not because their parents are different
-tasks. Two `local` threads on one checkout collide exactly like two subagents do.
-The shape that scales is worktrees for isolation and subagents for concurrency
-within an isolated tree.
+Threads and subagents compose in independent task lanes: each worktree thread
+spawns bounded subagents inside its checkout. A full-access coordinator can
+also assign separate managed worktrees directly to bounded subagents. In both
+forms, different worktrees provide file and HEAD isolation; different thread
+ids do not. Two `local` threads on one checkout still collide.
```

At lines 208-213, change the manifest lead so it does not require a task id for a bounded worker:

```diff
-Lanes are independent tasks, so nothing in the system knows two of them were handed the
+Independent task lanes are separate tasks, so nothing in the system knows two were handed the
 same issue until their pull requests collide. One shared record makes that visible before
 the branches diverge. Per lane: repository, lane id, task and host id, worktree, branch,
 base ref and sha, head sha, issue, owner, scope and status.
+A bounded worktree worker remains under its coordinator and does not invent a
+thread id or its own FSM. Record its worktree path and assigned scope in the
+coordinator's packet or progress record instead.
```

The rest of the lane manifest and wake/poll guidance remains scoped to independent threads; the new paragraph above prevents applying its `threadId` requirement to bounded workers.

### 2. MODIFY `plugins/codexclaw/skills/pabcd/references/delegation.md`

At lines 3-6, qualify the opening description:

```diff
 packet. [Dispatch surfaces](dispatch-surfaces.md) owns the choice between a
 subagent and a separate Codex task, and the fact that a subagent runs in this
-session's own working directory rather than a copy of it.
+session's native working directory rather than a copy of it. A bounded worker
+can operate in a separately created managed worktree only when its packet
+supplies that absolute path and it uses it as every shell command's workdir.
```

After the existing packet/scope instructions at lines 14-20, add this exact optional #265 section. `PROGRESS.md` is written only when the packet grants its path; a successor reads it plus the files and checks them before resuming. No new CLI or mandatory log is introduced.

````md
### Optional worker progress checkpoint (#265)

For a long bounded write packet, the coordinator may grant a specific `PROGRESS.md`
path inside the worker's assigned worktree. The worker may update it after a
coherent edit or check with three fields: `Done`, `Remaining`, and `Partial files`
(absolute paths plus what is incomplete). Example:

```text
Done: parsed hook input and added the first regression test
Remaining: add manifest entries; run focused tests
Partial files: /absolute/worktree/path/src/agent-thread-permissions.ts — parser branch incomplete
```

The checkpoint is a handoff hint, not completion proof or a new source of
authority. On interruption, the coordinator checks that the first worker has
stopped, reads `PROGRESS.md` and the named files, then gives the replacement
worker the same bounded packet, worktree path, and remaining work. The
replacement verifies the actual file state before editing. Without a granted
path, the worker does not create `PROGRESS.md`.
````

At lines 207-225, add the permission observation after the thread-surface paragraph:

```diff
 `worktree` is what gives a lane its own checkout. Creating a thread is
 user-visible; messaging one is not commanding it.
+A `create_thread` child may start with reduced approval permission even when
+the coordinator is full-access; this also occurs for projectless targets. Check
+the child's actual permission mode before assigning unattended writes. A
+bounded checkout worker can instead use `create_worktree` plus a subagent with
+the returned absolute path as every shell workdir. This does not give the
+subagent its own task, goal or PABCD state.
```

At lines 229-236, replace the isolation bullet:

```diff
-- **DISPATCH-ISOLATION-01:** subagent lanes are not isolated environments — they
-  all run in this session's working directory, so "isolation" here means scope
-  discipline, not separation. Give every lane explicit read and write access lists
-  with no overlap, and never share in-progress output across lanes. Concurrent
-  lanes must never run branch-level git operations (`checkout`, `switch`,
-  `branch`, `stash`, `reset`, `rebase`, `merge`, `pull`): those act on one shared
-  HEAD and a per-file write scope does not make them safe. Work that genuinely
-  needs its own branch or checkout is thread work, not a subagent lane.
+- **DISPATCH-ISOLATION-01:** subagents inherit the parent's native cwd; they
+  do not get a copied checkout. Give concurrent workers disjoint read/write
+  scopes. For a bounded worker in a managed worktree, assign one absolute
+  worktree path and require the shell workdir on every command; use absolute
+  file paths for edits. Different workers get different worktrees. Never run
+  concurrent branch-level operations (`checkout`, `switch`, `branch`, `stash`,
+  `reset`, `rebase`, `merge`, `pull`) in one checkout; a file scope cannot
+  separate one HEAD. Work that needs its own goal or PABCD cycle stays a
+  separate thread task.
```

## Activation scenarios and verification

1. Full-access coordinator, two bounded write packets: create two managed worktrees, wait for both absolute workspace paths, spawn two subagents with disjoint scopes, and require each shell command's `workdir` to equal its assigned path. Confirm `pwd`, `git rev-parse --show-toplevel`, branch/HEAD and edits in each worktree. Their native inherited cwd is not evidence of the command workdir. No simultaneous branch operation in one checkout.
2. Independent issue lane needing its own goal/PABCD: use a worktree thread, confirm its actual permission mode, and retain `wait_threads`, lane manifest, and separate FSM ownership. The managed-worktree/subagent route cannot satisfy this case.
3. Interrupted bounded worker with a granted checkpoint path: ensure it stopped, inspect `PROGRESS.md` and partial files, then dispatch a replacement with the same exact path/scope. Without a granted path, no checkpoint is created. These are manual acceptance scenarios for guidance, not claims of automated enforcement.

Run `rg -n 'native cwd|shell workdir|create_worktree|PROGRESS.md|concurrent branch' plugins/codexclaw/skills/pabcd/references/{dispatch-surfaces,delegation}.md` and inspect the modified paragraphs for contradictory unconditional statements. Run `git diff --check -- plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md plugins/codexclaw/skills/pabcd/references/delegation.md`. No executable code changed in this unit; do not claim the permission behavior itself has been tested by these text checks.

## Out of scope

No new CLI, automatic worker checkpoint, changed thread-creation API, permission grant, branch automation, or goal/FSM handoff to a subagent. The coordinator remains responsible for verifying worker files and integrating results.
