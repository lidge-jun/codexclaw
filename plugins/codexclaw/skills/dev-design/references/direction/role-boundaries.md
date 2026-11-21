# Design role boundaries (direction mode)

**Emoji ban (stub):** no emoji as UI visual elements (STRICT). Canonical rule, scope, and exemptions: [build enforcement](../build/anti-slop-enforcement.md#5-anti-slop-enforcement) / [anti-slop § Emoji Slop](../build/anti-slop.md).

**Direction mode owns** design judgment: intent discovery, information architecture, UX state meaning, typography/color/layout direction, product personality, brand vocabulary, anti-slop concept/taste judgment (is this direction generic, domain-wrong, or aesthetically derivative?), and design-system decisions. It hands copy mode the voice and register, then hands build mode the locked direction (Design Read / DESIGN.md) for HTML/CSS/components, responsive mechanics, accessibility wiring, runtime behavior and rendered verification.

**Audit handoff:** an [experience audit](experience-audit.md) ends with one packet of
personas, journeys, ideal state, gap ledger and per-gap verifiers. Audit mode records the
rendered gaps as violations in the [visual audit loop](../build/visual-audit-loop.md), build
mode fixes them, and each fix is proven with before and after evidence.

> **Role boundary (canonical — identical in [direction](role-boundaries.md) and [build](../build/role-boundaries.md) role files):**
> `dev` owns universal process, evidence, and safety rules. `dev-design` is one skill
> with four modes that hand off in order: **direction** (intent, IA, UX-state meaning,
> concept and taste judgment) → **copy** (visible words, register, tells) → **build**
> (HTML/CSS/components, responsive, accessibility wiring, rendered tell enforcement) →
> **audit** (rendered review, violation ledger, lint, before/after proof). A narrow task
> enters at the mode it needs; an open-ended visual brief never skips direction.
> Anti-slop has three layers: `dev` = output/process hygiene (FAMILY-SLOP-01), direction =
> concept/taste judgment (is this direction generic or domain-wrong?), build and audit =
> rendered tell detection and removal (FE-AI-TELL-01).


## Rule class note

> **Rule class note (UX-STYLE-01):** Everything in direction mode that expresses taste —
> product personalities, design-isms, preset tokens, aesthetic vocabulary — is
> `STYLE_SAMPLE` (defined in `dev` §0.2): examples to draw from, never universal requirements. Objective UX
> correctness (state coverage, accessibility, readability) is owned by [build objective/style classification](../build/design-intake.md#15-objective-gates-vs-style-samples) and stays STRICT/DEFAULT.
