## Modular References

| File                                      | When to Read                         | What It Covers                                                                    |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `crud-ui.md`              | C2 list/detail/form product screens  | State coverage (loading/empty/error/permission), forms, objective UX gates         |
| `anti-slop.md`            | New/redesigned visual surfaces, visual audits, and variant generation | 2026 AI slop patterns, Korean slop, oversized text, fake assets, default UI smells |
| `../../../dev-uiux-design/references/design-trends.md` | Calibrating a dated design example | Source provenance, surface-specific exceptions, and re-verification before promoting a sample to a default |
| `../../../dev-uiux-design/references/design-trends.md` | Implementing a dated trend or checking whether a technique is stable | 2026-07-14 axis prevalence, technique maturity, signature status, risks, and re-crawl/promotion rules |
| `aesthetics.md`           | Implementing an established visual direction | Domain-correct typography, color, composition constraints, serif three-role system, expressive/functional layers, AI-brand grammar |
| `product-density.md`      | Apps, tools, dashboards              | Density profiles for landing, consumer app, SaaS, ops, finance, devtools          |
| `asset-requirements.md`   | Any public/product/visual surface    | Required screenshots, images, diagrams, charts, generated bitmaps, or 3D assets, mockup production pipeline   |
| `visual-verification.md`  | Changes affecting rendered layout    | Screenshot, viewport, text fit, state, asset, and motion verification              |
| `token-source-divergence.md` | Changing colour, type, spacing, or breakpoint values in a repo that declares the same tokens in two or more places | Source inventory, authority and sync arrangement, one-sided-change gate, literal classification, rendered parity |
| `content-surface-pipeline.md` | Speeding up or changing a surface produced repeatedly by a content-design-development chain; read alongside `layout-discipline.md` (layout grammar) and `asset-requirements.md` (asset production), which own different questions about the same pages | Mapping the handoff, locating the constraining step, multi-path render resolution, data-injected style, preview fidelity, per-block QA, release coupling |
| `../../../dev-uiux-design/references/conversational-ai.md` | Implementing a turn-based AI surface with streaming, interruption, regeneration, or uncertain results | Turn-state contract the frontend must preserve before wiring rendering and a11y |
| `korea-2026.md`           | Korean-first or Korea-facing UI      | Korean service patterns, CJK typography, formats, mobile flows, Korean serif/myeongjo display                     |
| `ux-writing-ko.md`        | Korean UI copy                       | Natural Korean labels, error messages, tone, spacing, punctuation                  |
| `soft-3d-asset-gates.md`  | 3D/miniature/character-like visuals  | Toss-style soft 3D vs generic cute asset slop, domain gates                        |
| `motion.md`               | Motion/animation needed              | CSS animations, Framer Motion, CSS scroll-driven timelines, pointer-proximity chip motion (magnetic/dock), View Transitions, domain gates, organic bg + capsule label, product-led hero motion |
| `liquid-glass.md`         | Translucent materials, glass chrome, pill-chip surfaces | Liquid Glass layer discipline, named material states (pill-at-top/pill-scrolled/media-overlay/clear), FE-PILL-NEST-01, blur-free pill alternative, perf + a11y gates |
| `top-bar.md`              | Top/nav bar composition, sticky chrome | Top-bar grammar: geometry, slots, scroll-state contract (FE-TOPBAR-STATE-01), hover-surface contract (FE-TOPBAR-HOVER-01), domain gate, mobile collapse |
| `iterative-design.md`     | Multi-round design                   | LLM convergence problem, Diverge→Kill→Mutate process, upgrade techniques           |
| `prototype-variants.md`   | Runnable design variants             | `?variant=` switchers, structurally distinct options, cleanup after winner selection |
| `typography-wrapping.md`  | Heading/descriptor text changes      | `text-wrap: balance/pretty`, natural phrase breaks at any width, dynamic-viewport verification, `ch` units, Korean keep-all/orphan rules (verified 2026-07-07) |
| `logo-sections.md`        | Integration/partner logo display     | Marquee CSS, static grid, orphan cell fix, grayscale treatment, no individual hover |
| `brand-asset-sourcing.md` | Brand logos in UI                    | Simple Icons/SVGL sourcing, AI agent strategy, placeholder hierarchy, legal guide  |
| `reference-capture.md`    | Cloning/analyzing other sites        | HTML+asset capture mechanics (pageAssets/curl), analysis-only legal line, provenance manifest, never-ship gate |
| `dropdown-layer.md`       | Dropdowns, selects, menus, pickers   | Unified dropdown design layer (FE-DROPDOWN-LAYER-01): one skin over headless primitives, DS-detection precedence, scope table, mobile sheet |
| `layout-discipline.md`    | Landing/marketing pages              | Hero, eyebrow, section repetition, bento, zigzag, per-section responsive transforms, hero composition grammar (2026) |
| `section-level-sourcing.md` | Section-level design work (hero, pricing, testimonials, etc.) | Per-section-type reference sources from Land-book, One Page Love, Lapa.ninja |
| `consistency-locks.md`    | Any multi-section page               | Color, shape, theme consistency per page                                           |
| `responsive-viewport.md`  | Layout or breakpoint changes         | Canonical breakpoints, page containment, container queries, responsive images, safe area, split-screen |
| `mobile-ux.md`            | Consumer/landing pages with mobile traffic | Thumb zone, touch targets, sticky CTA, mobile section composition, bottom sheet, portrait media |
| `seo-baseline.md`         | Public-facing sites, SSR/SSG         | SEO meta, JSON-LD, robots.txt, GEO strategies, OG/Twitter cards                    |
| `a11y-patterns.md`        | Interactive widgets, modals, forms   | ARIA patterns, focus management, keyboard nav, screen reader testing               |
| `performance-budget.md`   | Launch / audit                       | CWV targets, bundle budgets, font loading, image optimization, build gates         |
| `theme-switching.md`      | Dark mode / theme                    | CSS custom properties toggle, FOWT prevention, transition, component checklist     |
| `color-system.md`         | Color tokens, palettes wiring, theme-ready CSS | Token layering, `oklch()` + fallback discipline, `color-mix()`, `light-dark()`, Tailwind v4/shadcn wiring, contrast gates (verified 2026-07-07) |
| `i18n-global.md`          | Multi-language / RTL                 | RTL layout, pluralization, Intl API, locale switching, content expansion           |
| See also: `dev-uiux-design` skill         | Vague requests, onboarding, UX states | Intent discovery, design isms, product personalities, onboarding/empty/error patterns |


## §16 Pre-Flight Checklist

Before shipping a production frontend surface, run through the full pre-flight checklist
at `preflight-full.md`. It covers design/composition, responsive/mobile,
states/behavior, Korean-first rules, SEO/theme/i18n, and performance/verification gates.
Use it as the C-phase audit companion for frontend work at C2+.
