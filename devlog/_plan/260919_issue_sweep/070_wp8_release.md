# 070 — wp8: promotion and release

## Preconditions

1. wp2-wp7 merged into `dev`, each with its own green PR checks captured fresh via
   `gh pr checks <n>`.
2. `CODEXCLAW_SKIP_REPOMAP_SMOKE=1 npm test` and `npm run gate` green on the final `dev`
   tree, with output captured rather than remembered. Baseline for comparison:
   3149 tests / 3144 pass / 1 fail / 4 skipped before `npm ci`, and the single failure was
   the missing-`react` install artifact described in `001`.
3. `dev` deletion protection verified active per `010`, before the promotion PR is merged.

## Steps

1. **MODIFY** `package.json` — bump `version` from `0.2.28` to the next patch version.
2. **MODIFY** `CHANGELOG.md` — one section for this release listing the landed clusters by
   issue number. The repository already has `.github/scripts/changelog-section.test.cjs`
   covering section shape, so the format is constrained, not free.
3. Commit as `chore(release): prepare codexclaw <version>`, matching the existing
   convention at `ca326d9e`.
4. Open the promotion PR `dev -> main`. `enforce-pr-target.yml:25,188` exempts this
   same-repository promotion, so it is the sanctioned path.
5. Merge once checks are green, then immediately re-read
   `gh api repos/lidge-jun/codexclaw/branches/dev --jq '{name,protected}'` to confirm
   `dev` survived. This is the live test of `010`.
6. Observe the release workflow: `gh run list --workflow release.yml` then
   `gh run view <id>`. `release.yml:278` publishes the release assets. The deploy claim
   requires that run's own conclusion, not the merge's.

## Issue closure

Each issue closes referencing the PR that landed it. Issues whose verdict was
PARTIALLY-REAL close with the part that was fixed and the part that was not — #188's
context-window recovery, #191's route-aware bypass, #193's desktop-wrapper half and #186's
execution evidence all have recorded remainders. Closing them as fully resolved would be
the failure mode this unit exists to avoid.

## Rollback

The release is additive: a version bump, a changelog section and a merge commit. If the
release run fails, `main` is already promoted, so recovery is a follow-up patch release
rather than a revert of the promotion. Do not force-push `main`.
