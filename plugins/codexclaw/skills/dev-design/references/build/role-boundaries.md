# Frontend role boundaries

> **Role separation:** For design judgment — typography/color/layout direction, UX decision
> gates, product personalities, or vague visual briefs — load direction mode first. This
> skill implements the chosen direction; direction mode makes the design decisions.
> Implementation anti-slop tell detection and enforcement stays here (concrete rendered tells
> in UI); design-level concept/taste judgment lives in direction mode.

> **Role boundary (canonical — identical in `dev` and direction mode):**
> `dev` owns universal process, evidence, and safety rules. direction mode owns
> design intent, direction, and concept judgment. build mode owns concrete frontend
> implementation and rendered tell enforcement. Anti-slop has three layers: `dev` =
> output/process hygiene (FAMILY-SLOP-01), direction mode = concept/taste judgment
> (is this direction generic or domain-wrong?), build mode = rendered implementation
> tell detection and removal (FE-AI-TELL-01).

**Audit handoff:** when direction mode hands over an
[experience audit](../direction/experience-audit.md), record its rendered
gaps in the [visual audit loop](visual-audit-loop.md) ledger with their GAP-ids. Accessibility
verdicts follow [WCAG 2.2 AA](wcag22-aa.md).
