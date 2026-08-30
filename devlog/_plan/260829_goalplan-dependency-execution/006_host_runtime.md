# 006 — 호스트 런타임 계약 (codex-rs 실측)

출처: 호스트 조사 3기(gpt-5.6-sol medium). 대상
`/Users/jun/developer/codex/121_openai-codex/codex-rs` HEAD `89650c66f`.
goalplan 설계가 호스트와 중복되거나 충돌하지 않는지 확인하려고 Rust 소스를 직접 읽었다.

## 1. 호스트 goal이 소유하는 것 (ext/goal)

데이터 모델은 스레드당 레코드 하나다. `thread_id`가 primary key라서 한 스레드에 goal이 둘일 수 없다.
필드는 `objective`(자유문자열, 최대 4,000자), `status`, `token_budget?`, `tokens_used`,
`time_used_seconds`, `created_at`, `updated_at`이다(state/src/model/thread_goal.rs:60,
state/goals_migrations/0001_thread_goals.sql:1).

상태 6종: `active`, `paused`, `blocked`, `usage_limited`, `budget_limited`, `complete`.
terminal은 `budget_limited`와 `complete`뿐이고 나머지는 재활성 가능한 정지다(thread_goal.rs:12, 35).

**하위 구조가 하나도 없다.** task, criterion, dependency, checkpoint, evidence, phase, owner,
priority, retry policy 전부 없다. 부속 테이블은 fork 직후 자동 continuation을 한 번 유예하는
`thread_goal_continuation_deferrals`뿐이다.

도구 계약:

- `get_goal`: 입력 `{}`. 출력 `{goal, remainingTokens, completionBudgetReport}`
- `create_goal`: `objective` 필수, `token_budget` 선택. **기존 goal이 `complete`일 때만 교체 가능**
- `update_goal`: `status`는 `complete` 또는 `blocked` **둘만** 허용. active/paused/usage_limited/
  budget_limited는 도구로 설정할 수 없다(ext/goal/src/spec.rs:60, tool.rs:234)

과금 공식은 `(input - cached_input) + max(output, 0)`이고 Plan mode 턴은 제외된다
(accounting.rs:313, extension.rs:214). 시간 예산은 없고 `time_used_seconds` 누적만 있다.

## 2. 가장 중요한 발견 — 호스트가 이미 continuation 드라이버다

스레드가 idle이 되면 호스트가 `continue_if_idle()`을 호출한다. goal이 `active`면 continuation
steering을 입력으로 **새 턴을 자동으로 띄운다**(`turn_trigger = "goal"`, ext/goal/src/extension.rs:148,
runtime.rs:363, 407).

즉 모델이 한 턴을 끝내도 goal이 active인 한 호스트가 다음 턴을 만든다. 호스트에는 CodexClaw
Stop 훅처럼 "Stop을 거부해 같은 턴을 붙잡는" 로직이 없다. 대신 턴 종료 → 사용량 flush →
idle 이벤트 → 새 goal 턴 순서다.

**설계 함의:** 우리가 goalplan에 별도 실행 드라이버(큐를 돌며 다음 항목을 자동 착수하는 루프)를
만들면 호스트 continuation과 이중으로 겹친다. 004에서 "스케줄러 진실은 pabcd-state, 파견은
메인 세션"이라고 적은 조사 결론이 이 실측으로 강화된다. 현행 명칭은 정본 §20의
**dependency-aware control plane**이다. **goalplan은 "지금 무엇이 실행 가능한가"를
계산해 알려주는 데까지만 하고, 턴을 만드는 일은 호스트에 남긴다.**

호스트 정지 조건도 이미 있다. 일반 turn error → `blocked`, usage limit → `usage_limited`,
예산 도달 → `budget_limited` + wrap-up steering. 우리가 재구현할 필요가 없다.

참고로 "같은 blocker 3회 연속" 규칙은 호스트 DB나 카운터가 아니라 continuation 프롬프트와 도구
설명에만 있다(spec.rs:66, templates/goals/continuation.md:48). 기계적 강제가 아니므로, 그 추적이
필요하면 goalplan이 소유해야 한다.

## 3. agent-graph-store는 다른 층이다

crate 설명이 "storage-neutral parent/child topology for thread-spawned agents"다
(agent-graph-store/src/lib.rs:1). 엣지는 `parent_thread_id`, `child_thread_id`, `status` 3필드이고
**`child_thread_id`가 primary key라서 자식당 부모가 최대 하나**다(state/migrations/0021_thread_spawn_edges.sql:1).
즉 일반 DAG가 아니라 parent-pointer forest다. 상태는 `open`/`closed` 둘뿐이다(types.rs:4).

API는 upsert edge, set status, list children, list descendants 네 개뿐이다(store.rs:17).
사이클 검출이 없고, `parent != child` 제약도 없으며, descendant 조회 쿼리는 `UNION ALL`에
visited 방어가 없다(state/src/runtime/threads.rs:291). 정상 spawn이 자연히 트리를 만든다는 전제다.

**중복이 아닌 이유:**

| 축 | 호스트 그래프 | goalplan dependsOn |
| --- | --- | --- |
| 노드 | 실제 `ThreadId` | 계획 단위(work phase / task) |
| 엣지 의미 | "A가 B를 spawn했다" (계보) | "B 전에 A가 충족돼야 한다" (선행 조건) |
| 다중 선행 | 불가(부모 1개) | 필수(여러 prerequisite) |
| 존재 시점 | 자식 스레드가 생긴 뒤 | 실행 전에도 존재 |
| ready/blocked 판정 | 없음 | 핵심 |
| 사이클 검증 | 없음 | 필요 |

한 계획 단위를 여러 서브에이전트가 수행하거나 한 서브에이전트가 여러 단위를 처리할 수 있어
일대일 대응도 성립하지 않는다. 따라서 `dependsOn`은 goalplan 층에 두는 것이 맞다.

선택적 연동 여지: goalplan 실행 증거에 담당 `ThreadId`를 남기면 계획 노드와 실제 실행 스레드를
추적할 수 있다. 이번 범위 밖이지만 방향은 열어 둔다.

참고로 `agent-identity`는 서브에이전트 신원이 아니라 backend 인증용 Ed25519 runtime identity이고,
`agent-roles`는 spawn 시 적용할 정적 설정 카탈로그다. 둘 다 실행 그래프와 무관하다.

## 4. 훅 예산 — 75ms 락 대기는 안전하다 (정본 §6 검증)

정확한 숫자를 얻었다.

- `PreToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop` 일반 명령 훅 기본 타임아웃 **600초**
- 설정으로 줄여도 **최소 1초**로 보정(`unwrap_or(600).max(1)`, hooks/src/engine/discovery.rs:727)
- SessionEnd/Interrupt만 기본 1초·최대 3초이며 우리 네 훅과 무관

75ms는 최소 예산의 7.5%, 기본 예산의 0.0125%다. **시간 예산 관점에서 안전하다.**

다만 새로 알게 된 제약이 셋 있다.

1. **동기 훅들은 직렬이 아니라 `FuturesUnordered`로 동시에 실행된다**(dispatcher.rs:124~156).
   즉 같은 goalplan 락을 훅끼리 실제로 놓고 경쟁한다. 락 도입이 이론이 아니라 실전 경합이다.
2. 훅 실패·타임아웃·잘못된 출력은 네 훅 모두 **프로세스 fail-open**이다. 도구·입력·종료를
   막지 않는다(pre_tool_use.rs:193, user_prompt_submit.rs:138, stop.rs:269). 다만 상태 변경 연산은
   **operation fail-closed**다. CLI lifecycle·steering apply·D-close가 락을 못 잡으면 plan과 원장을
   바꾸지 않고 전이도 진행하지 않는다. 훅 프로세스는 세션을 막지 않은 채 경고를 남긴다.
   조사 당시의 통짜 fail-open 결론보다 정본 §11이 최종이다.
3. 비동기 훅은 세션당 동시 프로세스 8개로 제한되고, 그 대기는 `timeout_sec` 시작 전이다
   (command_runner.rs:45).

따라서 정본 §6의 결론(75ms 후 자동 회수 없이 실패, 무한 재시도 금지, 락 안에서 다른 프로세스를
기다리지 않기)이 실측으로 뒷받침된다. 락 실패 시 훅 프로세스는 fail-open, 상태 변경 연산은
fail-closed이며 정본 §11이 최종이다.

## 5. Stop block 반복 상한이 없다

동기 Stop 훅이 유효한 `block`과 비어 있지 않은 `reason`을 반환하면 그 reason이 `role:"user"`
메시지로 같은 턴 기록에 들어가고 모델 루프로 돌아간다. 두 번째부터 입력의 `stop_hook_active`가
`true`가 된다(core/src/session/turn.rs:505, 522).

**반복 상한은 코드에 없다.** 통합 테스트도 같은 턴에서 두 번 연속 block 후 세 번째 응답에서
끝나는 것을 검증한다(core/tests/suite/hooks.rs:1301). `stop_hook_active`는 카운터가 아니라
"이미 한 번 block했다"는 신호일 뿐이다.

**설계 함의:** goalplan이 Stop 이유를 풍부하게 만드는 것은 안전하지만, 락 대기나 검증 실패로
블록을 무한 반복시키면 호스트가 막아주지 않는다. CodexClaw가 이미 phase별 stop-block 상한을
자체적으로 갖고 있는데, 그 설계가 옳았음이 확인된다.

## 6. 서브에이전트 동시 실행 상한

V2 `spawn_agent`의 `max_concurrent_threads_per_session` 기본값은 **4이며 현재 에이전트를 포함**한다
(core/src/config/mod.rs:229, session/multi_agents.rs:110). 슬롯 계산에서 1을 빼므로 **보통 자식은
최대 3개 동시 실행**이다. 용량 초과는 `AgentLimitReached`를 반환한다(agent/control/execution.rs:44).

V1은 자식 6개에 깊이 1 제한이 추가된다. V2 spawn 경로는 깊이 제한을 검사하지 않는다.

**설계 함의:** 오늘 이 세션이 6기를 동시에 던진 것처럼 보였지만 실제로는 호스트가 슬롯으로
직렬화한다. 따라서 goalplan의 ready 목록이 10개를 내놓아도 실제 병렬도는 3이다. ready 조회는
동시 실행 상한을 알 필요가 없고(호스트가 관리), 우리는 순서 정확성만 보장하면 된다.
이것이 정본 §4에서 claim/lease를 범위 밖으로 둔 근거를 강화한다.

## 7. app-server-protocol goal 메서드

`thread/goal/set`, `thread/goal/get`, `thread/goal/clear` 요청과 `thread/goal/updated`,
`thread/goal/cleared` 알림이 있다(app-server-protocol/src/protocol/common.rs:571, 1847).

lazygap_impl 030.1이 DEFER한 `thread/goal/set` 직접 호출은 이 메서드다. 여전히 별도 client와
Feature gating이 필요하므로 DEFER 판정을 유지한다.

## 8. 경계 한 줄 요약

> 호스트 goal은 "왜 계속 일하는가, 언제 턴을 다시 시작하고 언제 멈추는가, 얼마를 썼는가"를
> 소유한다. CodexClaw goalplan은 "무엇을 어떤 의존 순서로 수행하며 어떤 증거가 있어야
> 완료인가"를 소유한다.

이 경계에 따라 정본(005)에 반영할 추가 규칙:

- **A. 실행 드라이버를 만들지 않는다.** ready 계산과 보고까지만. 턴 생성은 호스트 몫(§2).
- **B. 락 실패는 훅 프로세스 fail-open / 상태 변경 연산 fail-closed로 나눈다.** 조사 당시의
  통짜 fail-open 결론보다 정본 §11이 최종이다(§4).
- **C. 동시 훅 경합을 전제로 설계한다.** 동기 훅은 병렬 실행이다(§4).
- **D. 동시 실행 상한을 goalplan이 관리하지 않는다.** 호스트가 슬롯으로 제한한다(§6).
