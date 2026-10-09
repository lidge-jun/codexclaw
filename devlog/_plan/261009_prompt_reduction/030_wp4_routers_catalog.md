# wp4 — catalog descriptions and the remaining routers

Goal: every L2 description is a selection trigger within budget, and each non-core router body keeps routing plus the rules every use needs, with procedures moved to references in the same skill. Source table, replacements and test pins: research/30_routers_catalog.md.

Before: descriptions 11,647 B (29 skills); 17 router bodies 342,360 B.

## B1 — descriptions (sol lane "catalog"; writes only line 3 of every skills/*/SKILL.md and line 3 of every skills/*/agents/openai.yaml)

Apply the research/30 replacement column, with these rules: ≤ 320 chars; scope first ("Use for …"); keep the strongest English and Korean triggers; keep `gpt-5.6-luna` in lunasearch (catalog.test.ts:8-19); keep dev's description a JSON-quoted single line (SAT:1179); stubs read "Deprecated alias. Use cxc-<target>." Fix orchestrate's YAML label. Target total ≤ 4,500 B.

## B2 — routers (four sol lanes, disjoint skill directories)

| Lane | Skills | Target body | Notes |
|---|---|---|---|
| r1 | dev-architecture, dev-backend, dev-data, dev-security | ≤ 10 KiB each (targets 2-3 KiB) | keep selectors and trust-boundary routes |
| r2 | dev-debugging, dev-devops, dev-testing, dev-code-reviewer, dev-scaffolding | ≤ 10 KiB each | keep RCA core, verdict/output contract, harness choice |
| r3 | dev-frontend, dev-uiux-design, dev-visualizer | ≤ 10 KiB each | protected design owners: move sections verbatim, do not rewrite design guidance; keep visualizer refs local (visualizer-packaging.test.mjs); genre phrase pins (report-genre-contract.test.mjs:35-49) |
| r4 | qa, search, recall, interview, lunasearch, stubs (skill-hub, orchestrate, goalplan, dev-diagram-viewer) | ≤ 10 KiB each; stubs ≤ 400 B body | recall synopsis test (recall-skill-synopsis.test.mjs:16-26) moves with the Commands section to its new reference path |

Method per router: cut sections that restate dev family invariants (C0/C1 notes, role-boundary paragraph, external-proof route) to a one-line pointer; move procedure sections verbatim into `references/<topic>.md` (NEW files, numbered by topic, not by phase) and leave a `condition | reference` row; delete history and roadmap paragraphs. Moving is verbatim: the lane does not rewrite domain guidance while moving it.

Any router still above 10 KiB after the lane is listed in the gate's `EXCEPTIONS` with its new size, reason and "follow-up" owner, and reported in D.

## Accept criteria

- check-prompt-architecture.mjs exit 0 with the description budget active for all 29 skills and router ceilings active (exceptions only shrink).
- Every heading removed from a router body exists verbatim in a reference of the same skill, or its removal is listed as duplicate/history in the lane report (diff check script in C).
- `manifest-policy`, `skill-catalog`, `inventory`, `recall-skill-synopsis`, `report-genre-contract`, `visualizer-packaging`, `port-provenance`, `repo-map-packaging`, `catalog.test.ts`, `spawn-attach-hook` tests pass; then `npm test`, `gate.mjs`.


## Amendments after A round 1

- Order. B1 (catalog lane) runs and lands in the working tree before the router lanes start; router lanes never edit frontmatter. After B1 the description entries leave the baseline and the 320/100-char limits apply to every skill.
- Survival check. Each router lane writes `evidence/router-<lane>-moves.md`: removed heading → destination file#anchor, or "duplicate of <owner>" / "history". C runs a script comparing removed headings in `git diff` with that table and the destination files; a reviewer checks that each moved section has a router row naming when to read it.
- Baseline. Routers still over 10 KiB keep an exact-size record; no skill outside the frozen eligible set may enter it.


## wp4 P revalidation (2026-10-09)

Continuity, quoting the wp3 D summary: "Next: deliver PR B, then wp4 per 030." Tree check: since the audited snapshot, files outside dev/loop/pabcd changed only where wp3 touched them (`dev/references/*` is dev's). The router sizes and description lengths are the "Before" figures in research/30 and the exact-size records in `prompt-architecture-baseline.json`; the gate now enforces every rule in this doc's accept criteria, so C uses it directly.

Additions from wp3: (1) router lanes must also clear the frozen legacy duplicate IDs in their skills where a single owner is obvious (READER-DOC-01..05 stay duplicated: `visualizer-packaging.test.mjs` requires dev-visualizer's local copy; FE-ASSET-BG-01, UX-CONCEPT-GEN-01, FE-MOTION-HONESTY-01 → lane r3; DEVOPS-BASELINE-DEFECT-01, SOT-SYNC-01 → lane r2); (2) each lane removes its skills' entries from the baseline only by reporting new sizes; main edits the baseline after the lanes finish; (3) the lessons of wp3 C apply: lane ledgers are checked by an independent reviewer against the destination text, and "duplicate of X" counts only if X contains the rule.

Branch `codex/prompt-reduction-routers` stacked on #289 (retargeted to `dev` after #289 merges).


## wp4 D summary (2026-10-09)

Conclusion: every skill meets the 001 budgets. Descriptions 11,647 → 4,492 B (longest 228 chars); sixteen routers moved procedures verbatim into same-skill references; all SKILL.md files 447,610 → ~110 KB. The gate baseline holds only `READER-DOC-01..05` (dev-visualizer's test-required local copy); the eligible sets are empty, so no skill can claim a size exception without a code change. Survival: 372 removed headings, 362 found as headings in the same skill, 10 recorded as pointers/history; independent review PASS at round 2 with no lost guidance. Full suite 3,772 tests, 0 failures.

What did not go well: one lane ledger named an owner (dev `3) that holds only the generic rule while the QA-specific text had moved to QA's own reference, so the proof was wrong even though nothing was lost; the router lanes left trailing whitespace and EOF blank lines in 24 files; a moved reference lacked its condition row. The hypothesis that died: that byte targets from research/30 (2-4 KB) were realistic for every router; the review-oriented routers (code-reviewer, debugging) settled near 5 KB. Evidence the direction is wrong: agents skipping a reference they needed because the router row did not name their situation, which would show as missing checklist steps in reviews or QA verdicts.

Next: deliver PR C, then wp5 (release 0.2.42 and deploy), then wp6.

