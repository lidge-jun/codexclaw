# 050 — wp5: visualizer upgrades

Research: [001 visual table](001_oss_survey.md). Amend at P.

## File change map (under plugins/codexclaw/skills/dev-visualizer/)

| Op | Path | Change |
|---|---|---|
| NEW | scripts/look.mjs | Render an HTML/SVG artifact at 390 and 1280 (playwright-core if resolvable, else NOT_RUN): script errors, horizontal scroll, labels < 12px, overlapping labels, text escaping its shape, then one contact sheet. Reuses wp3's ui-lint static checks. |
| MODIFY | SKILL.md (VIZ-VERIFY-SCALE-01 table) | The "computed" tier names look.mjs as the default render check. |
| NEW | reference/diagram-types.md | Catalog of about 20 types codexclaw users need (architecture, delta, sequence, state, ER, swimlane, timeline, quadrant, tree, funnel, waterfall, heatmap, small multiples, before/after, dependency graph), each with when-to-use, density cap (split above ~9 nodes) and the question it answers. |
| MODIFY | reference/artifact-composition.md | First-use brand gate: if the project has DESIGN.md or brand tokens use them; otherwise state that defaults are used, once. One claim per figure; every edge labeled with a verb; every number gets a mark. |
| MODIFY | reference/source-patterns.md | Add the 2026-11-21 rows (visual-explainer 0.15, diagram-design, open-design, baoyu, open-slide) with license and adoption boundary. |
| MODIFY | assets/*.html | Pass ui-lint and look.mjs. |

## Acceptance

look.mjs runs on both assets with zero FAIL (or NOT_RUN honestly reported when Playwright is
absent); check-prompt-architecture and gate exit 0.
