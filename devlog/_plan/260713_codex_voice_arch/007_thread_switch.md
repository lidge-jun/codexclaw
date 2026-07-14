# 007. 스레드 전환과 음성 세션 동작

## 핵심 제약

Codex UI는 여러 스레드를 동시에 렌더링하지 않는다.
현재 선택된 한 스레드의 `mpsc::Receiver`만 `select!` 루프에서 활성 상태가 된다.
이 동작은 Active Thread Exclusivity로 정리되며 [#14018](https://github.com/openai/codex/pull/14018)과 연결된다.
따라서 스레드 전환은 화면 탭만 바꾸는 일이 아니라 이벤트 수신 소유권과 오디오 자원을 이동하는 일이다.

## 채널 구조

각 스레드는 `ThreadEventChannel`을 가진다.
이 구조는 Sender, Receiver, ThreadEventStore의 세 요소로 이루어진다.
Sender는 실행 중인 컴포넌트가 이벤트를 보낸다.
Receiver는 현재 UI가 선택한 스레드의 이벤트를 읽는다.
ThreadEventStore는 Receiver가 현재 활성 상태가 아닐 때 이벤트를 버퍼링한다.
이 세 요소를 스레드별로 유지해야 비활성 스레드의 진행 상황이 유실되지 않는다.

## Thread A에서 Thread B로 전환

전환 전 상태를 Thread A가 음성 활성 상태라고 가정한다.

1. UI는 `select!` 루프의 활성 Receiver를 A에서 B로 옮긴다.
2. A의 WebRTC 오디오 세션을 멈춘다.
3. 마이크를 해제해 B 또는 운영체제의 다른 입력 사용을 막지 않는다.
4. 서버 측 durable Orchestrator는 종료하지 않는다.
5. A에서 진행 중이던 turn은 서버에서 계속 실행될 수 있다.
6. A로 향하는 이벤트는 A의 ThreadEventStore에 쌓인다.
7. UI는 B의 Receiver를 활성화하고 B의 텍스트 화면을 렌더링한다.
8. B는 별도 realtime 시작을 하지 않는 한 텍스트 모드로 동작한다.

## WebRTC와 Orchestrator의 분리

음성 세션을 멈춘다는 말은 서버 작업을 취소한다는 뜻이 아니다.
마이크와 오디오 송수신은 클라이언트의 물리·연결 자원이다.
반면 Orchestrator는 서버 측 세션과 실행 턴을 관리한다.
이 둘을 함께 닫으면 스레드 전환 중에 코딩 작업이 불필요하게 취소된다.
내구성 있는 서버 실행은 [#28826](https://github.com/openai/codex/pull/28826)의 설계 근거다.
전환 시 필요한 동작은 오디오 Receiver의 정지와 이벤트 버퍼링이지, 작업 전체의 삭제가 아니다.

## Thread A로 돌아오기

1. UI가 A를 다시 선택한다.
2. `select!` 루프의 Receiver 소유권을 A로 복원한다.
3. 새 WebRTC 세션을 만들고 기존 서버 세션에 durable reconnection을 수행한다.
4. 새 연결에서 UUIDv7 turn ID를 사용해 새 turn과 이전 이벤트를 구분한다.
5. 새 세션이 놓친 이전 대화 겹침 구간을 `appendText`로 재생한다.
6. A의 FEM은 재생된 맥락을 이용해 음성 대화를 이어간다.
7. ThreadEventStore에 쌓인 A의 결과 이벤트를 Receiver가 순서대로 소비한다.
8. 사용자는 전환 중 진행된 작업의 결과와 음성 대화의 연속성을 회복한다.

## appendText 재생

`appendText`는 새 WebRTC 연결이 과거 발화 일부를 놓친 상황을 보완한다.
이는 [#28836](https://github.com/openai/codex/pull/28836)의 session overlap replay 동작이다.
재생 데이터는 전체 세션 dump가 아니라 새 세션과 겹치는 최근 구간이어야 한다.
너무 적게 재생하면 FEM이 “무엇을 하던 중이었는지” 잊는다.
너무 많이 재생하면 중복 발화, 지연, 컨텍스트 오염이 생긴다.
turn ID와 이벤트 순서를 함께 사용해야 중복 재처리를 줄일 수 있다.

## 단일 마이크의 물리적 제약

마이크는 여러 스레드가 동시에 공유할 수 있는 논리 플래그가 아니다.
하나의 물리 입력 자원은 한 realtime 세션만 점유해야 한다.
A와 B를 동시에 음성 활성화하면 오디오 프레임의 목적지를 결정할 수 없고, 개인정보가 섞일 수 있다.
따라서 UI의 단일 활성 스레드 정책은 화면 설계이면서 하드웨어 안전장치다.
비활성 스레드는 이벤트를 버퍼링할 수 있지만 마이크를 계속 듣지 않는다.

## 진행 중 작업의 가시성

Thread A가 비활성인 동안에도 Orchestrator 이벤트가 발생할 수 있다.
이 이벤트는 B 화면에 잘못 표시하지 않고 A의 Store에 보관한다.
사용자가 A로 돌아오면 Receiver가 버퍼를 읽어 해당 스레드의 시간 순서로 표시한다.
Store는 단순 로그가 아니라 스레드별 UI 재개를 위한 경계다.
버퍼 상한, 종료 시 정리, 중복 이벤트 정책은 별도로 검증해야 한다.

## 상태 전이 요약

`A: voice active → A: audio stopped + server running → B: text active`가 첫 전환이다.
복귀는 `B: text active → A: receiver restored → new WebRTC + durable reconnect → A: voice resumed`다.
이 상태 전이에서 서버 작업의 생존과 클라이언트 오디오의 생존은 서로 다르다.
전환 구현은 두 생명주기를 한 상태 변수로 합치지 않아야 한다.

## 관련 PR과 검증 포인트

- 활성 Receiver 독점은 [#14018](https://github.com/openai/codex/pull/14018)에서 확인한다.
- durable 서버 재연결은 [#28826](https://github.com/openai/codex/pull/28826)에서 확인한다.
- 세션 겹침 재생은 [#28836](https://github.com/openai/codex/pull/28836)에서 확인한다.
- 실제 전환 테스트에서는 A의 마이크 해제, A 작업 지속, Store 버퍼링, A 복귀 음성 재개를 모두 확인한다.
- 두 스레드가 동시에 마이크를 점유하지 않는지 운영체제 오디오 상태까지 확인한다.
