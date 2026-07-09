# Liquid Glass & Translucent Materials — Implementation Guide

Implementation rules for Apple-class translucent materials ("Liquid Glass"),
classic glassmorphism, and the cheaper pill-over-imagery alternative.
Sources: Apple HIG Materials + aside.com rendered measurements + dcinside
practitioner notes (verified 2026-07-07; evidence:
`devlog/_fin/260707_liquid_glass_motion_trends/000_research.md`).
Design judgment (is glass domain-correct at all?) is owned by
`dev-uiux-design` — this file owns how to build it.

---

## Layer Discipline (FE-LIQUID-LAYER-01, DEFAULT)

Apple's 2025-2026 material system treats glass as a **functional-layer
material**, and the rule ports directly to the web:

- Glass belongs to floating **controls and navigation**: sticky headers, tab
  bars, sidebars, floating toolbars, command palettes, media overlays.
  Content scrolls and "peeks through" beneath it — that is the entire point.
- **Never in the content layer.** Cards-as-content, app backgrounds, article
  panels, and form bodies use solid or standard translucent surfaces, not
  glass. Glass-on-everything flattens hierarchy and reads as 2026 AI slop.
  Exception: a transient interactive element (slider/toggle mid-interaction)
  may momentarily adopt glass to emphasize interactivity.
- **Use sparingly.** One glass layer class per viewport region. If two glass
  surfaces stack, the lower one loses its meaning; merge or demote one.
- Two variants, matching HIG:
  - **regular** — blur + luminosity adjustment backing; default. Use when
    the surface carries text or many controls (headers, sidebars, popovers).
  - **clear** — no blur backing, just tint/border; ONLY over visually rich
    media backgrounds where the content behind is the hero (video players,
    photo overlays), and only for sparse, large-type controls.

## CSS Recipes (STYLE_SAMPLE)

```css
/* Regular glass — text-bearing floating chrome */
.glass-regular {
  background: color-mix(in oklab, canvas 55%, transparent);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid rgb(255 255 255 / 0.18);          /* edge refraction */
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12),  /* top highlight */
              0 8px 32px rgb(0 0 0 / 0.12);
}

/* Clear glass — sparse controls over rich media only */
.glass-clear {
  background: rgb(255 255 255 / 0.10);
  border: 1px solid rgb(255 255 255 / 0.25);
  /* no backdrop-filter: content behind stays crisp */
}

/* Scroll-edge legibility: fade a blur/opacity ramp under sticky chrome
   instead of hard borders (HIG "scroll edge effect" equivalent) */
.scroll-edge {
  mask-image: linear-gradient(to bottom, black 60%, transparent);
}
```

### Glass without blur (aside.com pattern, measured 2026-07-07)

The user-visible "liquid glass feel" often needs NO backdrop-filter at all.
aside.com renders 0 `backdrop-filter` elements site-wide; the material feel
comes from **opaque/translucent white pills and rounded cards floating over
soft photographic or pastel-gradient backgrounds**:

```css
.pill-chip {
  background: rgb(255 255 255 / 0.92);   /* near-opaque white */
  border-radius: 9999px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.08);
}
/* parent section supplies the "glass" richness */
.section-wash { background: linear-gradient(...soft pastel or photo...); }
```

Prefer this pattern when: many chips/cards per viewport, mid/low-end device
targets, or text-heavy chips — it is cheaper, more legible, and still reads
as the 2026 Apple-pastel language.

### Pill geometry (STYLE_SAMPLE, aside.com measured)

Rounded systems read as designed when radii form a small scale, not one
global value: e.g. 8px (inputs, small cards) / 12px (cards) / 16-20px
(containers, modals) + `9999px` pill class for chips, CTAs, and eyebrows.
Interactive chips are pills; page-level containers take the largest tier.
Do not mix a pill CTA with a 4px-radius input in the same cluster.

## Performance Gate (FE-LIQUID-PERF-01, DEFAULT)

Conservative local guidance. The cost model below is Tier-1 corroborated,
not locally benchmarked (see the research doc in the header) — treat
`backdrop-filter` as expensive by default until profiling says otherwise:

- Keep blurred surfaces **small**: chrome bars and chips, never full-page
  overlays or hero-sized panels.
- Keep radius modest (8-20px blur); expect cost to grow with blurred area
  and radius.
- Avoid `backdrop-filter` on elements inside scrolling containers or on
  elements that animate size/position; expect per-frame re-render cost
  there.
- Per-viewport budget: aim for <= 2 backdrop-filtered surfaces visible at
  once; prefer the glass-without-blur pattern beyond that.
- Profile on a mid-range phone before shipping any glass-heavy surface; if
  scrolling stutters, swap regular glass for near-opaque surfaces first.

## Accessibility Gate (FE-LIQUID-A11Y-01, STRICT)

- Honor user material preferences: reduce or remove translucency under
  `@media (prefers-reduced-transparency: reduce)` (check current browser
  support before relying on it; provide a solid fallback background
  regardless) and raise surface opacity under `@media (prefers-contrast:
  more)`.
- **Contrast on translucency is unprovable from tokens alone**: text over
  glass must pass WCAG contrast against the WORST-case background that can
  scroll beneath it. Verify with a rendered screenshot over the busiest
  background state, not against the tint color.
- Blur is not a contrast tool. If text needs the blur to be readable, the
  surface opacity is too low.
- `backdrop-filter` failures (unsupported engines) must degrade to a solid
  or near-opaque background via `@supports not (backdrop-filter: blur(1px))`.
