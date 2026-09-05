# 조사 결과: 숨은 스위치보다 실행 계약과 활용 방식

## 판단 요약

CodexClaw가 먼저 가져올 것은 V8 실행기나 옛 JS REPL 소스가 아니다. 현재 Codex가 제공하는 실행 환경을 정확히 판별하고, 도구 응답을 작게 읽고 재사용하는 방법을 가르치는 얇은 활용 계층이다. 별도 Node 실행기가 꼭 필요한 작업은 분리한다.

PR 흐름은 세 갈래다. core의 옛 `js_repl`은 제거됐다. V8 code mode는 독립 호스트와 gRPC, 실행 중단, 추적 정보가 보강됐다. Node 기반 `node_repl`·`cua_repl`은 MCP 실행 환경으로 인식하고 승인·이력·증거를 연결하는 방향으로 발전했다. 이 셋을 같은 REPL의 버전 차이로 보면 안 된다. [제거 #19410](https://github.com/openai/codex/pull/19410), [독립 호스트 #36217](https://github.com/openai/codex/pull/36217), [CUA 연동 #40257](https://github.com/openai/codex/pull/40257).

이전 대화의 “`js_repl`은 제거됐다”는 판단은 유지한다. 다만 그것만으로 “Node 기반 실행은 더 이상 없다”고 넓혀 해석하면 틀린다. #40257은 REPL 서버를 새로 구현한 PR이 아니라, 기존 Node-backed MCP 서버 이름과 동작을 core·Guardian·TUI에서 다루도록 보강한 PR이다.

## 네 가지 기준점을 분리한다

| 기준 | 이번 확인 결과 | 의미 |
| --- | --- | --- |
| 로컬 참조 소스 | `d2d5b70241fb448044c1c088a977cc720d70443a` | 이하 로컬 line anchor의 기준 |
| GitHub main | `ddf04ad26789d040f9ef6a96736f76602e35a6cc` | 로컬보다 12커밋 앞섬. checkout 변경 없이 compare API로 확인 |
| 설치된 CLI | `codex-cli 0.153.2` | `codex features list`를 실행한 바이너리 |
| GitHub latest release | `rust-v0.153.4`, 2026-09-04 23:25:48 UTC | 조회 당시 release 표기. 설치·업그레이드하지 않음 |
| 현재 대화 도구 | `functions.exec/wait`, `mcp__cua_repl.js/js_reset` 노출 | CLI 기본 플래그와 별도 관측. CUA는 이번 조사에서 실행하지 않음 |

[main 비교](https://github.com/openai/codex/compare/d2d5b70241fb448044c1c088a977cc720d70443a...ddf04ad26789d040f9ef6a96736f76602e35a6cc), [조회한 release](https://github.com/openai/codex/releases/tag/rust-v0.153.4).

CLI 출력은 `code_mode=false`, `code_mode_host=true`, `code_mode_interrupt=false`, `code_mode_prewarm=false`였다. 그런데 이 대화에는 code mode가 실제로 있다. 모순으로 보지 않는다. 모델 메타데이터의 `tool_mode`가 설정 플래그보다 우선할 수 있고, 앱의 세션 설정도 CLI 조회와 같다고 보장할 수 없다. 이 대화에서 무엇이 우선했는지까지 추적하지는 않았다. [#25031](https://github.com/openai/codex/pull/25031), 로컬 `codex-rs/core/src/tools/mod.rs:68`.

## 현재 code mode로 가능한 것과 경계

로컬 소스 루트는 `/Users/jun/Developer/codex/121_openai-codex`다. 다음 경로는 이 루트 기준이다.

| 능력 | 확인 근거 | 사용 시 지켜야 할 경계 |
| --- | --- | --- |
| 순수 JS 계산·JSON 가공 | `code-mode-protocol/src/description.rs:15` | 각 호출은 fresh V8 isolate. 일반 변수·함수가 다음 호출에 남지 않음 |
| `store/load` | `code-mode-runtime/src/runtime/callbacks.rs:205` | 직렬화 가능한 값만 저장. 파일·함수·소켓 핸들 저장소가 아님 |
| 호출 간 결과 재사용 | `code-mode-runtime/src/session_runtime/mod.rs:163` | 시작 시 snapshot, 완료 시 key별 writes 반영. 실행 중 셀끼리 live 공유 메모리가 아님 |
| 병렬 도구 요청 | `core/src/tools/parallel.rs:116` | 실제 실행 admission은 runtime이 결정. JS의 `Promise.all`만으로 겹침을 입증할 수 없음 |
| 지연 도구 발견 | `code-mode-protocol/src/description.rs:11` | 설명에 없더라도 `ALL_TOOLS`와 `tools`에 있을 수 있음. 실제 노출 확인 후 사용 |
| 부분 출력·양보·재개 | `code-mode-protocol/src/description.rs:22` | `yield_control`, `notify`, `wait`를 구분. wait 시간은 작업 완료 기한이 아님 |
| 이미지·오디오 반환 | `code-mode-protocol/src/description.rs:30` | 지원 ContentBlock/data URL 규약을 따름. 임의 원격 미디어 URL이나 stdout을 이미지로 취급하지 않음 |

위 표의 경로 앞에는 모두 `codex-rs/`가 붙는다.

현재 대화에서는 앞선 호출에서 저장한 작은 객체를 다음 호출에서 읽었고, JS 계산값 `21`, `process=undefined`, `fetch=undefined`를 확인했다. 이번 PR 조사에서도 응답 객체를 세션 저장소에 보관하고 다음 호출에서 PR 메타데이터만 꺼내 `004_source_ledger.json`을 작성했다. 이는 같은 세션 내 재사용 근거이지, 프로세스 재시작·대화 재개·다른 task로의 영속성 근거가 아니다.

### 저장 상태의 함정

[#24159](https://github.com/openai/codex/pull/24159)는 동시 셀이 전체 map을 덮어쓰던 문제를 key별 merge로 바꿨다. 서로 다른 key의 writes가 사라지는 문제는 줄지만 같은 key의 경쟁을 해결하는 트랜잭션은 아니다. 시작 시 snapshot을 읽고 완료 시 `HashMap::extend`하는 현재 구현도 이를 보여 준다. 로컬 `code-mode-runtime/src/session_runtime/mod.rs:279`.

채택 가이드는 key를 작업·자료별로 나누고, 실패·중단된 셀의 저장 성공을 가정하지 않아야 한다. 장기 증거는 devlog나 사용자가 허용한 파일에 따로 남긴다. PR 제목의 “durable session interface”도 디스크 persistence 증거가 아니다. [#24180](https://github.com/openai/codex/pull/24180).

### 병렬 호출의 함정

현재 MCP handler는 서버의 `supports_parallel_tool_calls` 또는 도구의 `readOnlyHint`를 확인한다. executor는 이에 따라 read/write lock으로 입장을 조절한다. 로컬 `core/src/tools/handlers/mcp.rs:128`, `core/src/tools/parallel.rs:155`.

호스트 소유 Codex Apps의 병렬화를 별도 플래그로 여는 [#31591](https://github.com/openai/codex/pull/31591)은 조회 시 OPEN이었다. 따라서 모든 connector를 병렬 호출하도록 강제하는 스킬은 부적절하다. 독립적인 읽기부터 실행 겹침을 측정하고, 순서 의존 쓰기·rate limit·서버의 직렬화 계약은 보존해야 한다.

### 도구 발견과 실행 권한의 함정

[#23605](https://github.com/openai/codex/pull/23605)는 지연 도구의 선언을 초기 exec 설명에서 숨기되 runtime 목록에는 남겼다. [#36781](https://github.com/openai/codex/pull/36781)은 direct/deferred/code-mode 노출을 각각 제외할 수 있게 했다. 목록 미노출은 미설치와 다르고, 발견됐다는 사실도 모든 호출 경로가 허용된다는 뜻이 아니다.

`ToolSearch`·`WebSearch` spec을 평범한 nested callable로 변환하지 않는 코드도 있다. 따라서 `tools.tool_search`를 항상 쓸 수 있다고 가정하지 않는다. 현재 도구 목록을 검색하고, 있으면 해당 도구의 계약을 읽고, 없으면 `ALL_TOOLS` 방식 등 실제 제공된 경로를 쓴다. 로컬 `codex-rs/tools/src/code_mode.rs:176`.

## PR 상태만 읽었으면 놓칠 반례

열린 [#31487](https://github.com/openai/codex/pull/31487)은 `app/installed`를 추가하는 제안이다. 그러나 같은 이름의 API는 [#33843](https://github.com/openai/codex/pull/33843)으로 이미 병합돼 현재 소스에 있다.

| 항목 | OPEN #31487의 제안 | 병합된 #33843 및 현재 소스 |
| --- | --- | --- |
| 입력 | 필수 `reload` | 선택 `forceRefresh`, 기본 false |
| 반환 | `id`, `enabled`, `callable` | 위 필드에 `runtimeName` 추가 |
| 플래그 | `apps_runtime_state_refactor`로 gate | 현재 소스에서 이 이름 미발견. `app/installed` route와 handler는 존재 |
| 판단 | 그대로 적용할 미래 API 계약이 아님 | 현재 계약을 기준으로 이용 가능성을 별도 확인 |

근거: 로컬 `codex-rs/app-server-protocol/src/protocol/common.rs:915`, `codex-rs/app-server-protocol/src/protocol/v2/apps.rs:31`, `codex-rs/app-server/src/request_processors/apps_processor/installed.rs:35`.

OPEN 스택이 공식적으로 superseded됐다고 판정하지는 않는다. 확인한 사실은 API 이름이 겹치고 계약이 다르다는 것뿐이다. 상태·커밋·현재 코드 세 가지를 함께 확인해야 한다.

## 남겨 둘 불확실성

- CUA 도구는 이 대화에 노출돼 있지만 이번 조사에서 브라우저나 앱을 열지 않았다. 패키지 import·범용 Node eval 지원은 각 실행 환경의 안내를 읽은 뒤 판단해야 한다.
- `store/load`의 장기 persistence, 용량 상한, host 재시작 후 값 복구는 이번 조사에서 입증하지 않았다.
- prewarm·interrupt를 켰을 때 이 앱·provider 조합에서 얻는 이익은 측정하지 않았다.
- tool inventory completeness는 실행 성공이 아니다. 전체 목록을 확보해도 각 호출의 실패·거절·취소를 따로 읽어야 한다. [#41058](https://github.com/openai/codex/pull/41058).
- source·PR에 등장한 기능이 설치된 CLI 또는 현재 앱에 같은 방식으로 배포됐다고 단정하지 않는다.
