---
created: 2026-08-15
status: design
workPhase: wp2
tags: [codexclaw, goalplan, d-close]
---

# 030 — CYCLE-COMPLETION-01: 미완 사이클을 닫지 못한다

## 결함

`advanceWorkPhase()`는 현재 work-phase의 pending task를 보지 않고 `done`으로
바꾼다(`goalplan.ts:832`). `remainingWorkPhases()`도 phase status만 보므로
(`goalplan.ts:568`) 완료 판정이 이를 잡지 못한다. 기존 테스트가 이 동작을
고정하고 있다(`goalplan.test.ts:224`).

## 안전성 근거

83개 goalplan 전수 조사: work-phase 245개, task 826개 중 763개 done.
`done`인 work-phase 227개 중 pending task 보유는 **3개(1%)**.
task status는 실제로 관리되므로 이 게이트는 정상 사용을 막지 않는다.

## 변경할 함수

### `goalplan.ts` — `advanceWorkPhase()`

반환형을 판별 유니온으로 바꾼다.

```ts
export type AdvanceResult =
  | { kind: "ok"; plan: Goalplan }
  | { kind: "tasks_pending"; workPhaseId: string; pending: GoalplanTask[] }
  | { kind: "no_active" };
```

`effectiveActiveWorkPhaseId()`로 현재 phase를 찾은 뒤, `status !== "done"`인
task가 있으면 `tasks_pending`을 반환하고 **plan을 전혀 건드리지 않는다**.

불변식 (감사 MAJOR 2): `tasks_pending` 반환 시 입력 plan과 개별 task status는
변경되지 않는다. D가 task를 자동으로 done 처리하지 않는다는 기존 성질
(`goalplan.test.ts:316`)을 유지한다.

### `goalplan.ts` — `isGoalplanComplete()` / `validateGoalplan()`

`done`인데 pending task를 가진 work-phase를 미완으로 취급한다. 둘 다 고쳐야
`loop show`의 complete와 `loop validate`의 판정이 어긋나지 않는다(감사 MINOR 1).

## preflight 위치 (감사 BLOCKER 2 + MAJOR 2)

핵심이다. 현재 두 경로 모두 state/ledger를 **먼저 쓰고** `advanceWorkPhase()`를
부르므로, 거기서 거부하면 "FSM은 IDLE, ledger는 done, goalplan은 미완"이 된다.

감사관이 지목한 정확한 삽입 지점:

- **채팅**: `hook.ts:647`(applyHumanTransition 실패 처리)과 `hook.ts:653`(state write)
  **사이**. `result.control === "done"`일 때만 실행.
- **CLI**: `orchestrate-cli.ts:337`(transition 성공)과 `:342`(D write) **사이**.

`transition()` 자체보다 뒤에 두는 이유: 그 함수는 순수하고 I/O가 없으므로,
legality/attest 오류가 먼저 나야 기존 오류 우선순위가 보존된다.

성공한 `AdvanceResult.plan`은 보관해서 재사용한다 — mutation 후 재조회하지 않는다.

거부 시 상태:

| 대상 | 값 |
|------|-----|
| `state.phase` | `C` (불변) |
| PABCD ledger | 무기록 |
| goalplan | 무변경 |

## fail-closed 결정 (감사 MAJOR 4)

`readGoalplan()`은 모든 오류를 null로 삼킨다(`goalplan.ts:474`).
이 저장소는 goalplan 수동 편집이 정상 워크플로이므로, 파일이 사라지면
게이트가 열리는 구멍은 실질적이다.

**bound slug가 비어 있지 않은데 goalplan이 unreadable이면 D-close를 거부한다.**
slug 자체가 없으면(HITL 세션) 기존대로 통과한다.

`no_active`도 bound goalplan에서는 거부한다 — one-work-phase-one-cycle 계약상
닫을 phase가 없는데 D를 닫는 것은 일관되지 않는다.

## activation scenario

| 시나리오 | 트리거 방법 | 관측 가능한 효과 |
|----------|-------------|------------------|
| pending 거부 | task 1개를 pending으로 두고 `cxc orchestrate D` | 비영 exit, 남은 task 이름 출력, status가 여전히 C |
| 정상 통과 | 모든 task done 후 D | phase IDLE, work-phase done, 다음 phase 활성 |
| unreadable 거부 | bound slug 상태에서 goalplan.json 임시 이동 후 D | 거부 + 명시적 사유 |
| HITL 무영향 | slug 없는 세션에서 D | 기존대로 통과 |

## 알려진 우회 (정직하게)

- task를 1개만 선언하거나 처음부터 done으로 선언하면 통과한다.
- task 없는 work-phase도 통과한다(`goalplan.test.ts:245`가 정상 입력으로 고정).
- 여러 구현 단위를 하나의 coarse task로 합치면 통과한다.

이 게이트는 **분해 품질을 강제하지 않는다**. 선언한 완료 조건을 지키게 할 뿐이다.
분해 품질은 로드맵 락의 판단이며 023이 그 경계를 명시한다.

`writeGoalplan()`이 실패하는 I/O fault에서는 여전히 불일치가 가능하다.
이 설계의 원자성 주장은 **정책 거부에 한정**된다.

## 소비자 (감사 MAJOR 1)

production 2곳: `hook.ts:689`, `orchestrate-cli.ts:362`.
테스트 11곳: `goalplan.test.ts` 8곳, `work-phase-states.test.ts` 3곳.
`null` assertion과 `result.workPhases` 직접 접근이 전부 깨지므로 함께 고친다.

