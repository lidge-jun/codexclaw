# Build role boundaries (build and audit modes)

> **Build mode** implements a chosen direction. For typography/color/layout direction, UX
> decision gates, product personalities or vague visual briefs, run direction mode first
> ([direction roles](../direction/role-boundaries.md)); build mode does not re-decide them.
> Visible words come from copy mode. Rendered anti-slop tell detection and enforcement
> lives in build and audit modes; concept/taste judgment lives in direction mode.

> **Role boundary (canonical — identical in [direction](../direction/role-boundaries.md) and [build](role-boundaries.md) role files):**
> `dev` owns universal process, evidence, and safety rules. `dev-design` is one skill
> with four modes that hand off in order: **direction** (intent, IA, UX-state meaning,
> concept and taste judgment) → **copy** (visible words, register, tells) → **build**
> (HTML/CSS/components, responsive, accessibility wiring, rendered tell enforcement) →
> **audit** (rendered review, violation ledger, lint, before/after proof). A narrow task
> enters at the mode it needs; an open-ended visual brief never skips direction.
> Anti-slop has three layers: `dev` = output/process hygiene (FAMILY-SLOP-01), direction =
> concept/taste judgment (is this direction generic or domain-wrong?), build and audit =
> rendered tell detection and removal (FE-AI-TELL-01).

**Audit handoff:** when direction mode hands over an
[experience audit](../direction/experience-audit.md), audit mode records its rendered
gaps in the [visual audit loop](visual-audit-loop.md) ledger with their GAP-ids. Accessibility
verdicts follow [WCAG 2.2 AA](wcag22-aa.md).
