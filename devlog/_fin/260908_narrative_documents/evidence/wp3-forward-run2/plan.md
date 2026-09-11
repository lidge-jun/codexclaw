# Plan — open-source deep-research agent frameworks (Sept 2026)

## Reader contract (READER-DOC-01)
- **Who reads this:** an engineering lead at a small team, deciding within one week.
- **What they decide:** which open-source deep-research agent framework to adopt for a citation-heavy research bot.
- **What they already know:** LLM agents, Python/TS services, retrieval basics. They do not know these specific repos.
- **Document type:** research report (direct answer -> analysis by sub-question -> limits -> sources).

## Question
As of September 2026, which open-source deep-research agent frameworks on GitHub are actively
maintained, what loop architecture does each use (recursive breadth/depth vs orchestrator-worker),
and which one should a small team adopt for a citation-heavy research bot?

## Scope
- Time period: repository state observable in September 2026; recency judged by last push/release date.
- Geography: none (global open source).
- Entities: candidate GitHub repositories whose stated purpose is autonomous/deep research report generation.
- Exclusions: closed/hosted-only products, generic agent frameworks with no research loop, single-file demos with no license.
- Depth: comparison shape.

## Consequential claims needing primary evidence
1. Maintenance status — last commit/push date, release cadence, open-issue posture. Source: GitHub API repo + commits + releases.
2. Loop architecture — recursive breadth/depth vs orchestrator-worker vs pipeline. Source: repository README / source files.
3. License — exact SPDX id. Source: GitHub API `license` field and/or raw LICENSE file.
4. Citation handling — whether the loop carries source URLs into the output.

## Budget (stated before wave 1)
- Comparison shape: 2 waves, **max 12 source opens**, no subagents, no Aside.
- Wave 1: Tier 1 hosted `web_search` discovery + Tier 2 opens on strongest candidates.
- Wave 2: gap-fill opens for missing license/date/architecture evidence, plus spot-check re-opens.
- Stop rule: stop when every framework row has maintenance + architecture + license evidence, OR at 12 opens, OR after 3 consecutive no-new-lead results, OR at wave 5. Record which fired.

## Query families (SEARCH-DEEP-02)
| # | Family | Goal | What a hit unlocks |
|---|---|---|---|
| F1 | Named incumbents (open_deep_research, gpt-researcher, STORM, dzhng/deep-research) | anchor the candidate set | repo URLs for Tier 2 |
| F2 | "actively maintained 2026" / recent surveys and awesome-lists | find newer entrants missed by memory | additional candidate repos |
| F3 | Loop architecture terms (orchestrator-worker, supervisor, recursive breadth depth) | classify each loop | the architecture column |
| F4 | Citation/verification features | pick for a citation-heavy bot | the recommendation |
| F5 | Rival hypothesis: "no framework — build a thin loop yourself" | strongest opposing view | honest non-adoption option |

## Fallback
If hosted `web_search` is unavailable or empty, open sources directly via
`api.github.com/repos/<owner>/<repo>` and `raw.githubusercontent.com` (README/LICENSE).
Those count as Tier 2 opens.

## Deliverables (in this directory only)
plan.md, journal.md, gap-matrix.md, ledger.md, report-source.md, report.html

