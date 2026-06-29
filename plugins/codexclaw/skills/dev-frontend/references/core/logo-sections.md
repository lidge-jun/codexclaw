# Logo Sections — Integration Grids, Marquees & Brand Walls

Patterns for displaying partner/integration logos. These sections are trust signals, not navigation.
For design judgment (when/why to use each pattern), see `dev-uiux-design/references/logo-trust-sections.md`.

---

## Decision Table

| Condition | Pattern | Reason |
|-----------|---------|--------|
| ≤6 logos, need labels/links | Static grid | Clean, scannable, clickable |
| ≤6 logos, case study links | Static grid, clickable | Hover justified — links add value |
| 8+ logos, social proof | CSS marquee | Avoids orphan cells, feels dynamic |
| Many logos, save vertical space | Multi-row marquee | Opposing directions add depth |
| Portfolio/client list | Static grid with uniform treatment | Professional, organized |

---

## Why Logo Sections Should NOT Have Individual Hover Effects

Logo/integration sections are **trust signals**, not interactive navigation.

1. **False affordance** — Hover implies clickability. Users expect navigation but get nothing.
2. **Visual noise** — Many logos + hover animations = busy, gimmicky, undermines credibility.
3. **Mobile incompatibility** — Hover states don't exist on touch devices.
4. **Brand guideline conflicts** — Heavy modifications can violate partner brand guidelines.
5. **Distraction from CTA** — The section's job is to build trust, not capture clicks.

**Acceptable alternatives:**
- Pause the entire marquee on hover (standard)
- Very subtle uniform opacity change on section hover (not individual items)
- No hover at all (cleanest, most common in premium sites)
- **Exception:** If logos link to case study pages, individual hover is justified.

---

## CSS-Only Marquee

The dominant production pattern. Duplicate the content for seamless looping.

```html
<div class="marquee" aria-label="Trusted by leading companies">
  <div class="marquee-track">
    <!-- Original set -->
    <img src="/logos/kubernetes.svg" alt="Kubernetes" width="120" height="40">
    <img src="/logos/docker.svg" alt="Docker" width="120" height="40">
    <img src="/logos/aws.svg" alt="AWS" width="120" height="40">
    <!-- Duplicate set for seamless loop -->
    <img src="/logos/kubernetes.svg" alt="" aria-hidden="true" width="120" height="40">
    <img src="/logos/docker.svg" alt="" aria-hidden="true" width="120" height="40">
    <img src="/logos/aws.svg" alt="" aria-hidden="true" width="120" height="40">
  </div>
</div>
```

```css
.marquee {
  overflow: hidden;
  user-select: none;
  -webkit-mask-image: linear-gradient(
    to right, transparent, black 10%, black 90%, transparent
  );
  mask-image: linear-gradient(
    to right, transparent, black 10%, black 90%, transparent
  );
}

.marquee-track {
  display: flex;
  gap: 48px;
  align-items: center;
  width: max-content;
  animation: marquee-scroll 40s linear infinite;
}

.marquee-track img {
  height: 32px;
  width: auto;
  flex-shrink: 0;
  filter: grayscale(1) brightness(0.7);
  opacity: 0.5;
  transition: none; /* No individual hover */
}

@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.marquee:hover .marquee-track {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
}
```

### Marquee Speed Guide

| Speed | Duration | Feel | Use |
|-------|----------|------|-----|
| Very slow | 50-60s | Calm, premium | Enterprise, finance |
| Slow | 30-40s | Professional | General SaaS |
| Medium | 20-30s | Energetic | Startups, dev tools |
| Fast | <15s | Cheap, frantic | **Avoid** |

`linear` timing only — no easing. Constant speed feels intentional.

### Key Details
- Duplicate items get `aria-hidden="true"` and empty `alt=""`
- Fade edges with `mask-image` gradient — no hard cut
- `translateX(-50%)` only works when content is exactly duplicated

---

## Multi-Row Opposing Marquee

Two rows scrolling in opposite directions for visual depth.

```css
.marquee-reverse .marquee-track {
  animation-direction: reverse;
}
```

---

## Static Grid (≤6 Logos)

When logos need labels or link to documentation/case study pages.

```css
.logo-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 32px 48px;
  align-items: center;
}

.logo-grid img {
  height: 28px;
  width: auto;
  filter: grayscale(1) brightness(0.7);
  opacity: 0.5;
}
```

**Use `flexbox` with `justify-content: center`, NOT CSS grid** — flex avoids the orphan cell problem.

---

## The Orphan Cell Problem

When a CSS grid has e.g. 8 items in a 7-column layout, 1 item sits alone on the last row.

| Solution | When to use |
|----------|-------------|
| **Marquee** | 8+ logos — eliminates the problem entirely |
| **Flexbox with `justify-content: center`** | Items wrap naturally, no empty cells |
| **Match column count to item count** | Add or remove logos to fill the row |

**Never** leave a single item alone on a grid row.

---

## Grayscale Treatment

Standard for logo walls: desaturated/monochrome by default.

```css
.logo-item img {
  filter: grayscale(1) brightness(0.7);
  opacity: 0.5;
}

[data-theme="dark"] .logo-item img {
  filter: grayscale(1) brightness(1.2) invert(1);
  opacity: 0.4;
}
```

Do NOT apply `filter: grayscale(0)` on individual hover. The grayscale-to-color-on-hover pattern feels gimmicky in 2026.

---

## Performance

- Use SVGs — sharp at any size, tiny file size
- Set explicit `width` and `height` attributes — prevents layout shift
- `will-change: transform` on the marquee track
- Lazy-load below-fold logos with `loading="lazy"`
