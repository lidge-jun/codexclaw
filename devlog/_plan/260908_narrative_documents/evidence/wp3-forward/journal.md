# journal.md — wave log

All times UTC. Opens counted per SEARCH-DEEP-03 budget (cap 12).

## Wave 1 — repository liveness (F1)

**Searched.** GitHub REST `/repos/{owner}/{repo}` for all six seed candidates.
Discovery lane F4 (hosted `web_search` for missed leaders) was **not run**: wave 1
already surfaced a successor lead (`langchain-ai/deepagents`) from inside opened
evidence, and the open budget was better spent proving it than discovering more.

**Tooling note.** The first attempt used unauthenticated `curl` against
`api.github.com` and returned HTTP 403 rate-limit bodies for all six requests
(`"API rate limit exceeded for 218.152.18.150"`). These are failed opens, not
evidence, and are not counted. The identical endpoints were re-run through
authenticated `gh api repos/<owner>/<repo>`, which is the same REST resource.
Counted opens are the authenticated ones.

**Found (opens 1–6, all Tier 2).**

| repo | stars | pushed_at | archived | license |
|---|---|---|---|---|
| langchain-ai/open_deep_research | 12675 | 2026-08-10 | **true** | MIT |
| assafelovic/gpt-researcher | 29337 | 2026-08-27 | false | Apache-2.0 |
| stanford-oval/storm | 31247 | 2025-09-30 | false | MIT |
| dzhng/deep-research | 19650 | 2026-04-11 | false | MIT |
| bytedance/deer-flow | 81881 | 2026-09-08 | false | MIT |
| modelscope/ms-agent | 4380 | 2026-09-07 | false | Apache-2.0 |

**Decisive result.** The seed set was wrong in one place: `open_deep_research` is
archived (read-only), which removes the framework most readers would name first.
STORM's last push is 2025-09-30, roughly eleven months before the research date.

**Open after wave 1.** Loop architecture per repo; citation handling; what
replaced the archived LangChain repo.

## Wave 2 — loop shape, citations, successor (F2, F3, successor lead)

**Searched.** `raw.githubusercontent.com/<repo>/main/README.md` for the five
non-archived seeds, plus REST metadata for `langchain-ai/deepagents`.

**Found (opens 7–12, all Tier 2, HTTP 200).**

- gpt-researcher README: planner/execution split, plus a "Deep Research" recursive
  tree-like workflow with configurable depth and breadth; citations named as a
  core output property; separate LangGraph/AG2 multi-agent assistant.
- dzhng/deep-research README: explicit breadth and depth parameters with a
  recursive `depth > 0` continuation; sources and references compiled at report time.
- storm README: two-stage pre-writing/writing pipeline built for citations;
  perspective-guided question asking and simulated conversation; Co-STORM adds a
  turn-managed discourse protocol.
- deer-flow README: super-agent harness on LangGraph where a lead agent spawns
  scoped sub-agents; sub-agents documented as an optimization, not the default.
- ms-agent README: "Researcher + tool-augmented sub-agents (Searcher/Reporter)"
  with a decoupled evidence store and report generator; DeepResearch Bench score claimed.
- deepagents: 29121 stars, pushed 2026-09-07, not archived, MIT — the live
  LangChain-org harness standing where open_deep_research stopped.

**Remaining open.** Nothing that the budget allows to close; see gap-matrix.md.

## Stop

**Budget stop fired** at the stated 2-wave / 12-open cap (SEARCH-DEEP-03). The
three-consecutive-no-new-lead stop did not fire — wave 2 still produced new leads.

## Spot-check

Before synthesis the highest-impact claim (open_deep_research is archived) was
re-opened independently via `gh api repos/langchain-ai/open_deep_research --jq '.archived'`
→ `true`, `pushed_at` → `2026-08-10T18:13:37Z`. `archived_at` is null in the payload,
so the archive *date* is unknown and is not claimed anywhere in the report.

