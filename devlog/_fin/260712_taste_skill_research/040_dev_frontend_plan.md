---
created: 2026-07-12
tags: [codexclaw, dev-frontend, improvement-plan]
---

# dev-frontend Improvement Plan

## New Anti-Slop Rules (anti-slop.md)

### P0 additions

**FE-BORDER-SHADOW-01**: Hairline border + diffuse shadow combination.
Edge or elevation, not both. A 1px border + spread box-shadow is the
#1 generated-UI composite tell. (Source: impeccable)

**FE-ICON-TILE-01**: Rounded-square icon tile stacked above feature-card
heading. Ban this specific composition — not individual icons or cards,
but the icon-in-rounded-container-above-heading scaffold. (Source: impeccable)

**FE-ITALIC-SERIF-HERO-01**: Oversized italic serif hero headline is now
a major AI-premium convergence signature. Not the same as serif ban — the
specific italic+oversized+startup-hero composition. (Source: impeccable)

**FE-TYPO-FLOOR-01**: Typography floors:
- Body line-height >= 1.3 (1.5 preferred)
- Body font-size >= 12px
- letter-spacing never below -0.03em (destructive tracking floor)
- Wide positive tracking (> 0.05em) on body copy is also a tell
(Source: impeccable)

**FE-PLACEHOLDER-IMG-01**: Broken or placeholder image detection.
Empty src, data:, placeholder.com, via.placeholder.com, or obviously
placeholder image URLs are shipping tells. (Source: impeccable)

### P1 additions

**FE-MARQUEE-01**: One marquee/ticker per page maximum. Two or more
scrolling elements on one page is repetition slop. (Source: taste-skill)

**FE-CLIP-OVERFLOW-01**: Clipped popover/tooltip detection. An
`overflow: hidden|clip` ancestor trapping a positioned child is a
common generated-UI bug. (Source: impeccable)

**FE-APHORISM-01**: Aphoristic rebuttal cadence ban. "Not a feature. A
platform." / "Stop managing. Start leading." — short rebuttals with
manufactured contrast are generated-copy cadence. (Source: impeccable)

**FE-IMAGE-HOVER-01**: Generic image hover zoom/rotation. Reflexive
scale/rotate on every card image is a default tell; hover transforms
belong on interactive controls only. (Source: impeccable)

**FE-GRADIENT-TEXT-01**: Gradient text (`background-clip: text`) is now
an overused AI tell. Ban as default; allow only with explicit design
rationale. (Source: impeccable)

**FE-SERIF-DEFAULT-01**: Fraunces and Instrument Serif as unexamined
creative-font defaults. Random serif words inside sans headlines (mixed
emphasis) without typographic rationale. (Source: taste-skill)

**FE-CONTENT-REALISM-01**: Content-data realism (overlaps with U8):
locale-appropriate names, organic metrics, plausible brands, concrete
verbs. (Source: taste-skill)

## Motion Reference (motion.md)

**FE-MOTION-HONESTY-01** (P0): Motion dial > 4 means the page must
actually move. If MOTION_INTENSITY is declared above 4 but the shipped
page has no scroll-driven, entrance, or interactive motion, the dial
is a lie. Verification: scroll the page and count motion events.
(Source: taste-skill)

## Accessibility (a11y-patterns.md)

**FE-HEADING-LEVELS-01** (P1): No skipped heading levels. h1 -> h3
without h2 is a semantic error. Already implied by "semantic HTML"
but not explicitly named. (Source: impeccable)

## Anti-Slop Intro: Second-Order Reflex Test (P1)

Add to anti-slop.md introduction: the two-level reflex test from impeccable.
First-order: can the palette/theme be guessed from the product category?
Second-order: can the alternative be guessed from category + obvious anti-reference?
Both are tells. (Source: impeccable)

## ima2 Integration (asset-requirements.md)

**FE-IMAGE-SET-CONTINUITY-01** (P0): Multi-image sets for landing pages
must maintain visual-world continuity: shared palette, typography direction,
CTA family, radius grammar, image treatment, and voice across all frames.
Composition anchors must rotate (not repeat the same layout). Per-section
frame count defaults: landing 6, full website 8, portfolio 6.
(Source: taste-skill imagegen-frontend-web)

**FE-IMAGE-ANCHOR-ROTATION-01** (P0): In UX-CONCEPT-GEN-01, each of the
5 concept renders should vary the composition anchor: hero position, stat
placement, CTA location, section hint, and accent treatment. Repetitive
same-layout renders are wasted candidates. (Source: taste-skill)
