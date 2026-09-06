# Stacked Pull Requests (canonical — `DEV-STACK-*`)

Canonical owner: `dev`. Other skills carry pointer stubs only (see
`references/skill-ownership.md`). Rules here are tool-agnostic: the portable model first,
CLI recipes second.

## Native stacks are explicit-only (DEV-STACK-OPT-IN-01)

Use ordinary pull requests by default; use a manual branch chain when dependencies
justify it. GitHub native stacks are default-off. Do not suggest, register, convert
to, or select a native-stack workflow unless the user clearly and strongly requests
GitHub native stacks for this specific task.

A generic request to "stack", split PRs, follow a dependency roadmap, improve CI,
merge, or release is not native opt-in. Neither platform support, a Can Stack banner,
nor existing membership supplies that intent. Do not ask users to opt in as a routine
step. One unmistakable request naming the native feature is enough: no repeated
confirmation, begging, emotional-word test, or special phrase is required. Preserve
that authorization within its stated task scope and respect later changes of mind.

This selection rule governs every native procedure below. Read-only inspection of
an existing stack remains allowed for safety; it does not authorize creating one,
merging its members, restacking, or dissolving it. If an existing stack prevents an
ordinary authorized operation, explain the concrete blocker and continue independent
work. Ask for direction only when necessary; do not push the user toward native use.
Explicit requests to leave or remove an existing stack are separate scoped actions,
not requests to adopt native stacks. Never change membership merely to avoid an error.

## The model

A **stack** is an ordered chain of branches. The **bottom** branch is based on trunk
(usually `main`); every branch above is based on the branch below it. Each branch gets its
own PR whose base is the branch below, so each PR's diff shows only that layer.

```
feature/ui        → PR #3 (base: feature/api)     ← top
feature/api       → PR #2 (base: feature/schema)
feature/schema    → PR #1 (base: main)            ← bottom
──────────────────  main (trunk)
```

Four invariants hold across every stacking tool (GitHub `gh stack`, Graphite, Git Town,
plain git). Learn these, not a vendor's flags:

1. **The base ref is the dependency edge.** The chain is your phase map, made reviewable.
2. **Editing a lower layer invalidates every layer above it** — always cascade.
3. **Merging is bottom-up.** Out-of-order merges are the pathological case.
4. **Every layer must stand alone for review**: own thesis, own build, own tests.

## DEV-STACK-06 — Recognize and register deliberately (DEFAULT)

Apply this preflight during PR creation, review, restacking or merge work, including
when inspection reveals that a PR targets another PR's head. Do not wait for a DevOps
invocation. "stacked PR", "스택 PR", "연쇄 브랜치", and dependent work-phase delivery
are signals to inspect, not proof of a stack. CSS stacks and runtime stack traces are
unrelated. Keep three states distinct:

| State | Evidence | Meaning |
|---|---|---|
| Manual branch chain | Same-repo child base = parent head; native membership absent | Layered diffs, but no native stack guarantees |
| Registered GitHub stack | API membership includes this PR, ordered members and trunk | Native stack behavior can apply |
| Unknown membership | API unavailable, denied or unsupported | Report uncertainty; do not treat an error as absence |

Start read-only, using the actual repository and PR number:

```sh
gh pr view <number> -R <owner/repo> --json number,baseRefName,headRefName,headRefOid,isCrossRepository
gh api 'repos/<owner>/<repo>/pulls/<number>'
gh api 'repos/<owner>/<repo>/stacks?pull_request=<number>'
```

Compare head/base **repository identities**, not branch names alone. Read the PR's
`stack` object or a successful stacks response; record the stack number, trunk and
bottom-to-top PR list. A successful `[]` reports no membership; non-success responses
remain unknown. Refresh before publication/merge because another actor may register
or restack while you work. GitHub native stacks currently require one repository.

`gh pr create --base <parent>`, a body stack map, labels, and the **Can Stack** banner
do not certify native registration. The banner offers conversion; confirmation is a
separate operation. **Ordinary PRs and manual chains are the default delivery path;
native registration requires the clear, strong, task-specific opt-in above.** A
manual chain satisfies a generic stacked-PR request without a native upgrade prompt.
Only after native selection and the particular write are authorized, inspect the
available tooling and use a supported native registration path. Re-read membership
after the write and record the stack number, trunk and ordered members. Never install
an extension automatically. If explicitly requested native support is unavailable,
report that limitation; do not claim a manual chain delivered the requested native
feature or silently change the user's chosen mode.

**Authority:** inspection is read-only. Registration, branch rewrites, PR retargeting,
CI changes/cancellation and merging need authority for that operation and those PRs.
A diagnosis/review or a request to publish one unrelated PR grants none of those writes.

## DEV-STACK-07 — Diagnose CI independently (DEFAULT)

Record four separate facts: branch topology, native membership, each layer's current
head/check SHA, and the workflow event/ref/concurrency policy. **Native registration
does not deduplicate CI.** GitHub runs applicable CI for each registered layer;
separate runs alone are not a stack defect. Manual chains depend on actual workflow
filters and branch rules; do not assume trunk protections are inherited.

For "CI runs separately/too often", inspect workflow triggers and job guards alongside
`gh pr checks`, `gh run list` and `gh run view` (use installed help for flags). Distinguish
different PRs from duplicate events for the same PR/head, rerun attempts, historical
heads and cancelled/superseded runs. Record the event, head SHA, ref/group, run ID and
conclusion. A PR-ref concurrency key cancels within that PR, not across the stack;
unknown cancellation causes stay unknown. Inspect required checks, not only a green
summary or check count. Missing, skipped or cancelled tests are not passing tests.

CI cost reduction is a separate, authorized workflow change. Preserve each mergeable
layer's required evidence and final integration checks; reverify after a cascade or
base/head change. Do not introduce blanket top-only skips, stack-wide cancellation,
branch-protection bypasses, or filters that silently exclude manual child bases merely
because a PR has a stack label or body map. If optimization is requested, specify which
jobs may be shared/deferred and how every required check gets truthful evidence.

## DEV-STACK-01 — When to stack (DEFAULT)

Stack when **all** of these hold:

- the work splits into 2+ parts with a real dependency order (later parts consume earlier
  parts' output), and
- shipping it as one PR would produce a diff too large to review in one sitting — by your
  repository's own review-size convention if it has one, otherwise reviewer judgment, and
- the lower parts are mergeable on their own — they do not need the upper parts to be
  correct or safe.

A `cxc-pabcd` PHASE-SPLIT-01 map orders implementation dependencies, not GitHub
features. A phase map or `cxc-loop` chain alone selects neither a PR stack nor native
registration. Decide whether a manual chain is useful using the criteria above;
the native feature still requires DEV-STACK-OPT-IN-01.

Do **not** stack when:

- the change is one cohesive thesis (splitting adds review and CI surface, buys nothing);
- the parts are independent — open parallel PRs off trunk instead, since a stack imposes a
  false merge order;
- the lower layer is speculative and likely to be rewritten (every rewrite re-cascades);
- you cannot name what each layer proves on its own (that is a slicing failure — fix the
  slice before opening anything).

**Depth (HEURISTIC — practitioner guidance, not a measured limit).** Aim for 2–4 layers
and think hard at 5. Community practice guides suggest each layer be reviewable in roughly
10–15 minutes and report stacks becoming unwieldy past about 4–5 layers; treat that as
experience, not a rule. What is certain: every layer is a separate fully gated PR with its
own review and its own CI, and every layer above an edit has to be re-stacked by hand or
by tool. If the map is longer, ship the bottom half, land it, then stack the rest.

**Slice by dependency, never by effort.** "Quick wins first" produces layers whose
dependency runs opposite to the merge order, so the stack cannot land bottom-up. This is
`cxc-pabcd` PHASE-SPLIT-01 applied to branches.

## DEV-STACK-02 — Cascading edits (STRICT)

When a lower layer changes, every layer above it must be checked against the new
lower tip; a rewrite leaves descendants on obsolete ancestry. Re-push the cascade
before asking for review:

- Plain git (no extension): `git rebase --update-refs` force-updates any branch pointing
  at a commit inside the rebased range. Branches checked out in another worktree are not
  updated. Prefer the per-invocation flag; do not change global Git configuration as
  an incidental step of stack work.
- Only for an explicitly authorized native workflow, `gh stack rebase` fetches origin and cascades from trunk upward; if a layer's PR has
  already merged it switches to `--onto` mode automatically. Conflicts pause the run;
  resume with `--continue`, unwind everything with `--abort`. Scope with `--downstack` /
  `--upstack` / `--no-trunk`.
- Other tools (Graphite `gt restack` / `gt modify`, Git Town `git town sync`, `spr diff`)
  express the same cascade — read their own docs before using their flags.

After the cascade, publish with `git push --force-with-lease` (never bare `--force`) and
re-check each PR's base ref. A rebase rewrites the reviewed commits, so depending on
repository settings a force-push can invalidate existing review state and leave inline
comments attached to commits that no longer exist. Assume review state is stale after a
cascade: say what changed and re-request review rather than expecting prior approvals to
carry.

**Verification (STRICT):** a cascade is not done because the command exited 0. Confirm each
upper branch actually contains the new lower-layer commit (`git merge-base --is-ancestor
<lower> <upper>` exits 0), inspect `git log --oneline <lower>..<upper>` for the layer-only
delta, and confirm each PR's base ref still names the branch below it.

## DEV-STACK-03 — Layer shape (DEFAULT)

Each layer:

- has one thesis, stated in its PR title;
- builds and passes its own tests at its own tip — do not defer a layer's tests upward;
- carries a stack map in its PR body so reviewers can navigate:

```markdown
**Stack** (merge bottom-up):
| # | PR | Layer | Review focus |
|---|----|-------|--------------|
| 3 | #103 | UI | integration only |
| 2 | #102 | API | endpoint behavior |
| 1 | #101 | schema ← you are here | migration + rollback |

Depends on #101. Review this PR's diff only.
```

Mid-stack layers are **not** lightly gated: in a **registered GitHub stack**, branch protection such as CODEOWNERS
approval is enforced on every PR in the stack — including mid-stack PRs that do not target
the default branch — and CI configured for the default branch runs for all of them, not
just the bottom. Budget for that: a 5-layer stack is 5 fully gated PRs, not one.
For manual chains, verify the actual branch rules and workflow coverage (`DEV-STACK-07`).

## DEV-STACK-05 — Reviewing a layer (DEFAULT)

When you are reviewing one layer of a stack:

- **Review this layer's diff only.** Its base is the branch below, so the diff is already
  scoped to the layer. Do not re-litigate a lower layer's decisions here — comment on that
  layer's own PR.
- **Judge the layer standalone** (`DEV-STACK-03`). Does it build and pass its tests at its
  own tip? "Tests come in the next PR" is a blocking finding, not a courtesy.
- **Verify the base ref.** A layer whose base points at trunk instead of its parent, or
  whose branch lacks the parent's latest commits, is a stale cascade (`DEV-STACK-02`) —
  block until it is re-stacked.
- **Re-check your findings after a force-push.** A cascade rewrites commits, so confirm
  earlier findings and approvals survived rather than assuming they carried.
- **Approving a layer is not approval to merge the stack.** Merge order and authorization
  stay with `DEV-STACK-04`.

## DEV-STACK-04 — Merging and safety (ESCALATE)

Native procedures in this section require DEV-STACK-OPT-IN-01 plus authorization
for the affected members. Existing membership and a generic merge request do not
authorize a native merge of lower members. Inspect first and report a real blocker;
do not auto-convert, dissolve, or issue native writes to complete an ordinary PR.

- **Merge bottom-up.** In a **registered GitHub stack**, merging the top PR brings every PR below it; merging a
  mid-stack PR merges everything below it while the PRs above stay open and re-target the
  stack's base automatically.
- **Manual chains are different.** Merging a child PR merges into its named parent base,
  not automatically into trunk. Land the bottom PR, retarget/restack its children, and
  verify new base/head CI before proceeding. Keep parent branches until no open child
  targets them; deletion can close a dependent PR.
- **Native API merges are asynchronous.** Use the supported async stack merge API, not
  legacy synchronous merge endpoints. Accepted/queued is not merged: poll the result,
  handle later rule/protection failures and verify actual landing before reporting success.
- **Merging stays user-authorized.** `DEV-GIT-PUSH-01` already gates pushing; merging a
  stack is a strictly larger external state change. Never merge, never enable auto-merge,
  and never bypass a queue on the agent's own initiative.
- **Never reorder or drop a layer that has already merged** — reconstruct forward instead.
- **Squash caution.** Squash merging collapses a PR's commits into one and does not
  preserve the originals. GitHub's own guidance is that squash merging works best for
  short-lived branches: if you keep working on the same head branch afterwards, later PRs
  can include commits already squashed into the base, making conflicts more likely and
  forcing you to resolve the same conflict more than once. In a stack, cascade immediately
  after any manual-chain squash merge; for native stacks verify the automatic rebase
  completed and re-check the resulting heads instead of assuming old approvals/CI apply.
- **Required reviews interact with shared commits.** Under required reviews, collaborators
  cannot merge a PR while other open PRs have a head branch pointing at the same commit
  with pending or rejected reviews — a shape stacks produce easily. Resolve those first.
- Merge requirements for every PR in a **registered GitHub stack** are determined by the **bottom** PR's
  base branch.

### Known failure: `gh pr merge --admin` still calls the legacy API

Observed in an owner-provided OpenCodex transcript on 2026-09-05: a native-stack
`gh pr merge ... --merge --admin --match-head-commit ...` failed with exit 1:

```text
GraphQL: This pull request is part of a stack and must be merged using the asynchronous merge REST API. (mergePullRequest)
```

That invocation used the unsupported GraphQL path; `--admin` did not change it.
Do not automatically repeat the same command for every layer, dissolve the stack,
or retarget it to evade this error. An explicit user request to unstack is a
separately scoped cleanup action, not native adoption. `mergeable_state: blocked` is a separate observation, not proof
that this transport error was fixed. Inspect membership and the actual merge result.

After the required native opt-in and authorization for the stack prefix, verify
current member heads and target the
highest PR in that prefix **once**. Recheck installed CLI support; otherwise use the
[async REST API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously):

```sh
# Substitute the approved repository, PR and reviewed head SHA; this is a write.
gh api --method PUT 'repos/OWNER/REPO/pulls/PR/merge-async' \
  -f sha='REVIEWED_HEAD_SHA' -f merge_method=merge -f merge_action=default
# Use the returned details.uuid to poll the same request (read-only).
gh api 'repos/OWNER/REPO/pulls/PR/merge-async/UUID'
```

The `sha` guard covers the requested PR, not independent pins for all lower members.
On 202, retain `details.uuid`; on 409, inspect the existing request/options instead of
resubmitting. Poll with bounded waits; HTTP 200 may still contain `status: pending`.
Already merged/queued responses are distinct; neither acceptance nor queue entry proves
landing. Verify `status: merged`, returned SHA and each PR's actual target integration.
Rule failures can arrive later. Do not invent an `admin` parameter or treat
`direct_merge` as permission to bypass repository rules.

## Anti-patterns

| Anti-pattern | Why it bites |
|---|---|
| Deep stacks (practitioner guidance: past ~4–5 layers) | Every added layer is another gated PR to review and another branch to re-stack on each cascade; practitioners report navigation cost outweighing the benefit past that range (experience, not a measured limit — see Depth above) |
| Effort-bucketed layers ("quick wins first") | Produces layers whose dependency runs opposite to the merge order, so the stack cannot land bottom-up |
| Mid-stack rewrites without a cascade | Upper branches keep a base that no longer exists; the PR diff shows unrelated commits |
| Force-push without `--force-with-lease` | Overwrites collaborator work, and may invalidate existing review state |
| Treating a base chain or Can Stack banner as native registration | Native rules and merge behavior require verified membership |
| Assuming registration reduces CI to one run | Applicable native CI still runs per layer; optimization is separate work |
| Assuming mid-stack PRs are lightly gated | Native stacks inherit trunk rules; manual chains need explicit coverage checks |
| Merging the top PR without checking membership | Native merge includes lower PRs; manual merge targets the parent branch |
| Stacking a single cohesive change | Every layer is a separately gated PR with its own review and CI, for no parallelism gain |

## Tooling

You do not need an extension for a **manual branch chain**: `gh pr create --base
<branch-below>` expresses the dependency and `git rebase --update-refs` maintains it.
Native registration is separate (`DEV-STACK-06`). Pass `--base` explicitly for every layer: when it
is omitted, `gh` uses the `branch.<current>.gh-merge-base` config and, if that is unset,
the repository's default branch — so a layer can silently target trunk instead of its
parent.

Only when the user clearly and strongly selected GitHub native stacks for this
task should these native tools be considered. Do not suggest or install them for
ordinary PRs or manual chains. GitHub's first-party extension is `gh stack` (`gh extension install github/gh-stack`,
requires `gh` v2.0+). Core verbs: `init`, `add`, `push`, `view`, `submit`, `rebase`,
`modify`; `up`/`down` navigate (up = away from trunk). Stack metadata lives in
`.git/gh-stack` (JSON, uncommitted) and it enables `git rerere` on init so conflict
resolutions replay across cascades. It also ships an agent-facing skill:
`gh skill install github/gh-stack`.

GitHub's native stacked-PR feature was in **public preview** as of 2026-09-05 — verify
current status before relying on preview-only behavior.

Registration, native/manual distinctions and CI semantics rechecked 2026-09-05:
[creating stacks](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests),
[native rules and CI](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[stack REST API](https://docs.github.com/en/rest/pulls/stacks), and
[API/webhook and async merge contract](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks).

Sources for the behavioral claims above, all opened 2026-08-03: `git rebase` docs
(`--update-refs`), GitHub Docs "About stacked pull requests", "Pull request merges", and
"About protected branches", the `gh pr create` manual, and the `github/gh-stack` README.
Claim-by-claim provenance: `devlog/_plan/260803_stacked_pull_requests/000_research.md`.
