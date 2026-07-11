# Top-Bar Grammar + Liquid Pill + Asset-First Motion — Skill Upgrade Interview

Date: 2026-07-09
Phase: I (Interview) — session `019f4754-031e-7fc0-b53e-cf146a123cee`
Targets: `plugins/codexclaw/skills/dev-frontend/` + `plugins/codexclaw/skills/dev-uiux-design/`
Related research (same day): `_plan/260709_opaque_gradient_discipline/`, `_plan/260709_design_grammar_research/`

---

## Trigger

User wants to co-improve the two design skills, starting with a canonical
**top bar (상단 바) definition**. Seven directives extracted from the brief:

| # | Directive (user's words, condensed) | Nature |
|---|--------------------------------------|--------|
| D1 | 상단 바 정의를 먼저 — top-bar grammar comes first | scope/order |
| D2 | `ima2 --help` 후 이미지 시안/목업 생성을 **1급 옵션**으로 — once a concept is locked | workflow |
| D3 | Liquid = **pill 스타일**; 스크롤로 내려올 때 리퀴드여도 **매우 불투명** — 시각요소가 잘 보여야 함. "리퀴드인 척"하되 불투명도를 높이는 방향으로 재정의 | material definition |
| D4 | 복잡한 디자인이어도 컴포넌트는 미니멀 — **pill-in-pill 금지** | composition rule |
| D5 | 다른 웹을 베낄 때 **HTML + 에셋도 가져와보기** | reference workflow |
| D6 | **스크롤 모션 최소 2개 이상** 목표 | motion floor |
| D7 | 그라데이션보다 **이미지/비디오 동적 모션** + **실제 SVG 로고** 중요 | asset priority |

## Repo State Audit (what already exists)

- **D2 (ima2-first)**: `dev-uiux-design` §2.5 `UX-CONCEPT-GEN-01` already mandates
  5-variant `ima2 gen` + synthesis for NEW pages/sites/major redesigns. `ima2 --help`
  verified working (v2.0.5: `gen -n N`, `multimode`, `edit`, `video` via Grok, `ps --json`).
  Gap: component-level surfaces (e.g. a top bar) are not covered; "when available"
  wording is soft; user wants 1st-class rank.
- **D3 (liquid pill)**: `dev-frontend/references/core/liquid-glass.md` already has the
  near-opaque aside.com pattern (`.pill-chip` at `rgb(255 255 255 / 0.92)`, zero
  backdrop-filter) but as an *alternative*; the DEFAULT `.glass-regular` recipe is
  `color-mix(... 55%, transparent)` — much more transparent than the user's direction.
  No scroll-state definition (top-of-page vs scrolled) exists anywhere.
- **D1 (top bar)**: no canonical top-bar/nav-bar grammar file. `dev-uiux-design`
  `responsive-nav.md` covers IA/breakpoints, not the material/geometry/scroll contract.
- **D4 (pill-in-pill)**: liquid-glass.md has a radius-tier scale (8/12/16-20/9999) and
  "do not mix pill CTA with 4px input in same cluster", but **no pill-in-pill ban**.
- **D5 (HTML+asset capture)**: no reference-site cloning workflow exists.
  `brand-asset-sourcing.md` covers logo sourcing (Simple Icons/SVGL/press kits) + legal.
  In-app browser runtime exposes `pageAssets` tab capability (list + bundle observed
  assets) — a natural mechanism to codify.
- **D6 (scroll motion >= 2)**: `motion.md` has CSS scroll-driven timelines, view()
  reveals, video scrub, horizontal scrolljack gates. But current doctrine is
  "exactly ONE signature moment" (`UX-DEFAULT-ISM-01` motion clause) — a floor of 2+
  scroll motions contradicts it as written.
- **D7 (image/video > gradient)**: `260709_opaque_gradient_discipline` research already
  demotes decorative gradients; `asset-requirements.md` requires real assets;
  `brand-asset-sourcing.md` requires real SVG logos. Gap: no explicit "moving
  image/video beats static gradient wash" priority rule; no perf reconciliation
  (video hero vs `performance-budget.md` LCP gate).

## Contradiction Scan (round 1, inline)

| ID | Severity | Contradiction |
|----|----------|---------------|
| C1 | HIGH | D6 (>= 2 scroll motions) vs `UX-DEFAULT-ISM-01` "exactly ONE signature moment" and MOTION_INTENSITY 1-3 for quiet surfaces. Scope unknown: all surfaces or expressive only? |
| C2 | HIGH | D3 redefines liquid material: current default recipe is 55% translucent; user wants near-opaque. Unknown: is the top-of-page resting state allowed to be more transparent (scroll-adaptive), or always near-opaque? Does blur stay for the "liquid인 척" feel? |
| C3 | HIGH | D4 pill-in-pill ban vs the most common pill-nav pattern (pill container + pill CTA inside). Unknown: absolute ban, or one-CTA exception, or radius-step rule (child radius < parent)? |
| C4 | MED | D5 asset capture vs legal guidance in `brand-asset-sourcing.md`: captured third-party assets for private mockups/analysis vs shipping them. Default assumption: capture for reference/mockup only; production assets re-sourced/licensed. |
| C5 | MED | D7 video motion vs performance budget (LCP <= 2.5s, bundle gates). Default assumption: poster-image LCP + lazy video, `prefers-reduced-motion` fallback to still image. |
| C6 | LOW | D2 "1급 옵션" vs existing skip conditions (existing design system, C0/C1). Default assumption: keep skips, extend mandate to component-level concepts (top bar included) and harden wording. |

## Contradiction Scan (round 2, 3 Mind lenses, post-answer rescan)

3 read-only Minds dispatched (Sartre: material ontology / Schrodinger: motion+perf
constraints / Mencius: workflow+success criteria). 34 contradictions, 14 HIGH.
Full returns in agent transcript; triage below.

### HIGH → escalated to user (round 2 questions)

- **S5+S4** at-rest filled elements inside the pill bar: is a solid-fill pill CTA
  (borderless) allowed at rest? Is `aria-current` persistent fill "active" (allowed)
  or "at rest" (banned)? User's literal wording was "테두리를 금지" (borders).
- **M1+M2+M7** exact motion-tier map: middle tiers (consumer app/education/community)
  are orphaned by a binary landing-vs-dashboard boundary; "ONE signature moment"
  doctrine must be rewritten to fit the >= 2 floor; MOTION dial inference (landing 3-5)
  vs scroll-driven level gates (7-8+) must be reconciled by moving one of them.
- **W4** component-scale mockup shape: 5-variant page schema (hero grammar, stat row...)
  is incoherent for a ~64px bar; need a component-level prompt/ledger schema or a
  context-strip approach (bar rendered inside its top-viewport context).

### HIGH → resolved as proposed defaults (recorded, revisable)

- **S1/S2** at-top transparent state gets a NAMED third material state in
  liquid-glass.md ("liquid pill, at-top"), legal ONLY when the hero is authored with
  a calm bar zone; aesthetics.md functional-layer rule gains an explicit
  scroll-adaptive-nav carve-out. Opacity bands: at-top ~70-80%, scrolled 85-95%+blur.
- **S3** FE-LIQUID-A11Y-01 (STRICT) stays supreme: `prefers-reduced-transparency` /
  `prefers-contrast: more` collapse ALL states to solid/near-opaque; worst-case
  contrast screenshot still required for the at-top state.
- **M3** the >= 2 floor is scoped to the BASE experience; `prefers-reduced-motion`
  and no-`@supports` fallbacks legitimately deliver zero motion.
- **M4** performance-budget.md gains media-motion rows: poster image counts toward
  hero budget; autoplay loop video lazy/IO-gated and excluded from first-load weight,
  soft cap ~4-6MB short loop; 100+-frame sequences need stated justification.
- **W1** UX-CONCEPT-GEN-01 skip rewritten: "user handed a finished design" skips;
  "we captured a reference to ground mockups" does NOT skip.
- **W2** mandate hardened: probe standardized to `ima2 status`; agent must attempt
  `ima2 serve` (or ask) before falling back; fallback must be stated.
- **W3** asset-requirements.md gains the concept-artifact vs shipped-asset
  distinction: ima2 UI mockups are exploration artifacts, NEVER shipped pixels;
  fake-asset rule scoped to shipped assets.
- **W5** capture workflow is analysis/mockup-grounding ONLY: fonts never copied,
  captured assets never shipped, provenance manifest (URL/date/license/use) required.

### MED/LOW → OPEN ASSUMPTIONS (one-line resolutions)

- S6 popover row in liquid-glass variant table rescoped: bar-spawned menus =
  near-opaque solid (demoted, blur-free) — also resolves S7 stacking + perf budget.
- S8 "pill container" defined: radius >= 24px or 9999px class on chrome; qualifying
  child visuals = background/border/outline at rest (shadow-only OK).
- S9 ownership split: liquid-glass.md owns material recipes; new top-bar.md owns
  composition/slots/scroll contract; design judgment stub points to dev-uiux-design.
- S10 scroll transition limited to background-color/opacity (no size morph on
  blurred bars).
- S11 a11y gate text scoped to translucent states.
- S12 new top-bar grammar carries its own STRICT domain gate (no dashboards/admin/
  finance/gov by default).
- M5 Lighthouse gate contradiction resolved toward "advisory smoke" (SKILL.md wins);
  CWV field metrics remain the gate.
- M6 dashboards: scroll-driven motion = 0 (hard), feedback/state transitions stay
  allowed (levels 1-4 preserved); dial inference tables reconciled to one source.
- M8 floor gets a ceiling + quality criterion: counts only distinct choreographed
  scroll moments (signature or supporting), max ~4/page, per-section fade-up spam
  explicitly does not count.
- M9/M10 visual-verification.md gains checklist rows: scroll-motion count (floor+
  ceiling), dashboard zero-check, autoplay poster/pause-offscreen/reduced-data.
- W6 precedence rule: UX-CONCEPT-GEN-01 synthesis governs pre-code concept stage;
  iterative-design Alive/Dead governs post-code iteration rounds — stated in both.
- W7 sequence defined: mockup-synthesis (pre-code) -> optional prototype-variants
  (structural, post-code) with explicit hand-off note.
- W8 mockup evidence contract: mockups land in devlog assets dir + DESIGN.md cites
  per-token source variant; mockup explicitly != render verification.
- W9 sourcing-priority clarified: asset-requirements order applies to CONTENT assets;
  concept mockups are process artifacts outside that order.
- W10 tool naming unified: `ima2` is the canonical CLI in both skills ($imagegen
  fallback when ima2 truly unavailable).
- W11/W12 reviewability: concept-pass evidence schema (dir + ledger) and capture
  manifest + "no captured asset shipped" pre-flight row added.

## Open Questions (round 1 → user)

1. C1 scope of the 2+ scroll-motion floor.
2. C2 liquid pill scroll-state contract + opacity band.
3. C3 exact shape of the pill-in-pill ban.

## Answers

### Round 1 (2026-07-09)

- **C1 scroll-motion floor** → "ㄴㄴ 대시보드 관리자 화면은 모션 없고 랜딩쪽에 그걸.
  목적을 정확하게 구분하라고" — floor applies to LANDING/expressive surfaces only;
  dashboards/admin get **zero** scroll motion (stricter than current MOTION 1-3).
  Skill edit must draw the purpose boundary explicitly.
- **C2 liquid pill state** → "스크롤 적응형이고 호버했을때 나타나는게 무조건 거의
  불투명이어야돼" — scroll-adaptive contract confirmed (transparent-ish at top,
  near-opaque once content scrolls beneath). NEW constraint: any hover-revealed
  surface (dropdown/popover/menu spawned from the bar) is **unconditionally
  near-opaque**, no transparency state at all.
- **C3 pill-in-pill** → "아니 그게아니라 ( () () () ) 이런걸 금지한다는거지.
  테두리를 금지한다고 기능은 상관없어" — the ban is VISUAL, not functional:
  a pill container may hold pill-shaped interactive children, but children must
  not each render their own visible capsule border/outline/background at rest —
  the `( () () () )` double-outline look is what's banned. Hover/active fills OK.

### Round 2 (2026-07-09)

- **Pill fill at rest** → "fill 전부 허용" — the pill-in-pill ban is now precise:
  child elements inside a pill container must not render visible capsule
  BORDERS/outlines at rest; solid fills are unrestricted (any count). The
  `( () () () )` ban targets nested outline rings only.
- **Motion tier map** → 3-bucket confirmed: landing/marketing/editorial/portfolio
  = floor 2 scroll motions (ceiling ~4, per-section fade-up spam does not count);
  consumer app in-app = feedback only, no floor; dashboards/admin = scroll motion 0
  (feedback/state transitions preserved).
- **Component mockup / ima2 mandate** → user deferred the exact render shape to the
  image model's judgment; the REAL directive: SKILL.md must explicitly mandate
  active tooling checks — probe `ima2` (status → serve) first, fall back to the
  `$imagegen` skill if truly unavailable — because the concept pass is currently
  underused ("너무 안쓰잖아"). Context-strip shape recorded as default assumption
  for component-level mockups (bar rendered inside its top-viewport context).

### Round 4 (2026-07-09)

- **Capture legal line** → 분석/시안 그라운딩 전용 confirmed: captured HTML/assets are
  for structure analysis + ima2 reference only; never shipped; fonts never copied;
  provenance manifest required.
- **Dropdown reach** → 폼 select 포함 전부: one custom dropdown design layer across
  nav menus, filters, form selects, date pickers; mobile gets the same skin as a
  bottom sheet; always headless/proven primitives underneath (behavior + ARIA
  preserved). This overrides native-first form-select guidance; crud-ui/form text
  gets amended accordingly.
- **Mockup scope** → user deferred the C-class scope (default assumption stands:
  C2+ expressive/brand surfaces) and clarified the D7 intent: when producing
  mockups AND real builds, do not default to CSS gradients for visual richness —
  generate image assets with VERY EXPLICIT LONG prompts (ima2), include video
  motion (ima2 video) where motion is wanted; real generated/photographic assets
  over CSS gradient washes. Long-prompt discipline becomes part of the asset rule.

## Contradiction Scan (round 4, 1 Mind delta lens: unlimited media + custom dropdown)

10 items (4 HIGH, 5 MED, 1 LOW). Triage — all scoped as planned edits/assumptions:

- **G1/G2 (HIGH)** "unlimited media budget" encoded as: BYTE caps (500KB first-load,
  100KB hero, 200KB above-fold rows) get a landing-bucket motion-media exemption;
  CWV field gates (LCP/INP/CLS) remain supreme via mechanics (poster-first LCP,
  lazy/IO-gated autoplay, stable layout). Budget freedom != correctness freedom.
- **G5 (HIGH)** custom dropdown recommendation is gated by Design System Detection:
  when MUI/Carbon/etc. governs, unify by THEMING that system's dropdown, not
  rebuilding it.
- **G6 (HIGH)** "하나의 드롭다운 디자인레이어" = ONE visual skin (material, radius,
  shadow, near-opaque surface, motion) applied across behavior-correct primitives
  (menu, combobox, listbox, select, datepicker) — NOT one blanket component;
  ARIA/keyboard contracts stay per-pattern.
- **G7 (HIGH)** mobile: hover-spawned surfaces keep tap alternatives; the same
  dropdown skin applies to the bottom-sheet form on mobile.
- **G3/G4 (MED)** build-time image audit + "optimize heavy media" rules gain the
  same landing-media exemption wording (rationale + loading gates stay).
- **G8/G9 (MED)** "custom" means headless/proven primitives (Radix, React Aria,
  Base UI) + custom skin, never hand-rolled behavior; form-boundary and keyboard
  gates unchanged.
- **G10 (LOW)** scope table to be written into the dropdown section (nav menu /
  filter / form select / mobile picker each mapped to a primitive + the one skin).

## Planned Edit Surface (draft, refined after answers)

- NEW `dev-frontend/references/core/top-bar.md` — canonical top-bar grammar:
  geometry (pill/full-width), material states (top vs scrolled), content slots,
  mobile collapse, a11y (focus not hidden under sticky chrome).
- `liquid-glass.md` — re-center default on near-opaque liquid pill; scroll-state
  opacity contract; keep 55% recipe as media-overlay special case.
- `anti-slop.md` (or liquid-glass.md) — pill-in-pill ban rule ID.
- `motion.md` — scroll-motion floor for expressive surfaces; reconcile with
  one-signature-moment doctrine.
- NEW reference-capture workflow (dev-frontend) — HTML + asset harvesting from
  reference sites (browser `pageAssets`, `curl`, legal line).
- `asset-requirements.md` / `aesthetics.md` — image/video-motion > gradient rule;
  real SVG logo emphasis (cross-ref brand-asset-sourcing).
- `dev-uiux-design` §2.5 — extend UX-CONCEPT-GEN-01 to component-level concepts.

## Contradiction Scan (round 5, 1 Mind final delta lens)

9 items (2 HIGH, 5 MED, 2 LOW) — ZERO new decision forks; every item is a concrete
amendment target already implied by locked decisions. Folded into the edit plan:

- **F1 (HIGH)** shipped-pixel boundary written into asset-requirements.md
  § Mockup Production Pipeline: generated CONCEPT mockups legal, shipped UI pixels
  must be real; generated photographic/texture/motion CONTENT assets legal in
  builds (they are not UI pixels).
- **F2 (HIGH)** performance-budget.md byte rows (500KB/100KB/200KB + preflight)
  get the landing-bucket motion-media exemption rows (poster-first LCP, lazy/
  IO-gated video, CWV still supreme).
- **F3 (MED)** dev-frontend SKILL.md §4 + dev-uiux-design §2 tool naming updated:
  ima2 canonical, `$imagegen` fallback.
- **F4-F7 (MED)** dropdown-layer amendments enumerated: crud-ui.md § Forms,
  form-patterns.md § Search/Filter + preflight, a11y-patterns.md (add select/
  listbox/menu picker mapping — one SKIN != one ARIA pattern), mobile-ux.md
  § Bottom Sheet (same-skin select pickers, no nested scroll).
- **F8-F9 (LOW)** capture manifest location + schema defined in the new
  reference-capture workflow doc; brand-asset-sourcing.md gains the
  "captured reference material vs shippable asset" boundary + fonts-never-copied.

## Interview Status

### Round 6 addendum (2026-07-10) — aside.com hero font + Pretendard alternatives

- **aside.com hero measured live** (in-app browser, computed styles): NOT
  Pretendard. H1 = custom `AsideDisplay_Variable` woff2 (`font-family:
  displayFont`, variable 100-900), rendered at weight 400 / 36px / centered /
  -0.36px tracking; body+mono = Geist / Geist Mono. Confirms D9 evidence: light
  centered display hero over soft photographic backdrop, with a near-opaque white
  pill CTA cluster.
- **D10: Pretendard alternatives** (web research, for Font Selection Guidelines
  table): SUIT (closest Pretendard substitute, UI-safe), Wanted Sans (more
  geometric/brand-forward; common pairing = Wanted Sans display + Pretendard
  body), LINE Seed KR (geometric UI-friendly, free commercial), Noto Sans KR
  (safest neutral/CJK fallback), Spoqa Han Sans Neo (tidy service-UI feel),
  Source Han Sans KR (broad CJK coverage). Skill edit: Korean-first font row
  stops being Pretendard-only; adds display/body pairing guidance.

## Contradiction Scan (round 6, 1 Mind delta lens: D9 light centered hero)

7 items (1 HIGH, 4 MED, 2 LOW) — all resolved as planned edits (user override + reconciliation):

- **B1 (HIGH)** aesthetics.md § Spatial Composition "VARIANCE > 4 centered Hero/H1
  BANNED" gains the carve-out: **Light Centered Display Hero** (weight <= 400,
  centered, over full-width real media/motion backdrop, generous space) is a
  sanctioned NAMED pattern at any variance; generic centered BOLD hero + template
  composition stays banned. Direct user directive.
- **B2 (MED)** Anti-Default Discipline keeps "centered hero" as default-to-avoid;
  D9 is legal only as the NAMED intentional exemplar, never as unexamined default.
- **B3 (MED)** Liquid Editorial kit gains a second hero grammar variant: type-led
  asymmetric (existing) OR light centered display (D9) — kit no longer implies
  asymmetric-only.
- **B4 (MED)** visual-hierarchy.md § Weight Contrast gets a display-hero exception:
  at display scale, SIZE contrast may replace weight contrast (light 300-400
  headline legal when >= 3x body size).
- **B5 (MED)** Korean: light centered Hangul hero maps to Pretendard 300-400 at
  display sizes only (hairline Hangul below display scale flagged); MaruBuri serif
  display keeps its own 400-600 band — two distinct rows, no merge.
- **B6 (LOW)** OpenAI (centered stacked over full-width media) vs Anthropic
  (editorial opener) stay distinct personalities; D9 references OpenAI grammar as
  the primary exemplar.
- **B7 (LOW)** ownership split: layout-discipline.md § Hero Composition Grammar
  owns the composition rule; aesthetics.md/design-isms.md own the type exemplar,
  cross-referenced as stubs.

### Round 5 (2026-07-10)

- **NEW D9: light centered hero** → "히어로 텍스트 중앙정렬 폰트 bold하지 않고
  라이트한 느낌으로 이런 느낌도 중요사례로" — center-aligned hero text with LIGHT
  font weight (300-400 band, not bold) must be encoded as an important named
  exemplar (matches OpenAI/Anthropic display grammar from
  `_plan/260709_design_grammar_research/`). Known tension: dev-uiux-design
  Anti-Default Discipline lists "centered hero" as an LLM default to reach past —
  resolution direction: name the pattern (light-weight centered hero) as
  INTENTIONAL when paired with light display weight + generous space + real
  asset/motion backdrop; the generic centered-bold-hero + 3-cards template stays
  banned.

All four dimensions covered (Goal, Constraint, Success criteria, Ontology).
5 scan rounds recorded, 61 contradictions total, 0 unresolved HIGH, all MED/LOW
exited into planned edits or OPEN ASSUMPTIONS listed above. Ready for I -> P
pending user closeout choice.

## Contradiction Scan (round 3, 1 Mind delta lens, post-answer rescan)

8 items (3 HIGH, 5 MED). Triage — all resolved without further user questions:

- **H3** floor-2 vs "exactly ONE signature moment" (UX-DEFAULT-ISM-01, design-isms,
  motion.md opener): PLANNED EDIT — doctrine rewritten to "one signature moment +
  >= 1 supporting scroll reveal; floor 2, ceiling ~4" on landing-bucket surfaces.
  User already decided the floor; this is reconciliation, not a new fork.
- **H6** ima2-first vs imagegen-preferred (system imagegen SKILL.md says built-in
  preferred; asset-requirements treats them as peers): PLANNED EDIT — both OUR
  skills state ima2 as canonical generator (`ima2 status` probe -> attempt
  `ima2 serve` -> only then `$imagegen` fallback). The bundled imagegen skill is
  not ours to edit; precedence lives in dev-frontend/dev-uiux-design text.
  This is the user's explicit round-2 ruling.
- **H7** "fire much more often" vs C0/C1 fast-path + CRUD-only C2 screens:
  OPEN ASSUMPTION (safe default) — mandate scoped to C2+ NEW/redesigned
  expressive or brand-visible surfaces (landing, hero, key chrome like the top
  bar, major redesign); C0/C1 patches and utility CRUD/dashboard screens stay
  exempt. The underuse complaint targets design surfaces, not CRUD forms.
- **M1** "fills unrestricted" is scoped by existing hierarchy rules: the pill rule
  itself no longer counts fills, but one-primary-action + max-1-accent still cap
  how many STRONG fills make sense; reviewers cite hierarchy, not pill-in-pill.
- **M2** border taxonomy: the pill CONTAINER's own single hairline border stays
  legal; the ban applies to CHILD capsule borders/outlines at rest. Glass recipe
  border lines get scoped wording.
- **M4** dial reconciliation: landing-bucket surfaces with the scroll floor imply
  MOTION >= 5; inference tables annotated so "landing 3-5" no longer contradicts
  scroll-driven level gates (7-8+ relaxed to "5+ with floor compliance").
- **M5** full taxonomy mapping: marketing-facing pages of ANY product (incl. AI
  tools, education, community) = landing bucket; logged-in/in-app views = feedback
  bucket; public service = feedback-only; games = domain-specific (exempt).
- **M8** duplicate of round-2 W3 (concept artifact != shippable asset) — already
  a planned edit in asset-requirements.md.

## Loop Archetype (INTERVIEW-CLASSIFY-01)

Spec work — a verifier defines done: (1) all decided rules encoded in the two
skills' files with no remaining internal contradictions (the 34+8 scan items each
resolved by an edit or recorded assumption), (2) a demo top-bar page built and
render-verified in the in-app browser (scroll states, hover surface opacity,
pill border ban, 2+ scroll motions) as the acceptance artifact.

## Answers

### Round 3 (2026-07-09, closeout fork)

- User chose: keep interviewing (more questions).
- **Media budget** → "예산은 무제한" — the proposed ~4-6MB soft cap on motion media
  is dropped; no byte budget on landing-bucket motion media. Loading MECHANICS stay
  (poster for LCP, lazy/IO-gated autoplay, reduced-motion/data fallbacks) since
  those are correctness, not budget.
- **NEW D8: custom dropdown layer** → skills must RECOMMEND building a custom
  dropdown component over native/default ones, unifying every dropdown into one
  design layer per project ("하나의 드롭다운 디자인레이어로 통일") — consistent with
  the bar-spawned hover-surface rule (unconditionally near-opaque).
