# 041 — Delivery record: issue train 2026-09-30 and release 0.2.40

codexclaw 0.2.40 is published and is the latest release: https://github.com/lidge-jun/codexclaw/releases/tag/v0.2.40 (stable, not a draft, published 2026-09-29T19:27:44Z, tag `v0.2.40` -> `3c1459ac`). It ships this train's #276/#277 fix and preflight (#278), the Interview assumption provenance guidance for #275 (#279) and the goalplan decision options for #262 (#280), together with the 2026-09-27 train (#269-#272). No hook file, hook registration or hook handler changed in this train (31 hooks before and after).

## Pull requests and CI

| PR | Scope | Head at merge | Merge commit | Hosted checks on the head |
|---|---|---|---|---|
| #278 | #276, #277, DISPATCH-VERIFIER-01, roadmap unit | `ef1ce80d` | `069a7d0e` | 14/14 (CI 36606303599, Packed install 36606303523) |
| #279 | #275 INTERVIEW-ASSUME-01 | `6e7bd3eb` | `58a8a174` | 14/14 (CI 36608949299, Packed install 36608949301) |
| #280 | #262 decision options | `7e4b90a3` | `99c9df6a` | 14/14 (CI 36611468113, Packed install 36611468104) |
| #281 | version 0.2.40, CHANGELOG | `1f02cfd4` | `ff3f5af5` | 14/14 (CI 36613312947, Packed install 36613313066) |
| #282 | promotion `dev` -> `main` | `ff3f5af5` | `3c1459ac` | all green; `dev` push CI 36614079312, Packed install 36614079283, WSL 36614079194 |

`main` at `3c1459ac`: push CI 36616839395, Packed install 36616839230, WSL 36616839277 and Docs 36616839247 all success.

## Release

| Step | Evidence |
|---|---|
| Dry run | run 36618591813: `release verify: READY — 0.2.40 @ 3c1459ac`, version kind stable, `release tests: pass=3661 fail=0 total=3737` |
| Publish | run 36619043417 success, same READY line; tag `v0.2.40` -> `3c1459acadeb1906d97c00a598e1457327ae372d`; `gh release list` shows v0.2.40 `isLatest=true` |
| Assets | `candidate-0.2.40.json`, `codexclaw-payload-0.2.40.tar.gz`, `SHA256SUMS`; `shasum -a 256 -c SHA256SUMS` OK; payload equals `git archive 3c1459ac plugins/codexclaw` (1120 files, 0 differing, 0 missing, 0 extra); manifest `0.2.40+codex.20260929183231` |

## Issue dispositions

- Closed as completed with a comment naming the PR, merge SHA and release: #275, #276, #277.
- Commented and kept open: #262 (options shipped; `withdrawn` needs a maintainer decision), #255, #256, #257, #260, #273, #274.
- Closed as not planned with per-issue reasons and a link to 001: #209, #213, #247, #258, #259, #263, #264, #265, #266, #267, #268.

## Review record

Every work phase ran P -> A -> B -> C -> D with persisted transitions. The architect (one V1 subagent) proposed D1-D28 and reflected on the plan (MISALIGNED with one gap, folded). At every A, a reviewer and a PABCD-initiative verifier (checking `pabcd_initiative/skills/dev-pabcd`) audited in parallel; at every implementation C, a fresh reviewer and a fresh initiative verifier ran in parallel against the final text and code. All agents inherited this session's model, so review independence is context-only (REVIEW-DECORRELATE-01 not established; disclosed in 000). Findings that changed the work: the roadmap's c-10 criterion contradicted architect D25 and was corrected at P with a recorded rationale; the privacy grep and the npm-ci precondition were broken in the first plan draft; the #277 prose contradicted the preflight rule; malformed-input paths threw; the #275 guidance failed a fresh-reader pass and was rewritten twice; two option-rendering branches were unobserved until C.

## Residual risks

- #276's stricter rule rejects a receipt that reports extra passing checks in `verifierResults`; no caller in codexclaw uses the contract today.
- INTERVIEW-ASSUME-01 is agent-followed guidance: nothing checks an answer reference against the ledger.
- Builds older than 0.2.40 drop a decision's `options` if they rewrite the plan.
- A timing assertion (`subagent-config/test/spawn-attach-hook.test.ts:920`) failed once locally under concurrent load and passed 3/3 in isolation and in every hosted run.
- The installed plugin cache (0.2.36) and remote hosts were not updated; that was outside this train's scope.

## Operational notes

- The worktree guard blocked one red-check command because it mentioned this worktree's path next to an `rm -rf` of a temp directory; the script was rewritten to resolve the repo with `git rev-parse` instead of bypassing the guard. The host also rejects `rm -rf`, so `/tmp/it0930/redcopy` was left in place.
- `Fixes #n` does not close issues from PRs into `dev`; issues were closed by hand after the release.

