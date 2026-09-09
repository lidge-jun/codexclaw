---
created: 2026-09-09
source_corpus: /Users/jun/Developer/codex/010_memory-pipeline/ (18 files, 10,150 lines)
tags: [memory-pipeline, harness-comparison, codex, corpus-synthesis]
---

# 하네스 18종 메모리 파이프라인 종합

코퍼스 `/Users/jun/Developer/codex/010_memory-pipeline/` 전체(00_memory.md 1,056줄 + 하네스별 17종, 합 10,150줄)를 읽고 정리했다. 코퍼스 문서의 주장은 그 문서가 인용한 소스 경로/라인을 그대로 옮겼고, Codex(`co`)에 한해서는 실제 체크아웃 `/Users/jun/Developer/codex/121_openai-codex/codex-rs`(HEAD `d2d5b7024`, 2026-09-04)에서 직접 재검증했다. 재검증하지 않은 항목은 "코퍼스 주장"으로 명시하고, 확인 불가한 것은 (unknown)으로 남긴다.

---

## 0. 읽은 범위와 검증 상태

| 파일 | 줄수 | 대상 | 코퍼스 소스 근거 | 본 문서에서 재검증? |
| --- | --- | --- | --- | --- |
| `00_memory.md` | 1056 | 전체 비교 | 하위 문서 종합 | 부분(co 축만) |
| `10_co_memory.md` | 1065 | Codex | `121_openai-codex/codex-rs` @ `2e8c3756f` | **예 — HEAD `d2d5b7024`에서 상수·경로 확인** |
| `10_cc_memory.md` | 399 | Claude Code | `150_claude_code/src/` deobfuscated TS (v1.0.x, ≈2026-03-31) | 아니오(체크아웃 미확인) |
| `10_ge_memory.md` | 708 | Gemini CLI | `130_gemini-cli/` | 아니오 |
| `10_gr_memory.md` | 645 | Grok Build | OSS `180_grok-build` @ `b189869` + 설치본 0.2.99 | 아니오 |
| `10_hermes_memory.md` | 466 | Hermes Agent | `160_hermes-agent/` v0.15.1 | 아니오 |
| `10_oc_memory.md` | 632 | OpenCode | `141_opencode-current/` | 아니오 |
| `10_ai_memory.md` | 724 | Aider | `110_aider/` | 아니오 |
| `10_cp_memory.md` | 763 | Copilot CLI | `151_copilot_cli/` 디컴파일 번들 | 아니오 |
| `10_ag_memory.md` | 566 | Antigravity(IDE) | `152_antigravity/` Go 심볼 + protobuf 역공학 | 아니오 |
| `10_omx_memory.md` | 422 | oh-my-codex | `171_oh-my-codex/` v0.18.6 | 아니오 |
| `10_omc_memory.md` | 369 | oh-my-claudecode | `170_oh-my-claudecode/` | 아니오 |
| `10_omo_memory.md` | 431 | oh-my-openagent | `172_oh-my-openagent/` | 아니오 |
| `10_ay_memory.md` | 402 | Antigravity CLI(agy) | `~/.local/bin/agy` v1.0.12 문자열 | 아니오 |
| `10_cr_memory.md` | 368 | Cursor Agent | 번들 `2026.06.26-7079533` | 아니오 |
| `10_ki_memory.md` | 452 | Kiro CLI | 바이너리 문자열 2.5.0 | 아니오 |
| `10_lc_memory.md` | 354 | LazyCodex | `161_lazycodex/` | 아니오 |
| `10_sp_memory.md` | 328 | Superpowers | `162_superpowers/` | 아니오 |

접두어 해설: `cp`는 **GitHub Copilot CLI**(질문의 "cp=?"에 대한 답). `oc`=OpenCode, `omo`=oh-my-openagent(구 oh-my-opencode), `omc`=oh-my-claudecode, `omx`=oh-my-codex, `ay`=Antigravity CLI(`agy` 바이너리), `ag`=Antigravity IDE/확장, `cr`=Cursor Agent, `lc`=LazyCodex, `sp`=Superpowers.

증거 등급이 하네스마다 크게 다르다. `co`/`ge`/`oc`/`ai`/`hermes`/`omx`/`omc`/`omo`/`gr`은 실제 소스 기반이고, `cc`는 deobfuscated 소스, `cp`/`ag`는 디컴파일·역공학, `ay`/`ki`/`cr`은 바이너리 문자열과 `--help`뿐이다. 마지막 그룹의 "없음" 판정은 **공개 표면에 없음**이지 구현이 없다는 증명이 아니다.

---

## 1. 하네스별 메모리 설계 한 장 표

| 하네스 | 저장 | 쓰기 트리거 | 읽기 경로 | 검색 | 망각/정리 |
| --- | --- | --- | --- | --- | --- |
| **co** Codex | SQLite state DB(`stage1_outputs`/`jobs`/`threads`) + `~/.codex/memories/` 마크다운 + `memories/.git` baseline | 세션 시작 시 백그라운드 2-phase(추출→통합). rollout이 10일 이내·6시간 idle·미처리일 때만. 시작당 2건 | `memory_summary.md`를 developer instructions에 2,500토큰 주입 → `MEMORY.md` → `rollout_summaries/` → `skills/` 점진 공개 | **인덱스 없음**. `memories/search` 도구는 substring 매칭(옵션 도구, 기본 off) + shell grep | `max_unused_days` 30일 초과 stage-1 prune(배치 200), `rollout_summaries` 유지분 외 삭제, extension resources 7일 |
| **cc** Claude Code | `CLAUDE.md` 4계층 + `{base}/projects/{git-root}/memory/`(MEMORY.md+토픽) + `agent-memory/` 3스코프 + JSONL transcript | 메인 에이전트 직접 쓰기(항상 지시) 또는 extract 모드 백그라운드 추출. autoDream 24h/5세션 | `MEMORY.md` 인덱스 200줄/25KB 로드 → 토픽 파일 | (unknown — 인덱스 링크 순회 + 파일 읽기. 전용 검색엔진 언급 없음) | autoDream Phase 4 Prune이 인덱스 정리, staleness 경고(>1일), 팀 sync는 삭제 미전파 |
| **ge** Gemini CLI | `GEMINI.md` 3-tier + JIT 서브디렉토리 + 세션 JSON. (2026-05 이후) `memoryService.ts` + `.inbox/{private,global}/*.patch` | `/memory add`. 최신판은 백그라운드 `memoryService`가 3시간+ idle·10+ user 메시지 세션을 스캔해 패치 후보 생성 | 계층 병합 후 `<global_context>`/`<extension_context>`/`<project_context>` XML로 시스템 프롬프트 주입 | (없음 — 계층 파일 전량 로드 방식) | 압축 시 도구출력 50K 예산 초과분 파일 백업 후 절삭, GC/Distillation 트리거 |
| **gr** Grok Build | `~/.grok/memory/` 마크다운(global+workspace)이 canonical + `index.sqlite`(재생성 가능 캐시) | 4경로: 세션종료 메타데이터(LLM 없음), `/flush`(LLM 요약), `/remember`, `/dream` 통합 | first-turn 주입 + post-compaction recovery + `memory_search`/`memory_get` 도구 — 셋이 동일 `MemoryBackendParams` 공유 | **FTS5 BM25 + 선택적 sqlite-vec 벡터 하이브리드**(0.7/0.3), min_score 0.35, MMR 옵션 | 세션 소스만 시간 감쇠(반감기 7일), workspace/global은 감쇠 없음. watcher가 삭제 파일 stale chunk 제거 |
| **hermes** Hermes | **SQLite `state.db`** schema v14, WAL(+NFS 폴백) + frozen-snapshot `MEMORY.md`/`USER.md` | `memory` 도구(add/replace/remove) 즉시 디스크. 압축 임계 초과 시 세션 회전 | 시스템 프롬프트에 **동결 스냅샷** 주입(prefix 캐시 보존). 도구 응답은 라이브 상태 | **FTS5 unicode61 + trigram 이중 테이블 + 3-way 라우팅**(CJK 대응). `content||tool_name||tool_calls` 인덱싱 | 문자 단위 한도(memory 2200/user 1375) 초과 시 쓰기 거부. Curator가 스킬 통합/아카이브 |
| **oc** OpenCode | SQLite(Drizzle, WAL) `session`/`message`/`part`/`todo` + 별도 Git 스냅샷 repo + 레거시 JSON | 모든 상태 변경이 SyncEvent → DB 프로젝션. 파일변경은 `Snapshot.track/patch` | `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md` 상향 탐색 + 도구 실행 중 해당 디렉토리 동적 주입 | (없음 — 학습 메모리 자체가 없음) | prune: 최근 2턴·40K 토큰 도구출력 보호, 20K 이상 줄일 때만 실행. `git gc --prune=7.days` |
| **ai** Aider | 프로세스 메모리 이중 버퍼 + append-only 플랫 파일 3종(input/chat/llm) | 턴 종료 시 `move_back_cur_messages` → `too_big()`이면 백그라운드 요약 | `--restore-chat-history` 플래그로 마크다운 재파싱(기본 비활성) | (없음) | head만 요약하고 tail 원본 보존. 재귀 깊이 3 |
| **cp** Copilot CLI | 워크스페이스 영속(`mc_session_id` 등) + 원격 MC 서버 동기화 | 80% 백그라운드 압축 / 95% 동기 대기. 메모리 저장은 권한 승인 대상(subject/fact/category/citations) | 압축 시 plan/todo/skills/reasoning을 XML 슬롯으로 보존 재주입 | (unknown) | 사용자 원본 메시지 30K자·20개·80/20 분할 |
| **ag** Antigravity IDE | protobuf `CortexMemory` 4-scope(Global/All/Project/Local) + Knowledge Items + Implicit Trajectory | Implicit Trajectory가 파일열기/편집/터미널/클립보드 자동 수집. Knowledge Generation Sub-agent가 대화에서 자동 정제. BrainUpdate 전략(forced/dynamic) | `PersistentContextSection`/`KnowledgeDiscoverySection` 프롬프트 mixin | `KnowledgeBaseSearch`, `QueryKnowledge` RPC명 확인 — 내부 구현 (unknown) | `Pruning KI` 로그 문자열 존재, 정책 (unknown) |
| **omx** oh-my-codex | **append-only `events.json` 이벤트 소싱**(진실원천) + `snapshot.json`/뷰 파생, fs2 배타 락 | 11종 명령이 11종 이벤트 생성. 모든 상태 전이가 로그에 append | `RuntimeEngine::load`가 events 재생해 상태 재구성 | (없음 — 구조화 상태 조회) | `compact()`는 **무손실** — Delivered/Failed 종결 디스패치 이벤트만 가지치기 |
| **omc** oh-my-claudecode | `.omc/state/*.json` 모드별·세션 격리 + notepad.md + project-memory.json + wiki | `state_write` 원자적 쓰기(temp→fsync→rename) + 파일락(stale 30s) | SessionStart 복원(6000자 예산), PreCompact 체크포인트+재주입 | wiki는 **키워드 검색, 임베딩 없음**(문서 명시) | stale 2시간 임계, tombstone, iteration 카운터 상한 |
| **omo** oh-my-openagent | `.omo/boulder.json` **순수 JSON**(SQLite 아님) + `.omo/tasks/` 원자적 JSON | `/start-work`가 boulder 생성. session-idle마다 진척 검사 | `readBoulderState` + mirror 투영. 미완이면 continuation prompt 재주입 | (없음) | boulder 본체는 atomic/lock 없음(문서-구현 불일치를 코퍼스가 명시) |
| **ay** Antigravity CLI | trajectory proto+SQLite, `conversations/*.pb` (미해독) | (unknown) | `--continue`/`--conversation` | `GetUserMemories`/`KnowledgeBaseSearch` RPC명만 확인 | `Trajectory has exceeded max length, clearing %d steps` 문자열 |
| **cr** Cursor Agent | `~/.cursor/chats/` + ACP SQLite `acp-sessions/store.db` + 클라우드 transcript | `onSummarize` 아카이브 | `--resume`/`--continue`/`ls` | (없음 — 학습 메모리 **미확인**) | (unknown) |
| **ki** Kiro CLI | `~/.kiro/sessions/cli/` json+jsonl+history+lock | 세션 진행 중 append | `--resume`/`--resume-id`/`--resume-picker` | `KnowledgeBase` 심볼 존재하나 레이아웃 (unknown). 학습 메모리 **미확인** | `CompactStrategy`(제외 메시지쌍/컨텍스트 %/대형 메시지 절삭) |
| **lc** LazyCodex | `~/.codex/codex-rules/sessions/*.json`(중복주입 방지 캐시) + `.omo/ultragoal/` 원장 | 룰 주입 키 기록, ultragoal 원장 append | 훅이 `additional_context`로 주입 | **부재**(코퍼스가 명시적으로 Absent 판정) | PostCompact가 캐시 리셋 후 재주입 대기 표시 |
| **sp** Superpowers | `skills/*/SKILL.md` git 버전관리 + 호스트 transcript | 스킬 작성이 곧 쓰기. 호스트 `save_memory`/`store_memory`에 위임 | SessionStart가 `using-superpowers` 전문 주입, compact 후 재부트스트랩 | (없음 — 호스트 스킬 로더) | git 이력이 곧 버전 관리 |

---

## 2. 설계 축(axis) 추출

코퍼스를 관통하는 축은 여섯 개다. 축마다 값의 범위가 다르므로 순서 척도로 정의한다.

**축 1 — 자동성(누가 언제 쓰는가)**
수동 명령(`/memory add`) → 세션 내 자동 요약 → 백그라운드 추출 파이프라인 → 에이전트 직접 파일 쓰기 → 사용자 행동 암묵 수집. 오른쪽으로 갈수록 사용자 개입이 줄지만 governance 부담이 커진다.

**축 2 — 계층(스코프 분리)**
단일 파일 → 2계층(global/project) → 3~4계층 + 조건부 로딩. `cc` 4계층(Managed/User/Project/Local), `ge` 4-tier(Global/Extension/Project/JIT), `ag` 4-scope(Global/All/Project/Local), `gr` 2계층(global/workspace), `co`는 **파일 계층이 아니라 요약 깊이 계층**(summary→MEMORY→rollout_summaries→skills)이라 성격이 다르다.

**축 3 — 검색 방식**
없음 → 전량 로드 → substring/grep → BM25 FTS → FTS+벡터 하이브리드. 이 축이 하네스 간 격차가 가장 크고, Codex가 가장 뒤처지는 축이다(§4).

**축 4 — 스코프 격리(무엇이 어디에 갇히는가)**
세션 격리 → 프로젝트/워크스페이스 격리 → 전역 → 팀 공유. `gr`은 git origin `org/repo` identity로 clone/worktree가 기억을 공유하고, `omc`/`omx`는 세션 ID로 상태를 격리하며, `cc`만 서버 팀 동기화(checksum delta)를 갖는다.

**축 5 — 신뢰 라벨(출처·검증·프라이버시 표시)**
없음 → 출처 경로 기록 → 인용 추적 → 사용량 피드백 → 자기 검증. `co`의 citation→`usage_count` 루프와 `ge`의 Probe 2차 검증이 양 끝의 서로 다른 접근이다.

**축 6 — 압축(무엇을 버리는가)**
무손실 가지치기 → 구조화 슬롯 요약 → 자유서술 요약 → 단순 절삭. `omx`의 종결 이벤트만 제거하는 무손실 compact와 `ge`의 `<state_snapshot>` 슬롯 요약이 상위, `ai`의 평문 요약과 `ki`의 절삭이 하위다.

### 축별 배치표

| 하네스 | 자동성 | 계층 | 검색 | 스코프 | 신뢰라벨 | 압축 |
| --- | --- | --- | --- | --- | --- | --- |
| co | 백그라운드 파이프라인(기본 off) | 요약 깊이 4단 | **substring only** | 전역 단일 root | **citation→usage 루프** | 자유서술 + 사용자메시지 20K 보존 |
| cc | 에이전트 직접 쓰기 + Dream | 파일 4계층 | 인덱스 순회 | user/project/local/team | type 4종 + scope 가이드 + staleness | auto/partial/SM-first |
| ge | 반자동(inbox 승인) | 4-tier + JIT | 전량 로드 | global/project/subdir | **Probe 자기검증** + 패치 승인 | `<state_snapshot>` 슬롯 |
| gr | 4경로(자동+수동) | global/workspace | **FTS5+vec 하이브리드** | git origin 공유 | score + source path/line | pre-compaction flush |
| hermes | 도구 + Curator | MEMORY/USER 2종 | **FTS5+trigram(CJK)** | 세션 lineage | frozen snapshot 불변식 | 세션 회전(무손실 lineage) |
| oc | 자동 상태 기록 | instruction 다중 호환 | 없음 | 세션/프로젝트 | — | prune→요약 2단 |
| ai | 세션 내 요약만 | 없음 | 없음 | 세션 | — | head 요약/tail 원본 |
| cp | 80/95% 자동 | — | (unknown) | 워크스페이스+원격 | 권한 승인 + citations | 구조화 슬롯 보존 |
| ag | **암묵 행동 수집** | 4-scope | RPC(unknown) | global/all/project/local | — | 절삭 |
| omx | 이벤트 자동 append | — | 없음 | 세션/팀 | **멱등 event id** | **무손실 가지치기** |
| omc | 훅 자동 | 모드/세션별 | 키워드(임베딩 없음) | 세션 격리 | tombstone/stale | 체크포인트 재주입 |
| omo | 훅 자동 | work별 | 없음 | worktree | — | 압축후 복구 훅 |
| ay/cr/ki | 세션 기록 | — | 없음/미확인 | 세션 | — | 절삭/요약 |
| lc/sp | 주입 캐시/스킬 | — | 없음 | 세션/repo | 품질 게이트(lc) | 캐시 리셋 |

---

## 3. 축별 최선단 구현

**자동성 — Claude Code(`cc`), 다만 방향이 다른 Codex와 병렬 1위.**
`cc`는 메인 에이전트가 프롬프트 지시로 항상 메모리 파일을 직접 쓰고(`memdir/paths.ts:60`), extract 모드가 켜지면 백그라운드 fork가 대신 추출하며(`extractMemories.ts:345`), autoDream이 24시간/5세션 게이트로 4-phase 통합을 돈다(`autoDream.ts:64`). 쓰기 주체가 셋(메인/추출기/Dream)이고 팀 sync까지 있어 가장 agentic하다. `co`는 자동성 수준은 높지만 **에이전트가 아니라 파이프라인이 쓴다**는 점에서 종류가 다르고, 결정적으로 기본값이 꺼져 있다.

행동 수집의 자동성만 떼어 보면 `ag`가 더 앞선다. 파일 열기·편집(200자 절삭)·터미널·클립보드·린트에러·커서위치를 사용자 지시 없이 trajectory step으로 적재한다. 다만 IDE 환경 전제라 CLI 하네스와 직접 비교는 어렵다.

**계층 — Gemini CLI(`ge`).**
Global(`~/.gemini/GEMINI.md`) → Extension → Project(상향+BFS 하향) → JIT 서브디렉토리의 4단이 선명하고, `@path` import가 깊이 5·순환방지·경로검증(`validateImportPath`)까지 갖췄으며, inode(`dev:ino`) 기반 중복 제거로 macOS 대소문자 무관 파일시스템의 중복 로드를 막는다. 우선순위 규칙(`Sub-directories > Workspace Root > Extensions > Global`)이 시스템 프롬프트에 명시된다. `cc`가 계층 수는 더 많지만(Managed 포함 4계층 + `.claude/rules/*.md` glob 스코프) 예측 가능성은 `ge`가 높다.

**검색 — Grok Build(`gr`)와 Hermes가 서로 다른 이유로 공동 1위.**
`gr`은 FTS5 BM25와 sqlite-vec 벡터를 0.3/0.7로 병합하고, 시간 감쇠(반감기 7일)·소스 가중치·접근 부스트를 적용한 뒤 선택적 MMR 재랭킹까지 한다(`search.rs:180-389`). 결정적으로 **model tool / first-turn injection / post-compaction recovery 세 소비자가 동일한 `MemoryBackendParams` 팩토리를 공유**해(`backend.rs:21-56`) "주입만 FTS-only가 되는" 설정 drift를 구조적으로 막는다. sqlite-vec이 없으면 FTS-only로 degrade하는 것이 실패가 아니라 지원 경로다.

Hermes는 **CJK 대응**에서 앞선다. 기본 unicode61 토크나이저가 `"大别山项目"`을 개별 문자로 쪼개는 문제를 trigram 테이블 병설로 풀고, 3-way 라우팅(CJK 없음→FTS / CJK 3자↑이고 모든 토큰 3자↑→trigram / 그 외→LIKE)에 **토큰별 CJK 길이 검사**까지 넣었다. `"广西 OR 桂林 OR 漓江"`이 총 6자지만 토큰마다 2자라 trigram이 0건을 내는 함정(이슈 #20494)을 실제로 수정한 흔적이다. 한국어로 일하는 환경이라면 이쪽이 직접 이식 대상이다.

**스코프 — Grok(식별자 설계)과 Claude Code(공유 범위).**
`gr`은 워크스페이스 identity를 경로가 아니라 git origin `org/repo`로 잡아 clone·worktree가 기억을 공유하고, temp cwd는 ephemeral로 분류해 write를 건너뛴다(`storage.rs:581-647`). 여러 worktree를 쓰는 작업 방식에서 실질적 차이를 만드는 설계다. 팀 단위 공유는 `cc`만 실제로 갖췄다(checksum delta push, 서버 키별 덮어쓰기 pull, 삭제 미전파).

**신뢰 라벨 — Codex(`co`)가 유일하게 사용 피드백 루프를 갖췄고, Gemini는 생성 검증에서 앞선다.**
`co`는 에이전트가 `<oai-mem-citation>` 블록으로 인용한 thread_id를 파싱해 `record_stage1_output_usage()`로 `usage_count`/`last_usage`를 갱신하고, 이 값이 다시 Phase 2 입력 선별 우선순위에 반영된다. **"실제로 쓰인 기억이 살아남는" 폐루프는 18종 중 Codex에만 있다.** 여기에 secret redaction(`[REDACTED_SECRET]`)까지 있다.

`ge`는 반대편이다. 요약 생성 직후 동일 모델로 2차 호출해 "빠뜨린 파일 경로·도구 결과·사용자 제약이 있는지 비판적으로 평가하고 개선본을 내라"고 시키는 Probe 검증이 있고, 실패 이력이 있으면 LLM을 건너뛰고 절삭만 하는 circuit breaker도 있다. 생성 시점 품질 보증은 `ge`, 사후 가치 측정은 `co`다.

**압축 — oh-my-codex(`omx`)가 개념적으로 가장 앞서고, 실무 완성도는 Claude Code.**
`omx`의 `compact()`는 LLM 요약이 아니라 **종결된(Delivered/Failed) 디스패치 이벤트만 제거하는 무손실 가지치기**다. 대화가 압축돼도 워크플로우 사실은 이벤트 로그에 남고, 재생 시 `seen_event_ids` HashSet이 중복 부수효과를 차단하며, `replay pending>0`이면 readiness가 blocked라 복원 전 새 작업이 시작되지 못한다. "요약을 잘하기"가 아니라 "상태를 컨텍스트 밖으로 외부화하기"로 문제를 재정의한 것이 핵심이다.

실무 기능 폭은 `cc`가 넓다. auto-compact(13K 마진)·partial compact(from/up_to 방향 지정)·session-memory 우선 압축(LLM 호출 없이 요약 주입)·Pre/PostCompact 훅을 갖췄다. 요약 스키마 품질만 보면 `ge`의 `<state_snapshot>` 7슬롯이 가장 선명하다.

---

## 4. Codex가 뒤처진 지점 (HEAD `d2d5b7024`에서 재검증)

아래는 코퍼스 주장을 그대로 옮긴 것이 아니라, 실제 체크아웃에서 확인한 결과다.

### 4.1 검색이 substring 매칭뿐이다 — 가장 큰 격차

`ext/memories/src/tools/search.rs`의 도구 설명이 그대로 말한다:

> "Search Codex memory files for **substring matches**, optionally normalizing separators or requiring all query substrings on the same line or within a line window."

인자는 `queries`/`match_mode`/`path`/`context_lines`/`case_sensitive`/`normalized`/`max_results`뿐이고 랭킹 개념이 없다. `ext/memories/src/`와 `memories/` 전체에 fts·sqlite·embed·vector·bm25 관련 구현이 없다(state DB용 `Feature::Sqlite` 참조만 잡힘). 반면 `gr`은 BM25+벡터 하이브리드에 시간감쇠·MMR을, hermes는 FTS5+trigram 이중 인덱스를 갖췄다.

실무적으로 이건 **한국어에서 특히 불리하다**. Codex는 인덱스가 없으니 CJK 토크나이징 문제 자체를 겪지 않지만, 대신 grep 수준 정확도에 머문다. 기억이 쌓일수록 "관련은 있지만 표현이 다른" 항목을 못 찾는다.

더 큰 문제는 이 도구가 **기본적으로 꺼져 있다**는 점이다. `config/src/types.rs:346`에서 `dedicated_tools: false`가 기본값이고, `ext/memories/src/extension.rs:115`가 `if !config.enabled || !config.dedicated_tools { return Vec::new() }`로 도구 등록을 건너뛴다. 즉 표준 경로에서 메모리 읽기는 프롬프트 안내 + shell grep이다.

### 4.2 기능 자체가 기본 비활성

`features/src/lib.rs:1094`:

```rust
FeatureSpec {
    id: Feature::MemoryTool,
    key: "memories",
    stage: Stage::Stable,
    default_enabled: false,
},
```

`Stage::Stable`인데 `default_enabled: false`다. `memories/write/src/start.rs:34`가 `!config.features.enabled(Feature::MemoryTool)`이면 파이프라인 전체를 건너뛴다. `cc`의 auto-memory나 `ge`의 계층 로딩이 기본 동작인 것과 대조된다. 가장 정교한 학습 파이프라인을 만들어 놓고 기본값으로는 아무도 쓰지 않는 상태다.

### 4.3 쓰기 지연이 최소 6시간 — 세션 내 기억이 불가능

`config/src/types.rs:48-51`에서 확인한 값:

```rust
pub const DEFAULT_MEMORIES_MAX_ROLLOUTS_PER_STARTUP: usize = 2;
pub const DEFAULT_MEMORIES_MAX_ROLLOUT_AGE_DAYS: i64 = 10;
pub const DEFAULT_MEMORIES_MIN_ROLLOUT_IDLE_HOURS: i64 = 6;
pub const DEFAULT_MEMORIES_MIN_RATE_LIMIT_REMAINING_PERCENT: i64 = 25;
```

rollout이 **6시간 idle이어야** 추출 후보가 되고, 시작당 **2건**만 claim하며, rate limit 잔량이 25% 미만이면 아예 돌지 않는다. 결과적으로 "방금 사용자가 교정해준 사실"이 이번 세션은 물론 다음 세션에도 반영되지 않을 수 있다.

비교하면 `cc`는 사용자가 "remember this"라고 하면 메인 에이전트가 그 자리에서 파일을 쓴다. `gr`의 `/remember`도 즉시다. `hermes`의 `memory` 도구는 디스크에 즉시 쓰되 시스템 프롬프트 스냅샷만 동결해 prefix 캐시를 지킨다 — **즉시성과 캐시 안정성을 동시에 얻는 설계**이고, Codex에는 이에 해당하는 경로가 없다. Codex의 유일한 즉시 쓰기 표면은 `memories/add_ad_hoc_note`인데 이것도 `dedicated_tools`가 켜져야 하고, 반영은 다음 Phase 2를 기다려야 한다.

### 4.4 스코프가 전역 단일 root — 프로젝트 격리가 없다

메모리 root는 `~/.codex/memories/` 하나다(`memories/write/src/control.rs`가 `memories`/`memories_extensions` 두 경로만 다룸). stage-1 출력에 `cwd`/`git_branch` 필드가 있지만(`state/src/model/memories.rs`의 `Stage1Output`), 이는 메타데이터일 뿐 읽기 시 프로젝트별 분기가 아니다. `memory_summary.md` 하나가 모든 프로젝트에 동일하게 주입된다.

`gr`은 워크스페이스별 디렉토리를 git origin 기준으로 나누고, `cc`는 `projects/{git-root}/memory/`로 나누며, `ge`는 project `GEMINI.md`가 별도 계층이다. 여러 프로젝트를 오가는 작업에서 Codex는 무관한 기억을 계속 읽게 된다.

### 4.5 주입 예산 2,500토큰 고정, 검색 기반 선택 주입이 없다

`ext/memories/src/lib.rs:16`:

```rust
pub(crate) const MEMORY_TOOL_DEVELOPER_INSTRUCTIONS_SUMMARY_TOKEN_LIMIT: usize = 2_500;
```

`memory_summary.md`를 앞에서부터 2,500토큰으로 자를 뿐, 현재 질의와의 관련도로 고르지 않는다. `gr`은 first-turn에 **질의 관련 청크를 검색해서** 주입하고(`[memory.initial_injection]`의 min_score 적용), 압축 후에는 별도 recovery 검색으로 사라진 맥락을 되살린다. Codex는 압축 후 메모리 재주입 경로가 없다 — compaction(`core/src/compact.rs`, `COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000` 확인)과 메모리 파이프라인이 서로 모른다.

### 4.6 팀 공유 표면이 없다

`cc`는 `TeamMemoryDataSchema`(organizationId/repo/version/checksum)로 서버 양방향 sync를 하고 2초 debounce watcher를 돌린다. Codex의 통합 구조는 중앙집중적이라 팀 환경에 어울리지만, 실제 공유 표면은 (없음). 사용자 간 기억 공유는 파일 수동 복사뿐이다.

### 4.7 망각 정책이 시간 기준 단일 축

`DEFAULT_MEMORIES_MAX_UNUSED_DAYS = 30`으로 미사용 stage-1 출력을 prune하고 `usage_count`로 선별 우선순위를 매기는 것까지는 좋은데, `gr`처럼 **소스별 차등 감쇠**(세션 로그는 반감기 7일, 큐레이트된 workspace/global은 감쇠 없음)가 없다. Codex는 모든 raw memory를 같은 시간 축으로 다룬다.

### 4.8 Codex가 오히려 앞선 지점(균형)

공정하게, Codex만 가진 것도 있다.

- **citation → usage → 재선별 폐루프**: 18종 중 유일. 어떤 기억이 실제로 쓰였는지 측정해 다음 통합 입력에 반영한다.
- **분산 조율**: state DB lease + ownership token + 90초 heartbeat + 전역 Phase 2 락. 여러 Codex 세션이 동시에 떠도 중복 추출이 없다. `cc`의 PID 락 파일보다 견고하다.
- **통합 에이전트 샌드박싱**: `phase2.rs`가 `ephemeral=true`, 재귀 메모리 생성 차단, `SpawnCsv`/`Collab`/`MemoryTool`/`Apps`/`Plugins` 비활성, MCP 서버 빈 맵, `network_access: false`, codex_home만 쓰기 가능으로 잠근다.
- **git baseline diff로 dirty 판정**: watermark 비교가 아니라 `memories/.git` 대비 실제 workspace diff가 비어 있으면 에이전트를 아예 띄우지 않는다. 무의미한 LLM 호출을 구조적으로 없앤다.
- **secret redaction**: 추출 결과에서 토큰/키를 `[REDACTED_SECRET]`으로 치환. `gr`의 `/flush`가 대화를 그대로 모델에 넘기는 것과 대비된다.

정리하면 Codex는 **쓰기 품질과 조율 안정성은 최상위, 읽기(검색·주입·스코프)와 즉시성은 하위권**이다. 격차는 파이프라인 설계가 아니라 retrieval 계층에 몰려 있다.

---

## 5. 코퍼스 문서의 신선도 경고

### 5.1 확인된 stale — Codex 문서의 스냅샷 핀이 5개월 뒤처졌다

`10_co_memory.md`는 `updated: 2026-07-10`이고 변경 기록에 "HEAD `2e8c3756f` 기준"이라 적혀 있다. `00_corpus_harmonization_status.md`도 `co`의 source-of-record를 `2e8c3756f`로 못박는다. 그런데 실제 체크아웃 `/Users/jun/Developer/codex/121_openai-codex`의 HEAD는 **`d2d5b7024`(2026-09-04)**다. 약 2개월 차이이고, 코퍼스 자체의 마지막 커밋은 `c323ad826c`(2026-07-16)로 오늘 기준 **약 2개월 전**이다.

다만 이번에 재검증한 범위에서는 co 문서의 핵심 주장이 **여전히 유효했다**. 확인한 항목:

| 문서 주장 | HEAD 확인 결과 |
| --- | --- |
| crate 분리 `memories/write`, `memories/read`, `ext/memories` | 유효(3개 디렉토리 존재) |
| `MemoryTool` Stable이나 기본 off | 유효(`features/src/lib.rs:1094`) |
| 시작당 2건 / 10일 / 6시간 / 25% | 유효(`config/src/types.rs:48-51`) |
| 동시성 8, 컨텍스트 70%, scan 5000, lease 3600, heartbeat 90 | 유효(`memories/write/src/lib.rs:81-107`) |
| 주입 한도 2,500토큰 | 유효(`ext/memories/src/lib.rs:16`) |
| compaction 사용자 메시지 20,000토큰 | 유효(`core/src/compact.rs:63`) |
| provider preferred-model API | 유효(`model-provider/src/provider.rs:167,174`) |
| 전용 도구 4종 + `dedicated_tools` 기본 false | 유효(`ext/memories/src/tools/` 4파일, `types.rs:346`) |

문서에 없던 것도 하나 발견했다: `Feature::ExternalAgentMemoryImport`(`UnderDevelopment`, 기본 off)와 `app-server/src/external_agent_migration/session_importer.rs`의 memory_mode 처리. **다른 하네스의 메모리를 가져오는 경로가 개발 중**이라는 뜻인데 코퍼스에는 반영돼 있지 않다.

### 5.2 문서가 스스로 표시한 신선도 리스크

- `10_cc_memory.md`: 스냅샷이 v1.0.x(≈2026-03-31)인데 현재는 v2.1.193으로 추정한다고 §8에 명시. **서버사이드 compaction(`compact-2026-01-12`/`compaction_delta`)은 src/에 없고 v2.1.83 번들에만 존재** — 바이너리 전용 기능이라 소스 기반 비교에서 누락된다.
- `10_ge_memory.md`: 본문(2025-07-15 작성)과 "최신 갱신(2026-05-30)" 절이 **서로 모순된다**. 본문은 `memory-manager-agent.ts`를 상세 설명하는데 갱신 절은 그 파일이 **삭제됐다**고 적는다(`6edfba4`, `7504259`). `memoryTool.ts`도 441줄 삭제 후 99줄 경로 유틸만 남았다. 본문의 Memory Manager Agent 서술은 현재 구현이 아니다.
- `10_gr_memory.md`: 하나의 파일에 **OSS 기반 최신 본문 + pre-OSS 바이너리 문자열 시대 부록**(0.2.67)이 함께 들어 있다. 부록의 `grok memory edit`/`stats` 문서-바이너리 불일치 지적은 0.2.67 기준이고 현재 0.2.99에서는 (unknown).
- `10_omo_memory.md`: boulder를 SQLite로 오해하는 통념을 정정하며 **문서-구현 불일치**를 명시한다 — `src/features/boulder-state/AGENTS.md`는 "temp→rename 원자적 쓰기 + 파일 락"을 문서화하지만 실제 `packages/boulder-state` 구현은 단순 `writeFileSync`다.
- `10_oc_memory.md`: source-of-record가 local `141_opencode-current@8cf8592b3`인데 harmonization 문서가 **upstream 대비 ahead 7 / behind 1274**라고 기록한다. 1,274 커밋 뒤처진 스냅샷이므로 OpenCode 서술은 상당히 오래됐을 수 있다.
- `00_memory.md`: 본문 대부분이 **5-에이전트 비교**(co/ai/ge/oc/cc)로 쓰였고 나머지 13종은 뒤에 addendum으로 덧붙었다. "누가 1위" 류의 종합 판단은 5종만 놓고 내린 것이라 18종 전체에 그대로 적용하면 안 된다. 예를 들어 "장기 학습 1위 Codex"는 `gr`/`hermes`를 빼고 매긴 순위다.

### 5.3 증거 등급이 낮아 결론을 신뢰하기 어려운 하네스

`ay`(confidence 0.80, 바이너리 문자열), `cr`, `ki`는 공개 CLI 표면과 심볼명만 근거다. 세 문서 모두 "학습 메모리 미확인"으로 분류하는데, 코퍼스 자신이 이를 **negative evidence**(공개 표면에 없음)로 정직하게 표기하고 있다. `cr` 문서는 "서버사이드 메모리는 그럴듯하나 로컬에서 검사 불가"라고 적는다. 이 셋에 대한 "메모리 없음" 판정은 확정으로 읽으면 안 된다.

`ag`(Antigravity IDE)는 protobuf 메시지 번호(msg 282/290/271/292/77)까지 특정한 역공학인데, 스키마 **필드 내용은 대부분 비어 있다**(`CortexMemoryMetadata { // 생성 시간, 수정 시간, 출처 정보 }` 식의 주석만). 4-scope 존재는 신뢰할 만하지만 동작 상세는 (unknown)이다.

---

## 6. 확인하지 못한 것

- `cc`/`ge`/`gr`/`hermes`/`oc`/`ai`/`cp`/`ag`/`omx`/`omc`/`omo`/`lc`/`sp`의 소스 체크아웃 현재 상태 — 이 문서는 `co`만 재검증했다. 나머지는 코퍼스가 인용한 경로/라인을 그대로 옮겼고 독립 확인은 하지 않았다.
- `cc` v2.1.193 실제 동작 — 코퍼스 스냅샷이 v1.0.x다.
- `ge` 현재 `memoryService.ts` 상세 — 갱신 절에 1,487줄 신규 파일이라고만 적혀 있고 본문 수준의 코드 인용이 없다.
- `cp`/`ag`/`ay`/`cr`/`ki`의 저장 포맷 실체 — 모두 디컴파일·문자열 근거이고 코퍼스가 프라이빗 데이터 열람을 금지하고 있다.
- Codex `Feature::ExternalAgentMemoryImport`의 동작 — 심볼 존재만 확인했고 구현은 읽지 않았다.
- 각 하네스 메모리 품질의 실측 비교 — 코퍼스에도, 본 문서에도 벤치마크는 없다. 모든 "앞선다" 판단은 **설계·기능 근거**이지 성능 측정이 아니다.

---

## 7. 인용한 코퍼스 위치

| 주장 | 위치 |
| --- | --- |
| cc 상수(200줄/25KB, 13K, 24h/5세션) | `10_cc_memory.md:110,199,248` |
| cc 메모리 타입 4종 + 팀 스키마 | `10_cc_memory.md:123,179` |
| ge 압축 상수·Probe 검증 | `10_ge_memory.md:149,156,311,336` |
| ge state_snapshot 7슬롯 | `10_ge_memory.md:384-392` |
| ge Memory Manager Agent 삭제 | `10_ge_memory.md` "최신 갱신(2026-05-30)" §1 |
| gr 하이브리드 검색·감쇠 | `10_gr_memory.md:48,387,392` |
| gr 3소비자 공유 팩토리 | `10_gr_memory.md:95` |
| hermes trigram 이중 테이블·CJK 라우팅 | `10_hermes_memory.md:156,161` |
| hermes schema v14·쓰기 재시도 | `10_hermes_memory.md:73,102` |
| oc prune 상수·Git 스냅샷 | `10_oc_memory.md:14,167,244` |
| ai 요약 알고리즘 | `10_ai_memory.md:155,165,215` |
| omx 무손실 compact·멱등 재생 | `10_omx_memory.md:144,155,165,175` |
| omc 원자적 쓰기·Stop 훅 | `10_omc_memory.md:79,328` |
| omo boulder JSON 정정 | `10_omo_memory.md:14` |
| ag 4-scope·implicit trajectory | `10_ag_memory.md:15,17,40` |
| cr/ki/lc 부재 판정 | `10_cr_memory.md:49,89`, `10_ki_memory.md:237-238`, `10_lc_memory.md:230-233` |

Codex 재검증 근거는 모두 `/Users/jun/Developer/codex/121_openai-codex/codex-rs` HEAD `d2d5b7024` 기준이며 본문 §4에 파일·라인을 명시했다.
