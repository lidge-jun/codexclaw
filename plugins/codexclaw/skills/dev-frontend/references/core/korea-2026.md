# Korea 2026 — Korean-First Frontend Rules

Use this when the UI is Korean-first, Korea-facing, or likely to be judged against Korean consumer/product norms.

## Product Defaults

Korean product UI often values:

- dense but scannable information
- fast task completion over empty hero space
- mobile-first navigation and sticky actions
- trust-first presentation in finance, public services, healthcare, education, and B2B
- concrete visual assets over abstract gradient atmosphere
- familiar Korean copy with low friction

Do not treat "Korean design" as automatically cute, pastel, or mascot-heavy.

## Domain Profiles

| Domain | Direction | Avoid |
| --- | --- | --- |
| Fintech/payment | calm, precise, explainable, reversible | childish mascots, vague trust claims, generic 3D icons |
| Public/gov | KRDS/KWCAG-minded, plain, predictable | decorative motion, cute assets, low contrast |
| B2B/SaaS/ops | dense, restrained, repeatable workflows | landing-page hero composition, card-heavy dashboards |
| Commerce/community | familiar, local, warm, concrete | generic global SaaS copy, fake reviews |
| Education/kids | guided, encouraging, visual, forgiving | confusing decoration, inaccessible contrast |
| AI tools | provenance, process, undo, permission clarity | magical gradients, no error/retry/cancel states |

## Public Service / Regulated Korean UI

For government, public-service, finance, healthcare, education administration, or other regulated Korean surfaces:

- Use KRDS-minded structure when applicable: predictable navigation, consistent tokens, clear service patterns, and plain Korean labels.
- Apply KWCAG/WCAG accessibility thinking from the start: labels, keyboard operation, focus order, contrast, alternatives, error recovery, and status messaging.
- Favor trust, reversibility, and task completion over decorative personality.
- Avoid cute characters, playful metaphors, soft 3D mascots, and heavy motion unless they explain a task and pass stakeholder/a11y review.
- Treat 44×44px hit areas as a conservative mobile baseline; smaller targets must still satisfy WCAG 2.2 target-size/spacing requirements.

## Korean Typography

- Use CJK-safe stacks first: Pretendard, SUIT, Noto Sans KR, Apple SD Gothic Neo, system sans fallback.
- Latin display fonts are optional accents, not the default for Hangul.
- Avoid negative letter-spacing as a default for Korean text.
- Body line-height should usually sit around 1.55-1.75.
- Large Korean headings need optical restraint; avoid hero-scale type inside tools.
- Test labels with long Hangul strings before delivery.

### Korean Hero / Large Display Type (verified 2026-07-08)

Big bold Hangul is NOT the same as big bold Latin. Each Korean syllable is a
dense, near-square block with little ascender/descender rhythm, so at the same
px and weight it reads as a heavier graphic mass (Typotheque CJK typesetting;
Morisawa Hangeul guide). Scaling Hangul to Latin-poster size and weight is a
slop signal on landing/campaign surfaces too, not only inside tools — a
`clamp(..., 10rem)` / `line-height: 0.9` / weight `800-900` Korean hero is the
tell.

Measured on live premium Korean services (2026-07-08, Playwright computed style):

| Service | Korean hero (desktop) | Note |
| --- | --- | --- |
| Toss home | 66px / 700 / lh 1.4 | keep-all, letter-spacing normal |
| Toss team | 72px / 700 / lh 1.3 | keep-all |
| Daangn about | 64px / 700 / lh 1.31 | keep-all |
| Kakao corp | 70px / 700 / lh 1.27 | letter-spacing -3px |
| Woowa | Korean 40px / 700 | its 900 is on ENGLISH display only |
| Naver / Musinsa | 32px/600, 20px/600 | content- and image-led |

Rules (DEFAULT):
- **Weight**: `700` is the premium ceiling for long Korean hero copy; `600` for a
  quieter tone. Reserve `800/900` for SHORT brand phrases (e.g. "토스페이스"),
  English display, or deliberate poster impact — `900` on long Hangul reads blunt
  before it reads refined.
- **Size**: keep desktop Korean heroes ~`56-72px`; avoid 100px+ walls of Hangul.
  Mobile ~`26-40px`. Do not let a `vw`-relative clamp push Hangul past this.
- **Line-height**: `1.25-1.4` for multi-line Hangul. Do not copy Latin display
  `line-height: 0.9-1.0`; dense Hangul needs air between lines.
- **Breaks**: `word-break: keep-all` + manual `<br>` at 어절/meaning boundaries;
  never split inside a word.
- **Tracking**: default `normal` (0). Mild negative (`-0.01` to `-0.02em`) on
  large display is an observed premium practice but optional and QA-gated; keep
  body Korean at normal.
- **Structure over scale**: short Korean headline + supporting copy + whitespace +
  imagery, or an English display accent, beats a giant Hangul wall. This is how
  Toss/Woowa/Naver read premium.
- **Fonts**: Pretendard (safe premium default), Wanted Sans (brand-forward),
  Spoqa Han Sans Neo (practical); reserve custom faces (Toss Product Sans style)
  for brand budgets.

Sources: live pages toss.im, about.daangn.com, kakaocorp.com, woowahan.com,
navercorp.com, musinsa.com; Typotheque CJK typesetting; Morisawa Hangeul guide;
W3C Korean Layout Requirements (KLREQ); Pretendard / Wanted Sans / Spoqa docs.

### Korean Serif / Myeongjo Display (verified 2026-07-09)

The Latin serif renaissance has a Korean lane, but it is **editorial myeongjo
display**, not a verified KR-AI-brand wave — do not claim Korean AI services
moved to myeongjo the way Anthropic moved to serif. Use myeongjo as a
domain-gated display direction for editorial, literary, cultural, publication,
and trust/heritage surfaces.

Webfont ranking (DEFAULT):
- **MaruBuri** (Naver, 명조/부리, ExtraLight-Bold): the best warm Korean
  display serif for screens; use 400-600 for headlines, never for tiny UI text.
- **Noto Serif KR**: widest coverage and weight range, but heavy CJK payload —
  subset aggressively or use the variable build.
- **Nanum Myeongjo**: familiar and literary, but reads dated for premium tech.
- **Chosun Myeongjo family**: strong newspaper-authority signal; choose it for
  press/heritage tone, not soft AI warmth.

Pairing grammar mirrors the Latin three-role system: **myeongjo display +
Pretendard/SUIT/system sans UI** (+ mono accent for technical surfaces).
Keep myeongjo out of dashboards, dense tools, and body-size UI text; Hangul
serif strokes degrade at small sizes on low-DPI screens.

Adjacent sans-display lane: light centered Hangul display heroes use
Pretendard/SUIT/Wanted Sans at 300-400 **at display sizes only**
(>= ~40px; FE-HERO-LIGHT-CENTER-01). Hairline Hangul below display scale is a
legibility failure. This does not change the MaruBuri serif display band:
MaruBuri keeps its own 400-600 range for editorial myeongjo headlines.

Sources: hangeul.naver.com MaruBuri (명조/부리 category, 5 weights);
notofonts/noto-cjk Serif KR; live checks 2026-07-09 found no myeongjo-led
Korean AI product home (Brunch-class editorial products observed on sans).

## Korean Formats

- Dates: `2026년 5월 10일`, `5월 10일`, `오후 9:41`.
- Counts: use Arabic numerals, Korean units where natural: `3개`, `1.2만`, `3억`.
- Currency: `1,234,567원`.
- Phone-like examples should use Korean patterns when relevant: `010-1234-5678`.

Use locale-aware formatters when possible rather than hand-building strings.

## Mobile Patterns

Korean mobile product flows commonly expect:

- bottom sheets for lightweight choices
- full-screen flows for complex funnel steps
- sticky bottom actions for primary submit/continue
- snackbar/toast for reversible or low-risk confirmations
- pull-to-refresh where feed/list mental models exist
- safe-area handling on modern mobile devices

Do not use a modal for every decision.

## Copy

For Korean copy, read `ux-writing-ko.md`. The short version:

- familiar words
- direct recovery actions in errors
- feature purpose over internal feature names
- minimal honorifics
- no translationese
- no childish friendliness in high-trust flows

## Verified 2026 Additions (2026-07-02)

- **Pretendard** remains a strong Korean-first default; current release line includes
  `Pretendard Variable` 1.3.9. Do not claim it as "the standard of Toss/당근" without a
  product-specific source — verify brand font rules per product.
- **W3C KLREQ** (Korean Layout Requirements) has a 2026-03-21 note version — the
  authoritative reference for Korean line-breaking and orphan rules.
- **Rendered screenshot gate**: after responsive changes, verify `word-break: keep-all`,
  `text-wrap: balance` on short descriptors, and no lone particles/endings ("합니다.",
  "화.") at target viewports. No browser API detects Korean orphans — screenshots are the gate.

| Claim | Source | Checked |
|---|---|---|
| Pretendard Variable 1.3.9 | https://github.com/orioncactus/pretendard | 2026-07-02 |
| KLREQ note 2026-03-21 | https://www.w3.org/TR/klreq/ | 2026-07-02 |
| keep-all CJK behavior | https://developer.mozilla.org/en-US/docs/Web/CSS/word-break | 2026-07-02 |
