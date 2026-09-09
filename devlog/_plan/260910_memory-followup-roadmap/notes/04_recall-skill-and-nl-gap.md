# 04 — cxc-recall 스킬 보강안과 자연어 질의 갭

날짜: 2026-09-10 (KST). 과제 S4. 읽기 전용.
설치 캐시: `/Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619`
워크트리 소스: `plugins/codexclaw/components/recall/src/*`, `plugins/codexclaw/skills/recall/SKILL.md`
캐시 SKILL.md와 워크트리 SKILL.md는 `diff -u` 0행(바이트 동일). 아래 CLI 6파일도 캐시=워크트리 동일.
재실행 CLI: `node <cache>/bin/cxc.mjs` (`--no-refresh`). 평가 원문 3건은 cases.json 그대로.

## 1. 스킬 vs CLI — 플래그·기본값·설명 어긋남

대조 대상: 캐시 `skills/recall/SKILL.md`(148행) vs `cli.ts` `chat-search.ts` `memory-search.ts` `query-words.ts` `synonyms.ts` `index-search.ts`.

| # | 스킬 주장 (파일:행) | 구현 (파일:행) | 판정 |
|---|---|---|---|
| 1 | 명령 시놉시스에 `cxc chat index [--rebuild] [--status]`만 (SKILL.md:32) | USAGE는 `[--rebuild] [--status] [--json]` (cli.ts:29, 185-188) | 플래그 누락 |
| 2 | chat/memory 시놉시스에 `--home` 없음 (SKILL.md:29-34). 뒤에서만 언급 (SKILL.md:127-130) | USAGE 본문에 `--home PATH` (cli.ts:51, 83, 124, 147) | 시놉시스 누락. 본문과 불일치 수준은 낮음 |
| 3 | `--full` 없음 | `--full` + `--json`이면 clip 생략 (cli.ts:50, 79, 128; format.ts:85-102) | 플래그 누락 |
| 4 | 시놉시스에 `--rank` 없음. 본문은 relevance 기본이라고만 (SKILL.md:46-49) | `--rank` 명시 플래그 (cli.ts:44, 73, 121) | 시놉시스 누락 |
| 5 | chat `--days` 기본 7 (SKILL.md:40-41) | `DEFAULT_DAYS = 7` (chat-search.ts:31, 113) | 일치 |
| 6 | memory `--days`는 시놉시스에만 있고 기본값 없음 (SKILL.md:33, 37-41) | memory `days` 기본 **0=전체** (memory-search.ts:379) | 기본값 미기재. chat 7과 혼동 위험 |
| 7 | `--limit` 숫자 없음 | chat 50, memory 20, chat 상한 200 (cli.ts:38; chat-search.ts:32-33, 114; memory-search.ts:34, 377) | 기본값 미기재 |
| 8 | JSON을 양쪽에 `{hits, warnings, scannedFiles, totalFiles, elapsedMs, mode}`로 적음 (SKILL.md:121-122) | chat은 추가로 `matchedFiles`, `index`, `clipped` (chat-search.ts:82-98; format.ts:89-102). memory는 `{hits, warnings, scannedFiles, elapsedMs}`만 (memory-search.ts:220-225). `mode`/`totalFiles` 없음 | 스키마 오류. memory JSON을 chat 스키마로 읽게 됨 |
| 9 | 심볼 질의가 경계에서 0건이면 substring fallback, **"empty answer is never the outcome"** (SKILL.md:61-63) | fallback은 memory에서 `hasBoundaryTerm`일 때만 (memory-search.ts:461-471). 한글 자연어는 boundary=false라 재시도 없음. chat은 substring AND뿐이며 fallback 없음 (chat-search.ts:101-108). 재시도도 0이면 빈 결과 | **과대 주장**. 이번 원문 3건이 그 반례 |
| 10 | "Korean works in both engines (trigram FTS >=3 chars; shorter words auto-fallback)" (SKILL.md:50) | trigram/LIKE 분기는 **chat index**만 (index-search.ts:4-8, 95-102, 190). memory는 paragraph scan + 동의어/어간 (memory-search.ts:351-354, 386-388) | 엔진 혼동. memory에 FTS가 있는 것처럼 읽힘 |
| 11 | "Both commands are strictly read-only over ~/.codex; they never modify anything" (SKILL.md:24) | `cxc chat search`는 `--no-refresh`가 없으면 sidecar ingest (chat-search.ts:181-189). `cxc chat index --rebuild`는 `DELETE FROM msgs; DELETE FROM files;` (cli.ts:173-174). 쓰기는 ~/.codexclaw/recall/index.sqlite | ~/.codex는 안 만지지만 "never modify anything"은 거짓 |
| 12 | "Words AND together"만 (SKILL.md:39) | 공백 분리 후 **최대 8단어**, 이후 폐기 (query-words.ts:20-21, 34-38). 불용어 목록 없음 (`stopword` rg 0건) | **8단어 캡·불용어 없음 미기재**. 긴 자연어 0건의 직접 원인 |
| 13 | `--no-synonyms` = "literal matching with no expansion at all" (SKILL.md:73) | 원단어만 남기고 동의어·한국어 어간 모두 버림 (cli.ts:48; memory-search.ts:386-388; synonyms.ts:163-185) | 설명은 대체로 맞음. chat에는 이 플래그가 무의미(동의어 미사용)하다는 점은 없음 |
| 14 | memory 0건이면 chat에서 최대 5개, tool 제외 (SKILL.md:98-103) | `want = min(limit, 5)`, `noRefresh: true`, tools 기본 제외 (memory-search.ts:514-531). `--no-chat`이면 주입 자체를 안 함 (cli.ts:154) | 동작 일치. 스킬 사다리(SKILL.md:108-116)는 이 fallback을 단계로 안 적음 |
| 15 | `--no-tools`만 나열 (SKILL.md:30) | chat `includeTools` 기본 **true** (chat-search.ts:120, 202, 240). 평가가 `--no-tools`를 쓴 이유 | 기본값이 도구 로그를 맞춘다는 점 미기재 |
| 16 | "How memory search reads your query" 전체(SKILL.md:52-71)를 리콜 일반 규칙처럼 읽히게 배치 | 심볼 경계·어간·동의어는 **memory only**. chat은 소문자 substring, 어간/동의어 없음 (chat-search.ts:101-108, 118) | chat에 어간이 있다고 오해하면 `코덱스를` 같은 질의를 안 줄임 |
| 17 | 사다리 1단계가 `cxc chat search "<distinctive terms>" --days 0` (SKILL.md:108-116) | 자연어 분해, `--any`, 고유명사 단독, native memories.search 역할 분담 없음 | 스킬 공백. 코드 버그 아님 |
| 18 | 시놉시스에 없는 숨은 플래그 `--index-path` (cli.ts:84, 125) | USAGE에도 없음 | 테스트용으로 보임. 스킬에 넣을 필요는 낮음 |

USAGE 전체(cli.ts:25-51)와 스킬 시놉시스(SKILL.md:28-34)를 나란히 보면, 스킬이 빠뜨린 사용자 플래그는 `--json`(index), `--home`, `--full`, `--rank`이다.

## 2. 자연어 0건 3질의 재실행

평가 report.md:21이 가리킨 긴 자연어 3건. cases.json 원문 그대로. 플래그는 평가와 동일.

- chat: `--days 0 --limit 3 --json --context 0 --no-tools --no-refresh`
- memory: `--days 0 --limit 3 --json --no-chat`

원문 재현 (2026-09-10, 설치본):

| ID | 질의 | chat n | memory n | memory fallback(no --no-chat) |
|---|---|---:|---:|---:|
| D3 | 지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법 | 0 (739ms) | 0 (82ms) | 0 |
| P2 | 코덱스를 재시작하면 플러그인이 사라지는 문제 | 0 (212ms) | 0 (83ms) | 0 |
| R2 | 2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록 | 0 (188ms) | 0 (99ms) | 0 |

평가 results.json과 동일하게 0건. chat fallback도 원문이 chat에서 0이므로 복구하지 못함 (memory-search.ts:547 `out.length === 0`이면 원 hits 반환).

토큰 분해 (query-words.ts + synonyms.ts, `node --experimental-strip-types`로 동일 모듈 실행):

### D3

- 공백 10단어 → MAX_WORDS=8로 `확인한`, `방법` 폐기.
- 남는 AND 8그룹: `지난번` ∧ `로컬` ∧ (`소스를`∨`소스`) ∧ `실제` ∧ (`서비스에`∨`서비스`) ∧ (`연결하고`∨`연결`) ∧ `정상` ∧ (`동작까지`∨`동작`).
- 동의어 테이블에 도그푸딩/dogfooding/서비스 연결 없음 (synonyms.ts:31-58).
- chat은 어간 없이 `소스를` `서비스에` `연결하고` `동작까지` 원형 substring AND.

### P2

- 5단어, 캡에 안 걸림.
- memory AND: (`코덱스를`∨`코덱스`) ∧ (`재시작하면`∨`재시작`) ∧ (`플러그인이`∨`플러그인`∨`plugin`∨`plugins`) ∧ (`사라지는`∨`사라지`) ∧ `문제`.
- `코덱스`↔codex, `재시작`↔restart, `사라지`↔wipe/disappear 동의어 없음.
- chat은 `코덱스를`(조사 포함) 원형 필수. 기록은 대개 Codex / restart.

### R2

- 9단어 → `기록` 폐기.
- 남는 8그룹: `2.49.0`(boundary, FILENAME 규칙 query-words.ts:54-55) ∧ (`배포하고`∨`배포`∨`deploy`∨`deployment`) ∧ `npm`(SHORT_ASCII 경계) ∧ (`패키지가`∨`패키지`) ∧ `진짜` ∧ `그` ∧ `소스인지` ∧ `검증한`.
- `소스인지`: 어미 목록에 `인지` 없음 → 어간 없음 (synonyms.ts:73-109, 134-146).
- `검증한`: `한` 없음, HA_VERB_TAIL은 `했|하|해`만 (synonyms.ts:124) → 어간 없음.
- 한 글자 `그`가 AND 항. 불용어 제거 없음.

### 변형 표

정답 기준은 평가 report.md 재현 근거와 같다. D3=소스 도그푸딩 완료(2026-09-09 `도그 푸딩 세팅좀 해줘 ff 하고` / gJAt 요약). P2=번들 마켓플레이스 소실(ad-hoc `20260908-codex-bundled-plugin-wipe-remote-ssh.md`, MEMORY.md). R2=2.49.0 안정 릴리스 검증(7x4X / thread `01a08498-4ebf`).

| 질의 | chat | memory | 정답 복구? |
|---|---:|---:|---|
| **원문 3건** | 0 | 0 | 아니오 |
| 원문 + `--any` D3 | 3 | 3 | **아니오** (공통어 OR. chat 1위는 2026-07 로케일, memory는 이미지/메모리PR) |
| 원문 + `--any` P2 | 3 | 3 | chat 1위는 AGENTS.md 증상 메모로 **부분**. 2·3위는 ‘코덱스’만 맞는 무관. memory 1위는 ima2 재시작 |
| 원문 + `--any` R2 | 3 | 3 | chat **3위만** 2.49.0 완료 답변. 1·2위는 다른 배포. memory는 옛 npm 이름/ima2 |
| D3 `로컬 소스 서비스` | 3 | 3 | **chat 예** (1위 09-09 완료: health 10100). memory 아니오 (소스코드/CI 오탐) |
| D3 `도그푸딩` | 3 | 3 | **부분**. chat 1위는 “진행할게” 시작 안내. memory는 MEMORY.md + 09-04 요약 |
| D3 `도그 푸딩` | 3 | 3 | **부분**. chat 1위는 사용자 **요청** 한 줄 |
| D3 `dogfooding` / `source dogfooding` | 3 / 3 | 3 / 3 | **예**. 완료 답변·stage1 dogfooding 행 |
| D3 `bun link healthz` | 3 | 3 | **예**. 완료 체인 + MEMORY.md 핸드북 |
| D3 `로컬 소스 dogfooding` | 3 | 0 | chat 예, memory 0 (한글+영어 AND가 한 청크에 없음) |
| P2 `BundledPluginsMarketplace` | 0 | 3 | **memory 예** (memory_summary + ad-hoc). chat 0 — 고유명이 대화보다 메모에 있음 |
| P2 `plugin restart` | 3 | 3 | **chat 예** (09-08 `@computer 또 날라갔어` 복구 답변). memory 2·3위 예, 1위는 무관 stage1 |
| P2 `플러그인 재시작` | 3 | 3 | **chat 예**. memory 혼재 |
| P2 `코덱스 플러그인` / `코덱스 플러그인 재시작` / `코덱스를 재시작` | 3 / 0 / 0 | 0 / 0 / 0 | 한글 `코덱스`는 기록의 Codex와 비대칭. 재시작을 붙이면 다시 0 |
| P2 `플러그인이 사라지는` | 3 | 0 | chat는 ‘사라지는’ 오탐. memory 0 |
| R2 `2.49.0` | 3 | 3 | **부분**. chat 1위는 09-09 완료. 2·3위는 09-08 **2.48 세션이 dev를 2.49.0으로 올리는 문장** |
| R2 `2.49.0 배포` | 3 | 2 | **예**. chat 완료 답변, memory 7x4X |
| R2 `2.49.0 npm` / `2.49.0 배포 npm` | 3 / 3 | 3 / 1 | **예**. `배포 npm` memory는 7x4X 단독 |
| R2 `2.49.0 SLSA` | 0 | 2 | **memory 예**. chat 0 (평가와 동일, 대화에 SLSA 어휘 부재) |
| R2 `2.49.0 provenance` | 1 | 3 | **함정**. memory 1위는 2.48 세션(01a08029). 7x4X는 3위. 평가 followups.json fix_release와 동일 |
| R2 `2.49.0 배포하고 npm` | 0 | 1 | memory만 예. chat은 `배포하고` 원형 AND 실패 |
| R2 `2.49.0 배포 npm 패키지 검증` | 2 | 0 | chat 예. memory는 `검증`이 청크에 없어 0 |
| R2 `소스인지 검증` | 1 | 0 | 어간 실패 재확인 |
| R2 원문 `--no-synonyms` | — | 0 | 동의어를 꺼도 원문 AND는 그대로 0 |

원문 덤프: `/tmp/mfu-260910/s4-search-runs.jsonl` (85행).

### 왜 원문이 0건인가 (코드 규칙)

1. **AND 결합이 기본** (chat-search.ts:107-108; index-search.ts:115, 147-149; memory-search.ts:351-354). `--any`만 OR. 스킬은 이 한 줄을 적지만, 에이전트 사다리는 원문 문장을 그대로 넣게 한다.
2. **불용어 없음**. `그`, `진짜`, `지난번`, `실제`, `정상`, `문제`, `방법`이 필수 항이 된다.
3. **MAX_WORDS=8**. D3·R2는 뒤 단어를 버리지만, 남은 8항 AND가 이미 과하다.
4. **조사 처리는 memory만, 그것도 목록에 있는 어미만**. `을/를/이/가/에/까지/하고`는 잘린다. `소스인지`·`검증한`은 어미 목록 밖. `사라지는`의 `-는`은 잘리지만 어간 `사라지`가 본문에 있어야 한다. chat은 조사 포함 원형.
5. **동의어 표가 이 3주제를 커버하지 않음**. 있는 것: plugin/플러그인, deploy/배포 (synonyms.ts:49, 53). 없는 것: dogfooding/도그푸딩, codex/코덱스, restart/재시작, provenance/검증, SLSA.
6. **심볼 경계 fallback은 이 질의에 해당 없음** (한글 항은 boundary=false). 스킬 63행의 “빈 결과는 없다”는 여기 적용되지 않는다.

`--any`는 건수를 채우지만 정답을 복구하지 않는다. 복구는 **짧은 고유명사·한영 동의어·3단어 이하 키워드**에서만 일어났다.

## 3. cli-jaw / jawcode — 에이전트에게 검색을 언제·어떻게 시키나

경로 존재: `/Users/jun/Developer/new/700_projects/cli-jaw`, `/Users/jun/Developer/new/700_projects/jawcode`.

### cli-jaw — 명시 검색을 프롬프트에 강제

`src/prompt/templates/a1-system.md:331-362` (Long-term Memory MANDATORY):

> Before answering about past decisions/preferences: search memory first
> When searching memory, consider Korean/English variants, filenames, symbols, and error codes if useful
> For any term in goal NOT in `<key_knowledge>`: run `cli-jaw memory search "<term>"`
> If memory search returns nothing: the term was not saved — ask user or infer
> `cli-jaw chat search "<keywords>" --days 3`
> `cli-jaw memory search "<keywords>" --chat`

같은 파일 371-372: L1 `cli-jaw memory search`가 기본, L2 dashboard는 사용자가 교차 인스턴스를 물을 때만.

`src/prompt/templates/employee.md:76-80`: 정확한 CLI 형식, “Search memory before claiming remembered facts.”

`src/core/compact.ts:722-725`: compact 핸드오프 footer가 `<overall_goal>`·다음 사용자 메시지 용어마다 `cli-jaw memory search`를 다시 돌리라고 한다.

`src/memory/heartbeat.ts:510`: heartbeat 프롬프트 앞에 “Before responding, you MUST search memory (cli-jaw memory search)…”를 붙인다.

`src/agent/spawn.ts:1567`: 일반 사용자 메시지 끝에 한 줄 nudge `(need history? L1: cli-jaw chat/memory search/context | L2: ...)`.

요지: **자동 주입만 믿지 말고, 과거 사실·compact 이후 낯선 용어·heartbeat마다 CLI 검색**. 한/영 변형을 검색 시점에 고려하라고 **스킬/시스템 프롬프트가 이미 적는다**. cxc-recall SKILL.md에는 이 문장이 없다.

### jawcode — 자동 주입이 본체, 공개 memory 툴은 막힘

`packages/coding-agent/src/prompts/system/system-prompt.md:322`: blocked skills에 `memory — blocked; jwc uses native session memory.`

`packages/coding-agent/src/prompts/memories/read-path.md:1-11`:

> The memory summary below is already injected; do not try to call or invent a `memory` tool.
> Treat memory as heuristic process context. Trust current repo files, runtime output, and user instruction for factual state
> Memory alone is NEVER sufficient proof.

`packages/coding-agent/src/memory-backend/local-backend.ts:26-34`: 매 턴 `beforeAgentStartPrompt`가 현재 프롬프트로 로컬 검색해 상위 4개를 `<memories> Task snapshot`으로 주입.

`packages/coding-agent/src/hindsight/backend.ts:24-29` (Hindsight일 때만): `<memories>`는 배경 지식; “Use `recall` proactively before answering questions about past conversations…”. CHANGELOG는 공개 retain/recall 툴 안내를 제거했다고 적음 — 로컬 백엔드와 불일치 가능.

CLI 표면은 있다: `jwc memory search <query> [--cloud] [--scope path]` (`jwc-runtime/memory-runtime.ts:59-66`). 시스템 프롬프트는 에이전트에게 그 툴을 쓰라고 하지 않고 **주입된 요약+스냅샷을 쓰라**고 한다.

요지: jawcode는 “언제 검색하나”를 에이전트 재량에 거의 안 맡긴다. cxc-recall은 반대(에이전트가 CLI를 직접 친다). 보강 시 cli-jaw의 **한영 변형·compact 후 재검색·빈 결과면 사용자에게 검색어를 밝히기**를 가져오고, jawcode의 **주입만으로 증명 삼지 말기**를 결과 검증 규칙에 넣는다.

## 4. 스킬 보강 초안 (diff 제안. SKILL.md는 수정하지 않음)

대상: `plugins/codexclaw/skills/recall/SKILL.md` (= 설치 캐시 동일 파일).

```diff
--- a/plugins/codexclaw/skills/recall/SKILL.md
+++ b/plugins/codexclaw/skills/recall/SKILL.md
@@ Defaults
- Words AND together; pass `--any` for OR. Quote the whole query.
+ Words AND together; pass `--any` for OR. Quote the whole query.
+ Do not paste a Korean sentence as-is. Split on spaces, keep at most 8 words
+ (MAX_WORDS); there is no stopword list, so 그/진짜/지난번/문제 stay required.
+ `--any` on a long sentence fills the page with common-word noise — it is not
+ a relevance rewrite.
  - `--days` defaults to 7 for chat; pass `--days 0` for FULL history ...
+ Memory `--days` defaults to 0 (full history). Chat default 7 and memory
+ default 0 are different.
+ `--limit` defaults: chat 50, memory 20.
@@ Korean
- Korean works in both engines (trigram FTS >=3 chars; shorter words auto-fallback).
+ Chat index: trigram FTS for words of length >= 3, LIKE fallback below that.
+ Memory search is a paragraph scan with ko/en synonyms and Korean ending trim.
+ Chat search does NOT stem or expand synonyms — drop particles yourself
+ (`코덱스를` → `코덱스` or `codex`).
@@ empty answer
- When a symbol query finds nothing on boundaries, results fall back to substring
- matching and the output carries a `lower confidence` warning, so an empty
- answer is never the outcome.
+ Symbol-shaped memory terms fall back to substring with a lower-confidence
+ warning. Korean prose has no boundary term, so that retry does not run.
+ Empty results are possible and common for unsplit sentences.
@@ Escalation ladder
-1. `cxc chat search "<distinctive terms>" --days 0` — find the conversation.
-   Add `--context 2` to read around a hit; `--cwd <repo>` to scope to a project.
-2. `cxc memory search "<topic>"` — find the durable per-thread summary
-   (`rollout_summaries`, MEMORY.md, stage1 outputs); hits carry `rollout_path` and
-   thread ids for deep-dive.
-3. Open the winning rollout file directly (path is in every hit) for full detail.
-4. Only if all three miss, ask the user — and say what you searched.
+1. Do not start with the user's sentence. Rewrite in this order, each as its
+   own query (`--days 0`, chat then memory):
+   a. Proper nouns / versions / hostnames / filenames as a single token
+      (`BundledPluginsMarketplace`, `2.49.0`, `gJAt`).
+   b. Korean/English synonym pair of that noun (`도그푸딩` and `dogfooding`,
+      `플러그인` and `plugin restart`, `배포` and `provenance` / `SLSA`).
+   c. Short 2–3 word keyword query (`로컬 소스 서비스`, `2.49.0 배포 npm`).
+2. `cxc chat search "<keywords>" --days 0 --no-tools` — find the conversation.
+   Add `--context 2`; `--source all` if the work was delegated.
+3. `cxc memory search "<keywords>"` — durable summary. Omit `--no-chat` so
+   empty memory can backfill up to 5 raw messages (labelled chat/chat).
+4. Open the winning rollout / memory file. Do not answer from the excerpt.
+5. Only if the rewritten queries miss, ask the user and list what you searched.
+
+## Result checks (before treating a hit as the answer)
+
+- Request vs completion: a user line or “진행할게” is a locator, not proof.
+  Prefer assistant text that names the outcome (healthz, npm latest, recovered).
+- Version-string trap: a hit that contains `2.49.0` may be the previous
+  release bumping *toward* 2.49.0. Check the title/date/task_outcome; do not
+  take the first version match. `2.49.0 provenance` ranked a 2.48 session first.
+- Correction history: later ad-hoc notes and MEMORY.md entries override older
+  summaries. If two hits disagree, read the newer file, then the rollout.
+- `--any` hits and always-return candidates are not evidence by mere existence.
+
+## Subagent / worktree
+
+- Chat default `--source main` hides subagent transcripts. Delegated work:
+  `--source all` or `subagent`.
+- Memory `--cwd PATH` only boosts; a worktree often owns zero summaries.
+  Do not start with `--cwd-only` or the result is empty by construction.
+  If `--cwd-only` warns, retry `--cwd`.
+- This skill's CLI search is allowed in a read-only subagent. Do not ask the
+  parent/user to recap a term until the ladder above has run.
+
+## Native memories.* vs cxc
+
+When Codex `[memories] dedicated_tools=true`, `memories.search` / `memories.read`
+/ `memories.list` search the memory store as dedicated tools (path-scoped,
+match_mode any|all_on_same_line|all_within_lines). They do not search
+session JSONL. Use them to open a known memory file or to scan MEMORY.md
+without a shell. They are not a substitute for `cxc chat search --days 0`.
+`cxc memory search` adds ko/en synonyms, Korean stems, cwd boost, kind
+priority, and chat fallback — use it when the native tool returns nothing
+or only the saturated memory_summary. Never use `memories.add_ad_hoc_note`
+from this skill; recall is read-only.
@@ JSON
- `--json` returns `{hits, warnings, scannedFiles, totalFiles, elapsedMs, mode}` where
- `mode` is `index` (sidecar FTS) or `scan` (raw JSONL fallback).
+ Chat `--json` returns `{hits, warnings, scannedFiles, matchedFiles, totalFiles,
+ elapsedMs, mode, index?, clipped}`. Memory `--json` returns
+ `{hits, warnings, scannedFiles, elapsedMs}` only.
+ `mode` is `index` or `scan` on chat. Pass `--full` to skip 500-char clipping.
+ Also list `--home` and `--rank` in the command synopsis; add `--json` to
+ `cxc chat index`.
```

동의어 표를 코드에서 늘리는 일은 스킬 밖(P1). 후보: `dogfooding/도그푸딩/도그 푸딩`, `codex/코덱스`, `restart/재시작`, `verify/검증`.

## 로드맵 입력

### (a) 회귀 여부

자연어 3건 0건은 **L0(#100~#108) 매칭 회귀가 아니다.** AND·MAX_WORDS=8·불용어 없음·chat 무어간은 기존 설계(cli-jaw 패리티, query-words.ts:20-21, chat-search.ts:4-6). L0이 넣은 한국어 어간·동의어·심볼 경계 fallback은 이 3문장에 닿지 못했다(어미 목록 밖, 주제 동의어 없음, 한글이라 경계 재시도 없음).

스킬 쪽 결함은 L0과 같이 온 **문서 과대 주장**이다: “empty answer is never the outcome”(SKILL.md:63), 양 엔진 trigram(SKILL.md:50), JSON 스키마(SKILL.md:121), 자연어 분해 절차 없음. 설치 캐시와 워크트리 SKILL은 동일하므로 “캐시가 뒤처짐”은 아니다.

`--any`로 건수만 살리는 동작도 L0 이전부터다. 정답 복구는 키워드 재작성에서만 확인됨 (평가 followups.json의 `source dogfooding` / `plugin restart` / `2.49.0 provenance`와 이번 재실행이 일치).

### (b) 수정 후보

**P0**

- 스킬에 자연어→키워드 사다리, 요청/완료 구분, 버전 문자열 오인, 정정 이력, 서브에이전트 `--source`, 워크트리 `--cwd` vs `--cwd-only`, native `memories.search` vs `cxc` 분담을 넣는다. 대상: `plugins/codexclaw/skills/recall/SKILL.md`.
- 스킬에서 틀린 기본값/스키마/“빈 결과 없음”을 같은 파일에서 고친다.

**P1**

- 동의어 시드에 도그푸딩/codex/재시작/검증 계열 추가. 대상: `plugins/codexclaw/components/recall/src/synonyms.ts` + `test/synonyms.test.ts`.
- 스킬·USAGE에 MAX_WORDS=8, 불용어 없음을 명시. 코드에서 불용어를 넣을지는 별 실험 — 넣으면 `그`/`문제`가 빠지지만 `CI` 같은 짧은 심볼과 충돌 여부를 테스트해야 한다.
- `--any`를 긴 문장에 쓰지 말라는 한 줄을 스킬에. 코드 자동 rewrite는 P2.

**P2**

- chat에도 memory와 같은 어간/동의어를 넣을지. index/scan 동등성 테스트(index.test.ts)를 깨므로 비용 큼.
- `소스인지`/`검증한` 어미 확장. `한`을 자르면 `검사`류 오탐 위험(기존 MIN_STEM_SYLLABLES 가드, synonyms.ts:126-127).
- native memories 툴과 cxc의 중복 호출을 줄이는 사다리만 스킬에 두고, 검색 엔진 통합은 하지 않는다.

### (c) 대상 파일과 검증 명령

- 스킬: `plugins/codexclaw/skills/recall/SKILL.md`
  - 검증: 시놉시스 플래그가 `cli.ts` USAGE와 같은지 눈으로 대조. 아래 3원문이 스킬 사다리대로면 0건이 아니어야 한다.
- 동의어: `plugins/codexclaw/components/recall/src/synonyms.ts`
  - 검증: 설치본 대신 워크트리 테스트. 제품 스위트 금지 시 해당 유닛만.
- 재현 (설치 CLI, 메모리 디렉터리 절대 경로를 셸에 넣지 말 것):

```
CXC="node /Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs"
$CXC chat search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --no-tools --no-refresh
$CXC memory search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --no-chat
$CXC chat search "로컬 소스 서비스" --days 0 --limit 3 --json --no-tools --no-refresh
$CXC memory search "source dogfooding" --days 0 --limit 3 --json --no-chat
$CXC memory search "BundledPluginsMarketplace" --days 0 --limit 3 --json --no-chat
$CXC chat search "plugin restart" --days 0 --limit 3 --json --no-tools --no-refresh
$CXC chat search "2.49.0 배포 npm" --days 0 --limit 3 --json --no-tools --no-refresh
$CXC memory search "2.49.0 provenance" --days 0 --limit 3 --json --no-chat
```

원문 3건은 0, 키워드 건은 0이 아니어야 한다. `2.49.0 provenance`는 0이 아니어도 1위가 2.48 세션이면 실패(오인)로 본다.
