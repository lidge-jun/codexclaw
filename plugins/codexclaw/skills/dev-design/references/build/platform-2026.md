# Platform 2026 — native features that replace JavaScript

Read before adding a positioning library, a custom select, an auto-growing textarea, an
enter/exit animation script or a scroll listener. Statuses read 2026-11-21 from MDN Baseline
badges and dated release notes (sources per row); re-check MDN before quoting a status,
because "newly available" moves monthly.

## Prefer the platform (FE-PLATFORM-2026-01, DEFAULT)

Reach for the native feature first, with the stated guard, and add a library only when a
listed gap blocks the brief. Baseline features ship without a fallback beyond the guard;
partial features ship as progressive enhancement where the non-supporting browser still
gets a correct, if plainer, result. Never ship a feature from the "partial" rows as the only
path to a required control.

| Feature | Status (2026-11) | Guard / fallback | Replaces | Source |
|---|---|---|---|---|
| Popover API (`popover`, `popovertarget`) + invoker commands (`commandfor`) | Baseline (popover 2025-01, invokers 2025-12) | none needed | toggle scripts, outside-click handlers | anhtu.dev 2026-10-05 |
| Anchor positioning (`anchor-name`, `position-anchor`, `position-area`, `position-try-fallbacks: flip-block, flip-inline`) | Baseline 2026, newly available since 2026-09 (Chrome 125, Firefox 147, Safari 26) | `@supports (position-anchor: --a)`; plain `position: absolute; inset-block-start: 100%` outside it | Floating UI / Popper for menus, tooltips, popovers (default choice now: popover + anchor) | MDN position-anchor; cssdna 2026-08-26 |
| `@starting-style` + `transition-behavior: allow-discrete` | Baseline since 2024-08 (widely ~2027-02) | Firefox fades in but snaps out (does not transition `display`); accept the snap or keep exit JS for that case | class-toggle enter animations | flaviocopes 2026-09-21 |
| Scroll-driven animations (`animation-timeline: scroll()/view()`) | All three engines since Firefox 159 (2026-10-27) | wrap in `@media (prefers-reduced-motion: no-preference)` and `@supports (animation-timeline: view())`; content visible without it | scroll listeners, simple ScrollTrigger reveals | jarednewnam.com 2026-11-06 |
| `text-box-trim` / `text-box: trim-both cap alphabetic` | Baseline 2026, since 2026-08 (Firefox 154) | none; unsupported browsers keep normal leading | negative-margin optical centering in buttons and headings | MDN text-box-trim |
| Style queries on custom properties (`@container style(--x: y)`) | All three engines (Firefox 151) | `@supports` not available for style queries; keep a sensible default state | theme/variant class juggling | cssdna 2026-08-26 |
| Same-document view transitions (`document.startViewTransition`) | Baseline | reduced-motion check | route animation libraries | uiarchives 2026-11-18 |
| Cross-document view transitions (`@view-transition { navigation: auto }`) | Chromium + Safari; Firefox partial | none needed; unsupported browsers navigate normally | MPA page-transition scripts | uiarchives 2026-11-18 |
| `field-sizing: content` | Chromium + Safari | `min-height`/`max-height` in `lh`; other browsers keep a fixed size | auto-resize textarea scripts | uiarchives 2026-11-18 |
| Customizable select (`appearance: base-select`, `::picker(select)`, `<selectedcontent>`) | Chrome/Edge 135+, Safari 27; Firefox behind a flag | progressive enhancement only; the native select still works and must stay styled | custom select libraries (when the unified dropdown skin allows) | web.dev 2026-10 release notes |
| `<dialog closedby="any">` | Chrome, Firefox; Safari not yet (Interop 2026) | keep an explicit close button and Esc handling | modal managers' light-dismiss code | anhtu.dev 2026-10-05 |
| Interest invokers (`interestfor`) | Chromium only | progressive enhancement; the target must also open on click/focus | hover-card and tooltip JS | uiarchives 2026-11-18 |

Already covered elsewhere and Baseline: `oklch()`, `color-mix()`, `light-dark()` ([color
system](color-system.md)); container size queries; `text-wrap: balance/pretty`
([typography wrapping](typography-wrapping.md)).

## Recipes

```css
/* Menu: popover + anchor, flips by itself, no JS */
.menu-trigger { anchor-name: --menu; }
.menu[popover] { position-anchor: --menu; position-area: block-end span-inline-end;
  position-try-fallbacks: flip-block, flip-inline; margin: 4px 0; }
@supports not (position-anchor: --menu) { .menu[popover] { inset: auto; } }

/* Enter/exit without a class toggle */
.menu[popover] { opacity: 1; transition: opacity .15s, display .15s allow-discrete, overlay .15s allow-discrete; }
.menu[popover]:not(:popover-open) { opacity: 0; }
@starting-style { .menu[popover]:popover-open { opacity: 0; } }

/* Optical centering of button labels and display type */
.btn, h1 { text-box: trim-both cap alphabetic; }

/* Auto-growing textarea */
textarea { field-sizing: content; min-height: 3lh; max-height: 12lh; }
```

Accessibility stays with the owner files: ARIA and keyboard for menus and comboboxes in
[a11y patterns](a11y-patterns.md); dropdown skin in [dropdown layer](dropdown-layer.md); motion
budgets in [motion](motion.md).
