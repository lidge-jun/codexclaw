# Favicon & Product Logo — Design Judgment & Patterns

Design guidance for favicons, product logos, and brand identity elements in web applications. Covers decision-making and design rationale.

Read `dev-frontend` references for CSS implementation details.
Read `logo-trust-sections.md` for partner/client logo bars (separate concern).

---

## 1. Favicon: The Modern Minimum Set

You need **5 image files + 1 manifest**. Everything else is legacy bloat.

| File | Size | Purpose |
|------|------|---------|
| `favicon.ico` | 32x32 | Legacy browser fallback |
| `icon.svg` | Scalable | Modern browsers, dark mode via CSS media query |
| `apple-touch-icon.png` | 180x180 | iOS home screen bookmark |
| `icon-192.png` | 192x192 | Android home screen, PWA minimum |
| `icon-512.png` | 512x512 | PWA splash screen, install prompt |

Plus `site.webmanifest` referencing the 192 and 512 PNGs.

**Skip list (2025+):** 96x96, 128x128, 64x64, 144x144, msapplication-TileImage. All obsolete.

### HTML Head Markup

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#4a90d9">
```

Order matters: ICO first (fallback), then SVG (modern browsers pick this).

### Web Manifest

```json
{
  "name": "App Name",
  "short_name": "App",
  "icons": [
    { "src": "/icon-192.png", "type": "image/png", "sizes": "192x192" },
    { "src": "/icon-512.png", "type": "image/png", "sizes": "512x512" },
    { "src": "/icon-mask.png", "type": "image/png", "sizes": "512x512", "purpose": "maskable" }
  ],
  "theme_color": "#4a90d9",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

### Maskable Icon (Android Adaptive)

Android 13+ crops icons into adaptive shapes (circles, squircles). The safe zone is a centered circle with 40% radius of the canvas. In practice: **at least 10% padding on all sides**. Never reuse the standard 512 icon — create a dedicated maskable version. Preview at https://maskable.app.

---

## SVG Favicon Dark Mode

SVG favicons can embed `prefers-color-scheme` to adapt automatically:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <style>
    .logo-fill { fill: #1a1a2e; }
    @media (prefers-color-scheme: dark) {
      .logo-fill { fill: #f0f0f0; }
    }
  </style>
  <circle class="logo-fill" cx="64" cy="64" r="60" />
</svg>
```

**Browser support:**

| Browser | SVG Favicon | Dark Mode in SVG |
|---------|-------------|------------------|
| Chrome 80+ | Yes | Yes |
| Firefox 41+ | Yes | Yes |
| Edge (Chromium) | Yes | Yes |
| Safari 15+ | Renders SVG | Does NOT apply embedded `@media` |

Safari caveat: always shows light-mode variant. For Safari dark-mode favicons, swap a PNG via JS `matchMedia`.

**Rules:**
- Always set `viewBox`. Browsers default to 16x16 without it.
- Keep SVG simple. Complex paths at 16px tab size become noise.
- Test at actual tab size, not at source resolution.

---

## Deriving a Favicon from a Logo

| Rule | Rationale |
|------|-----------|
| Use the logomark, not the wordmark | Text is illegible at 16x16 |
| Strip to 1-2 elements | Detail vanishes at small sizes |
| Maximum 3 colors (2 is better) | Color distinction fails at low resolution |
| Push contrast hard | White mark on vivid background holds up better than subtle coloring |
| Test on dark tab backgrounds | Dark favicons vanish against dark browser chrome |

---

## Generation Workflow

1. Design the icon at 512x512 or as SVG in Figma/Illustrator
2. Create the SVG version manually (for dark mode — generators can't produce this)
3. Run through RealFaviconGenerator for all PNG/ICO sizes
4. Create a separate maskable version with safe-zone padding
5. Validate with RealFaviconGenerator's checker

**Framework-specific:**
- **Next.js App Router:** Drop `favicon.ico`, `icon.svg`, `apple-icon.png` into `app/`. Auto-generates `<link>` tags. For programmatic: export default from `app/icon.tsx` using `ImageResponse`.
- **Vite/React/Vue:** Place in `public/`. Reference with absolute paths in `index.html`.

---

## Product Logo in Navigation

### Sizing

| Context | Height | Max Width |
|---------|--------|-----------|
| Desktop header | 40-48px | 280px |
| Mobile header | 32-40px | 160px |
| Retina/HiDPI | 2x PNG or SVG | Same |

Use fixed height + `width: auto` + `max-width` constraint. Set explicit `width` and `height` attributes on `<img>` to prevent CLS.

### Responsive Collapse

1. **Full logo** (mark + wordmark) above 1024px
2. **Logomark only** at 768-1024px
3. **Hamburger appears** below 768px, logomark stays

### Logo as Home Link

Universal UX convention. Implementation:

```html
<a href="/" aria-label="Homepage">
  <img src="/logo.svg" alt="Acme Corp" width="200" height="48">
</a>
```

Rules:
- Left-align (LTR). Always link to `/`.
- Use SVG for the logo image when possible.
- Click target: minimum 44x44px (WCAG 2.2 AAA). Pad with CSS if the logo is smaller.
- If the logo is the only content identifying the company, `alt` must name the org.
- If adjacent text already names the org, use `alt=""` (decorative).

### Inline SVG Logo

```html
<a href="/">
  <svg role="img" aria-label="Acme Corp" viewBox="0 0 200 48">
    <title>Acme Corp</title>
    <!-- paths -->
  </svg>
</a>
```

---

## Dark Mode Logo

Four techniques, ranked by reliability:

### 1. Separate variants (most reliable)

```html
<picture>
  <source srcset="/logo-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="/logo-light.svg" alt="Acme Corp" />
</picture>
```

### 2. SVG embedded `prefers-color-scheme`

Works in `<img>`, CSS backgrounds, and favicons.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50">
  <style>
    .brand { fill: #1a1a2e; }
    @media (prefers-color-scheme: dark) {
      .brand { fill: #f5f5f5; }
    }
  </style>
  <path class="brand" d="..." />
</svg>
```

### 3. SVG `currentColor` (monochrome only)

```xml
<svg viewBox="0 0 100 100"><path fill="currentColor" d="..." /></svg>
```

Inherits parent's CSS `color`. Only works with inline SVGs, not `<img>` tags.

### 4. CSS `filter` (last resort)

```css
@media (prefers-color-scheme: dark) {
  .logo img { filter: invert(1) hue-rotate(180deg); }
}
```

Imprecise for multi-color logos. Use only for simple single-color marks.

---

## Logo in Footer

- Height: **50-75% of header logo** (16-20px if header is 28px)
- Use a monochrome/neutral variant (grayscale or muted)
- Left-aligned or centered, near copyright line
- `loading="lazy"` if below the fold

---

## Open Graph & Social Sharing

### Required Images

| Platform | Size | Ratio |
|----------|------|-------|
| Facebook, LinkedIn, Slack, Discord | 1200x630px | 1.91:1 |
| X summary_large_image | 1200x630px | 1.91:1 |
| X summary card | 240x240px min | 1:1 |

Keep text/elements within the center 1080x600 safe zone.

### Meta Tags

```html
<meta property="og:image" content="https://example.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Acme Corp" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://example.com/og-image.png" />
```

Tags must be server-rendered. Social crawlers do not execute JavaScript.

### Schema.org Organization Logo

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Acme Corp",
  "url": "https://example.com",
  "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png", "width": 600, "height": 600 }
}
```

Google requires at least 112x112px. Must be crawlable.

---

## Brand Tokens from Logo

Extract the primary brand color from the logo and generate a full scale:

**Primitive tokens** (raw values):
```css
:root {
  --color-brand-500: #1a73e8;  /* logo primary color */
  --color-brand-400: #4a90d9;
  --color-brand-600: #1557b0;
}
```

**Semantic tokens** (usage-based):
```css
:root {
  --color-brand-primary:    var(--color-brand-500);
  --color-brand-hover:      var(--color-brand-600);
  --color-brand-subtle:     var(--color-brand-400);
  --color-brand-on-primary: #ffffff;
}
```

Generate the full 50-950 scale using OKLCH for perceptual evenness. Reference: `color-system.md`.

---

## Empty State & Error Page Logos

| Context | Logo Treatment |
|---------|---------------|
| 404 / 500 error | Simplified mark, not prominent. Focus is on error message + recovery action. |
| Empty state (no data) | Contextual illustration preferred over logo. Brand presence via nav header. |
| First-run / onboarding | Full logo acceptable as part of welcome. |
| Maintenance page | Full logo + brand colors to reassure users. |

Never place a large isolated logo as the centerpiece of a 404 page — users read it as a dead end. Pair a small mark with clear next-step navigation.

---

## Animated Logo

**When appropriate:** App launch/splash (under 3s), page transitions as loading indicator, marketing hero sections.

**When not:** Nav logo on every page load, on scroll, or as persistent decoration.

**Performance:**
- Prefer CSS animations (transform, opacity) — GPU-composited.
- Lottie for complex animations adds 50-250KB. Only justified for splash screens.
- Keep animated SVGs under 10KB.

**`prefers-reduced-motion` is mandatory (WCAG 2.1 AA):**

```css
.logo-animated { animation: logo-entrance 1.2s ease-out; }
@media (prefers-reduced-motion: reduce) {
  .logo-animated { animation: none; }
}
```

---

## Common Mistakes

| Mistake | Why It Matters |
|---------|---------------|
| Blurry favicons | Scaling 512px to 16px with generic resampling. Generate each size natively or use SVG. |
| Missing apple-touch-icon | iOS shows ugly screenshot clip on home screen save. |
| Reusing standard icon as maskable | Android crops it — logo text gets clipped without safe-zone padding. |
| Not testing at actual tab size | 512px preview is meaningless. Test at 16px in real browser tabs. |
| Forgetting dark mode | Dark favicon vanishes against dark browser chrome. |
| Transparent apple-touch-icon | iOS replaces transparency with black. Always use solid background. |
| Missing `sizes` attribute | Browser picks wrong resolution file. |
| No explicit width/height on logo `<img>` | Causes CLS as image loads. |
| Over-complex favicon design | Detailed illustrations at 16px become noise. Simplify ruthlessly. |
| Stale cached favicons | Use `?v=2` query string during rollout, remove after propagation. |

---

## Performance

- **Cache aggressively:** `Cache-Control: public, immutable, max-age=31536000` for favicons (rarely change).
- **Minify SVG:** SVGO, strip editor metadata. Target under 1KB for favicon SVGs.
- **Compress PNG:** pngquant/oxipng. 32x32 should be under 2KB.
- **Don't serve from a different domain** (extra DNS lookup).
- **Don't use Base64 data URIs** for favicons (bloats HTML, defeats caching).
- **Preload primary favicon** if needed: `<link rel="preload" href="/icon.svg" as="image" type="image/svg+xml">` — but only the primary one.
- **`loading="lazy"`** on trust-bar logos below fold, NOT on header logo.
