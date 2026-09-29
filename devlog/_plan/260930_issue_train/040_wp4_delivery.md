# 040 — wp4: delivery, issue disposition, main promotion and release 0.2.40

This phase lands nothing new in product code. It gets each implementation phase into `dev` through an ordinary PR with hosted CI read on the exact head, dispositions every open issue per `001_research.md`, bumps the version to 0.2.40, promotes `dev` to `main`, and publishes v0.2.40 through `release.yml` with verified assets. It reuses the 0.2.39 train (`../260924_issue_sweep_0238/070_release_0239.md`, `071_delivery.md`) with fresh evidence at every step.

## Per implementation phase (wp2, wp3, wp5)

1. Branch: wp2 is `codex/issue-train-0930-wp2`, cut from this session's `codex/issue-train-0930` (= `origin/dev` `659de59b` plus this unit's docs). wp3 and wp5 branch from the latest `origin/dev` after the previous PR merges; if the previous PR is still in CI, branch from its phase branch and retarget to `dev` after it merges (the 0927 train's amendment).
2. Local gates at the phase C: `npm run build`; focused tests through `cxc receipt test`; `npm test` (record the TAP total); `node plugins/codexclaw/scripts/inventory.mjs --write --tests <total>` then `--check --tests <total>`; `node plugins/codexclaw/scripts/gate.mjs`; `node plugins/codexclaw/scripts/platform-smoke.mjs`; `git diff --stat origin/dev -- plugins/codexclaw/hooks plugins/codexclaw/.codex-plugin` shows no hook registration change (criterion c-5).
3. Privacy self-check before the first push (DEV-PRIVACY-01): grep the push range for tokens, client names and home paths other than this user's own (`git log -p origin/dev..HEAD | rg -i 'ghp_|sk-|token=|/Users/(?!jun)'`).
4. `git push -u origin <branch>`; `gh pr create --base dev --body-file <tmp>` (problem, behavior before/after, tests, residual risk, `Fixes #276` / `Fixes #277` / `Fixes #275` for fully fixed issues; #262 is referenced without `Fixes`).
5. Hosted CI (DEV-CI-EVIDENCE-01): `gh pr view <n> --json headRefOid,statusCheckRollup`, `gh run list --commit <head> --json databaseId,event,headSha,status,conclusion,workflowName`; confirm the ci.yml jobs (ubuntu, macOS, Windows shards, packed install, artifacts), labeler and target check ran on that head, distinguishing pending, skipped, cancelled and failed. Diagnose a failure from its job log before any rerun.
6. Merge with a merge commit (same method as #269-#272) using `gh pr merge <n> --merge --match-head-commit <head>`.

## Issue disposition (after the implementation PRs merge)

- #275, #276, #277 close through `Fixes`; verify each shows closed with the PR link.
- #262: comment naming the wp5 PR (`options[]` and recommendation membership shipped; answers stay free text by design; `withdrawn` still needs a maintainer decision); stays open.
- Close as not planned with the one-line reason from 001 and a link to `devlog/_plan/260930_issue_train/001_research.md` on `dev`: #209, #247, #258, #259, #263, #264, #266, #267, #268.
- Close as completed with the reason and evidence anchors: #213 (plugin scope), #265.
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

