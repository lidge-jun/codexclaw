# plan.md — WP3-forward deep research

## SEARCH-DEEP-01 Scope

- **Question.** As of September 2026, which open-source deep-research agent frameworks on GitHub are actively maintained, what loop architecture does each use (recursive breadth/depth vs orchestrator-worker), and which one should a small team adopt for a citation-heavy research bot?
- **Reader.** An engineering lead choosing a framework within one week. Reads to decide adopt/skip, so the deliverable is a comparison with a single named recommendation.
- **Assumed expertise.** Comfortable with Python/TypeScript agent stacks and LLM API costs; does not know these six projects' internals.
- **Decision they make.** Pick one framework to prototype a citation-heavy research bot on.
- **Time period / geography.** Repository state as of 2026-09-08 UTC; global, English-language sources.
- **Entities (verify, do not trust).** langchain-ai/open_deep_research, assafelovic/gpt-researcher, stanford-oval/storm, dzhng/deep-research, bytedance/deer-flow, modelscope/ms-agent.
- **Exclusions.** No subagent delegation, no Aside lane, no hosted paid research products, no vendored source text.
- **Deliverable.** `report.html`, self-contained, reader-documents structure (READER-DOC-01..04), at least one inline SVG or table. Every number, date and license traces to an opened URL.
- **Deadline.** This session.

## Consequential claims needing primary evidence

1. Maintenance status: last push date, archived flag, license, star count per repo.
2. Loop architecture per repo: recursive breadth/depth expansion vs orchestrator-worker supervisor.
3. Citation behavior: whether the framework emits source-anchored citations by default.
4. Adoption fit for a small team: language, deployment weight, license permissiveness.

## SEARCH-DEEP-02 Query families

| # | Family | Goal | A hit unlocks |
|---|---|---|---|
| F1 | Repository metadata (GitHub REST API) | Maintenance liveness | archived/pushed_at/license/stars, all Tier 2 |
| F2 | README / architecture docs (raw.githubusercontent.com) | Loop shape | orchestrator-worker vs recursive depth/breadth |
| F3 | Citation handling | Report quality | whether citations are first-class or bolted on |
| F4 | Candidate set completeness | Rival hypothesis: the seed list misses a leader | new candidate repos via hosted search |

## Budget (stated before wave 1)

Comparison shape: **2 waves, max 12 source opens total, no subagents.**

- Wave 1: 6 opens — GitHub REST API metadata for all six seeds (F1). Hosted `web_search` for F4 discovery (Tier 1, not counted as opens).
- Wave 2: up to 6 opens — README/docs for the surviving candidates (F2, F3).

## Stop rule

Stop at 2 waves (budget cap) or earlier if three consecutive no-new-lead results. Record which fired.

## Assumptions

- GitHub REST API `pushed_at` is the maintenance signal; `archived` is authoritative for abandonment.
- Star counts are popularity snapshots, not adoption of the architectural pattern (per source-hierarchy note).

