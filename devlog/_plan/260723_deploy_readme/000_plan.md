# 260723 deploy path research + README optimization — plan (P)

Session: 019f8f1b-b356-7443-a937-b839f17b7ac6 (HITL cxc-loop, cycle 1 = docs-first)

## Objective

1. Research codexclaw's deployment/distribution path ahead of first public release,
   using LazyCodex (`lazycodex-ai` npm wrapper + `omo` plugin) as the reference
   implementation the user pointed at.
2. Optimize the public README set (`README.md`, `README.ko.md`, `README.zh.md`)
   so the repo is factually accurate and install-ready at release.

## Evidence base (this cycle's research)

- `001_deploy_readiness_audit.md` — repo-local factual audit (manifest, versioning,
  README accuracy, dist ship-state, blockers). Source: Sol subagent "Nash", 2026-07-23,
  VERDICT: COMPLETE; spot-verified by main agent (skill count 27, hooks 18, routers 12,
  tests 1201/1201 via fresh `npm test`).
- `002_lazycodex_distribution.md` — LazyCodex distribution chain, manifest format,
  versioning/update mechanics, 10 takeaways. Source: Sol subagent "Heisenberg",
  2026-07-23, VERDICT: COMPLETE.
- Live CLI verification (main agent, 2026-07-23): `codex plugin --help` →
  `add|list|remove`; `codex plugin marketplace --help` → `add|list|upgrade|remove`.
- Marketplace manifest discovery: `.agents/plugins/marketplace.json` is a supported
  root manifest path (codex-rs `MARKETPLACE_MANIFEST_RELATIVE_PATHS`, mirrored in
  opencodex `src/codex/plugins-doctor.ts:9`).

## Work-phase map (dependency-ordered)

- **WP1 (THIS cycle, docs-only):** write this unit — research 001/002, deploy-path
  design `010_deploy_path.md`, README rewrite plan `020_readme_optimization.md`.
  No production edits. D locks the roadmap.
- **WP2 (next cycle):** execute `020` — optimize `README.md` + `README.ko.md` +
  `README.zh.md` (factual corrections, install/update/uninstall UX, docs links).
  Verifier: count commands re-run, link existence checks, i18n structural parity,
  `node plugins/codexclaw/scripts/gate.mjs`.
- **WP3 (appended at A, LOOP-UNIT-CHAIN-01):** execute `030_docssite_sync.md` —
  the primary docs site (`lidge-jun.github.io/codexclaw/`) is MORE stale than the
  README (25 skills / twelve hooks / 801 tests, shipped-GUI claims). Linking the
  optimized README to an unsynced site would relocate the inaccuracy, not fix it.
  Verifier: `npm run build` in `docs-site/` + stale-number sweep.

## Out of scope for this loop (user decisions, recorded in 010)

- D1: `gui/dist` shipping policy (commit bundle vs build-on-install doc).
- D2: devlog public posture (753 tracked files).
- D3: CHANGELOG introduction at first tag.
- D4: npm wrapper (`npx <name> install`) — recommended defer.
- Actual release actions: git tag, GitHub release, any push. Push remains gated
  by DEV-GIT-PUSH-01 regardless.

## Constraints

- No production code changes in WP1/WP2 (docs-only loop).
- Preserve unrelated untracked work (`devlog/_plan/260722_260722-repo-governance-config/`).
- i18n READMEs must stay structurally synchronized (currently 144 lines each,
  matching sections).

## A-phase amendments (folded from reviewer "Ampere", GO-WITH-FIXES blockers=3)

1. B-CLI (High, accepted): the marketplace payload `plugins/codexclaw/` contains
   no `bin/`/`cli/` — a clean install gets hooks/MCP but no `cxc` on PATH.
   Recorded as deploy blocker + decision D6 in 010; README CLI section scoped
   accordingly in 020.
2. B-GUI (High, accepted): D1 upgraded from optional decision to RELEASE GATE;
   E6 marks every GUI/dashboard claim, not one caveat paragraph.
3. B-DOCSSITE (High, accepted): WP3 appended (above) with decade doc 030.
4. Rule-ID count corrected: 155 (dedup after stripping file prefixes), research
   moved from 020 to 001 (LEXICO-SPLIT-01 repair).
5. Hook metric pinned: 18 active manifest registrations; 21 JSON files on disk
   incl. 3 under `hooks/_deprecated/`.
