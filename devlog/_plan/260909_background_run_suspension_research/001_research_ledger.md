# 001 — 리서치 원장 (레인 파견과 검증 상태)

wp1 빌드 산출물. 어떤 증거가 어디서 왔고, 메인이 무엇을 직접 재확인했는지 기록한다.
로드맵의 증거 규칙에 따라, 메인이 재확인하지 않은 서브에이전트 주장은 본문에서 "미검증"으로 표시한다.

## 파견한 레인

xai/grok-4.6 서브에이전트 8개 + Aside 브라우저 4개, 사용자 승인에 따른 무제한 병렬 파견.

| 레인 | 범위 | 상태 |
|---|---|---|
| L1 | 150_claude_code 소스 — 백그라운드 실행, Agent 도구, 세션/sidechain, resume | 완료 |
| L2 | codex-rs unified_exec — 세션 수명, yield, 폴링, compaction 영향 | 완료 |
| L3 | codex-rs multi_agents V1/V2 — 스폰/대기/알림/재개/동시성 | 완료 |
| L4 | codex-rs app-server + goal + Stop-continuation + 서스펜션 | 완료 |
| L5 | 하네스 비교 문서 코퍼스 (005_subagents-collab, 003_tool-runtime) | 완료 |
| L6 | 타 하네스 백그라운드 추적 패턴 (opencode, hermes, oh-my-*, openclaw, gemini-cli, cli-jaw) | 완료 |
| L7 | Claude 공식 문서 웹 조사 | 완료 |
| L8 | Codex 공식 문서 웹 조사 | 완료 |
| A1~A4 | Aside 브라우저 레인 (Claude docs, Agent SDK, Codex docs, 커뮤니티) | 실행됨. 출력 회수 실패 — 폴링 시 토큰 상한으로 잘렸고 세션이 이미 종료됨. L7/L8이 같은 축을 커버하므로 증거로 쓰지 않는다 |
| RV | 독립 감사(explorer) — 로드맵 2라운드 | 완료 (1R fail → 2R near-pass) |

Aside 레인의 실패는 기록해 둔다. 결론에 쓰지 않았으므로 결론에 영향은 없지만, "무제한 병렬 파견"이 곧 회수 성공은 아니라는 운영상의 사실이다.

## 메인이 직접 재확인한 인용

아래는 서브에이전트 보고를 받은 뒤 메인이 codex-rs에서 직접 실행해 확인한 것이다. 본문에 단정형으로 쓸 수 있는 근거다.

- core/src/session/turn_suspension.rs:13-119 — suspend_turn_and_shutdown 전체
- core/src/session/turn_suspension.rs:37 — HasLiveDescendants 조기 반환
- protocol/src/turn_input.rs:20-28 — SuspendTurnOutcome 열거형
- core/src/agent/status.rs:26-31 — is_final (PendingInit/Running/Interrupted 제외)
- core/src/codex_thread.rs:617-618 — inject_fragment_without_turn
- core/src/session/mod.rs:2299 — 자식 종료 알림의 trigger_turn false
- core/src/tools/handlers/multi_agents_spec.rs:283 — V2 wait_agent 설명
- core/src/context/turn_aborted.rs:10-11 — interrupt 후 unified exec 프로세스 생존 안내
- core/src/unified_exec/process_manager.rs:567 — 초기 yield 전에 세션을 저장하는 이유
- core/src/tools/handlers/sleep.rs:1-160 — clock.sleep, 최대 12시간, 새 입력으로 조기 종료
- core/src/config/mod.rs:1258-1276 — CurrentTimeReminderConfig.sleep_tool 기본 false
- core/src/tools/handlers/wait_for_environment.rs:19 — "blocks other tool calls"
- core/src/agent/role.rs:383 — "Awaiter is temp removed"
- core/assets/agent/builtins/awaiter.toml — 대기 전용 역할 프롬프트 원문
- code-mode-runtime/src/service.rs:121-160 — wait / begin_wait
- core/src/tasks/mod.rs:412-418, 439-450 — has_outstanding_durable_sleep와 pending-work 턴 시작
- state/goals_migrations/0001_thread_goals.sql:1-17 — goal 상태 집합
- state/goals_migrations/0002_thread_goal_continuation_deferrals.sql — continuation deferral 테이블
- state/src/runtime/goals.rs:100-152 — deferral 삽입/조회/삭제
- ext/goal/src/runtime.rs:398-458 — continue_if_idle와 start_turn_if_idle
- ext/goal/src/extension.rs:225-236 — 턴 시작 시 deferral 해제
- ext/goal/src/tool.rs:244 — update_goal이 pause/resume을 거부
- app-server-protocol/src/protocol/v2/turn.rs:32-38 — TurnStatus에 Paused 없음
- tui/src/chatwidget/interaction.rs — interrupt 시 클라이언트가 goal을 Paused로 전환
- core/src/config/mod.rs:233-243 — 동시성/깊이 기본값

## 메인이 재확인하지 않은 주장 (미검증)

- L1의 Claude 소스 라인 인용 전체. 로컬 스냅샷이며 현재 배포본과 도구 이름이 다르다(L7이 확인).
- L6의 타 하네스 인용 전체. 설계 참고용이며 결론의 근거로는 쓰지 않는다.
- L5 문서 코퍼스의 라인 인용. 코퍼스 자체가 2차 자료이고, 같은 코퍼스 안에서도 시점 충돌이 있다고 L5가 스스로 보고했다.
- L7/L8의 공식 문서 URL 인용. 문서 URL은 확인 가능하지만 메인이 재방문하지 않았다.

## 감사 이력

1라운드 VERDICT: fail. 블로커 — 능력 질문을 서스펜션 한 축으로 선점, 서스펜션 정의가 실제 구현과 불일치, 대기 표면 누락(clock.sleep, wait_for_environment, code-mode wait, awaiter, turn/steer, thread/fork, cloud-tasks, wait_threads), 부재 증거 규칙 부족.

2라운드 VERDICT: near-pass. 잔여 5건 — 능력 질문과 4범주 정합, goal 충돌 질문에 서스펜션/steering 누락, 닫힌 목록의 회수·형제 RPC 이름 누락, wp2에 Monitor 누락, wp4에 4범주 분류표 강제 없음. 전부 접었고 rebut은 없다.

