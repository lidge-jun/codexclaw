# 090 — cli-jaw 커맨드 → codex-native 매핑

Status: TODO (서브에이전트 J1 조사 대기) · work-phase 090

상위: [090_expansion_moc.md](090_expansion_moc.md)

## 목표
cli-jaw의 운영 커맨드 표면을 codex 런타임 네이티브 기능으로 매핑한다. codexclaw는 서버가
없으므로 cli-jaw 서버 의존 커맨드는 codex-rs 시스템프롬프트/내장 도구로 대체하거나 위임한다.

## 항목별 결정 (jun, 090 MOC 기준)
| 커맨드 | 결정 | 매핑 대상 |
|--------|------|----------|
| memory | PASS | codex 내장 메모리 |
| chat search | CANDIDATE | codex-rs에 동등 구현 유무 조사 (J1) |
| task | codex todo로 대체 | codex-rs 시스템프롬프트 todo |
| bgtask | codex-rs로 구현 | codex 시스템프롬프트 등록분 추정 → 실측 |
| worker status/watch | codex-native | spawn_agent 진행조회 |
| hooks inspect | codex-native | codex hook 점검 |
| dispatch | native spawn_agent | multi-agent spawn |
| service / clone | 위임 | codex 런타임 |
| doctor / reset | 계획함 | codexclaw 자체 진단/리셋 |

## J1 조사 산출물

### 조사 범위/근거
- `cli-jaw --help` 기준 운영 표면: `dispatch`, `worker status|watch`, `orchestrate`, `goal`, `task`, `bgtask`, `memory`, `hooks inspect`, `service`, `clone`, `doctor`, `reset` 등이 노출됨.
- codex-rs 도구 라우터는 매 턴 `add_shell_tools`, `add_core_utility_tools`, `add_collaboration_tools`를 통해 모델-visible tool spec을 구성한다. 근거:
  - /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/spec_plan.rs:524
  - /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/spec_plan.rs:546
  - /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/spec_plan.rs:593
  - /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/spec_plan.rs:649
- jawcode는 이번 매핑의 “codex-native 여부” 판정 근거로 쓰지 않았다. `diagram-html`, `chart-json`, `compose-block`, `structured-renderers` 검색은 codex-rs prompt/core/tui에서 0건이었고, jawcode 검색 결과도 Codex 시스템프롬프트/내장 도구 근거가 아니라 CU/MCP/네이티브 패키지 내부 타입 수준이었다.

### 기능별 실측
| 확인 항목 | codex-rs 실측 | 호출 형태/도구명 | 판정 |
|---|---|---|---|
| task/todo | 존재. 기본 시스템 프롬프트가 `update_plan`을 TODO/checklist 도구로 설명하고, core tool spec도 `update_plan`을 등록한다. | `update_plan({ explanation?, plan: [{ step, status }] })`, `status ∈ pending/in_progress/completed`. | codex-native 대체 가능 |
| bgtask | 부분 존재. 서버 소유 `bgtask add/show/cancel`과 1:1은 아니지만 unified exec가 장기 프로세스를 `process_id`로 보존하고 `write_stdin` 빈 입력으로 poll한다. | `exec_command({ cmd, workdir?, tty?, yield_time_ms?, max_output_tokens? })` → live면 `process_id`; `write_stdin({ session_id, chars?, yield_time_ms?, max_output_tokens? })`. | codex-native 부분 대체; 서버 내구 bgtask는 자체구현 필요 |
| worker status/watch | 존재. multi-agent v2에는 live agent 목록/상태 조회와 mailbox 대기가 있다. legacy collab에도 wait가 있다. | v2: `spawn_agent`, `wait_agent`, `list_agents`, `send_message`, `followup_task`, `close_agent`; legacy: `multi_agent_v1.spawn_agent`, `multi_agent_v1.wait_agent`, `send_input` 등. | codex-native 대체 가능 |
| hooks inspect | 런타임 hook/추가 컨텍스트 주입은 존재. cli-jaw의 “pre-prompt runtime context inspect”와 가장 가까운 Codex CLI는 `codex debug prompt-input`이다. | hooks: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStart`, `SubagentStop`; debug: `codex debug prompt-input [prompt]`. | codex-native 대체 가능 |
| dispatch → spawn_agent | 존재. `spawn_agent`는 모델/role/service tier/fork 설정을 받아 child thread를 생성하고 agent id/task name을 반환한다. | v2 필수: `task_name`, `message`; 선택: `agent_type`, `model`, `reasoning_effort`, `service_tier`, `fork_turns`. legacy 필수는 없음, `message/items`와 `agent_type/model/...` 선택. | codex-native 대체 가능 |
| chat search | CLI command로는 발견 안 됨. 다만 app-server protocol에 experimental `thread/search`가 있고 `ThreadSearchParams.search_term`은 required full-text/substring query다. | app-server request: `thread/search` with `{ searchTerm, cursor?, limit?, sortKey?, sortDirection?, sourceKinds?, archived? }`. | CANDIDATE 유지; CLI/agent tool 래핑 필요 |
| diagram/html render | codex-rs 시스템프롬프트/내장 tool에서 `diagram-html`, `chart-json`, `compose-block`, `structured-renderers`, `mermaid` 근거 없음. 스킬 로딩 프레임워크는 있으나 diagram 전용 bundled skill은 이번 소스 근거에서 확인 안 됨. | 없음. | codexclaw 자체 스킬/렌더 지침 필요 |

### 근거 상세
- `update_plan`
  - 시스템 프롬프트가 `update_plan`을 “tracks steps and progress” 도구로 설명한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/protocol/src/prompts/base_instructions/default.md:54
  - 시스템 프롬프트가 `update_plan` 호출 규칙과 status 3종을 명시한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/protocol/src/prompts/base_instructions/default.md:267
  - tool spec 이름은 `update_plan`, required는 `plan`, 각 step은 `step/status`다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/plan_spec.rs:7
  - protocol type도 `UpdatePlanArgs { explanation?, plan }`, `PlanItemArg { step, status }`다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/protocol/src/plan_tool.rs:6
  - handler는 Plan mode에서 `update_plan` 사용을 막고 `EventMsg::PlanUpdate`를 발생시킨다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/plan.rs:79
- `bgtask` 후보: unified exec
  - unified exec가 켜진 shell type이면 `exec_command`와 `write_stdin`이 모델-visible로 등록된다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/spec_plan.rs:563
  - `exec_command` spec은 “returning output or a session ID for ongoing interaction”로 정의된다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/shell_spec.rs:83
  - `exec_command` 인자는 `cmd`, `workdir`, `shell`, `tty`, `yield_time_ms`, `max_output_tokens`다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/shell_spec.rs:23
  - `write_stdin` spec은 `session_id`, `chars`, `yield_time_ms`, `max_output_tokens`를 받는다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/shell_spec.rs:105
  - live process는 initial yield 전에 store되어 turn interrupt가 background process를 죽이지 않게 한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/unified_exec/process_manager.rs:413
  - live process면 tool response에 `process_id`가 남고, 종료했으면 `None`이 된다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/unified_exec/process_manager.rs:508
  - 빈 `write_stdin`은 background poll로 취급된다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/unified_exec/write_stdin.rs:80
  - 빈 poll은 더 긴 background timeout bounds를 쓴다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/unified_exec/process_manager.rs:643
  - 별도 후보인 `spawn_agents_on_csv`는 CSV 행별 worker를 생성하지만 호출이 “blocks until all rows finish”라서 cli-jaw 서버 소유 bgtask와 다르다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/agent_jobs_spec.rs:63
- multi-agent / worker
  - collab tools는 `MultiAgentV2` 또는 legacy `Collab` feature가 켜져야 등록된다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/spec_plan.rs:293
  - v2 등록 도구: `spawn_agent`, `send_message`, `followup_task`, `wait_agent`, `close_agent`, `list_agents`: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/spec_plan.rs:651
  - v2 `spawn_agent` spec은 `task_name`과 `message`가 required다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/multi_agents_spec.rs:77
  - legacy namespaced tool은 `multi_agent_v1.spawn_agent`이고 출력은 `agent_id`, `nickname`이다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/multi_agents_spec.rs:48
  - legacy handler 인자는 `message`, `items`, `agent_type`, `model`, `reasoning_effort`, `service_tier`, `fork_context`다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/multi_agents/spawn.rs:218
  - `wait_agent`는 `targets`, `timeout_ms`를 받고 final status를 기다린다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/multi_agents/wait.rs:51
  - v2 `list_agents`는 live agents를 list하고 `path_prefix` filter를 지원한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/tools/handlers/multi_agents_spec.rs:259
- hooks / prompt inspect
  - hook outcome은 `should_stop`과 `additional_contexts`를 가진다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/hook_runtime.rs:49
  - `SessionStart`/`SubagentStart` hook request와 preview/run 경로가 있다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/hook_runtime.rs:100
  - `PreToolUse` hook은 block/updated_input/additional_contexts를 처리한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/hook_runtime.rs:155
  - `PostToolUse` hook은 tool_input/tool_response를 stable contract로 전달한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/hook_runtime.rs:255
  - root는 `Stop`, thread-spawned child는 `SubagentStop` hook을 실행한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/hook_runtime.rs:294
  - `UserPromptSubmit`는 pending input inspect 단계에서 실행된다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/hook_runtime.rs:497
  - hook additional contexts는 developer messages로 기록된다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/hook_runtime.rs:584
  - Codex CLI에는 “Render the model-visible prompt input list as JSON”인 `debug prompt-input`이 있다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/cli/src/main.rs:211
  - `debug prompt-input`은 `build_prompt_input(..., state_db: None)` 결과를 pretty JSON으로 출력한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/cli/src/main.rs:1701
- chat search
  - Codex CLI top-level subcommands에는 `Resume`/`Fork`는 있지만 `Search`/`ChatSearch`는 없다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/cli/src/main.rs:116
  - `Resume`/`Fork`는 picker/last/session id 기반으로 TUI를 실행한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/cli/src/main.rs:1099
  - app-server protocol에는 experimental `thread/search` request가 있다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/app-server-protocol/src/protocol/common.rs:572
  - `ThreadSearchParams.search_term`은 required substring/full-text query다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/app-server-protocol/src/protocol/v2/thread.rs:1022
  - `ThreadSearchResponse`는 `ThreadSearchResult { thread, snippet }` 배열을 반환한다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/app-server-protocol/src/protocol/v2/thread.rs:1103
- diagram/html 렌더
  - codex-rs prompt/core/tui에서 `diagram-html`, `chart-json`, `compose-block`, `structured-renderers`, `mermaid`는 검색 결과 0건이었다.
  - Codex는 일반 skill 로딩/주입 프레임워크는 있다: /Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/session/mod.rs:2743
  - 다만 이번 조사 소스에서 diagram/html 전용 시스템프롬프트나 built-in renderer tool은 확인되지 않았다.

### cli-jaw 커맨드별 판정표
| cli-jaw 커맨드 | Codex 매핑 | 판정 | 근거/비고 |
|---|---|---|---|
| `memory` | Codex 내장 memory/skills 메모리와 별도 검토 필요 | CANDIDATE | 본 J1 범위의 핵심 7항목 밖. 기존 MOC의 PASS는 유지하되 별도 실측 필요 |
| `chat search` | app-server `thread/search` | CANDIDATE | 프로토콜은 존재하나 CLI 명령/agent tool은 미확인. codexclaw wrapper 필요 가능성 높음 |
| `task` | `update_plan` | codex-native 대체 가능 | TODO/checklist tool로 충분 |
| `bgtask` | `exec_command` + `write_stdin` poll | 부분 대체 / 자체구현 필요 | 현재 turn/session live process 상호작용은 가능. cli-jaw처럼 서버가 재호출하는 durable bgtask는 별도 필요 |
| `worker status` | `list_agents` | codex-native 대체 가능 | live agent status 조회 |
| `worker watch` | `wait_agent` | codex-native 대체 가능 | mailbox/final status 대기 |
| `hooks inspect` | `codex debug prompt-input` + hook additional_contexts | codex-native 대체 가능 | pre-prompt/model-visible input JSON 점검 가능 |
| `dispatch` | `spawn_agent` (+ `send_message`/`followup_task`) | codex-native 대체 가능 | multi-agent v2/legacy collab 도구 존재 |
| `service` | `codex app-server daemon start|stop|...`, `codex remote-control ...` | 위임 | Codex 런타임 서비스 관리로 넘김 |
| `clone` | `codex resume`/`fork` 및 Codex app-server thread model | 위임 | jaw instance clone과 1:1은 아니므로 Codex runtime/session 모델로 위임 |
| `doctor` | `codex doctor` + codexclaw plugin health checks | codexclaw 자체구현 필요 | Codex 설치 진단은 위임 가능하지만 codexclaw hook/skill/agent config 검사는 플러그인 고유 영역 |
| `reset` | Codex config/plugin reset 일부 위임 + codexclaw state cleanup | codexclaw 자체구현 필요 | codexclaw PABCD state, generated skill/hook files, GUI/subagent config 정리는 자체 구현 필요 |
| `diagram/html render` | 없음 | codexclaw 자체구현 필요 | diagram/html 전용 renderer prompt/tool 미확인. codexclaw skill/renderer 지침으로 제공해야 함 |

### 결론
- `task`, `dispatch`, `worker status/watch`, `hooks inspect`는 codex-native로 매핑한다.
- `bgtask`는 “장기 터미널 프로세스 poll”은 codex-native지만 “서버 소유 재호출/완료 알림”은 Codex 내장 근거가 없으므로 codexclaw 자체 구현 후보로 남긴다.
- `chat search`는 `thread/search` 프로토콜 근거가 있어 CANDIDATE로 유지하되, CLI/agent-facing wrapper가 없으면 codexclaw 자체 래퍼가 필요하다.
- `diagram/html render`, codexclaw 전용 `doctor/reset`은 자체 구현으로 남긴다.
