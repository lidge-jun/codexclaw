# 000 — Stacked Pull Requests: Research + Claim Ledger

Unit: `260803_stacked_pull_requests`
Date: 2026-08-03
Class: C3 (cross-skill doctrine addition, public skill-contract surface, no runtime code)
Method: `cxc-lunasearch` fan-out (4 Luna lanes) → `cxc-search` Tier 2 proof by the main agent.

## 1. Why this unit exists

A repo-wide `rg` for stacked-PR vocabulary across `plugins/`, `structure/`, and `devlog/`
on 2026-08-03 returned **zero** matches in a pull-request sense (`stacked` hits were all
CSS/scroll/design-token noise in `dev-frontend`, `dev-uiux-design`, and finished devlogs).
The codexclaw skill family therefore has a real capability hole:

- `dev` §5 owns exactly two git rules — `DEV-GIT-COMMIT-01` (commit incrementally) and
  `DEV-GIT-PUSH-01` (push needs approval). Both are single-branch assumptions.
- `pabcd` PHASE-SPLIT-01 already forces a **dependency-ordered** work-phase map, and
  `loop` LOOP-UNIT-CHAIN-01 already chains many PABCD cycles in one session. That is
  precisely the shape a PR stack expresses — but nothing tells the agent to publish it
  as a stack, so multi-phase loop output collapses into one oversized branch or a set of
  unrelated-looking PRs whose true dependency order is invisible to reviewers.

The gap is not "we never mention stacking." It is that the family's own planning
discipline **produces** stack-shaped work and then has no vocabulary to ship it.

## 2. Claim ledger

Status legend: `verified` = primary source opened by the main agent at Tier 2 during this
cycle; `lead` = Luna lane result not independently re-opened here (must not become
normative skill text without a Tier-2 pass); `corrected` = Luna's claim was wrong and the
opened source overrides it.

| # | Claim | Source (opened) | Accessed | Status |
|---|-------|-----------------|----------|--------|
| K1 | `git rebase --update-refs` force-updates any branch pointing at a commit in the rebased range; branches checked out in a worktree are **not** updated. `rebase.updateRefs` config makes it default; `--no-update-refs` overrides. | https://git-scm.com/docs/git-rebase | 2026-08-03 | verified |
| K2 | GitHub native stacked PRs are in **public preview** (Luna lane reported "private preview"). | https://docs.github.com/en/pull-requests/get-started/about-stacked-prs | 2026-08-03 | corrected |
| K3 | In a GitHub stack the bottom PR targets the trunk and each higher PR targets the branch below it; merge requirements for **every** PR in the stack are determined by the bottom PR's base branch. | https://docs.github.com/en/pull-requests/get-started/about-stacked-prs | 2026-08-03 | verified |
| K4 | Branch protection (e.g. CODEOWNERS approval) is enforced on every PR in the stack, including mid-stack PRs that do not target the default branch. CI checks configured for the default branch run for **all** PRs in the stack, not just the bottom. | https://docs.github.com/en/pull-requests/get-started/about-stacked-prs | 2026-08-03 | verified |
| K5 | PRs must merge **bottom-up**. Merging the top PR brings every PR below it; merging a mid-stack PR merges everything below it and the PRs above stay open and automatically re-target the stack's base. Merge commit, squash, and rebase are all supported and stacks are merge-queue aware. Merging via API requires the new stacks merge API. | https://docs.github.com/en/pull-requests/get-started/about-stacked-prs | 2026-08-03 | verified |
| K6 | `gh stack` is a GitHub-maintained `gh` extension (`gh extension install github/gh-stack`, requires gh v2.0+). Stack metadata lives in `.git/gh-stack` (JSON, not committed); interrupted rebase state in `.git/gh-stack-rebase-state`. `gh stack init` enables `git rerere` automatically. | https://raw.githubusercontent.com/github/gh-stack/main/README.md | 2026-08-03 | verified |
| K7 | `gh stack rebase` fetches origin then cascades a rebase from trunk upward; **if a branch's PR has been merged it switches to `--onto` mode** to replay correctly. Conflicts pause the run and it resumes with `--continue` / unwinds with `--abort` (restoring all branches). `--downstack` / `--upstack` / `--no-trunk` scope the cascade. | https://raw.githubusercontent.com/github/gh-stack/main/README.md | 2026-08-03 | verified |
| K8 | `gh-stack` ships an agent-installable skill: `gh skill install github/gh-stack` "to teach your AI coding agents how to work with stacked PRs". | https://raw.githubusercontent.com/github/gh-stack/main/README.md | 2026-08-03 | verified |
| K9 | Navigation model: `up` moves away from trunk, `down` toward it; core verbs are `init`, `add`, `push`, `view`, `submit`, `modify`. | https://raw.githubusercontent.com/github/gh-stack/main/README.md | 2026-08-03 | verified |
| K10 | When a PR branch is merged, GitHub retargets open PRs based on it to the merged PR's own base branch instead of closing them. | https://github.blog/changelog/2020-05-19-pull-request-retargeting/ | 2026-08-03 | lead (page served an oEmbed wrapper; behavior is corroborated by K5's "automatically re-target" on an opened GitHub Docs page) |
| K11 | `gh pr create --base <branch>` selects the base branch for the created PR — the plain-`gh` way to express a stack link with no extension. If `--base` is omitted, `gh` uses the `gh-merge-base` git branch config, else the repository default branch. | https://cli.github.com/manual/gh_pr_create | 2026-08-03 | verified |
| K12 | Graphite `gt`: `gt create` makes a child branch on the current one, `gt modify -a` restacks descendants automatically, `gt submit --stack` publishes, `gt restack` / `gt sync` repair the chain. | https://graphite.com/docs/cli-quick-start | 2026-08-03 | lead |
| K13 | Git Town: `git town append` creates a child branch, `set-parent` re-points it, `propose` opens the PR, `sync` propagates (pausing on conflict, resumed by `git town continue`), `ship --strategy=fast-forward` merges bottom-up without rewriting descendants. | https://www.git-town.com/all-commands | 2026-08-03 | lead |
| K14 | `spr` models one amendable commit per PR (`spr init`, `spr diff`, `spr land`); `land` squash-merges. | https://github.com/spacedentist/spr | 2026-08-03 | lead |
| K15 | Practice guidance converges on small stacks: ~10–15 minutes of review per layer and roughly 4–5 PRs before a stack becomes unwieldy. | https://stacked-pr.github.io/ , https://www.stacking.dev/ | 2026-08-03 | lead (opinion/practice, not measured — ships only as an explicitly hedged heuristic) |
| K16 | Vendor-measured PR-size data: ~50-line PRs merge ~40% faster than ~250-line PRs. Vendor-reported, single-vendor dataset. | https://graphite.com/blog/the-ideal-pr-is-50-lines-long | 2026-08-03 | lead (vendor-reported) |
| K17 | Stacking multiplies CI: more PRs plus rebase-triggered reruns of dependent branches. | https://graphite.com/docs/stacking-and-ci | 2026-08-03 | lead (vendor doc). NOTE: the *portable* half of this claim is independently verified by K4 — default-branch CI runs for every PR in a GitHub stack. Shipped text asserts only the K4 half. |
| K18 | Squash merges use fast-forward and do not preserve intermediate commits. "Squash merging works best for short-lived branches. If you keep working on the same head branch after a squash merge, later pull requests can include commits that were already squashed into the base branch. This can make merge conflicts more likely and can force you to resolve the same conflicts more than once." | https://docs.github.com/en/pull-requests/reference/pull-request-merges | 2026-08-03 | verified |
| K19 | Under required reviews, "collaborators cannot merge the pull request if there are other open pull requests that have a head branch pointing to the same commit with pending or rejected reviews" — someone with write access must approve or dismiss those first. A blocking review can be dismissed by anyone with write permissions. | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches | 2026-08-03 | verified |
| K20 | Stale-approval dismissal on force-push: the specific "dismiss approvals when the diff changes" behavior was NOT confirmed on an opened page this cycle (the rulesets page returned `blocked`). Shipped text therefore says a rebase+force-push "can invalidate review state depending on repository settings" and directs the reader to re-request review, without asserting a specific dismissal mechanism. | — | 2026-08-03 | unverified — hedged in shipped text |

### 2.1 Normative-use policy for this ledger

Skill text may state a `verified` claim as fact. A `lead` claim may appear only as
**tool-agnostic guidance** or an explicitly hedged example — never as a precise behavioral
guarantee. Concretely, the shipped doctrine states the *portable model* (bottom-up merge,
base-chain, cascade-on-rebase) from K1/K3/K4/K5/K6/K7/K11/K18/K19, and mentions
Graphite/git-town/spr only as "other tools exist, check their docs" without quoting
per-flag semantics.

**A-gate round 1 (2026-08-03) enforced this policy.** An independent reviewer returned
`VERDICT: FAIL` with two High blockers; blocker 1 was that the draft doctrine asserted
K11/K17/K18/K19 as fact while they were still `lead`. Disposition: K11, K18, and K19 were
promoted by opening their primary sources during the A loop (rows above now quote the
opened text); K17's vendor-specific claim was dropped in favor of the already-verified K4
statement; the stale-approval mechanism became K20 and ships hedged. K15 remains `lead`
and ships only as a labeled heuristic. See `001_audit_synthesis.md`.

## 3. What the tools agree on (the portable model)

Across `gh stack`, Graphite, Git Town, and plain git, the same four invariants hold and
they are what codexclaw should encode — the CLI surface is interchangeable:

1. **A stack is a chain of branches, each based on the one below, bottom-based on trunk.**
   The PR's base ref is the edge; the chain is the plan made reviewable.
2. **Editing a lower layer invalidates every layer above it.** Every tool answers this with
   a cascading rebase (`gh stack rebase`, `gt restack/modify`, `git town sync`, or bare
   `git rebase --update-refs`). There is no tool where "just push the fix" is enough.
3. **Merging happens bottom-up.** Upper PRs then either auto-retarget (GitHub) or need an
   `--onto` replay (K7). A stack merged out of order is the pathological case.
4. **Each layer must stand alone for review**: its diff is only its own layer, so it needs
   its own build-ability, its own tests, and its own thesis.

Invariant 4 is exactly `pabcd` PHASE-SPLIT-01's requirement that "every phase must still
close with something independently verifiable." That correspondence is the hinge of this
whole unit.

## 4. Anti-patterns worth encoding

| Anti-pattern | Why it bites | Ledger |
|---|---|---|
| Deep stacks (>4–5 layers) | Rebase cost and reviewer navigation cost grow faster than the review benefit | K15 |
| Effort-bucketed layers ("quick wins first") | Produces layers that cannot merge bottom-up because the dependency runs the other way | derived from K3/K5 + PHASE-SPLIT-01 |
| Mid-stack rewrites without a cascade | Upper branches silently keep the old base; the PR diff shows unrelated commits | K1, K7 |
| Force-push without `--force-with-lease` | Overwrites collaborator work; may also invalidate existing review state | K20 (hedged — mechanism unverified) |
| Ignoring same-commit review blocks | Required reviews block merging while another open PR's head branch points at the same commit with pending/rejected reviews — a shape stacks produce easily | K19 |
| Assuming mid-stack PRs are lightly gated | CODEOWNERS and default-branch CI apply to every layer | K4 |
| Merging the top PR expecting only that layer | It brings every PR below it | K5 |
| Stacking a single cohesive change | Pure ceremony cost: every layer is a separately gated PR with its own review and CI, for no parallelism gain | K4 |

## 5. Ownership decision inputs

The family enforces one canonical owner per rule area
(`dev/references/skill-ownership.md`). Candidate owners considered:

- **`dev` §5 + `dev/references/stacked-prs.md`** — `dev` already owns `DEV-GIT-COMMIT-01`
  and `DEV-GIT-PUSH-01`, and both new rules are siblings of those. Every dev-family skill
  already treats `dev` as canonical for safety/process rules, so pointer stubs are cheap.
- `dev-devops` — owns delivery pipelines, but a PR stack is an authoring/review construct
  that exists before CI; putting it here would force `pabcd`/`loop` to point at a skill
  they otherwise never load.
- `dev-code-reviewer` — owns *reviewing* a stack, not producing one. It becomes a stub.
- A new `dev-git` skill — rejected: `npm run gate` `checkCounts` and the README/docs-site
  skill badge (`skills-27`) track the skill inventory, so a new skill directory is a
  manifest/docs change with no doctrine benefit.

**Decision: `dev` is the canonical owner.** Rule family `DEV-STACK-*`, body in
`dev/references/stacked-prs.md`, summary block in `dev` §5.1, pointer stubs in `pabcd`,
`loop`, `dev-code-reviewer`, and `dev-devops`. Recorded as a row in the ownership map.

## 6. Residuals / open questions

- GitHub's stacked-PR feature is public preview (K2) and may change; shipped text says
  "public preview as of 2026-08-03" rather than asserting stable behavior.
- Graphite/git-town/spr flag-level semantics stay `lead`; if a later cycle wants to ship
  per-tool recipes, it owes a Tier-2 pass on each vendor doc first.
- K10 remains a lead (the changelog page served an oEmbed wrapper); the doctrine relies on
  K5's opened-page retarget statement instead. K11 was promoted to `verified` during
  A-gate round 1.
- K20 (stale-approval dismissal on force-push) remains unverified — the rulesets page
  returned `blocked` on 2026-08-03. If a later cycle wants to state the mechanism, it owes
  a Tier-2 pass, likely via a different ladder rung.
- K17's vendor CI-rerun claim is NOT used in shipped text at all (A-gate round 2 caught
  the claim surviving its own citation removal). Any future CI-cost statement beyond K4
  needs its own primary source.
