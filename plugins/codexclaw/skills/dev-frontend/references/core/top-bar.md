# Top Bar Composition - Implementation Guide

Canonical owner for top-bar composition: geometry, slots, scroll-state
contract, spawned surfaces, and verification hooks. Material recipes live in
`liquid-glass.md`; do not duplicate opacity/blur recipes here. The top-bar
domain GATE lives in this file (FE-TOPBAR-DOMAIN-01 below); broader brand/
style judgment beyond that gate lives in `dev-uiux-design`.

---

## Domain Gate (FE-TOPBAR-DOMAIN-01, STRICT)

Liquid pill top bars are for expressive surfaces: landing, campaign,
editorial, portfolio, brand, and visual product pages.

Dashboards, admin, finance, government, B2B repeated-work tools, auth,
payment, security, and developer consoles keep standard solid headers by
default. Their chrome should be predictable, dense, and readable before it is
expressive.

## Geometry

Prefer a floating detached pill bar only when the first viewport can support it.
The bar must have a capped max-width, top inset, safe-area handling, and a
single outer capsule radius (`9999px` or >= 24px).

| Surface | Geometry | Notes |
| --- | --- | --- |
| Landing / campaign / portfolio | Floating detached pill | Legal when the hero has a calm bar zone and enough top breathing room. |
| Editorial / brand story | Floating pill or quiet full-width | Choose based on reading comfort and hero image complexity. |
| Consumer app shell | Full-width or compact solid header | Use pill only for promotional/home surfaces, not repeated workflows. |
| Dashboard / admin / finance / gov / B2B tool | Full-width solid header | Avoid detached liquid chrome; preserve scanning and task speed. |

STYLE_SAMPLE:

```css
.top-bar {
  position: sticky;
  top: max(12px, env(safe-area-inset-top));
  z-index: 40;
  width: min(calc(100% - 32px), 1120px);
  margin-inline: auto;
  border-radius: 9999px;
}
```

## Slots

Keep the bar sparse enough that the pill still reads as one piece of chrome:

- Logo: use the real brand SVG; see `brand-asset-sourcing.md`.
- Navigation: 2-5 links. More destinations move into a menu or full navigation
  surface.
- Controls: only include controls that earn their place in the first viewport
  (for example theme, language, account, or search when essential).
- CTA: one filled pill CTA is allowed. It must not create a row of competing
  primary actions.

Mobile collapses to logo + menu trigger. The menu opens a sheet or drawer with
a complete tap path; do not rely on hover behavior on touch devices.

## Scroll State (FE-TOPBAR-STATE-01, DEFAULT)

Top bars may be scroll-adaptive:

- At top: a lighter material state around 70-80% opacity is allowed only over a
  hero authored with a calm bar zone behind the chrome.
- Scrolled: use the near-opaque 85-95% opacity range and keep blur when the
  selected material state calls for it.
- Transition: animate `background-color` and `opacity` only. Do not morph size,
  width, radius, or layout on blurred bars.
- Accessibility supremacy: `FE-LIQUID-A11Y-01` in `liquid-glass.md` overrides
  every state here. Reduced-transparency, increased-contrast, unsupported
  `backdrop-filter`, or failed worst-case contrast collapses all states to
  solid or near-opaque.

STYLE_SAMPLE:

```css
.top-bar {
  transition: background-color 180ms ease, opacity 180ms ease;
}
```

## Hover Surfaces (FE-TOPBAR-HOVER-01, DEFAULT)

Any surface spawned from the bar is unconditionally near-opaque, blur-free, and
solid: dropdown, mega-menu, popover, account menu, language picker, or search
panel. Content must remain legible over the busiest background that can appear
behind it.

Hover surfaces also need a tap path. Mobile uses the same visual skin where
appropriate, but the interaction becomes a sheet, drawer, or proven picker
primitive with correct ARIA and keyboard behavior.

## Child Visuals

Nested pill visuals are governed by `FE-PILL-NEST-01` in `liquid-glass.md`.
Inside pill chrome, child controls render no capsule borders or outlines at
rest. Solid fills are not restricted by that rule; use hierarchy and accent
budget to decide how many strong fills the bar can carry.

Use fill or tint, not rest-state capsule borders, for `aria-current` and active
navigation state.

## Accessibility

The full bar and every spawned surface must be keyboard reachable:

- Tab order enters the logo, links, controls, CTA, and spawned surfaces in a
  predictable path.
- Escape closes spawned surfaces and returns focus to the trigger.
- Arrow-key behavior follows the underlying primitive pattern for menu,
  combobox, listbox, or picker.
- Sticky chrome never hides focused content; apply `scroll-margin-top` or
  equivalent offsets to in-page targets.
- Skip links remain visible and usable with the sticky bar present.

## Verification Hooks

Screenshot or otherwise inspect:

- At-top and scrolled states over their real hero/background.
- A bar-spawned hover surface over the busiest possible background.
- Reduced-transparency / increased-contrast collapse to solid or near-opaque.
- Mobile logo + menu trigger and the resulting sheet or drawer tap path.
