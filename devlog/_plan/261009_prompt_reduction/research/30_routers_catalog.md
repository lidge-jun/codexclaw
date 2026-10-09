# L2 catalog and non-core router audit

Read-only leaf; only this report is written. Sources are the current shared checkout. **Every path:line anchor below is relative to `plugins/codexclaw/`**; e.g. `skills/dev/SKILL.md:3` = `plugins/codexclaw/skills/dev/SKILL.md:3`. Later `:N` anchors in a row refer to that row’s named file.

## Measurement and proposal

All **29** descriptions: **11,647 UTF-8 bytes / 10,783 Unicode characters** (line-3 sources below). Proposed replacements: **3,737 B**, saving **7,910 B (67.9%)**. Budget **≤300 characters**, scope first; maximum proposed **144**. Counts exclude YAML key/quotes/newline; body counts include everything after closing frontmatter. Byte savings are not token-cost measurements.

L2 routes tasks; L3 selects references; L4 owns detailed guidance. Dev already owns family invariants (`skills/dev/SKILL.md:242`, `:269`, `:273`). Preserve domain requirements when relocating them. Leaf catalog reads the first 1,024 characters and displays 120 description characters (`components/subagent-config/src/spawn-attach-hook.ts:655`, `:660`); keep scope first and single-line quoted values.

## Descriptions: assessment and rewrites

R=scope routing (good); M=routing mixed with policy (move policy); P=policy-heavy; A=alias. “MUST USE” alone is not the defect. Rewrites are proposals. Trigger lists reproduce description triggers with quoting removed; when absent, scope phrases substitute.

| Source | chars/B | Type | Replacement | Description triggers/scope |
|---|---:|---|---|---|
| `skills/ast-grep/SKILL.md:3` | 497/497 | M examples/tool preference | Use for AST-shaped code search and deterministic codemods: functions, calls, classes, imports, YAML rules. | ast-grep/sg, AST structural matching, codemods, function/call/class/import shapes, console.log→logger.info, as any, require→import, empty catch, missing await, YAML rules |
| `skills/dev/SKILL.md:3` | 270/286 | M classifier/proof | Use for coding, fixes, refactors, docs, code review, PR delivery, scaffolding, and QA. Triggers: develop, review, 개발, 수정, 검토. | develop, fix, refactor, test, review, docs, browse, QA, stacked PR, 개발, 수정, 검토, 스택 PR |
| `skills/dev-architecture/SKILL.md:3` | 319/335 | R | Use for module boundaries, circular imports, coupling, barrels/re-exports, and validation placement. Triggers: 모듈 경계, 순환 참조. | circular import, module split, layer violation, dependency direction, utils growth, barrel file, re-export, boundary review, architecture refactor, 모듈 경계, 순환 참조 |
| `skills/dev-backend/SKILL.md:3` | 391/425 | R | Use for APIs, servers, services, app databases/migrations, middleware, caching, queues, and long-lived connections. Triggers: 백엔드. | backend, API, REST, GraphQL, schema, migration, query optimization, middleware, OTel, caching, Result pattern, server, 백엔드, API 작업, 마이그레이션, 쿼리 최적화 |
| `skills/dev-code-reviewer/SKILL.md:3` | 396/422 | M process/quality | Use for code/PR/diff review, pre-merge checks, review readiness, and refactor audits. Triggers: review this, 코드 리뷰, 머지 전에 확인. | review this, code review, PR review, check my diff, before merge, antipattern, 리뷰, 코드 리뷰, 머지 전에 확인 |
| `skills/dev-data/SKILL.md:3` | 297/329 | R | Use for analytics, ETL/ELT, data quality, analytical SQL, schema drift, and backfills. App CRUD uses dev-backend. Triggers: 데이터 품질, 백필. | ETL, ELT, pipeline, data quality, SQL optimization, backfill, migration, schema drift, validation, batch vs streaming, 데이터 파이프라인, 데이터 품질, 백필 |
| `skills/dev-debugging/SKILL.md:3` | 569/613 | M five-phase method | Use for crashes, wrong output, build/test failures, flakes, performance regressions, or unknown-system comprehension. Triggers: 디버깅, 로직 파악. | debug this, why is X failing, this test is flaky, fix the crash, root cause, 왜 안 돼, 디버깅, 원인 분석, how does X work, figure out how, 로직 파악, 뜯어봐, reverse engineer |
| `skills/dev-devops/SKILL.md:3` | 971/1079 | R | Use for containers, CI/CD, deploys/releases, K8s/IaC, SRE, repo/PR policy, branch/worktree cleanup, and native desktop acceptance. Triggers: 배포. | Dockerfile, container build, deploy, CI/CD, stacked PR CI, duplicate CI, Kubernetes, K8s, Terraform, Pulumi, Helm, SRE, SLI, SLO, error budget, serverless, edge, stale branch, branch cleanup, delete merged branches, delete_branch_on_merge, worktree cleanup, repo bootstrap, branch protection, ruleset, PR limits, agent PR, agent PRs, AI PR policy, superseded PR, worktree gc, Tauri, AppKit, WidgetKit, menu bar app, notarization, TCC, 스택 PR CI, 배포, 인프라, 쿠버네티스, 브랜치 정리, 브랜치 삭제, 워크트리 정리, 저장소 세팅, 브랜치 보호, 에이전트 PR, PR 정책, 데스크톱 앱, 메뉴 막대 |
| `skills/dev-diagram-viewer/SKILL.md:3` | 136/138 | A | Deprecated alias. Use cxc-dev-visualizer. | old name → cxc-dev-visualizer |
| `skills/dev-frontend/SKILL.md:3` | 527/559 | M load order | Use for frontend pages/components, CSS, responsive layouts, motion, accessibility, and rendered UI fixes. Triggers: React, 프론트엔드, 반응형. | frontend, UI, component, CSS, responsive, animation, React, Vue, Svelte, Tailwind, layout, styling, redesign, mockup, anti-slop, 프론트엔드, UI 작업, 반응형, 디자인 수정 |
| `skills/dev-scaffolding/SKILL.md:3` | 446/488 | M layout/doc policy | Use for project/module setup, scaffolding, structural audits, and architecture/API docs. Triggers: scaffold, 새 프로젝트, 구조 점검. | scaffold, scaffolding, new project, init project, new feature, add module, project setup, structure audit, architecture docs, source-of-truth docs, monorepo setup, API docs, 스캐폴딩, 새 프로젝트, 새 기능, 구조 점검, 모듈 추가 |
| `skills/dev-security/SKILL.md:3` | 296/296 | R | Use for auth, validation, secrets, trust boundaries, PII, uploads/payments, supply-chain/CI integrity, and agent security. Triggers: OWASP. | security, XSS, CSRF, SQL injection, JWT, OAuth, secrets, OWASP, auth hardening, supply chain, threat model; sensitive code, trust boundaries, PII, uploads, payments, CI integrity, agents, security/threat_model tags |
| `skills/dev-testing/SKILL.md:3` | 434/462 | R | Use for test strategy/harnesses, regressions, API/contract/E2E tests, CI flakes, TDD, and release verification. Triggers: 테스트, 회귀 테스트. | write tests, regression test, Playwright, E2E, contract test, coverage, CI flake, TDD, 테스트, 회귀 테스트, 품질 게이트 |
| `skills/dev-uiux-design/SKILL.md:3` | 450/478 | M load order | Use for open UI/UX direction, onboarding/states, IA, typography/layout, logos, and brand identity. Triggers: make it look good, 깔끔하게, 모던하게. | make it look good, modern, clean, aesthetic, onboarding, empty state, error state, favicon, logo, design system, 깔끔하게, 모던하게, 감성적으로 |
| `skills/dev-visualizer/SKILL.md:3` | 497/531 | P format/render policy | Use for visual explanations, diagrams/charts, interactive models, HTML reports, and PDF/document composition. Triggers: 시각화, 보고서. | visualize, visual explanations, architecture diagrams, comparison reports, infographics, document creation, 시각화, 그려줘, 문서 만들어줘, 보고서, PDF 생성 |
| `skills/goalplan/SKILL.md:3` | 71/73 | A | Deprecated alias. Use cxc-loop. | old name → cxc-loop |
| `skills/interview/SKILL.md:3` | 327/333 | M ledger/gating | Use for requirements interviews, contradictions, assumptions, and readiness before Plan. Triggers: interview, ask me questions, 인터뷰. | interview, 인터뷰, requirements clarification, ambiguity, contradiction scan, ask me questions, I phase, cxc-interview |
| `skills/kwrite/SKILL.md:3` | 448/508 | M universal output duty | Use for Korean prose polishing: tone, register, rhythm, translationese, and AI idioms. Triggers: 윤문, 다듬어줘, 교정, AI투, 번역투. | 윤문, 다듬어, 다듬어줘, 자연스럽게, 매끄럽게, 교정, 고쳐줘, AI투, 번역투, Korean polish, kwrite, proofread Korean |
| `skills/loop/SKILL.md:3` | 229/247 | M mode precedence | Use for requested completion loops across PABCD phases. Triggers: continue until done, HOTL, 루프 돌려, 끝까지 해줘, docs-first. | cxc-loop, continue until done, HOTL, repeated PABCD, 루프 돌려, 끝까지 해줘, docs-first |
| `skills/lunasearch/SKILL.md:3` | 380/420 | M model/proof protocol | Use for requested cheap, broad, parallel web discovery with gpt-5.6-luna. Triggers: Luna search, 루나검색, 병렬 웹검색. Proof uses cxc-search. | Luna search, cheap/broad web discovery, parallel research, many source sweeps, 루나검색, 루나 서치, 병렬 웹검색, or 싸게 많이 찾아봐 |
| `skills/orchestrate/SKILL.md:3` | 69/71 | A | Deprecated alias. Use cxc-pabcd. | old name → cxc-pabcd |
| `skills/pabcd/SKILL.md:3` | 215/239 | M mode/authority limits | Use for Plan-Audit-Build-Check-Done work, planning, and phase/evidence management. Triggers: PABCD, plan this, 기획, 요구사항 정리. | PABCD, plan this, 기획, 단계별로, 요구사항 정리 |
| `skills/qa/SKILL.md:3` | 552/592 | P completion gate/procedure | Use for manual QA after changes to web UI, TUI, CLI, API, or desktop GUI. Triggers: smoke test, visual QA, screenshot check, 수동 QA, 직접 돌려봐. | manual QA, QA this, does it actually work, drive the UI, smoke test, visual QA, screenshot check, TUI alignment, CJK clipping, 수동 QA, 실제로 되는지 확인, 동작 확인, 직접 돌려봐 |
| `skills/recall/SKILL.md:3` | 424/498 | M mandatory search order | Use to recover earlier work, decisions/files/names, or context after compaction. Triggers: recall, last time, previous session, 그때, 지난번, 기억나?. | recall, 리콜, past session, chat search, memory search, 지난 세션, 이전 작업, 뭐였지, 어떻게 했었지 |
| `skills/remote/SKILL.md:3` | 443/495 | M actor/setup policy | Use for Telegram/Discord bridge onboarding, pairing, tokens, agent registration, webhooks, and troubleshooting. Triggers: 텔레그램 연결, 디스코드 연결. | remote, bridge setup, messenger, pairing, connect telegram, connect discord, 텔레그램 연결, 디스코드 연결, 메신저 연결, 봇 연결, 원격, 페어링 |
| `skills/repo-map/SKILL.md:3` | 246/250 | R | Use for codebase/architecture overviews, structure/symbol maps, or unfamiliar repository exploration. Triggers: repo map, 와꾸. | repo map, codebase overview, structure map, 와꾸, project structure, unfamiliar codebase exploration, symbol overview, architecture map |
| `skills/search/SKILL.md:3` | 424/476 | M tool/query policy | Use for web/current lookups, official docs, releases, news/prices/status, X/Twitter, and deep research. Triggers: 검색, 찾아봐, 웹검색, 딥리서치. | search, look up, latest, current, news, real-time, X, Twitter, deep research, deep-research, 검색, 검색해, 찾아봐, 찾아줘, 알아봐, 웹검색, 딥리서치, 심층 조사 |
| `skills/skill-hub/SKILL.md:3` | 52/52 | A | Deprecated alias. Use cxc-dev. | old name → cxc-dev |
| `skills/worktree-guardian/SKILL.md:3` | 407/455 | P Git operations | Use for adopting, renaming, or managing Codex-app worktrees, thread-bound checkouts, and detached HEAD. Triggers: worktree, 워크트리 이름. | worktree, 워크트리, 워크트리 이름, rename worktree, 새 워크트리, 브랜치랑 워크트리, detached HEAD worktree, ~/.codex/worktrees |


Additional metadata keywords:
- `skills/dev/SKILL.md:7`: develop, implement, refactor, feature, code quality, verification, browse, browser, QA, agbrowse, stacked PR, stacked pull request, stacked diff, PR stack, restack, 브라우저, 페이지 확인, 화면 QA, 플레이라이트, 스택 PR, PR 쪼개기.
- `skills/dev-backend/SKILL.md:7`: API, REST, endpoint, middleware, database, ORM, cache, queue, error handling.
- `skills/dev-code-reviewer/SKILL.md:7`: review, PR, pull request, diff, merge, feedback, approve, code quality, stacked PR, stack review, 스택 PR 리뷰.
- `skills/dev-debugging/SKILL.md:7`: debug, error, stack trace, root cause, flaky, regression, crash, bisect, logic analysis, comprehension, unknown system, reverse engineering.
- `skills/dev-frontend/SKILL.md:7`: frontend, UI, component, CSS, responsive, layout, animation, design implementation.
- `skills/dev-testing/SKILL.md:7`: test, testing, TDD, coverage, regression, e2e, playwright, contract test, CI.
- `skills/dev-visualizer/SKILL.md:7`: diagram, visualization, visualize, document, report, SVG, HTML, PDF, interactive, cover, contents, storyline.
- `skills/dev-security/SKILL.md:7`: security, xss, csrf, sql injection, jwt, oauth, secrets, owasp, auth hardening, supply chain, threat model. `:18` has sensitive-code/trust-boundary/PII/payment/upload/CI/agents/tags injection_condition.

## All agents/openai.yaml content

Every file: `interface.display_name` is exactly `cxc-<folder>` at :2; short_description at :3; policy.allow_implicit_invocation at :5 (:6 when a default_prompt occupies :4). Table reproduces every short_description and boolean; prompts follow. Eight true values are pinned by `test/manifest-policy.test.mjs:51`.

| Source | short_description | implicit |
|---|---|---|
| `skills/ast-grep/agents/openai.yaml:3` | AST-aware structural search + codemods across 25 languages; rg-first for byte searches. | false |
| `skills/dev/agents/openai.yaml:3` | Class-scaled development, routing, safety, and proof. | true |
| `skills/dev-architecture/agents/openai.yaml:3` | Module boundaries, circular deps, coupling taxonomy, and boundary-only defensive programming. | false |
| `skills/dev-backend/agents/openai.yaml:3` | Framework-agnostic backend guidance for APIs, architecture, data access, and operations. | false |
| `skills/dev-code-reviewer/agents/openai.yaml:3` | Code review router: findings, severity, verdicts, and review workflow. | false |
| `skills/dev-data/agents/openai.yaml:3` | Data pipelines, ETL/ELT design, data quality validation, SQL optimization, and analysis patterns. | false |
| `skills/dev-debugging/agents/openai.yaml:3` | Phases 0-4 systematic root-cause debugging method (any language). | false |
| `skills/dev-devops/agents/openai.yaml:3` | Container, deploy, Kubernetes, IaC, SRE and native desktop acceptance guidance for production delivery. | false |
| `skills/dev-diagram-viewer/agents/openai.yaml:3` | DEPRECATED - renamed to cxc-dev-visualizer. Use $cxc-dev-visualizer. | false |
| `skills/dev-frontend/agents/openai.yaml:3` | Production-grade frontend implementation with responsive, accessible, anti-slop UI guidance. | true |
| `skills/dev-scaffolding/agents/openai.yaml:3` | Project and module scaffolding with repo-first convention reuse and structural audits. | false |
| `skills/dev-security/agents/openai.yaml:3` | Security router for auth, validation, secrets, supply chain, and hardening. | false |
| `skills/dev-testing/agents/openai.yaml:3` | Testing and QA router: strategy, harness choice, CI gates, TDD, and coverage. | false |
| `skills/dev-uiux-design/agents/openai.yaml:3` | Design judgment for vague briefs, UX states, typography, layout patterns, logos, and brand vocabulary. | true |
| `skills/dev-visualizer/agents/openai.yaml:3` | Visual documents, SVG/HTML explainers and PDF delivery. | false |
| `skills/goalplan/agents/openai.yaml:3` | DEPRECATED - merged into cxc-loop. Use $cxc-loop for durable goalplans. | false |
| `skills/interview/agents/openai.yaml:3` | Persistent I-phase contradiction interview. | true |
| `skills/kwrite/agents/openai.yaml:3` | Korean prose polishing: AI-tell removal + register consistency, meaning-exact. | false |
| `skills/loop/agents/openai.yaml:3` | Scoped HOTL completion with explicit scope limits. | true |
| `skills/lunasearch/agents/openai.yaml:3` | Luna parallel search for cheap discovery. | false |
| `skills/orchestrate/agents/openai.yaml:3` | IPABCD phase control and status. | false |
| `skills/pabcd/agents/openai.yaml:3` | PABCD phases, evidence, and explicit scope boundaries. | true |
| `skills/qa/agents/openai.yaml:3` | Manual surface-driving QA gate: faithful channels, evidence matrix, adversarial classes, teardown receipts. | false |
| `skills/recall/agents/openai.yaml:3` | Past-session recall: search prior Codex chats + memory store. | true |
| `skills/remote/agents/openai.yaml:3` | Messenger-bridge onboarding: connect Telegram/Discord, pair chats, troubleshoot. | false |
| `skills/repo-map/agents/openai.yaml:3` | One-shot tree-sitter symbol map with PageRank for unfamiliar codebase exploration. | false |
| `skills/search/agents/openai.yaml:3` | Codex-native search ladder (discover, prove, deep research with Aside lane) and Korean intent guard. | true |
| `skills/skill-hub/agents/openai.yaml:3` | DEPRECATED - capability routing now lives in cxc-dev. | false |
| `skills/worktree-guardian/agents/openai.yaml:3` | Managed-worktree identity safety - adopt/rename in place, never delete/recreate (워크트리 이름/삭제 방지). | false |

Only these have default_prompt (all other files omit it):
- `skills/kwrite/agents/openai.yaml:4`: Use $cxc-kwrite to polish this Korean text without changing what it says.
- `skills/lunasearch/agents/openai.yaml:4`: Use $cxc-lunasearch to run a cheap parallel Luna search swarm on this topic.
- `skills/recall/agents/openai.yaml:4`: Use $cxc-recall to search past sessions for this before asking me.
- `skills/remote/agents/openai.yaml:4`: Use $cxc-remote to set up the messenger bridge for me end-to-end.

Orchestrate YAML still advertises active phase control (`skills/orchestrate/agents/openai.yaml:3`) despite deprecated description (`skills/orchestrate/SKILL.md:3`); replace label with “Deprecated alias for cxc-pabcd.” Registration is separate from prose (`test/manifest-policy.test.mjs:58`).


## L3 bodies: shares and targets

R=routing; Ref=domain procedures/examples/checklists; D=dev invariants/inheritance boilerplate. Shares are editorial estimates ±5pp from section sizes; body bytes are exact. Domain proof/security is Ref, not disposable duplication. Targets exclude frontmatter. Row :N anchors use its SKILL.md.

| Source | Body B | R/Ref/D % | Target B | Keep / move / cut |
|---|---:|---:|---:|---|
| `skills/dev-architecture/SKILL.md:8` | 22822 | 8/89/3 | 2000 | Keep :22 selectors; move SSOT/deep modules/validation/trees (:99,:117,:226,:341) to L4. |
| `skills/dev-backend/SKILL.md:9` | 24613 | 18/80/2 | 3000 | Keep :12/:30 ops/C2 routing; move protocols/connections/queues/middleware/preflight (:110,:129,:202,:294,:416). |
| `skills/dev-code-reviewer/SKILL.md:9` | 21187 | 10/87/3 | 3000 | Keep :20/:86/:171 posture/output/verdict; move threshold/antipattern/security/perf/slop/interdiff (:134,:186,:233,:264,:348,:417). |
| `skills/dev-data/SKILL.md:8` | 20681 | 12/85/3 | 1800 | Keep :28 OLTP split; move ingestion/ETL/quality/report/tools/PII/query/backfill (:69,:105,:149,:197,:281,:308,:343,:384). |
| `skills/dev-debugging/SKILL.md:9` | 21755 | 22/75/3 | 3500 | Keep compact RCA/:210 logic route; move phases/scenarios/escalation/postmortems (:56,:89,:155,:223,:268,:337,:366). |
| `skills/dev-devops/SKILL.md:8` | 25513 | 24/74/2 | 3500 | Keep :29/:176 selectors/proof fields; move Docker/pipeline/freeze/branches/K8s/IaC/SRE (:68,:106,:182,:222,:269,:324,:360). |
| `skills/dev-frontend/SKILL.md:9` | 35515 | 35/62/3 | 4500 | Keep :79/:102 C2/surface routing; split :32 index; move intake/icons/hero/a11y/state/contracts (:151,:229,:261,:311,:352,:394). |
| `skills/dev-scaffolding/SKILL.md:8` | 19004 | 10/85/5 | 2200 | Keep :20 setup/doc routes; move logs/skeleton/languages/naming/suffix/docs/audits (:70,:125,:139,:197,:214,:224,:307). |
| `skills/dev-security/SKILL.md:20` | 19853 | 25/73/2 | 2800 | Keep :34/:55/:71/:300 trust/threat/owner routes; move auth/headers/rate-limit/agent/checklists (:108,:162,:187,:230,:266). |
| `skills/dev-testing/SKILL.md:9` | 29567 | 12/85/3 | 3500 | Keep :64 harness/risk + short oracle rule; move examples/browser/CI/TDD/acceptance/oracle/patch (:41,:152,:205,:230,:383,:404,:468). |
| `skills/dev-uiux-design/SKILL.md:8` | 27521 | 30/64/6 | 3500 | Keep :25/:100/:110 design/state/IA; cut :23/:27 emoji/role repeat; move presets/DESIGN/ima2/icons (:130,:185,:241,:314,:400). |
| `skills/dev-visualizer/SKILL.md:9` | 15417 | 35/60/5 | 4000 | Keep :51/:156 format/verify tiers; move maintenance/composition/export/PDF (:20,:80,:114,:176,:182,:191) to LOCAL reference/. |
| `skills/dev-diagram-viewer/SKILL.md:8` | 440 | 100/0/0 | 100 | Keep :15 pointer; cut :11 migration story/copied rule ids. |
| `skills/qa/SKILL.md:7` | 11411 | 25/72/3 | 3000 | Keep :56/:94/:109 channels/verdict/validator; move schemas/oracles/receipts (:73,:146,:182); cut :192 roadmap/:43 proof repeat. |
| `skills/search/SKILL.md:8` | 13893 | 35/60/5 | 3000 | Keep :16/:53/:196/:224 proof/target/depth/stop; move divergence/browser/attachment/history (:25,:74,:129,:191). |
| `skills/recall/SKILL.md:7` | 15979 | 25/75/0 | 3000 | Keep two searches/rewrite/open/corrections (:27,:139,:166); move flags/scoring/status/requeue/scope/hooks (:34,:57,:72,:103,:224,:285). |
| `skills/interview/SKILL.md:7` | 17189 | 20/78/2 | 3200 | Keep dimensions/questions/readiness/closeout (:15,:88,:202,:220); move assumptions/ledger/CLI/configurator/runtime (:47,:103,:171,:241). |

17 bodies **342,360→49,600 B (85.5% less L3)**. Selected L4 content still loads; savings vary by task.

Collapse C0/C1/canonical-dev blocks (`skills/dev-backend/SKILL.md:22`, `skills/dev-testing/SKILL.md:18`), triple role definition (`skills/dev/SKILL.md:244`, `skills/dev-frontend/SKILL.md:22`, `skills/dev-uiux-design/SKILL.md:27`), external-proof repeats (`skills/dev-data/SKILL.md:30`; owner `skills/dev/SKILL.md:279`) to owner pointers. Resolve frontend blanket render rule vs visualizer tiers before cutting (`skills/dev-frontend/SKILL.md:93`, `skills/dev-visualizer/SKILL.md:156`).

## Stubs

Deprecated/redirect metadata at each :5–6: `skills/skill-hub/SKILL.md:9` 202→≤100 B; `skills/orchestrate/SKILL.md:9` 156→≤100 B; `skills/goalplan/SKILL.md:9` 422→≤120 B; `skills/dev-diagram-viewer/SKILL.md:9` 440→≤100 B. Keep pointers, cut histories/rule copies. Goalplan CLI alias (:14) to CLI docs; docs-first (:17) to loop. Only 1,220 B total.

Lunasearch is active (`skills/lunasearch/SKILL.md:8`, :39 model), 8,633→≤1,600 B. Keep explicit activation/model/fallback/proof handoff; move dispatch/attachments (:15,:52), cut history (:168). Folder removal affects catalog/badges/provenance (`test/skill-catalog.test.mjs:54`, :58; `test/port-provenance.test.mjs:34`).

## L5 constraints

- `test/manifest-policy.test.mjs:27`, :41 frontmatter fields; :51/:58 implicit set; :136/:146 search prose pins REMOVED; :153/:189/:202 named routes/targets. No general description-length/text pin.

- `test/skill-catalog.test.mjs:23`, :49/:54/:58/:74 catalog syntax/set/badges; `test/inventory.test.mjs:51`, :71/:160/:195 identity/scripts/count/hash, not prose (`scripts/inventory.mjs:41`, :50 folder+name).

- `test/recall-skill-synopsis.test.mjs:16`, :18/:26 exact Commands heading/fence/CLI flags; “0 (full history) for memory”, “chat index only”, “Do not use `--any` on a long”, two forbidden phrases. Move synopsis test to L4; preserve CLI parity; prose pins to review.

- `components/subagent-config/test/catalog.test.ts:8`, :16/:19 Luna description needs gpt-* token in NATIVE_OPENAI_MODELS; proposal keeps gpt-5.6-luna. Removing it needs runtime/test change.

- `components/subagent-config/test/spawn-attach-hook.test.ts:1179`, :1183/:1192 dev JSON-quoted description/leaf parsing/body once/no recursive refs.

- `test/report-genre-contract.test.mjs:35`, :43/:49 genre-qualified “end(s) at the ask” in visualizer SKILL.md/refs; :17/:25/:56/:63/:71/:78 pin L4 genre/rule/phrases.

- `test/visualizer-packaging.test.mjs:52`, :68/:103/:112 isolated links/reader rule parity/Canonical owner/provenance: keep LOCAL refs, not ../dev. `test/port-provenance.test.mjs:34`, :41/:57/:65 skill sets/status/destinations/redirects.

- `test/native-execution.test.mjs:45` owner links; `test/repo-map-packaging.test.mjs:190` ≤500 lines/YAML; `components/cxc-ops/test/ast-grep.test.ts:49`, :60 completeness, AST prose pin REMOVED.

- `test/build.test.mjs:67`; `components/cxc-ops/test/cxc-ops.test.ts:154` SKILL/YAML completeness. `test/probe-compiled-hooks.test.mjs:75`, :86; `test/hook-e2e.test.mjs:1026`, :1090 body delivery, not production wording.

No suites run/runtime or CI proof claimed. Verification covers measurements, rewrite budgets, anchors and size. Suite scratch writes exceed this report-only scope; parent runs affected suites during implementation.

