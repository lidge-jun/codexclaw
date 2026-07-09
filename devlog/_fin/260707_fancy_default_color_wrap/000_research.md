# 000 — Research: No-Brief Default Ism / Color Tooling / Natural Line Breaks

Second loop (session `019f3957-f9a8-7f50-ae6b-42d4c0f6e77a`, goalplan
`fancy-no-brief-default-ism-policy-2026-decided-b`). Research executed by a
3-lane gpt-5.5 xhigh explorer swarm with `cxc-search` attached
(SEARCH-ATTACH-01), 2026-07-07. Full lane reports live in the session
transcript; this doc records the claim ledger, catalog scan, and the main
agent's decisions.

## Lane A — Fanciest 2026 isms (explorer "Bernoulli")

Tier-2 sources opened: Apple Newsroom Liquid Glass announcement (2025-06-09),
Apple WWDC25 "Meet Liquid Glass" session page, Figma Resource Library 2026 web
trends, Creative Bloq 2026 typography (2025-12-28) + graphic design
(2025-12-23) forecasts, Awwwards live winners (incl. 2026-07-06) + 3D/animation
collections, Fireart Studio 2026 trends (updated 2026-04-25), aside.com.

Key findings:
- Liquid Glass is the loudest NAMED premium direction; Apple itself warns:
  restrained, floating nav/control layers only, no glass-on-glass.
- Field consensus for 2026 expressive web: bold/kinetic typography as primary
  architecture, tactile/anti-AI textures, vibrant-but-authored color, 3D/motion
  for premium sites; "uniformity is out, character is in".
- Explorer ranking for a no-brief default: 1. Expressive Editorial Premium
  (type-led, low slop risk, plain-CSS implementable), 2. Liquid Glass-lite
  (highest fancy signal, highest copycat/a11y risk), 3. Spatial gradient/3D
  (aurora-slop + perf risk).

## Lane B — Color tooling + token implementation (explorer "Maxwell")

Tier-2 opened: MDN oklch (Baseline 2023) / color-mix (Baseline 2023) /
light-dark (Baseline 2024) / var+@supports; Tailwind v4 @theme docs;
shadcn/ui theming docs (semantic OKLCH vars via `@theme inline`); W3C WCAG
2.2 REC + WCAG 3.0 Working Draft; APCA site + Myndex repo; tool repos with
push dates.

Vetted 2026 toolbox (maintenance-checked 2026-07-07):
| Tool | Use-when | Status |
|---|---|---|
| tweakcn (tweakcn.com) | shadcn/Tailwind v4 theme editing/export | active (repo pushed 2026-06-11) |
| OKLCH Picker (oklch.com) | precise OKLCH picking/conversion | active (2026-07-04) |
| Harmonizer (harmonizer.evilmartians.com) | OKLCH UI palettes w/ APCA-minded contrast | active (2026-04-06) |
| Leonardo (leonardocolor.io) | adaptive a11y-aware system palettes | active (Adobe, 2026-05-18) |
| Radix Colors | prebuilt accessible app scales | stable (2025-12-17) |
| Adobe Color / Coolors | fast ideation, extraction, gacha | live commercial |
| APCA calc + Atmos checker | perceptual contrast alongside WCAG 2.2 | active |
| Huetone | learning tool only | STALE (2023-11) |

Token architecture facts (all Tier 2): primitive → semantic → component CSS
variable layering; oklch() primitives with hex fallback via @supports (NOT
var() fallback — var(--x, fb) does not save a declaration whose value holds an
unsupported color function); color-mix(in oklch, ...) for state derivation;
light-dark() + color-scheme for browser-controlled 2-mode, `.dark`/[data-theme]
for app-controlled themes; Tailwind v4 CSS-first @theme, shadcn `@theme inline`
mapping. Contrast: WCAG 2.2 is the compliance bar; APCA advisory until WCAG 3.

## Lane C — Korean/CJK natural line breaks + dynamic viewport (explorer "McClintock")

Tier-2 opened: MDN word-break (mod. 2026-04-20) / line-break / overflow-wrap /
wbr / text-wrap (Baseline 2024) / Intl.Segmenter (Baseline 2024); CSSWG CSS
Text 4 draft; W3C KLREQ (Korean layout requirements); W3C i18n line-breaking
article; Chrome Developers css-i18n post (auto-phrase: Japanese-only as of
Chrome 119, Korean planned); Naver SmartStudio line-break deep-dive
(2023-03-23).

Bottom line: natural Korean phrase (어절) wrapping in production 2026 =
`:lang(ko)` scoping + `word-break: keep-all` + `overflow-wrap: break-word`
escape + `text-wrap: balance` on short blocks. `word-break: auto-phrase` is
Japanese-only (progressive enhancement; MUST NOT be relied on for Korean).
`text-wrap` chooses among existing break opportunities — it does not create
Korean phrase boundaries. KLREQ 금칙 rules (closing punctuation can't start a
line etc.) are real Korean requirements, not just Japanese kinsoku. Global
keep-all harms zh/ja — scope by language. `Intl.Segmenter("ko",
{granularity:"word"})` (Baseline 2024) can find word-ish units for render-time
`<wbr>`/ZWSP insertion; storing ZWSP in canonical content harms search/copy.
Dynamic-viewport verification: sweep CONTAINER widths in 8-16px increments
(160-900px), not just canonical breakpoints; test dvh/svh URL-bar changes,
split-screen, foldable panes, container-query crossings, 200% zoom; assert
scrollWidth <= clientWidth; keep-all + narrow chips/buttons = overflow risk
fixtures (long 어절, mixed ko/Latin/number, URLs).

## Skill-catalog scan (`cxc skill search`, 2026-07-07)

- `liquid-glass-design` (jaw catalog): iOS 26-27 Liquid Glass SwiftUI/UIKit
  skill. NOT adopted (native-platform scope) but mined as corroboration:
  iOS 27 adds a SYSTEM-WIDE user transparency slider (strengthens our
  FE-LIQUID-A11Y-01 stance), `.clear`/`.identity` styles, GlassEffectContainer
  merge/morph concepts (web analog: chip-cluster gooey merges).
- `ui-design-system`, `dev-uiux-design` (jaw): already superseded by active
  local skills (catalog marks them "-> use dev-uiux-design (active)").
- `officecli-cjk`: document-generation CJK rules; not web scope. Not adopted.

## MAIN-AGENT DECISION (user-delegated)

**No-brief default direction = "Liquid Editorial" (2026)** — a named composite
kit, decided against the explorer's pure-#1 and pure-#2 options:

- **Structure (from Expressive Editorial Premium):** type-led composition;
  oversized editorial headline scale; one authored pairing (grotesk default,
  serif display only with editorial rationale); tactile/photographic texture
  over flat gradient washes; asymmetric, content-weighted layout.
- **Material accent (from Liquid Glass-lite / aside.com class):** glass or
  near-opaque pill chrome ONLY on floating functional layers (nav, toolbars,
  chip clusters); pill-chip content units; pastel-photography washes allowed;
  content layer stays solid (FE-LIQUID-LAYER-01).
- **Motion:** feedback-level baseline + exactly ONE signature moment
  (pointer-proximity chips OR scroll-driven reveal), per motion domain gates.
- **Color:** OKLCH-derived single accent + tinted neutrals (hue-budget rule).

Rationale: the user asked for the fanciest default; pure Liquid Glass is the
highest-fancy signal but Apple's own restraint guidance + our anti-slop bans
make it a poor UNIVERSAL default (copycat + a11y risk, Lane A cons). The
composite keeps the 2026 fancy signal in the chrome/accent layer where HIG
says it belongs, while the editorial structure carries authored
distinctiveness with low slop risk. Domain gate: expressive surfaces only
(landing/consumer/creative/AI-product); quiet surfaces (dashboards, admin,
finance, gov, B2B ops) keep quiet domain-correct defaults — "fancy" never
overrides domain correctness.

## Claim-tier discipline for the patches

Everything entering skills from Lanes B/C is Tier-2 with dates. From Lane A,
trend NAMES and Apple guidance are Tier-2; the composite kit itself is a
DECISION (STYLE_SAMPLE), not a factual claim.
