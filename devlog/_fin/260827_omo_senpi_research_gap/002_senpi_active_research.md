# Senpi main — prompt, parallel execution, goal/wake runtime

Pinned HEAD: `703d9d7676b3419273765a4566dd02c1abe75d70` (`2026.8.27`)
OMO beta pinned peer version: `2026.8.26-2`; 최신 Senpi 관찰은 beta 결합의 실행 증거가 아니다.

## 소유권 결론

Senpi core는 active research parser나 autonomous child-task engine이 아니다. 다음을 제공한다.

- dynamic system prompt와 prompt-only IntentGate;
- 같은 assistant message 안의 independent tool-call 병렬 실행;
- durable goal/todo;
- terminal background bash/monitor와 generic wake-source event;
- wake-source-aware hidden goal continuation.

`task`, `task_output`, `task_send`, child persistence는 OMO의 `omo-senpi` + `senpi-task`가 공급한다.

## Intent와 병렬 실행

| Mechanism | Class | Positive / negative | State / output | 판정 |
| --- | --- | --- | --- | --- |
| `buildIntentGate()` | prompt-only | default dynamic prompt / model preset `corePrompt` override | state 없음; 모델이 `I read this as...`와 routing을 생성. `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/intent-gate.ts:14-45`, `build.ts:30-35,72-90` | turn-local reset 개념 ADAPT, visible boilerplate REJECT |
| parallel-tools section | prompt-only | default prompt / corePrompt override, dependent calls | independent read/search/tool을 한 response에 emit하라고 지시. `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/parallel-tools.ts:1-6` | dependency-aware batching ADAPT |
| `executeToolCallsParallel()` | deterministic-runtime | 2+ non-sequential calls / global or per-tool sequential barrier | one batch promise state; execution end는 completion순, result messages는 source순. `devlog/.senpi/packages/agent/src/agent-loop.ts:846-864,927-993`, `types.ts:301-311,466-473` | host runtime이므로 DEFER |

이 셋을 한 “active parallel research” 기능으로 세면 안 된다. Prompt가 병렬을 권하는 것, host가 이미 emit된 tool calls를 병렬 실행하는 것, child researchers를 파견하는 것은 서로 다른 계층이다.

## Goal/todo

- Goal은 session-backed 또는 cwd/thread fallback JSON에 atomic 0600 write하며 history JSONL을 가진다: `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/goal/store-ref.ts:9-23`, `persistence.ts:173-216,286-312`, `store.ts:36-45,148-152`.
- Model은 complete/blocked만 설정하고 pause/resume은 user/system 경계다: `goal/types.ts:1-5`, `goal/transitions.ts:27-44`.
- Todo는 session branch의 `senpi.todo-state` snapshot으로 복원되고 sequential barrier를 사용한다: `todotools/tools/todo.ts:283-325`, `todotools/index.ts:37-48`.
- Pending/in_progress todo가 goal completion을 막는다: `goal/todo-gate.ts:8-30`, `goal/tool-registration.ts:77-98`.

CodexClaw은 native goal DB를 read-only로 쓰고 별도 goalplan/ledger를 이미 가진다. Senpi goal/todo DB를 복제하지 않는다. 최신 durable task state가 completion을 막는 원칙만 기존 goalplan task gate에 ADAPT한다.

## Monitor와 wake-source continuation

Terminal monitor는 단순 polling 지시가 아니라 실제 event path다.

1. command/regex를 받아 PTY output의 complete line 또는 exit를 event로 만든다: `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/terminal/monitor-registry.ts:79-100,133-163`.
2. notifier가 rate-limit/dedupe/wake budget을 적용하고 hidden steer/followUp `triggerTurn:true`를 보낸다: `terminal/notify.ts:28-46`, `terminal/monitor-notify.ts:184-235`.
3. terminal active count를 `terminal-monitors` wake source로 publish한다: `terminal/extension.ts:53-84`.
4. Goal continuation은 source가 살아 있으면 immediate continuation을 미루고, drain 뒤 1초에 한 번 fire한다: `goal/lifecycle-helpers.ts:66-89,200-204`, `goal/continuation.ts:7-18,50-64,99-121,170-182`.

Positive: active goal + idle/no pending + no guard violation; active wake source면 delayed backstop, count가 0으로 drain되면 continuation. Negative: inactive goal, pending messages, non-idle, single-flight, repeated/stale output, cap, user input, flooded history.

CodexClaw Stop hook은 monitor/event liveness를 보지 않고 phase/goal/context/cap만 본다. 이 때문에 “background child/terminal이 곧 main을 깨울 예정”과 “정말 정체됨”을 구분하기 어렵다. **registered wake-source accounting**은 P1 ADAPT 후보다. 단 Senpi generic event validator는 finite number만 확인해 negative/fraction count를 허용한다: `monitor-state-event.ts:26-36`, `goal/monitor-continuation.ts:582-618`. 채택 시 source registry + nonnegative integer validation이 필수다.

Hidden timer loop 자체는 REJECT한다. CodexClaw의 single Stop owner와 visible reason을 유지하고, wake-source가 active일 때 stop/release reason을 더 정확히 만드는 데만 쓴다.

## Background bash

Senpi terminal은 explicit background 또는 60초 foreground window 초과 시 process-local `bash_N`으로 전환하고, active count와 exit notice를 보낸다: `terminal/tools/bash.ts:182-193,364-393`, `terminal/tools/foreground-window.ts:1-15`. 이는 Codex host가 이미 제공하는 managed terminal/session 기능과 중복이므로 DEFER한다.

## UNVERIFIED

- OMO beta가 pin한 Senpi `2026.8.26-2`에서 최신 HEAD와 같은 skill token/order/monitor behavior인지.
- generic external wake-source의 malformed count가 실전 goal scheduling에 미치는 영향.
- process restart 뒤 terminal/child reconnect; extension reload parking과 host restart는 다르다.
