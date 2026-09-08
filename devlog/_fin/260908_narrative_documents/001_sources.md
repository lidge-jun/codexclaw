# Source research — 2026-09-08

Method: three Opus-5 research subagents (narrative structure, agent writing skills,
deep-research agents) with cxc-search attached, plus two Aside browser lanes (GitHub
trending skills; Minto/Korean/Amazon originals). Proof levels: **API** = GitHub
metadata read live; **OPENED** = file or page opened at a pinned revision; **T1** =
appeared in hosted search only. Star counts are repository snapshots on the
observation date, not adoption of the specific pattern. Nothing here is vendored;
all shipped text is independently written.

## A. Reader-facing document structure

| Source | Snapshot | Useful pattern | Boundary |
|---|---|---|---|
| [tyroneross/pyramid-principle](https://github.com/tyroneross/pyramid-principle) | 28★, push 2026-09-07, Apache-2.0 (API) | Pyramid as composable moves: SCQA opener, MECE grouping, short vs long form, audit pass | Small project; use as a checklist of moves, not authority |
| [Minto Pyramid Principle — Concept](https://www.barbaraminto.com/) | OPENED via Aside 2026-09-08; © Minto Books | "Guide the reader down the pyramid": group facts → insight → single governing thought; applies to memo, report, deck | Proprietary text; principle only, no copying |
| [life-itself/issuetrees](https://github.com/life-itself/issuetrees) | 5★, no license (API) | Issue/hypothesis trees under SCQA | No grant; reference-only |
| [punt-labs/prfaq](https://github.com/punt-labs/prfaq) | 25★, MIT (API), push 2026-09-01 | Working Backwards: press release stating the outcome in reader language, then FAQ answering hard objections | Product-launch genre; adopt the "outcome first, objections next" order |
| [liuzheng/6-page](https://github.com/liuzheng/6-page) | 2★, MIT, push 2020 (stale) | Amazon six-page narrative: prose over bullets exposes reasoning gaps | Shape only |
| [adr/madr](https://github.com/adr/madr) | 2,455★, license NOASSERTION (API; not opened) | Decision record shape: status, context, drivers, options, outcome, **consequences** required | Template variant comparison; no text copied |
| [architecture-decision-record catalog](https://github.com/joelparkerhenderson/architecture-decision-record) | 16,847★, NOASSERTION | Comparison of ADR templates (Nygard, MADR, Y-statements) | Same |
| [Diátaxis](https://diataxis.fr/) / [source](https://github.com/evildmp/diataxis-documentation-framework) | 1,216★, NOASSERTION | One document serves one of tutorial/how-to/reference/explanation; mixing degrades all | Adopt the classification step |
| [Design Docs at Google (Ubl)](https://www.industrialempathy.com/posts/design-docs-at-google/) | T1 + prior knowledge; article is the authority | Context/scope, goals and **non-goals**, alternatives considered with rejection reasons, cross-cutting concerns; "mini design doc" for small changes | Do not apply the full template to small changes |
| Korean 두괄식 / 기승전결 guidance | See section D1 (Aside, OPENED) | 두괄식 = conclusion first; 기승전결 = narrative build-up for stories, not reports | Korean wording taken from opened sources |

## B. Agent writing/document skills (SKILL.md packages)

| Source | Snapshot | Useful pattern | Boundary |
|---|---|---|---|
| [anthropics/skills — doc-coauthoring, internal-comms](https://github.com/anthropics/skills/tree/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills) | 175,048★, push 2026-09-03; per-skill LICENSE.txt Apache-2.0; docx/pdf/pptx/xlsx source-available only | Reader contract first (who reads, what they do next); fresh context-free reader pass to find blind spots | Root has no LICENSE; do not copy the document-format skills |
| [obra/superpowers — writing-plans, writing-skills](https://github.com/obra/superpowers/tree/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills) | 282,858★, MIT | Skill authoring as TDD: baseline pressure scenario, record rationalizations, write the rule, re-verify; bite-sized tasks each with its own check | Its plan-path/announcement conventions are plugin-specific |
| [JuanMarchetto/doc-standards-skill](https://github.com/JuanMarchetto/doc-standards-skill/tree/44a07d6b430779f1ff6cdcd30a5f6c6ca24debb6/doc-standards) | 16★, MIT | Classify type before prose; stacked layers structure → sentence → lint gate | Vale-specific gate not adopted |
| [NulightJens/humanizer-stack](https://github.com/NulightJens/humanizer-stack/tree/13f5c023189d428ffba726c75886ca1fd0dcba65/skills) | 261★, MIT (file) | Two passes, surface then **structure**; cites StoryScope (arXiv:2604.03136): structure features dominate AI-text detection; limit to 1–2 interventions per piece | Do not apply the whole menu |
| [jamditis/claude-skills-journalism](https://github.com/jamditis/claude-skills-journalism/tree/2ab11fdc0ef99b8393d582a9925d34f16f4ab8ad/journalism-core/skills) | 387★, MIT | Banned-move tables paired with rewrites plus explicit exemptions (quotes, code) | Flat word bans are the shallow layer; not adopted as a gate |
| [HiroHyun/grounded-copy](https://github.com/HiroHyun/grounded-copy/tree/120c5f6ca854b9d5bcc2d5e476b2ca7517b0c355/skills/grounded-copy) | 17★, MIT | Enumerated bans + replacement + named user override | Same |
| [mhyy10/release-notes-skill](https://github.com/mhyy10/release-notes-skill/tree/c8ff28241288c25fedcb149e9183eb925e24b247/release-notes) | 0★, **no license** | Evidence-anchored generation: every entry maps to a commit hash; verifier fails on unknown hashes, uncovered commits, missing breaking-change acknowledgement | Shape only; no code reuse |
| [GaZmagik/iso-24495](https://github.com/GaZmagik/iso-24495/tree/9ae69e628665cc512aa92ca0eeaed121e1e8337c/skills) | 171★, MIT | Plain-language audit: named reader and purpose before drafting | Numeric caps are self-declared proxies, not gates |
| [borghei/Claude-Skills](https://github.com/borghei/Claude-Skills/tree/ddca910e95580c63a236303fc1534054f0f14d4c) | 719★, MIT + Commons Clause | Directory of delivery/documentation skills | Commercial restriction; not reused |
| Index lists: VoltAgent/awesome-agent-skills 33,899★ MIT; ComposioHQ/awesome-claude-skills 74,640★ no license; travisvn/awesome-claude-skills 14,993★ no license | 2026-09-07 / 08-10 / 04-28 | Discovery only | Popularity ≠ pattern quality |

## C. Deep-research agents and method notes

| Source | Snapshot | Loop shape | Adopted / rejected |
|---|---|---|---|
| [langchain-ai/open_deep_research prompts.py @1b7d2e8](https://github.com/langchain-ai/open_deep_research/blob/1b7d2e80db9faa586165c60e09096dbbfd483a64/src/open_deep_research/prompts.py) | 12,675★, MIT, **archived 2026-08-10** | Supervisor with ConductResearch/ResearchComplete/think_tool; reflection is an isolated tool call; explicit iteration and concurrency budgets; "bias towards single agent"; standalone subagent briefs; report structure varies by question type; gapless sequential citations with terminal Sources list | Adopt reflection step, budgets, brief completeness, citation rule. Reject as live base |
| [assafelovic/gpt-researcher deep_research.py @5cdad9c](https://github.com/assafelovic/gpt-researcher/blob/5cdad9cb434754188b78bd998df18dd8d502cf7e/gpt_researcher/skills/deep_research.py) | 29,337★, Apache-2.0 | breadth 4 / depth 2 / concurrency 2; 25k-word recency-preserving context trim; report-type registry | Adopt bounded context and report types. Reject 1000-word floor, APA default, "form your own opinion" |
| [stanford-oval/storm README @fb951af](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/README.md) | 31,247★, MIT | Pre-writing (research → outline) then writing (outline + refs → cited article); perspective-guided questions; Co-STORM moderator raises questions from retrieved-but-unused info | Adopt outline-before-draft and gap questions from unused retrievals |
| [dzhng/deep-research deep-research.ts @1f8f3e2](https://github.com/dzhng/deep-research/blob/1f8f3e285bbc23e80b98a66a64effab9069f3ad4/src/deep-research.ts) | 19,649★, MIT | Query + explicit researchGoal per unit; learnings + followUpQuestions; breadth/2, depth-1 decay | Adopt query-with-goal and arithmetic termination. Reject unconditional recursion |
| [huggingface/smolagents open_deep_research run.py @30bb116](https://github.com/huggingface/smolagents/blob/30bb1161095dbae2271e6bc3cc4c219cc3897a57/examples/open_deep_research/run.py) | 29,220★, Apache-2.0 | Manager with planning_interval 4 / max_steps 12 over one browser worker | Reject additional_authorized_imports=["*"] |
| [nickscamara/open-deep-research @eea0962](https://github.com/nickscamara/open-deep-research/tree/eea0962c8be343230d9571cbdeb82df12504ad72) | 6,283★, Apache-2.0 (LICENSE opened), last push 2025-05 | Web UI research loop | Unmaintained; comparator only |
| [mshumer/OpenDeepResearcher README @6bbb945](https://github.com/mshumer/OpenDeepResearcher/blob/6bbb94516be182eb9cb7e270524d793a13881e53/README.md) | 2,795★, MIT | Model-judged early exit with 10-iteration cap and link dedupe | Adopt as the early-exit half of termination |
| [bytedance/deer-flow README @9ce6fdc](https://github.com/bytedance/deer-flow/blob/9ce6fdcb2252ea005b4fa98ca50bd3857e1f681a/README.md) | 81,870★, MIT | 2.0 rewrite; plan → research → report | Do not port 1.x plan structures |
| [Anthropic — multi-agent research system (2025-06-13)](https://www.anthropic.com/engineering/multi-agent-research-system) | proprietary article | Lead/subagent scaling by question shape (1 agent 3–10 calls for facts; 2–4 subagents for comparisons); start wide then narrow; ~15× tokens for multi-agent | Adopt scaling rule and "wide then narrow"; fan-out is not default |
| Host skill deep-research-work 0.1.14 (local plugin, read in-session) | n/a | Scope/plan → gap matrix → waves → report-source.md → artifact → verify → deliver | Alignment target for wp3; not a public source |

The subagent lane could not open a public Claude/Codex deep-research SKILL.md; the
Aside lane in section D2 did (ECC, alirezarezvani/claude-skills, academic-research-skills).

## Patterns adopted into the roadmap

1. Reader contract before drafting: named reader, decision they must make, what they
   already know (Anthropic doc-coauthoring, ISO-24495, doc-standards).
2. Answer first (SCQA / 두괄식): situation and complication in two or three sentences,
   the question, then the answer; supporting sections descend the pyramid (Minto,
   pyramid-principle skill).
3. Type classification: explanation, how-to, reference, decision record or research
   report; one document, one type (Diátaxis, doc-standards).
4. Required sections that writers omit: non-goals, alternatives considered with
   rejection reasons, consequences/costs (Google design docs, MADR).
5. Evidence separated from narrative: appendix or ledger, each claim anchored to an
   artifact or source; verifier can fail on unanchored claims (release-notes skill,
   LangChain citation rule).
6. Fresh-reader pass: an independent agent with no context reads the draft and
   reports where it got lost (doc-coauthoring, superpowers TDD).
7. Structure before sentences when de-slopping; at most one or two interventions
   (humanizer-stack; kwrite already owns the sentence layer).
8. Deep research loop: scope/plan → query families each with a goal → waves with an
   isolated reflection/gap step → bounded budgets by question shape → outline → cited
   report → artifact → verification (LangChain, dzhng, STORM, Anthropic, host skill).

## Patterns rejected

Word-ban lists as a gate; fixed word counts; APA-by-default; "form your own opinion"
mandates; unconditional recursion; multi-agent fan-out as default; framework-specific
plan paths; any text from unlicensed or Commons-Clause repositories.


## D. Aside lanes (opened in a signed-in browser, 2026-09-08)

Raw transcripts: evidence/research/aside-github-skills.log and
evidence/research/aside-korean-minto-amazon.log.

### D1. Originals for answer-first structure

| Source | Date shown | Rule observed |
|---|---|---|
| [Minto Pyramid Principle — Concept](https://www.barbaraminto.com/concept) | © 2007–2026 | Think bottom-up (facts → insight → grouped insights → one governing thought); communicate top-down, guiding the reader down the pyramid |
| [McKinsey alumni interview with Barbara Minto](https://www.mckinsey.com/alumni/news-and-events/global-news/alumni-news/barbara-minto-mece-i-invented-it-so-i-get-to-say-how-to-pronounce-it) | n/a | "The point above has to be a summary of those below"; groups logically alike, ordered, mutually exclusive and collectively exhaustive |
| [ModelThinkers — Minto Pyramid & SCQA](https://modelthinkers.com/mental-model/minto-pyramid-scqa) | n/a (secondary) | Start with the answer, then grouped arguments, then data; SCQA opener |
| [한경비즈니스 — 두괄식으로, 중복도 누락도 없이](https://magazine.hankyung.com/business/article/201904021493b) | 2019-04-03 | 결론·전망·요약을 맨 앞에; 현황→문제→원인→해결→기대효과 앞에 한 장짜리 핵심 요약을 붙인다 |
| [일잘러탐구생활 — 보고서 작성 Tip (2)](https://hotcoca.tistory.com/74) | 2021-06-29 | 두괄식: 첫 문장에 결론, 아래에 이유; 미괄식은 설득·설명이 급한 보고서에 부적합 |
| [오마이뉴스 — 글 잘 쓰고 싶다면 이 공식만](https://www.ohmynews.com/NWS_Web/View/at_pg.aspx?CNTN_CD=A0002393286) | 2018-01-10 | 두괄식/미괄식/쌍괄식 정의; 기승전결은 문제 제기→전개→전환→결론의 서사 전개 |
| [Amazon 2017 Letter to Shareholders](https://www.aboutamazon.com/news/company-news/2017-letter-to-shareholders) | 2018-04-18 | Narratively structured six-page memos read silently first; rewritten and peer-reviewed; no fixed section order prescribed |
| [Slab — Bezos narrative](https://slab.com/blog/jeff-bezos-writing-management-strategy/) | 2019-02-05 | Prose forces relative importance and relationships that bullets hide (secondary; four-part order is the article's) |
| [About Amazon — Working Backwards excerpt](https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes) | 2021-02-09 | PR under one page with customer highlights first, FAQ ≤5 pages with costs and challenges |

Conclusion for the roadmap: reports and explainers are 두괄식 (answer first); 기승전결 is
reserved for narrative pieces. The Korean sources give the wording used in
reader-documents.md and kwrite's structure pointer.

### D2. High-star GitHub skills (repository-wide stars, API counts 2026-09-08)

| Repo / skill | Stars | Push | License | Pattern | Boundary |
|---|---|---|---|---|---|
| [affaan-m/ECC deep-research](https://github.com/affaan-m/ECC/blob/main/.agents/skills/deep-research/SKILL.md) | 252,906 | 09-07 | MIT | Decompose → parallel search → deep-read strongest evidence → cited report | Broad collection; skill body not vendored |
| [msitarzewski/agency-agents executive-summary](https://github.com/msitarzewski/agency-agents/blob/main/support/support-executive-summary-generator.md) | 150,782 | 09-06 | MIT | SCQA framing, impact-ranked findings, owner/timeline recommendations, 500-word cap | Its template opens with situation, not answer; we open with the answer |
| [nexu-io/open-design research-decision-room](https://github.com/nexu-io/open-design/blob/main/skills/research-decision-room/SKILL.md) | 94,706 | 09-08 | Apache-2.0 | One HTML artifact: evidence ledger, theme map, confidence heatmap, decision memo, uncertainty visible | Shape for the deep-research artifact route in wp3 |
| [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill/blob/main/skills/last30days/SKILL.md) | 61,534 | 09-08 | MIT | Recency-bounded parallel evidence with attribution | Social-signal weighting not adopted |
| [Imbad0202/academic-research-skills deep-research](https://github.com/Imbad0202/academic-research-skills/blob/main/deep-research/SKILL.md) | 46,828 | 09-07 | CC BY-NC 4.0 | 13-agent pipeline with adversarial/editorial review | Non-commercial license; observation only |
| [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design/blob/main/skills/diagram-design/SKILL.md) | 33,321 | 09-07 | MIT | 39 diagram types, editorial hierarchy, self-contained HTML/SVG | Complements existing diagram-viewer ledger |
| [alirezarezvani/claude-skills deep-research](https://github.com/alirezarezvani/claude-skills/blob/main/research/deep-research/skills/deep-research/SKILL.md) | 25,668 | 08-30 | MIT | Reframe → genre/blocks → plan.md with stop criteria → search loop → score credibility/recency/bias, ≥3 independent source types per thesis → synthesize with steel-manned counterarguments → verify citations → refresh targets | Strongest public SKILL.md for wp3; adopt genre selection, triangulation rule and refresh targets |
| [tw93/Kami writing rules](https://github.com/tw93/Kami/blob/main/skills/kami/references/writing.md) | 11,235 | 09-07 | MIT (fonts separate) | Conclusions before evidence, one-page executive summary, claim-first chapter titles, consistent HTML→PDF typography | Adopt claim-first headings; already in diagram-viewer ledger for typography |
| [nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer/blob/main/plugins/visual-explainer/SKILL.md) | 9,664 | 08-28 | MIT | Summary-before-detail hierarchy per claim | Already ledgered in diagram-viewer |
| [mohitagw15856/pm-claude-skills executive-summary](https://github.com/mohitagw15856/pm-claude-skills/blob/main/skills/executive-summary/SKILL.md) | 1,341 | 09-07 | MIT | Decision brief vs recap; BLUF → context → findings → options → recommendation → actions | Adopt the BLUF skeleton for the report template |
| [RefoundAI/lenny-skills executive-communication](https://github.com/RefoundAI/lenny-skills/blob/main/skills/executive-communication/SKILL.md) | 1,311 | 07-16 | MIT | Conclusion-first SCR/SCQA; rejects the delayed "movie-arc" reveal | Same |

This closes the subagent lane's gap: public Claude/Codex deep-research SKILL.md packages
exist (ECC, alirezarezvani, academic-research-skills) and were opened through Aside.

