## 1. User Intent Discovery Protocol

When the user's design request is vague ("깔끔하게 해줘", "모던하게", "just make it look good"), do not produce generic output. Run the compact ambiguity flow (UX-INTENT-01):
1. Produce the Design Read from `design-read.md` using available signals.
2. If one decision still blocks the direction, ask ONE best clarifying fork with binary/ternary choices.
3. Proceed from the answer; if the user does not answer and the task can continue, choose the most domain-correct default and state the assumption. On EXPRESSIVE surfaces (landing/consumer/creative/AI-product), that default is the No-Brief Default Direction below (UX-DEFAULT-ISM-01); quiet surfaces keep quiet domain-correct defaults.

> Skip this section if the user provided explicit design specs or this is a ≤5-line patch.

### No-Brief Default Direction (UX-DEFAULT-ISM-01, DEFAULT — kit content STYLE_SAMPLE)

This is the UX-INTENT-01 step-3 FALLBACK, never a bypass: it fires only after
the Design Read and after the one blocking fork is resolved or unanswered, and
the applied direction is ALWAYS stated as an explicit assumption in the
deliverable. A named, specific, domain-gated direction replaces generic LLM
defaults; it must NOT reintroduce generic glassmorphism / centered-card /
beige-default taste under a new label.

Default kit for expressive surfaces: **Liquid Editorial** (2026 composite,
decided 2026-07-07 from Tier-2 trend research — see `design-isms.md`
§1.14 for the full signature):

- Structure: type-led editorial composition (oversized authored headline
  scale, grotesk default, serif display only with editorial rationale per
  UX-TYPE-01), tactile/photographic texture over flat gradient washes,
  asymmetric content-weighted layout.
- Material accent: Liquid Glass or near-opaque pill chrome ONLY on floating
  functional layers (nav/toolbars/chip clusters); pill-chip content units;
  content layer stays solid (`dev-frontend` FE-LIQUID-LAYER-01). Children
  inside pill chrome carry no capsule borders/outlines at rest — emphasis via
  fills/tints only (`dev-frontend` FE-PILL-NEST-01); top-bar scroll states per
  `dev-frontend` `top-bar.md` FE-TOPBAR-STATE-01.
- Motion: feedback baseline + one signature moment (pointer-proximity chips or
  scroll-driven reveal) + >= 1 supporting scroll reveal on landing-bucket
  surfaces (floor 2, ceiling ~4 — `dev-frontend` `motion.md`
  FE-MOTION-BUCKET-01); feedback-only elsewhere, per motion domain gates.
- Color: OKLCH-derived single accent + tinted neutrals (hue budget,
  `color-system.md`).

Domain gate (STRICT): dashboards, admin, ops, finance, gov, B2B repeated-work
tools NEVER receive this kit by default — "fancy" never overrides domain
correctness (§ IA Chooser + `dev-frontend` product-density profiles).

**Optional deepening:** use the ladder below only when the first fork fails or the user explicitly wants guided exploration.
- Use binary/ternary choices, not open-ended questions.
- Reference known products — users recognize what they want faster than they articulate it.
- If the diagram skill is available, offer: "참고로 스타일 비교를 다이어그램으로 보여드릴 수도 있어요."
- If the user names a specific product reference, skip remaining steps and map directly via `product-personalities.md`.

For the full 6-step guided ladder (Mood → Lightness → Density → Shape → Viewport →
Reference) and vague-request disambiguation table, read
`intent-discovery-ladder.md`. Load it only when the compact flow above
needs deeper guided exploration.

---
