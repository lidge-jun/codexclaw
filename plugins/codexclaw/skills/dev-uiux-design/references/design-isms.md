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
contrast). Two variants: `regular` (blur + luminosity backing; text-safe)
and `clear` (no blur; only over rich media).
```css
background: color-mix(in oklab, canvas 55%, transparent);
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
premium direction). Editorial type-led structure carrying a Liquid Glass
accent layer — the "fancy" lives in the chrome, the authorship in the type.
```css
/* signature: oversized authored headline + tactile wash + pill chrome */
h1 { font-size: clamp(2.5rem, 8vw, 6rem); letter-spacing: 0; text-wrap: balance; }
.wash { background: url(texture-or-photo) / oklch-tinted pastel; }
.chrome { border-radius: 9999px; background: rgb(255 255 255 / .92); } /* or glass-regular on nav */
:root { --accent: oklch(0.6 0.2 <one hue>); }
```
**Use:** no-brief expressive surfaces (landing, consumer, creative, AI-product) as a stated assumption. **Avoid:** any quiet/repeated-work domain; briefs that name another direction; reusing it so uniformly that it becomes the new generic default — vary texture, hue, and the single signature motion per project.
Related: 1.12 (material rules), `product-personalities.md` Aside profile (chip vocabulary), `dev-frontend` `liquid-glass.md` + `motion.md` (implementation).

---
