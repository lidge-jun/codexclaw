# Aesthetics — Domain-Correct Design Engineering Guide

Comprehensive design rules for building distinctive frontends. The SKILL.md references this file — read it before any frontend work.

---

## Domain First

Do not start from "make it bold." Start from the surface:

- Landing/campaign: expressive typography and strong media can be appropriate.
- Product tools/dashboards/admin: task clarity, density, and repeatability matter more than spectacle.
- Fintech/public/B2B: trust, predictability, and low anxiety matter more than novelty.
- Education/community: warmth and guided visuals can help when they clarify the task.
- Korean-first UI: read `korea-2026.md` before choosing type scale, copy, spacing, or assets.

Hero-scale typography belongs to true hero surfaces. It is usually slop inside working tools.

## Typography

### Font Selection
- **Campaign/landing display**: `clamp(2.5rem, 6vw, 5rem)` when the first viewport is truly a hero.
- **Product/tool page title**: `clamp(1.5rem, 2vw, 2.25rem)`.
- **Dashboard/panel heading**: `0.875rem-1.125rem`, clear weight, compact rhythm.
- **Body**: `text-base text-gray-600 leading-relaxed max-w-[65ch]`
- **Serif**: BANNED for Dashboard/Software UIs. OK for editorial/creative only.

### Serif Discipline (expanded)
Serif is VERY DISCOURAGED as default font. "It feels creative/premium" is NOT a reason.

**Serif acceptable ONLY when:**
- Brand brief literally names a serif font, OR
- Aesthetic is genuinely editorial/luxury/publication AND you can articulate why

**Banned as defaults:**
- Fraunces, Instrument_Serif (the two LLM-favorite display serifs)

**Emphasis Rule:**
- Never inject serif word into sans headline (or vice versa) for visual interest
- Use italic or bold of the SAME font family

**If serif is justified (rare), rotate from:**
PP Editorial New, GT Sectra Display, Reckless Neue, Tiempos Headline, Recoleta, Cormorant Garamond, Playfair Display, EB Garamond, IvyPresto, Migra

**Italic Descender Clearance:**
When italic has descender letters (y g j p q): `line-height: 1.1` min + `padding-bottom: 0.25rem` reserve

### Recommended Fonts (rotate — never converge on one)
| Category         | Options                                                     |
| ---------------- | ----------------------------------------------------------- |
| Modern Sans      | Geist, Outfit, Cabinet Grotesk, Satoshi, Clash Display      |
| Premium Sans     | GT America, Neue Machina, Obviously, Reckless               |
| Mono (data/code) | Geist Mono, JetBrains Mono, Fira Code                       |
| CJK/Korean       | Pretendard, SUIT, Noto Sans KR, Apple SD Gothic Neo |

For Korean-first UI, choose CJK-safe fonts before Latin display fonts. Do not apply negative letter-spacing to Hangul by default.

### Variable Font Pairing
Always pair a distinctive display font with a refined body font:
- `Clash Display` (display) + `Satoshi` (body)
- `Cabinet Grotesk` (display) + `Geist` (body)
- `Outfit` (display) + `Geist Mono` (code)

### Fluid Typography
Use `clamp()` for responsive sizing:
```css
--fluid-h1: clamp(2rem, 1rem + 3.6vw, 4rem);
--fluid-h2: clamp(1.75rem, 1rem + 2.3vw, 3rem);
--fluid-h3: clamp(1.5rem, 1rem + 1.4vw, 2.25rem);
--fluid-body: clamp(1rem, 0.95rem + 0.2vw, 1.125rem);
```

For CSS text wrapping implementation (`text-wrap`, `ch` units), see `typography-wrapping.md`.

---

## Color & Theme

### Rules
- **Max 1 accent color.** Saturation < 80%.
- **THE LILA BAN**: "AI Purple/Blue" aesthetic is BANNED. No purple button glows, no neon gradients.
- **Neutral bases**: Zinc, Slate, Stone. Not plain gray.
- **High-contrast singular accents**: Emerald, Electric Blue, Deep Rose, Amber.
- **Consistency**: ONE palette for entire project. No warm/cool gray mixing.
- **CSS Variables**: All colors defined as `--color-*` variables.
- **Never pure black (#000000)**: Use off-black (Zinc-950, Charcoal, `#0a0a0a`).

### Color Scale
| Step    | Brightness | Use Case              |
| ------- | ---------- | --------------------- |
| 50      | Very light | Subtle backgrounds    |
| 100-200 | Light      | Hover states, borders |
| 300-400 | Mid-light  | Disabled states       |
| 500     | Base       | Default color         |
| 600-700 | Dark       | Hover (dark), active  |
| 800-900 | Very dark  | Text, headings        |

### Alternative Palettes (use instead of banned warm-beige)

| Name | Background | Accent | Text |
|------|-----------|--------|------|
| Cold Luxury | silver-grey `#e8e8e8` | chrome `#c0c0c0` | smoke `#2d2d2d` |
| Forest | deep green `#1a3a2a` | bone `#f0ede5` | amber `#d4a017` |
| Black and Tan | off-black `#1a1a1a` | warm tan `#c9a96e` | white `#f5f5f5` |
| Cobalt + Cream | cream `#fafaf5` | cobalt `#0047ab` | near-black `#1a1a2e` |
| Terracotta + Slate | slate `#e2e0dc` | terracotta `#c75b39` | charcoal `#2f2f2f` |
| Olive + Brick + Paper | paper `#f2f0e8` | olive `#6b7c3e`, brick `#8b3a2a` | dark grey `#333` |
| Pure Monochrome | white `#fff` | single saturated pop | black `#111` |

Rotate: never the same palette twice in consecutive projects.

---

## Spatial Composition

### Layout Diversification
- **ANTI-CENTER BIAS**: When DESIGN_VARIANCE > 4, centered Hero/H1 is BANNED.
- **ANTI-HERO-IN-TOOLS**: Apps, dashboards, admin, finance flows, and developer tools should not start with landing-page hero composition.
- Force: "Split Screen" (50/50), "Left-aligned content / Right asset", "Asymmetric white-space"
- **Grid over Flex-Math**: NEVER `w-[calc(33%-1rem)]`. ALWAYS CSS Grid.
- **NO 3-Column Card Layouts**: Generic "3 equal cards" is BANNED. Use 2-column zig-zag, asymmetric grid, or horizontal scroll.

### DESIGN_VARIANCE Definitions
| Level | Style                                                                                          |
| :---: | ---------------------------------------------------------------------------------------------- |
|  1-3  | Flexbox centered, strict 12-column symmetry, equal paddings                                    |
|  4-7  | `margin-top: -2rem` overlapping, varied aspect ratios, left-aligned headers over centered data |
| 8-10  | Masonry, CSS Grid fractional (`2fr 1fr 1fr`), massive empty zones (`padding-left: 20vw`)       |

**MOBILE OVERRIDE**: Levels 4-10 MUST fall back to strict single-column (`w-full`, `px-4`, `py-8`) on `< 768px`.

---

## Backgrounds & Visual Depth

Don't default to empty decorative atmosphere. First decide whether the surface needs concrete assets:
- Product/object/person/place pages need real or generated subject imagery.
- Tools/dashboards need state previews, charts, tables, workflow screenshots, or diagrams.
- Fintech/public/B2B can use restrained semantic visuals; decoration must not reduce trust.

Atmospheric techniques are secondary:
- **Gradient meshes**: Organic, lava-lamp-like animated color blobs
- **Noise textures**: Subtle grain overlays on fixed pseudo-elements
- **Geometric patterns**: SVG-based repeating patterns
- **Layered transparencies**: Frosted glass with inner refraction borders
- **Dramatic shadows**: Tinted to background hue, not generic black

### Glassmorphism (when used)
Go beyond `backdrop-blur`:
- 1px inner border: `border-white/10`
- Inner shadow: `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`
- Simulates physical edge refraction

---

## Visual Density (VISUAL_DENSITY dial)

| Level | Style                                                                            |
| :---: | -------------------------------------------------------------------------------- |
|  1-3  | Art Gallery: lots of white space, huge section gaps, expensive/clean feel        |
|  4-7  | Daily App: normal spacing for standard web apps                                  |
| 8-10  | Cockpit: tiny paddings, 1px separators instead of cards, `font-mono` for numbers |

---

## UI States (Mandatory)

LLMs generate "static successul states." You MUST implement full interaction cycles:
- **Loading**: Skeletal loaders matching layout sizes. No generic circular spinners.
- **Empty**: Beautifully composed empty states indicating how to populate.
- **Error**: Clear inline error reporting.
- **Tactile Feedback**: On `:active`, use `-translate-y-[1px]` or `scale-[0.98]`.

---

## Image Rules

Use assets in this priority order:

1. **Existing repo/design-system assets** → strongest fit for brand and provenance
2. **User-provided or approved brand assets** → preserve original meaning and legal use
3. **Generated local bitmap, SVG, diagram, chart, or screenshot** → create concrete visual evidence when no asset exists
4. **Approved external CDN assets configured in the framework** → use only when allowed by project config
5. **Temporary stock URLs** → prototypes only; label them as temporary and replace before production

Asset quality gates:
- Every meaningful image needs alt text that describes purpose, not file appearance.
- Set intrinsic dimensions, aspect-ratio, or layout constraints before rendering.
- Verify desktop, mobile, and narrow crops; the subject must not be clipped or hidden behind text.
- Use framework image optimization when available (`next/image`, responsive `srcset`, lazy loading).
- Track licensing/provenance for stock, generated, and third-party visuals.
- Never invent fake image URLs or ship generic egg/Lucide user icons as real avatars.

---

## Aesthetic Archetypes (Inspiration Library)

When choosing a direction, select from these. Each has distinct rules:

| Archetype                  | Color Vibe                         | Signature Effects                                 |
| -------------------------- | ---------------------------------- | ------------------------------------------------- |
| Minimalism / Swiss         | Monochrome + 1 accent              | Razor-sharp hierarchy, micro hover lifts          |
| Glassmorphism              | Aurora/sunset + translucent whites | Frosted panels, glowing borders                   |
| Brutalism                  | Harsh primaries, black/white       | Sharp corners, huge bold text, "broken" aesthetic |
| Dark OLED Luxury           | #0a0a0a + vibrant accent           | Velvet textures, cinematic entrance animations    |
| Aurora / Mesh Gradient     | Teal→purple→pink                   | Animated mesh gradients, color breathing          |
| Retro-Futurism / Cyberpunk | Neon cyan/magenta on black         | Scanlines, glitch transitions, chrome accents     |
| Organic / Biomorphic       | Earthy or muted pastels            | SVG morphing, blob shapes, irregular borders      |
| Editorial / Magazine       | Warm neutrals, serif display       | Column layouts, pull quotes, dramatic whitespace  |

Vary between these. NEVER converge on the same archetype across generations.

---

## Icon System

```
Sizing system:
  --icon-xs: 12px   (inline metadata, tight spaces)
  --icon-sm: 16px   (inline with body text)
  --icon-md: 20px   (buttons, form elements)
  --icon-lg: 24px   (navigation, section icons)
  --icon-xl: 32px   (feature highlights, empty states)
  --icon-2xl: 48px  (hero icons, illustrations)
```

- Icons inherit `currentColor` — never hardcode fill/stroke colors
- Stroke width consistent within a page (1.5px for Lucide, 2px for Heroicons)
- Icon + text alignment: `vertical-align: -0.125em` or flexbox `align-items: center`
- Touch target: icon buttons min 44x44px touch area (icon can be 24px, padding adds the rest)
- Never use icons without labels for critical actions (tooltip minimum, visible label preferred)
- Icon-only buttons require `aria-label`

---

## Print Styles

```css
@media print {
  nav, footer, .no-print, button, .cookie-banner { display: none; }
  body { font-size: 12pt; line-height: 1.5; color: #000; background: #fff; }
  a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #666; }
  a[href^="#"]::after, a[href^="javascript"]::after { content: none; }
  h2, h3 { page-break-after: avoid; }
  table, figure, blockquote { page-break-inside: avoid; }
  img { max-width: 100%; page-break-inside: avoid; }
  p { widows: 3; orphans: 3; }
}
```

- Only add print styles for content-heavy pages (blog, docs, reports)
- Marketing/landing pages: print is rarely needed — skip unless requested
- Test: Cmd+P in browser, check layout breaks
