# Catalog descriptions evidence

Scope: only frontmatter `description:` and YAML `short_description:` lines in all 29 skills, plus this authorized ledger. Bodies, other metadata, and baseline are untouched. Classification: C0 catalog prose; discovery retained locally because this leaf owns the complete bounded metadata slice and spawning is prohibited.

Sources: `001_layering_standard.md` L2; `030_wp4_routers_catalog.md` B1/amendments/P revalidation; `research/30_routers_catalog.md` proposed replacements, trigger lists and L5 pins.

## Totals

- Descriptions: 10,783 → 3,676 Unicode characters; 11,647 → 4,492 UTF-8 bytes; 7,155 bytes saved (61.4%).
- Short descriptions: 2,159 → 1,382 characters; 2,179 → 1,382 UTF-8 bytes.
- All 29 descriptions ≤320 chars (maximum 228); all 29 summaries ≤100 chars (maximum 75). Description total meets the ≤4,500 B target.
- 102 literal trigger phrases dropped or compressed from the research inventory and original explicit trigger lists; every one is listed below. All listed Korean invocation phrases remain verbatim.
- JSON double-quoted single-line descriptions preserved. Luna retains `gpt-5.6-luna`, matching `NATIVE_OPENAI_MODELS` in `components/subagent-config/src/catalog.ts:6`; dev remains readable by the real leaf catalog (spawn-attach-hook test).

## Descriptions

| skill | old chars | new chars | new description |
|---|---:|---:|---|
| ast-grep | 497 | 124 | Use for AST search and codemods. Triggers: ast-grep, sg, function/call/class/import, empty catch, missing await, YAML rules. |
| dev | 270 | 141 | Use for coding, PR delivery, scaffolding and QA. Triggers: develop, fix, refactor, test, review, docs, browse, stacked PR, 개발, 수정, 검토, 스택 PR. |
| dev-architecture | 319 | 135 | Use for module boundaries and dependencies. Triggers: circular import, coupling, barrel, re-export, validation placement, 모듈 경계, 순환 참조. |
| dev-backend | 391 | 154 | Use for APIs, servers and app databases. Triggers: REST, GraphQL, migration, query optimization, middleware, caching, queues, 백엔드, API 작업, 마이그레이션, 쿼리 최적화. |
| dev-code-reviewer | 396 | 119 | Use for code/PR/diff review and refactor audits. Triggers: review this, before merge, antipattern, 리뷰, 코드 리뷰, 머지 전에 확인. |
| dev-data | 297 | 136 | Use for analytics and data pipelines. Triggers: ETL, ELT, data quality, SQL optimization, schema drift, backfill, 데이터 파이프라인, 데이터 품질, 백필. |
| dev-debugging | 569 | 143 | Use for debugging and system comprehension. Triggers: debug this, root cause, how does X work, reverse engineer, 왜 안 돼, 디버깅, 원인 분석, 로직 파악, 뜯어봐. |
| dev-devops | 971 | 228 | Use for infra, CI/CD, releases, repo policy, worktree cleanup and native desktop apps. Triggers: Dockerfile, K8s, IaC, SRE, Tauri, 스택 PR CI, 배포, 인프라, 쿠버네티스, 브랜치 정리, 브랜치 삭제, 워크트리 정리, 저장소 세팅, 브랜치 보호, 에이전트 PR, PR 정책, 데스크톱 앱, 메뉴 막대. |
| dev-diagram-viewer | 136 | 41 | Deprecated alias. Use cxc-dev-visualizer. |
| dev-frontend | 527 | 151 | Use for frontend code and UI fixes. Triggers: CSS, responsive, animation, React, Vue, Svelte, Tailwind, redesign, anti-slop, 프론트엔드, UI 작업, 반응형, 디자인 수정. |
| dev-scaffolding | 446 | 154 | Use for project/module setup and docs. Triggers: scaffold, structure audit, architecture docs, API docs, monorepo setup, 스캐폴딩, 새 프로젝트, 새 기능, 구조 점검, 모듈 추가. |
| dev-security | 296 | 190 | Use for security and trust boundaries. Triggers: auth, secrets, XSS, CSRF, SQL injection, JWT, OAuth, OWASP, PII, uploads, payments, supply chain, CI integrity, agent security, threat model. |
| dev-testing | 434 | 144 | Use for tests and release verification. Triggers: regression test, Playwright, E2E, contract test, coverage, CI flake, TDD, 테스트, 회귀 테스트, 품질 게이트. |
| dev-uiux-design | 450 | 150 | Use for UI/UX and brand direction. Triggers: make it look good, onboarding, empty state, error state, favicon, logo, design system, 깔끔하게, 모던하게, 감성적으로. |
| dev-visualizer | 497 | 150 | Use for visual explanations and documents. Triggers: diagrams, charts, interactive models, HTML reports, infographics, 시각화, 그려줘, 문서 만들어줘, 보고서, PDF 생성. |
| goalplan | 71 | 31 | Deprecated alias. Use cxc-loop. |
| interview | 327 | 116 | Use for requirements interviews. Triggers: interview, ambiguity, contradiction scan, ask me questions, I phase, 인터뷰. |
| kwrite | 448 | 121 | Use for Korean prose polishing. Triggers: Korean polish, proofread Korean, 윤문, 다듬어, 다듬어줘, 자연스럽게, 매끄럽게, 교정, 고쳐줘, AI투, 번역투. |
| loop | 229 | 121 | Use for PABCD completion loops. Triggers: cxc-loop, continue until done, HOTL, repeated PABCD, 루프 돌려, 끝까지 해줘, docs-first. |
| lunasearch | 380 | 126 | Use for cheap parallel web discovery (gpt-5.6-luna). Triggers: Luna search, parallel research, 루나검색, 루나 서치, 병렬 웹검색, 싸게 많이 찾아봐. |
| orchestrate | 69 | 32 | Deprecated alias. Use cxc-pabcd. |
| pabcd | 215 | 88 | Use for Plan-Audit-Build-Check-Done work. Triggers: PABCD, plan this, 기획, 단계별로, 요구사항 정리. |
| qa | 552 | 148 | Use for manual web, TUI, CLI, API and desktop QA. Triggers: smoke test, visual QA, screenshot check, CJK clipping, 수동 QA, 실제로 되는지 확인, 동작 확인, 직접 돌려봐. |
| recall | 424 | 175 | Use for past-session context recovery. Triggers: recall, last time, previous session, chat search, memory search, 그때, 지난번, 저번 세션, 예전에 했던, 기억나?, 리콜, 지난 세션, 이전 작업, 뭐였지, 어떻게 했었지. |
| remote | 443 | 135 | Use for Telegram/Discord bridge setup. Triggers: remote, messenger, pairing, tokens, webhooks, 텔레그램 연결, 디스코드 연결, 메신저 연결, 봇 연결, 원격, 페어링. |
| repo-map | 246 | 100 | Use for repo structure and symbol maps. Triggers: repo map, codebase overview, architecture map, 와꾸. |
| search | 424 | 159 | Use for web/current lookups. Triggers: search, look up, latest, news, prices, docs, status, X/Twitter, deep research, 검색, 검색해, 찾아봐, 찾아줘, 알아봐, 웹검색, 딥리서치, 심층 조사. |
| skill-hub | 52 | 30 | Deprecated alias. Use cxc-dev. |
| worktree-guardian | 407 | 134 | Use for Codex-app worktrees. Triggers: worktree, rename worktree, detached HEAD, ~/.codex/worktrees, 워크트리, 워크트리 이름, 새 워크트리, 브랜치랑 워크트리. |

## Short descriptions

| skill | old chars | new chars | new short description |
|---|---:|---:|---|
| ast-grep | 87 | 43 | AST code search and deterministic codemods. |
| dev | 53 | 40 | Coding, PR delivery, scaffolding and QA. |
| dev-architecture | 93 | 57 | Module boundaries, dependencies and validation placement. |
| dev-backend | 88 | 52 | APIs, servers, app databases and backend operations. |
| dev-code-reviewer | 70 | 26 | Code, PR and diff reviews. |
| dev-data | 97 | 52 | Analytics, data pipelines, ETL/ELT and data quality. |
| dev-debugging | 65 | 56 | Runtime debugging, root causes and system comprehension. |
| dev-devops | 103 | 75 | Infrastructure, CI/CD, releases, repo policy and native desktop acceptance. |
| dev-diagram-viewer | 68 | 40 | Deprecated alias for cxc-dev-visualizer. |
| dev-frontend | 92 | 57 | Frontend implementation, responsive layouts and UI fixes. |
| dev-scaffolding | 86 | 62 | Project and module setup, structural audits and documentation. |
| dev-security | 75 | 45 | Auth, secrets, trust boundaries and security. |
| dev-testing | 77 | 52 | Test strategy, regressions and release verification. |
| dev-uiux-design | 102 | 55 | UI/UX direction, states, typography and brand identity. |
| dev-visualizer | 55 | 64 | Visual explanations, diagrams, reports and document composition. |
| goalplan | 71 | 30 | Deprecated alias for cxc-loop. |
| interview | 43 | 59 | Requirements interviews, contradictions and Plan readiness. |
| kwrite | 78 | 42 | Korean prose polishing, tone and register. |
| loop | 50 | 23 | PABCD completion loops. |
| lunasearch | 41 | 39 | Cheap parallel web discovery with Luna. |
| orchestrate | 32 | 31 | Deprecated alias for cxc-pabcd. |
| pabcd | 54 | 42 | Plan, Audit, Build, Check and Done phases. |
| qa | 107 | 52 | Manual QA for web UI, TUI, CLI, API and desktop GUI. |
| recall | 61 | 42 | Past-session context, decisions and files. |
| remote | 80 | 59 | Telegram/Discord bridge setup, pairing and troubleshooting. |
| repo-map | 82 | 56 | Repository structure, symbol and architecture overviews. |
| search | 100 | 51 | Web lookups, current information and deep research. |
| skill-hub | 53 | 29 | Deprecated alias for cxc-dev. |
| worktree-guardian | 96 | 51 | Codex-app worktree adoption, naming and management. |

## Every dropped literal trigger

Comparison is case-insensitive against the research trigger/scope column and original explicit trigger lists. A phrase absent verbatim is disclosed even when its meaning remains in the scope or another trigger. No Korean phrase in that inventory was dropped. Alias targets replace their former descriptive scope as explicitly requested.

| skill | dropped literal trigger | reason |
|---|---|---|
| ast-grep | ast-grep/sg | Specific syntax examples collapse to AST search/codemods and shape triggers; no procedure in L2. |
| ast-grep | AST structural matching | Specific syntax examples collapse to AST search/codemods and shape triggers; no procedure in L2. |
| ast-grep | function/call/class/import shapes | Specific syntax examples collapse to AST search/codemods and shape triggers; no procedure in L2. |
| ast-grep | console.log→logger.info | Specific syntax examples collapse to AST search/codemods and shape triggers; no procedure in L2. |
| ast-grep | as any | Specific syntax examples collapse to AST search/codemods and shape triggers; no procedure in L2. |
| ast-grep | require→import | Specific syntax examples collapse to AST search/codemods and shape triggers; no procedure in L2. |
| dev-architecture | module split | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-architecture | layer violation | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-architecture | dependency direction | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-architecture | utils growth | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-architecture | barrel file | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-architecture | boundary review | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-architecture | architecture refactor | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-backend | backend | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-backend | schema | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-backend | OTel | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-backend | Result pattern | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-code-reviewer | code review | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-code-reviewer | PR review | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-code-reviewer | check my diff | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-data | migration | Broad implementation terms are less discriminating than analytics, pipelines, data quality and backfill. |
| dev-data | validation | Broad implementation terms are less discriminating than analytics, pipelines, data quality and backfill. |
| dev-data | batch vs streaming | Broad implementation terms are less discriminating than analytics, pipelines, data quality and backfill. |
| dev-debugging | why is X failing | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-debugging | this test is flaky | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-debugging | fix the crash | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-debugging | figure out how | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-devops | container build | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | deploy | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | stacked PR CI | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | duplicate CI | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | Kubernetes | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | Terraform | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | Pulumi | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | Helm | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | SLI | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | SLO | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | error budget | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | serverless | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | edge | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | stale branch | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | branch cleanup | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | delete merged branches | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | delete_branch_on_merge | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | repo bootstrap | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | branch protection | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | ruleset | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | PR limits | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | agent PR | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | agent PRs | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | AI PR policy | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | superseded PR | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | worktree gc | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | AppKit | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | WidgetKit | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | menu bar app | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | notarization | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-devops | TCC | English implementation/tool variants collapse to infra, CI/CD, releases, repo policy, worktree cleanup or native desktop scope; Korean invocation phrases retained. |
| dev-frontend | component | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-frontend | layout | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-frontend | styling | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-frontend | mockup | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-scaffolding | scaffolding | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-scaffolding | new project | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-scaffolding | init project | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-scaffolding | new feature | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-scaffolding | add module | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-scaffolding | project setup | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-scaffolding | source-of-truth docs | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-security | auth hardening | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-security | threat model; sensitive code | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-security | agents | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-security | security/threat_model tags | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-testing | write tests | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-uiux-design | modern | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-uiux-design | clean | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-uiux-design | aesthetic | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-visualizer | visualize | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-visualizer | architecture diagrams | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-visualizer | comparison reports | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| dev-visualizer | document creation | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| interview | requirements clarification | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| interview | cxc-interview | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| kwrite | kwrite | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| lunasearch | cheap/broad web discovery | Discovery synonyms collapse to cheap parallel web discovery; model and all Korean invocations retained. |
| lunasearch | many source sweeps | Discovery synonyms collapse to cheap parallel web discovery; model and all Korean invocations retained. |
| qa | manual QA | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| qa | QA this | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| qa | does it actually work | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| qa | drive the UI | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| qa | TUI alignment | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| recall | past session | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| remote | connect telegram | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| remote | connect discord | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| repo-map | structure map | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| repo-map | project structure | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| repo-map | unfamiliar codebase exploration | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| repo-map | symbol overview | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| search | real-time | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| search | deep-research | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |
| worktree-guardian | detached HEAD worktree | Literal synonym or detailed example compressed into the responsibility/stronger triggers; domain guidance remains in the unchanged body. |

| recall | what did we do | Literal invocation compressed into the responsibility or other triggers; unchanged body retains domain guidance. |

## Verification

Fresh checks after the Luna punctuation correction:

```sh
node plugins/codexclaw/scripts/check-prompt-architecture.mjs
```

Exit 1, expected: 37 exact-size baseline shrink errors, with no other gate violations. These comprise 18 description entries, 3 short_description entries and 16 whole-SKILL.md router records. Router checks measure the whole file, so frontmatter shrink alone changes the recorded bytes. Parent lowers/removes those records; this lane does not edit the baseline.

```sh
node --test plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/inventory.test.mjs
```

Exit 0. tests 22; suites 0; pass 22; fail 0; cancelled 0; skipped 0; todo 0.

```sh
node --test --experimental-strip-types plugins/codexclaw/components/subagent-config/test/catalog.test.ts plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts
```

Exit 0. tests 107; suites 0; pass 107; fail 0; cancelled 0; skipped 0; todo 0.

The first TypeScript test run failed only because the model regex captured the period in `gpt-5.6-luna.`. Parenthesizing `(gpt-5.6-luna)` fixes the declared token without changing the runtime/test. The rerun passes all 107 tests.

### Every expected baseline error

```text
description ast-grep: 124 chars but the baseline records 497 (lower the record or delete it)
router dev-architecture: 23180 bytes but the baseline records 23364 (lower the record)
description dev-backend: 154 chars but the baseline records 391 (lower the record or delete it)
router dev-backend: 25105 bytes but the baseline records 25344 (lower the record)
description dev-code-reviewer: 119 chars but the baseline records 396 (lower the record or delete it)
router dev-code-reviewer: 21666 bytes but the baseline records 21945 (lower the record)
router dev-data: 21050 bytes but the baseline records 21213 (lower the record)
description dev-debugging: 143 chars but the baseline records 569 (lower the record or delete it)
router dev-debugging: 22270 bytes but the baseline records 22706 (lower the record)
description dev-devops: 228 chars but the baseline records 971 (lower the record or delete it)
short_description dev-devops: 75 chars but the baseline records 103 (lower the record or delete it)
router dev-devops: 26050 bytes but the baseline records 26795 (lower the record)
description dev-frontend: 151 chars but the baseline records 527 (lower the record or delete it)
router dev-frontend: 35995 bytes but the baseline records 36373 (lower the record)
description dev-scaffolding: 154 chars but the baseline records 446 (lower the record or delete it)
router dev-scaffolding: 19397 bytes but the baseline records 19691 (lower the record)
router dev-security: 20557 bytes but the baseline records 20663 (lower the record)
description dev-testing: 144 chars but the baseline records 434 (lower the record or delete it)
router dev-testing: 30014 bytes but the baseline records 30306 (lower the record)
description dev-uiux-design: 150 chars but the baseline records 450 (lower the record or delete it)
short_description dev-uiux-design: 55 chars but the baseline records 102 (lower the record or delete it)
router dev-uiux-design: 27912 bytes but the baseline records 28214 (lower the record)
description dev-visualizer: 150 chars but the baseline records 497 (lower the record or delete it)
router dev-visualizer: 15915 bytes but the baseline records 16262 (lower the record)
description interview: 116 chars but the baseline records 327 (lower the record or delete it)
router interview: 17449 bytes but the baseline records 17660 (lower the record)
description kwrite: 121 chars but the baseline records 448 (lower the record or delete it)
description lunasearch: 126 chars but the baseline records 380 (lower the record or delete it)
description qa: 148 chars but the baseline records 552 (lower the record or delete it)
short_description qa: 52 chars but the baseline records 107 (lower the record or delete it)
router qa: 11774 bytes but the baseline records 12180 (lower the record)
description recall: 175 chars but the baseline records 424 (lower the record or delete it)
router recall: 16379 bytes but the baseline records 16630 (lower the record)
description remote: 135 chars but the baseline records 443 (lower the record or delete it)
description search: 159 chars but the baseline records 424 (lower the record or delete it)
router search: 14317 bytes but the baseline records 14584 (lower the record)
description worktree-guardian: 134 chars but the baseline records 407 (lower the record or delete it)
```

### Scope proof

`git diff --unified=0 -- plugins/codexclaw/skills` checked in full: exactly 58 files each with one removed metadata line and one added metadata line (116 changed lines). Every line is an authorized `description:` or `short_description:`. All non-target lines are unchanged. No git writes, spawning or builds performed.

Combined catalog prose: descriptions + short descriptions = 13,826 → 5,874 UTF-8 bytes, saving 7,952 bytes (57.5%). Counts exclude YAML keys, quotes and newlines.

