# 004. 모델 호출 흐름 비교: 텍스트 1회와 음성 2회

## 연구 목적

이 문서는 Codex의 텍스트 턴과 realtime 음성 턴이 모델 호출을 어떻게 분리하는지 기록한다.
핵심 차이는 음성 입력이 단순히 다른 입력 모달리티가 아니라, FEM의 판단 호출과 Codex Orchestrator의 실행 호출로 나뉜다는 점이다.
따라서 음성 코딩 요청의 체감 지연시간, 컨텍스트 전달, 오류 경계를 호출 단위로 분석해야 한다.

## 텍스트 전용 경로

1. 사용자가 TUI 또는 데스크톱 텍스트 입력창에 요청을 입력한다.
2. 클라이언트는 `turn/start` 요청으로 새 턴을 시작한다.
3. Codex Orchestrator가 요청과 세션 컨텍스트를 받아 모델을 호출한다.
4. 일반적인 텍스트 코딩 턴에서는 GPT-5.x 계열 모델 호출이 한 번 발생한다.
5. 호출 결과는 Responses API의 HTTP streaming 이벤트로 반환된다.
6. Codex core는 도구 호출, 권한 확인, 파일 변경, 최종 텍스트 생성의 실행 주체다.
7. 사용자는 스트리밍된 텍스트 결과를 직접 읽는다.
8. 요약하면 `입력 → turn/start → Orchestrator → 텍스트 응답`이다.
9. 여기서 “1회”는 모델 추론 호출의 수를 뜻하며, 도구 호출이나 스트림 이벤트 수를 뜻하지 않는다.
10. 하나의 모델 턴 안에 여러 도구 호출이 있어도 상위 라우팅 관점에서는 Orchestrator 호출이다.

## 음성 경로

1. 사용자가 마이크로 말하면 WebRTC가 오디오 프레임을 realtime 세션으로 전달한다.
2. FEM(Frontend/Facilitator 계층)은 Realtime API에서 첫 모델 호출을 수행한다.
3. 첫 호출의 역할은 음성을 듣고, 발화를 해석하고, 직접 답할지 위임할지 판단하는 것이다.
4. FEM이 일반 질문으로 판단하면 그 호출 안에서 음성 응답을 생성한다.
5. FEM이 코딩 작업으로 판단하면 handoff를 선택한다.
6. handoff 시 FEM은 요청과 최근 대화 스냅샷을 Delegation Envelope로 포장한다.
7. Codex Orchestrator는 전달된 작업을 두 번째 모델 호출에서 실제로 실행한다.
8. Orchestrator는 Responses API의 HTTP streaming으로 도구·세션 실행을 진행한다.
9. 결과가 생성되면 서버가 handoff 결과를 FEM 대화에 다시 append한다.
10. FEM은 결과를 음성으로 변환해 사용자에게 말한다.
11. 요약하면 `음성 → FEM 판단(1차) → handoff → Orchestrator 실행(2차) → 결과 → FEM 발화`다.
12. 코딩 요청의 정상 경로는 텍스트보다 모델 호출 경계가 하나 더 많다.

## 호출 수 매트릭스

| 요청 유형 | 1차 모델 | handoff | 2차 모델 | 최종 출력 |
|---|---|---:|---|---|
| 텍스트 일반 질문 | Orchestrator | 없음 | 없음 | 텍스트 |
| 텍스트 코딩 작업 | Orchestrator 실행 | 없음 | 없음 | 텍스트 |
| 음성 일반 질문 | FEM 듣기·판단·응답 | 없음 | 없음 | FEM 음성 |
| 음성 코딩 작업 | FEM 듣기·판단 | 있음 | Orchestrator 실행 | FEM 음성 |

## 간단한 질문의 예외

“지금 몇 시야?” 같은 질문은 코드 변경이나 도구 실행이 필요하지 않다.
이 경우 FEM은 direct response 판단을 하고, Orchestrator로 넘기지 않는다.
따라서 음성이라고 항상 2회 호출되는 것은 아니다.
이 최적화는 지연시간과 비용을 줄이지만, FEM이 질문을 잘못 분류할 수 있는 위험을 만든다.

## API 경계

FEM의 통신 표면은 WebRTC 기반 Realtime API다.
오디오 스트리밍, turn 감지, 음성 출력이 한 realtime 세션에 묶인다.
Orchestrator의 통신 표면은 HTTP streaming 기반 Responses API다.
도구 호출과 Codex 세션 실행은 이 두 번째 표면에서 처리된다.
이 구조는 FEM과 Orchestrator가 같은 모델 호출을 공유한다는 뜻이 아니다.
둘은 서로 다른 목적과 수명, 전송 프로토콜을 가진 경계다.

## 설계상 의미

음성 코딩의 지연시간은 오디오 인식, FEM 판단, handoff 전송, Orchestrator 실행, 결과 재주입, 음성 합성의 합이다.
특히 FEM이 작업 의도를 충분히 전달하지 못하면 Orchestrator는 파일이나 요구사항을 다시 물어야 한다.
반대로 FEM이 모든 질문을 handoff하면 간단한 질문도 불필요하게 두 모델 경계를 통과한다.
운영 지표는 단순한 전체 응답 시간뿐 아니라 direct/handoff 비율과 handoff 후 재질문 비율도 기록해야 한다.
음성 UX에서 “말할 수 있는 최종 응답” 보장은 실행 결과가 없는 경우에도 필요하다.

## 관련 PR 및 근거

- Realtime 음성 경로의 기본 동작은 [#27114](https://github.com/openai/codex/pull/27114)의 voice-ready 최종 응답 보호와 연결된다.
- handoff 결과의 FEM 재주입은 [#27127](https://github.com/openai/codex/pull/27127)의 결과 반환 경계를 함께 봐야 한다.
- Delegation Envelope 형식은 [#18597](https://github.com/openai/codex/pull/18597)에 정의된 계약을 따른다.

## 검증 체크리스트

- 텍스트 `turn/start`가 Orchestrator 단일 경로로 들어가는지 확인한다.
- 음성 일반 질문이 실제로 handoff 없이 종료되는지 확인한다.
- 음성 코딩 요청에서 FEM과 Orchestrator 호출이 각각 관측되는지 확인한다.
- Orchestrator 결과가 FEM에 재주입된 뒤 음성 출력으로 끝나는지 확인한다.
- 실패 시에도 사용자가 들을 수 있는 최종 응답이 만들어지는지 확인한다.
