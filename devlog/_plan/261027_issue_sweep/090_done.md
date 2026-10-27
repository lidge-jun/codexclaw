# 090 — issue_sweep: Done

Five open issues are closed and the removed `preview` branch no longer appears in CI. PR #325 merged into dev on 2026-10-27 (merge commit fea3eeaa; all 14 checks passed on head 8b1c7ed3). PR CI now tolerates a lagging tests badge, the full suite is green on macOS with Node 22 and Node 26, and the Audit phase has three new rules. `main` stays as the release and install channel.

## What changed for whom

- **Contributors** no longer need a badge-bump commit when a PR adds tests. CI prints the exact `inventory.mjs --write --tests N` command as a notice, and only a badge that overstates fails (#301). #325's own ubuntu lane showed "published tests=3869 lags the measured suite total 3879" and passed. Releases still require the exact number.
- **Mac and worktree users** get a green full local suite. Two prompt byte budgets (l1-injections, worktree-guard) no longer count the machine-specific root (#297). Six tests that await `unref()`'d timers hold the event loop under Node 22 (#296).
- **PABCD users**: phase-audit.md adds AUDIT-REAUDIT-SCOPE-01, REBUTTAL-BASIS-01 and AUDIT-REVIEWER-ROLE-01. Same-reviewer reuse stays the default (#294, partly adopted; the reasons for each rejected item are in the issue comment).
- #313 was already fixed by #307/#319 and was closed with a comment.

## What did not improve, and what died

- Hypothesis that died: "#296 is not reproducible." Main's first Node 22 run actually ran Node 26, because `npm` on this machine is the Vite+ launcher, which ignores a node binary prepended to PATH. Audit round 1 caught this with a direct Node 22 run (8 cancelled). Lesson: a version-specific claim needs `node -p process.version` from the same process that ran the suite.
- The issue's gui router file-level failure did not reproduce on current dev under either version, so nothing was changed for it.
- Not addressed: CI runs only Node 24, so a Node 22 regression would again surface only locally. A Node 22 lane would cost one more CI leg. If it recurs, that is the direction to take.
- What would refute the #296 fix: a Node 22 full run that cancels any test awaiting an unref'd timer outside the six covered tests. The final reviewer's search found none currently exercised.

## Process record

- Architect (gpt-6.1-sol): D1–D7 proposal, reflection MISALIGNED ×4, all folded (000 §Architect consultation, 010 §Reflection).
- Audit: round 1 FAIL (2 High), synthesized in 000 §Audit synthesis; round 2, same reviewer, PASS. Final C review by a fresh reviewer: GO-WITH-FIXES with 0 blockers; its 2 Low findings were folded in 8b1c7ed3.

## Evidence

- Full suite, Node 26.12.1, `cxc receipt test -- npm test` at 8b1c7ed3: tests 3879, pass 3873, fail 0, cancelled 0, skipped 6.
- Full suite, Node 22.22.0 direct executable at 72bd28cd: tests 3879, pass 3873, fail 0, cancelled 0. Before the fix, the three #296 files alone gave 34 tests, 8 cancelled.
- `inventory.mjs --check` and `gate.mjs`: exit 0. release-gate.test.ts: 38/38.
- Hosted CI on 8b1c7ed3: 14/14 pass; floor notice present as a check annotation.
- Goalplan `codexclaw-issue-sweep-lidge-jun-codexclaw-hotl-v`: `cxc loop validate` OK, c-1..c-6 met.
