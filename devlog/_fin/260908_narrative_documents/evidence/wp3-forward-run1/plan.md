# Plan — open-source deep-research agent frameworks (Sept 2026)

## Question
As of September 2026, which open-source deep-research agent frameworks on GitHub are
actively maintained, what loop architecture does each use (recursive breadth/depth vs
orchestrator-worker), and which should a small team adopt for a citation-heavy research bot?

## Reader and decision (READER-DOC-01)
- **Reader:** an engineering lead at a small team (assume 2-5 engineers).
- **Decides:** which single framework to adopt for a citation-heavy research bot, within one week.
- **Already knows:** general agent/LLM engineering; does not know these specific repos' internals.
- **Document type:** research report (direct answer -> analysis by sub-question -> limits -> sources).

## Scope
- **Time period:** maintenance signals as of 2026-09-08 (Asia/Seoul). Repo state is a snapshot.
- **Geography:** none; global open-source projects.
- **Entities (candidate set, to be confirmed by search, not memory):** LangChain
  `open_deep_research`, `gpt-researcher`, Stanford `STORM`/Co-STORM, `dzhng/deep-research`,
  plus anything wave 1 surfaces.
- **Exclusions:** closed/hosted products (OpenAI/Google/Perplexity deep research offerings) except
  as architectural context; paid SaaS; non-GitHub projects.
- **Depth:** comparison shape.
- **Deadline:** this session.
- **Requested format:** self-contained `report.html` with one inline comparison table/SVG, plus
  internal `report-source.md`, `journal.md", `gap-matrix.md`, `ledger.md`.

## Consequential claims needing primary evidence (Tier 2)
1. Each framework is actively maintained (last commit / release date read on GitHub).
2. Each framework's loop architecture, read from its own README/docs/source.
3. Each framework's citation handling, read from its own docs.
4. License, read from the repo.

## Query families (SEARCH-DEEP-02)
| # | Family | Goal | What a hit unlocks |
|---|---|---|---|
| F1 | Landscape roundup "open source deep research agents 2026" | Confirm the candidate set is not memory-derived | Names + repo URLs |
| F2 | Per-repo maintenance state (commits, releases) | Prove "actively maintained" | Objective recency signal |
| F3 | Loop architecture (supervisor/orchestrator-worker vs recursive depth/breadth) | Answer sub-question 2 | The comparison axis |
| F4 | Citation/source-attribution features | Answer the adoption question | The decision driver |
| F5 | Rival hypothesis: "build it yourself / use a plain agent SDK instead of a framework" | Strongest opposing view | Guards against framework bias |

## Budget (stated before wave 1)
- **Waves:** at most 2.
- **Source opens:** at most 12 total.
- **Lanes:** direct retrieval only. No subagents, no Aside (task constraint).
- **Stop rule:** stop when each framework has Tier-2 maintenance + architecture evidence and
  contradictions are bounded; or at 2 waves; or at 12 opens; or after no-new-lead reflection.
  Record which fired.

## Assumptions
- "Actively maintained" = commit activity within roughly the last 3 months of 2026-09-08,
  read from the repository itself. Stated explicitly rather than inferred from stars.
- Star counts are snapshots of repo popularity, not adoption of the loop pattern.

## Anti-invention rule
No URL, date, version, or number appears in any artifact unless it was read in an opened
source. Anything not opened is labeled `NOT OPENED` in the ledger and the report.
