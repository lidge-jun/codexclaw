# 020 — wp2: goalplan 스키마 v3 저장·복원 계약

> 작업 등급: C4 전체 로드맵 중 첫 구현 slice. 이 문서는 wp2의 diff를 고정한다.
> 구현 대상은 스키마 저장·복원·버전 경계뿐이다. 의존 대상 존재 여부, self/cycle,
> 실행 가능 판단, phase 선택 순서는 각각 wp3·wp4에서 다룬다.
> 선행 조건: `005_contract.md`의 확정 계약과 완료된 `010_wp1_roadmap.md`.

## 1. 목표와 비목표

### 목표

- `GoalplanWorkPhase`와 `GoalplanTask`가 선택적 `dependsOn: string[]`를 저장할 수 있게 한다.
- `GoalplanTask`가 선택적 완료 증거 `outcome?: string`을 저장할 수 있게 한다.
- `readGoalplan()` 뒤에도 두 계층의 `dependsOn`이 그대로 남게 한다.
- `readGoalplan()`은 task outcome을 trim한 뒤 비어 있지 않을 때만 보존한다.
- wp6이 구현할 `addGoalplanTask()` 입력 `{ id, title, dependsOn? }`을 받을 수 있도록
  `GoalplanTask.dependsOn?: string[]` 타입과 reviver 보존 계약을 먼저 고정한다.
- 새 plan은 `schemaVersion: 3`을 명시한다.
- 이 바이너리가 이해하지 못하는 v4 이상 plan은 읽기와 완료 검증 양쪽에서 거부한다.
- 잘못된 `dependsOn` 때문에 읽기가 실패하면 `invalid-shape` 진단에 정확한 필드명이 나온다.
- 변경 전 parser가 발견한 모든 `goalplan.json`의 결과 집합과 비식별 입력 corpus를 baseline JSON으로
  생성해 fixture에 체크인한다. 발견 개수와 manifest는 기록하되 개수를 통과 조건으로 쓰지 않는다.

### 이 phase에서 하지 않는 것

- dangling/self/cycle/중복 id 검증을 추가하지 않는다. 이는 wp3 범위다.
- `nextOpenTask()`, `effectiveActiveWorkPhaseId()`, `advanceWorkPhase()`의 배열 순서 선택을 바꾸지 않는다. 이는 wp4 범위다.
- task/criterion 완료 연산이나 ledger 이벤트 발생 코드를 추가하지 않는다. CLI와 lifecycle 기록은 wp6 범위다.
- `addGoalplanTask()` 본문과 `add-task` CLI는 추가하지 않는다. wp2는 입력에 필요한 task 타입과
  저장·복원만 맡고, wp6이 `{ id, title, dependsOn? }` 입력을 실제 mutation에 연결한다.
- 공통 락과 RMW 직렬화, CAS, `.steer.lock` 확장을 하지 않는다. 락은 wp5 범위다.
- legacy `criteria[].text` 읽기 backpatch를 추가하지 않는다. 이번 변경 전부터 읽지 못한 형식이며 wp7은 변경 전후 파싱 결과 집합의 동등성만 검사한다.
- senpi-task DAG 엔진, 별도 스케줄러, 별도 상태 저장소를 가져오지 않는다.

## 2. 확인한 현재 코드

- `GoalplanTask`는 현재 `id`, `title`, `status`만 가진다: `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:74-78`.
- `GoalplanWorkPhase`에도 의존 필드가 없다: 같은 파일 `:80-90`.
- `reviveGoalplan()`은 work phase와 task를 새 객체로 재구성한다. 현재 허용 목록에 없는 필드는 읽는 순간 사라진다: 같은 파일 `:428-515`.
- task 복원은 `tasks.push({ id, title, status })`만 실행하므로 저장된 outcome도 버린다: 같은 파일 `:449-455`.
- 잘못된 work-phase status는 `pending`, task status는 `pending`으로 정규화한다: 같은 파일 `:445-455`.
- `criteriaIds`는 문자열 원소만 남긴다: 같은 파일 `:456-458`.
- `steeringLog`는 한 항목이라도 잘못되면 plan 전체를 거부한다. 일부 유실이 재적용을 허용하기 때문이다: 같은 파일 `:387-417`, `:512-514`.
- `firstInvalidField()`가 `invalid-shape`의 필드명을 만든다: 같은 파일 `:594-612`.
- `buildGoalplan()`은 현재 `schemaVersion`을 쓰지 않는다: 같은 파일 `:669-695`.
- `effectiveSchemaVersion()`은 marker가 있으면 최소 v2로 올리지만 최대 지원 버전을 검사하지 않는다: 같은 파일 `:771-775`.
- `validateGoalplan()`은 v3도 v2 이상으로만 보고 `finalGateReasons()`를 실행한다: 같은 파일 `:791-819`, `:871-919`.
- 테스트는 `node:test`의 `test()`를 쓰며, 스키마 왕복 테스트는 `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts:30-45`에 있다.

## 3. 설계 결정

### 3.1 `dependsOn` shape 오류는 plan 전체를 거부한다

필드가 없으면 `undefined`로 둔다. 기존 v1/v2 plan과 의존이 없는 v3 항목은 그대로 읽힌다.
필드가 있으면 다음 조건을 모두 만족해야 한다.

1. 배열이다.
2. 모든 원소가 문자열이다.
3. 모든 문자열은 `trim()` 기준으로 비어 있지 않다.

빈 배열은 “의존 없음”이라는 명시이므로 유효하다. 공백만 있는 문자열은 빈 id와 같으므로 거부한다.
유효한 문자열은 trim하거나 정규화하지 않고 원문 그대로 보존한다. id 의미와 참조 무결성은 wp3가 판정한다.

저장 계층에서 `dependsOn === undefined`와 `dependsOn === []`는 모두 “의존 없음”이다. reviver는 기존
파일의 byte shape를 지키려고 미지정 필드를 붙이지 않고, 명시된 빈 배열은 빈 배열로 보존한다. wp4 이후
소비자는 `(dependsOn ?? [])`로 읽으며 두 표현을 다른 실행 상태로 나누지 않는다.

일부 원소만 걸러내거나 필드 전체를 조용히 삭제하는 방식은 채택하지 않는다. wp4가 `dependsOn`을
실행 장벽으로 사용하기 시작한 뒤 의존 하나가 유실되면 아직 준비되지 않은 task/phase가 실행 가능해진다.
이는 `steeringLog` 일부 유실이 중복 적용을 허용하는 것과 같은 위험 방향이다. 반대로 잘못된 status를
`pending`으로 내리는 기존 정규화는 작업을 늦출 뿐 조기 실행을 만들지 않는다. 따라서 status 관례와
충돌하지 않으며, 위험한 의미 필드는 `steeringLog`처럼 fail-closed로 처리하는 것이 일관된다.

### 3.2 task outcome은 trim한 비어 있지 않은 문자열만 보존한다

`GoalplanTask.outcome?: string`은 task 완료 증거의 권위 필드다. wp2는 타입과 복원만 소유하고,
`status === "done"`과 outcome의 결합 검증은 wp3, `complete-task --outcome` 입력과 원장 detail 기록은
wp6이 맡는다.

reviver는 `tt.outcome`이 문자열이면 trim한다. 결과가 비어 있지 않을 때만 복원 task에 `outcome`을
붙인다. 필드가 없거나 문자열이 아니거나 trim 결과가 빈 문자열이면 필드를 붙이지 않는다. 기존 plan을
읽었다가 다시 직렬화할 때 없던 key가 생기지 않아 task 객체의 JSON bytes가 같다. 이는
`reviewRounds`와 `schemaVersion`을 실제 입력에 있을 때만 붙이는 `goalplan.ts:490-509` 관례와 같다.

### 3.3 v3가 신규 plan의 선언 버전이다

`buildGoalplan()`은 `schemaVersion: 3`을 항상 쓴다. v3의 의미는 “work phase/task의 선택적
`dependsOn` 필드를 이해하고 보존한다”이다. 필드가 실제로 비어 있더라도 v3 바이너리가 만든 plan은
v3를 선언해야 구버전 바이너리가 모르는 필드를 조용히 삭제하지 않는다.

기존 파일에서 `schemaVersion`이 없으면 계속 v1로 읽는다. `schema-v2.marker`도 계속 버전을 최소 2로만
올린다. v3 marker를 새로 만들지 않는다. 이 phase는 기존 plan의 일괄 승격이나 마이그레이션이 아니다.

### 3.4 지원 최대 버전은 3이며 미래 버전은 fail-closed다

`SUPPORTED_MAX_SCHEMA_VERSION = 3`을 스키마 소유 모듈에 둔다. `effectiveSchemaVersion()`은 실제
유효 버전을 반환하며 미래 버전을 3으로 clamp하지 않는다. clamp하면 v4를 v3로 오인하기 때문이다.

v4 plan은 두 경로에서 실패한다.

- 디스크 읽기: `reviveGoalplan()`이 `null`을 반환하고 `readGoalplanDetailed()`은
  `kind: "invalid-shape"`, `field: "schemaVersion"`을 반환한다. 따라서 다섯 RMW 소비자는 plan을 얻지
  못해 쓰기로 진행할 수 없다.
- 메모리 검증: 호출자가 직접 만든 `Goalplan`처럼 reviver를 거치지 않은 값도 `validateGoalplan()`이
  `ok: false`와 “supports at most 3” 사유 하나로 즉시 거부한다. v4를 v2 final-gate 규칙으로 계속
  해석하지 않는다.

### 3.5 변경 전 parser baseline은 wp2 첫 산출물이다

2026-08-29 재측정값은 `.codexclaw/goalplans/` 디렉터리 91개, 그 아래 `goalplan.json` 90개다.
이 수치는 관측 기록일 뿐 생성기 상수가 아니다. wp2 소스와 테스트를 고치기 전에 현재 parser가
발견한 파일을 모두 읽고, manifest와 `sourceCount`를 baseline JSON에 함께 적는다. wp7은 manifest에
실린 각 fixture의 변경 전 `expected`와 변경 후 normalized 결과가 같은지만 판정한다. 운영 디렉터리에
파일이 더 생겨도 체크인된 baseline의 회귀 판정은 바뀌지 않는다.

비식별화는 denylist가 아니라 allowlist다. fixture마다 alias map을 새로 만들고, parser가 enum으로
읽는 값과 boolean·숫자만 원본으로 둔다. 그 밖의 문자열은
`fixture-<ordinal>-string-<sequence>`로 바꾼다. 같은 fixture 안의 id와 `dependsOn` 참조는 같은
alias를 받아 관계를 유지하지만, 서로 다른 fixture 사이에는 alias 관계가 없다. plan의 slug는
재파싱 디렉터리와 맞도록 `fixture-<ordinal>`로 고정한다. 각 fixture와 manifest 항목은 070의
소비 정본대로 `ordinal`, `alias`, `sourceClass`, `expected`를 가지며 fixture에만 `plan`을 더한다.
snapshot은 `measuredOn`, `sourceCount`, `manifest`, `fixtures`만 가진다. `invalid-shape` 결과는 진단
`field`를 `criteria-shape` 또는 `other-shape`로 정규화한다.

생성기는 비식별 plan을 임시 cwd에 다시 쓴 뒤 `readGoalplanDetailed()`로 재파싱한다. 재파싱 결과가
원본의 normalized `expected`와 하나라도 다르면 JSON을 쓰지 않는다. 생성 직후 JSON 전체에서 UUID,
절대 경로, 40자 hex가 남았는지도 검사한다.

## 4. 변경 지도

### 4.1 출력·타입 변경과 기존 테스트 검색

2026-08-29 checkout에서 아래 명령으로 실제 검색했다.

```bash
cd /Users/jun/Developer/new/700_projects/codexclaw
rg -n 'schemaVersion|invalid-shape|criteria\[\]|supports at most|buildGoalplan\(|GoalplanTask|outcome|dependsOn' \
  plugins/codexclaw/components/pabcd-state/test --glob '*.test.ts'
rg -n 'validateGoalplan\([^,)]*\)|applyGoalCompleteGuard|permissionDecisionReason|requires a finalGate|no valid surface' \
  plugins/codexclaw/components/pabcd-state/test --glob '*.test.ts'
```

| 이 wp가 바꾸는 값 | 기존 테스트 검색 결과 | 기존 단언 변경 소유자 | 이 문서의 갱신 diff |
|---|---|---|---|
| `buildGoalplan()` 기본 `schemaVersion`: 생략 → `3` | `goalplan.test.ts:135-158`은 context 없는 legacy 완료를 `ok === true`로 기대한다. `final-gate.test.ts:64-72`의 `plan()`은 v1 fixture다. `work-phase-states.test.ts:33-35`의 공통 builder도 context 없이 완료를 검사한다. `goal-gate.test.ts:362-367`은 final gate 없는 plan의 완료 허용을 기대한다. | wp2(020), 유일한 소유자 | §5.2 C, §5.3, §5.4, §5.5에서 각 legacy fixture에 `schemaVersion = 1`을 명시한다. |
| 미래 버전 거부 사유 `schemaVersion <n> ... supports at most 3` | 기존 테스트에서 `supports at most` 검색 결과는 0건이다. | 기존 단언 없음. 신규 문자열 소유자는 wp2(020) | 기존 assert 갱신은 없다. §5.2 B의 신규 v4 테스트가 정확한 두 문자열 조각을 고정한다. |
| `schemaVersion 2 requires it`·`schemaVersion 2 requires a finalGate` → 실제 `${version}` 표기 | `final-gate.test.ts:125,142,156,333`이 각각 `/requires a finalGate/`, `/no valid surface/`를 기다린다. v2 입력의 실제 출력은 그대로이며 regex도 버전 숫자에 결합되지 않았다. | 기존 단언을 바꾸지 않음. 동적 버전 표기 소유자는 wp2(020) | 기존 네 assert가 v2 문구 보존을 계속 검사하고, 신규 v3 경로는 §5.2의 완료 검증 테스트가 잡는다. |
| `invalid-shape.field`의 새 값 `workPhases[].dependsOn`, `workPhases[].tasks[].dependsOn`, `schemaVersion` | 기존 테스트에서 `diagnostic.field`, `invalid-shape`, 기존 criteria-shape 문구를 기다리는 assert는 0건이다. | 기존 단언 없음. 신규 진단 소유자는 wp2(020) | 기존 assert 갱신은 없다. §5.2 B의 신규 malformed/v4 테스트가 새 필드를 고정한다. |
| `GoalplanTask.outcome?`, task/work-phase `dependsOn?` | 기존 테스트의 task object는 구조 전체 exact-equal이 아니라 필요한 필드를 읽거나 `Goalplan` 타입으로 조립한다. optional 필드라 기존 fixture 수정은 필요 없다. | 기존 단언 변경 없음. 스키마 소유자는 wp2(020) | 기존 task fixture는 유지하고 §5.2 B에 미지정·빈 배열·값 있음 왕복과 outcome trim 테스트를 추가한다. |

검색 결과에 없는 문자열을 기다리는 테스트를 추측해서 만들지 않는다. 위 네 파일의 legacy 고정 diff는
`buildGoalplan()` 출력 변경 때문에 실제로 깨지는 기존 assertion만 고친다.

- **MODIFY** `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`
  - v3 타입, 최대 지원 버전, `dependsOn` reviver, task outcome 보존, 미래 버전 거부, 진단, 신규 plan 버전을 추가한다.
- **MODIFY** `plugins/codexclaw/components/pabcd-state/dist/goalplan.js`
  - `npm run build`가 `src/goalplan.ts`에서 다시 만든 tracked 배포 산출물이다.
- **MODIFY** `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`
  - 의존 왕복, malformed shape, outcome trim·미지정 보존, v3 선언, v4 거부 회귀 테스트를 추가한다.
- **MODIFY** `plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts`
  - `plan()`의 “v1 fixture” 의도를 `schemaVersion: 1`로 명시한다.
- **MODIFY** `plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts`
  - work-phase 상태만 검증하는 fixture를 v1로 고정해 final-gate 계약과 분리한다.
- **MODIFY** `plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts`
  - final gate 없이 통과해야 하는 기존 완료 fixture가 legacy v1임을 명시한다.
- **NEW** `plugins/codexclaw/components/pabcd-state/test/fixtures/capture-goalplan-baseline.mjs`
  - 변경 전 parser 결과와 발견한 allowlist 비식별 입력을 manifest와 함께 한 JSON으로 만든다.
- **NEW** `plugins/codexclaw/components/pabcd-state/test/fixtures/goalplans-pre-change-baseline.json`
  - 생성기가 만든 manifest, 입력, 변경 전 parser 결과 집합을 그대로 체크인한다.
- **DELETE 없음**

## 5. Diff-level PRD

### 5.1 MODIFY — `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

#### A. 지원 버전과 타입

Before:

```ts
// wp1 적용 후 상태
export const GOALPLAN_LEDGER_FILE = "ledger.jsonl";

export type CriterionStatus = "open" | "met";
```

After:

```ts
export const GOALPLAN_LEDGER_FILE = "ledger.jsonl";
export const SUPPORTED_MAX_SCHEMA_VERSION = 3;

export type CriterionStatus = "open" | "met";
```

Before:

```ts
// wp1 적용 후 상태
export interface GoalplanTask {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface GoalplanWorkPhase {
  id: string;
  title: string;
  status: WorkPhaseStatus;
  tasks: GoalplanTask[];
  criteriaIds: string[];
```

After:

```ts
export interface GoalplanTask {
  id: string;
  title: string;
  status: TaskStatus;
  /** trimmed completion evidence; written by the wp6 complete-task lifecycle. */
  outcome?: string;
  /** task ids that must be done before this task is ready; interpreted in wp4. */
  dependsOn?: string[];
}

// wp6이 구현할 공개 lifecycle 입력 계약:
// input: { id: string; title: string; dependsOn?: string[] }

export interface GoalplanWorkPhase {
  id: string;
  title: string;
  status: WorkPhaseStatus;
  tasks: GoalplanTask[];
  criteriaIds: string[];
  /** work-phase ids that must be done before this phase is ready; interpreted in wp4. */
  dependsOn?: string[];
```

#### B. `dependsOn` 전용 reviver

`reviveSteeringLog()` 바로 뒤, `goalplanPath()` 앞에 추가한다.

Before:

```ts
// wp1 적용 후 상태
function goalplanPath(cwd: string, slug: string): string {
  return join(goalplanDir(cwd, slug), GOALPLAN_FILE);
}
```

After:

```ts
/**
 * Preserve a dependency list exactly, or reject it as a unit.
 * Dropping one dependency could make blocked work executable, so partial recovery
 * is unsafe. Missing stays missing for v1/v2 compatibility; [] is valid.
 */
function reviveDependsOn(raw: unknown): string[] | undefined | "invalid" {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return "invalid";
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string" || id.trim().length === 0) return "invalid";
    out.push(id);
  }
  return out;
}

function goalplanPath(cwd: string, slug: string): string {
  return join(goalplanDir(cwd, slug), GOALPLAN_FILE);
}
```

#### C. `reviveGoalplan()`에서 미래 버전, task outcome, 두 계층의 의존 필드 보존

버전은 work phase 순회 전에 판정한다. 현재 `schemaVersion` 부착부에서 다시 계산하지 않도록
`declaredSchemaVersion` 지역값을 재사용한다.

Before:

```ts
// wp1 적용 후 상태
  if (expectedSlug !== undefined && o.slug !== expectedSlug) return null;
  if (!Array.isArray(o.workPhases) || !Array.isArray(o.criteria)) return null;

  const workPhases: GoalplanWorkPhase[] = [];
```

After:

```ts
  if (expectedSlug !== undefined && o.slug !== expectedSlug) return null;
  if (!Array.isArray(o.workPhases) || !Array.isArray(o.criteria)) return null;
  const declaredSchemaVersion =
    typeof o.schemaVersion === "number" && Number.isFinite(o.schemaVersion)
      ? Math.floor(o.schemaVersion)
      : undefined;
  if (
    declaredSchemaVersion !== undefined
    && declaredSchemaVersion > SUPPORTED_MAX_SCHEMA_VERSION
  ) return null;

  const workPhases: GoalplanWorkPhase[] = [];
```

Before:

```ts
// wp1 적용 후 상태
    const tasks: GoalplanTask[] = [];
    for (const t of Array.isArray(w.tasks) ? (w.tasks as unknown[]) : []) {
      if (typeof t !== "object" || t === null) continue;
      const tt = t as Record<string, unknown>;
      if (typeof tt.id !== "string" || typeof tt.title !== "string") continue;
      tasks.push({ id: tt.id, title: tt.title, status: tt.status === "done" ? "done" : "pending" });
    }
    const criteriaIds = Array.isArray(w.criteriaIds)
      ? (w.criteriaIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const phase: GoalplanWorkPhase = { id: w.id, title: w.title, status, tasks, criteriaIds };
    if (typeof w.blockedReason === "string") phase.blockedReason = w.blockedReason;
```

After:

```ts
    const phaseDependsOn = reviveDependsOn(w.dependsOn);
    if (phaseDependsOn === "invalid") return null;
    const tasks: GoalplanTask[] = [];
    for (const t of Array.isArray(w.tasks) ? (w.tasks as unknown[]) : []) {
      if (typeof t !== "object" || t === null) continue;
      const tt = t as Record<string, unknown>;
      if (typeof tt.id !== "string" || typeof tt.title !== "string") continue;
      const taskDependsOn = reviveDependsOn(tt.dependsOn);
      if (taskDependsOn === "invalid") return null;
      const task: GoalplanTask = {
        id: tt.id,
        title: tt.title,
        status: tt.status === "done" ? "done" : "pending",
      };
      const outcome = typeof tt.outcome === "string" ? tt.outcome.trim() : "";
      if (outcome.length > 0) task.outcome = outcome;
      if (taskDependsOn !== undefined) task.dependsOn = taskDependsOn;
      tasks.push(task);
    }
    const criteriaIds = Array.isArray(w.criteriaIds)
      ? (w.criteriaIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const phase: GoalplanWorkPhase = { id: w.id, title: w.title, status, tasks, criteriaIds };
    if (phaseDependsOn !== undefined) phase.dependsOn = phaseDependsOn;
    if (typeof w.blockedReason === "string") phase.blockedReason = w.blockedReason;
```

Before:

```ts
// wp1 적용 후 상태
  if (typeof o.schemaVersion === "number" && Number.isFinite(o.schemaVersion)) {
    plan.schemaVersion = Math.floor(o.schemaVersion);
  }
```

After:

```ts
  if (declaredSchemaVersion !== undefined) plan.schemaVersion = declaredSchemaVersion;
```

#### D. `firstInvalidField()`가 정확한 의존 필드를 지목

work-phase 엔트리 기본 shape 검사 직후, criteria 검사 전에 넣는다. reviver가 실제로 검사하는 순서대로
phase 필드를 먼저 보고, id/title이 유효해 reviver 대상이 되는 task만 검사한다.

Before:

```ts
// wp1 적용 후 상태
  if (!Array.isArray(o.workPhases)) return "workPhases";
  if (Array.isArray(o.workPhases) && o.workPhases.some((w) => typeof w !== "object" || w === null || typeof (w as Record<string, unknown>).id !== "string")) {
    return "workPhases[] entries (each needs id/title/status)";
  }
  if (!Array.isArray(o.criteria)) return "criteria";
```

After:

```ts
  if (!Array.isArray(o.workPhases)) return "workPhases";
  if (o.workPhases.some((w) => {
    if (typeof w !== "object" || w === null) return true;
    const wp = w as Record<string, unknown>;
    return typeof wp.id !== "string" || typeof wp.title !== "string";
  })) {
    return "workPhases[] entries (each needs id/title)";
  }
  for (const rawWp of o.workPhases) {
    const wp = rawWp as Record<string, unknown>;
    if (reviveDependsOn(wp.dependsOn) === "invalid") return "workPhases[].dependsOn";
    for (const rawTask of Array.isArray(wp.tasks) ? wp.tasks : []) {
      if (typeof rawTask !== "object" || rawTask === null) continue;
      const task = rawTask as Record<string, unknown>;
      if (typeof task.id !== "string" || typeof task.title !== "string") continue;
      if (reviveDependsOn(task.dependsOn) === "invalid") {
        return "workPhases[].tasks[].dependsOn";
      }
    }
  }
  if (!Array.isArray(o.criteria)) return "criteria";
```

`schemaVersion` 진단은 slug 검사 다음, workPhases 검사 전에 추가한다.

Before:

```ts
// wp1 적용 후 상태
  if (typeof o.slug !== "string") return "slug";
  if (!Array.isArray(o.workPhases)) return "workPhases";
```

After:

```ts
  if (typeof o.slug !== "string") return "slug";
  if (
    typeof o.schemaVersion === "number"
    && Number.isFinite(o.schemaVersion)
    && Math.floor(o.schemaVersion) > SUPPORTED_MAX_SCHEMA_VERSION
  ) return "schemaVersion";
  if (!Array.isArray(o.workPhases)) return "workPhases";
```

#### E. 신규 plan은 v3를 선언

Before:

```ts
// wp1 적용 후 상태
    criteria,
    host: {
```

After:

```ts
    criteria,
    schemaVersion: SUPPORTED_MAX_SCHEMA_VERSION,
    host: {
```

#### F. 완료 검증에서도 미래 버전 거부

`effectiveSchemaVersion()`은 미래 버전을 숨기지 않는다는 계약을 주석으로 고정한다.

Before:

```ts
// wp1 적용 후 상태
/** Absent schemaVersion means 1; the marker can only raise the answer. */
export function effectiveSchemaVersion(plan: Goalplan, markerPresent: boolean): number {
  const declared = typeof plan.schemaVersion === "number" ? plan.schemaVersion : 1;
  return markerPresent ? Math.max(declared, 2) : declared;
}
```

After:

```ts
/**
 * Absent schemaVersion means 1; the marker can only raise the answer.
 * Do not clamp to SUPPORTED_MAX_SCHEMA_VERSION: callers must see and reject a
 * future version instead of interpreting it as the newest version they know.
 */
export function effectiveSchemaVersion(plan: Goalplan, markerPresent: boolean): number {
  const declared = typeof plan.schemaVersion === "number" ? plan.schemaVersion : 1;
  return markerPresent ? Math.max(declared, 2) : declared;
}
```

`validateGoalplan()`의 다른 의미 검증보다 먼저 미래 버전을 거부한다. v4에 v2 규칙을 적용해 여러
부수 오류를 만들지 않도록 즉시 반환한다.

Before:

```ts
// wp1 적용 후 상태
export function validateGoalplan(plan: Goalplan, ctx?: GoalplanValidationCtx): GoalplanValidation {
  const reasons: string[] = [];
  if (plan.workPhases.length === 0 && plan.criteria.length === 0) {
```

After:

```ts
export function validateGoalplan(plan: Goalplan, ctx?: GoalplanValidationCtx): GoalplanValidation {
  const markerPresent = ctx ? existsSync(schemaMarkerPath(ctx.cwd, plan.slug)) : false;
  const version = effectiveSchemaVersion(plan, markerPresent);
  if (version > SUPPORTED_MAX_SCHEMA_VERSION) {
    return {
      ok: false,
      reasons: [
        `unsupported goalplan schemaVersion ${version}; this binary supports at most ${SUPPORTED_MAX_SCHEMA_VERSION} — upgrade CodexClaw before reading or mutating this plan`,
      ],
    };
  }
  const reasons: string[] = [];
  if (plan.workPhases.length === 0 && plan.criteria.length === 0) {
```

`finalGateReasons()`의 기존 marker 계산은 그대로 둔다. 중복 파일 조회는 검증 한 번당 최대 두 번이며,
이번 phase에서 함수 시그니처와 호출부를 넓혀 얻는 이익이 없다. 후속 정리 대상도 아니다.

이 미래 버전 거부 가드는 wp2가 `validateGoalplan()` 맨 앞에 둔다. wp3는 이 가드를 유지한 채
`goalplanDefinitionIntegrityReasons()`가 만든 integrity 사유를 버전 가드 뒤에 붙인다.

v3 plan에 v2라고 잘못 안내하지 않도록 같은 함수의 두 진단은 이미 계산한 `version`을 사용한다.

Before:

```ts
// wp1 적용 후 상태
      out.push(`criterion ${c.id} has no valid surface ("logic" | "web" | "tui") — schemaVersion 2 requires it, since an unclassified criterion would silently escape the QA requirement`);
```

After:

```ts
      out.push(`criterion ${c.id} has no valid surface ("logic" | "web" | "tui") — schemaVersion ${version} requires it, since an unclassified criterion would silently escape the QA requirement`);
```

Before:

```ts
// wp1 적용 후 상태
      "schemaVersion 2 requires a finalGate - open a final-gate review round with " +
```

After:

```ts
      `schemaVersion ${version} requires a finalGate - open a final-gate review round with ` +
```

### 5.2 MODIFY — `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`

#### A. import 확장

Before:

```ts
// wp1 적용 후 상태 (wp1은 소스를 바꾸지 않았으므로 현재 HEAD와 동일)
// 실측 위치: plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts:6-20
import {
  buildGoalplan,
  readGoalplan,
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
  type Goalplan,
} from "../src/goalplan.ts";
```

After:

```ts
// wp1 적용 후 + 이 wp 추가분
// wp1 추가 이름: 없음(wp1은 문서 전용 사이클)
// wp2 추가 이름: readGoalplanDetailed, effectiveSchemaVersion
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

정본 §36에 따라 After는 부분 조각이 아니라 전체 import 블록이다. `npm run build`는 타입만
제거하므로 이름 누락을 잡지 못한다. 구현자는 위 After 블록을 그대로 파일에 반영하고, 기존 13개
이름 중 하나라도 사라지지 않았는지 눈으로 확인한다.

#### B. 정확한 테스트 케이스와 제목

첫 번째 schema round-trip 테스트 뒤에 아래 여덟 개를 추가한다. 저장 경계와 공개 validator를 써서
검증하며 private reviver/helper를 export하지 않는다.

```ts
test("schema v3: work-phase/task dependsOn survives a write/read round trip", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "dependency round trip" });
  plan.workPhases = [
    {
      id: "wp-1",
      title: "foundation",
      status: "done",
      tasks: [{ id: "t-1", title: "foundation task", status: "done", outcome: "foundation complete", dependsOn: [] }],
      criteriaIds: [],
      dependsOn: [],
    },
    {
      id: "wp-2",
      title: "consumer",
      status: "pending",
      tasks: [
        { id: "t-2", title: "first", status: "done", outcome: "first complete" },
        { id: "t-3", title: "second", status: "pending", dependsOn: ["t-2"] },
      ],
      criteriaIds: [],
      dependsOn: ["wp-1"],
    },
  ];

  // act
  writeGoalplan(cwd, plan);
  const back = readGoalplan(cwd, plan.slug);

  // assert
  assert.ok(back);
  assert.deepEqual(back.workPhases[0].dependsOn, []);
  assert.deepEqual(back.workPhases[0].tasks[0].dependsOn, []);
  assert.deepEqual(back.workPhases[1].dependsOn, ["wp-1"]);
  assert.equal(back.workPhases[1].tasks[0].dependsOn, undefined);
  assert.deepEqual(back.workPhases[1].tasks[1].dependsOn, ["t-2"]);
  assert.deepEqual(
    back.workPhases[0].tasks[0].dependsOn ?? [],
    back.workPhases[1].tasks[0].dependsOn ?? [],
    "undefined and [] both mean no task dependency",
  );
});

test("schema v3: malformed dependsOn or phase shape rejects the whole plan and names the field", () => {
  // arrange
  const cases: Array<{
    name: string;
    field: string;
    detailPattern: RegExp;
    apply: (raw: any) => void;
  }> = [
    { name: "phase is not an array", field: "workPhases[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].dependsOn = "wp-0"; } },
    { name: "phase has a non-string", field: "workPhases[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].dependsOn = [1]; } },
    { name: "phase has an empty id", field: "workPhases[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].dependsOn = [" "]; } },
    { name: "task is not an array", field: "workPhases[].tasks[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].tasks[0].dependsOn = "t-0"; } },
    { name: "task has a non-string", field: "workPhases[].tasks[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].tasks[0].dependsOn = [null]; } },
    { name: "task has an empty id", field: "workPhases[].tasks[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].tasks[0].dependsOn = [""]; } },
    // 감사 라운드 10 BLOCKER 2: D의 phase 기본 shape 검사 확장(id만 -> id와 title)을 실제로 커버한다.
    // 이 두 case가 없으면 After에서 title 검사를 빼거나 필드 문자열을 틀려도 focused GREEN이 된다.
    { name: "phase title is missing", field: "workPhases[] entries (each needs id/title)", detailPattern: /workPhases/, apply: (raw) => { delete raw.workPhases[0].title; } },
    { name: "phase title is not a string", field: "workPhases[] entries (each needs id/title)", detailPattern: /workPhases/, apply: (raw) => { raw.workPhases[0].title = 42; } },
  ];

  for (const c of cases) {
    // arrange
    const cwd = tmp();
    const plan = buildGoalplan({ objective: `bad dependsOn ${c.name}` });
    plan.workPhases = [{
      id: "wp-1",
      title: "phase",
      status: "pending",
      tasks: [{ id: "t-1", title: "task", status: "pending" }],
      criteriaIds: [],
    }];
    writeGoalplan(cwd, plan);
    const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
    const raw = JSON.parse(readFileSync(path, "utf8"));
    c.apply(raw);
    writeFileSync(path, JSON.stringify(raw));

    // act
    const result = readGoalplanDetailed(cwd, plan.slug);

    // assert
    assert.equal(result.plan, null, c.name);
    assert.equal(result.diagnostic?.kind, "invalid-shape", c.name);
    if (result.diagnostic?.kind === "invalid-shape") {
      assert.equal(result.diagnostic.field, c.field, c.name);
      assert.match(result.diagnostic.detail, c.detailPattern, c.name);
    }
  }
});

test("schema v3: task outcome is trimmed while absent and blank outcomes stay absent", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "outcome round trip" });
  plan.workPhases = [{
    id: "wp-1",
    title: "phase",
    status: "in_progress",
    tasks: [
      { id: "t-1", title: "done", status: "done", outcome: "  node --test: 0 fail  " },
      { id: "t-2", title: "missing", status: "pending" },
      { id: "t-3", title: "blank", status: "pending", outcome: "   " },
      { id: "t-4", title: "non-string", status: "pending" },
    ],
    criteriaIds: [],
  }];
  writeGoalplan(cwd, plan);
  const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.workPhases[0].tasks[3].outcome = 42;
  writeFileSync(path, JSON.stringify(raw));

  // act
  const back = readGoalplan(cwd, plan.slug);

  // assert
  assert.ok(back);
  assert.equal(back.workPhases[0].tasks[0].outcome, "node --test: 0 fail");
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[1], "outcome"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[2], "outcome"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[3], "outcome"), false);
});

test("schema v3: legacy plan without outcome keeps byte-identical serialized plan data", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "legacy outcome omission" });
  delete plan.schemaVersion;
  plan.workPhases = [{
    id: "wp-1",
    title: "legacy phase",
    status: "done",
    tasks: [{ id: "t-1", title: "legacy done task", status: "done" }],
    criteriaIds: [],
  }];

  // act
  writeGoalplan(cwd, plan);
  const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  const stored = readFileSync(path, "utf8");
  const back = readGoalplan(cwd, plan.slug);

  // assert
  assert.ok(back);
  assert.equal(JSON.stringify(back, null, 2), stored);
  assert.equal(Object.prototype.hasOwnProperty.call(back, "schemaVersion"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[0], "outcome"), false);
});

test("schema v3: buildGoalplan declares schemaVersion 3", () => {
  // arrange and act
  const plan = buildGoalplan({ objective: "new v3 plan" });

  // assert
  assert.equal(plan.schemaVersion, 3);
});

test("schema v3: schemaVersion 4 is rejected as unsupported", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "future plan", criteria: [{ scenario: "done" }] });
  plan.schemaVersion = 4;

  // act
  const effective = effectiveSchemaVersion(plan, false);
  const verdict = validateGoalplan(plan);
  writeGoalplan(cwd, plan);
  const result = readGoalplanDetailed(cwd, plan.slug);

  // assert
  assert.equal(effective, 4, "future versions must not be clamped");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasons.length, 1);
  assert.match(verdict.reasons[0], /schemaVersion 4/);
  assert.match(verdict.reasons[0], /supports at most 3/);
  assert.equal(result.plan, null);
  assert.equal(result.diagnostic?.kind, "invalid-shape");
  if (result.diagnostic?.kind === "invalid-shape") {
    assert.equal(result.diagnostic.field, "schemaVersion");
  }
});

test("schema v3: pre-change baseline records a private-data-free manifest and parser results", () => {
  // arrange
  const path = join(
    process.cwd(),
    "plugins/codexclaw/components/pabcd-state/test/fixtures/goalplans-pre-change-baseline.json",
  );
  type ParserResult =
    | { kind: "parsed" }
    | { kind: "absent" | "unreadable" | "invalid-json" }
    | { kind: "invalid-shape"; field: "criteria-shape" | "other-shape" };

  // act
  const text = readFileSync(path, "utf8");
  const snapshot = JSON.parse(text) as {
    measuredOn: "2026-08-29";
    sourceCount: number;
    manifest: Array<{
      ordinal: number;
      alias: `fixture-${number}`;
      sourceClass: "normal" | "legacy-text-criterion";
      expected: ParserResult;
    }>;
    fixtures: Array<{
      ordinal: number;
      alias: `fixture-${number}`;
      sourceClass: "normal" | "legacy-text-criterion";
      expected: ParserResult;
      plan: Record<string, unknown>;
    }>;
  };
  const preservedEnumsByKey = new Map<string, Set<string>>([
    ["status", new Set([
      "pending", "in_progress", "done", "blocked", "superseded", "open", "met",
      "launching", "in_flight", "approved", "changes_requested", "inconclusive",
    ])],
    ["surface", new Set(["logic", "web", "tui"])],
    ["source", new Set(["freeze", "none"])],
    ["purpose", new Set(["plan_audit", "final_gate"])],
    ["verdict", new Set(["pass", "near-pass", "fail"])],
    ["kind", new Set([
      "resolved", "unavailable", "parsed", "absent", "unreadable", "invalid-json", "invalid-shape",
    ])],
    ["sourceClass", new Set(["normal", "legacy-text-criterion"])],
    ["field", new Set(["criteria-shape", "other-shape"])],
  ]);
  const assertAliased = (value: unknown, ordinal: number, key = ""): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => assertAliased(item, ordinal, key));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([childKey, child]) => assertAliased(child, ordinal, childKey));
      return;
    }
    if (typeof value === "string" && !preservedEnumsByKey.get(key)?.has(value)) {
      if (value === `fixture-${ordinal}`) return;
      assert.match(value, new RegExp(`^fixture-${ordinal}-string-\\d{4}$`));
    }
  };

  // assert
  assert.equal(snapshot.measuredOn, "2026-08-29");
  assert.ok(snapshot.sourceCount > 0);
  assert.equal(snapshot.sourceCount, snapshot.manifest.length);
  assert.equal(snapshot.fixtures.length, snapshot.manifest.length);
  assert.deepEqual(
    snapshot.manifest,
    snapshot.fixtures.map(({ ordinal, alias, sourceClass, expected }) => ({
      ordinal,
      alias,
      sourceClass,
      expected,
    })),
  );
  assert.deepEqual(snapshot.fixtures.map(({ ordinal }) => ordinal),
    snapshot.fixtures.map((_, index) => index + 1));
  for (const fixture of snapshot.fixtures) {
    assert.equal(fixture.alias, `fixture-${fixture.ordinal}`);
    assert.equal(fixture.plan.slug, fixture.alias);
    assertAliased(fixture.plan, fixture.ordinal);
  }
  const legacy = snapshot.fixtures.find((fixture) => fixture.sourceClass === "legacy-text-criterion");
  assert.ok(legacy);
  assert.deepEqual(legacy.expected, { kind: "invalid-shape", field: "criteria-shape" });
  assert.doesNotMatch(text, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  assert.doesNotMatch(text, /"\/(?!\/)/, "absolute POSIX paths must not remain");
  assert.doesNotMatch(text, /"[A-Za-z]:\\\\/, "absolute Windows paths must not remain");
  assert.doesNotMatch(text, /\b[0-9a-f]{40}\b/i, "40-character hashes must not remain");
});
```

여덟 번째 테스트는 감사 라운드 10 BLOCKER 3의 처분이다. 일곱 번째가 이미 생성된 JSON의 정적
shape만 읽어서, 생성기의 privacy scan이나 재파싱 동등성 loop를 지워도 focused GREEN과
`npm test`가 통과할 수 있었다. 5.6이 export하는 `assertFixturesPrivateAndStable()`을 체크인된
fixture로 매 `npm test`에서 직접 호출해 그 구멍을 닫는다. 운영 corpus는 읽지 않는다.

```ts
test("schema v3: baseline generator privacy and reparse invariants run on every suite", async () => {
  // arrange
  const { assertFixturesPrivateAndStable, normalizeResult, PRIVACY_PATTERNS } = await import(
    "./fixtures/capture-goalplan-baseline.mjs"
  );
  const snapshot = JSON.parse(readFileSync(
    join(
      import.meta.dirname,
      "fixtures",
      "goalplans-pre-change-baseline.json",
    ),
    "utf8",
  )) as { fixtures: Array<{ ordinal: number; alias: string; expected: unknown; plan: Record<string, unknown> }> };
  const reparseRoot = tmp();

  // act and assert — 체크인된 fixture 전수가 재파싱 뒤에도 같은 normalized 결과를 낸다.
  assertFixturesPrivateAndStable(snapshot.fixtures, reparseRoot);

  // assert — 순수 helper 자체가 살아 있는지 negative case로 확인한다.
  assert.ok(PRIVACY_PATTERNS.length >= 4);
  assert.throws(
    () => assertFixturesPrivateAndStable(
      [{ ordinal: 1, alias: "fixture-1", expected: { kind: "parsed" }, plan: { leak: "/Users/someone/secret" } }],
      tmp(),
    ),
    /privacy scan/,
    "absolute path leak must be caught by the generator helper",
  );
  assert.deepEqual(normalizeResult({ plan: {}, diagnostic: null }), { kind: "parsed" });
});
```

#### C. 같은 파일의 기존 v1 완료 검증 fixture 고정

`buildGoalplan()`의 기본 버전이 v3로 바뀌므로 기존 테스트 중 final gate가 아니라 v1의 evidence/empty
규칙만 검증하는 두 fixture는 v1을 명시해야 한다. 그렇지 않으면 “evidence가 충분하면 통과”라는
기존 assertion이 v3 final-gate 부재 때문에 실패해 테스트 관심사가 섞인다.

Before (`030: validateGoalplan rejects met-without-evidence and incomplete plans`):

```ts
// wp1 적용 후 상태
  const plan = buildGoalplan({ objective: "v", criteria: [{ scenario: "c" }] });
```

After:

```ts
  const plan = buildGoalplan({ objective: "v", criteria: [{ scenario: "c" }] });
  plan.schemaVersion = 1; // this case isolates the legacy evidence checks
```

Before (`260709: validateGoalplan FAILS an EMPTY plan (no workPhases, no criteria)`):

```ts
// wp1 적용 후 상태
  const plan = buildGoalplan({ objective: "shell only" });
  const verdict = validateGoalplan(plan);
```

After:

```ts
  const plan = buildGoalplan({ objective: "shell only" });
  plan.schemaVersion = 1; // this case isolates EMPTY-plan validation
  const verdict = validateGoalplan(plan);
```

같은 테스트의 `withCriterion`도 v1로 고정한다.

Before:

```ts
// wp1 적용 후 상태
  const withCriterion = buildGoalplan({ objective: "with criterion", criteria: [{ scenario: "c", expectedEvidence: "e" }] });
  withCriterion.criteria[0] = { ...withCriterion.criteria[0], status: "met", capturedEvidence: "proof" };
```

After:

```ts
  const withCriterion = buildGoalplan({ objective: "with criterion", criteria: [{ scenario: "c", expectedEvidence: "e" }] });
  withCriterion.schemaVersion = 1;
  withCriterion.criteria[0] = { ...withCriterion.criteria[0], status: "met", capturedEvidence: "proof" };
```

### 5.3 MODIFY — `plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts`

이 파일의 `plan()`은 주석부터 “v1 checks all pass” fixture이며 각 v2 케이스가 명시적으로
`schemaVersion: 2`를 override한다. 기본값을 v1로 고정해야 기존 테스트 분리가 유지된다.

Before:

```ts
// wp1 적용 후 상태
  return {
    ...base,
    workPhases: [{ id: "wp1", title: "t", status: "done", tasks: [], criteriaIds: ["c-1"] }],
```

After:

```ts
  return {
    ...base,
    schemaVersion: 1,
    workPhases: [{ id: "wp1", title: "t", status: "done", tasks: [], criteriaIds: ["c-1"] }],
```

`...over`가 뒤에 있으므로 기존 `plan({ schemaVersion: 2, ... })`와 v3/v4 추가 fixture는 원하는
버전을 계속 선택한다.

### 5.4 MODIFY — `plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts`

이 파일은 blocked/superseded 상태의 순수 helper와 구조 검증을 다룬다. final-gate가 없는 plan의
`validateGoalplan(...).ok === true` assertion이 있으므로 fixture builder를 v1로 고정한다.

Before:

```ts
// wp1 적용 후 상태
function plan(workPhases: GoalplanWorkPhase[], over: Partial<Goalplan> = {}): Goalplan {
  return { ...buildGoalplan({ objective: "work phase states" }), workPhases, ...over };
}
```

After:

```ts
function plan(workPhases: GoalplanWorkPhase[], over: Partial<Goalplan> = {}): Goalplan {
  return {
    ...buildGoalplan({ objective: "work phase states" }),
    schemaVersion: 1,
    workPhases,
    ...over,
  };
}
```

### 5.5 MODIFY — `plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts`

`valid goalplan at IDLE -> complete passes`는 final-gate 도입 전 legacy 완료 경로를 보존하는 테스트로
명시한다. 신규 v3 plan이 final gate 없이 통과한다고 오해하게 두지 않도록 제목도 바꾼다.

Before:

```ts
// wp1 적용 후 상태
test("GOAL-COMPLETE-GATE-01: valid goalplan at IDLE -> complete passes", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "Done for real", criteria: [{ scenario: "tests", expectedEvidence: "green" }] });
    plan.criteria[0] = { ...plan.criteria[0], status: "met", capturedEvidence: "node --test: 0 fail" };
```

After:

```ts
test("GOAL-COMPLETE-GATE-01: valid legacy v1 goalplan at IDLE -> complete passes", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "Done for real", criteria: [{ scenario: "tests", expectedEvidence: "green" }] });
    plan.schemaVersion = 1;
    plan.criteria[0] = { ...plan.criteria[0], status: "met", capturedEvidence: "node --test: 0 fail" };
```

신규 v3의 final-gate 필수 동작은 `final-gate.test.ts`의 v2 이상 공통 계약과
`goalplan.test.ts`의 v3 선언 테스트가 함께 고정한다. 이 phase에서 별도 gate fixture를 복제하지 않는다.

### 5.6 NEW — `plugins/codexclaw/components/pabcd-state/test/fixtures/capture-goalplan-baseline.mjs`

wp2 구현을 시작하기 전에 아래 파일을 추가하고 한 번 실행한다. parser 결과를 먼저 읽은 다음 입력
문자열을 allowlist 방식으로 치환한다. alias map은 fixture마다 새로 만들며, 같은 fixture 안의 id와
참조만 같은 alias를 받아 관계를 유지한다.

Before:

```js
// wp1 적용 후 상태
// 파일 없음
```

After:

```js
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GOALPLAN_FILE, goalplanDir, readGoalplanDetailed } from "../../src/goalplan.ts";

const repo = process.cwd();
const sourceRoot = join(repo, ".codexclaw", "goalplans");
const output = join(dirname(fileURLToPath(import.meta.url)), "goalplans-pre-change-baseline.json");
const measuredOn = "2026-08-29";
const preservedEnumsByKey = new Map([
  ["status", new Set([
    "pending", "in_progress", "done", "blocked", "superseded", "open", "met",
    "launching", "in_flight", "approved", "changes_requested", "inconclusive",
  ])],
  ["surface", new Set(["logic", "web", "tui"])],
  ["source", new Set(["freeze", "none"])],
  ["purpose", new Set(["plan_audit", "final_gate"])],
  ["verdict", new Set(["pass", "near-pass", "fail"])],
  ["kind", new Set([
    "resolved", "unavailable", "parsed", "absent", "unreadable", "invalid-json", "invalid-shape",
  ])],
  ["sourceClass", new Set(["normal", "legacy-text-criterion"])],
  ["field", new Set(["criteria-shape", "other-shape"])],
]);

export function aliasFixtureStrings(value, ordinal, aliases = new Map(), key = "") {
  if (Array.isArray(value)) {
    return value.map((item) => aliasFixtureStrings(item, ordinal, aliases, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [
      childKey,
      aliasFixtureStrings(child, ordinal, aliases, childKey),
    ]));
  }
  if (typeof value !== "string" || preservedEnumsByKey.get(key)?.has(value)) return value;
  if (!aliases.has(value)) {
    aliases.set(value, `fixture-${ordinal}-string-${String(aliases.size + 1).padStart(4, "0")}`);
  }
  return aliases.get(value);
}

export function normalizeResult(result) {
  if (result.plan && result.diagnostic === null) return { kind: "parsed" };
  assert.ok(result.diagnostic);
  return result.diagnostic.kind === "invalid-shape"
    ? {
        kind: result.diagnostic.kind,
        field: result.diagnostic.field === "criteria[] entries (each needs scenario/expectedEvidence/status)"
          ? "criteria-shape"
          : "other-shape",
      }
    : { kind: result.diagnostic.kind };
}

export function sourceClass(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.criteria)) return "normal";
  return raw.criteria.some((criterion) => (
    criterion && typeof criterion === "object"
    && typeof criterion.text === "string"
    && typeof criterion.scenario !== "string"
  )) ? "legacy-text-criterion" : "normal";
}

export const PRIVACY_PATTERNS = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /"\/(?!\/)/,
  /"[A-Za-z]:\\\\/,
  /\b[0-9a-f]{40}\b/i,
];

/**
 * 감사 라운드 10 BLOCKER 3: privacy scan과 재파싱 동등성을 순수 함수로 노출해
 * `goalplan.test.ts`의 여덟 번째 테스트가 매 `npm test`에서 직접 호출한다.
 * 이 함수는 운영 corpus를 읽지 않는다. 호출자가 준 fixture 배열만 검사한다.
 */
export function assertFixturesPrivateAndStable(fixtureList, reparseRoot) {
  const serialized = `${JSON.stringify(fixtureList, null, 2)}\n`;
  const hit = PRIVACY_PATTERNS.find((pattern) => pattern.test(serialized));
  if (hit) {
    throw new Error(`baseline privacy scan matched ${hit}`);
  }
  for (const fixture of fixtureList) {
    const dir = goalplanDir(reparseRoot, fixture.alias);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, GOALPLAN_FILE), `${JSON.stringify(fixture.plan, null, 2)}\n`);
    assert.deepEqual(
      normalizeResult(readGoalplanDetailed(reparseRoot, fixture.alias)),
      fixture.expected,
      `fixture ${fixture.ordinal} changed parser result after de-identification`,
    );
  }
}

// 감사 라운드 10 재검증의 새 BLOCKER 1: 아래 수집·쓰기 구문은 반드시 main 가드 안에 둔다.
// 가드 밖에서는 위 순수 함수와 상수 export만 평가된다. 여덟 번째 focused test가 이 모듈을
// dynamic import 할 때 운영 `.codexclaw/goalplans` 전수 수집이나 baseline 쓰기가 절대 일어나지
// 않아야 하며, corpus가 없는 checkout에서 `readdirSync(sourceRoot)`의 ENOENT로 import가 깨지지도
// 않아야 한다.
function captureBaseline() {
  const sourceFiles = readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${entry.name}/${GOALPLAN_FILE}`)
    .filter((relativeFile) => existsSync(join(sourceRoot, relativeFile)))
    .sort();

  const fixtures = sourceFiles.map((relativeFile, index) => {
    const ordinal = index + 1;
    const sourceSlug = dirname(relativeFile);
    const raw = JSON.parse(readFileSync(join(sourceRoot, relativeFile), "utf8"));
    assert.equal(typeof raw.slug, "string");
    const alias = `fixture-${ordinal}`;
    const expected = normalizeResult(readGoalplanDetailed(repo, sourceSlug));
    const aliases = new Map([[raw.slug, alias]]);
    const plan = aliasFixtureStrings(raw, ordinal, aliases);
    assert.equal(plan.slug, alias);
    return { ordinal, alias, sourceClass: sourceClass(raw), expected, plan };
  });
  const snapshot = {
    measuredOn,
    sourceCount: fixtures.length,
    manifest: fixtures.map(({ ordinal, alias, sourceClass, expected }) => ({
      ordinal,
      alias,
      sourceClass,
      expected,
    })),
    fixtures,
  };
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (PRIVACY_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error("baseline privacy scan found a UUID, absolute path, or 40-character hash");
  }

  const suppliedReparseRoot = process.env.CXC_GOALPLAN_BASELINE_TMP;
  const reparseRoot = suppliedReparseRoot ?? mkdtempSync(join(tmpdir(), "codexclaw-goalplan-baseline-"));
  try {
    assertFixturesPrivateAndStable(fixtures, reparseRoot);
  } finally {
    if (!suppliedReparseRoot) rmSync(reparseRoot, { recursive: true, force: true });
  }

  writeFileSync(output, text);
  const parsed = snapshot.manifest.filter((entry) => entry.expected.kind === "parsed").length;
  const invalid = snapshot.manifest.filter((entry) => entry.expected.kind === "invalid-shape").length;
  console.log(`wrote ${fixtures.length} private-data-free fixtures (${parsed} parsed, ${invalid} invalid-shape) to ${output}`);
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("capture-goalplan-baseline.mjs")) {
  captureBaseline();
}
```

선택 근거: 루트 `package.json`과 `plugins/codexclaw/scripts/*.mjs`는 실행 스크립트를 `.mjs`로 두고
`node`로 호출한다. `build.mjs`도 TypeScript 소스를 동적 import한다. 생성기는 이 관례를 따르되,
루트 `npm test`와 별도로 직접 실행하므로 TypeScript import의 타입 제거를 명령에 명시한다.

실행 명령:

```bash
cd /Users/jun/Developer/new/700_projects/codexclaw
fixture_cwd="$(mktemp -d)"
trap 'rm -rf -- "$fixture_cwd"' EXIT
CXC_GOALPLAN_BASELINE_TMP="$fixture_cwd" \
  node --experimental-strip-types \
  plugins/codexclaw/components/pabcd-state/test/fixtures/capture-goalplan-baseline.mjs
```

기대 결과: exit 0이며 발견한 fixture 수와 `parsed`·`invalid-shape` 수를 보고한다. 특정 개수를
기대하지 않는다. 임시 cwd는 shell trap이 정리한다. 환경 변수 없이 생성기를 직접 실행해도 생성기가
`mkdtempSync()`로 만든 cwd를 `finally`에서 정리한다. 이 명령은 wp2의 다른 파일을 고치기 전에 한 번만
실행한다. 생성 뒤에는 운영 plan을 다시 읽어 baseline을 갱신하지 않는다.

### 5.7 NEW — `plugins/codexclaw/components/pabcd-state/test/fixtures/goalplans-pre-change-baseline.json`

Before:

```jsonc
// wp1 적용 후 상태
// 파일 없음
```

After는 5.6 생성기가 쓴 JSON 전체다. `measuredOn`, `sourceCount`, `manifest`, `fixtures` 네 필드와
070의 소비 타입을 그대로 지킨다. manifest 항목이나 입력을 손으로 줄이거나 결과를 새 parser 값으로
바꾸지 않는다. 같은 wp2 구현 commit에 생성기와 JSON을 함께 넣는다.

## 6. 수용 기준

| ID | 조건 | 관측 가능한 판정 |
|---|---|---|
| WP2-1 | 타입 계약 | task와 work phase 모두 `dependsOn?: string[]`를 가지며, wp6의 `addGoalplanTask()` 입력은 `{ id, title, dependsOn? }`이다. |
| WP2-2 | 무손실 왕복 | 미지정, 빈 배열, 1개 이상 배열이 write/read 뒤 각각 그대로다. |
| WP2-3 | shape fail-closed | 비배열, 비문자열 원소, 빈/공백 id 중 하나라도 있으면 plan 전체가 null이다. |
| WP2-4 | 진단 | phase 오류는 `workPhases[].dependsOn`, task 오류는 `workPhases[].tasks[].dependsOn`으로 나온다. |
| WP2-5 | 의존 없음의 동치 | `dependsOn` 미지정과 `[]`는 모두 의존 없음이며, 저장 시 미지정은 미지정으로, 빈 배열은 빈 배열로 남는다. |
| WP2-6 | outcome 타입 | `GoalplanTask`가 `outcome?: string`을 가지며, trim 결과가 비어 있지 않은 문자열만 read 뒤 남는다. |
| WP2-7 | legacy outcome 생략 | outcome과 schemaVersion이 없던 plan은 read 뒤에도 두 key가 생기지 않고 저장 JSON과 `JSON.stringify(readResult, null, 2)`가 byte-identical이다. |
| WP2-8 | 신규 버전 | `buildGoalplan()` 결과가 `schemaVersion === 3`이다. |
| WP2-9 | 미래 버전 | v4는 clamp되지 않으며 디스크 read와 `validateGoalplan()` 양쪽에서 거부된다. |
| WP2-10 | 범위 고정 | 기존 순서 기반 선택 함수와 ledger 발생 코드는 변하지 않는다. |
| WP2-11 | 변경 전 baseline | `measuredOn`, `sourceCount`, manifest의 `{ ordinal, alias, sourceClass, expected }`, 같은 필드를 포함한 fixture가 070 소비 타입과 일치한다. 특정 개수는 단언하지 않는다. |
| WP2-12 | fixture privacy | fixture별 alias만 쓰며 UUID·절대경로·40자 hex가 없다. legacy fixture의 normalized `field`는 `criteria-shape`다. |
| WP2-13 | 비식별 shape 보존 | 생성기가 모든 비식별 fixture를 임시 cwd에 풀어 재파싱하며, 각 결과가 원본 normalized `expected`와 같다. 같은 검사를 `assertFixturesPrivateAndStable()` export로 노출해 여덟 번째 focused test가 체크인된 fixture로 매 `npm test`에서 직접 호출하며, privacy 누락은 negative case가 잡는다. |

## 7. 구현 순서

1. 변경 전 parser가 발견한 모든 plan의 manifest와 baseline JSON을 생성하고 privacy·재파싱 검사를 통과시켜 fixture에 둔다.
2. 위 여덟 테스트를 먼저 추가하고 RED를 확인한다.
3. 타입과 `SUPPORTED_MAX_SCHEMA_VERSION`을 추가한다.
4. `GoalplanTask.outcome`과 trim 후 조건부 복원을 구현한다.
5. `reviveDependsOn()`과 두 계층 복원, read-time v4 거부를 구현한다.
6. `firstInvalidField()`의 nested field 진단을 구현한다.
7. `buildGoalplan()` v3 선언과 `validateGoalplan()` 미래 버전 거부를 구현한다.
8. v1 의미만 검증하는 기존 fixture 세 곳을 명시적 v1로 고정한다.
9. focused test, `npm run build`, `npm test`, `npm run gate`를 순서대로 실행한다.

## 8. 검증 명령과 기대 결과

저장소 루트 `/Users/jun/Developer/new/700_projects/codexclaw`에서 실행한다.

### false-green 경계 (P-phase stale check 260829 발견)

`--test-name-pattern`은 일치하는 테스트가 하나도 없어도 exit 0으로 끝난다. 구현 착수 전 현재
checkout에서 이 명령을 돌리면 `tests 1 / pass 1 / fail 0`이 나오는데, 이는 Node가 테스트 파일
실행 자체를 한 건으로 집계한 결과이고 `schema v3:`로 시작하는 테스트가 아직 없다는 뜻이다.
따라서 아래 RED와 GREEN 판정은 exit code만 보지 않고 출력의 `# tests` 값을 함께 읽는다.

- RED 단계: `# tests`가 8이고 `# fail`이 5여야 한다. `# tests`가 1이면 신규 테스트가 아직
  등록되지 않은 상태이므로 RED가 아니라 미착수다. 여덟 번째 baseline generator 테스트는 5.6 파일과
  5.7 JSON이 구현 순서 1단계에서 이미 생성됐으므로 RED에서 pass한다.
- GREEN 단계: `# tests`가 8이고 `# fail`이 0이어야 한다. `# tests`가 8보다 작으면 제목 오타나
  누락이며 GREEN으로 인정하지 않는다.
- 판정은 실패 개수만 보지 않고 각 테스트의 제목과 실패 이유를 함께 읽는다. 구현자가 타입이나
  reviver 일부를 먼저 넣으면 실패 수가 달라질 수 있으므로, 아래 RED 확인의 테스트별 예상 원인이
  실제 출력과 맞는지 대조한다(감사 라운드 10 NON-BLOCKING 1).

### RED 확인

```bash
node --test --test-name-pattern='schema v3:' plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts
```

기대 결과: 구현 전 여덟 개 중 legacy outcome 생략, pre-change baseline privacy,
baseline generator invariant 세 개만 pass하고 나머지 다섯 개가 실패한다.
의존 왕복 테스트는 `dependsOn` 유실, outcome 테스트는 trim된 증거 유실, 신규 plan 테스트는
`schemaVersion` 미지정, v4 테스트는 미래 버전 통과 때문에 실패해야 한다. malformed 테스트는
reviver가 필드를 무시하므로 실패해야 한다. `buildGoalplan()`을 v3로 바꾼 뒤 legacy fixture를 아직
고정하지 않은 중간 단계에서는 기존 v1 완료 테스트도 실패하며, 7단계에서 해소한다.

### focused GREEN

```bash
node --test --test-name-pattern='schema v3:' plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts
```

기대 결과: 정확히 위 여덟 제목의 테스트가 pass하고 fail은 0이다. baseline 테스트는 manifest,
fixture, 결과의 항목 집합이 같고 privacy pattern이 0개임을 단언한다. 개수는 기록값끼리만 비교한다.

### tracked dist 생성·레이아웃 검사

```bash
npm run build
```

기대 결과: exit 0. 타입 제거와 파일 복사가 끝나고 tracked `dist/goalplan.js`가 다시 생성되며
컴포넌트 산출물 레이아웃 검사가 통과한다. 이 명령은 TypeScript 심볼이나 import 이름을 검사하지 않는다.

### 소유 컴포넌트 회귀

```bash
npm test
```

기대 결과: 저장소 전체 `node:test` suite가 fail 0으로 종료한다. 기존 v1/v2, final-gate marker,
steeringLog fail-closed 테스트가 그대로 통과한다. 루트 freshness 테스트도 src와 tracked
`dist/goalplan.js`의 byte equality를 확인한다.

### 저장소 gate

```bash
npm run gate
```

기대 결과: exit 0. 저장소가 정한 정적 검사와 통합 gate가 모두 통과한다.

### 범위·문서 정합성

```bash
test -f devlog/_plan/260829_goalplan-dependency-execution/020_wp2_schema_v3.md
git status --porcelain -- devlog/_plan/260829_goalplan-dependency-execution/020_wp2_schema_v3.md
git diff --no-index /dev/null devlog/_plan/260829_goalplan-dependency-execution/020_wp2_schema_v3.md
git status --porcelain -- \
  plugins/codexclaw/components/pabcd-state/src/goalplan.ts \
  plugins/codexclaw/components/pabcd-state/dist/goalplan.js \
  plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts \
  plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts \
  plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts \
  plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts \
  plugins/codexclaw/components/pabcd-state/test/fixtures/capture-goalplan-baseline.mjs \
  plugins/codexclaw/components/pabcd-state/test/fixtures/goalplans-pre-change-baseline.json \
  devlog/_plan/260829_goalplan-dependency-execution/020_wp2_schema_v3.md
```

기대 결과: `test -f`는 exit 0이다. `git status`의 문서 행은 untracked 변경을 표시한다.
`git diff --no-index`는 새 문서 전체 diff라 exit 1이며 출력에 trailing whitespace 오류가 없어야 한다.
마지막 `git status`에는 위 소스·테스트·fixture·문서 경로만 나타난다. 테스트 세 파일의 추가 변경은
`buildGoalplan()` 기본 버전 상승으로 드러난 legacy fixture 의도를 명시하는 데 한정한다. 이 phase에서
`nextOpenTask`, `effectiveActiveWorkPhaseId`, `advanceWorkPhase`, ledger producer는 바뀌지 않는다.

## 9. 후속 phase 인계

- wp3는 이 phase가 보존한 문자열 배열을 입력으로 id 유일성, dangling, self, cycle을 검증한다.
- wp3는 wp2가 `validateGoalplan()` 맨 앞에 둔 미래 버전 거부 가드를 유지한 채, 030 정본의 integrity
  사유를 그 뒤에 붙인다.
- wp3는 schemaVersion 3 task의 done/outcome 결합 무결성을 검증한다.
- wp4는 wp3가 유효하다고 판정한 그래프만 사용해 ready task/phase를 선택한다.
- wp5의 공통 락과 RMW 직렬화가 들어오기 전까지 이 phase는 필드 유실은 막지만 lost update까지 해결하지 않는다.
- wp6는 `addGoalplanTask(plan, workPhaseId, { id, title, dependsOn? })`, `complete-task --outcome`, 공개
  등록·조회·lifecycle을 구현한다. wp2가 보존한 `GoalplanTask.dependsOn?: string[]`을 다시 정의하지 않는다.
- wp7은 wp2가 체크인한 `goalplans-pre-change-baseline.json`을 읽으며 baseline 생성기를 다시 실행하지 않는다.

DONE: 020_wp2_schema_v3.md — W5 tracked goalplan dist manifest와 build 선행 검증 순서를 닫음
