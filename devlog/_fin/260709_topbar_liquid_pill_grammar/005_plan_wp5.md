# WP5 Plan — Light Centered Hero + Korean Font Alternatives (D9, D10)

Phase: drafted during WP4 audit wait; activates at next P.
Decision source: `000_interview.md` D9/D10, B1-B7 triage (round-6 scan),
round-6 addendum (aside.com measured evidence: AsideDisplay variable 400/36px/
centered; Geist body).

## Loop-spec (HOTL bounds)

- Write scope: `dev-frontend/references/core/layout-discipline.md` (hero
  composition grammar section), `aesthetics.md` (spatial composition carve-out),
  `dev-uiux-design/references/design-isms.md` (Liquid Editorial second hero
  variant), `visual-hierarchy.md` (display-scale weight exception),
  `korea-2026.md` (Korean display weight rows), `dev-uiux-design/SKILL.md`
  (Font Selection Guidelines D10 table), `product-personalities.md` (only if
  OpenAI/Anthropic rows need a one-line pointer).
- Tools: apply_patch, rg, 2 gpt-5.5 workers + reviewer. ~35min soft.

## Edits

### E1. Light Centered Display Hero — composition (worker A)

- layout-discipline.md § Hero Composition Grammar: NEW named pattern
  FE-HERO-LIGHT-CENTER-01 (DEFAULT): centered hero headline at LIGHT weight
  (300-400), over a full-width real media/motion backdrop (photo, generated
  texture, video — not gradient wash), generous space, minimal copy stack
  (FE-HERO-01 copy budget still applies). OpenAI grammar; aside.com measured
  evidence cited. Generic centered BOLD hero + template composition stays
  banned (cross-ref anti-slop). Composition ownership lives HERE (B7).
- aesthetics.md § Spatial Composition: the "VARIANCE > 4 centered Hero/H1
  BANNED" rule gains the carve-out — FE-HERO-LIGHT-CENTER-01 is a sanctioned
  named exception at any variance when its conditions hold (light weight +
  authored media backdrop) (B1).
- layout-discipline.md line ~61 stale cross-ref ("aesthetics.md § Spatial
  Composition also bans 3-col cards and centered heroes") reworded to note the
  FE-HERO-LIGHT-CENTER-01 exception (audit R1 blocker 1).

## Audit synthesis (round 1)

Reviewer FAIL: stale centered-ban cross-ref inside layout-discipline.md
(ACCEPTED, added to E1) and c10 checking only half the D10 font list
(ACCEPTED, c10 now checks all six names).

### E2. Type + kits (worker B)

- design-isms.md §1.13 Liquid Editorial: structure clause gains a second hero
  grammar variant — "type-led asymmetric OR light centered display
  (FE-HERO-LIGHT-CENTER-01)" (B3).
- visual-hierarchy.md § Weight Contrast: display-scale exception — at display
  sizes, SIZE contrast may replace weight contrast; a 300-400 headline is legal
  when >= 3x body size (B4).
- korea-2026.md § Korean Serif/Myeongjo Display: add adjacent row — light
  centered Hangul display heroes use Pretendard (or SUIT/Wanted Sans) 300-400
  at display sizes ONLY; hairline Hangul below display scale is a legibility
  failure; MaruBuri serif display keeps its own 400-600 band (B5, two distinct
  rows, no merge).
- dev-uiux-design/SKILL.md § Font Selection Guidelines: D10 — Korean-first row
  expands with alternatives table/lines: SUIT (closest swap), Wanted Sans
  (display pairing: Wanted Sans display + Pretendard body), LINE Seed KR
  (geometric consumer), Noto Sans KR (neutral/CJK fallback), Spoqa Han Sans Neo
  (tidy service UI), Source Han Sans KR (Adobe CJK); light-centered-hero weight
  note (300-400 display-only).
- product-personalities.md OpenAI row: one-line pointer to
  FE-HERO-LIGHT-CENTER-01 (keep OpenAI vs Anthropic distinct — B6).

## Dispatch plan

- Worker A: layout-discipline.md + aesthetics.md. Worker B: design-isms.md +
  visual-hierarchy.md + korea-2026.md + dev-uiux-design/SKILL.md fonts +
  product-personalities.md pointer. Disjoint files. Main: read-back + rg.
- Reviewer: same-reviewer plan audit.

## WP5 acceptance (criteria c9-c10)

- c9: FE-HERO-LIGHT-CENTER-01 exists in layout-discipline; aesthetics carve-out
  present; design-isms second variant; visual-hierarchy exception; Korean weight
  rows distinct; rg rule ID across >= 4 files; bold centered hero ban survives.
- c10: font alternatives present in Font Selection Guidelines — rg finds ALL
  six: SUIT, "Wanted Sans", "LINE Seed", "Noto Sans KR", "Spoqa Han Sans Neo",
  "Source Han Sans KR".
