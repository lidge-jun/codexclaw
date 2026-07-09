# 000 — Research: Liquid Glass / Apple-Circular / Dynamic Icon-Chip Motion (2026)

Goal: gather Tier-2-proven evidence to improve `cxc-dev-frontend` and
`cxc-dev-uiux-design` with 2026-current guidance on (1) Apple-style
rounded/pill ("원형 애플식") design + Liquid Glass, and (2) scroll/mouse-driven
dynamic icon-chip motion. Session `019f3957-f9a8-7f50-ae6b-42d4c0f6e77a`,
goalplan `improve-cxc-dev-frontend-cxc-dev-uiux-design-wit`, WP1.

## Claim ledger

| # | Claim | Source | Date opened | Tier |
|---|-------|--------|-------------|------|
| 1 | aside.com design anatomy (below) | https://aside.com/ via `agbrowse fetch` + CDP screenshots + computed-style probe | 2026-07-07 | Tier 2 (rendered + measured) |
| 2 | dcinside 특이점 갤러리 "프론트/웹/디자인 팁" content (below) | https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=1291953 (`agbrowse fetch`, verdict `strong_ok`) | 2026-07-07 | Tier 2 (text; 12 inline images not retrievable) |
| 3 | Liquid Glass = functional layer for controls/nav floating above content; never in content layer; use sparingly; `regular` vs `clear` variants; regular blurs + adjusts luminosity + scroll-edge effects; clear only over visually rich backgrounds; appearance responds to reduce-transparency / increase-contrast accessibility settings | https://developer.apple.com/design/human-interface-guidelines/materials (opened via agbrowse CDP) | 2026-07-07 | Tier 2 |
| 4 | CSS scroll-driven animations module: `animation-timeline`, `scroll()`, `view()`, `animation-range(-start/-end)`, `scroll-timeline-*`, `view-timeline-*`, `timeline-scope`, `ScrollTimeline`/`ViewTimeline` interfaces; animates along scroll progress instead of time | https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations (opened via agbrowse CDP) | 2026-07-07 | Tier 2 |
| 5 | Apple HIG has dedicated pages: Materials, Motion, Adopting Liquid Glass, Liquid Glass technology overview | developer.apple.com HIG index (seen while opening #3) + hosted search corroboration | 2026-07-07 | Tier 2 (index observed) |
| 6 | Magnetic-hover pattern: `pointermove` + rAF-batched `transform: translate3d`, displacement = cursor offset x strength (0.2-0.5), reset on `pointerleave`, gate behind `@media (hover: hover) and (pointer: fine)` | hosted web_search synthesis over MDN pointer-events/rAF docs + tutorials | 2026-07-07 | Tier 1 (pattern corroborated across snippets; no single page opened) |
| 7 | Dock-style proximity magnification: per-chip distance-to-cursor falloff mapped to scale/translate, influence radius, `transform-origin: bottom`, rAF batching | hosted web_search synthesis (macOS-dock tutorials, Framer Motion docs snippets) | 2026-07-07 | Tier 1 |
| 8 | `backdrop-filter: blur()` is one of the most expensive CSS effects: cost scales with blurred area x radius; GPU acceleration not guaranteed; keep surfaces small, radius low, never on scrolling containers | hosted web_search (web.dev/MDN/Safari release-note snippets) | 2026-07-07 | Tier 1 (directionally consistent across sources; treat exact numbers as unverified) |

## 1. aside.com anatomy (user's named reference, Tier 2)

Measured on the live page (CDP `getComputedStyle` sweep over 1054 elements,
2026-07-07):

- **Pill-first geometry**: 33 elements with effectively-infinite border-radius
  (`1.67772e+07px` — the fully-rounded pill). Radius tiers below that:
  8.4px (23x), 11.2px (19x), 16.8px (10x), 22.4px/33.6px (page-level containers).
  A clear 3-tier radius scale + pill class, not one global radius.
- **Typography**: Geist. Large, short, declarative headlines that end with a
  period ("The most intelligent AI assistant, but it's a browser.",
  "Crafted for both human and agent. Start using today."). Apple-newsroom
  cadence: sentence-case, no exclamation, benefit-as-statement.
- **Glass without blur**: `backdrop-filter` count on the rendered page = 0.
  The "liquid glass" feel comes from translucent WHITE pills/cards floating
  over soft photographic/pastel backgrounds (sky photo hero, pink/teal/green
  gradient card washes), not from actual backdrop blur. Cheap and legible.
- **Composition**: whole page reads as one giant rounded container (macOS
  window metaphor); hero = full-bleed sky photo + centered copy + one black
  pill CTA + one bordered pill eyebrow chip ("Backed by Y Combinator");
  feature rows = 3 pastel-gradient rounded cards, each with a real product
  screenshot and a floating white prompt pill ("Get my paystubs for this
  month", "Monday 8AM" / "Thursday 4PM" choice chips).
- **Chips as content**: prompt strings, scheduling options, bookmark items
  (Gmail/Figma/WhatsApp/Vercel with real brand icons) are all rendered as
  pill chips — the chip IS the primary content unit, not decoration.
- Screenshots: `~/.browser-agent/screenshots/screenshot_1783373904378.png`
  (hero), `_1783373934559.png` (feature cards), `_1783373952776.png`
  (password section), `_1783373979898.png` (final CTA).

## 2. dcinside 특이점 갤러리 1291953 "[작업] 프론트?웹?디자인?팁" (은대리, 2026-07-05, Tier 2)

Designer-written color discipline post (8.7k views, +52). Key content:

- Think in **HSL**, not hex: H = hue family, S = punchiness, L = brightness.
  Understand palette structure through HSL even if you write hex.
- **Reduce hue count**: analogous hues + ONE accent. Before/after examples
  (12 images, not retrievable via fetch) show "navy + one accent" beating a
  colorful layout. "AI가 말아주는 프론트가 엉망인 것처럼 느껴지는 이유 =
  의미부여하는 색이 너무 많아."
- **Von Restorff effect**: when everything is emphasized, nothing is.
  Semantic colors (green notice / yellow warn / red danger + bg + text)
  already consume the hue budget.
- **Token discipline**: explicitly constrain allowed colors; derive shades
  via lightness/saturation (and alpha, if confident) from few base hues.
- **Tinted neutrals**: pure #000 dark modes are rare and eye-straining; mix
  slight red/blue into black, slight yellow into white for warmth.
- **Brand-first theming**: build icon/logo/symbol identity first (or
  together), then melt the brand into the app theme = frontend principle.
- Tools: Adobe Color (color.adobe.com/create/color-wheel), tweakcn
  (tweakcn.com/editor/theme, shadcn/ui theme codegen), coolors.co/generate.

Overlap check vs existing skills: max-1-accent and off-black already exist in
`dev-frontend` (aesthetics/anti-slop). NEW nuggets worth patching: HSL-derived
token families, tinted-neutral rule (beyond off-black), brand-first theming,
tweakcn/Adobe Color as tools, Von Restorff naming for the accent budget.

## 3. Apple Liquid Glass (HIG Materials, Tier 2)

- Liquid Glass is a **functional-layer material**: controls + navigation
  (tab bars, sidebars, floating controls) sit on it, floating ABOVE the
  content layer. Content scrolls and "peeks through" beneath.
- **Never in the content layer** (backgrounds, cards-as-content). Exception:
  transient interactive elements (slider/toggle during interaction).
- **Use sparingly** on custom controls; it exists to bring attention to
  underlying content — overuse distracts and degrades UX.
- Two variants: **regular** (blurs + adjusts luminosity, scroll-edge effects
  keep text legible; default for alerts/sidebars/popovers/text-heavy) and
  **clear** (no blur backing; ONLY over visually rich backgrounds).
- Appearance responds to user settings: preferred Liquid Glass look,
  **Reduce Transparency**, **Increase Contrast** — web ports must honor
  `prefers-reduced-transparency` and `prefers-contrast`.

## 4. CSS scroll-driven animations (MDN, Tier 2)

- Module: `animation-timeline: scroll(<scroller> <axis>)` / `view(<axis>
  <inset>)`; `animation-range` (e.g. `entry 0% cover 40%`);
  `scroll-timeline-name/-axis`, `view-timeline-name/-axis/-inset`,
  `timeline-scope`; JS `ScrollTimeline` / `ViewTimeline`.
- Animates property values along scroll progress instead of time — compositor
  driven, replaces scroll-listener + style-write JS for reveal/progress
  patterns. (Baseline caveat: verify current browser support before shipping;
  Firefox support landed late — flag as check-before-use.)

## 5. Cursor-proximity motion patterns (Tier 1 synthesis)

- **Magnetic hover**: track `pointermove` on a padded hit-area, compute
  offset from element center, apply `transform: translate3d(dx*k, dy*k, 0)`
  with k≈0.2-0.5 via rAF (or spring lib); reset with transition on
  `pointerleave`. Gate: `@media (hover: hover) and (pointer: fine)`, honor
  `prefers-reduced-motion`.
- **Dock magnification / chip clusters**: for each chip, scale =
  f(distance(cursor, chip center)) with a linear/gaussian falloff inside an
  influence radius; `transform-origin: bottom`; one shared rAF loop writes a
  CSS variable (`--mouse-x`) consumed by children — avoids N listeners.
- Both patterns are transform/opacity-only → §6 perf rules already apply.

## Open leads (not settled, candidates for a later pass)

- `mask`-composited "progressive blur" liquid-glass web recipes (SVG filter
  displacement approaches) — Tier 1 only, needs a proven source before
  entering a skill.
- Chrome DevRel scroll-driven-animations demo library (scroll-driven-animations.style) — discovered, not opened.
- `prefers-reduced-transparency` browser support matrix — check before
  stating as universally available.

## Verdicts required by goalplan c-a

- aside.com: `agbrowse fetch --browser never` verdict `blocked` (bot-gate on
  plain HTTP) BUT full text extracted; CDP render + 4 screenshots + computed
  style probe succeeded → treated as Tier-2 proven.
- dcinside 1291953: verdict `strong_ok`, full post text + list context
  extracted. Inline images (12) not retrievable textually — noted as a gap,
  content understood from prose.
