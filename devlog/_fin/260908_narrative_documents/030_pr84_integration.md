# wp4 — Integrate PR #84 worktree source binding (diff-level)

Depends on wp1. Class C3 (runtime component change authored by a contributor;
review, do not rewrite). Verifier: `node --test --test-concurrency=1
'plugins/codexclaw/components/pabcd-state/test/*.test.ts'
'plugins/codexclaw/components/subagent-config/test/*.test.ts'
'plugins/codexclaw/test/*.test.mjs'` on the merged head (reads every changed test),
plus exact-head GitHub CI on the PR after retarget/update.

## Observed state (2026-09-08)

- PR #84 head 57e63fdc (thisisjun786:fix/worktree-source-binding), base dev,
  merge-base d8117010, state CONFLICTING, maintainerCanModify=true (checked at A).
- Trial merge of origin/dev 50b7309c + pr84 in /tmp/pr84-merge-260908: the only
  conflict is CHANGELOG.md (0.2.23 section vs the PR's Unreleased section).
  Resolution keeps both with the PR's Unreleased above 0.2.23. The pre-existing empty
  `## [Unreleased]` below 0.2.19 is left untouched here and removed in wp5 (040).
  43 files, +1092/−103.
- Component test run on the merged tree: see 002_verifiers.md (recorded at wp1 C).

## Procedure at B

1. Create integration branch `codex/pr84-integration` from origin/dev; `git merge
   pr84 --no-ff`; resolve CHANGELOG.md exactly as in the trial; preserve the
   contributor's commits and authorship (merge, not squash; no rewrite of their
   history). Commit message: "Merge PR #84 worktree source binding into dev".
2. Run the verifier; if a test fails, fix forward in a separate commit in the
   integration branch with a clear message, keeping the contributor's commits intact.
3. Decided at A: maintainerCanModify is true, so push the merge commit to the
   contributor's head branch (thisisjun786:fix/worktree-source-binding) so PR #84
   itself becomes mergeable; wait for exact-head CI/packed/WSL on #84; merge #84 with
   a merge commit. Fallback only if the push to the fork is refused: open
   `codex/pr84-integration` to dev crediting #84, merge it, then close #84 with a
   comment linking the merged PR.
4. Refusal path: if the merged tests fail for a reason inside PR #84's own change
   that cannot be fixed forward in one bounded commit, record the failing output
   in evidence/wp4/ and leave #84 open with a review comment; criterion c-4 then
   closes as "justified refusal recorded".

## Files touched by this work-phase (beyond PR #84's own diff)

- CHANGELOG.md — conflict resolution only.
- devlog/_plan/260908_narrative_documents/evidence/wp4/ — test logs, CI run ids.

## Acceptance (either branch closes c-4)

- Merge branch: merged head tests 0 fail; CI green at exact head; #84 merged (or
  closed with the integration PR link); evidence/wp4/ holds the test log and run ids.
- Refusal branch (activation: a failing test whose cause is inside PR #84's own diff
  and is not fixable in one bounded commit): evidence/wp4/refusal.md holds the failing
  output, the diagnosis, and the review comment URL left on #84; #84 stays open. c-4
  is then met as "justified refusal recorded".

