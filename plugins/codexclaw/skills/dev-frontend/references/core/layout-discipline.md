# Layout Discipline Rules

## Hero Discipline (MANDATORY)
1. Hero MUST fit initial viewport — headline ≤2 lines, subtext ≤20 words, CTA visible
2. Font-scale: plan font + image together; default text-4xl md:text-5xl lg:text-6xl
3. Top padding cap: max pt-24 (6rem) at desktop
4. Stack discipline: max 4 text elements (eyebrow|brand-strip, headline, subtext, CTAs)
5. Banned inside hero: tagline below CTAs, trust strip, pricing teaser, feature bullets
6. "Used by" logo wall → separate section directly below hero

## Hero Composition Grammar (verified 2026-07-09)

The classic SaaS split hero — left bold headline + subcopy + CTA, right boxed
product screenshot/mockup card — is the exhausted Stripe(2020)->Linear(2023)
template lineage; "Linear Design" is now a reproducible kit/template category
(LogRocket 2026-02-03). Treat it as a slop signal on brand/product homepages.
**FE-HERO-SPLIT-01: never choose a split hero unprompted — build one ONLY when
the user explicitly requests a split/2-column hero.** The one context where it
is worth *proposing* is a conversion-focused paid-acquisition landing page
where 5-second clarity beats brand memorability (Unbounce anatomy) — but even
there, suggest it and let the user decide; no universal A/B evidence favors
either shape (VWO). "This looks like a landing page" is NOT an exception.

Core inversion (DEFAULT): **the product visual is the STAGE, not a polite
right-column card.** Choose from the verified replacement menu (heroes
live-checked 2026-07-09):

| Composition | Shape | Verified users |
| --- | --- | --- |
| Centered stacked over media | centered headline + CTA over full-width media/video/canvas | OpenAI, Dia, Framer, Raycast |
| Product-as-stage | headline spans the width; huge product UI rises full-width BELOW, not beside | Linear, Cursor |
| Editorial opener | large text-led mission headline, no screenshot; editorial modules follow | Anthropic |
| Evolved split | copy left + giant animated canvas/visual behind/right — never a boxed screenshot card | Stripe, Vercel |
| Full-bleed consumer hero | centered copy over full-bleed photography/brand imagery | Toss |

Rules (DEFAULT):
- Without an explicit user request for a split hero (FE-HERO-SPLIT-01), do not
  place a boxed screenshot, media, or device-mockup card in a right column of
  the hero. If the product must appear in the first viewport, make it
  full-width, background, environment, or an interactive demo surface.
- **FE-HERO-LIGHT-CENTER-01 (DEFAULT): Light Centered Display Hero.** A centered
  hero headline is allowed as an intentional named pattern when the headline is
  LIGHT weight (300-400, explicitly not bold), set over a full-width real media
  or motion backdrop (photography, generated texture, or video; never a
  gradient wash), with generous whitespace and a minimal copy stack (FE-HERO-01
  copy budget still applies). Evidence: OpenAI announcement grammar; aside.com
  measured 2026-07-10 with a custom display variable font, weight 400, 36px,
  centered, over soft sky photography. The generic centered BOLD hero plus
  template composition remains banned. This exception exists ONLY when the
  light-weight headline and authored-media backdrop conditions both hold.
  Composition ownership lives here; type exemplar details live in
  `aesthetics.md` / `design-isms.md`.
- Korean note: "left bold Pretendard headline + right mockup" is the same dead
  template in Korean surfaces; Toss itself uses centered copy over full-bleed
  imagery, not a split.
- Replacement trend labels: story-driven heroes, scrollytelling, immersive 3D,
  dimensionality/layers (SaaSFrame / Figma / Digidop / Contra, 2025-2026).

Sources: LogRocket "Linear Design" (2026-02-03); Nordcraft "why do all websites
look the same" (2024-09-03); Rectangle "The Linear effect" (2023-01-10); live
hero inspections of openai.com, linear.app, cursor.com, anthropic.com,
stripe.com, vercel.com, raycast.com, diabrowser.com, framer.com, toss.im
(2026-07-09); Unbounce landing-page anatomy; VWO A/B testing guide.

## Eyebrow Restraint (MANDATORY)
- Maximum 1 eyebrow per 3 sections (hero counts as 1)
- Pre-flight mechanical check: count uppercase+tracking instances ≤ ceil(sectionCount / 3)
- Alternative: drop the eyebrow. Headline alone is enough.

## Section Layout Repetition Ban
- Each layout family (3-col cards, split-text-image, full-width-quote, etc.) at most ONCE per page
- 8-section page needs ≥4 different layout families
- Cross-ref: aesthetics.md § Spatial Composition also bans 3-col cards and
  centered heroes, except the named FE-HERO-LIGHT-CENTER-01 pattern above.

## Zigzag Alternation Cap
- Max 2 consecutive left-image/right-text alternating sections
- 3rd consecutive = fail. Break with full-width, vertical-stack, bento, or different family
- Note: aesthetics.md recommends zigzag as alternative to 3-cards — that's fine for 1-2 uses, this rule caps overuse

## Split-Header Ban
- "Left big headline + right small explainer paragraph" as section header: BANNED as default
- Stack vertically: headline on top, body below, max-width 65ch

## Bento Rules
- Cell count: EXACTLY as many cells as content items. No empty cells.
- Background diversity: ≥2-3 cells need real visual variation (image, gradient, pattern)
- Rhythm: no one-sided repetition (6 left-image/right-text rows)

### Bento Composition (FE-BENTO-01, DEFAULT)

A bento is one composed object, not a pile of cards. Catch these failures before styling:

- **Ragged rows**: cells in the same visual row ending at different heights with dead air below the short ones. Compose on an explicit grid (`grid-template-rows` / `grid-row: span n`) so every row edge lands on a shared line. If a cell can't fill its slot, its span is wrong or its content is thin.
- **Uniform-span monotony**: 6+ cells all 1x1 is a card grid wearing a bento costume. A real bento has 1 dominant cell (2x2 or 2x1) and clear size hierarchy: big = most important, not "whatever fit".
- **Span-content mismatch**: cell size must track content weight. A 2x2 cell holding one metric, or a 1x1 cell with a cramped 4-row table, both fail. Resize the cell or recut the content.
- **Orphan tail row**: last row with 1 cell + void. Re-span the tail cell to full width or merge its content upward.
- **Sealed-box syndrome**: every cell = same radius + same border + same padding + same background. Vary surface treatment: let 1-2 cells go borderless, let an image bleed to cell edges, let one cell be a flat stat with no chrome.
- **Density whiplash**: one cell packed with a data table next to a cell holding 3 words. Balance per-cell content weight before styling.
- **Gap drift**: one `gap` value for the whole bento, followed by random local margins, breaks the object illusion.

**Pre-ship check**: screenshot the bento, squint. If it reads as one interlocking slab, pass. If it reads as boxes floating near each other, recompose spans before touching colors.

## Section Content Limits
- Default per section: short headline (≤8 words) + sub-paragraph (≤25 words) + one visual/CTA
- Long lists (>5 items): use cards/tabs/accordion/scroll-snap/carousel, not default <ul>
- Carousel is for browsing long homogeneous lists (product catalog, image gallery), NOT a default response to "복잡한" or "complex" briefs. If Design Read does not specify list-browsing UX, do not add carousels.
- Spec sheets: 2-col card grid, scroll-snap pills, grouped chunks, or featured-vs-rest
- Quotes: max 3 lines, attribution = name + role [+ company]

## Page Containment (MANDATORY)
See `responsive-viewport.md` for the canonical containment rule (`max-w-[1400px] mx-auto`) and full explanation. Full-bleed sections break out with `w-screen` or negative margins; content inside stays contained.

## Responsive Transforms by Section Type (MANDATORY)

Every section type MUST declare its behavior at each viewport tier. "Tailwind handles it" is not a responsive strategy.

### Hero
- **Desktop (≥1024px)**: Side-by-side text+image or full-bleed. `text-4xl md:text-5xl lg:text-6xl`.
- **Tablet (768-1023px)**: Stack image behind/above, text below. One font-scale step down.
- **Mobile (<768px)**: Vertical stack. Image max 60vh. `text-3xl` max. Subtext ≤15 words. CTA visible without scroll. Full-width button.

### Split Text-Image (60/40, 50/50)
- **Desktop**: Side-by-side columns.
- **Tablet**: Side-by-side if container ≥900px with tighter gap; stack if container <900px (use `@container`, not viewport).
- **Mobile**: Always stack. Image first (product/visual), text first (story/narrative). Never side-by-side.

### Multi-Column Cards/Features (3+ columns)
- **Desktop**: `grid-cols-3` or `grid-cols-4`.
- **Tablet**: `grid-cols-2`.
- **Mobile**: `grid-cols-1`. Limit visible to 3-4 cards; rest behind "Show more" or horizontal scroll-snap.

### Full-Width Quote
- **Desktop**: Large text, generous padding.
- **Tablet**: Same layout, one font-scale step down.
- **Mobile**: `text-xl` max. `px-6`. Attribution inline below quote.

### Bento Grid
- **Desktop**: Multi-cell asymmetric layout.
- **Tablet**: Reduce to 2-column grid.
- **Mobile**: Single column. Each cell full-width.

### Zigzag (Alternating Left/Right)
- **Desktop**: Left/right alternation.
- **Tablet**: Same if container ≥900px, else stack (use `@container`).
- **Mobile**: Always stack. Consistent order (no alternation). Pick image-then-text or text-then-image and keep it.

### CTA Section
- **Desktop**: Centered with breathing room.
- **Tablet**: Same, tighter padding.
- **Mobile**: Full-width button. Remove decorative elements. Consider sticky bottom bar (see `mobile-ux.md`).

### Logo Wall
- **Desktop**: Horizontal row or multi-row grid.
- **Tablet**: Wrap to 2 rows if needed.
- **Mobile**: Horizontal scroll-snap marquee or compact 2×3 grid. No orphan cells.

### Pricing/Spec Grid
- **Desktop**: 2-3 column card layout.
- **Tablet**: 2 columns.
- **Mobile**: 1 column. Featured plan first. Comparison table → accordion.
