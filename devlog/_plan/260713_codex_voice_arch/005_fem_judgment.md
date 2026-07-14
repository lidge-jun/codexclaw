# 005. FEM 판단 구조와 Delegation Envelope

## 연구 목적

FEM은 음성 세션의 첫 번째 모델 경계이며, 모든 발화를 직접 해결하는 실행기가 아니다.
시스템 프롬프트는 FEM에게 코딩 작업을 Codex Orchestrator로 위임하도록 지시한다.
이 문서는 direct response와 handoff를 가르는 판단 구조, 전달 데이터의 범위, 실패 시 안전장치를 정리한다.

## FEM의 역할

FEM은 Realtime API와 WebRTC 세션의 전면에 있다.
사용자의 음성을 듣고 turn을 닫으며, 발화의 의도와 필요한 실행 수준을 해석한다.
일반적인 정보 질문에는 짧은 응답을 직접 생성할 수 있다.
코딩, 파일 수정, 명령 실행, 저장소 조사처럼 Codex의 작업 능력이 필요한 요청은 위임해야 한다.
따라서 FEM은 “답을 아는가”보다 “누가 이 요청을 실행해야 하는가”를 먼저 판단한다.

## 판단 분기

### Direct response

일반 질문, 간단한 설명, 현재 대화 안에서 해결 가능한 요청은 direct response 후보이다.
“오늘 날씨가 어때?” 또는 “지금 몇 시야?”처럼 Codex 작업 공간에 접근할 필요가 없는 질문이 예다.
이 분기에서는 FEM이 별도의 Orchestrator 호출을 만들지 않는다.
FEM이 Realtime 음성으로 최종 문장을 생성하므로 모델 호출은 1회다.
응답은 짧고 명확해야 하며, 사용자가 들을 수 있는 자연스러운 문장이어야 한다.

### Handoff

코드 작성, 버그 수정, 테스트 실행, 파일 읽기, 저장소 탐색은 handoff 후보이다.
요청이 짧아도 실행 대상이나 작업 공간이 필요하면 직접 코딩하려 하지 않는다.
FEM은 실제 패치나 셸 명령을 수행하지 않고, 요청을 Envelope에 담아 Orchestrator로 넘긴다.
Orchestrator가 작업을 완료하면 결과를 다시 FEM 대화에 append한다.
FEM은 그 결과를 사용자에게 말할 수 있는 최종 응답으로 바꾼다.

## 판단 오류

첫 번째 오류는 FEM이 코딩 요청을 직접 해결하려는 것이다.
이 경우 파일 시스템, 도구 정책, 권한 심사, 세션 상태가 실행되지 않아 답변이 부정확해질 수 있다.
두 번째 오류는 단순 질문을 불필요하게 handoff하는 것이다.
이 경우 지연시간이 증가하고 Orchestrator의 컨텍스트 예산을 소비한다.
세 번째 오류는 요청의 핵심 제약을 Envelope에서 누락하는 것이다.
따라서 분류 결과만 보내지 말고 실제 요청과 최근 대화 맥락을 함께 보내야 한다.

## voice-ready 안전장치

모든 realtime turn은 최종적으로 voice-ready 응답을 만들어야 한다.
이 요구는 [#27114](https://github.com/openai/codex/pull/27114)의 보호 장치와 연결된다.
handoff 실패, 빈 결과, 실행 중단처럼 정상 결과가 없는 경우에도 FEM이 말할 문장이 필요하다.
사용자에게 내부 이벤트명이나 빈 음성 스트림만 노출하면 안 된다.
FEM은 실패를 짧게 설명하고, 필요한 다음 행동이나 재시도 방법을 안내해야 한다.
이 보장은 direct response와 handoff 결과 모두에 적용된다.

## Delegation Envelope

handoff payload의 외형은 다음과 같다.

```xml
<realtime_delegation>
  <input>actual request</input>
  <transcript_delta>recent conversation snapshot</transcript_delta>
</realtime_delegation>
```

이 계약은 [#18597](https://github.com/openai/codex/pull/18597)에 근거한다.
`input`은 사용자가 실제로 요청한 작업을 보존하는 필드다.
`transcript_delta`는 FEM이 최근에 들은 대화의 선별된 스냅샷이다.
이 값은 전체 세션 transcript가 아니다.
오래된 대화와 무관한 음성 잡음을 모두 전달하지 않고, 현재 판단에 필요한 최근 맥락만 담는다.
따라서 Envelope는 전체 대화 백업이 아니라 실행 위임을 위한 curated snapshot이다.

## 스냅샷의 의미

최근 스냅샷에는 요청의 대상, 사용자가 추가한 제약, 직전 FEM 응답, 미완료 지시가 포함될 수 있다.
반면 세션 전체를 복사하면 토큰 비용과 개인정보 노출 범위가 커진다.
스냅샷이 너무 짧으면 Orchestrator가 같은 질문을 다시 해야 한다.
스냅샷이 너무 길면 handoff 지연과 컨텍스트 혼선이 증가한다.
따라서 “최근”은 단순 문자 수가 아니라 현재 작업을 재구성할 수 있는 의미 단위로 해석해야 한다.

## 결과 반환

Orchestrator가 실행을 마치면 결과는 `conversation.handoff.append` 경로로 FEM에 돌아온다.
결과 반환에는 [#27127](https://github.com/openai/codex/pull/27127)의 1000 토큰 상한이 적용된다.
상한은 음성 세션에 지나치게 긴 실행 로그를 주입하지 않기 위한 경계다.
FEM은 전체 로그를 낭독하지 않고, 완료 여부·핵심 변경·검증 결과를 짧게 말해야 한다.
필요한 상세 정보는 텍스트 UI나 후속 요청에서 확인할 수 있다.

## 검증 포인트

- 시스템 프롬프트가 코딩 작업 handoff를 명시하는지 확인한다.
- 일반 질문은 직접 응답하고 Orchestrator 호출이 없는지 확인한다.
- 코딩 요청은 실제 `input`과 최근 `transcript_delta`를 포함하는지 확인한다.
- Envelope가 전체 세션을 무조건 복사하지 않는지 확인한다.
- 반환 결과가 1000 토큰 상한 안에서 voice-ready 문장으로 변환되는지 확인한다.
- 분류 오류와 handoff 실패 모두에서 사용자에게 유효한 다음 응답이 전달되는지 확인한다.
