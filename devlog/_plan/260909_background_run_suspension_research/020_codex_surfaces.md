# 020 — Codex 쪽 대기 표면 (wp3)

경로는 모두 `/Users/jun/Developer/codex/121_openai-codex/codex-rs` 기준. 별도 표시가 없으면 메인이 직접 열어 확인했다.
표면마다 네 가지를 기록한다. 종류(모델 도구 / 호스트 Op / 클라이언트 RPC), 기본 활성 여부, 호출자, 대기 중 부모 턴 생존.

## 요약 표

| # | 표면 | 종류 | 기본 | 호출자 | 대기 중 부모 턴 |
|---|---|---|---|---|---|
| 1 | `exec_command` / `write_stdin` | 모델 도구 | on | 모델 | 살아 있음 (도구 호출만 yield) |
| 2 | `spawn_agent` | 모델 도구 | on | 모델 | 살아 있음, 자식은 별도 스레드 |
| 3 | `wait_agent` V1 | 모델 도구 | on | 모델 | 살아 있음, 툴콜이 블로킹 |
| 3b | `wait_agent` V2 | 모델 도구 | **off** (`multi_agent_v2` default_enabled false, `features/src/lib.rs:1265-1272`) | 모델 | 살아 있음 |
| 4 | `clock.sleep` | 모델 도구 | **off** | 모델 | 살아 있음, 최대 12시간 |
| 5 | `wait_for_environment` | 모델 도구 | **off** (`Feature::DeferredExecutor` 필요, `spec_plan.rs:1146-1156`) | 모델 | 살아 있음, 다른 도구 차단 |
| 6 | code-mode `exec` / `wait` | 모델 도구 | **off** (`Feature::CodeMode` default_enabled false, `features/src/lib.rs:1011-1014`) | 모델 | 살아 있음, JS 셀만 재부착 |
| 7 | `awaiter` 역할 | 에이전트 역할 | **제거됨** | — | — |
| 8 | `SuspendTurnAndShutdown` / `RecoverTurn` | 호스트 Op | 내부 | 워커/핸드오프 | 턴 태스크는 취소되고 워커가 내려감. 턴 ID는 남아 다른 워커가 회수 가능 |
| 9 | `turn/steer`, `thread/resume`, `thread/fork`, `thread/backgroundTerminals/*` | 클라이언트 RPC | 일부 experimental | 앱/TUI | 경우별 |
| 10 | `cloud-tasks`, 앱 MCP `wait_threads` | CLI / MCP 도구 | 별개 표면 | 사용자/모델 | 살아 있음 |

핵심: **부모 턴이 죽지 않은 채로 대기하는 표면은 많고, 부모 턴을 살려 둔 채 워커만 내려놓는 표면은 없다.** 8번만 턴을 멈추는데, 그건 프로세스 전체를 내리는 핸드오프다.

## 1. unified_exec — 백그라운드 셸 세션

`core/src/unified_exec/mod.rs:149-174`가 세션 스코프 `ProcessStore`를 들고, `core/src/state/service.rs:52`가 그걸 `SessionServices`에 붙인다. 프로세스 상한은 세션당 64개(`mod.rs:82`).

`exec_command`는 `yield_time_ms`(250ms~30s, `mod.rs:73-77`)만 기다린 뒤 살아 있으면 `session_id`를 돌려주고 프로세스를 남긴다. 이후 `write_stdin`에 빈 `chars`를 주면 폴링이고, 빈 폴링은 5초~5분이다(clamp는 `process_manager.rs:955`, 기본 상한 필드 `background_terminal_max_timeout`는 `config/mod.rs:1046`, 기본값 300000).

프로세스가 턴을 넘어 사는 것은 의도된 설계다. `process_manager.rs:567`의 주석이 이유를 적는다. "Persist live sessions before the initial yield wait so interrupting the turn cannot drop the last Arc and terminate the background process." 인터럽트 후 모델에게 주는 안내도 같은 말을 한다(`core/src/context/turn_aborted.rs:10-11`): "Any running unified exec processes may still be running in the background."

전부 종료되는 지점은 세션 shutdown과 명시적 clean 두 곳뿐이다.

한계: **모델이 볼 수 있는 세션 목록 도구가 없다.** 목록은 `list_processes()` → 클라이언트 RPC `thread/backgroundTerminals/list`로만 나가고 슬래시 커맨드 `/ps`가 그걸 쓴다. 컨텍스트가 압축되면서 `session_id`가 히스토리에서 사라지면 모델은 그 프로세스를 다시 붙잡을 수단이 없다. compaction 경로에 unified_exec 참조는 없다(L2 확인, 메인 미재검증).

## 2~3. 서브에이전트 — spawn과 wait

`spawn_agent`는 새 `CodexThread`를 만들고 초기 입력을 보낸 뒤 즉시 `agent_id`를 반환한다. 자식은 별도 스레드에서 자기 턴을 돌린다. **부모가 자기 턴을 끝내도 자식은 계속 돈다.**

완료 알림 경로가 둘로 갈린다.
- V1: spawn 직후 detached watcher가 붙고, 자식이 최종 상태가 되면 `inject_fragment_without_turn`으로 부모 히스토리에 `<subagent_notification>`을 넣는다(`core/src/codex_thread.rs:629-635`). 이름 그대로 **새 턴을 열지 않는다.**
- V2: 자식의 `TurnComplete`/`TurnAborted`가 부모에게 `InterAgentCommunication`을 `trigger_turn = false`로 보낸다(`core/src/session/mod.rs:2299`).

즉 **자식이 끝나도 부모의 새 턴은 자동으로 열리지 않는다.** 알림은 히스토리와 메일박스에 쌓여 있다가, 부모가 다음에 무언가로 턴을 열 때 함께 들어간다. 이것이 사용자가 느낀 불편의 코드상 위치다.

예외가 하나 있다. `core/src/tasks/mod.rs:412-418`의 `has_outstanding_durable_sleep`다. 스레드에 `SleepItem`이 붙어 있으면, `trigger_turn`이 없는 메일조차 유휴 세션의 새 턴을 열 수 있다(`:439-450`, 주석: "Queue-only mail wakes durable sleep without selecting a new task's settings"). 이것이 Codex 안에서 "자고 있다가 메일이 오면 깨어난다"에 가장 가까운 기계다.
**그러나 이 체크아웃에서 `SleepItem`을 `thread_store`에 넣는 곳은 테스트뿐이다**(`core/tests/suite/pending_input.rs:494`). `core/src/tools/handlers/sleep.rs:101`의 `SleepItem`은 화면 표시용 `TurnItem`이지 durable 마킹이 아니다. 즉 확장이 꽂을 수 있는 훅은 있고, 꽂는 확장은 이 트리에 없다.

`wait_agent`는 두 버전이 다르다.
- V1: 대상이 최종 상태가 될 때까지 부모 툴콜을 붙잡는다. 첫 최종 상태에서 break한다. `Interrupted`는 최종이 아니다(`core/src/agent/status.rs:26-31`).
- V2: 대상 인자가 없다. 살아 있는 에이전트의 메일박스 갱신이나 사용자 steering을 기다린다. 스펙 원문(`multi_agents_spec.rs:283`): "Wait for a mailbox update from any live agent... The wait also ends early when new user input is steered into the active turn."

동시성 기본값은 V1 스레드 6개, V2 세션당 4슬롯(부모 포함이라 자식 상한은 3), 깊이 1이다(`core/src/config/mod.rs:233-243`). Claude의 기본 20과 깊이 3에 비해 좁다.

## 4. clock.sleep — 블로킹 대기, 기본 꺼짐

`core/src/tools/handlers/sleep.rs`. 설명 원문: "Pause execution for a specified duration. The sleep ends early when new input arrives for the active turn." 최대 12시간(`MAX_SLEEP_DURATION_MS = 12*60*60*1000`).

노출은 `ToolExposure::DirectModelOnly`이고, `CurrentTimeReminderConfig`의 `sleep_tool` 기본값이 `false`다(`core/src/config/mod.rs:1258-1276`). 켜져 있어도 턴은 살아 있다. 컨텍스트와 워커를 12시간까지 점유할 수 있다는 뜻이다.

## 5. wait_for_environment

`core/src/tools/handlers/wait_for_environment.rs:19` 설명 원문에 "Waiting may take several minutes and blocks other tool calls"라고 적혀 있다. 다른 도구 호출을 막는다고 명시적으로 말하는 표면은 이것뿐이지만, 블로킹 자체를 설명에 드러내는 도구는 더 있다. `clock.sleep`의 "Pause execution for a specified duration"(`sleep.rs:50`), V2 `wait_agent`의 "Wait for a mailbox update..."(`multi_agents_spec.rs:283`).
등록 조건은 호스트 제공만이 아니다. `Feature::DeferredExecutor`가 켜져야 등록된다(`core/src/tools/spec_plan.rs:1146-1156`).

## 6. code-mode exec / wait

`code-mode-protocol/src/lib.rs:51-52`가 도구 이름 `exec`와 `wait`를 정의하고, `code-mode-runtime/src/service.rs:121-160`의 `wait`/`begin_wait`가 셀을 끝내지 않은 채 다시 관찰한다.
재부착 대상은 **JS 셀**이지 턴이 아니다. 셀이 살아 있는 동안에도 모델은 턴 안에서 계속 돈다. 이 리서치 자체가 그 위에서 돌아갔다.

## 7. awaiter — 있었다가 제거된 대기 전용 역할

`core/assets/agent/builtins/awaiter.toml`은 지금도 저장소에 있다. 내용은 "You are an awaiter. Your role is to await the completion of a specific command or task and report its status only when it is finished"이고, "If the task is still running, continue polling using tool calls", "Use long timeouts... increase the timeouts/yield times exponentially"까지 적혀 있다. `background_terminal_max_timeout = 3600000`(1시간)도 포함한다.

그런데 `core/src/agent/role.rs:383`에 `// Awaiter is temp removed`라는 주석과 함께 등록 블록 전체가 주석 처리되어 있다. 내장 역할은 `default`, `explorer`, `worker`뿐이다.

이것이 이 조사에서 가장 강한 음수 증거다. "긴 작업을 대신 기다려 주는 서브에이전트"는 Codex가 만들었다가 껐다. 주석에 남은 원래 지침은 이렇게 시작한다. "Use an awaiter agent EVERY TIME you must run a command that will take some very long time... When an awaiter is running, you can work on something else."

## 8. 턴 서스펜션 — 있지만 목적이 다르다

`core/src/session/turn_suspension.rs`의 `suspend_turn_and_shutdown`이 유일하게 진행 중인 턴을 멈춘다. `protocol/src/turn_input.rs:20-28`의 결과 타입은 `Suspended{turn_id}`, `NotActive`, `HasLiveDescendants`, `UnsupportedTask`다.

무엇을 하는가. 종료 이벤트를 기록하지 **않고** 태스크를 취소한 뒤(`:70-72` 주석: "Normal shutdown records a terminal turn event, preventing another worker from recovering this turn under its original ID. Cancel the task without that event."), 히스토리를 flush하고 writer를 닫고 세션 런타임을 내린다. 그러면 다른 워커가 `RecoverTurn`으로 같은 turn ID를 회수한다(`core/src/codex_thread.rs:353-361`: "Recovery starts no new user input and preserves the turn ID").

왜 사용자가 원하는 것이 아닌가. 세 가지 이유가 코드에 있다.
1. **살아 있는 자손이 있으면 거절한다.** `:37`에서 `HasLiveDescendants`로 조기 반환한다. 백그라운드 작업을 추적하려고 서스펜드하는 것 자체가 금지된 조합이다.
2. **대기 상태가 아니라 종료다.** in-process 태스크는 `cancellation_token.cancel()`로 취소되고, 워커 프로세스의 세션 런타임이 내려간다.
3. **pending input과 waiter를 버린다.** `:97-98` 주석: "Pending accepted input and interactive waiters live only in this process. Handoff intentionally drops that state; persisting or replaying it needs a separate protocol."

프로토콜 레벨에도 pause 개념이 없다. `app-server-protocol/src/protocol/v2/turn.rs:32-38`의 `TurnStatus`는 `Completed | Interrupted | Failed | InProgress` 넷뿐이다.

## 9. 클라이언트 RPC

`turn/steer`(`common.rs:1028`)는 활성 턴에 입력을 넣는다. 이게 `wait_agent`와 `clock.sleep`을 깨우는 경로다.
`thread/resume`은 저장되거나 실행 중인 스레드에 클라이언트를 다시 붙이는 것이고, `thread/fork`(`common.rs:564`)는 분기다.
`thread/backgroundTerminals/`는 `clean`, `list`, `terminate` 셋 다 `#[experimental]`이다(`common.rs:716-732`). TUI 슬래시 커맨드 `/ps`와 `/stop`이 여기에 붙는다.

## 10. 인접 표면

`cloud-tasks` CLI는 `exec`로 원격 작업을 제출하고 `status`/`list`/`diff`/`apply`로 조회한다. 로컬 턴을 멈추지 않고 별도 작업을 시작하는 것이다.
앱 MCP `wait_threads`(`tui/src/dynamic_tools.rs:179, 832-852`)는 다른 태스크의 완료를 현재 턴에서 기다린다. 호출 태스크 자신은 대상이 될 수 없다. 이것도 블로킹 대기다.

## 11. 인접하지만 다른 축

`request_user_input`은 실험적 블로킹 도구이고 `request_user_input_async`는 즉시 반환한다(`core/src/tools/spec_plan.rs:1158-1166`). 사용자 응답을 기다리는 것이라 백그라운드 작업 추적과는 다른 축이지만, "턴을 붙잡는 대기" 목록에는 들어간다.
`thread_unload_delay`(`core/src/config/mod.rs:1049`)는 유휴 스레드를 메모리에서 내리는 설정이다. 핸드오프와 인접하지만 대기 도구는 아니다.

## 12. 부재 확인 (검색어와 매치 수)

로드맵의 증거 규칙에 따라, 무엇을 어떤 이름으로 찾았는지와 매치 수를 남긴다. codex-rs 트리 기준.

- turn/pause|turn/resume RPC → 매치 0건
- Paused in TurnStatus → 매치 0건
- model-visible list of exec sessions → 매치 0건
- run_in_background arg → 매치 1건 (TUI 종료 액션 테스트. 13절 참조. Claude식 도구 인자는 아니다)
- auto-background on timeout → 매치 0건
- monitor tool → 매치 0건
- park/suspend parent turn → 매치 0건

읽는 법. 턴 자체를 일시정지하는 RPC와 `TurnStatus::Paused`는 없다. 모델이 부를 수 있는 exec 세션 목록 도구가 없다(매치는 전부 core/src/tools 밖의 클라이언트 경로). Claude의 `run_in_background` 인자, 타임아웃 자동 백그라운드 전환, Monitor에 해당하는 것도 없다. 부모 턴을 park하는 이름도 없다.
`spawn_agent`가 사실상 Codex의 백그라운드 실행 단위이지만, 그건 셸 명령이 아니라 에이전트다. 셸을 백그라운드로 두는 것은 `exec_command`의 yield 반환이고, 그건 인자가 아니라 시간이 정한다.

## 13. TUI의 Run in background — Codex에 실재하는 detach

이건 처음 세운 10개 목록에 없었다. 부재 검색 중 `run_in_background`가 codex-rs에 딱 1건 걸려서 찾았다.

실행 중인 태스크를 두고 종료하려 하면 TUI가 세 선택지를 띄운다(`tui/src/app/input.rs:362-390`).

- "Cancel task" — Stop the current task and stay in Codex
- "Run in background" — **Exit Codex and leave the task running**
- "Exit" — Stop the current task and exit Codex

"Run in background"은 `allow_background`가 참일 때만 보인다. 조건은 실행 중인 side thread가 없고 큐에 쌓인 후속 메시지가 없을 것.
동작은 `ExitMode::Immediate`로 나가는 것뿐이다(`tui/src/app/event_dispatch.rs:695-697`). 인터럽트를 보내지 않으므로 데몬 쪽 스레드는 계속 돈다. 테스트 이름이 계약을 그대로 말한다. `run_in_background_detaches_without_interrupting_main_or_side_threads`(`tui/src/app/tests/background_exit_tests.rs:274`).

goal 관점에서 결정적인 차이가 여기 있다. **세 선택지 중 "Run in background"만 goal을 pause하지 않는다.**
- Cancel task → `pause_active_goal_for_interrupt()`
- Exit → `thread_goal_set(..., Paused, ...)`
- Run in background → 아무것도 하지 않음

즉 Codex에서 "런을 두고 나간다"는 것은 이미 가능하다. 다만 그것은 **TUI를 나가는 것**이지, 대화 안에서 턴을 대기 상태로 두는 것이 아니다. 그리고 이 경로로 나가면 goal은 Active로 남아 데몬이 계속 새 턴을 연다.

## goal 쪽 사실 (wp4 충돌 분석의 입력)

- 상태 집합은 `active | paused | blocked | usage_limited | budget_limited | complete`다(`state/goals_migrations/0001_thread_goals.sql:1-17`).
- `update_goal`로 에이전트가 쓸 수 있는 것은 `complete`와 `blocked`뿐이다. 원문(`ext/goal/src/tool.rs:244`): "pause, resume, budget-limited, and usage-limited status changes are controlled by the user or system".
- 자동 연속은 `on_thread_idle` → `continue_if_idle` → `start_turn_if_idle`이고, `turn_trigger = "goal"`인 **새 턴**을 연다(`ext/goal/src/runtime.rs:398-458`). 같은 턴을 잇는 것이 아니다.
- `thread_goal_continuation_deferrals` 테이블이 연속을 한 번 건너뛰게 한다. goal 생성 시 삽입되고(`state/src/runtime/goals.rs:111`) 턴 시작 시 지워진다(`ext/goal/src/extension.rs:235`).
- 서스펜션이 `emit_thread_stop_lifecycle`을 내면 goal의 `on_thread_stop`이 런타임을 unregister한다(`ext/goal/src/extension.rs:190-196`).
- 공식 cookbook 문장(Aside 확인): "Interruptions pause the objective." 그리고 continuation은 스레드가 유휴일 때만 일어난다.

## 상류에 이미 올라온 이슈

사용자가 느낀 불편은 openai/codex에 이미 보고되어 있다. Aside가 `gh`로 직접 조회한 결과다.

| 번호 | 제목 | 상태 |
|---|---|---|
| #15723 | Background subprocesses/subagents do not wake the calling agent on completion | OPEN, 댓글 21, bug/subagent |
| #22003 | Support injecting command output from background completion into the active Codex session | OPEN, enhancement/session |
| #42908 | Desktop agent is not resumed when a background exec session completes | OPEN, app/app-server/enhancement/tool-calls |
| #14318 | Race condition between subagent async notification and main agent turn lifecycle | CLOSED |
| #22099 | Parallel-first subagents and nonblocking background task management | OPEN, 엄브렐러 |
| #36141 | Parent turn completes while newly spawned child agent is still pendingInit | OPEN |
| #17737 | Feature request: Claude Code-like /monitoring for background terminals | OPEN |
| #3968 | Background Terminal Sessions | CLOSED |
| #34279 | Allow switching away from active CLI sessions while their turns keep running | CLOSED |
| #38177 | macOS: pausing a Goal leaves the thread active/inProgress and sidebar spinner running | OPEN |

#15723의 기대 동작이 사용자 질문과 같은 문장이다. 긴 백그라운드 작업이 끝나면 에이전트가 통보받아 자율적으로 이어서 행동해야 한다는 것.

