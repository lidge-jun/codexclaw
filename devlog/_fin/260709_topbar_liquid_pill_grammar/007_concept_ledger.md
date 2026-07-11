# WP6 S1 — Concept Pass Element Ledger (component context-strip, 3 renders)

Dogfooding UX-CONCEPT-GEN-01 (rewritten in WP3): `ima2 status` FAILED ->
`ima2 serve` started (persistent exec session 70333) -> re-probe OK -> 3
context-strip renders (bar+hero top viewport), long explicit prompts.
Files: `assets/concept/concept_{a,b,c}.png` (read back via view_image).

## Element ledger (synthesis — per-token best source)

| Token | Source | Reading |
|---|---|---|
| Bar geometry | A | Capped-width detached capsule, top inset, logo left / 4 links / 1 filled black CTA — cleanest slot rhythm |
| At-top material | A | ~76% white over CALM sky zone: legible, clearly "liquid인 척" |
| Scrolled/busy material need | B, C | Over busy imagery (clay hands, dark water) the bar reads correctly only near-opaque — validates the 85-95% scrolled state |
| Dropdown | B | Solid white panel, borderless rows, one gray hover fill — exactly FE-TOPBAR-HOVER-01 + FE-PILL-NEST-01 |
| Hero type | A, C | Weight-300 centered display, tracking 0, two lines — target look confirmed at both light-on-dark (C) and dark-on-light (A) |
| Next-section peek | C | Solid off-white band sliver at bottom edge — FE-HERO-01 viewport-fit cue |
| CTA color | A (black) | B green/C coral fine, black is calmest against photo backdrops |
| Backdrop strategy | A+C blend | Demo uses generated CLEAN sky (calm top zone per FE-TOPBAR-STATE-01) with denser lower clouds so scroll transition earns the opacity ramp |

Divergences noted: B rendered the dropdown detached below the bar (gap) —
demo attaches panel to trigger; C put white text over mid-contrast foam — demo
verifies worst-case contrast per FE-LIQUID-A11Y-01.

Clean no-text content assets generated for the build: `assets/hero_sky.jpg`,
`assets/band_clay.jpg` (generated CONTENT assets — legal per
FE-ASSET-CONCEPT-01; concept PNGs remain exploration artifacts, not shipped).
