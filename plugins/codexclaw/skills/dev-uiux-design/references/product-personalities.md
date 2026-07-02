## 1. Product Personality Database

Last reviewed: 2026-07-02 — brand tokens are snapshots; verify against the live product (per search skill) before shipping.

When the user references a product ("Notion 느낌", "Linear처럼"), map to these exact design parameters.

### Notion
**Essence:** Warm minimalism — paper-like, approachable, quietly structured.
```yaml
colors: { bg: "#ffffff", surface: "#f6f5f4", text: "#000", secondary: "#787774", accent: "#097fe8", border: "#dfdcd9" }
typography: { font: "Inter (or custom NotionInter)", heading_weight: 600-700, body_weight: 400, optional_serif: "Lyon Text" }
spacing: "4px scale (4, 8, 12, 16, 24, 32, 48, 64)"
radius: "8px elements, 12px cards"
shadows: "multi-layered soft — rgba(25,25,25,0.027)"
signature: "off-white surface, serif option for content, hand-drawn illustrations, block-based composition"
```

### Linear
**Essence:** Dark precision — engineering-grade, sharp, purple-accented.
```yaml
colors: { bg: "#000", text: "dark-gray-on-black", accent: "purple gradient" }
typography: { font: "Inter", weight: "400-600" }
spacing: "8px scale (8, 16, 32, 64)"
radius: "6-8px"
shadows: "minimal — relies on surface layering"
signature: "pure black bg, extreme keyboard-first, command palette (Cmd+K), modular components, speed above all"
```

### Figma
**Essence:** Bright playground — collaborative, vibrant, tool-as-canvas.
```yaml
colors: { chrome: "neutral gray", content: "colorful", schemes: "tonal vibrancy, electric pairings" }
typography: { font: "custom grotesque sans-serif", styles: "sans, condensed, mono, hand" }
radius: "8px"
signature: "infinite canvas metaphor, real-time presence (cursors/avatars), dual-panel (layers left, properties right), abstract playful primitives"
```

### Arc Browser
**Essence:** Gradient personality — organic, macOS-native, context-shifting.
```yaml
colors: { per_space_gradients: true, work: "linear-gradient(135deg, #667eea, #764ba2)", personal: "linear-gradient(135deg, #f093fb, #f5576c)" }
typography: { font: "-apple-system, system-ui" }
radius: "contextual (--radius-sm, --radius-lg)"
shadows: "0 4px 24px rgba(0,0,0,0.2)"
animation: "spring(response: 0.3, dampingFraction: 0.7)"
signature: "per-Space gradient theming, sidebar replaces tab bar, CSS variables exposed for user theming"
```

### Vercel
**Essence:** Monochrome precision — black, white, Geist, nothing else.
```yaml
colors: { bg: "#000", fg: "#fff", accent_blue: "#0070F3 (functional only)", grays: "10-step ramp #F7F7F7→#0A0A0A" }
typography: { font: "Geist", mono: "Geist Mono", letter_spacing: "-0.04em headings, -0.01em body" }
spacing: "4-8px base, 96-128px section padding"
radius: "0-4px marketing, 6-8px UI"
shadows: "minimal or none"
signature: "almost entirely grayscale, aggressive whitespace, blueprint grid bg, no illustrations, CSS-preferred animations"
```

### Stripe
**Essence:** Gradient elegance — illustrated, polished, technically confident.
```yaml
colors: { signature: "purple gradients", palette: ["blue", "yellow", "pink", "purple", "orange", "red"] }
typography: { weight: 300, style: "sharp, clear, restrained" }
effects: { hero: "WebGL animated gradient mesh", illustrations: "telling animations that communicate without copy" }
signature: "weight-300 type elegance, complementary multi-color gradients, sharp minimal copy, restrained with no frills"
```

### Apple
**Essence:** Frosted glass, system font, spacious — hardware-grade polish.
```yaml
colors: { bg: "#fff/#000 (light/dark)", surface: "rgba with context-adaptive opacity", accent: "system blue" }
typography: { font: "-apple-system, SF Pro", weight: "200-800 variable" }
effects: { liquid_glass: "backdrop-filter: blur(20px); background: rgba(255,255,255,0.3); border: 0.5px solid rgba(255,255,255,0.3)" }
spacing: "40px+ padding on glass, very generous sections"
radius: "12-20px"
signature: "system font, Liquid Glass adapts contextually, specular highlights on motion, generous spacing = luxury"
```
