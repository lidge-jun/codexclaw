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
4. MODIFY `.github/workflows/ci.yml`: trigger on push/PR for `[main, dev]`
   (verify current triggers first; amend minimally).
5. NEW (optional, if CI edit is in scope): `enforce-pr-target.yml` port from
   opencodex with EXPECTED_BASE=dev — decide at P-recheck; default IN, it is
   16 lines of yml and completes the convention.
6. Contributor pointer: README "Contributing" one-liner — PRs target `dev`.
   (Lands with WP2 if convenient, else here.)
7. Verify: `git branch -r` shows origin/dev; GitHub CI green on both
   branches (poll `gh run list --branch dev --limit 1`).

## Accept criteria

- origin/main up to date; origin/dev exists with CI configured (CR-D, CR-E).
- Final release-readiness note in D summary: what a v0.1.0 tag still needs
  (from 260723 unit: gui/dist decision D1, CHANGELOG D3).
