---
created: 2026-07-11
tags: [codexclaw, pabcd-initiative, docs-site, detail-pages, impl-record]
---

# WP4 impl record — detail pages

Status: DONE (cycle closed 2026-07-11; dispositions were recorded
pre-synthesis per DISPATCH-ECONOMY-01 clause 2)

## A-gate trail

- Round 1 (Hypatia, same-family): FAIL — 3 blockers (1024 viewport
  regression, non-mechanical evidence verifier, stop-condition mismatch) +
  8 advisories. All ACCEPT -> rev 2.
- Round 2 (Hypatia): FAIL — 1 blocker: reviewer model routing violated
  REVIEW-DECORRELATE-01 (inherited family for the audit dispatch). ACCEPT ->
  rev 3; same-family rounds 1-2 recorded as deviation.
- Round 3 (Russell, gpt-5.6-sol, decorrelated closing verdict): pending at
  time of writing; result: FAIL — 1 fresh blocker a same-family reviewer
  missed twice ("every named incident" not mechanically enumerable). ACCEPT
  -> rev 4 (CLOSED incident set {"NEXT NATION","019f4407","2604.20938"}).
- Round 4 (Russell): VERDICT: PASS. Decorrelation earned its keep — live
  in-unit evidence for REVIEW-DECORRELATE-01, cited on the delegation page.

## Triage dispositions — Lane A (Avicenna, origin evidence, 20 findings)

Wave disposition: ACCEPT 19/20, NO-EVIDENCE 1.

- #1-#5 (NEXT NATION incident narrative, debug-line punchline, incident->rule
  pipeline, zero-delta ablation signature, Harbor arXiv corroboration):
  ACCEPT — origin page section (b) centerpiece. #5 note: Harbor
  arXiv 2604.20938 is OUTSIDE the 005 EXACT-SET; per verifier 1 it may only
  be cited as a devlog-anchored quote (file:line), not added to the
  references section. MERGE with that constraint.
- #6-#9 (019f4407 self-completed goal incident, GOAL-COMPLETE-GATE-01,
  render-grounding "done without looking" rationale, "threat model =
  laziness"): ACCEPT — origin section (a).
- #10-#13 (3.5/8 judge vs 96% self-play, economy-opponent plateau,
  visually-broken-but-tsc-green, fixed-seed selection): ACCEPT — origin
  section (c) game-dev problems.
- #14 (game asset pipelines): NO EVIDENCE FOUND — REJECT the planned
  asset-pipeline bullet from the content map; section (c) covers 시각 상태
  검증/비결정성/로컬지표-실지표 갭 only. (Plan content map amended by this
  disposition; no unanchored claim ships.)
- #15-#17 (context pressure != budget exhaustion, 019f4407 context-cited
  close, files-not-chat-history continuity): ACCEPT — origin section on
  context collapse.
- #18-#20 (attest mechanism, form-only gate philosophy, "all tests green"
  does not satisfy activation grounding): ACCEPT — origin section (d).

## Triage dispositions — Lane B (Leibniz, skills/loop evidence, 24 findings)

Wave disposition: ACCEPT 24/24, 2 with merge notes.

- #1-#3 (architecture naming, 75-grade provenance, 13-skill roster with
  verbatim one-liners): ACCEPT — skills page intro + roster table.
- #4-#9 (tiered reference loading, FAMILY-FRESH-01, DEV-ROUTE-01,
  subagent routing-table-only, implicit-visible set, structure/INDEX
  confirmation): ACCEPT — skills page router/references section. #8/#9
  MERGE: cite one of the two (plugin SKILL.md preferred; INDEX as backup).
- #10-#15 (five hardening rules: README summary + verbatim definitions):
  ACCEPT — skills page rules section.
- #16-#23 (HITL/HOTL contract, GOAL-IDLE-CONTINUE-01, goalplan contract
  fields, E8 + GOAL-COMPLETE-GATE-01, hook deny conditions, no-downward
  redefinition, divergence policy, collapse mode command): ACCEPT — loop
  page. #23 MERGE note: cite the command as mechanics detail, small print.
- #24 (C0-C5 classifier): ACCEPT — skills page depth-scaling paragraph.
- Roster-count caution (13 in pabcd_initiative vs 15 dev-prefixed dirs in
  codexclaw): ACCEPT — skills page states the canonical count and the
  downstream-port divergence explicitly.

## Synthesis ownership

Korean editorial copy, page composition, and claim triage above are
main-owned (judgment). Lanes settled nothing; every claim that ships carries
its lane anchor or is dropped.

## Build + check record (C/D)

Shipped: `pages/{origin,skills,delegation,loop}.html` full bodies (Korean
editorial, section markers A-E, `.evidence` verbatim blocks, `.refnote`
anchors) + additive neutral components in `site.css` (refnote/evidence/rules
table — ink/neutral only, accent untouched).

Verifier results:
1. Evidence audit (mechanical): rule-ID regex, closed incident set, and
   arXiv IDs — every hit chunk anchored; arXiv links exactly within the 005
   EXACT-SET (10/10, delegation page only); 40 anchor paths resolved on disk
   (roster refnote uses an explicit glob, 13/13 SKILL.md verified);
   `rg -i "todo|lorem|placeholder|TBD" pages/` empty.
2. Browser QA: 16 captures (4 pages x 390/768/1024/1440) in `assets/qa/`
   `wp4_*`; view_image read-back across all widths — no overlap/overflow,
   Pretendard/Archivo render over local HTTP with network on.
3. Link + asset sweep: 13/13 targets HTTP 200 (pages, css, webp cutouts,
   hero/print bitmaps).
Regression guard: `npm run gate` OK after all edits.
