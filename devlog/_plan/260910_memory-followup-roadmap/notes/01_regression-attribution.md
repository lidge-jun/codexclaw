# 01 — 회귀 귀속 (S1)

날짜: 2026-09-10 (KST). 과제: 메모리 상태 점검 평가(cases.json 30 + followups.json 8)의 Codex chat/memory 검색을 설치본(머지 후)과 머지 전 0cacdc8d에서 같은 명령으로 재실행.

원본 평가: `/Users/jun/.codex/visualizations/2026/09/09/01a08805-2ace-7250-8272-3636e50fa5eb/memory-search-eval/{cases,results,followups}.json`.
원본 레포는 읽기만 했고, 머지 전 트리는 `/tmp/mfu-260910/premerge` 공유 클론(detached 0cacdc8d2e8df26b96d47a325270cc7a25069904). 워크트리 HEAD는 그대로 369ed0e1.

## 진입점 (확인됨)

양쪽 모두 payload dispatcher → recall dist CLI. 빌드하지 않음. dist는 커밋되어 있다(`git ls-files plugins/codexclaw/components/recall/dist`: 머지 전 14개 파일).

- (a) 설치본: `node /Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs`
  - `componentCli` = `components/<name>/dist/cli.js` (cxc.mjs:28)
  - `COMMAND_TABLE.chat/memory = "recall"` (cxc.mjs:58-59)
  - spawn: cxc.mjs:105 → `.../components/recall/dist/cli.js`
  - dist에 `query-words.js`, `cwd-context.js` 포함 (L0 이후).
- (b) 머지 전: `node /tmp/mfu-260910/premerge/plugins/codexclaw/bin/cxc.mjs` (같은 28/58-59 라우팅)
  - → `/tmp/mfu-260910/premerge/plugins/codexclaw/components/recall/dist/cli.js`
  - dist에 `query-words.js` / `cwd-context.js` 없음.

코드 인용은 실행 트리와 대응시킨다. 머지 후 규칙은 워크트리 src(`plugins/codexclaw/components/recall/src`, HEAD 369ed0e1, L0 포함)이고, 재실행 바이너리는 설치본 캐시 dist다.

## 인덱스 / 스키마

- 공유 인덱스: `~/.codexclaw/recall/index.sqlite` (schema_version=2, files=13194, msgs=1226523, size=12106944512).
- 채팅 검색은 모두 `--no-refresh`. 메모리 채팅 폴백도 `noRefresh: true` (memory-search.ts:524-526). 재실행 후 인덱스 mtime은 2026-09-10 06:28:09로, 본 과제 검색(06:32대)이 파일을 쓰지 않았다.
- 머지 후 인덱스는 `recall_hit_counts` 테이블을 추가로 가진다. `INDEX_SCHEMA_VERSION`은 양쪽 모두 `"2"` (index-db.ts:18). 이 테이블은 훅 전용이며 검색 코어는 만지지 않는다 (index-db.ts:30-32). `--no-refresh`는 `openIndexReadOnly`라 DDL을 실행하지 않는다 (index-db.ts:37-38).
- 머지 전 코드로 인덱스 읽기: **스키마 실패 없음**. 우회 복제(`/tmp/mfu-260910/premerge-home`)는 쓰지 않았다.
- 인덱스 위치 옵션 (양쪽 CLI, `strict: false`): `--home` = Codex home(`$CODEX_HOME` ?? `~/.codex`), `--index-path` = 사이드카 sqlite, 환경변수 `$CODEXCLAW_HOME` (index-db.ts:20-26). `--home`은 인덱스 경로가 아니다.

## 판정 요약

재실행한 cxc 케이스 25건(본평가 chat/memory 18 + followup 7). Aside/wiki 13건은 재실행하지 않고 `cxc 밖`.

| 판정 | 건수 | 케이스 |
|---|---|---|
| 회귀 | 1 | memory_R1 (`2.49.0 SLSA`) |
| 개선 | 5 | fallback_fresh; chat_D1/D2, repeat_chat_spacing, chat_release_broad (순위) |
| 동일 | 8 | chat_F1, memory_D1/D2/P1, fix_dogfood/plugins/release, 부재 쿼리 chat_N1/memory_N1 |
| 둘 다 실패=원래 한계 | 11 | 자연어 D3/P2/R2 (chat+memory 6), chat_P1, chat_R1, chat_release_tools, memory_F1 |

동일 8에 부재 쿼리 2건을 포함하면 표의 행 합이 25. 부재 쿼리 0건은 기대한 음성이라 `동일`으로 둔다.

핵심: 평가가 보고한 **자연어 0건은 L0 회귀가 아니다**. 머지 전에도 같은 AND·공백 토큰 규칙으로 0건이다. L0가 만든 실측 변화는 (1) 채팅 관련도 순위 개선(#103), (2) 메모리→채팅 폴백 개선(#108), (3) 심볼 경계 매칭이 `v2.49.0` 형태를 놓치는 회귀(#105) 한 건이다.

## 케이스 결과

명령은 cases.json/followups.json과 같고, 바이너리 경로만 갈랐다. 채팅은 원본 그대로 `--no-refresh`. 메모리에도 `--no-refresh`를 붙였고, 머지 전 CLI는 `strict: false`라 모르는 플래그를 무시한다. `--limit 3`이라 hit 수 3은 실제 매칭 ≥3일 수 있다(채팅은 `clipped`/matchedFiles로 보완).

제목은 채팅=`title`, 메모리=`relpath`. 길면 앞 70자.

### 본평가 chat

| id | 질의 | 머지 전 n / 상위3 | 머지 후 n / 상위3 | 판정 |
|---|---|---|---|---|
| chat_D1 | 도그푸딩 | 3 / 로그인풀림 스레드, 도그 푸딩 세팅…, 도그 푸딩 세팅… (matchedFiles=2, recency) | 3 / 현재 dev 기준으로 ff 하고 도그푸딩 셋업해줘, 지금 도그푸딩 세팅해봐, 현재 pull하고 도그푸딩 세팅해봐 (원본 평가와 동일) | 개선(순위). 매칭 술어는 같고 기본 정렬만 recency→relevance (#103, index-search.ts:12-15) |
| chat_D2 | 도그 푸딩 | 3 / 로그인풀림, readme 뒤처짐, 도그 푸딩 세팅… | 3 / 도그 푸딩 세팅좀 해줘 ff 하고, 계정 불러오기…, 로그인풀림 (원본과 동일) | 개선(순위) |
| chat_D3 | (자연어 도그푸딩) | 0 / matchedFiles=0 | 0 | 둘 다 실패=원래 한계 |
| chat_P1 | BundledPluginsMarketplace | 0 | 0 | 둘 다 실패=원래 한계 (같은 질의는 memory_P1에서 3건 — 채팅 코퍼스에 문자열이 없거나 FTS가 카멜케이스를 못 쪼갬. unknown: 메시지 원문을 이 과제에서 열어보지 않음) |
| chat_P2 | (자연어 플러그인 와이프) | 0 | 0 | 둘 다 실패=원래 한계 |
| chat_R1 | 2.49.0 SLSA | 0 | 0 | 둘 다 실패=원래 한계 (한 메시지 AND. memory_R1은 히트) |
| chat_R2 | (자연어 2.49.0 검증) | 0 | 0 | 둘 다 실패=원래 한계 |
| chat_N1 | zxqv84721무지개잠수함 | 0 | 0 | 동일 (부재 쿼리) |
| chat_F1 | 로그인이 풀리는데 | 1 / 지금 작업하다가 계속 코덱스 로그인이 풀리는데… | 1 / 동일 제목 | 동일 |

### 본평가 memory (`--no-chat`)

| id | 질의 | 머지 전 n / 상위3 | 머지 후 n / 상위3 | 판정 |
|---|---|---|---|---|
| memory_D1 | 도그푸딩 | 3 / MEMORY.md, MEMORY.md, rollout_summaries/2026-09-04T11-22-14-jBOL-… | 동일 | 동일 |
| memory_D2 | 도그 푸딩 | 3 / MEMORY.md, memory_summary.md, raw_memories.md | 동일 | 동일 |
| memory_D3 | (자연어) | 0 | 0 | 둘 다 실패=원래 한계 |
| memory_P1 | BundledPluginsMarketplace | 3 / memory_summary.md ×2, extensions/ad_hoc/notes/20260908-codex-bundled-plugin-wipe-remote-ssh.md | 동일 | 동일 |
| memory_P2 | (자연어) | 0 | 0 | 둘 다 실패=원래 한계 |
| memory_R1 | 2.49.0 SLSA | 3 / memory_summary.md, rollout_summaries/2026-09-09T05-16-09-7x4X-…, MEMORY.md | 2 / memory_summary.md, rollout_summaries/… (MEMORY.md 탈락) | **회귀** |
| memory_R2 | (자연어) | 0 | 0 | 둘 다 실패=원래 한계 |
| memory_N1 | (부재) | 0 | 0 | 동일 |
| memory_F1 | 로그인이 풀리는데 | 0 | 0 | 둘 다 실패=원래 한계 (메모리 스토어 지연. 아래 fallback_fresh가 채팅 폴백으로 보완) |

limit=5로 memory_R1을 다시 보면 머지 전 n=4 (MEMORY.md 청크 2개, per-file cap=2), 머지 후 n=2. 탈락 excerpt는 `SLSA provenance, v2.49.0` 형태.

### followups (cxc만)

| id | 질의 | 머지 전 | 머지 후 | 판정 |
|---|---|---|---|---|
| fix_dogfood | source dogfooding | 3 / stage1 01a084de, 01a078f9, 01a074af | 동일 | 동일 |
| fix_plugins | plugin restart | 3 / stage1 01a01314, 20260908-codex-bundled-plugin-wipe…, MEMORY.md | 동일 | 동일 |
| fix_release | 2.49.0 provenance | 3 / stage1 01a08029, memory_summary.md, rollout 7x4X | 동일 | 동일 |
| fallback_fresh | 로그인이 풀리는데 (`--no-chat` 없음) | 0 | 1 / sessions/2026/09/10/rollout-…01a087ef…, warn=`no memory artifacts matched — 1 raw session message(s) shown instead` | **개선** (#108 채팅 폴백) |
| chat_release_broad | 2.49.0 | 3 / 도그푸딩 스레드가 1위 (recency), 그다음 릴리스 스레드 | 3 / 2.49.0 배포 스레드 제목들 (원본 followup과 같은 방향, matchedFiles=2) | 개선(순위) |
| chat_release_tools | 2.49.0 SLSA (`--no-tools` 없음) | 0 | 0 | 둘 다 실패=원래 한계 |
| repeat_chat_spacing | 도그 푸딩 | chat_D2와 같은 패턴 (pre recency / post relevance) | 개선(순위) |

### cxc 밖 (재실행 안 함)

A1–A6 aside, W1–W6 wiki, followup `aside_literal` (`ask.py --ns aside`). 원본 평가에서 Aside 자연어/키워드 무관 점수·위키 대표문서 편중은 cxc recall 밖이다. L0 PR #100–#108 귀속 대상이 아니다.

## 자연어 3건이 양쪽 0건인 이유

대상: chat/memory D3·P2·R2. 질의 토큰은 설치본 `query-words.js`로 재현.

공통 규칙 (머지 전·후 동일):

- 공백 split, 빈 토큰 제거, **최대 8단어** (머지 전 chat-search.ts:31,85-90; 머지 후 query-words.ts:21,34-38).
- 기본은 AND. 채팅: `words.every(lowerText.includes)` (pre chat-search.ts:93-94, post chat-search.ts:107-108, index-search.ts:115·147-149). 메모리: 그룹 사이 AND, 그룹 안 OR (pre memory-search.ts:222-225, post memory-search.ts:351-354).
- 채팅은 동의어/어간을 쓰지 않는다. 메모리만 `expandQueryWords`.

실제 토큰:

- D3 `지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법` → 8단어 `지난번, 로컬, 소스를, 실제, 서비스에, 연결하고, 정상, 동작까지`. 버려짐: `확인한, 방법` (MAX_WORDS=8).
- P2 `코덱스를 재시작하면 플러그인이 사라지는 문제` → 5단어 `코덱스를, 재시작하면, 플러그인이, 사라지는, 문제`.
- R2 `2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록` → 8단어 `2.49.0, 배포하고, npm, 패키지가, 진짜, 그, 소스인지, 검증한`. 버려짐: `기록`. `그`도 AND 항.

조사·어미가 토큰에 붙어 `소스를`는 `소스`를, `서비스에`는 `서비스`를 채팅 경로에서 못 맞춘다. 머지 후 메모리는 한국어 어간을 OR 멤버로 넣는다 (synonyms.ts:134-174, `소스를`→`소스`, `재시작하면`→`재시작`, `배포하고`→`배포`+deploy). 그래도 8항 AND(`지난번`∧`실제`∧`정상` …, R2는 `진짜`∧`그`∧`소스인지`)가 한 청크에 동시에 있어야 해서 0건이다. `--any`를 안 켠 원본 명령과 같다.

따라서 자연어 0건은 **L0 이전부터 있던 매칭 모델 한계**다. #105 어간 확장은 메모리 쪽을 완화했지만 이 3질의는 통과시키지 못했다.

## 회귀 1건: memory_R1

질의 `2.49.0 SLSA`. 설치본 토큰: `2.49.0` symbol=true (FILENAME 정규식이 `.0`에 매칭, query-words.ts:55,64-72), `SLSA` symbol=true (UPPER_ACRONYM, query-words.ts:47). 두 그룹 모두 `boundary: true`.

경계 판정은 전후 문자가 `[A-Za-z0-9_]`이면 실패 (query-words.ts:84-90). 머지 전 MEMORY.md 히트 excerpt에 `v2.49.0`이 있다. `v`가 TOKEN_CHAR라 머지 후 `2.49.0` 경계 매칭이 실패한다. 머지 전은 그냥 substring `includes` (memory-search.ts:224).

완화 재시도는 **후보가 0일 때만** 돌아간다 (memory-search.ts:466-467). memory_summary.md / rollout_summaries는 이미 경계에 맞는 `2.49.0`+SLSA를 가지고 있어서 재시도가 안 열리고, MEMORY.md만 조용히 탈락한다.

이 회귀의 도입 지점은 L0 #105 (query-words / 심볼 경계). #107 hit_count는 훅 테이블이라 검색 결과와 무관 (index-db.ts:30-32).

## 개선 2종

1. 채팅 기본 정렬 recency → relevance RRF (index-search.ts:12-15 vs 머지 전 ORDER BY m.ts DESC, index-search.ts:86). chat_D1/D2에서 최신 로그인-풀림 스레드가 키워드 히트로 1위이던 것이, 제목이 도그푸딩인 스레드로 바뀌었다. 원본 평가의 설치본 결과와 일치.
2. 메모리 0건일 때 채팅 폴백 (#108). fallback_fresh만 머지 후 1건. memory_F1은 `--no-chat`라 계속 0 — 폴백을 끈 명령의 원래 한계.

키워드 메모리(도그푸딩, BundledPluginsMarketplace, source dogfooding, plugin restart, 2.49.0 provenance)는 상위3 relpath가 양쪽 동일했다.

## 원본 평가와의 관계

본평가 chat/memory 18건의 설치본 재실행 hit 수·상위 제목은 원본 results.json과 같다 (memory_R1 원본도 이미 n=2). 원본 점검이 본 설치본과 같은 엔진을 본 것이고, 그 증상의 대부분은 머지 전에도 재현된다.

## 로드맵 입력

### (a) 회귀 여부 판정

- 자연어 검색 0건, 채팅 `BundledPluginsMarketplace`/`2.49.0 SLSA` 0건, `--no-chat` freshness 0건: **원래 한계** (L0 이전 토큰·AND 모델 + 코퍼스 위치).
- 채팅 상위 결과의 관련도: **개선** (#103). 회귀 아님.
- 최근 대화가 메모리에 없을 때: **개선** (#108 폴백). `--no-chat`이면 이전과 같음.
- `2.49.0 SLSA`가 MEMORY.md `v2.49.0` 청크를 잃는 것: **L0 #105 회귀**.
- Aside 무관 점수·위키 대표문서 편중: **cxc 밖**.

### (b) 수정 후보

**P0**

- 긴 자연어 AND 실패. 채팅은 어간/불용어가 없고 MAX_WORDS=8에서 뒷단어를 버린다. 대상: query-words.ts, chat-search.ts, index-search.ts, memory-search.ts. 후보 동작: 조사·어미 분리(이미 메모리 synonyms.ts:134-174), 채팅에도 동일 그룹을 쓰거나, 단어≥5이면 AND를 완화(`--any` 자동, 필수어만 AND). 검증: 아래 D3/P2/R2 명령을 머지 전 0 / 목표 n>0으로.
- 버전 문자열 경계 오탐. `2.49.0`을 FILENAME으로 취급하지 말 것. `v2.49.0` 접두를 경계로 인정하거나, 심볼 완화를 “전체 0건”이 아니라 그룹 단위 미스로 확대 (memory-search.ts:466). 대상: query-words.ts `FILENAME`/`isSymbolWord`, memory-search.ts relax 조건. 검증: memory_R1 limit 5에서 MEMORY.md 복구, memory_summary.md는 유지.

**P1**

- 채팅 관련도 정렬은 유지. 회귀로 되돌리지 말 것. 검증: chat_D1 1위가 도그푸딩 제목 스레드인지 (로그인풀림 스레드가 1위면 후퇴).
- 채팅 폴백은 유지하되, cxc-recall 스킬에 `--no-chat`가 freshness를 숨긴다는 점을 명시. 검증: fallback_fresh 명령 n≥1, memory_F1(`--no-chat`) n=0이 의도인지 문서화.
- camelCase 식별자 채팅 미스(chat_P1). 대상: index-search.ts wordCondition / FTS tokenize. 검증: `chat search BundledPluginsMarketplace --days 0 --no-refresh --json` — 메모리에 있는 문자열이면 채팅에서도 n>0이거나, 코퍼스 부재면 스킬이 memory로 넘기도록.

**P2**

- 희귀 토큰 2개 AND (`2.49.0` AND `SLSA`)가 한 채팅 메시지에 동시에 있어야 함. 스킬 쪽 쿼리 분해(버전 / 고유명사 각각 검색 후 병합)가 코드 변경보다 싸다면 스킬 P2. 검증: chat_R1 vs memory_R1.
- Aside/위키는 별 트랙. 이 노트의 cxc 재실행으로 손대지 않음.

### (c) 검증 명령

설치본 BIN=`/Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs`. 인덱스를 건드리지 않으려면 채팅에 `--no-refresh`.

```bash
# P0 자연어 (현재 양쪽 0)
node "$BIN" chat search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --context 0 --no-tools --no-refresh
node "$BIN" memory search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --no-chat --no-refresh

# P0 버전 경계 회귀 (현재 설치본 2, 머지 전 3+)
node "$BIN" memory search "2.49.0 SLSA" --days 0 --limit 5 --json --no-chat --no-refresh

# P1 순위 (1위가 도그푸딩 제목이어야 함)
node "$BIN" chat search "도그푸딩" --days 0 --limit 3 --json --context 0 --no-tools --no-refresh

# P1 폴백
node "$BIN" memory search "로그인이 풀리는데" --limit 3 --json --no-refresh
node "$BIN" memory search "로그인이 풀리는데" --days 0 --limit 3 --json --no-chat --no-refresh
```

