# wp2 — P revalidation and diff-level plan

## Revalidation of 010

wp1's D concluded that the confusion is a routing gap rather than a missing
fact, and that the fix is one owner file plus conditional edges into it. Reading
the live tree at `288d83e5` confirms 010's design still holds, with two
adjustments the audit forced.

`lunasearch/SKILL.md:18-20` turns out to be the sharpest example in the repo of
the thing being fixed: "The session surface is pinned on its first turn. V1 is
the default unless the model catalog selects V2 … Fan the lanes out as N spawns".
It already knows about V1 versus V2 and still calls the units "lanes" without
once saying they share a checkout. One sentence there is worth more than a
paragraph elsewhere.

`structure/20_pabcd_dispatch_doctrine.md:29` maps the cli-jaw "Employee" row onto
`spawn_agent` in a translation table that has no row for a Codex task at all.
Adding a row is better than editing the existing one, since the existing mapping
is correct as far as it goes.

## Exact changes

### New — `skills/pabcd/references/dispatch-surfaces.md`

Sections in order: DISPATCH-SURFACE-01 (name the surface first); the comparison
table; DISPATCH-ROUTE-01 (the routing decision); DISPATCH-SHARED-TREE-01 (the
shared-tree trap and the contradicted host wording); parallel lanes; the
thread-with-subagents hybrid; authority.

The comparison table's rows: working tree, git branch and HEAD, thread id,
`.codexclaw` session state, host goal, PABCD FSM, who owns the result, user
visibility, creation authority, addressing, waiting, and lifecycle end.

### Edits

| File | Anchor | Change |
|---|---|---|
| `pabcd/SKILL.md` | "## Delegation Model (subagents)" | a first paragraph routing to the taxonomy before a surface is chosen |
| `pabcd/references/delegation.md` | line 1 | a scope line: this file owns the subagent packet, the taxonomy owns surface choice |
| `pabcd/references/delegation.md` | DISPATCH-ISOLATION-01 | add that lanes share one working tree, so scopes must be disjoint by path |
| `loop/SKILL.md` | reading table | a row for parallel lanes and surface choice |
| `dev/SKILL.md` | "### Discovery delegation" | one sentence separating discovery from a parallel branch lane |
| `worktree-guardian/SKILL.md` | §2 WG-FACTS-01 | a WG-FACTS-02 note: a spawned child inherits this worktree and does not get one |
| `lunasearch/SKILL.md` | "## Hardcoded Spawn Path" | the lanes share one checkout; Luna lanes are read-only so they cannot collide |
| `structure/20_pabcd_dispatch_doctrine.md` | translation table | a row mapping a separate Codex task to `create_thread` |

## Out of this cycle

The delegation reference's "Live tool schema and role transport" section and
every `components/subagent-config` file belong to wp3. The audit confirmed the
two spans in `delegation.md` do not overlap: wp2 touches line 1 and
DISPATCH-ISOLATION-01 near line 103, wp3 touches lines 50-99.

## Check

`npm run gate` under `cxc receipt test`. The reviewer read `gate.mjs` and
established what it actually does: `walkSkillMds` covers every
`references/*.md`, so the false-enforcement prose scan applies
(`gate.mjs:125-165`), and the new file must therefore state its rules as agent
discipline rather than claiming a hook enforces them. `checkCounts` is hook
cardinality only and `checkInventory` collects skill folders, so a new reference
file stales neither. It runs no link check and no frontmatter check — 010's claim
that it does was wrong and is withdrawn.

## Revision 1 — audit FAIL fold

The A-phase reviewer returned **FAIL** on this plan with five blockers. It is
right, and the failure is the interesting kind: every anchor existed, every edit
was real, and the plan still would not have worked.

The reviewer walked the actual reading path for "7개 PR 레인을 병렬로 머지해줘"
and showed that nothing on it reaches the new file. SessionStart injects the loop
and stacked-PR pointers. `cxc-loop` SKILL.md is read in full and would gain only
another conditional table row. `cxc-pabcd` SKILL.md is read in full and would
gain a pointer sitting under a heading already named "Delegation Model
(subagents)" — the heading has chosen the surface before the pointer is read.
And `cxc-loop` explicitly forbids following the link anyway: "Do not recursively
load every linked file", "read only references whose conditions apply".

A rule that lives only behind a conditional link, in a system built on
progressive disclosure, is a rule the failing agent never sees. The fix is to put
the decision itself in the bodies that are always read, and keep the reference
for the detail.

### Folded changes

**B1 — the rule moves into always-read bodies.** `loop/SKILL.md` gets the
routing decision as prose in its execution invariants, not a table row.
`pabcd/SKILL.md`'s delegation section gets the same decision in its first
paragraph, and its heading changes from "Delegation Model (subagents)" to
"Delegation model — choosing a surface" so the title stops pre-selecting the
answer. The reference keeps the comparison table and the detail.

**B2 — `dev/references/stacked-prs.md` joins the scope.** It is the file
SessionStart names for PR and dependent-branch work, and it never mentions either
dispatch tool. It gets the lane rule directly.

**B3 — the SessionStart affordance.** `components/cxc-ops/src/map-affordance.ts`
`renderStackedPrAffordance` gains one clause routing parallel lane work to the
thread surface. This is injected prompt text, in scope under the Revision 1
decision recorded in `000_plan.md`; the affordance's control flow is untouched.

**B4 — the authority bounce.** The reviewer found a live contradiction: the
taxonomy would require an explicit user request before creating a thread, the
host tool text says the same, and "merge seven lanes in parallel" is a request
for parallel work rather than a request for seven tasks. An agent could read the
taxonomy, hit that rule, and fall back to subagents while believing it obeyed.
The taxonomy must resolve it: asking for parallel lane work IS the request for
the threads that lane work requires, because the lanes are the mechanism, not a
separate deliverable. Where the agent is genuinely unsure it asks once and says
what it will create, rather than silently choosing the surface that collides.

**B5 — DISPATCH-ISOLATION-01 must read as a constraint.** "Lanes share one
working tree, so scopes must be disjoint by path" is, as the reviewer put it, a
recipe for seven executor spawns with "PR #N" as the write scope. It is rewritten
so the shared tree forbids concurrent branch-level git operations outright,
rather than describing how to partition them.

**B6 — the dropped edge is restored.** `dev/references/peer-collaboration.md`
returns to the list; 010 had it and 011 lost it.

**Lunasearch correction.** The planned sentence would have taught N parallel
`spawn_agent` lanes as the default shape for parallel work. It is scoped to what
Luna lanes actually are: read-only discovery, which is collision-free precisely
because it writes nothing, and therefore not a template for parallel write work.

## Revision 2 — user steering: sequential stack-merge priority

The user asked, mid-cycle, to write the stack-merge strategy from the
"Rebase 순차 스택 머지 우선순위" task into `stacked-prs.md`. That file was already
pulled into this cycle by blocker B2, so both land in one pass.

The strategy is recorded in that task's own plan unit at
`/Users/jun/.codex/worktrees/b4a9/opencodex/devlog/_plan/260913_lane_stack_merge/`,
which is the source for the new rule. It contributes five mechanics that the
current `stacked-prs.md` does not have, each learned by something breaking:

1. **Lane parallelism with tip-only CI.** Group PRs into lanes by dominant file
   domain, make each lane a cumulative stack, push every non-tip head with
   `[skip ci]` in the commit subject, and let the tip's run gate the lane. This
   works only where CI triggers on `pull_request` plus a trunk-pinned `push`;
   `pull_request_target` workflows keep running and cannot be skipped.
2. **Merge commit, not squash, for a lane tip.** A squash discards the ancestry
   of the links beneath the tip, so GitHub cannot see their heads in trunk and
   they stay open to be closed by hand as superseded. A merge commit keeps it and
   GitHub marks the whole lane `MERGED` from one merge. Six responses-lane PRs
   closed correctly this way from a single `--merge`.
3. **The ancestry invariant.** Auto-close holds only while the tip is a
   descendant of every link's current remote head, so re-merging a lower link
   after the chain was built breaks it. Verify per link with
   `git merge-base --is-ancestor origin/<link> <tip>` before merging the tip.
   Two of five live lanes had already broken it.
4. **Chained children merge top-down.** Merging a stacked child lands nothing on
   trunk: it collapses into its parent's branch. Only the trunk-based root lands
   on trunk, so a lane containing a base chain merges deepest-child first and the
   root last. This inverts the bottom-up rule, which still governs lanes whose
   members all target trunk.
5. **Sequential priority within a wave.** Order by what reduces future conflict
   and rework: the designated next slot first, especially just after review fixes
   when its head is new and needs a fresh exact-head check; then trunk-based
   singles with no open review threads; and a PR sharing the most-contended files
   earlier rather than later, since every later lane rebases around it.

It lands as **DEV-STACK-08**, after DEV-STACK-07, and carries the explicit
precondition that it is a lane-throughput strategy which relaxes the per-PR
merge gate. The per-PR gate stays the default; DEV-STACK-08 requires the
repository owner's decision, names the risk that a broken non-tip link is only
discovered at the tip, and pairs it with the stop-on-red trunk watch that makes
the relaxation survivable.
