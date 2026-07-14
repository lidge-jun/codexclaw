# Realtime Voice Path: WebRTC, AVAS, 전송 계층

## 1. 범위

Realtime Voice는 `thread/realtime/start`에서 시작해 미디어 세션과 Codex 작업을 연결한다.
이 경로는 오디오 transport, 음성 세션, FEM, Orchestrator를 한 덩어리로 취급하지 않는다.
transport는 음성을 안정적으로 운반하고, FEM은 사용자 경험을 관리하며, Orchestrator는 작업 handoff를 관리한다.

## 2. 초기 외부 오디오 브리지

WebRTC 외부 오디오 브리지는 [#16396](https://github.com/openai/codex/pull/16396)에서 구체화됐다.
이 구현은 외부 오디오를 libwebrtc 미디어 파이프라인에 연결한다.
jitter buffer는 네트워크 도착 편차를 흡수해 재생·처리 시점의 불규칙성을 줄인다.
PR의 macOS link args 변경은 오디오 기능이 순수 애플리케이션 코드만으로 끝나지 않고 네이티브 WebRTC 링크 조건을 가진다는 증거다.

## 3. WebSocket에서 WebRTC로

WebRTC transport stack은 네 개의 연속 PR로 정리됐다.
[#16805](https://github.com/openai/codex/pull/16805)은 기존 WebSocket 중심 경로를 WebRTC로 교체하는 방향을 제시한다.
[#16806](https://github.com/openai/codex/pull/16806)은 echo cancellation을 포함한 오디오 품질 경계를 강화한다.
[#16807](https://github.com/openai/codex/pull/16807)은 로컬 playback interruption 제거를 포함해 재생 제어 책임을 재배치한다.
이 변화는 transport 선택이 단순 성능 문제가 아니라 사용자 음성 경험의 상태 머신임을 보여준다.

## 4. AVAS 아키텍처 선택

초기 AVAS 전환은 [#27720](https://github.com/openai/codex/pull/27720)에서 realtimeapi를 기본으로 두고 avas를 opt-in하는 형태였다.
그 PR의 중요한 제한은 AVAS가 WebRTC-only였다는 점이다.
이후 [#28856](https://github.com/openai/codex/pull/28856)은 WebRTC에서 항상 AVAS를 사용하도록 architecture selector를 제거했다.
결과적으로 현재 해석에서는 `intent=quicksilver&architecture=avas`가 WebRTC 경로의 고정 계약이다.
따라서 구현 문서에서 사용자가 임의로 realtimeapi와 AVAS를 전환할 수 있다고 쓰면 역사적 상태와 현재 상태를 혼동하게 된다.

## 5. FEM과 Orchestrator

FEM은 마이크·재생·사용자 표시와 realtime 이벤트를 다룬다.
Orchestrator는 음성 입력을 Codex 작업으로 위임하고 결과를 다시 음성 세션에 돌려준다.
두 컴포넌트 사이의 핵심 데이터는 오디오 프레임이 아니라 transcript, delegation envelope, turn ID다.
FEM ↔ Orchestrator handoff의 세부 포맷은 `003_handoff_protocol.md`에 기록한다.

## 6. TUI 연결의 역사

WebRTC media transport를 TUI에 연결한 [#17058](https://github.com/openai/codex/pull/17058)은 클라이언트 표면이 media event를 소비한 시점을 보여준다.
그러나 TUI 음성을 제거한 [#27801](https://github.com/openai/codex/pull/27801)은 음성 소유권을 TUI에 계속 둘 수 없음을 분명히 했다.
현재 TUI는 음성 transport의 권위 있는 구현자가 아니라 app-server 경계의 소비자다.

## 7. WebSocket v2와 typed events

WebSocket 경로의 session 초기화는 [#12036](https://github.com/openai/codex/pull/12036)의 `session.create`와 typed inbound events를 근거로 한다.
이 경로는 WebRTC가 불가능하거나 별도 transport가 필요한 상황에서 이벤트 기반 realtime 세션을 제공한다.
다만 WebRTC 경로에 AVAS가 고정된 현재 규칙과 WebSocket v2의 이벤트 계약은 분리해서 기록해야 한다.
같은 “realtime”이라는 이름이 transport와 architecture를 모두 뜻하지 않기 때문이다.

## 8. 단계별 흐름

1. 클라이언트가 `thread/realtime/start`를 요청한다.
2. app-server가 thread 상태와 realtime 세션을 확인한다.
3. WebRTC라면 AVAS 고정 설정으로 미디어 채널을 구성한다.
4. 외부 오디오는 jitter buffer와 libwebrtc 브리지를 통과한다.
5. FEM이 음성 입력과 transcript 이벤트를 관리한다.
6. Orchestrator가 delegation envelope을 통해 Codex 작업을 시작한다.
7. 작업 결과 중 voice-ready 텍스트만 realtime 세션에 전달한다.
8. turn ID와 transcript를 이용해 재연결·replay를 처리한다.

## 9. 품질과 상태 경계

echo cancellation은 입력 마이크와 출력 스피커의 피드백을 줄이는 transport 품질 기능이다.
jitter buffer는 도착 순서와 재생 안정성을 다루지만 handoff의 의미를 결정하지 않는다.
로컬 playback interruption 제거는 음성 세션의 중단 정책을 상위 상태 머신에 돌려준다.
즉 오디오 품질, 세션 상태, Codex 작업 상태는 서로 다른 관찰 단위다.

## 10. 결론

Realtime Voice의 현재 구조는 WebRTC와 AVAS를 transport·architecture의 기본 조합으로 사용한다.
[#27720](https://github.com/openai/codex/pull/27720)에서 선택지가 열렸고 [#28856](https://github.com/openai/codex/pull/28856)에서 WebRTC AVAS가 고정됐다.
[#16396](https://github.com/openai/codex/pull/16396), [#16805](https://github.com/openai/codex/pull/16805), [#16806](https://github.com/openai/codex/pull/16806), [#16807](https://github.com/openai/codex/pull/16807)은 실제 미디어 안정화 근거다.
handoff 응답의 길이와 replay 규칙은 transport 문서가 아니라 `003_handoff_protocol.md`의 계약으로 관리한다.

## 11. 관찰성과 디버깅 포인트

transport 장애는 연결 수립, 오디오 도착, jitter buffer, playback 상태를 분리해 관찰해야 한다.
handoff 장애는 transcript 생성, envelope 전달, Codex turn 완료, voice-ready append를 분리해 관찰해야 한다.
WebRTC가 연결됐다는 사실만으로 Orchestrator handoff가 성공했다고 판단할 수 없다.
반대로 turn이 완료됐다는 사실만으로 오디오가 사용자에게 재생됐다고 판단할 수도 없다.
이 두 관찰 축을 분리하는 것이 PR 변경을 회귀 분석하는 기본 방법이다.

---

## Sol 추가 리서치 (2026-07-13, gpt-5.6-sol)

### AVAS 아키텍처 상세

AVAS는 "voice-app-server-backed WebRTC architecture"로, `intent=quicksilver&architecture=avas` 쿼리로 선택된다.
공식 약어 확장은 없음. 리뷰어 production-smoke에서 "voice app server"에 연결, "AV App init response"를 수신,
`output=realtimeapi-avas`를 보고하는 것으로 보아, 단순 트랜스포트가 아니라 application/orchestration 레이어다.

### Split-Plane 설계 ([#17057](https://github.com/openai/codex/pull/17057))

- WebRTC call의 `Location` 헤더를 파싱하여 같은 call에 sideband WebSocket으로 합류
- **WebRTC**: 클라이언트 미디어 (오디오 스트림)
- **Sideband WebSocket**: 세션 업데이트, 이벤트, 핸드오프, Codex 통합
- 두 채널이 `call_id`로 연결됨

### v1 vs v2 프로토콜 차이

| 항목 | v1 | v2 |
|------|-----|-----|
| 위임 메커니즘 | `conversation.handoff.append` (native) | function tool (`background_agent`, `remain_silent`) |
| 입력 트랜스크립션 | 없음 | `gpt-4o-mini-transcribe` |
| 노이즈 리덕션 | 없음 | near-field 활성 |
| VAD | 없음 | server VAD, 500ms silence threshold |
| 응답 제어 | 없음 | `interrupt_response`, `create_response` |

WebRTC가 v1에 고정된 이유: AVAS가 v1 conversational call contract만 지원하기 때문 (WebRTC 자체 한계 아님).
직접 WebSocket은 AVAS를 경유하지 않으므로 v2 사용 가능.

관련 PR: [#13531](https://github.com/openai/codex/pull/13531), [#14554](https://github.com/openai/codex/pull/14554), [#14606](https://github.com/openai/codex/pull/14606), [#14828](https://github.com/openai/codex/pull/14828), [#23771](https://github.com/openai/codex/pull/23771)

### 오디오 처리 파이프라인 (역사적)

TUI에서 사용된 로컬 오디오 파이프라인 (현재 #27801로 제거됨):
- `cpal` 마이크 → sample 변환 → 24kHz mono PCM16 → `aec3` 에코 캔슬 → 백엔드
- WebRTC 브릿지: jitter buffering으로 불균일 PCM 도착을 libwebrtc의 정기 프레임 풀과 적응

관련 PR: [#16806](https://github.com/openai/codex/pull/16806), [#16396](https://github.com/openai/codex/pull/16396), [#13192](https://github.com/openai/codex/pull/13192)
