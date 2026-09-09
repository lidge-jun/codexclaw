# 02 — Codex 네이티브 메모리 주입 감사 (S2)

날짜: 2026-09-10 (KST). 읽기 전용. 이 층은 L0 PR(#100–#108)과 무관하며 **회귀 아님**.

런타임: `codex --version` = `codex-cli 0.153.4`. 현재 스레드 session_meta `cli_version=0.153.4`, `originator=Codex Desktop`, cwd는 이 워크트리 (rollout `2026/09/10/rollout-2026-09-10T06-23-39-01a0880e-149e-72d0-86db-53bd99bcac0e.jsonl` 0행).

대조 소스: `/Users/jun/Developer/codex/121_openai-codex` HEAD `095da4b7e8` (2026-09-08, `main`, origin/main보다 35 커밋 behind). 태그 `rust-v0.153.0` = `41e22fee98` (2026-09-02). 이 체크아웃에 `0.153.4` 태그는 없음. HEAD는 태그 이후 메모리 v2 커밋 다수(`#43797` 버전 분리, `#43813` v2 프롬프트 등). 사용자 config에 `[memories].version` 없음 → 기본 V1. 설치된 바이너리 문자열에 `MEMORY_SUMMARY BEGINS` 존재. **주입 경로(V1 요약 통째 주입 + 2500 토큰 근사 상한)는 0.153.0과 HEAD가 같다.** v2 dual-write·버전 키는 런타임 0.153.4에 없을 수 있음 (unknown, 태그 없음).

---

## 1. 현재 저장소 실측

측정 위치: `~` 아래 `.codex/memories` 상대 경로 Python. 셸 본문에 메모리 절대 경로를 넣지 않음.

### 1.1 memory_summary.md

| 항목 | 값 | 근거 |
|---|---|---|
| 바이트 | 9245 | `Path.stat` / `read_bytes` |
| 문자 수 | 8991 | UTF-8 decode |
| 줄 수 | 109 | 1–109행 |
| 단어 수 | 1094 | `str.split` |
| 네이티브 근사 토큰 | 2312 | `approx_token_count` = ceil(bytes/4), `codex-rs/utils/string/src/truncate.rs:4,71-74` `APPROX_BYTES_PER_TOKEN=4` |
| 2500 대비 | 92.48% (2312/2500) | 주입 상한 `MEMORY_TOOL_DEVELOPER_INSTRUCTIONS_SUMMARY_TOKEN_LIMIT=2_500` (`ext/memories/src/lib.rs:16`) |
| 주입 시 중간 절단 여부 | 아니오 | 예산 10000바이트, 파일 9245 < 10000. `truncate_middle_with_token_budget`는 길이가 예산 이하면 원문 반환 (`truncate.rs:20-21`) |

브리프의 “94% 포화”는 점검 태스크 최종 답변에 숫자로 없음. 그 태스크는 주입 텍스트를 정성 평가했고 저장소 바이트를 재지 않았다 (세션 `01a08805-2ace-7250-8272-3636e50fa5eb`, 2026-09-09T21:14:37Z). 현재 파일 기준 네이티브 근사는 **92.5%**. 문자/4면 2248/2500=89.9%. 94%는 당시 파일·다른 토크나이저·래퍼 포함 추정일 수 있음 (unknown).

구조 (실파일 행):

- L1 `v1`
- L3–7 `## User Profile`
- L9–18 `## User preferences` (인용된 세션 지시 8개)
- L20–28 `## General Tips`
- L30–109 `## What's in Memory` — cwd 헤더 8개 + `Older Memory Topics` 3개

### 1.2 MEMORY.md

| 항목 | 값 |
|---|---|
| 바이트 | 899149 |
| 줄 수 | 8946 |
| 헤더(`#` 시작) | 2115 |
| `# Task Group:` | 219 |
| `## User preferences` | 212 |
| `## Reusable knowledge` | 217 |
| `## Failures and how to do differently` | 216 |
| `applies_to: cwd=` | 219개, 고유 106 |

블록 골격은 consolidation 템플릿과 일치: Task Group → scope/applies_to → Task n → rollout_summary_files/keywords → User preferences / Reusable knowledge / Failures (`memories/write/templates/memories/consolidation.md:208-259`).

오래된/충돌 사례:

- L25–31 (OpenCodex 2.49.0 블록): “서브에이전트는 검증용”, “로컬 스위트 금지”, “preview main 머지는 ci 보지 말고”를 해당 태스크 선호로 보존.
- L582: “private devlog separate from public PR content” (cli-jaw PABCD 블록).
- L5314, L5388: 2026-07-30 OpenCodex “private devlog submodule → tracked files” 전환 기록. 같은 파일 안에 구·신 거버넌스가 공존.
- `no-verify` 54회, `로컬 스위트` 12회, `로컬스위트` 7회 — 다수 태스크 그룹에 같은 제약이 반복.

현행 OpenCodex AGENTS.md (`/Users/jun/Developer/new/700_projects/opencodex/AGENTS.md` 약 90–148행): `devlog/`는 공개 저장소의 추적 디렉터리, 서브모듈/프라이빗 미러 없음. “private half is no longer a thing that exists.” 보안 초안은 `devlog/`가 아니라 scratch. **요약 L16의 ‘private devlog stays separate’는 이 문서와 충돌.**

### 1.3 rollout_summaries/

개수 **256** (파일만). 기본 `max_raw_memories_for_consolidation=256` (`config/src/types.rs:52`)과 같음 → 선택 상한 포화.

날짜 분포: 파일명 접두 `YYYY-MM-DD` 기준 57버킷. 최오래된 `2026-06-02` 1개, 최신 `2026-09-09` 2개. 피크 `2026-07-23` 16개. 2026-09-08 1개, 09-09 2개. 오늘(09-10) 없음 — 기본 `min_rollout_idle_hours=6` (`types.rs:50`)과 맞음.

크기: min 1934, max 16055, 합 1_641_634 바이트.

Phase 1 신규 추출 창은 기본 `max_rollout_age_days=10`인데, 6월 파일이 남는 이유는 Phase 2가 사용/미사용일(`max_unused_days` 기본 30)로 고르기 때문. 디스크의 256개는 그 선택 집합.

### 1.4 extensions/ad_hoc/notes

**18개 파일.** 2026-07-31 ~ 2026-09-08. kim_wiki 정정 다수(08-21), apply-patch envelope(09-05), bundled plugin wipe(09-08, 2712바이트).

요약 L27, L66–68에 `[ad-hoc note]`로 plugin wipe가 승격됨. ad-hoc → Phase 2 → memory_summary.md 경로가 실제로 돈다.

기타 루트: `raw_memories.md` 1_379_821바이트(주입 안 함). `skills/` 6개(opencodex-release-train 등, 주입 안 함, 템플릿만 경로 안내). `.git` 있음(Phase 2 베이스라인).

### 1.5 게이트 오탐 (이 조사 중)

`cd ~/.codex/memories && python3 … Path('rollout_summaries').iterdir()` 가 PreToolUse MEMORY-WRITE-GATE에 차단됨. 메시지는 “Blocked a write of a file under the Codex memories directory”. 명령은 읽기 전용. 같은 나열을 `cd ~` + 상대 경로로 재시도해 성공. 브리프가 경고한 본문 경로 오탐이며, 실제 쓰기는 없었음. L0 #102 회귀 후보(S2 범위 밖, 게이트 조사가 담당).

---

## 2. 소스: 생성 · 주입 · 상한 · cwd

### 2.1 파이프라인

`codex-rs/memories/README.md`: 루트 세션 시작 시 백그라운드. 조건 — non-ephemeral, feature on, not sub-agent, state DB 있음. Phase 1 롤아웃 추출 → Phase 2 통합.

- Phase 1: 허용 세션, 나이 창, idle, 미점유, startup 한도. 모델이 `raw_memory` + `rollout_summary` + slug. cwd는 stage-one 입력 `rollout_cwd` (`stage_one_input.md:5`, `prompts.rs:136-154`).
- Phase 2: 전역 락. `max_unused_days` 밖 제외, usage_count/last_usage 순위, 상한 개수. `raw_memories.md`, `rollout_summaries/` 동기화 후 통합 서브에이전트가 MEMORY.md / memory_summary.md / skills 갱신. cwd는 **아티팩트 인덱싱용**. 주입 필터가 아님.

오케스트레이션 README는 `core/src/memories/`를 가리키나 현재 트리에 그 디렉터리는 없음. 세션 플래그는 `core/src/session/session.rs:904` `generate_memories` → `memory_mode`.

### 2.2 주입 (읽기 경로)

구현: `ext/memories` (확장 컨텍스트). `memories/read`는 citation/usage 헬퍼, 요약 주입 본문은 `ext/memories/src/prompts.rs`.

1. `features.memories`(Feature::MemoryTool) **그리고** `config.memories.use_memories`여야 함 (`extension.rs:48,67`).
2. `build_memory_tool_developer_instructions`: `{codex_home}/{version.dir}/memory_summary.md` 전체를 읽고, **현재 스레드 cwd를 보지 않음** (`prompts.rs:36-50`).
3. `truncate_text(..., Tokens(2500))`.
4. `read_path.md` 템플릿에 끼워 developer_policy 프래그먼트 `memories.instructions`로 주입 (`extension.rs:92-99`).
5. V2만 8900바이트 조각 분할. 사용자 version 미설정 → V1 단일 프래그먼트.

즉 **모든 대화에 같은 글로벌 요약이 들어간다.** `What's in Memory`의 cwd 헤더는 검색 힌트일 뿐, 런타임이 현재 cwd로 잘라 주지 않는다.

전용 도구(`dedicated_tools=true`일 때 list/read/search/add_ad_hoc_note): 경로는 메모리 루트 상대. 스레드 cwd 스코프 아님 (`local.rs:resolve_scoped_path`).

### 2.3 상한

| 상한 | 값 | 설정 가능 | 위치 |
|---|---|---|---|
| 주입 요약 | 2500 근사 토큰 (4바이트/토큰) | **불가** (const) | `ext/memories/src/lib.rs:16`, `prompts.rs:47-50` |
| 생성 밀도 | “high signal per token”, Profile ≤350 words | 프롬프트만, 하드캡 아님 | `consolidation.md:474,508` |
| Phase 1 롤아웃 입력 | 모델 유효 창의 70%, fallback 150000 | 모델 창 간접. 키 없음 | `prompts.rs:121-129`, `write/src/lib.rs:94,101` |
| 도구 read | 기본 20000 토큰 | 호출 인자 `max_tokens` | `ext/memories/src/lib.rs:15`, `local/read.rs:38-43` |
| 선택 개수 | 기본 256 | `max_raw_memories_for_consolidation` | `types.rs:52,308-311` |

생성기는 2500을 강제하지 않는다. 넘치면 주입 때 중간 절단. 현재 파일은 미절단.

### 2.4 cwd 스코핑이 있는 곳 / 없는 곳

있는 곳: Phase 1 `cwd:` 필드, Phase 2 `applies_to: cwd=`, 요약 `### <cwd>` 인덱스, 도구 path 샌드박스.

없는 곳: developer instruction 주입. 현재 워크스페이스가 이 워크트리여도 OpenCodex·cli-jaw·voice/WebRTC 블록이 같이 들어간다.

### 2.5 선호가 상시 규칙이 되는 경로

`consolidation.md:390-407,446-449,532`:

- 세션 인용을 MEMORY.md `## User preferences`로 승격 (“when <situation> … quote -> <future default>”).
- “Do not require a preference to be global across all tasks. Repeated evidence across similar tasks in the same block is enough.”
- “if it recurs … may also deserve promotion into memory_summary.md.”
- 요약 User preferences는 “main actionable payload”, MEMORY.md 불릿을 들어 올려 거의 그대로 유지.

그 결과 요약 L12–18이 인용된 일회/워크플로 지시를 전역 기본값처럼 싣는다. 템플릿이 의도한 동작.

### 2.6 context_management

Feature 키 `context_management`, Stage UnderDevelopment, default false (`features/src/lib.rs` FeatureSpec). 설정 구조체는 `experimental_mode`만 (`feature_configs.rs:302-311`). 사용자 `config.toml` `[features]`에 없음(꺼짐). 컨텍스트 창 실험 플래그이며 **메모리 요약 주입과 분리**.

---

## 3. 설정으로 조절 가능한 것 / 불가능한 것

사용자 실측 `~/.codex/config.toml`:

- L77 `[features] memories = true` (Feature::MemoryTool, 기본 false, Stable).
- L665–668 `[memories] generate_memories=true use_memories=true dedicated_tools=true`.
- `version` / `dual_write` / 한도 키 없음 → 소스 기본값.
- `context_management` 없음.

`dedicated_tools=true`는 L0 #106이 `cxc enable` 때 켜는 값. 주입 내용이 아니라 도구 노출.

HEAD `MemoriesToml` (`config/src/types.rs:294-336`). `rust-v0.153.0`에는 `version`/`dual_write` 없음.

| 키 | 기본 | 사용자 | 하는 일 | 안 하는 일 |
|---|---|---|---|---|
| `features.memories` | false | true | 파이프라인+확장 on | 요약 내용/cwd 필터 |
| `generate_memories` | true | true | 신규 스레드 memory_mode, Phase 1/2 | 기존 요약 주입 중지 못 함 |
| `use_memories` | true | true | 요약 주입 on/off | 부분/cwd 주입 |
| `dedicated_tools` | false | true | memories.* 도구 | 주입 집합 |
| `version` | V1 | 미설정 | V1/V2 디렉터리 | 0.153.4에 키 없을 수 있음 |
| `dual_write` | false | 미설정 | 두 버전 동시 기록 | HEAD 전용 가능 |
| `disable_on_external_context` | false | 미설정 | MCP/웹검색 시 polluted | 주입 cwd |
| `max_raw_memories_for_consolidation` | 256 (1–4096) | 기본 | Phase 2 개수. 현재 256=상한 | 주입 토큰 |
| `max_unused_days` | 30 (0–365) | 기본 | 미사용 제외 | |
| `max_rollout_age_days` | 10 (0–90) | 기본 | Phase 1 나이 | 디스크 기존 파일 즉시 삭제 아님 |
| `max_rollouts_per_startup` | 2 (1–128) | 기본 | 시작당 추출 | |
| `min_rollout_idle_hours` | 6 (1–48) | 기본 | 활성 스레드 스킵 | |
| `min_rate_limit_remaining_percent` | 25 | 기본 | 쿼터 가드 | |
| `extract_model` / `consolidation_model` | None | 미설정 | 모델 오버라이드 | |
| **주입 2500 토큰** | const | — | **설정 키 없음** | |
| **주입 cwd 필터** | 없음 | — | **설정 키 없음** | |
| **선호 승격 정책** | 템플릿 | — | **설정 키 없음** | |
| `context_management.experimental_mode` | false | 꺼짐 | 창 관리 실험 | 메모리 주입 |

끌 수 있는 큰 스위치: `use_memories=false`(주입 전체 off), `generate_memories=false`(신규 생성 off, 기존 요약은 `use_memories`가 켜져 있으면 계속 주입), feature `memories=false`.

---

## 4. 점검 증상 × 요약 인용 × 층 판정

점검 태스크(`01a08805`, cwd=opencodex)는 주입 텍스트만 보고 저장소는 안 열었다. 아래는 같은 증상을 memory_summary.md 행으로 재확인.

| 증상 | 요약 인용 | 판정 | 이유 |
|---|---|---|---|
| 과거 세션 지시가 상시 선호로 일반화 | L12 `“실제 작업 새로운 워크트리… 서브에이전트는 검증용” -> implementation belongs in explicit worktree tasks; subagents are bounded read-only verifiers…` / L13 `“절대 로컬스위트를… no verify로 푸시”` / L15 `“preview main 머지는 ci 보지 말고 바로 머지해”` | **(1) 네이티브 고유**, (3) 일부 관행 | 통합 프롬프트가 인용 → future default → 요약 payload로 올리라고 지시. 권한 범위가 세션마다 다른데도 전역 불릿. 사용자가 같은 문장을 여러 태스크에서 반복한 것은 (3)이나, 전역 주입은 파이프라인이 함. |
| private devlog 구식 사실이 현행 AGENTS.md와 충돌 | L16 `Docs-first PABCD … private devlog stays separate from public PR content.` | **(1) 네이티브 고유**, (2) ad-hoc으로 완화 가능 | OpenCodex AGENTS.md는 공개 추적 `devlog/`, 프라이빗 하프 없음. 네이티브는 라이브 AGENTS와 대조·무효화하지 않음. MEMORY.md L582(구)와 L5314/5388(전환)이 공존. (2) ad-hoc 정정 노트는 다음 Phase 2에 들어갈 수 있음(plugin wipe가 L27에 승격된 사례). 사용자가 “잊어”를 안 한 것은 (3) 보조. |
| 중복 | L12와 L52(`Subagents verify only`) / L13과 L22(최종 SHA CI) / L14–15와 L23(릴리스 절차) | **(1) 네이티브 고유** | 요약이 Profile + Preferences + Tips + What's in Memory learnings에 같은 운영 규칙을 재서술. MEMORY.md 212개 preferences에 `no-verify` 54회. 템플릿은 중복 제거를 말하지만 층간 중복을 막지 못함. 주입 템플릿 `read_path.md`의 메모리 조회 절차는 cxc-recall 스킬과도 겹침(L0 검색층, 네이티브 주입과 별개). |
| 무관 프로젝트 이력 주입 | L32–44 OpenCodex 메인, L46–52 worktree 2.49.0, L54–60 codexclaw, L62–68 플러그인 와이프, L70–76 2.48 B, L78–84 voice/WebRTC, L86–92 cli-jaw-pr473, L94–109 Older topics(ima2-gen 등) | **(1) 네이티브 고유** | 주입이 cwd 비필터. 이 스레드 cwd는 이 워크트리인데 전 프로젝트 인덱스가 developer instructions에 상주. (2) `use_memories=false`만 전체 off. cxc `--cwd`(#108)는 **cxc memory search**이지 네이티브 주입이 아님. (3) 다프로젝트 사용은 코퍼스 크기만 설명하고, 필터 부재는 네이티브. |

**회귀 아님.** 생성·주입·2500 const·글로벌 요약은 `rust-v0.153.0`(09-02)과 HEAD에 동일. L0은 cxc 검색/훅/dedicated_tools 토글. #106은 도구 on, 요약 텍스트를 안 만듦. #108 cwd는 CLI 검색. #102는 쓰기 게이트.

점검의 검색 0건·Aside 점수·위키 대표문서 누락은 S2 밖(검색/Aside/위키 층).

---

## 5. 버전 차이 표시

| 항목 | 런타임 | 로컬 소스 HEAD | 차이 위험 |
|---|---|---|---|
| CLI | 0.153.4 Desktop | 태그 없음. `rust-v0.153.0` 09-02, HEAD 09-08 | 0.153.4 SHA 미확인 |
| 주입 2500 | 바이너리에 memory_summary.md / MEMORY_SUMMARY BEGINS | 동일 const | 낮음 |
| `[memories] version/dual_write` | 사용자 미설정, 0.153.0 스키마에 필드 없음 | HEAD에 있음 | 중. 사용자가 V2를 켜도 0.153.4가 거절/무시할 수 있음 |
| 통합 프롬프트 문구 | unknown (바이너리 임베드) | consolidation.md 현재본 | 중저. 승격 정책은 0.153 계열에 이미 있음 |
| Feature memories | config true | default false | 없음. 사용자가 켬 |

소스 조사 결과는 HEAD 기준. 런타임이 v2 코드를 안 가져도 V1 주입 결론은 바뀌지 않음.

---

## 로드맵 입력

### (a) 회귀 여부

**회귀 아님.** Codex 네이티브 메모리 층(글로벌 memory_summary.md 주입, 2500 근사 상한, 세션 지시 승격, cwd 비필터)의 기존 동작. L0 #100–#108이 이 텍스트를 생성·주입하지 않음. #106 `dedicated_tools`는 도구 노출만. 현재 92.5% 포화·충돌·일반화는 통합 에이전트 산출 + 주입 설계.

### (b)(c) 수정 후보

**P0 — 없음 (네이티브 주입을 L0으로 고칠 대상 아님).** 제품 긴급 우회가 필요하면 `use_memories=false`로 주입 전체 off. 대상: `~/.codex/config.toml` `[memories] use_memories`. 검증: 새 스레드 developer instructions에 `MEMORY_SUMMARY BEGINS` 부재 (session jsonl `response_item` role=developer). 부작용: 네이티브 요약/도구 지침 상실. dedicated_tools만 true여도 `use_memories=false`면 확장 enabled가 false (`extension.rs:48`).

**P1 — 구식 사실 정정 (codexclaw/사용자 관행, 네이티브 수정 없이).** 대상: `~/.codex/memories/extensions/ad_hoc/notes/<timestamp>-opencodex-devlog-public.md` (사용자 “기억해둬” 필요, 이 세션에서는 쓰지 않음). 내용: OpenCodex `devlog/`는 공개 추적 디렉터리, private submodule 분리 규칙은 폐기, 보안 초안은 scratch. 검증: 다음 루트 세션 Phase 2 이후 요약에서 “private devlog stays separate”가 0이거나 폐기 주석으로 대체. 한계: 통합 모델이 노트를 무시할 수 있음.

**P1 — cxc-recall/스킬에 네이티브 주입 한계를 명시.** 대상: `plugins/codexclaw/skills/recall/SKILL.md` (및 설치 캐시 동기화). 넣을 사실: (1) 주입 요약은 cwd 비필터, (2) User preferences는 세션 인용 승격이라 권한 범위가 현재 태스크와 다를 수 있음, (3) 라이브 AGENTS.md가 요약보다 우선, (4) 상세는 MEMORY.md `applies_to: cwd=`로 재검색. 검증: 스킬 로드 후 에이전트가 요약 L15를 현재 머지 권한으로 단정하지 않는 시나리오 1건. L0 검색 품질과 별개.

**P1 — 설정 문서화.** 대상: 사용자/운영 노트 또는 cxc doctor. 표: 2500·cwd 필터는 키 없음, 개수 한도만 조절, 현재 rollout_summaries=256=상한. 검증: 문서에 `max_raw_memories_for_consolidation`과 2500 const가 명시.

**P2 — 업스트림 Codex (이 레포 밖).** 대상: `codex-rs/ext/memories/src/prompts.rs`, `ext/memories/src/lib.rs`, `memories/write/templates/memories/consolidation.md`, `config/src/types.rs`. 후보: (i) 주입 토큰 상한 설정 키, (ii) `What's in Memory`를 현재 cwd/프로젝트 패밀리만, (iii) 요약 User preferences에 applies_to/유효기간, 일회 인용 승격 금지, (iv) 라이브 AGENTS.md와 충돌 시 폐기. 검증: 단위 테스트 — 다른 cwd 요약이 주입 프래그먼트에 없음; 2500 키 변경 시 truncate 예산 변경. 0.153.4 vs HEAD v2 차이를 먼저 확인할 것.

**P2 — 중복 축소는 통합 프롬프트/재생성 문제.** 로컬에서 MEMORY.md 212 블록을 수동 편집하면 다음 Phase 2가 되돌릴 수 있음. 유효한 로컬 수단은 ad-hoc “이 선호는 OpenCodex 수동 스택에만” 범위 노트. 검증: 요약 L9–18 불릿 수와 전역 vs 워크플로 라벨.

codexclaw가 훅으로 네이티브 developer_policy 프래그먼트를 빼는 경로는 이 소스에서 확인 못 함 (unknown). PostCompact 실버그(#104)는 cxc 압축 주입이지 Codex `memories.instructions`가 아님.

