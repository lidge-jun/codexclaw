# Scroll Interaction — native scroll, state-carrying motion, nothing hidden

The scroll itself belongs to the user. Good scroll interaction is not "more effects"; it is
native, fast scrolling where a few moments **report state** (how far, what is next, what
just became stuck or snapped) and one signature moment carries the product story. This file
is the build contract; [motion](motion.md) holds the pattern recipes (pinning, frame
sequences, cinematic transitions) and the surface buckets (FE-MOTION-BUCKET-01) that decide
how much of this a page may use.

Statuses read 2026-11-22. Re-check before quoting: the scroll platform moved four times in
2026.

## Creative license (read first)

These are defaults that protect readers, not a house style. Pinned stories, snapping decks,
horizontal galleries, smooth-scroll libraries, scroll-scrubbed video and ambient motion with
no "verb" are all allowed when they serve the concept; name the reason in the design notes
and keep the escape hatches (skip path, reduced-motion branch). The one hard line is
content that never becomes visible (FE-SCROLL-BASE-01 in `--render`). The lint is advisory:
only that and a timeline silently reset by declaration order are FAIL; everything else is
WARN/INFO to weigh, not to obey.

## Platform status (2026-11-22)

| Feature | Status | Use as |
|---|---|---|
| Scroll-driven animations (`animation-timeline: scroll()` / `view()`, `animation-range`) | All three engines: Chrome 115, Safari 26, Firefox 159 (2026-10-27). Baseline Newly available; Widely available ~2029 | Progressive enhancement. Base state must stand alone |
| `ScrollTimeline` / `ViewTimeline` JS, `timeline-scope`, range names inside `@keyframes`, playback control (`currentTime`, `playbackRate`) on scroll animations | Uneven: Firefox fails most range-in-keyframes tests, `timeline-scope` is still moving in the CSSWG, repeated timeline names are pathologically slow in Firefox < 161 | Avoid. Anonymous `scroll()`/`view()` in CSS, or a name declared on an ancestor |
| Off-main-thread execution | Chrome: `scroll()` and `view()` composited. Safari 26.0–26.3: main thread at 60 Hz; 26.4+ threaded. Firefox 159: `scroll()` composited, `view()` on the main thread | Compositor-only properties; profile in Firefox before merge |
| Scroll-triggered animations (`timeline-trigger`, `animation-trigger`) | Chrome/Edge 146 only | Enhancement for play-once reveals; IntersectionObserver fallback only when `!CSS.supports('timeline-trigger: --t view()')` |
| Scroll-state container queries (`@container scroll-state(stuck / snapped / scrollable / scrolled)`) | Chrome/Edge 133 (`scrolled` 144). Safari implementing, Firefox not started | Decoration only (shadow when stuck, dimmed neighbours when snapped). Nothing may depend on it |
| Scroll snap events (`scrollsnapchange`, `scrollsnapchanging`), `scrollend` | Snap events Chromium; `scrollend` in all engines | Sync indicators and thumbnails to a snap rail; fall back to `scrollend` + nearest item |
| GSAP + ScrollTrigger (and ScrollSmoother, SplitText) | Free for commercial use since 2025-04-30 (Webflow) | Pinned multi-step timelines that CSS cannot express |

Sources: [web.dev October 2026](https://web.dev/blog/web-platform-10-2026), [MDN animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline), [nbellocam, production notes 2026-11-01](https://nbellocam.dev/blog/scroll-driven-animations-produccion), [MDN scroll-triggered](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animation_triggers/Using_scroll-triggered_animations), [scroll-state support 2026-10](https://www.mewastudio.com/en/blog/scroll-state-queries-sticky-interface-css), [Chrome snap events](https://developer.chrome.com/blog/scroll-snap-events), [GSAP pricing](https://gsap.com/pricing).

## FE-SCROLL-NATIVE-01 — the user owns the scroll (DEFAULT)

- Default to native scrolling. Cancelling `wheel`/`touchmove` or turning one wheel tick
  into a section jump is a deliberate EXPERIENCE choice, not a landing-page default; on a
  reading page prefer `proximity` snap over root `y mandatory`.
- Smooth-scroll libraries (Lenis, ScrollSmoother, Locomotive) fit pages where the scroll
  is part of the brand ([motion](motion.md) FE-MOTION-BUCKET-01), not tools; when used, keep:
  disabled under
  `prefers-reduced-motion: reduce`, anchors and `#hash` loads land correctly, keyboard
  (Space, PgDn, Home/End, Tab into offscreen focus) still scrolls, nested scrollers and
  iframes keep native scroll (`data-lenis-prevent`), no `syncTouch` by default. Most landing
  pages do not need one: native scroll plus CSS timelines already feels smooth.
- `scroll-behavior: smooth` only inside `@media (prefers-reduced-motion: no-preference)`.
- Horizontal-in-vertical and pinned stories keep a plain path: a visible skip link past
  the pin, and every panel's content reachable by Tab and present in the DOM.
- A modal, drawer or sheet that scrolls sets `overscroll-behavior: contain` so the page
  behind does not move; the page behind is `inert`, not scroll-locked by `position: fixed`
  hacks that lose the scroll position.

## FE-SCROLL-BASE-01 — the base state is the visible state (the hard line)

Every scroll effect must leave the content readable when the animation does not run:
unsupported browser, inactive timeline (no overflow, `display:none`, ancestor with
`overflow: hidden`), print (viewport timelines are inactive in paged media), reduced motion,
JS failure, crawlers and AI agents that read the DOM or a screenshot.

- Hidden values (`opacity: 0`, offset `translate`, `clip-path: inset(100%)`) live only in the
  `from` keyframe. Omit `to`: the animation then ends on the element's real computed style.
- Never set `opacity: 0` / `visibility: hidden` on the element itself to "prepare" a reveal,
  in CSS or in a JS class added before the observer fires. A JS reveal adds the hidden class
  from JS (so no-JS stays visible) and removes it on intersection **and on focus**.
- `animation-fill-mode: both` on ranged scroll animations, or the element snaps back
  outside the range.
- Render check: `ui-lint --render` scrolls the page with reduced motion emulated and fails
  text that stays invisible (FE-SCROLL-BASE-01).

```css
@keyframes rise { from { opacity: 0; translate: 0 1.5rem; } } /* no `to` */

@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      animation: rise linear both;          /* shorthand first ...            */
      animation-timeline: view();           /* ... longhands after it         */
      animation-range: entry 10% cover 30%; /* range names, not bare percents */
    }
  }
}
```

## FE-SCROLL-GUARD-01 — guards and declaration order (DEFAULT)

- Wrap every scroll timeline in `@supports (animation-timeline: …)`. Without it, an old
  browser runs the `animation` shorthand on the clock: every reveal fires once at load,
  offscreen, unseen.
- Wrap moving effects in `@media (prefers-reduced-motion: no-preference)`. State-only effects
  (a progress bar's scale, a stuck header's shadow) may stay.
- The `animation` shorthand resets `animation-timeline` and `animation-range`; declare the
  longhands after it (also in CSS-in-JS key order).
- Write range names (`entry 10% cover 30%`), not bare percentages on `view()`.
- `overflow-x: hidden` on a page wrapper becomes the timeline's scroller and freezes every
  `view()` inside it. Use `overflow-x: clip`.
- Header effects tied to `scroll(root)` use pixel ranges (`animation-range: 0 120px`); a
  percentage moves whenever lazy content changes document height.
- A carousel inside the page: `view(inline)` for the carousel axis; for page-axis reveals
  inside it set `overflow-y: clip` on the carousel.

## FE-SCROLL-INTENT-01 — every scroll moment has a verb (DEFAULT)

Start from what the user should learn, not from an effect name. A moment with a verb earns
its place easily; atmosphere (a drifting field, a parallax illustration) is welcome too, as
long as it is one deliberate choice rather than the same fade-up on every section, which
counts as one moment ([motion](motion.md) FE-MOTION-HONESTY-01).

| Intent (verb) | Mechanism | Bucket |
|---|---|---|
| How far am I / how much is left | Reading progress: `scaleX` on `scroll(root)` or a `view-timeline` on the `<article>` with `animation-range: contain` | LANDING, editorial, docs |
| There is more here | Scroll shadows on overflow containers (`scroll()` + `opacity`); `scroll-state(scrollable)` as decoration | All, including TOOL |
| Where am I | Section nav / TOC current item from IntersectionObserver or `scrollsnapchange`; `aria-current` updated | LANDING, docs, long settings |
| This became sticky | Header shadow or compaction via `scroll-state(stuck)` or a pixel-range `scroll(root)` animation on a pseudo-element; never animate `height` | All |
| Browse a set | Native rail with `scroll-snap-type: x mandatory`, `scroll-padding`, prev/next buttons, snap-synced indicator | All |
| See the product work | One signature: a pinned product panel whose state advances with scroll (real UI, real data), or a scrubbed frame sequence | LANDING, EXPERIENCE |
| Arrive at a section | `scroll-margin-top` on anchor targets equal to the sticky header height; `:target` highlight is optional | All |
| Something entered view | Play-once reveal: `timeline-trigger` where supported, otherwise scrubbed `view()`; never replays on scroll-up for content | LANDING |

TOOL surfaces keep scroll-driven motion at 0 (FE-MOTION-BUCKET-01); scroll shadows, sticky
state and progress for long forms are state, not motion, and are allowed.

### Pinned stage (FE-SCROLL-PIN-01, DEFAULT for a 3-6 step story)

The screen holds while steps advance: a tall section with a `position: sticky` stage at
`top: var(--header-h)`, driven by a `view-timeline` on the section (`animation-range:
contain`) or one ScrollTrigger pin ([motion](motion.md#gsap-pinned-master-timeline); call
`refresh()` after images and fonts load). What this adds to the rules above (skip link,
stacked fallback, keyboard reveal, `will-change`):
- Budget: about 60-100vh of scroll per step, 400vh total at most, 2 pins per page at most.
- Visible progress (`2 / 4` or a filling rail) and step chips that are `<a href>` to a
  per-step sentinel with `scroll-margin-top`; no JS offset math, no mandatory snap.
- The visual is the stage: frames, video or product state fill the pinned viewport
  edge to edge; step copy sits on it as a centered or bottom caption plate, never as a text
  column beside a half-width video (FE-HERO-ALIGN-01).
- Text swaps per step (short crossfade at the threshold, never a half-faded resting state);
  only the visual scrubs continuously.
- Every step's copy stays in the DOM and readable; inactive steps dim, never `aria-hidden`.
- Unpin to a stack under reduced motion, `max-width: 720px` and `max-height: 600px`
  (landscape phones, 200% zoom); size the stage in `svh`. Sticky dies under an
  `overflow: hidden/auto` ancestor, like `view()`.

## FE-SCROLL-ANCHOR-01 — anchors, restoration, focus (DEFAULT)

- Sticky or fixed header present: set `scroll-padding-top` on the scroller (or
  `scroll-margin-top` on targets) to the header height, so `#hash` links and focus do not
  land under it. WCAG 2.2 Focus Not Obscured (2.4.11) covers the focus case.
- In-page nav uses real `<a href="#id">` links (crawlable, shareable, agent-operable); the
  target heading has an `id`, not a JS click handler.
- SPAs restore scroll position on Back and reset it on new routes; long lists keep position
  when returning from a detail view.
- `scrollbar-gutter: stable` on the root when dialogs toggle scrolling, so the layout does
  not jump.
- Long pages: `content-visibility: auto` with `contain-intrinsic-size` on below-fold
  sections, never on sections that hold the current anchor target.

## FE-SCROLL-PERF-01 — compositor or nothing (DEFAULT)

- Scroll-linked properties: `transform`, `translate`, `scale`, `rotate`, `opacity`,
  `clip-path`, `filter: blur` only on small layers. Never `height`, `top`, `width`,
  `font-size`, `box-shadow`, `background-position` (animate a pseudo-element's opacity
  instead).
- No `scroll` event listener for visuals. When JS must observe, use IntersectionObserver,
  `scrollend`, snap events, or one passive listener feeding `requestAnimationFrame`, with
  no layout reads (`getBoundingClientRect`, `offsetTop`) inside it.
- `will-change` only on the pinned stage during its range.
- Verify: Chrome DevTools Performance, CPU 4–6x throttle, insert a long task: a composited
  animation stays smooth. Rendering → Paint flashing must stay quiet during scroll. Open
  the page in Firefox and Safari before merge (Firefox runs `view()` on the main thread).
- Smooth scroll is not measured by INP, but its main-thread work delays the taps INP does
  measure; measure INP and CLS on the finished page.

## Accessibility

- WCAG 2.2.2 (A): auto-moving content longer than 5 s needs pause/stop. 2.3.3 (AAA)
  names parallax as non-essential motion; honour reduced motion for it.
- Keyboard: Tab into an unrevealed or pinned block shows it immediately; snap rails expose
  prev/next buttons and are not keyboard traps.
- Screen readers: text revealed by scroll is in the DOM from first paint; canvas or video
  scrubs carry a text equivalent.

## Scroll and SEO/GEO are the same rule

Crawlers, AI answer engines and browser agents read the DOM, the accessibility tree and
screenshots. Content that is `opacity: 0` until a scroll event, injected only after
intersection, or painted only into canvas is invisible to them in the same way it is
invisible to a reduced-motion user. FE-SCROLL-BASE-01 is therefore also a
[SEO/GEO](seo-baseline.md) requirement (GEO-VISIBLE-01). The web.dev agent guidance adds:
no transparent overlays above interactive elements, stable layout, targets of at least
8×8 px ([web.dev, agent-friendly sites](https://web.dev/articles/ai-agent-site-ux)).

## Pre-ship checklist

- [ ] Bucket named (FE-MOTION-BUCKET-01); TOOL has zero scroll-driven motion
- [ ] Each scroll moment is a deliberate choice (verb or named atmosphere); repeated fade-ups counted once
- [ ] Hijack, root snap or a smooth-scroll library only with a written reason and escape hatches
- [ ] Base state visible: hidden values only in `from`; `ui-lint --render` FE-SCROLL-BASE-01 clean
- [ ] `@supports` + reduced-motion guards; longhands after the shorthand; range names
- [ ] No `overflow-x: hidden` wrapper around `view()` users (use `clip`)
- [ ] Sticky header → `scroll-padding-top` / `scroll-margin-top`; in-page links are `<a href>`
- [ ] Compositor-only properties; throttled profile run; Firefox and Safari opened
- [ ] Pinned stage (FE-SCROLL-PIN-01): step budget, visible progress, chip links, stacks on mobile, short screens and reduced motion

Lint (advisory): `ui-lint.mjs` reports FE-SCROLL-BASE-01, FE-SCROLL-GUARD-01,
FE-SCROLL-NATIVE-01, FE-SCROLL-ANCHOR-01 and FE-SCROLL-PERF-01 ([scripts](../../scripts/README.md)).
A reasoned INFO/WARN left in place is fine; say why in the ship note.
