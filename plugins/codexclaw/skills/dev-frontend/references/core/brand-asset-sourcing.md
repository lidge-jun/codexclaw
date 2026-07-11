# Brand Asset Sourcing — Logos, Icons & SVGs

How to source, use, and handle brand logos in integration/partner sections.
For anti-slop detection of generic icon substitution, see the Iconography Audit section in `anti-slop.md`.

---

## The Problem with Generic Icons

Using generic stroke icons (Lucide, Heroicons, Feather) as substitutes for brand logos is **always wrong**. A checkmark circle is not Kubernetes. A rectangle is not Docker. A layer stack is not AWS.

Brand logos are recognition signals. Generic substitutes look lazy, undermine trust, and signal AI-generated design.

---

## Official Brand SVG Sources (MIT Licensed)

| Library | Coverage | Best For | URL |
|---------|----------|----------|-----|
| **Simple Icons** | 3,400+ brands | Broadest coverage, monochrome SVG + official hex | simpleicons.org |
| **SVGL** | 400+ icons | Light/dark variants, public API | svgl.app |
| **theSVG** | 4,000+ brands | Multi-variant (color, mono, wordmark), MCP integration | thesvg.org |

All MIT-licensed. Safe for integration sections.

```bash
npm install simple-icons  # All 3400+ SVGs as JS objects
```

**Production recommendation:** Self-host SVGs rather than CDN for performance and reliability.

---

## Company Press Kits

When libraries don't have the brand:
- Search for "[Company] press kit" or "[Company] brand guidelines"
- CNCF artwork repo for Kubernetes, Prometheus, etc.
- AWS icons at aws-icons.com
- Brandfetch for aggregated brand assets

---

## Legal: Fair Use for Integration Sections

Using brand logos in "integrates with" or "trusted by" sections is generally safe under nominative fair use if:

1. **Necessary** — The brand can't be identified without the mark
2. **Not confusing** — No suggestion of endorsement or affiliation
3. **Proportional** — Logo is small, in supporting role

**Safe:** "We support Kubernetes deployments" with small logo
**Risky:** "Official Kubernetes Partner" with large featured logo

---

## AI Agent Strategy: What To Do When You Can't Access Real Assets

### Strategy 1: Use Official Libraries (Preferred)

If the brand exists in Simple Icons, SVGL, or theSVG, reference the CDN URL or npm package directly.

### Strategy 2: Placeholder with Explicit TODO

```html
<!-- TODO: Replace with official [BrandName] SVG
     Source: [BrandName] press kit or simpleicons.org
     Do NOT ship with this placeholder. -->
<div class="logo-placeholder" aria-label="BrandName">
  <span>BrandName</span>
</div>
```

### Strategy 3: Ask the User

Report which brands are available in libraries and which need manual sourcing.

### What Agents Must NEVER Do

- Silently substitute generic stroke icons for brand logos
- Ship without flagging missing brand assets
- Use approximate icon shapes ("close enough")

---

## Fallback Hierarchy

| Priority | Approach | When |
|----------|----------|------|
| 1 | Official library SVG (Simple Icons, SVGL) | Brand exists in library |
| 2 | Company press kit SVG | Brand not in library, press kit exists |
| 3 | Text-only label | No SVG available |
| 4 | Brand color + text | Visually distinctive without logo |
| 5 | Placeholder + TODO | Temporary, must be resolved before production |

**Text-only is ALWAYS better than a generic icon.** A wrong icon is worse than no icon.

Integration logo walls use brand assets, not icon rows. See also `asset-requirements.md`.

---

## Dark Mode Handling

```css
[data-theme="dark"] .logo-item img {
  filter: brightness(0) invert(1);
}
```

For multi-variant support, prefer SVGL or theSVG which ship separate light/dark SVGs.

---

## Captured Reference Material vs Shippable Assets

Assets harvested from other sites (HTML, CSS, imagery, fonts) via
`reference-capture.md` are ANALYSIS-ONLY: they ground structure analysis and
ima2 mockup references, and they never ship. Webfont binaries are never copied
(license-restricted by default). Shippable brand assets come only from the
channels in this file (press kits, Simple Icons/SVGL, licensed libraries), and
nominative fair use covers shipped integration logos only. Every capture needs
the provenance manifest defined in `reference-capture.md`.
