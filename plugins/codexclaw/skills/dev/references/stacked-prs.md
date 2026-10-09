# Stacked Pull Requests (canonical — `DEV-STACK-*`)

Dev owns this procedure. Other skills point here. Apply the portable branch model
before choosing tool-specific recipes.

## Native stacks are explicit-only (DEV-STACK-OPT-IN-01)

Use ordinary PRs by default, or a manual branch chain when dependencies justify
one. Do not suggest, register, convert to or select GitHub native stacks unless
the user clearly and strongly requests that feature for this task.

Generic requests to stack, split PRs, follow a roadmap, reduce CI, merge or release
are not native opt-in. Existing membership, platform support and a Can Stack
banner do not supply it. One unmistakable request naming the feature suffices;
do not ask routinely or require special wording. Preserve its task scope and
respect later withdrawal.

Read-only membership inspection is allowed; it grants no registration, restack,
merge or dissolution. If a stack blocks an ordinary authorized operation, explain
the blocker and continue independent work; ask only for needed direction.
Leaving/removing an existing stack is separate cleanup authority. Never change
membership merely to evade an error.

## The model

A stack is a chain: bottom based on trunk, each upper branch based on its parent,
one PR per layer with that parent as base. Four invariants apply:

1. Base ref expresses the dependency.
2. Editing a lower layer requires cascading every layer above.
3. Merge bottom-up, except the cumulative chained-child order in DEV-STACK-08.
4. Each layer has its own reviewable thesis, build and verification.

## DEV-STACK-06 — Recognize and register deliberately (DEFAULT)

Inspect topology and membership during PR creation, review, restack or merge,
including a PR targeting another PR's head. Dependent work-phase delivery is an
inspection signal; generic CSS/runtime stacks are unrelated.

| State | Evidence |
|---|---|
| Manual chain | Same-repo child base equals parent head; native membership absent |
| Registered native stack | Successful API membership gives ordered members and trunk |
| Unknown | API denied, unsupported or unavailable; an error is not absence |

Start read-only with the actual repository and PR:

```sh
gh pr view <number> -R <owner/repo> --json number,baseRefName,headRefName,headRefOid,isCrossRepository
gh api 'repos/<owner>/<repo>/pulls/<number>'
gh api 'repos/<owner>/<repo>/stacks?pull_request=<number>'
```

Compare head/base repository identities, not names alone. Read the PR stack
object or successful stacks response; record stack number, trunk and bottom-to-top
members. Successful `[]` means no membership. Refresh before publication/merge:
another actor may change membership or ancestry. Native stacks require one repo;
verify current platform support before relying on it.

A parent base, body map, label or Can Stack banner does not certify registration.
Apply the selection rule above, then require authority for the particular native
write. Use supported tooling and re-read membership afterward. Do not install an
extension automatically. If the requested native feature is unavailable, report
that gap instead of claiming a manual chain delivered it or silently changing mode.

Inspection grants no branch rewrite, registration, PR retarget, CI change/
cancellation or merge authority. A review/diagnosis or unrelated PR publication
request authorizes none of those writes.

## DEV-STACK-07 — Diagnose CI independently (DEFAULT)

Record topology, native membership, each layer's current head and checked SHA,
and workflow event/ref/concurrency policy separately. Registration does not
deduplicate CI: applicable native CI runs per layer. Manual children depend on
actual workflow filters and branch rules, not assumed trunk protection.

For excessive runs, inspect workflow triggers/guards with `gh pr checks`,
`gh run list` and `gh run view`; use installed help for flags. Distinguish separate
PRs, duplicate events at one head, reruns, old heads and cancelled/superseded runs.
Record event, head SHA, ref/group, run ID and conclusion. A PR-ref concurrency
key cancels within that PR; unknown cancellation causes remain unknown.

Before judging jobs or merge readiness, apply
[hosted CI evidence](../references/hosted-ci-evidence.md) (DEV-CI-EVIDENCE-01).
For independent task lanes, apply manifest and landing rules in
[dispatch surfaces](../../pabcd/references/dispatch-surfaces.md)
(DISPATCH-LANE-MANIFEST-01, DISPATCH-LANE-MERGE-01).
A WRONG BRANCH verdict may be a base-policy rejection of a legitimate parent:
inspect the enforcer rather than destroy the dependency topology.

CI optimization is a separately authorized workflow change. Specify shareable/
deferred jobs and truthful evidence for every required check. Preserve each
mergeable layer's evidence and final integration checks; reverify after a cascade
or base/head change. No blanket tip-only skips, stack-wide cancellation,
branch-protection bypasses or filters excluding manual child bases merely because
of labels/maps. DEV-STACK-08 is a scoped exception, not evidence that a skipped
non-tip check passed.

## DEV-STACK-08 — Lane-parallel stacks with a tip-only gate (ESCALATE)

Only a repository-owner authorization for a named batch permits this per-PR gate
exception. Otherwise retain per-PR required checks.

### The shape

Group PRs by dominant file domain. Lanes prepare in parallel, but each lane is
cumulative: the bottom merges trunk, each upper branch merges its parent's new
commit. Before independent lane preparation, follow
[dispatch surfaces](../../pabcd/references/dispatch-surfaces.md) for isolation and
creation authority.

### Tip-only CI

Push each non-tip head with `[skip ci]` in its commit subject; the tip runs the
expensive suite. Verify the actual workflow shape first: `pull_request` plus
`push` pinned to trunk lets a feature-branch push rely on PR synchronize, which
skip markers suppress. `pull_request_target` continues, including cheap hygiene,
label and base checks. Do not assume this recipe fits other trigger shapes.

### Mandatory guards

- Missing/skipped/cancelled checks are not passing checks. The tip covers links
  only while it contains their current heads; record which run covers which PRs.
- No unauthorized top-only skip, branch-protection bypass or merge-queue bypass.
  `--admin` and merge-method selection are mechanisms, not authority.
- Never let a `[skip ci]` subject land on trunk and suppress trunk regression.
- Watch trunk after each lane lands; stop the lane on red. Moving the gate to
  immediately after merge does not remove it.
- Apply DEV-STACK-04 merge authority; this procedure grants only an order.

### Merge with a merge commit, not a squash

Use `--merge` for a lane tip. Squashing discards link ancestry, leaving lower
PRs open and requiring manual closure reported as closed, not merged. A merge
commit retains ancestry so a cumulative tip can mark covered links MERGED.
Use `--squash` for a PR landed alone.

### The ancestry invariant

The tip must descend from every link's current remote head. Refreshing a lower
link without carrying it upward invalidates auto-close. Check every link:

```sh
git merge-base --is-ancestor origin/<link-branch> <tip-commit>
```

A nonzero exit requires repair: merge the refreshed link into its next child,
then propagate that result through the tip. Absorbing trunk only at the bottom
also breaks this invariant.

### Chained children merge top-down

A child merge lands in its parent branch; only a trunk-based root lands on trunk.
For an already cumulative base chain, merge deepest child first, then parents,
then the root; each PR closes MERGED. Direct-to-trunk independent links retain
bottom-up order.

Parent squashes can make children conflict with the squashed form of their own
content. If resolving to a child that is a strict superset, verify no parent
content was lost. Child-first order limits repeated re-merges.

### Order within a wave

Prefer the designated next reviewed slot with fresh exact-head evidence, then
lanes owning contended shared files, then independent trunk singles with no open
review threads. A single sweeping change goes last so it rebases once; a lane
owning shared files goes early to reduce other lanes' rework.

Land lanes serially. Before the next lane lands, re-merge trunk at its tip and
rerun tip CI; dominant-domain grouping does not remove cross-lane file overlap.

## DEV-STACK-01 — When to stack (DEFAULT)

Use a stack only when the parts have real implementation dependencies, one PR
would exceed the repo's review-size convention (or reviewer judgment), and lower
layers are independently correct, safe and mergeable.

Do not stack a cohesive thesis, independent parts, speculative lower layers
likely to be rewritten, or slices with no standalone proof. Independent parts
use parallel trunk PRs. A phase map alone selects neither stacking nor native
registration. Dependency order follows PHASE-SPLIT-01 in
[Plan](../../pabcd/references/phase-plan.md); native choice follows the opt-in rule.

Depth is a heuristic: aim for 2–4 layers and reassess at 5. Each layer adds review,
CI and cascade work; land a lower group before extending a long map.
[Historical research](../../../../../devlog/_plan/260803_stacked_pull_requests/000_research.md)
holds practitioner estimates. Every layer remains gated unless the owner
explicitly selects the named DEV-STACK-08 tip-coverage exception.

## DEV-STACK-02 — Cascading edits (STRICT)

When a lower layer changes, check every upper branch against its new tip and
cascade before requesting review or publishing. Use supported tooling:

- Plain git: `git rebase --update-refs` moves branches in the rebased range but
  excludes branches checked out in other worktrees. Prefer the per-call flag;
  do not incidentally change global Git configuration.
- Authorized native workflow: `gh stack rebase` fetches and cascades from trunk;
  a merged layer switches to `--onto`. Conflicts pause: `--continue` resumes,
  `--abort` unwinds. Scope with `--downstack`, `--upstack` or `--no-trunk`.
- Other tools express the same operation; read their current docs before flags.

Push only with DEV-GIT-PUSH-01 authority; rewritten heads use
`git push --force-with-lease`, never bare `--force`.
Recheck each PR's base. Treat review state as stale after rewrites; describe
changes and re-request review because approvals and inline anchors may change.

Exit zero is insufficient. Verify each upper branch contains the new lower tip
with `git merge-base --is-ancestor <lower> <upper>`, inspect
`git log --oneline <lower>..<upper>` for only that layer's delta, and verify its
PR base still names the parent.

## DEV-STACK-03 — Layer shape (DEFAULT)

Each layer has one thesis in its title, builds and passes verification at its
own tip, and includes a navigable stack map and review focus in its PR body.
Deferring verification upward is allowed only by the recorded DEV-STACK-08
exception.

```markdown
**Stack** (merge bottom-up):
| # | PR | Layer | Review focus |
|---|----|-------|--------------|
| 3 | #103 | UI | integration only |
| 2 | #102 | API | endpoint behavior |
| 1 | #101 | schema ← you are here | migration + rollback |

Depends on #101. Review this PR's diff only.
```

Registered native members inherit required protection, including CODEOWNERS and
configured trunk CI, even mid-stack. Budget for each gated PR. For manual chains,
inspect actual branch rules and coverage under DEV-STACK-07.

## DEV-STACK-05 — Reviewing a layer (DEFAULT)

Review its own diff against the parent; address lower-layer decisions on their
own PR. Demand standalone build/test evidence: deferring tests to a later layer
blocks review. Check the parent base and latest-parent ancestry; a stale cascade
blocks until repaired. After force-push, recheck findings and approvals.
Review approval grants no merge authority.

## DEV-STACK-04 — Merging and safety (ESCALATE)

Apply native opt-in and authority for all affected members before native writes.
Existing membership or a generic single-PR merge request does not authorize a
native merge of lower members. Inspect blockers; never auto-convert, dissolve
or perform native writes to complete an ordinary PR.

- Ordinary stacks land bottom-up. Native top/mid merges include lower members;
  upper members remain open and retarget automatically. Verify that behavior.
  For an already cumulative child chain, apply DEV-STACK-08 child-first order.
- Manual children merge into their named parent, not trunk. When landing layer
  by layer, land the bottom, retarget/restack children and verify new base/head
  CI. Keep parent branches until no child targets them; deleting a parent can
  close a dependent PR. Already cumulative lanes use the separate child-first order.
- Use supported async native merge transport. Acceptance or queueing is not
  merged: inspect later protection failures and actual landing.
- Merge, auto-merge and queue bypass remain user-authorized. Push authority
  under DEV-GIT-PUSH-01 alone grants no stack merge.
- Never reorder or drop an already merged layer; reconstruct forward.
- Superseding follows DEVOPS-PR-SUPERSEDE-01 in
  [PR intake](../../dev-devops/references/agent-pr-intake.md); retain a superseded
  parent while any child stays open.
- Squashes discard original commits. Continuing a squashed head can repeat
  prior deltas/conflicts. Cascade after a manual squash; verify native automatic
  rebase and new heads rather than assuming old approvals or CI.
- Resolve pending/rejected reviews on other open heads at the same commit
  before merging under required-review rules.
- A native stack's merge requirements come from its bottom PR's base branch.

### Native merge transport

A legacy GraphQL rejection requires membership and CLI diagnosis. Do not repeat
the same call across members, retarget or change membership to evade it.
Unstacking requires separate cleanup authority. Blocked mergeability proves no
transport recovery; inspect the actual result.

After native selection and authorized-prefix review, verify member heads and
target its highest PR once. Recheck installed CLI support, or use the
[async REST API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously):

```sh
# Approved repository, PR and reviewed SHA only; this is a write.
gh api --method PUT 'repos/OWNER/REPO/pulls/PR/merge-async' \
  -f sha='REVIEWED_HEAD_SHA' -f merge_method=merge -f merge_action=default
# Poll the same returned request, read-only.
gh api 'repos/OWNER/REPO/pulls/PR/merge-async/UUID'
```

The SHA guard pins the requested PR, not every lower member. On 202 retain
`details.uuid`; on 409 inspect the existing request/options instead of resubmit.
Poll with bounded waits: HTTP 200 may still say pending. Distinguish already
merged from queued; verify status merged, returned SHA and every target landing.
Rules can fail later. Never invent an admin parameter or treat direct_merge as
permission to bypass rules.

## Anti-patterns

Apply each named owner: excessive depth (DEV-STACK-01), missing cascade
(DEV-STACK-02), weak mid-layer proof (DEV-STACK-03), and unreviewed membership,
force-push or merge (DEV-STACK-04/06/07). Labels, banners and maps are neither
native registration nor CI evidence.

## Tooling

Manual chains need no extension: `gh pr create --base <branch-below>` expresses
the edge and `git rebase --update-refs` maintains it. Always pass `--base`:
otherwise `gh` uses `branch.<current>.gh-merge-base`, then the repo default,
which can silently retarget a child to trunk.

Before any native extension write/install, apply native opt-in and specific
operation authority. Verify current official docs and installed help rather than
reuse dated recipes. Primary sources:
[creating stacks](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests),
[native rules and CI](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[stack REST API](https://docs.github.com/en/rest/pulls/stacks), and
[API/webhook and async merge contract](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks).
Claim-by-claim history is in
[the research record](../../../../../devlog/_plan/260803_stacked_pull_requests/000_research.md).
