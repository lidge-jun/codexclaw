# 030 — wp3: cross links, WCAG wording fixes, stale references, changelog, PR delivery

Branch: `docs/frontend-skill-audit-consistency` from the wp2 branch head, PR 3 of the manual
chain (base = wp2 branch). Re-verify every "before" line at this cycle's P with `rg -n` and
amend if it moved.

## Scope

IN: wording fixes in both skill directories, cross links between the four new files,
CHANGELOG `[Unreleased]`, `structure/INDEX.md` and `docs-site/src/content/docs/guides/skills.md`
(section G), PR bodies. OUT: rule content changes beyond the listed sentences,
other skills, runtime code.

## A. Cross links (both directions now that all four files exist)

dev-uiux-design/references/universal-principles.md

~~~~diff
-WCAG 2.2 AA has its own owner in
-dev-frontend's WCAG 2.2 AA reference.
+WCAG 2.2 AA has its own owner in
+[dev-frontend WCAG 2.2 AA](../../dev-frontend/references/core/wcag22-aa.md).
~~~~

dev-uiux-design/references/experience-audit.md

~~~~diff
-verdicts, violation screenshots, before/after verification and PR evidence) belongs to
-dev-frontend's visual audit loop.
+verdicts, violation screenshots, before/after verification and PR evidence) belongs to
+dev-frontend's [visual audit loop](../../dev-frontend/references/core/visual-audit-loop.md).
~~~~

## B. WCAG wording fixes (source: 005; each now points at the owner)

| # | File:line (dev @ c12c71c8) | Before | After |
|---|---|---|---|
| 1 | dev-uiux-design/references/favicon-logo.md:152 | `- Click target: minimum 44x44px (WCAG 2.2 AAA). Pad with CSS if the logo is smaller.` | `- Click target: 44x44px, the codexclaw touch baseline and the 2.5.5 (AAA) size; the AA floor is 24x24px under 2.5.8 ([WCAG 2.2 AA](../../dev-frontend/references/core/wcag22-aa.md)). Pad with CSS if the logo is smaller.` |
| 2 | dev-uiux-design/references/favicon-logo.md:319 | `**`prefers-reduced-motion` is mandatory (WCAG 2.1 AA):**` | `**`prefers-reduced-motion` is mandatory (codexclaw rule; WCAG 2.3.3 is AAA, see [product rules beyond AA](../../dev-frontend/references/core/wcag22-aa.md#product-rules-beyond-aa)):**` |
| 3 | dev-uiux-design/references/color-system.md:89 | `- Large text (≥ 24px or bold ≥ 18.5px): 3:1 minimum.` | `- Large text (≥ 24px, or bold ≥ 18.66px; 18pt and 14pt bold): 3:1 minimum.` |
| 4 | dev-uiux-design/references/color-system.md:90 | `- Interactive components: 3:1 against adjacent colors.` | `- Component boundaries and states needed to identify a control: 3:1 against adjacent colors (1.4.11).` |
| 5 | dev-uiux-design/references/ux-preflight.md:70 | `- [ ] Color contrast passes WCAG AA (4.5:1 text, 3:1 large text)` | `- [ ] Text contrast passes WCAG 1.4.3 (4.5:1 text, 3:1 large text); full AA statements follow dev-frontend [WCAG 2.2 AA](../../dev-frontend/references/core/wcag22-aa.md)` |
| 6 | dev-frontend/references/core/a11y-patterns.md:131 | `- axe-core or Lighthouse accessibility audit (score ≥ 90)` | `- axe-core with the WCAG 2.2 tags in [WCAG 2.2 AA](wcag22-aa.md#automated-pass); a Lighthouse accessibility score is smoke only, never a conformance result` |
| 7 | dev-frontend/references/core/a11y-patterns.md:138 | `- 3:1 contrast for UI components and graphical objects` | `- 3:1 contrast for component boundaries and states needed to identify them, and for meaningful graphics (1.4.11)` |
| 8 | dev-frontend/references/core/visual-verification.md:57 | `2. **Form field contrast:** Input borders must be visible against background (minimum 3:1 against surrounding bg). Test: toggle between light/dark if applicable.` | `2. **Form field contrast:** When the border is what identifies the input, it needs 3:1 against the surrounding background (WCAG 1.4.11; disabled fields are exempt). Test: toggle between light/dark if applicable.` |
| 9 | dev-frontend/references/core/platform-runtime.md:12 | `- WCAG AA minimum (4.5:1 normal text, 3:1 large text)` | `- Text contrast 4.5:1 normal, 3:1 large (WCAG 1.4.3); conformance statements follow [WCAG 2.2 AA](wcag22-aa.md)` |
| 10 | dev-frontend/references/core/platform-runtime.md:13 | `- Visible focus indicators (`focus-visible:ring-2`)` | `- Focus indicators that are visible and never fully hidden (WCAG 2.4.7, 2.4.11); `focus-visible:ring-2` is one implementation` |
| 11 | dev-frontend/references/core/platform-runtime.md:22 | `- Pointer targets follow WCAG 2.2 AA target-size rules; 44×44px is a conservative product baseline, not the only legal minimum` | `- Pointer targets meet WCAG 2.5.8 (24×24 CSS px or equivalent spacing, see [WCAG 2.2 AA](wcag22-aa.md)); 44×44px is the conservative product baseline for touch` |
| 12 | dev-frontend/references/core/anti-slop.md:257 | `- Default browser focus rings → `focus-visible:ring-2`` | `- Default focus rings restyled without checking → a `focus-visible` ring verified visible and unobscured (WCAG 2.4.7, 2.4.11)` |
| 13 | dev-frontend/references/core/korea-2026.md:37 | see diff 13 below | see diff 13 below |

### Diff 13 (full line)

~~~~diff
-- Treat 44×44px hit areas as a conservative mobile baseline; smaller targets must still satisfy WCAG 2.2 target-size/spacing requirements.
+- Treat 44×44px hit areas as a conservative mobile baseline; smaller targets must still meet WCAG 2.5.8 (24×24 CSS px or equivalent spacing, see [WCAG 2.2 AA](wcag22-aa.md)).
~~~~

## C. Stale section references (source: 003 explorer uiux + main grep)

| # | File:line | Before | After |
|---|---|---|---|
| 14 | dev-uiux-design/references/intent-discovery-ladder.md:4 | `The compact flow in SKILL.md §1` | `The compact flow in [intent discovery](intent-discovery.md)` |
| 15 | dev-uiux-design/references/design-read-example.md:3 | `Use this as a filled-in model for `SKILL.md` §2.` | `Use this as a filled-in model for [Design Read](design-read.md).` |
| 16 | dev-uiux-design/references/anti-rationalization.md:13 | `(dev-frontend §12 Design System Detection is MANDATORY)` | `(Design System Detection in dev-frontend [platform rules](../../dev-frontend/references/core/platform-runtime.md#12-frontend-platform-rules) is MANDATORY)` |
| 17 | dev-uiux-design/references/anti-rationalization.md:20 | `pre-flight companion to dev-frontend §14 (Pre-Flight Checklist), not a` | `pre-flight companion to dev-frontend [full pre-flight](../../dev-frontend/references/core/preflight-full.md), not a` |
| 18 | dev-frontend/references/core/dropdown-layer.md:40 | `Design System Detection in `dev-frontend/SKILL.md` Section 12 wins.` | `Design System Detection in [platform rules](platform-runtime.md#12-frontend-platform-rules) wins.` |
| 19 | dev-frontend/references/core/preflight-full.md:3 | `Companion to `dev-frontend/SKILL.md` §14. The router keeps` | `Companion to the `dev-frontend/SKILL.md` pre-flight row. The router keeps` |
| 20 | dev-frontend/references/core/preflight-full.md:28 | `(SKILL §12)` | `([state classification](platform-runtime.md#state-classification))` |
| 21 | dev-frontend/scripts/README.md:8 | `aligned with `SKILL.md` §12.` | `aligned with [platform rules](../references/core/platform-runtime.md#12-frontend-platform-rules).` |

Anchor slugs follow `slug()` in check-prompt-architecture.mjs:88 (GitHub style): heading
`## 12. Frontend Platform Rules` gives `12-frontend-platform-rules`; the link gate verifies it.

## D. Duplicate index rows

| # | File | Change |
|---|---|---|
| 22 | dev-uiux-design/references/topic-index.md | Delete the second `design-trends.md` row (the "Calibrating a dated design example" row at the end); the first row already covers it |
| 23 | dev-frontend/references/core/topic-index.md | Merge the two `design-trends.md` rows into one: When `Calibrating a dated example or implementing a dated trend`, Covers `2026-07-14 axis prevalence, technique maturity, provenance, exceptions, re-verification and promotion rules` |

## E. CHANGELOG [Unreleased]

~~~~markdown
### Added

- dev-uiux-design: an experience audit (personas, journeys, ideal state, a severity-ranked gap ledger and a handoff packet) and universal interface principles distilled from Apple's HIG without Apple-specific visuals. (#PR1)
- dev-frontend: a WCAG 2.2 AA owner with all 55 A/AA criteria, the six 2.2 additions, a Playwright axe script and verdict rules that forbid conformance claims from automated runs alone; a visual audit loop with a violation ledger, a verifier and pass rule per violation, before/after captures, a closure gate, a PR before/after section and cxc-loop routing. (#PR2)

### Fixed

- WCAG levels and thresholds stated wrongly in both skills: reduced motion labelled AA (it is AAA 2.3.3), large bold text at 18.5px (18.66px), Lighthouse score used as an accessibility pass, unconditional 3:1 borders, and target size without the 24px AA floor. Stale "SKILL.md §12/§14" references now link to the sections that hold those rules. (#PR3)
~~~~

PR numbers replace `#PR1..3` when known.

## F. PR delivery (goalplan c-8)

Push and PR creation are authorized by the user's request in this session for multiple PRs
with before/after sections; merge is not. Manual chain (DEV-STACK-OPT-IN-01: no native stack):

| PR | Head | Base | Before/After content |
|---|---|---|---|
| 1 | docs/frontend-skill-audit-uiux | dev | Before: "audit this product" had no persona, journey, ideal state or gap ledger owner (003). After: UX-AUDIT-01..07 and P/J tables |
| 2 | docs/frontend-skill-audit-frontend | docs/frontend-skill-audit-uiux | Before: no WCAG 2.2 AA owner, no per-violation verifier; fixture screenshots at 390 px. After: same fixture, axe `[]` exit 0, screenshots |
| 3 | docs/frontend-skill-audit-consistency | docs/frontend-skill-audit-frontend | Before/after table of the 23 corrected sentences |

Images for PR 2 are committed under `evidence/axe-fixture/` on its branch and referenced by
blob URL. Each PR gets `goat_pull_request_link` if that tool exists in the session.

## G. Source-of-truth sync (SOT-SYNC-01)

structure/INDEX.md:162-163

~~~~diff
-| `cxc-dev-frontend` | `skills/dev-frontend/` | UI/frontend implementation |
-| `cxc-dev-uiux-design` | `skills/dev-uiux-design/` | design judgment, UX states, logos/typography |
+| `cxc-dev-frontend` | `skills/dev-frontend/` | UI/frontend implementation, WCAG 2.2 AA verdicts, visual audit loop |
+| `cxc-dev-uiux-design` | `skills/dev-uiux-design/` | design judgment, UX states, experience audits, logos/typography |
~~~~

docs-site/src/content/docs/guides/skills.md:99-100

~~~~diff
-| `cxc-dev-frontend` | `dev-frontend` | Frontend/UI implementation and responsive layout. |
-| `cxc-dev-uiux-design` | `dev-uiux-design` | UX direction, states, visual judgment, logos, and typography. |
+| `cxc-dev-frontend` | `dev-frontend` | Frontend/UI implementation, responsive layout, WCAG 2.2 AA checks and before/after visual audits. |
+| `cxc-dev-uiux-design` | `dev-uiux-design` | UX direction, states, experience audits (personas, journeys, gap ledger), visual judgment, logos, and typography. |
~~~~

Residual, not changed: README.md:31 "155 unique rule IDs" is prose that no gate counts
(`rg -i 'rule id' plugins/codexclaw/scripts/inventory.mjs` finds nothing); adding seven ids
makes it older, and recounting the family is outside this unit.


## Accept criteria (goalplan c-5, c-7, c-8)

| Criterion | Observable proof |
|---|---|
| c-5 | `rg -n 'WCAG 2\.1 AA|18\.5px|score ≥ 90|SKILL\.md` `§1[24]|SKILL §12|Section 12' plugins/codexclaw/skills/dev-frontend plugins/codexclaw/skills/dev-uiux-design` returns nothing |
| c-7 | gate.mjs, check-prompt-architecture.mjs and the five skill tests exit 0 at the PR 3 head; full `npm test` through `cxc receipt test` at PR 3 head |
| c-8 | three PRs open with the bases above, before/after sections present, checks green |

