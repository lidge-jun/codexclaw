# Opaque-Surface Gradient Discipline — Research

**Date**: 2026-07-09
**Method**: 3 parallel GPT-5.5 explorer lanes with `$cxc-search` attached (Tier 1
discovery -> Tier 2 source-open proof). Lane 3 (live field measurement) died on a
proxy stream disconnect and was respawned as a slim Korean-services lane; lanes 1-2
already carried concrete token values from official design-system docs.

## Trigger

User flagged the opencodex GUI Providers page "Account login" panel as tacky
(촌스러움). Root cause verified in the SIBLING repo (not codexclaw's own GUI):
`/Users/jun/Developer/new/700_projects/opencodex/gui/src/styles.css:175`, with
tokens `--surface` (line 14), `--accent` (line 25), `--accent-soft` (line 28)
all defined in the same file:

```css
.panel-accent {
  border-color: rgba(124, 92, 255, 0.28);
  background: linear-gradient(180deg, var(--accent-soft), transparent 120%), var(--surface);
}
```

A purple-tinted vertical gradient wash layered over an opaque functional panel —
exactly the pattern this research condemns.

## Verdict (Tier-2 backed)

Gradients are not dead; **undisciplined gradients on opaque functional surfaces
are**. The boundary is surface role x opacity:

| Surface / role | Gradient? |
| --- | --- |
| Full-bleed marketing/hero ambient background | Yes (mesh/aurora/grain still current) |
| Brand/illustration/media layer | Yes (art-directed) |
| Translucent glass/navigation layer | Carefully (Liquid Glass rules: nav layer only, no glass-on-glass) |
| Opaque cards/panels/sidebars in tools | **No** — flat surface + border/tint/shadow |
| Opaque buttons/badges/chips | Rarely (one deliberate brand CTA at most) |
| Text gradients | High risk — strong AI-landing tell when repeated |

Why opaque gradient washes read dated (lane 1):

1. Color as decoration, not state — modern systems route color through semantic
   tokens (`color.background.*` / `--bgColor-accent-muted`), never decorative fills.
2. Muddy hierarchy — a wash makes contrast vary top-to-bottom, so text, borders,
   and nested controls fight a changing background.
3. Marketing-era "pretty card" language inside product UI — the premium 2025-2026
   direction for dense tools is calm: solid surfaces, hairline borders, tiny alpha
   fills, purposeful shadows.

History (lane 2): flat design (2012-14) -> Flat 2.0 with subtle shadow/layer depth
(NN/g) -> glassmorphism (2020-21, translucent only) -> 2025-26: in design-community
discussion (Bakaus, vibecodekit, r/webdev "AI has a Purple Problem"), opaque
purple/blue gradient chrome is repeatedly named as a generic-AI-output tell.
Community-taste synthesis, not official-guidance fact — the official sources above
establish the flat/tonal/semantic direction, the community sources supply the
"dated/slop" framing.

## Modern emphasis vocabulary (measured token values, lane 1)

1. Flat semantic tint: Radix `--accent-3/4/5` component backgrounds +
   `--accent-6/7/8` borders; Primer `--bgColor-accent-muted: #ddf4ff` +
   `--borderColor-accent-muted: #54aeff66`.
2. Neutral card + accent border: Geist background-1/2 surfaces, gray-4 border,
   selected -> `border-color: var(--ds-blue-6)`.
3. Left/top accent bar: Stripe Apps keeps the panel body neutral and puts brand
   color in a small stable indicator (`border-left: 3px solid var(--brand)`).
4. Elevation: Primer `--shadow-resting-small` / `--shadow-floating-small` tokens
   instead of decorative panel gradients.
5. Semantic selected/active: shadcn `--accent: oklch(0.97 0 0)` (dark
   `oklch(0.269 0 0)`) — flat values from the theming docs; the
   hover/focus/selected role reading is a system-level inference from component
   usage, not a literal docs quote.
6. Status tokens: Atlassian `color.background.information` etc. — meaning encoded
   in a role, not a wash.
7. Ring emphasis: Tailwind emphasized tier = `ring-2 ring-indigo-600 shadow-lg`
   on a white card, or flat `bg-indigo-50 border-indigo-200`.

## Decision rule (for skill port)

```text
Ambient / expressive / translucent / media-like surface
  -> gradient allowed if it encodes brand mood, light, depth, or material.
Opaque + functional (repeated cards, panels, sidebars, badges, task UI)
  -> NO gradient fill. Emphasize with exactly ONE channel:
     flat alpha/step tint | 1px accent border or ring | left/top accent bar |
     elevation shadow | semantic status token.
```

Corollary (house-rule reconciliation, not an external finding): the anti-slop
line "empty flat sections -> add gradients" must be scoped to ambient/marketing
surfaces, or it contradicts this rule.

## Fix prescription for opencodex `.panel-accent`

Flat tint + border, one emphasis channel:

```css
.panel-accent {
  border-color: rgba(124, 92, 255, 0.28);
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}
```

(or keep `var(--accent-soft)` as a FLAT fill if its alpha is ~4-8% — the point is
removing the directional wash, not the tint.)

## Sources (Tier 2 opened)

- https://vercel.com/geist/colors
- https://docs.stripe.com/stripe-apps/design , https://docs.stripe.com/stripe-apps/style
- https://primer.style/product/getting-started/foundations/color-usage , https://primer.style/product/primitives/color/
- https://www.radix-ui.com/themes/docs/theme/color , https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- https://ui.shadcn.com/docs/theming
- https://atlassian.design/foundations/color , https://developer.atlassian.com/platform/forge/design-tokens-and-theming/
- https://developer.android.com/develop/ui/compose/designsystems/material3 (tonal elevation)
- https://developer.apple.com/videos/play/wwdc2025/219/ (Liquid Glass constraints)
- https://www.nngroup.com/articles/flat-design-best-practices/ , https://www.nngroup.com/articles/flat-design/
- https://polaris-react.shopify.com/design/depth/creating-depth
- https://linear.app/blog/how-we-redesigned-the-linear-ui , https://linear.app/changelog/2025-10-16-mobile-app-redesign
- Community signal (Tier 2 opened, non-authoritative): vibecodekit.dev/ai-slop-design,
  r/webdev threads, Bakaus LinkedIn post.

## Korean services lane

Respawned slim (Dirac); findings appended in `001_korean_services.md` if the lane
returns usable Tier-2 evidence.
