## Korean Intent Guard (8 rules)

When the user says **검색 / 검색해 / 찾아봐 / 찾아줘 / 알아봐 / 웹검색** (or English
*search / look up / latest / current / news*) without naming local files or code:

1. **Classify the target first**: external/public/current info -> the ladder
   above; programming library/framework/API docs -> official docs or the active
   documentation retrieval path, then source-open proof; this repository's
   code/logs/config -> file search (`rg`, `rg --files`, local code tools).
   **"Figure out how this specific system/app/AI tool/API works"** (로직 파악,
   뜯어봐) is not a web lookup by default — route to `dev-debugging`
   [logic-analysis.md](../../dev-debugging/references/logic-analysis.md) (the observation loop) and use this ladder
   only for its external-evidence steps (docs, CVEs, prior writeups).
2. **Do not send the full natural-language sentence as the only query.** Rewrite
   it into 1-3 focused keyword queries (see `query-rewrite.md`).
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
