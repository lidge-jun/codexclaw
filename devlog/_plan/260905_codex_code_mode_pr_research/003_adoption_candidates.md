# 채택 후보와 검증 시나리오

이 문서는 연구 결과에 따른 제안이다. 실행 계획 승인이나 설정 적용 기록이 아니다. 순서는 의존 관계를 따른다: 실행 환경 판별 → 활용 규약 → 계측 → 설정 실험. 코드를 가져오는 작업은 실제 native gap이 남을 때만 검토한다.

## 실행 환경 판별부터

CodexClaw의 native capability 문서에 아래 구분을 넣는 것이 첫 후보다.

- configured flag: CLI·파일에 적힌 값.
- effective tool mode: 모델·세션·호스트 가용성을 반영한 값.
- exposed tools: 지금 모델에 실제로 제공된 도구.
- invocation result: 직접 호출해 확인한 성공·거절·오류.

`js_repl=true`, `tool_search=true`처럼 제거된 플래그를 복구책으로 안내하지 않는다. [`features/src/lib.rs:985`](https://github.com/openai/codex/blob/d2d5b70241fb448044c1c088a977cc720d70443a/codex-rs/features/src/lib.rs#L985)와 [#25031](https://github.com/openai/codex/pull/25031)이 근거다.

현재 관련 owner는 `structure/60_native_capabilities.md`와 `plugins/codexclaw/skills/dev/SKILL.md`다. 변경한다면 기존 capability routing 문맥에서 연결하고, 모든 task에 큰 도구 설명을 상시 주입하지 않는다.

## Code-mode 활용 규약

새 V8 wrapper·상시 MCP·daemon 없이 기존 dev reference에 필요한 내용만 추가하는 안을 우선 검토한다. 별도 스킬이 필요한지는 사용 빈도와 trigger 중복을 본 뒤 결정한다.

| 패턴 | 제안 | 반례·검증 시나리오 |
| --- | --- | --- |
| 대량 응답 처리 | 원본은 작업별 key에 저장하고 다음 판단에 필요한 필드만 출력 | 값 일부를 잘라 실패 원인이 사라지지 않는지 확인 |
| 병렬 읽기 | 독립성 확인 후 제한된 fan-out. 실패를 보존해야 하면 `allSettled` 고려 | 하나가 실패해도 다른 결과가 보이는지, 실제 실행 시간이 겹치는지 측정 |
| 의존 호출 | 앞 호출의 결과·성공 여부를 확인한 뒤 다음 호출 | 앞 호출 실패 때 후속 쓰기가 실행되지 않아야 함 |
| 상태 재사용 | 새 셀 시작 때 필요한 key를 읽고 없으면 명시적 재수집 | 세션 reset·host 교체 시 오래된 key를 성공 결과로 취급하지 않음 |
| 출력 제어 | 작은 `max_output_tokens`, 필요한 `text`, 큰 원본은 재조회 가능한 근거 경로 | 잘린 출력으로 완전한 성공을 판정하지 않음 |
| 긴 작업 | `yield_control`/`wait`와 외부 프로세스 핸들을 구분 | wait timeout을 완료·실패·프로세스 종료로 오인하지 않음 |
| 승인과 hooks | 중첩 도구의 승인·거절·취소를 원래 의미대로 유지 | PreToolUse 거절 후 호출 없음; PostToolUse 거절은 이미 실행된 효과를 롤백하지 않음 |

[#28365](https://github.com/openai/codex/pull/28365)는 PostToolUse 차단 시 JS promise를 reject하도록 고쳤다. 모든 exception을 빈 배열로 바꾸거나 자동 재시도하면 이 차단 의미가 사라질 수 있다. 읽기 재시도와 외부 쓰기 재시도도 구분해야 한다.

## 실험 후보: 효과는 아직 미측정

| 후보 | 기대가 생기는 이유 | 채택 전 필요한 관측 | 되돌림·중단 조건 |
| --- | --- | --- | --- |
| `code_mode_prewarm` | 첫 turn 이전 host 연결, 중복 실패 공유 [#40678](https://github.com/openai/codex/pull/40678) | 동일 모델·도구 집합의 cold first-call 지연, startup 비용, 실패·종료 시 지연 | 해당 실험 프로필에서만 false로 복귀. 연결 실패 증가 시 보류 |
| `code_mode_interrupt` | 턴 interrupt와 실행 중 셀 취소 연결 [#37483](https://github.com/openai/codex/pull/37483) | 부작용 없는 긴 도구를 중단해 active cell·하위 호출 종료와 이미 저장된 상태 확인 | 실험 프로필에서 false로 복귀. orphan 작업·상태 유실이면 보류 |
| `code_mode_only` 및 direct 예외 | 도구 노출을 줄이면서 필요한 직접 호출 보존 | 일반 mode와 동일 작업 성공률, 도구 누락, 승인 흐름, malformed JS | 전역 강제 금지. 원래 mode로 복귀 |
| 실행 메타데이터 활용 | 셀과 nested call·wait를 연결 [#41058](https://github.com/openai/codex/pull/41058) | 부분 inventory·argument truncation·취소를 완료와 구분 | incomplete를 PASS로 판정하면 채택 중단 |

플래그는 이 문서에서 켜지 않는다. 특히 `code_mode_only`는 호스트 부재 때 direct fallback을 기대하면 안 된다. 독립 호스트 전환 PR은 해당 경로를 fail-closed로 유지했다. [#36217](https://github.com/openai/codex/pull/36217).

## Node/CUA REPL

현재 CUA 실행 환경은 브라우저·앱 조작용이다. code mode에 없는 Node 기능이 있다는 이유만으로 범용 shell 우회 실행기로 사용하지 않는다. 공개된 API와 권한 범위를 먼저 읽는다.

오래 유지해야 하는 브라우저 객체나 앱 세션은 CUA 쪽 후보이고, JSON 집계·도구 조합은 code mode 쪽 후보다. 단발성 로컬 JS 프로그램은 기존 명령 실행 도구로 충분할 수 있다. 이 경우에도 파일 수정은 작업 규칙과 승인 범위를 따른다.

옛 core JS REPL을 복원하는 안은 보류한다. 삭제된 실행기·Node 의존성·sandbox·승인·수명 관리까지 떠안는데, 구체적으로 막힌 작업이 아직 없다. [#19410](https://github.com/openai/codex/pull/19410), [#39301](https://github.com/openai/codex/pull/39301), [#42082](https://github.com/openai/codex/pull/42082).

## 열린 제안과 이미 대체 경로가 있는 제안

- **검색 inspector #30104:** runtime BM25 index를 읽는 디버그 API 제안이다. OPEN이며 이번 로컬 소스에서 `toolSearch/inspect` 미발견. 현재 도구 발견이 반복 실패한다는 사례부터 모으고, 별도 inspector를 구현하기 전 재확인한다.
- **connector snapshot 스택 #31471 → #31472 → #31476 → #31487:** 모두 OPEN. 그러나 `app/installed` 자체는 #33843으로 별도 병합됐다. 스택 전체를 가져오는 대신 현재 cache·request-stability 구현과 실제 결함을 다시 비교해야 한다.
- **Apps 병렬화 #31591:** OPEN이며 해당 새 플래그는 로컬에서 미발견. 이미 허용된 read-only 호출까지 금지할 이유도, 모든 Apps를 강제로 병렬화할 이유도 없다.
- **비동기 질문 TUI #42891 → #42903:** 조회한 main에 병합됐고 로컬 참조보다 새롭다. HITL 연구·질문 수집에 유용할 가능성은 있지만 desktop parity나 현재 세션 지원은 확인하지 않았다. 이번에 UI를 이식하지 않는다.

각 PR의 링크·상태·시간은 [PR 흐름](002_pr_flow.md)과 [source ledger](004_source_ledger.json)에 있다.

## 평가 설계: 숫자는 실행 후 채운다

같은 모델·reasoning 설정·호스트·도구 목록·입력 자료를 고정해 기존 방식과 활용 규약 적용 방식을 비교한다. cold/warm을 구분하고 실행 순서도 번갈아 배치한다.

| 작업 | 정확성 기준 | 수집 항목 |
| --- | --- | --- |
| 독립 PR 12개 읽고 비교 | 번호·상태·merge 시간·근거 링크 누락 없음 | model round trips, 실제 도구 호출 수, 모델에 출력한 bytes/tokens |
| 큰 JSON에서 조건별 집계 | 원본 집계와 일치, 예외 항목 보존 | 재조회 횟수, 저장 크기, 출력 크기 |
| 지연 도구 발견 | 미발견·노출 제외·미설치를 구분 | 발견 성공률, 최초 guide 크기, 불필요한 전체 목록 출력 |
| 일부 읽기 실패 | 성공·실패 결과 모두 회수 | 재시도 횟수, 실패 원인 보존, 부분 결과 오판 |
| 긴 호출 중단 | 허용된 범위의 작업만 중단, handle 상태 확인 | cancel latency, active cells, orphan 여부 |

host wall time은 전체 사용자 체감 시간과 다르다. [#41452](https://github.com/openai/codex/pull/41452)는 client 지연과 wait 사이 idle을 빼고 host operation 시간을 기록한다. 둘을 함께 수집해야 “빨라졌다”는 판단을 할 수 있다. 현재 연구에서 속도·토큰 절감 수치를 만들지 않았다.

## 제안 결론

채택 검토 순서는 실행 환경 판별 → code-mode 활용 규약 → 최소 계측 → 분리된 설정 실험이다. 이 순서로도 해결되지 않는 사례가 생길 때만 새 실행기나 MCP를 설계한다. 다음 작업을 시작한다면 위 후보 중 범위를 정하고 정확한 파일 diff와 검증 명령을 새 P 계획으로 확정한다.
