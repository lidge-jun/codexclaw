# 030 — WP3: push main + create `dev` integration branch + release readiness

Depends on WP1+WP2 committed locally. Push to origin/main is user-approved
("다하고 푸시한 이후"); `dev` branch creation is explicitly requested
("../opencodex 처럼 preview dev 브랜치 만들어 놓고").

## opencodex convention (verified live 2026-07-24, Sol explorer)

- `dev` = integration branch, sole PR target (enforce-pr-target.yml,
  EXPECTED_BASE=dev); `main` = release branch, maintainer promotions only;
  `preview` = prerelease train tied to npm `@preview` dist-tag.
- codexclaw has no npm artifact yet → replicate `dev` now; skip `preview`
  until a versioned release train exists (record as deferred decision D7).

## Steps (exact commands)

1. Preflight: `git status --short` (only intended changes; leave
   `devlog/_plan/260722_260722-repo-governance-config/` untracked),
   `npm test` tail green, `node plugins/codexclaw/scripts/gate.mjs` exit 0.
2. `git push origin main` (fast-forward only; if remote moved, fetch+rebase
   first per maintainer-merge discipline).
3. `git branch dev main && git push -u origin dev`.
4. MODIFY `.github/workflows/ci.yml`: push `branches: [main]` → `[main, dev]`
   (line 5; pull_request already unfiltered so dev-target PRs run CI as-is).
   `docs.yml` stays main-only ON PURPOSE (Pages deploy — opencodex parity);
   do not add dev there.
5. NEW `enforce-pr-target.yml` port from opencodex (A-round corrected: 278
   lines, not 16 — an inline github-script program; SHA-pinned action, minimal
   `pull-requests: write` permission, EXPECTED_BASE already "dev"). One
   codexclaw edit required: replace the hardcoded opencodex contributing URL
   (their line 198) with the codexclaw docs/README §Contributing link.
6. Contributor pointer: DONE in WP2 (README.md §Contributing, all 3 langs).
7. Verify: `git branch -r` shows origin/dev; GitHub CI green on both
   branches (poll `gh run list --branch dev --limit 1`).

## Accept criteria

- origin/main up to date; origin/dev exists with CI configured (CR-D, CR-E).
- Final release-readiness note in D summary, reframed for v0.1.1 (A-round:
  a v0.1.0 tag ALREADY exists on origin at c266bb06): what a v0.1.1 tag
  still needs — user decisions D1 (gui/dist) and D3 (CHANGELOG.md, now
  past-due since v0.1.0 tagged without one); tag creation stays a user call.
