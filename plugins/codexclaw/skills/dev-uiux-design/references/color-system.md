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
