# codex-rs 세션간 메시징 업데이트 리서치 (000)

- 날짜: 2026-08-09
- 대상 트리: `/Users/jun/developer/codex/121_openai-codex` (origin=openai/codex, main @ `420accf19`)
- 조사: terra-high explorer 서브에이전트(`019fe3fb-9712-7692-a9f6-4e0cec4f4c1d`, gpt-5.6-terra / effort=high) 1차 추적 + 메인 세션 앵커 스팟체크
- 세션: `019fe3f5-9734-7340-899b-89726e83250f` (WP1)

## 1. 결론 한 문단

사용자 보고("다른 세션간 메세지를 볼 수 있게 업데이트")에 해당하는 기능은 **multi-agent v2의 inter-agent communication(mailbox)** 이다. 한 스레드의 에이전트가 같은 `ThreadManager` 프로세스 안의 다른 스레드에 `send_message` / `followup_task` 모델 툴로 메시지를 본다. 수신 세션의 in-memory mailbox(`InputQueue.mailbox_pending_mails`)에 쌓이고, `trigger_turn` 여부와 durable sleep 상태에 따라 진행 중인 턴에 끼어들거나 새 턴을 깨운다. 2026-07-20 `b00c9b2e1`(#34383)에서 multi-agent v2가 stable 선언됐다. 단 stable이어도 **기본 비활성**이다 — `Feature::MultiAgentV2`는 `Stage::Stable`에 `default_enabled: false`로 등록돼 있고(`features/src/lib.rs:1130-1135`), v2 툴 노출은 이 플래그로 게이트된다(`core/src/tools/spec_plan.rs:595, 656, 1127`).

같은 시기에 들어온 유저 메시지 큐 3종(`bf7804c25`, `b87981a51`, `bc8b25ea0`)은 **별개 기능**이다. 그쪽은 "유저(클라이언트) → 한 스레드"의 durable 큐잉이지 "세션 A → 세션 B"가 아니다.

## 2. 관련 커밋 타임라인

| SHA | 날짜 | PR | 내용 |
|---|---|---|---|
| `6a0c4709c` | 2026-03-27 | #15986 | v2 spawn/통신 툴 스펙 최초 도입 계열 (`create_send_message_tool`, `send_inter_agent_communication` 최초 출현) |
| `5f4d06ef1` | 2026-06-05 | #26210 | v2 메시지 페이로드 암호화 (`encrypted_content`) |
| `a98a21798` | 2026-07-01 | #30867 | v2 communication send 경로 통합 |
| `129ea2aaf` | 2026-07-01 | #30872 | 통신 lifecycle 로깅 (`agent_communication.rs`) |
| `c28770a42` | 2026-07-15 | #33367 | final-answer 이후 도착한 mail을 다음 턴으로 defer (`MailboxDeliveryPhase`) |
| `b00c9b2e1` | 2026-07-20 | #34383 | **multi-agent v2 stable 선언** |
| `44d76c6a6` | 2026-07-23 | #34852 | durable sleep 중인 스레드를 queue-only agent mail로 깨움 |
| `03edf16f0` | 2026-07-28 | #35845 | plaintext collaboration tool 메시지 지원 |

별개 기능(유저 → 스레드 durable 큐):

| SHA | 날짜 | PR | 내용 |
|---|---|---|---|
| `bf7804c25` | 2026-07-31 | #36385 | acknowledged user message submission (`UserMessageAdmission`) |
| `b87981a51` | 2026-08-04 | #36952 | SQLite `queued_items` 테이블 + `QueueStore`, 스레드당 100개 상한 |
| `bc8b25ea0` | 2026-08-06 | #37204 | `QueuedItemService` — idle 시 FIFO dispatch, hook rejection 폐기, `ThreadQueueChanged` 이벤트 |

무관한 것: `6b39d0c65` "owner nudge app-server API"(#18220)는 이름과 달리 결제 nudge 이메일(`account/sendAddCreditsNudgeEmail`)이다.

## 3. 프로토콜 표면

### 3.1 모델 툴 표면 (세션 → 세션, JSON-RPC 아님)

| 툴 | 방향 | 앵커 |
|---|---|---|
| `send_message` (QueueOnly) | agent A → agent B | `codex-rs/core/src/tools/handlers/multi_agents_v2/send_message.rs:12` (`ToolName::plain("send_message")`, 메인 세션 스팟체크 확인), 스펙: `core/src/tools/handlers/multi_agents_spec.rs:186-206` |
| `followup_task` (TriggerTurn) | agent A → agent B (root 타겟 불가) | `multi_agents_v2/followup_task.rs:12`, 가드: `message_tool.rs:78-87` |
| `wait_agent` (mailbox 활동 대기) | agent ← mailbox | `multi_agents_v2/wait.rs:24`, 스펙 설명: `core/src/tools/handlers/multi_agents_spec.rs:287` |
| `spawn_agent` / `interrupt_agent` / `list_agents` | 부모 → 자식 | `multi_agents_v2/spawn.rs:27`, `interrupt_agent.rs:10`, `list_agents.rs:10` |
| v1 `send_input`/`wait_agent`/`spawn_agent`/`close_agent`/`resume_agent` | 레거시 | `multi_agents/send_input.rs:10` 등 |

### 3.2 app-server JSON-RPC 표면 (외부 클라이언트 → 스레드)

inter-agent send 전용 JSON-RPC 메서드는 **없다**(`common.rs` 메서드 전수 확인 — explorer 보고, 메인 세션이 `rg` 스캔으로 재확인). 외부 클라이언트의 진입점:

| 메서드 | 방향 | 앵커 |
|---|---|---|
| `turn/start` | client → idle thread | `app-server-protocol/src/protocol/common.rs:863` (스팟체크 확인), params: `v2/turn.rs:71` |
| `turn/steer` (`expected_turn_id` precondition 필수) | client → active turn | `common.rs:869` (스팟체크 확인), `v2/turn.rs:175-197` |
| `turn/interrupt` | client → turn | `common.rs:875`, `v2/turn.rs:209` |
| `thread/inject_items` (raw history append, 턴 시작 안 함) | client → thread | `common.rs:700` (스팟체크 확인), `v2/thread.rs:1490-1499` |
| `ThreadQueueChanged` 이벤트 | core → client (현재 app-server는 무시) | `protocol/src/protocol.rs:1375, 4126`; `app-server/src/bespoke_event_handling.rs:1189` (`=> {}`) |

### 3.3 in-process 제어 경로 (외부에서 직접 못 씀)

| 요소 | 앵커 |
|---|---|
| `Op::InterAgentCommunication` (ThreadManager → session) | `core/src/session/handlers.rs:776` |
| `InterAgentCommunication` 페이로드 (author/recipient AgentPath, trigger_turn, encrypted_content) | `protocol/src/protocol.rs:740-756` (740 라인 스팟체크 확인) |

## 4. End-to-end 플로우 (세션 A → 세션 B)

1. A의 모델이 `send_message { target, message }` 호출 → `resolve_agent_target`이 target(스레드 id 또는 task name)을 `ThreadId`로 해석 (`core/src/agent/agent_resolver.rs:9-30`).
2. `handle_message_string_tool`이 `ensure_v2_agent_loaded`로 수신 스레드를 residency LRU에서 로드하고 `InterAgentCommunication`을 만들어 `agent_control.send_inter_agent_communication` 호출 (`multi_agents_v2/message_tool.rs:52-119`).
3. `AgentControl`이 실행 용량 체크 후 `ThreadManagerState::send_op(B, Op::InterAgentCommunication{..})` → B의 session IO 채널로 submit (`core/src/agent/control.rs:195-264`, `core/src/thread_manager.rs:1337-1353`).
4. B의 submission 루프가 `handlers::inter_agent_communication`으로 디스패치 → B의 `InputQueue.enqueue_mailbox_communication`에 push. `trigger_turn==true`이거나 B가 durable sleep 중이면 `maybe_start_turn_for_pending_work`로 턴 시작 (`core/src/session/handlers.rs:284-301, 776-784`; `input_queue.rs:85-98`).
5. B 턴 경계에서 `drain_mailbox_input_items` → `TurnInput::InterAgentCommunication`으로 변환 (`input_queue.rs:113-132`). 실행 중인 턴이면 commentary/reasoning 아이템 경계에서 preempt해 다음 샘플링 요청에 fold (`turn.rs:2326-2370`); final-answer 이후면 `MailboxDeliveryPhase::NextTurn`으로 다음 턴 배달 (enum: `state/turn.rs:50-56`, defer 함수: `input_queue.rs:155-176`, 호출부: `stream_events_utils.rs:108-112`).
6. 배달 시 `record_inter_agent_communication`: B의 rollout에 `InterAgentCommunicationMetadata{trigger_turn}` + ResponseItem 영속, raw response item 이벤트를 클라이언트에 송신 (`session/mod.rs:3211-3238`).
7. A 측에는 `SubAgentActivityItem{kind: Interacted}` 활동 아이템 emit (`message_tool.rs:120-131`). A는 `wait_agent`로 B의 결과를 폴링 (`wait.rs:142, 179-197`).

## 5. 제약/가드 (확인됨)

- `followup_task`는 root agent 타겟 불가, `agent_path` 필수 (`message_tool.rs:78-91`).
- 빈 메시지 거부 (`message_tool.rs:42-48`).
- 유저 큐 dispatch: idle+Completed에서만 FIFO 1개 시작. interruption/failure 후에는 큐에 남김, hook rejection 시 아이템 삭제 (`ext/queue/src/service.rs:230-240, 242-293`).
- trigger-turn mail이 pending이면 extension 주도 idle 턴 거부 (`inject.rs:57-63`). Plan mode에서는 유저 입력 없는 idle 턴 거부 (`inject.rs:64-69`).
- 유저 큐 상한 100 (`MAX_QUEUE_ITEMS`, `state/src/lib.rs:89` — 메인 세션 스팟체크 확인), 스레드당 dispatch 뮤텍스 (`service.rs:86-101`).
- 수신 에이전트는 v2 residency LRU에 로드 가능해야 하며 사망 시 `InternalAgentDied` → 스레드 제거/해제 (`control.rs:281-298`).
- **mailbox pending은 in-memory(`VecDeque`)** — 프로세스 재시작 시 미배달 mail 유실 가능성. durable한 것은 배달된 메시지의 rollout 기록뿐 (`input_queue.rs:44`, `session/mod.rs:3229-3236`).

## 6. 미해결 / uncertainty

- 미배달 mailbox mail의 재시작 복구 경로는 못 찾음 — 없을 가능성 높음 (candidate — unverified).
- 유저 큐 extension을 외부에 노출하는 JSON-RPC/TS export는 HEAD(`420accf19`) 기준 부재. `QueuedItemService`는 Rust extension contributor로만 배선 (`ext/queue/src/lib.rs:14-19`, `app-server/src/extensions.rs:72-78`).
- `remoteControl/*` 메서드군(`common.rs:947-984`)은 디바이스 페어링/원격 제어용으로 보이며 inter-thread messaging과의 관계 미확인 (스코프 밖).
- cross-process(서로 다른 app-server 인스턴스) 간 메시징 표면은 존재하지 않음 (메서드 전수 스캔).

## 7. 유의사항

"세션간 메시징"이라 부를 때 upstream이 실제로 제공하는 것은 **같은 ThreadManager 프로세스 안**의 스레드 간 통신이다. 서로 다른 codex 프로세스(예: 각각 `codex exec`로 뜬 두 런) 사이의 메시징은 이 기능의 범위 밖이다. codexclaw 채택안은 `001_adoption_proposal.md` 참조.
