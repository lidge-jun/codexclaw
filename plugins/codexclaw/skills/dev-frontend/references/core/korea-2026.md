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
