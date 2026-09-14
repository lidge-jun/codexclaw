# 030 — wp4: promote to main and publish v0.2.28

## Goal

`main` carries 0.2.28, the Release workflow publishes it, #170-#173 close, and
`dev` survives.

## Step 1 — promotion PR

    gh pr create -R lidge-jun/codexclaw --base main --head dev \
      --title "chore(release): promote codexclaw 0.2.28 to main"

`enforce-target` requires PRs to target `dev`, with exactly one exemption: a
`dev` -> `main` PR whose head repo is this repository. A fork branch merely named
`dev` is not exempt, because the check compares `head.repo.full_name`. This PR
qualifies, so no `[WRONG BRANCH]` prefix should appear. If one does, the exemption
did not match and that is a real finding, not a cosmetic one.

### `main` is ruleset-protected

Ruleset `protect-main` (id 20884837, enforcement `active`, **no bypass actors**)
applies `deletion`, `non_fast_forward` and `required_status_checks` to
`refs/heads/main`. Six contexts are required:

    ci
    artifact (ubuntu-latest) / artifact (windows-latest) / artifact (macos-latest)
    install (ubuntu-latest) / install (macos-latest)

`strict_required_status_checks_policy` is **false**, so the PR does not have to be
rebased onto the latest `main` before merging. No bypass actor exists, so
`--admin` is not available here — the six contexts must genuinely pass. Note that
WSL and the Windows `install` lane are NOT required contexts, so a red WSL lane
does not block the merge even though wp2 still wants it green as release evidence.

Merge once green. Record the merge commit SHA on `main` — that SHA is what the
release dispatch must pin.

## Step 2 — dev will be deleted; restore it

`delete_branch_on_merge` is true and the promotion PR's head branch IS `dev`.
Merging deletes it, exactly as happened after PR #169. Immediately after the merge:

    git fetch origin --prune
    git ls-remote --heads origin refs/heads/dev
    # if absent:
    git push origin origin/main:refs/heads/dev

This satisfies c-8. The permanent fix is issue #175 and is out of scope here.

## Step 3 — release dispatch

Wait for CI, WSL and Packed install to conclude `success` on the `main` merge SHA
first. `cxc release verify` reads those conclusions by SHA and fails closed; a
dispatch before they finish reports `platform-ci is missing`.

    gh workflow run release.yml -R lidge-jun/codexclaw --ref main \
      -f version=0.2.28 -f prerelease=false -f dry_run=false \
      -f expected_sha=<main merge SHA>

`expected_sha` is mandatory and exists because branches move between the audit and
the dispatch. Use `workflow_dispatch`, not the `push: tags` trigger.

**Trap.** Ruleset `protect-release-tags` (id 20884836) applies `deletion`,
`non_fast_forward` and `update` to `refs/tags/v*` with no bypass actors, so a
version tag cannot be moved or removed once pushed. If a dispatch fails AFTER the
tag is pushed, `v0.2.28` is burned and cannot be reused; that is a NEEDS_HUMAN
outcome, not something to work around. Verified 2026-09-14: tags run to `v0.2.27`
and `v0.2.28` is still free. This is why the gate runs before publication and why
the dispatch is pinned to an audited SHA.

## Step 4 — close the issues

PR #174 carries `Closes #170`-`#173`, but it targeted `dev`. GitHub auto-closes
only on merge into the DEFAULT branch, which is `main`, so the promotion merge is
what closes them. Verify explicitly rather than assuming:

    gh issue view 170 -R lidge-jun/codexclaw --json state

If any remain open, close them with a comment pointing at the release.

## Exit

wp4 closes when the Release workflow concluded `success`, GitHub Release `v0.2.28`
exists, #170-#173 are CLOSED, and `dev` resolves on the remote.
