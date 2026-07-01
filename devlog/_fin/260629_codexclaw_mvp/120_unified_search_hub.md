# 120 — 통합 search 허브

Status: J4 조사 완료 · work-phase 120

상위: [090_expansion_moc.md](090_expansion_moc.md)

## 목표 (jun 확정)
cli-jaw search 4-tier 에스컬레이션과 lazycodex search를 병합하되, web 탐색은 codex의
browser-use / computer-use를 1차 백엔드로 사용한다. 한국어 "검색" intent guard는 반드시 포함.

## 병합 소스
- cli-jaw: 4-tier (built-in web → browser CDP → progrok → web-ai) + 한국어 intent guard +
  쿼리 리라이트 규약 + agbrowse research plan.
- lazycodex(omo): ultimate-browsing / ultraresearch 스킬.
- codex: browser-use / computer-use 네이티브 + built-in web search.

## J4 조사 산출물

### 1. cli-jaw search 4-tier 실측

cli-jaw `search` 스킬의 canonical tier는 문서 frontmatter와 본문이 일치한다.

1. **Tier 1 — built-in CLI web search**: native `WebSearch` / `WebFetch` / `web_search` 도구. 일반 사실, 문서, 버전 확인은 여기서 시작한다. 검색 결과는 증거가 아니라 URL 후보이며, 원문 fetch/open 전에는 `sufficient` 금지다.
2. **Tier 2 — cli-jaw browser CDP + adaptive fetch ladder**: candidate URL이 생긴 뒤, native fetch가 403/empty/truncated/JS shell/Naver shell/PDF/table 등에 막히면 `cli-jaw browser fetch <url>`로 검증한다. 내부 ladder는 public endpoint resolver → direct HTTP → TLS fingerprint rotation → Jina Reader → browser render → DOM/table extraction 순서다.
3. **Tier 3 — progrok**: Grok OAuth 기반 web + X 검색. `progrok status`가 logged-in이면 `progrok search`, `--web`, `--x`, `--json`, `--reasoning xhigh`를 사용한다. X/Twitter·실시간·deep synthesis는 이 tier에서 시작할 수 있다.
4. **Tier 4 — web-ai**: grok.com/chatgpt.com을 browser control로 구동하는 최후 tier. heavy query는 `cli-jaw browser web-ai send` 후 server-owned `bgtask`로 넘기는 규약이 있다.

핵심 불변식:
- search는 discovery, browser는 proof다.
- candidate URL 없이 browser fetch를 raw query search처럼 쓰면 안 된다.
- snippet consensus만으로 `sufficient` 금지.
- tier error는 묵살하지 말고 실패와 다음 필요조건을 보고한다.

근거:
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:13
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:16
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:128
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:137
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:190
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:196
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:320
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:371
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:441

### 2. omo ultimate-browsing / ultraresearch 실측

`ultimate-browsing`은 search provider가 아니라 blocked/hard-to-reach URL용 browsing escalation skill이다. 단순 검색은 "NOT this skill (use web-search)"로 명시되어 있다.

`ultimate-browsing` tier:

1. **Tier 1 — insane-search**: URL 본문 추출, WAF/403/Cloudflare/JS-only 대응용 headless extraction. `python3 -m engine "<URL>"`가 단일 진입점이며 curl_cffi TLS impersonation, yt-dlp, Jina Reader, official public APIs, mobile URL transform, Playwright fallback을 사용한다.
2. **Tier 1.5 — agent-reach**: 플랫폼별 native reader/API/CLI. Exa web search, Jina Reader, GitHub `gh`, Twitter CLI, Reddit `rdt`, yt-dlp, V2EX API, 중국 플랫폼 reader 등을 포함한다.
3. **Tier 2 — Chrome stealth**: CloakBrowser + `agent-browser` CDP. click/form/screenshot/video/persistent login/cookie injection 또는 Tier 1/1.5 partial/empty 때 사용한다.

`insane-search` 세부 engine은 `probe → validate → detect → plan → execute → fallback → report` phase를 갖고, HTTP 200을 성공으로 보지 않고 validator를 거친다. WAF 조기 감지 + 리스트/수집 intent일 때는 MCP Playwright로 network API를 정찰하는 병렬 분기를 허용한다.

`ultraresearch`는 탐색 backend가 아니라 명시 opt-in exhaustive research orchestration이다. Codex harness에서는 OpenCode 예시 도구를 `multi_agent_v1.spawn_agent`, `wait_agent`, `close_agent` 등 Codex native subagent tool로 번역하라고 되어 있으며, source axes별 worker swarm + EXPAND loop + cited synthesis를 요구한다.

근거:
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/SKILL.md:3
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/SKILL.md:8
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/SKILL.md:12
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/SKILL.md:37
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/SKILL.md:61
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/SKILL.md:83
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/references/insane-search/README.md:68
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/references/insane-search/README.md:78
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/references/insane-search/README.md:121
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/references/agent-reach/README.md:21
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultraresearch/SKILL.md:6
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultraresearch/SKILL.md:26
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ultraresearch/SKILL.md:44

### 3. Codex native search/browser/computer-use 실측

Codex native surface는 세 갈래다.

- **Hosted web search**: Codex core에는 Responses API `ToolSpec::WebSearch`가 있고 serialized name은 `web_search`다. `external_web_access`는 `WebSearchMode::Cached → false`, `Live → true`, `Disabled/None → no tool`로 매핑된다. config schema의 mode 값은 `disabled | cached | live`다.
- **Browser Use / in-app browser**: feature key `in_app_browser`, `browser_use`, `browser_use_external`은 stable + default-enabled다. 세션 skill은 in-app Browser가 있으면 브라우저 작업 전 skill을 읽고, standalone Playwright나 Computer Use로 우회하지 말라고 한다. 호출은 Node REPL `js`에서 `setupBrowserRuntime`, `agent.browsers.get("iab")`, `browser.documentation()`을 통해 `browser-client` runtime을 초기화하는 형태다.
- **Computer Use**: feature key `computer_use`는 stable + default-enabled다. local Mac app UI를 화면 읽기 + click/type/scroll/drag/key/set_value로 조작한다. 단, 전용 plugin/skill이 가능하면 그것을 선호하고, Computer Use는 exposed interface가 없는 app interaction에 쓴다. Browser/Computer Use MCP는 UI side effect를 만들 수 있어 confirmation policy를 따라야 한다.

근거:
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/tools/src/tool_spec.rs:30
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/tools/src/tool_spec.rs:36
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/hosted_spec.rs:20
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/hosted_spec.rs:21
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/config.schema.json:4242
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/features/src/lib.rs:149
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/features/src/lib.rs:1007
- /Users/jun/Developer/codex/121_openai-codex/codex-rs/features/src/tests.rs:205
- /Users/jun/.codex/plugins/cache/openai-bundled/browser/26.623.61825/skills/control-in-app-browser/SKILL.md:8
- /Users/jun/.codex/plugins/cache/openai-bundled/browser/26.623.61825/skills/control-in-app-browser/SKILL.md:10
- /Users/jun/.codex/plugins/cache/openai-bundled/browser/26.623.61825/skills/control-in-app-browser/SKILL.md:26
- /Users/jun/.codex/plugins/cache/openai-bundled/browser/26.623.61825/skills/control-in-app-browser/SKILL.md:39
- /Users/jun/.codex/plugins/cache/openai-bundled/computer-use/1.0.857/skills/computer-use/SKILL.md:8
- /Users/jun/.codex/plugins/cache/openai-bundled/computer-use/1.0.857/skills/computer-use/SKILL.md:13

### 4. 통합 4-tier 재설계안

jun 지시인 "web 탐색은 codex browser-use / computer-use를 1차 백엔드로 사용"을 반영하되, cli-jaw의 "search discovers, browser proves" 불변식은 유지한다. 따라서 Tier 1을 하나의 "Codex native discovery + proof" tier로 묶고, 그 내부 실행 순서를 intent별로 나눈다.

#### Proposed CodexClaw Search Hub v1

| Tier | 이름 | 주 백엔드 | 사용 조건 | 성공 조건 | escalate 조건 |
| --- | --- | --- | --- | --- | --- |
| 1 | Codex native search/browser | `web_search`/current web tool + Codex Browser Use(in-app browser) + Computer Use fallback | 모든 일반 web/current/search intent. URL 후보 발견은 hosted web search, 후보 검증/JS/DOM/상호작용은 Browser Use. visible desktop/browser chrome 또는 in-app browser가 처리 못 하는 OS UI만 Computer Use | 원문/primary URL을 web fetch 또는 Browser Use로 실제 open/fetch/DOM 확인 | 후보 없음, stale/blocked/empty/truncated/JS shell, Naver/table/PDF/interactive verification 필요, X/realtime/deep synthesis 필요 |
| 2 | Adaptive public-source readers | CodexClaw 포팅판 `ultimate-browsing` reader ladder: public APIs, registry APIs, Jina Reader, yt-dlp, curl_cffi/TLS impersonation, mobile transform, structured DOM/table extraction | candidate URL이 있고 Codex native fetch/browser만으로 읽기 비효율 또는 blocked. platform-native reader가 더 정확한 경우 | reader trace + validator가 원문 evidence 확보 | reader ladder 실패, challenge/login/paywall/CAPTCHA, live interaction 필요 |
| 3 | Realtime / social / deep search | `progrok`가 있으면 Grok OAuth web+X; 없으면 Codex hosted web_search live + source-specific public APIs로 degrade | X/Twitter, 실시간, 사회적 반응, 다중 출처 비교, disconfirmation pass | citation URL이 있고, 중요 claim은 Tier 1/2에서 원문 검증 | OAuth 없음, source coverage 불충분, deep synthesis 필요 |
| 4 | Hosted web AI / delegated deep research | Codex Browser Use로 chatgpt.com/grok.com 등 hosted AI를 조작하거나, Codex subagent swarm/ultraresearch-style orchestration | Tier 1-3으로 수집한 source bundle의 종합, 장시간 deep research, 다축 비교 | source audit + primary URL matrix + uncertainty labels | 장시간이면 server/background durable task 설계 필요. CodexClaw MVP에서는 "manual/interactive deep tier"로 남김 |

Tier 1 세부 라우팅:
- **Discovery first**: hosted `web_search`/현재 세션 web tool로 1-3개 focused query 실행. 결과는 URL 후보일 뿐이다.
- **Proof next**: 후보 URL은 Codex Browser Use로 open/read/DOM/screenshot 검증한다. Browser Use skill이 있으면 Computer Use보다 우선한다.
- **Computer Use fallback**: native Browser Use가 불가하거나 target이 browser chrome/OS dialog/desktop app이면 Computer Use. CAPTCHA 해결, paywall bypass, credential extraction은 금지/확인 정책을 적용한다.
- **No silent fallback**: 각 tier gate 실패와 다음 필요조건을 보고하고, 같은 tier 안의 tool choice만 자동 라우팅한다.

Tier 2 흡수 범위:
- cli-jaw `browser fetch` adaptive ladder의 platform resolvers/direct HTTP/TLS/Jina/browser render/DOM extraction 개념과 omo `insane-search`/`agent-reach`의 public API·reader catalog를 합친다.
- CodexClaw MVP에서는 별도 stealth browser(CloakBrowser)는 vendoring하지 않는다. Browser Use가 이미 1차 백엔드이므로, CloakBrowser/agent-browser는 "optional external adapter"로만 문서화한다.

### 5. 한국어 "검색" intent guard 포팅안

CodexClaw search skill에 아래 텍스트를 거의 그대로 이식한다.

```md
#### Korean "검색" Intent Guard

When the user says "검색", "검색해", "찾아봐", "찾아줘", "알아봐", or asks to look up/search without naming local files/code:

1. Classify before acting:
   - external/public/current info → Search Hub tiers;
   - programming library/framework/API docs → official docs or current docs retrieval first;
   - this repository's symbols/files/logs/config → file search.
2. Do not treat the bare Korean word "검색" as permission for repo-wide grep. If target is ambiguous, ask one short clarification.
3. Do not send the full Korean natural-language request as the only query. Rewrite into 1-3 focused keyword queries.
4. Preserve anchor entities: institution, product/brand, domain, current year/date, location, document type.
5. Add source hints when useful: `공식`, `site:`, `공지사항`, `PDF`, `보도자료`, `후기`, `목록`, `표`, `랭킹`, `네이버`.
6. Treat search results as URL candidates only. Open/fetch the original page before final factual claims.
7. If official/original URL is blocked, timed out, truncated, JS-rendered, Naver shell/iframe, PDF binary, or table/list-only, escalate to Browser Use/Tier 2 verification before relying on secondary sources.
8. Secondary sources corroborate; they do not substitute for failed official-source verification. Mark unresolved claims `browse-needed`, `partial`, or `insufficient`.
```

Codex 환경 차이:
- cli-jaw의 "native cli-jaw search" 문구는 "Codex hosted `web_search`/current web tool"로 치환한다.
- cli-jaw `cli-jaw browser fetch` 의무 문구는 "Codex Browser Use로 candidate URL을 open/read/DOM 검증"으로 치환한다.
- Codex Browser Use skill의 우선순위 때문에, Browser Use가 노출된 세션에서는 standalone Playwright/Computer Use로 먼저 우회하지 않는다.

근거:
- /Users/jun/.cli-jaw-3459/AGENTS.md:65
- /Users/jun/.cli-jaw-3459/AGENTS.md:72
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:149
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:155
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:160
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:163
- /Users/jun/.codex/plugins/cache/openai-bundled/browser/26.623.61825/skills/control-in-app-browser/SKILL.md:10
- /Users/jun/.codex/plugins/cache/openai-bundled/browser/26.623.61825/skills/control-in-app-browser/SKILL.md:39

### 6. agbrowse research plan 대체/흡수 판정

판정: **흡수하되 hard dependency로 두지 않는다.**

cli-jaw 규약에서 `agbrowse research plan --query "<request>" --json`은 실행 provider가 아니라 query-planning helper이며, `plan.atomicQueries`만 rewrite candidate로 쓰고 Exa/Tavily/Perplexity/Brave 실행에는 사용하지 말라고 되어 있다. CodexClaw에서는 이를 별도 binary 의존으로 보존할 이유가 약하다.

MVP 구현 제안:
- Search Hub skill 내부에 `rewriteQueries(request, locale)` prompt/template를 둔다.
- 출력 schema는 `{ classification, atomicQueries[], anchors[], sourceHints[], needsBrowserVerification }`로 고정한다.
- `agbrowse`가 설치되어 있으면 optional adapter로 `atomicQueries` 후보를 받을 수 있지만, unavailable이면 동일한 rewrite → search → fetch/open → browse escalation 정책을 수동 수행한다.

근거:
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:171
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:177
- /Users/jun/.cli-jaw-3459/AGENTS.md:78

### 7. 구현 메모

- 새 CodexClaw skill 이름은 `search-hub` 또는 기존 cli-jaw 호환성을 위해 `search`가 적합하다.
- skill description trigger에는 `search`, `검색`, `웹검색`, `찾아봐`, `알아봐`, `latest`, `news`, `real-time`, `X/Twitter`, `deep research`를 포함한다.
- output discipline은 rewritten queries, candidate URLs, actually opened/fetched URLs, browser verification command/tool, evidence status, unresolved uncertainty를 요구한다.
- `ultimate-browsing`의 "blocked URL reader" 로직은 별도 helper/reference로 이식하고, hosted web search 자체를 대체하지 않는다.
- `ultraresearch`는 Tier 4 orchestration mode로 연결하되, ordinary search에는 자동 발동하지 않는다.

## ✅ JUN 결정 반영 (090.1, 2026-06-30)
- **ladder 재정의** (J-10) = cli-jaw 4-tier 이름/의미를 그대로 보존하지 않고 **codex-only ladder로
  재정의**한다. codexclaw 네이티브 등가가 없는 dead tier(progrok, hosted web-ai)는 제거.
  새 ladder = `built-in web_search` → `browser-use/computer-use(공개 endpoint·fetch ladder)` →
  `subagent swarm(ultraresearch 모드)`. tier 이름도 codex 기준으로 재명명.
- **노출** (J-6): `search`(=search-hub) 스킬은 lazycodex 컨벤션대로 implicit 노출(dev+search+pdf 집합).
- `ultimate-browsing`의 blocked-URL reader는 helper/reference로 흡수(별도 tier 신설 X), `ultraresearch`는
  최상위 orchestration 모드로만(자동 발동 X) — 기존 결론 유지.
