# Performance Budget

## Core Web Vitals Targets

| Metric | Good | Needs Work | Poor | Measures |
|--------|------|------------|------|----------|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s | Hero load time |
| INP | ≤ 200ms | ≤ 500ms | > 500ms | Input responsiveness |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 | Visual stability |

- Every page targets "Good" on all three
- LCP element: identify early, preload it
- INP: never block main thread > 50ms
- CLS: every image/video/embed needs explicit `width`+`height` or `aspect-ratio`

## Bundle Size Budgets

| Resource | Budget (compressed) |
|----------|-------------------|
| Total page weight | ≤ 500KB first load |
| JavaScript (per route) | ≤ 150KB |
| CSS (total) | ≤ 50KB |
| Hero image | ≤ 100KB |
| Images (above fold) | ≤ 200KB |
| Web fonts | ≤ 100KB |

- Measure compressed (gzip/brotli) sizes
- Tree-shake: `import { x } from 'lib'`, never `import lib`
- Dynamic import for below-fold: `lazy(() => import('./Modal'))`
- Bundle analyzer mandatory for builds > 200KB JS

## Font Loading

```html
<link rel="preload" href="/fonts/primary.woff2" as="font" type="font/woff2" crossorigin>
```

```css
@font-face {
  font-family: 'Primary';
  src: url('/fonts/primary.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0020-007F, U+AC00-D7AF;
}
```

- `font-display: swap` for body, `optional` for decorative
- Preload only the primary font file
- Subset: Latin + target script only
- Max 2 families, 4 weights total
- Self-host when possible

## Image Optimization

| Format | Use For | Quality |
|--------|---------|---------|
| WebP | Photos, complex | 75-85% |
| AVIF | Photos (modern) | 65-75% |
| SVG | Icons, logos | N/A |
| PNG | Screenshots, transparency | Lossless |

- `<picture>` with AVIF → WebP → fallback for hero
- `loading="lazy"` below-fold, `loading="eager" fetchpriority="high"` for hero
- Max 2x display size for retina
- Responsive `srcset` + `sizes` for content images

## Build-Time Gates

- Lighthouse Performance ≥ 90
- Bundle regression: fail if JS increases > 10KB
- Image audit: flag > 200KB
- Unused CSS: flag > 5KB dead CSS

## Runtime Rules

- No `querySelectorAll` in scroll/resize handlers
- Debounce scroll: 100ms min, `requestAnimationFrame` for visual
- Intersection Observer for lazy loading
- `content-visibility: auto` on below-fold sections

## Pre-flight

- [ ] Hero image ≤ 100KB, `fetchpriority="high"`, explicit dimensions
- [ ] Below-fold images have `loading="lazy"`
- [ ] No JS bundle > 150KB compressed
- [ ] `font-display: swap` + `preload` on primary font
- [ ] Every `<img>`/`<video>` has `width`+`height`
- [ ] Lighthouse Performance ≥ 90
