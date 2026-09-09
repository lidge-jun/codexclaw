# Aside 메모리 시스템 분석

조사일 2026-09-09. 대상 /Users/jun/.aside/u/0/memory/ (읽기 전용 접근).
측정 시점 인덱스 세대는 gen-0000001381, updatedAt 2026-09-08T16:47:23Z.
CLI 는 /Users/jun/.local/bin/aside. 아래 수치는 모두 그 시점 스냅샷이고, 스토어는 세션마다 움직인다.

## 0. 저장소 실측

MEMORY.md            11,224 B  (19줄)
USER.md              13,166 B  (50줄)
TAXONOMY.md         180,664 B  (401줄)
memory-index.json  2,272,965 B  (5,048 entries)
.history.jsonl   432,167,312 B  (908줄)
.dream-state.json        65 B
.moss-cache/           약 12 MB x 2세대
episodic/              1.2 MB (21개 날짜 파일, 2026-07-30 ~ 2026-09-09)

디렉터리는 9개다. concepts/ 23개, sites/ 25개, projects/ 6개, agent/ 5개,
routines/ 3개, people/ 1개, companies/ 1개, users/ 1개, episodic/ 21개.
aside memory list --json 이 반환한 마크다운 파일 총수는 91개다.

## 1. L1 / semantic / episodic 3계층의 실제 동작

계층 정의는 TAXONOMY.md 5-14행 Invariants 에 명시돼 있다.

> - Semantic and episodic memory are the source of truth. L1 (MEMORY.md, USER.md) is derived from them.
> - L1 files must stay small enough for prompt loading.
> - Semantic pages use frontmatter + Current + History.
> - Episodic memory lives under episodic/ and uses append-only raw markdown entries grouped by date.
> - Read-time retrieval must not depend on this file.

마지막 줄이 중요하다. TAXONOMY 자체는 쓰기(write-routing) 규범 문서고, 읽기 경로는 이걸 안 거친다.
즉 이 파일은 dreaming 이 참조하는 편집 규칙집이지 런타임 인덱스가 아니다.

### 실제 쓰기 경로 (.history.jsonl 실측)

.history.jsonl 908줄은 전부 trigger: "session_completed", status: "success" 이고
타입은 두 종류뿐이다.

| type | 건수 | 중앙 elapsedMs | 주 대상 |
|---|---|---|---|
| extraction | 764 | 14,869 | episodic/YYYY-MM-DD.md |
| dreaming | 144 | 332,549 | semantic + L1 + TAXONOMY |

extraction 은 세션이 끝날 때마다 도는 짧은 패스다. 마지막 레코드의 result 는
{"filesTouched": ["episodic/2026-09-09.md"], ...} 하나뿐이고, 대부분의 extraction 은
episodic 한 파일만 건드린다. 다만 episodic 전용은 아니다 — extraction 이 non-episodic 경로를
쓴 사례가 실제로 있다: routines/daily-multi-channel-inbox-task-digest-.../MEMORY.md 22회,
TAXONOMY.md 17회, users/byungjun-kim.md 12회, projects/opencodex.md 10회.
"extraction=episodic, dreaming=semantic" 은 경향이지 강제 규칙이 아니다.

dreaming 은 훨씬 무겁다. 마지막 dreaming 레코드(2026-09-08T16:08:04Z)는
elapsedMs 1,025,668 (17분), totalTokens 44,581,638 (cacheRead 43.8M),
filesTouched 15개, result.episodicWindowDays: 14,
episodicWindowRange: "2026-08-23 - 2026-09-09" 였다.
144번의 dreaming 전부 episodicWindowDays: 14 다. 즉 dreaming 은 항상 최근 14일
episodic 창을 읽고 semantic/L1 로 승격한다. 고정 윈도우이고, 그 밖의 episodic 은
dreaming 입력에 안 들어온다.

### 계층 간 실제 흐름

세션 종료 --extraction--> episodic/YYYY-MM-DD.md   (append-only, 14.9s)
                              |
                              | 최근 14일 창
                              v
세션 종료 --dreaming-----> projects/ sites/ agent/ concepts/ users/ ...  (편집/병합, 5.5분 중앙)
                              |
                              v
                         MEMORY.md / USER.md   (프롬프트 로드용 요약)

dreaming 대상 상위 실측:
TAXONOMY.md 104회, projects/opencodex.md 95회, USER.md 89회,
users/byungjun-kim.md 86회, MEMORY.md 66회, projects/neuralarcade.md 58회.

눈에 띄는 점: dreaming 이 가장 많이 고친 파일이 TAXONOMY.md 자체다.
규범 문서가 스스로를 계속 다시 쓴다. 5,798 B (2026-08-31) -> 179,620 B (2026-09-08),
9일 만에 31배. 이건 "규칙집"이 아니라 실패 사례 누적 로그로 변질된 상태에 가깝다.

### L1 사이즈 규율은 지켜지지 않는다

TAXONOMY.md 32행:

> USER.md target <= 5 KB, MEMORY.md <= 3 KB.

실측은 MEMORY.md 11,224 B, USER.md 13,166 B. 각각 목표의 3.7배, 2.6배다.
dreaming 이 기록한 afterContent 길이 추이로 보면 MEMORY.md 는 458 B (2026-08-30) ->
11,148 B (2026-09-08), USER.md 는 191 B (2026-08-02) -> 12,870 B (2026-09-08).
자기가 쓴 사이즈 규칙을 자기가 계속 위반하면서 단조 증가한다. L1 압축은 규범에만 있고
실행에는 없다.

## 2. 인덱싱과 검색 랭킹 실체

### 임베딩이다 (키워드 아님) - 판정 근거

.moss-cache-schema 파일 내용은 moss-minilm-provenance-v1 한 줄이다.
캐시 디렉터리는 세대별 append 구조다.

.moss-cache/memory-a291c31e-.../CURRENT            -> "gen-0000001381"
.moss-cache/memory-a291c31e-.../gen-0000001381/
    COMMITTED       14 B
    session.json   338,533 B
    docs.json    4,287,895 B
    index.mossvec 7,834,752 B

session.json 헤더(docIds 제외):

    {"dimension": 384, "generation": "gen-0000001381",
     "manifestSha256": "4932540174ffd210d5bde5c4d92c989f11c40558ba17af810f9bd173d14ae996",
     "modelArtifactVersion": "bootstrap-2026-08-11",
     "modelId": "moss-minilm",
     "name": "memory-a291c31e-f7a3-4f57-a143-627c85cab7e6-main",
     "updatedAt": "2026-09-08T16:47:23.828916+00:00"}

index.mossvec 바이너리 헤더를 직접 뜯었다.

    00000000: 4d4f 5353 0200 0100 8001 0000 1006 0000  MOSS............
    00000010: b813 0000 0000 0000 0001 0000 0000 0000

매직 MOSS, 이어서 <HHIIIQ 로 풀면 (2, 1, 384, 1552, 5048, 1099511627776).
= version 2, flags 1, dim 384, stride 1552, rows 5048.
파일 크기 7,834,752 = 256(헤더) + 5048 x 1552 로 정확히 맞는다.

행 레이아웃도 확정했다. 오프셋 16부터 384개 float32 를 읽으면 L2 norm 이 정확히 1.0 이고,
앞 16바이트는 u64 row_index + f32 norm(약 1.0) + u32 0 이다.

    row0 hdr 0000000000000000feff7f3f00000000  u64=0 f32@8=0.9999998807907104 u32@12=0  -> vec norm 1.0
    row1 hdr 01000000000000000000803f00000000  u64=1 f32@8=1.0                          -> vec norm 1.0

결론: 384차원 정규화 dense 벡터를 flat 배열로 저장한 임베딩 인덱스다.
moss-minilm 이라는 모델 ID 와 384 dim 은 MiniLM 계열(all-MiniLM-L6-v2 가 384 dim)과 일치한다.
정규화가 돼 있으니 검색은 내적 = 코사인 유사도다. 역색인/BM25/토큰 사전 같은 키워드 구조물은
캐시 어디에도 없다. HNSW 같은 ANN 그래프도 없다 - 5,048행 flat brute-force scan 이다.

### memory-index.json 은 벡터가 아니라 위치 메타다

{"version":1,"entries":{<chunkId>: {...}}} 구조이고 엔트리 스키마는
['charOffset','hash','headings','id','lineStart','path','title'] 뿐이다. 벡터는 여기 없다.

검증한 것:

- memory-index.json 의 5,048개 id 집합 == docs.json 의 5,048개 id 집합 (완전 일치)
- session.json 의 docIds 순서 == docs.json 배열 순서 (완전 일치)
  -> 즉 index.mossvec 의 N번째 행 = docIds[N] = docs.json[N] 이라는 위치 대응.
- entries[id].hash == sha256(docs.json 해당 text). 실제로 MEMORY.md 첫 청크에서
  sha256 == a2d52e19... 로 일치 확인. hash 는 청크 본문 해시라서 재인덱싱 여부를 판단하는
  변경 감지 키다.

즉 역할 분리는 이렇다: index.mossvec = 의미, docs.json = 본문, memory-index.json =
파일/오프셋/제목 복원용 메타. 세 파일이 같은 순서로 정렬돼 있어서 조인 키가 필요 없다.

### 청킹 방식

청크 본문 길이는 min 1 / median 794 / max 1,025 자다. 상한이 약 1KB 에서 잘린다.
episodic/2026-09-09.md 청크들의 (charOffset, len) 을 뽑아보면

    offset 0     line 1   len 807  end 807
    offset 514   line 7   len 825  end 1339
    offset 808   line 9   len 532  end 1340
    offset 1339  line 10  len 981  end 2320
    offset 2077  line 15  len 794  end 2871

오프셋이 겹친다 (0-807 과 514-1339). 슬라이딩 윈도우 오버랩 청킹이고, 게다가 서로 다른
시작점 두 개가 같은 지점(1339/1340)에서 끝난다. 헤딩 경계 분할과 고정길이 분할이 섞여 있는 것으로
보인다. 정확한 분할 알고리즘은 바이너리 안에 있어서 (unknown).

청크당 파일 분포 상위: episodic/2026-09-08.md 867개, TAXONOMY.md 422개,
episodic/2026-09-04.md 375개, projects/opencodex.md 370개.
episodic 이 인덱스를 지배한다. 5,048 청크 중 episodic 만 대략 절반 이상이다.
TAXONOMY.md 가 단일 파일로 2위(422 청크)라는 건, 규범 문서가 검색 결과를 오염시킬 수 있다는 뜻이다.
실제로 'moss cache indexing' 검색 4위로 TAXONOMY.md#Resolver Evolution 이 올라왔다.
Invariants 의 "Read-time retrieval must not depend on this file" 은 지켜지지 않는다 -
TAXONOMY 는 통째로 인덱싱돼서 리콜에 섞여 들어온다.

### 검색 랭킹 실측

aside memory search --json 이 반환하는 필드는
path, title, headings, excerpt, line, score, chunkId, date 다.
chunkId 가 memory-index.json 의 키와 동일함을 확인했다 (ec57bfe0... 조회 성공).

세 개 쿼리를 실제로 돌렸다.

(A) 'opencodex 릴리스 검증' (한국어) - 1위 projects/opencodex.md#L1,
2위 episodic/2026-08-31.md#L272, 3~5위 opencodex 페이지 내부. 한국어 쿼리로 영어 문서를
정확히 맞췄다. 다국어 임베딩이 작동한다.

(B) 'MAX_STOP_BLOCKS' (정확한 식별자) - score 0.8265 / 0.7531 / 0.662 ...
1위가 episodic/2026-09-04.md#L942, 2위가 projects/codexclaw.md#L21.
문제는 하위권이다. 0.5572 로 MEMORY.md 가, 0.571 로 concepts/mid-turn-steer.md 가 올라온다.
MAX_STOP_BLOCKS 라는 리터럴이 없는 문서들이다. 순수 벡터 검색의 전형적 약점이고,
정확한 식별자 검색에 하이브리드(BM25) 레인이 없다는 증거다.

(C) 'What is the weather in Antarctica' (스토어에 없는 주제) - 그래도 10건이 반환된다.
1위 score 0.6825 (episodic/2026-09-05.md), 10위 0.5488.
score 하한(cutoff)이 없다. 완전 무관한 쿼리도 0.68 을 받는다. 즉 score 는 절대적 관련성
지표로 못 쓰고, "0.7 이상이면 관련 있다" 같은 임계값 해석은 틀린다. 관련 없으면 빈 결과를
주는 게 아니라 최근 episodic 을 채워 넣는다.

옵션은 --account, -n/--max-results (1-10), --json 뿐이다.
-n 상한이 10이고, 날짜/경로/디렉터리 필터가 없다. date 필드를 응답에 주면서
정작 그걸로 거를 수단은 CLI 에 없다. 90일 아카이브 규칙(TAXONOMY 42행)을 CLI 에서
구현할 방법 자체가 없다는 뜻이다. 실제 랭킹에 recency boost 가 들어가는지는 (unknown) -
(C) 결과가 최근 파일로 쏠린 건 인덱스 자체가 최근 episodic 으로 편중돼서일 수도 있다.

aside memory show <path> / list / path 는 순수 파일 접근이다.
path 는 /Users/jun/.aside/u/0/memory 를 출력한다.

## 3. claim label 규율은 semantic 페이지에서 사실상 무너져 있다

규범은 TAXONOMY.md 16-28행이고 다섯 개로 못 박혀 있다.

> Every non-trivial claim in a semantic Current section carries one of five labels. Do not invent a sixth.
> | (verified YYYY-MM-DD) | ... | volatile values ... MUST carry the date inline |
> | (user-stated YYYY-MM-DD) | ... | (inferred) | ... | (planned) | ... | (unknown) | ... |

실제 파일에서 라벨 출현을 센 결과 (bullets = '- ' 로 시작하는 줄 수):

| 파일 | bullets | verified+날짜 | verified(날짜없음) | user-stated | inferred | planned | unknown |
|---|---|---|---|---|---|---|---|
| projects/opencodex.md | 187 | 2 | 1 | 3 | 17 | 6 | 1 |
| users/byungjun-kim.md | 127 | 3 | 1 | 9 | 1 | 3 | 0 |
| projects/neuralarcade.md | 64 | 9 | 0 | 4 | 13 | 4 | 3 |
| projects/cli-jaw.md | 46 | 4 | 1 | 1 | 7 | 1 | 2 |
| agent/repl.md | 40 | 10 | 0 | 0 | 0 | 0 | 0 |
| projects/ku-2026-2.md | 37 | 2 | 0 | 0 | 0 | 1 | 0 |
| projects/codexclaw.md | 27 | 1 | 1 | 1 | 1 | 0 | 0 |
| sites/x.com.md | 22 | 1 | 0 | 0 | 0 | 0 | 0 |
| companies/lidgeai.md | 20 | 0 | 0 | 0 | 0 | 0 | 4 |
| people/kexin-chen.md | 11 | 0 | 0 | 1 | 0 | 0 | 1 |
| concepts/bundle-teardown.md | 9 | 0 | 0 | 0 | 0 | 0 | 0 |
| projects/ku-courses-taken.md | 44 | 0 | 0 | 0 | 0 | 0 | 0 |
| projects/design-isms.md | 7 | 0 | 0 | 0 | 0 | 0 | 0 |

판정:

깨진다. projects/opencodex.md 는 187개 불릿 중 라벨이 붙은 게 30개(16%)다.
projects/ku-courses-taken.md 44불릿, concepts/bundle-teardown.md 9불릿, projects/design-isms.md
7불릿은 라벨이 하나도 없다. sites/ 페이지 대부분도 마찬가지다.

동시에 라벨이 없는 게 전부 위반은 아니다. agent/repl.md 는 10개 전부 날짜 붙은
(verified YYYY-MM-DD) 이고, 나머지는 재현 가능한 API/도구 동작 기술이라 "volatile value" 가
아니다. 규칙 자체가 "volatile values MUST carry the date" 라서 정적 절차 지식에는 라벨이
불필요하다고 볼 여지가 있다. 문제는 그 구분이 페이지마다 일관되지 않다는 것이다.

라벨이 붙은 곳의 품질은 높다. 실제 문장을 보면 규율이 형식적이지 않다.

companies/lidgeai.md:20 —
> (unknown) Song's acknowledgement of this final settlement, and her separate 학점인정원 confirmation, are still not recorded.

projects/neuralarcade.md:57 —
> 하도윤 (DY) has left the engagement (user-stated 2026-09-05), ...

projects/neuralarcade.md:59 에는 정정 이력까지 인라인으로 남아 있다.
> 지상 and 도현 are one company (SLIT), and 건당 500만 is a package rate, not per person (user-stated 2026-09-05 07:45; earlier per-person framing on this page was a misread and has been corrected).

같은 줄에서 (unknown) 을 부정 증거와 함께 유지하는 것도 확인된다 - "whether 수지/은진 know ...
is (unknown) going into the October renewal" 그리고 "지상/도현's 0 commits are not evidence
of absence". 규칙 20행의 "keep it; say what was searched" 가 실제로 지켜진 사례다.

요약: 라벨 규율은 최근 dreaming 이 활발히 만진 고가치 페이지(neuralarcade, lidgeai, opencodex,
cli-jaw)에서만 살아 있고, 저빈도 페이지에서는 존재하지 않는다. 규율의 적용 범위가
dreaming 의 편집 빈도에 종속된다.

한 가지 더: projects/opencodex.md:7 의 페이지 자체 헤더는
"Labels: (verified) live lookup/file with date; (user-stated); (inferred); (planned)." 인데
5개 중 (unknown) 이 빠져 있다. projects/codexclaw.md:6 헤더는 더 줄어서 3개만 나열한다
((verified), (user-stated), (inferred)). TAXONOMY 18행의 "Do not invent a sixth" 는
지켜지지만, 다섯 개 전부를 옮기는 건 페이지마다 다르다.

## 4. dreaming / decay 실행 증거

### 상태 파일

.dream-state.json 전문:

    {
      "lastDreamAt": 1788883684535,
      "sessionsSinceLastDream": 2
    }

1788883684535 = 2026-09-09T01:28:04Z 근처. 필드가 두 개뿐이다.
sessionsSinceLastDream 카운터가 있다는 건 세션 수 기반 트리거라는 뜻이다.
임계값이 몇인지는 파일에 없다 (unknown) - 바이너리 안이다.
다만 .history.jsonl 의 dreaming 144건이 전부 trigger: "session_completed" 이므로,
세션 종료마다 카운터를 올리고 임계 도달 시 dreaming 을 돌리는 구조로 읽힌다.

### 실행 빈도 (실측)

일자별 dreaming 횟수:

    08-23:2  08-24:4  08-30:4  08-31:10  09-01:7  09-02:2
    09-03:14 09-04:21 09-05:16 09-06:13  09-07:10 09-08:28

하루 28회까지 돈다. "밤에 한 번 자면서 정리" 같은 야간 배치가 아니라 세션 활동에
비례해 상시로 도는 패스다. extraction 764 : dreaming 144 = 약 5.3 : 1.

### 모델

dreaming 은 강한 모델을 쓴다.

    dreaming:   anthropic/claude-opus-5 80, xai/grok-4.6 51, gpt-5.6-terra 13
    extraction: xai/grok-4.6 181, gemini-3.8-flash 144, gemini-3.7-flash 132,
                claude-opus-5 106, gpt-5.6-terra 53

전부 provider: "opencodex" (일부 opencodex-local, openai-codex) 로 라우팅된다.
즉 이 사용자의 Aside 메모리는 자기가 만든 OpenCodex 프록시를 통해 굴러간다.
기록된 costUsd 합계는 dreaming 0.016 / extraction 0.082 인데, 최근 레코드는 costUsd 0 이라
비용 필드는 신뢰할 수 없다. 실제 부하는 토큰으로 봐야 한다 - 마지막 dreaming 한 번이
44.5M 토큰(cacheRead 43.8M)이다.

### decay 는 부분적으로만 실행된다

규범은 TAXONOMY.md 36-43행 "Decay Rules (what dreaming may drop)" 이다.

> - L1 lines whose backing fact is older than 30 days and not marked standing preference -> drop from L1
> - (planned) items past their date -> either promote to History with outcome, or mark (unknown) outcome.
> - Repeated snapshots of the same metric: keep only the latest in Current
> - Explicit negations ... When a page has more than three, restate the positive fact ... and delete the negations.
> - Episodic files are append-only and never edited, but after 90 days they are eligible to be excluded from default recall ranking (archive, do not delete).
> - Site quirk pages (sites/) with no History entry in 60 days are candidates for ... removal

실측 대조:

(a) 축소는 실제로 일어난다. dreaming 변경 1,235건(modified 1,018 / added 217) 중
afterContent 가 beforeContent 보다 짧아진 사례가 39건이다. 예:

    2026-09-07T23:46:17Z  projects/ku-2026-2.md      21,478 -> 18,376
    2026-09-07T23:46:17Z  projects/neuralarcade.md   70,741 -> 65,091
    2026-09-07T23:46:17Z  sites/x.com.md             15,665 -> 14,538
    2026-09-07T23:46:17Z  agent/calendar.md           6,513 ->  5,663

실제 중복 제거/압축이 돈다. 다만 1,235건 중 39건이면 3.2% 다. 나머지 97%는 증가하거나 신규다.

(b) 삭제는 한 번도 없다. change status 는 modified 와 added 두 값뿐이다.
deleted 상태가 0건이다. 파일 단위 삭제는 이 메커니즘에 없다.

(c) L1 30일 decay 는 실행되지 않는다. 위 1절에서 본 대로 MEMORY.md/USER.md 는
단조 증가했다. 30일치 드롭이 돌았다면 크기가 톱니처럼 오르내려야 한다.

(d) 90일 episodic 아카이브는 아직 발동 조건이 아니다. 가장 오래된 episodic 이
2026-07-30.md 로 41일 전이다. 90일 규칙은 아직 시험된 적이 없다 (unknown).
게다가 2절에서 본 대로 CLI 에 날짜 필터가 없어서, 발동해도 어떻게 "default recall ranking 에서
제외"할지 경로가 안 보인다.

### dreaming 이 스스로 기록한 실패 모드

TAXONOMY 하단(248행 이후)은 dreaming 패스가 자기 실수를 적어 놓은 로그다. 이게 이 시스템에서
가장 값어치 있는 부분이다.

TAXONOMY.md:248 - 철회 규칙:
> A dreaming pass must be willing to retract, not only append. ... when new evidence contradicts a Current line, edit that line and say it was corrected, with the date, then log the reversal in History. Leaving both versions present is worse than either alone, because the page stops being a statement of current belief.

TAXONOMY.md:254 - 프리뷰 staleness:
> Verify page state with absolute paths before editing. ... relative-path reads (projects/neuralarcade.md) returned a stale pre-consolidation copy while the absolute path returned the current one, causing a large duplicate section to be appended and then reverted. ... A failed exact-match edit is usually evidence that the page is ahead of your source, not behind it.

TAXONOMY.md:322 - 중복 append 가 최대 실패 모드:
> A single busy day can produce duplicate sections on five pages at once, which makes "one dreaming pass per episodic day" the real invariant. The 2026-09-08 window was promoted by more than one pass ... None of the copies conflicted - they were independently correct restatements - which is exactly why grep-before-append fails: a pass greps for its own phrasing. The durable hardening is ... grep a distinctive identifier from the evidence (axhub-prototype, 제8조, setInputFiles, NO_DEFAULT_MODEL), not a paraphrase of the claim.

TAXONOMY.md:298 - 새 날짜가 새 사실이 아니다:
> a fresh episodic date is not evidence of a fresh fact. ... when the rule is already encoded, the correct action is to write nothing rather than to add a second dated confirmation.

TAXONOMY.md:314 - (planned) 조기 승격:
> The 09-08 window recorded the sponsor outbound plan at 01:44 with "nothing sent at end of turn", and the sends completed at 01:47-01:53 in the very next episodic entries. ... read forward through the rest of the window before promoting it - (planned) is only correct if nothing later in the same window resolves it.

TAXONOMY.md:390 - 성숙한 패스의 정상 출력:
> The dominant work of a mature dreaming pass is editing existing lines, not adding new ones. ... a pass that produces many new sections against an already-promoted day is almost certainly duplicating, which remains this store's most persistent failure mode.

TAXONOMY.md:272 - 추세 주장의 만료:
> the store recorded "main has gone two full days without a user-facing release" as a live characterization ... v2.43.0 shipped nine hours later ... The underlying facts were each correct when observed - the error was compounding them into a standing condition.

이 로그는 실제 사고에서 나왔다. 09-08 하루에 dreaming 이 28번 돌았다는 실측치가
322행의 "promoted by more than one pass" 진단을 그대로 뒷받침한다.
중복 append 는 이 구조의 구조적 결함이다 - 세션마다 도는 패스에 멱등성이 없고,
동일 episodic 창(14일 고정)을 반복해서 다시 읽기 때문이다.

## 5. Codex 메모리가 가져올 것 5개

### (1) 파이프라인을 두 단계로 쪼개고, 무거운 쪽만 좋은 모델을 쓴다

지금 Codex 메모리는 rollout_summaries/ + MEMORY.md 로 사실상 단일 승격 경로다.
Aside 는 값싼 extraction(중앙 14.9초, flash 계열)과 비싼 dreaming(중앙 5.5분, opus-5)을
분리해서 5.3:1 로 돌린다. 세션 종료마다 전량 재구성하는 대신 저비용 append 를 기본으로 두고,
통합/정정은 N세션마다 몰아서 하는 구조가 비용과 품질 모두에서 낫다.

### (2) 실행 이력을 기계가 읽을 수 있게 남긴다

.history.jsonl 이 이 분석을 가능하게 한 유일한 이유다. 레코드마다
{type, trigger, status, startedAt, elapsedMs, model, usage, result.filesTouched, changes[]} 이 있고,
changes[] 는 beforeSha256/afterSha256/beforeContent/afterContent 를 통째로 담는다.
덕분에 "L1 이 커지기만 했는가", "축소가 몇 번 있었는가"를 추측 없이 셀 수 있었다.
Codex 메모리에는 이런 감사 레인이 없다. 최소한 {touched, before_hash, after_hash, bytes_delta} 는
남겨야 자기 규칙 준수를 검증할 수 있다.

### (3) claim label 을 채택하되, 적용 대상을 좁게 정의한다

다섯 라벨(verified / user-stated / inferred / planned / unknown)은 잘 설계됐고,
특히 (unknown) 을 "찾아봤지만 없었다 + 무엇을 찾았는지"로 유지하는 규칙이 좋다.
Codex 의 MEMORY_SUMMARY 도 user profile 과 learnings 를 섞어 쓰는데,
사용자 진술과 세션에서 검증한 것을 구분하는 축이 없다. 다만 3절에서 본 대로
"모든 non-trivial claim" 은 너무 넓어서 실패했다. volatile value (수치/상태/날짜)에만
강제하는 게 지켜질 수 있는 선이다.

### (4) 실패 모드 로그를 규범 문서와 분리해서 유지한다

TAXONOMY 하단의 자기 실패 기록(248/254/272/298/314/322/390행)은 이 스토어에서 가장 밀도 높은 자산이다.
"중복 append 를 막으려면 자기 표현이 아니라 증거의 고유 식별자를 grep 하라"(322행) 같은 건
한 번 겪지 않으면 못 쓰는 규칙이다. Codex 도 이런 걸 축적해야 한다.
단 분리해야 한다 - Aside 는 규범과 실패 로그를 한 파일에 넣어서 180KB, 422 청크로 부풀렸고
그게 검색 결과를 오염시킨다(2절).

### (5) 승격 라우팅을 명시적 결정 트리로 쓴다

TAXONOMY.md 159-177행의 8단계 Write Routing Decision Tree 는 "어디에 쓸 것인가"를
애매하게 두지 않는다. 특히 4번("이미 올바른 primary home 페이지가 있는가 -> 새로 만들지 말고 그걸 고쳐라")과
185행 이후의 Resolver Evolution - sites/okx.com.md 를 만들지 마라, concepts/pabcd.md 를 만들지 마라 같은
부정형 라우팅 지시가 페이지 증식을 실제로 억제한다. Codex 메모리의 워크트리별 블록은
이런 명시적 "만들지 마라" 목록이 없어서 같은 주제가 여러 경로에 흩어지기 쉽다.

## 6. Aside 방식의 한계

(a) 임계값 없는 순수 벡터 검색. cutoff 가 없어서 무관한 쿼리도 10건을 반환하고
score 0.68 을 준다(2절 (C)). 정확한 식별자 검색에 키워드 레인이 없어서
MAX_STOP_BLOCKS 검색에 그 문자열이 없는 MEMORY.md 가 0.557 로 올라온다.
하이브리드(BM25 + dense)가 없다는 게 구조적 약점이다.

(b) 규범과 실행의 괴리를 아무도 강제하지 않는다. L1 사이즈 규칙(3KB/5KB)은 3.7배/2.6배
초과 상태이고, "Read-time retrieval must not depend on this file"(TAXONOMY 11행)은
TAXONOMY 가 422 청크로 인덱싱되면서 깨졌다. 규칙을 쓰는 주체와 지키는 주체가 같은 LLM 패스라
검증 게이트가 없다. 자기가 쓴 규칙을 자기가 어기고, 그걸 감지하는 코드가 없다.

(c) 멱등성 없는 dreaming. 고정 14일 창을 세션마다 다시 읽는다. 09-08 하루 28회.
같은 사실이 여러 패스에서 독립적으로 "옳게" 재서술되고, 각 패스는 자기 표현으로만 grep 하니
중복을 못 잡는다(TAXONOMY 322행이 자백). 워터마크나 처리 완료 표시가 없다.

(d) 무한 증가. deleted 상태가 0건이고, 축소 이벤트는 전체 변경의 3.2%다.
.history.jsonl 은 432MB 로 메모리 본문(약 4MB)의 100배다. before/after 전문을 매 변경마다
담기 때문인데, 로테이션이 없다. episodic 도 하루 359KB(09-08)까지 나온다.

(e) 검색 API 가 빈약하다. -n 상한 10, 날짜/경로/디렉터리 필터 없음.
응답에 date 를 주면서 그걸로 거를 수단이 없다. 90일 아카이브 규칙을 구현할 인터페이스 자체가 없다.

(f) 스토어 규모가 아직 작다. 5,048 청크 / 91 파일 / 7.8MB 벡터는 flat scan 으로 충분한 크기다.
한 자릿수 배로만 커져도 ANN 인덱스가 필요해지는데 현재 구조에는 없다.
세대(gen-NNNNNNNNNN)마다 12MB 를 통째로 다시 쓰는 방식도 그때 문제가 된다
- gen-1380 과 gen-1381 이 각각 12MB 로 나란히 존재한다.

(g) 벤더 락인. moss-minilm 은 Aside 바이너리 안에 있고, modelArtifactVersion
bootstrap-2026-08-11 이 바뀌면 5,048개 벡터를 전부 다시 만들어야 한다.
마크다운 본문은 이식 가능하지만 인덱스는 아니다.

## 부록: 확인하지 못한 것 (unknown)

- dreaming 트리거 임계값 (sessionsSinceLastDream 이 몇에서 발동하는지) - 바이너리 내부
- 청킹 알고리즘의 정확한 규칙 (오버랩 폭, 헤딩 경계 우선순위)
- 검색 랭킹에 recency/경로 가중치가 별도로 들어가는지 - 코사인 단독인지 확인 불가
- moss-minilm 의 정확한 기반 모델 (384 dim 은 MiniLM 계열과 일치하지만 확증은 못 함)
- index.mossvec 헤더 마지막 u64 1099511627776 (=2^40) 의 의미
- 90일 episodic 아카이브 규칙의 실동작 - 최고령 episodic 이 41일이라 아직 발동한 적 없음
- .moss-cache/memory-deb87045-... (176 docs, 2026-08-24 정지) 가 왜 남아 있는지 - 구 스토어 잔존물로 보이나 확증 못 함
