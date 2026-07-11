# Visual Hierarchy

The arrangement of visual elements by importance so the viewer's eye follows a deliberate path: most important → supporting → peripheral. Hierarchy is created through six levers: **size, weight, color, spacing, position, density**.

## 1. Size Scale

```
Level 1 (hero headline):   clamp(2.25rem, 4vw + 1rem, 4rem)
Level 2 (section heading):  clamp(1.5rem, 2.5vw + 0.75rem, 2.5rem)
Level 3 (subsection):       clamp(1.125rem, 1.5vw + 0.5rem, 1.5rem)
Level 4 (body):             1rem (16px base)
Level 5 (caption/meta):     0.875rem
Level 6 (legal/fine print): 0.75rem
```

- Adjacent levels must differ by at least 1.25x ratio (L1:L2 ≥ 1.5x, L2:L3 ≥ 1.25x)
- Never use more than 4 levels on a single viewport screen
- Hero headline ≥ 2x body size or it reads as a paragraph

## 2. Weight Contrast

| Role | Weight | Use |
|------|--------|-----|
| Primary heading | 700-800 | Hero, section titles |
| Secondary heading | 600 | Subsection, card titles |
| Body emphasis | 500-600 | Key phrases, inline bold |
| Body text | 400 | Default reading text |
| De-emphasized | 300-400 | Captions, timestamps, metadata |

- Primary vs body weight difference ≥ 200 (e.g., 700 vs 400)
- Never use weight alone to create hierarchy — pair with size
- Display-scale exception: at display sizes, size contrast may replace weight
  contrast; a 300-400 light headline is legal when >= 3x body size
  (FE-HERO-LIGHT-CENTER-01). The 700-800 primary-heading row applies to
  in-content headings, not display heroes.
- Monospace/code blocks: weight 400-500 max

## 3. Color Emphasis

```
Level 1 (primary):    var(--color-text-primary)    — full contrast, used sparingly
Level 2 (secondary):  var(--color-text-secondary)  — 70-80% of primary contrast
Level 3 (tertiary):   var(--color-text-tertiary)   — 50-60% of primary contrast
Level 4 (disabled):   var(--color-text-disabled)    — 35-40% of primary contrast
Accent:               var(--color-accent)           — reserved for ONE interactive element per viewport
```

- Accent color on max 1-2 elements per viewport (CTA + link, not more)
- If everything is accent-colored, nothing is — the "purple wash" anti-pattern
- Heading color ≠ body color unless intentionally monochrome
- Background color creates hierarchy: white surface > gray surface > dark surface for cards

## 4. Spacing as Hierarchy

```
Section gap (between major sections):  clamp(4rem, 8vw, 8rem)
Subsection gap:                         clamp(2rem, 4vw, 4rem)
Element group gap:                      1.5rem - 2rem
Element gap (within a group):           0.5rem - 1rem
Tight (label-to-input, icon-to-text):   0.25rem - 0.5rem
```

- More whitespace around an element = more important (isolation draws the eye)
- Hero section: generous padding (≥ 6rem top/bottom) — signals "start here"
- Dense sections contrast with sparse sections to create rhythm
- Gap between sections > gap within sections > gap between elements (nesting principle)

## 5. Position Priority

| Position | Priority | Use |
|----------|----------|-----|
| Above the fold, center | Highest | Hero headline, primary CTA |
| Above the fold, left | High | Navigation, brand mark |
| Below fold, first scroll | Medium | Social proof, key features |
| Mid-page | Standard | Detailed features, comparison |
| Footer area | Low | Legal, secondary nav, contact |

- Primary CTA must appear above the fold
- Repeat CTA after every 2-3 sections on long pages
- F-pattern for text-heavy pages, Z-pattern for marketing/landing
- Mobile: stack in strict priority order (most important = topmost)

## 6. Density Contrast

| Section Type | Density | Purpose |
|-------------|---------|---------|
| Hero | Sparse (1-3 elements) | Focus attention on single message |
| Social proof | Medium (logos + quote) | Build trust without overwhelming |
| Features | Dense (grid/cards) | Information delivery |
| CTA/pricing | Medium-sparse | Decision moment — clear options |
| Testimonial | Sparse (1 quote + photo) | Emotional pause, breathing room |

- Alternate dense/sparse sections to prevent fatigue
- Never stack two dense sections without a sparse break
- Sparse section immediately after hero creates "breathing room"

## 7. Pre-commit Checklist

- [ ] Exactly 1 element per viewport is the obvious focal point
- [ ] Size ratio between heading levels ≥ 1.25x
- [ ] Weight difference between heading and body ≥ 200
- [ ] Accent color on ≤ 2 elements per viewport
- [ ] Section gaps > internal gaps > element gaps (nesting principle)
- [ ] Hero section has most whitespace on the page
- [ ] Primary CTA is above the fold
- [ ] Dense and sparse sections alternate
- [ ] F or Z reading pattern identifiable by squinting
- [ ] Color hierarchy has ≥ 3 distinct levels

## 8. Cross-references

- Size scale clamp values: `dev-frontend/references/core/aesthetics.md` §Typography
- Section composition order: `layout-macrostructures.md`
- Responsive transforms: `dev-frontend/references/core/layout-discipline.md`
- Color tokens: `color-system.md`
