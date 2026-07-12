---
name: cxc-dev-frontend
description: "MUST USE for any frontend, web UI, or visual implementation work — building, styling, or redesigning pages/components, responsive layouts, motion, component architecture, and production-surface polish. Pairs with cxc-dev-uiux-design: load it first when design direction is vague; this skill implements the chosen direction. Triggers: 'frontend', 'UI', 'component', 'CSS', 'responsive', 'animation', 'React', 'Vue', 'Svelte', 'Tailwind', 'layout', 'styling', 'redesign', 'mockup', 'anti-slop', '프론트엔드', 'UI 작업', '반응형', '디자인 수정'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Production-grade frontend implementation with responsive, accessible, anti-slop UI guidance."
  keywords: [frontend, UI, component, CSS, responsive, layout, animation, design implementation]
---

# Dev-Frontend — Domain-Correct Frontend Engineering

Build production-grade frontend implementations from an established product/design direction.
This skill owns HTML/CSS/component/runtime implementation, responsive behavior, accessibility
wiring, visual verification, and frontend platform rules.

> **Role separation:** For design judgment — typography/color/layout direction, UX decision
> gates, product personalities, or vague visual briefs — load `dev-uiux-design` first. This
> skill implements the chosen direction; `dev-uiux-design` makes the design decisions.
> Implementation anti-slop enforcement stays here; design taste/pattern judgment lives there.

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.

## Modular References

| File                                      | When to Read                         | What It Covers                                                                    |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `references/core/crud-ui.md`              | C2 list/detail/form product screens  | State coverage (loading/empty/error/permission), forms, objective UX gates         |
| `references/core/anti-slop.md`            | New/redesigned visual surfaces, visual audits, and variant generation | 2026 AI slop patterns, Korean slop, oversized text, fake assets, default UI smells |
| `references/core/aesthetics.md`           | Visual design decisions              | Domain-correct visual direction, typography, color, composition, serif three-role system, expressive/functional layers, AI-brand grammar                    |
| `references/core/product-density.md`      | Apps, tools, dashboards              | Density profiles for landing, consumer app, SaaS, ops, finance, devtools          |
| `references/core/asset-requirements.md`   | Any public/product/visual surface    | Required screenshots, images, diagrams, charts, generated bitmaps, or 3D assets, mockup production pipeline   |
| `references/core/visual-verification.md`  | Changes affecting rendered layout    | Screenshot, viewport, text fit, state, asset, and motion verification              |
| `references/core/korea-2026.md`           | Korean-first or Korea-facing UI      | Korean service patterns, CJK typography, formats, mobile flows, Korean serif/myeongjo display                     |
| `references/core/ux-writing-ko.md`        | Korean UI copy                       | Natural Korean labels, error messages, tone, spacing, punctuation                  |
| `references/core/soft-3d-asset-gates.md`  | 3D/miniature/character-like visuals  | Toss-style soft 3D vs generic cute asset slop, domain gates                        |
| `references/core/motion.md`               | Motion/animation needed              | CSS animations, Framer Motion, CSS scroll-driven timelines, pointer-proximity chip motion (magnetic/dock), View Transitions, domain gates, organic bg + capsule label, product-led hero motion |
| `references/core/liquid-glass.md`         | Translucent materials, glass chrome, pill-chip surfaces | Liquid Glass layer discipline, named material states (pill-at-top/pill-scrolled/media-overlay/clear), FE-PILL-NEST-01, blur-free pill alternative, perf + a11y gates |
| `references/core/top-bar.md`              | Top/nav bar composition, sticky chrome | Top-bar grammar: geometry, slots, scroll-state contract (FE-TOPBAR-STATE-01), hover-surface contract (FE-TOPBAR-HOVER-01), domain gate, mobile collapse |
| `references/core/iterative-design.md`     | Multi-round design                   | LLM convergence problem, Diverge→Kill→Mutate process, upgrade techniques           |
| `references/core/prototype-variants.md`   | Runnable design variants             | `?variant=` switchers, structurally distinct options, cleanup after winner selection |
| `references/core/typography-wrapping.md`  | Heading/descriptor text changes      | `text-wrap: balance/pretty`, natural phrase breaks at any width, dynamic-viewport verification, `ch` units, Korean keep-all/orphan rules (verified 2026-07-07) |
| `references/core/logo-sections.md`        | Integration/partner logo display     | Marquee CSS, static grid, orphan cell fix, grayscale treatment, no individual hover |
| `references/core/brand-asset-sourcing.md` | Brand logos in UI                    | Simple Icons/SVGL sourcing, AI agent strategy, placeholder hierarchy, legal guide  |
| `references/core/reference-capture.md`    | Cloning/analyzing other sites        | HTML+asset capture mechanics (pageAssets/curl), analysis-only legal line, provenance manifest, never-ship gate |
| `references/core/dropdown-layer.md`       | Dropdowns, selects, menus, pickers   | Unified dropdown design layer (FE-DROPDOWN-LAYER-01): one skin over headless primitives, DS-detection precedence, scope table, mobile sheet |
| `references/core/layout-discipline.md`    | Landing/marketing pages              | Hero, eyebrow, section repetition, bento, zigzag, per-section responsive transforms, hero composition grammar (2026) |
| `references/core/consistency-locks.md`    | Any multi-section page               | Color, shape, theme consistency per page                                           |
| `references/core/responsive-viewport.md`  | Layout or breakpoint changes         | Canonical breakpoints, page containment, container queries, responsive images, safe area, split-screen |
| `references/core/mobile-ux.md`            | Consumer/landing pages with mobile traffic | Thumb zone, touch targets, sticky CTA, mobile section composition, bottom sheet, portrait media |
| `references/core/seo-baseline.md`         | Public-facing sites, SSR/SSG         | SEO meta, JSON-LD, robots.txt, GEO strategies, OG/Twitter cards                    |
| `references/core/a11y-patterns.md`        | Interactive widgets, modals, forms   | ARIA patterns, focus management, keyboard nav, screen reader testing               |
| `references/core/performance-budget.md`   | Launch / audit                       | CWV targets, bundle budgets, font loading, image optimization, build gates         |
| `references/core/theme-switching.md`      | Dark mode / theme                    | CSS custom properties toggle, FOWT prevention, transition, component checklist     |
| `references/core/color-system.md`         | Color tokens, palettes wiring, theme-ready CSS | Token layering, `oklch()` + fallback discipline, `color-mix()`, `light-dark()`, Tailwind v4/shadcn wiring, contrast gates (verified 2026-07-07) |
| `references/core/i18n-global.md`          | Multi-language / RTL                 | RTL layout, pluralization, Intl API, locale switching, content expansion           |
| See also: `dev-uiux-design` skill         | Vague requests, onboarding, UX states | Intent discovery, design isms, product personalities, onboarding/empty/error patterns |
| `references/stacks/react.md`              | React projects                       | Server Components, hooks, state, TanStack Query, shadcn/ui, performance            |
| `references/stacks/nextjs.md`             | Next.js projects                     | App Router, RSC, image optimization, data fetching, middleware                     |
| `references/stacks/vanilla.md`            | HTML+CSS+JS (no framework)           | Zero-dependency, viewport fitting, responsive CSS, progressive enhancement         |
| `references/stacks/svelte.md`             | Svelte/SvelteKit projects            | Svelte 5 Runes, SvelteKit 2 routing/actions, snippets, migration from Svelte 4     |
| `references/stacks/mobile-native.md`      | Native mobile app development        | RN/Expo current pairing, Flutter 3.44, KMP, Swift 6, framework selection           |
| `references/stacks/astro.md`              | Astro projects                       | Islands architecture, multi-framework shell, content collections, SSG/SSR/hybrid   |

Start with `anti-slop.md`, `aesthetics.md`, `responsive-viewport.md`, and `visual-verification.md`. Add domain/locale/stack references only when relevant.
For C2 ordinary app screens (form/table/list/detail), `crud-ui.md` alone suffices; add the style references above for marketing/visual surfaces or C3+ work.

When frontend choices depend on current framework, design-system, browser API,
library behavior, browser-rendered source evidence, or package/source freshness,
read the active `search` skill and follow its source-fetch and evidence-status
rules before treating external material as proof.

### Verification grounding

**STRICT:** For render/executable artifacts (HTML, SVG, games, UI, charts),
run the real renderer: headless browser, screenshot, canvas check, or equivalent.
Observe the actual output yourself, fix what observation reveals, then re-run.
Static parsing confirms well-formed files; it does not prove the artifact is
visually or interactively correct. One clean observation is enough for unchanged
state; do not re-render unchanged output just to repeat evidence.

---

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

Default rules:
- For apps/tools/dashboards, build the actual working surface first, not a marketing hero.
- For Korean-first work, read `korea-2026.md` and `ux-writing-ko.md`.
- For any soft 3D miniature, mascot, chibi, toy-like object, or character-like asset, read `soft-3d-asset-gates.md`.
- For product/brand/object/place/person pages, use concrete visual assets in the first viewport.
- For finance, government, B2B, admin, auth, security, and developer tools, keep visual warmth restrained and subordinate to clarity.
- Every user-facing decision point must justify its existence — defaults first, one primary action per screen, choices demoted to progressive disclosure (`cxc-dev-uiux-design` UX-LAZY-01 owns the gate).
- For text-heavy surfaces (landing, marketing, editorial, public service), apply typography wrapping defaults — see `typography-wrapping.md`. Dashboard table cells are excluded.

---

## 1. Component Identification

When the user describes UI in vague terms (e.g. "접히는 거", "팝업 같은 거"):
1. Recommend the best-fit component with reasoning: `<Name> — <what it does, why it fits>`
2. Confirm, then proceed

If the user already names a specific component, skip this step.
Reference: [component.gallery/components](https://component.gallery/components/)

For new React/Vue/Svelte/Next UI source files, prefer `.tsx` or typed component files when the repo supports TypeScript. Inherit `dev` TypeScript strict-compatibility rules.
If frontend structure is unclear, read existing source-of-truth docs first, then document pages, components, routes, state stores, and build commands in the repo's existing docs before broad implementation.

---

## 1.5 Objective Gates vs Style Samples

Two different kinds of rules live in this skill (see `dev` §0.2):
- **Objective UX gates (STRICT/DEFAULT)** — accessibility baseline (§7, §11), state coverage
  (loading/empty/error/permission), keyboard operability, visible focus, contrast. Missing
  these are review findings.
- **Style direction (STYLE_SAMPLE)** — design thinking (§2), aesthetics, density profiles,
  product personalities, preset tokens, and the concrete values in §4-§5 (palettes, font
  choices, pixel max-widths). These illustrate acceptable choices; they are NOT
  requirements, must not override an existing design system (Design System Detection stays
  MANDATORY), and must never be enforced as universal taste (UX-STYLE-01).
## 2. Design Thinking

> When the user cannot articulate a clear design direction, load `dev-uiux-design` to
> discover intent and choose a direction before implementing here.

Before coding, commit to a domain-correct direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Surface**: Is this a working tool, dashboard, public service, AI workflow, game, landing page, or editorial surface?
- **Tone**: Pick a specific direction. For product tools this often means quiet, dense, trustworthy, and fast rather than loud.
- **Constraints**: Framework, performance budget, accessibility requirements.
- **Signature**: What ONE thing will make this unforgettable? (the signature
  moment; supporting scroll reveals may exist alongside it per
  `motion.md` FE-MOTION-BUCKET-01)

When user intent is vague ("깔끔하게", "모던하게", "just make it look good"), read the `dev-uiux-design` skill and run the User Intent Discovery Protocol before making routing decisions.
If the user cannot answer these questions, use the `dev-uiux-design` skill's structured preference elicitation flow. Offer product references ("Notion 느낌? Linear 느낌?") and visual comparisons.

**Concept pass before code (stub — canonical: `dev-uiux-design` §2.5 UX-CONCEPT-GEN-01):**
for a C2+ new/redesigned expressive or brand-visible surface (page, hero, key
chrome like a top bar) with open design direction — probe `ima2 status`, attempt
`ima2 serve` if down, `$imagegen` only as true fallback — then
generate 5 highly specific candidate mockups of ONE locked concept, then SYNTHESIZE the
best elements across all 5 (NOT pick a single winner) into DESIGN.md and implement from
that synthesis — do not start coding the layout blind.

Intentionality over intensity. Bold maximalism, refined minimalism, dense utility, and friendly consumer UI can all work when they match the domain.

---

## 3. Baseline Configuration

Adjust these dials based on what's being built. Present to user if unclear.

| Dial             | Default | Range | Meaning                              |
| ---------------- | :-----: | :---: | ------------------------------------ |
| DESIGN_VARIANCE  |    5    | 1-10  | 1=symmetric utility, 10=asymmetric art |
| MOTION_INTENSITY |    4    | 1-10  | 1=static, 10=cinematic choreography    |
| VISUAL_DENSITY   |    5    | 1-10  | 1=art gallery airy, 10=cockpit dense   |

After Design Read, set dials per `dev-uiux-design` §2 Dial Setting.

Product density profile (D1-D8 in `references/core/product-density.md`) sets component class; VISUAL_DENSITY (1-10) sets spacing within that class. These are orthogonal axes.

Adapt dynamically based on user requests. Dashboard → density up. Portfolio → variance up. Data tool → motion down.
Korean app/tool surfaces usually need higher density and clearer hierarchy, not oversized hero text.

---

## 4. Implementation

Read `references/core/aesthetics.md` for full guidelines. Summary:

- **Typography**: Use domain-appropriate typography. For Korean-first UIs, prioritize CJK-safe stacks before Latin display fonts. Apply `text-wrap: balance` on all headings **AND short descriptors** (hero subtitle, card description, caption — anything 1-3 lines). Use `text-wrap: pretty` only on body paragraphs (4+ lines). `pretty` has no effect on short text and will leave Korean orphans like "합니다." or "화." on a line alone. See `typography-wrapping.md` for full rules.
- **Color**: Max 1 accent. Use neutral bases (Zinc/Slate) with singular high-contrast accent — avoid purple-on-white. One-note means the ENTIRE page is dominated by variations of a single hue family. One accent color with neutral bases is correct, not one-note.
- **Layout**: Match the product surface. Avoid centered-card/hero patterns in repeated-use tools.
- **Motion**: See `references/core/motion.md`. One signature moment + a few
  supporting reveals > 10 scattered effects; landing-bucket floor/ceiling per
  FE-MOTION-BUCKET-01.
- **Assets**: Use screenshots, product images, diagrams, charts, illustrations, generated bitmaps, or soft 3D only when they add product meaning. Never ship a placeholder. Prefer real/generated image or video assets over CSS gradient washes. Read any design reference or captured screenshot back into context with `view_image` before matching it. Third-party captures follow `reference-capture.md` (analysis-only, provenance manifest).

  1. **Probe**: `ima2 status` → `ima2 serve` if down → recheck.
  2. **Generate**: `ima2 gen` with explicit long prompts; `--ref` for style anchors.
  3. **Inspect**: `view_image` every candidate.
  4. **Synthesize**: element ledger per FE-ASSET-SELECT-01.
  5. **Iterate**: `ima2 edit` for targeted fixes.
  6. **Verify**: browser screenshot of rendered result.

  Fallback: `$imagegen` only when ima2 is truly unavailable.

  `ima2` supports multi-candidate generation (`-n N`, multimode, and independent CLI
  parallel; FE-ASSET-PARALLEL-01), prompt builder, session style sheets, and provider
  routing (GPT/Grok/Gemini; FE-ASSET-PROVIDER-01). Monitor parallel jobs with
  `ima2 ps --json` and cancel unwanted jobs with `ima2 cancel <id>`. For motion assets,
  use `ima2 video` under FE-MOTION-VIDEO-01. Prompts must specify subject, composition,
  palette, lighting, style, and aspect per `asset-requirements.md`.

  Concept mockups guide implementation and are not shipped; production assets require candidate inspection and selection; cutout assets additionally follow FE-ASSET-BG-01.
- **Visual verification**: after UI changes, exercise the flow per `cxc-dev-testing` §4.6 (TEST-CU-QA-01) — `browser:control-in-app-browser` on the dev server, screenshot, `view_image` — instead of claiming visual correctness from code alone.

### Cutout Asset Generation (FE-ASSET-BG-01 surface — STRICT)
Every cutout asset MUST follow `references/core/asset-requirements.md` § Asset Background Strategy; load it with `ima2 skill front ref asset-requirements` when ima2 is available.
---

## 5. Anti-Slop Enforcement

Rule classes (dev §0.2): items below are DEFAULT — deviate with a stated reason; concrete
values and palettes are STYLE_SAMPLE (§1.5); the emoji-as-UI-icon ban is the only STRICT item.

Read `references/core/anti-slop.md` for full rules. Key standards:

### Hero discipline (FE-HERO-01)

- First viewport must fit: hero content leaves a hint of the next section on mobile and desktop.
- Keep hero copy to ~4 text elements max: headline, subhead, primary CTA, one proof/context line.
- Do not put trust strips, pricing teasers, feature bullets, or mini dashboards inside the hero.
- Logo walls belong below the hero, not as hero filler.
- Plan font scale with image/product scale so neither crushes the other.

Before delivery, run the second-order reflex test (FE-REFLEX-TEST-01, `anti-slop.md`) against both the obvious category default and its fashionable opposite.
Audit composite convergence tells under FE-CONVERGENCE-01 (`anti-slop.md`): hairline border+shadow, icon-tile-above-heading, italic-serif-hero, hero-metric template, and other multi-element compositions.

- Treat unexamined default typography as a slop signal. Choose a domain-appropriate stack; Korean-first UI should use CJK-safe fonts and system fallbacks deliberately.
- **Gradient budget (FE-GRADIENT-01)**: gradient soup is the 2026 #1 anti-slop signal; max 1 ambient gradient per viewport and no gradients on 3+ sibling cards — see `anti-slop.md § Gradient Budget`
- **One-note theme ban (FE-ONENOTE-01)**: full-page single-hue dark washes (terminal green, cyber cyan, CRT amber) are the current dark-mode tell — see `anti-slop.md § One-Note Theme Ban`
- **No self-describing meta copy (FE-METACOPY-01)**: UI text must explain the product/user job, never narrate the mockup, layout, responsive behavior, or agent process — see `anti-slop.md § Self-Describing Meta Copy`
- Use neutral or intentional color palettes — purple gradients on white are now the old tell; gradient overuse and one-note single-hue themes are the current tell
- Use asymmetric or purposeful layouts — centered-everything reads as template
- Vary card sizes, spans, and groupings — equal 3-card grids read as generic
- **Bento composition (FE-BENTO-01)**: bento grids must read as one interlocking slab with aligned row edges, a dominant cell, content-weighted spans, and no orphan tail — see `layout-discipline.md § Bento Composition`
- Avoid oversized bold hero text inside tools, dashboards, admin, finance flows, and public services
- **Hero composition (FE-HERO-SPLIT-01)**: never build a split hero (left bold headline + right boxed screenshot/mockup card) unless the user explicitly requests one — the product visual is the stage (full-width, background, or interactive demo), never a right-column card; paid-conversion LPs are the one context to propose it — see `layout-discipline.md § Hero Composition Grammar`
- Avoid asset-free UI: abstract blobs/gradients do not replace real visual evidence
- Avoid generic soft 3D icon packs; soft 3D must be semantic, brand-consistent, and restrained
- **NEVER use emoji as UI visual elements** (feature icons, card icons, section markers, buttons) — emoji in production UI is the #1 AI slop signal. Use SVG icons (Lucide/Phosphor/Heroicons). See `anti-slop.md § Emoji Slop`
- Warm beige/cream backgrounds with brass/clay accents are banned as defaults for premium-consumer briefs — see `anti-slop.md § Premium-Consumer Palette Ban`
- Layout monotony (same family repeated, 3+ zigzag sections, overused eyebrows) — see `references/core/layout-discipline.md`
- Color, shape, and theme must be locked per-page and audited before shipping — see `references/core/consistency-locks.md`
- Use off-black (`#0a0a0a`, `#111`) — pure `#000000` lacks depth
- **Responsive enforcement (DEFAULT)**: every multi-column section must declare its mobile/tablet collapse behavior — "it'll work at mobile" is not a plan. See `responsive-viewport.md`
- **Page containment required**: `max-w-[1400px] mx-auto` or equivalent wrapper. Content stretching to viewport edges on wide monitors is a layout bug
- **Mobile is a different product**: section composition, CTA placement, and interaction model change on mobile — it is NOT just "desktop stacked vertically." See `mobile-ux.md`
- Use realistic, specific names and brands in placeholder content
- Write original copy — avoid "Elevate", "Seamless", "Next-Gen" and similar clichés
- Treat uncontrolled heading line breaks (orphaned single word, no `text-wrap`, no `max-width` in `ch`) as a slop signal — see `typography-wrapping.md`
- Treat short descriptors (hero subtitle, card description, caption) using `text-wrap: pretty` instead of `balance` as a slop signal — `pretty` does nothing on 1-3 line text, especially Korean
- Treat Korean orphan fragments ("합니다.", "화.", "입니다." alone on a line) as a slop signal — always verify Korean text breaks at target viewports
- Treat generic stroke icons as brand logo substitutes as a slop signal — use actual brand SVGs from Simple Icons, SVGL, or press kits. See `brand-asset-sourcing.md`
- When NO design brief exists, do not invent a generic default: apply the domain-gated no-brief kit owned by `dev-uiux-design` §1 UX-DEFAULT-ISM-01 and state the assumption

### Do not ship these tells (FE-AI-TELL-01)
Enforce the complete AI-default tell catalogs in `references/core/anti-slop.md` and `references/core/layout-discipline.md`.
---

## 6. Performance Guardrails
Animate only `transform` and `opacity`; isolate perpetual animation, remove temporary `will-change`, reserve z-index for systemic layers.
Keep grain/noise filters off scrolling containers. Centralize polling/subscriptions; clean up SSE/WebSocket on unmount.
Never open unbounded per-component connections; prefer one multiplexed connection.
For detailed budgets and browser connection limits, read `references/core/performance-budget.md`.
---

## 7. Accessibility Baseline

- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- Keyboard navigation for all interactive elements
- WCAG AA minimum (4.5:1 normal text, 3:1 large text)
- Visible focus indicators (`focus-visible:ring-2`)
- `prefers-reduced-motion` support
- Skip link or equivalent bypass for repeated navigation
- Focus must not be hidden by sticky headers, sticky bottom bars, sheets, or overlays
- Icon-only buttons need accessible names (`aria-label`, visible text, or labelled-by)
- Charts, status messages, loading progress, and AI streaming states need screen-reader labels or live regions where appropriate
- Do not encode meaning by color alone
- Modals, menus, comboboxes, bottom sheets, and command palettes must have a complete keyboard path
- Stress-test Korean long labels and screen-reader names; clipped Hangul is a failure
- Pointer targets follow WCAG 2.2 AA target-size rules; 44×44px is a conservative product baseline, not the only legal minimum

### A11y polish (FE-A11Y-POLISH-01)

- CTA text fits on one line at target breakpoints; if it wraps, shorten the label or change the layout.
- Inputs need visible boundaries against their background in default, focus, error, and disabled states.
- Duplicate CTA intent on the same screen should merge or clearly differ by outcome.
- Button contrast is checked during visual review, not left to palette intent.

---

## 8. React, Forms, and Accessibility
For React hooks, state ownership, performance, and Compiler, read `references/stacks/react.md`.
Custom hooks: only for reusable behavior with explicit inputs, small outputs, honest dependencies, justified effects, correct cleanup. Do not hide server/router/form ownership inside generic hooks.
For forms: follow repo stack and schema-validation conventions; expose field errors accessibly with `role="alert"`.
For widget keyboard paths, focus trapping, ARIA state, and screen-reader testing, enforce `references/core/a11y-patterns.md`.
The objective accessibility baseline in §7 remains mandatory.
---

## 12. Frontend Platform Rules
Prefer project conventions; detect installed framework/version before changing configuration.
Read `references/stacks/react.md` for React 19.2+ features, Compiler, Suspense, Effects, state.
Read `references/stacks/nextjs.md` for Next.js 16 App Router, caching, Server Actions, RSC.
Prefer native CSS (container queries, `:has()`, nesting, subgrid, View Transitions, `dvh/svh/lvh`) before JS observers.
Do not introduce Webpack-era config unless the existing app is Webpack-bound.
Never cache user/session data without an explicit user-scoped key.
Classify state using the table below before adding a store, Effect, or cache.
### State Classification
Before adding state, classify it:
| State type | Owner | Default tool |
|---|---|---|
| render-local UI | nearest component | `useState` / `useReducer` |
| derived | render calculation | expression / `useMemo` if expensive |
| form draft | form boundary | native form, React Hook Form, TanStack Form |
| server/cache | server/cache layer | RSC, Next cache, TanStack Query, SWR |
| URL/navigation | router | path params, search params |
| global client UI | external store | Zustand, Jotai, context |
| optimistic mutation | mutation boundary | `useOptimistic`, mutation library |
| AI stream | conversation boundary | append-only message model + stream status |

Rules: Do not store derived state just to sync with Effect. Do not put server state in Zustand. Do not put URL-shareable state only in component state. Keep optimistic state reversible.

Before creating tokens, run Design System Detection (MANDATORY): check `package.json` for installed systems, existing tokens/themes, and the brief.
**Aesthetic honesty (FE-AESTHETIC-HONESTY-01):** aesthetic directions are not official design systems.
For shadcn/ui, inspect local components and follow `components.json`, aliases, tokens, and registry.
AI-native interfaces must represent real states; never fake streaming, citations, or tool calls.
---

## 13. Error Boundaries

React Error Boundary pattern:
- Wrap each major section (not the entire app) in an Error Boundary
- Error boundary renders: friendly message + retry button + report link
- Log error to monitoring service (Sentry, etc.) in componentDidCatch
- Never show stack traces to end users

Error state hierarchy:
1. Field-level: inline validation message
2. Form-level: summary at top of form
3. Section-level: Error Boundary with retry
4. Page-level: `error.tsx` / error page
5. App-level: root Error Boundary → offline/crash page

---

## 15. Backend Contract & Security Alignment

Frontend does not operate in isolation. When consuming backend APIs or implementing security-sensitive UI:

### 15.1 Contract Ownership

| Responsibility | Owner |
|---------------|-------|
| Response envelope shape (`success`, `data`, `error`, `meta`) | `dev-backend` defines, `dev-testing` verifies |
| Consumer-side fixture alignment | **Frontend** — keep mocks in sync with `fixtures/contracts/` |
| Contract test triggers | Frontend payload changes → update contract tests BEFORE merging (see `dev-testing` §3) |
| Error display mapping | Frontend maps `error.code` to user-facing messages; never parse `error.message` for logic |

**When a frontend change touches API consumption:**
1. Check if the response shape assumption still holds
2. If changed, update or add a contract test first (see `dev-testing` §3.5)
3. Align frontend mocks/fixtures with backend golden examples

### 15.2 Security Responsibilities

| Control | Policy Owner | Implementation Owner |
|---------|-------------|---------------------|
| CSP directives | `dev-security` §5 | Frontend (no inline scripts, no `eval`, no surprise 3rd-party scripts) |
| CORS | `dev-security` §5 | Backend middleware (`dev-backend` §4) |
| XSS prevention | `dev-security` §5 | Frontend (avoid `dangerouslySetInnerHTML`; if needed, sanitize with DOMPurify + CSP defense) |
| Token storage | `dev-security` §2 | Frontend (`httpOnly` cookies preferred over `localStorage`) |
| Auth state display | `dev-security` §2 | Frontend (loading → check → redirect or render; never flash protected content) |

### 15.3 Testing Integration

- Playwright smoke tests validate rendered flows AFTER backend API + contract tests pass
- Frontend unit tests mock API responses using the **same envelope shape** defined in `dev-backend` §5
- When backend error codes change, frontend error-mapping tests must be updated

## §16 Pre-Flight Checklist

Before shipping a production frontend surface, run through the full pre-flight checklist
at `references/core/preflight-full.md`. It covers design/composition, responsive/mobile,
states/behavior, Korean-first rules, SEO/theme/i18n, and performance/verification gates.
Use it as the C-phase audit companion for frontend work at C2+.
