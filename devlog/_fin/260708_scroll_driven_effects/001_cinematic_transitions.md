# Cinematic Section Transitions Research

**Date**: 2026-07-08
**Method**: GPT-5.5 explorer (Bohr) web search
**Context**: Follow-up to 000_research.md — full-screen/"flying" section transition effects for motion.md

---

## Core Finding

Most cinematic section-transition systems share one architecture: a **pinned
full-viewport stage**, layered sections/images, and scroll progress mapped to a
timeline. GSAP ScrollTrigger is the practical production default for complex
sequencing (`pin`, `scrub`, `snap`, timelines are built for exactly this). CSS
scroll-driven animations cover simpler transform/opacity/wipe cases, and the
View Transitions API is best for discrete state changes, not continuous scroll
scrubbing.

Tool selection:
1. **GSAP ScrollTrigger** — continuous cinematic scroll scenes
2. **CSS scroll-driven animations** — simple fades, wipes, progress-linked transforms
3. **View Transitions API** — click/state/page morphs, card-to-detail
4. **Canvas/WebGL** — only when product fidelity requires image sequences or shader transitions

---

## Pattern Catalog

| Pattern | CSS or JS | Code Pattern | Notes |
|---------|-----------|--------------|-------|
| Zoom-through | JS (CSS for simple scale) | Pin wrapper, scale foreground 8-30x, fade next scene behind | transform/opacity only; `overflow:hidden`, `transform-origin:center` |
| 3D perspective fly-through | JS | `.stage{perspective:1200px}`, animate `z`/`scale`/`rotationX` + opacity | many composited layers; flatten finished layers |
| Full-viewport crossfade/morph | CSS or JS | Stacked absolute sections, opacity + scale (`.92`/`1.08`) | cheapest; opacity+transform only |
| Card-to-fullscreen expand | JS (View Transitions/FLIP) | `viewTransitionName` or GSAP Flip converts size/pos delta to transforms | avoid animating layout directly |
| Wipe/reveal | CSS or JS | `clip-path: inset(...)`, SVG mask, or translated cover panel | translated cover is fastest; clip-path/mask can repaint |
| Tunnel/portal | JS | `clip-path: circle(var(--r) at 50% 50%)` grows, or mask cutout | pre-rendered mask scale is smoother than clip-path repaint |
| Scale + opacity depth | CSS or JS | Prev scales down/fades, next scales `1.08 -> 1` | safest high-end look, compositor-friendly |
| View Transitions section morph | JS trigger + CSS | `startViewTransition()`, `::view-transition-old/new(name)` | snapshot-based; discrete states, not scroll progress |
| GSAP pinned timeline | JS | `gsap.timeline({scrollTrigger:{pin:true,scrub:1,snap:1/(n-1)}})` | build timeline first, one master timeline |

---

## Production Rules

- Animate `transform` and `opacity` as the default vocabulary. Layout/paint
  properties are hard to keep smooth (web.dev, Chrome perf docs).
- Always include `prefers-reduced-motion`, mobile-specific timelines, smaller
  media variants, and a non-pinned fallback for narrow/touch devices.
- Pinning feels heavy on mobile Safari; use `ScrollTrigger.matchMedia()` to
  simplify or disable pins on small screens.
- For zoom-through, reduce max scale and asset size on mobile; giant raster
  layers cause memory crashes.
- Tune depth-illusion scale lower on mobile (`1.04 -> 1`) to avoid motion sickness.

---

## Sources

| Topic | Source |
|-------|--------|
| GSAP ScrollTrigger (pin/scrub/snap) | [gsap.com](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) |
| View Transitions API | [Chrome](https://developer.chrome.com/docs/web-platform/view-transitions), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) |
| Layered zoom scroll effect | [Codrops](https://tympanus.net/codrops/2025/10/29/building-a-layered-zoom-scroll-effect-with-gsap-scrollsmoother-and-scrolltrigger/) |
| SVG mask transitions on scroll | [Codrops](https://tympanus.net/codrops/2026/03/11/svg-mask-transitions-on-scroll-with-gsap-and-scrolltrigger/) |
| Large image to content page transition | [Codrops](https://tympanus.net/codrops/2022/08/03/large-image-to-content-page-transition/) |
| Full image reveal (cover slide) | [Codrops](https://tympanus.net/codrops/2018/06/12/full-image-reveal-effect/) |
| CSS scroll-driven animations | [WebKit](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) |
| Performant animations (transform/opacity) | [web.dev](https://web.dev/articles/animations-guide) |
| Non-composited animation warnings | [Chrome Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/non-composited-animations) |
| Apple AirPods-style image sequence | [Medium (Trehan)](https://ankittrehan2000.medium.com/creating-scroll-animations-similar-to-apples-airpods-pro-page-bc5c1c0814df) |
| Apple product references | [AirPods Pro](https://www.apple.com/airpods-pro/), [iPhone Air](https://www.apple.com/iphone-air/) |
| Lenis cinematic scroll | [lenis.dev](https://lenis.dev/) |
| Awwwards zoom-in example (Krew) | [awwwards.com](https://www.awwwards.com/inspiration/video-zoom-in-on-scroll-krew) |

---

## motion.md Reflection

New section added: `## Cinematic Section Transitions (Level 8+)` after the
Scroll-Driven section, before the Scroll Pattern Decision Tree. Includes the 9
patterns above with code, a comparison table, domain gate (landing/campaign
only), and mobile/reduced-motion handling. Decision Tree updated with a
cinematic-transition branch.
