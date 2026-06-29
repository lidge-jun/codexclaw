# Layout Discipline Rules

## Hero Discipline (MANDATORY)
1. Hero MUST fit initial viewport — headline ≤2 lines, subtext ≤20 words, CTA visible
2. Font-scale: plan font + image together; default text-4xl md:text-5xl lg:text-6xl
3. Top padding cap: max pt-24 (6rem) at desktop
4. Stack discipline: max 4 text elements (eyebrow|brand-strip, headline, subtext, CTAs)
5. Banned inside hero: tagline below CTAs, trust strip, pricing teaser, feature bullets
6. "Used by" logo wall → separate section directly below hero

## Eyebrow Restraint (MANDATORY)
- Maximum 1 eyebrow per 3 sections (hero counts as 1)
- Pre-flight mechanical check: count uppercase+tracking instances ≤ ceil(sectionCount / 3)
- Alternative: drop the eyebrow. Headline alone is enough.

## Section Layout Repetition Ban
- Each layout family (3-col cards, split-text-image, full-width-quote, etc.) at most ONCE per page
- 8-section page needs ≥4 different layout families
- Cross-ref: aesthetics.md § Spatial Composition also bans 3-col cards and centered heroes

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
