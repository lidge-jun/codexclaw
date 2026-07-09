# 001 — Reference Landscape: LLM-driven divergence / quality-diversity search

Status: RESEARCH · 2026-07-01 · cxc-search Tier 1 discovery (primary sources listed)

> The four bodies of work below are the established answer to "iteratively improve a
> program against a deceptive/expensive objective." Each supplies one missing piece of
> the divergence layer that PABCD/jawcode/lazycodex all lack. Cited as candidate
> primary sources (Tier 1); open the arXiv/Nature PDF (Tier 2) before quoting a specific
> numeric result. The *mechanisms* are corroborated across all four.

## Source-Proof note

Tier 1 web search returned a model-written summary asserting "islands are not a core
AlphaEvolve concept." Treat that as unproven snippet text. FunSearch's own Nature paper
documents an **islands (population subgroups) model** for preserving diversity; AlphaEvolve
generalizes FunSearch. The conservative, source-safe framing used here: the
**programs-database + evaluator-scored evolution** is the shared core; the
**diversity-preservation structure** (islands / MAP-Elites cells / novelty archive) is the
specific divergence mechanism. Confirm exact wording in the PDFs before implementation.

## S1 — AlphaEvolve (DeepMind, 2025)

- Primary: arXiv:2506.13131 "AlphaEvolve: A coding agent for scientific and algorithmic
  discovery"; DeepMind blog (deepmind.google/blog/alphaevolve-...).
- Core loop: LLM (Gemini) proposes program *diffs* → **automated evaluator** scores each
  candidate → a **programs database** stores scored candidates → high-scoring + diverse
  parents are sampled back into the prompt to evolve further.
- What it contributes to our gap: the canonical shape of a real divergence loop —
  generate many candidates, score every one on the true objective, keep a *database* of
  scored variants (not a single current best), and sample parents for the next round.
  This is exactly the "population + objective-bound scoring" PABCD has zero of.

## S2 — FunSearch (DeepMind, Nature 2024)

- Primary: Romera-Paredes et al., "Mathematical discoveries from program search with large
  language models," Nature (2024); DeepMind blog (deepmind.google/blog/funsearch-...).
- Core loop: LLM generates a function → evaluator scores it on a problem-specific metric →
  best programs are stored in an **islands** model (multiple sub-populations) so diversity
  is preserved and the search does not collapse onto one lineage.
- What it contributes: the **evaluator-as-truth** discipline (the score function is the
  objective, and only it decides survival) plus **islands** as a concrete
  diversity-preservation structure. Directly answers the "C/D bound to command-shape, not
  true objective" defect in `structure/50_emergence_gap.md`.

## S3 — Novelty Search & MAP-Elites (Lehman & Stanley; Mouret & Clune)

- Primary: Lehman & Stanley, "Abandoning Objectives: Evolution Through the Search for
  Novelty Alone" (2011); Mouret & Clune, "Illuminating search spaces by mapping elites,"
  arXiv:1504.04909 (2015).
- Core idea: on **deceptive** objectives, optimizing the objective directly gets stuck;
  rewarding **behavioral novelty** (or keeping the best solution per behavior *cell* in a
  MAP-Elites grid) escapes local optima and illuminates the whole space.
- What it contributes: the **plateau → diversify** mechanism. When the true metric stalls,
  the harness should reward *different behavior* (a new strategy archetype), not another
  patch on the same lineage. This is the antidote to the NYPC "15 phases tweaking one
  garrison strategy" failure.

## S4 — Quality-Diversity (QD) optimization (survey)

- Primary: Cully & Demiris, "Quality and Diversity Optimization: A Unifying Modular
  Framework," arXiv:2012.04322 (and the QD survey literature).
- Core idea: unify "high quality" + "behavioral diversity" into one framework — keep an
  archive of candidates that are each the best in their behavioral niche, not one global
  champion.
- What it contributes: the **archive data model** for a no-server port. A QD archive is
  just a keyed table of {behavior descriptor → best candidate + its true-objective score}.
  That maps cleanly to "files + a ledger," which is what codexclaw can persist without a
  daemon.

## Synthesis — the four missing pieces, named

| Piece | Source | PABCD has it? | jawcode autoresearch? | lazycodex omo? |
| ----- | ------ | ------------- | --------------------- | -------------- |
| Candidate **population/database** (not single best) | S1, S2 | no | no (single line + keep/discard) | no |
| **Evaluator = true objective** decides survival | S1, S2 | no (exitCode/PASS) | partial (METRIC, user-defined) | no (receipt-shape) |
| **Diversity preservation** (islands / MAP-Elites / novelty) | S2, S3, S4 | no | no | no |
| **Plateau → inject exploration** (abandon-objective trigger) | S3 | no (turn-cap) | no (max-iter off) | no (process-cap) |

This table is the whole point: every sibling harness is missing the same four pieces, and
the literature names each one. The design doc (`002`) maps them onto PABCD + hooks.
