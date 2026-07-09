## 1. Color Palette Generation

When the user provides a brand color (or you need to generate a palette from scratch), follow this method.

### From Brand Color to Full Palette

1. **Start with the brand hex.** Compute OKLCH values for precise perceptual steps.
2. **Generate the scale** (50–900) by adjusting lightness while preserving hue and saturation:
   - 50: background tint (lightness ~97%)
   - 100–200: hover/pressed states
   - 300: borders
   - 400: disabled text
   - 500: brand primary (the input color)
   - 600–700: text on light backgrounds
   - 800–900: heading text, dark surfaces

3. **Add semantic colors:**
   - Success: green-based (hue ~145°)
   - Warning: amber-based (hue ~45°)
   - Danger: red-based (hue ~25°)
   - Info: blue-based (hue ~220°)
   - Generate each as a 50–900 scale.

4. **Neutral ramp:** Pick a subtle hue bias from the brand color. Apply it at very low chroma (0.005–0.01) across the gray scale. This gives "warm grays" or "cool grays" that feel cohesive with the brand.

### Practitioner Notes — Hue Budget & Tinted Neutrals (verified 2026-07-07)

Field-tested extensions to the method above (Korean designer community;
evidence: repo `devlog/_fin/260707_liquid_glass_motion_trends/000_research.md` §2):

- **Hue budget:** most "AI-generated frontend looks off" complaints trace to
  too many meaning-carrying hues (Von Restorff effect: emphasize everything,
  emphasize nothing). Semantic colors (success/warn/danger/info) + bg + text
  already spend most of the budget — new UI meaning should come from the
  existing scales' lightness/chroma/alpha steps, not a new hue.
- **Tinted neutrals:** pure `#000` backgrounds and pure `#FFFFFF` surfaces
  read flat and strain eyes; production dark modes are rarely pure black.
  Bias black slightly red or blue, bias white slightly yellow for warmth —
  this is the same low-chroma neutral-ramp rule applied to the extremes.
- **Brand-first theming:** decide icon/logo/symbol identity first (or
  together with the UI), then derive the app theme from the brand color via
  the scale above — the brand-in-theme IS the frontend color principle.
- **Tools:** see the vetted toolbox below.

### Color Toolbox 2026 (maintenance-checked 2026-07-07)

Reach for the right tool by job, not by habit:

| Tool | Use when | Status |
|------|----------|--------|
| tweakcn (tweakcn.com) | shadcn/ui + Tailwind v4 theme editing/export (OKLCH/HSL) | active (repo 2026-06) |
| OKLCH Picker (oklch.com) | precise OKLCH picking, hex conversion, gamut checks | active (2026-07) |
| Harmonizer (harmonizer.evilmartians.com) | generating OKLCH UI palettes with APCA-minded contrast | active (2026-04) |
| Leonardo (leonardocolor.io) | adaptive, accessibility-aware design-system scales + token export | active (Adobe, 2026-05) |
| Radix Colors (radix-ui.com/colors) | prebuilt accessible app scales — strong neutral/accent pairs | stable (2025-12) |
| Adobe Color (color.adobe.com) | fast ideation, harmonies, extract-from-image, non-engineer collab | live |
| Coolors (coolors.co) | rapid palette gacha, quick exports | live |
| APCA calc (apcacontrast.com) + Atmos checker (atmos.style/contrast-checker) | perceptual contrast checks alongside WCAG | active |

Judgment: for SYSTEM-quality palettes start from OKLCH tools (Picker →
Harmonizer/Leonardo/Radix); use Adobe/Coolors for ideation only; for
shadcn/Tailwind v4 projects finish in tweakcn. Huetone is stale (2023) —
learning reference only. Contrast stance: **WCAG 2.2 is the compliance gate;
APCA is advisory** until WCAG 3 (Working Draft as of 2026-07-07) settles.
Implementation mechanics (token layering, oklch() fallbacks, color-mix(),
light-dark(), Tailwind/shadcn wiring):
`dev-frontend/references/core/color-system.md`.

### Dark Mode Token Derivation
- Do NOT simply invert lightness values. Dark mode has its own logic.
- Elevation = brightness: higher surfaces are lighter (900→800→700 for bg→surface→elevated).
- Text: use 100–200 range (not pure white — `#e5e5e5` or `#f5f5f5`).
- Borders: use 700–800 range at low opacity.
- Accent colors: may need chroma adjustment for dark backgrounds (slightly more saturated).

### Accessible Pair Generation
For every text-on-background combination, verify:
- Normal text (< 24px): 4.5:1 contrast ratio minimum (WCAG AA).
- Large text (≥ 24px or bold ≥ 18.5px): 3:1 minimum.
- Interactive components: 3:1 against adjacent colors.
