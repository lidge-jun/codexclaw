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

