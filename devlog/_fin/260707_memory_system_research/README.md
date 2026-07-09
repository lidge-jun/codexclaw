---
created: 2026-07-07
status: research-done, phase1-shipped
tags: [codexclaw, memory, codex-rs, cli-jaw, jawcode, recall, architecture]
aliases: [memory system research, codex memory integration analysis]
---

# Codex Memory System Research: Integration Analysis for Codexclaw

> 목표: Codex의 네이티브 메모리 파이프라인, cli-jaw/jawcode의 자체 메모리 시스템,
> 그리고 codexclaw의 현재 recall 시스템을 소스 레벨로 분석하여,
> codexclaw이 메모리를 어떻게 다룰지 전략적 방향을 결정한다.

---

## 1. Codex-RS 네이티브 메모리 파이프라인

### 1.1 아키텍처 개요

Codex의 메모리 시스템은 **비동기 2-phase 파이프라인**이다. 세션 시작 시 백그라운드로 실행되며,
과거 롤아웃에서 구조화된 기억을 추출하고 전역으로 통합한다.

```
Session Start
  -> start_memories_startup_task()
    -> Phase 1: per-rollout extraction (parallel, cap=8)
    -> Phase 2: global consolidation (singleton lock)
      -> consolidation agent edits memory workspace
    -> memory_summary.md injected into future prompts
```

소스 위치: `~/Developer/codex/121_openai-codex/codex-rs/memories/`

### 1.2 Phase 1: 롤아웃 추출

- **모델**: `gpt-5.4-mini`, low reasoning (configurable via `config.memories.extract_model`)
- **동시성**: `buffer_unordered(8)` -- 최대 8개 롤아웃 병렬 처리
- **입력 필터링**: developer 메시지, AGENTS.md 지시, `<skill>` 블록 제거
- **출력**: strict JSON -- `raw_memory`, `rollout_summary`, `rollout_slug`
- **보안**: 입력/출력 모두 `codex_secrets::redact_secrets` 적용 (defense in depth)
- **Job 조율**: SQLite state DB의 `BEGIN IMMEDIATE` + ownership token + lease/retry/backoff

핵심 파일:
- `memories/write/src/phase1.rs` -- `StageOneOutput`, `run()`, `serialize_filtered_rollout_response_items()`
- `memories/write/templates/memories/stage_one_system.md` -- 추출 프롬프트
- `state/src/runtime/memories.rs` -- `claim_stage1_jobs_for_startup()`, `try_claim_stage1_job()`

### 1.3 Phase 2: 전역 통합

- **모델**: `gpt-5.4`, medium reasoning (configurable via `config.memories.consolidation_model`)
- **방식**: git-baselined workspace에 Stage 1 결과를 동기화 -> workspace diff 생성 -> 내부 consolidation agent 스폰
- **Agent 제한**: ephemeral, no network, no MCP, no apps/plugins, no spawn/collab, 메모리 루트만 write 가능
- **입력**: `raw_memories.md` + `rollout_summaries/*.md` + `phase2_workspace_diff.md` (4MB cap)
- **출력**: `memory_summary.md`, `MEMORY.md`, `skills/`, `rollout_summaries/`
- **Lock**: DB global job lease + 90s heartbeat + ownership 확인 후 baseline reset

핵심 파일:
- `memories/write/src/phase2.rs` -- `Claim`, `run()`, `sync_phase2_workspace_inputs()`
- `memories/write/src/workspace.rs` -- git diff 계산/reset
- `memories/write/templates/memories/consolidation.md` -- 통합 프롬프트

### 1.4 Read Path

- `memory_summary.md`는 항상 system prompt에 주입 (5,000 token cap)
- `MEMORY.md`는 on-demand search
- `rollout_summaries/`와 `skills/`는 progressive disclosure
- Citation tracking: `<citation_entries>` + `<rollout_ids>` 파싱 -> usage count 기록

핵심 파일:
- `memories/read/src/citations.rs` -- `parse_memory_citation()`
- `memories/read/src/usage.rs` -- `MemoriesUsageKind`, telemetry classification

### 1.5 Compaction

- **Inline**: active turn model로 오래된 history를 요약, 최근 user messages 20,000 토큰 보존
- **Remote**: provider capability `supports_remote_compaction()` 시 서버 측 compaction
- pre/post compact hooks 실행, trace checkpoint 기록

핵심 파일:
- `core/src/compact.rs` -- inline compaction
- `core/src/compact_remote.rs` -- remote compaction

### 1.6 설정 표면

```toml
[features]
memories = true

[memories]
generate_memories = true
use_memories = true
extract_model = "gpt-5.4-mini"
consolidation_model = "gpt-5.4"
max_raw_memories_for_consolidation = 256
max_rollout_age_days = 30
min_rollout_idle_hours = 6
max_rollouts_per_startup = 16
summary_injection_token_limit = 5000
```

### 1.7 아티팩트 구조

```
~/.codex/memories/
|-- .git/                    # git-baselined workspace
|-- memory_summary.md        # prompt에 항상 주입되는 라우팅 요약
|-- MEMORY.md                # grep-friendly 핸드북
|-- raw_memories.md          # Phase 1 raw 입력 병합
|-- rollout_summaries/       # per-thread 요약 파일
|-- skills/                  # 재사용 가능 절차
|   +-- <name>/
|       |-- SKILL.md
|       |-- scripts/
|       +-- templates/
+-- extensions/              # 확장 리소스
```

---

## 2. cli-jaw 자체 메모리 시스템

### 2.1 아키텍처 개요

cli-jaw의 메모리는 **markdown-canonical, SQLite-index-derived, role-injected** 구조이다.
자체 에이전트 런타임 안에서 메모리를 생성, 저장, 검색, 주입까지 완전 자급자족한다.

```
Session Start
  -> ensureIntegratedMemoryReady()
    -> bootstrap / legacy import
    -> buildTaskSnapshot() -> prompt injection
  -> Agent lifecycle
    -> memory flush (every N turns) -> episodes/live/<date>.md
    -> maybeAutoReflect() (24h) -> profile/shared 승격
  -> L2 Dashboard
    -> federation search across instances
    -> optional embedding (sqlite-vec)
```

소스 위치: `~/Developer/new/700_projects/cli-jaw/src/memory/`

### 2.2 저장 모델

| Store | 경로 | 역할 |
|---|---|---|
| Profile | `memory/structured/profile.md` | 사용자/프로젝트 프로필 |
| Shared | `memory/structured/shared/*.md` | preferences, decisions, projects, soul |
| Episodes | `memory/structured/episodes/**` | live/daily/imported 에피소드 로그 |
| Semantic | `memory/structured/semantic/**` | concept memory, KV imports |
| Procedures | `memory/structured/procedures/**` | runbooks, procedural memory |
| Index | `memory/structured/index.sqlite` | derived FTS/trigram index |
| Embeddings | `vec_memory.sqlite` | L2 dashboard vector index (optional) |

### 2.3 검색/랭킹

- **FTS5 unicode61** + **FTS5 trigram** 이중 인덱스
- CJK: 3+ chars -> trigram, shorter -> LIKE fallback
- BM25 + synonym expansion + reciprocal rank fusion
- Kind priority boost: profile(-4.0) > shared(-3.0) > procedure(-2.5) > semantic(-2.0) > episodes(0)
- Recency half-life: episodes 7d, semantic 30d, shared 90d, profile/procedures infinite

### 2.4 주입 정책

| Role | Profile | Soul | Task Snapshot |
|---|:---:|:---:|:---:|
| boss | O | O | O |
| employee | O | X | X |
| subagent | O | X | X |
| flush | X | X | X |

`buildTaskSnapshot()`이 recall-to-prompt 브릿지: FTS 검색 -> kind/path 다양화 -> 4 블록, 700자 캡

### 2.5 Reflection Pipeline

- 비-LLM 휴리스틱 추출 (regex/line classification)
- episodes -> profile/shared/procedure 승격
- Identity ledger (`shared/soul.md`): high-confidence만 자동 적용, medium은 `soul-candidates.log`에 기록
- `maybeAutoReflect()`: flush 후 24시간 단위로 실행

### 2.6 L2 Federation

- `searchFederated()`: 다중 인스턴스 read-only 검색
- `rerankAcrossInstances()`: RRF로 cross-instance 결과 병합
- Chat federation: `jaw.db` messages LIKE 검색
- Embedding: dashboard-owned `sqlite-vec`, hybrid merge 지원

### 2.7 핵심 파일

| 파일 | 역할 |
|---|---|
| `runtime.ts` | public facade, snapshot building, search |
| `injection.ts` | role-based injection policy |
| `indexing.ts` | FTS/trigram index, BM25 ranking |
| `reflect.ts` | episode -> stable memory 승격 |
| `identity.ts` | soul ledger management |
| `bootstrap.ts` | legacy import, structured layout 생성 |
| `memory-flush-controller.ts` | periodic episode flush |

---

## 3. Jawcode (gajae-code) 메모리 시스템

### 3.1 아키텍처 개요

Jawcode의 local memory는 **Codex-RS와 거의 동일한 2-phase 파이프라인**을 TypeScript로 구현한 것이다.
Codex의 오픈소스 메모리 아키텍처를 가장 직접적으로 채택한 사례다.

### 3.2 Phase 1/Phase 2

- `runPhase1`: 완료된 롤아웃 스캔 -> job claim -> model 호출 -> `stage_one_*` 프롬프트
- `runPhase2`: per-cwd global consolidation job -> artifacts 동기화 -> consolidation model 호출
- 생성 아티팩트: `raw_memories.md`, `rollout_summaries/*.md`, `MEMORY.md`, `memory_summary.md`, `skills/*`
- Phase 2 scope: `global:${cwd}` key로 프로젝트별 격리

### 3.3 저장/검색

- SQLite tables: `threads`, `stage1_outputs`, `jobs` (memory_stage1, memory_consolidate_global)
- **FTS/search 없음** -- retrieval은 `memory_summary.md` prompt injection만
- Hindsight: 별도 외부 API 기반 recall/retain/reflect (`HindsightSessionState`)

> **[정정 2026-07-07]** 위의 "FTS/search 없음" 판단은 `buildMemoryToolDeveloperInstructions`
> (summary 주입 경로)에만 참이고, jawcode 전체에는 틀렸다. 읽기 전용 explorer 재검증 결과,
> jawcode의 local backend per-turn 경로는 실제로 검색+랭킹을 수행한다:
> `beforeAgentStartPrompt` -> `buildLocalTaskSnapshot` -> `searchLocalMemories`
> (`packages/coding-agent/src/memory-backend/local-backend.ts:26`,
> `src/memories/local-query.ts:47,:49,:167-170,:186-242,:261-351`).
> 랭킹은 lower-is-better에 `KIND_WEIGHT = { profile: -4, shared: -3, episode: 0 }`,
> `SYNONYM_GROUPS = [["pabcd","plan","audit","build","check","done"]]`, FTS-or-LIKE,
> 선형 recency `-max(0, 2 - daysAgo / 7)`; 기본 검색 모드는 hybrid
> (`src/memories/memory-config.ts:25,:65`). 아래 6장 매트릭스의 jawcode "검색" 행도
> 이 정정을 따른다.

### 3.4 통합 포인트

- `resolveMemoryBackend(settings).buildDeveloperInstructions()` -> system prompt
- `resolveMemoryBackend(settings).start()` -> session startup
- `/memory view|clear|enqueue|rebuild` slash command
- Legacy `memory://` protocol handler (non-public, compatibility only)

### 3.5 핵심 파일

| 파일 | 역할 |
|---|---|
| `memories/index.ts` | pipeline orchestration, Phase 1/2 |
| `memories/storage.ts` | SQLite job queue, thread registry |
| `prompts/memories/*.md` | stage_one_system, stage_one_input, consolidation, read_path |
| `memory-backend/local-backend.ts` | local backend wrapper |
| `hindsight/state.ts` | external recall/retain/reflect API |

---

## 4. Codexclaw Recall 시스템 (현재)

### 4.1 아키텍처 개요

Codexclaw recall은 **Codex 네이티브 persistence에 대한 read-only 검색 레이어**이다.
메모리를 생성하지 않으며, `~/.codex/`의 세션/메모리 아티팩트를 검색만 한다.

```
~/.codex/ (source of truth, read-only)
  |-- sessions/**/rollout-*.jsonl
  |-- archived_sessions/*.jsonl
  |-- memories/**/*.md
  +-- memories_<N>.sqlite
         | ingest (incremental)
~/.codexclaw/recall/index.sqlite (derived cache, rebuildable)
  |-- msgs (content table)
  |-- msgs_fts (unicode61 FTS5)
  +-- msgs_tri (trigram FTS5, CJK)
```

소스 위치: `plugins/codexclaw/components/recall/`

### 4.2 검색 기능

- **Chat search**: sidecar FTS index, 8 words max, AND/OR, role/source/cwd/days 필터
- **Memory search**: markdown paragraph scan + `stage1_outputs` SQL scan (FTS 미적용)
- **CJK**: `msgs_tri` trigram (3+ codepoints), `LIKE` fallback (shorter)
- Tool output cap: 8192 chars in index

### 4.3 Hook 통합

- `handleSessionStart`: recall 가용성 안내
- `handleUserPromptSubmit`: 과거 작업 참조 언어 감지 시 nudge
- `handlePostCompact`: compaction 후 recall 재안내

### 4.4 CLI 표면

```bash
cxc chat search "<query>" [--days N] [--cwd PATH] [--role r] [--source main|subagent|all]
cxc chat index [--rebuild] [--status]
cxc memory search "<query>" [--days N] [--limit N]
```

### 4.5 핵심 파일 (48 tests, all passing)

| 파일 | 역할 |
|---|---|
| `index-db.ts` | sidecar SQLite schema, open/status |
| `ingest.ts` | incremental rollout -> index |
| `chat-search.ts` | chat search orchestration |
| `memory-search.ts` | memory artifact search |
| `index-search.ts` | FTS/trigram query compilation |
| `hook.ts` | Codex hook integration |

---

## 5. 통합 분석: 세 가지 선택지

### 5.1 선택지 비교

| | Option A: Codex 네이티브 통합 | Option B: 자체 메모리 (cli-jaw식) | Option C: 얇은 하이브리드 |
|---|---|---|---|
| **핵심** | Codex가 생성한 `~/.codex/memories/`를 그대로 소비 | 자체 extraction/consolidation 파이프라인 구축 | 저장은 Codex에 맡기고, codexclaw은 검색/주입/증거 연결만 강화 |
| **장점** | 유지보수 비용 0, Codex 업데이트 자동 반영, 이미 recall이 이 구조 위에 작동 | 완전한 통제, Codex 변경에 독립, CJK/reflection/injection 커스터마이징 자유 | 중복 저장소 없이 실사용 품질 개선, plugin 경계와 잘 맞음 |
| **단점** | Codex 구현 변경에 종속, write API 없음, 커스터마이징 한계 | 대규모 개발 비용, Codex 메모리와 중복, model API 비용 | Codex native memory의 write 타이밍/선별은 직접 통제 불가 |
| **Model 비용** | 0 (Codex가 지불) | Phase 1/2 model 호출 비용 발생 | 0에 가깝게 유지 가능 |
| **적합 시나리오** | plugin으로 남을 때, 검색 강화가 주 목표 | 독립 제품화, multi-harness 지원 | 현재 codexclaw의 포지션 |

### 5.2 현재 상태 분석

Codexclaw은 이미 **Option C (얇은 하이브리드)의 핵심 절반**을 구현하고 있다:

1. **Read 측**: recall 컴포넌트가 Codex 네이티브 세션/메모리를 read-only로 검색
2. **Write 측**: 없음 -- 이건 결함이라기보다 plugin 경계상 자연스러운 상태
3. **Injection**: 약함 -- 현재는 hook nudge 중심이고, 검색 결과를 자동 주입하지는 않음

Codex 네이티브 메모리는 이미 잘 작동한다:
- `memory_summary.md`가 모든 세션에 주입됨
- `MEMORY.md`가 on-demand search로 사용됨
- citation tracking으로 메모리 가치를 정량화함

### 5.3 2026-07-07 수정 결론: 별도 일반 메모리 저장소는 만들지 않는다

사용자 피드백으로 결론을 좁혔다. `~/.codexclaw/memory/` 같은 **일반 메모리 저장소**를 만드는 것은
당장 필요하지 않다. Codex가 이미 native memory를 생성/통합/주입하고 있고, codexclaw이 같은 목적의
메모리 저장소를 하나 더 만들면 중복과 혼선이 생긴다.

정확한 판단은 다음과 같다.

| 질문 | 답 |
|---|---|
| Codex 메모리를 저장할 수 있는가? | **있다.** Codex 자체가 `~/.codex/memories/`와 state DB에 저장한다. |
| codexclaw이 Codex native memory에 저장 요청을 보낼 수 있는가? | **안정적인 public write API는 없다고 보는 게 맞다.** |
| 설정으로 저장을 통제할 수 있는가? | **부분적으로만 가능하다.** 생성/사용 enable, 모델, idle/age/batch/rate-limit 같은 파이프라인 knob은 있다. |
| 파일을 직접 수정할 수 있는가? | 파일시스템상 가능하지만 **권장하지 않는다.** Codex Phase 2가 다시 정리하거나 덮어쓸 수 있고, 내부 기대값을 깨뜨릴 수 있다. |
| codexclaw 자체 메모리 저장소가 필요한가? | 일반 memory 목적이면 **불필요**. 필요한 것은 검색 품질과 workflow evidence다. |

따라서 `~/.codexclaw/memory/`는 당장 만들지 않는다. 특히 다음을 하지 않는다:

- Codex native memory와 같은 성격의 `MEMORY.md`, `profile.md`, `episodes/`, `semantic/` 복제
- 자체 Phase 1/Phase 2 extraction/consolidation 파이프라인
- Codex의 `~/.codex/memories/`에 직접 쓰는 writer
- "나중에 유용할 수도 있는" 일반 facts 저장소

codexclaw이 맡을 일은 더 좁다:

1. **Codex memory를 잘 찾는다.**
   - `~/.codex/sessions/**/rollout-*.jsonl`
   - `~/.codex/memories/**/*.md`
   - `~/.codex/memories_<N>.sqlite` / `stage1_outputs`

2. **찾은 내용을 현재 워크플로우에 맞게 연결한다.**
   - PABCD phase 시작 시 과거 유사 작업을 recall
   - compaction 후 "잃어버린 맥락"을 찾도록 hook nudge
   - goalplan/ledger의 evidence와 past session evidence를 연결

3. **필요하면 메모리가 아니라 evidence log로 남긴다.**
   - `goalplan.json` / `ledger.jsonl`
   - divergence archive
   - metric ledger
   - phase attestation
   - 즉, "장기 기억"이 아니라 "워크플로우 증거"로 남긴다.

이 구분이 중요하다. **메모리 저장은 Codex의 일이고, codexclaw의 일은 검색/연결/검증이다.**

### 5.4 Codex native memory 통제 가능 범위

Codex memory는 완전히 블랙박스가 아니다. 하지만 "원하는 항목을 지금 저장"하는 API가 있는 것도 아니다.

통제 가능한 것:

- `memories.generate_memories`: 새 thread를 memory input으로 삼을지
- `memories.use_memories`: 기존 memory를 prompt에 주입할지
- `memories.extract_model`: Phase 1 extraction model override
- `memories.consolidation_model`: Phase 2 consolidation model override
- `max_rollout_age_days`, `min_rollout_idle_hours`, `max_rollouts_per_startup`
- `min_rate_limit_remaining_percent`
- `disable_on_external_context`

통제하기 어려운 것:

- 특정 fact를 즉시 저장하라고 명령하기
- 특정 rollout을 반드시 memory로 승격하기
- consolidation agent가 `MEMORY.md`/`memory_summary.md`에 어떤 문장으로 남길지 보장하기
- codexclaw plugin에서 native memory DB mutation을 안정적으로 수행하기

파일 직접 수정에 대한 판단:

- `~/.codex/memories/MEMORY.md`나 `memory_summary.md`를 사람이 수정하는 것은 가능하다.
- 그러나 plugin writer가 자동으로 수정하는 것은 위험하다.
- Phase 2의 git-baselined workspace/diff/reset 흐름과 충돌할 수 있다.
- Codex의 내부 모델/스키마/프롬프트가 바뀌면 codexclaw writer가 stale해진다.
- 그래서 codexclaw은 native memory에 **write하지 않는 read-only 원칙**을 유지한다.

### 5.5 구현 로드맵 (수정)

**Phase 0 (현재)**: recall read-only search over `~/.codex/`

**Phase 1**: recall 검색 품질 강화
- `memory-search`에 FTS5 인덱스 적용
- cli-jaw식 kind priority + recency half-life 랭킹 도입
- synonym expansion table (CJK 특화)

**Phase 2**: evidence 연결 강화
- goalplan `ledger.jsonl`에서 past-session lookup anchor 생성
- phase attestation에 관련 rollout/memory hit 링크 기록
- 별도 일반 memory 저장소 없이, 이미 존재하는 workflow evidence에 recall 결과를 연결

**Phase 3**: prompt injection bridge
- recall 검색 결과를 hook을 통해 developer instructions에 컨텍스트로 주입
- Codex `memory_summary.md` 주입과 보완적 관계 (충돌하지 않음)
- PABCD phase 시작 시 관련 과거 워크플로우 자동 recall

**Phase 4** (Optional, 보류): codexclaw-specific retention
- 일반 memory가 아니라 "workflow failure shield"처럼 좁은 목적일 때만 검토
- 저장 위치도 `~/.codexclaw/memory/`가 아니라 해당 기능의 evidence store가 우선
- LLM-based consolidation은 기본값이 아니며, 충분한 실패 사례가 쌓일 때만 다시 검토

---

## 6. 시스템별 비교 매트릭스

| 축 | Codex Native | cli-jaw | Jawcode | Codexclaw (현재) |
|---|---|---|---|---|
| 메모리 생성 | LLM 2-phase pipeline | LLM flush + heuristic reflect | LLM 2-phase pipeline | 없음 |
| 저장소 | `~/.codex/memories/` + state DB | `JAW_HOME/memory/structured/` | agent DB + filesystem | `~/.codexclaw/recall/index.sqlite` (캐시) + goalplan/ledger evidence |
| 검색 | `cat`/`grep` on-demand | FTS5 + trigram + BM25 + RRF | summary prompt injection | FTS5 + trigram (chat), paragraph scan (memory) |
| CJK 지원 | model-dependent | trigram + LIKE + synonym | model-dependent | trigram + LIKE |
| Prompt 주입 | `memory_summary.md` auto-inject | role-based injection policy | `memory_summary.md` auto-inject | hook nudge (검색 권유만) |
| Cross-session 학습 | Phase 1/2 자동 | flush + reflect + bootstrap | Phase 1/2 자동 | Codex native memory에 위임, codexclaw은 recall로 연결 |
| 보안 | secret redaction, sandbox agent | path guard | secret redaction | read-only |
| 독립성 | Codex runtime 필수 | 완전 독립 | 자체 런타임 필수 | Codex plugin 의존 |

---

## 7. 핵심 교훈

### 7.1 Codex에서 배울 것

- **2-phase 분리**는 아키텍처적으로 깔끔하다. 병렬 추출 + 직렬 통합.
- **Git-baselined workspace**로 dirty check하는 패턴은 incremental consolidation에 매우 효과적.
- **Citation tracking**으로 메모리의 실제 활용도를 정량화하는 것은 pruning 결정에 핵심.
- **Progressive disclosure**: `memory_summary.md` -> `MEMORY.md` -> `rollout_summaries/` -> `skills/`

### 7.2 cli-jaw에서 배울 것

- **Kind priority + recency half-life** 랭킹은 codexclaw recall에 직접 이식 가능.
- **Heuristic reflection** (비-LLM episode -> stable fact 승격)은 저비용 고가치.
- **Role-based injection** 정책은 subagent 파견 시 메모리 과부하를 방지.
- **Synonym expansion**과 **L2 federation**은 한국어 + 다중 프로젝트 환경에 유용.

### 7.3 Jawcode에서 배울 것

- Codex 파이프라인의 TypeScript 포트로, **Phase 1/2 구현이 실제로 가능하다**는 증거.
- **per-cwd scope** (`global:${cwd}`)로 프로젝트 간 메모리 오염 방지.
- Hindsight backend 추상화로 **memory backend를 교체 가능하게** 설계.

### 7.4 핵심 원칙

1. **Codex가 만드는 것은 Codex에게 맡긴다.** 네이티브 메모리 파이프라인을 재구현하지 않는다.
2. **Codex native memory에는 write하지 않는다.** public write API가 없고 직접 파일 수정은 Phase 2와 충돌할 수 있다.
3. **읽기는 강화한다.** recall의 검색 품질(FTS, 랭킹, synonym)을 올린다.
4. **쓰기는 memory가 아니라 evidence로 제한한다.** goalplan/ledger/divergence/metric 같은 워크플로우 증거에 남긴다.
5. **비용을 관리한다.** LLM 기반 extraction은 기본 전략이 아니다.
6. **CJK는 1급 시민이다.** trigram + synonym + LIKE 3-way 라우팅을 기본으로 한다.

---

## 8. 소스 참조 요약

### Codex-RS
- `codex-rs/memories/write/src/phase1.rs` -- Phase 1 extraction
- `codex-rs/memories/write/src/phase2.rs` -- Phase 2 consolidation
- `codex-rs/memories/write/src/prompts.rs` -- prompt building
- `codex-rs/memories/write/src/storage.rs` -- filesystem sync
- `codex-rs/memories/write/src/workspace.rs` -- git diff/reset
- `codex-rs/memories/write/src/start.rs` -- pipeline entry
- `codex-rs/memories/read/src/citations.rs` -- citation parsing
- `codex-rs/memories/read/src/usage.rs` -- usage telemetry
- `codex-rs/state/src/model/memories.rs` -- DB models
- `codex-rs/state/src/runtime/memories.rs` -- DB queries
- `codex-rs/core/src/compact.rs` -- inline compaction
- `codex-rs/core/src/compact_remote.rs` -- remote compaction

### cli-jaw
- `src/memory/runtime.ts` -- public facade
- `src/memory/injection.ts` -- role-based injection
- `src/memory/indexing.ts` -- FTS/trigram index, BM25
- `src/memory/reflect.ts` -- heuristic reflection
- `src/memory/identity.ts` -- soul ledger
- `src/memory/bootstrap.ts` -- legacy import
- `src/agent/memory-flush-controller.ts` -- periodic flush
- `src/manager/memory/federation.ts` -- L2 federation
- `docs/memory-architecture.md` -- architecture doc

### Jawcode
- `packages/coding-agent/src/memories/index.ts` -- pipeline orchestration
- `packages/coding-agent/src/memories/storage.ts` -- SQLite job queue
- `packages/coding-agent/src/prompts/memories/*.md` -- prompt templates
- `packages/coding-agent/src/hindsight/state.ts` -- external recall API
- `docs/memory.md` -- memory architecture doc

### Codexclaw
- `plugins/codexclaw/components/recall/src/index-db.ts` -- sidecar FTS index
- `plugins/codexclaw/components/recall/src/ingest.ts` -- rollout ingestion
- `plugins/codexclaw/components/recall/src/chat-search.ts` -- chat search
- `plugins/codexclaw/components/recall/src/memory-search.ts` -- memory search
- `plugins/codexclaw/components/recall/src/index-search.ts` -- FTS query compilation
- `plugins/codexclaw/components/recall/src/hook.ts` -- Codex hook integration
- `plugins/codexclaw/skills/recall/SKILL.md` -- recall skill definition

---

## 9. 구현 기록 (2026-07-07): Phase 1 패치 출하

5.5 로드맵의 Phase 1을 HOTL PABCD 3-cycle 루프로 구현했다. 세션 `019f3982-0774`,
goalplan `.codexclaw/goalplans/recall-phase-1-read-side-search-quality-patch-po/`
(ledger.jsonl에 phase/criteria 증거 전체). 사용자 지시대로 **자체 메모리 저장소는
만들지 않았다** — `~/.codexclaw/memory/`는 존재하지 않고, `~/.codex/`에는 아무것도
쓰지 않았다. 순수 read-side 검색 품질 패치다.

### 9.1 WP1 — kind-priority + recency half-life 랭킹 (DONE)

`plugins/codexclaw/components/recall/src/memory-search.ts`:

- `kindOfRelpath()`: Codex 메모리 아티팩트를 kind로 분류 —
  `memory_summary.md`=summary, `MEMORY.md`=handbook, `skills/**`=skill,
  `extensions/**`=extension, `raw_memories.md`=raw, `rollout_summaries/**`=rollout,
  stage1 rows=stage1.
- `KIND_PRIORITY`: summary +4 / handbook +3 / skill +2.5 / extension +2 / raw +0.5 /
  rollout·stage1 0. cli-jaw `kindPriority()` (profile -4 ... episode 0)의 **부호 반전**
  포트다 — cli-jaw는 bm25 lower-is-better, codexclaw는 higher-is-better 정렬.
- `HALF_LIFE_HOURS`: rollout/stage1 168h, raw 720h, extension 2160h,
  summary/handbook/skill Infinity (curated store는 감쇠 없음).
- `recencyBoost()`: `+1.5 * exp(-LN2 * ageHours / halfLife)`; 2x half-life를 넘긴
  rollout/stage1은 최대 -2 staleness 패널티; 미래/무효 timestamp는 age 0으로 clamp;
  timestamp 없으면 0. age 소스는 cli-jaw의 relpath 날짜가 아니라 실제
  mtime/`source_updated_at` (더 나은 신호).
- `finalScore()` = textScore + kindPriority + recencyBoost. 후보 생성 시점에 계산해
  `MemoryHit.score`가 정렬 키이자 JSON 출력값 (리뷰어 지적 반영). 검색당 `nowMs` 1회
  캡처 (`opts.nowMs`로 테스트 주입 가능).

### 9.2 WP2 — ko/en synonym expansion (DONE, 수리 1회)

`src/synonyms.ts` (신규): 정적 in-code 양방향 ko/en `SYNONYM_GROUPS` — cli-jaw
`synonyms.ts` 시드(preference/선호/취향, decision/결정/선택/방침, project/프로젝트,
runbook/런북/절차, workflow/워크플로우, pabcd family, fts/bm25) + codexclaw 도메인
(memory/메모리, search/검색, session/세션, error/오류/버그, test/테스트, skill/스킬,
plugin/플러그인, index/인덱스, hook/훅, config/설정, deploy/배포). sqlite 테이블이
아닌 코드 상수인 이유: recall의 read-only derived-cache 원칙 유지.

- `expandQueryWords()`: 단어당 OR-group (원어 선두, 대소문자 dedupe, cap 8).
- 매칭: group 간 AND, group 내 OR; `--any`는 any-member-of-any-group.
- stage1 SQL: group당 bound LIKE 파라미터만 사용 (질의어는 SQL 텍스트에 절대 미진입).
- opt-out: `opts.synonyms=false` / CLI `--no-synonyms`.
- C-gate 리뷰어 FAIL 2건 수리: (1) density를 first-present가 아닌 best-present
  member로 계산 (결정 == decision 점수 동등성 회귀 테스트 추가); (2) 신규
  `dist/synonyms.js`가 전역 `dist/` ignore에 걸려 untracked -> `git add -f`로 추적
  (packaging entry가 `dist/cli.js`라 미추적 시 런타임 import 파손).
- 문서화된 collapse: 같은 group의 두 질의어(`plan audit`)는 하나의 요구로 접힌다
  (cli-jaw parity, 테스트로 고정).

### 9.3 검증 증거

- recall 단위: canonical glob `node --test test/*.test.ts` 57/57 pass
  (WP1 이전 baseline 47; in-component 실행의 58은 fixtures.ts 파일 스텁 포함 수치).
- plugin 루트 `npm test`: 851 중 850 pass, 1 fail — 실패는 recall과 무관한
  packaging.test.mjs untracked-dist 단정으로, 사용자의 진행 중 messenger-bridge
  작업(untracked src/test + build 산출물)이 원인. 이 루프에서 수정하지 않음
  (타인 WIP를 force-add하지 않는다).
- live smoke: `cxc memory search "codexclaw"` -> summary > handbook > raw 순서로
  kind 라벨과 함께 출력 (112 files, ~20ms); `cxc memory search "결정"` -> 영어
  decision 콘텐츠 recall, `--no-synonyms`로 원어 매칭 복원.
- FTS 이관은 **보류 결정**: 실측 112 파일 / 11-21ms paragraph scan에서 sidecar FTS
  ingest 복잡도를 정당화할 병목이 없다. 재검토 트리거는 메모리 코퍼스가 스캔 지연을
  체감시킬 때.
- 리뷰 체인: A-gate 리뷰어(Helmholtz, 3개 work-phase 재사용) PASS/PASS/FAIL->PASS,
  C-gate 리뷰어는 매 cycle 신규(Planck PASS, Lagrange FAIL->수리->PASS).

### 9.4 외부 리서치 provenance (Tier-2 opened)

랭킹 설계가 현행 관행과 일치함을 확인한 출처 (explorer가 원문을 연 URL만):

- LangChain time-weighted retriever: `score = (1-decayRate)^hoursPassed + relevance`,
  hoursPassed는 last-access 기준 —
  https://docs.langchain.com/oss/javascript/integrations/retrievers/time-weighted-retriever ;
  기본 `decay_rate=0.01`은 소스에서 확인 —
  https://github.com/langchain-ai/langchain/blob/master/libs/langchain/langchain_classic/retrievers/time_weighted_retriever.py
- LlamaIndex TimeWeightedPostprocessor: `score + (1-time_decay)^hours_passed`,
  기본 `time_decay=0.99` —
  https://developers.llamaindex.ai/python/framework-api-reference/postprocessor/fixed_recency/
- 이종 스토어 혼합은 명시적 소스 가중치: LangChain EnsembleRetriever weighted RRF
  `rrf += weight/(rank+c)`, c=60 —
  https://github.com/langchain-ai/langchain/blob/master/libs/langchain/langchain_classic/retrievers/ensemble.py ;
  Elastic RRF rank_constant=60 —
  https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion
- 한국어 lexical: 형태소 분석(Elastic Nori, mecab-ko-dic) 우선, curated user-dict /
  synonym_graph는 보조 —
  https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-nori ;
  codexclaw recall은 trigram+LIKE 위에 curated synonym table로 충분 (코퍼스 소형).

시사점: 지수 시간감쇠 + kind/source 가중은 업계 표준 패턴과 정합. codexclaw의
half-life 상수(cli-jaw 이식)는 LangChain 기본(69h 반감)보다 완만한 168h인데,
메모리 아티팩트는 채팅 로그보다 수명이 길어 타당하다.

---

## 부록: 외부 에이전트 메모리 비교 (2026-07)

| Agent | 접근 방식 | 자동 추출 | 검색 | Source |
|---|---|---|---|---|
| **Codex** | 2-phase pipeline -> `~/.codex/memories/` | O (opt-in) | on-demand cat/grep | [docs](https://developers.openai.com/codex/memories) |
| **Claude Code** | Memory tool + Dreams consolidation | O | `/mnt/memory/` file search | [docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) |
| **Gemini CLI** | `GEMINI.md` hierarchy + Auto Memory | O (experimental) | `/memory show` | [docs](https://geminicli.com/docs/cli/auto-memory/) |
| **Aider** | `CONVENTIONS.md` read-only | X | manual `/read` | [docs](https://aider.chat/docs/usage/conventions.html) |
| **Cursor** | `.cursor/rules` + `AGENTS.md` | X | rule matching | [docs](https://cursor.com/docs/rules) |
