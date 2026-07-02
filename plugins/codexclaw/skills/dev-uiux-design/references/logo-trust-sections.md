# Logo Trust Sections — Design Patterns & Judgment

Design guidance for integration/partner/client logo sections. These are trust signals, not UI components.

Read `dev-frontend/references/core/logo-sections.md` for the CSS implementation.
Read `dev-frontend/references/core/brand-asset-sourcing.md` for SVG sourcing.

---

## 1. Purpose

Logo sections serve ONE job: **social proof**. They answer: "Who else uses this?"

They are NOT:
- Navigation (users don't click them)
- Feature lists (no detailed info needed)
- Calls to action (no conversion expected)
- Interactive components (no hover/click feedback expected)

Design them as passive, ambient trust signals. Like a restaurant displaying a Michelin star — you notice it, you don't interact with it.

---

## Pattern Decision Table

| Situation | Pattern | Rationale |
|-----------|---------|-----------|
| 3-6 recognizable logos | Static flex row, centered | Clean, scannable, no animation needed |
| 8-15 logos | Single-row marquee | Avoids orphan cells, shows volume |
| 15+ logos | Dual-row opposing marquee | Shows scale, feels dynamic |
| Logos link to case studies | Static grid, clickable | Links add value, hover justified |
| Premium/enterprise feel | Static grid, generous spacing | Motion can feel unserious |
| Startup/modern SaaS feel | Marquee, fast but smooth | Energy matches brand |

---

## Anti-Patterns (Do NOT)

### 1. Individual hover effects on non-clickable logos
Users hover, expect a click target, find nothing. Trust signals should never feel broken.

### 2. CSS Grid with orphan cells
One logo alone on the last row looks broken. Use flexbox or marquee instead.

### 3. Generic stroke icons instead of brand marks
Use actual brand SVGs from Simple Icons, SVGL, or press kits. See `brand-asset-sourcing.md`.

### 4. Colorful logos clashing with each other
Multiple full-color logos fight for attention. Apply uniform grayscale treatment.

---

## Visual Treatment

**Default state:** All logos monochrome, dimmed, uniform height (28-32px).

**Dark mode:** Invert for visibility with `brightness(1.2) invert(1)`.

**Consistent sizing:** Set a uniform `height` and let `width: auto` maintain aspect ratios. Do NOT stretch logos.

---

## Placement on Page

| Position | Effectiveness | Notes |
|----------|--------------|-------|
| Below hero, above fold | Highest | Immediate credibility before scroll |
| Near pricing/CTA | High | Reduces purchase anxiety |
| Mid-page section break | Medium | Trust reinforcement during consideration |
| Footer area | Low | Afterthought feel |

**Best practice:** Place near the primary conversion point (pricing, sign-up, CTA). "Trusted by" directly above the CTA is a strong pattern.

---

## Marquee Speed Guidelines

| Speed | Duration | Feel | Use |
|-------|----------|------|-----|
| Very slow | 50-60s | Calm, premium | Enterprise, finance |
| Slow | 30-40s | Professional | General SaaS |
| Medium | 20-30s | Energetic | Startups, dev tools |
| Fast | <15s | Cheap, frantic | **Avoid** |

`linear` timing function only — no easing. Constant speed feels intentional; eased motion feels like a carousel.

---

## Accessibility Requirements

- [ ] `aria-label` on marquee container: "Trusted by leading companies"
- [ ] Duplicate logos get `aria-hidden="true"` and empty `alt=""`
- [ ] `prefers-reduced-motion: reduce` stops all animation
- [ ] Sufficient contrast between logos and background
- [ ] Logos have meaningful `alt` text (first set only)
- [ ] Pause-on-hover behavior for marquee
