---
name: cxc-dev-frontend
description: "Use for frontend code and UI fixes. Triggers: CSS, responsive, animation, React, Vue, Svelte, Tailwind, redesign, anti-slop, 프론트엔드, UI 작업, 반응형, 디자인 수정."
metadata:
  last-verified: "2026-07-14"
  short-description: "Production-grade frontend implementation with responsive, accessible, anti-slop UI guidance."
  keywords: [frontend, UI, component, CSS, responsive, layout, animation, design implementation]
---

# Dev-Frontend — Domain-Correct Frontend Engineering

Build production-grade frontend implementations from an established product/design direction.
This skill owns HTML/CSS/component/runtime implementation, responsive behavior, accessibility
wiring, visual verification, and frontend platform rules.

Before selecting depth or claiming completion, read [dev](../dev/SKILL.md#01-patch-fast-path-c0c1) and its [verification gate](../dev/SKILL.md#3-verification-before-completion-strict). For current/external evidence, use [dev’s conditional routes](../dev/SKILL.md#conditional-routes).

## Modular References

| Condition | Reference |
|---|---|
| Every frontend change: role boundary | [Role boundaries](references/core/role-boundaries.md) |
| Before designing or coding: surface defaults | [Routing defaults](references/core/routing-defaults.md) |
| C2 list/detail/form screens | [CRUD UI](references/core/crud-ui.md) |
| Marketing/visual surfaces or C3+: choose topic/locale references | [Core topic index](references/core/topic-index.md) |
| Framework implementation or configuration | [Stack index](references/stack-index.md) |
| Components, direction intake, dials or objective/style classification | [Design intake](references/core/design-intake.md) |
| Typography, color, layout, assets, icons or cutouts | [Implementation](references/core/implementation.md) |
| New/redesigned surfaces or visual audits | [Anti-slop enforcement](references/core/anti-slop-enforcement.md) |
| Performance, accessibility, forms, state, platform or errors | [Platform and runtime](references/core/platform-runtime.md) |
| API consumption, security UI or contract fixtures | [Backend contracts](references/core/backend-contracts.md) |
| Any render/executable frontend artifact | [Verification grounding](references/core/render-grounding.md) |
| Before shipping a production frontend surface at C2+ | [Full pre-flight](references/core/preflight-full.md) |

Start with `references/core/anti-slop.md`, `references/core/aesthetics.md`, `references/core/responsive-viewport.md`, and `references/core/visual-verification.md`. Add domain/locale/stack references only when relevant.
For C2 ordinary app screens (form/table/list/detail), `references/core/crud-ui.md` alone suffices; add the style references above for marketing/visual surfaces or C3+ work.

- UI/rendering bug RCA: load `dev-debugging`.
- Build pipeline, bundle config, or deployment: load `dev-devops`.
- Project setup or file placement conventions: load `dev-scaffolding`.
- Data-driven dashboards, reporting views, or data format expectations: load `dev-data`.

## 0. Frontend Routing

Before designing or coding, classify the work:

| Decision | Options | Why It Matters |
| --- | --- | --- |
| Product surface | landing, app, dashboard, AI tool, public service, education, game, creative | Sets density, typography scale, asset requirements |
| Locale | Korean-first, global/i18n, English-only | Sets CJK typography, copy, date/number formats |
| Density | campaign, consumer app, productivity, SaaS, ops, finance, developer console | Prevents landing-page composition inside repeated-work tools |
| Asset need | none, screenshot, product photo, diagram, chart, illustration, soft 3D, game asset | Prevents asset-free gradient/card UI |
| Soft 3D/character gate | not allowed, subtle, primary | Prevents generic cute 3D/mascot slop |
| Motion intensity | static, feedback-only, expressive, cinematic | Prevents cinematic motion in utility workflows |
