---
name: cxc-search
description: "MUST USE for external, current, real-time, or public-web lookups — latest releases/versions, news, prices, docs, status, X/Twitter, and deep research. Routes Korean and English lookup verbs to a codex-native search ladder, never an accidental repository grep. Triggers: search, look up, latest, current, news, real-time, X, Twitter, deep research, 검색, 검색해, 찾아봐, 찾아줘, 알아봐, 웹검색."
metadata:
  short-description: "Codex-native unified search: 3-tier discover->prove->deep-research ladder + Korean intent guard."
---

# search — Unified Search Hub

On-demand search discipline for any lookup that leaves the repository. This skill
activates by explicit trigger (or `dev`-hub routing), not by any external
dispatcher, and never fires implicitly.

## Source-Proof Invariant (read first)

Search results are **candidate URLs, not evidence.** Snippets, summaries, and
search-result consensus discover where a fact might live; they never settle it.
When recency, factual accuracy, version/compatibility, or source attribution
matters, open the original page and confirm it before you treat the answer as
sufficient. This invariant precedes every sufficiency rule below — no tier may
declare an answer final on snippet text alone.

## Divergence Candidate Grounding

When `cxc-loop` enters divergence mode, every N>=2 candidate must carry search
provenance in the divergence archive:

- `strong-1`: Tier 2 proven by opening the original source. Concrete numbers or
  claims may be cited only after this proof step.
- `add-1`: at least Tier 1 discovered, with candidate URL recorded. Promote to
  Tier 2 before using detailed claims from it.
- Record provenance URLs with `cxc divergence candidate add ... --source <url>`.
  The archive enforces non-empty source URLs; it does not certify the search tier.
  The agent must state Tier 1/Tier 2 evidence in the rationale or phase notes.

Do not invent a candidate from memory and then search only for confirmation. Search
discovers rival approaches first; the archive records which sources justified each
candidate.

## The Ladder (exactly three codex-native tiers)

### Tier 1 — Hosted web search (discovery)
Use the built-in `web_search` / current hosted web-search tool to run 1-3
focused, rewritten queries. It returns candidate URLs plus source metadata
(title, date, host). Tier 1 discovers; it does not prove. Never mark an answer
sufficient from Tier 1 output alone.

### Tier 2 — Browser Use / Computer Use (proof, default)
Open candidate URLs and read the real source. Browser Use reads DOM, PDFs,
rendered pages, and screenshots; Computer Use is reserved for browser chrome or
OS UI the in-app browser cannot reach. This is the default proof tier: confirm
date, author/source identity, the exact claim, and whether the page is primary
evidence. When a source is blocked, JS-rendered, PDF-only, or table-only, apply
the tactics in `references/blocked-url-reader.md` — that helper is Tier 2
guidance, **not** a fourth tier.

### Tier 3 — Subagent swarm (deep research, opt-in)
For broad, costly, or multi-source research, the main agent may explicitly spawn
a subagent swarm in ultraresearch mode: one query family or source class per
agent, source URLs returned, no edits, no hidden providers. Tier 3 is opt-in and
must be requested deliberately — it never auto-fires for ordinary latest/current
lookups. It is not a durable/background facility; durability is Phase 3 work.

### Removed cli-jaw tiers (non-goals — do not re-add)
codexclaw has no server runtime, so the cli-jaw 4-tier ladder does not carry over.
Do **not** reintroduce any of these removed backends as available: a progrok tier, a hosted web-AI wait (Grok Expert / GPT Pro), or an Exa / Tavily / Perplexity / Brave provider promise.
There is no codex-native equivalent and J-10 removed them deliberately.

## Korean Intent Guard (8 rules)

When the user says **검색 / 검색해 / 찾아봐 / 찾아줘 / 알아봐 / 웹검색** (or English
*search / look up / latest / current / news*) without naming local files or code:

1. **Classify the target first**: external/public/current info -> the ladder
   above; programming library/framework/API docs -> official docs or the active
   documentation retrieval path, then source-open proof; this repository's
   code/logs/config -> file search (`rg`, `rg --files`, local code tools).
2. **Do not send the full natural-language sentence as the only query.** Rewrite
   it into 1-3 focused keyword queries (see `references/query-rewrite.md`).
3. **Preserve anchors** in the rewrite: entities, source hints (official, Naver,
   GitHub), dates, locale, and content type.
4. **Treat results as candidate URLs**, not final evidence — fetch/open the
   original page when factual accuracy, recency, or attribution matters.
5. **Repository targets use file search**, never web search. Do not misroute a
   code/log/config lookup to the web.
6. **Docs queries prefer official documentation** (or the active docs retrieval
   path) before general web search, then open the source for proof.
7. **Bare ambiguous "검색"** (no local-file and no clear web target) -> ask ONE
   short clarification before launching either a repo-wide grep or a web search.
8. **No hidden fallback** between web, docs, and file search. State the
   classification you chose; never silently chain web -> docs -> grep.

## When to stop

Stop escalating when any holds: a sufficient primary source is found and
confirmed; all candidate URLs are dead or unreachable; or the task needs a user
clarification. Do not keep climbing tiers past a confirmed answer, and do not
spend Tier 3 subagents on a question Tier 1+2 already settled.

## Notes

- This skill is on-demand (`allow_implicit_invocation: false`); only `dev` is
  implicit. It is reached by trigger words or by `dev`-hub routing.
- Query rewrite runs prompt-side; there is no `agbrowse` binary dependency.
- The blocked-URL reader and ultraresearch decomposition are absorbed as Tier 2
  helper tactics and Tier 3 method, not as new tiers or vendored browsers.
