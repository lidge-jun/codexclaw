# wp4 independent C review

Anchor: `af7e9afe..702f42f460132976590b296024eabcf352720a0e`; scope: `plugins/codexclaw/skills` and `plugins/codexclaw/test`. Checkout: `/Users/jun/.codex/worktrees/55e8/codexclaw`. C3 contract review; plan/amendments/P revalidation read. No builds, tests, spawning, orchestration, goal commands or Git writes.

Read-only work began 2026-10-09 04:17:33 UTC; first write after 04:24:05 UTC. No parent test process visible at write time; no claim about its test results.

## Findings

1. **Style, non-blocking — whitespace.** `git diff --check af7e9afe HEAD -- plugins/codexclaw/skills plugins/codexclaw/test` exits 2: trailing whitespace at `plugins/codexclaw/skills/dev-architecture/references/04-architecture-review.md:51` and 23 added EOF blank lines. Trigger: committed relocation diff. Impact: hygiene only. Verification: verified.

2. **Medium; blocker under requested check (1) — QA ledger names the wrong owner.** `devlog/_plan/261009_prompt_reduction/evidence/router-r4-moves.md:25` labels the removed `1. Trust nothing` section a verified pointer to dev §3. Dev lacks its QA-specific freshness fields, no inferred/partial verdicts, cannot-run => FAIL, structural-only NA, and worker-receipt routing. Trigger: accepting this row as ownership proof. Impact: the explicit owner-validation gate fails.

   Falsification found every sentence in `plugins/codexclaw/skills/qa/references/evidence-contract.md:24`, required before any verdict by `plugins/codexclaw/skills/qa/SKILL.md:44`. **No QA guidance disappeared.** Correct the ledger to record this local relocation; dev owns only generic proof. Blocker classification follows the user's explicit owner-lacks-rule criterion. Verification: verified.

3. **Low, non-blocking — intent guard has no condition-table row.** `plugins/codexclaw/skills/search/SKILL.md:47` omits moved `references/intent-guard.md`. Trigger: the plan requires a row for every moved reference. Impact: table coverage fails. The inline “Before querying” instruction at `plugins/codexclaw/skills/search/SKILL.md:43` preserves routing; no obligation is lost. Add a before-query row. Verification: verified.

## Requested checks

**Owner pointers:** all 25 checked (r1/r2/r3/r4: 5/12/7/1). Opened dev's fast-path, authority, family, proof, safety and conditional routes; DevOps baseline attribution; PABCD SoT sync; limited-oracle evaluation; stacked-PR preflight; frontend background/motion; UI/UX concept router/procedure. Only finding 2 has an incorrect owner. External-evidence pointers inherit dev's mandatory search route; search retains query/source-proof/status rules. Unique browser preconditions survive locally.

**25 moved-section samples:** compared original `git show af7e9afe:<router>` sections against their ledger destinations, using unified text diffs, including nested content:

- r1 (6): architecture Structural Decision Gate; backend Boundary Parsing Contract and Async Task Queue Patterns; data Migration & Backfill Sequencing; security MCP Server Vetting and Must-Pass Addenda.
- r2 (7): debugging Phase 3; DevOps Rollback Rules and Freeze/GO-NO-GO; testing Fixture/Seed Synchronization and Test Oracle Integrity; review Changed-File Coverage Ledger; scaffolding Scaffold Contract.
- r3 (8): frontend Component Identification, Objective Gates vs Style Samples, AI-default tells, State Classification; UI/UX Intent Discovery, DESIGN.md persistence, Icon Strategy; visualizer Compose before styling.
- r4 (4): QA Evidence Contract; search Source-open Proof; recall Commands; interview Rescan/readiness.

No unexplained dropped sentence or protected design-guidance rewrite in these samples. Differences: paths/section pointers; RCA's exact gate retained in its router; archived r2/r4 history. Recall receives its unchanged sidecar-write caution from elsewhere in the original router. Frontend's nonexistent §11 reference predates this patch.

**Routing/core:** 100/101 new references have direct condition-table links; finding 3 accounts for the other. Security threat/trust-boundary routes, testing's before-green oracle rule, review verdict/output, RCA/toggle gates, search proof, recall chat-then-memory order and interview readiness stops survive. QA verdict rules are mandatory via its recording-verdict reference.

**Catalog:** all 29 old/new descriptions and dropped triggers compared. Common requests remain covered by scope or retained triggers. No demonstrated gap; live model selection untested.

**Duplicate IDs:** all five resolutions preserve their non-owner surface text: SoT before-patch reads and scaffold proposal guidance; testing's DEFAULT attribution/CI-access caveat and strict-release precedence; cutout MUST/ima2 instruction; asset composition-anchor variation/element ledger; UI/UX's pre-shipping motion-owner handoff. Canonical owners contain the removed shared obligations.

Coverage: 165 paths accounted for: 29 SKILL + 29 YAML entries reviewed; 101 new references checked for routing/ownership with 25 content samples (remaining full prose not exhaustively sampled); four existing-reference edits and two test diffs reviewed. Recall changes only its input path; architecture tests use synthetic eligibility and assert real exceptions are empty. No test-pass claim. Supplied heading JSON: 372 removed, 362 same-skill headings, 10 ledger dispositions, none unaccounted; supplemental only.

## blocking_issues

- Finding 2: correct the QA owner disposition before accepting the requested owner-validation gate. No write-scope expansion is needed.

VERDICT: FAIL
