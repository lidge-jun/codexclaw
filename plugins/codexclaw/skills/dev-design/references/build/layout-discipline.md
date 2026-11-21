# Layout Discipline Rules

## Hero Discipline (MANDATORY)
1. Hero MUST fit initial viewport — headline ≤2 lines, subtext ≤20 words, CTA visible
2. Font-scale: plan font + image together; default text-4xl md:text-5xl lg:text-6xl
3. Top padding cap: max pt-24 (6rem) at desktop
4. Stack discipline: max 4 text elements (eyebrow|brand-strip, headline, subtext, CTAs)
5. Banned inside hero: tagline below CTAs, trust strip, pricing teaser, feature bullets
6. "Used by" logo wall → separate section directly below hero

## Hero Composition Grammar (revised 2026-11-21)

### Alignment (FE-HERO-ALIGN-01, DEFAULT, owner A/B + survey 2026-11-21)

- **Short heroes are centered by default.** A headline of two short lines, one sub-line
  and one or two buttons sits on the center axis, with the product, a photo or nothing
  below it. Owner blind A/B: centered won 4 of 4 head-to-heads (with the product below,
  copy only, same layout with only alignment changed). Survey of 254 first viewports
  (devlog 010c): centered on 58% of foreign leaders, 59% of Korean companies, 45% of YC P26.
- **Left alignment needs a counterweight.** Use it for longer copy, B2B explanation or
  when a visual earns the other half, and only with one of: a visual on the right, full-bleed
  photo or video behind the text, or the product directly below. 90% of left-aligned heroes
  in the survey carry one (split 43%, full-bleed 28%, product below 19%).
- **Never a left headline alone on an empty right side.** Type-alone left heroes were 10%
  of the survey, all YC P26, none at Korean or foreign leaders.
- **Split default 50:50.** The owner preferred 50:50 over 55:45 and, on the right side, an
  authored graphic over a generic boxed screenshot: balance matters more than filling the
  slot with any product picture.
- Apps, dashboards and tools do not open with a hero at all (ANTI-HERO-IN-TOOLS in
  [aesthetics](aesthetics.md)).

### Split heroes (FE-HERO-SPLIT-01, DEFAULT)

A split hero (copy left, visual right) is a normal, majority pattern, not slop. The tell is
narrower: **a boxed, generic screenshot or device-mockup card that shows nothing real**
(a dashboard of placeholder bars, a fake window with traffic-light dots, a stock phone
frame) parked in the right column. Fix it by showing a real product state, an authored
graphic or photography, letting the visual bleed or cross the grid, or switching to the
centered layout with the product below. An edge-to-edge, grid-crossing, interactive or
media aperture that performs the product premise is fine in any position.

| Composition | Shape | Verified users |
| --- | --- | --- |
| Centered over media | centered headline + CTA over full-width media/video/canvas | OpenAI, Dia, Framer, Raycast, Toss |
| Centered, product below | centered copy, product UI rising full-width below | Linear-style launch pages, Korean service sites |
| Product-as-stage (left) | headline spans the width; product UI full-width directly below | Linear, Cursor, Supabase, Ramp |
| Editorial opener | large text-led statement, editorial modules follow | Anthropic |
| Split | copy left, real visual or authored graphic right, about 50:50 | Stripe, Vercel, 43% of left heroes |

### Light centered display (FE-HERO-LIGHT-CENTER-01, DEFAULT)

A named centered variant that predates FE-HERO-ALIGN-01 and stays valid: a LIGHT headline
(300-400) over a full-width real media or motion backdrop (photography, generated texture
or video, never a gradient wash), generous whitespace and a minimal copy stack (FE-HERO-01
budget). Evidence: OpenAI announcement grammar; aside.com measured 2026-07-10 (display
variable font, 400, 36px, centered over sky photography). The **Authored-Field Centered
Statement** variant: centered copy over a background or proof object that is itself the
primary content, at most 3 semantic elements in the overlay, deliberate line breaks, no
equal-card row next (Vectr, Fin, Michael Pumo, 2026-07-14 crawl). Bold centered heroes are
also allowed under FE-HERO-ALIGN-01; this entry only names the light variant. Type exemplar
details live in [aesthetics](aesthetics.md) and the direction mode's design-isms.

- Korean note: Toss, KakaoBank and Daangn use centered or full-bleed brand heroes; a "left
  bold Pretendard headline + right placeholder mockup" fails FE-HERO-SPLIT-01's narrow tell.
- Replacement trend labels: story-driven heroes, scrollytelling, immersive 3D,
  dimensionality/layers (SaaSFrame / Figma / Digidop / Contra, 2025-2026).

Sources: LogRocket "Linear Design" (2026-02-03); Nordcraft "why do all websites
look the same" (2024-09-03); owner A/B round 4 and 254-site alignment survey (devlog 010c, 2026-11-21); Rectangle "The Linear effect" (2023-01-10); live
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
- Cross-ref: aesthetics.md § Spatial Composition also bans generic 3-col cards; hero
  alignment follows FE-HERO-ALIGN-01 above.

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
