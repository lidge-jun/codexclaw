# FEM ↔ Orchestrator Handoff Protocol

## 1. 목적

Realtime Voice에서 FEM은 사용자와 realtime 세션을 담당하고 Orchestrator는 Codex 실행을 담당한다.
handoff는 둘 사이에 긴 내부 실행을 전달하기 위한 명시적 계약이다.
계약의 중심은 음성 오디오가 아니라 입력·transcript·turn ID·voice-ready 응답이다.
이 문서는 전달 포맷, 출력 제한, 재연결과 replay 규칙을 정리한다.

## 2. 위임 envelope

Realtime handoff의 기본 envelope은 [#18597](https://github.com/openai/codex/pull/18597)에 기록된 다음 형태를 따른다.

```text
<realtime_delegation>
  <input>...</input>
  <transcript_delta>...</transcript_delta>
</realtime_delegation>
```

`input`은 Orchestrator가 실행할 사용자 의도를 표현한다.
`transcript_delta`는 FEM이 관찰한 음성 인식의 증분이며 전체 대화와 동일하지 않을 수 있다.
증분을 envelope에 명시하면 부분 인식 결과와 최종 실행 입력을 구분할 수 있다.

## 3. 입력 소유권

[#27116](https://github.com/openai/codex/pull/27116)은 Codex user input을 realtime 세션에 자동으로 mirror하던 동작을 제거했다.
따라서 FEM은 모든 Codex 입력을 무조건 다시 realtime 입력으로 복제하지 않는다.
Orchestrator가 handoff 의미를 결정하고, realtime 쪽에는 필요한 이벤트만 명시적으로 전달한다.
이 규칙은 중복 발화, 이중 실행, transcript와 실제 작업 입력의 불일치를 막는다.

## 4. 음성용 최종 응답

모든 완료된 realtime turn은 짧은 voice-ready 응답으로 끝나야 한다.
이 불변식은 [#27114](https://github.com/openai/codex/pull/27114)의 voice-ready final responses 변경으로 뒷받침된다.
voice-ready는 reasoning trace나 도구 로그를 그대로 읽을 수 있다는 뜻이 아니다.
짧고 자연스럽게 발화할 수 있으며, 완료된 작업의 결과를 사용자에게 전달해야 한다는 뜻이다.
따라서 긴 최종 답변은 FEM에 그대로 보내기 전에 음성용 표현으로 축약한다.

## 5. Assistant 출력 전달

Orchestrator가 생성한 assistant 출력을 realtime handoff에 전달하는 계약은 [#27127](https://github.com/openai/codex/pull/27127)에 있다.
전달 이벤트는 `conversation.handoff.append`이며 최대 1000 token cap이 적용된다.
reasoning과 tool plumbing은 전달 대상에서 제외된다.
이 제한은 realtime 세션을 내부 실행 로그의 복사본으로 만들지 않고 사용자 응답 채널로 유지한다.
전달 순서는 turn의 완료와 연결돼야 하며, 중간 도구 이벤트를 최종 발화처럼 취급해서는 안 된다.

## 6. append API

실험적 `appendSpeech` API는 [#27917](https://github.com/openai/codex/pull/27917)에서 도입됐다.
이 API는 생성된 음성 또는 음성에 준하는 내용을 handoff 결과로 덧붙이는 확장 지점이다.
실험적이라는 표시는 안정적인 기본 계약과 선택적 확장 계약을 구분하기 위해 중요하다.
기본 경로는 여전히 voice-ready text와 `conversation.handoff.append`를 중심으로 검증해야 한다.

## 7. 클라이언트 관리 handoff

클라이언트가 handoff를 관리할 수 있는 설정은 [#27986](https://github.com/openai/codex/pull/27986)의 `clientManagedHandoffs`로 표현된다.
같은 변경은 `codexResponseHandoffPrefix`도 도입해 handoff 응답을 식별할 수 있게 한다.
클라이언트 관리 모드에서는 FEM이 발화 시점과 표시를 더 많이 소유할 수 있다.
그러나 Orchestrator의 turn 완료와 응답 의미를 임의로 바꾸는 권한까지 생기는 것은 아니다.
prefix는 일반 assistant 메시지와 handoff용 메시지를 구분하는 표식으로 사용한다.

## 8. durable turn ID

재연결 가능한 handoff에는 안정적인 turn 식별자가 필요하다.
UUIDv7 turn ID 도입은 [#28826](https://github.com/openai/codex/pull/28826)에 근거한다.
시간 정렬 특성을 가진 UUIDv7은 재연결 시 최근 turn을 찾고 이벤트 순서를 정렬하는 데 유리하다.
FEM과 Orchestrator는 handoff 재전송 시 동일 turn ID를 유지해야 한다.
새 ID를 만들면 같은 작업이 중복 발화되거나 replay가 별도 turn으로 기록될 수 있다.

## 9. 세션 replay

assistant realtime append text는 [#28836](https://github.com/openai/codex/pull/28836)에서 session replay를 위해 추가됐다.
이는 reconnect 후에도 이전 handoff의 assistant 텍스트를 realtime session이 복원할 수 있음을 뜻한다.
replay는 이미 발화된 내용을 다시 실행하는 것이 아니라 세션 기록을 재구성하는 동작이어야 한다.
따라서 replay 이벤트에는 원래 turn ID와 append의 의미가 보존돼야 한다.

## 10. 상태 전이

```text
FEM: partial transcript
          |
          v
delegation envelope
          |
          v
Orchestrator: running Codex turn
          |
          v
completed + voice-ready response
          |
          v
conversation.handoff.append / replay record
```

부분 transcript는 실행 중에 계속 변할 수 있지만, 완료된 turn의 voice-ready 응답은 한 번의 결과로 취급한다.
reasoning·tool plumbing은 상태 관찰에는 유용해도 사용자 발화 payload에는 포함하지 않는다.

## 11. 실패 방지 규칙

자동 input mirror를 되살리지 않는다.
1000 token cap을 넘는 assistant 출력을 한 번의 realtime append로 보내지 않는다.
완료되지 않은 turn을 voice-ready final로 표시하지 않는다.
재연결 시 UUIDv7 turn ID를 바꾸지 않는다.
replay를 새 Codex 실행으로 처리하지 않는다.
이 규칙은 [#27116](https://github.com/openai/codex/pull/27116), [#27127](https://github.com/openai/codex/pull/27127), [#28826](https://github.com/openai/codex/pull/28826), [#28836](https://github.com/openai/codex/pull/28836)의 변경 의도를 실행 불변식으로 압축한 것이다.

## 12. 결론과 감사 포인터

FEM ↔ Orchestrator handoff는 “음성을 Codex에 전달”하는 단순 브리지보다 엄격한 프로토콜이다.
입력 envelope은 [#18597](https://github.com/openai/codex/pull/18597), 출력 제한은 [#27114](https://github.com/openai/codex/pull/27114)과 [#27127](https://github.com/openai/codex/pull/27127), 관리·확장은 [#27917](https://github.com/openai/codex/pull/27917)과 [#27986](https://github.com/openai/codex/pull/27986)에 근거한다.
내구성·replay는 [#28826](https://github.com/openai/codex/pull/28826)과 [#28836](https://github.com/openai/codex/pull/28836)로 추적한다.
이 포인터들은 향후 구현이 transport 변경과 handoff 계약 변경을 서로 혼동하지 않도록 하는 감사 기준이다.

---

## Sol 추가 리서치 (2026-07-13, gpt-5.6-sol)

### FEM Startup Context 예산 ([#18172](https://github.com/openai/codex/pull/18172))

FEM이 realtime 세션 시작 시 받는 Codex 컨텍스트의 정확한 토큰 예산:

| 섹션 | 예산 (approximate tokens) |
|------|--------------------------|
| Current Thread | 1,200 |
| Recent Work | 2,200 |
| Machine / Workspace Map | 1,600 |
| Notes | 300 |
| **총합** | **5,300** |

- 각 섹션은 독립적으로 truncate됨 (heading 포함)
- 중복 middle-truncation 없음, 섹션 순서/경계 보존
- `<startup_context>...</startup_context>` 태그로 감싸서 1회 전송
- 이후 협조는 handoff/item으로 진행, 전체 히스토리 재전송 없음

관련 PR: [#13560](https://github.com/openai/codex/pull/13560), [#14829](https://github.com/openai/codex/pull/14829), [#17519](https://github.com/openai/codex/pull/17519), [#13796](https://github.com/openai/codex/pull/13796), [#28405](https://github.com/openai/codex/pull/28405)

### 음성 출력 Delivery Policy Matrix ([#27986](https://github.com/openai/codex/pull/27986))

| 정책 | 자동 코멘터리/최종 응답 | 클라이언트 책임 |
|------|----------------------|---------------|
| Default | Core가 protocol-native speakable 출력 자동 전송 | 선택적 explicit append |
| `codexResponsesAsItems` | Core가 regular realtime item 자동 생성 | FEM이 반응/발화 결정 |
| `clientManagedHandoffs` | Core가 자동 핸드오프/완료 출력 억제 | 클라이언트가 append API 직접 호출 |

- `codexResponseHandoffPrefix`: v1 자동 코멘터리에만 적용, 최종 답변은 unprefixed
- `clientManagedHandoffs` 우선: 활성화 시 `codexResponsesAsItems`는 자동 경로 선택 불가

### v2 Handoff: Function Tool 방식 ([#14554](https://github.com/openai/codex/pull/14554))

v1이 `conversation.handoff.append`라는 native primitive를 쓰는 반면,
v2는 function tool로 위임을 모델링:
- FEM이 `background_agent` / `remain_silent` function tool을 수신
- function call로 작업 위임/조향
- function-output/conversation item으로 결과 반환
- `response.create`로 FEM에게 spoken continuation 요청

관련 PR: [#15077](https://github.com/openai/codex/pull/15077), [#27319](https://github.com/openai/codex/pull/27319), [#17896](https://github.com/openai/codex/pull/17896)
