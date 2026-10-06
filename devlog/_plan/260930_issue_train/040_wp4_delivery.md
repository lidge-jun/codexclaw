# 040 — wp4: delivery, issue disposition, main promotion and release 0.2.40

This phase lands nothing new in product code. It gets each implementation phase into `dev` through an ordinary PR with hosted CI read on the exact head, dispositions every open issue per `001_research.md`, bumps the version to 0.2.40, promotes `dev` to `main`, and publishes v0.2.40 through `release.yml` with verified assets. It reuses the 0.2.39 train (`../260924_issue_sweep_0238/070_release_0239.md`, `071_delivery.md`) with fresh evidence at every step.

## Per implementation phase (wp2, wp3, wp5)

1. Branch: wp2 is `codex/issue-train-0930-wp2`, cut from this session's `codex/issue-train-0930` (= `origin/dev` `659de59b` plus this unit's docs). wp3 and wp5 branch from the latest `origin/dev` after the previous PR merges; if the previous PR is still in CI, branch from its phase branch and retarget to `dev` after it merges (the 0927 train's amendment).
2. Local gates at the phase C, after `npm ci` (without installed dependencies `gui/test/router.test.ts` fails on `react` and the TAP total drops by one; A round 1 measured 3707 against the published 3708): `npm run build`; focused tests through `cxc receipt test`; `npm test` (record the TAP total only from a run with 0 failures); `node plugins/codexclaw/scripts/inventory.mjs --write --tests <total>` then `--check --tests <total>`; `node plugins/codexclaw/scripts/gate.mjs`; `node plugins/codexclaw/scripts/platform-smoke.mjs`. Criterion c-5: `git diff --stat origin/dev -- plugins/codexclaw/hooks plugins/codexclaw/.codex-plugin plugins/codexclaw/components/pabcd-state/src/hook.ts` is empty and `node plugins/codexclaw/scripts/inventory.mjs --published` still reports 31 hooks.
3. Privacy self-check before the first push (DEV-PRIVACY-01): `git log -p origin/dev..HEAD -- . ':(exclude)devlog/_plan/260930_issue_train/040_wp4_delivery.md' | rg -P -i 'ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|token=[A-Za-z0-9]|/Users/(?!jun/)'` must exit 1 (no match). The exclusion keeps this command's own text from matching. On 2026-09-30 at `048a521c` the unexcluded form matched only this line.
4. `git push -u origin <branch>`; `gh pr create --base dev --body-file <tmp>` (problem, behavior before/after, tests, residual risk, issue numbers). `Fixes #n` does not close issues from a PR into `dev` because the default branch is `main` (the 0927 train closed #250-#254 by hand); issues are closed manually after merge (below).
5. Hosted CI (DEV-CI-EVIDENCE-01): `gh pr view <n> --json headRefOid,statusCheckRollup`, `gh run list --commit <head> --json databaseId,event,headSha,status,conclusion,workflowName`; confirm the ci.yml jobs (ubuntu, macOS, Windows shards, artifacts), the `packed-install.yml` lifecycle, labeler and target check ran on that head, distinguishing pending, skipped, cancelled and failed. Diagnose a failure from its job log before any rerun.
6. Merge with a merge commit (same method as #269-#272) using `gh pr merge <n> --merge --match-head-commit <head>`.

## Issue disposition (after the implementation PRs merge)

- #275, #276, #277: close as completed with a comment naming the PR and its merge SHA; verify each shows closed.
- #262: comment naming the wp5 PR (`options[]` and recommendation membership shipped; answers stay free text by design; `withdrawn` still needs a maintainer decision); stays open.
- Close as not planned with the one-line reason from 001 and a link to `devlog/_plan/260930_issue_train/001_research.md` on `dev`: #209, #247, #258, #259, #263, #264, #266, #267, #268.
- Close as not planned with the reason and evidence anchors: #213 (the plugin's ownership gate shipped; the remaining atomic authorization is host scope) and #265 (checkpoint guidance shipped; the validator verb is declined).
- Comment and keep open: #255, #256, #257, #260, #273, #274.

## Release 0.2.40

1. Branch `codex/release-0240` from `origin/dev` after the implementation PRs merge.
2. Version files, found with `rg --hidden -l '0\.2\.39' --glob '!.git' --glob '!CHANGELOG.md' --glob '!devlog/**' --glob '!node_modules/**'`: `package.json`, `package-lock.json` (every `"version": "0.2.39"` owned by this repo's workspaces), `cli/package.json`, `plugins/codexclaw/gui/package.json`, `plugins/codexclaw/components/*/package.json` -> 0.2.40; `plugins/codexclaw/.codex-plugin/plugin.json` -> `0.2.40+codex.<UTC stamp>`; `inventory.json` and README badges regenerated with `inventory.mjs --write --tests <total>`. `pabcd-state/test/hook.test.ts` matches the pattern: inspect it and leave it unless it asserts the current package version.
3. CHANGELOG: rename `[Unreleased]` to `[0.2.40] - <date>` keeping the 0927 train entries, and add: Added — optional `verifierEffects` and `verifierPreflight` (#277), `verifierResults` on receipts (#276), goalplan decision `options` / `cxc loop ask --option` (#262), Interview assumption provenance guidance INTERVIEW-ASSUME-01 (#275). Fixed — `receiptSatisfiesPacket` requires a matching successful result per required verifier command (#276). Compatibility — a legacy single `verifierResult` for a different command, or one result for a multi-command packet, no longer satisfies; two hooks from the 0927 train need trust approval after upgrade.
4. Local gates as above plus `node plugins/codexclaw/scripts/check-versions.mjs 0.2.40` and `npm ls --workspaces --depth=0`; PR to `dev`, exact-head CI, merge; dev push CI, Packed install and WSL green at the merge SHA.
5. Promotion PR `dev` -> `main` titled "Release codexclaw 0.2.40"; exact-head CI; merge with a merge commit; main push CI and Packed install green at the merge SHA.
6. `gh workflow run release.yml -f version=0.2.40 -f prerelease=false -f dry_run=true -f expected_sha=<main sha>`; read `release verify: READY — 0.2.40` and the test totals. Then the same with `dry_run=false`.
7. Assets: `gh release download v0.2.40`; `shasum -a 256 -c SHA256SUMS`; unpack the payload and compare with `git archive <main sha> plugins/codexclaw` (0 differing, missing or extra files); tag `v0.2.40` points at the main merge SHA; release is stable and latest.

The installed plugin cache and remote hosts are not updated by this train (goal scope OUT).

## Delivery record

`041_delivery.md`: PRs, heads, merge commits, CI runs, release runs, asset verification, issue dispositions, residual risks. It lands on `dev` through a small docs PR, which then reaches `main` with the next promotion; that later promotion is outside this train.

## Acceptance

All goalplan criteria met with captured evidence; `cxc loop validate` passes; v0.2.40 is the latest release and its assets verify.

## wp4 P revalidation and executable amendment (2026-09-30)

Continuity (LOOP-CONTINUITY-01), quoting the wp5 D summary in 030: "the #262 options half is merged ... Next: wp4 delivers per 040." State at entry: `origin/dev` = `99c9df6a` with PRs #278 (`069a7d0e`), #279 (`58a8a174`), #280 (`99c9df6a`) merged after 14/14 checks on their heads; `main` = `8e6aa800` (v0.2.39); no v0.2.40 tag or release exists. Branch `codex/release-0240` from `99c9df6a`. No architect consultation: this phase makes no design decisions (the 0927 train's wp5 precedent); the A reviewers cover the steps.

Resource bounds (disclosed gap): the release is C4 and the initiative's loop-engineering rule asks for a token and wall-clock bound; the user authorized push, merge to `dev` and `main`, and release on 2026-09-30 without stating one, so none is invented. Stop conditions instead: any red check on an exact head, a release dry run that is not READY, or an asset mismatch halts delivery with the state reported.

### Version edits (re-verified with the `rg` in step 2 at `99c9df6a`)

`0.2.39` -> `0.2.40` in `package.json`, `cli/package.json`, `plugins/codexclaw/gui/package.json`, the nine `plugins/codexclaw/components/*/package.json`, and the 13 `"version": "0.2.39"` entries in `package-lock.json` (root and workspace entries). `plugins/codexclaw/.codex-plugin/plugin.json`: `"version": "0.2.40+codex.<UTC yyyymmddHHMMSS at commit>"`. `inventory.json` component versions and README badges via `inventory.mjs --write --tests 3737`. `pabcd-state/test/hook.test.ts:181` contains `0.2.39` only inside a fixture cache path; it stays.

### CHANGELOG diff

`## [Unreleased]` becomes `## [0.2.40] - 2026-09-30`, a fresh empty `## [Unreleased]` goes above it, and these lines join the existing sections:

- Added: "Dispatch packets can declare each verifier's write effects (`verifierEffects`), and a pure `verifierPreflight(packet)` reports which verifiers need an isolated copy: under a shared-read packet only a verifier declared read-only runs in the shared tree. Nothing executes a command (#277)."
- Added: "Interview assumptions carry their source, confidence, consequence if wrong and a status (`proposed`, `open`, `user_confirmed`, `user_rejected`); confirmed and rejected entries need an answer reference, and the plan keeps open assumptions apart from confirmed requirements and rejected ones (INTERVIEW-ASSUME-01, guidance only, #275)."
- Changed (extend the existing #262 bullet): "`cxc loop ask` also takes a repeatable `--option <text>`; when options are given the recommendation must be one of them, the answer stays free text, and `ready --json` and `show` list them. Builds older than 0.2.40 drop `options` if they rewrite such a plan."
- Fixed: "A dispatch receipt satisfies its packet only when every required verifier command has a matching result with exit 0 and, when commands are required, no result names another command. Receipts can report `verifierResults[]`; a single legacy `verifierResult` for a multi-command packet reports incomplete. `validateReceipt` now checks the result shapes and `validatePacket` rejects blank or non-string verifier commands; a receipt whose one result names a different command, even cosmetically, no longer satisfies (#276)."

### Issue comments (wording)

- #276, #277, #275: "Fixed in #278/#279 (merged into `dev` as <sha>) and released in v0.2.40." closed as completed.
- #262: "Options shipped in #280 (`ask --option`, recommendation must be one of them, answers stay free text). `withdrawn` still needs a decision on how a withdrawn question releases its linked phases, so this stays open."
- Not planned (#209, #213, #247, #258, #259, #263, #264, #265, #266, #267, #268): the reason line from 001 and "Closing as not planned in the 2026-09-30 issue train: codexclaw is keeping its hook surface small, and this needs <a new hook | a host signal the plugin cannot observe | nothing further on the plugin side>." plus the link to 001 on `dev`.
- Kept open (#255, #256, #257, #260, #273, #274): the reason line from 001 and the link.

Order: issue comments and closes run after the release so "released in v0.2.40" is true.

## A review record

Plan audit (A) at P->A: reviewer `01a0ee1f-b88c-73d0-ae1a-c526f311d2c2` and PABCD-initiative verifier `01a0ee1f-b983-7e61-b27e-c9eeeeada686` in parallel (the same pair as wp1, reused per DISPATCH-ACTOR-01). Round 1: both PASS; nits (per-issue not-planned reasons for #209/#213/#265, per-PR fix comments, leftover-version `rg`, full `expected_sha` with `--ref main`, known-flake policy, CHANGELOG Compatibility and Verification headings, a working latest check, one clock for date and stamp) folded in B.

## wp4 C record (2026-09-30)

Gates on the release tree: local `/tmp/it0930/c-gate.sh` on `1f02cfd4` before the PR (3737 tests, 0 failures, inventory, gate, smoke; its c-5 line was narrowed there because `plugin.json`'s version bump sits under `.codex-plugin`: hook files and `hook.ts` must have no diff, the manifest may change only its `version` line, and 31 hooks must stay published), `check-versions.mjs 0.2.40` OK, leftover `0.2.39` only in the `hook.test.ts:181` fixture path, and the same gate under `cxc receipt test` on `0ff1ae01` (exit 0). Hosted: #281 14/14 on `1f02cfd4`; `dev` push runs on `ff3f5af5`; #282 28/28 on `ff3f5af5` (including its own `pull_request` CI 36615865372 and Packed install 36615865506); `main` push CI, Packed install, WSL and Docs on `3c1459ac`; release dry run 36618591813 and publish 36619043417 both `READY — 0.2.40` with `pass=3661 fail=0 total=3737` (the 76 unlisted tests are platform skips, as in 0.2.39's 3533/3609); assets verified twice (main and the release reviewer's fresh download).

C lanes in parallel: release reviewer `01a0eea5-aa63-7ab3-b773-2b5c86144e0b` PASS (every release, CI, asset, issue and CHANGELOG claim re-checked against GitHub); PABCD-initiative verifier `01a0eea5-aba9-74e1-a829-ada290c75c65` GO-WITH-FIXES (5, all loop records: this C record, criteria c-5 to c-9, A-round IDs in the decade docs, the wp4 D summary, and 041's wording before #283 lands), folded in this commit. Deviations from the plan: the CHANGELOG heading is dated 2026-09-29 (UTC, matching the build stamp and publish time) instead of 2026-09-30; issue comments link 001 on `main` (identical blob on `dev`).

## wp4 D summary (2026-09-30)

Conclusion: codexclaw 0.2.40 is released from `main` `3c1459ac` with verified assets, all 21 open issues are dispositioned, and the delivery record lands through #283. No next work phase: every goalplan phase is done after this cycle.

What did not go well: the c-5 gate line was written for implementation phases and flagged the release's own version bump, so it had to be narrowed at B; the first issue-comment template gave three issues the wrong reason until A caught it; the loop's review evidence lived in ledger attests rather than the decade docs until the final verifier asked for it. The hypothesis that died: that a train-wide gate script could be reused unchanged for the release phase. Evidence that the delivery direction is wrong: users hit the stricter #276 receipt rule or the dropped `options` on an older build, which would show up as issues against 0.2.40.
