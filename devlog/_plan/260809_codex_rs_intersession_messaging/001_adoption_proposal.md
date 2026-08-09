# codexclaw 세션간 메시징 채택 제안 (001)

- 날짜: 2026-08-09
- 근거 리서치: `000_research.md` (codex-rs @ `420accf19`)
- 성격: 설계/제안 문서. 이 유닛은 문서화 전용이라 codexclaw 코드 변경은 없고, 실제 구현은 후속 구현 유닛에서 이 문서를 입력으로 받는다.

## 1. codexclaw의 현재 실행 모델

codexclaw는 codex 세션을 **일회성 프로세스**로 다룬다. messenger-bridge의 runner가 stock `codex exec`(새 스레드) 또는 `codex exec resume <SESSION_ID>`(이어달리기)를 spawn한다 (`plugins/codexclaw/components/messenger-bridge/src/runner.ts:4-12`). pabcd-state와 subagent-config는 프롬프트/훅 레이어에서 오케스트레이션을 제공하고, 세션 간 조정은 파일 기반(`.codexclaw/` 세션 상태, ledger, goalplan)으로 이뤄진다.

이 구조에서 "세션간 메시징"의 의미를 두 갈래로 나눠야 한다:

- **같은 codex 프로세스 안**의 스레드 간 (부모 세션 ↔ spawn된 subagent): upstream v2 mailbox가 그대로 쓸 수 있는 영역.
- **서로 다른 codex 프로세스** 간 (예: messenger-bridge가 띄운 run A ↔ 데스크톱 앱 세션 B): upstream에 표면이 없는 영역.

## 2. 옵션 비교

### 옵션 A — 프롬프트/스킬 레벨 채택 (v2 mailbox를 codexclaw 오케스트레이션에 명시)

내용: codexclaw의 dispatch doctrine과 role 프롬프트가 v2 통신 툴(`send_message` QueueOnly, `followup_task` TriggerTurn, `wait_agent`)의 semantics를 정확히 가르치도록 한다. 지금도 subagent는 같은 프로세스 안의 스레드라 mailbox가 동작하지만, codexclaw 문서/프롬프트 어디에도 이 트리거 조건과 제약이 기록돼 있지 않다.

- 전제: 이 경로는 `multi_agent_v2` 플래그가 켜져 있을 때만 성립한다 (stable이지만 `default_enabled: false`, `features/src/lib.rs:1130-1135`). codexclaw에서는 config-guard가 이 플래그를 관리한다 (`plugins/codexclaw/components/config-guard/src/multi-agent-v2.ts`, `setMultiAgentV2State` :101).
- 바꿀 것: `structure/20_pabcd_dispatch_doctrine.md` §3 DISPATCH-ACTOR-01은 이미 "followup_task triggers a turn when idle; send_message is context-only delivery" 구분을 담고 있다(:127-130). 여기에 아직 없는 v2 semantics — root 타겟 불가 가드(`message_tool.rs:78-91`), QueueOnly mail의 다음-턴 지연 배달(`MailboxDeliveryPhase`), trigger-turn mail pending 시 extension idle 턴 거부(`inject.rs:57-63`), `wait_agent` 폴링/타임아웃 지침 — 를 보강하고, subagent-config의 role promptOverride에 mailbox 활동 대기 지침을 추가한다.
- 장점: 코드 변경 사실상 없음(문서/프롬프트 패치), upstream이 의도한 경로, stable 선언(`b00c9b2e1`) 이후라 API 소거 위험이 낮음.
- 단점: 프로세스 경계를 못 넘는다. mailbox pending은 in-memory라 재시작에 약함.
- 비용: C1-C2.

### 옵션 B — app-server 상주 클라이언트로 전환해 JSON-RPC 진입점 사용

내용: messenger-bridge runner를 `codex exec` 일회성 spawn에서 app-server JSON-RPC 상주 연결로 바꾸고, 외부에서 스레드에 메시지를 넣을 때 `turn/start`(idle), `turn/steer`+`expectedTurnId`(활성 턴), `thread/inject_items`(기록만)을 쓴다.

- 바꿀 것: runner.ts 전면 재설계, active turn id 추적(`thread/status/changed` 노티 구독), steer precondition 실패 처리.
- 장점: 외부(텔레그램/디스코드/다른 프로세스)에서 돌고 있는 세션으로 메시지를 넣는 공식 경로. `turn/steer`는 upstream이 precondition까지 둔 정식 표면.
- 단점: 아키텍처 변경이 크고, `turn/steer`는 "세션→세션"이 아니라 "클라이언트→세션"이라 발신 세션의 정체성(AgentPath)은 못 실는다. durable 유저 큐(`queued_items`)는 JSON-RPC 미노출이라 외부에서 못 씀.
- 비용: C4 (별도 구현 유닛 필요).

### 옵션 C — upstream 확장 대기/기여

내용: durable queue의 JSON-RPC 노출, mailbox의 durable화, cross-process 메시징 등은 upstream에 없다. 필요하면 upstream에 제안/기여한다.

- 장점: 근본 해결.
- 단점: 일정을 우리가 통제 못 함. 당장의 가치 없음.

## 3. 권고

**A를 지금 하고, B는 별도 구현 유닛으로 미뤄두고, C는 워치 아이템으로 둔다.**

근거:
1. codexclaw가 오늘 실제로 돌리는 멀티에이전트(부모 세션 + spawn_agent subagent)는 전부 같은 프로세스 안이다. doctrine DISPATCH-ACTOR-01은 turn-trigger/context-only 구분을 이미 갖고 있지만, root 타겟 불가·QueueOnly 지연 배달·idle 턴 거부 조건 같은 운영 제약은 없다. 이 제약들을 박아넣는 것만으로 기존 규칙이 upstream 동작과 더 정합해진다.
2. B는 가치가 있지만 runner 재설계를 동반한다. 이 유닛의 스코프(문서화 루프)를 넘고, 사용자 승인 없이 진행할 수 있는 규모가 아니다.
3. C의 세 항목(queue JSON-RPC 노출, mailbox durable화, cross-process)은 upstream 커밋 흐름상 활발히 움직이는 영역(#36952→#37204가 2일 간격)이라, 우리가 선행 구현하면 충돌 가능성이 높다.

## 4. 후속 구현 유닛 시드 (옵션 A를 실제로 패치할 때)

이 문서는 제안이고 구현 계획은 아니다. 구현 유닛을 열 때 아래를 P 단계 입력으로 쓴다.

- 수정 후보 경로:
  - `structure/20_pabcd_dispatch_doctrine.md` §3 — reviewer reuse 라이프사이클에 v2 tool semantics 표 추가
  - `plugins/codexclaw/components/subagent-config/` — role promptOverride 문구 (mailbox 대기/깨우기 지침)
  - `skills/` 계열 dispatch 언급 스킬들 — V1/V2 도구 이름 매핑 정합성 점검
- 수용 기준 아이디어:
  - doctrine이 기존 turn-trigger/context-only 구분 위에 root 타겟 불가와 QueueOnly 지연 배달까지 설명하는가
  - `wait_agent` 타임아웃/폴링 지침이 upstream 동작(`wait.rs:142, 179-197`)과 맞는가
  - 문서만 바뀌므로 C 단계는 링크/앵커 실존 검증 + 기존 테스트 스위트 통과
- 명시적 비목표: app-server 클라이언트 전환(옵션 B), codex-rs fork 패치

## 5. 리스크/오해 방지

- "codex-rs가 세션간 메시징을 지원"한다고 해서 codexclaw가 띄운 서로 다른 `codex exec` 프로세스끼리 통신할 수 있는 게 **아니다**. 같은 프로세스 안의 스레드 간만 된다. messenger-bridge의 "여러 채팅 세션이 서로 메시지를 주고받는" 시나리오는 옵션 B 없이는 불가.
- mailbox 미배달 mail은 재시작 시 유실될 수 있다(000_research.md §6). "병렬 세션에 메시지를 넣어두고 재시작했다"는 복구 시나리오를 설계하면 안 된다.
- `ThreadQueueChanged` 이벤트는 app-server가 현재 무시한다(`bespoke_event_handling.rs:1189`). 유저 큐 상태를 외부에서 observe하려면 아직 방법이 없다.
