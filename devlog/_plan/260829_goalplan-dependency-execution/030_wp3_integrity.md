# 030 — wp3: 순수 무결성 검증

> 선행 조건: `020_wp2_schema_v3.md` 작업이 끝나 `GoalplanWorkPhase.dependsOn?`,
> `GoalplanTask.dependsOn?`, `GoalplanTask.outcome?`이 타입과 `reviveGoalplan()` 왕복에서
> 보존되어야 한다.

## 목표와 제외선

wp3는 읽기 전용 검증만 맡는다. 공개 API 이름은 아래 둘로 고정한다.

```ts
export function goalplanDefinitionIntegrityReasons(plan: Goalplan): string[];
export function goalplanDependencyCompletionReasons(plan: Goalplan): string[];
```

다른 공개 별칭은 만들지 않는다. wp4가 맡는 의존 판정 helper는
`taskDependenciesMet(phase, task)`다. plan 전역 `flatMap()`은 금지다.

검증 불변식:

1. work-phase 의존은 같은 plan의 work-phase ID만 가리킨다.
2. task 의존은 소속 work-phase의 task ID만 가리킨다.
3. work-phase 그래프와 각 phase의 task 그래프는 DAG다.
4. work-phase ID와 criterion ID는 plan 안에서 유일하다. task ID는 phase 안에서만 유일하다.
5. `criteriaIds[]`는 실제 criterion ID만 가리킨다.
6. `done` 항목의 직접 의존은 모두 `done`이다.
7. schema v3 이상의 done task는 공백이 아닌 outcome을 갖고 pending task는 outcome을 갖지 않는다.
8. `validateGoalplan()`과 goal complete gate가 같은 사유를 노출한다.

wp4는 의존 인식 선택, wp5는 공통 락과 RMW 직렬화, wp6는 등록·조회·lifecycle 공개 표면을
맡는다. 새 등록 입구, 상태 변경, ledger event, writer 락은 wp3에 넣지 않는다.
wp6의 `add-task --depends-on`은 새 task를 상태에 쓰기 전에 같은 work phase의 **기존 task id**만
참조하는지 이 wp의 정의 무결성 검증으로 확인해야 한다. 다른 phase의 task, 아직 없는 task, 생성할
task 자신을 가리키면 아래 정본 사유로 거부하고 상태를 만들지 않는다.

## 현재 소스 근거

2026-08-29 checkout에서 확인한 줄이다.

| 파일과 줄 | 확인한 사실 | 처분 |
| --- | --- | --- |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:82-115` | `GoalplanTask`와 `GoalplanWorkPhase` 타입, wp2 optional 필드 위치 | wp2 필드를 읽는 검증만 추가 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:453-523` | `declaredSchemaVersion()`·`reviveDependsOn()`과 `reviveGoalplan()`의 task/phase 복원 | wp2 소유, 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:695-736` | `writeGoalplan()`의 rename과 `appendGoalplanLedger()`가 별도 write | wp5·wp6 소유, 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:832-909` | `GoalplanValidation` 타입과 `validateGoalplan()` E8 validator | 두 순수 함수를 연결 |
| `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:271-285` | validator 사유 네 개를 deny에 표시 | 안내 문자열만 수정 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:246-257` | add-work-phase producer | wp6 소유, 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/steering.ts:176-183,307-320` | 등록 shape와 commit point | wp6·wp5 소유, 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/atomic-write.ts:16,38-45` | rename retry 상수와 실행부 | 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:632-637,671-678,734-739` | D-close와 writer | wp5·wp6 소유, 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/hook.ts:839-875,893-930` | 채팅 D-close preflight, state/PABCD ledger writer, goalplan writer | wp5·wp6 소유, 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/review-round-cli.ts:233-263` | review round writer | wp5 소유, 수정 없음 |
| `plugins/codexclaw/components/pabcd-state/src/review-observer.ts:119-164` | ignored ledger와 verdict writer | wp5 소유, 수정 없음 |

## 변경 지도

| 구분 | 파일 | 책임 |
| --- | --- | --- |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | 정의·outcome·완료 의존 사유와 validate 연결 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts` | E8 안내에 integrity 복구 순서 명시 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/goalplan.js` | build가 갱신한 tracked `goalplan.ts` 배포 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/goal-gate.js` | build가 갱신한 tracked `goal-gate.ts` 배포 산출물 |
| NEW | `plugins/codexclaw/components/pabcd-state/test/goalplan-integrity.test.ts` | 순수 함수와 validate 연결 테스트 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts` | update_goal complete deny 통합 테스트 |

DELETE는 없다.

## Diff-level 설계

### MODIFY — `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

현재 `GoalplanValidation` 선언(`:832`) 직전에 넣는다. wp2 적용 뒤에는
`doneWorkPhasesWithPendingTasks()` 다음이라는 구조 앵커를 쓴다.

Before:

```ts
export interface GoalplanValidation {
  ok: boolean;
  reasons: string[];
}
```

After:

```ts
interface DependencyNode {
  id: string;
  dependsOn: readonly string[];
}

function duplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  }
  return [...duplicates].sort();
}

function findDependencyCycle(nodes: readonly DependencyNode[]): string[] | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const visiting = new Map<string, number>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    const seenAt = visiting.get(id);
    if (seenAt !== undefined) return [...stack.slice(seenAt), id];
    if (visited.has(id)) return null;
    visiting.set(id, stack.length);
    stack.push(id);
    for (const dependencyId of [...(byId.get(id)?.dependsOn ?? [])].sort()) {
      if (!byId.has(dependencyId)) continue;
      const cycle = visit(dependencyId);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };
  for (const id of [...byId.keys()].sort()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

export function goalplanDefinitionIntegrityReasons(plan: Goalplan): string[] {
  const reasons: string[] = [];
  const phaseIds = new Set(plan.workPhases.map((phase) => phase.id));
  for (const id of duplicateIds(plan.workPhases.map((phase) => phase.id))) {
    reasons.push(`duplicate work phase id '${id}' makes dependency references ambiguous`);
  }
  for (const phase of plan.workPhases) {
    // 감사 라운드 1 BLOCKER 1: 같은 참조를 여러 번 쓴 dependsOn이 같은 사유를 반복하면
    // goal-gate의 slice(0, 4)가 한 문장으로 네 칸을 채워 다른 진단을 가린다. wp2 reviver는
    // 중복 원소를 거부하지 않으므로(goalplan.ts:466-475) 여기서 첫 등장 순서를 지켜 줄인다.
    for (const dependencyId of new Set(phase.dependsOn ?? [])) {
      if (dependencyId === phase.id) reasons.push(`work phase ${phase.id} depends on itself`);
      else if (!phaseIds.has(dependencyId)) {
        reasons.push(`work phase ${phase.id} depends on unknown work phase '${dependencyId}'`);
      }
    }

    const taskIds = new Set(phase.tasks.map((task) => task.id));
    for (const id of duplicateIds(phase.tasks.map((task) => task.id))) {
      reasons.push(`work phase ${phase.id} has duplicate task id '${id}', so task dependency references are ambiguous`);
    }
    for (const task of phase.tasks) {
      for (const dependencyId of new Set(task.dependsOn ?? [])) {
        if (dependencyId === task.id) reasons.push(`task ${phase.id}/${task.id} depends on itself`);
        else if (!taskIds.has(dependencyId)) {
          reasons.push(`task ${phase.id}/${task.id} depends on unknown task '${dependencyId}' in the same work phase`);
        }
      }
    }
    const taskCycle = findDependencyCycle(phase.tasks.map((task) => ({
      id: task.id,
      dependsOn: (task.dependsOn ?? []).filter((dependencyId) => dependencyId !== task.id),
    })));
    if (taskCycle) {
      reasons.push(`task dependency cycle in work phase ${phase.id}: ${taskCycle.join(" -> ")}`);
    }

    if ((plan.schemaVersion ?? 1) >= 3) {
      for (const task of phase.tasks) {
        if (task.status === "done" && (task.outcome ?? "").trim().length === 0) {
          reasons.push(`task ${phase.id}/${task.id} is done but has no non-empty outcome`);
        }
        if (task.status === "pending" && task.outcome !== undefined) {
          reasons.push(`task ${phase.id}/${task.id} is pending but has outcome`);
        }
      }
    }
  }

  const phaseCycle = findDependencyCycle(plan.workPhases.map((phase) => ({
    id: phase.id,
    dependsOn: (phase.dependsOn ?? []).filter((dependencyId) => dependencyId !== phase.id),
  })));
  if (phaseCycle) reasons.push(`work phase dependency cycle: ${phaseCycle.join(" -> ")}`);

  const criterionIds = new Set(plan.criteria.map((criterion) => criterion.id));
  for (const id of duplicateIds(plan.criteria.map((criterion) => criterion.id))) {
    reasons.push(`duplicate criterion id '${id}' makes criteriaIds references ambiguous`);
  }
  for (const phase of plan.workPhases) {
    for (const criterionId of phase.criteriaIds) {
      if (!criterionIds.has(criterionId)) {
        reasons.push(`work phase ${phase.id} references unknown criterion '${criterionId}'`);
      }
    }
  }
  return reasons;
}

export function goalplanDependencyCompletionReasons(plan: Goalplan): string[] {
  const reasons: string[] = [];
  const phasesById = new Map(plan.workPhases.map((phase) => [phase.id, phase]));
  for (const phase of plan.workPhases) {
    if (phase.status === "done") {
      // 중복 참조는 한 사유 안의 목록에도 한 번만 나온다(감사 라운드 1 BLOCKER 1).
      const open = [...new Set(phase.dependsOn ?? [])].filter(
        (dependencyId) => phasesById.get(dependencyId)?.status !== "done",
      );
      if (open.length > 0) {
        reasons.push(`work phase ${phase.id} is done while dependency work phase(s) are not done: ${open.join(", ")}`);
      }
    }
    const tasksById = new Map(phase.tasks.map((task) => [task.id, task]));
    for (const task of phase.tasks) {
      if (task.status !== "done") continue;
      const open = [...new Set(task.dependsOn ?? [])].filter(
        (dependencyId) => tasksById.get(dependencyId)?.status !== "done",
      );
      if (open.length > 0) {
        reasons.push(`task ${phase.id}/${task.id} is done while dependency task(s) are not done: ${open.join(", ")}`);
      }
    }
  }
  return reasons;
}

export interface GoalplanValidation {
  ok: boolean;
  reasons: string[];
}
```

### 무결성·의존 사유 문자열 정본

**이 절의 문자열이 정본이며 060/070은 글자 그대로 인용한다.** 문자열을 바꾸려면 이 표와 위
구현 본문, 이 문서의 테스트 기대값을 먼저 함께 고친다.

| 구분 | 정본 문자열 |
| --- | --- |
| work phase dangling | `work phase <id> depends on unknown work phase '<dep>'` |
| work phase self | `work phase <id> depends on itself` |
| work phase cycle | `work phase dependency cycle: <closed-path>` |
| work phase duplicate id | `duplicate work phase id '<id>' makes dependency references ambiguous` |
| task duplicate id | `work phase <id> has duplicate task id '<id>', so task dependency references are ambiguous` |
| task dangling | `task <phase>/<task> depends on unknown task '<dep>' in the same work phase` |
| task self | `task <phase>/<task> depends on itself` |
| task cycle | `task dependency cycle in work phase <phase>: <closed-path>` |
| done task outcome 없음 | `task <phase>/<task> is done but has no non-empty outcome` |
| pending task outcome 존재 | `task <phase>/<task> is pending but has outcome` |
| criterion duplicate id | `duplicate criterion id '<id>' makes criteriaIds references ambiguous` |
| criterion dangling | `work phase <id> references unknown criterion '<id>'` |
| done work phase의 미완료 의존 | `work phase <id> is done while dependency work phase(s) are not done: <comma-separated-ids>` |
| done task의 미완료 의존 | `task <phase>/<task> is done while dependency task(s) are not done: <comma-separated-ids>` |

### 기존 테스트 소비자 조사 (§28)

2026-08-29에 아래 명령으로 `plugins/codexclaw/components/pabcd-state/test/` 전체를 검색했다.

```bash
rg -n -F \
  -e "fails the E8 quality gate" \
  -e "fails the E8 quality/integrity gate" \
  -e "Repair invalid dependency, outcome, and criteria references first" \
  -e "depends on unknown work phase" \
  -e "depends on itself" \
  -e "work phase dependency cycle:" \
  -e "duplicate work phase id" \
  -e "has duplicate task id" \
  -e "depends on unknown task" \
  -e "task dependency cycle in work phase" \
  -e "is done but has no non-empty outcome" \
  -e "is pending but has outcome" \
  -e "duplicate criterion id" \
  -e "references unknown criterion" \
  -e "is done while dependency work phase(s) are not done" \
  -e "is done while dependency task(s) are not done" \
  plugins/codexclaw/components/pabcd-state/test
```

검색 결과는 기존 `goal-gate.test.ts:314`의 옛 gate 정규식 한 건뿐이다. 새 문자열은 아직 소스에
없으므로 기존 테스트 소비자가 없다. 아래 표의 "신규 단언"은 이 wp가 새 테스트 파일이나 추가
테스트에서 문자열을 고정한다는 뜻이다.

| 이 wp가 내보내거나 바꾸는 출력 문자열 | 기존 테스트 파일:줄 | 소유자 | 갱신 diff 여부 |
| --- | --- | --- | --- |
| `work phase <id> depends on unknown work phase '<dep>'` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `work phase <id> depends on itself` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `work phase dependency cycle: <closed-path>` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `duplicate work phase id '<id>' makes dependency references ambiguous` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `work phase <id> has duplicate task id '<id>', so task dependency references are ambiguous` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `task <phase>/<task> depends on unknown task '<dep>' in the same work phase` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `task <phase>/<task> depends on itself` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `task dependency cycle in work phase <phase>: <closed-path>` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `task <phase>/<task> is done but has no non-empty outcome` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `task <phase>/<task> is pending but has outcome` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `duplicate criterion id '<id>' makes criteriaIds references ambiguous` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `work phase <id> references unknown criterion '<id>'` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `work phase <id> is done while dependency work phase(s) are not done: <ids>` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `task <phase>/<task> is done while dependency task(s) are not done: <ids>` | 없음 (`rg` 무출력) | wp3 신규 integrity 테스트 | 해당 없음, 신규 단언 포함 |
| `fails the E8 quality gate` → `fails the E8 quality/integrity gate` | `goal-gate.test.ts:314` | wp3, 기존 `bound goalplan failing E8` 테스트 | **예**, 아래 A diff |
| `Repair invalid dependency, outcome, and criteria references first` | 없음 (`rg` 무출력) | wp3 신규 goal-gate 통합 테스트 | 해당 없음, 신규 단언 포함 |

task ID 집합과 `tasksById`는 phase 루프 안에서 만든다. 서로 다른 phase의 같은 task ID는
오류가 아니다. task 의존 참조는 같은 work phase에서 **이미 존재하는 task ID**만 유효하다.

### wp2 경계와 겹치지 않는 지점 (P-phase stale check 260829)

wp2의 `reviveDependsOn()`은 **구조 경계**다. 필드가 배열이 아니거나 원소가 문자열이 아니거나
공백 id면 `"invalid"`를 내고 `reviveGoalplan()`이 plan 전체를 `null`로 거부한다
(`goalplan.ts:466-475`, `:496-508`). wp3는 그 다음 **의미 경계**다. 정상 `string[]` 안의
dangling, self, duplicate, cycle과 완료 상태를 본다. 담당이 달라 중복도 모순도 아니다.

여기서 나오는 세 가지 결과:

1. 파일에서 읽은 malformed `dependsOn`은 공개 integrity 함수까지 도달하지 않는다.
   `readGoalplan()`이 `null`을 내고 goal complete gate는 missing/malformed deny를 낸다
   (`goal-gate.ts:288-291`). 신규 테스트는 순수 helper 직접 호출과 read 경계 테스트를 섞어
   해석하지 않는다.
2. wp2 reviver는 nonblank outcome만 trim해 보존하고 blank·non-string outcome은 필드 자체를
   버린다(`goalplan.ts:511-514`). 그래서 `pending but has outcome` 사유는 revive 뒤에도 남는
   nonblank 문자열만 잡는다. blank pending outcome까지 별도 오류로 삼으려면 wp2 계약 변경이
   먼저 필요하며 이번 범위가 아니다.
3. definition 오류와 completion 오류는 한 plan에서 함께 나온다. done phase가 dangling 의존을
   가지면 unknown 사유와 not-done 사유가 모두 생긴다. gate는 앞 네 사유만 보여주므로 신규
   테스트가 사유 **순서**를 고정한다. `validateGoalplan()`에서 definition 사유가 completion
   사유보다 먼저 들어가고, 두 묶음 모두 empty-plan 사유보다 앞선다.

`validateGoalplan()` 시작점(`:871-883`)도 바꾼다. **wp2가 확정한 미래 버전 조기 return과 그
거부 문자열을 글자 그대로 보존하고**, 그 return 뒤에서 integrity 사유를 추가한다. wp2는
`effectiveSchemaVersion()`·`schemaMarkerPath()`가 아니라 `plan.schemaVersion`을 직접 검사하는
형태로 착지했으므로(커밋 d9259ca6, `goalplan.ts:871-883`), 아래 Before/After가 그 실제 코드다.
이전 초안의 marker 기반 가드를 그대로 붙이면 `goalplan.test.ts`의 v4 validate 단언이 깨진다.

Before:

```ts
// wp2 적용 후 (커밋 d9259ca6 실측)
export function validateGoalplan(plan: Goalplan, ctx?: GoalplanValidationCtx): GoalplanValidation {
  const reasons: string[] = [];
  // Refuse before any other check: a plan this binary cannot fully represent must
  // not be judged complete on a partial reading of it.
  if (typeof plan.schemaVersion === "number" && plan.schemaVersion > SUPPORTED_MAX_SCHEMA_VERSION) {
    return {
      ok: false,
      reasons: [
        `schemaVersion ${plan.schemaVersion} is newer than this build supports (max ${SUPPORTED_MAX_SCHEMA_VERSION}) - upgrade codexclaw before validating this plan`,
      ],
    };
  }
  if (plan.workPhases.length === 0 && plan.criteria.length === 0) {
```

After:

```ts
export function validateGoalplan(plan: Goalplan, ctx?: GoalplanValidationCtx): GoalplanValidation {
  const reasons: string[] = [];
  // Refuse before any other check: a plan this binary cannot fully represent must
  // not be judged complete on a partial reading of it.
  if (typeof plan.schemaVersion === "number" && plan.schemaVersion > SUPPORTED_MAX_SCHEMA_VERSION) {
    return {
      ok: false,
      reasons: [
        `schemaVersion ${plan.schemaVersion} is newer than this build supports (max ${SUPPORTED_MAX_SCHEMA_VERSION}) - upgrade codexclaw before validating this plan`,
      ],
    };
  }
  reasons.push(
    ...goalplanDefinitionIntegrityReasons(plan),
    ...goalplanDependencyCompletionReasons(plan),
  );
  if (plan.workPhases.length === 0 && plan.criteria.length === 0) {
```

기존 empty-plan, criterion evidence, 남은 phase, pending task, superseded, final gate 검사는 유지한다.

### MODIFY — `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts`

대상은 `:283-285`다. 조건, catch, 사유 네 개 제한은 유지한다.

Before:

```ts
// wp2 적용 후 상태
const reasons = verdict.reasons.slice(0, 4).join("; ");
return goalCompleteDenyEnvelope(
  `GOAL-COMPLETE-GATE-01: the session-bound goalplan '${state.slug}' fails the E8 quality gate: ${reasons}. Finish the remaining work and record fresh capturedEvidence in .codexclaw/goalplans/${state.slug}/goalplan.json (check with \`cxc loop validate --slug "${state.slug}"\`), or use update_goal status "blocked" if an external blocker prevents completion. Do not shrink the objective to escape the gate (LOOP-CONTINUE-01).`,
);
```

After:

```ts
const reasons = verdict.reasons.slice(0, 4).join("; ");
return goalCompleteDenyEnvelope(
  `GOAL-COMPLETE-GATE-01: the session-bound goalplan '${state.slug}' fails the E8 quality/integrity gate: ${reasons}. Repair invalid dependency, outcome, and criteria references first; then finish remaining work and record fresh capturedEvidence in .codexclaw/goalplans/${state.slug}/goalplan.json (check with \`cxc loop validate --slug "${state.slug}"\`), or use update_goal status "blocked" if an external blocker prevents completion. Do not shrink the objective to escape the gate (LOOP-CONTINUE-01).`,
);
```

## 테스트 본문

### NEW — `plugins/codexclaw/components/pabcd-state/test/goalplan-integrity.test.ts`

아래 내용 전체로 만든다.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGoalplan,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  validateGoalplan,
  type Goalplan,
  type GoalplanWorkPhase,
} from "../src/goalplan.ts";

function planWith(workPhases: GoalplanWorkPhase[], schemaVersion = 3): Goalplan {
  const plan = buildGoalplan({ objective: "integrity fixture" });
  plan.schemaVersion = schemaVersion;
  plan.workPhases = workPhases;
  plan.criteria = [];
  return plan;
}

test("definition integrity: work-phase dangling and self dependencies name exact reasons", () => {
  const dangling = planWith([
    { id: "wp-b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["ghost"] },
  ]);
  const self = planWith([
    { id: "wp-a", title: "a", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["wp-a"] },
  ]);

  const danglingReasons = goalplanDefinitionIntegrityReasons(dangling);
  const selfReasons = goalplanDefinitionIntegrityReasons(self);

  assert.deepEqual(danglingReasons, ["work phase wp-b depends on unknown work phase 'ghost'"]);
  assert.deepEqual(selfReasons, ["work phase wp-a depends on itself"]);
  assert.equal(selfReasons.some((reason) => reason.includes("dependency cycle")), false);
});

test("definition integrity: work-phase cycle reports a closed deterministic path", () => {
  const plan = planWith([
    { id: "b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
    { id: "a", title: "a", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["b"] },
  ]);

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, ["work phase dependency cycle: a -> b -> a"]);
});

test("definition integrity: task dependency is phase-local", () => {
  const plan = planWith([
    { id: "wp-a", title: "a", status: "pending", tasks: [
      { id: "shared", title: "shared a", status: "pending" },
      { id: "only-in-a", title: "only a", status: "pending" },
    ], criteriaIds: [] },
    { id: "wp-b", title: "b", status: "pending", tasks: [
      { id: "shared", title: "shared b", status: "pending" },
      { id: "leaf", title: "leaf", status: "pending", dependsOn: ["shared", "only-in-a"] },
    ], criteriaIds: [] },
  ]);

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, [
    "task wp-b/leaf depends on unknown task 'only-in-a' in the same work phase",
  ]);
  assert.equal(reasons.some((reason) => reason.includes("duplicate task id 'shared'")), false);
});

test("definition integrity: task self edge and cycle have distinct reasons", () => {
  const self = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "a", title: "a", status: "pending", dependsOn: ["a"] },
  ], criteriaIds: [] }]);
  const cycle = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "b", title: "b", status: "pending", dependsOn: ["a"] },
    { id: "a", title: "a", status: "pending", dependsOn: ["b"] },
  ], criteriaIds: [] }]);

  const selfReasons = goalplanDefinitionIntegrityReasons(self);
  const cycleReasons = goalplanDefinitionIntegrityReasons(cycle);

  assert.deepEqual(selfReasons, ["task wp-a/a depends on itself"]);
  assert.deepEqual(cycleReasons, ["task dependency cycle in work phase wp-a: a -> b -> a"]);
});

test("definition integrity: duplicate ids and dangling criteria use their authority scopes", () => {
  const plan = planWith([
    { id: "wp-a", title: "a1", status: "pending", tasks: [
      { id: "dup-task", title: "one", status: "pending" },
      { id: "dup-task", title: "two", status: "pending" },
    ], criteriaIds: ["missing-criterion"] },
    { id: "wp-a", title: "a2", status: "pending", tasks: [
      { id: "dup-task", title: "other phase", status: "pending" },
    ], criteriaIds: [] },
  ]);
  plan.criteria = [
    { id: "c-dup", scenario: "one", expectedEvidence: "one", capturedEvidence: null, status: "open" },
    { id: "c-dup", scenario: "two", expectedEvidence: "two", capturedEvidence: null, status: "open" },
  ];

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, [
    "duplicate work phase id 'wp-a' makes dependency references ambiguous",
    "work phase wp-a has duplicate task id 'dup-task', so task dependency references are ambiguous",
    "duplicate criterion id 'c-dup' makes criteriaIds references ambiguous",
    "work phase wp-a references unknown criterion 'missing-criterion'",
  ]);
});

test("completion integrity: done phase rejects each non-done dependency status", () => {
  for (const status of ["pending", "in_progress", "blocked", "superseded"] as const) {
    const plan = planWith([
      { id: "base", title: "base", status, tasks: [], criteriaIds: [] },
      { id: "leaf", title: "leaf", status: "done", tasks: [], criteriaIds: [], dependsOn: ["base"] },
    ]);

    const reasons = goalplanDependencyCompletionReasons(plan);

    assert.deepEqual(reasons, [
      "work phase leaf is done while dependency work phase(s) are not done: base",
    ], status);
  }
  const done = planWith([
    { id: "base", title: "base", status: "done", tasks: [], criteriaIds: [] },
    { id: "leaf", title: "leaf", status: "done", tasks: [], criteriaIds: [], dependsOn: ["base"] },
  ]);
  assert.deepEqual(goalplanDependencyCompletionReasons(done), []);
});

test("completion integrity: done task reads dependencies from its own phase", () => {
  const plan = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "base", title: "base", status: "pending" },
    { id: "leaf", title: "leaf", status: "done", outcome: "leaf finished", dependsOn: ["base"] },
  ], criteriaIds: [] }]);

  const pendingReasons = goalplanDependencyCompletionReasons(plan);
  plan.workPhases[0].tasks[0] = {
    ...plan.workPhases[0].tasks[0], status: "done", outcome: "base finished",
  };
  const doneReasons = goalplanDependencyCompletionReasons(plan);

  assert.deepEqual(pendingReasons, [
    "task wp-a/leaf is done while dependency task(s) are not done: base",
  ]);
  assert.deepEqual(doneReasons, []);
});

test("definition integrity: schema v3 enforces done and pending outcome states", () => {
  const plan = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "done-missing", title: "done", status: "done" },
    { id: "done-blank", title: "blank", status: "done", outcome: "   " },
    { id: "pending-present", title: "pending", status: "pending", outcome: "premature" },
    { id: "done-valid", title: "valid", status: "done", outcome: "node --test: 8 pass, 0 fail" },
  ], criteriaIds: [] }]);

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, [
    "task wp-a/done-missing is done but has no non-empty outcome",
    "task wp-a/done-blank is done but has no non-empty outcome",
    "task wp-a/pending-present is pending but has outcome",
  ]);
});

test("definition integrity: schema v1 and v2 allow legacy done tasks without outcome", () => {
  for (const schemaVersion of [1, 2]) {
    const plan = planWith([{ id: "wp-a", title: "legacy", status: "done", tasks: [
      { id: "legacy-done", title: "done before v3", status: "done" },
    ], criteriaIds: [] }], schemaVersion);

    const reasons = goalplanDefinitionIntegrityReasons(plan);

    assert.deepEqual(reasons, [], `schemaVersion ${schemaVersion}`);
  }
});

test("validateGoalplan places definition and completion reasons first", () => {
  const plan = planWith([
    { id: "base", title: "base", status: "pending", tasks: [], criteriaIds: [] },
    { id: "leaf", title: "leaf", status: "done", tasks: [
      { id: "done-missing", title: "done", status: "done" },
    ], criteriaIds: [], dependsOn: ["base"] },
  ]);

  const verdict = validateGoalplan(plan);

  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.reasons.slice(0, 2), [
    "task leaf/done-missing is done but has no non-empty outcome",
    "work phase leaf is done while dependency work phase(s) are not done: base",
  ]);
});

test("a joining DAG is not a cycle at either layer", () => {
  // 감사 라운드 1 BLOCKER 2: 기존 cycle 테스트는 2-node 순환만 봐서
  // findDependencyCycle()의 visited 재방문 분기(합류 지점)를 아무도 밟지 않았다.
  // diamond는 d를 두 경로로 두 번 만나므로 그 분기를 정확히 통과한다.
  const plan = planWith([
    { id: "a", title: "a", status: "pending", tasks: [], criteriaIds: [] },
    { id: "b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
    { id: "c", title: "c", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
    { id: "d", title: "d", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["b", "c"] },
    { id: "solo", title: "disconnected", status: "pending", tasks: [
      { id: "t-a", title: "a", status: "pending" },
      { id: "t-b", title: "b", status: "pending", dependsOn: ["t-a"] },
      { id: "t-c", title: "c", status: "pending", dependsOn: ["t-a"] },
      { id: "t-d", title: "d", status: "pending", dependsOn: ["t-b", "t-c"] },
    ], criteriaIds: [] },
  ]);

  assert.deepEqual(goalplanDefinitionIntegrityReasons(plan), []);
});

test("a repeated dependency reference is reported once, leaving room for other reasons", () => {
  // 감사 라운드 1 BLOCKER 1: raw 배열을 순회하면 같은 dangling 문장이 네 번 나와
  // goal-gate의 slice(0, 4)가 한 진단으로 소진된다. 중복은 첫 등장만 남는다.
  const plan = planWith([
    { id: "wp-1", title: "phase", status: "pending", tasks: [
      { id: "t-1", title: "task", status: "pending", outcome: "premature" },
    ], criteriaIds: ["c-missing"], dependsOn: ["ghost", "ghost", "ghost", "ghost"] },
  ]);

  assert.deepEqual(goalplanDefinitionIntegrityReasons(plan), [
    "work phase wp-1 depends on unknown work phase 'ghost'",
    "task wp-1/t-1 is pending but has outcome",
    "work phase wp-1 references unknown criterion 'c-missing'",
  ]);
});
```

### MODIFY — `plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts`

#### A. 기존 E8 문구 단언 갱신

실측 소비자 `:314`를 gate 출력 변경과 같은 diff에서 고친다.

Before:

```ts
// wp2 적용 후 상태
assert.match(reason, /fails the E8 quality gate/);
```

After:

```ts
assert.match(reason, /fails the E8 quality\/integrity gate/);
```

#### B. integrity 사유 통합 테스트 추가

기존 E8 실패 테스트(`:305-318`)와 EMPTY 테스트(`:320-330`) 사이에 아래 본문을 추가한다.
기존 import로 실행된다. A의 기존 단언 갱신도
보존한 상태가 이 After의 기준이다.

Before:

```ts
// wp2 적용 후 상태 + 위 A 적용 후
test("GOAL-COMPLETE-GATE-01: EMPTY bound goalplan -> deny (register the plan first)", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "Shell only" });
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("gc3"), phase: "IDLE", orchestrationActive: false, slug: plan.slug });
    const out = applyGoalCompleteGuard(ptuAt(cwd, "gc3", "update_goal", { status: "complete" }));
    assert.notEqual(out, "");
    assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecisionReason, /plan is empty/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

After:

```ts
test("GOAL-COMPLETE-GATE-01: dependency integrity failure is exposed in update_goal complete denial", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "dependency cycle" });
    plan.schemaVersion = 3;
    plan.workPhases = [
      { id: "b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
      { id: "a", title: "a", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["b"] },
    ];
    writeGoalplan(cwd, plan);
    writeState(cwd, {
      ...defaultState("gc-integrity"),
      phase: "IDLE",
      orchestrationActive: false,
      slug: plan.slug,
    });

    const out = applyGoalCompleteGuard(
      ptuAt(cwd, "gc-integrity", "update_goal", { status: "complete" }),
    );
    const parsed = JSON.parse(out.trimEnd()).hookSpecificOutput;

    assert.equal(parsed.permissionDecision, "deny");
    assert.match(parsed.permissionDecisionReason, /fails the E8 quality\/integrity gate/);
    assert.match(parsed.permissionDecisionReason, /work phase dependency cycle: a -> b -> a/);
    assert.match(parsed.permissionDecisionReason, /Repair invalid dependency, outcome, and criteria references first/);
    assert.equal(
      applyGoalCompleteGuard(ptuAt(cwd, "gc-integrity", "update_goal", { status: "blocked" })),
      "",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("GOAL-COMPLETE-GATE-01: EMPTY bound goalplan -> deny (register the plan first)", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "Shell only" });
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("gc3"), phase: "IDLE", orchestrationActive: false, slug: plan.slug });
    const out = applyGoalCompleteGuard(ptuAt(cwd, "gc3", "update_goal", { status: "complete" }));
    assert.notEqual(out, "");
    assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecisionReason, /plan is empty/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

## 구현 순서

1. wp2 적용 뒤 세 optional 필드가 타입과 reviver에 있는지 확인한다.
2. `goalplan.ts`에 private helper와 두 public 사유 함수를 추가한다.
3. `validateGoalplan()`의 reasons 초기값을 바꾼다.
4. 새 단위 테스트를 실행한다.
5. gate 안내와 통합 테스트를 고친다.
6. wp6에 `add-task --depends-on` 생성 시점 검증 계약을 인계한다. 같은 work phase의 기존 task id가
   아니면 이 문서의 정본 사유로 거부하고 plan과 ledger를 쓰지 않는다.
7. 금지 API·plan 전역 flatMap·mutation 잔여를 검사한 뒤 focused test → `npm run build` →
   `npm test` → `npm run gate` 순서로 실행한다.

## 검증 명령과 기대값

### 문서와 구현 경계

```bash
test -f devlog/_plan/260829_goalplan-dependency-execution/020_wp2_schema_v3.md
test -f devlog/_plan/260829_goalplan-dependency-execution/030_wp3_integrity.md
git status --porcelain -- \
  devlog/_plan/260829_goalplan-dependency-execution/030_wp3_integrity.md
git diff --no-index /dev/null \
  devlog/_plan/260829_goalplan-dependency-execution/030_wp3_integrity.md || test $? -eq 1
rg -n '^export function goalplan(DefinitionIntegrityReasons|DependencyCompletionReasons)' \
  plugins/codexclaw/components/pabcd-state/src/goalplan.ts
! rg -n 'plan\.workPhases\.flatMap' \
  plugins/codexclaw/components/pabcd-state/src/goalplan.ts \
  plugins/codexclaw/components/pabcd-state/test/goalplan-integrity.test.ts
```

`plan.workPhases.flatMap`만 금지한다. plan 전역 task 평탄화는 phase-local ID 권위를 깨지만,
`readyWorkPhases(plan).flatMap((wp) => wp.tasks)`는 검증을 마친 ready 목록만 펼치므로 허용해야 한다.

기대값: 두 `test -f`는 exit 0. `git status --porcelain`은 담당 문서의 `??` 한 줄을 출력한다.
`git diff --no-index` 자체는 새 문서 전체 diff를 출력하고 차이가 있으므로 exit 1이며, 뒤의 `test`가
그 값을 확인해 복합 명령은 exit 0이다. export 검색은 두 줄만 출력한다. 부정 검색은 출력이 없고
exit 0이다.

### 집중 테스트

```bash
node --test plugins/codexclaw/components/pabcd-state/test/goalplan-integrity.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts
```

기대값: 첫 명령은 `tests 12`, `pass 12`, `fail 0`, exit 0. 두 번째 명령도 `fail 0`, exit 0.

개수 근거: 라운드 1 감사 전 10건에 BLOCKER 2의 합류 DAG 음성 테스트와 BLOCKER 1의 중복 참조
테스트를 더해 12건이다. `--test-name-pattern`을 쓰지 않고 파일 전체를 돌리므로 매칭 0건에서
exit 0으로 끝나는 false-green은 발생하지 않는다. 그래도 `# tests` 값이 12인지 함께 읽는다.

### 전체 회귀와 저장소 gate

```bash
npm run build
npm test
npm run gate
```

기대값: 각 명령 exit 0. build는 tracked `dist/goalplan.js`와 `dist/goal-gate.js`를 다시 만들고
레이아웃을 검사한다. 뒤따른 전체 테스트는 `fail 0`이며 freshness 테스트가 두 dist와 src의
byte equality를 확인한다.

## 완료 판정

- 공개 API 이름이 정본의 두 export와 같다.
- task 참조와 완료 판정이 소속 phase 밖의 task를 읽지 않는다.
- plan 전역 task ID 중복은 사유가 아니고 phase 내부 중복만 사유다.
- dangling, self, cycle, outcome 사유가 구체 문자열로 고정됐다.
- schema v3 outcome 오류 두 종류를 잡고 v1/v2 done task는 허용한다.
- validator와 update_goal complete deny가 같은 integrity 사유를 앞쪽에 노출한다.
- 변경 목록에 CLI, steering, lifecycle, ledger, 공통 락 mutation이 없다.
- 모든 신규 테스트가 fixture, 호출, 문자열·상태 assert를 담는다.

DONE: 030_wp3_integrity.md — W5 tracked integrity dist manifest와 build 선행 검증 순서를 닫음
