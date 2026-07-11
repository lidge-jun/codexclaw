# Full Pre-Flight Checklist (launch/audit depth)

Companion to `dev-frontend/SKILL.md` §14. The router keeps the minimum blocking gates;
this file is the full launch/audit list. Production surfaces only (`dev` §0.4).

## Design & composition
- [ ] Domain-correct direction chosen and committed
- [ ] Product surface, locale, density, asset need, soft 3D gate, motion intensity classified
- [ ] Anti-slop patterns enforced (SKILL §5)
- [ ] Oversized hero text avoided unless a true hero surface
- [ ] Required assets are real, semantic, rendered — not generic decoration
- [ ] Soft 3D/miniature/character assets pass domain and semantic gates
- [ ] Eyebrow count ≤ ceil(sectionCount / 3) (layout-discipline.md)
- [ ] Section layout diversity: ≥4 different families per 8 sections
- [ ] Color/shape/theme locks consistent across all sections (consistency-locks.md)

## Responsive & mobile
- [ ] Mobile layout collapse guaranteed with per-section-type rules (layout-discipline.md § Responsive Transforms)
- [ ] Full-height sections use `min-h-[100dvh]` not `h-screen`
- [ ] Page containment: `max-w-[1400px] mx-auto` (responsive-viewport.md)
- [ ] Tested at 768px (tablet) and 1024px (split-screen) plus mobile/desktop
- [ ] Touch targets ≥ 44px on mobile; no hover-only interactions (mobile-ux.md)
- [ ] Responsive images use `srcset`/`sizes` or `<picture>` (responsive-viewport.md)
- [ ] Safe-area padding on fixed elements: `env(safe-area-inset-*)`

## States & behavior
- [ ] Loading, empty, and error states provided
- [ ] State classified before adding store/Context/Effect/cache (SKILL §12)
- [ ] Effects sync with external systems; derived state is not Effect-synced
- [ ] Container queries considered before viewport-query or JS layout workarounds
- [ ] View transitions respect reduced motion
- [ ] shadcn components follow local registry and token conventions
- [ ] AI UI states honest: no fake streaming, citations, or tool calls
- [ ] Forms validate with schema and show field-level errors (SKILL §8)
- [ ] Focus management on modals and popovers (SKILL §7)
- [ ] Interactive components isolated as Client Components (if RSC)
- [ ] Error Boundaries wrap major sections, not the entire app (SKILL §13)

## Korean-first
- [ ] CJK typography and Korean UX writing rules followed (korea-2026.md, ux-writing-ko.md)
- [ ] `word-break: keep-all`; `text-wrap: balance` on short descriptors
- [ ] Rendered screenshot check for lone particles/endings ("합니다.", "화.") at target viewports

## SEO, theme, i18n
- [ ] SEO meta present for public pages (title, description, canonical, OG) — seo-baseline.md
- [ ] JSON-LD structured data matches page type
- [ ] Theme toggle works: light/dark/system, no FOWT — theme-switching.md
- [ ] All colors use CSS custom properties (theme-ready)
- [ ] i18n: no hardcoded strings, CSS logical properties, Intl API — i18n-global.md

## Performance & verification
- [ ] Core Web Vitals field gate: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 - performance-budget.md
- [ ] Lighthouse Performance score is advisory smoke only; CWV field metrics are the gate; no JS bundle > 150KB compressed
- [ ] Hero image preloaded, below-fold images lazy-loaded; landing motion media exempt from byte caps only when FE-MEDIA-BUDGET-01 poster-first/loading mechanics hold
- [ ] Desktop/mobile/narrow screenshots checked for overlap, clipping, asset rendering
- [ ] No captured third-party asset (reference-capture.md) in the shipped build; capture manifest present for any reference captures
- [ ] Accessibility deep pass: modals trap focus, live regions — a11y-patterns.md
- [ ] Stack-specific rules followed (references/stacks/)
