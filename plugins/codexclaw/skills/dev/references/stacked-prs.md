# Stacked Pull Requests (canonical — `DEV-STACK-*`)

Canonical owner: `dev`. Other skills carry pointer stubs only (see
`references/skill-ownership.md`). Rules here are tool-agnostic: the portable model first,
CLI recipes second.

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

## DEV-STACK-01 — When to stack (DEFAULT)

Stack when **all** of these hold:

- the work splits into 2+ parts with a real dependency order (later parts consume earlier
  parts' output), and
- shipping it as one PR would produce a diff too large to review in one sitting — by your
  repository's own review-size convention if it has one, otherwise reviewer judgment, and
- the lower parts are mergeable on their own — they do not need the upper parts to be
  correct or safe.

Codexclaw produces stack-shaped work by construction: a `cxc-pabcd` PHASE-SPLIT-01 phase
map is dependency-ordered (foundations → core → integration → hardening) and each phase
must close with something independently verifiable. That map **is** a stack plan; a
`cxc-loop` chain of work-phases under one goal is the same shape across cycles.

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

When a lower layer changes, every layer above it is based on a commit that no longer
exists. Re-push the cascade before asking for review:

- Plain git (no extension): `git rebase --update-refs` force-updates any branch pointing
  at a commit inside the rebased range. Branches checked out in another worktree are not
  updated. Enable by default with `git config --global rebase.updateRefs true`; disable
  per-invocation with `--no-update-refs`.
- `gh stack rebase` fetches origin and cascades from trunk upward; if a layer's PR has
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
upper branch actually contains the new lower-layer commit (`git log --oneline
<lower>..<upper>` shows only that layer's commits) and that each PR's base ref still names
the branch below it.

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

Mid-stack layers are **not** lightly gated: on GitHub, branch protection such as CODEOWNERS
approval is enforced on every PR in the stack — including mid-stack PRs that do not target
the default branch — and CI configured for the default branch runs for all of them, not
just the bottom. Budget for that: a 5-layer stack is 5 fully gated PRs, not one.

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

- **Merge bottom-up.** On GitHub, merging the top PR brings every PR below it; merging a
  mid-stack PR merges everything below it while the PRs above stay open and re-target the
  stack's base automatically.
- **Merging stays user-authorized.** `DEV-GIT-PUSH-01` already gates pushing; merging a
  stack is a strictly larger external state change. Never merge, never enable auto-merge,
  and never bypass a queue on the agent's own initiative.
- **Never reorder or drop a layer that has already merged** — reconstruct forward instead.
- **Squash caution.** Squash merging collapses a PR's commits into one and does not
  preserve the originals. GitHub's own guidance is that squash merging works best for
  short-lived branches: if you keep working on the same head branch afterwards, later PRs
  can include commits already squashed into the base, making conflicts more likely and
  forcing you to resolve the same conflict more than once. In a stack, cascade immediately
  after any squash merge.
- **Required reviews interact with shared commits.** Under required reviews, collaborators
  cannot merge a PR while other open PRs have a head branch pointing at the same commit
  with pending or rejected reviews — a shape stacks produce easily. Resolve those first.
- Merge requirements for every PR in a GitHub stack are determined by the **bottom** PR's
  base branch.

## Anti-patterns

| Anti-pattern | Why it bites |
|---|---|
| Deep stacks (practitioner guidance: past ~4–5 layers) | Every added layer is another gated PR to review and another branch to re-stack on each cascade; practitioners report navigation cost outweighing the benefit past that range (experience, not a measured limit — see Depth above) |
| Effort-bucketed layers ("quick wins first") | Produces layers whose dependency runs opposite to the merge order, so the stack cannot land bottom-up |
| Mid-stack rewrites without a cascade | Upper branches keep a base that no longer exists; the PR diff shows unrelated commits |
| Force-push without `--force-with-lease` | Overwrites collaborator work, and may invalidate existing review state |
| Assuming mid-stack PRs are lightly gated | CODEOWNERS and default-branch CI apply to every layer |
| Merging the top PR expecting only that layer | It brings every PR below it |
| Stacking a single cohesive change | Every layer is a separately gated PR with its own review and CI, for no parallelism gain |

## Tooling

You do not need an extension: `gh pr create --base <branch-below>` expresses the chain and
`git rebase --update-refs` maintains it. Pass `--base` explicitly for every layer: when it
is omitted, `gh` uses the `branch.<current>.gh-merge-base` config and, if that is unset,
the repository's default branch — so a layer can silently target trunk instead of its
parent.

GitHub's first-party extension is `gh stack` (`gh extension install github/gh-stack`,
requires `gh` v2.0+). Core verbs: `init`, `add`, `push`, `view`, `submit`, `rebase`,
`modify`; `up`/`down` navigate (up = away from trunk). Stack metadata lives in
`.git/gh-stack` (JSON, uncommitted) and it enables `git rerere` on init so conflict
resolutions replay across cascades. It also ships an agent-facing skill:
`gh skill install github/gh-stack`.

GitHub's native stacked-PR feature was in **public preview** as of 2026-08-03 — verify
current status before relying on preview-only behavior.

Sources for the behavioral claims above, all opened 2026-08-03: `git rebase` docs
(`--update-refs`), GitHub Docs "About stacked pull requests", "Pull request merges", and
"About protected branches", the `gh pr create` manual, and the `github/gh-stack` README.
Claim-by-claim provenance: `devlog/_plan/260803_stacked_pull_requests/000_research.md`.
