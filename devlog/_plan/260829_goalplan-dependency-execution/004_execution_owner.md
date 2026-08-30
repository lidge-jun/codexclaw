# 004 — 실행 주체와 과거 판정 제약

출처: T4(실행 표면), T5(과거 판정) 파견.

## 지금 누가 실행하나

메인 에이전트다. 구성 요소들은 전부 보조 역할이다.

```text
goalplan 배열 순서
  → nextOpenTask()
  → Stop 훅이 block reason에 다음 작업을 실어 메인 에이전트에게 돌려줌
  → 메인 에이전트가 직접 수행하거나 spawn_agent 호출
  → spawn-attach 훅이 payload 보강(모델/effort/스킬 inline/중첩 차단)
  → SubagentStop 훅이 verdict나 증거 관찰
```

확인된 사실:

- Stop 훅은 실행기가 아니다. 종료를 잠시 막고 "계속하고 다음 orchestrate 명령을 실행하라"는
  이유를 돌려준다(hook.ts:1087, 1108, 1176). goalplan 참조는 세션 상태의 slug로만 하고
  디렉터리를 훑지 않는다(1135, 1143).
- `spawn-wrapper.ts`는 agent를 만들지 않고 payload만 만든다(23). intent 라우팅(427, 440)과
  surface→스킬 라우팅(41, 163)은 있으나 `routeDispatch()`는 `{role, task_name, fork_turns, message}`만
  반환하며(471, 495) 생산 호출자가 없다. 문서도 "메인 에이전트가 inline으로 spawn한다"고 명시한다.
- 모델/effort는 `.codexclaw/subagents.json`에 역할별로 저장된다(store.ts:16, 38, 215).
  카탈로그는 선택 자료이고 스케줄러가 아니다.
- `cxc review-round open`도 round를 기록하고 launch id와 파견 지시문만 반환한다. spawn 호출은
  없다(review-round-cli.ts:221, 232, 238).

즉 카테고리·모델 라우팅은 있지만 goalplan 항목을 읽어 파견까지 잇는 end-to-end 라우터는 없다.
cxc CLI에도 ready/claim/dispatch/complete 같은 스케줄러 명령이 없다.

## 실행 주체 후보 비교

| 후보 | 장점 | 단점 | 판단 |
| --- | --- | --- | --- |
| 메인 에이전트 직접 | native spawn/wait를 바로 쓰고 작업 성격 판단이 쉽다 | 준비 계산·중복 방지·복구·동시성 제한이 프롬프트 준수에 의존 | 현재 구조 |
| Stop 훅 | 멈춤 감지에 적합 | 짧은 동기 수명주기. 장시간 대기·재시도·리스 관리에 부적합 | 감시자로만 유지 |
| 일회성 cxc CLI | 결정론적 계산, JSON 출력, 테스트, 원자적 claim에 적합 | 호스트 spawn 도구가 없고 호출이 끝나면 수명주기를 소유 못 함 | 제어면에 적합 |
| 장기 daemon/MCP | 큐·리스·재시도·동시성·복구 중앙화 | 별도 프로세스와 호스트 인증·세션 결합·spawn API 필요 | 호스트 API 확보 시 |
| 호스트 메인 세션 | native 권한과 세션 컨텍스트를 유지하며 스케줄러 결과를 실행 | 호스트별 어댑터 필요 | 실행자로 권장 |

## 채택 구조

```text
pabcd-state / cxc  (제어면 = 진실)
  goalplan 의존 그래프
  ready 계산
  상태·증거·재시도 정책
          ↓ 실행 가능 항목 JSON
호스트 메인 세션  (실행면)
  spawn_agent 병렬 호출, wait/cancel
  결과를 cxc 상태 명령으로 반영
          ↓
spawn / SubagentStop 훅  (정책·관찰)
```

핵심 결정: 조사 당시에는 "스케줄러의 진실"이라고 적었지만, **dependency-aware control plane**이
현행 명칭이며 정본 §20이 최종이다. ready/dependency 판정은 pabcd-state에, 실제 파견은 호스트
메인 세션에 둔다. Stop 훅에 실행기를 넣거나, 메인 에이전트가 배열을 해석해 임의로 병렬화하는
구조는 재시작·중복 방지·의존 정확성을 보장하기 어렵다.

claim/lease는 이번 goal 범위에 넣지 않는다. 단일 세션 단일 실행자 전제에서는 wp5의 쓰기 직렬화로
충분하고, 다중 실행자는 필요성이 실증된 뒤에 다룬다(thin-host 원칙).

## 과거 판정 — 반드시 지킬 제약

### REJECT 유지

- OMO/Senpi 스케줄러와 중복 goal/todo/task 엔진 (G8, gap_matrix:14)
- 자동 전이, 복수 Stop 소유자, 두 번째 orchestrator (4.19 판정, 5.0에서도 유지)
- CodexClaw 내부 영속 DAG/WAL 스케줄러, 별도 goal/todo/task DB
- goalplan만으로 Stop을 arm하는 모델 (host goal이 arming gate, goalplan은 이유 보강)
- 원장이나 마크다운 체크박스를 구조화 goalplan 대신 런타임 진실로 쓰기

### ADAPT 승계

- G2: 기존 structured goalplan으로 ADAPT, 새 FSM 없음. `workPhases[].tasks[]`와 `criteria[]`가
  권위 상태이고 원장은 역사다 (gap_matrix:8, 26, 28)
- lane/lead는 task, claim은 criterion으로 표현. 재시도는 완료를 되돌리지 않고 새 pending 추가
  (gap_matrix:30, 34, 37)
- Program 1의 "public goalplan task/criterion operations와 optional research/DAG metadata" —
  여기서 DAG는 메타데이터이고 스케줄러 소유권이 아니다 (axis_synthesis:36, 38, 41)
- mass-ulw에서 가져올 상태 없는 규율 3종: 5필드 항목 계약, 진행 중 scope drift 감독,
  누락과 초과를 모두 실패로 보는 양방향 완료 검증 (020_deep_analysis:128, 133, 135)

### DEFER 유지

- G10 팀 의존 그래프/claim 런타임: participant identity, existence, liveness, claim ownership,
  cycle 검출, wake 증명이 선행돼야 함 (gap_matrix:16, 93, 99)
- lazygap_impl 030.1 freeze→goalplan 자동 seed: objective/criteria 입력이 비어 있어 DEFER.
  현재도 freeze-cli.ts:98이 `acceptanceCriteria: []`를 유지하므로 닫혔다고 볼 근거가 없다
- app-server client를 통한 `thread/goal/set`: 별도 client와 Feature gating 필요

## 이번 작업의 본질

42쪽 보고서의 Goal/task state 판정은 CXC 3 / OMO 4 / Senpi 4, 신뢰도 H/H/H이고 이유는
"completion은 강하지만 public task lifecycle이 없다"였다(score_claim_ledger:30, 35).

따라서 메워야 할 격차는 "새 실행 엔진이 없음"이 아니라 "기존 task/criterion을 지원되는 CLI로
생성·해결·증거 결박하는 lifecycle이 없음"이다. 의존 관계는 그 lifecycle 위에 올리는 메타데이터와
검증 규칙이고, 스케줄러 소유권 이전이 아니다.

## lazygap_impl 030 원래 의도

`goalplan.ts` 주석의 참조는 devlog/_fin/lazygap_impl/030_goalplan_cxc_loop_substrate.md다.
의도는 PABCD FSM이 D-close 후 보존하지 않는 work-phase 커서를 project-local goalplan으로
유지하고(54), host goal DB는 쓰지 않으며(139), goalplan이 Stop을 독자 arm하지 않고 remaining
work를 보강하며(143, 149), 후속 work-aware Stop의 기반이 되는 것이었다(212, 250).

남긴 미구현은 030.1 freeze seed와 app-server goal write 두 가지이고, 둘 다 이번 범위 밖이다.
