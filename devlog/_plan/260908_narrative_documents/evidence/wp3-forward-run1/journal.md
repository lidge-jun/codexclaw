# Journal — wave log

Audit artifact (READER-DOC-04). Not the reader deliverable.

## Wave 1 — discovery (Tier 1 only)

**Date:** 2026-09-08 (Asia/Seoul)

**Queries issued (hosted web_search, 5 in one batch):**

1. `open source deep research agent frameworks GitHub 2026` (family F1)
2. `LangChain open_deep_research supervisor architecture` (F3)
3. `gpt-researcher architecture planner executor citations` (F3/F4)
4. `dzhng deep-research breadth depth recursive` (F3)
5. `STORM Co-STORM Stanford OVAL GitHub deep research` (F1/F3)

**Returned to the agent:** results for queries 1 and 2 only. Results for queries 3, 4 and 5 were
not delivered into the agent's context before the run was cut. They are recorded here as
ISSUED / NOT RETURNED so a later wave does not assume they were answered.

**What was found (candidate level):**

- A landscape roundup naming eight candidate repositories plus four general-purpose agent
  frameworks. This satisfied F1's stated goal of confirming the candidate set is search-derived
  rather than memory-derived, and it surfaced projects that were not in the plan's assumed set:
  MiroFlow, SkyworkAI DeepResearchAgent, Alibaba-NLP DeepResearch (Tongyi), modelscope MS-Agent,
  OPPO-PersonalAI O-Researcher, and AutoSearch.
- A detailed architectural description of LangChain Open Deep Research as a LangGraph supervisor
  / orchestrator-worker loop: clarify, research brief, supervisor, parallel researcher sub-agents
  with isolated context, compression, final report writer.

**What remains open:**

- Every maintenance claim. No repository page, commit history, or release list was opened.
  "Actively maintained" is therefore unanswered for all eight candidates.
- The recursive breadth/depth branch of the architecture question. The two projects expected to
  represent it (dzhng/deep-research, STORM/Co-STORM) had their queries issued but not returned,
  so no evidence exists for them at any tier.
- Citation handling beyond one snippet phrase per project.
- F5 (the "build it yourself" opposing view) was never issued.

**Stop rule status:** wave 2 was not run and no source was opened. The stop that fired was an
external instruction to answer from wave-1 results, not one of the plan's own stop conditions
(sufficiency / 2 waves / 12 opens / three no-new-lead waves). Source opens used: **0 of 12**.

## Wave 2 — not run

Planned and budgeted, not executed. The gap matrix records what it would have to close.

