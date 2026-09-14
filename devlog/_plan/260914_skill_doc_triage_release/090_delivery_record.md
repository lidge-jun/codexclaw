# 090 — Delivery record: codexclaw 0.2.28

Written in wp4's B phase, before the closing check. Every value below was read
from the live repository or a hosted run, not from the roadmap's projections.

## What shipped

Four reference-doc fixes for #170-#173, plus this unit's roadmap and the 0.2.28
release preparation.

| SHA | Landed | Content |
|---|---|---|
| `7036f9b8` | PR #174 | the four skill-reference fixes |
| `b984aa5c` | `dev` | merge of #174, merged by lidge-jun 2026-09-13T23:48:40Z |
| `93e1c0aa` | `dev` | this roadmap unit |
| `ca326d9e` | `dev` | version surfaces, CHANGELOG, regenerated inventory |
| `e8e46f90` | `main` | promotion PR #176 |

## Hosted evidence, by SHA

| SHA | CI | WSL | Packed install |
|---|---|---|---|
| `b984aa5c` | success | success | success |
| `ca326d9e` | success | success | success |
| `e8e46f90` | success (×2) | success (×2) | success (×2) |

`e8e46f90` carries two runs of each lane because the promotion merge and the
subsequent `dev` restore both pushed that SHA. All six concluded success.

Release: run `34793539291`, dispatched against `main` with `version=0.2.28`,
`prerelease=false`, `dry_run=false`, `expected_sha=e8e46f90`. Preceded by dry run
`34793306251`, which exercised the gate with publication skipped so that
`protect-release-tags` could not burn `v0.2.28` on a gate failure.

## What the roadmap predicted correctly

`delete_branch_on_merge` deleted `dev` the moment PR #176 merged, exactly as
`030` said it would. `git ls-remote --heads origin refs/heads/dev` came back empty
immediately after the merge; `dev` was restored at `e8e46f90` and now resolves
again. Issue #175 tracks the permanent fix and was deliberately left unimplemented.

`enforce-target` passed with no `[WRONG BRANCH]` prefix, confirming the
`dev` -> `main` exemption matched on `head.repo.full_name`.

## What the roadmap got wrong, and the correction

`000` recorded that the roadmap would precede every merge. It did not precede the
user's own merge of #174, which landed while these documents were being written.
The ordering caveat is recorded verbatim in criterion c-1's evidence rather than
smoothed over.

Issue #175 was filed with the cleanup workflow named as the root cause. That was
wrong: `delete_branch_on_merge` is `true` at the repository level and deletes an
unprotected head branch immediately, well before the scheduled cleanup runs. PR
#169 merged at 09:48:01Z while the cleanup run did not start until 12:17:11Z. The
issue was corrected in place, and the recommended fix changed accordingly — protect
`refs/heads/dev`, which closes both paths, with the workflow's never-delete set as
defence in depth.

## Measurement provenance

The inventory was regenerated with `--tests 3150`, taken from the `tests 3150`
line of hosted CI run `34790437740` job `103813520900`. No local suite, typecheck,
build or install ran at any point in this delivery. The published badge already
read `3,150`, so it did not move and the three READMEs were untouched — only the
inventory's version fields changed.

## Plan deviations

Two steering batches are in the ledger. `wp2-fold-version-bump-20260914` folded
wp3's version edits into wp2 because CI, WSL and Packed install serialize on the
`dev` ref and each extra head cost a full ~14-minute generation, while the gate
reads only the promoted SHA. `wp3-becomes-promotion-cycle-20260914` then gave wp3
the promotion work so no cycle ran empty, keeping the irreversible publication
alone in wp4.

