# Query Rewrite (prompt-side)

Turn a vague request into 1-3 focused queries before touching Tier 1. This runs
entirely prompt-side — there is no `agbrowse` or external planner dependency.

## Rules

1. Generate 1-3 queries, not one. Cover the distinct facets of the question
   (entity, attribute, time window) rather than restating the whole sentence.
2. Never submit the full natural-language sentence as the only query. Strip
   filler ("좀 알아봐 줄래", "can you find out") and keep the search anchors.
3. Preserve anchors verbatim: named entities, product/version strings, source
   hints (`공식`, `official`, `Naver`, `GitHub`, `docs`), dates, locale, and the
   content type wanted (release notes, pricing, changelog, paper).
4. Match locale to the source. Korean-market facts query in Korean; upstream
   library/API facts query in English against official docs.
5. Add a recency anchor (year, "latest", "changelog") when the answer is
   time-sensitive, so Tier 1 surfaces current candidates.

## Examples

Request: "리액트 19 새로운 기능 좀 정리해줘"
- `React 19 new features`
- `React 19 release notes official`
- `react.dev React 19 changelog`

Request: "요즘 cli-jaw 비슷한 오픈소스 뭐 있어"
- `open source AI agent CLI 2026`
- `cli coding agent framework comparison`
- `autonomous coding agent github`

## Output contract

Hand Tier 1 the rewritten queries. Carry the returned items forward as candidate
URLs only — proof happens at Tier 2 by opening the source.
