# App-Server Request Router와 네 가지 런타임 경로

## 1. 역할

app-server는 표면별 UI와 실행 코어 사이의 공용 경계다.
Request Router는 요청을 바로 모델에 보내지 않고 thread, turn, 세션 소유권을 확인한다.
이 문서에서 “라우터”는 단일 함수 이름이 아니라 이 경계에서 수행되는 분기와 수명주기 조정 전체를 뜻한다.

## 2. 진입점

텍스트 요청의 대표 진입점은 `turn/start`와 `turn/steer`다.
음성 진입점은 `thread/realtime/start`다.
멀티 에이전트 진입점은 `spawn_agent`다.
도구 탐색 진입점은 `tool_search`이며 Connector snapshot과 MCP 호출로 이어진다.
각 요청은 현재 thread의 상태를 기준으로 허용 여부와 후속 이벤트를 결정한다.

## 3. app-server 아키텍처의 근거

TUI를 app-server로 마이그레이션한 [#14018](https://github.com/openai/codex/pull/14018)은 ThreadManager를 중심으로 공용 실행 경계를 세웠다.
이 PR의 중요한 개념은 Active Thread Exclusivity다.
활성 thread를 동시에 임의로 소비하지 않게 함으로써 turn 이벤트의 순서와 사용자 표면의 관찰 가능성을 보장한다.
CLI 표면을 in-process app-server로 연결한 [#13636](https://github.com/openai/codex/pull/13636)은 네트워크 홉 없이도 같은 계약을 사용하게 한다.

## 4. ThreadManager와 독점성

ThreadManager는 thread의 생성, 활성화, 전환, 종료를 조정한다.
활성 thread 독점성은 “한 화면에 한 thread”라는 UI 규칙보다 강한 실행 규칙이다.
한 thread의 turn이 처리되는 동안 다른 요청은 순서를 보존하거나 명시적으로 거절돼야 한다.
이 경계가 없으면 음성 handoff와 텍스트 steer가 같은 thread 상태를 서로 덮어쓸 수 있다.
따라서 router는 입력 payload만 보는 것이 아니라 active session의 점유 상태도 읽는다.

## 5. 네 경로의 분기표

| 경로 | 대표 요청 | 다음 소유자 | 핵심 결과 |
|---|---|---|---|
| Text Turn | `turn/start`, `turn/steer` | Guardian → codex-core Session | Responses API turn |
| Realtime Voice | `thread/realtime/start` | WebRTC/WS → FEM ↔ Orchestrator | voice-ready 응답 |
| Multi-Agent | `spawn_agent` | child thread manager | 자식 결과/상태 |
| Connector/MCP | `tool_search` | snapshot → MCP server | 선택된 tool 호출 |

## 6. Text Turn 분기

router는 text turn을 Guardian으로 넘긴다.
Guardian 뒤에서 codex-core Session이 모델·도구 루프와 Responses API 연결을 소유한다.
`turn/steer`는 새 대화를 만드는 요청이 아니라 활성 turn의 방향을 조정하는 입력이다.
그러므로 라우터는 start와 steer를 같은 “문자열 입력”으로 축약해서는 안 된다.
활성성, 순서, 취소와 후속 이벤트가 서로 다르기 때문이다.

## 7. Realtime Voice 분기

`thread/realtime/start`는 음성 세션을 시작하고 미디어 전송 설정을 준비한다.
라우터는 오디오 프레임을 codex-core의 일반 텍스트 입력처럼 직접 밀어 넣지 않는다.
FEM이 사용자 경험과 세션 이벤트를 관리하고, Orchestrator가 core 작업과 handoff를 조정한다.
실제 envelope과 응답 전달 규칙은 [#18597](https://github.com/openai/codex/pull/18597) 및 [#27127](https://github.com/openai/codex/pull/27127)의 계약을 따른다.

## 8. Multi-Agent 분기

`spawn_agent`는 child thread 생성 요청이다.
child는 부모의 active thread와 동일한 입력 채널로 직접 조작되지 않는다.
v2 sub-agent에 직접 입력을 거부한 [#27173](https://github.com/openai/codex/pull/27173)은 이 소유권 경계를 명시한다.
부모가 자식의 작업을 시작하고 결과를 수집하며, 사용자의 직접 turn은 부모가 계속 소유한다.
모델 override를 지원한 [#32749](https://github.com/openai/codex/pull/32749)은 생성 시 모델 정책도 라우터가 전달해야 함을 보여준다.

## 9. Connector/MCP 분기

`tool_search`는 connector의 현재 snapshot을 기준으로 도구 후보를 찾는다.
snapshot 구현의 근거는 [#32698](https://github.com/openai/codex/pull/32698)이다.
선택된 tool 호출은 MCP 서버와의 프로토콜 경계를 넘으며, 결과는 다시 부모 turn의 도구 결과로 귀결된다.
미리 적재된 도구는 [#29554](https://github.com/openai/codex/pull/29554)의 `preloaded_tools` 계약으로 구별된다.
따라서 검색 결과와 실제 호출 가능한 도구 집합을 혼동해서는 안 된다.

## 10. 오류와 충돌 처리

활성 thread가 없는 steer는 정상적인 text turn으로 자동 승격하지 않는 편이 안전하다.
이미 다른 runtime path가 점유한 thread에 realtime start를 중복 호출하면 상태 충돌을 명시해야 한다.
child thread에 직접 입력을 허용하면 부모의 순서·권한·취소 계약이 깨진다.
MCP snapshot이 오래됐으면 서버 호출 전에 도구 가용성을 재검증할 필요가 있다.
이 네 실패 유형은 모두 라우터가 payload를 전달하기 전에 판단해야 한다.

## 11. 설계 결론

Request Router의 핵심은 네 경로를 하나의 공통 실행 루프로 합치는 것이 아니다.
공통 thread 상태와 이벤트 질서를 보장하되, 각 경로의 소유자를 분리하는 것이 핵심이다.
[#14018](https://github.com/openai/codex/pull/14018)의 ThreadManager와 Active Thread Exclusivity가 공통 기반이다.
[#13636](https://github.com/openai/codex/pull/13636)은 표면이 달라도 app-server 계약은 동일해야 함을 보강한다.
voice와 child thread의 상세 계약은 각각 `002_realtime_voice_path.md`, `003_handoff_protocol.md`를 참조한다.

## 12. 검증 메모

문서의 분기표는 [#14018](https://github.com/openai/codex/pull/14018), [#13636](https://github.com/openai/codex/pull/13636), [#27173](https://github.com/openai/codex/pull/27173)의 설계 근거를 조합했다.
PR 링크는 설명용 장식이 아니라 라우터 책임과 입력 소유권을 추적하는 감사 포인터다.
