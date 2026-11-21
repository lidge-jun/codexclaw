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
  --gray-950: oklch(0.21 0 0);
  --blue-600: oklch(0.58 0.22 260);
  /* semantic: primary is ink; the one hue is the accent (focus, links, data) */
  --background: oklch(1 0 0);
  --primary: var(--gray-950);
  --primary-foreground: oklch(0.99 0 0);
  --accent: var(--blue-600);
}
.dark {
  --background: oklch(0.145 0 0);
  --primary: oklch(0.96 0 0);
  --primary-foreground: oklch(0.18 0 0);
  --accent: oklch(0.70 0.18 260);
}
/* --primary stays ink unless the brief names a brand primary (FE-COLOR-RESTRAINT-01) */
.button-primary {
  --button-bg: var(--primary);
  --button-bg-hover: color-mix(in oklch, var(--primary) 88%, var(--background));
  background: var(--button-bg);
  color: var(--primary-foreground);
}
```

## Accent Surface Emphasis (FE-COLOR-ACCENT-SURFACE-01, DEFAULT, verified 2026-07-09)

Emphasized/highlighted panels on opaque functional UI use a FLAT emphasis
channel, never a gradient fill (see `anti-slop.md` FE-GRADIENT-02). Pick exactly
one channel per surface:

1. **Flat alpha/step tint** — accent at ~4-8% over the surface, or a dedicated
   low-step token. Radix uses accent steps 3-5 for component backgrounds and
   6-8 for borders; Primer ships `--bgColor-accent-muted: #ddf4ff` with
   `--borderColor-accent-muted: #54aeff66`; shadcn defines flat
   `--accent: oklch(0.97 0 0)` (dark `oklch(0.269 0 0)`) surfaces.
2. **Border/ring emphasis** — neutral surface, accent moves to the edge:
   selected -> `border-color: var(--accent-border)` (Geist pattern), or
   Tailwind-style `ring-2` + shadow for an emphasized tier.
3. **Elevation** — shadow tokens (`--shadow-resting-*` / `--shadow-floating-*`,
   Primer pattern) instead of decorative fills.
4. **Semantic status token** — `background/border/text` role triplets per
   status (information/success/warning/danger; Atlassian pattern) when the
   emphasis carries meaning.

One-sided accent bars are not a channel (FE-SIDE-ACCENT-01 in
[anti-slop.md](anti-slop.md)).

```css
/* flat tint + border, derived from semantic tokens — no wash */
.panel-emphasis {
  background: color-mix(in oklch, var(--primary) 6%, var(--background));
  border: 1px solid color-mix(in oklch, var(--primary) 30%, var(--border));
}
```

Field note (live-measured 2026-07-09): Toss/Kakao/Naver/Channel Talk/Daangn all
style functional highlighted cards as flat solid/pastel tints with border 0-1px
and little or no shadow; gradients appear only in hero backgrounds and
illustration mockups.

## Neutral Controls and Color Budget (FE-COLOR-RESTRAINT-01, DEFAULT, user contract 2026-11-21)

What is clicked stays neutral; what is measured or signalled may carry hue. Reference: a
native macOS utility toolbar (Activity Monitor). Its actions are monochrome glyphs in neutral
circles, its view switcher is a neutral segmented control whose selected segment is one gray
step darker, and color appears only in the CPU chart and the figures that match it.

Color budget per rendered screen:

- Neutrals: ink, one muted text step, two or three surface/border steps.
- At most one accent hue, spent on focus rings, links inside prose, the selected data series
  or the one number that carries the claim.
- Semantic status hues only where a state is shown, each with a non-color cue.
- Check: list every distinct non-neutral hue on the rendered screen. More than one
  non-semantic hue, or a hue that only decorates, fails.

Buttons:

| Tier | Treatment |
|---|---|
| Primary, one per view | Ink fill: foreground color as background, background color as text. Not a brand hue. |
| Secondary | Neutral surface, 1px neutral border, ink text. |
| Tertiary and toolbar | Glyph or text on a transparent or neutral ground; hover moves one neutral step. |
| Destructive | Neutral button with an explicit verb ("Delete 3 files"); the danger hue appears only on the confirming control inside the confirmation surface. |

A hue-filled button is allowed only when the brief names a brand-colored primary: then one per
screen, no gradient, no glow, every other button neutral. Different hues per button and
colored chips used as actions are not allowed.

Icon controls:

- Monochrome SVG glyphs from one library or one authored set, one stroke weight, painted with
  `currentColor` so the control's text color drives them. No multicolor icons or emoji as
  actions.
- The glyph sits in a neutral shape (circle or rounded square in the chrome's own gray) that
  moves one neutral step on hover and press; 44x44px target; an accessible name, plus a
  tooltip when the glyph is not self-evident.
- Related actions share one neutral capsule instead of separate colored buttons.

Selected and active states (tabs, segmented controls, nav items, chips): one neutral step
darker (lighter in dark mode) plus weight or a filled glyph. Never a hue tint, never a side bar
(FE-SIDE-ACCENT-01 in [anti-slop.md](anti-slop.md)).

```css
:root { --fg: oklch(0.21 0 0); --bg: oklch(0.99 0 0); --surface-2: oklch(0.955 0 0);
        --surface-3: oklch(0.92 0 0); --line: oklch(0.88 0 0); --focus: var(--accent); }
.btn         { background: var(--bg); color: var(--fg); border: 1px solid var(--line); }
.btn:hover   { background: var(--surface-2); }
.btn-primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.icon-btn    { inline-size: 44px; block-size: 44px; border: 0; border-radius: 999px;
               display: grid; place-items: center; background: var(--surface-2); color: var(--fg); }
.icon-btn:hover { background: var(--surface-3); }
.icon-btn svg   { inline-size: 20px; block-size: 20px; fill: none; stroke: currentColor; stroke-width: 1.75; }
.segmented [aria-selected="true"] { background: var(--surface-3); font-weight: 600; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
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
