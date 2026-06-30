# L18 / 180 — Status-sync + forbidden-claims + count gate (E8)

Status: DONE (gate shipped + tested) · 2026-06-30 · mvp_hard loop L18 · class C3 (tooling + tests; no runtime hook change)

Register rows: B1-B7 (status drift / false-DONE), C7 (hook count — already fixed, gate locks it),
C9 (component test-script asymmetry), C10 (build+test contention flaky — out of scope, L18 note only).

## Problem

The recurring failure mode is **drift**: an `mvp_hard/000_INDEX.md` impl-state says DONE while
the loop doc's own `Status:` line (or README/roadmap) still says PLANNED / "no runtime shipped".
There is no mechanical gate; drift is caught only by ad-hoc audits. E8 = make `npm test` fail on
drift, false-enforcement prose, or count mismatch.

## Diff-level plan

1. `scripts/gate.mjs` — pure, dependency-free Node module exporting three checks, each returning
   `{ ok, violations: string[] }`:
   - `checkStatusSync(repoRoot)`: parse the INDEX loop-ledger table into
     `{ ln, decade, decisionState, implState }`. For each row with a numeric decade, resolve
     `devlog/_plan/mvp_hard/<decade>_*.md`; read its first `Status:` line; extract the leading
     DONE/PLANNED/PARTIAL/DEFERRED token. VIOLATION when INDEX impl-state is `DONE` but the loop
     doc status token is not `DONE` (and vice-versa). Missing loop doc for a decade = violation.
     Tokens come from a LOCKED enum (no new tokens): `DONE|PLANNED|PARTIAL|DEFERRED|PROPOSED`.
   - `checkForbiddenClaims(repoRoot)`: scan `plugins/codexclaw/skills/**/SKILL.md` for
     false-enforcement phrases. A line may opt out with a trailing `<!-- gate-ok: <reason> -->`
     for verified-true claims. VIOLATION = a matching line without the escape (cli-jaw claim-audit).
   - `checkCounts(repoRoot)`: assert the number of `./hooks/*.json` entries in `plugin.json.hooks`
     equals the count of files in `plugins/codexclaw/hooks/`.
2. A `gate` runner wired as `"gate": "node scripts/gate.mjs"` in `package.json` AND a test
   (`plugins/codexclaw/test/gate.test.mjs`) importing the checks and asserting `ok === true` on the
   live repo, so `npm test` fails on drift.
3. C9: document in `structure/INDEX.md` that the root `package.json` glob is the single test source
   and component `test` scripts are intentionally not uniform (least churn, honest) — unless the
   audit argues for adding the scripts.
4. Fix any live drift the gate surfaces (B1-B7 residue) so the gate passes green on commit.

## DONE when

`npm test` includes a gate test that fails on status drift, false-enforcement prose, or hook-count
mismatch; the gate passes on the current tree (all live drift resolved); register B1-B7/C7/C9 updated.

## Non-goals

- No NLP. The status-sync gate is token-level (LOCKED enum), not semantic.
- C10 (build+test contention flaky) is NOT fixed here — noted as an L18 follow-up candidate. The
  gate test must not depend on the MCP stdio roundtrip.
- README/roadmap.html are user-owned; the gate READS them at most, never rewrites them.
