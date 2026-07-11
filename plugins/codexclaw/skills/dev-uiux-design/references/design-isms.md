## 1. Design Ism Vocabulary

When the user references a design style or movement, or when selecting an aesthetic direction, use this vocabulary. Each ism includes a CSS signature for rapid implementation.

### 1.1 Flat Design
Minimalist 2D. No shadows, gradients, or textures. Bold saturated solids, clean geometry, ample whitespace.
```css
background: #3498db; border: none; border-radius: 0-4px; box-shadow: none;
font-family: system-ui, sans-serif; font-weight: 400-600;
```
**Use:** Content-heavy, mobile-first, government/public services. **Avoid:** Complex data-dense UI, luxury.

### 1.2 Material Design
Flat + physics-based elevation. Z-axis surfaces with systematic shadows, ripple animations, 8dp grid.
```css
box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24); /* dp=1 */
border-radius: 4px; transition: box-shadow 0.3s cubic-bezier(0.25,0.8,0.25,1);
```
**Use:** Cross-platform apps, enterprise SaaS, form-heavy workflows. **Avoid:** Distinctive brand identity, Apple-ecosystem.

### 1.3 Glassmorphism
Frosted-glass with `backdrop-filter: blur()`, transparency, and subtle borders over colorful backgrounds.
```css
background: rgba(255,255,255,0.1); backdrop-filter: blur(10px);
border: 1px solid rgba(255,255,255,0.2); border-radius: 12px;
```
**Use:** Over rich backgrounds, navigation overlays, media players, macOS-aligned products. **Avoid:** Plain white backgrounds, text-heavy reading, low-powered devices.

### 1.4 Neumorphism
Extruded/inset elements from monochromatic background. Paired light+dark soft shadows. Soft plastic/clay feel.
```css
background: #e0e0e0;
box-shadow: 5px 5px 10px #bebebe, -5px -5px 10px #ffffff;
border-radius: 20px;
```
**Use:** Smart home dashboards, music players, single-purpose widgets, low-density internal tools. **Avoid:** Accessibility-critical (WCAG fails on low contrast), data-dense, e-commerce.

### 1.5 Neobrutalism
Thick black borders, flat bright backgrounds, no blur, oversized bold type, deliberately raw.
```css
border: 3px solid #000; background: #ff6b6b;
box-shadow: 4px 4px 0 #000; border-radius: 0; font-weight: 800-900;
```
**Use:** Creative agencies, indie products, developer portfolios, youth-facing. **Avoid:** Finance, healthcare, government, enterprise B2B, luxury.

### 1.6 Claymorphism
3D clay-like. Thick soft pastel shadows, vibrant rounded elements, cartoon-like inflated depth.
```css
background: linear-gradient(135deg, #ff6b9d, #feca57);
box-shadow: 10px 10px 20px rgba(0,0,0,0.1), -5px -5px 15px rgba(255,255,255,0.7);
border-radius: 25px;
```
**Use:** Children's apps, gamification, onboarding, playful consumer. **Avoid:** Professional tools, finance, healthcare, enterprise.

### 1.7 Art Deco
Bold geometry, symmetry, metallic finishes, strong vertical emphasis, luxurious ornamentation.
```css
font-family: 'Playfair Display', serif; text-transform: uppercase; letter-spacing: 0.15em;
color: #c9a96e; background: #1a1a2e; border-radius: 0;
```
**Use:** Luxury brands, hospitality, jewelry/fashion, event landing pages. **Avoid:** SaaS, developer tools, casual consumer apps.

### 1.8 Bauhaus
"Form follows function." Reductive, geometric, primary colors (red/yellow/blue) + black/white, grid-based asymmetric.
```css
font-family: 'DM Sans', sans-serif; font-weight: 700;
display: grid; grid-template-columns: 2fr 1fr;
border: 2px solid #000; border-radius: 0;
```
**Use:** Design portfolios, museum/gallery sites, educational platforms. **Avoid:** Complex data interfaces, general consumer apps.

### 1.9 Swiss / International Typographic Style
Maximum clarity. Grid systems, Helvetica/sans-serif, asymmetric layouts, objective photography, mathematical spacing.
```css
font-family: 'Helvetica Neue', 'Inter', sans-serif;
display: grid; gap: 1.5rem; color: #111; background: #fff;
```
**Use:** Corporate identities, developer documentation, data dashboards. **Avoid:** Playful consumer products, entertainment.

### 1.10 Memphis Design
Anarchic 1980s. Clashing colors, squiggly lines, geometric confetti, deliberately "ugly" compositions.
```css
background: #ff6b6b; border-radius: 50% 0 50% 0;
/* SVG confetti/geometric shapes as background-image */
```
**Use:** Event promotions, youth marketing, creative agency sites, social media graphics. **Avoid:** Professional software, finance, healthcare.

### 1.11 Skeuomorphism
Real-world materials in digital. Leather, wood, metal textures. Realistic shadows, bevels, highlights.
```css
background: linear-gradient(to bottom, #e8e8e8, #d0d0d0);
box-shadow: 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.6);
border: 1px solid #999; border-radius: 8px;
```
**Use:** Onboarding for non-technical users, music/audio apps, nostalgic products. **Avoid:** Developer tools, dashboards, SaaS, responsive layouts.

### 1.12 Liquid Glass (Apple, 2025-2026)
Glassmorphism's successor as a SYSTEM material, not a card style (Apple HIG
Materials, verified 2026-07-07). Dynamic translucent layer reserved for
floating controls/navigation; content scrolls beneath and peeks through.
Adapts to context and user settings (reduced transparency, increased
contrast). Named material states (canonical: `dev-frontend` `liquid-glass.md`):
`pill-at-top` (~70-80% opacity, only over an authored calm bar zone),
`pill-scrolled` (85-95% + blur, the default text-bearing chrome state),
`media-overlay` (the older canvas-55% recipe, media/photo overlays only), and
`clear` (no blur; sparse controls over rich media). Bar-spawned dropdowns and
popovers are unconditionally near-opaque, blur-free solid.
```css
/* pill-scrolled state */
background: color-mix(in oklab, canvas 90%, transparent);
backdrop-filter: blur(16px) saturate(1.4);
border: 1px solid rgba(255,255,255,0.18); border-radius: 16px;
box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
```
**Judgment gate vs 1.3 Glassmorphism:** 1.3 styles individual cards over
colorful backgrounds; Liquid Glass is a two-layer hierarchy decision —
functional chrome floats as glass, content NEVER does. If someone asks for
"glass cards" in the content layer, that is 1.3 (and usually slop); reserve
Liquid Glass for sticky headers, tab bars, sidebars, floating toolbars,
players. A blur-free variant (near-opaque pills over photographic/pastel
washes) delivers the same 2026 language at lower cost.
**Use:** macOS/iOS-aligned products, media-rich consumer apps, floating chrome over scrollable content. **Avoid:** content-layer cards, text-heavy reading surfaces, data-dense dashboards, low-powered targets.
Implementation recipes, perf budget, and a11y gates: `dev-frontend/references/core/liquid-glass.md`.

### 1.13 Liquid Editorial (2026 no-brief default kit)
The composite kit behind SKILL.md §1 UX-DEFAULT-ISM-01 (decided 2026-07-07
from Tier-2 trend research: Apple Liquid Glass 2025-06-09 announcement + HIG
restraint guidance; Figma/Creative Bloq/Fireart 2026 forecasts naming
expressive typography, tactile anti-AI texture, and authored color as the
premium direction). Structure: type-led asymmetric composition OR light
centered display (FE-HERO-LIGHT-CENTER-01: centered, weight 300-400, over
full-width real media backdrop; see `dev-frontend` `layout-discipline.md`).
Both carry a Liquid Glass accent layer — the "fancy" lives in the chrome, the
authorship in the type.
```css
/* signature: oversized authored headline + tactile wash + pill chrome */
h1 { font-size: clamp(2.5rem, 8vw, 6rem); letter-spacing: 0; text-wrap: balance; }
.wash { background: url(texture-or-photo) / oklch-tinted pastel; }
.chrome { border-radius: 9999px; background: rgb(255 255 255 / .92); } /* or pill-scrolled state on nav */
/* children inside pill chrome: fills/tints only, no capsule borders at rest (FE-PILL-NEST-01) */
:root { --accent: oklch(0.6 0.2 <one hue>); }
```
**Use:** no-brief expressive surfaces (landing, consumer, creative, AI-product) as a stated assumption. **Avoid:** any quiet/repeated-work domain; briefs that name another direction; reusing it so uniformly that it becomes the new generic default — vary texture, hue, and the single signature motion per project.
Related: 1.12 (material rules), `product-personalities.md` Aside profile (chip vocabulary), `dev-frontend` `liquid-glass.md` + `motion.md` (implementation).

---
### 1.14 AI Serif Editorial (2024-2026 serif renaissance)
The AI-brand serif turn (verified 2026-07-09): display serif at LIGHT weights +
sans UI + mono technical accent — never "make everything serif". Measured:
claude.ai `Anthropic Serif` 56px/weight 330 (identity by Geist: Styrene +
Tiempos); Perplexity's Comet leads with Editorial New (Studio Freight);
manus.im Libre Baskerville 36px/400; precedent medium.com GT Super 120px/400 +
Sohne UI. Semiotics: books/scholarship/human-hand trust against AI coldness,
often with a warm off-white page metaphor.
```css
h1, .display { font-family: "Tiempos Headline", "Editorial New", "GT Super", serif;
  font-weight: 350; font-size: clamp(2.5rem, 5vw, 4.5rem); line-height: 1.15; }
body, button, input { font-family: var(--sans); }  /* UI stays sans */
code, .meta { font-family: var(--mono); }          /* technical accent */
:root { --page: #faf9f5; }                          /* warm off-white page */
```
**Use:** AI-product, research, editorial, publication, trust/human-warmth
brands WITH real editorial structure (long-form typography, page-like
surfaces, restrained palette). **Avoid:** dashboards, dense tools, SaaS
layouts wearing a serif as premium shorthand — that is "tasteslop" (WIRED
2026-06-05); heavy bold display serif (the pattern is 330-400).
Related: `dev-frontend` `aesthetics.md § Serif Discipline`,
`korea-2026.md § Korean Serif / Myeongjo Display` (MaruBuri pairing).

---

### 1.15 Organic Capsule (OpenAI announcement grammar)
The OpenAI model-card/hero grammar (in-house Feb-2025 rebrand led by Veit
Moeller/Shannon Jager; OpenAI Sans by ABC Dinamo; motion/sound by Studio
Dumbar/DEPT): a soft-focus organic photographic field (natural palettes,
film grain, some Sora-generated texture) carrying an OPAQUE white capsule
label with bold warm-sans text. Two strict layers: expressive background
(no functional text) vs functional capsule/copy (no decoration). Kin to
Apple's WWDC25 capsule system but opaque, not glass.
```css
.field { background: url(soft-focus-organic.jpg) center/cover; }
.field::after { content:""; position:absolute; inset:0; opacity:.15;
  /* grain: noise image or feTurbulence */ mix-blend-mode: multiply; }
.capsule { border-radius: 9999px; background: #fff; color: #111;
  padding: .4em 1em; font-weight: 700; }
```
**Use:** announcement cards, model/product reveals, campaign heroes for
warm-tech brands; pairs with restrained type-led pages. **Avoid:** mixing the
layers (text on raw busy background, texture on the capsule), more than one
organic field per viewport (gradient/texture budget), tools/dashboards.
Related: `dev-frontend` `motion.md § Soft-Focus Organic Background + Capsule
Label`, `aesthetics.md § Expressive vs Functional Layers`.

---
