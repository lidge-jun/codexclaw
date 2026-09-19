---
title: Cutting a Release
description: The promotion path from dev to main, what the release gate checks, and the traps that only show up once.
---

`dev` is the integration branch. `main` moves by maintainer promotion and carries
releases. Every release is a `dev` -> `main` pull request followed by a run of the
Release workflow.

## The path

1. Land the work on `dev` and let CI, WSL and Packed install lifecycle go green on
   that exact commit. The release gate reads conclusions by SHA, so a green run from
   a neighbouring commit does not count.
2. Bump every version surface. `check-versions.mjs` enumerates them:
   `package.json`, the plugin manifest, every component and workspace package, and
   the two inventory fields. The manifest and inventory may carry `+codex.<stamp>`
   build metadata; the others may not.
3. Regenerate the inventory with the measured test count:
   `node plugins/codexclaw/scripts/inventory.mjs --write --tests <n>`. Take `<n>`
   from the `tests` line of a real run, not `pass` - CI skips the repo-map live
   smoke, so `pass` is environment-dependent while `tests` is not.
4. Confirm `dev` is protected from deletion **before** merging the promotion PR:

   ```sh
   gh api repos/lidge-jun/codexclaw/rules/branches/dev
   ```

   It must list an enforced `deletion` rule. The repository has
   `delete_branch_on_merge` enabled, so an unprotected `dev` is deleted by GitHub the
   moment the promotion merges, and the next cycle has no integration branch to target.
   The `protect-dev` ruleset exists for exactly this and is deliberately narrow: it
   carries the deletion rule only, so ordinary merged-feature cleanup keeps working and
   `protect-main`'s unrelated status-check requirements are not imposed on `dev`.
5. Open the promotion PR from `dev` to `main` and merge it once checks are green.
   Then immediately re-read `gh api repos/lidge-jun/codexclaw/branches/dev`. The merge
   is the only moment the protection is actually exercised, so this is the one check
   that cannot be done in advance.
6. Run the Release workflow against `main`. **Merging does not start it.** The workflow
   triggers only on `workflow_dispatch` or a `v*` tag push, and the dispatch inputs
   `version` and `expected_sha` are both required — `expected_sha` fails the run if
   `main` moved after you audited it:

   ```sh
   gh workflow run release.yml --repo lidge-jun/codexclaw --ref main \
     -f version=<version> -f expected_sha=<main SHA> -f prerelease=false -f dry_run=true
   ```

   Dispatch with `dry_run=true` first. The gate runs without publishing, which is the
   cheapest way to find a missing receipt. Then repeat with `dry_run=false` and read
   that dispatch's own run conclusion — not the newest run in the list.

## What the gate actually checks

`cxc release verify` fails closed. It wants the exact-SHA conclusions of the other
workflows, a suite measured in the same run, the inventory hash the docs were
generated from, and the packed-install lifecycle. It is worth trusting: during the
0.2.7 campaign it refused three times, and every refusal was a real mismatch rather
than gate noise.

The two you will meet most often:

```
- platform-ci is missing
- published tests=1901 but the measured suite reported 1924
```

The first means the other workflows have not finished on this SHA. The second means
step 3 was skipped or the count moved after it - adding tests during a release cycle
is normal, so re-measure and regenerate rather than editing the badge by hand.

## Two traps worth knowing before you hit them

**A failed release leaves a tag you cannot reuse.** A repository ruleset forbids
force-updating and deleting version tags, so if a release attempt fails after the tag
is pushed, that tag stays pinned to the commit that failed. Retagging is not an
option. Run the Release workflow through `workflow_dispatch` against `main`
instead of the `push: tags` trigger, which is what `v0.2.7` had to do.

**A workflow change cannot vouch for its own promotion.** The `enforce-target` check
runs on `pull_request_target`, which always executes the workflow file from the BASE
branch. So a PR that changes that workflow is still judged by `main`'s old copy, and
the first promotion after such a change can never benefit from it. Merge that one with
`--admin`; the next promotion is the real confirmation.

## Promotions are exempt from the target-branch rule

`enforce-target` requires PRs to target `dev`, with one exemption: a `dev` -> `main`
PR from this repository. A fork branch merely named `dev` is not exempt, since the
check compares `head.repo.full_name`.

If the token cannot draft a PR, the check warns instead of failing - the title prefix
and the explanatory comment are the enforcement that matters, and a permission the
repository never granted should not turn into a red check.
