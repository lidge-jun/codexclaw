---
name: cxc-search
description: "Use for web/current lookups. Triggers: search, look up, latest, news, prices, docs, status, X/Twitter, deep research, 검색, 검색해, 찾아봐, 찾아줘, 알아봐, 웹검색, 딥리서치, 심층 조사."
metadata:
  last-verified: "2026-09-08"
  short-description: "Codex-native unified search: discover -> prove -> deep-research ladder with Aside lane and Korean intent guard."
---

# search — Unified Search Hub

Search discipline for any lookup that leaves the repository. This skill is
implicit-visible as metadata (`allow_implicit_invocation: true`); load the
full body on explicit trigger or `dev`-hub routing, never by an external
dispatcher.

## Source-Proof Invariant (read first)

Search results are **candidate URLs, not evidence.** Snippets, summaries, and
search-result consensus discover where a fact might live; they never settle it.
When recency, factual accuracy, version/compatibility, or source attribution
matters, open the original page and confirm it before you treat the answer as
sufficient. This invariant precedes every sufficiency rule below — no tier may
declare an answer final on snippet text alone.

## The Ladder (exactly three codex-native tiers)

### Research-depth classifier (SEARCH-DEPTH-01)

Before climbing the ladder, name the depth — it is distinct from the target classifier in the
Korean Intent Guard (which picks web vs docs vs repo):

- **latest/current fact** — one entity, a version/date/price/status. Tier 1 discover + Tier 2
  open one primary source. Capture the exact date.
- **official-doc fact** — API/library behavior. Prefer official docs first, then open for proof.
- **implementation/source fact** — how something is built. Open the source/repo, not a summary.
- **comprehensive research** — multi-source/contested. This is the only depth that justifies
  Tier 3 ([Deep research](references/deep-research.md)); ordinary latest/current lookups never
  auto-escalate to a subagent swarm.

## Target routing

Classify external/public/current information, official-doc behavior, or this repository's code/logs/config before choosing tools; system comprehension routes to `cxc-dev-debugging`.
Before querying, read [Korean Intent Guard](references/intent-guard.md) and [query rewrite](references/query-rewrite.md).

## Conditional References

| Condition | Reference |
| --- | --- |
| Before every query | [Korean Intent Guard](references/intent-guard.md), [query rewrite](references/query-rewrite.md) |
| Discovering candidate URLs (Tier 1) | [Hosted discovery](references/hosted-discovery.md) |
| Opening a source to settle a claim (Tier 2) | [Source-open proof](references/source-open-proof.md) (SEARCH-BROWSE-01) |
| Blocked, JS, PDF or table source | [Blocked-URL reader](references/blocked-url-reader.md) |
| Explicit deep-research request or host mode (Tier 3) | [Entry boundaries](references/deep-research-entry.md), then [Deep research](references/deep-research.md) |
| Any search subagent, including audit/reviewer or Luna lanes | [Skill attachment](references/subagent-attachment.md) (SEARCH-ATTACH-01) |
| PABCD divergence candidates | [Candidate grounding](references/divergence-grounding.md) |
| Luna discovery or assessing available backends | [Discovery boundaries](references/discovery-boundaries.md) |
| Host/tool capability or search integration questions | [Tool notes](references/tool-notes.md) |

## When to stop

Stop escalating when any holds: a sufficient primary source is found and
confirmed; all candidate URLs are dead or unreachable; or the task needs a user
clarification. Do not keep climbing tiers past a confirmed answer, and do not
spend Tier 3 subagents on a question Tier 1+2 already settled.
