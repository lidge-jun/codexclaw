# wp2 — Dispatch-surface taxonomy

## Diff level

New reference file plus routing edges from four existing skills. No code.

## New file: `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md`

It lives next to `delegation.md` because both are read at A/B time, and the
delegation reference already owns the subagent packet contract. The new file owns
the choice *between* surfaces; delegation.md keeps owning what a subagent packet
contains once the choice is made.

Contents, in order:

1. **DISPATCH-SURFACE-01 (STRICT)** — name the surface before dispatching. The
   two surfaces are not interchangeable and the word "파견"/"dispatch" alone does
   not select one.
2. **The comparison table.** Filesystem, git branch/HEAD, session state, host
   goal, PABCD FSM, who owns the result, visibility to the user, lifecycle, and
   how the handle is addressed. Every row backed by the wp1 measurement.
3. **DISPATCH-ROUTE-01 (STRICT)** — the routing decision:
   - Work that needs its own branch, its own checkout, or its own long-running
     merge/CI lane goes to a **thread**.
   - Work that is a bounded slice of the tree the parent is already editing, and
     that returns evidence rather than owning a branch, goes to a **subagent**.
   - Read-only research goes to a subagent by default; it is cheaper and it
     cannot collide because it does not write.
4. **DISPATCH-SHARED-TREE-01 (STRICT)** — the trap. Subagents share the parent's
   working tree; write scopes must be disjoint by path, and two subagents must
   never be told to run git branch/checkout/stash/reset operations concurrently.
   Records that the host tool text says "forked workspace" and that the
   measurement contradicts it on this build.
5. **Parallel-worktree lanes.** The concrete pattern: N lanes, N threads, N
   worktrees, one FSM each; the parent coordinates with `wait_threads` and does
   not advance any child's FSM.
6. **The hybrid that actually works.** A thread per lane, and inside each lane
   that thread spawns its own subagents. Subagents of different threads cannot
   collide because their parents' worktrees differ. This is the shape the
   opencodex merge run converged on and it is worth naming.
7. **Authority.** Creating a thread is a user-visible act and needs an explicit
   user request; spawning a subagent needs delegation authority but no new task.
   Neither surface grants the child authority to touch the parent's goal or FSM.

## Routing edges to add

| File | Edge |
|---|---|
| `pabcd/SKILL.md` §Delegation Model | route to the new file before choosing a surface; keep delegation.md for the packet |
| `pabcd/references/delegation.md` | first line states that surface selection is owned elsewhere |
| `loop/SKILL.md` reading table | add a row: "Parallel lanes, worktrees, or a choice between a thread and a subagent" |
| `dev/SKILL.md` §Discovery delegation | one sentence: discovery is a subagent, a parallel branch lane is a thread |
| `worktree-guardian/SKILL.md` | a subagent does not get its own worktree; a thread does. This is where a reader arrives when they ask "누가 워크트리를 갖나" |
| `dev/references/peer-collaboration.md` | the peer table row for a dispatched child points at the taxonomy |
| `skills/lunasearch/SKILL.md` | its parallel spawn lanes share one checkout; added by the audit |
| `structure/20_pabcd_dispatch_doctrine.md` | the Employee row maps to `spawn_agent` only, with no thread row; added by the audit |

DISPATCH-ISOLATION-01 in `delegation.md` is amended in the same pass: it
currently says "every lane gets explicit read and write access lists" without
saying the lanes share one working tree, which is the sentence most easily read
as isolation.

The `spawn-attach-hook.ts` leaf-guard strings and their surrounding comments are
edited in wp3 rather than here, because they sit next to the V1/V2 surface
detection that wp3 owns. Splitting them across two cycles would touch the same
file twice.

## Acceptance

- Criterion c-1: the taxonomy file states the filesystem/goal/FSM/lifecycle
  differences and cites the measurement.
- Criterion c-3: the routing rule is stated as an imperative with the
  parallel-lane case resolved explicitly.
- `cxc gate` passes, including whatever link and frontmatter checks it runs.

## Risks

The skills are already long; adding a seventh reference to pabcd increases
reading cost. Mitigation: the new file is a routing target, not a preload —
the edges are conditional rows, matching how the other references are reached.

A second risk is drift: the V1/V2 namespace and the "forked workspace" wording
are host facts that can change. Mitigation: every claim about the host is written
as "measured on this build, re-check the live schema", never as a permanent fact.
