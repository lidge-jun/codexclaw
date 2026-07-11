# Motion Choreography — Animation Engineering Guide

Rules for meaningful, performant animation. One signature moment + a small number of supporting reveals > 10 scattered effects.

---

## Domain Gates

Motion intensity must match the product surface:

| Surface | Default |
| --- | --- |
| Finance, gov, B2B, auth, payment, security | TOOL: scroll-driven = 0 (hard); feedback/state transitions 1-4 OK |
| Dashboards, admin, ops, developer tools | TOOL: scroll-driven = 0 (hard); feedback/state transitions 1-4 OK |
| Consumer apps, education, community | APP: feedback + state-transition motion only; no scroll-motion floor |
| Landing, campaign, marketing, editorial, portfolio | LANDING: scroll-driven floor 2, ceiling ~4; expressive but still performant |
| Games / interactive art | domain-specific |

## FE-MOTION-BUCKET-01 - Motion Bucket Map (DEFAULT)

Classify the surface before choosing scroll choreography. The bucket map is the
primary gate; `MOTION_INTENSITY` is secondary.

- **LANDING**: landing, marketing, editorial, portfolio, and
  marketing-facing pages of any product, including AI tools, education, and
  community products. Scroll-driven motion floor = 2, ceiling ~4. The floor is
  **1 signature + >= 1 supporting reveal = floor 2**.
- **APP**: logged-in or in-app consumer, education, and community screens.
  Feedback + state-transition motion only; no scroll-motion floor.
- **TOOL**: dashboards, admin, finance, gov, B2B repeated-work, developer
  consoles, auth, and payment surfaces. Scroll-driven motion = 0 (hard);
  feedback/state transitions at levels 1-4 are preserved.
- **Games / interactive art**: domain-specific and exempt.

A "scroll motion" is one distinct choreographed scroll-driven moment, either a
signature moment or a supporting reveal. Identical per-section fade-up
repetition counts as one supporting moment total, not N. The floor applies to
the base experience only; `prefers-reduced-motion` and missing `@supports`
legitimately deliver zero motion.

Avoid cinematic page loads for repeated-work tools. Motion should clarify state, not slow the task.

## MOTION_INTENSITY Levels

| Level | Rules                                                                                                           |
| :---: | --------------------------------------------------------------------------------------------------------------- |
|  1-3  | No automatic animations. CSS `:hover` and `:active` only.                                                       |
|  4-7  | Enumerate transition properties, usually `transform`, `opacity`, `background-color`, `border-color`, `box-shadow`. `animation-delay` cascades. |
| 8-10  | Complex scroll-triggered reveals. Framer Motion hooks. NEVER `window.addEventListener('scroll')`.               |

---

Never use `transition-all` as a default in Tailwind or CSS all-property transitions. Enumerate the properties so layout, width, height, and color changes do not animate accidentally.

## CSS-Only Patterns (Level 4-7)

### Staggered Reveal
```css
.reveal-item {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeUp 0.6s ease forwards;
  animation-delay: calc(var(--index) * 100ms);
}

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}
```

### Hover Lift
```css
.card {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -15px rgba(0,0,0,0.1);
}
```

### Active Press
```css
.button:active {
  transform: translateY(1px) scale(0.98);
}
```

---

## Framer Motion Patterns (Level 6+)

### Spring Physics (mandatory for interactive elements)
```tsx
// Premium, weighty feel — no linear easing
const spring = { type: "spring", stiffness: 100, damping: 20 };
```

### Stagger Children
```tsx
// Parent + Children MUST be in the same Client Component tree
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};
```

### Layout Animations
```tsx
// Smooth re-ordering / resizing
<motion.div layout layoutId="unique-id" />
```

### Magnetic Hover (Level 8+)
**CRITICAL**: NEVER use `useState` for magnetic hover. Use EXCLUSIVELY:
```tsx
const x = useMotionValue(0);
const y = useMotionValue(0);
// No re-renders. Pure motion outside React cycle.
```

---

## Pointer-Proximity Motion — Icon Chips, Magnetic, Dock (Level 6+)

2026-trend surface: floating icon-chip clusters that respond to the cursor —
magnetic pull, dock-style magnification, proximity glow. Chip-as-content
composition is Tier-2 observed (aside.com, 2026-07-07); the motion patterns
below are Tier-1 pattern-survey synthesis — see
`devlog/_fin/260707_liquid_glass_motion_trends/000_research.md` §5. Use for
landing/expressive surfaces only (Domain Gates above); never inside
repeated-work tools.

Rules (FE-PROXIMITY-01, DEFAULT):

- **One listener, shared state.** Track `pointermove` once per cluster (or
  once on the section), write normalized cursor position into CSS variables
  inside a single rAF; chips consume the variables. Never N per-chip
  listeners.
- **Gate the capability**: wrap in `@media (hover: hover) and (pointer:
  fine)`; touch devices get the static layout (or a scroll-driven
  equivalent), not a broken hover sim.
- **Reduced motion**: proximity displacement counts as non-essential motion;
  under `prefers-reduced-motion: reduce`, chips stay static (opacity/color
  feedback only).
- Transform/opacity only, as everywhere else. Displacement caps keep text
  legible: magnetic pull <= 8-12px for buttons, dock scale <= 1.3-1.5.

```js
// Shared cluster loop: one pointermove -> CSS vars -> chips derive their own motion
const cluster = document.querySelector('.chip-cluster');
let px = 0, py = 0, raf = 0;
cluster.addEventListener('pointermove', (e) => {
  px = e.clientX; py = e.clientY;
  raf ||= requestAnimationFrame(() => {
    raf = 0;
    const r = cluster.getBoundingClientRect();
    cluster.style.setProperty('--mx', `${px - r.left}px`);
    cluster.style.setProperty('--my', `${py - r.top}px`);
  });
});
cluster.addEventListener('pointerleave', () => {
  cluster.style.setProperty('--mx', '-9999px'); // chips ease back to rest
});
```

- **Magnetic chip**: displacement = (cursor - chip center) x strength
  (0.2-0.5), eased back on leave via a `transform` transition or spring.
- **Dock magnification**: per-chip `scale = 1 + k * max(0, 1 -
  distance/influenceRadius)` with `transform-origin: bottom`; a
  linear/gaussian falloff over ~2-3 neighbor chips reads as macOS Dock.
  Reserve real dock behavior for playful/creative surfaces.
- With Framer Motion, keep this in `useMotionValue` + `useTransform` (no
  re-renders), same as Magnetic Hover above.

---

## Scroll-Driven (Level 8+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

### Scroll Progress
```tsx
const { scrollYProgress } = useScroll();
const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
```

### CSS Scroll-Driven Animations (preferred for reveal/progress)

The CSS scroll-driven animations module (MDN, verified 2026-07-07) animates
along scroll progress on the compositor — it replaces scroll-listener JS
(and most `useScroll` cases) for reveals, progress bars, and parallax:

```css
/* Progress bar tied to document scroll */
.progress { animation: grow linear; animation-timeline: scroll(root block); }
@keyframes grow { from { scale: 0 1; } to { scale: 1 1; } }

/* Reveal tied to the element's own viewport entry */
.reveal-item {
  animation: fadeUp linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 35%;
}
```

- Key surface: `animation-timeline: scroll(<scroller> <axis>)` / `view(<axis>
  <inset>)`, `animation-range(-start/-end)`, `scroll-timeline-*`,
  `view-timeline-*`, `timeline-scope`; JS `ScrollTimeline`/`ViewTimeline`.
- Support caveat: verify current engine support before shipping
  (Firefox landed late); provide non-animated final states as fallback
  (`both` fill + content visible without the animation).
- Browser support snapshot (Can I Use, 2026-07 research): 83.66%
  global usage; Chrome/Edge 115+, Safari/iOS Safari 26+, Firefox 155
  partial/subfeature support. Treat as progressive enhancement.
- Use `@supports` around scroll timelines and keep the base state usable:

```css
.reveal { opacity: 1; transform: none; }

@supports (animation-timeline: view()) {
  .reveal {
    opacity: 0;
    transform: translateY(16px);
    animation: fadeUp linear both;
    animation-timeline: view();
    animation-range: entry 15% cover 40%;
  }
}
```

- Scroll-linked icon-chip choreography (chips drifting/parallaxing at
  different rates while scrolling) = `view()` timelines with per-chip
  `animation-range` offsets — no JS.

### View Transitions API
```tsx
document.startViewTransition(() => {
  // DOM update
});
```

### Horizontal Scroll-in-Vertical (Level 8+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Domain gate: landing/campaign/editorial scrolltelling only. For tools,
dashboards, admin, ops, and developer consoles, prefer a normal table/list or a
native rail; never hijack vertical scroll for repeated work.

| Technique | Best Use | Tradeoff |
| --- | --- | --- |
| Native rail + CSS Scroll Snap | Cards, galleries, product shelves | Most accessible; needs visible affordance on desktop |
| Sticky + `translateX` | One-off story sections | Must manage focus, resize, and reduced motion |
| GSAP ScrollTrigger pin | Campaign-grade timeline choreography | Dependency cost; isolate from Framer component trees |
| CSS scroll-driven | Progressive-enhanced horizontal motion | Browser support requires `@supports` fallback |

Native rail + CSS Scroll Snap:

```css
.rail {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: x mandatory;
}

.rail-card {
  flex: 0 0 min(82vw, 420px);
  scroll-snap-align: start;
}
```

Sticky + `translateX`:

```css
.h-section { height: calc(100dvh + var(--travel)); }
.h-sticky { position: sticky; top: 0; height: 100dvh; overflow: hidden; }
.h-track { display: flex; will-change: transform; }
.h-panel { flex: 0 0 100vw; }
```

```js
const section = document.querySelector('.h-section');
const track = document.querySelector('.h-track');
let raf = 0;

function updateHorizontal() {
  raf = 0;
  const rect = section.getBoundingClientRect();
  const travel = section.offsetHeight - innerHeight;
  const max = track.scrollWidth - innerWidth;
  const progress = Math.min(1, Math.max(0, -rect.top / travel));
  track.style.transform = `translateX(${-max * progress}px)`;
}

addEventListener('scroll', () => {
  raf ||= requestAnimationFrame(updateHorizontal);
}, { passive: true });
```

GSAP ScrollTrigger pin:

```js
gsap.to('.h-track', {
  xPercent: -100 * (panels.length - 1),
  ease: 'none',
  scrollTrigger: {
    trigger: '.h-wrap',
    pin: true,
    scrub: 1,
    snap: 1 / (panels.length - 1),
    end: () => `+=${document.querySelector('.h-track').offsetWidth}`,
  },
});
```

CSS scroll-driven enhancement:

```css
.h-track { transform: none; }

@supports (animation-timeline: scroll()) {
  .h-track {
    animation: move-x linear both;
    animation-timeline: scroll(root block);
  }

  @keyframes move-x {
    to { transform: translateX(calc(-100% + 100vw)); }
  }
}
```

Reduced motion: keep the native rail scrollable, collapse fake-horizontal
sections to a vertical stack, disable pin/scrub timelines, and make all panels
reachable in document order.

### Sticky Card Stacking (Level 7+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Domain gate: landing, editorial, case studies, education, onboarding. In tools,
use it only for non-blocking summaries; never stack forms, tables, or required
workflow controls.

```css
.stack {
  position: relative;
  display: grid;
  gap: 24px;
}

.stack-card {
  position: sticky;
  top: calc(24px + (var(--i) * 18px));
  transform-origin: top center;
  z-index: var(--i);
}
```

```html
<section class="stack">
  <article class="stack-card" style="--i: 1">...</article>
  <article class="stack-card" style="--i: 2">...</article>
  <article class="stack-card" style="--i: 3">...</article>
</section>
```

Reduced motion: keep sticky positioning if it only affects placement; remove
scale/rotation/fade flourishes and ensure each card remains readable when
stacked.

### Frame Sequence Scrolltelling (Level 8+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Domain gate: product launches, campaign pages, editorial explainers, and
portfolio moments where photoreal inspection matters. Avoid in dashboards,
admin tools, auth, payments, and repeated workflows.

AI pipeline:

```text
ima2 gen "product scene" --quality high
  -> ima2 video "motion prompt" --ref image.png --duration 10 --resolution 1080p
  -> ffmpeg -i motion.mp4 -vf "fps=24,scale=1440:-1" frames/%04d.webp
  -> Canvas scroll scrub
```

Progressive loading strategy:

1. Load poster frame 0 first.
2. Load last frame, midpoint, then quarter checkpoints.
3. Fill gaps in idle time after the section is near the viewport.
4. Draw only when the frame index changes.
5. Use separate desktop/mobile sequences when canvas dimensions differ.

Image format: WebP is the default for canvas sequences because support is broad
and decode is fast. Use AVIF + WebP in `<picture>` for static posters or art
direction. Keep JPEG as a simple fallback only.

```js
const canvas = document.querySelector('canvas.sequence');
const ctx = canvas.getContext('2d');
const section = document.querySelector('.sequence-section');
const frameCount = 180;
const frames = Array.from({ length: frameCount }, (_, i) => {
  const img = new Image();
  img.src = `/frames/${String(i + 1).padStart(4, '0')}.webp`;
  return img;
});

let current = -1;
function drawFrame(index) {
  if (index === current || !frames[index]?.complete) return;
  current = index;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frames[index], 0, 0, canvas.width, canvas.height);
}

function scrubSequence() {
  const rect = section.getBoundingClientRect();
  const travel = section.offsetHeight - innerHeight;
  const progress = Math.min(1, Math.max(0, -rect.top / travel));
  drawFrame(Math.round(progress * (frameCount - 1)));
}

addEventListener('scroll', () => requestAnimationFrame(scrubSequence), { passive: true });
```

Reduced motion: show a poster image or a short non-scrubbed clip with controls;
do not bind dozens or hundreds of frame changes to scroll.

### Video currentTime Scrub (Level 7+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Domain gate: lightweight landing/editorial effects where exact frame accuracy
does not matter. Use Canvas frame sequences for Apple-style product precision.

```js
const video = document.querySelector('.scrub-video');
const section = document.querySelector('.video-section');

function scrubVideo() {
  if (!video.duration) return;
  const rect = section.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, -rect.top / (section.offsetHeight - innerHeight)));
  video.currentTime = progress * video.duration;
}

addEventListener('scroll', () => requestAnimationFrame(scrubVideo), { passive: true });
```

Known limitations: `currentTime` seeks are not frame-perfect, mobile media
policies can delay readiness, decode can stutter, and long GOP videos scrub
poorly. Consider all-I-frame encoding only when the larger file size is
acceptable.

Reduced motion: let the user play/pause normally, show poster-first content,
and avoid automatic scroll-bound seeking.

### Slide/Page Transitions (Level 6+)

Domain gate: presentation-like landing pages, education modules, galleries, and
interactive stories. Avoid hard scroll snap in forms, docs, dashboards, and
long-reading content.

```css
.slides {
  height: 100dvh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}

.slide {
  min-height: 100svh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

Use View Transitions for discrete morphs between selected slides or route/state
changes, not continuous scroll progress. Use Sticky Card Stacking when the page
should keep natural document flow instead of full-page snapping.

Reduced motion: change `scroll-snap-type` to `y proximity` or remove snap, and
disable View Transition animations.

### Text Mask & Reveal (Level 8+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Domain gate: editorial, campaign, portfolio, and hero storytelling. In product
tools, use plain readable text and reserve reveal for small onboarding moments.

```css
.masked-copy {
  clip-path: inset(0 100% 0 0);
  animation: text-wipe linear both;
  animation-timeline: view();
  animation-range: entry 20% cover 45%;
}

@keyframes text-wipe {
  to { clip-path: inset(0 0 0 0); }
}
```

SVG mask over video:

```svg
<svg viewBox="0 0 1200 400" aria-hidden="true">
  <defs>
    <mask id="headline-mask">
      <text x="50%" y="55%" text-anchor="middle">LAUNCH</text>
    </mask>
  </defs>
  <foreignObject width="1200" height="400" mask="url(#headline-mask)">
    <video autoplay muted loop playsinline src="/motion.webm"></video>
  </foreignObject>
</svg>
```

Kinetic typography: split decorative layers only; keep one semantic text node
available to assistive tech and search. Animate transforms/opacity, not layout
properties.

Reduced motion: render final text immediately, keep video masks static or use a
poster, and do not scramble/split characters over time.

### SVG Path Drawing (Level 7+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Domain gate: routes, timelines, process maps, editorial diagrams, and playful
landing moments. Avoid it for dense operational diagrams where the path itself
is critical information.

```css
.route-path {
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  animation: draw-path linear both;
  animation-timeline: view();
  animation-range: entry 10% cover 60%;
}

@keyframes draw-path {
  to { stroke-dashoffset: 0; }
}
```

Set `--path-length` from `path.getTotalLength()` once at init, not on every
scroll frame.

Reduced motion: show the completed path immediately and use labels or markers
for meaning; never make comprehension depend on the drawing animation.

### Lottie Scroll Scrub (Level 7+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Domain gate: vector explainers, icons, onboarding, and editorial diagrams. Do
not use Lottie for photoreal product scrolltelling; use frame sequences instead.

```js
const anim = lottie.loadAnimation({
  container: document.querySelector('.lottie'),
  renderer: 'svg',
  loop: false,
  autoplay: false,
  path: '/motion.json',
});

ScrollTrigger.create({
  trigger: '.lottie-section',
  start: 'top bottom',
  end: 'bottom top',
  scrub: true,
  onUpdate: ({ progress }) => {
    anim.goToAndStop(progress * (anim.totalFrames - 1), true);
  },
});
```

Reduced motion: pause at the most informative frame, provide static SVG/PNG
fallback, and do not scrub vector motion in response to scroll.

**NEVER mix GSAP/Three.js with Framer Motion in the same component tree.**
Use Framer for UI. Use GSAP/Three.js ONLY for isolated full-page scrolltelling or canvas backgrounds, wrapped in strict `useEffect` cleanup blocks.

---

## Cinematic Section Transitions (Level 8+, or Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor)

Full-screen "flying" transitions where one section transforms into the next:
zoom-through, fly-through, morph, wipe, portal. Research:
`devlog/_fin/260708_scroll_driven_effects/001_cinematic_transitions.md`.

Domain gate: landing, campaign, editorial, and product-story surfaces only.
Never apply cinematic section transitions to tools, dashboards, admin, auth,
payment, or developer consoles — they hijack scroll, delay task work, and raise
motion-sickness and accessibility risk. Motion intensity here is Level 8+, or
Level 5+ when needed to satisfy the FE-MOTION-BUCKET-01 landing floor; do not
ship it on repeated-work surfaces.

All of these share one architecture: a **pinned full-viewport stage**, layered
sections/images, and scroll progress mapped to a timeline. Choose the driver by
job:

- **GSAP ScrollTrigger** — continuous cinematic scenes (`pin`, `scrub`, `snap`, timelines).
- **CSS scroll-driven animations** — simple fades, wipes, progress-linked transforms.
- **View Transitions API** — discrete click/state/route morphs, not scroll scrubbing.
- **Canvas/WebGL** — only when product fidelity needs image sequences or shaders.

| Pattern | CSS or JS | Best Use | Tradeoff |
| --- | --- | --- | --- |
| Zoom-through | JS (CSS for simple scale) | Enter next scene "through" an element | Giant raster layers eat memory; cap scale + asset size on mobile |
| 3D perspective fly-through | JS | Panels flying toward/away from viewer | Many composited layers; flatten finished layers, test memory |
| Crossfade / morph | CSS or JS | Soft scene change between full-viewport sections | Cheapest; watch mid-fade text contrast |
| Card-to-fullscreen expand | JS (View Transitions / FLIP) | Thumbnail or card opens into detail | Never animate layout directly; use FLIP/View Transitions |
| Wipe / reveal | CSS or JS | One section slides/wipes to reveal next | `clip-path`/mask can repaint; translated cover is fastest |
| Tunnel / portal | JS | Zoom through a shape that opens into next content | Masked shape can be unreadable on narrow screens |
| Scale + opacity depth | CSS or JS | Safe high-end depth illusion | Compositor-friendly; tune scale lower on mobile |
| View Transitions morph | JS trigger + CSS | Discrete section/state morph | Snapshot-based; not continuous scroll progress |
| GSAP pinned timeline | JS | Master timeline sequencing multiple scenes | Pin is heavy on mobile Safari; simplify via `matchMedia` |

### Zoom-through / portal

Pin a stage, scale a foreground element up (8-30x) so the next scene reveals
behind or through it. Transform and opacity only.

```js
gsap.timeline({
  scrollTrigger: { trigger: '.stage', pin: true, scrub: true, end: '+=200%' },
})
  .to('.portal', { scale: 18, ease: 'none' })
  .to('.next-scene', { opacity: 1 }, '<');
```

CSS-only portal via a growing circle mask (no next-scene replacement, simpler):

```css
.portal {
  clip-path: circle(var(--r, 8%) at 50% 50%);
  animation: open linear both;
  animation-timeline: scroll(root block);
  animation-range: 20% 70%;
}
@keyframes open { to { --r: 140%; } }
```

### 3D perspective fly-through

```css
.stage { perspective: 1200px; transform-style: preserve-3d; }
.panel { will-change: transform, opacity; }
```

```js
gsap.to('.panel', {
  z: 600, rotationX: -12, autoAlpha: 0, stagger: 0.15,
  scrollTrigger: { trigger: '.stage', pin: true, scrub: true },
});
```

Cap travel distance and rotation on small screens; perspective reads stronger
on mobile and can trigger motion sickness.

### Crossfade / scale-depth morph

The safest high-end look: previous section scales down and fades, next scales
from slightly larger to rest. Compositor-friendly.

```css
.scene { position: sticky; top: 0; height: 100dvh; }
.scene--out { animation: sink linear both; animation-timeline: view(); animation-range: exit 0% exit 100%; }
@keyframes sink { to { opacity: 0; transform: scale(0.92); } }
```

On mobile, tune the incoming scale toward `1.04 -> 1` (not `1.08`) to reduce
motion sickness.

### Wipe / reveal

```css
.next { clip-path: inset(0 0 100% 0); animation: wipe linear both; animation-timeline: view(); }
@keyframes wipe { to { clip-path: inset(0 0 0 0); } }
```

A translated cover panel (transform only) is cheaper than `clip-path` on
low-power devices; prefer it when the wipe is a straight edge.

### Card-to-fullscreen (View Transitions)

Discrete, click-driven morph — not scroll. Match old/new with a shared name.

```js
card.style.viewTransitionName = 'hero-media';
document.startViewTransition(() => openDetailView());
```

```css
::view-transition-old(hero-media),
::view-transition-new(hero-media) { animation-duration: 0.4s; }
```

Provide a fallback for unsupported browsers, preserve focus, and land the
expansion into a scrollable detail view on mobile with working back gesture.

### GSAP pinned master timeline

Build the timeline first, then attach one ScrollTrigger. One pinned master
timeline beats many competing triggers.

```js
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '.story', start: 'top top', end: '+=400%',
    pin: true, scrub: 1, snap: 1 / (scenes - 1),
  },
});
tl.addLabel('s1').to('.s1', { autoAlpha: 0 })
  .addLabel('s2').fromTo('.s2', { scale: 1.08, autoAlpha: 0 }, { scale: 1, autoAlpha: 1 }, '<');
```

### Mobile + reduced motion (mandatory)

- Gate pinned/zoom scenes with `ScrollTrigger.matchMedia()` or a CSS media
  query; on small screens replace with stacked sections or a native swipe rail.
- Serve smaller media variants and fewer/lower-res frames on mobile; giant
  raster zoom layers crash memory.
- Under `prefers-reduced-motion: reduce`, disable zoom/fly/portal entirely:
  render a static poster or a plain crossfade, and never pin scroll.

```js
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce) { /* build cinematic timeline */ }
```

Animate `transform` and `opacity` as the default vocabulary; layout/paint
properties are hard to keep smooth under a pinned, scrubbed timeline.

---

## Soft-Focus Organic Background + Capsule Label (Level 5+)

The OpenAI-announcement-card grammar: an expressive soft-focus organic field
with an opaque capsule label floating above (see aesthetics.md § Expressive vs
Functional Layers). Prefer a REAL soft-focus photographic or generated image
for the background; the pure-CSS fallback:

```css
.card {
  position: relative; overflow: hidden; border-radius: 28px;
  background:
    radial-gradient(circle at 25% 20%, #d8efd5 0, transparent 34%),
    radial-gradient(circle at 75% 35%, #c8dfd8 0, transparent 38%),
    radial-gradient(circle at 45% 80%, #f2d9c8 0, transparent 42%);
}
.card::before { content:""; position:absolute; inset:-40px; background:inherit;
  filter: blur(32px) saturate(1.05); transform: scale(1.08); }
.card::after  { content:""; position:absolute; inset:0; pointer-events:none;
  opacity:.18; mix-blend-mode:multiply;
  /* grain: noise image or SVG feTurbulence filter */ }
.pill { display:inline-flex; align-items:center; border-radius:999px;
  background:#fff; color:#000; padding:.35em .85em; font-weight:800; }
```

Rules: the capsule is opaque (not glass); one organic field per viewport
(gradient budget applies); grain at low opacity (.1-.2); animate only
transform/opacity on the field (slow drift), never the blur radius.
Counts toward the ambient-gradient budget — a real image is exempt.

## Product-Led Hero Motion (Level 6+)

Motion combos for product-as-stage heroes (see layout-discipline.md § Hero
Composition Grammar):

- **Parallax layered product scene**: product/device foreground moves slower
  or opposite to the background field; 2-3 layers max, transform-only.
- **Scroll-driven product rotation**: 3D or frame-sequence rotation of the
  product mapped to scroll progress (see Frame Sequence Scrolltelling above);
  keep the interactive scene full-bleed, not boxed in a card.
- **Video-in-mockup**: an autoplaying muted product-UI loop inside a device
  frame; lazy-load, `playsinline muted loop`, poster fallback, pause offscreen
  via IntersectionObserver.
- All three: static first-frame fallback under `prefers-reduced-motion`.

## Scroll Pattern Decision Tree

```text
Need a scroll effect?
  |
  +-- Product tool, dashboard, admin, auth, payment?
  |     -> scroll-driven = 0 (hard, FE-MOTION-BUCKET-01); feedback-only motion allowed.
  |
  +-- Cards/gallery need horizontal browsing?
  |     -> Native rail + CSS Scroll Snap.
  |
  +-- Full-page slide deck or presentation?
  |     -> CSS scroll-snap y mandatory; reduce to proximity when needed.
  |
  +-- Simple reveal, progress, or parallax?
  |     -> CSS scroll-driven animation + @supports fallback.
  |
  +-- Pinned horizontal campaign story?
  |     -> GSAP ScrollTrigger pin + scrub, isolated from UI component motion.
  |
  +-- Cinematic full-screen transition (zoom-through, fly, portal, morph)?
  |     -> Pinned stage + timeline: GSAP ScrollTrigger for continuous scenes,
  |        CSS scroll-driven for simple fade/wipe. Landing/campaign only.
  |
  +-- Discrete section/card-to-detail morph on click?
  |     -> View Transitions API (view-transition-name), not scroll scrubbing.
  |
  +-- Product-grade frame-by-frame object motion?
  |     -> Canvas + Image sequence + progressive loading.
  |
  +-- Layered narrative cards?
  |     -> Sticky Card Stacking.
  |
  +-- Text-as-window, mask, or kinetic type?
  |     -> Text Mask & Reveal, with semantic text preserved.
  |
  +-- Route/timeline drawing?
  |     -> SVG Path Drawing with precomputed path length.
  |
  +-- Vector animation scrub?
  |     -> Lottie + ScrollTrigger goToAndStop.
  |
  +-- Simple video scrub?
        -> video.currentTime only when frame precision is not required.
```

Default fallback: content visible, controls reachable, no scroll hijack. Under
`prefers-reduced-motion`, every branch resolves to static content, native
scroll, proximity snap, or user-controlled playback.

---

## Frame Sequence Format Guide

| Format | Use For | Avoid When |
| --- | --- | --- |
| WebP | Default canvas frame sequences; broad support and fast decode | You need the absolute smallest possible bytes |
| AVIF | Static posters, `<picture>` primary source, bandwidth-sensitive art direction | Decode cost or tooling slows scroll responsiveness |
| JPEG | Legacy/simple fallback and easy production pipelines | Alpha, modern compression, or large frame counts matter |

Rules:

- Canvas sequences: prefer WebP frames, sized separately for desktop/mobile.
- Static posters: use `<picture>` with AVIF first and WebP fallback.
- Long sequences: prioritize frame count, dimensions, and preload order before
  chasing marginal compression gains.
- Do not ship hundreds of full-resolution frames without an IntersectionObserver
  preload gate and checkpoint-first loading.
- Reduced motion: poster image beats loading an entire sequence the user will
  not see.

---

## ima2 Video Pipeline for Motion Assets (FE-MOTION-VIDEO-01, DEFAULT)

When a motion surface needs real video or animated content, use ima2's video
pipeline instead of simulating motion with CSS transitions alone. Domain gates
from FE-MOTION-BUCKET-01 still apply — video assets serve the LANDING and APP
buckets; TOOL bucket surfaces use static assets with feedback-only transitions.

### Image-First Video (highest quality)

The best video output comes from generating a high-quality still first, then
animating it via image-to-video (i2v). The video model has a concrete visual
anchor, producing better composition and character consistency than text-to-video.

```bash
# Step 1: Generate keyframe with GPT Image 2 (primary provider)
# Match aspect ratio to target video: 1792x1024 for 16:9, 1024x1024 for 1:1
ima2 gen "cinematic product shot of wireless earbuds on granite, three-point lighting, 16:9" \
  --quality high --size 1792x1024 -o keyframe.png

# Step 2: Animate the keyframe via i2v
ima2 video "camera slowly orbits the product, soft ambient hum, no music, \
  hold on a centered medium shot at the end" \
  --ref keyframe.png --duration 10 --resolution 720p --aspect-ratio 16:9
```

**Keyframe provider rule:** GPT Image 2 (`--provider oauth`, `--quality high`)
produces superior keyframes. Grok (`--provider grok`) is the fallback — only
aspect ratio must match because i2v internally rescales.

### Storyboard-to-Video Chain (multi-beat sequences)

For sequences longer than 15 seconds or needing precise beat control, use the
9-panel storyboard workflow:

```bash
# Step 1: Generate opening keyframe
ima2 gen "cinematic wide shot, dramatic lighting" --quality high --size 1024x1024 -o keyframe.png

# Step 2: Generate 9-panel storyboard grid from keyframe
ima2 gen "Using this scene as reference, create a 3x3 storyboard grid (9 panels, \
  thin black borders). Panel 1: solid black (lead-in). Panel 2-9: sequential action \
  beats with timestamps. Maintain character design across panels." \
  --ref keyframe.png --quality high --size 1024x1024 -o storyboard.png

# Step 3: Animate storyboard
ima2 video "This is a 9-panel storyboard. Animate left-to-right, top-to-bottom. \
  Panel 1: black fade-in. Panel 2: ... Sound: taiko percussion builds. \
  Camera: wide establishing then push to medium. End frame: stable close-up." \
  --ref storyboard.png --duration 15 --resolution 720p --model grok-imagine-video-1.5

# Step 4: Extract last frame and chain next storyboard
ima2 video frame <generated-file>.mp4 --last -o lastframe.png
ima2 gen "Using this last frame, create next 9-panel storyboard..." \
  --ref lastframe.png --quality high --size 1024x1024
```

**9-panel rules:** Panel 1 must be solid black (auto-trimmed lead-in). Square
format (1024x1024) works best. No timestamp labels in panels — they burn into
the video. Character design must be identical across all panels.

### Video Continue and Extend

For multi-shot connected sequences:

```bash
# Extend from last frame (xAI native, combines original + extension)
ima2 video extend "camera slowly pulls back revealing the full scene" \
  --video <generated-file>.mp4 --duration 6

# Continue with lineage (new clip, carries revisedPrompt history)
ima2 video continue "she turns toward camera, rain grows louder, no music, \
  says 'gidarryeo', end on still close-up" \
  --video <generated-file>.mp4 --duration 10
```

`extend` returns original + extension as one file. `continue` creates a new
clip from the last frame with branch-local prompt lineage (up to 4 entries).

### Video Prompt Writing Rules

Video prompts must be ACTIVE — describe motion, not a static description.
Every video prompt should include:

| Element | Required | Example |
|---------|----------|---------|
| Opening frame | Yes | "tight macro on the brushed aluminum edge" |
| Camera intent | Yes | "lateral glide", "orbit", "rack focus" |
| Subject motion | Yes | "earbuds slowly rotate, light catches the stem" |
| Sound/music | Yes | "ambient hum, no music" or "lo-fi piano builds" |
| Dialogue | If needed | "speaker says 'welcome', then silence" |
| Ending frame | Yes | "settles into centered medium shot, holds steady" |
| Duration pacing | Yes | 1-4s: one action. 5-7s: setup/turn/hold. 8-15s: multi-beat arc |

**Anti-slop:** reject "cinematic", "stunning", "AAA trailer", generic "neon glow".
Write what the camera actually sees and hears.

### Model and Resolution by Motion Surface

| Motion Surface | Model | Resolution | Duration |
|---------------|-------|-----------|----------|
| Product reveal | `grok-imagine-video-1.5` | 1080p | 5-10s |
| Hero background loop | `grok-imagine-video` | 720p | 5-10s |
| Scroll-driven frame sequence | Generate video, extract frames with ffmpeg | 720p+ | 5-15s |
| Social/marketing clip | `grok-imagine-video-1.5` | 1080p | 5-15s |
| Quick draft / iteration | `grok-imagine-video` | 480p | 3-5s |

### Frame Extraction for Scroll Sequences

To create scroll-driven frame sequences from ima2 video:

```bash
# Generate the motion asset
ima2 video "product slowly rotates 360 degrees on clean backdrop" \
  --ref product.png --duration 10 --resolution 1080p -o motion.mp4

# Extract WebP frames for canvas scroll scrub
ffmpeg -i motion.mp4 -vf "fps=24,scale=1440:-1" frames/%04d.webp

# Or extract specific keyframes
ima2 video frame motion.mp4 --last -o lastframe.png
```

Then use the Frame Sequence Scrolltelling pattern from this document with
the extracted frames.

### Parallel Video Generation

Video generation is slow (30-120s per clip). For multi-shot sequences, launch
clips in parallel when they do not depend on each other:

```bash
# Independent shots can run concurrently
ima2 video "wide establishing shot" --ref scene.png --duration 5 &
ima2 video "close-up detail shot" --ref detail.png --duration 5 &

# Monitor progress
ima2 ps --json

# Sequential shots (each needs the previous last frame) must be serial
```

### `$imagegen` Fallback — Motion Without Video

When ima2 is unavailable, `$imagegen` cannot generate video. Degrade to:

1. **Static keyframe + CSS animation:** Generate a high-quality still with
   `$imagegen`, then apply CSS transforms (parallax, scale, fade) for motion.
2. **Multi-still frame sequence:** Generate 3-5 stills at different angles or
   states with `$imagegen`, use CSS scroll-driven animations to crossfade.
3. **CSS-only motion:** Use the CSS patterns in this document (scroll-driven
   animations, sticky card stacking, text reveals) without bitmap frames.

The quality gap is significant — video > multi-still > CSS-only. Document the
gap in the deliverable when using fallback motion.

---

## Performance Rules

1. Animate ONLY `transform` and `opacity`. Never `top`, `left`, `width`, `height`.
2. `will-change: transform` sparingly. Remove after animation completes.
3. Grain/noise filters → fixed `pointer-events-none` pseudo-elements only.
4. Perpetual/infinite animations MUST be `React.memo`'d and isolated in microscopic Client Components.
5. Wrap dynamic lists in `<AnimatePresence>`.
6. 60fps target. Profile on mobile before shipping.

---

## Creative Arsenal (Inspiration)

Pick from these for signature moments — don't use all of them:

| Category       | Concepts                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Navigation** | Mac OS Dock magnification, Magnetic buttons, Gooey menu, Dynamic Island                          |
| **Cards**      | Parallax tilt (3D on mouse), Spotlight border, Holographic foil hover                            |
| **Scroll**     | Sticky scroll stack, Horizontal scroll hijack, Zoom parallax, SVG path drawing                   |
| **Text**       | Kinetic marquee, Text mask reveal (type as window to video), Text scramble (Matrix decode)       |
| **Micro**      | Particle explosion button, Directional hover fill, Ripple click effect, Mesh gradient background |

---

## `prefers-reduced-motion` (Mandatory)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Always include. No exceptions.

CSS overrides alone are NOT enough for JS-driven scroll effects. When
`prefers-reduced-motion: reduce` is set, the script must SHORT-CIRCUIT setup:
skip building frame arrays, skip binding scroll/resize listeners, skip the
update loop, and render a static, readable end state instead (all reveal text
lit, a representative canvas frame drawn, the first caption shown). A CSS
`animation-duration: 0.01ms` override still lets the JS build hundreds of
offscreen frames and run a scroll handler every frame — wasteful and still
motion under user control.

```js
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) {
  drawStaticFrame();          // one representative frame, not the whole sequence
  revealAll();                // reveal copy, show first caption
  return;                     // bind no listeners, run no update loop
}
buildFrames();
addEventListener('scroll', onScroll, { passive: true });
```

Research: `devlog/_fin/260708_scroll_driven_effects/000_research.md`,
`devlog/_fin/260708_scroll_driven_effects/001_cinematic_transitions.md`

---

## Motion Honesty (FE-MOTION-HONESTY-01, DEFAULT)

Source: taste-skill v2 (62k stars), adapted for codexclaw.

The declared MOTION_INTENSITY dial must match the shipped page's actual motion.
A dial value above 4 that ships a static page is a lie — the motion was claimed
but never delivered.

| Dial | Required motion evidence |
|------|------------------------|
| 1-3 | Hover and active state transitions only. No scroll-driven motion required. |
| 4-5 | At least one entrance animation or staggered load-in visible on first scroll. |
| 6-7 | Scroll-driven reveals on multiple sections + at least one signature moment. |
| 8-10 | Choreographed scroll timeline or parallax + signature moment + supporting reveals. |

Verification: scroll the built page top-to-bottom and count distinct motion events.
If the count does not match the dial band, either lower the dial or add the motion.

Any MOTION_INTENSITY > 3 MUST honor `prefers-reduced-motion`: reduce to hover/active
only. This is not optional at any dial level.
