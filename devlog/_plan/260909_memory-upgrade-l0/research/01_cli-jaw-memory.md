# cli-jaw 메모리 서브시스템 분석

- 대상 저장소: `/Users/jun/Developer/new/700_projects/cli-jaw` (HEAD `0da40d7c9`)
- 실행 인스턴스: `/Users/jun/.cli-jaw` (JAW_HOME, `src/core/config.ts:49`에서 `CLI_JAW_HOME`으로 재정의 가능)
- 조사 방법: 소스 직접 읽기 + 실제 SQLite 스키마 덤프(`sqlite3 .schema`)
- 작성일: 2026-09-09

---

## 1. 저장 계층 구조

### 1.1 물리 레이아웃

메모리는 **파일이 원본(source of truth), SQLite는 파생 인덱스**다. `reindexAll`이 인덱스를 통째로 지우고 마크다운에서 다시 만드는 구조(`src/memory/indexing.ts:237-294`)이므로 DB를 지워도 내용은 사라지지 않는다.

루트는 `JAW_HOME/memory/structured` (`src/memory/shared.ts:61-63`):

```
~/.cli-jaw/memory/
├── MEMORY.md                  # 레거시 코어 메모리 (Phase A, 여전히 존재)
└── structured/
    ├── profile.md             # kind=profile
    ├── meta.json              # AdvancedMeta
    ├── .reflect-meta.json     # lastReflectedAt
    ├── .host-toolchain.json
    ├── index.sqlite (+ -wal, -shm)
    ├── shared/                # soul.md, preferences.md, decisions.md, projects.md
    ├── episodes/live/         # YYYY-MM-DD.md ← flush 결과가 쌓이는 곳
    ├── episodes/digests/      # kind=episode-cold (아래 5절 참고)
    ├── semantic/
    ├── procedures/            # runbooks.md
    ├── sessions/, corrupted/, legacy-unmapped/
```

디렉터리 생성은 `ensureAdvancedMemoryStructure` (`src/memory/bootstrap.ts:450-540`)가 담당하고, 여기서 `profile.md`와 `shared/soul.md` 기본값을 심는다.

실제 확인된 인스턴스 상태: `episodes/live` 5개(2026-08-03~08-16), `shared/` 3개, `semantic/` 5개. `procedures/`, `sessions/`, `corrupted/`, `legacy-unmapped/`는 디렉터리만 있고 비어 있다. `episodes/digests`, `archive` 디렉터리는 아예 존재하지 않는다.

### 1.2 index.sqlite 스키마 (실제 덤프)

`getIndexDb` (`src/memory/indexing.ts:160-198`)가 만드는 것과 실물이 일치한다.

| 테이블 | 종류 | 역할 |
|---|---|---|
| `chunks` | table | 청크 본체 |
| `chunks_fts` | fts5 (`unicode61`) | BM25 검색 |
| `chunks_trigram` | fts5 (`trigram`) | CJK/부분문자열 검색 |
| `memory_synonyms` | table | 동의어 확장 |

`chunks` 컬럼: `id, path, relpath, kind, home_id, source_start_line, source_end_line, source_hash, content, content_hash, created_at, session_id`.

주목할 점은 `session_id`가 덤프에서 `ALTER TABLE`로 뒤에 붙은 형태(`, session_id TEXT NOT NULL DEFAULT ''`)로 나온다는 것이다. `migrateSessionColumn` (`indexing.ts:138-158`)이 구버전 DB에 온라인 마이그레이션한 흔적이고, 실패해도 `probeChunkColumns`로 재확인해 레거시 호환으로 남는다.

`chunks_fts`는 external-content가 아니라 **독립 테이블**이다. `rowid`에 `chunks.id`를 수동으로 넣어 조인하는 방식(`indexing.ts:272, 285`)이라 두 테이블 동기화는 전적으로 애플리케이션 코드 책임이다.

인덱스 현황(실측): 총 37 chunks / 14 relpath. kind 분포는 episode 14, shared 10, profile 8, semantic 5. `procedure`, `episode-cold`는 0건.

### 1.3 jaw.db (대화 로그, 별도 DB)

`~/.cli-jaw/jaw.db` (44MB). 메모리와 얽힌 테이블:

- **`messages`** — 실제 대화 원본. `id, role, content, cli, model, trace, turn_id, cost_usd, duration_ms, created_at, tool_log, working_dir, trace_run_id, session_id`. flush가 여기서 읽어간다. 실측 476행.
- **`messages_fts` / `messages_trigram`** — 트리거 3개(`messages_search_ai/ad/au`)로 INSERT/DELETE/UPDATE 시 자동 동기화. `chunks_fts`가 수동인 것과 대조적이다.
- **`memory`** — 레거시 KV 테이블(`key, value, source, created_at, updated_at`). **실측 0행**. `importKvMemory` (`bootstrap.ts:250-265`)로 `semantic/kv-imported.md`에 흡수되는 경로만 남았다.
- **`chat_sessions`** (23행), `session_buckets` (`memory_snapshot` 컬럼 보유), `heartbeat_events`.

**즉 저장소가 3개로 분리되어 있다**: 대화 원본(jaw.db/messages) → 요약된 마크다운(structured/) → 검색 인덱스(index.sqlite). 프롬프트에 주입되는 건 마지막 두 개뿐이다.

---

## 2. 쓰기 경로

### 2.1 자동 flush (주 경로)

트리거는 턴 카운터다. `lifecycle-handler.ts:698-699` 및 `:809-812`에서 어시스턴트 턴이 끝날 때마다:

```ts
incrementMemoryFlush();
const threshold = settings['memory']?.flushEvery ?? 10;
if (settings['memory']?.enabled !== false && countTurnForFlush(threshold)) {
    void triggerMemoryFlush();
}
```

기본 10턴마다 1회(`src/core/config.ts:373`). `countTurnForFlush` (`memory-flush-controller.ts:106-112`)는 임계 도달 시 카운터를 리셋하며 true를 반환해서, 호출자가 "리셋 없이 발사"하거나 "발사 없이 리셋"하는 걸 구조적으로 막는다.

흐름 (`memory-flush-controller.ts:327-451`):

1. 전역 `_flushLock` 확인. 잠겨 있으면 `_pendingMergedFlush = true` 한 비트만 세우고 반환 — 여러 번 튕겨도 재시도 1회로 합쳐진다.
2. `collectMergedSlices`: unflushed 행이 있는 **모든 세션**을 수집. 세션당 최대 10행(`MAX_FLUSH_ROWS_PER_SESSION`), 행당 4000자(`MAX_FLUSH_ROW_CHARS`), 전체 10만자(`MAX_FLUSH_PROMPT_CHARS`).
3. 정렬은 **가장 오래된 대기 행 기준**(`:280`). 최근 활동순으로 하면 수다스러운 세션이 매 사이클 앞자리를 차지해 뒤쪽이 굶는다는 주석이 달려 있다.
4. 예산 초과 시 **세션 단위로 통째 탈락**시킨다. 행 단위로 자르면 watermark가 주장하는 연속성이 깨지기 때문(`:283-292`).
5. 요약 전용 서브에이전트를 `permissions: 'deny'`로 스폰(`:418`). 프롬프트의 "do not write"는 가이드일 뿐 경계가 아니라는 판단이다.
6. 결과가 `SKIP`이거나 비면 파일은 안 쓰되 watermark는 전진(`:486-490`).
7. `episodes/live/YYYY-MM-DD.md`에 `## HH:MM` 헤딩으로 append → 해당 파일만 재인덱싱 → `maybeAutoReflect()` → 임베딩 동기화 → watermark 커밋.

**watermark는 세션별 Map**(`_lastFlushedMessageId`, `:22`). 전역 하나였을 때 조용한 세션의 옛 행이 바쁜 세션이 밀어올린 바닥 아래 깔려 영영 요약되지 않는 버그(#454, 073 §2.3)가 있었다는 주석이 남아 있다.

### 2.2 프롬프트 인젝션 방어

flush 출력은 신뢰할 수 없는 텍스트로 취급된다. `UNTRUSTED_HEADING_RE` (`:79`)가 `#{1,6}` 로 시작하는 모든 줄을 `\#`로 이스케이프한다(`:497`). 주석이 밝히는 두 가지 공격:

- `· session:<id>`를 단 위조 H2 → 가짜 출처 조작
- 평범한 H1(`# Decisions`) → 헤딩 스택 리셋으로 이후 청크가 세션 헤딩을 통째로 잃음

`buildFlushPrompt` (`:166-199`)는 `memFile` 경로를 **의도적으로 템플릿에 노출하지 않는다**. 커스텀 템플릿에 `{{convo}}`가 없으면 기본 템플릿으로 폴백하는데, 이유는 대화 없이 나온 답변이 성공한 요약으로 처리되어 아무도 읽지 않은 구간까지 watermark가 전진하기 때문이다(`:176-187`).

### 2.3 reflect (승격)

`reflectRecentEpisodes` (`reflect.ts:316-323`)가 최근 7일 `episodes/live/*.md`를 스캔해 안정 페이지로 승격한다. 분류는 **순수 정규식 스코어링**(`classifyLine`, `:83-123`) — LLM 호출이 없다:

- `profile.md` — "my role", "i work as", "uses macos", "내 역할" 등
- `procedures/runbooks.md` — runbook/절차 계열 2점 이상 **그리고** 명령형이거나 리스트 형태
- `shared/preferences.md` / `decisions.md` / `projects.md` — 각 1점 이상
- 어디에도 안 걸리면 `isIdentityRelevant`(always/never/prefer/tone/value/boundary/trust) 검사 후 `shared/soul.md`

질문문("what/how/왜/언제")과 짧은 부정문은 `isLikelyNonClassifiable` (`:61-66`)로 선제 배제한다. 상한은 타깃당 6개, 전체 24개(`:176-183`). 중복은 소문자 앞 80자 프리픽스로 제거한다.

**soul은 직접 쓰지 않는다.** reflect가 만든 soul 후보는 전부 `confidence: 'medium'`으로 넘어가고(`:217`), `applySoulUpdate` (`identity.ts:42-49`)는 medium을 `shared/soul-candidates.log`에 적어두기만 하고 적용하지 않는다. 즉 **자동 반영되는 soul 변경은 현재 경로상 없다** — high는 다른 호출자가 있어야 하는데 reflect는 항상 medium을 준다.

호출 시점은 flush 성공 직후(`memory-flush-controller.ts:526`) 단 한 곳. `maybeAutoReflect` (`reflect.ts:335-356`)가 24시간 쿨다운을 건다.

### 2.4 그 외 쓰기

- `memory.save()` (`memory.ts:94-117`) — API/CLI 수동 저장. 경로에 따라 재인덱싱/코어싱크/섀도임포트로 분기. `resolveMemoryPath`가 널바이트와 루트 탈출을 막는다.
- `memory.appendDaily()` (`:144-153`) — `episodes/daily/`에 append. **호출자를 코드베이스에서 찾지 못했다.**
- `syncCoreProfile` (`bootstrap.ts:162-218`) — `MEMORY.md` → `profile.md`. `source_hash` 비교로 멱등, 사용자가 쓴 부분은 `<!-- cli-jaw:core-memory:start/end -->` 마커 밖에 보존.
- `bootstrapAdvancedMemory` (`:542-586`) — 레거시 4종(MEMORY.md, 마크다운, KV 테이블, `~/.claude/projects/*/memory`) 일괄 임포트. 사전에 `backup-memory-v1/`로 백업.

### 2.5 heartbeat

**heartbeat는 메모리를 쓰지 않는다.** `src/memory/` 아래 있어 오해하기 쉽지만 실제로는 스케줄 잡 러너다. 메모리와의 접점은 딱 한 줄, 프롬프트에 검색을 지시하는 문자열이다 (`heartbeat.ts:510`):

> `Before responding, you MUST search memory (cli-jaw memory search) for recent conversation context...`

heartbeat 실행 결과는 `jaw.db`의 `heartbeat_events` 테이블로 가고, 그게 어시스턴트 턴을 만들면 그 턴이 §2.1의 flush 카운터에 잡히는 **간접 경로**만 존재한다.

### 2.6 worklog

`src/memory/worklog.ts`는 `JAW_HOME/worklogs/`에 PABCD 오케스트레이션 로그를 쓴다. **structured 메모리와 완전히 분리**되어 있고 인덱싱 대상이 아니다(`indexedFiles`, `indexing.ts:243-252`에 없음). 병렬 에이전트 쓰기 경합은 파일 경로별 Promise 체인 락으로 직렬화한다(`:10-21`). `latest.md` 심링크로 최신 로그를 가리키고, `parseWorklogPending`이 "이어서 해줘" 재개용으로 ⏳/⏸ 행을 파싱한다.

---

## 3. 읽기 경로

### 3.1 프롬프트 주입

`buildMemoryInjection` (`injection.ts:20-44`)이 단일 진입점이고, `src/prompt/builder.ts:793`에서 `role: 'boss'`로 호출된다. 역할별 스코프:

| role | profile | soul | task snapshot |
|---|---|---|---|
| `boss` | ✅ | ✅ | ✅ |
| `employee` / `subagent` | ✅ | ❌ | ❌ |
| `read_only_tool` | ✅ | ❌ | ❌ |
| `flush` | ❌ | ❌ | ❌ |

예산: profile 800자, soul 1000자, snapshot 2800자.

블록 문구가 흥미롭다 (`injection.ts:46-56`). 주석에 따르면 이전 문구는 에이전트가 라이브 조회보다 이 블록을 믿게 유도했고, 그 결과 캐시된 낡은 카운트를 자신 있게 단언하는 사고(#518)가 났다. 지금은 반대로 뒤집혀 있다:

```
- this is a PAST SNAPSHOT, not current state
- counts, statuses and any other volatile fact must be verified live before you assert them
```

flush 역할에 메모리를 주지 않는 건 요약기가 자기 출력을 다시 먹는 피드백 루프를 끊는다.

### 3.2 Task Snapshot 구성

`buildTaskSnapshot` (`runtime.ts:174-219`):

1. 프롬프트가 20자 미만이면("okay", "go") 최근 메시지 5건을 붙여 쿼리를 보강(`:184-196`). 짧은 프롬프트가 빈 스냅샷을 만드는 문제를 해결한 것.
2. `searchIndex` 실행.
3. `diversifyHits` (`:155-172`) — kind별 상한(episode 2, 나머지 1), **relpath당 1개**. 한 파일이 결과를 독점하는 걸 막는다.
4. 상위 4개, 청크당 700자, 총 2800자 예산.
5. `stripChunkMeta`로 `Source:/Kind:/Header:` 프리픽스 제거 후 `relpath:시작-끝` 헤더와 함께 출력.

### 3.3 검색 랭킹

`searchIndexCore` (`indexing.ts:625-668`). **쿼리 언어에 따라 경로가 갈린다**:

**CJK 경로** — 한글/일본어/중국어 포함이고 trigram 사용 가능하면:
- CJK 3자 이상 → trigram 전용 검색
- 3자 미만 → LIKE 폴백 (trigram은 3-gram이라 2자를 못 다룸)

이건 실용적인 판단이다. `chunks_fts`가 `unicode61` 토크나이저를 쓰는데 이건 한국어를 공백으로만 쪼개므로 "메모리를"과 "메모리"가 다른 토큰이 된다. BM25로는 한국어 부분일치가 사실상 안 된다.

**비CJK 경로**:
1. 토큰별 `expandSynonyms`로 그룹 확장
2. BM25(FTS5) + LIKE 폴백 병행 (`searchBM25`, `:475-526`). LIKE로만 잡힌 건 score 999를 줘서 뒤로 민다.
3. trigram 검색 별도 실행
4. **RRF 융합** (`:591-602`) — `1/(60+rank)`, BM25 가중 1.0 / trigram 0.8

이후 `computeFinalScore` (`:397-407`)로 재점수. **점수는 낮을수록 좋다**(BM25 관례):

```
최종 = RRF점수 + kindPriority + recencyBoost + exactBoost + phraseBoost
```

- `kindPriority` (`:363-371`): profile −4.0, shared −3.0, procedure −2.5, semantic −2.0, episode 0. **안정된 지식이 일화보다 구조적으로 우대**된다.
- `recencyBoost` (`:382-395`): kind별 반감기로 지수 감쇠. episode 7일, episode-cold 180일, semantic 30일, shared 90일, procedure/profile **무한(감쇠 없음)**. 최대 −1.5. 날짜는 **relpath에서 정규식으로 추출**하므로 파일명에 날짜가 없으면 0.
- episode가 반감기 2배(14일)를 넘으면 벌점을 더해 아래로 밀어낸다(`:391-393`).
- 정확 일치 −2.0, 헤더/제목 구문 일치 −1.0.

동의어(`synonyms.ts:3-14`)는 하드코딩 10쌍으로, 한영 대응(preference↔선호↔취향, decision↔결정)과 프로젝트 고유어(cli-jaw↔jaw↔clijaw)를 담는다. 초기화 시 그룹 내 모든 쌍을 양방향 삽입한다.

`keyword-expand.ts`의 `expandSearchKeywords`는 이름과 달리 **LLM을 쓰지 않는다.** `heuristicKeywords` (`:66-84`)가 공백 분리에 더해 login/auth/401, launchd/plist/service 두 도메인만 하드코딩으로 보강한다. `AdvancedConfig`에 provider/model/apiKey/baseUrl 필드가 다 있지만 `validateAdvancedMemoryConfig`는 무조건 `{ok: true, provider: 'integrated'}`를 반환한다(`:95-98`) — LLM 확장 기능의 잔해로 보인다.

### 3.4 provider 경로

`MemorySearchProvider` (`src/search/providers/memory.ts`)는 통합 검색 컨트랙트용 래퍼다. `PROVIDER_SEARCH_OPTIONS` (`indexing.ts:446-453`)는 후보를 64개로 넓히고 `deterministicTies: true`로 동점을 relpath/라인으로 안정 정렬한다 — 페이지네이션 시 순서가 흔들리지 않게 하려는 것이다. `sessionFilter`가 오면 `session_filter_ignored` 경고를 낸다: 메모리는 세션 공유 자원이라는 명시적 입장.

---

## 4. federation / instance-discovery

여러 cli-jaw 인스턴스(포트별로 다른 JAW_HOME)의 메모리를 한 번에 검색하는 계층이다.

### 4.1 인스턴스 발견

`instance-discovery.ts`. 소스가 두 갈래고 `origin`으로 구분한다(`types.ts:13-16`):

- `registry` — 오퍼레이터가 선언한 항목. **오프라인이어도 목록에 남는다.**
- `scan` — 포트 스캔으로 발견. `item.ok`인 살아있는 것만(`:114-118`).

주석에 이유가 있다: 전체 스캔은 3457부터 50개 포트를 훑고 오프라인 행도 보관하므로, 통째로 합치면 진짜 인스턴스 2개가 죽은 48개에 파묻힌다(#436).

블랙리스트(`:10-15`)로 매니저/대시보드/스모크테스트/`.bak.` 홈을 제외한다. 각 ref는 `index.sqlite`(메모리)와 `jaw.db`(대화) 두 경로의 존재 여부를 따로 들고 있다.

### 4.2 연합 검색

`searchFederated` (`federation.ts:28-87`)는 각 인스턴스의 `index.sqlite`를 **읽기 전용으로 직접 열어** 쿼리한다(`searchIndexReadOnly`, `indexing.ts:703-713`, `{readonly: true, fileMustExist: true}`). HTTP를 거치지 않으므로 상대 인스턴스가 죽어 있어도 파일만 있으면 검색된다.

에러를 코드로 분류한다(`:66-72`): `native_module_mismatch`(better-sqlite3 ABI 불일치), `corrupt`, `open_failed`, `query_failed`, `schema_mismatch`. 구버전 스키마는 실패시키지 않고 `degraded` 목록과 함께 부분 동작시킨다.

`origin: 'registry'`이면서 인덱스가 없는 건 경고하지 않는다 — 그냥 꺼져 있는 것이므로 매 검색마다 알리면 소음이다(`:44-48`).

### 4.3 인스턴스 간 재랭킹

`rerankAcrossInstances` (`result-rerank.ts`)는 **인스턴스 내 순위만 쓰는 RRF**다: `1/(60 + rank)`. 인스턴스별 상한 10, 전역 50. 동점은 instanceId → relpath → 시작줄로 안정 정렬.

여기서 원래 점수(`hit.score`)는 버려진다. 인스턴스마다 코퍼스 크기가 달라 BM25 절대값이 비교 불가능하므로 순위만 쓰는 건 타당하다. 다만 §7에서 짚듯 부작용이 있다.

### 4.4 대화 연합

`chat-federation.ts`는 별개로 각 인스턴스의 `jaw.db` `messages`를 검색한다. FTS를 안 쓰고 **단어별 LIKE OR**(최대 5단어, 2자 이상)로 간다(`:98-116`). 랭킹 모드도 `'recency'`로 명시된다(`federation.ts:162`). 상대 인스턴스의 `tool_log`/`session_id` 컬럼 유무를 프로브해서 없으면 degrade + 경고.

---

## 5. 망각 / 압축 / decay

**세 층위가 있지만 실제로 도는 건 하나뿐이다.**

### 5.1 검색 시점 decay — 동작함

`recencyBoost`의 kind별 반감기가 유일하게 실제 동작하는 decay다. 다만 이건 **랭킹 감쇠지 삭제가 아니다.** 오래된 episode는 아래로 밀릴 뿐 인덱스에 그대로 남는다.

### 5.2 아카이브 — 구현됐지만 호출되지 않음

`cleanupStaleEpisodes` (`reflect.ts:358-379`)는 90일 지난 episode를 `structured/archive/`로 옮긴다. **호출자가 없다.** 저장소 전체(dist/electron 빌드 산출물 제외)에서 정의 한 곳 외에 참조가 없고, 테스트조차 없다. 실제 인스턴스에 `archive/` 디렉터리가 없는 것도 이와 일치한다.

또한 `settings.memory.retentionDays`(기본 30, `config.ts:376`)는 `GET /api/memory-files`가 읽어서 UI에 표시하지만(`routes/memory.ts:122`), `cleanupStaleEpisodes`의 기본값은 별도로 90이고 둘은 연결되어 있지 않다.

### 5.3 압축(digest) — 소비자만 있고 생산자가 없음

`kindForFile` (`indexing.ts:258`)은 `episodes/digests/`를 `episode-cold`(반감기 180일)로 분류한다. 그런데 **`digests/`에 파일을 쓰는 코드가 없다.** `rg digests`로 나오는 건 이 분류 한 줄과 무관한 테스트뿐이다. 콜드 스토리지 설계는 랭킹 쪽에만 남고 승격 파이프라인은 미구현이다.

### 5.4 실질적 압축

의도치 않게 압축 역할을 하는 건 flush 자체다. 10턴 × 최대 10행의 원본 대화가 1~3문장 요약으로 줄어 `episodes/live`에 들어간다. 원본은 `jaw.db/messages`에 남지만 프롬프트 주입 대상이 아니다. 정보 손실은 여기서 대부분 발생하고, 이후 단계에는 진짜 망각 메커니즘이 없다.

또 `reflect`의 타깃당 6개 / 전체 24개 상한도 사실상 유입량 제한으로 작동한다.

**정리: 삭제되는 메모리는 없다.** 랭킹이 낮아질 뿐이다. `shared/*.md`는 reflect가 날짜 섹션을 계속 append하므로 단조 증가하고, 이를 정리하는 코드는 없다.

---

## 6. 좋은 아이디어 5개

**1. 파일이 원본, DB는 언제든 버릴 수 있는 파생물**
`reindexAll`이 인덱스를 통째로 재생성한다(`indexing.ts:237-294`). 인덱스가 깨지거나 스키마가 바뀌어도 마크다운만 있으면 완전 복구된다. 사용자가 에디터로 직접 고칠 수도 있고 git에 올릴 수도 있다. 메모리를 DB에 가두는 설계보다 운영 리스크가 훨씬 낮다.

**2. 요약기를 권한 없는 격리 프로세스로 돌리는 것**
`permissions: 'deny'`로 스폰하고 목적지 경로를 템플릿에 노출하지 않는다(`memory-flush-controller.ts:188-193, 418`). 게다가 요약 출력의 모든 마크다운 헤딩을 이스케이프한다(`:497`). "적대적인 대화 텍스트가 요약기를 설득해 메모리 파일을 직접 쓰게 만들 수 있다"는 위협을 실제로 모델링했고, 프롬프트의 "쓰지 마라"는 문장을 경계로 신뢰하지 않는다는 입장을 코드로 관철했다. 메모리 시스템에서 이 수준의 인젝션 방어는 드물다.

**3. 주입 블록이 스스로를 불신하게 만드는 문구**
`- this is a PAST SNAPSHOT, not current state` (`injection.ts:54-56`). 실제 사고(#518, 낡은 캐시 카운트를 확신에 차서 단언)에서 역산해 나온 문구다. 프롬프트 한 줄로 고칠 수 있는 문제를 아키텍처 문제로 오인하지 않았다는 점, 그리고 역할별로 주입 범위를 나눠 flush에는 아무것도 안 주는 것(피드백 루프 차단)이 같이 묶여 있다.

**4. 세션별 watermark + 세션 단위 탈락**
전역 watermark 하나면 조용한 세션의 오래된 행이 영영 요약되지 않고(#454), 예산 맞추려 행 단위로 자르면 watermark가 주장하는 "이 id 이하는 모두 요약됨"이 거짓말이 된다. 둘 다 실제로 겪고 고친 흔적이 주석에 남아 있다(`memory-flush-controller.ts:18-30, 259-296`). "가장 오래된 대기 행 기준 정렬"로 기아를 막는 것도 같은 계열의 판단이다.

**5. CJK 쿼리를 trigram으로 분기**
`unicode61` 토크나이저는 한국어를 공백으로만 쪼개서 부분일치가 안 된다. 이를 정면으로 인정하고 CJK 3자 이상은 trigram, 3자 미만은 LIKE로 보내는 라우팅(`indexing.ts:638-652`)은 형태소 분석기를 붙이지 않고 얻을 수 있는 현실적 최선에 가깝다. 비CJK는 BM25+trigram RRF를 유지해 영어 품질을 희생하지 않는다.

---

## 7. 약점 3개

**1. 승격 파이프라인이 정규식이고, 종점이 막혀 있다**
`classifyLine` (`reflect.ts:83-123`)은 키워드 매칭 점수 1점이면 승격한다. "preference"나 "설정"이 스친 문장이 전부 `shared/preferences.md`로 간다. 요약 생성에는 LLM을 쓰면서 정작 **무엇을 영구 기억으로 승격할지는 정규식이 정한다** — 판단이 더 필요한 쪽에 더 약한 도구가 붙어 있다.

더 심각한 건 soul 경로다. reflect는 soul 후보를 항상 `confidence: 'medium'`으로 만들고(`:217`), `applySoulUpdate`는 medium을 `soul-candidates.log`에 적기만 한다(`identity.ts:43-49`). 로그를 읽어 승인하는 UI나 CLI를 찾지 못했다. 즉 정체성 학습 루프가 설계는 되어 있으나 **실질적으로 닫혀 있다.**

**2. 삭제가 없어서 무한 증식한다**
§5에서 확인했듯 decay는 랭킹에만 있고, 유일한 아카이브 함수는 호출되지 않으며, digest 압축은 소비자만 있고 생산자가 없다. `shared/*.md`는 reflect가 날짜 섹션을 계속 붙이는 append-only 파일이고 정리 주체가 없다. 게다가 dedup이 "소문자 앞 80자 프리픽스 일치"(`reflect.ts:169-174`)라 같은 사실을 조금 다르게 쓴 문장은 매번 새 항목으로 쌓인다.

지금은 37 chunks라 문제가 안 보이지만, 이건 규모가 커진 뒤에야 드러나는 종류의 부채다. `retentionDays` 설정이 UI에 노출되면서 실제로는 아무것도 지우지 않는 것도 사용자를 오도한다. 같은 패턴으로 `autoReflectAfterFlush`(`config.ts:378`)는 설정과 UI가 다 있지만 flush 컨트롤러는 이를 읽지 않고 `maybeAutoReflect()`를 무조건 호출한다(`memory-flush-controller.ts:526`) — 끌 수 없는 토글이다.

**3. 연합 랭킹이 순위만 보고 점수를 버린다**
`rerankAcrossInstances` (`result-rerank.ts:21`)는 `1/(60+rank)`만 쓴다. 코퍼스 크기가 달라 BM25 절대값을 못 섞는 건 맞지만, 결과적으로 **아무 관련 없는 인스턴스의 1위가 정확히 관련된 인스턴스의 2위를 이긴다.** 관련도 임계값이 없어서, 질의어가 전혀 없는 인스턴스도 LIKE 폴백으로 뭐라도 뱉으면 그게 상위에 올라온다.

같은 맥락에서 로컬 검색의 `searchBM25`도 LIKE 폴백 결과에 score 999를 주지만(`indexing.ts:521`), 이건 RRF 융합 단계에서 순위로 환원되면서 페널티가 희석된다. 즉 "정말로 매칭된 것"과 "부분문자열이 우연히 스친 것"을 최종 순위에서 구분할 방법이 남지 않는다.

---

## 8. 확인하지 못한 것 (unknown)

- `soul-candidates.log`의 medium 후보를 검토/승인하는 경로. 코드에서 읽는 곳을 찾지 못했다.
- `memory.appendDaily()` (`memory.ts:144`)의 호출자. `episodes/daily/`는 실제 인스턴스에도 없다.
- `applySoulUpdate`를 `confidence: 'high'`로 호출하는 곳. reflect는 항상 medium이다.
- `tryEmbeddingSearch` / `src/manager/memory/embedding`의 내부 동작. 이번 범위 밖이라 읽지 않았다. `embedding.json`의 `enabled`가 켜져야 도는 옵션 경로로만 확인했다(`memory-flush-controller.ts:550-570`).
- `session_buckets.memory_snapshot` 컬럼의 실제 쓰임.
- `structured/sessions/`, `corrupted/`, `legacy-unmapped/` 디렉터리를 채우는 코드. 생성만 확인했다.

