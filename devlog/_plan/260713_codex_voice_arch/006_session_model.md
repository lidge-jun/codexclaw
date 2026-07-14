# 006. 세션 모델: 스레드별 realtime 활성화

## 핵심 결론

FEM은 전역에서 항상 실행되는 모델이 아니다.
음성 기능은 특정 스레드에서 `thread/realtime/start`가 호출될 때 활성화된다.
따라서 `[realtime]` 설정이 존재한다는 사실만으로 모든 스레드가 WebRTC 세션을 갖는 것은 아니다.
이 문서는 전역 기본값, 스레드 세션, 모델 결합, child agent 제한을 분리해서 설명한다.

## 전역 설정의 의미

`config.toml`의 `[realtime]` 블록은 realtime 기능의 기본 설정을 제공한다.
예를 들어 연결 옵션, 음성 기본값, 서버 주소 같은 값이 여기에 놓일 수 있다.
그러나 설정 로드는 모델 프로세스를 자동으로 시작하지 않는다.
실제 활성화는 스레드 수명주기의 `thread/realtime/start` 요청이 담당한다.
이 구분은 설정과 런타임 리소스를 혼동하지 않게 하는 핵심이다.

## AVAS 제거

초기 설계에서 사용되던 AVAS 아키텍처 키는 잠긴 뒤 제거되었다.
이 변화는 [#28856](https://github.com/openai/codex/pull/28856)과 연결된다.
현재 모델은 오래된 AVAS 키를 보고 전역 음성 서비스를 가정해서는 안 된다.
대신 현재 세션과 스레드 API가 실제 활성화 여부의 근거다.
문서나 설정에 남은 과거 명칭은 런타임 계약으로 해석하지 않는다.

## 스레드별 구성

### Thread A: realtime 활성

Thread A에서 사용자가 음성을 켜면 WebRTC 세션이 생성된다.
해당 스레드에는 FEM, 음성 전송, Codex Orchestrator의 실행 컨텍스트가 함께 연결된다.
FEM의 direct response와 Orchestrator handoff가 모두 Thread A의 대화 의미를 사용한다.
음성 세션이 살아 있는 동안 마이크와 해당 스레드의 이벤트 수신기가 연결된다.

### Thread B와 C: 텍스트 전용

Thread B와 C는 일반 Codex core Session만 가진다.
WebRTC 세션이 없고 FEM도 생성되지 않는다.
텍스트 `turn/start`는 Orchestrator 경로로 바로 처리된다.
같은 프로세스 안에 여러 스레드가 있어도 음성 리소스는 스레드별로 자동 복제되지 않는다.

### Thread D: child agent

child agent 스레드에서는 realtime을 사용할 수 없다.
음성 시작 요청은 직접 입력으로 허용되지 않으며, [#27173](https://github.com/openai/codex/pull/27173)의 제한과 맞닿아 있다.
child agent는 상위 작업의 실행 단위이지 독립적인 마이크 대화 주체가 아니다.
따라서 child agent에 음성 입력을 전달하는 설계는 지원 계약 밖이다.

## RealtimeConversationManager

`RealtimeConversationManager` 인스턴스는 스레드마다 생성된다.
이 per-thread 인스턴스 모델은 [#12268](https://github.com/openai/codex/pull/12268)의 구조와 연결된다.
관리자는 WebRTC 연결, realtime 이벤트, 음성 대화 상태를 특정 스레드에 귀속한다.
전역 singleton으로 만들면 Thread A의 오디오나 turn 상태가 Thread B에 섞일 수 있다.
인스턴스 수명은 스레드 활성화와 종료에 맞춰야 한다.

## 수명주기

1. `thread/start`가 텍스트 스레드를 생성한다.
2. 초기 상태에서는 Codex core Session만 존재한다.
3. 사용자가 음성을 활성화하면 `thread/realtime/start`가 호출된다.
4. 스레드별 WebRTC 세션과 FEM 관리자가 연결된다.
5. FEM direct response 또는 Orchestrator handoff의 이중 모델 동작이 시작된다.
6. 사용자가 음성을 종료하거나 스레드가 끝나면 realtime 리소스가 정리된다.
7. 스레드는 다시 텍스트 모드로 돌아갈 수 있다.
8. 이때 텍스트 세션의 대화 연속성은 보존되어야 한다.

## 내구성 있는 재연결

WebRTC 연결이 끊겨도 서버 측 Orchestrator가 즉시 사라지는 것은 아니다.
fresh Session 인스턴스에서도 재연결할 수 있는 내구성은 [#28826](https://github.com/openai/codex/pull/28826)에 기록되어 있다.
따라서 클라이언트 연결 수명과 서버 작업 수명을 같은 것으로 취급하면 안 된다.
새 음성 연결은 기존 스레드와 진행 중인 작업을 식별해 다시 붙어야 한다.
재연결 시 UUIDv7 turn ID를 사용하면 이벤트 순서와 새 턴을 구분할 수 있다.

## 세션 겹침 재생

새 세션이 기존 음성 세션의 일부를 놓치면 `appendText`가 이전 겹침 구간을 재생한다.
이 동작은 [#28836](https://github.com/openai/codex/pull/28836)의 session overlap replay와 관련된다.
목적은 단순 transcript 복사가 아니라, FEM이 마지막 대화 상태를 다시 알고 이어 말하게 하는 것이다.
재생 범위는 필요한 겹침 구간으로 제한해야 하며 전체 세션을 매번 재전송하지 않는다.

## 검증 포인트

- `[realtime]` 설정만으로 FEM이 자동 시작되지 않는지 확인한다.
- `thread/realtime/start` 전후의 리소스 차이를 확인한다.
- Thread A만 WebRTC와 FEM을 갖고 B·C는 텍스트 전용인지 확인한다.
- child agent의 realtime 직접 입력이 거부되는지 확인한다.
- `RealtimeConversationManager`가 스레드마다 별도 인스턴스인지 확인한다.
- fresh Session 재연결과 `appendText` 겹침 재생이 기존 작업을 보존하는지 확인한다.
