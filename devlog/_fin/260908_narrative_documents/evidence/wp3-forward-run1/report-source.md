# Which open-source deep-research framework should a small team adopt?

**Reader:** engineering lead, small team, deciding within a week.
**Date:** 2026-09-08 (Asia/Seoul).
**Type:** research report (READER-DOC-01).

## Direct answer

The evidence gathered does not support a maintenance-based recommendation, and the honest answer
is that this research stopped one step short of the thing you actually need. One discovery wave
ran; **zero sources were opened**, so no commit date, release date, license or star count was read
for any candidate. "Actively maintained" — the first clause of your question — is unanswered for
all eight candidates found.

What the wave does support is a provisional lean and a short verification you can finish in an
afternoon. **Lean toward LangChain Open Deep Research** for a citation-heavy research bot, because
it is the only candidate whose loop was described consistently and specifically by more than one
independent search result, and because its described shape — a supervisor delegating to parallel
researcher sub-agents with isolated context, then a compression step, then a dedicated report
writer — is the shape that makes per-claim citation tractable. Treat that as a hypothesis to
disprove in two hours, not a decision.

## Analysis by sub-question

### 1. Which frameworks are actively maintained?

Unanswered. No repository was opened, so every maintenance signal is missing. One search result
characterized AutoSearch as "appearing actively updated in 2026", but its cited URL was a GitHub
topic index rather than the project repository, and the phrase was the search tool's summary
rather than a read commit date. That is not evidence of maintenance and it is not recorded as
such.

The candidate set itself is search-derived rather than memory-derived, which is worth something:
langchain-ai/open_deep_research, assafelovic/gpt-researcher, MiroFlow, SkyworkAI
DeepResearchAgent, Alibaba-NLP DeepResearch (Tongyi), modelscope MS-Agent, OPPO-PersonalAI
O-Researcher, and AutoSearch. Of these, O-Researcher was described as a data-synthesis and
training framework, which may not be a deployable research runtime at all.

### 2. What loop architecture does each use?

Only one is described with enough specificity to classify. **Open Deep Research** is an
orchestrator-worker loop: a clarification step, a research brief, a supervisor that spawns
parallel researcher sub-agents each holding isolated context, a compression stage, and a final
report writer. Model roles are split across summarization, research, compression and report
generation, and the models must support tool calling and structured output.

**SkyworkAI DeepResearchAgent** was described as hierarchical with a top-level planner and
specialized sub-agents, which sounds orchestrator-worker but is not specific enough to
distinguish from recursive decomposition. The rest carry no architectural description at all.

The recursive breadth/depth pole of your question is entirely unevidenced. The two projects
expected to represent it, dzhng/deep-research and Stanford STORM/Co-STORM, had queries issued but
their results never returned. With one pole missing, the recursive-versus-orchestrator-worker
comparison you asked for cannot be drawn from this research.

### 3. Which should a small team adopt for a citation-heavy bot?

Citation handling is the decision driver and it is the weakest-evidenced dimension here. GPT
Researcher was described as producing "cited reports", but nothing in the wave describes the
mechanism — specifically whether source URLs are carried through as data alongside retrieved text
or re-emitted by the model at write time. That distinction is the whole ballgame for a
citation-heavy bot, because a model that re-emits URLs from memory at report time will invent
them.

This gives you the concrete test to run. For each finalist, find where retrieved content and its
source URL travel together through the pipeline, and check whether the report writer receives the
URL as a field it copies or as text it regenerates.

## Limitations

- Zero of a budgeted twelve source opens were used. Every claim is Tier 1, discovered in a search
  result and never confirmed in the source.
- Three of five planned queries were issued but never returned results, removing the recursive
  architecture branch.
- The opposing view — that a small team should build the loop directly on an agent SDK and skip
  the framework — was never tested. For a team of two to five, this deserves real weight: these
  loops are a few hundred lines, and a framework you must debug is worse than a loop you wrote.
- The MiroFlow arXiv identifier appeared in a search result and was never checked for existence.
  Do not cite it without opening it.

## Recommendation

Spend two hours before committing. Open the four most plausible repositories — Open Deep Research,
GPT Researcher, SkyworkAI DeepResearchAgent, Alibaba-NLP DeepResearch — and for each read three
things: the commit history for the last ninety days, the license file, and the code path where a
retrieved source URL reaches the report writer. That converts this report's provisional lean into
a decision, and it fits comfortably inside your week.

If the two hours confirm Open Deep Research is maintained and carries source URLs as structured
data, adopt it. If it fails either test, the orchestrator-worker shape is still the right target,
and building it yourself on an agent SDK is a defensible second choice for a team your size.

## Sources

All sources are Tier 1 (discovered, not opened). See `ledger.md` for the full record.

1. langchain-ai/open_deep_research — https://github.com/langchain-ai/open_deep_research — NOT OPENED
2. assafelovic/gpt-researcher — https://github.com/assafelovic/gpt-researcher — NOT OPENED
3. SkyworkAI/DeepResearchAgent — https://github.com/SkyworkAI/DeepResearchAgent — NOT OPENED
4. Alibaba-NLP/DeepResearch — https://github.com/Alibaba-NLP/DeepResearch — NOT OPENED
5. modelscope/ms-agent — https://github.com/modelscope/ms-agent — NOT OPENED
6. OPPO-PersonalAI/O-Researcher — https://github.com/OPPO-PersonalAI/O-Researcher — NOT OPENED
7. MiroFlow (paper) — https://arxiv.org/abs/2602.22808 — NOT OPENED, identifier unverified
8. GitHub research-agent topic index — https://github.com/topics/research-agent — NOT OPENED

