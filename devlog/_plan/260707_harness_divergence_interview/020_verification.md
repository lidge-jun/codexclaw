# 020 - C-Phase Verification Evidence (DIVERGE-TIER-01, four repos)

Date: 2026-07-07. Work-phase wp3 of goalplan
`diverge-tier-01-divergence-cost-tiers-guidance-o`.

## Deterministic checks

- `rg -c 'DIVERGE-TIER-01'` == 1 in all five target files (initiative
  loop-engineering.md + SKILL.md router, cli-jaw skills_ref SKILL.md, jawcode
  orchestrate-p.md, codexclaw loop SKILL.md) — re-run after repair round, still 1.
- Section ordering: initiative reference 11.5(L121) -> 11.6(L127) -> 11.7(L132) ->
  11.8(L137); cli-jaw 11.5(L470) -> 11.6(L477) -> 11.7(L486) -> 11.8(L502).
- Diff scope: initiative loop-engineering.md +86 and SKILL.md router bullet;
  cli-jaw is a git SUBMODULE (skills_ref @ heads/main) — submodule diff is
  dev-pabcd/SKILL.md +42 only; jawcode orchestrate-p.md +1/-1; codexclaw loop
  SKILL.md additive bullet only. No unrelated files touched by this unit
  (pre-existing dirty files in initiative/jawcode left alone).

## Runtime test loops

- jawcode: `bun test test/jwc-runtime/orchestrate-state.test.ts` -> 38 pass, 0
  fail (212 expects). Prompt edit did not break orchestrate runtime tests.
- codexclaw: `node --test test/loop-activation-doc-sync.test.mjs
  test/emergence-doc-sync.test.mjs` -> 3 pass, 0 fail; re-run after repair
  round -> 3 pass, 0 fail.
- pabcd_initiative, cli-jaw skills_ref: docs-only repos/paths, no test suite in
  blast radius; covered by reviewer loops below.

## Reviewer loops (fresh xhigh explorers, one per repo)

- jawcode (Hume 019f398d-0eb6): round 1 FINDINGS 0, VERDICT OKAY.
- pabcd_initiative (Sartre 019f398d-0cc3): round 1 ITERATE — S1 P2 (11.8
  "never relaxes" claim false vs 11.7 search-only provenance), S2/S3 P3 (stubs
  contradict the file's completeness claim). All ACCEPTED; fixes: provenance
  widening renamed an EXPLICIT 11.8 AMENDMENT (search provenance kept for
  external candidates), stubs now open with "Exception to this file's
  completeness claim" + pending consolidation. Round 2: F1-F3 RESOLVED with
  line evidence, VERDICT OKAY.
- cli-jaw (Erdos 019f398d-0dc1): round 1 ITERATE — E1 P2 (same provenance
  claim), E2 P3 (star-not-mesh contradicted agent_spawn.md:305 where employees
  may use CLI sub-agents). Both ACCEPTED; fixes: amendment wording + topology
  reworded to star-shaped candidate EXCHANGE with employee-internal sub-agents
  explicitly allowed. Round 2: F1-F2 RESOLVED, VERDICT OKAY.
- codexclaw (Kierkegaard 019f398d-0fbf): round 1 ITERATE — K1 P1 (read-only
  explorers cannot author candidate docs per dispatch doctrine
  20_pabcd_dispatch_doctrine.md:94-100, 00_philosophy.md:153). ACCEPTED; fix:
  explorers return findings only, candidate DOC written by MAIN session or a
  scoped WORKER (write scope = devlog unit / .codexclaw/divergence/). Round 2:
  RESOLVED against doctrine lines, VERDICT OKAY.

Cross-repo note: codexclaw keeps the STRICTER cxc-search-only provenance rule
(its existing doctrine); the repo-evidence amendment applies to initiative and
cli-jaw texts. jawcode's compact clause allows "repo-evidence path or search
source" and its reviewer accepted it against that prompt's conventions.

## Plan deviations (B/C)

1. Reviewer-driven: "tightens, never relaxes" was replaced by a named explicit
   amendment (initiative + cli-jaw). The original claim was simply false.
2. Reviewer-driven: Tier-1 authorship model corrected everywhere — research
   read-only, doc write by collapse owner or scoped writer lane.
3. Reviewer-driven: cli-jaw topology acknowledges employee-internal sub-agents.
4. Discovery: cli-jaw skills_ref is a git submodule; the patch lives in the
   submodule working tree (heads/main, uncommitted as requested).
