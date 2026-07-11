---
created: 2026-07-11
tags: [codexclaw, pabcd-initiative, docs-site, hero, impl-record]
---

# WP3 impl record — docs-site skeleton + hero (DONE)

Cycle: P -> A (4 blockers, all ACCEPT, rev 2) -> B -> C -> D closed
(session `019f4a07-70d9-7fc3-bdcb-9276fa5f2522`, 2026-07-11).

## What shipped

- `../pabcd_initiative/docs-site/index.html` — full-bleed hero (ima2
  `hero_grid_paper.png` stage + live HTML type masthead), P/A/B/C/D sequence
  figure (corrected semantics Plan/Audit/Build/Check/Done), 6-item numbered
  index strip (next-section hint inside first viewport), doctrine band with
  state table, print-detail divider, docs index rows, 10-paper reference list,
  wordmark footer. One scroll reveal (IO), `prefers-reduced-motion` honored.
- `assets/site.css` — tokens from DESIGN.md ledger; stepped media-query type
  scale (no vw-scaled font sizes), letter-spacing 0.
- `pages/{origin,skills,delegation,loop}.html` — skeleton pages with real
  abstracts; WP4 fills bodies.

## Cutout asset pipeline (user steering, this session)

User pasted the ima2-site chrome-blob thread and asked for "이 방식대로":
solid-bg generation + pixel crush + blend-mode removal (FE-ASSET-BG-01).
Light-paper inversion applied: PURE WHITE bg prompts -> PIL crush (all
channels >= 235 -> 255) -> WebP -> `mix-blend-mode: multiply` +
`isolation: isolate` on `.blend-scope` containers. Border probe before crush:
all three prior renders min channel 253 (near-perfect white).

| Asset | Source render | Placement |
| --- | --- | --- |
| cut_fsm.webp | cut_01_fsm_ink (ima2) | index doctrine figure |
| cut_attested.webp | cut_02_attested_stamp | index state-table stamp |
| cut_wordmark.webp | cut_03_wordmark | footer mark |
| cut_dispatch.webp | cut_04_dispatch_ink (ima2, this phase) | delegation page Fig.02 |
| cut_gate.webp | cut_05_gate_ink (ima2, this phase) | loop page Fig.03 |

ima2 was primary throughout; the imagegen fallback was never needed.

## Verification evidence

QA captures in `assets/qa/`: `wp3_index_{390,768,1024,1440}_fold.png`,
`wp3_index_{390,1440}_full.png`, `wp3_doctrine_1440.png`,
`wp3_page_delegation_1440.png` — all read back via `view_image`. Full-bleed
hero, brand H1 in first viewport, strip hint visible at all four widths, no
overlap/overflow, cutouts blend seamlessly on paper.

One QA-script bug worth remembering: `html { scroll-behavior: smooth }` makes
rapid programmatic `scrollTo` loops never reach the page bottom, so reveal
sections looked blank in early fullPage captures. Fixed by
`behavior: "instant"` in the capture script — a capture artifact, not a site
bug (`.reveal` fires correctly on real scroll; `inCount=3` verified).

## Post-D steering fix (user, 2026-07-11 20:15, C1)

User: hero too empty on wide screens vs the r1_03 reference ("빈공간이 너무
많잖아 레퍼런스처럼 채워놓으라고"). Root cause: type scale stopped at
1500px+ while the reference masthead fills half the frame. CSS-only fix in
`site.css`: (1) min-width mast steps added (1501px 18rem / 1750px 21.5rem /
2100px 25rem), line-height 0.8, bigger red square (0.42em) + Initiative;
(2) seq-figure stretches full hero height (`space-evenly`) with a left
column rule and larger letters/labels; (3) hairline above the descriptor —
both rules echo the reference's visible column grid. Verified at
1995/1440/390 (`assets/qa/wp3fix_index_*_fold.png`, view_image read-back);
mobile unchanged (rules removed under 1024px).

Round 2 (browser comment on hero at 1387x1242, "현재상태가 가장 문제"):
the 1181-1500px band still ran a 12.5rem masthead (~14% of width vs the
reference's ~21%) and the hero tracked full viewport height on tall/narrow
desktops, leaving a type-less void. Fix: mid-band scale bump (<=1500px 17rem,
<=1180px 13rem, <=1023px 11rem, <=900px 9.5rem) + hero height capped by
width `min(calc(100svh - 210px), 60vw)` (reference aspect), + `?v=3`
cache-buster on the stylesheet link in all 5 pages. Verified
1387x1242 / 1440x900 / 1995x1240 / 390x844
(`assets/qa/wp3fix2_index_*.png`) — problem viewport now shows the
next-section hint inside the first viewport; mobile unchanged.
