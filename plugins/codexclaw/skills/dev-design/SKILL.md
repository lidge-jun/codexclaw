---
name: cxc-dev-design
description: "Use for UI design and frontend work: direction, UX states, copy, code, audits. Triggers: make it look good, redesign, landing, CSS, responsive, React, Tailwind, onboarding, empty state, logo, anti-slop, 디자인, 깔끔하게, 모던하게, 프론트엔드, UI 작업, 반응형, 카피."
metadata:
  last-verified: "2026-11-21"
  short-description: "One design skill: direction, copy, build and audit for anti-slop, accessible UI."
---

# Dev-Design — direction, copy, build, audit

One skill for interface work. It replaced `cxc-dev-uiux-design` and `cxc-dev-frontend` on
2026-11-21; both names remain as redirects. Run the modes in order for new or redesigned
surfaces; jump straight to the mode a narrow task needs.

Before selecting depth or claiming completion, read [dev](../dev/SKILL.md#01-patch-fast-path-c0c1) and its [verification gate](../dev/SKILL.md#3-verification-before-completion-strict). Current/external evidence: [dev's conditional routes](../dev/SKILL.md#conditional-routes). Use browser fetch/open/snapshot only after candidate URLs exist.

| Mode | Use when | Start with |
|---|---|---|
| **Direction** | The brief is vague ("깔끔하게", "Linear처럼"), a new surface, a design system, brand, logo, IA, UX states | [Intent discovery](references/direction/intent-discovery.md), then [Design Read](references/direction/design-read.md) |
| **Copy** | Any visible words: headline, CTA, microcopy, errors, empty states | [Copy process](references/copy/copy-process.md) |
| **Build** | HTML/CSS/components, responsive, motion, accessibility wiring, framework code | [Routing defaults](references/build/routing-defaults.md), [anti-slop](references/build/anti-slop.md), [aesthetics](references/build/aesthetics.md) |
| **Audit** | Review an existing UI, pre-ship check, "why does this look AI-made" | [Visual audit loop](references/build/visual-audit-loop.md), [slop consensus](references/build/slop-consensus-2026.md), [lint](scripts/README.md) |

Mode boundaries and handoffs: [direction roles](references/direction/role-boundaries.md), [build roles](references/build/role-boundaries.md). A narrow build task does not reopen direction; an open-ended visual brief never skips it.

## House defaults (owner-validated 2026-11-21)

Owner blind A/B and a 254-site survey back these; details in each rule.
- Neutral controls, color only in data and focus: FE-COLOR-RESTRAINT-01 in [color system](references/build/color-system.md).
- No one-sided accent bars: FE-SIDE-ACCENT-01 in [anti-slop](references/build/anti-slop.md).
- The first viewport is a full-bleed scene with the copy in it, not a white page with a demo box; short heroes centered; no text-left / video-right splits: FE-HERO-ALIGN-01 in [layout discipline](references/build/layout-discipline.md).
- Korean marketing copy follows the owner register: [copy registers](references/copy/copy-registers.md).

## References

| Condition | Reference |
|---|---|
| User-facing decision points | [Lazy-user gate](references/direction/lazy-user-gate.md) |
| Existing product audit: personas, journeys, gap ledger | [Experience audit](references/direction/experience-audit.md), [universal principles](references/direction/universal-principles.md) |
| Concept generation, then production assets and icons | [Concept procedure](references/direction/concept-exploration.md), [asset handoff](references/direction/asset-handoff.md), [icon strategy](references/direction/icon-strategy.md) |
| Agents that act for the user: plan, approval, undo, activity | [Agent action UX](references/direction/agent-action-ux.md) |
| Styles, products, palettes, states, IA, branding, Korean UI | [Direction topic index](references/direction/topic-index.md) |
| Copy shapes, registers and tells (EN/KO) | [Registers](references/copy/copy-registers.md), [tells](references/copy/copy-tells.md) |
| C2 list/detail/form screens | [CRUD UI](references/build/crud-ui.md) |
| Marketing/visual surfaces or C3+ topic and locale files | [Build topic index](references/build/topic-index.md) |
| Framework implementation | [Stack index](references/stack-index.md) |
| Components, dials, objective/style intake | [Design intake](references/build/design-intake.md) |
| Typography, color, layout, assets, icons | [Implementation](references/build/implementation.md) |
| Platform features with Baseline status (anchor, popover, select, text-box) | [Platform 2026](references/build/platform-2026.md) |
| Any scroll effect, sticky chrome, anchors, snap rails | [Scroll interaction](references/build/scroll-interaction.md) (FE-SCROLL-*), then [motion](references/build/motion.md) recipes |
| Public pages: search and AI-answer visibility, crawlers, structured data | [SEO and GEO](references/build/seo-baseline.md) (SEO-*/GEO-*), `scripts/seo-lint.mjs` |
| Performance, accessibility, forms, state, errors | [Platform and runtime](references/build/platform-runtime.md), [WCAG 2.2 AA](references/build/wcag22-aa.md) |
| API consumption, security UI | [Backend contracts](references/build/backend-contracts.md) |
| Any render or executable artifact; production C2+ | [Render grounding](references/build/render-grounding.md), [full pre-flight](references/build/preflight-full.md) |

C2 app screens need only CRUD UI plus anti-slop; add style references for marketing or C3+.
Other surfaces: rendering bug RCA `dev-debugging`, build/deploy `dev-devops`, file placement
`dev-scaffolding`, data views `dev-data`, documents and diagrams `dev-visualizer`, Korean
prose polish `kwrite`.

## Build routing

| Decision | Options | Why |
|---|---|---|
| Product surface | landing, app, dashboard, AI tool, public service, education, game, creative | Density, type scale, assets |
| Locale | Korean-first, global/i18n, English-only | CJK type, copy, formats |
| Density | campaign, consumer app, productivity, SaaS, ops, finance, developer console | No landing composition in tools |
| Asset need | none, screenshot, product photo, diagram, chart, illustration, soft 3D, game asset | No asset-free gradient UI |
| Soft 3D/character | not allowed, subtle, primary | No generic mascot slop |
| Motion | static, feedback-only, expressive, cinematic | No cinematic motion in utilities |

## UX State Contract (UX-STATE-01)

For onboarding, empty, loading, error or progressive disclosure, answer the state's meaning before styling ([UX states](references/direction/ux-states.md)).
- Onboarding teaches the first meaningful action, not the whole product.
- Empty explains why the state exists and names the next action.
- Loading: skeleton for known structure, spinner/progress for short unknown waits, no fake completion.
- Error exposes retry, recovery or escalation; never a dead end.
- Progressive disclosure names what stays hidden, why, and where it becomes available.

## IA Chooser (UX-IA-01)

| Work shape | Default IA |
|---|---|
| Dense desktop repeated work | Sidebar + command palette |
| Medium sectioned work | Tabs or segmented control |
| Mobile-primary consumer flow | Bottom nav, sheet, thumb-zone actions |
| Wizard/auth/setup | Stepper or stacked linear flow |

Responsive details: [responsive nav](references/direction/responsive-nav.md).

## Visual Concept Exploration (UX-CONCEPT-GEN-01, DEFAULT)

Before implementing a C2+ expressive or brand-visible surface, read the [concept procedure](references/direction/concept-exploration.md).

## Done means

Rendered and looked at; [lint](scripts/README.md) run on the output (an unrun check is reported as not run, never as passed); the [visual audit loop](references/build/visual-audit-loop.md) ledger closed for audits.
