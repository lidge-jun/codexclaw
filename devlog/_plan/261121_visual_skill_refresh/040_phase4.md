# 040 — wp4: platform and pattern refresh

Research: [002](002_web_platform_2026.md). Re-check every Baseline status on MDN at P.

## File change map (under plugins/codexclaw/skills/)

| Op | Path | Change |
|---|---|---|
| NEW | dev-frontend/references/core/platform-2026.md | Baseline table with dates and per-feature guard/fallback: anchor positioning (+ popover for menus/tooltips, replacing Floating UI by default), `@starting-style` (note the Firefox exit snap), scroll-driven animations (reduced-motion wrapper), `text-box-trim` for button/heading optical centering, `field-sizing`, customizable select as progressive enhancement, `interestfor` Chromium-only, `dialog closedby`, cross-document view transitions, style queries. |
| MODIFY | dev-frontend/references/core/topic-index.md, SKILL.md | Route "popover/tooltip/menu/select/textarea/enter animation" to platform-2026. |
| MODIFY | dev-frontend/references/core/dropdown-layer.md, motion.md | Point positioning and enter/exit animation at the native features first. |
| NEW | dev-uiux-design/references/agent-action-ux.md | UX-AGENT-ACTION-01: intent preview, plan checklist, review-and-approve with exact diffs, scoped confirmation for irreversible actions (named verb button, neutral per FE-COLOR-RESTRAINT-01), activity log, pause, undo, confidence without raw percentages, seeded empty state. Korean copy samples. |
| MODIFY | dev-uiux-design/references/conversational-ai.md | Scope line pointing action-taking agents to agent-action-ux. |
| MODIFY | dev-uiux-design/references/design-read.md | DESIGN.md persistence follows the google-labs-code spec (YAML front matter tokens + prose); optional `npx @google/design.md lint` when the network allows, otherwise NOT_RUN. |
| MODIFY | dev-uiux-design/references/design-trends.md, dev-frontend trend notes | New observed_at; add "neutral controls, color only in data" as an observed direction with sources; mark July rows that the refresh did not re-observe as unrefreshed. |
| MODIFY | both SKILL.md metadata | `last-verified` to the wp4 date. |

## Acceptance

check-prompt-architecture exit 0; `rg -l 'anchor posit|@starting-style|base-select|text-box-trim|field-sizing|interestfor'`
lists platform-2026.md; agent-action-ux.md cited from conversational-ai.md and the uiux
router; every Baseline row has a source and date.
