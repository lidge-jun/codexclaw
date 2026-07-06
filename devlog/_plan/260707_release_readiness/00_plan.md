# 260707 release readiness — WP1 plan (pre-public hygiene)

Goal (HOTL, session 019f3901-f128-7b50-bea8-60df7c2876c1, goalplan slug
`codexclaw-release-readiness-secret-scan-history`): make lidge-jun/codexclaw
release-ready — public repo, CI gates, Pages docs, marketplace submission prep.

## Loop-spec header

- **Loop archetype**: spec-satisfaction repair (verifier defines done).
- **Trigger**: user request 2026-07-07 — "배포 준비 상태로 만들어놔".
- **Goal**: public GitHub repo with green CI, live GitHub Pages docs, LICENSE,
  public-grade README, marketplace-ready plugin metadata + submission checklist.
- **Non-goals (OUT)**: component feature changes, skill doctrine changes, GUI
  features, docs-site redesign. Only metadata/docs/CI/visibility work.
- **Verifier**: `npm test` (798+ pass), `node plugins/codexclaw/scripts/gate.mjs`,
  `(cd docs-site && npm run build)` exit 0, `gh repo view --json visibility`,
  `gh run list` green, `curl -sI https://lidge-jun.github.io/codexclaw/` 200.
- **Stop condition**: all goalplan criteria cr1-cr6 met, or terminal outcome
  BLOCKED/NEEDS_HUMAN/BUDGET_EXHAUSTED per goal text.
- **Memory artifact**: this devlog dir + goalplan ledger
  `.codexclaw/goalplans/codexclaw-release-readiness-secret-scan-history/`.
- **Expected terminal outcomes**: DONE; NEEDS_HUMAN only if history rewrite
  needed (secret found in tracked history — already ruled out, see below).
- **Escalation condition**: real credential in tracked git history, GitHub API
  permission failure on visibility flip, or Pages build persistently red after
  LOOP-REPAIR-01 budget (2 repairs same failure -> root-cause; 3 -> replan).
- **HOTL resource bounds**: local shell + gh CLI + web_search + multi_agent
  research explorers (read-only); write scope = this repo + its GitHub remote;
  wall-clock = this session.

## Class

C4 (release surface, public contract) per DEV-ESCALATE-01 — release/publish
promotes the affected slice. Full PABCD per work-phase.

## Evidence so far (C-grade, fresh)

- `gitleaks git .` → "346 commits scanned … no leaks found"
  (`.codexclaw/evidence/release_readiness/gitleaks_history.json`, empty).
- `gitleaks dir .` → 1045 findings, ALL in gitignored/untracked paths:
  1037 `.codexclaw/` (session state), 5 `devlog/.lazycodex` +
  `devlog/_plan/260630_ouroboros…/.ouroboros` (reference clones, gitignored,
  test fixtures with dummy keys), 3 `plugins/codexclaw/.codexclaw/friction.jsonl`
  (gitignored). `git check-ignore -v` confirms each path; `git ls-files` shows
  none tracked. → No tracked secret; public flip is safe from this angle.
- `npm test` → 798 pass / 0 fail (fresh run 2026-07-07).
- `node plugins/codexclaw/scripts/gate.mjs` → OK.
- Repo currently PRIVATE (`gh repo view` 2026-07-07), local main ahead 28.

## WP1 file change map

| Path | Change |
|---|---|
| `LICENSE` | NEW — MIT, copyright lidge-jun. package.json + plugin.json already say MIT. |
| `README.md` | EDIT — add docs-site link (https://lidge-jun.github.io/codexclaw/), CI badge, license badge, quickstart install block already present; keep layout/status sections. |
| `.github/workflows/ci.yml` | NEW — push/PR to main: setup-node (node 24, npm cache), `npm ci`, `npm test`, `node plugins/codexclaw/scripts/gate.mjs`. |
| `.github/workflows/docs.yml` | NEW — push to main (docs-site/** + workflow path filter … plus manual dispatch): build Astro in docs-site, upload-pages-artifact, deploy-pages with `pages: write`/`id-token: write` permissions, environment github-pages. |
| `devlog/_plan/260707_release_readiness/00_plan.md` | NEW — this doc. |

Version pins for actions to be confirmed against research explorer output
(Bernoulli) before commit; fall back to checkout@v4/v5, setup-node@v4/v5,
configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4 as verified.

## Accept criteria (testable)

1. `ls LICENSE` exists and mentions MIT + lidge-jun AND carries the
   third-party notices pointer (RepoMapper MIT, Aider Apache-2.0); matches
   manifests.
2. README renders with working docs link + badges (link targets checked
   post-flip in WP2; badge URLs syntactically correct now).
3. `actionlint` (if available) or YAML parse passes on both workflows; CI
   workflow runs the same two local verifier commands.
4. Local gates green: npm test 798+, gate OK, docs-site build exit 0.
5. Activation scenarios: ci.yml activates on push to main (observed in WP2 via
   `gh run list`); docs.yml activates on push touching docs-site (observed in
   WP2 via Pages 200).

## Out-of-scope deviations policy

Any tracked-file secret discovery, component code edit, or docs-site content
rewrite beyond factual drift fixes returns to P with an amended plan.

## A-phase fold-back (REVIEW-SYNTHESIS-01, reviewer "Dirac", verdict FAIL)

Per-blocker RCA + accept/rebut:

1. **LICENSE misrepresents vendored code — ACCEPT.** Tracked third-party code:
   repo-map vendored RepoMapper (MIT, (c) 2025 Pete Davis,
   `plugins/codexclaw/skills/repo-map/scripts/LICENSE`) and Aider-derived
   `queries/*.scm` (Apache-2.0, `.../scripts/NOTICE.md`). Fix: root `LICENSE`
   stays MIT (c) lidge-jun but gains a "Third-party notices" pointer section;
   README license section links the NOTICE.md. No new notice files needed —
   NOTICE.md already exists in-tree.
2. **README falsehoods — ACCEPT.** Fixes: "Eleven hooks" -> twelve (plugin.json
   declares 12, gate checkCounts proves 12=12); implicit skill-set claim drops
   `skill-hub` (its openai.yaml is `allow_implicit_invocation: false`); layout
   tree adds `skill-search` component and drops the gitignored
   `devlog/.lazycodex` line. Doctrine drift (dev SKILL.md "only cxc-dev
   implicit" vs six yamls true) is noted as follow-up, NOT changed here —
   behavior change is out of goal scope.
3. **PII/publish-surface decision — ACCEPT (decision recorded).** Verified: no
   tracked credentials (gitleaks + grep ladders). `/Users/jun` literals in
   tests are pure string-builder parameters (e.g. messenger-bridge
   `service.test.ts:41-46` passes "/Users/jun" as an argument — CI-safe, not
   leakage). Decision: devlog/`.omo` corpora STAY tracked and go public —
   the author's identity (lidge-jun) is already on the repo, the corpus
   contains no credentials, and publishing the devlog is part of the project's
   working-in-public intent. Recorded here as the explicit keep decision.
4. **repo-map smoke networks on GitHub runners — ACCEPT.** ubuntu-latest ships
   `uv`, so `depsAvailable()` returns true and the test exercises a live
   dependency resolve (tiktoken download). Fix (minimal, CI-enabling): add an
   env gate `CODEXCLAW_SKIP_REPOMAP_SMOKE=1` to
   `plugins/codexclaw/test/repo-map-smoke.test.mjs` skip logic and set it in
   ci.yml. Local runs stay unchanged.
5. **docs.yml own install (warning) — ACCEPT.** docs-site is NOT a root
   workspace; docs.yml runs `npm ci` inside `docs-site/` with
   `cache-dependency-path: docs-site/package-lock.json`.

Amended WP1 file change map (delta): `LICENSE` gains third-party pointer;
`README.md` fixes hook count/implicit set/layout tree + license note;
`repo-map-smoke.test.mjs` gains 3-line env gate; ci.yml sets the skip env;
docs.yml installs in docs-site. Action pins per research: checkout@v7,
setup-node@v6, configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5,
node 24.
