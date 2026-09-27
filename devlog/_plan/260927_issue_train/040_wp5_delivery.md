# wp5 — Delivery and issue disposition



## Amendment 2026-09-28: CI queue as an external wait

At wp2's C, PR #269's hosted CI sat queued because the account's Actions concurrency was held by another repository (lidge-jun/opencodex: 81 queued, 5 in progress at 16:30 UTC). Cancelling another repository's runs is outside this train's authority. The per-phase "CI, merge" step therefore moves to wp5 as an external wait: each implementation phase closes at D once its PR is open with local gates green, the next phase branches from the previous phase branch, and wp5 verifies hosted CI on every PR head, merges them into dev in order (retargeting each later PR to dev after its predecessor merges), and only then meets criterion c-7.
This phase lands nothing new; it proves the merged state and records the issue decisions.

## Per implementation phase (wp2, wp3, wp4)

1. Branch `codex/issue-train-wpN` from current `origin/dev` (wp2 starts from this session's `codex/issue-train-0927`, which equals `origin/dev` 958441a9 plus this unit's docs).
2. Local gates at the phase C: `npm run build`, focused tests through `cxc receipt test`, `npm test` (record the TAP total), `node plugins/codexclaw/scripts/inventory.mjs --check --tests <total>`, `node plugins/codexclaw/scripts/gate.mjs`, `node plugins/codexclaw/scripts/platform-smoke.mjs`.
3. Privacy self-check before first push (DEV-PRIVACY-01): grep the push range for client names, personal paths beyond this user's own home, tokens.
4. `git push -u origin codex/issue-train-wpN`; `gh pr create --base dev` with a body file (problem, behavior before/after, tests, residual risk, `Fixes #n` only for issues fixed in that PR).
5. Hosted CI: confirm ci.yml jobs actually ran against the PR head SHA (`gh pr view --json headRefOid,statusCheckRollup`, `gh run list --commit <sha>`), distinguishing pending, skipped, cancelled and failed.
6. Merge with the repository's usual method for dev PRs (squash, matching #245-#249), then rebase the next phase branch onto the new `origin/dev`.

## Issue disposition

- Fixed issues close automatically through `Fixes #n`; verify each closed.
- Deferred issues get one comment linking `devlog/_plan/260927_issue_train/001_research.md` on dev and the reason line from the table; they stay open.
- #261 gets the decline reason and is closed as not planned.
- #265 gets a comment linking the guidance PR; it stays open for the deferred CLI.

## Acceptance

All goalplan criteria met with captured evidence; `cxc loop validate` passes; `origin/dev` contains the three merge commits; no PR into `main` was opened by this unit.


## wp5 executable plan (2026-09-28)

State at entry: PR #269 (wp2) merged as b558d84e and PR #270 (wp3) merged as c550d78e, both after all 13 checks passed on their heads; PR #271 (wp4) open at the codex/issue-train-wp4 head.

1. Wait for PR #271's hosted CI on its head SHA; merge with a merge commit (same method as #269 and #270, so later branches stay clean) using `--match-head-commit`.
2. Close the fixed issues with a comment that names the merged PR: #250, #251, #253 and #252, #254 (implemented) through #269; #262 through #271. #255 gets a comment that the `.gitignore` half shipped in #269 and lazy session-state creation is deferred (reason in 001), and it stays open.
3. Comment on each deferred issue (#209, #213, #247, #256, #257, #258, #259, #260, #263, #264, #266, #267, #268) with the one-line reason from 001 and a link to `devlog/_plan/260927_issue_train/001_research.md` on dev; they stay open. #261 gets the decline reason and is closed as not planned. #265 gets a comment linking the guidance in #270 and stays open for the deferred CLI.
4. Write `041_delivery.md` (PRs, merge commits, CI run evidence, issue dispositions, residual risks, the plugin-cache and log observations) and deliver it through a small docs PR to dev (CI, merge).
5. Verify: every closed issue shows the closing comment; `origin/dev` contains the four merge commits; `cxc loop validate` passes.

No architect consultation: this phase makes no design decisions (cxc-dev §0.1 fast path for ops and docs); the independent A review covers the disposition list.
