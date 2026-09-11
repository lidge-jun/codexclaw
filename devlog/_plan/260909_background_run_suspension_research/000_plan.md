# 260909 — 백그라운드 런 서스펜션 / 대기-추적 리서치 로드맵

상태: wp1 (docs-first 로드맵). 구현 없음. 이 문서는 이후 wp2~wp4가 무엇을 증명해야 하는지 고정한다.
감사 1회차(FAIL) 반영 개정본. 반영 내용: 능력 질문을 한 축으로 좁히지 않음, 서스펜션 정의를 실제 구현에 맞춤, 누락된 대기 표면 추가, 부재 증거 규칙 강화.

## 사용자 질문 (원문 취지)

"~/Developer/codex 에, Claude의 백그라운드 서브에이전트나 세션처럼 **현재 런을 중지하고 대기한 채로 추적**할 수 있는 기능이 있나?
하트비트나 스케줄 말고. 그건 좀 불편하다. goal 상태와도 충돌이 있을 것 같은데."

두 개의 분리된 질문으로 읽는다.

1. 능력 질문 — Codex에서 외부/자식 작업의 완료를 기다리는 방법이 무엇이고, 그중 "런을 중지한 채 추적"에 해당하는 1급 메커니즘이 있는가. 이 질문을 하나의 축으로 좁히지 않는다. 아래 용어 절의 네 범주(백그라운드 병행, 블로킹 대기, 턴 종료 후 재진입, 서스펜션)를 모두 후보로 놓고 각각 판정한다. 서스펜션도 후보에 포함한다. 워커 핸드오프용으로 만들어진 프리미티브가 사용자가 원하는 용도로 전용될 수 있는지는 별도 판정 대상이다.
2. 충돌 질문 — 그런 대기 모델이 host goal(HOTL 자동 연속)과 어떻게 부딪히는가.

heartbeat automation과 cron은 사용자가 명시적으로 배제했으므로 대안 후보로 제시하지 않는다. 다만 분류 대상에서까지 빼지는 않는다. 무엇이 그 범주인지 정확히 말해야 나머지가 무엇인지 말할 수 있다.

## 용어 고정

- **턴(turn)** — 하나의 모델 실행 단위. 시작-도구호출-최종메시지로 끝난다.
- **런 중지 후 대기** — 턴이 종료되지도, CPU를 태우지도 않으면서, 외부 이벤트가 오면 같은 맥락에서 재개되는 상태.
- **블로킹 대기** — 턴이 살아 있는 채로 도구 호출 안에서 기다리는 것. 컨텍스트와 워커를 계속 점유한다. 내부적으로 폴링을 하더라도 턴이 살아 있으면 이쪽이다.
- **턴 종료 후 재진입** — 턴을 끝내고 외부 트리거(스케줄러, 사용자, 자동 연속)가 새 턴을 여는 것. heartbeat/cron이 여기 속한다.
- **서스펜션(suspension)** — 미완료 루트 턴을 종료 이벤트 없이 멈추고, 같은 turn ID를 다른 워커가 회수할 수 있게 상태를 영속화하는 것. in-process 태스크 자체는 취소되고, pending input과 interactive waiter는 버려진다. 즉 워커 핸드오프 프리미티브이며 자동으로 "외부 이벤트를 기다렸다가 같은 맥락에서 이어가기"를 뜻하지 않는다.

wp3는 이 네 범주 각각이 Codex에 어떤 모습으로 존재하는지 코드로 판정한다. 어느 것이 사용자가 원하는 것인지 미리 정해 놓지 않는다.

## 작업 단계

### wp2 — Claude 쪽 기준선

무엇이 "Claude의 백그라운드 서브에이전트/세션"인지 먼저 확정한다. 후보:

- Bash 도구의 백그라운드 실행과 타임아웃 auto-background, 출력 회수/중지 도구, `/tasks`(구 `/bashes`)
- Monitor 도구 — 백그라운드 명령의 출력 스트림을 줄 단위 이벤트로 추적. 사용자가 말한 "대기한 채로 추적"의 직접 기준선이므로 반드시 포함한다. Bash 프롬프트가 sleep 폴링을 금지하고 이쪽으로 유도하는지도 확인한다
- Agent 도구(구 Task) 서브에이전트의 전경/백그라운드 구분과 부모 턴 블로킹 여부
- 완료 알림이 부모 대화에 어떻게 들어오는가 (같은 턴인가, 턴 사이인가)
- detached background session (agent view, `--bg`, `/background`)
- Agent SDK의 session 저장 / resume / fork / streaming input / `interrupt()`
- hook 기반 제어: Stop hook의 계속 지시, PreToolUse defer 후 프로세스 재개

증거: `/Users/jun/Developer/codex/150_claude_code` 소스 path:line + 공식 문서 URL.
도구 이름은 이동 표적이다. 로컬 소스 스냅샷과 현재 공식 문서가 어긋나면 둘 다 적고, 현재 동작 판정은 공식 문서를 우선한다.
판정해야 할 것: 각 기능이 부모 턴을 블로킹하는가, 턴 종료 후에도 살아남는가, 나중에 다시 붙을 수 있는가.

### wp3 — Codex 쪽 대응면

`/Users/jun/Developer/codex/121_openai-codex/codex-rs`에서 다음을 path:line으로 확인한다. 대기 표면을 빠뜨리면 "없다"는 결론이 거짓 음성이 되므로 목록을 닫아 둔다.

1. `core/src/unified_exec/` — 백그라운드 셸 세션의 수명, yield 상한, 빈 stdin 폴링
2. `core/src/tools/handlers/multi_agents{,_v2}/` + `core/src/agent/` — 스폰/대기/재개, 부모 턴과의 동시성, 완료 알림 주입 경로
3. `core/src/agent/role.rs` + `core/assets/agent/builtins/awaiter.toml` — 전용 대기 역할이 왜 비활성인지 (음수 증거)
4. `core/src/tools/handlers/sleep.rs` — clock.sleep의 블로킹 성격과 기본 on/off
5. `core/src/tools/handlers/wait_for_environment.rs` — 다른 도구 호출을 막는다고 명시한 대기
6. `code-mode-runtime/src/service.rs` + `code-mode-protocol` — exec 셀 yield와 `wait` 재부착
7. `core/src/session/turn_suspension.rs` + `core/src/codex_thread.rs` — 서스펜션과 회수. `Op::SuspendTurnAndShutdown`, `Op::RecoverTurn`, `recover_turn_if_idle`, `SuspendTurnOutcome::HasLiveDescendants`를 이름으로 확인한다
8. `ext/goal/` + `state/src/runtime/goals.rs` + `state/goals_migrations/` — goal 자동 연속, 상태 집합, continuation deferral
9. app-server 프로토콜 — `turn/start`, `turn/steer`, `turn/interrupt`, `thread/resume`, `thread/fork`, 그리고 `thread/backgroundTerminals/` 계열 전체(list/clean/terminate)
10. `cloud-tasks/` 와 앱 MCP `wait_threads`(`tui/src/dynamic_tools.rs`) — 원격 제출 후 조회, 다른 태스크 완료를 현재 턴에서 대기. 대안 추천이 아니라 분류 대상이다.

각 표면마다 네 가지를 반드시 기록한다. (a) 모델에게 보이는 도구인가, 호스트 `Op`인가, 클라이언트 RPC인가. (b) 기본으로 켜져 있는가. (c) 호출자가 누구인가(모델/app-server/워커/사용자). (d) 대기 중 부모 턴이 살아 있는가.

### wp4 — 매핑, 충돌 분석, 설계 옵션

Claude 기능 ↔ Codex 대응/부재를 1:1 표로 만들고, "런 중지 후 대기 추적"의 가능 여부를 명시적으로 결론낸다.
wp3에서 확인한 10개 표면을 빠짐없이 네 범주로 분류한 표를 함께 싣는다. Claude에 대응물이 없는 Codex 전용 표면(clock.sleep, 비활성 awaiter, 서스펜션, durable sleep 훅)이 1:1 표 밖으로 떨어지지 않게 하기 위해서다.
이어서 goal 활성 상태에서 대기 모델이 어떻게 깨지는지 코드 근거로 쓰고, 실현 가능한 설계를 weak/medium/strong 세 단계로 제시한다.
구현은 이 goal의 범위가 아니다.

## 증거 규칙

모든 핵심 주장은 절대경로:라인 또는 공식 URL을 단다. 서브에이전트가 가져온 인용은 메인이 직접 재확인한 것만 본문에 단정형으로 올리고, 재확인하지 않은 것은 "미검증"으로 표시한다.

부재 주장은 검색어와 함께 적는다. 무엇을 어떤 이름으로 찾았는데 없었는지를 쓰지 않은 "없음"은 증거로 치지 않는다. 제거되거나 비활성화된 기능은 강한 음수 증거이므로 따로 기록한다.

goal 충돌은 네 질문을 고정한다. (1) 블로킹 대기가 턴을 붙잡고 있는 동안 idle 훅이 돌지 않는가. (2) 턴이 끝나면 continuation이 곧바로 새 턴을 켜는가. (3) 서스펜션이 세션을 내리고 thread stop을 낼 때 goal runtime은 어떻게 되는가. (4) goal이 활성 턴에 steering을 주입하는 경로가 블로킹 대기(wait_agent, clock.sleep)를 깨우는가. 네 답이 합쳐져야 대기 모델과 goal이 왜 부딪히는지가 나온다.

## 범위 밖

Codex 본체나 codexclaw 제품 코드 수정, git push, PR, merge, deploy, 외부 메시지, heartbeat/automation 생성.

