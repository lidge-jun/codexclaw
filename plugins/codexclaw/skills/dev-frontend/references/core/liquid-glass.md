# Liquid Glass & Translucent Materials - Implementation Guide

Implementation rules for Apple-class translucent materials ("Liquid Glass"),
classic glassmorphism, and the cheaper pill-over-imagery alternative.
Sources: Apple HIG Materials + aside.com rendered measurements + dcinside
practitioner notes (verified 2026-07-07; evidence:
`devlog/_fin/260707_liquid_glass_motion_trends/000_research.md`).
Design judgment (is glass domain-correct at all?) is owned by
`dev-uiux-design` - this file owns material recipes. Top-bar composition,
slots, and scroll choreography live in `references/core/top-bar.md`.

---

## Layer Discipline (FE-LIQUID-LAYER-01, DEFAULT)

Apple's 2025-2026 material system treats glass as a **functional-layer
material**, and the rule ports directly to the web:

- Glass belongs to floating **controls and navigation**: sticky headers, tab
  bars, sidebars, floating toolbars, command palettes, media overlays.
  Content scrolls and "peeks through" beneath it - that is the entire point.
- **Never in the content layer.** Cards-as-content, app backgrounds, article
  panels, and form bodies use solid or standard translucent surfaces, not
  glass. Glass-on-everything flattens hierarchy and reads as 2026 AI slop.
  Exception: a transient interactive element (slider/toggle mid-interaction)
  may momentarily adopt glass to emphasize interactivity.
- **Use sparingly.** One glass layer class per viewport region. If two glass
  surfaces stack, the lower one loses its meaning; merge, solidify, or demote
  one.
- Prefer named material states over generic "regular glass" decisions. Text
  chrome defaults to near-opaque pill material; highly transparent glass is a
  media-overlay exception, not the baseline.

## Named Material States (FE-LIQUID-STATE-01, DEFAULT)

| State | Legal Use | Material Contract |
| --- | --- | --- |
| `pill-at-top` | Text-bearing top bar ONLY while resting over a hero authored with a calm bar zone. | Pill chrome at about 70-80% opacity. No busy imagery, hard contrast, or scrolling content may sit beneath text. |
| `pill-scrolled` | Default text-bearing chrome state once content can pass beneath the bar. | Near-opaque 85-95% surface with blur 12-16px when blur is affordable; may collapse to blur-free near-opaque. |
| `media-overlay` | Media/photo/video controls where the image remains the subject. | The old canvas-55% regular recipe, demoted to overlay chrome only. Avoid dense text. |
| `clear` | Sparse, large controls over rich media only. | No blur backing; tint/border only. Never for text-heavy nav, menus, forms, or body content. |

Scroll-adaptive top bars transition from `pill-at-top` to `pill-scrolled` by
animating background-color/opacity only. Do not morph size, radius, padding, or
layout on a blurred bar; that belongs in `top-bar.md` composition planning and
is also a performance constraint below.

Bar-spawned surfaces (dropdowns, menus, popovers, combobox panels, date pickers,
and hover/tap-revealed chrome) are **unconditionally near-opaque, blur-free
SOLID**. They do not inherit `pill-at-top`, `pill-scrolled`, `media-overlay`, or
`clear`. This resolves glass-on-glass stacking and preserves the <= 2 visible
blurred-surfaces budget.

## Pill Nesting (FE-PILL-NEST-01, DEFAULT)

Inside a pill container (border-radius >= 24px or the `9999px` chrome class),
child elements must NOT render their own capsule border or outline at rest. The
`( () () () )` nested-ring look is banned.

This is a visual border/outline rule, not a functional ban:

- Solid fills are not restricted by this rule, at any count.
- One-primary-action and accent-budget hierarchy rules still apply on top.
- The container's own single hairline border stays legal.
- Shadow-only children are legal.
- Hover, active, and `aria-current` fills/tints are legal at rest.

## CSS Recipes (STYLE_SAMPLE)

```css
/* pill-at-top - text-bearing top bar over an authored calm hero zone */
.liquid-pill-at-top {
  background: rgb(255 255 255 / 0.76);
  border: 1px solid rgb(255 255 255 / 0.26);
  border-radius: 9999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.16),
              0 8px 28px rgb(0 0 0 / 0.10);
}

/* pill-scrolled - default text-bearing chrome */
.liquid-pill-scrolled {
  background: rgb(255 255 255 / 0.90);
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
  border: 1px solid rgb(255 255 255 / 0.24);
  border-radius: 9999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14),
              0 10px 32px rgb(0 0 0 / 0.12);
}

/* media-overlay - old "regular glass", now only for media/photo overlay chrome */
.liquid-media-overlay {
  background: color-mix(in oklab, canvas 55%, transparent);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid rgb(255 255 255 / 0.18);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12),
              0 8px 32px rgb(0 0 0 / 0.12);
}

/* clear - sparse controls over rich media only */
.liquid-clear {
  background: rgb(255 255 255 / 0.10);
  border: 1px solid rgb(255 255 255 / 0.25);
  /* no backdrop-filter: content behind stays crisp */
}

/* bar-spawned menu/popover/select surface */
.chrome-surface-solid {
  background: rgb(255 255 255 / 0.96);
  border: 1px solid rgb(0 0 0 / 0.08);
  border-radius: 18px;
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.16);
}

/* blur-free pill chip - aside.com pattern */
.pill-chip {
  background: rgb(255 255 255 / 0.92);
  border-radius: 9999px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.08);
}
```

### Glass without blur (aside.com pattern, measured 2026-07-07)

The user-visible "liquid glass feel" often needs NO backdrop-filter at all.
aside.com renders 0 `backdrop-filter` elements site-wide; the material feel
comes from **opaque/translucent white pills and rounded cards floating over
soft photographic or pastel-gradient backgrounds**.

Prefer this pattern when: many chips/cards per viewport, mid/low-end device
targets, or text-heavy chips - it is cheaper, more legible, and still reads
as the 2026 Apple-pastel language.

### Pill geometry (STYLE_SAMPLE, aside.com measured)

Rounded systems read as designed when radii form a small scale, not one
global value: e.g. 8px (inputs, small cards) / 12px (cards) / 16-20px
(containers, modals) + `9999px` pill class for chips, CTAs, and eyebrows.
Interactive chips are pills; page-level containers take the largest tier.
Do not mix a pill CTA with a 4px-radius input in the same cluster.

## Performance Gate (FE-LIQUID-PERF-01, DEFAULT)

Conservative local guidance. The cost model below is Tier-1 corroborated,
not locally benchmarked (see the research doc in the header) - treat
`backdrop-filter` as expensive by default until profiling says otherwise:

- Keep blurred surfaces **small**: chrome bars and chips, never full-page
  overlays or hero-sized panels.
- Keep radius modest (12-16px for pill chrome; 8-20px broader range); expect
  cost to grow with blurred area and radius.
- Avoid `backdrop-filter` on elements inside scrolling containers or on
  elements that animate size, position, radius, padding, or layout; scroll
  state changes on blurred bars animate background-color/opacity only.
- Per-viewport budget: aim for <= 2 backdrop-filtered surfaces visible at
  once; prefer blur-free near-opaque surfaces beyond that.
- Profile on a mid-range phone before shipping any glass-heavy surface; if
  scrolling stutters, swap blurred states for near-opaque solid surfaces first.

## Accessibility Gate (FE-LIQUID-A11Y-01, STRICT)

This gate is supreme over all named states. Under reduced-transparency or
high-contrast preferences, every translucent state collapses to solid or
near-opaque; state names do not override the user preference.

- Honor user material preferences: reduce or remove translucency under
  `@media (prefers-reduced-transparency: reduce)` (check current browser
  support before relying on it; provide a solid fallback background
  regardless) and raise surface opacity under `@media (prefers-contrast:
  more)`.
- **Contrast on translucent states is unprovable from tokens alone**: text
  over `pill-at-top`, `pill-scrolled`, `media-overlay`, or `clear` must pass
  WCAG contrast against the WORST-case background that can appear beneath it.
  Verify with a rendered screenshot over the busiest background state, not
  against the tint color. Unconditionally opaque spawned surfaces are audited
  for normal contrast, not translucency.
- Blur is not a contrast tool. If text needs the blur to be readable, the
  surface opacity is too low.
- `backdrop-filter` failures (unsupported engines) must degrade to a solid
  or near-opaque background via `@supports not (backdrop-filter: blur(1px))`.
