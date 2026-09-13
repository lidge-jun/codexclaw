# 010 — wp2: land PR #174 on dev

## Goal

`dev` contains the four reference-doc fixes, and the resulting `dev` head SHA
carries its own green CI, WSL and Packed install lifecycle conclusions.

## Precondition

PR #174 is MERGEABLE / CLEAN at head `7036f9b8` with 14/14 checks passing. Re-read
it immediately before merging; do not trust the value recorded in `000`.

## Action

    gh pr merge 174 -R lidge-jun/codexclaw --merge

Merge commit, not squash: the repository's integration history uses merge commits
(`Merge pull request #169 from lidge-jun/dev`) and the promotion path reads that
shape. `delete_branch_on_merge` removes the topic branch
`codex/260914-skill-doc-triage-170-173` automatically, which is correct for a
topic branch.

## Why a separate CI generation is required

The PR checks ran against `7036f9b8`. Merging produces a NEW commit on `dev`, and
the release gate resolves conclusions by SHA. Workflow triggers:

| Workflow | Runs on push to `dev` | Runs on PR |
|---|---|---|
| CI (`ci.yml`) | yes | yes |
| WSL (`wsl.yml`) | yes | **no** |
| Packed install (`packed-install.yml`) | yes | yes |

WSL never ran for PR #174 by design, so the `dev` push is the FIRST evidence that
lane produces for this change. It is also the longest lane at 13-14 minutes.

## Verification

    DEV_SHA=$(gh api repos/lidge-jun/codexclaw/commits/dev --jq .sha)
    gh run list -R lidge-jun/codexclaw --commit "$DEV_SHA"

Require conclusion `success` for CI, WSL and Packed install lifecycle at that SHA.
Record the SHA and the run ids as c-2 evidence.

## Exit

wp2 closes when `dev` head is green on all three lanes. A failure here is fixed
forward on `dev`; do not revert the merge.

