# Gap matrix — post-wave-1 reflection

Isolated reflection step, run without any fetch. Every row is at Tier 1: discovered in a search
result, never confirmed by opening the source.

| claim | evidence (URL, date, tier) | confidence | contradiction | missing | next query |
|---|---|---|---|---|---|
| Open Deep Research uses a supervisor delegating to parallel researcher sub-agents (orchestrator-worker) | github.com/langchain-ai/open_deep_research — no date read — Tier 1 | Medium: two independent results agree and name specific roles | none seen | the README and the LangGraph node definitions | open the repo README and graph source |
| GPT Researcher produces cited reports over web, document and local sources | github.com/assafelovic/gpt-researcher — no date read — Tier 1 | Low-Medium: one snippet phrase, no mechanism | none seen | how citations attach to claims; whether URLs are verified or model-emitted | open the docs section on report generation |
| SkyworkAI DeepResearchAgent uses a top-level planner with specialized sub-agents | github.com/SkyworkAI/DeepResearchAgent — no date read — Tier 1 | Low-Medium: one roundup row | none seen | whether "hierarchical" means orchestrator-worker or recursive decomposition | open the README architecture section |
| MiroFlow uses agent graphs and deep-reasoning modes, benchmarked on GAIA/BrowseComp | arxiv.org/abs/2602.22808 — no date read — Tier 1 | Low: abstract cited second-hand, arXiv ID never checked | none seen | the paper, the repo, the loop shape | open the arXiv abstract, find the linked repo |
| Alibaba-NLP DeepResearch (Tongyi) targets long-horizon information seeking with open models | github.com/Alibaba-NLP/DeepResearch — no date read — Tier 1 | Low | none seen | loop architecture, license, maintenance | open the README |
| MS-Agent is a lightweight web/deep-research and document-analysis framework | github.com/modelscope/ms-agent — no date read — Tier 1 | Low | none seen | loop architecture, citation support | open the README |
| O-Researcher is a multi-agent data-synthesis and training framework | github.com/OPPO-PersonalAI/O-Researcher — no date read — Tier 1 | Low | reads as a training/data project, not a deployable research bot | whether it is a runtime framework at all | open the README |
| AutoSearch supports many search channels and "appears actively updated in 2026" | github.com/topics/research-agent — no date read — Tier 1 | Very low | the cited URL is a topic index, not the project repo | the canonical repo URL | locate the repo, then open its commit history |
| **All eight are actively maintained** | **none** | **none — unverified** | — | last commit, last release, issue responsiveness per repo | open each repo's commits and releases |
| Recursive breadth/depth is represented by dzhng/deep-research and STORM/Co-STORM | none — queries issued, results not returned | none — unverified | — | the entire recursive side of the comparison | re-issue both queries, open both repos |
| A small team should build on an agent SDK instead of adopting a framework | none — query never issued | none — untested | — | the strongest opposing view (F5) | search critiques; look for teams who removed a framework |

## What wave 2 must close, in priority order

1. **Maintenance.** Nothing can say "actively maintained" until each repo's commit and release
   history is opened. This is the question's first clause and it is currently unanswerable.
2. **The recursive side of the architecture axis.** Without it the comparison has one pole and
   the "recursive vs orchestrator-worker" framing collapses into a description of one project.
3. **Citation mechanism.** The reader's actual decision driver, supported by one snippet phrase.
4. **The opposing view.** A recommendation that never tested "adopt nothing" is a weak one.

