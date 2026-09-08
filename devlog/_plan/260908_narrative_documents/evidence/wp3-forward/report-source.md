# Adopt gpt-researcher for a citation-heavy research bot

**Title:** Which open-source deep-research framework should a small team adopt, September 2026
**Reader:** An engineering lead choosing a framework within one week.
**Date:** 2026-09-08. **Repository state:** as returned by the GitHub REST API on that date.

## Scope

Six candidate repositories, supplied as a starting set and verified rather than trusted:
langchain-ai/open_deep_research, assafelovic/gpt-researcher, stanford-oval/storm,
dzhng/deep-research, bytedance/deer-flow, modelscope/ms-agent. One successor candidate
(langchain-ai/deepagents) was added from evidence found during wave 1.

**Excluded:** hosted or paid research products, frameworks not on GitHub, and any claim
not readable in an opened source. **Budget:** 2 waves, 12 source opens, no subagents.

## Assumptions

- `pushed_at` from the REST API is the maintenance signal and `archived` is authoritative
  for abandonment.
- Star counts are popularity snapshots, not evidence that the architecture is adopted.
- README architecture descriptions were read as maintainer statements of intent; no
  loop implementation module was opened within budget.

## Direct answer

**Adopt gpt-researcher.** It is the only candidate that is simultaneously actively
maintained (pushed 2026-08-27), permissively licensed (Apache-2.0), architecturally
sized for a small team, and built around cited reports as its stated output. Its loop is
a planner/execution split with an optional recursive depth-and-breadth mode, so a team
can start with the simple pipeline and turn on recursion only where a topic needs it.

Two corrections to the starting set matter more than the ranking. First,
**langchain-ai/open_deep_research is archived** — read-only, last pushed 2026-08-10. Any
plan that begins with it needs to change. Second, **stanford-oval/storm has not been
pushed since 2025-09-30**, roughly eleven months, which makes it a citation *reference
design* to learn from rather than a dependency to build a product on.

## Maintenance status separates the field before architecture does

| Repository | Stars | Last push | Archived | License | Language |
|---|---|---|---|---|---|
| bytedance/deer-flow | 81,881 | 2026-09-08 | no | MIT | Python |
| modelscope/ms-agent | 4,380 | 2026-09-07 | no | Apache-2.0 | Python |
| assafelovic/gpt-researcher | 29,337 | 2026-08-27 | no | Apache-2.0 | Python |
| dzhng/deep-research | 19,650 | 2026-04-11 | no | MIT | TypeScript |
| stanford-oval/storm | 31,247 | 2025-09-30 | no | MIT | Python |
| langchain-ai/open_deep_research | 12,675 | 2026-08-10 | **yes** | MIT | Python |
| langchain-ai/deepagents | 29,121 | 2026-09-07 | no | MIT | Python |

Sources: ledger rows 1–6, 13. All values read from GitHub REST repo objects on 2026-09-08.

Four repositories are active within the last month. dzhng/deep-research is five months
stale, which is survivable for a 400-line reference implementation and disqualifying for
a dependency. STORM is eleven months stale. open_deep_research is out.

## Two loop shapes, and the choice between them is really a team-size choice

| Framework | Loop architecture | Evidence |
|---|---|---|
| gpt-researcher | Planner generates questions, execution agents gather in parallel, publisher aggregates; a separate Deep Research mode adds tree-like exploration with configurable depth and breadth | README lines 56, 215–217 |
| dzhng/deep-research | Pure recursive breadth/depth: parameterized SERP query fan-out, learnings extracted, recursion continues while `depth > 0` | README lines 72, 182–196 |
| stanford-oval/storm | Neither: a two-stage pipeline (research + outline, then cited writing) driven by perspective-guided question asking; Co-STORM layers a turn-managed discourse protocol | README lines 44–68 |
| bytedance/deer-flow | Orchestrator-worker: a lead agent spawns isolated-context sub-agents on LangGraph, with sub-agents documented as an optimization rather than the default | README lines 12, 879, 1218–1226 |
| modelscope/ms-agent | Orchestrator-worker: Researcher plus tool-augmented Searcher/Reporter sub-agents over a decoupled evidence store | README lines 338, 341 |

The split is clean. Recursive breadth/depth designs (dzhng, and gpt-researcher's deep mode)
expand a query tree and control cost with two integers. Orchestrator-worker designs
(deer-flow, ms-agent) delegate to sub-agents with isolated context, which buys parallelism
and specialist behavior at the price of a harness a small team must operate. gpt-researcher
sits between them and lets a team pick per task.

## For citation-heavy output, three frameworks state it as a design goal

STORM is the strongest on this axis on paper: its whole two-stage design exists to produce
long articles *with citations*, collecting references before writing rather than after.
gpt-researcher states that reports are "detailed, factual, and unbiased ... with citations."
MS-Agent ships a decoupled evidence store and report generator, which is the right shape
for provenance. dzhng compiles sources and references at report generation. DeerFlow's
README covers sub-agent receipts and provenance for tool calls, but its scope is a general
super-agent harness rather than a citation pipeline.

Since STORM is not actively pushed, the practical path is to build on gpt-researcher and
borrow STORM's ordering — gather and pin references first, write against that fixed set —
which is exactly what the archived-and-stale evidence permits recommending.

## Why not the others

**deer-flow** is the most active and by far the most starred, but it is a super-agent
harness for long-horizon work with sandboxes, memory, skills, and a message gateway. Its
897 open issues and the breadth of its README are the signal: a small team adopting it
inherits a platform. Choose it only if you also want the coding and long-horizon surfaces.

**ms-agent** is credible and current, with the cleanest evidence-store story, and it claims
#2 open-source on DeepResearch Bench at 55.31. That number is the vendor's own README claim;
the leaderboard was not opened within budget, so treat it as unverified.

**dzhng/deep-research** is the best thing to read and the worst thing to depend on. It is
deliberately the simplest implementation of the loop, in TypeScript, and five months stale.
Copy the loop, do not import the repo.

**open_deep_research** is archived. **deepagents** in the same organization is live (29,121
stars, pushed 2026-09-07, MIT), but no opened source declares it the successor, so that
relationship stays an open question rather than a recommendation.

## Limits and disagreements

- Architecture claims come from READMEs, not from reading loop implementations. A README
  can describe intent that the code has drifted from.
- No output-quality comparison was run. Nothing here says which framework produces better
  citations, only which ones are designed around them.
- Star counts measure attention, not adoption of the architecture.
- STORM's eleven-month gap is a fact; calling it abandonment is an inference. No maintainer
  statement was opened.
- The candidate-set completeness lane was not run, so a leading framework outside these
  seven could have been missed.
- MS-Agent's benchmark standing is self-reported and unverified.

## Open questions

1. Is deepagents the official successor to open_deep_research?
2. Does MS-Agent's DeepResearch Bench claim hold on the independent leaderboard?
3. Is STORM deliberately finished, or unmaintained?

## Recommendation

Prototype on **gpt-researcher** this week. Run its standard planner/execution pipeline
first, enable the recursive depth/breadth mode only for topics that need it, and adopt
STORM's reference-before-writing ordering for citation fidelity. Revisit deer-flow only if
the roadmap grows beyond research into long-horizon agent work.

## Sources

1. GitHub REST — langchain-ai/open_deep_research. https://api.github.com/repos/langchain-ai/open_deep_research (retrieved 2026-09-08)
2. GitHub REST — assafelovic/gpt-researcher. https://api.github.com/repos/assafelovic/gpt-researcher (retrieved 2026-09-08)
3. GitHub REST — stanford-oval/storm. https://api.github.com/repos/stanford-oval/storm (retrieved 2026-09-08)
4. GitHub REST — dzhng/deep-research. https://api.github.com/repos/dzhng/deep-research (retrieved 2026-09-08)
5. GitHub REST — bytedance/deer-flow. https://api.github.com/repos/bytedance/deer-flow (retrieved 2026-09-08)
6. GitHub REST — modelscope/ms-agent. https://api.github.com/repos/modelscope/ms-agent (retrieved 2026-09-08)
7. GitHub REST — langchain-ai/deepagents. https://api.github.com/repos/langchain-ai/deepagents (retrieved 2026-09-08)
8. gpt-researcher README. https://raw.githubusercontent.com/assafelovic/gpt-researcher/main/README.md (retrieved 2026-09-08)
9. dzhng/deep-research README. https://raw.githubusercontent.com/dzhng/deep-research/main/README.md (retrieved 2026-09-08)
10. STORM README. https://raw.githubusercontent.com/stanford-oval/storm/main/README.md (retrieved 2026-09-08)
11. DeerFlow README. https://raw.githubusercontent.com/bytedance/deer-flow/main/README.md (retrieved 2026-09-08)
12. MS-Agent README. https://raw.githubusercontent.com/modelscope/ms-agent/main/README.md (retrieved 2026-09-08)

