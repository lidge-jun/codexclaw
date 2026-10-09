---
name: cxc-dev-uiux-design
description: "Use for UI/UX and brand direction. Triggers: make it look good, onboarding, empty state, error state, favicon, logo, design system, 깔끔하게, 모던하게, 감성적으로."
metadata:
  last-verified: "2026-07-14"
  short-description: "Design judgment for vague briefs, UX states, typography, layout patterns, logos, and brand vocabulary."
---

# UI/UX Design: Intent Discovery, Patterns & Product Vocabulary

Activates by change surface when:
- User's design direction is vague ("깔끔하게", "모던하게", "just make it look good")
- Building onboarding, empty state, error state, or loading state UI
- User references a product aesthetic ("Notion 느낌", "Linear처럼")
- Starting a new design system or generating a color palette
- Choosing layout patterns or navigation architecture
- Setting up favicons, product logos, or brand identity elements
- Handling logo dark mode variants, OG images, or social sharing meta

Read this before style-specific references when the user cannot articulate a clear design direction.
For rendered anti-slop tell detection and implementation-level banned patterns, defer to `dev-frontend/references/core/anti-slop.md`, especially the 2026 gradient budget and one-note theme bans. This skill owns concept/taste-level anti-slop judgment (is this direction generic or domain-wrong?).

Use [dev](../dev/SKILL.md) for work class, fast paths, rule classes, family invariants, proof and safety; current evidence: [conditional routes](../dev/SKILL.md#conditional-routes).

Use browser fetch/open/text/get-dom/snapshot only after candidate URLs exist.

## Modular References

| Condition | Reference |
|---|---|
| Every design task: role boundary, rule classes and implementation handoff | [Role boundaries](references/role-boundaries.md) |
| User-facing decision points | [Lazy-user gate](references/lazy-user-gate.md) |
| Vague design direction or no brief | [Intent discovery](references/intent-discovery.md) |
| New pages/components/layouts: before frontend code | [Design Read](references/design-read.md) |
| Concept generation before implementation | [Concept procedure](references/concept-exploration.md) |
| After concept lock: production assets | [Asset handoff](references/asset-handoff.md) |
| Choosing iconography during Design Read | [Icon strategy](references/icon-strategy.md) |
| Styles, product references, typography, palette, states, IA, branding, Korean UI or pre-delivery checks | [Topic index](references/topic-index.md) |

## UX State Contract (UX-STATE-01)

For onboarding, empty, loading, error, or progressive-disclosure work, the body must answer the state meaning before styling. Deep patterns live in `references/ux-states.md`.

- Onboarding teaches the first meaningful action, not the whole product.
- Empty explains why the state exists and names the next action.
- Loading chooses skeleton for known structure, spinner/progress for short unknown waits, and avoids fake completion.
- Error exposes retry, recovery, or escalation; never dead-end the user.
- Progressive disclosure names what stays hidden, why it stays hidden, and where it becomes available.

## IA Chooser (UX-IA-01)

Default navigation architecture by work shape; read `references/responsive-nav.md` for responsive details.

| Work shape | Default IA |
|------------|------------|
| Dense desktop repeated work | Sidebar + command palette |
| Medium sectioned work | Tabs or segmented navigation |
| Mobile-primary consumer flow | Bottom nav, sheet, or thumb-zone actions |
| Wizard/auth/setup | Stepper or stacked linear flow |

## 2.5 Visual Concept Exploration (UX-CONCEPT-GEN-01, DEFAULT)

Before implementing a C2+ expressive or brand-visible surface, read the [concept procedure](references/concept-exploration.md).
