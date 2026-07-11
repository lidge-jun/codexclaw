# WP6 S3 — Demo Render Verification (in-app browser, HTTP-served)

Server: `python3 -m http.server 8642` from the devlog unit (exec session 99944).
URL: `http://127.0.0.1:8642/demo/index.html`. All screenshots read back via
view_image; computed styles via read-only page evaluate; reduced-motion via
CDP `Emulation.setEmulatedMedia`.

## Screenshots (assets/)

| File | Proves |
|---|---|
| `verify_attop.png` | pill-at-top state (bar bg rgba(255,255,255,0.76)) over calm sky zone; FE-HERO-LIGHT-CENTER-01 (centered, weight 300, real photo backdrop, Korean subtitle renders); borderless pill children; aria-current tint on "Craft"; ONE filled CTA; next-section peek cue |
| `verify_scrolled_dropdown.png` | pill-scrolled (bg 0.90 + blur) floating over golden clouds; dropdown solid near-opaque (0.96, blur-free) with borderless rows; "Product" ring = focus indicator (state, not rest — a11y-required, exempt from FE-PILL-NEST-01) |
| `verify_select_open.png` | skinned form select (listbox) desktop panel, same dropdown-layer skin |
| `verify_mobile_sheet.png` | 390px: listbox renders as same-skin bottom sheet (position fixed, bottom 0, top-only 18px radius, selected-option tint, Korean option) |

## Computed-style motion evidence (FE-MOTION-BUCKET-01 floor)

Normal (base experience), scrollY 0 -> 900:

```json
before: { mediaTransform: "matrix(1.08,...)", mediaOpacity: "1",
          revealOpacity: "0", revealTransform: "translateY(28px)",
          barBg: "rgba(255,255,255,0.76)", scrollTimelineSupported: true }
after:  { mediaTransform: "matrix(1.00364,...)", mediaOpacity: "0.570486",
          revealOpacity: "1", revealTransform: "none",
          barBg: "rgba(255,255,255,0.9)", barClass: "top-bar scrolled" }
```

= exactly 2 distinct choreographed scroll motions (signature hero drift +
supporting view() reveal), within floor 2 / ceiling 4.

Emulated `prefers-reduced-motion: reduce` (CDP):

```json
{ matchesReduce: true, mediaAnimation: "none", mediaTransform: "none",
  mediaOpacity: "1", revealAnimation: "none", revealOpacity: "1" }
```

= base-experience scoping holds: reduced users get a fully static page.

## State checks

- Bar transition animates background-color only (single `transition` prop);
  no size morph. IntersectionObserver sentinel, no scroll listener.
- Dropdown/menu + listbox: full keyboard paths (Arrow/Escape/Enter) wired;
  focus-visible outlines present; skip link; scroll-margin-top on sections.
- `@supports not (backdrop-filter)` and reduced-transparency/contrast
  collapse rules present in CSS (static fallbacks to solid white).

Residual notes: viewport override in the in-app browser rendered the 390px
page in a column (screenshot wider than page) — evidence still legible;
demo uses generated CONTENT assets (hero_sky.jpg, band_clay.jpg) per
FE-ASSET-CONCEPT-01; concept renders remain exploration artifacts.
