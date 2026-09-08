# wp3 audit — deep research mode and Aside lane

VERDICT: NEAR-PASS

Scope: uncommitted diff + new `plugins/codexclaw/skills/search/references/deep-research.md`
against `020_deep_research.md`, host `deep-research-work` 0.1.14, and `aside-jun` SKILL.md.

## What passes

- Every planned MODIFY landed. Frontmatter triggers (딥리서치 / 심층 조사 / deep-research),
  `last-verified: 2026-09-08`, Tier 3 stub with Boundaries kept, classifier link,
  Tier 2 Aside pointer, Notes host-precedence bullet, browser-routing row. SKILL.md
  268 -> 240 lines. The `skill-ownership.md` SEARCH-DEEP row is already at HEAD:32,
  so its absence from the diff is correct, not a miss.
- No content loss from old Tier 3 §98–157: EXPAND -> SEARCH-DEEP-02; waves and the
  three-no-new-lead / five-wave stop rule -> deep-research.md:34–53; journal -> :121–125;
  claim ledger -> :96–105; grounding is carried by the Source-Proof Invariant
  (SKILL.md:17–24), :96–97 "Never invent URLs", and deep-research.md:79–80, :118.
- Host alignment holds across all five steps: scope/plan, gap matrix, source order,
  report-source.md with gapless citations, artifact + render verification, delivery.
- Six relative links resolve (check-links.mjs, 4 files, missing 0).
- Aside lane does not overclaim: guard-by-default with an explicit authorization
  condition for `--permission full-access` is stricter than aside-jun's own default
  and factually sound, since the log redirect is Codex-side, not an Aside file write.

## Blockers

B1. deep-research.md:75–77 — the Aside brief omits the mandatory no-questions clause.
aside-jun:275–287 makes this the single hardest constraint: `aside exec` is
non-interactive, `ask_user_question` is absent from the CLI catalog, and a question
ends the run with exit 0 and silently incomplete work. Add the verbatim clause.

B2. deep-research.md:77 — running under guard needs the guard-specific fence
(aside-jun:263–266: file tools only under `~/.aside/u/0/`, bash for any other path).
Without it a denied `read_file` drops a step and still exits 0. The current text
recommends guard but not the fence that makes guard safe.

## Nits

- SKILL.md:98–157 removal drops the V1/V2 dispatch mechanics. They survive in
  `pabcd/references/delegation.md`:47–49 and `lunasearch/SKILL.md`:21–25, but neither
  the stub nor deep-research.md:55–64 points there. Add one pointer.
- `search/agents/openai.yaml`:3 still says "3-tier" after SKILL.md dropped it.
- deep-research.md:24 says mirror the plan "when the host exposes a plan tool"; host §1
  says MUST call `update_plan`. Host precedence covers it, but the modal is weaker.
- deep-research.md omits three host §2 behaviours: URL/query dedupe, one bounded retry
  for transient errors, and an independent spot-check of highest-impact claims before
  synthesis.
- The old "at least two explorers, two waves before converging" floor is deliberately
  superseded by direct-retrieval-default; intended, worth a devlog line.
- SKILL.md:123 "the swarm is one-shot agent work" reads oddly beside :112 direct
  retrieval default.


## Fold (main, 2026-09-08)

Blocker 1: no-questions clause added verbatim as clause (3) of the Aside brief. Blocker 2:
guard fence added as clause (1). Nits: dispatch-mechanics pointer to pabcd delegation.md
added in both files; openai.yaml wording updated; update_plan made mandatory when exposed;
dedupe, one bounded retry and pre-synthesis spot-check added; "swarm" sentence reworded.

## Forward-use trials 1 and 2 (main observation)

Both Opus-5 leaves ended their turn after wave 1 (Tier 1 only) with 0 Tier 2 opens and
no report. Run 1 blamed an "external instruction"; run 2 wrote plan.md only. Neither
invented facts, which is the right failure, but the reference let a leaf spend its whole
turn on scope/plan/query families before opening a single source. Fold: SEARCH-DEEP-03
now says wave 1 opens the strongest candidates in the same step as discovery and the
first ledger rows must exist before any further planning; the artifact list is written
incrementally (journal/ledger first, report last).

## Forward-use trial 3 (after the fold)

Completed the protocol: plan → wave 1 (7 GitHub REST + 5 README opens, 6 rate-limited
calls not counted) → journal/ledger/gap-matrix → report-source.md → report.html.
Stop rule: budget (2 waves / 12 opens). Seed set corrected on evidence (open_deep_research
archived; STORM idle since 2025-09-30). Render check (Playwright, file://): 0 page errors,
0 failed requests; 1280 full-page screenshot inspected by main (report-1280.png): answer
callout first, claim headings, comparison table, inline SVG, limits, open questions,
sources, appendix. At 360px the wide table overflows (scrollWidth 657): a trial-artifact
table-wrapper detail, already covered by diagram-viewer DIAGRAM-RENDER-VERIFY-01; not a
reference defect. Runs 1–2 are kept under wp3-forward-run1/run2 as the failed admission
evidence that motivated the "open sources in wave 1" fold.
