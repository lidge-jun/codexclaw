# 260707 release readiness — WP2 plan (public flip + Pages + remote CI)

Class: C4 (release surface, irreversible-ish visibility flip). Archetype:
spec-satisfaction. Verifier: gh repo view visibility=PUBLIC; gh run list green
for CI + Deploy Docs; curl -sI Pages URL = 200; git status ahead 0.

## Runbook (ordered — A-phase fold-back applied: flip/Pages BEFORE push so the
## first docs.yml run lands on an enabled Pages site; test env-gate edit
## explicitly assigned to the ci: commit)

1. Commit WP1 changes as atomic commits on main:
   - `chore(release): LICENSE (MIT + third-party notices) + README public pass`
   - `ci: test+gate workflow, docs-site Pages deploy, repo-map smoke env gate`
     (includes `plugins/codexclaw/test/repo-map-smoke.test.mjs`)
   - `docs(devlog): 260707_release_readiness WP1 plan + research capture`
2. Pre-push gate: `npm test` + `gate.mjs` fresh (done in WP1 C: 801/0, OK).
3. Flip FIRST: `gh repo edit lidge-jun/codexclaw --visibility public
   --accept-visibility-change-consequences` (origin state is 28-behind but
   history is gitleaks-clean per WP1 cr1 — safe to expose pre-push).
4. Enable Pages workflow source: `gh api --method POST
   /repos/lidge-jun/codexclaw/pages -F build_type=workflow` (PUT if exists).
   Free-plan constraint: this MUST follow the public flip (private+Free has no
   Pages).
5. `git push origin main` (ahead 28+3) — this push fires both ci.yml and
   docs.yml (paths filter matched by docs.yml itself + docs-site commits).
6. Watch runs: `gh run list`, `gh run watch <id>`; `gh workflow run docs.yml`
   only if a race still reds the first docs run (criterion 3 applies to the
   LATEST runs, not the first attempt).
7. Verify `curl -sI https://lidge-jun.github.io/codexclaw/` -> 200 and CI green.
8. Repo metadata polish: `gh repo edit` description + homepage (docs URL).

## Risks / rollback

- Visibility flip is reversible (`--visibility private`) but stars/watches
  reset and caches may persist — treated as one-way for planning.
- Secret exposure risk retired by WP1 cr1 evidence (no tracked/history leaks).
- CI red on ubuntu: LOOP-REPAIR-01 — max 2 same-failure repairs, then RCA mode.
- Pages 404 right after deploy: propagation wait up to ~10 min before treating
  as failure.

## Accept criteria

1. `gh repo view --json visibility` == PUBLIC.
2. `git rev-list origin/main..main --count` == 0.
3. ci.yml + docs.yml runs conclude success on origin.
4. Pages URL returns HTTP 200 (activation scenario for docs.yml: the push that
   contains docs.yml itself touches `.github/workflows/docs.yml`, so the
   workflow fires on this push; ci.yml fires on any main push).
