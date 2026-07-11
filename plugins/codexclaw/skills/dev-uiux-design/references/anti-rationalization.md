# Anti-Rationalization Table (UX-ANTI-RATIONAL-01)

Source: addyosmani/agent-skills frontend-ui-engineering pattern, adapted for codexclaw.

Agents rationalize shortcuts. This table pre-empts the five most common excuses
by naming the shortcut, its factual rebuttal, the observable red flag that proves
the shortcut was taken, and the verification action that closes the gap.

| Shortcut | Rebuttal | Red Flag | Verification |
|----------|----------|----------|--------------|
| "The reference is only inspiration, so exact tokens don't matter" | Observed tokens ARE the direction lock. Palette drift > 2 OKLCH stops from DESIGN.md is a regression, not creative freedom. | Colors, radii, or type in the build don't match DESIGN.md. | Color-pick the rendered page; compare hex values against DESIGN.md tokens. |
| "One desktop screenshot is enough" | Mobile is a different product (dev-frontend mobile-ux.md). A desktop-only check misses thumb zones, collapsed nav, and touch targets. | No mobile or tablet screenshot in C-phase evidence. | Screenshot at 390px (mobile) and 768px (tablet) in addition to desktop. |
| "The design system wasn't obvious, so I created new tokens" | Always check package.json first (dev-frontend §12 Design System Detection is MANDATORY). Inventing tokens when an official system exists doubles maintenance. | New CSS custom properties or Tailwind config when MUI/Carbon/shadcn is installed. | Run the DS detection grep before creating any tokens. |
| "The concept mockup is close enough to skip runtime verification" | Generated text and logos in concept art are unreliable. The mockup locks the direction; the browser proves the implementation. | No browser screenshot after implementation; only concept renders cited as evidence. | Open the dev server, screenshot, view_image, compare against DESIGN.md. |
| "A screenshot proves accessibility" | Vision cannot test keyboard navigation, focus order, screen reader announcements, or ARIA state. A screenshot proves visual layout, nothing more. | No keyboard traversal test or axe-core run in C-phase evidence. | Tab through the flow; run axe-core or equivalent; record results. |

## When to load this reference

Load before C-phase verification on any C2+ frontend work. The table is a
pre-flight companion to dev-frontend §14 (Pre-Flight Checklist), not a
replacement for it.
