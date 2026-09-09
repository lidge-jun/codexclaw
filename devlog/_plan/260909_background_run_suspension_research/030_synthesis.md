# 030 — 매핑, goal 충돌, 설계 옵션 (wp4)

## 1. 결론 먼저

**Codex에는 "현재 런을 중지하고 대기한 채로 추적"하는 1급 기능이 없다.** 그리고 Claude에도 그 형태로는 없다.
차이는 park의 유무가 아니라 **깨어나는 방식**에 있다.

- Claude: 자식/셸을 백그라운드로 띄우면 부모는 턴을 끝내고 자유로워진다. 완료는 completion notification으로 **다음 턴에 스스로 돌아온다**. 문서 원문: "A background subagent's results reach Claude as a completion notification in a later turn."
- Codex: 자식/셸을 백그라운드로 띄우면 부모는 마찬가지로 자유로워진다. 그런데 완료 알림이 **새 턴을 열지 않는다**. V1은 `inject_fragment_without_turn`, V2는 `trigger_turn = false`다. 알림은 히스토리와 메일박스에 조용히 쌓여 있다가, 부모가 다른 이유로 턴을 열 때 비로소 읽힌다.

그래서 Codex에서 백그라운드 작업을 추적하려면 부모가 턴을 붙잡은 채 기다리는 수밖에 없다. `wait_agent`, `clock.sleep`, `write_stdin` 폴링이 전부 그 형태다. 사용자가 불편하다고 한 heartbeat는 그 회피책이다. 턴을 끝내고 외부 스케줄러로 다시 들어오는 것.

이 진단은 상류에서도 같은 문장으로 보고되어 있다. openai/codex #15723 "Background subprocesses/subagents do not wake the calling agent on completion" (OPEN, 댓글 21), #22003, #42908.

## 2. Claude 기준선 ↔ Codex 대응

| # | Claude 기준선 | Codex 대응 | 판정 |
|---|---|---|---|
| 1 | 셸 백그라운드 실행, 부모 계속 진행 | `exec_command`가 yield 후 `session_id` 반환, 프로세스 생존 | 있음 (형태 다름: 인자가 아니라 시간이 결정) |
| 2 | 타임아웃 시 자동 백그라운드 전환 | `exec_command`의 `yield_time_ms`가 끝나면 프로세스를 남기고 `session_id`를 반환(`mod.rs:73-77`, `process_manager.rs:566-567`). 1행과 같은 기계다 | 있음 (감사에서 정정) |
| 3 | 실행 중 전경 작업을 사후 백그라운드로 (Ctrl+B) | 없음. TUI `Run in background`는 프로세스를 나가는 것 | 부분 (레벨이 다름) |
| 4 | 세션 내 작업 목록 UI, attach/stop (`/tasks`) | `/ps`, `/stop` + `thread/backgroundTerminals/*` (experimental). **모델용 목록 도구는 없음** | 부분 (사람만 볼 수 있음) |
| 5 | Monitor — 스트림 기반 추적, 대화 중단 없이 반응 | 없음 (매치 0). 요청은 이슈 #17737 | 없음 |
| 6 | 서브에이전트 기본 백그라운드, 부모 턴 비블로킹 | `spawn_agent`가 즉시 반환, 자식은 별도 스레드 | 있음 |
| 7 | 자식 완료가 다음 턴 입력으로 자동 재진입 | **없음.** `trigger_turn = false` / `inject_fragment_without_turn` | **없음 — 핵심 격차** |
| 8 | 터미널을 떼도 사는 detached 세션 | TUI `Run in background`로 종료 시 데몬 스레드 유지 | 있음 (대화 레벨 아님) |
| 9 | 세션 저장/재개/fork | `codex resume`, `thread/resume`, `thread/fork` | 있음 |
| 10 | 도구 호출 보존 후 프로세스 종료·재개 (PreToolUse defer) | 없음. 가장 가까운 `SuspendTurnAndShutdown`은 워커 핸드오프이고 살아 있는 자손이 있으면 거절 | 없음 |
| 11 | Stop 훅으로 "멈추지 말고 한 턴 더" | goal 자동 연속이 기능적으로 대응 (다만 사용자/시스템만 제어) | 있음 (다른 축) |
| 12 | 입력으로 깨는 블로킹 sleep | `clock.sleep` (기본 off, 최대 12시간) | 있음 (기본 꺼짐) |
| 13 | 실행 중 에이전트에 메시지 붙이기 | `send_input`(V1), `send_message`/`followup_task`(V2) | 있음 |
| 14 | 수명 내내 running인 teammate | V2 residency로 로드된 자식 유지 | 부분 |
| 15 | detached supervisor와 in-process 백그라운드의 구분 | 데몬 스레드 vs 세션 스코프 프로세스로 구분됨 | 있음 |

## 3. Codex 표면의 4범주 분류

| 표면 | 범주 |
|---|---|
| `exec_command` 반환 후 프로세스 생존 | 백그라운드 병행 |
| `spawn_agent` | 백그라운드 병행 |
| TUI `Run in background` 종료 | 백그라운드 병행 (프로세스 레벨) |
| `write_stdin` 빈 폴링 | 블로킹 대기 |
| `wait_agent` V1/V2 | 블로킹 대기 |
| `clock.sleep` | 블로킹 대기 |
| `wait_for_environment` | 블로킹 대기 |
| code-mode `wait` | 블로킹 대기 (셀 단위) |
| 앱 MCP `wait_threads` | 블로킹 대기 |
| `request_user_input` | 블로킹 대기 |
| goal 자동 연속 | 턴 종료 후 재진입 |
| heartbeat / automation | 턴 종료 후 재진입 (사용자가 배제) |
| durable sleep 훅 (`SleepItem`) | 턴 종료 후 재진입 — **프로덕션 생산자 없음** |
| `SuspendTurnAndShutdown` / `RecoverTurn` | 서스펜션 (워커 핸드오프 전용) |
| `awaiter` 역할 | 백그라운드 병행이었으나 **제거됨** |

빈 칸이 어디인지가 답이다. "대기하지만 턴을 붙잡지 않고, 완료가 스스로 깨우는" 칸이 비어 있다.

## 4. goal 충돌 — 로드맵이 고정한 네 질문

**Q1. 블로킹 대기가 턴을 붙잡는 동안 idle 훅이 도는가.**
돌지 않는다. `core/src/tasks/mod.rs:843-856`이 active turn이 비워졌을 때만 `emit_thread_idle_lifecycle_if_idle`을 부른다. `wait_agent`나 `clock.sleep`이 턴을 잡고 있으면 턴은 활성이므로 goal은 개입하지 않는다.
→ 블로킹 대기는 goal과 충돌하지 않는다. 대신 컨텍스트와 워커를 그 시간만큼 태운다.

**Q2. 턴이 끝나면 continuation이 곧바로 새 턴을 켜는가.**
켠다. `ext/goal/src/extension.rs:175-186`의 `on_thread_idle`이 idle 원인을 보지 않고 `continue_if_idle()`을 부른다. `ThreadIdleCause`는 `Completed | Interrupted | Failed`인데 셋 다 같은 처리다. `runtime.rs:399-458`이 deferral이 없고 상태가 Active면 `start_turn_if_idle`로 `turn_trigger = "goal"`인 새 턴을 연다.
→ **이것이 정확히 사용자가 예상한 충돌이다.** goal이 활성인 동안 "조용히 기다리려고 턴을 끝내는" 것은 불가능하다. 턴을 끝내는 순간 goal이 새 턴을 연다. goal은 유휴를 없애려고 만든 기계이고, 대기는 유휴다.

빠져나갈 구멍은 `thread_goal_continuation_deferrals` 하나뿐인데, 그마저 에이전트가 닿을 수 없다.
감사에서 정정: 이 INSERT는 `replace_thread_goal_snapshot` 안에만 있고(`state/src/runtime/goals.rs:68-118`), 호출자는 fork 상속 한 곳뿐이다(`app-server/src/request_processors/thread_fork_goal.rs:5-26`). 에이전트의 `create_goal`은 `insert_thread_goal`을 쓰고 deferral을 넣지 않으며(`ext/goal/src/tool.rs:203-211`), API `replace_thread_goal`도 넣지 않는다(`goals.rs:156-211`). 지우는 곳은 턴 시작 하나뿐이다(`ext/goal/src/extension.rs:232-235`).
즉 deferral은 fork된 스레드가 즉시 폭주하지 않게 하는 일회성 장치이고, **에이전트에게 이걸 세우는 도구는 없다.** `update_goal`은 원문 그대로 거절한다: "pause, resume, budget-limited, and usage-limited status changes are controlled by the user or system"(`ext/goal/src/tool.rs:244`).

**Q3. 서스펜션이 세션을 내릴 때 goal runtime은 어떻게 되는가.**
서스펜션은 `emit_thread_stop_lifecycle`을 낸다(`turn_suspension.rs:107-114`). goal의 `on_thread_stop`이 런타임을 unregister한다(`ext/goal/src/extension.rs:190-196`). 재개 시 `restore_after_resume`이 DB 상태가 Active면 다시 활성으로 표시한다(`runtime.rs:375-396`).
→ goal은 서스펜션을 견디도록 설계돼 있다. 다만 서스펜션 자체가 살아 있는 자손이 있으면 거절되므로(`HasLiveDescendants`), 백그라운드 추적 용도로는 쓸 수 없다.

**Q4. goal의 steering 주입이 블로킹 대기를 깨우는가.**
깬다. goal은 예산 한도 상황에서 `inject_active_turn_steering`으로 활성 턴에 아이템을 넣는다(`ext/goal/src/extension.rs:488`). V2 `wait_agent`는 steered input에 조기 종료하고(`multi_agents_spec.rs:283`), `clock.sleep`도 "The sleep ends early when new input arrives for the active turn"이다(`sleep.rs:50`).
→ 긴 블로킹 대기는 goal의 예산 steering에 의해 예고 없이 끊길 수 있다. 다만 이 주입은 예산 한도 상황에서만 일어난다(`ext/goal/src/extension.rs:478-488`). 일상적인 continuation이 대기를 끊지는 않는다.

**종합.** goal이 활성인 동안 가능한 대기는 블로킹 대기뿐이고, 그것도 steering에 깨질 수 있다. 턴을 끝내고 조용히 기다리는 선택지는 goal이 구조적으로 막는다. TUI `Run in background`로 나가도 goal은 Paused가 되지 않으므로 데몬이 계속 새 턴을 연다.

## 5. 설계 옵션

### Weak — 지금 있는 것만으로 (코드 변경 0)

goal의 자동 연속을 **대기 메커니즘으로 전용**한다. 부모는 자식을 띄우고 턴을 끝낸다. goal이 새 턴을 열어 주면 그 턴 첫머리에서 `wait_agent`를 짧게 호출하거나 메일박스 알림을 읽는다.
- 장점: 지금 당장 된다. 이 세션이 실제로 그렇게 돌았다.
- 단점: 폴링 한 번이 턴 하나다. 토큰이 든다. goal이 없으면 성립하지 않는다.

대안으로 `wait_agent`에 긴 타임아웃(V2 최대 1시간)을 주고 한 턴 안에서 버티는 방법이 있다. 턴 하나로 끝나 토큰은 아끼지만, 그동안 컨텍스트와 워커가 묶이고 goal steering에 끊길 수 있다.

### Medium — codexclaw 레이어에서 (Codex 본체 무변경)

로컬 백그라운드 작업 레지스트리를 두고, goal continuation 프롬프트에 "완료된 백그라운드 작업" 목록을 실어 보낸다. cli-jaw의 `bgtask`와 openclaw의 task registry가 이미 그 형태다. 깨우는 것은 goal이고, 무엇 때문에 깼는지를 알려 주는 것은 codexclaw다.
- 장점: 상류 변경 없이 "완료가 스스로 돌아온다"는 감각을 만든다. 알림 내용이 구조화된다.
- 단점: 여전히 goal에 의존한다. goal 없는 대화에서는 안 된다. 그리고 codexclaw가 Codex의 알림 경로를 이중화하게 된다.

### Strong — 상류 변경 (이미 이슈로 존재)

이미 있는 훅을 켜는 것이 가장 짧은 길이다. `has_outstanding_durable_sleep`(`core/src/tasks/mod.rs:412-450`)은 스레드에 `SleepItem`이 붙어 있으면 `trigger_turn` 없는 메일조차 새 턴을 열게 한다. 생산자만 없다.

필요한 것 세 가지.
1. 모델이 부를 수 있는 durable sleep 마킹. "지금 도는 자식/프로세스가 끝날 때까지 잔다"를 선언하고 턴을 끝낸다.
2. 자식 완료 알림을 `trigger_turn = true`로 승격하거나, durable sleep이 걸린 스레드에 한해 승격.
3. goal 쪽에서 durable sleep이 걸린 스레드의 continuation을 억제.
감사에서 정정: 이걸 "deferral 테이블에 한 줄 넣기"로 구현하면 안 된다. 턴이 끝나면 idle이 **먼저** goal continuation을 돌리고(`core/src/tasks/mod.rs:855-864`), deferral은 다음 턴 시작에 지워지므로(`extension.rs:232-235`) 기상 턴이 그걸 지운 뒤 continuation이 다시 돈다. 자는 동안 `continue_if_idle`이 `SleepItem`의 존재를 직접 보고 건너뛰어야 한다.

상류 이슈 대응: #15723(깨우지 않는다는 버그 보고), #22003(완료 출력을 활성 세션에 주입), #42908(Desktop 재개), #17737(Monitor식 추적). 3번은 아직 이슈로 정리되어 있지 않다. goal과 durable sleep의 상호작용은 이 조사에서 새로 드러난 부분이다.

## 7. 이 세션 자체가 만든 1차 증거

이 조사는 조사 대상 위에서 돌았다. 그래서 관찰된 것이 있다.

grok-4.6 서브에이전트 8개와 Aside 셸 세션 10여 개를 병렬로 띄웠다. 관찰:

- `spawn_agent` 8회가 즉시 반환했고 부모 턴은 계속 진행했다. 백그라운드 병행은 실제로 된다.
- `wait_agent`로 기다리는 동안 부모 턴은 살아 있었다. 45초 타임아웃을 여러 번 반복해야 했고, 그 시간만큼 아무 일도 못 했다.
- 자식이 끝나면 `<subagent_notification>`이 **다음 모델 스텝의 입력으로** 들어왔다. 부모가 `wait_agent`를 부르지 않아도 도착했다. 다만 부모가 이미 턴 안에 있었기 때문이다.
- 부모가 턴을 끝냈다면 그 알림은 조용히 쌓여 있었을 것이고, goal이 새 턴을 열어 줄 때까지 읽히지 않았을 것이다. 이 세션에 goal이 걸려 있었으므로 결과적으로는 읽혔다. 5절 Weak 옵션이 실제로 작동한 사례다.
- Aside 셸 세션은 `exec_command`가 `session_id`를 돌려준 뒤 턴을 넘어 살아남았고, 나중에 `write_stdin` 빈 폴링으로 회수했다. 1차 파견분(A1~A4)은 폴링 시 출력 상한에 잘려 유실됐다. 세션이 이미 끝나 있었기 때문이다. 2차 파견분은 출력을 파일로 받아 유실이 없었다.

마지막 항목이 4번 격차(모델용 목록 도구 없음)의 실제 비용을 보여 준다. 백그라운드 프로세스의 출력을 놓치면 모델에게는 그걸 되찾을 경로가 없다.

## 8. 무엇을 고를 것인가

지금 당장 쓸 것은 Weak이다. 이미 그렇게 돌고 있고 추가 작업이 없다. 대신 폴링 한 번이 턴 하나라는 비용을 받아들여야 한다.

Medium은 goal 없이 돌아가는 대화에서도 백그라운드 완료를 잃지 않으려 할 때 의미가 있다. codexclaw가 로컬 레지스트리를 들고 continuation 프롬프트를 채우는 방식이다. 다만 goal 의존은 남는다.

Strong은 상류에 올릴 값어치가 있다. 특히 3번(자는 스레드의 continuation 억제)은 아직 아무도 이슈로 정리하지 않았고, 1번과 2번만 고치면 goal이 자는 스레드를 계속 깨워서 효과가 없다. 이 상호작용이 이번 조사에서 새로 드러난 부분이다.

## 9. 남은 불확실성

- Desktop(이 앱)이 TUI처럼 Stop 시 goal을 Paused로 바꾸는지는 확인하지 못했다. 서버만 보면 interrupt는 goal 상태를 바꾸지 않는다.
- V2에서 부모 재시작 후 자손이 자동 회수되는지는 테스트가 V1에만 있다.
- `150_claude_code` 스냅샷은 2026-03경이라 현재 배포본과 다르다. 현재 동작 판정은 공식 문서를 우선했다.
- 이 조사는 로컬 체크아웃 기준이다. 실제 실행 중인 Codex 바이너리 버전과의 차이는 검증하지 않았다.

