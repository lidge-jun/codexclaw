# Codex 메모리가 약한 이유 — 구현 근거 분석

- 작성: 2026-09-09
- 소스 스냅샷: `/Users/jun/Developer/codex/121_openai-codex` (HEAD `d2d5b70241fb448044c1c088a977cc720d70443a`, 2026-09-04)
- 설치본: `/Users/jun/.codex` (config.toml, memories/, sessions/)
- 조사 범위: rust 소스 정적 분석 + 설치본 파일/크기 측정. 런타임 계측(실제 프롬프트 덤프, 텔레메트리 수치)은 하지 않음.

---

## 요약 (결론 먼저)

Codex 네이티브 메모리는 "구현이 없는" 게 아니라 **쓰기 파이프라인은 꽤 무겁게 구현돼 있고, 읽기 경로가 의도적으로 얇게 설계돼 있다.** 읽기는 사실상 `memory_summary.md` 한 장을 developer 프롬프트에 붙이는 것이 전부다. 검색 도구(`memories.search` 등)는 코드에 존재하지만 **기본값이 꺼져 있어(`dedicated_tools: false`) 툴 목록에 아예 등장하지 않는다.** 그래서 에이전트는 "검색 툴을 안 쓰는" 게 아니라 **부를 툴이 없어서 못 쓴다.** 남은 접근 경로는 프롬프트가 산문으로 지시하는 `grep/rg` 뿐이고, 이건 예산 문구("4-6 search steps")와 함께 제시돼서 강제력이 약하다.

per-project 스코핑은 **없다.** phase-1 후보 선정 SQL은 `cwd_filters: None`으로 명시적으로 cwd를 안 건다. 주입되는 summary도 전역 1개 파일이다.

세션 rollout jsonl(22GB, 12,469개)은 네이티브 경로에서 **phase-1 요약 입력으로 1회 소비된 뒤 버려진다.** 검색 인덱스가 없다. codexclaw `cxc chat search`가 그 공백을 메우려고 별도 FTS 사이드카(12,735 파일 / 1,213,941 메시지)를 만든 것이다.

---

## 1) Codex 네이티브 메모리는 어디까지 구현돼 있나

크레이트는 3개로 쪼개져 있다.

| 위치 | 역할 | 규모 |
|---|---|---|
| `codex-rs/memories/write/` | phase1/phase2 쓰기 파이프라인 | phase1.rs 905줄, phase2.rs 629줄, runtime.rs 379줄 |
| `codex-rs/memories/read/` | 읽기 경로 | lib.rs **15줄**, citations.rs 85줄, usage.rs 60줄 |
| `codex-rs/ext/memories/` | extension 등록 + 전용 툴 | extension.rs 136줄, tools/ 5파일, local/ 5파일 |

`memories/read/src/lib.rs` 전체가 15줄이고 실질 내용은 이것뿐이다.

```rust
// codex-rs/memories/read/src/lib.rs:13-15
pub fn memory_root(codex_home: &AbsolutePathBuf) -> AbsolutePathBuf {
    codex_home.join("memories")
}
```

즉 read 크레이트는 경로 계산 + citation 파싱 + 텔레메트리 분류만 한다. **검색/랭킹/리트리벌 로직이 read 크레이트에 없다.** 리트리벌 비중이 쓰기 대비 압도적으로 작다는 게 코드 규모에서 그대로 드러난다.

쓰기 쪽은 반대로 충실하다. `codex-rs/memories/README.md`가 명시하는 2단계 구조:

- phase 1: 상태 DB에서 rollout을 claim → 모델로 요약 → `raw_memory` / `rollout_summary` / `rollout_slug` 구조화 출력 → DB 저장
- phase 2: stage-1 출력들을 파일로 동기화(`raw_memories.md`, `rollout_summaries/`) → git diff 생성 → **전용 서브에이전트**를 띄워 `MEMORY.md` / `memory_summary.md` / `skills/`를 갱신

phase 2가 서브에이전트로 돌아간다는 점이 중요하다 (`memories/write/src/phase2.rs:320` 부근에서 `agent_config.cwd = root`로 메모리 루트에 묶고, 같은 파일 333줄에서 재귀 방지를 위해 `Feature::MemoryTool`을 끈다). 즉 통합 품질은 그 에이전트의 판단력에 의존하고, 결정론적 인덱싱이 아니다.

기동 조건은 `memories/write/src/start.rs:33-37`:

```rust
if config.ephemeral
    || !config.features.enabled(Feature::MemoryTool)
    || source.is_non_root_agent()
{
    return;
}
```

서브에이전트 세션에서는 메모리 생성이 아예 안 돈다.

## 2) memory_summary는 누가 언제 만들고 어떻게 주입되나

**만드는 쪽**: phase 2 통합 서브에이전트. README의 "consolidated outputs such as `MEMORY.md`, `memory_summary.md`, and `skills/` are left for the agent to update" 문장이 근거다. 트리거는 루트 세션 시작 시 백그라운드 spawn(`start.rs:53`의 `tokio::spawn`).

**주입하는 쪽**: 훅이 아니라 **코어의 extension(ContextContributor)**이다. `codex-rs/ext/memories/src/extension.rs:51-77`:

```rust
impl ContextContributor for MemoriesExtension {
    fn contribute_thread_context<'a>(...) {
        Box::pin(async move {
            let Some(config) = thread_store.get::<MemoriesExtensionConfig>() else { return Vec::new(); };
            if !config.enabled { return Vec::new(); }
            build_memory_tool_developer_instructions(&config.codex_home)
                .await
                .map(|instructions| {
                    PromptFragment::developer_policy(
                        instructions,
                        ContentItemKind("memories.instructions".to_string()),
                    )
                })
                ...
```

`build_memory_tool_developer_instructions`는 `ext/memories/src/prompts.rs:27-51`에서 **`memory_summary.md` 파일 하나만 읽어** 템플릿 `templates/memories/read_path.md`의 `{{ memory_summary }}` 자리에 끼운다. MEMORY.md도 rollout_summaries도 읽지 않는다.

```rust
// ext/memories/src/prompts.rs:30-40
let base_path = codex_home.join("memories");
let memory_summary_path = base_path.join("memory_summary.md");
let memory_summary = fs::read_to_string(&memory_summary_path).await.ok()?.trim().to_string();
let memory_summary = truncate_text(
    &memory_summary,
    TruncationPolicy::Tokens(MEMORY_TOOL_DEVELOPER_INSTRUCTIONS_SUMMARY_TOKEN_LIMIT),
);
```

상한은 `ext/memories/src/lib.rs:16`의 `MEMORY_TOOL_DEVELOPER_INSTRUCTIONS_SUMMARY_TOKEN_LIMIT: usize = 2_500`.

**설치본 실측**: `memory_summary.md`는 9,544 바이트 / 115줄, 대략 2,359 토큰(4바이트/토큰 근사). 2,500 상한 바로 아래다. 즉 지금 이 시스템은 **잘림 직전까지 꽉 찬 상태**이고, 조금만 더 커지면 뒤쪽이 조용히 truncate 된다. 반면 `MEMORY.md`는 891,417 바이트 / 8,875줄, `raw_memories.md`는 1,376,199 바이트 / 18,032줄, `rollout_summaries/`는 256개 파일이다.

정리하면 **디스크에 있는 메모리의 약 0.7%(9.5KB / 전체 7.2MB)만 자동으로 컨텍스트에 들어가고, 나머지 99%는 에이전트가 스스로 grep 해야만 닿는다.** 이게 "메모리가 약하다"고 체감되는 1차 원인이다.

## 3) per-project 스코핑은 되는가 — 안 된다

세 지점 모두에서 프로젝트 경계가 없다.

**(a) 주입 단위가 전역이다.** `prompts.rs:30`은 `codex_home.join("memories")` 고정 경로 하나만 본다. cwd/프로젝트 인자를 받지 않는다.

**(b) phase-1 후보 선정이 cwd를 안 건다.** `codex-rs/state/src/runtime/memories.rs:217-235`:

```sql
FROM threads
```
```rust
push_thread_filters(
    &mut builder,
    ThreadFilterOptions {
        archived_only: false,
        allowed_sources,
        model_providers: None,
        cwd_filters: None,      // <-- 프로젝트 스코핑 없음
        section: None,
        project_id: None,       // <-- 프로젝트 스코핑 없음
        ...
```

`cwd_filters`와 `project_id` 필드는 **존재하는데 None으로 넘긴다.** 인프라는 있고 메모리 파이프라인이 안 쓰는 것이다. 필터는 `memory_mode = 'enabled'`, 나이(`max_rollout_age_days`), idle 시간뿐이다.

**(c) phase-2 선택도 전역 랭킹이다.** `state/src/runtime/memories.rs:464-481`:

```sql
ORDER BY
    COALESCE(so.usage_count, 0) DESC,
    COALESCE(so.last_usage, so.source_updated_at) DESC,
    so.source_updated_at DESC,
    so.thread_id DESC
```

cwd가 정렬/필터 키에 전혀 없다. 결과적으로 opencodex 작업 중에도 cli-jaw, kim_wiki, ima2-gen 메모리가 같은 요약에 섞여 들어온다. 실제 설치본 `MEMORY.md`에 `cwd=` 문자열이 610번, `applies_to`가 217번 등장하는데, **이건 스키마가 아니라 통합 에이전트가 프롬프트 규칙으로 만들어낸 산문 관례다.** 런타임이 이 `cwd=` 표기를 읽어서 필터링하는 코드는 찾지 못했다. (검색 범위: `memories/`, `ext/memories/`, `state/src/runtime/memories.rs`)

왜 안 하나에 대한 설계 의도는 소스에 주석으로 없다 (unknown). 다만 구조상 이유는 추정 가능하다: 주입이 파일 1개 읽기로 끝나므로 프로젝트별 분기를 하려면 파일을 프로젝트 수만큼 쪼개거나 인덱스가 필요한데, 현재 read 크레이트에는 그 계층 자체가 없다.

## 4) 에이전트가 검색 툴을 호출하지 않는 구조적 이유

제시된 5개 후보(툴 노출 방식 / 프롬프트 우선순위 / 비용 / 컨텍스트 위치 / 리콜 신호 부재) 중 **1순위는 압도적으로 "툴 노출 방식"이다.** 나머지는 2차 요인이다.

### 4-1. 결정적 원인: 네이티브 메모리 툴이 기본적으로 등록조차 안 된다

툴은 분명히 구현돼 있다. `ext/memories/src/lib.rs:18-22`:

```rust
pub(crate) const MEMORY_TOOLS_NAMESPACE: &str = "memories";
pub(crate) const ADD_AD_HOC_NOTE_TOOL_NAME: &str = "add_ad_hoc_note";
pub(crate) const LIST_TOOL_NAME: &str = "list";
pub(crate) const READ_TOOL_NAME: &str = "read";
pub(crate) const SEARCH_TOOL_NAME: &str = "search";
```

`local/search.rs`는 176줄짜리 실동작 재귀 검색 구현이다(매칭 모드, 커서 페이징, 심볼릭 링크 거부까지). 그런데 등록 경로에 게이트가 하나 더 있다. `ext/memories/src/extension.rs:104-123`:

```rust
impl ToolContributor for MemoriesExtension {
    fn tools(...) -> Vec<Arc<dyn ...ToolExecutor...>> {
        let Some(config) = thread_store.get::<MemoriesExtensionConfig>() else { return Vec::new(); };
        if !config.enabled || !config.dedicated_tools {
            return Vec::new();
        }
        tools::memory_tools(...)
    }
}
```

그리고 `codex-rs/config/src/types.rs:340-347`의 기본값:

```rust
impl Default for MemoriesConfig {
    fn default() -> Self {
        Self {
            disable_on_external_context: false,
            generate_memories: true,
            use_memories: true,
            dedicated_tools: false,   // <-- 기본 OFF
```

`config/src/types.rs:301`의 주석도 명확하다: *When true, expose dedicated memory tools through the extension tool surface.*

**설치본 확인**: `/Users/jun/.codex/config.toml:585-587`의 `[memories]` 섹션은 `generate_memories = true`, `use_memories = true`만 있고 **`dedicated_tools` 키가 없다.** → 기본값 false 적용 → `tools()`가 빈 벡터 반환 → **`memories.search`가 툴 스키마에 존재하지 않는다.**

이게 "에이전트가 memory search를 안 쓴다"의 진짜 답이다. 프롬프트 우선순위나 비용 판단 이전에, **모델이 볼 수 있는 툴 목록에 그 툴이 없다.** 대비되는 게 `ContextContributor`(주입)는 `config.enabled`만 보고 `dedicated_tools`를 안 본다는 점이다. 즉 **"메모리를 쓰라는 지시문은 항상 들어가는데, 그 지시를 이행할 전용 툴은 기본적으로 없는" 비대칭**이 설계에 박혀 있다.

### 4-2. 2차 원인: 남은 접근 경로가 산문 지시 + 예산 문구다

전용 툴이 없으니 실제 경로는 `read_path.md`가 산문으로 시키는 shell grep뿐이다. 그런데 같은 템플릿이 곧바로 예산을 건다.

```
Quick-pass budget:

- Keep memory lookup lightweight: ideally <= 4-6 search steps before main work.
- Avoid broad scans of all rollout summaries.
```
(`ext/memories/templates/memories/read_path.md`, "Quick-pass budget" 절)

그리고 스킵 조건이 먼저 나온다.

```
- Skip memory ONLY when the request is clearly self-contained and does not need
  workspace history, conventions, or prior decisions.
- Hard skip examples: current time/date, simple translation, simple sentence
  rewrite, one-line shell command, trivial formatting.
```

문면은 "Skip ONLY when..."이라 보수적이지만, 실제 효과는 **탐색을 억제하는 방향**이다. 강한 명령형("MUST", "before answering")이 아니라 "It can save time", "Use it whenever it is likely to help" 같은 권유형이고, 판단 기준이 "likely to help"라는 모델 자체 추정에 위임돼 있다. 툴 콜이 아니라 shell 파이프라인을 직접 조립해야 하는 비용까지 겹치면, 애매한 상황에서 기본 선택은 "그냥 진행"이 된다.

대조군으로 codexclaw recall 스킬은 같은 목적을 훨씬 강한 문구로 쓴다 (`plugins/codexclaw/skills/recall/SKILL.md`):

```
description: "MUST USE for past-session recall — ..."
...
- You are about to write "I don't have context about X" — search X first.
```

"MUST USE" + 구체적 발동 조건(내가 '모르겠다'고 쓰려는 순간)까지 못박는다. 네이티브 템플릿에는 이런 트리거가 없다.

### 4-3. 3차 원인: 리콜 신호가 런타임에 존재하지 않는다

네이티브에는 "사용자가 과거를 언급했다"를 감지하는 코드가 없다. 유일하게 관련된 런타임 감지는 **사용 여부 텔레메트리**인데, 이것도 사후 계측일 뿐 유도 장치가 아니다. `memories/read/src/usage.rs:46-59`는 실행된 shell 명령 문자열을 파싱해서 경로에 `memories/MEMORY.md` 등이 있으면 카운터를 올린다.

```rust
fn get_memory_kind(path: String) -> Option<MemoriesUsageKind> {
    if path.contains("memories/MEMORY.md") {
        Some(MemoriesUsageKind::MemoryMd)
    } else if path.contains("memories/memory_summary.md") {
    ...
```

그리고 `core/src/memory_usage.rs:37-42`를 보면 이 계측은 `exec_command` 한 종류만 인식한다.

```rust
match invocation.tool_name.name.as_str() {
    "exec_command" => serde_json::from_str::<ExecCommandArgs>(arguments).ok().map(|params| params.cmd),
    _ => None,
}
```

즉 **메모리 사용 여부의 정의 자체가 "shell로 그 파일을 읽었나"**다. 이게 다시 phase-2 랭킹으로 되먹임된다: `core/src/stream_events_utils.rs:176-189`의 `record_stage1_output_usage_for_memory_citation`은 **모델이 최종 답변에 `<oai-mem-citation>` 블록을 붙였을 때만** `usage_count`를 올린다. 그리고 phase-2 SQL은 `usage_count DESC`로 정렬한다.

여기서 되먹임 함정이 생긴다. **모델이 citation을 안 붙이면 → usage_count가 안 오르고 → `max_unused_days`(기본 30일) 창을 벗어나면 phase-2 선택에서 탈락한다.** `state/src/runtime/memories.rs:470-474`:

```sql
WHERE (length(trim(so.raw_memory)) > 0 OR length(trim(so.rollout_summary)) > 0)
  AND (
        (so.last_usage IS NOT NULL AND so.last_usage >= ?)
        OR (so.last_usage IS NULL AND so.source_updated_at >= ?)
  )
```

즉 **읽기가 약하면 메모리가 실제로 소멸한다.** 리트리벌 부진이 저장소 품질 저하로 이어지는 자기강화 루프다.

### 4-4. 보조 요인: 처리량 상한과 오염 규칙

`config/src/types.rs:48-53` 기본값:

```rust
pub const DEFAULT_MEMORIES_MAX_ROLLOUTS_PER_STARTUP: usize = 2;
pub const DEFAULT_MEMORIES_MAX_ROLLOUT_AGE_DAYS: i64 = 10;
pub const DEFAULT_MEMORIES_MIN_ROLLOUT_IDLE_HOURS: i64 = 6;
pub const DEFAULT_MEMORIES_MIN_RATE_LIMIT_REMAINING_PERCENT: i64 = 25;
pub const DEFAULT_MEMORIES_MAX_RAW_MEMORIES_FOR_CONSOLIDATION: usize = 256;
pub const DEFAULT_MEMORIES_MAX_UNUSED_DAYS: i64 = 30;
```

**세션 시작당 rollout 2개**가 상한이고, 10일보다 오래된 세션은 후보에서 빠지며, 6시간 idle이어야 처리 대상이 된다. 설치본에는 12,469개 rollout이 있고 `rollout_summaries/`는 256개다 — 상한 `max_raw_memories_for_consolidation = 256`과 정확히 일치한다. **전체의 약 2%만 요약으로 남아 있고 그마저 상한에 포화 상태다.** 새 메모리가 들어오면 오래되거나 안 쓰인 것이 밀려난다.

`min_rate_limit_remaining_percent = 25`는 사용량이 많은 날에는 메모리 생성이 아예 스킵된다는 뜻이다(`memories/write/src/guard.rs:38`).

오염 규칙도 있다. `core/src/stream_events_utils.rs:133-141`:

```rust
fn response_item_may_include_external_context(item: &ResponseItem) -> bool {
    matches!(
        item,
        ResponseItem::ToolSearchCall { .. }
            | ResponseItem::ToolSearchOutput { .. }
            | ResponseItem::WebSearchCall { .. }
            | ResponseItem::FunctionCallOutput { call_id: None, .. }
    )
}
```

웹검색이나 MCP를 쓴 스레드는 `memory_mode = 'polluted'`가 되어 메모리 생성에서 제외된다. 다만 이건 `disable_on_external_context`가 true일 때만이고, **기본값은 false**이며 설치본 config.toml에도 해당 키가 없다. 그래서 현 환경에서는 이 규칙이 작동하지 않는다 — 오염은 이 설치본에서 원인이 아니다.

## 5) rollout jsonl이 있는데도 활용이 안 되는 이유

**규모**: `/Users/jun/.codex/sessions` 22GB, rollout jsonl 12,469개, archived_sessions 266개.

**네이티브의 소비 방식은 1회성이다.** `memories/write/src/phase1.rs`의 sample 함수(같은 파일 mod job 내부, 위 발췌 기준 60-95줄 구간):

```rust
let (rollout_items, _, _) = RolloutRecorder::load_rollout_items(rollout_path).await?;
let rollout_contents = serialize_filtered_rollout_response_items(&rollout_items)?;
```

**파일 전체를 읽어 모델에 한 번 던지고, 결과 텍스트만 DB에 남긴다.** 원본 jsonl에 대한 인덱스도, 이후 재조회 경로도 만들지 않는다. 검색 도구인 `ext/memories/src/local/search.rs`도 검색 대상이 `backend.root`(= `~/.codex/memories`)로 한정돼 있어서, 애초에 `sessions/`를 못 본다.

결과적으로 22GB 원본은 **read 경로에서 완전히 도달 불가**다. 유일한 연결고리는 `MEMORY.md`에 산문으로 적힌 `rollout_path=...` 문자열이고, 템플릿도 그렇게 안내한다:

```
- The paths of these entries can be found in {{ base_path }}/MEMORY.md or {{ base_path }}/rollout_summaries/ as `rollout_path`
...
- For efficient lookup, prefer matching the filename suffix or `session_meta.payload.id`; avoid broad full-content scans unless needed.
```

"broad full-content scans를 피하라"는 조언은 인덱스가 없기 때문에 나온 것이다. 22GB를 grep 하면 실제로 느리다. **인덱스 부재 → 스캔 금지 권고 → 사실상 접근 포기**의 사슬이다.

codexclaw recall은 정확히 이 지점을 사이드카로 메운다. `~/.codexclaw/recall/index.sqlite`에 **12,735 파일 / 1,213,941 메시지**가 FTS로 적재돼 있고(`cxc chat index --status`, last ingest 2026-09-08T16:59:57Z), 스킬 문서는 `--days 0` 전체 이력 질의가 "tens of milliseconds"라고 명시한다. 네이티브가 세운 "스캔은 비싸다"는 전제를 인덱스로 무너뜨린 것이다.

파일 수가 12,735로 세션 12,469 + archived 266 = 12,735와 정확히 일치한다 — 인덱스가 두 디렉터리를 모두 커버한다.

또 recall은 네이티브에 없는 **리콜 신호 감지**를 훅으로 구현한다. `components/recall/src/hook.ts:61-77`은 한국어/영어 회상 관용구를 정규식으로 잡고(`그때 그거`, `지난번`, `뭐였지`, `last time`, `what did we do` 등), 94-102줄에서 검색 명령을 직접 주입한다.

```
"[cxc-recall] The prompt references past work. Before asking the user to re-explain,",
"search prior sessions (read-only):",
```

설치본 `config.toml:613-620`에 `session-start-injecting-recall-context`, `post-compact-injecting-recall-context`, `user-prompt-submit-detecting-recall-intent` 세 훅이 등록돼 있다. 그리고 `hook.ts:5-7` 주석대로 SessionStart/PostCompact 주입은 **CWD 스코프**다 — 네이티브가 못 하는 per-project 스코핑을 훅 레이어에서 하고 있다.

---

## 원인 순위 정리

| 순위 | 원인 | 근거 | 성격 |
|---|---|---|---|
| 1 | 전용 메모리 툴이 기본 미등록 (`dedicated_tools: false`) | `config/src/types.rs:346`, `ext/memories/src/extension.rs:115`, 설치본 config.toml에 키 없음 | 설정 한 줄로 변경 가능 |
| 2 | 읽기 경로가 summary 1파일 주입뿐 | `ext/memories/src/prompts.rs:30-40`, `memories/read/src/lib.rs` 15줄 | 구조적 |
| 3 | 2,500 토큰 상한에 이미 포화 (실측 ~2,359) | `ext/memories/src/lib.rs:16` + 설치본 9,544바이트 | 임박한 손실 |
| 4 | per-project 스코핑 부재 | `state/.../memories.rs:226-228` `cwd_filters: None, project_id: None` | 구조적 |
| 5 | rollout 인덱스 부재 → 22GB 도달 불가 | `phase1.rs` 1회 소비, search backend root가 memories/로 한정 | 구조적 |
| 6 | 프롬프트가 권유형 + 탐색 예산 억제 | `read_path.md` "Quick-pass budget", "Skip memory ONLY when" | 문구 문제 |
| 7 | usage 되먹임 루프 (citation 없으면 메모리 소멸) | `stream_events_utils.rs:176-189` + phase2 SQL `usage_count DESC` + `max_unused_days=30` | 자기강화 악순환 |
| 8 | 처리량 상한 (startup당 2개, 256개 포화) | `config/src/types.rs:48-53`, 실측 rollout_summaries 256개 | 튜닝 가능 |

## 확인하지 못한 것 (unknown)

- `dedicated_tools`를 true로 켰을 때 모델이 실제로 `memories.search`를 호출하는 빈도. 정적 분석만 했고 런타임 실험은 안 함.
- per-project 스코핑을 넣지 않은 설계 의도. 소스에 주석/ADR 없음.
- `MEMORY.md`의 `cwd=` / `applies_to` 표기를 런타임이 파싱하는 코드는 검색 범위에서 발견하지 못함. "없다"고 단정하기보다 "발견 못함"으로 남긴다.
- 실제 주입된 프롬프트에서 memories 블록이 다른 developer 지시문 대비 어느 위치에 오는지. `PromptFragment::developer_policy`로 넣는 것까지만 확인했고 최종 조립 순서는 추적 안 함.
- 텔레메트리 실측치(`MEMORIES_USAGE_METRIC` 카운터 값). 로컬에서 수집 불가.
- `/Users/jun/Developer/codex/120_codex-cli/`는 이번 조사에서 비교 대상으로 열지 않았다. 121 스냅샷이 최신이라 그쪽만 근거로 삼음.

