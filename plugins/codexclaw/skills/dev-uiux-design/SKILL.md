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
  content layer stays solid (`dev-frontend` FE-LIQUID-LAYER-01).
- Motion: feedback baseline + exactly ONE signature moment
  (pointer-proximity chips or scroll-driven reveal), per motion domain gates.
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

### Step 1 — Mood

Ask: "전체적인 분위기가 어떤 느낌이면 좋을까요?" / "What overall feeling should the product have?"

| Option | Signals | Product References |
|--------|---------|-------------------|
| 전문적/신뢰감 (Professional) | swiss, flat, restrained | Linear, Vercel, GitHub |
| 따뜻한/친근한 (Warm/Friendly) | rounded, warm-neutrals, illustrations | Notion, Airbnb, Toss |
| 고급스러운/세련된 (Premium) | generous-whitespace, thin-type, restrained-color | Apple, Stripe, Aesop |
| 재미있는/활기찬 (Fun/Energetic) | bright-colors, playful-shapes, bold-type | Figma, Discord |
| 대담한/독특한 (Bold/Distinctive) | brutalism, asymmetry, experimental | Gumroad, Nothing |

### Step 2 — Lightness

Ask: "밝은 화면이 좋으신가요, 어두운 화면이 좋으신가요?" / "Light or dark background?"

| Option | CSS |
|--------|-----|
| 밝은 배경 (Light) | `bg-white text-gray-900` |
| 어두운 배경 (Dark) | `bg-gray-950 text-gray-100` |
| 둘 다 (Both / auto) | `prefers-color-scheme` aware |

### Step 3 — Density

Ask: "화면에 정보가 많이 보이는 게 좋으신가요, 여유롭게 보이는 게 좋으신가요?" / "Dense or spacious?"

| Option | VISUAL_DENSITY | Tokens |
|--------|---------------|--------|
| 빽빽하게 (Dense) | 8–10 | `text-sm py-1 px-2 gap-1` |
| 보통 (Normal) | 4–7 | `text-base py-3 px-4 gap-4` |
| 여유롭게 (Spacious) | 1–3 | `text-lg py-8 px-8 gap-8` |

### Step 4 — Shape

Ask: "모서리가 각진 느낌이 좋으신가요, 둥근 느낌이 좋으신가요?" / "Sharp or rounded?"

| Option | CSS | Signals |
|--------|-----|---------|
| 각진 (Sharp) | `rounded-none` / 0–2px | Vercel, brutalism, swiss |
| 살짝 둥근 (Slightly rounded) | `rounded-md` / 6–8px | Linear, Notion, material |
| 많이 둥근 (Very rounded) | `rounded-2xl` / 16–24px | Figma, iOS, Toss |

### Step 5 — Viewport Priority

Ask: "주로 어떤 화면에서 볼 건가요?" / "What's the primary viewing device?"

| Option | Responsive Strategy | Key Constraint |
|--------|-------------------|----------------|
| 데스크탑 위주 (Desktop-first) | Desktop layout → tablet → mobile collapse | Data density OK, hover interactions OK |
| 모바일 위주 (Mobile-first) | Mobile layout → tablet → desktop expansion | Thumb zone, touch targets, minimal density |
| 둘 다 중요 (Both equally) | Design mobile AND desktop as separate compositions, not one adapted from the other | Most work — section order/composition may differ |

Cross-ref: `references/responsive-nav.md` for canonical breakpoints and container query patterns, `dev-frontend/references/core/mobile-ux.md` for mobile-specific composition rules.

### Step 6 — Reference

Ask: "혹시 '이런 느낌이면 좋겠다' 하는 사이트나 앱이 있으신가요?" / "Any website or app that feels like what you want?"

This single question often resolves all ambiguity. If the user names a product, map it via `references/product-personalities.md`.

### Vague Request Disambiguation

When the user gives feedback without specifics, translate:

| User says | Action |
|-----------|--------|
| "더 좋게" / "make it better" | Ask: "레이아웃? 색상? 타이포? 여백?" — identify the dimension |
| "더 전문적으로" / "more professional" | Increase whitespace, reduce color count to 2–3, tighten grid alignment |
| "더 모던하게" / "more modern" | Negative letter-spacing on headings, offer dark mode, reduce radius to 8px |
| "더 재미있게" / "more exciting" | Add one bold accent color, increase type contrast, add micro-animation on hover |
| "너무 심심해" / "too boring" | Add asymmetric layout, introduce one unexpected element, vary section rhythm |
| "너무 복잡해" / "too busy" | Reduce element count, increase whitespace, limit to 2 colors |

---

## 2. Design Read (MANDATORY for new pages, components, or layouts. Optional for ≤5-line patches — see dev §0.1 Patch Fast-Path.)

Before generating ANY frontend code, produce a Design Read. If the project has a `DESIGN.md` file, read it first — its tokens and prose override everything below.

Native tool support (structure/60): read visual references — existing screens, competitor
captures, design exports — into context with `view_image` before writing the Design Read;
produce needed bitmap assets (icons, illustrations, mock imagery) with the native
`imagegen` tool (`$imagegen`) rather than leaving placeholder boxes; and verify the built
result visually per `cxc-dev-testing` §4.6 (browser screenshot -> `view_image`).

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
- Marketing/landing → VARIANCE 4-7, MOTION 3-5, density D2-D3
- Creative/portfolio/editorial → VARIANCE 6-9, MOTION 4-7, density D1-D3
- Dashboard/SaaS/admin → VARIANCE 2-4, MOTION 1-2, density D4-D5
- "Complex" in brief → increase density profile (functional depth), NOT VARIANCE or MOTION
- "Simple" in brief → decrease all three proportionally

"복잡하다" = high DESIGN_VARIANCE is WRONG. Complexity means more features/data/flows, not more visual tricks (carousels, parallax, animations).

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

Before implementing a NEW page, site, or major redesign (C2+ UI surface with open
design direction), when `ima2` is available (`ima2 status` confirms a running
server), generate design candidates BEFORE any frontend code:

1. **Lock ONE concept, write 5 maximally specific prompts for it.** Decide the
   single design concept first (domain, audience, palette family, hero grammar,
   density, signature visual). Then write 5 prompts that all express that SAME
   concept but vary the execution: emphasis points, fine layout choices, accent
   treatment, type nuance, secondary-section hints. Distinct directions were the
   old UX-VARIANT-OLD spec; identical-concept varianting is the point — you are
   sourcing the best EXECUTION of one shared idea, not choosing among 5 unrelated
   designs. Each prompt still pins: domain + audience, layout family and hero
   grammar (FE-HERO-SPLIT-01 applies — no split hero unless the user asked),
   palette with concrete hues (color-system bans apply), typography direction,
   and density. Vague prompts ("modern clean landing page") are banned: a reader
   must be able to reconstruct the layout from the prompt alone.
2. **Generate as a batch.** Run `ima2 gen <prompt> -n 1 -o <path>` five times
   concurrently (or `ima2 gen <prompt> -n 5 -d <dir>` for a single request);
   monitor with `ima2 ps --json`.
3. **Read all 5 side by side and SYNTHESIZE — do not pick a single winner.**
   Each render usually nails some elements and fumbles others. The output is
   not "which variant is best"; it is "which elements are best across all of
   them." Build an element ledger: for palette, hero composition, type
   treatment, signature visual, stat row, bottom-section hint, and every other
   design token, note WHICH variant did it best and WHY. Show the user all 5
   images (markdown image tags with absolute paths) with the synthesis ledger
   and let them confirm/adjust the per-element picks; in autonomous/goal mode
   make the picks with stated reasoning and record it.
4. **The SYNTHESIZED DESIGN.md becomes the Design Read basis.** Extract palette,
   layout family, type direction, and every other token from the element ledger
   (each token citing its source variant) into DESIGN.md and implement from that.
   Never pixel-copy any single render (generated text/logos are unreliable) — the
   synthesis is a direction lock assembled from the best of five, not one asset.

Skip (state the skip): user already supplied a concrete design/reference/mockup,
an existing design system governs the surface, C0/C1 patches, or `ima2` is
unavailable — then fall back to the text-only Design Read.
---

## 3. Korean Request Translation

Map common Korean design descriptors to concrete tokens. When the user uses these words, translate before implementing.

| Korean | Literal | CSS/Token Translation |
|--------|---------|----------------------|
| 깔끔하게 | cleanly | Generous whitespace (24-48px gaps), strict grid, max 2-3 colors, saturation < 60%, 1px borders or none, 4-8px radius, single font, no/subtle shadows |
| 모던하게 | modern | Geometric sans-serif (Geist/Outfit), negative letter-spacing on headings, dark mode or high-contrast light, 8-16px radius, spring micro-interactions |
| 고급스럽게 | luxurious | Very generous whitespace (48-96px padding), thin weights (300-400), refined sans by default, serif only with editorial/luxury rationale, low-saturation palette, slow animations (800ms+), 0-4px radius |
| 심플하게 | simply | Max 3-4 element types per screen, 1-2 colors, single font, 2-3 size steps, hidden/minimal navigation, zero decoration |
| 트렌디하게 | trendy | Glassmorphism, bento grid, gradient mesh, variable fonts — ask for a reference site |
| 따뜻하게 | warmly | Warm hue range (stone/amber/orange), 12-20px radius, warm-tinted shadows rgba(180,140,100,0.1), rounded or humanist sans |
| 차가운 | cold/cool | Cool grays (slate/zinc), blue-tinted whites, geometric sans, thin weights, 0-8px radius |
| 감성적으로 | emotionally | Editorial/lifestyle, serif display + sans body, muted/pastel colors, generous line-height, photography-heavy |

**Clarifying questions per term:**
- 깔끔: "Notion처럼 따뜻한 깔끔함인지, Vercel처럼 차가운 깔끔함인지요?"
- 모던: "다크 모드 + 날카로움(Linear)인지, 화이트 + 미니멀(Vercel)인지요?"
- 고급: "브랜드 고급감(Apple/Stripe)인지, 패션 럭셔리(Art Deco)인지요?"
- 심플: "기능이 적은 건지, 기능은 많지만 화면이 심플해 보이길 원하는 건지요?"

---

## 4. Quick-Match Table

Rapid lookup: user word → concrete starting point.

| User (KO) | User (EN) | Start From | Dark? | Radius | Density | Font |
|------------|-----------|------------|-------|--------|---------|------|
| 깔끔하게 | Clean | Notion or Vercel | No | 8px | 4–7 | Geist / Pretendard |
| 모던하게 | Modern | Linear or Vercel | Yes | 6px | 4–7 | Geist / Outfit |
| 고급스럽게 | Premium | Apple or Stripe | Either | 0–4px | 1–3 | Satoshi / system thin-300 |
| 심플하게 | Simple | Vercel | Either | 0px | 1–3 | Geist |
| 따뜻하게 | Warm | Notion or Toss | No | 12px | 4–7 | Pretendard / Cabinet Grotesk |
| 재미있게 | Fun | Figma | No | 16px+ | 4–7 | Custom grotesque |
| 전문적으로 | Professional | Linear or GitHub | Either | 6px | 4–7 | Geist / Outfit |
| 대담하게 | Bold | Neobrutalism | No | 0px | 4–7 | Black 900 |
| 감성적으로 | Aesthetic | Editorial | No | 0–4px | 1–3 | Serif display |
| 트렌디하게 | Trendy | Ask for reference | Either | 12px | 4–7 | Variable font |

### Font Selection Guidelines

- **Typography stance (UX-TYPE-01)**: sans by default. Use serif only when the brief, brand system, or stated editorial/premium rationale supports it; do not inject one serif word into an otherwise sans headline for spice. When serif is justified (AI-product/editorial/research/trust surfaces), use the three-role system — display serif at light weights 330-400 + sans UI + mono accent — never as a bare AI-premium shortcut ("tasteslop"); gates in `dev-frontend` `aesthetics.md § Serif Discipline`.
- **Primary default**: Geist (modern SaaS, Vercel ecosystem)
- **Korean-first**: Pretendard (한글 최적화, Toss/당근 등 국내 서비스 표준)
- **Warm/editorial**: Outfit or Cabinet Grotesk
- **Premium/luxury**: Satoshi or system thin weights
- **Korean serif display**: MaruBuri (Naver 명조/부리) 400-600 for editorial Hangul headlines, paired with Pretendard UI — see `dev-frontend` `korea-2026.md § Korean Serif / Myeongjo Display`
- **Avoid defaulting to Inter** (DEFAULT) — it is the #1 AI-generated UI tell. Use it when the user explicitly requests it or the project already uses it.
