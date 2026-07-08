# Color System — Token Implementation Mechanics

Implementation owner for color tokens: layering, modern color functions,
framework wiring, and contrast verification. Palette GENERATION and judgment
(hue budget, scales, tools) are owned by
`dev-uiux-design/references/color-system.md` — read it for what colors to
pick; read this for how to ship them. Runtime theme selection, FOWT
prevention, and toggle behavior stay in `theme-switching.md`.
Feature facts below verified 2026-07-07 (MDN/Tailwind/shadcn/W3C, Tier 2).

---

## Token Layering (FE-COLOR-TOKEN-01, DEFAULT)

Three layers, referenced downward only:

1. **Primitive** — raw scale values, no meaning: `--blue-600`, `--gray-100`.
2. **Semantic** — meaning, theme-switchable: `--background`, `--primary`,
   `--primary-foreground`, `--border`, `--danger`.
3. **Component** — scoped knobs derived from semantic: `--button-bg`,
   `--card-border`.

Rules: components consume SEMANTIC tokens (or their own component tokens),
never primitives; hardcoded colors in component CSS are a review finding
(theme-ready enforcement); dark/alt themes redefine SEMANTIC tokens only.

```css
:root {
  /* primitives */
  --blue-600: oklch(0.58 0.22 260);
  /* semantic */
  --background: oklch(1 0 0);
  --primary: var(--blue-600);
  --primary-foreground: oklch(0.99 0 0);
}
.dark {
  --background: oklch(0.145 0 0);
  --primary: oklch(0.70 0.18 260);
}
.button-primary {
  --button-bg: var(--primary);
  --button-bg-hover: color-mix(in oklch, var(--primary) 88%, black);
  background: var(--button-bg);
  color: var(--primary-foreground);
}
```

## Modern Color Functions (baseline status 2026-07-07)

- `oklch()` — Baseline 2023. Default authoring space for new palettes:
  perceptually uniform lightness, predictable scale steps.
- `color-mix(in oklch, ...)` — Baseline 2023. Derive hover/pressed/disabled
  states from semantic tokens instead of hardcoding shade variants.
- `light-dark(<light>, <dark>)` — Baseline 2024; requires `color-scheme:
  light dark`. Use for BROWSER-controlled two-mode color. For app-controlled
  or multi-theme systems, use `.dark`/`[data-theme]` semantic redefinition
  instead (see `theme-switching.md` for the runtime side).
- `@supports (color: oklch(0.6 0.2 250))` is the feature gate primitive.

## Fallback Discipline (FE-COLOR-FALLBACK-01, DEFAULT)

`var(--token, fallback)` does NOT rescue a declaration whose variable holds an
unsupported color function — the whole declaration is discarded at
computed-value time. Gate by feature, not by var fallback:

```css
:root { --primary: #2563eb; }                       /* universal fallback */
@supports (color: oklch(0.6 0.2 250)) {
  :root { --primary: oklch(0.58 0.22 260); }         /* modern override */
}
```

Or precompile fallbacks (PostCSS) when the toolchain already does so. Either
way, the fallback lives at the PRIMITIVE layer so semantic/component layers
stay function-agnostic.

## Framework Wiring

- **Tailwind v4** — CSS-first tokens via `@theme` (`--color-*` variables);
  do not reintroduce JS config for colors. Semantic tokens defined in
  `:root`/`.dark` map into utilities via `@theme inline`.
- **shadcn/ui** — current convention is semantic CSS variables in OKLCH
  mapped through `@theme inline`; follow the project's `components.json`
  tokens; edit themes with tweakcn (see the uiux toolbox) rather than
  hand-tuning hex.

## Contrast Verification (FE-COLOR-CONTRAST-01, STRICT)

Implementation gate pointing at the §7 accessibility baseline (WCAG AA
contrast is already STRICT there): every text/background SEMANTIC pair — in
EVERY theme — is verified against WCAG 2.2 AA (4.5:1 normal, 3:1 large/UI).
`color-mix()`-derived states count as new pairs; verify them, not just the
base. APCA/Lc is a useful advisory second check for perceptual readability
(WCAG 3 is still a Working Draft as of 2026-07-07) — it does not replace the
WCAG 2.2 gate. Translucent surfaces: worst-case-background rule in
`liquid-glass.md` FE-LIQUID-A11Y-01 applies.
