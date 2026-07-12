---
name: cxc-dev-uiux-design
description: "MUST USE for UI/UX direction and design judgment — vague visual briefs, onboarding, empty/error/loading states, layout vocabulary, typography breaks, favicons, logos, and brand identity choices. Pairs with cxc-dev-frontend: this skill decides the design direction, then load cxc-dev-frontend to implement it. Triggers: make it look good, modern, clean, aesthetic, onboarding, empty state, error state, favicon, logo, design system, 깔끔하게, 모던하게, 감성적으로."
metadata:
  last-verified: "2026-07-02"
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
For anti-slop detection and banned patterns, defer to `dev-frontend/references/core/anti-slop.md`, especially the 2026 gradient budget and one-note theme bans.

**Emoji ban (stub):** no emoji as UI visual elements (STRICT). Canonical rule, scope, and exemptions: `dev-frontend` §5 / `dev-frontend/references/core/anti-slop.md § Emoji Slop`.

**Role separation:** This skill owns design judgment: intent discovery, information architecture, UX state meaning, typography/color/layout direction, product personality, brand vocabulary, anti-slop pattern judgment, and design-system decisions. `dev-frontend` owns implementation: HTML/CSS/components, responsive mechanics, accessibility wiring, runtime behavior, and rendered verification. After choosing the design direction here, load `dev-frontend` for concrete implementation.

**External/current design evidence:** For live product-reference claims, current
design-system docs, browser API behavior, accessibility guidance that may have
changed, or browser-rendered source evidence, read the active `search` skill and
follow its query-rewrite, source-fetch, and evidence-status rules. Use browser
fetch/open/text/get-dom/snapshot only after candidate URLs exist.

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.

> **Rule class note (UX-STYLE-01):** Everything in this skill that expresses taste —
> product personalities, design-isms, preset tokens, aesthetic vocabulary — is
> `STYLE_SAMPLE`: examples to draw from, never universal requirements. Objective UX
> correctness (state coverage, accessibility, readability) is owned by `dev-frontend`
> §1.5 and stays STRICT/DEFAULT.

## Modular References

| File | When to Read | What It Covers |
|------|-------------|----------------|
| `references/design-isms.md` | User names a style/movement | 15 design movements with CSS signatures, incl. Liquid Glass + Liquid Editorial default kit (2025-2026) + AI Serif Editorial + Organic Capsule (verified 2026-07-09) |
| `references/design-read-example.md` | Learning or reviewing Design Read format | Filled-in Design Read + dial setting example |
| `references/product-personalities.md` | User references a product | 10 product DNA profiles with exact tokens, incl. 2026 AI-product pastel + OpenAI warm-sans organic + Anthropic serif bookish |
| `references/layout-macrostructures.md` | Choosing page/component layout | Component layouts + page-level compositions |
| `references/ux-states.md` | Building any stateful UI | Onboarding, empty, error, loading, progressive disclosure |
| `references/color-system.md` | Generating colors/palette | OKLCH-based palette generation, hue budget, tinted neutrals, dark mode, accessibility |
| `references/design-system-bootstrap.md` | New project / design system | Token architecture, component hierarchy, **DESIGN.md format** (google-labs-code/design.md) |
| `references/responsive-nav.md` | Responsive or navigation work | Breakpoints, container queries, nav patterns by density |
| `references/ux-preflight.md` | **Before delivery** | UX state verification checklist |
| `references/typography-line-breaks.md` | **Always for text-heavy UI** | Heading break quality, **short descriptor category** (hero subtitle, card desc — use `balance` not `pretty`), orphan prevention, `ch` units, Korean orphan criteria, `-webkit-line-clamp` conflict |
| `references/favicon-logo.md` | **Favicon, product logo, or brand identity work** | Favicon file set, SVG dark mode, logo in nav/footer, dark mode variants, OG images, brand tokens, common mistakes |
| `references/logo-trust-sections.md` | Integration/partner/client logos | Marquee vs grid decision, anti-patterns, grayscale treatment, placement |
| `references/visual-hierarchy.md` | Any layout / composition decision | 6 levers: size scale, weight contrast, color emphasis, spacing, position, density |
| `references/form-patterns.md` | Forms, wizards, auth, file upload | Validation timing, multi-step, password UX, file upload, search/filter |
| `references/mobile-native-ux.md` | Native mobile app UX decisions | iOS HIG vs Material 3, gestures, deep linking, Korean privacy, app store UX |
| `references/intent-discovery-ladder.md` | UX-INTENT-01 optional deepening (Steps 1-6) | Mood/lightness/density/shape/viewport/reference ladder, vague request disambiguation |
| `references/anti-rationalization.md` | **Before C-phase verification** | Agent-shortcut excuse/rebuttal table (UX-ANTI-RATIONAL-01) |
| `references/korean-design-vocabulary.md` | Korean design briefs or Korean-first UI | Korean descriptor → CSS token translation, quick-match table, font selection guidelines |

---

## Lazy-User Gate (UX-LAZY-01, DEFAULT — ponytail discipline applied to UX)

Design for the cognitively frugal user: users don't read, they scan; they satisfice;
they will trade choice for one obvious next action. Before shipping any user-facing
decision point — option, setting, step, confirmation, input field, mode — justify its
existence the ponytail way, in order:

1. **Do nothing**: can a correct default remove this decision entirely?
2. **Delete**: does the step/field earn its completion-rate cost (Hick's law)?
3. **Absorb**: can the system take the complexity instead of the user (Tesler's law)?
4. **Demote**: still needed for some users → progressive disclosure, never a top-level fork.

Every screen has ONE primary action. Surface-conditional: consumer/one-shot flows
minimize DECISIONS; repeated-work tools (dense profiles) minimize repeated MOTIONS —
collapsing expert controls into wizards is the inverse failure. STRICT exemptions:
destructive/irreversible actions, consent/privacy/legal, payments confirmation, and
accessibility affordances are never collapsed into magic defaults.

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

## 1. User Intent Discovery Protocol

When the user's design request is vague ("깔끔하게 해줘", "모던하게", "just make it look good"), do not produce generic output. Run the compact ambiguity flow (UX-INTENT-01):
1. Produce the Design Read from §2 using available signals.
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
decided 2026-07-07 from Tier-2 trend research — see `references/design-isms.md`
§1.13 for the full signature):

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
  `references/color-system.md`).

Domain gate (STRICT): dashboards, admin, ops, finance, gov, B2B repeated-work
tools NEVER receive this kit by default — "fancy" never overrides domain
correctness (§ IA Chooser + `dev-frontend` product-density profiles).

**Optional deepening:** use the ladder below only when the first fork fails or the user explicitly wants guided exploration.
- Use binary/ternary choices, not open-ended questions.
- Reference known products — users recognize what they want faster than they articulate it.
- If the diagram skill is available, offer: "참고로 스타일 비교를 다이어그램으로 보여드릴 수도 있어요."
- If the user names a specific product reference, skip remaining steps and map directly via `references/product-personalities.md`.

For the full 6-step guided ladder (Mood → Lightness → Density → Shape → Viewport →
Reference) and vague-request disambiguation table, read
`references/intent-discovery-ladder.md`. Load it only when the compact flow above
needs deeper guided exploration.

---

## 2. Design Read (MANDATORY for new pages, components, or layouts. Optional for ≤5-line patches — see dev §0.1 Patch Fast-Path.)

Before generating ANY frontend code, produce a Design Read. If the project has a `DESIGN.md` file, read it first — its tokens and prose override everything below.

Inspect provided visual references with `view_image` before writing the Design
Read. Asset production and rendered verification are owned by `dev-frontend`
and `cxc-dev-testing` respectively.

### Output format (mini DESIGN.md)

Filled-in example: `references/design-read-example.md`.

```yaml
---
name: <project-name>
colors:
  primary: "<hex>"
  accent: "<hex>"
  background: "<hex>"
typography:
  heading: { fontFamily: <font>, fontSize: <size> }
  body: { fontFamily: <font>, fontSize: <size> }
---
```

Reading this as: <page kind> for <audience>, with a <vibe> language.
<1-2 sentences: specific reference, not adjectives. "1970s lecture handout" > "modern and clean">

Do's: <context-specific positive from brief>
Don'ts: <context-specific ban from brief>

### Signals to read
1. Page kind — landing (SaaS/consumer/agency/event), portfolio, redesign, editorial, app UI, tool UI
2. Vibe words — what the user said or implied
3. Reference signals — URLs, screenshots, brands named
4. Audience — B2B procurement vs design-conscious consumer vs recruiter
5. Existing brand assets — logo, color, type, photography
6. Quiet constraints — accessibility-first, public-sector, regulated, kids

### Dial Setting (MANDATORY — immediately after Design Read)

From the Design Read, derive and declare three dials before any code:

```
DESIGN_VARIANCE: <1-10>
MOTION_INTENSITY: <1-10>
Product density profile: <D1-D8> (see dev-frontend/references/core/product-density.md)
Reasoning: <one sentence explaining why these values match the brief>
```

Inference rules:
- Corporate/gov/utility → VARIANCE 2-4, MOTION 1-3, density D2-D3
- Marketing/landing → VARIANCE 4-7, MOTION 5-7 (scroll-motion floor applies, FE-MOTION-BUCKET-01), density D2-D3
- Creative/portfolio/editorial → VARIANCE 6-9, MOTION 5-7 (landing-bucket scroll floor applies, FE-MOTION-BUCKET-01), density D1-D3
- Dashboard/SaaS/admin → VARIANCE 2-4, MOTION 1-2 (scroll-driven = 0), density D4-D5
- "Complex" in brief → increase density profile (functional depth), NOT VARIANCE or MOTION
- "Simple" in brief → decrease all three proportionally

"복잡하다" = high DESIGN_VARIANCE is WRONG. Complexity means more features/data/flows, not more visual tricks (carousels, parallax, animations).

### Dial Presets (UX-DIAL-PRESET-01, STYLE_SAMPLE)

Source: taste-skill v2 (62k stars). Exact tuples for common use cases.
Presets are authoritative specializations that may exceed the inference ranges
above (e.g. Agency motion 8 exceeds the general landing 5-7 range). When a
preset exists for the exact use case, use it directly; adjust from Design Read.

| Use case | V | M | D | Notes |
|----------|---|---|---|-------|
| Landing (SaaS mainstream) | 7 | 6 | 4 | |
| Landing (Agency/creative) | 9 | 8 | 3 | |
| Landing (Premium consumer) | 7 | 6 | 3 | |
| Portfolio (Designer/studio) | 8 | 7 | 3 | |
| Portfolio (Developer) | 6 | 5 | 4 | |
| Editorial / Blog | 6 | 4 | 3 | |
| Public-sector service | 3 | 2 | 4 | |
| Dashboard / SaaS admin | 3 | 2 | 5 | |
| Finance / ops | 2 | 1 | 7 | density D6-D7 |
| Game | 8 | 7 | 4 | domain-specific |
| Korean consumer app | 5 | 4 | 5 | CJK density |

**Redesign arithmetic** (DEFAULT):
- Preserve redesign: V = match existing, M = match + 1, D = match existing
- Overhaul redesign: V = existing + 2, M = existing + 2, D = match existing
- "Complex" in brief: increase density (D), NOT variance or motion
- "Simple" in brief: decrease variance and motion; density stays or increases

Score existing surface using preset rules. Clamp all arithmetic to 1-10 / D1-D8.
Example: existing SaaS 7/6/4 preserve -> 7/7/4; overhaul -> 9/8/4.

**Audience-first ownership** (UX-AUDIENCE-01, DEFAULT):
The audience picks the aesthetic, not the model's taste. When audience signal
and model preference conflict, audience wins. The dial presets above encode
audience expectations — a public-sector audience expects trust-first restraint;
an agency audience expects high variance. Override with stated rationale only.

**Motion honesty** (FE-MOTION-HONESTY-01, DEFAULT, pointer to motion.md):
If MOTION_INTENSITY > 4, the shipped page must actually move. A declared dial
without matching motion output is a lie. See dev-frontend/references/core/motion.md.

### Anti-Default Discipline
Do not default to: warm beige backgrounds, centered hero, three equal feature cards, generic glassmorphism, Inter + slate-900, card-based everything. These are LLM defaults. Reach past them BASED ON the design read.
When no brief exists at all, the sanctioned replacement for these generic
defaults is the named kit in §1 UX-DEFAULT-ISM-01 — deliberate, domain-gated,
and stated as an assumption; it is not an exemption from this discipline.

If the brief is ambiguous, follow UX-INTENT-01: Design Read → ONE clarifying fork → proceed.

### DESIGN.md persistence
If the project needs persistent design tokens across sessions, save the Design Read as a full `DESIGN.md` in the project root. Format spec: `references/design-system-bootstrap.md § DESIGN.md Format`.

---

## 2.5 Visual Concept Exploration (UX-CONCEPT-GEN-01, DEFAULT)

Before implementing a C2+ new/redesigned expressive or brand-visible UI
surface, generate visual concept candidates BEFORE frontend code. C0/C1
patches and utility CRUD/dashboard screens are exempt.

### Concept Decision Tree

1. Is the surface C2+ and expressive or brand-visible?
   - No: skip concept generation and state why.
   - Yes: continue.

2. Probe ima2 availability: `ima2 status`, attempt `ima2 serve` if
   down, `$imagegen` only as true fallback. State the chosen
   generator.

### Compact ima2 Recipe

Canonical command:
`ima2 gen "<detailed prompt>" --quality high --size 1536x1024 -o ./concepts/01.png`

- Add a reference image with `--ref ./reference.png`.
- Every prompt specifies surface, audience, composition, palette, typography,
  material, and constraints.
- Batch one prompt with `ima2 gen -n 5 -d ./concepts/`.
- For distinct prompts, launch `ima2 gen ... &` in parallel and monitor with
  `ima2 ps --json`.
- Fall back to `$imagegen` only after `ima2 status`, `ima2 serve`, and the
  subsequent status re-check all fail.

3. Is the direction already concrete (named ism, reference screenshot,
   finished design, governing design system)?
   - Yes: lock that direction → generate 3-5 contextual execution
     variants.
   - No: use UX-IMAGE-FIRST-01 → generate 3-5 distinct ism directions,
     compare, lock one direction, then refine with 2-4 variants.

### Image-First Direction Discovery (UX-IMAGE-FIRST-01, DEFAULT)

Fires when the brief has no named ism, product reference, or concrete design
direction. Generate 5 maximally different ism directions, varying layout
family, palette, type stance, material, and hero grammar. Every prompt must be
detailed enough to reconstruct the layout. Compare candidates on hero
composition, palette coherence, typographic voice, and density fit. Pick the
winning ISM, not the winning image, then refine it with 2-4 variants.
Interactive mode: the user picks the ism. Autonomous mode: state the selection
reasoning in the devlog.

4. Evaluate candidates on: domain/audience fit, hero/composition,
   palette coherence, typographic voice, density and context fit.

5. SYNTHESIZE — do not pick one winner. Build an element ledger: for
   each token (palette, composition, type, material, signature visual),
   note WHICH variant did it best and WHY. Use FE-ASSET-SELECT-01
   scorecard as rubric.

| Token | Best variant | Rationale | DESIGN.md value |
|-------|-------------|-----------|-----------------|
| Palette | #3 | warmest coherence | primary: #2c2420, accent: #c4956a |
| Hero | #1 | strongest asymmetric composition | editorial offset |
| Type | #2 | best grotesk weight contrast | heading: 300, body: 400 |

Synthesis IS the direction lock: it assembles the best tokens from multiple candidates into one coherent DESIGN.md. The lock is the assembled token set, not any single render.

6. Lock DESIGN.md from the synthesis. Each token cites its source
   variant. Interactive mode: show candidates + synthesis for
   confirmation. Autonomous mode: record selection rationale and
   proceed.

Generation mechanics,
batching (FE-ASSET-PARALLEL-01),
cutout preparation,
hero constraints (FE-HERO-SPLIT-01),
and asset selection are owned by
`dev-frontend/references/core/asset-requirements.md`.

Precedence: UX-CONCEPT-GEN-01 governs PRE-CODE concept stage. After
code exists, `iterative-design.md` governs POST-CODE rounds.
`prototype-variants.md` runs AFTER the concept lock for structural
variants.

Skip (state the skip): a finished implementation-ready design skips concept
generation entirely. A reference screenshot or style direction requires
contextual execution variants rather than a skip. A governing design system
skips generation unless a new brand-visible composition remains unresolved.
C0/C1 patches and utility CRUD/dashboard surfaces also skip. Generator
unavailability is a skip only after the complete fallback sequence above.
---

## 2.6 Asset Production Handoff (UX-ASSET-GEN-01)

After concept direction is locked,
follow `dev-frontend/references/core/asset-requirements.md` for asset
generation, background removal (FE-ASSET-BG-01), batching, selection,
and integration.

Concept images are composition/style evidence,
not shipped assets.
Production assets are generated after concept lock
and must pass integration requirements
(`dev-frontend` `asset-requirements.md`).

## 3. Korean Design Vocabulary + Quick-Match + Font Selection

Korean descriptor → CSS token translation, quick-match table (user word → starting
point), clarifying questions per term, and font selection guidelines (UX-TYPE-01,
Pretendard for Korean-first, Inter avoidance) are extracted to
`references/korean-design-vocabulary.md`. Read it when the brief uses Korean
aesthetic words or when choosing fonts for Korean-first UI.
