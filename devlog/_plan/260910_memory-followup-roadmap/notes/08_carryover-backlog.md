# 08 — 이월 백로그 정리

날짜: 2026-09-10 (KST). HEAD: `origin/dev` `369ed0e1`. 읽기 전용.

상태 값: **이미 구현됨** / **부분** / **미착수** / **폐기**.
평가연결 열의 E1–E7은 §4 증상 번호다. 공란은 직접 연결 없음.

---

## 0. 소스와 한계

| 소스 | 위치 | 비고 |
|---|---|---|
| L0 플랜 | `devlog/_plan/260909_memory-upgrade-l0/000_plan.md` | 이 워크트리 HEAD에 존재 |
| L0 로드맵 | 같은 유닛 `020_roadmap.md` | §7 미확인 8항 |
| L0 인도 | 같은 유닛 `040_delivery.md` | 작성 시점 PR 미머지. 이후 #100·#102–#108이 `dev`에 들어감 (`git log --merges origin/dev`) |
| 설계 P0–P3 | 같은 유닛 `research/08_codexclaw-memory-design.md` | |
| 260829 개선 계획 | **이 워크트리 HEAD에는 없음** | `git cat-file -e HEAD:devlog/_plan/260829_memory-upgrade/020_improvement_plan.md` → missing. 실파일은 메인 체크아웃 `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/260829_memory-upgrade/{000_plan,010_phase1,020_improvement_plan}.md`. 스냅샷 커밋 `855291b5` / `ae03c761`에만 생성 기록이 있다 |
| 평가 산출물 | visualizations `01a08805-…/memory-search-eval/report.md` | 검색 38회 |

코드 근거는 이 워크트리 `plugins/codexclaw/**` 현재 트리. 문서 근거는 `docs-site/src/content/docs/**`.

---

## 1. research/08 P0–P3

| ID | 항목 | 상태 | 근거 | 평가연결 |
|---|---|---|---|---|
| P0-1 | `memories.dedicated_tools true` | 이미 구현됨 | #106. `managed-keys.ts:68-69` `autoEnable: true`. `activate.ts:260-264`가 `autoEnabledManagedKeys()`만 켠다. 브리프: 사용자 config에 세 키 모두 true | |
| P0-2 | `cxc config unset` / disable 원복 | 이미 구현됨 | #106. `managed-keys.ts:44,74` — `cxc disable`이 설치 이전 값으로 되돌림. `deactivate.ts:129-157`을 주석이 가리킴 | |
| P0-3 | `memory_summary.md` 포화 관측·대응 | 미착수 | 08:286은 주기적 `wc -c`만. 000_plan 범위 밖("사용자 결정"). 평가 report.md가 포화·일반화·중복을 재확인 | **E5** |
| P1-1 | `--cwd` 부스트 + `--cwd-only` 하드 필터 | 이미 구현됨 | #108. `memory-search.ts:48,301,312,478`. CLI `cli.ts:31,35,148-151`. 040 c-6 충족 | |
| P1-2 | compaction 인지 회수 캡 | 부분 | #104. 원안 PostCompact 예산 축소는 T1 때문에 폐기되고 SessionStart `source==="compact"`로 이전 (`hook.ts:501-506`, `COMPACTED_BUDGET` 164-172행, `handlePostCompact` 549-551행은 `""`). 040 c-8: 바이트 대소는 실측, compact 발화 런타임 실증 없음 | |
| P1-3 | 2티어 주입 (첫 사용자 발췌 + summary 제목) | 부분 | #104. `cwd-context.ts:72-125` 첫 user 발췌, `loadSummaryIndex` 146행+, `hook.ts:422-426` 조인. 040 c-9: 하드 예산·빈 문자열은 테스트로 닫힘. 두 티어 동시 성립은 픽스처뿐, 실측 워크트리는 summary 희소 | |
| P1-4 | 주입 "과거 스냅샷" 라벨 | 이미 구현됨 | #104. `hook.ts:287-297` `PAST SNAPSHOT as of ${latestDate}`, 델리미터 밖. 040 c-10 충족. 검색 랭킹·요약 합성에는 없음 | E4에 약함 (주입만) |
| P1-5 | `msgs_fts` 살리거나 지우기 | 이미 구현됨 | 살리는 쪽. #103이 BM25 레인으로 사용 (`index-search.ts:165-191`). `INDEX_SCHEMA_VERSION`은 `"2"` 고정 (`index-db.ts:18,34`) | |
| P2-1 | chat BM25 + trigram RRF + recency | 이미 구현됨 | #103. `index-search.ts:54,66,74-76,171`. 기본 정렬 관련도, `--recent` 시간순. 040 c-11 충족. 골든 20질의 수동 평가는 040에 없음 | E1에 약함 (키워드 쪽) |
| P2-2 | 파일/스레드당 상한 `diversifyHits` | 미착수 | 040 §7 후속. recall 소스에 `diversifyHits` 0건. 자동 주입 폴백만 스레드 dedup (`hook.ts:453-457`) | E4 약함 |
| P2-3 | hit-count 감점 (자동 주입만) | 이미 구현됨 | #107. `index-db.ts:41,142-166`, `hook.ts:191,366`. 명시 검색 경로는 테이블을 안 부름 (040 #107) | |
| P2-4 | 회수 실행 이력 로그 | 미착수 | 040 §7. 주입 카운트 테이블은 감점용이지 발동/빈결과 비율 로그가 아님 | |
| P2-5 | chat search 동의어 opt-in `--synonyms` | 미착수 | 020_roadmap.md:943-945, 040 §7. 동의어는 memory search만 (`synonyms.ts` + `memory-search.ts`). chat는 `splitQueryWords`만 | **E1** |
| P3-1 | PABCD phase 인지 회수 | 미착수 | 000_plan 범위 밖, 040 §7 | |
| P3-2 | 검색 힌트 추출 (고유 식별자) | 미착수 | 040 §7. LLM 없이 설계 미작성 | **E1** |
| P3-3 | memory search 인덱스화 | 미착수 | 착수 조건 200ms 초과. 평가 메모리 중앙값 105ms (76–146). 040: `--cwd-only` 0건 2.7초는 별개 chat 필터 경로 | |
| P3-4 | PABCD Done → ad_hoc 노트 | 미착수 | 사용자 승인 선행 (08 Q3, 040 §7). #102가 승인 경로(`allow-write` / 세션 마커)만 만들어 둠 | |

08 §5 하지 말 것:

| 항목 | 상태 | 근거 | 평가연결 |
|---|---|---|---|
| 5.1 임베딩 도입 | 폐기 | 08:344-361. Aside cutoff 없음·무관 후보 반환이 근거 | **E2** (Aside 실측이 같은 실패 모드) |
| 5.2 Aside식 dreaming | 폐기 | 08:363-377 | |
| 5.3 자동 메모리 쓰기 | 폐기 (W2가 실행 경로로 봉인) | 08:379-383, #102 | |
| 5.4 네이티브 `memories.search` 재구현 | 폐기 | 08:385-391 | |
| 5.5 cli-jaw federation | 폐기 | 08:393-399, SKILL.md 범위 절 | |
| 5.6 대량 상시 주입 | 폐기 (1,400자 캡 유지) | `hook.ts:164` `FULL_BUDGET.chars: 1400` | |

08 열린 질문:

| Q | 내용 | 상태 |
|---|---|---|
| Q1 | summary 포화 처치 | 미착수. **E5** |
| Q2 | dedicated_tools 자동 켤지 | L0가 자동 켜기로 결정 (#106). 효과 빈도 측정은 020 §7 unknown |
| Q3 | PABCD 역류 | 미착수 = P3-4 |
| Q4 | chat 기본 정렬 | L0가 관련도 기본으로 바꿈 (#103, 040 §4) |
| Q5 | msgs_fts | 살림 = P1-5/P2-1 |
| Q6 | 실행 이력 로그 | 미착수 = P2-4 |

---

## 2. 260829 개선 계획 (`020_improvement_plan.md`)

000_plan.md:335 승계표와 대조. 파일은 이 HEAD에 없고 메인 체크아웃 사본을 읽었다.

| ID | 항목 | 상태 | 근거 | 평가연결 |
|---|---|---|---|---|
| 0.1 dedicated_tools | W2와 함께 켬 | 이미 구현됨 | #102→#106 순서. 000_plan 승계표 | |
| 0.2 / 0.4 generate_memories 정책 | 사용자 결정 | 미착수 | 000_plan 범위 밖. 브리프 config는 `generate_memories=true` 유지 | **E5** (자동 축적이 포화·일반화의 공급원. 인과는 추정) |
| 0.3 summary 크기 감시 | D1 항목으로 등록만 | 미착수 | 코드에 doctor 없음 | **E5** |
| R1 토큰 경계 | wp2 | 이미 구현됨 | #105. `query-words.ts:3,16,64-79`, `memory-search.ts:462-464`. 040 c-4 충족. strict 0건이면 무경계 재시도+감점 | |
| R2 한국어 어미+동의어 | wp2 | 부분 | #105. `synonyms.ts:33-56,134,173-177` (`release/릴리즈/배포`, `memory/메모리/기억`, `koreanStem`). 040 c-5: `opencodex 릴리즈`·`결정했지` 실행, **`메모리 기억` 전후 실행 비교 기록 없음** | **E1** |
| R3 지시어 해소 | 범위 밖 | 미착수 | 000_plan 승계표. `detectRecallIntent` (`hook.ts:76-78`)는 스킬 라우팅이지 질의에서 `그때/지난번`을 빼고 cwd를 넣는 해소가 아님 | **E1** |
| R4 memory FTS sidecar | 조건 미충족 | 미착수 | 08 P3-3과 동일. 평가 메모리 p50 105ms | |
| R5 memory 0건 → chat 보완 | wp3 | 이미 구현됨 | #108. `memory-search.ts:52-56,514-553`, `--no-chat`. 평가 report: 로그인 질의에서 fallback 정상 | |
| S1 상태/지식 낡음 표기 | 범위 밖 | 미착수 | 회수 시 `stale_after`/`verify_live` 없음 | **E4** |
| S1b 인용 관행 | 관행, 코드 아님 | 미착수 (코드 관점) | 260829: "코드가 아니라 관행" | |
| S2 supersedes/tombstone | 범위 밖 | 미착수 | recall에 `superseded_by` 0건 (skill-search만 보유) | E4 약함 |
| S3 provenance 공백 / doctor 검출 | 범위 밖 | 미착수 | D1에 종속 | |
| W1 git 이력 | 이미 철회 | 폐기 | 260829 §3 W1, 000_plan 승계표 | |
| W2 승인 게이트 훅 | wp1-A | 부분 | #102. 훅 파일 `pre-tool-use-guarding-memory-write.json`, `memory-write-gate.ts:2-33,60-62,167,211-213,227-232`. 차단 자체는 동작. **읽기 `sed`도 `\\bsed\\b`에 걸리고** (211행), **명령 본문 토큰에 `memories`가 있으면 쓰기 목적지가 아니어도 차단** (158-167행). 평가 E6 + 브리프 heredoc 오탐 | **E6 E7** |
| W3 후보 제안기 | 범위 밖 | 미착수 | 000_plan 승계표 | |
| D1 `cxc memory doctor` | 범위 밖 | 미착수 | recall/ops에 doctor 서브커맨드 없음. `cxc doctor`는 컴포넌트 헬스 | **E5** |
| ChatGPT 동기화 | REJECT | 폐기 | 260829 §5–§6 | |
| OMO 이식 / reflection FSM / 임베딩 / 자동저장 무승인 / Phase2 writer 차단 | REJECT | 폐기 | 260829 §6 | |

260829 000_plan.md의 문서 사이클 성공 기준(파견 근거, 실패 케이스 실증, REJECT)은 그 유닛의 산출물(`010`/`020`)로 닫힌 문서 작업이다. 코드 이월은 위 표가 전부다.

---

## 3. L0 000_plan / 020 로드맵 / 040 부분·미확인

### 3.1 work-phase와 성공 기준

| ID | 요지 | 040 판정 (작성 시) | 현재 상태 | 근거 | 평가연결 |
|---|---|---|---|---|---|
| c-1 | wp0 로드맵 | 충족 | 이미 구현됨 | #100 | |
| c-2 | W2 양쪽 차단 + 테스트 | 충족 | 부분 | 테스트 고정은 040 충족. 런타임 오탐이 평가·브리프에서 재현 | **E6 E7** |
| c-3 | dedicated_tools enable/disable | 충족 | 이미 구현됨 | #106 | |
| c-4 | LSP substring 오매칭 제거 | 충족 | 이미 구현됨 | #105 | |
| c-5 | 한국어 활용형·동의어, 예시 3질 | 부분 | 부분 | 040: `결정했지` 0→20건, `메모리 기억`은 그룹 존재(`synonyms.ts:43`)만. 평가 자연어 3질 메모리/대화 모두 0건 | **E1** |
| c-6 | cwd 부스트/필터 | 충족 | 이미 구현됨 | #108 | |
| c-7 | chat 보완, 툴 로그 제외 | 충족 | 이미 구현됨 | #108. 평가 fallback 정상 | |
| c-8 | compact 예산 < startup, 복구 지시 | 부분 | 부분 | 040: PostCompact 0B, compact 1199B, startup 1634B (CLI 직접 호출). compact SessionStart 런타임 발화 미관찰 (040 §6, 020 §7) | |
| c-9 | 2티어 예산, 히트0 빈 문자열 | 부분 | 부분 | 040: 두 번째 티어가 실측 워크트리에서 비다 | |
| c-10 | 신선도 라벨 | 충족 | 이미 구현됨 | #104 | |
| c-11 | BM25+RRF, msgs_fts 실제 쿼리 | 충족 | 이미 구현됨 | #103 | |
| c-12 | 감점 자동 주입만 | 충족 | 이미 구현됨 | #107 | |
| c-13 | 스택 PR + 최종 head CI | 부분 (미머지, #108 wsl 진행, dependent base 불가) | 이미 구현됨 (머지) / 부분 (스택 형태) | `git log --merges`: #100 `34700a81`, #102 `645ce22e`, #106 `85987833`, #104 `05690d72`, #105 `75a568d6`, #103 `3e9e72f3`, #108 `4fc00f51`, #107 `3f9d22e5`. GitHub dependent base는 enforce-pr-target 때문에 못 씀 (040 §2.1). #108 wsl 최종 여부는 이 조사에서 Actions를 다시 안 봄 **(unknown)** | |
| c-14 | 임베딩·dreaming·네이티브 재구현 없음 | 충족 | 이미 구현됨 | L0 diff 정책. 현재 트리에도 임베딩 모듈 없음 | |

000_plan 정찰 뒤집힘:

| ID | 내용 | 상태 | 근거 |
|---|---|---|---|
| T1 PostCompact 실버그 | 고침 | 이미 구현됨 | `hook.ts:549-551` |
| T2 툴 이름 구분자 없음 | 방어형 matcher, 실측 없음 | 부분 | `memory-write-gate.ts:16,55-62`. 020 §7 첫 항. stdin 덤프 기록 없음 |
| T3 stage1에 cwd 없음 | 우회로 구현 | 이미 구현됨 | #108 thread-id 조인. 040 §4 frontmatter 선두 블록 한정 |
| T4 basename(cwd) 0건 | cwd 열거로 고침 | 부분 | `cwd-context.ts:87-92` `files.cwd` 정확 일치. 040 §6: 훅은 `--no-refresh`라 ingest 안 된 워크트리는 계속 0건 |

### 3.2 000_plan 범위 밖 (당시 선언)

| 항목 | 현재 |
|---|---|
| INDEX_SCHEMA_VERSION 상향 | 폐기(정책). `"2"` 고정, DDL은 `CREATE TABLE IF NOT EXISTS` (`index-db.ts:18,34`) |
| self-heal `healedKeys`에 table-key | 미착수 (040 §6, 020 범위 밖) |
| P3 전부 | 미착수 |
| summary 포화 대응 | 미착수 = P0-3 |
| 릴리스/npm/main | 이 사이클 밖 |

### 3.3 040 §6 미확인 — 현재

| 항목 | 상태 | 평가연결 |
|---|---|---|
| compact 후 SessionStart(`source=compact`) 런타임 실증 | 미착수 (관찰 작업) | |
| 훅 `--no-refresh` → 신규 워크트리 주입 0건 | 미착수 | |
| `--cwd-only` 0건 지연 2.7초 (chat 필터) | 미착수 | |
| chat `--cwd` 후행 슬래시 0건 | 미착수 | |
| self-heal table-key | 미착수 | |
| `memoriesadd_ad_hoc_note` stdin 실측 | 미착수 | |
| 어미 절단 정밀도 골든셋 | 미착수 | E1 약함 |
| K=500 종단 지연 (020 §7) | 부분. 040 #103은 기존과 동등(369 vs 356ms)이라고 적음. 평가 대화 p50 303ms, 최댓값 10008ms는 콜드/동시실행과 분리 안 됨 | |
| `dedicated_tools` 켠 뒤 모델이 `memories.search`를 부르는 빈도 | 미착수 **(unknown)** | |
| `msgs_fts` 바이트 크기 | 미착수 **(unknown)** | |
| `raw_memory` 본문 `cwd:` 전수 | 미착수. #108이 선두 블록만 파싱하도록 우회 | |
| chat가 동의어를 안 쓰는 이유 | 미착수 (코드 근거 없음, 020 §7) | **E1** |

---

## 4. 평가 증상 → 백로그 직접 연결

평가 원문: `memory-search-eval/report.md` (124줄). 증상 번호는 이 노트의 부여.

| # | 증상 | 직접 연결되는 미착수·부분 항목 | 비고 |
|---|---|---|---|
| E1 | 자연어 질의 0건, 키워드는 상위 3 | **R3 미착수**, **P3-2 미착수**, **P2-5 미착수**, **c-5 부분** | `지난번 로컬 소스를…확인한 방법` 메모리 0 / 대화 0. 키워드 `도그푸딩`·`BundledPluginsMarketplace`·`2.49.0 SLSA`는 메모리 히트. L0 R2는 어미·동의어이지 문장 질의 재작성이 아님 |
| E2 | Aside, 없는 문자열에도 0.64–0.68 무관 후보 | 백로그에 **구현 항목 없음**. 08 §5.1 **폐기**가 같은 실패를 이유로 임베딩을 금지 | codexclaw 코드 공백이 아니라 다른 층. 위키 `--ns aside` 문자 검색은 경로를 복구 |
| E3 | 위키 `wiki_lookup.py`가 `100.md`형 대표 문서만 | 백로그에 없음 | kim_wiki 스크립트. L0 범위 밖 |
| E4 | `2.49.0 provenance` 1위가 2.48 당시 버전 문자열 | **S1 미착수**. P1-4는 주입 라벨이라 검색 랭킹을 안 고침. P2-2는 약함 | 평가: 버전 문자열 일치 ≠ 완료 증거 |
| E5 | summary 2,500토큰 94% 포화, 과거 지시 상시 선호 일반화, 중복 | **P0-3 / Q1 / 0.3 / D1 미착수**. 0.2/0.4 정책 미결이 공급 쪽 | L0가 명시적으로 안 함 |
| E6 | 읽기 전용 `sed`가 MEMORY-WRITE-GATE에 차단 | **W2 / c-2 부분** | report.md 마지막에서 1회 재현. 게이트 `\\bsed\\b` (memory-write-gate.ts:211) |
| E7 | 브리프: devlog heredoc 본문의 메모리 경로 문자열로 오탐 | **W2 부분** (#102 회귀) | `shellPathTokens`가 `memories` 부분문자열 토큰을 전부 수집 (158-167행). 실제 쓰기 대상이 devlog여도 본문 경로가 루트 아래면 차단 |

L0가 **만든** 회귀로 이 조사가 코드와 맞춘 것은 E6·E7뿐이다. E1은 260829 000_plan Objective가 이미 "한국어 활용형·지시어·이유 질의 0건"을 적었다. E2·E3는 Aside/위키. E5는 네이티브 요약.

---

## 5. docs-site ↔ L0 플래그·훅 이름

대조 대상: `docs-site/src/content/docs/**`. 스킬 `plugins/codexclaw/skills/recall/SKILL.md`는 사이트가 아니지만 L0 반영의 참조면이다. 현재 `plugin.json` 훅 배열은 **25파일** (L0 24 + 이후 #116 `session-start-announcing-subagent-fallback.json`).

### 5.1 반영된 것

| 표면 | L0 내용 | 위치 |
|---|---|---|
| 훅 테이블에 memory-write | 파일명 `pre-tool-use-guarding-memory-write.json`, matcher `^(memories[._]?add_ad_hoc_note\\|apply_patch\\|Write\\|Edit\\|Bash)$`, 커맨드 `hook pre-tool-use-memory-write` | `reference/hooks.md:47` |
| SessionStart compact 캡 + 복구 지시가 PostCompact가 아님 | `source` compact일 때 세션 수 축소, PostCompact는 이벤트-specific 봉투 불가 | `hooks.md:62-64, 105-109` |
| memory 플래그 `--cwd` / `--cwd-only` / `--no-chat` / `--no-synonyms` | recall sub-grammar | `reference/commands.md:168-169` |
| chat 관련도 기본 + `--recent` | BM25+trigram RRF | `commands.md:166, 174-176` |
| 훅 개수 PreToolUse x7 | memory-write 포함 | `index.mdx:151` |
| 스킬 본문 | 심볼 경계, 어미, cwd, chat fallback, 주입 회전 | `skills/recall/SKILL.md:31-34, 48, 84-106, 자동 주입 절` |

### 5.2 어긋나거나 빠진 것

| 표면 | 현재 문서 | 코드 | L0 관련 |
|---|---|---|---|
| `concepts/how-it-works.md:45` | `PreToolUse (x6)`, memory-write 목록 없음 | `plugin.json` 25번째가 memory-write, index.mdx는 x7 | **미반영** |
| `how-it-works.md:48` | PostCompact recall-context를 "invoke recall recovery" | `hook.ts:549-551` 고의 silent `""` | **L0 T1 수정과 모순**. `hooks.md:105-109`는 맞음 |
| `reference/plugin-manifest.md` hooks JSON (등록 목록) | memory-write 파일 없음. 23개 나열 | `plugin.json:47`에 있음 | **미반영** |
| `plugin-manifest.md:19`, `hooks.md:3,6`, `installation.md:101`, `how-it-works.md:36`, `index.mdx:151` | "24 files / 25 handlers" | 현재 25 files (+#116 fallback) | L0 직후 24/25는 맞았고, 이후 PR이 한 장 더함 |
| `hooks.md:40` statusMessage | `(codexclaw) Recovering recall context after compaction` | 출력 0바이트 | 이름만 구식 |
| `commands.md` live 표 | `cxc memory search`만 | `bin/cxc.mjs:164-165` `memory allow-write` → pabcd-state | **#102 CLI 미기재** |
| `commands.md` recall grammar | `--rank` 없음 | `cli.ts:44, 옵션 rank` | #103 플래그 누락 |
| docs-site 전역 | `dedicated_tools` 0건, `allow-write` 0건 | `managed-keys.ts:68-69`, `memory-cli.ts` | **#106·#102 설정/승인 플래그 미기재** |
| `guides/native-tools.md:93` | `memories` remain flag-gated | 설치가 dedicated_tools를 켬 | 구식 서술 |
| `guides/skills.md:74,108` | recall을 "읽기 전용 검색"으로만 | 검색 플래그 상세 없음 | 사이트 가이드는 L0 CLI를 commands에만 둠 |

결론: **검색 CLI 플래그(`--cwd`/`--cwd-only`/`--no-chat`/`--recent`)와 memory-write 훅 파일명은 hooks.md·commands.md·SKILL.md에 들어가 있다.** 빠진 것은 (1) `how-it-works.md` / `plugin-manifest.md` 훅 목록, (2) `dedicated_tools` 자동 활성, (3) `cxc memory allow-write`, (4) `--rank`, (5) PostCompact "recovery" 문구 잔존이다.

---

## 로드맵 입력

### (a) 회귀 여부

#102 게이트는 L0가 만든 회귀다. 읽기 `sed`와, 실제 쓰기 대상이 메모리 밖인데 명령 본문에 메모리 경로 문자열이 있는 경우(브리프 heredoc)를 쓰기로 분류한다. 근거: `memory-write-gate.ts:167,211` + 평가 report 말미 + 브리프 재현.

자연어 0건(E1)은 L0 회귀가 아니다. 260829가 같은 실패를 적었고, L0 R2는 어미·동의어만 넣었다. Aside 무관 후보(E2)와 위키 대표 문서(E3)는 다른 층. summary 포화(E5)는 000_plan이 범위 밖으로 남긴 네이티브 요약이다. compact 캡(c-8)은 도달 경로를 옮긴 수정이고, 런타임 발화 미관찰은 회귀가 아니라 미증기다.

### (b) 수정 후보

P0

1. W2 오탐: 읽기 `sed` 제외, 셸 쓰기 목적지와 본문 언급 분리. 대상 E6·E7.
2. docs-site L0 잔여: `how-it-works.md` PreToolUse x7 + memory-write, PostCompact silent, `plugin-manifest.md` 훅 배열, `commands.md`에 `allow-write`·`--rank`·`dedicated_tools`.

P1

3. R3 + P3-2 방향의 질의 재작성: 지시어 제거, 고유명사·짧은 한/영 키워드로 분해 후 재검색. 대상 E1. 평가 우선순위 1과 같음.
4. c-8 런타임 실증: 실제 compaction 세션에서 SessionStart `source=compact` 발화·바이트를 관측. 안 뜨면 복구 지시가 모델에 안 간다.
5. T2 stdin 실측: 훅이 보는 메모리 툴 이름 확정.
6. P0-3/Q1: summary 포화 처치 결정 (방치 / phase2 압축 지시 / 별도 주입). E5. 사용자 결정이 선행.

P2

7. P2-5 chat `--synonyms` (기본 off). E1 대화층.
8. S1 검색 결과 낡음 표기. E4.
9. T4 잔여: 훅 `--no-refresh`와 ingest 신선도.
10. P2-2 다양화, P2-4 로그, D1 doctor — 040 §7 착수 조건 유지.
11. P3-4 역류는 승인 없이 착수하지 않음.

폐기 유지: 임베딩(E2가 재확인), dreaming, 네이티브 search 재구현, federation, W1 git 이력.

### (c) 대상 파일과 검증

| 후보 | 대상 파일 | 검증 |
|---|---|---|
| W2 오탐 | `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts`, `test/memory-write-gate.test.ts` | 픽스처: (1) 읽기 전용 sed로 메모리 파일을 여는 명령 허용 (2) 본문에 메모리 경로 문자열이 있는 heredoc이 메모리 밖 파일을 쓸 때 허용 (3) 메모리 경로를 목적지로 하는 sed -i / 리다이렉트는 계속 거부. 기존 c-2 쓰기 차단 테스트 유지 |
| docs | `docs-site/src/content/docs/concepts/how-it-works.md`, `reference/plugin-manifest.md`, `reference/commands.md`, `reference/hooks.md:40`, `guides/native-tools.md:93` | 사이트에서 PreToolUse x7, memory-write 훅 파일, allow-write, dedicated_tools, --rank가 보이는지. 훅 JSON 배열이 plugin.json과 같은 파일 집합인지 |
| 질의 재작성 | `components/recall/src/memory-search.ts`, `chat-search.ts`, `synonyms.ts`, 신규 모듈, `skills/recall/SKILL.md` | 평가 cases.json의 memory_D3 / chat_D3 / memory_P2 / memory_R2를 재실행해 0건이 키워드 경로로 회복되는지. --no-synonyms 회귀. LSP c-4 유지 |
| compact 실증 | 관측만. 코드 변경 없음 | 실제 compact 후 훅 stdin의 source 필드 덤프. handleSessionStart 분기가 compact일 때만 축소 예산을 타는지 |
| T2 덤프 | 관측. 필요 시 `memory-write-gate.ts` 주석 | PreToolUse stdin tool_name이 memoriesadd_ad_hoc_note인지 |
| summary 포화 | 네이티브 파일은 코드로 못 줄임. 후보: ad_hoc 지시 또는 문서화 | memory_summary.md 바이트가 10,000B에 가까운지 (물결표 경로) |
| chat 동의어 | `chat-search.ts`, `cli.ts`, SKILL.md, commands.md | --synonyms 기본 off. 골든 질의 정밀도 전후 |
| S1 낡음 | `memory-search.ts` format, 또는 결과 경고 | 2.49.0 provenance류에서 완료 세션이 버전 문자열 스침보다 위인지 — 평가는 검색 품질이지 산술 테스트가 아님 |
