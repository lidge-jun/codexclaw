# PR 흐름: 제거, 분리, 안정화, 열린 제안

조사일은 2026-09-05다. 표의 병합 날짜는 GitHub `mergedAt`의 UTC 날짜다. 로컬 `git log --date=short` 날짜와 하루 다를 수 있다. OPEN 표는 `updatedAt` 날짜를 쓴다. 전체 PR 집합이 아니라 기능별로 골라 원문을 읽은 33개 표본이다.

## 병합된 변화

| 병합일 UTC | PR | 조회 상태 | 확인한 변화 |
| --- | --- | --- | --- |
| 2026-04-25 | [#19410](https://github.com/openai/codex/pull/19410) | MERGED | core JS REPL과 관련 handler·kernel·설정 제거. 제거 사유는 빈 PR 본문만으로 단정하지 않음. |
| 2026-05-20 | [#23605](https://github.com/openai/codex/pull/23605) | MERGED | deferred tool을 초기 exec 설명에서 제외하되 runtime 목록에는 유지. |
| 2026-05-23 | [#24159](https://github.com/openai/codex/pull/24159) | MERGED | 동시 셀의 전체 저장 map 덮어쓰기를 key별 write merge로 변경. |
| 2026-05-29 | [#25031](https://github.com/openai/codex/pull/25031) | MERGED | 모델 tool_mode 메타데이터가 로컬 feature fallback보다 우선. |
| 2026-05-29 | [#24180](https://github.com/openai/codex/pull/24180) | MERGED | 셀 수명·delegate·저장 상태를 세션 인터페이스로 묶음. 디스크 영속성 증거는 아님. |
| 2026-06-12 | [#27724](https://github.com/openai/codex/pull/27724) | MERGED | 독립 host 전환 4단계 중 protocol·host crate 분리 단계. |
| 2026-06-15 | [#28365](https://github.com/openai/codex/pull/28365) | MERGED | PostToolUse block을 nested JS promise rejection으로 전달. |
| 2026-07-17 | [#33843](https://github.com/openai/codex/pull/33843) | MERGED | forceRefresh 입력과 runtimeName 반환을 쓰는 app/installed API 병합. |
| 2026-07-30 | [#36217](https://github.com/openai/codex/pull/36217) | MERGED | V8을 독립 host로 이동. optional direct fallback과 code-mode-only fail-closed 구분. |
| 2026-08-03 | [#36781](https://github.com/openai/codex/pull/36781) | MERGED | direct/deferred/code_mode 노출 제어와 client-private MCP meta 제거. |
| 2026-08-05 | [#37114](https://github.com/openai/codex/pull/37114) | MERGED | 세션별 yield 시간 상한·host capability 협상; 시간 초과가 cell 종료는 아님. |
| 2026-08-07 | [#37483](https://github.com/openai/codex/pull/37483) | MERGED | 옵트인 interrupt가 active cell과 nested 호출 취소를 연결; 세션은 유지. |
| 2026-08-12 | [#38257](https://github.com/openai/codex/pull/38257) | MERGED | host 재시작 후 세션 재연결과 generation별 cell ID 처리. |
| 2026-08-14 | [#38621](https://github.com/openai/codex/pull/38621) | MERGED | gRPC nested tool 오류의 64 KiB 제한 제거. |
| 2026-08-14 | [#38645](https://github.com/openai/codex/pull/38645) | MERGED | gRPC notify의 1,024-byte 절단 제거. |
| 2026-08-18 | [#39301](https://github.com/openai/codex/pull/39301) | MERGED | NODE_REPL_AUTH_TOKEN의 child process 환경 유출 차단. |
| 2026-08-23 | [#40257](https://github.com/openai/codex/pull/40257) | MERGED | cua_repl을 Node-backed MCP로 인식하고 정책·증거·이력 표시 연동. |
| 2026-08-25 | [#40678](https://github.com/openai/codex/pull/40678) | MERGED | startup에서 host 연결을 미리 준비하고 초기화 취소·실패 공유 처리. |
| 2026-08-25 | [#40692](https://github.com/openai/codex/pull/40692) | MERGED | WebSocket code-mode transport 제거. stdio와 gRPC 중심으로 정리. |
| 2026-08-27 | [#41058](https://github.com/openai/codex/pull/41058) | MERGED | exec/wait에 걸친 tool inventory와 completeness marker 보강; 성공 여부와 별개. |
| 2026-08-27 | [#41195](https://github.com/openai/codex/pull/41195) | MERGED | candidate model 계획이 현재 모델의 tool inventory를 오염시키지 않도록 router별 확정. |
| 2026-08-29 | [#41452](https://github.com/openai/codex/pull/41452) | MERGED | execute/wait/terminate의 host operation 시간을 별도 기록. |
| 2026-09-01 | [#41950](https://github.com/openai/codex/pull/41950) | MERGED | nested callback과 실행 process의 trace parent·수명 추적 보강. |
| 2026-09-01 | [#42082](https://github.com/openai/codex/pull/42082) | MERGED | nested REPL 승인을 현재 turn의 같은 서버 call ID에 연결; 잘못된 ID는 fallback. |
| 2026-09-04 | [#42744](https://github.com/openai/codex/pull/42744) | MERGED | 모델별 Guardian action-category 정책과 캐시 무효화·unknown-mode 보수 처리. |
| 2026-09-05 | [#42891](https://github.com/openai/codex/pull/42891) | MERGED | 비동기 질문 편집 UI를 TUI event flow에 연결. 로컬 참조 이후 병합. |
| 2026-09-05 | [#42903](https://github.com/openai/codex/pull/42903) | MERGED | 비동기 질문 draft·선택·queue·reconnect 상태 보존. 로컬 참조 이후 병합. |

## 열린 제안

| 최근 갱신일 UTC | PR | 조회 상태 | 읽는 방법 |
| --- | --- | --- | --- |
| 2026-06-25 | [#30104](https://github.com/openai/codex/pull/30104) | OPEN | runtime tool_search BM25 inspector API 제안. OPEN; 로컬 method 미발견. |
| 2026-09-04 | [#31471](https://github.com/openai/codex/pull/31471) | OPEN | connector snapshot owner 추출. 열린 4단계 스택의 기반. |
| 2026-07-30 | [#31472](https://github.com/openai/codex/pull/31472) | OPEN | 명시적 refresh를 context별 직렬화. #31471 기반. |
| 2026-07-08 | [#31476](https://github.com/openai/codex/pull/31476) | OPEN | 한 sampling step의 connector tool snapshot 고정. #31472 기반. |
| 2026-07-08 | [#31487](https://github.com/openai/codex/pull/31487) | OPEN | reload 입력을 쓰는 app/installed 제안. 현재 병합된 API와 계약이 다름. |
| 2026-07-30 | [#31591](https://github.com/openai/codex/pull/31591) | OPEN | 호스트 소유 Apps 병렬화를 여는 별도 플래그 제안. OPEN; 로컬 flag 미발견. |

## 흐름 1: core JS REPL 제거와 Node-backed MCP 지원은 다른 사건

4월의 [#19410](https://github.com/openai/codex/pull/19410)은 core kernel·handler·관련 테스트를 실제 삭제했다. 로컬 commit `8a559e793`의 변경 통계는 63 files, 77 insertions, 9,261 deletions다. 숨겨진 플래그만 켜서 되살릴 상태가 아니다.

8월의 [#39301](https://github.com/openai/codex/pull/39301) → [#40257](https://github.com/openai/codex/pull/40257) → [#42082](https://github.com/openai/codex/pull/42082)는 Node-backed MCP 실행의 환경 변수, 서버 식별, nested approval attribution을 다룬다. 방향은 “core REPL 복원”이 아니라 “외부 실행 환경을 기존 정책·이력 안에서 다루기”로 해석하는 편이 소스와 맞는다. 이 방향 해석은 연구자의 종합이며 작성자의 로드맵 선언은 아니다.

## 흐름 2: V8을 host 경계 밖으로 이동

[#27724](https://github.com/openai/codex/pull/27724)의 본문은 독립 프로세스 전환을 4단계 스택으로 설명한다. [#36217](https://github.com/openai/codex/pull/36217)이 runtime 분리를 마무리하고 host 부재 시 동작을 구분했다.

이어 host 재시작 복구 [#38257](https://github.com/openai/codex/pull/38257), 오류·알림 데이터 보존 [#38621](https://github.com/openai/codex/pull/38621)·[#38645](https://github.com/openai/codex/pull/38645), prewarm [#40678](https://github.com/openai/codex/pull/40678), WebSocket 제거 [#40692](https://github.com/openai/codex/pull/40692)가 병합됐다.

따라서 중간 시점의 WebSocket host 구현을 가져오는 안은 현재 흐름과 어긋난다. stdio/gRPC capability와 설치 패키지의 host discovery를 기준으로 봐야 한다. 이 연구는 PR들을 기능 흐름으로 연결한 것이며, 모든 인접 PR이 git parent-child stack이라는 주장은 아니다.

## 흐름 3: 출력 크기보다 실행 증거의 의미가 먼저

[#24159](https://github.com/openai/codex/pull/24159)는 저장 경쟁을, [#28365](https://github.com/openai/codex/pull/28365)는 hook 차단 의미를, [#41058](https://github.com/openai/codex/pull/41058)은 inventory completeness를 바로잡는다. [#41452](https://github.com/openai/codex/pull/41452)와 [#41950](https://github.com/openai/codex/pull/41950)는 시간·trace attribution을 보강한다.

단순히 큰 배치를 만들거나 출력을 적게 내는 것만으로는 충분하지 않다. 완료·부분 결과·실패·취소·거절을 그대로 식별할 수 있어야 한다. source와 PR 본문에 있는 테스트 목록은 채택 검증 시나리오를 고르는 자료로 쓴다. 이번 조사에서 해당 Rust 테스트를 재실행하지는 않았다.

## 흐름 4: 도구 목록은 모델·세션·노출 경로별 계약

[#23605](https://github.com/openai/codex/pull/23605) → [#25031](https://github.com/openai/codex/pull/25031) → [#36781](https://github.com/openai/codex/pull/36781) → [#41195](https://github.com/openai/codex/pull/41195)를 함께 보면, “config에서 켰다”와 “이 모델이 이 단계에서 이 경로로 호출할 수 있다”가 계속 분리되고 있다.

문서에서 모든 도구 선언을 상시 펼치거나 flat 이름을 임의 복원하는 방식은 이 구분을 깨뜨릴 수 있다. CodexClaw는 실행기가 실제 노출한 이름과 계약을 소비하는 편이 맞다.

## 흐름 5: 열린 스택을 미래의 유일한 답으로 보지 않는다

[#31471](https://github.com/openai/codex/pull/31471) → [#31472](https://github.com/openai/codex/pull/31472) → [#31476](https://github.com/openai/codex/pull/31476) → [#31487](https://github.com/openai/codex/pull/31487)는 PR 본문이 명시한 4단계 dependency stack이다. 조회 시 모두 OPEN이었다.

그러나 `app/installed`는 별도 [#33843](https://github.com/openai/codex/pull/33843)으로 이미 병합됐고 현재 소스에는 `forceRefresh` 계약이 있다. 열린 스택의 `reload` 계약을 복사하면 틀린 호출을 만들 수 있다. “공식 superseded” 상태를 확인한 것은 아니다. 기능 중복과 계약 차이는 확인했다.

같은 이유로 검색 결과에 OPEN PR이 보인다고 “아직 기능 없음”을 단정하지 않는다. 반대로 제목이 비슷한 merged PR만으로 해당 OPEN PR의 모든 불변식이 충족됐다고도 말하지 않는다.

## adjacent lead: 비동기 질문

로컬보다 앞선 main의 12커밋을 읽으며 [#42891](https://github.com/openai/codex/pull/42891)과 [#42903](https://github.com/openai/codex/pull/42903)을 추가 확인했다. 연구 중 질문을 받으면서 작업을 이어 가는 TUI 흐름이다. 현재 desktop에 동일 UX가 있다는 증거는 확보하지 않았으므로 이식·활성화 제안으로 승격하지 않는다.

## 조사 종료 조건

핵심 다섯 흐름에서 원문 상태·현재 소스·활용 판단을 연결했고, 두 번째 조회에서 발견한 반례(`app/installed`)를 반영했다. 새로운 제품 구현은 이 조사 범위 밖이다. PR 본문·커밋·상태를 확인한 표본 조사로 마무리하며, 전체 upstream 로드맵을 망라했다고 주장하지 않는다.
