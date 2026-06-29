# Responsive & Viewport Rules (MANDATORY)

Every multi-column layout, every full-height section, every image-heavy page MUST follow these rules. "It works at 1440px" is not responsive.

---

## Canonical Breakpoint Tiers

| Tier | Breakpoint | Name | Tailwind | Devices |
|------|-----------|------|----------|---------|
| T1 | < 640px | Mobile | default | Phone portrait/landscape |
| T2 | ≥ 640px | Large Mobile | `sm:` | Landscape phones, small tablets |
| T3 | ≥ 768px | Tablet | `md:` | iPad portrait, desktop half-screen (1440px split) |
| T4 | ≥ 1024px | Small Desktop | `lg:` | iPad landscape, laptop, desktop half-screen (1920px split) |
| T5 | ≥ 1280px | Desktop | `xl:` | Standard desktop monitors |
| T5+ | ≥ 1536px | Large Desktop | `2xl:` | Ultra-wide, large monitors |

Use these tiers consistently. Do not invent ad-hoc `@media` breakpoints. Container query breakpoints are based on container width (not viewport tiers) — custom values like 400px or 900px are fine there.

## Page Containment (MANDATORY)

Every page layout MUST have a max-width wrapper:
```css
max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8
```

Without containment, text lines stretch to 200+ characters on wide monitors — unreadable.
Full-bleed sections (hero images, color blocks) break out of containment with negative margins or `w-screen`.

## Viewport Units

- `min-h-[100dvh]` — ALWAYS. Accounts for mobile browser chrome (iOS Safari address bar).
- `h-screen` / `100vh` — BANNED for full-height sections. These cause layout jump on mobile.
- `svh` — use for "minimum guaranteed visible height" (rare).
- `lvh` — use for background sizing where slight overflow is acceptable.

## Container Queries (default for components)

Prefer `@container` over `@media` for any reusable component. Components should adapt to their parent's width, not the viewport — this is what makes the same component work in a sidebar, modal, full-width layout, AND split-screen.

```css
.card-grid { container-type: inline-size; }

@container (min-width: 600px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}
@container (min-width: 900px) {
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}
```

Reserve `@media` for page-level layout shifts (sidebar show/hide, nav mode switch, page grid columns).

## Split-Screen / Half-Window (the neglected viewport)

macOS split-view on a 1440px display gives each app ~640-720px. Windows snap on 1440px gives ~720px. On 1920px displays, each half is ~960px.

This range (640-1024px) falls between "mobile collapse" and "full desktop." Most pages break here because rules only exist for < 768px and ≥ 1280px.

Rules:
- At 640-767px (T2): 2-column grids reduce to 1-column. Side-by-side hero stacks. Padding tightens.
- At 768-1023px (T3): 3-column grids reduce to 2-column. Hero can remain side-by-side if text-heavy. Bento reduces to 2-column.
- Test at 768px AND 1024px in addition to mobile and desktop widths.

## Responsive Spacing Scale

Section padding scales with viewport tier:

| Element | Mobile (<640px) | Tablet (640-1023px) | Desktop (≥1024px) |
|---------|-----------------|---------------------|--------------------|
| Section vertical padding | `py-12` (3rem) | `py-16` (4rem) | `py-20` to `py-24` (5-6rem) |
| Section horizontal padding | `px-4` (1rem) | `px-6` (1.5rem) | `px-8` (2rem) |
| Inter-section gap | `gap-12` | `gap-16` | `gap-20` |
| Card grid gap | `gap-4` | `gap-5` | `gap-6` |
| Content max-width | `max-w-full` | `max-w-2xl` | `max-w-[1400px]` |

## Responsive Images (MANDATORY for image-heavy pages)

### srcset / sizes
Above-fold / LCP images use `loading="eager"` (or omit — eager is the default) + `fetchpriority="high"`. Below-fold images use `loading="lazy"`. Example (above-fold hero):
```html
<img
  src="hero-800.webp"
  srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"
  alt="..."
  loading="eager"
  fetchpriority="high"
  decoding="async"
/>
```

### Art Direction (picture element)
When the image crop must change between viewports (landscape hero → portrait on mobile):
```html
<picture>
  <source media="(max-width: 639px)" srcset="hero-portrait.webp" />
  <source media="(max-width: 1023px)" srcset="hero-square.webp" />
  <img src="hero-landscape.webp" alt="..." />
</picture>
```

### Aspect Ratio
Lock aspect ratios to prevent layout shift:
```css
.hero-image { aspect-ratio: 16/9; object-fit: cover; }
@media (max-width: 767px) { .hero-image { aspect-ratio: 4/5; } }
```

## Safe Area / Notch (MANDATORY for mobile)

Modern phones have notches, dynamic islands, and home indicators. Content MUST not hide behind them:

Apply safe-area insets selectively, not as blanket body padding (top inset on `body` conflicts with fixed navigation bars):

```css
/* Fixed bottom elements (sticky CTA, tab bar) */
.sticky-bottom {
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
}

/* Horizontal safe area for landscape notch devices */
.page-wrapper {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

Add `viewport-fit=cover` to the meta viewport tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

## Nav Height Cap

- Desktop nav: 64-72px default, 80px absolute max
- Mobile nav: 56-64px
- Nav must not consume >10% of viewport height
- On scroll, nav can compact to 48px with `transition-all duration-200`
