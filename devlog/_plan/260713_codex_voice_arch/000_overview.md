# Codex Voice Architecture 런타임 개요

## 1. 문서 목적

이 문서는 `openai/codex`의 현재 런타임을 app-server Request Router를 중심으로 정리한다.
초점은 음성 기능 자체보다, 텍스트·음성·멀티 에이전트·Connector/MCP가 어디에서 갈라지는가에 있다.
아래 설명은 저장소 구현의 역사와 PR 설계 의도를 함께 읽기 위한 연구용 devlog다.
PR 링크는 해당 구조가 도입되거나 변경된 근거다.

## 2. 한눈에 보는 분기

클라이언트 요청은 먼저 app-server의 Request Router에 들어온다.
Router는 요청 종류와 thread 상태를 판별하고 각 런타임 경로의 수명주기로 넘긴다.
첫 번째 경로는 `turn/start`와 `turn/steer`를 처리하는 Text Turn이다.
두 번째 경로는 `thread/realtime/start`에서 시작하는 Realtime Voice다.
세 번째 경로는 `spawn_agent`로 자식 thread를 만드는 Multi-Agent다.
네 번째 경로는 `tool_search`에서 Connector snapshot과 MCP 서버로 이어지는 Connector/MCP다.

```text
Client surfaces
      |
      v
app-server Request Router
  |          |             |                |
  v          v             v                v
Text Turn  Realtime      Multi-Agent      Connector/MCP
           Voice
  |          |             |                |
Guardian   WebRTC/WS     child threads    snapshot/MCP
  |          |             |                |
codex-core FEM/Orch.     model override   preloaded tools
  |          |             |                |
Responses  voice reply   Responses        external tools
API
```

## 3. Text Turn

Text 요청은 `turn/start` 또는 `turn/steer`로 들어오며 Guardian을 통과한다.
Guardian은 입력과 실행 경계를 관리하고, Codex core Session이 모델 호출과 도구 루프를 소유한다.
최종 모델 통신은 Responses API로 향한다.
TUI를 app-server로 이동시킨 [#14018](https://github.com/openai/codex/pull/14018)은 이 경로의 진입점을 표면별 구현에서 공용 서버로 모으는 근거다.
CLI 표면을 in-process app-server로 연결한 [#13636](https://github.com/openai/codex/pull/13636)은 같은 라우팅 경계를 더 얇게 만든다.

Realtime Voice가 core와 연결된 출발점은 [#12268](https://github.com/openai/codex/pull/12268)이다.
따라서 음성은 별도의 대화 엔진이라기보다, app-server가 시작하고 core 및 오케스트레이터가 협력하는 런타임 경로로 읽어야 한다.

## 4. Realtime Voice

음성 요청은 `thread/realtime/start`에서 생성되며 미디어 전송과 대화 오케스트레이션이 분리된다.
전송은 초기 WebRTC external audio bridge와 이후 AVAS 또는 WebSocket 계층으로 나뉜다.
WebRTC 경로의 외부 오디오 브리지는 jitter buffer와 libwebrtc를 사용한다([#16396](https://github.com/openai/codex/pull/16396)).
초기 WebSocket을 WebRTC로 교체하고 echo cancellation을 보강한 연속 변경은 [#16805](https://github.com/openai/codex/pull/16805), [#16806](https://github.com/openai/codex/pull/16806), [#16807](https://github.com/openai/codex/pull/16807)에 기록돼 있다.
AVAS 기본 아키텍처의 전환 과정은 [#27720](https://github.com/openai/codex/pull/27720)과 [#28856](https://github.com/openai/codex/pull/28856)에서 확인된다.

음성 모델이 즉시 말할 짧은 답과 core의 긴 실행 결과는 FEM(Frontend/Experience Manager)과 Orchestrator 사이 handoff로 조정된다.
이 때문에 voice path의 정확한 계약은 오디오 코덱보다 transcript, turn ID, 응답 길이, replay 규칙에 있다.

## 5. Multi-Agent

`spawn_agent`는 현재 thread를 직접 확장하는 대신 child thread를 만든다.
자식은 독립적인 작업 수명주기를 가지며 부모는 결과와 상태를 조정한다.
모델을 자식마다 다르게 지정할 수 있게 한 [#32749](https://github.com/openai/codex/pull/32749)은 thread 생성이 단순 재귀 호출이 아니라 모델 선택 경계를 포함한다는 증거다.
v2 sub-agent에 직접 입력을 거부한 [#27173](https://github.com/openai/codex/pull/27173)은 사용자 입력의 소유권을 부모 라우터에 남긴다.

## 6. Connector/MCP

`tool_search`는 모든 도구를 매번 동적으로 열거하지 않고 Connector snapshot을 조회한다.
snapshot 기반 연결은 [#32698](https://github.com/openai/codex/pull/32698)의 설계 근거이며, MCP 서버 호출의 안정적인 목록과 메타데이터를 제공한다.
`preloaded_tools`는 [#29554](https://github.com/openai/codex/pull/29554)에서 별도 입력 경계로 다뤄진다.
즉 Connector/MCP 경로는 모델 대화 자체보다 도구 발견·선택·호출을 중심으로 동작한다.

## 7. 역사적 경계

TUI 음성을 제거한 [#27801](https://github.com/openai/codex/pull/27801)은 음성 기능의 소유권이 TUI에 남지 않음을 명확히 한다.
이 변경은 TUI가 미디어 구현을 직접 유지하는 구조에서 app-server와 realtime 계층을 소비하는 구조로의 이동을 보여준다.
따라서 현재 구조를 분석할 때 TUI 코드를 음성의 권위 있는 라우터로 간주하면 안 된다.

## 8. 핵심 불변식

첫째, 모든 표면은 app-server 라우터를 통해 thread와 turn의 소유권을 얻는다.
둘째, Text Turn은 core Session을 중심으로 하고 Realtime Voice는 FEM·Orchestrator handoff를 중심으로 한다.
셋째, child thread와 MCP 서버는 부모 turn의 내부 세부사항과 다른 수명주기를 가진다.
넷째, 음성 출력은 reasoning이나 도구 배선 전체를 그대로 복제하지 않고 voice-ready 결과만 전달한다.
다섯째, turn 식별자는 재연결과 replay를 고려해야 한다.

## 9. 검증 메모

이 개요의 네 경로는 각각 [#14018](https://github.com/openai/codex/pull/14018), [#12268](https://github.com/openai/codex/pull/12268), [#32749](https://github.com/openai/codex/pull/32749), [#32698](https://github.com/openai/codex/pull/32698)로 교차 확인했다.
세부 WebRTC 흐름은 `002_realtime_voice_path.md`에서 분리한다.
요청 라우팅과 Active Thread Exclusivity는 `001_app_server_router.md`에서 분리한다.
FEM ↔ Orchestrator 계약과 replay는 `003_handoff_protocol.md`에서 분리한다.
