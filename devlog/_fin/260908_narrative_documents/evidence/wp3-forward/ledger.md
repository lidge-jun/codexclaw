# ledger.md — claim to source

Tier 2 = source opened and the claim read in it. Tier 1 = discovered only.
All rows below are Tier 2 unless marked. Retrieved 2026-09-08.

| # | Claim | Source | Publisher | Date on source | URL | Tier | Confidence | Contradiction |
|---|---|---|---|---|---|---|---|---|
| 1 | open_deep_research is archived; 12,675 stars; pushed 2026-08-10T18:13:37Z; MIT; Python | GitHub REST repo object | GitHub | pushed_at 2026-08-10 | https://api.github.com/repos/langchain-ai/open_deep_research | 2 | high | none |
| 2 | gpt-researcher not archived; 29,337 stars; pushed 2026-08-27T19:34:56Z; Apache-2.0; Python | GitHub REST repo object | GitHub | pushed_at 2026-08-27 | https://api.github.com/repos/assafelovic/gpt-researcher | 2 | high | none |
| 3 | storm not archived; 31,247 stars; pushed 2025-09-30T18:07:21Z; MIT; Python | GitHub REST repo object | GitHub | pushed_at 2025-09-30 | https://api.github.com/repos/stanford-oval/storm | 2 | high | none |
| 4 | dzhng/deep-research not archived; 19,650 stars; pushed 2026-04-11T23:58:25Z; MIT; TypeScript | GitHub REST repo object | GitHub | pushed_at 2026-04-11 | https://api.github.com/repos/dzhng/deep-research | 2 | high | none |
| 5 | deer-flow not archived; 81,881 stars; pushed 2026-09-08T01:21:38Z; MIT; Python; 897 open issues | GitHub REST repo object | GitHub | pushed_at 2026-09-08 | https://api.github.com/repos/bytedance/deer-flow | 2 | high | none |
| 6 | ms-agent not archived; 4,380 stars; pushed 2026-09-07T17:40:25Z; Apache-2.0; Python | GitHub REST repo object | GitHub | pushed_at 2026-09-07 | https://api.github.com/repos/modelscope/ms-agent | 2 | high | none |
| 7 | gpt-researcher uses planner + execution agents and a publisher; Deep Research adds "tree-like exploration with configurable depth and breadth"; reports carry citations | README.md lines 27, 56, 215–217 | assafelovic | untagged, fetched 2026-09-08 | https://raw.githubusercontent.com/assafelovic/gpt-researcher/main/README.md | 2 | high | none |
| 8 | dzhng/deep-research recurses while `depth > 0`, driven by explicit breadth/depth parameters (breadth 3–10 default 4; depth 1–5 default 2) and compiles sources/references into the report | README.md lines 72, 140–141, 182–196 | dzhng | untagged, fetched 2026-09-08 | https://raw.githubusercontent.com/dzhng/deep-research/main/README.md | 2 | high | none |
| 9 | STORM splits citation-bearing article generation into pre-writing (research + outline) and writing stages; uses perspective-guided question asking and simulated conversation; Co-STORM adds a turn-managed collaborative discourse protocol and mind map | README.md lines 44–68 | Stanford OVAL | untagged, fetched 2026-09-08 | https://raw.githubusercontent.com/stanford-oval/storm/main/README.md | 2 | high | none |
| 10 | DeerFlow is a super-agent harness on LangGraph where a lead agent spawns isolated-context sub-agents; README states "Sub-agents are an optimization, not the default response to a complex request" | README.md lines 12, 879, 1218–1226, 1368 | ByteDance | untagged, fetched 2026-09-08 | https://raw.githubusercontent.com/bytedance/deer-flow/main/README.md | 2 | high | none |
| 11 | MS-Agent Agentic Insight v2 uses a "Researcher + tool-augmented sub-agents (Searcher/Reporter)" architecture with a decoupled todo list / evidence store / report generator | README.md lines 338, 341 | ModelScope | untagged, fetched 2026-09-08 | https://raw.githubusercontent.com/modelscope/ms-agent/main/README.md | 2 | high | none |
| 12 | MS-Agent claims #2 open-source (#5 overall) on DeepResearch Bench, score 55.31 (Qwen3.5-Plus + GPT 5.2) | README.md lines 59, 337 | ModelScope (self-reported) | changelog entry dated Apr 09, 2026 | https://raw.githubusercontent.com/modelscope/ms-agent/main/README.md | 2 | medium — vendor self-report, benchmark page not opened | none found within budget |
| 13 | langchain-ai/deepagents is live: 29,121 stars, pushed 2026-09-07T21:25:35Z, not archived, MIT, "The batteries-included agent harness" | GitHub REST repo object | GitHub | pushed_at 2026-09-07 | https://api.github.com/repos/langchain-ai/deepagents | 2 | high | none |
| 14 | open_deep_research `archived_at` is null, so the archive date is unknown | GitHub REST repo object (spot-check) | GitHub | n/a | https://api.github.com/repos/langchain-ai/open_deep_research | 2 | high | none |

## Not promoted (Tier 1 or unproven)

- That deepagents is the *official successor* to open_deep_research. The
  repository metadata proves both facts (one archived, one live in the same org)
  but no opened source states a succession relationship. Listed as an open question.
- DeepResearch Bench standings independent of the ms-agent README (row 12).
- Whether STORM's 2025-09-30 push reflects abandonment or a finished research
  artifact. No maintainer statement was opened.

