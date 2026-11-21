# Design role boundaries

**Emoji ban (stub):** no emoji as UI visual elements (STRICT). Canonical rule, scope, and exemptions: [frontend enforcement](../build/anti-slop-enforcement.md#5-anti-slop-enforcement) / `../../dev-design/references/build/anti-slop.md § Emoji Slop`.

**Role separation:** This skill owns design judgment: intent discovery, information architecture, UX state meaning, typography/color/layout direction, product personality, brand vocabulary, anti-slop concept/taste judgment (is this direction generic, domain-wrong, or aesthetically derivative?), and design-system decisions. build mode owns implementation: HTML/CSS/components, responsive mechanics, accessibility wiring, runtime behavior, rendered tell detection, and rendered verification. After choosing the design direction here, load build mode for concrete implementation.

**Audit handoff:** an [experience audit](experience-audit.md) ends with one packet of
personas, journeys, ideal state, gap ledger and per-gap verifiers. build mode records the
rendered gaps as violations, fixes them and proves each fix with before and after evidence.

> **Role boundary (canonical — identical in `dev` and build mode):**
> `dev` owns universal process, evidence, and safety rules. direction mode owns
> design intent, direction, and concept judgment. build mode owns concrete frontend
> implementation and rendered tell enforcement. Anti-slop has three layers: `dev` =
> output/process hygiene (FAMILY-SLOP-01), direction mode = concept/taste judgment
> (is this direction generic or domain-wrong?), build mode = rendered implementation
> tell detection and removal (FE-AI-TELL-01).


## Rule class note

> **Rule class note (UX-STYLE-01):** Everything in this skill that expresses taste —
> product personalities, design-isms, preset tokens, aesthetic vocabulary — is
> `STYLE_SAMPLE` (defined in `dev` §0.2): examples to draw from, never universal requirements. Objective UX
> correctness (state coverage, accessibility, readability) is owned by [frontend objective/style classification](../build/design-intake.md#15-objective-gates-vs-style-samples) and stays STRICT/DEFAULT.
