# 002 — Web platform and UX patterns since 2026-07 (research for wp4)

Read 2026-11-21. Re-check MDN Baseline badges at wp4 P; statuses move monthly.

## CSS / HTML features: none are mentioned in dev-frontend today

| Feature | Status (Nov 2026) | Source |
|---|---|---|
| Anchor positioning (`anchor-name`, `position-anchor`, `position-area`, `position-try-fallbacks`) | Baseline 2026, newly available since 2026-09 (Chrome 125, Firefox 147, Safari 26) | MDN position-anchor; cssdna 2026-08-26 |
| `text-box-trim` / `text-box` | Baseline 2026, since 2026-08 (Firefox 154) | MDN text-box-trim |
| Scroll-driven animations | All three engines after Firefox 159 (2026-10-27) | jarednewnam.com 2026-11-06 |
| `@starting-style` | Baseline since 2024-08; widely available ~2027-02; Firefox fades in but snaps out (`display` not transitioned) | flaviocopes 2026-09-21 |
| Customizable select (`appearance: base-select`, `::picker(select)`, `<selectedcontent>`) | Chrome 135+, Safari 27; Firefox behind flag | web.dev 2026-10 release notes |
| Interest invokers (`interestfor`) | Chromium only | uiarchives 2026-11-18 |
| `field-sizing: content` | Chromium + Safari | uiarchives 2026-11-18 |
| Popover API, invoker commands (`commandfor`) | Baseline (popover 2025-01, invokers 2025-12) | anhtu.dev 2026-10-05 |
| `<dialog closedby>` | Chrome/Firefox; Safari not yet (Interop 2026) | anhtu.dev |
| Cross-document view transitions (`@view-transition`) | Chromium + Safari; Firefox partial | uiarchives |
| Style queries (custom properties) | All three engines (Firefox 151) | cssdna |

dev-frontend already covers: oklch/color-mix/light-dark, container queries, text-wrap,
same-document view transitions, scroll-driven animation (pre-Firefox note), popover.

## Agent action UX: missing from dev-uiux-design

`references/conversational-ai.md` covers chat turn states, interruption, regeneration and
uncertain results; `rg -i 'confirm|approval|tool call|plan'` on it returns 0 (2026-11-21).
The 2027 pattern writing converges on:

- Intent preview: restate the parsed goal as editable fields before acting.
- Plan preview as a checklist the agent ticks through live.
- Review and approve screen: exact proposed changes, approve all / edit / undo.
- Scoped confirmation only for irreversible actions (pay, delete, send); the primary label
  names the action ("Order", not "OK"); Apple keeps confirmation snippets short.
- Activity log, pause agent, undo after the fact; confidence shown without raw percentages.
- Empty state seeded with concrete example intents.

Sources: browserlondon 2026-11-06, neonapps 2026-11-16, design-bootcamp 2026-11-01,
Dribbble/Unfold 2026-10-30, uxdesigninstitute 2026-11-13. This matters directly for GOAT
and the direction-board product the user builds.

## Tokens and design context

- Design Tokens Community Group format 2025.10 is stable (since 2025-10-28).
- DESIGN.md (google-labs-code) is now the shared context file read by hallmark, impeccable,
  open-design and Stitch. dev-uiux-design's Design Read saves a "mini DESIGN.md" in its own
  shape; wp4 aligns its persistence section to the spec's YAML front matter and names the
  `lint` command as an optional check when Node can fetch it.
