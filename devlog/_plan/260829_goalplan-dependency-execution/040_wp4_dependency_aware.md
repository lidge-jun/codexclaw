# 040 — wp4: 의존 인식 선택

> 상태: 설계 잠금 초안
> 선행 조건: wp2(스키마 v3·reviver 보존), wp3(참조 무결성·DAG 검증) 완료
> 범위: 실행 가능한 work phase/task 선택, 부분 의존 대기 사유, D-close 다음 phase 선택, Stop·attest 표면 정합성
> 범위 밖: task/criterion lifecycle·steering 입력 확장·ready 조회·ledger 이벤트 생산·그 밖의 공개 표면(wp6), 공통 락과 RMW 직렬화(wp5), 실행 루프·턴 생성·동시성 상한 관리(호스트 소유)

## 1. 목표와 변경 불변식

현재 선택기는 배열 순서만 본다.

- `effectiveActiveWorkPhaseId()`는 명시 커서, 첫 `in_progress`, 첫 `pending` 순으로 고른다.
- `nextOpenTask()`는 `done | blocked | superseded` phase를 제외하고 첫 pending task를 고른다.
- `advanceWorkPhase()`는 현재 phase 뒤의 첫 pending phase를 고르고, 없으면 앞쪽으로 돌아간다.
- `readStopWorkContext()`는 `nextOpenTask()` 결과를 그대로 “Remaining work”로 노출한다.
- `orchestrate-cli.ts`의 gated attest는 `effectiveActiveWorkPhaseId()` 결과에 결박된다.

실제 구현 근거는 `goalplan.ts:707-718`의 현재 `nextOpenTask()`, `goalplan.ts:1029-1094`의
`advanceWorkPhase()`와 `effectiveActiveWorkPhaseId()`, `hook.ts:1081-1192`의 Stop context 소비부,
`orchestrate-cli.ts:632-655`의 D-close `no_active` 분기다. 이 줄 범위는 wp4 B 착수 직전 다시
확인하고, 소스가 움직였으면 같은 symbol을 기준으로 before 블록을 갱신한다.

wp4는 이 우선순위와 순회 방향을 유지하되, `dependsOn`이 있는 항목에 한해서 **모든 직접 의존이 완료된 후보만** 통과시킨다. 이 goal이 만드는 것은 **dependency-aware control plane**이며 스케줄러나 실행기가 아니다. 두 번째 상태 저장소와 자동 상태 변경도 추가하지 않는다.

잠글 불변식은 다음과 같다.

1. phase 의존은 대상 phase의 `status === "done"`일 때만 충족이다.
2. task 의존은 같은 work phase 안의 대상 task가 `status === "done"`일 때만 충족이다. task id는
   소속 phase 안에서만 유일하며 plan 전역 중복을 허용한다. phase를 넘는 task 의존은 금지한다.
3. `blocked`, `pending`, `in_progress`, `superseded`는 의존 완료로 간주하지 않는다. 특히 `superseded`는 “다른 phase가 대신한다”는 기록이지 성공 기록이 아니므로, 의존 소비자는 대체 phase로 명시적으로 재배선해야 한다.
4. 선택기는 상태를 쓰지 않는다. 의존 대기와 교착은 `goalplan.json`에서 파생한 진단일 뿐이며 phase/task를 자동으로 `blocked`로 바꾸지 않는다.
5. `advanceWorkPhase()`는 현재 phase의 모든 task가 done인지 확인하는 기존 CYCLE-COMPLETION-01을 그대로 유지한다. 실행 불가능한 pending task를 건너뛰어 phase를 닫지 않는다.
6. 다음 phase는 현재 phase를 done으로 반영한 **닫힌 뒤 스냅샷**에서 계산한다. 그래야 `dependsOn: [current.id]`가 즉시 충족된다.
7. 다음 phase 순회는 기존과 동일하게 “현재 뒤쪽의 첫 pending → 없으면 앞쪽의 첫 pending”이다. 각 구간에서 의존 미충족 후보만 건너뛴다.
8. `dependsOn === undefined`와 `dependsOn: []`는 선택 의미상 모두 의존 0개다. 저장 표현은 구분한다. `undefined`는 v1/v2 유산 필드 부재를 유지하고, `[]`는 v3에서 명시한 빈 의존 목록을 유지한다. 선택기에서 정규화해 다시 쓰지 않는다.
9. v1/v2처럼 모든 phase/task에 `dependsOn`이 없으면 반환값, 후보 우선순위, wrap 순회, 상태 전이가 변경 전과 100% 같아야 한다.
10. 선택기는 `schemaVersion`을 읽지 않는다. `dependsOn` 필드의 부재·빈 배열·원소만 보고 같은
    알고리즘을 적용한다.
11. wp4는 ready 판정과 진단만 계산한다. 큐 실행, 자동 착수, 새 턴 생성, 재시작, 동시성 제한을
    추가하지 않는다. 호스트 continuation이 턴을 이어 간다.
12. wp4가 잠근 ready 의미는 wp6의 `readyWorkPhases()`와 `readyTasks()`가 그대로 쓴다. wp6은 그
    계산 결과를 Stop 표면에 넣어 에이전트가 지금 착수할 항목과 대기 사유를 함께 읽게 한다.
13. `dependencyDeadlock()`은 ready task나 닫을 수 있는 phase가 하나라도 있으면 `null`인 전역 교착
    판정 전용이다. `dependencyWaitReasons()`는 그 gate와 무관하게 미충족 의존 때문에 기다리는
    phase/task 사유를 모두 낸다. 두 함수는 같은 내부 문장 생성기를 쓴다.

## 2. 의존 대기와 교착의 정의

wp6 등록 입구가 wp3의 dangling/self/cycle 검증을 호출하고 쓰기 전에 거부하므로 wp4는 유효한
DAG를 전제로 한다. 그래도 런타임 상태 때문에 실행 가능한 항목이 0개일 수 있다.

예:

```json
{
  "workPhases": [
    { "id": "wp1", "status": "blocked", "blockedReason": "vendor release", "dependsOn": [] },
    { "id": "wp2", "status": "pending", "dependsOn": ["wp1"] }
  ]
}
```

사이클은 없지만 `wp1`은 상태상 실행할 수 없고 `wp2`는 `wp1`이 done이 아니어서 실행할 수 없다. 이를 **dependency deadlock**으로 보고한다. 여기서 deadlock은 그래프 사이클이라는 뜻이 아니라 “미완료 상태는 남았지만 지금 실행하거나 닫을 수 있는 항목이 하나도 없음”이라는 런타임 진단이다.

실행 가능 항목이 있다고 보는 조건은 다음 둘 중 하나다.

- 의존이 충족된 `pending | in_progress` phase에 실행 가능한 pending task가 하나 이상 있다.
- 의존이 충족된 `pending | in_progress` phase의 task가 모두 done이어서 해당 phase를 D-close할 수 있다.

반대로 아래 조건을 모두 만족하면 교착이다.

- `remainingWorkPhases(plan)`이 비어 있지 않다.
- 위 두 실행 가능 조건이 모두 거짓이다.
- 원인은 명시적 `blocked` phase 또는 미충족 phase/task 의존으로 설명할 수 있다.

교착 진단은 직접 blocker만 보고한다. DAG 전체 경로를 critical path처럼 확장하지 않는다. 출력 예시는 다음과 같이 고정한다.

```text
Dependency deadlock: no executable work remains while unfinished items exist: work-phase wp1 is blocked (vendor release); work-phase wp2 waits for work-phase wp1 (blocked)
```

이 진단은 ledger에 쓰지 않는다. ledger 이벤트는 역사이며, 파생 상태를 매 Stop마다 적으면 같은
상태가 중복 기록된다. 성공한 등록·lifecycle의 ledger 이벤트는 wp6이 생산하고, wp5는 공통 락과
RMW 직렬화만 맡는다.

전역 교착과 부분 대기는 구분한다. 아래처럼 실행 가능한 task와 미충족 의존 task가 함께 있으면
`dependencyDeadlock()`은 `null`이지만 `dependencyWaitReasons()`는 대기 사유를 낸다.

```text
task wp1/t-waiting waits for task wp1/t-upstream (pending)
```

work phase 사유는 기존 교착 진단과 같은
`work-phase <id> waits for work-phase <dependency-id> (<status>)` 형식이다. task 사유는 030의
phase-local 표기 관례에 맞춰
`task <phase-id>/<task-id> waits for task <phase-id>/<dependency-id> (<status>)`로 고정한다.
`dependencyWaitReasons()`는 blocked 자체를 대기 사유로 만들지 않는다. blocked 진단은 전역 교착의
직접 원인으로만 `dependencyDeadlock()`에 남는다.

## 3. 변경 파일 지도

### MODIFY

- `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`
  - phase/task 의존 충족 판정
  - `effectiveActiveWorkPhaseId()`, `nextOpenTask()`, `advanceWorkPhase()` 의존 인식
  - 실행 불가 상태의 파생 진단 `dependencyDeadlock()`
  - ready와 무관한 부분 대기 진단 `dependencyWaitReasons()`와 공통 문장 생성기
- `plugins/codexclaw/components/pabcd-state/src/hook.ts`
  - Stop 안내가 의존 미충족 task를 “Remaining work”로 제시하지 않도록 함
  - 의존 교착이면 구체적인 blocker 안내
  - 채팅 D-close의 `no_active` 안내도 같은 파생 진단 사용
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`
  - CLI D-close의 `no_active` 안내에 같은 교착 진단 사용
  - gated attest 결박 코드는 유지하되 dependency-aware active와 일치함을 테스트로 고정
- `plugins/codexclaw/components/pabcd-state/dist/goalplan.js`
  - build가 갱신한 tracked `goalplan.ts` 배포 산출물
- `plugins/codexclaw/components/pabcd-state/dist/hook.js`
  - build가 갱신한 tracked `hook.ts` 배포 산출물
- `plugins/codexclaw/components/pabcd-state/dist/orchestrate-cli.js`
  - build가 갱신한 tracked `orchestrate-cli.ts` 배포 산출물
- `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`
- `plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts`
- `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`

### NEW

- 없음

### DELETE

- 없음

## 4. `goalplan.ts` 상세 diff

경로: `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`
구분: **MODIFY**

### 4.1 wp4 진입 시 타입 전제

아래 필드는 wp2에서 타입과 reviver에 이미 들어와 있어야 한다. wp4는 필드 자체를 다시 정의하거나 reviver를 수정하지 않는다.

```ts
export interface GoalplanTask {
  id: string;
  title: string;
  status: TaskStatus;
  /** Absent on v1/v2; [] means explicitly dependency-free in v3. */
  dependsOn?: string[];
  /** Required with a non-blank value when a v3 task is done. */
  outcome?: string;
}

export interface GoalplanWorkPhase {
  id: string;
  title: string;
  status: WorkPhaseStatus;
  tasks: GoalplanTask[];
  criteriaIds: string[];
  /** Absent on v1/v2; [] means explicitly dependency-free in v3. */
  dependsOn?: string[];
  blockedReason?: string;
  supersededBy?: string;
}
```

wp2 reviver는 `undefined`를 `[]`로 채우지 않고, 저장된 배열이 있을 때만 필드를 붙여야 한다. 이 구분은 선택 의미에는 영향을 주지 않지만 v1/v2의 write-back 형태를 보존하는 데 필요하다.

#### 4.1.1 wp4가 추가하는 공개 export

정본 §2의 기존 API 이름은 바꾸지 않는다. wp4는 그 목록을 다음 세 공개 export로 보완한다.

```ts
export interface DependencyDeadlock {
  reasons: string[];
}

export function dependencyDeadlock(plan: Goalplan): DependencyDeadlock | null;
export function dependencyWaitReasons(plan: Goalplan): string[];
```

반환 shape는 다음과 같이 고정한다.

- 실행 가능 task 또는 D-close 가능한 phase가 있거나 미완료 phase가 없으면 `null`이다.
- 교착이면 `{ reasons: string[] }`이며 `reasons`는 비어 있지 않다.
- `reasons`는 선언 순서대로 찾은 직접 blocker만 담는다. 전이 경로를 확장하거나 상태를 쓰지 않는다.
- `DependencyDeadlock`과 `dependencyDeadlock()`은 `goalplan.ts`의 공개 export다.
- `dependencyWaitReasons()`도 `goalplan.ts`의 공개 export다. ready 여부를 gate로 삼지 않고 미충족
  phase/task 의존의 직접 사유를 선언 순서대로 돌려준다. 충족된 의존만 있으면 빈 배열이다.
- wp3 무결성 검증 사유는 `030_wp3_integrity.md`의 문자열을 글자 그대로 쓴다. 이 런타임 진단은
  무결성 사유를 새로 정의하거나 바꾸지 않는다.

### 4.2 의존 판정과 교착 진단 추가

추가 위치: `remainingWorkPhases()` 직후, 현재 `nextOpenTask()` 앞.

#### Before

```ts
// wp3 적용 후 상태
/** The next pending task in the first non-done work phase, or null when none remain. */
export function nextOpenTask(plan: Goalplan): { wp: GoalplanWorkPhase; task: GoalplanTask } | null {
  for (const wp of plan.workPhases) {
    // A blocked phase's tasks are not actionable and a superseded phase's tasks
    // belong to its replacement, so neither can be "the next thing to do".
    if (wp.status === "done" || wp.status === "blocked" || wp.status === "superseded") continue;
    for (const task of wp.tasks) {
      if (task.status !== "done") return { wp, task };
    }
  }
  return null;
}
```

#### After

```ts
function workPhaseDependenciesMet(plan: Goalplan, phase: GoalplanWorkPhase): boolean {
  return (phase.dependsOn ?? []).every(
    (dependencyId) => plan.workPhases.find((candidate) => candidate.id === dependencyId)?.status === "done",
  );
}

function taskDependenciesMet(phase: GoalplanWorkPhase, task: GoalplanTask): boolean {
  return (task.dependsOn ?? []).every(
    (dependencyId) => phase.tasks.find((candidate) => candidate.id === dependencyId)?.status === "done",
  );
}

function isRunnablePhase(plan: Goalplan, wp: GoalplanWorkPhase): boolean {
  return (
    (wp.status === "pending" || wp.status === "in_progress")
    && workPhaseDependenciesMet(plan, wp)
  );
}

/** The first runnable pending task in declared order, or null when none remain. */
export function nextOpenTask(plan: Goalplan): { wp: GoalplanWorkPhase; task: GoalplanTask } | null {
  for (const wp of plan.workPhases) {
    if (!isRunnablePhase(plan, wp)) continue;
    for (const task of wp.tasks) {
      if (task.status === "pending" && taskDependenciesMet(wp, task)) return { wp, task };
    }
  }
  return null;
}

export interface DependencyDeadlock {
  reasons: string[];
}

function describePhaseDependency(plan: Goalplan, dependencyId: string): string {
  const dependency = plan.workPhases.find((wp) => wp.id === dependencyId);
  return `work-phase ${dependencyId} (${dependency?.status ?? "missing"})`;
}

function describeTaskDependency(phase: GoalplanWorkPhase, dependencyId: string): string {
  const dependency = phase.tasks.find((task) => task.id === dependencyId);
  return `task ${phase.id}/${dependencyId} (${dependency?.status ?? "missing"})`;
}

function dependencyWaitReason(subject: string, dependencies: readonly string[]): string {
  return `${subject} waits for ${dependencies.join(", ")}`;
}

function unmetPhaseDependencyIds(plan: Goalplan, phase: GoalplanWorkPhase): string[] {
  return (phase.dependsOn ?? []).filter(
    (dependencyId) => plan.workPhases.find((candidate) => candidate.id === dependencyId)?.status !== "done",
  );
}

function unmetTaskDependencyIds(phase: GoalplanWorkPhase, task: GoalplanTask): string[] {
  return (task.dependsOn ?? []).filter(
    (dependencyId) => phase.tasks.find((candidate) => candidate.id === dependencyId)?.status !== "done",
  );
}

/**
 * Direct unmet-dependency reasons, independent of whether other work is ready.
 * This is derived data and never mutates the plan or appends a ledger row.
 */
export function dependencyWaitReasons(plan: Goalplan): string[] {
  const reasons: string[] = [];
  for (const wp of remainingWorkPhases(plan)) {
    const unmetPhaseDependencies = unmetPhaseDependencyIds(plan, wp);
    if (unmetPhaseDependencies.length > 0) {
      reasons.push(dependencyWaitReason(
        `work-phase ${wp.id}`,
        unmetPhaseDependencies.map((id) => describePhaseDependency(plan, id)),
      ));
    }
    if (wp.status !== "pending" && wp.status !== "in_progress") continue;
    for (const task of wp.tasks.filter((candidate) => candidate.status === "pending")) {
      const unmetTaskDependencies = unmetTaskDependencyIds(wp, task);
      if (unmetTaskDependencies.length > 0) {
        reasons.push(dependencyWaitReason(
          `task ${wp.id}/${task.id}`,
          unmetTaskDependencies.map((id) => describeTaskDependency(wp, id)),
        ));
      }
    }
  }
  return reasons;
}

/**
 * Derived runtime diagnosis only. It never mutates a phase/task and is never
 * appended to the historical ledger by itself.
 */
export function dependencyDeadlock(plan: Goalplan): DependencyDeadlock | null {
  const unfinished = remainingWorkPhases(plan);
  if (unfinished.length === 0) return null;

  const runnablePhases = plan.workPhases.filter((wp) => isRunnablePhase(plan, wp));
  const hasRunnableTask = runnablePhases.some((wp) =>
    wp.tasks.some((task) => task.status === "pending" && taskDependenciesMet(wp, task))
  );
  const hasClosablePhase = runnablePhases.some((wp) =>
    wp.tasks.every((task) => task.status === "done")
  );
  if (hasRunnableTask || hasClosablePhase) return null;

  const reasons: string[] = [];
  for (const wp of unfinished) {
    if (wp.status === "blocked") {
      reasons.push(
        `work-phase ${wp.id} is blocked${wp.blockedReason ? ` (${wp.blockedReason})` : ""}`,
      );
      continue;
    }
    const unmetPhaseDependencies = unmetPhaseDependencyIds(plan, wp);
    if (unmetPhaseDependencies.length > 0) {
      reasons.push(dependencyWaitReason(
        `work-phase ${wp.id}`,
        unmetPhaseDependencies.map((id) => describePhaseDependency(plan, id)),
      ));
      continue;
    }
    for (const task of wp.tasks.filter((candidate) => candidate.status === "pending")) {
      const unmetTaskDependencies = unmetTaskDependencyIds(wp, task);
      if (unmetTaskDependencies.length > 0) {
        reasons.push(dependencyWaitReason(
          `task ${wp.id}/${task.id}`,
          unmetTaskDependencies.map((id) => describeTaskDependency(wp, id)),
        ));
      }
    }
  }
  return reasons.length > 0 ? { reasons } : null;
}
```

구현 메모:

- `find()`가 `undefined`를 반환하면 `=== "done"`이 거짓이므로 fail-closed다. 정상 v3는 wp3가 dangling 참조를 먼저 거부하지만, hand-edit된 메모리 fixture가 selector를 우회해도 실행 가능으로 오판하지 않는다.
- task 조회는 항상 owning `GoalplanWorkPhase`의 `tasks`만 본다. plan 전역 task 배열과 전역 task
  index는 금지한다. 디스크 plan에는 phase 간 중복 id `t1`, `t2`, `t3`이 있으므로
  전역 첫 일치 조회는 다른 phase의 상태를 읽는다.
- 성능을 위한 인덱스/그래프 엔진은 만들지 않는다. goalplan은 현재 수백 항목 규모이며 이 단계의 목표는 의미 잠금이다. 필요하면 후속 최적화에서 같은 순수 helper 내부만 Map으로 바꿀 수 있다.
- `dependsOn ?? []`는 읽기용일 뿐 객체에 빈 배열을 쓰지 않는다.
- task 후보를 고를 때 parent phase의 의존도 함께 확인한다. task 자체 의존만 확인하면 미충족 phase 아래 task가 Stop 안내에 새어 나온다.
- 선택 helper 어디에서도 schema version 비교식이나 버전 판정 변수를 만들지 않는다.
- `dependencyDeadlock()`의 `hasRunnableTask || hasClosablePhase` 조기 반환은 그대로다. 새 helper는 이
  조기 반환을 쓰지 않는다. 공통화 대상은 문장 생성과 미충족 ID 판정뿐이다.
- 두 공개 함수 모두 순수 함수다. plan, phase, task, ledger를 쓰지 않는다.

### 4.3 `effectiveActiveWorkPhaseId()`

#### Before

```ts
// wp3 적용 후 상태
export function effectiveActiveWorkPhaseId(plan: Goalplan): string | null {
  if (plan.activeWorkPhaseId) {
    const cur = plan.workPhases.find((wp) => wp.id === plan.activeWorkPhaseId);
    if (cur && cur.status !== "done" && cur.status !== "blocked" && cur.status !== "superseded") return cur.id;
  }
  const inProgress = plan.workPhases.find((wp) => wp.status === "in_progress");
  if (inProgress) return inProgress.id;
  const pending = plan.workPhases.find((wp) => wp.status === "pending");
  return pending?.id ?? null;
}
```

#### After

```ts
export function effectiveActiveWorkPhaseId(plan: Goalplan): string | null {
  if (plan.activeWorkPhaseId) {
    const cur = plan.workPhases.find((wp) => wp.id === plan.activeWorkPhaseId);
    if (cur && isRunnablePhase(plan, cur)) return cur.id;
  }
  const inProgress = plan.workPhases.find(
    (wp) => wp.status === "in_progress" && workPhaseDependenciesMet(plan, wp),
  );
  if (inProgress) return inProgress.id;
  const pending = plan.workPhases.find(
    (wp) => wp.status === "pending" && workPhaseDependenciesMet(plan, wp),
  );
  return pending?.id ?? null;
}
```

명시 커서가 미충족 의존 phase를 가리키면 `done | blocked | superseded` 커서와 똑같이 stale 취급하고 fall-through한다. 기존 우선순위인 “명시 커서 → 첫 in_progress → 첫 pending”은 바꾸지 않는다.

### 4.4 `advanceWorkPhase()`

#### Before

```ts
// wp3 적용 후 상태
// Search after current index first (declared order), then wrap.
const after = plan.workPhases.slice(currentIdx + 1).find((wp) => wp.status === "pending");
const next = after ?? plan.workPhases.slice(0, currentIdx).find((wp) => wp.status === "pending");
return {
  kind: "ok",
  closedId: current.id,
  plan: {
    ...plan,
    activeWorkPhaseId: next?.id ?? null,
    workPhases: plan.workPhases.map((wp) => {
      if (wp.id === current.id) {
        return {
          ...wp,
          status: "done" as const,
          tasks: wp.tasks,
        };
      }
      if (next && wp.id === next.id) return { ...wp, status: "in_progress" as const };
      return wp;
    }),
  },
};
```

#### After

```ts
// Dependency readiness must be evaluated after the current phase becomes done;
// a direct dependent of `current` becomes runnable at this exact boundary.
const closedWorkPhases = plan.workPhases.map((wp) =>
  wp.id === current.id
    ? { ...wp, status: "done" as const, tasks: wp.tasks }
    : wp
);
const closedPlan: Goalplan = {
  ...plan,
  activeWorkPhaseId: null,
  workPhases: closedWorkPhases,
};

// Preserve the old cursor order: after current first, then wrap to the front.
const after = closedWorkPhases.slice(currentIdx + 1).find(
  (wp) => wp.status === "pending" && workPhaseDependenciesMet(closedPlan, wp),
);
const next = after ?? closedWorkPhases.slice(0, currentIdx).find(
  (wp) => wp.status === "pending" && workPhaseDependenciesMet(closedPlan, wp),
);
return {
  kind: "ok",
  closedId: current.id,
  plan: {
    ...closedPlan,
    activeWorkPhaseId: next?.id ?? null,
    workPhases: closedWorkPhases.map((wp) =>
      next && wp.id === next.id ? { ...wp, status: "in_progress" as const } : wp
    ),
  },
};
```

다음 후보가 없더라도 현재 phase의 정상 D-close는 성공한다. `activeWorkPhaseId`는 `null`이 되고, 미완료가 남아 실행 불가라면 이후 Stop/다음 D-close 진단이 `dependencyDeadlock()`으로 원인을 설명한다. 후속 phase가 막혔다는 이유로 이미 검증된 현재 phase의 완료를 롤백하거나 D-close를 거부하지 않는다.

`advanceWorkPhase()` 시작부의 다음 코드는 유지한다.

```ts
const effectiveId = effectiveActiveWorkPhaseId(plan);
if (!effectiveId) return { kind: "no_active" };
```

따라서 진입 시점부터 모든 phase가 의존 대기라면 `no_active`다. `AdvanceResult` union은 바꾸지 않고 호출자가 `dependencyDeadlock(plan)`을 함께 읽어 `empty`, `all done`, 명시적 blocked, dependency deadlock을 구분한다.

## 5. `hook.ts` 상세 diff

경로: `plugins/codexclaw/components/pabcd-state/src/hook.ts`
구분: **MODIFY**

### 5.1 import와 Stop context

#### Before

```ts
// wp3 적용 후 상태
import { advanceWorkPhase, appendGoalplanLedger, effectiveActiveWorkPhaseId, readGoalplan, writeGoalplan, nextOpenTask, unmetCriteria, type AdvanceResult, type Goalplan } from "./goalplan.ts";

export interface StopWorkContext {
  nextTaskTitle: string | null;
  expectedEvidence: string | null;
  ledgerPath: string | null;
}
```

#### After

```ts
// wp3 적용 후 + wp4 추가분 (선행 wp 신규 이름: 없음; wp4: dependencyDeadlock)
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  nextOpenTask,
  readGoalplan,
  unmetCriteria,
  writeGoalplan,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";

export interface StopWorkContext {
  nextTaskTitle: string | null;
  expectedEvidence: string | null;
  dependencyBlockedReason: string | null;
  ledgerPath: string | null;
}
```

### 5.2 `buildStopBlock()` enrichment

#### Before

```ts
// wp3 적용 후 상태
if (work.nextTaskTitle) lines.push(`Remaining work: ${work.nextTaskTitle}`);
if (work.expectedEvidence) lines.push(`Required evidence: ${work.expectedEvidence}`);
if (work.ledgerPath) lines.push(`Record progress in: ${work.ledgerPath}`);
```

#### After

```ts
if (work.nextTaskTitle) lines.push(`Remaining work: ${work.nextTaskTitle}`);
if (work.expectedEvidence) lines.push(`Required evidence: ${work.expectedEvidence}`);
if (work.dependencyBlockedReason) lines.push(work.dependencyBlockedReason);
if (work.ledgerPath) lines.push(`Record progress in: ${work.ledgerPath}`);
```

`buildGoalIdleBlock()` 안의 같은 세 줄에도 `dependencyBlockedReason` 한 줄을 동일한 순서로 추가한다. 기존 context가 없을 때 byte-identical 보장은 유지된다. 새 필드는 context가 실제로 만들어진 경우에만 읽힌다.

### 5.3 `readStopWorkContext()`

#### Before

```ts
// wp3 적용 후 상태
const next = nextOpenTask(plan);
const unmet = unmetCriteria(plan);
if (!next && unmet.length === 0) return null;
return {
  nextTaskTitle: next ? `${next.wp.title} → ${next.task.title}` : null,
  expectedEvidence: unmet[0]?.expectedEvidence ?? null,
  ledgerPath: `.codexclaw/goalplans/${slug}/ledger.jsonl`,
};
```

#### After

```ts
const next = nextOpenTask(plan);
const unmet = unmetCriteria(plan);
const deadlock = dependencyDeadlock(plan);
if (!next && unmet.length === 0 && !deadlock) return null;
return {
  nextTaskTitle: next ? `${next.wp.title} → ${next.task.title}` : null,
  expectedEvidence: unmet[0]?.expectedEvidence ?? null,
  dependencyBlockedReason: deadlock
    ? `Dependency deadlock: no executable work remains while unfinished items exist: ${deadlock.reasons.join("; ")}`
    : null,
  ledgerPath: `.codexclaw/goalplans/${slug}/ledger.jsonl`,
};
```

`nextOpenTask()` 자체가 parent phase와 task 의존을 모두 확인하므로 미충족 항목은 `nextTaskTitle`에 들어오지 않는다. 교착이면 `nextTaskTitle`은 `null`이고 blocker만 안내한다. 열린 criterion의 `expectedEvidence`는 기존 순서대로 유지한다. criterion-phase 연계 변경은 wp4 범위가 아니다.

wp6 인계: 이 한 건짜리 `nextTaskTitle`은 wp4 시점의 호환 표면이다. wp6은 같은 ready 의미로
`readyWorkPhases()`와 `readyTasks()`를 공개하고, `readStopWorkContext()`와 Stop 안내가 두 목록과
대기 사유를 실제로 소비하게 확장한다. 새 턴 생성이나 자동 착수는 넣지 않는다.

### 5.4 채팅 D-close `no_active` 안내

#### Before

```ts
// wp3 적용 후 상태
if (advanced.kind === "no_active") {
  return buildContextOutput(
    "UserPromptSubmit",
    `[codexclaw — refused: the bound goalplan "${state.slug}" has no active work-phase to close (CYCLE-COMPLETION-01). Nothing was written.]`,
  );
}
```

#### After

```ts
if (advanced.kind === "no_active") {
  const deadlock = dependencyDeadlock(plan);
  const detail = deadlock
    ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
    : `the bound goalplan "${state.slug}" has no active work-phase to close`;
  return buildContextOutput(
    "UserPromptSubmit",
    `[codexclaw — refused: ${detail} (CYCLE-COMPLETION-01). Nothing was written.]`,
  );
}
```

채팅 경로의 기존 all-done 처리 차이는 이 phase에서 넓히지 않는다. wp4가 바꾸는 것은 `no_active`가 의존 교착인 경우의 정확한 설명뿐이다.

## 6. `orchestrate-cli.ts` 상세 diff

경로: `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`
구분: **MODIFY**

### 6.1 import

#### Before

```ts
// wp3 적용 후 상태
import { advanceWorkPhase, appendGoalplanLedger, effectiveActiveWorkPhaseId, readGoalplan, writeGoalplan, type AdvanceResult, type Goalplan } from "./goalplan.ts";
```

#### After

```ts
// wp3 적용 후 + wp4 추가분 (선행 wp 신규 이름: 없음; wp4: dependencyDeadlock)
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  readGoalplan,
  writeGoalplan,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";
```

### 6.2 gated attest 결박

현재 코드는 이미 단일 helper를 사용한다.

```ts
const plan = readGoalplan(args.cwd, state.slug);
effective = plan ? effectiveActiveWorkPhaseId(plan) : null;
const bindCheck = validateWorkPhaseBinding(args.attest, effective);
```

이 부분은 **코드 변경 없음**이다. `effectiveActiveWorkPhaseId()`가 의존 인식으로 바뀌면 attest가 요구하는 `workPhaseId`도 자동으로 같은 결과를 사용한다. 별도 active 계산을 추가하면 두 규칙이 다시 갈라지므로 금지한다. `orchestrate-cli.test.ts`에서 미충족 명시 커서를 건너뛴 effective id만 허용하는 통합 테스트를 추가한다.

### 6.3 CLI D-close `no_active` 안내

#### Before

```ts
// wp3 적용 후 상태
if (advanced.kind === "no_active") {
  const closable = plan.workPhases.length > 0 && plan.workPhases.every((wp) => wp.status === "done");
  if (closable) {
    advanced = { kind: "ok", closedId: null, plan };
  } else {
    return {
      code: 1,
      output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${state.slug}" has no work-phase to close (CYCLE-COMPLETION-01): ${plan.workPhases.length === 0 ? "the plan is empty — register workPhases[] first" : "every remaining work-phase is blocked or superseded — unblock one"}. Nothing was written.`,
    };
  }
}
```

#### After

```ts
if (advanced.kind === "no_active") {
  const closable = plan.workPhases.length > 0 && plan.workPhases.every((wp) => wp.status === "done");
  if (closable) {
    advanced = { kind: "ok", closedId: null, plan };
  } else {
    const deadlock = dependencyDeadlock(plan);
    const reason = plan.workPhases.length === 0
      ? "the plan is empty — register workPhases[] first"
      : deadlock
        ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
        : "every remaining work-phase is blocked or superseded — unblock one";
    return {
      code: 1,
      output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${state.slug}" has no work-phase to close (CYCLE-COMPLETION-01): ${reason}. Nothing was written.`,
    };
  }
}
```

기존 empty/all-done 분기와 write-before-refusal 방지는 유지한다. 교착 분기는 진단만 추가하며 state, PABCD ledger, goalplan을 쓰지 않는다.

### 6.4 wp5 D-close 인계 계약

wp5는 이 문구를 유지한 채 락 실패 분기만 추가한다. wp5의 Before는 현재 HEAD가 아니라 wp4 적용
후 상태이며, 아래 두 블록의 위치와 문자열을 그대로 복사한다. 락 실패 분기는 각 D-close 연산의
쓰기·전이보다 앞에 놓고, `no_active` 진단을 옛 문자열로 되돌리지 않는다.

```ts
// hook.ts: 채팅 D-close의 `advanced.kind === "no_active"` 분기
if (advanced.kind === "no_active") {
  const deadlock = dependencyDeadlock(plan);
  const detail = deadlock
    ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
    : `the bound goalplan "${state.slug}" has no active work-phase to close`;
  return buildContextOutput(
    "UserPromptSubmit",
    `[codexclaw — refused: ${detail} (CYCLE-COMPLETION-01). Nothing was written.]`,
  );
}
```

```ts
// orchestrate-cli.ts: CLI D-close preflight의 `advanced.kind === "no_active"` 분기
if (advanced.kind === "no_active") {
  const closable = plan.workPhases.length > 0 && plan.workPhases.every((wp) => wp.status === "done");
  if (closable) {
    advanced = { kind: "ok", closedId: null, plan };
  } else {
    const deadlock = dependencyDeadlock(plan);
    const reason = plan.workPhases.length === 0
      ? "the plan is empty — register workPhases[] first"
      : deadlock
        ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
        : "every remaining work-phase is blocked or superseded — unblock one";
    return {
      code: 1,
      output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${state.slug}" has no work-phase to close (CYCLE-COMPLETION-01): ${reason}. Nothing was written.`,
    };
  }
}
```

### 6.5 출력 문자열 조사와 기존 테스트 갱신

wp4가 만드는 reason을 소비하는 Stop context, 채팅 D-close, CLI D-close를 조사했다. 다음 명령으로
`plugins/codexclaw/components/pabcd-state/test/` 전체를 실제 검색했다. Stop 필드와 Stop 출력 문자열의
단언은 §35 U3·U6에 따라 040에서 제거하고 060으로 넘긴다.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
rg -n -F \
  -e 'Dependency deadlock' \
  -e 'no executable work remains while unfinished items exist' \
  -e 'has no active work-phase to close' \
  -e 'has no work-phase to close' \
  -e 'every remaining work-phase is blocked or superseded' \
  -e 'blocked or superseded' \
  -e 'Remaining work:' \
  -e 'Waiting on:' \
  -e 'waits for work-phase' \
  -e 'waits for task' \
  -e 'CYCLE-COMPLETION-01' \
  plugins/codexclaw/components/pabcd-state/test/
```

| wp4가 소유하는 출력 문자열 | 기존 테스트 검색 결과 | 갱신 소유자·처분 |
|---|---|---|
| `dependencyDeadlock()` reason: `work-phase <id> is blocked (<reason>)` / `work-phase <id> waits for work-phase <id> (<status>)`; CLI D-close는 `Dependency deadlock: <reasons>`로 감싼다 | `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts:904`가 기존 `/blocked or superseded/`를 기다려 확정 실패 | **reason 형식과 기존 CLI 단언 갱신은 wp4 소유.** 아래 diff로 정확한 새 reason을 기다리게 고친다. `dependencyDeadlock(plan).reasons`와 `dependencyWaitReasons(plan)`의 순수 helper golden은 §7.1이 소유한다 |

`work-phase-states.test.ts:144`의 `blocked or superseded`는 테스트 이름이며 출력 assert가 아니다.
`goalplan.test.ts:250`, `:364`, `hook.test.ts:644`, `:668`, `orchestrate-cli.test.ts:727`, `:794`의
`CYCLE-COMPLETION-01`은 바뀌지 않는 invariant 또는 open-task 분기를 검사하므로 갱신하지 않는다.
`hook-continuation.test.ts`의 기존 `Remaining work:` 단언 두 곳과 040이 제안했던
`nextTaskTitle`·`dependencyBlockedReason` 단언 세 개는 이 표의 갱신 대상이 아니다. **Stop 표면 단언은
060 소유**이며, 060이 `readyWorkPhases`·`readyTasks`·`waitingOn` After shape와 실제 Stop 출력으로
기존 단언을 갱신한다.

기존 테스트 갱신 diff:

```diff
--- a/plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts
+++ b/plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts
@@
   assert.equal(r.code, 1);
-  assert.match(r.output, /blocked or superseded/);
+  assert.match(r.output, /Dependency deadlock: work-phase wp-1 is blocked/);
   assert.equal(readState(cwd, id).phase, "C");
```

### 6.6 wp6 Before용 wp4 최종 상태

아래는 wp5까지 적용을 마친 `hook.ts`의 관련 상태다. 060은 이 블록을 Before 정본으로 삼는다.
wp4의 세 항목에 wp5의 `withGoalplanWriteLock`을 이어 붙인 상태다. import에서 `dependencyDeadlock`을 빼지 않고,
`dependencyBlockedReason`과 교착 계산을 ready 목록·`waitingOn`으로 이어 붙인다. wp6의 After는
`dependencyWaitReasons` import를 전체 import 블록에 추가하고 `waitingOn` 값으로 호출한다. ready가
0건이어도 `deadlock`이 있으면 `readStopWorkContext()`는 `null`을 반환하지 않아야 하며, ready가
1건 이상이어도 `dependencyWaitReasons(plan)`이 비어 있지 않으면 `waitingOn`을 버리지 않는다.

```ts
// wp4 적용 후 + wp5 추가분 (선행 wp4: dependencyDeadlock; wp5: withGoalplanWriteLock)
// 060은 이 세 부분을 모두 보존한다.
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  nextOpenTask,
  readGoalplan,
  unmetCriteria,
  withGoalplanWriteLock,
  writeGoalplan,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";

export interface StopWorkContext {
  nextTaskTitle: string | null;
  expectedEvidence: string | null;
  dependencyBlockedReason: string | null;
  ledgerPath: string | null;
}

export function readStopWorkContext(cwd: string, state: State): StopWorkContext | null {
  const slug = state.slug;
  if (!slug) return null;
  const plan = readGoalplan(cwd, slug);
  if (!plan) return null;
  const next = nextOpenTask(plan);
  const unmet = unmetCriteria(plan);
  const deadlock = dependencyDeadlock(plan);
  if (!next && unmet.length === 0 && !deadlock) return null;
  return {
    nextTaskTitle: next ? `${next.wp.title} → ${next.task.title}` : null,
    expectedEvidence: unmet[0]?.expectedEvidence ?? null,
    dependencyBlockedReason: deadlock
      ? `Dependency deadlock: no executable work remains while unfinished items exist: ${deadlock.reasons.join("; ")}`
      : null,
    ledgerPath: `.codexclaw/goalplans/${slug}/ledger.jsonl`,
  };
}
```

인계 소유는 고정한다. wp6이 `dependencyWaitReasons()`를 실제 Stop 소비 경로에 연결하고 그 표면의
출력·기존 단언 갱신을 단독 소유한다. wp7은 wp6 After에서 확정한 `Ready work phases:`,
`Ready tasks:`, `Waiting on:` 문자열을 그대로 인용하며 같은 단언을 다시 수정하지 않는다.

**Stop 표면 단언은 060 소유다.** 060의 After는 `StopWorkContext`를
`readyWorkPhases`·`readyTasks`·`waitingOn`으로 바꾸고, `hook-continuation.test.ts`의 기존
`Remaining work:` 단언 두 곳과 ready/부분 대기/전역 교착 소비 경로를 자기 shape로 검증한다. 040은
그 필드나 Stop 출력 문자열을 단언하지 않는다.

## 7. 테스트 상세 diff

### 7.1 `goalplan.test.ts`

경로: `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`
구분: **MODIFY**

함수를 호출하는 테스트 파일이 자립하도록 import 전체 Before/After를 적는다.

Before:

```ts
// wp3 적용 후 상태 (선행 wp2 신규: readGoalplanDetailed, effectiveSchemaVersion; wp3 신규: 없음)
import {
  buildGoalplan,
  readGoalplan,
  readGoalplanDetailed,
  writeGoalplan,
  appendGoalplanLedger,
  goalplanDir,
  remainingWorkPhases,
  nextOpenTask,
  unmetCriteria,
  isGoalplanComplete,
  validateGoalplan,
  advanceWorkPhase,
  effectiveActiveWorkPhaseId,
  effectiveSchemaVersion,
  type Goalplan,
} from "../src/goalplan.ts";
```

After:

```ts
// wp3 적용 후 + wp4 추가분 (선행 wp2: readGoalplanDetailed, effectiveSchemaVersion; wp3: 없음; wp4: dependencyDeadlock)
import {
  buildGoalplan,
  readGoalplan,
  readGoalplanDetailed,
  writeGoalplan,
  appendGoalplanLedger,
  dependencyDeadlock,
  goalplanDir,
  remainingWorkPhases,
  nextOpenTask,
  unmetCriteria,
  isGoalplanComplete,
  validateGoalplan,
  advanceWorkPhase,
  effectiveActiveWorkPhaseId,
  effectiveSchemaVersion,
  type Goalplan,
} from "../src/goalplan.ts";
```

추가 케이스 이름과 본문:

```ts
test("wp4: nextOpenTask excludes a task whose direct dependency is not done", () => {
  const plan = buildGoalplan({ objective: "task dependency" });
  plan.schemaVersion = 3;
  plan.workPhases = [{
    id: "wp1",
    title: "one",
    status: "in_progress",
    dependsOn: [],
    criteriaIds: [],
    tasks: [
      { id: "t1", title: "upstream", status: "pending", dependsOn: [] },
      { id: "t2", title: "downstream", status: "pending", dependsOn: ["t1"] },
    ],
  }];
  assert.equal(nextOpenTask(plan)?.task.id, "t1");
  plan.workPhases[0].tasks[0].status = "done";
  plan.workPhases[0].tasks[0].outcome = "upstream task completed";
  assert.equal(nextOpenTask(plan)?.task.id, "t2");
});

test("wp4 regression: duplicate task ids in different phases stay phase-local", () => {
  const plan = buildGoalplan({ objective: "phase-local duplicate task ids" });
  plan.schemaVersion = 3;
  plan.workPhases = [
    {
      id: "wpA",
      title: "phase A",
      status: "done",
      dependsOn: [],
      criteriaIds: [],
      tasks: [{
        id: "t1",
        title: "phase A t1",
        status: "done",
        dependsOn: [],
        outcome: "phase A t1 completed",
      }],
    },
    {
      id: "wpB",
      title: "phase B",
      status: "in_progress",
      dependsOn: [],
      criteriaIds: [],
      tasks: [
        { id: "t2", title: "phase B t2", status: "pending", dependsOn: ["t1"] },
        { id: "t1", title: "phase B t1", status: "pending", dependsOn: [] },
      ],
    },
  ];

  const next = nextOpenTask(plan);

  assert.deepEqual(
    next ? { workPhaseId: next.wp.id, taskId: next.task.id } : null,
    { workPhaseId: "wpB", taskId: "t1" },
  );
  assert.notEqual(next?.task.id, "t2");
});

test("wp4 compatibility: undefined and empty dependsOn have identical selection semantics", () => {
  const legacy = buildGoalplan({ objective: "legacy undefined" });
  legacy.workPhases = [
    { id: "wp1", title: "one", status: "in_progress", tasks: [{ id: "t1", title: "one", status: "pending" }], criteriaIds: [] },
    { id: "wp2", title: "two", status: "pending", tasks: [], criteriaIds: [] },
  ];
  legacy.activeWorkPhaseId = "wp1";
  const explicitEmpty: Goalplan = structuredClone(legacy);
  explicitEmpty.schemaVersion = 3;
  explicitEmpty.workPhases = explicitEmpty.workPhases.map((wp) => ({
    ...wp,
    dependsOn: [],
    tasks: wp.tasks.map((task) => ({ ...task, dependsOn: [] })),
  }));
  assert.equal(effectiveActiveWorkPhaseId(legacy), effectiveActiveWorkPhaseId(explicitEmpty));
  assert.equal(nextOpenTask(legacy)?.task.id, nextOpenTask(explicitEmpty)?.task.id);
  assert.equal(dependencyDeadlock(legacy), null);
  assert.equal(dependencyDeadlock(explicitEmpty), null);
});

test("wp4 compatibility: v1 selector and advance golden result stays byte-for-byte stable", () => {
  const plan = buildGoalplan({ objective: "v1 golden" });
  delete plan.schemaVersion;
  plan.workPhases = [
    { id: "wp1", title: "before", status: "pending", tasks: [], criteriaIds: [] },
    { id: "wp2", title: "current", status: "in_progress", tasks: [{ id: "t2", title: "done", status: "done" }], criteriaIds: [] },
    { id: "wp3", title: "after", status: "pending", tasks: [{ id: "t3", title: "next", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp2";
  assert.equal(effectiveActiveWorkPhaseId(plan), "wp2");
  assert.deepEqual(
    { wp: nextOpenTask(plan)?.wp.id, task: nextOpenTask(plan)?.task.id },
    { wp: "wp3", task: "t3" },
  );
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok");
  if (advanced.kind !== "ok") return;
  assert.deepEqual(
    {
      activeWorkPhaseId: advanced.plan.activeWorkPhaseId,
      statuses: advanced.plan.workPhases.map((wp) => wp.status),
    },
    { activeWorkPhaseId: "wp3", statuses: ["pending", "done", "in_progress"] },
  );
});

test("wp4 compatibility: v2 plans without dependsOn keep the v1 selection result", () => {
  const plan = buildGoalplan({ objective: "v2 golden" });
  plan.schemaVersion = 2;
  plan.workPhases = [
    { id: "wp1", title: "one", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp2", title: "two", status: "pending", tasks: [{ id: "t2", title: "next", status: "pending" }], criteriaIds: [] },
  ];
  assert.equal(effectiveActiveWorkPhaseId(plan), "wp2");
  assert.equal(nextOpenTask(plan)?.task.id, "t2");
});
```

“변경 전후 동일”은 새 구현을 옛 구현과 런타임에서 동시에 호출하는 방식이 아니라, 현재 구현의 관측 결과를 golden object로 고정해 증명한다. 이 케이스는 v1 필드 부재, 명시 커서 우선, task 탐색, 뒤쪽 우선 advance를 한 번에 잠근다.

### 7.2 `work-phase-states.test.ts`

경로: `plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts`
구분: **MODIFY**

함수를 호출하는 테스트 파일이 자립하도록 import 전체 Before/After를 적는다.

Before:

```ts
import {
  advanceWorkPhase,
  buildGoalplan,
  effectiveActiveWorkPhaseId,
  goalplanDir,
  nextOpenTask,
  readGoalplan,
  remainingWorkPhases,
  validateGoalplan,
  writeGoalplan,
  type Goalplan,
  type GoalplanWorkPhase,
  type WorkPhaseStatus,
} from "../src/goalplan.ts";
```

After:

```ts
// wp3 적용 후 + wp4 추가분 (선행 wp 신규 이름: 없음; wp4: dependencyDeadlock, dependencyWaitReasons)
import {
  advanceWorkPhase,
  buildGoalplan,
  dependencyDeadlock,
  dependencyWaitReasons,
  effectiveActiveWorkPhaseId,
  goalplanDir,
  nextOpenTask,
  readGoalplan,
  remainingWorkPhases,
  validateGoalplan,
  writeGoalplan,
  type Goalplan,
  type GoalplanWorkPhase,
  type WorkPhaseStatus,
} from "../src/goalplan.ts";
```

추가 케이스:

```ts
test("wp4: effective cursor skips an in-progress phase with unmet dependencies", () => {
  const p = plan([
    phase("a", "blocked", { blockedReason: "vendor" }),
    phase("b", "in_progress", { dependsOn: ["a"] }),
    phase("c", "pending", { dependsOn: [] }),
  ], { schemaVersion: 3, activeWorkPhaseId: "b" });
  assert.equal(effectiveActiveWorkPhaseId(p), "c");
});

test("wp4: superseded is not dependency completion", () => {
  const p = plan([
    phase("a", "superseded", { supersededBy: "replacement" }),
    phase("replacement", "pending"),
    phase("consumer", "pending", { dependsOn: ["a"] }),
  ], { schemaVersion: 3, activeWorkPhaseId: "consumer" });
  assert.equal(effectiveActiveWorkPhaseId(p), "replacement");
});

test("wp4: advance evaluates readiness after closing current and unlocks its dependent", () => {
  const p = plan([
    phase("current", "in_progress", { tasks: [{ id: "t", title: "done", status: "done", outcome: "current task completed" }] }),
    phase("dependent", "pending", { dependsOn: ["current"] }),
  ], { schemaVersion: 3, activeWorkPhaseId: "current" });
  const advanced = advanceWorkPhase(p);
  assert.equal(advanced.kind, "ok");
  if (advanced.kind !== "ok") return;
  assert.equal(advanced.plan.activeWorkPhaseId, "dependent");
  assert.deepEqual(advanced.plan.workPhases.map((wp) => wp.status), ["done", "in_progress"]);
});

test("wp4: advance skips unmet phases after current and preserves wrap order", () => {
  const p = plan([
    phase("front-ready", "pending"),
    phase("current", "in_progress"),
    phase("after-blocked", "pending", { dependsOn: ["external-blocked"] }),
    phase("external-blocked", "blocked", { blockedReason: "external" }),
  ], { schemaVersion: 3, activeWorkPhaseId: "current" });
  const advanced = advanceWorkPhase(p);
  assert.equal(advanced.kind, "ok");
  if (advanced.kind !== "ok") return;
  assert.equal(advanced.plan.activeWorkPhaseId, "front-ready");
});

test("wp4: blocked upstream produces a dependency deadlock without a cycle", () => {
  const p = plan([
    phase("upstream", "blocked", { blockedReason: "vendor release" }),
    phase("downstream", "pending", { dependsOn: ["upstream"] }),
  ], { schemaVersion: 3, activeWorkPhaseId: null });
  assert.equal(effectiveActiveWorkPhaseId(p), null);
  assert.equal(nextOpenTask(p), null);
  assert.deepEqual(dependencyDeadlock(p)?.reasons, [
    "work-phase upstream is blocked (vendor release)",
    "work-phase downstream waits for work-phase upstream (blocked)",
  ]);
});

test("wp4: runnable empty phase is closable and is not reported as a deadlock", () => {
  const p = plan([phase("ready", "pending", { dependsOn: [], tasks: [] })], { schemaVersion: 3 });
  assert.equal(dependencyDeadlock(p), null);
});

test("wp4: dependency wait reasons survive when other work is ready", () => {
  const p = plan([phase("build", "in_progress", {
    dependsOn: [],
    tasks: [
      { id: "t-ready", title: "ready", status: "pending", dependsOn: [] },
      { id: "t-upstream", title: "upstream", status: "pending", dependsOn: [] },
      { id: "t-waiting", title: "waiting", status: "pending", dependsOn: ["t-upstream"] },
    ],
  })], { schemaVersion: 3, activeWorkPhaseId: "build" });

  assert.equal(nextOpenTask(p)?.task.id, "t-ready");
  assert.equal(dependencyDeadlock(p), null);
  assert.deepEqual(dependencyWaitReasons(p), [
    "task build/t-waiting waits for task build/t-upstream (pending)",
  ]);
});

test("wp4: dependency wait reasons are empty when every dependency is done", () => {
  const p = plan([
    phase("foundation", "done", { dependsOn: [], tasks: [] }),
    phase("build", "in_progress", {
      dependsOn: ["foundation"],
      tasks: [
        {
          id: "t-upstream",
          title: "upstream",
          status: "done",
          dependsOn: [],
          outcome: "upstream completed",
        },
        { id: "t-dependent", title: "dependent", status: "pending", dependsOn: ["t-upstream"] },
      ],
    }),
  ], { schemaVersion: 3, activeWorkPhaseId: "build" });

  assert.deepEqual(dependencyWaitReasons(p), []);
});

test("wp4: dependency wait reasons include phase and task waits", () => {
  const p = plan([
    phase("vendor", "blocked", { blockedReason: "release pending", dependsOn: [], tasks: [] }),
    phase("build", "pending", {
      dependsOn: ["vendor"],
      tasks: [
        { id: "t-upstream", title: "upstream", status: "pending", dependsOn: [] },
        { id: "t-dependent", title: "dependent", status: "pending", dependsOn: ["t-upstream"] },
      ],
    }),
  ], { schemaVersion: 3, activeWorkPhaseId: null });

  assert.deepEqual(dependencyWaitReasons(p), [
    "work-phase build waits for work-phase vendor (blocked)",
    "task build/t-dependent waits for task build/t-upstream (pending)",
  ]);
});
```

위 테스트가 040의 순수 helper golden이다. `dependencyDeadlock(plan).reasons`는 blocked와 phase wait
문장의 정확한 배열을 잠그고, `dependencyWaitReasons(plan)`는 ready 공존·전부 충족·phase/task 동시
대기의 정확한 배열을 잠근다. Stop context shape나 렌더링 문자열은 여기서 검사하지 않는다.
기존 blocked/superseded 테스트는 삭제하거나 이름을 바꾸지 않는다. 새 helper가 과거 상태 처리와
일관되는지 함께 회귀한다.

### 7.3 Stop 표면 테스트 인계

경로: `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts`
구분: **040 변경 없음**

040은 `readStopWorkContext()`의 `nextTaskTitle`·`dependencyBlockedReason` 필드와 Stop 출력 문자열을
단언하지 않는다. 040이 제안했던 Stop 단언 세 개는 제거했다. **Stop 표면 단언은 060 소유**다.
060이 자기 After shape인 `readyWorkPhases`·`readyTasks`·`waitingOn`과 실제 `handleStop()` 출력을
검증하고 기존 `Remaining work:` 단언 두 곳을 갱신한다. 040은 §7.1의 순수 helper golden만 잠근다.

### 7.4 `orchestrate-cli.test.ts`

경로: `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`
구분: **MODIFY**

추가 케이스:

```ts
test("wp4: gated attest binds to dependency-aware effective workPhaseId", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("dep-bind"), phase: "B" as never, slug: "dep-bind" });
    const plan = buildGoalplan({ objective: "dependency binding" });
    plan.slug = "dep-bind";
    plan.schemaVersion = 3;
    plan.activeWorkPhaseId = "blocked-child";
    plan.workPhases = [
      { id: "upstream", title: "upstream", status: "blocked", blockedReason: "external", dependsOn: [], tasks: [], criteriaIds: [] },
      { id: "blocked-child", title: "blocked child", status: "in_progress", dependsOn: ["upstream"], tasks: [], criteriaIds: [] },
      { id: "ready", title: "ready", status: "pending", dependsOn: [], tasks: [], criteriaIds: [] },
    ];
    writeGoalplan(cwd, plan);

    const stale = runOrchestrateCli({
      verb: "C",
      attest: { from: "B", to: "C", did: "worked", workPhaseId: "blocked-child" },
      session: "dep-bind",
      cwd,
      json: false,
    });
    assert.equal(stale.code, 1);
    assert.match(stale.output, /active work-phase is ready/);

    const ready = runOrchestrateCli({
      verb: "C",
      attest: { from: "B", to: "C", did: "worked", workPhaseId: "ready" },
      session: "dep-bind",
      cwd,
      json: false,
    });
    assert.equal(ready.code, 0, ready.output);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp4: D-close reports dependency deadlock and writes nothing", () => {
  const cwd = boundCwd();
  const id = "cycle-dependency-deadlock";
  const slug = "cycle-dependency-deadlock";
  const plan = buildGoalplan({ objective: "dependency deadlock" });
  plan.slug = slug;
  plan.schemaVersion = 3;
  plan.workPhases = [
    { id: "wp-1", title: "upstream", status: "blocked", blockedReason: "vendor", dependsOn: [], tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "downstream", status: "pending", dependsOn: ["wp-1"], tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  const before = readFileSync(goalplanPath(cwd, slug), "utf8");
  const epoch = "c-test-epoch";
  writeState(cwd, { ...defaultState(id), phase: "C", slug, checkEpoch: epoch, flags: { interview: false, auditPassed: true, checkPassed: false } });
  seedReceipt(cwd, id, epoch);

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const result = runOrchestrateCli(args as never);
  assert.equal(result.code, 1);
  assert.match(result.output, /Dependency deadlock/);
  assert.match(result.output, /wp-2 waits for work-phase wp-1 \(blocked\)/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(ledgerLines(cwd).length, 0);
  assert.equal(readFileSync(goalplanPath(cwd, slug), "utf8"), before);
});
```

기존 `260714 wp4: goalplan-bound gated edge requires matching workPhaseId`, all-done, empty, all-blocked D-close 테스트는 유지한다. 새 테스트는 기존 계산을 복제하지 않고 production path가 바뀐 helper 결과를 실제로 소비하는지 확인한다.

## 8. 하위 호환성 판정표

| 입력 | 선택 의미 | 저장 의미 | 기대 결과 |
|---|---|---|---|
| v1/v2, `dependsOn` 필드 없음 | 의존 0개 | 필드 부재 유지 | 기존 배열 순회와 완전히 동일 |
| v3, `dependsOn: []` | 의존 0개 | 빈 배열 유지 | v1/v2와 같은 후보 |
| v3, `dependsOn: [id]`, 대상 done | 충족 | 배열 유지 | 기존 우선순위 안에서 후보 가능 |
| v3, `dependsOn: [id]`, 대상 pending/in_progress/blocked/superseded | 미충족 | 배열 유지 | 후보에서 제외 |
| hand-edit dangling id | 미충족(fail-closed) | wp3 validation 실패 | 선택되지 않음 |

v1/v2 불변 증명은 세 층으로 한다.

1. `goalplan.test.ts` golden: effective active, next task, advance 결과를 현재 값으로 고정한다.
2. `goalplan.test.ts` helper golden: `dependencyDeadlock(plan).reasons`와
   `dependencyWaitReasons(plan)`의 정확한 배열을 고정한다.
3. 기존 전체 테스트: blocked/superseded, 뒤쪽 우선 wrap, null/ghost cursor, all-done, empty, HITL
   동작을 그대로 통과시킨다. Stop 표면의 하위 호환 단언은 060이 자기 After shape로 갱신한다.

빈 배열과 undefined를 의미상 구분하지 않는 이유는 “명시적으로 의존 없음”과 “스키마 도입 전이라 필드 없음”이 실행 준비 조건에서는 모두 제약 0개이기 때문이다. 반대로 저장에서는 구분해야 구버전 plan을 읽고 쓰는 것만으로 대량 diff가 생기거나 schema v3처럼 재기록되는 일을 막을 수 있다.

## 9. 실패·경계 조건

- 현재 phase가 미충족 의존 상태로 바뀌면 명시 커서는 stale로 취급하고 다른 runnable phase로 fall-through한다.
- runnable phase가 없고 미완료가 남으면 `effectiveActiveWorkPhaseId()`는 `null`이다. 호출자는 이를 완료로 간주하지 않고 `remainingWorkPhases()`와 `dependencyDeadlock()`으로 구분한다.
- current D-close 직후 후속 phase가 current에만 의존했다면 즉시 `in_progress`가 된다.
- current D-close 직후 모든 후속 phase가 다른 blocked dependency를 기다리면 D-close 자체는 성공하고 active는 null이 된다. 다음 Stop에서 dependency deadlock을 안내한다.
- task 의존이 미충족이어도 task 상태를 `blocked`로 쓰지 않는다. pending을 유지한다.
- phase에 pending task가 남아 있으면 그 task가 실행 불가하더라도 D-close는 `tasks_pending`으로 거부한다.
- `superseded` 의존을 자동으로 `supersededBy` 대상으로 따라가지 않는다. 자동 추적은 뜻밖의 실행 허용이며, 재배선은 명시적 변경이어야 한다.
- ledger에는 선택/교착 조회만으로 아무 이벤트도 추가하지 않는다.

## 10. 검증 명령과 기대 결과

작업 디렉토리: `/Users/jun/Developer/new/700_projects/codexclaw`

### 10.1 대상 테스트

```bash
#!/usr/bin/env bash
set -euo pipefail
verification_tmp="$(mktemp -d)"
trap 'rm -rf "$verification_tmp"' EXIT
export TMPDIR="$verification_tmp"
cd /Users/jun/Developer/new/700_projects/codexclaw
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts
```

기대 결과:

- exit code 0
- fail 0
- 위에 명시한 `wp4:` 및 `wp4 compatibility:` 케이스 전부 pass
- ready와 대기가 공존하는 helper 케이스, 의존 전부 충족 케이스, phase/task 동시 대기 케이스 pass

### 10.2 저장 표현 회귀 확인

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
node --experimental-strip-types --test --test-name-pattern "wp4 compatibility|schema round-trips" plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts
```

기대 결과:

- exit code 0
- v1/v2 fixture read/write 후 `dependsOn`이 새로 생기지 않음
- v3의 `dependsOn: []`와 non-empty 배열은 wp2 round-trip 테스트와 함께 보존됨
- selector 결과는 필드 부재와 빈 배열에서 동일

### 10.3 변경 공개 경로 focused gate

```bash
#!/usr/bin/env bash
set -euo pipefail
verification_tmp="$(mktemp -d)"
trap 'rm -rf "$verification_tmp"' EXIT
export TMPDIR="$verification_tmp"
cd /Users/jun/Developer/new/700_projects/codexclaw
node --experimental-strip-types --test \
  --test-name-pattern='wp4:|wp4 regression:|wp4 compatibility:' \
  plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts \
  plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts \
  plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts
node --experimental-strip-types --test \
  plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts
```

기대 결과:

- exit code 0
- fail 0
- `goalplan.ts`의 공개 export `dependencyDeadlock()`, `dependencyWaitReasons()`,
  `effectiveActiveWorkPhaseId()`, `nextOpenTask()`, `advanceWorkPhase()`를 실제 import·호출한 케이스 pass
- `orchestrate-cli.ts`가 `dependencyDeadlock()`을 소비하는 gated attest·D-close 공개 경로 pass
- `hook.ts`의 `readStopWorkContext()`와 Stop context 소비 경로를 실제 호출하는 focused 파일 pass

`npm run build`는 타입 제거와 파일 복사만 하며 심볼을 해석하지 않는다. build exit 0을 타입·import
오류 검출 증거로 쓰지 않는다. 위 focused test가 변경된 공개 경로를 TypeScript 소스에서 직접 import하고
호출하는 단계 게이트다.

### 10.4 tracked dist 생성·레이아웃 검사

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
npm run build
```

기대 결과:

- exit code 0
- tracked `dist/goalplan.js`, `dist/hook.js`, `dist/orchestrate-cli.js` 재생성
- 컴포넌트 산출물 레이아웃 검사 통과

### 10.5 전체 저장소 회귀

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
npm test
```

기대 결과:

- exit code 0
- fail 0
- pabcd-state의 기존 blocked/superseded, D-close, Stop byte-compat 테스트 포함 전부 pass
- 루트 freshness 테스트가 변경 src와 위 tracked dist의 byte equality 확인

### 10.6 저장소 gate

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
npm run gate
```

기대 결과:

- exit code 0
- gate 오류 0

### 10.7 담당 문서 확인

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
doc=devlog/_plan/260829_goalplan-dependency-execution/040_wp4_dependency_aware.md
test -f "$doc"
git status --porcelain -- "$doc"
set +e
git diff --no-index /dev/null "$doc"
diff_status=$?
set -e
test "$diff_status" -eq 1
```

기대 결과:

- `test -f`는 exit code 0
- `git status --porcelain`은 담당 문서의 `??` 한 줄을 출력
- `git diff --no-index`는 untracked 문서 전체 diff를 출력하고 exit code 1
- `git diff --name-only -- <문서>`는 쓰지 않음

## 11. 완료 조건

- 미충족 phase 의존이 명시 커서·`in_progress`·`pending` 후보에서 모두 제외된다.
- 미충족 task 의존이 `nextOpenTask()`와 Stop의 “Remaining work”에서 제외된다.
- `advanceWorkPhase()`가 current를 done으로 만든 뒤 의존을 다시 계산하고, 기존 after-then-wrap 순서를 지킨다.
- 실행 가능한 항목 0 + 미완료 존재 상태가 blocker ID/status/reason을 포함한 dependency deadlock으로 노출된다.
- ready 존재 여부와 무관하게 `dependencyWaitReasons()`가 미충족 phase/task 의존 사유를 같은 문장
  생성기로 돌려주며, 모든 의존이 충족되면 빈 배열을 돌려준다.
- Stop과 CLI/chat D-close가 같은 `dependencyDeadlock()` 진단을 사용한다.
- wp6은 새 helper를 Stop `waitingOn`에 연결하고, wp7은 wp6이 확정한 출력 문자열을 인용만 한다.
- orchestrate gated attest가 별도 계산 없이 dependency-aware `effectiveActiveWorkPhaseId()`에 결박된다.
- v1/v2 필드 부재와 v3 빈 배열이 실행 의미상 동일하고 저장 표현은 각각 보존된다.
- 지정된 네 테스트 파일과 변경 공개 경로 focused gate 뒤 `npm run build` → `npm test` →
  `npm run gate`가 차례로 exit 0이다.

DONE: 040_wp4_dependency_aware.md — W5 tracked 선택 경로 dist manifest와 build 선행 검증 순서를 닫음
