## 5. Anti-Slop Enforcement

Rule classes (dev §0.2): items below are DEFAULT — deviate with a stated reason; concrete
values and palettes are STYLE_SAMPLE (`design-intake.md` §1.5); the emoji-as-UI-icon ban is the only STRICT item.

Read `anti-slop.md` for full rules. Key standards:

Award examples do not establish universal taste rules. Use the shipped design-trends
reference and reopen its sources; explain the product-specific role and preserve
accessibility. No private goalplan is required to justify a design decision.

### Hero discipline (FE-HERO-01)

- First viewport must fit: hero content leaves a hint of the next section on mobile and desktop.
- Keep hero copy to ~4 text elements max: headline, subhead, primary CTA, one proof/context line.
- Do not put trust strips, pricing teasers, feature bullets, or mini dashboards inside the hero.
- Logo walls belong below the hero, not as hero filler.
- Plan font scale with image/product scale so neither crushes the other.

Before delivery, run the second-order reflex test (FE-REFLEX-TEST-01, `anti-slop.md`) against both the obvious category default and its fashionable opposite.
Audit composite convergence tells under FE-CONVERGENCE-01 (`anti-slop.md`): hairline border+shadow, icon-tile-above-heading, italic-serif-hero, hero-metric template, and other multi-element compositions.

- Treat unexamined default typography as a slop signal. Choose a domain-appropriate stack; Korean-first UI should use CJK-safe fonts and system fallbacks deliberately.
- **Gradient budget (FE-GRADIENT-01)**: gradient soup is the 2026 #1 anti-slop signal; max 1 ambient gradient per viewport and no gradients on 3+ sibling cards — see `anti-slop.md § Gradient Budget`
- **One-note theme ban (FE-ONENOTE-01)**: full-page single-hue dark washes (terminal green, cyber cyan, CRT amber) are the current dark-mode tell — see `anti-slop.md § One-Note Theme Ban`
- **No self-describing meta copy (FE-METACOPY-01)**: UI text must explain the product/user job, never narrate the mockup, layout, responsive behavior, or agent process — see `anti-slop.md § Self-Describing Meta Copy`
- Use neutral or intentional color palettes — purple gradients on white are now the old tell; gradient overuse and one-note single-hue themes are the current tell
- Use asymmetric or purposeful layouts — centered-everything reads as template
- Vary card sizes, spans, and groupings — equal 3-card grids read as generic
- **Bento composition (FE-BENTO-01)**: bento grids must read as one interlocking slab with aligned row edges, a dominant cell, content-weighted spans, and no orphan tail — see `layout-discipline.md § Bento Composition`
- Avoid oversized bold hero text inside tools, dashboards, admin, finance flows, and public services
- **Hero composition (FE-HERO-SPLIT-01)**: never build a split hero (left bold headline + right boxed screenshot/mockup card) unless the user explicitly requests one — the product visual is the stage (full-width, background, or interactive demo), never a right-column card; paid-conversion LPs are the one context to propose it — see `layout-discipline.md § Hero Composition Grammar`
- Avoid asset-free UI: abstract blobs/gradients do not replace real visual evidence
- Avoid generic soft 3D icon packs; soft 3D must be semantic, brand-consistent, and restrained
- **NEVER use emoji as UI visual elements** (feature icons, card icons, section markers, buttons) — emoji in production UI is the #1 AI slop signal. Use SVG icons (Lucide/Phosphor/Heroicons), but choose the set from the Design Read instead of treating that parenthetical as a default. Lucide-as-default is itself a 2025-2026 vibe-coded tell: detect icon-library monoculture when the project uses the same glyphs and weight as every shadcn starter. Prefer a domain-correct library and a deliberate domain/brand layer; do not swap libraries randomly for novelty. See `anti-slop.md § Emoji Slop`
- Warm beige/cream backgrounds with brass/clay accents are banned as defaults for premium-consumer briefs — see `anti-slop.md § Premium-Consumer Palette Ban`
- Layout monotony (same family repeated, 3+ zigzag sections, overused eyebrows) — see `layout-discipline.md`
- Color, shape, and theme must be locked per-page and audited before shipping — see `consistency-locks.md`
- Use off-black (`#0a0a0a`, `#111`) — pure `#000000` lacks depth
- **Responsive enforcement (DEFAULT)**: every multi-column section must declare its mobile/tablet collapse behavior — "it'll work at mobile" is not a plan. See `responsive-viewport.md`
- **Page containment required**: `max-w-[1400px] mx-auto` or equivalent wrapper. Content stretching to viewport edges on wide monitors is a layout bug
- **Mobile is a different product**: section composition, CTA placement, and interaction model change on mobile — it is NOT just "desktop stacked vertically." See `mobile-ux.md`
- Use realistic, specific names and brands in placeholder content
- Write original copy — avoid "Elevate", "Seamless", "Next-Gen" and similar clichés
- Treat uncontrolled heading line breaks (orphaned single word, no `text-wrap`, no `max-width` in `ch`) as a slop signal — see `typography-wrapping.md`
- Treat short descriptors (hero subtitle, card description, caption) using `text-wrap: pretty` instead of `balance` as a slop signal — `pretty` does nothing on 1-3 line text, especially Korean
- Treat Korean orphan fragments ("합니다.", "화.", "입니다." alone on a line) as a slop signal — always verify Korean text breaks at target viewports
- Treat generic stroke icons as brand logo substitutes as a slop signal — use actual brand SVGs from Simple Icons, SVGL, or press kits. See `brand-asset-sourcing.md`
- When NO design brief exists, do not invent a generic default: apply the domain-gated no-brief kit owned by `../../../dev-uiux-design/references/intent-discovery.md` §1 UX-DEFAULT-ISM-01 and state the assumption

### Do not ship these tells (FE-AI-TELL-01)
Enforce the complete AI-default tell catalogs in `anti-slop.md` and `layout-discipline.md`.
---
