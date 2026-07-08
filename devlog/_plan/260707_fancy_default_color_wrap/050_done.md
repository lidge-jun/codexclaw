# 050 — Done: No-Brief Default Ism / Color System / Natural Line Breaks

Terminal outcome: **DONE** (criteria a-f met with captured evidence). 4 PABCD
work-phases under HOTL goal, session `019f3957-f9a8-7f50-ae6b-42d4c0f6e77a`,
goalplan `fancy-no-brief-default-ism-policy-2026-decided-b`. Second loop of
the day (first: `260707_liquid_glass_motion_trends`).

## Loop history

### WP1 — Swarm research + decision (000_research.md, 010_plan.md)
- 3-lane gpt-5.5 xhigh explorer swarm, cxc-search attached: Lane A isms
  (Apple Newsroom/WWDC25, Figma, Creative Bloq, Awwwards, Fireart — all
  Tier-2 opened, dated), Lane B color (MDN baselines: oklch 2023 / color-mix
  2023 / light-dark 2024; Tailwind v4 @theme; shadcn OKLCH; WCAG 2.2 REC vs
  WCAG 3 draft; APCA advisory; 11 tools maintenance-dated), Lane C
  line-breaking (MDN, CSSWG Text 4, W3C KLREQ, Chrome DevRel auto-phrase
  ja-only, Naver SmartStudio; dvh/container sweep checklist).
- `cxc skill search` catalog scan: liquid-glass-design (jaw) mined for iOS 27
  corroboration, not adopted; ui-design-system/officecli-cjk not adopted.
- A-gate reviewer (Mencius) round-1 FAIL → 5 binding constraints → PASS.
- **MAIN-AGENT DECISION (user-delegated): default ism = "Liquid Editorial"**
  composite kit (editorial type-led structure + Liquid Glass/pill chrome
  accent + one signature motion + OKLCH single accent), domain-gated to
  expressive surfaces. Rationale in 000_research.md §Decision.

### WP2 — dev-uiux-design (020_uiux_patch.md)
- Reviewer round-3 PASS (no UX-TYPE-01/anti-slop/motion conflicts; toolbox
  replacement scoped; design-isms right home).
- Shipped: SKILL.md UX-DEFAULT-ISM-01 (UX-INTENT-01 step-3 fallback, STRICT
  quiet-domain gate, assumption duty) + Anti-Default cross-ref; design-isms
  §1.13 Liquid Editorial; color-system Color Toolbox 2026 (8 tools,
  maintenance dates, WCAG 2.2 gate / APCA advisory); typography-line-breaks
  Dynamic Rewrap Judgment + arbitrary-width criterion.

### WP3 — dev-frontend (030_frontend_patch.md)
- Reviewer round-4 PASS (contrast STRICT pattern ok; theme-switching keeps
  runtime; no i18n collision).
- Shipped: NEW references/core/color-system.md (FE-COLOR-TOKEN-01,
  FE-COLOR-FALLBACK-01 incl. var()-fallback pitfall, FE-COLOR-CONTRAST-01
  STRICT; Tailwind v4/shadcn wiring); typography-wrapping.md — keep-all
  rescoped `[lang|="ko"]` (Tier-2 bugfix: global keep-all degrades zh/ja),
  FE-WRAP-NATURAL-01 natural-phrase-breaks-at-any-width + Korean facts
  (auto-phrase ja-only, KLREQ 금칙, Intl.Segmenter render-time wbr) +
  Dynamic-Viewport Verification checklist; SKILL.md rows + UX-DEFAULT-ISM-01
  pointer; theme-switching cross-link.

### WP4 — Final gate
- FRESH reviewer (Meitner) round-1 FAIL: (1) scope contamination claim —
  REBUTTED with evidence (loop/goalplan/skill-hub/ultraresearch +
  map-affordance changes are pre-existing baseline dirt correlating with
  260705_loop_search_consolidation + 260706_repo_map; not this loop's
  writes; NOT reverted per dirty-worktree discipline); (2) stale "CJK word
  integrity" table row — ACCEPTED, fixed to ko-scoped wording. Round-2 PASS.
- No contradictions found vs anti-slop/gradient budget/premium-consumer
  palette ban/serif stance/Liquid Glass layer rules; all cross-ref paths
  exist; claims dated.

## Pre-existing baseline dirt (explicitly NOT ours, NOT reverted)

`docs-site/public/og.png`, `components/cxc-ops/map-affordance.{ts,js}`,
`skills/dev/SKILL.md`, `skills/loop/SKILL.md`, deletions of
`goalplan|skill-hub|ultraresearch/agents/openai.yaml`, unrelated untracked
devlog dirs.

## Residuals / open leads

- APCA/WCAG 3: revisit the advisory stance when WCAG 3 leaves Working Draft.
- `word-break: auto-phrase` Korean support: Chrome roadmap says planned —
  re-check and upgrade the Korean guidance when it ships.
- Liquid Editorial anti-uniformity: monitor whether the kit itself becomes a
  new generic tell; §1.13 already mandates per-project variation.
- Lane-B unopened candidates (InclusiveColors, Color Safe, RandomA11y):
  candidate-only, not added.
