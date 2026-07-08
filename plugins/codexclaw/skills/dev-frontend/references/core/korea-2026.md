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
