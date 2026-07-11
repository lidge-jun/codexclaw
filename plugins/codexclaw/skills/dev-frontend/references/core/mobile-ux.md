# Mobile UX Rules (MANDATORY for consumer/landing pages)

Mobile is NOT "desktop squished down." It is a different interaction model with different constraints, different user posture, and different conversion mechanics. These rules apply to any page serving mobile traffic.

---

## Thumb Zone Geometry

49% of users hold their phone with one hand. The bottom 40% of the screen is the natural thumb reach zone ("easy"), the middle 40% is comfortable, and the top 20% is hard to reach.

```
┌────────────────────┐
│   HARD TO REACH    │  ← top 20%: status bar, back nav, secondary info
│                    │
│   COMFORTABLE      │  ← middle 40%: content, scrollable area
│                    │
│   EASY / NATURAL   │  ← bottom 40%: primary CTA, tab bar, key actions
└────────────────────┘
```

Rules:
- Primary CTA → bottom 80% of viewport (easy + comfortable zones), or sticky-bottom
- Secondary actions (share, bookmark, settings) → top or overflow menu
- Destructive actions (delete, cancel) → require confirmation, never in thumb zone default
- FAB (floating action button) → bottom-right, 56px, 16px from edges

## Touch Targets (MANDATORY)

| Element | Minimum Size | Recommended |
|---------|-------------|-------------|
| Buttons | 44 x 44px | 48 x 48px |
| Form inputs | 44px height | 48px height |
| List items (tappable) | 44px height | 48-56px height |
| Icon buttons | 44 x 44px (including padding) | 48 x 48px |
| Links in body text | 44px touch area (padding) | — |
| Spacing between targets | 8px minimum | 12px |

Never rely on hover states for mobile — there is no hover. Every hover-revealed element needs a tap-accessible alternative.

## Sticky CTA Pattern (conversion pages)

On landing/marketing pages longer than 2 screen heights, the primary CTA scrolls out of view. Fix:

```html
<div class="fixed bottom-0 inset-x-0 p-4 bg-white/90 backdrop-blur-sm border-t
            pb-[calc(1rem+env(safe-area-inset-bottom))] z-40 md:hidden">
  <button class="w-full h-12 rounded-lg bg-primary text-white font-semibold">
    Get Started
  </button>
</div>
```

Rules:
- Show only on mobile (< 768px)
- Appear after user scrolls past the hero CTA (use IntersectionObserver)
- Semi-transparent background so content beneath is visible
- Include safe-area bottom padding
- Do NOT show if the hero CTA is still visible

## Mobile Section Composition

Section order and density must adapt for mobile — not just stack unchanged.

### CTA Placement
- Hero: CTA visible without scroll (MANDATORY — same as desktop)
- After first proof/testimonial block: repeat CTA
- After FAQ/objection handling: final CTA
- Desktop can have 5-8 sections between CTAs. Mobile: max 3 sections between CTAs.

### Proof Proximity
On desktop, users tolerate claim → feature → feature → proof. On mobile, every claim needs proof within 1 scroll:
- Feature claim → immediately followed by testimonial, stat, or screenshot
- No more than 2 consecutive "claim" sections without evidence

### Section Density on Mobile
- Max content per mobile section: 1 heading + 1 paragraph (≤60 words) + 1 visual or CTA
- Long feature lists (>4 items): horizontal scroll-snap cards or accordion, not vertical list
- Pricing: 1 card visible at a time with swipe or tab selector
- Testimonials: swipe carousel, not stacked cards

### Content That Changes on Mobile
- Desktop side-by-side comparison → mobile tab selector or accordion
- Desktop data table → mobile card list or horizontal scroll
- Desktop multi-column footer → mobile accordion sections
- Desktop image gallery grid → mobile horizontal scroll-snap

## Mobile Hero Constraints

The mobile hero has ~390 x 600px of usable space. It must:
- Headline: max `text-3xl` (1.875rem), max 2 lines
- Subtext: max 15 words (not 20 — mobile has less width per line)
- CTA: visible without scroll, full-width button preferred
- Hero image: max 60vh, or background with overlay text
- No decorative elements (trust badges, taglines below CTA, scroll cues)

If the desktop hero has a side-by-side layout, mobile MUST stack: image first (if product/visual), text first (if story/narrative).

## Bottom Sheet Pattern

Mobile form selects and pickers use the same dropdown design-layer skin
(`dropdown-layer.md` FE-DROPDOWN-LAYER-01) rendered as a bottom sheet: no
nested scrolling, preserved form semantics and keyboard/AT behavior, and a tap
path for anything hover-spawned on desktop.

For mobile actions that need more space than a button but less than a full page:

```
┌──────────────────────┐
│ ──── (drag handle)   │
│                      │
│ Action title         │
│ Option 1             │
│ Option 2             │
│ Option 3             │
│                      │
│ [Cancel]             │
└──────────────────────┘
```

Rules:
- Max height: 70vh (user must see the page behind it)
- Drag handle visible at top center
- Close on backdrop tap or swipe down
- No nested scrolling (if content is too long, use a full page instead)
- `overscroll-behavior: contain` to prevent background scroll

## Mobile Form Rules

- One input per row (never side-by-side on mobile)
- Use correct `inputmode`: `tel` for phone, `numeric` for zip/PIN, `email` for email, `url` for URLs
- Label above input, not inside (placeholder-only labels are inaccessible)
- Auto-advance between short fields (OTP, phone segments)
- Submit button full-width, sticky-bottom for long forms
- Error messages inline below the field, not in a toast or alert
- Keyboard-aware: scroll the active input into view above the keyboard

## Portrait Media Guidance

Mobile is portrait-first. Images optimized for desktop landscape crop poorly on mobile.

- Hero images: prepare portrait crop (4:5 or 3:4) for mobile, landscape (16:9 or 3:2) for desktop
- Product images: square (1:1) works for both orientations
- Background textures: use CSS `object-position` to control crop focal point
- Video: provide portrait version or use `object-fit: cover` with careful framing
