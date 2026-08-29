# 060 — wp6: 공개 실행 표면

> 선행 조건: `020_wp2_schema_v3.md`의 schema v3 저장·복원,
> `030_wp3_integrity.md`의 순수 무결성 검사,
> `040_wp4_dependency_aware.md`의 의존 인식 선택,
> `050_wp5_write_serialization.md`의 공통 락과 RMW 직렬화가 끝나야 한다.
> 이 표면의 모든 쓰기는 wp5의 `withGoalplanWriteLock()` 안에서 수행한다.

## 목표와 제외

공개 CLI에서 ready 조회, 의존이 있는 work phase 등록, task 추가·완료, criterion 충족을 처리한다.
`goalplan.json`이 권위 상태고 `ledger.jsonl`은 성공한 변경의 역사다. 별도 큐, 실행기, task 저장소,
기존 phase의 의존을 사후 편집하는 연산은 만들지 않는다.

## 실제 소스 기준선

- `GoalplanTask`는 wp2가 이미 `dependsOn?`과 `outcome?`을 넣었다. wp6은 그 필드를 소비만 한다.
  wp5 구현으로 행 번호가 전부 밀렸으므로 이 문서의 앵커는 심볼 이름으로 읽는다.
- `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:192`의 원장 event union에는
  `dependency_registered`가 없다.
- `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:615`의 `writeGoalplan()`과
  `:639`의 `appendGoalplanLedger()`는 별도 호출이다. outcome은 원장에만 두지 않는다.
- `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:708`의 `nextOpenTask()`는 현재 선언
  순서대로 pending task를 고른다. wp4가 의존 판정을 넣은 뒤 공개 조회가 같은 helper를 쓴다.
- `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:74`는 parser,
  `:215`는 `runAddOp()`, `:298`은 help, `:324`는 실행 분기다.
- `plugins/codexclaw/components/pabcd-state/src/steering.ts:34`의 `SteerOp`, `:130`의 batch parser,
  `:210`의 `applyOps()`, `:259`의 `applySteeringBatch()`가 phase 등록의 단일 입구다.
- 현재 `applyOps()`는 지역 배열을 루프에서 갱신하고 최종 `return`을 루프 밖에 둔다
  (`steering.ts:210-245`). wp6은 각 mutation op 뒤
  `goalplanDefinitionIntegrityReasons(next)`를 호출하되 이 fold 구조를 보존한다. 검증 성공 뒤 지역
  `criteria`와 `workPhases`를 갱신하고 다음 op로 넘어간다. 뒤 op가 아직 없는 참조는 그 자리에서
  dangling으로 거부되며, batch 전체를 먼저 만든 뒤 cycle을 검사하지 않는다.
- `plugins/codexclaw/components/pabcd-state/src/hook.ts:1081`의 `StopWorkContext`는 현재 다음 task 한 건을
  담고, `:1165`의 `readStopWorkContext()`는 `nextOpenTask()` 한 건만 읽는다.
- `plugins/codexclaw/skills/loop/SKILL.md:245-268`은 task를 `{id,title,status}`로만 설명하고
  ready/lifecycle CLI, `dependsOn`, `outcome`, `dependency_registered`를 안내하지 않는다.
- D-close pending 거부는 `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:633`과
  `plugins/codexclaw/components/pabcd-state/src/hook.ts:840`에 있다.

## 선행 API 계약

```ts
// wp3
export function goalplanDefinitionIntegrityReasons(plan: Goalplan): string[];
export function goalplanDependencyCompletionReasons(plan: Goalplan): string[];

// wp4
export function effectiveActiveWorkPhaseId(plan: Goalplan): string | null;
export function dependencyWaitReasons(plan: Goalplan): string[];
function taskDependenciesMet(phase: GoalplanWorkPhase, task: GoalplanTask): boolean;
function workPhaseDependenciesMet(plan: Goalplan, phase: GoalplanWorkPhase): boolean;

// wp6
export function readyWorkPhases(plan: Goalplan): GoalplanWorkPhase[];
export function readyTasks(plan: Goalplan): Array<{ workPhaseId: string; task: GoalplanTask }>;
```

wp5의 `050_wp5_write_serialization.md:139-144`가 확정한 락 시그니처를 그대로 쓴다. wp6은 별도 락
wrapper를 만들지 않는다.

```ts
export function withGoalplanWriteLock<T>(
  cwd: string,
  slug: string,
  fn: (plan: Goalplan) => T,
  options: GoalplanWriteLockOptions = {},
): GoalplanWriteLockResult<T>;
```

## 공개 계약

```text
cxc loop ready (--slug <slug> | --objective <text> | --session <id>) [--json] [--cwd <path>]
cxc loop add-work-phase --session <id> --id <id> --title <text> [--depends-on <id>]... [--cwd <path>]
cxc loop add-task --session <id> --work-phase <id> --id <id> --title <text> [--depends-on <task-id>]... [--cwd <path>]
cxc loop complete-task --session <id> --work-phase <id> --id <id> --outcome <text> [--cwd <path>]
cxc loop meet-criterion --session <id> --id <id> --evidence <text> [--cwd <path>]
```

`--depends-on`은 한 번에 id 하나를 받고 반복 지정한다. `add-work-phase`에서는 기존 work phase id,
`add-task`에서는 같은 work phase의 기존 task id만 받는다. `--depends-on a,b`는 `a,b`라는 id
하나이며 parser는 쪼개지 않는다. wp3 참조 무결성 검사가 미존재 id로 거부한다. 같은 id 반복과
빈 값은 parser가 code 1로 거부한다. 새 task가 자신을 가리키거나 다른 phase에만 있는 task를
가리켜도 wp3 정본 사유로 거부하며 plan과 원장을 쓰지 않는다.

`ready`만 읽기 전용이다. 쓰기 명령은 canonical `--session`의 `state.slug`를 쓴다.

```json
{
  "slug": "dependency-execution",
  "readyWorkPhases": [
    { "id": "wp2", "title": "Public surface", "status": "in_progress", "dependsOn": ["wp1"] }
  ],
  "readyTasks": [
    {
      "workPhaseId": "wp2",
      "id": "t-2",
      "title": "Expose ready query",
      "status": "pending",
      "dependsOn": ["t-1"]
    }
  ]
}
```

항목이 없어도 code 0과 빈 배열을 반환한다. goalplan 부재·손상, 잘못된 session, 빈 id/title,
빈 outcome/evidence, 중복 `--depends-on`, 무결성 오류는 code 1이다. 거부 시 plan과 원장을
한 바이트도 바꾸지 않는다.

| 명령 | 허용 변경 | 재실행 | 원장 |
| --- | --- | --- | --- |
| `add-work-phase` | 새 pending phase 추가 | 같은 내용 no-op, 같은 id의 다른 정의 거부 | 기존 `steered`; 의존 저장 시 `dependency_registered` |
| `add-task` | live/blocked phase에 phase-local 의존을 가진 pending task 추가 | 같은 phase의 같은 id 거부, 다른 phase의 같은 id 허용 | 의존 저장 시 `dependency_registered` |
| `complete-task` | ready task를 done으로 바꾸고 trim한 outcome 저장 | done이면 write와 append 생략, 기존 outcome 유지 | 실제 변경 때 `task_done`, `detail === outcome` |
| `meet-criterion` | open criterion에 trim한 증거 저장 후 met | met이면 write와 append 생략 | 실제 변경 때 `criterion_met` |

task id는 소속 work phase 안에서만 유일하다. `task.dependsOn`도 같은 phase의 id만 가리킨다.
phase 간 장벽은 `workPhase.dependsOn`만 표현한다.

이 문서가 CLI 래핑 안에서 인용하는 무결성 사유는 `030_wp3_integrity.md:233-244`가 정본이다.
이번 wp6 테스트가 쓰는 문자열은 아래 네 개이며 글자를 바꾸지 않는다.

```text
work phase <id> depends on unknown work phase '<dep>'
task <phase>/<task> depends on unknown task '<dep>' in the same work phase
task <phase>/<task> depends on itself
work phase <id> has duplicate task id '<id>', so task dependency references are ambiguous
```

`complete-task`는 bulk complete, phase complete, reopen, 임의 status를 제공하지 않는다. pending task는
`readyTasks(plan)`에 있을 때만 완료한다. outcome은 `GoalplanTask.outcome`과 `task_done.detail`에 같은
문자열로 남긴다. phase status, `activeWorkPhaseId`, criterion, sibling task는 바꾸지 않는다.

## 변경 목록

| 표기 | 파일 | 변경 |
| --- | --- | --- |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | ready API, lifecycle 순수 함수, 원장 event |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/steering.ts` | 의존 입력·검사·성공 event |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts` | parser, ready, lock 안 lifecycle, help |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/hook.ts` | Stop에 ready phase/task와 대기 사유 소비 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/goalplan.js` | `src/goalplan.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/steering.js` | `src/steering.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/goalplan-cli.js` | `src/goalplan-cli.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/hook.js` | `src/hook.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/skills/loop/SKILL.md` | shipped 스키마, CLI, event, phase-local task 의존 정본 동기화 |
| NEW | `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts` | 공개 계약 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts` | `loop show` 락 경로·나이 출력 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts` | 기존 loop help 계약에 새 동사·필수 증거 인자 추가 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/steering.test.ts` | 의존 등록·거부 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts` | Stop 출력의 ready/대기 목록 회귀 |

DELETE는 없다.

## 출력 문자열과 기존 테스트 검색 결과

다음 검색을 저장소 루트에서 실행해 기존 assertion을 확인했다.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
rg -n -C 3 \
  'nextTaskTitle|dependencyBlockedReason|Remaining work|Waiting on' \
  plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts \
  plugins/codexclaw/components/pabcd-state/test/hook.test.ts
rg -n --glob '*.test.ts' 'Remaining work:|Ready work phases:|Ready tasks:|Waiting on:|Required evidence:|Record progress in:' plugins/codexclaw/components/pabcd-state/test
rg -n --glob '*.test.ts' '\[codexclaw loop:|objective:|workPhases:|criteria:|complete:|loop show|show\.output' plugins/codexclaw/components/pabcd-state/test
rg -n --glob '*.test.ts' 'Usage:|--session <id>|--batch-json|idempotencyKey|ready .*--json|complete-task|meet-criterion' plugins/codexclaw/components/pabcd-state/test
rg -n --glob '*.test.ts' -F \
  -e 'add-work-phase --session <id> --slug <slug>' \
  -e 'add-criterion --session <id> --slug <slug>' \
  -e 'add-work-phase --session <id> --id' \
  -e 'add-criterion --session <id> --criterion' \
  -e 'goalplan state was committed, but ledger append failed' \
  -e 'ledger append' \
  plugins/codexclaw/components/pabcd-state/test
```

| wp6 출력 변경 | `rg`로 찾은 기존 대기 테스트 | 기존 단언 갱신의 유일한 소유자 | 이 문서의 갱신 |
| --- | --- | --- | --- |
| `Remaining work: Stop hook → goal-idle block` | `hook-continuation.test.ts:505` | **wp6 / 060** | 같은 fixture에서 `Ready work phases: wp-1 (Stop hook)`과 `Ready tasks: wp-1/t-1 (goal-idle block)`을 모두 단언한다 |
| `Remaining work: Backend → add endpoint` | `hook-continuation.test.ts:692` | **wp6 / 060** | 같은 fixture에서 `Ready work phases: wp-1 (Backend)`와 `Ready tasks: wp-1/t-1 (add endpoint)`를 모두 단언한다 |
| `nextTaskTitle` | 현재 checkout의 두 지정 테스트 파일에는 없음. 040 초안의 Stop 단언 2개는 §35에 따라 040에서 빠진다 | **wp6 / 060** | ready parent 회귀를 `readyWorkPhases`·`readyTasks` deep-equal로 다시 쓴다. legacy context golden도 새 전체 shape로 다시 쓴다 |
| `dependencyBlockedReason` | 현재 checkout의 두 지정 테스트 파일에는 없음. 040 초안의 Stop 단언 2개는 §35에 따라 040에서 빠진다 | **wp6 / 060** | 교착 회귀를 `waitingOn` deep-equal과 실제 `Waiting on:` 출력 단언으로 다시 쓴다 |
| `Waiting on:` | 현재 checkout의 두 지정 테스트 파일에는 없음 | **wp6 / 060** | mixed ready/wait와 전역 교착 Stop 출력 회귀를 이 문서가 추가한다 |
| `hook.test.ts`의 네 검색어 | `rg` 일치 0건. `CYCLE-COMPLETION-01` 단언은 Stop ready context shape가 아니라 채팅 D-close 거부 계약이다 | **wp6 / 060 검색 확인** | 바꿀 옛 필드·문자열 단언이 없으므로 diff 없음. 대신 `hook-continuation.test.ts`의 인계 세 테스트가 새 전체 shape를 잠근다 |
| `loop show`에 `writeLock: absent path=<절대 경로>` 또는 `writeLock: present path=<절대 경로> ageMs=<ms>` 추가 | `goalplan.test.ts:194-196`이 기존 show 출력을 검사하며 새 줄 자체를 기다리는 테스트는 없음 | **wp6 / 이 문서** | 같은 기존 show case에 absent assertion을 넣고 present case를 추가 |
세 verb가 같은 문제를 공유한다. `runSteer()`도 `readState(args.cwd, session).slug`만 읽고 `args.slug`를
무시하므로(`goalplan-cli.ts` 183행 근방) `--slug`는 `steer` usage에서도 지운다. `--slug`를 계속 받는
verb는 세션 바인딩 없이 plan을 지목하는 읽기 경로 `show`·`validate`·`ready` 셋뿐이고, 그 셋은
`resolveSlug()`로 실제 인자를 쓴다. parser의 `--slug` 처리 자체는 지우지 않는다 — 읽기 verb가 쓴다.

| help에 `ready --json`, `add-task`, `complete-task --outcome`, `meet-criterion --evidence`, 반복 `--depends-on` 추가. `add-work-phase`와 `add-criterion`의 `--slug <slug>`는 **삭제**한다 | `help-verbs.test.ts:18-29`가 loop help의 `Usage:`, `--session`, `--batch-json`, `idempotencyKey`를 검사. 기존 `--slug` 두 줄을 직접 기다리는 테스트는 없다 | **wp6 / 이 문서** | 감사 라운드 1 High: `runAddOp()`는 `readState(args.cwd, session).slug`만 읽고 `args.slug`를 무시하므로, 두 줄은 실행되지 않는 문법을 광고한다. help에서 지우고, 신규 공개 표면 테스트가 두 usage 줄에 `--slug`가 없음을 단언한다 |
| lifecycle 거부·성공 및 ledger append 경고 문구 신설 | 기존 테스트 없음. `steering.test.ts:180-190`은 steering 전용 ledger 실패 경고 관례만 검사 | **wp6 / 이 문서** | 신규 `goalplan-public-surface.test.ts`가 정확한 문자열·code·무변경과 plan commit 뒤 ledger 실패의 code 0·경고를 검사 |

### 최종 Stop 출력 문자열 정본 — wp6 단독 소유

`hook-continuation.test.ts`의 기존 `Remaining work:` 단언을 바꾸는 문서는 이 문서 하나뿐이다.
`070_wp7_regression.md`를 비롯한 후속 문서는 아래 문자열을 바꾸지 않고 인용만 한다. 값이 없는 줄은
출력하지 않는다. mixed ready 상태의 `Waiting on:`은 wp4 `dependencyWaitReasons(plan)`의 원소를
그대로 쓴다. 이 helper는 ready 존재 여부와 무관하게 부분 대기를 계산한다. 전역 교착이면
`dependencyDeadlock().reasons`를 우선해 blocked 자체의 사유도 보존한다.

V9 검색 결과를 빠짐없이 닫는다. 현재 checkout에서 옛 Stop 문자열 단언은
`hook-continuation.test.ts:505`와 `:692`의 `Remaining work:` 두 건뿐이며 둘 다 아래 diff에서
`Ready work phases:`와 `Ready tasks:`로 바꾼다. `nextTaskTitle`, `dependencyBlockedReason`,
`Waiting on`은 두 지정 파일의 현재 HEAD에 일치가 없다. 040이 제거하고 넘긴 세 테스트는 각각
미충족 task 제외, 전역 교착, legacy context를 맡으며 모두
`readyWorkPhases`·`readyTasks`·`waitingOn` 전체 shape로 다시 만든다. `hook.test.ts`에는 네 검색어가
0건이므로 stale 필드 접근을 남겨 두는 별도 diff가 없다.

아래 한 블록이 070이 인용할 최종 golden이다. `Waiting on:` 뒤 두 원소는 040의
`dependencyWaitReasons(plan)` golden과 글자 단위로 같다. 060은 `Waiting on: ` prefix와 `; ` join만
맡고 원소를 다시 만들거나 고치지 않는다.

```text
Ready work phases: wp-live (Live)
Ready tasks: wp-live/ready (Ready task); wp-live/later (Later task)
Waiting on: task wp-live/blocked waits for task wp-live/later (pending); work-phase wp-blocked waits for work-phase wp-live (in_progress)
Required evidence: node --test green
Record progress in: .codexclaw/goalplans/expose-dependency-aware-stop-guidance/ledger.jsonl
```

전역 교착에서는 `dependencyDeadlock(plan).reasons`가 blocked 자체의 사유까지 보존한다. 그 분기는
`Waiting on: work-phase wp-blocked is blocked (vendor release)`로 고정한다. 부분 대기 원소의 정본은
여전히 040의 `dependencyWaitReasons()`이고, 060은 별도 부분 대기 문장을 만들지 않는다.

## Diff-level 구현 명세

### MODIFY — `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

before (`GoalplanLedgerEvent`, 현재 `goalplan.ts:192`, wp5 적용 후 상태):

```ts
// wp5 적용 후 상태
export type GoalplanLedgerEvent =
  | "created"
  | "workphase_started"
  | "workphase_done"
  | "task_done"
  | "criterion_met"
  | "host_armed"
  | "steered"
  | "review_signoff_ignored"
  | "review_round_superseded";
```

after:

```ts
export type GoalplanLedgerEvent =
  | "created"
  | "workphase_started"
  | "workphase_done"
  | "task_done"
  | "criterion_met"
  | "host_armed"
  | "steered"
  | "dependency_registered"
  | "review_signoff_ignored"
  | "review_round_superseded";
```

거부 event는 union, append, 테스트에 넣지 않는다.

before (`workPhaseDependenciesMet()`부터 `nextOpenTask()`까지, wp5 적용 후 상태):

```ts
// wp5 적용 후 상태
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
```

after:

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

export function readyWorkPhases(plan: Goalplan): GoalplanWorkPhase[] {
  return plan.workPhases.filter((wp) => isRunnablePhase(plan, wp));
}

export interface ReadyGoalplanTask {
  workPhaseId: string;
  task: GoalplanTask;
}

export function readyTasks(plan: Goalplan): ReadyGoalplanTask[] {
  return readyWorkPhases(plan).flatMap((wp) =>
    wp.tasks
      .filter((task) => task.status === "pending" && taskDependenciesMet(wp, task))
      .map((task) => ({ workPhaseId: wp.id, task })),
  );
}

export function nextOpenTask(plan: Goalplan): { wp: GoalplanWorkPhase; task: GoalplanTask } | null {
  const next = readyTasks(plan)[0];
  if (!next) return null;
  const wp = plan.workPhases.find((candidate) => candidate.id === next.workPhaseId);
  return wp ? { wp, task: next.task } : null;
}
```

`taskDependenciesMet()`에는 plan 전역 task 배열을 넘기지 않는다.

before (`unmetCriteria()`, 현재 `goalplan.ts:720`):

```ts
// wp5 적용 후 상태
/** Criteria still open. */
export function unmetCriteria(plan: Goalplan): GoalplanCriterion[] {
```

after:

```ts
const LIFECYCLE_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export type GoalplanLifecycleResult =
  | { kind: "changed"; plan: Goalplan }
  | { kind: "unchanged"; plan: Goalplan; reason: string }
  | { kind: "rejected"; reason: string };

export function addGoalplanTask(
  plan: Goalplan,
  workPhaseId: string,
  input: { id: string; title: string; dependsOn?: string[] },
): GoalplanLifecycleResult {
  const id = input.id.trim();
  const title = input.title.trim();
  const dependsOn = (input.dependsOn ?? []).map((dependencyId) => dependencyId.trim());
  if (!LIFECYCLE_ID_RE.test(id)) {
    return { kind: "rejected", reason: "task id must be a short lowercase id, e.g. t-1" };
  }
  if (!title) return { kind: "rejected", reason: "task title must not be empty" };
  if (dependsOn.some((dependencyId) => dependencyId.length === 0)) {
    return { kind: "rejected", reason: "task dependencies must be non-empty task ids" };
  }
  if (new Set(dependsOn).size !== dependsOn.length) {
    return { kind: "rejected", reason: "task dependencies must not contain duplicate ids" };
  }
  const target = plan.workPhases.find((wp) => wp.id === workPhaseId);
  if (!target) return { kind: "rejected", reason: `work phase '${workPhaseId}' is not in this plan` };
  if (target.status === "done" || target.status === "superseded") {
    return { kind: "rejected", reason: `work phase '${workPhaseId}' is ${target.status} and cannot accept a new task` };
  }
  if (target.tasks.some((task) => task.id === id)) {
    return { kind: "rejected", reason: `task '${workPhaseId}/${id}' is already in this work phase` };
  }
  const next: Goalplan = {
    ...plan,
    workPhases: plan.workPhases.map((wp) => wp.id === workPhaseId
      ? {
          ...wp,
          tasks: [...wp.tasks, {
            id,
            title,
            status: "pending" as const,
            ...(dependsOn.length > 0 ? { dependsOn } : {}),
          }],
        }
      : wp),
  };
  const reasons = goalplanDefinitionIntegrityReasons(next);
  return reasons.length > 0
    ? { kind: "rejected", reason: reasons.join("; ") }
    : { kind: "changed", plan: next };
}

export function completeGoalplanTask(
  plan: Goalplan,
  workPhaseId: string,
  taskId: string,
  outcomeText: string,
): GoalplanLifecycleResult {
  const outcome = outcomeText.trim();
  if (!outcome) return { kind: "rejected", reason: "task outcome must not be empty" };
  const target = plan.workPhases.find((wp) => wp.id === workPhaseId)?.tasks.find((task) => task.id === taskId);
  if (!target) return { kind: "rejected", reason: `task '${workPhaseId}/${taskId}' is not in this plan` };
  if (target.status === "done") {
    return { kind: "unchanged", plan, reason: `task '${workPhaseId}/${taskId}' is already done` };
  }
  const ready = readyTasks(plan).some((entry) =>
    entry.workPhaseId === workPhaseId && entry.task.id === taskId
  );
  if (!ready) return { kind: "rejected", reason: `task '${workPhaseId}/${taskId}' is not ready` };
  return {
    kind: "changed",
    plan: {
      ...plan,
      workPhases: plan.workPhases.map((wp) => wp.id === workPhaseId
        ? {
            ...wp,
            tasks: wp.tasks.map((task) => task.id === taskId
              ? { ...task, status: "done" as const, outcome }
              : task),
          }
        : wp),
    },
  };
}

export function meetGoalplanCriterion(
  plan: Goalplan,
  criterionId: string,
  evidenceText: string,
): GoalplanLifecycleResult {
  const evidence = evidenceText.trim();
  if (!evidence) return { kind: "rejected", reason: "criterion evidence must not be empty" };
  const target = plan.criteria.find((criterion) => criterion.id === criterionId);
  if (!target) return { kind: "rejected", reason: `criterion '${criterionId}' is not in this plan` };
  if (target.status === "met") {
    return { kind: "unchanged", plan, reason: `criterion '${criterionId}' is already met` };
  }
  return {
    kind: "changed",
    plan: {
      ...plan,
      criteria: plan.criteria.map((criterion) => criterion.id === criterionId
        ? { ...criterion, capturedEvidence: evidence, status: "met" as const }
        : criterion),
    },
  };
}

/** Criteria still open. */
export function unmetCriteria(plan: Goalplan): GoalplanCriterion[] {
```

### MODIFY — `plugins/codexclaw/components/pabcd-state/src/steering.ts`

before (`steering.ts`의 `goalplan.ts` import, wp5 적용 후 상태):

```ts
// wp5 적용 후 상태
import {
  appendGoalplanLedger,
  withGoalplanWriteLock,
  writeGoalplan,
  type Goalplan,
  type GoalplanWriteLockOptions,
  type SteeringEntry,
} from "./goalplan.ts";
```

after:

```ts
// wp5 적용 후 + wp6 추가분 (선행 wp5: withGoalplanWriteLock, GoalplanWriteLockOptions;
// wp6: goalplanDefinitionIntegrityReasons)
import {
  appendGoalplanLedger,
  goalplanDefinitionIntegrityReasons,
  withGoalplanWriteLock,
  writeGoalplan,
  type Goalplan,
  type GoalplanWriteLockOptions,
  type SteeringEntry,
} from "./goalplan.ts";
```

before:

```ts
// wp5 적용 후 상태
  | { kind: "add-work-phase"; id: string; title: string };
```

after:

```ts
  | { kind: "add-work-phase"; id: string; title: string; dependsOn?: string[] };
```

before (`steering.ts:183`):

```ts
// wp5 적용 후 상태
ops.push({ kind: "add-work-phase", id: op.id, title: op.title.trim() });
```

after:

```ts
const rawDependsOn = op.dependsOn ?? [];
if (!Array.isArray(rawDependsOn)) {
  return { error: `ops[${i}].dependsOn must be an array of non-empty work-phase ids` };
}
const dependsOn = rawDependsOn.map((id) => typeof id === "string" ? id.trim() : "");
if (dependsOn.some((id) => id.length === 0)) {
  return { error: `ops[${i}].dependsOn must be an array of non-empty work-phase ids` };
}
if (new Set(dependsOn).size !== dependsOn.length) {
  return { error: `ops[${i}].dependsOn must not contain duplicate ids` };
}
ops.push({ kind: "add-work-phase", id: op.id, title: op.title.trim(), dependsOn });
```

before (`steering.ts:210-245`, wp5 적용 후 상태):

```ts
// wp5 적용 후 상태
function applyOps(plan: Goalplan, ops: SteerOp[]): { plan: Goalplan } | { error: string } {
  let criteria = [...plan.criteria];
  let workPhases = [...plan.workPhases];
  for (const op of ops) {
    if (op.kind === "annotate") continue;
    if (op.kind === "add-criterion") {
      const scenario = op.scenario;
      if (criteria.some((criterion) => criterion.scenario === scenario)) {
        return { error: `a criterion with scenario "${scenario}" is already registered` };
      }
      const maxId = criteria.reduce((maximum, criterion) => {
        const value = Number(/^c-(\d+)$/.exec(criterion.id)?.[1] ?? 0);
        return Number.isFinite(value) && value > maximum ? value : maximum;
      }, 0);
      criteria = [
        ...criteria,
        {
          id: `c-${maxId + 1}`,
          scenario,
          surface: op.surface ?? "logic",
          expectedEvidence: op.expectedEvidence ?? "",
          capturedEvidence: null,
          status: "open",
        },
      ];
      continue;
    }
    if (workPhases.some((phase) => phase.id === op.id)) {
      return { error: `work phase '${op.id}' is already in this plan` };
    }
    workPhases = [
      ...workPhases,
      { id: op.id, title: op.title, status: "pending", tasks: [], criteriaIds: [] },
    ];
  }
  return { plan: { ...plan, criteria, workPhases } };
}
```

after:

```ts
function applyOps(plan: Goalplan, ops: SteerOp[]): { plan: Goalplan } | { error: string } {
  let criteria = [...plan.criteria];
  let workPhases = [...plan.workPhases];
  for (const op of ops) {
    if (op.kind === "annotate") continue;

    if (op.kind === "add-criterion") {
      const scenario = op.scenario;
      if (criteria.some((criterion) => criterion.scenario === scenario)) {
        return { error: `a criterion with scenario "${scenario}" is already registered` };
      }
      const maxId = criteria.reduce((maximum, criterion) => {
        const value = Number(/^c-(\d+)$/.exec(criterion.id)?.[1] ?? 0);
        return Number.isFinite(value) && value > maximum ? value : maximum;
      }, 0);
      const candidateCriteria = [
        ...criteria,
        {
          id: `c-${maxId + 1}`,
          scenario,
          surface: op.surface ?? "logic",
          expectedEvidence: op.expectedEvidence ?? "",
          capturedEvidence: null,
          status: "open" as const,
        },
      ];
      const next: Goalplan = { ...plan, criteria: candidateCriteria, workPhases };
      // 감사 라운드 1 High: lifecycle과 `ready`는 두 helper를 다 보는데 steering만 definition만
      // 봤다. 실측 반례: leaf가 done이고 그 dependency base가 pending인 plan은 definition 0건,
      // completion 1건이다. 그 plan에서 `add-task`와 `ready`는 거부하는데 steering을 지나는
      // `add-work-phase`는 새 phase를 써 버린다. 같은 순서로 둘 다 검사한다.
      const reasons = [
        ...goalplanDefinitionIntegrityReasons(next),
        ...goalplanDependencyCompletionReasons(next),
      ];
      if (reasons.length > 0) return { error: reasons.join("; ") };
      criteria = candidateCriteria;
      continue;
    }

    if (workPhases.some((phase) => phase.id === op.id)) {
      return { error: `work phase '${op.id}' is already in this plan` };
    }
    const dependsOn = op.dependsOn ?? [];
    const candidateWorkPhases = [...workPhases, {
      id: op.id,
      title: op.title,
      status: "pending" as const,
      tasks: [],
      criteriaIds: [],
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
    }];
    const next: Goalplan = { ...plan, criteria, workPhases: candidateWorkPhases };
    const reasons = [
      ...goalplanDefinitionIntegrityReasons(next),
      ...goalplanDependencyCompletionReasons(next),
    ];
    if (reasons.length > 0) return { error: reasons.join("; ") };
    workPhases = candidateWorkPhases;
    continue;
  }

  return { plan: { ...plan, criteria, workPhases } };
}
```

각 mutation op는 아직 디스크에 쓰지 않은 임시 plan을 검사한다. 검사 성공 때만 지역 배열을 갱신하고
`continue`한다. 최종 `return`은 루프 밖에 하나만 둔다. 따라서 `[wp-a, wp-b dependsOn wp-a]`는
두 phase를 모두 쌓고, forward 참조는 참조 phase를 만나기 전 dangling으로 거부한다.

`applySteeringBatch()`의 wp5 lock callback에서 `writeGoalplan()`이 성공한 뒤 기존 `steered`를
append한다. 의존이 저장된 새 phase마다 다음 줄을 추가한다.

```ts
for (const op of batch.ops) {
  if (op.kind !== "add-work-phase") continue;
  const dependsOn = op.dependsOn ?? [];
  if (dependsOn.length === 0) continue;
  appendGoalplanLedger(cwd, slug, {
    ts: entry.appliedAt,
    slug,
    event: "dependency_registered",
    detail: `${op.id} dependsOn=${dependsOn.join(",")}`,
  });
}
```

거부 경로에는 append 호출이 없다.

### MODIFY — `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts`

`goalplan.ts` import의 전체 After는 아래와 같다. `goalplanWriteLockStatus`는 wp5가 만든 read-only
진단 helper며, `commitLifecycle()`이 호출하는 write·ledger·lock 함수도 같은 블록에 남긴다.

```ts
// wp5 적용 후 + wp6 추가분
// 선행 wp2: readGoalplanDetailed
// 선행 wp3: goalplanDefinitionIntegrityReasons, goalplanDependencyCompletionReasons
// 선행 wp5: goalplanWriteLockStatus, withGoalplanWriteLock, GoalplanWriteLockStatus
// wp6: addGoalplanTask, completeGoalplanTask, meetGoalplanCriterion, readyTasks,
// readyWorkPhases, GoalplanLifecycleResult
import {
  addGoalplanTask,
  appendGoalplanLedger,
  buildGoalplan,
  completeGoalplanTask,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  goalplanWriteLockStatus,
  isGoalplanComplete,
  meetGoalplanCriterion,
  readGoalplan,
  readGoalplanDetailed,
  readyTasks,
  readyWorkPhases,
  remainingWorkPhases,
  unmetCriteria,
  validateGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
  type Goalplan,
  type GoalplanLifecycleResult,
  type GoalplanReadResult,
  type GoalplanValidationCtx,
  type GoalplanWriteLockStatus,
} from "./goalplan.ts";
```

wp5의 `goalplanWriteLockStatus()`는 wp6이 바꾸지 않는다. 네 번째 `stat` 인자는 exists→stat 경쟁을
재현하는 테스트 seam이다. Before와 After에서 시그니처를 그대로 보존하고 본문은 `stat(path)`를
호출한다. `node:fs` import의 `existsSync`, `statSync`도 남긴다.

before (`goalplan.ts`, wp5 적용 후 상태):

```ts
// wp5 적용 후 상태
export function goalplanWriteLockStatus(
  cwd: string,
  slug: string,
  nowMs: number = Date.now(),
  stat: (path: string) => { mtimeMs: number } = statSync,
): GoalplanWriteLockStatus {
  const path = goalplanWriteLockDir(cwd, slug);
  if (!existsSync(path)) return { path, exists: false, ageMs: null };
  try {
    const ageMs = Math.max(0, nowMs - stat(path).mtimeMs);
    return { path, exists: true, ageMs };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { path, exists: false, ageMs: null };
    }
    throw err;
  }
}
```

after (`goalplan.ts`, wp6 적용 후에도 동일):

```ts
// wp5 적용 후 + wp6 추가분 없음
// 선행 wp5: closeSync, fsConstants, lstatSync, statSync, writeSync
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";

export function goalplanWriteLockStatus(
  cwd: string,
  slug: string,
  nowMs: number = Date.now(),
  stat: (path: string) => { mtimeMs: number } = statSync,
): GoalplanWriteLockStatus {
  const path = goalplanWriteLockDir(cwd, slug);
  if (!existsSync(path)) return { path, exists: false, ageMs: null };
  try {
    const ageMs = Math.max(0, nowMs - stat(path).mtimeMs);
    return { path, exists: true, ageMs };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { path, exists: false, ageMs: null };
    }
    throw err;
  }
}
```

`renderPlan()`과 `renderPlanLines()`는 선택적인 락 상태를 받는다. `show`만 helper를 호출해 락 줄을
넣으므로 init·등록·lifecycle의 기존 plan 출력은 바뀌지 않는다. path는 항상 절대 경로고, 락이
있으면 밀리초 나이도 나온다.

before (`goalplan-cli.ts:124-126`, `:275-290`, wp5 적용 후 상태):

```ts
// wp5 적용 후 상태
function renderPlan(plan: Goalplan): string {
  return renderPlanLines(plan);
}

function renderPlanLines(plan: Goalplan): string {
  const lines = [
    `[codexclaw loop: ${plan.slug}]`,
    `objective: ${plan.objective}`,
    `host: armed=${plan.host.armed} source=${plan.host.source}`,
    `workPhases: ${plan.workPhases.length} (remaining ${remainingWorkPhases(plan).length})`,
    `criteria: ${plan.criteria.length} (unmet ${unmetCriteria(plan).length})`,
    `complete: ${isGoalplanComplete(plan)}`,
  ];
  for (const wp of plan.workPhases) {
    lines.push(`  - ${wp.id} [${wp.status}] ${wp.title}`);
  }
  for (const c of plan.criteria) {
    lines.push(`  - ${c.id} [${c.status}] ${c.scenario}`);
  }
  return lines.join("\n");
}
```

after:

```ts
function renderPlan(plan: Goalplan, lock: GoalplanWriteLockStatus | null = null): string {
  return renderPlanLines(plan, lock);
}

function renderPlanLines(plan: Goalplan, lock: GoalplanWriteLockStatus | null = null): string {
  const lines = [
    `[codexclaw loop: ${plan.slug}]`,
    `objective: ${plan.objective}`,
    `host: armed=${plan.host.armed} source=${plan.host.source}`,
  ];
  if (lock) {
    lines.push(lock.exists
      ? `writeLock: present path=${lock.path} ageMs=${Math.round(lock.ageMs ?? 0)}`
      : `writeLock: absent path=${lock.path}`);
  }
  lines.push(
    `workPhases: ${plan.workPhases.length} (remaining ${remainingWorkPhases(plan).length})`,
    `criteria: ${plan.criteria.length} (unmet ${unmetCriteria(plan).length})`,
    `complete: ${isGoalplanComplete(plan)}`,
  );
  for (const wp of plan.workPhases) {
    lines.push(`  - ${wp.id} [${wp.status}] ${wp.title}`);
  }
  for (const c of plan.criteria) {
    lines.push(`  - ${c.id} [${c.status}] ${c.scenario}`);
  }
  return lines.join("\n");
}
```

`runGoalplanCli()`의 show 분기만 락 상태를 넘긴다.

```ts
if (args.verb === "show") {
  const lock = goalplanWriteLockStatus(args.cwd, plan.slug);
  return { output: renderPlan(plan, lock), code: 0 };
}
```

`GoalplanVerb`과 `VERBS`에 `ready`, `add-task`, `complete-task`, `meet-criterion`을 추가한다.
args와 초기 객체는 아래 필드를 가진다.

```ts
dependsOn?: string[];
workPhaseId?: string;
evidence?: string;
outcome?: string;
// 감사 라운드 1 BLOCKER: optional로 둔다. `parseGoalplanCliArgs()`의 help 조기 반환
// (`goalplan-cli.ts:80`)은 `{ verb: "help", cwd, criteria: [] }`를 그대로 돌려주므로 필수
// 필드를 더하면 그 반환이 타입 오류가 된다. 소비 지점은 `args.json === true`로 읽는다.
json?: boolean;

const out: GoalplanCliArgs = {
  verb: verb as GoalplanVerb,
  cwd,
  criteria: [],
  dependsOn: [],
  json: false,
};
```

before (`goalplan-cli.ts:99` 뒤):

```ts
// wp5 적용 후 상태
else if (a === "--title") out.title = argv[++i];
```

after:

```ts
else if (a === "--title") out.title = argv[++i];
else if (a === "--work-phase") out.workPhaseId = argv[++i];
else if (a === "--evidence") out.evidence = argv[++i];
else if (a === "--outcome") out.outcome = argv[++i];
else if (a === "--json") out.json = true;
else if (a === "--depends-on") {
  const value = argv[++i];
  if (typeof value !== "string" || value.trim().length === 0) {
    return { error: "--depends-on requires one non-empty prerequisite id" };
  }
  const id = value.trim();
  if ((out.dependsOn ?? []).includes(id)) {
    return { error: `--depends-on must not repeat prerequisite id '${id}'` };
  }
  out.dependsOn = [...(out.dependsOn ?? []), id];
}
```

before (`goalplan-cli.ts:251-252`):

```ts
// wp5 적용 후 상태
op = { kind: "add-work-phase", id, title };
summary = `${id}: ${title}`;
```

after:

```ts
const dependsOn = args.dependsOn ?? [];
op = { kind: "add-work-phase", id, title, dependsOn };
summary = dependsOn.length === 0
  ? `${id}: ${title}`
  : `${id}: ${title}; dependsOn=${dependsOn.join(",")}`;
```

의존이 없는 명령의 summary는 업그레이드 전 문자열과 글자 단위로 같다. 이 문자열이 SHA-256 기반
idempotency key의 입력이므로 빈 suffix도 붙이지 않는다. 의존을 한 개 이상 지정한 새 명령만
`dependsOn=` suffix를 쓴다.

`renderPlanLines()` 앞에 ready 실행기를 추가한다.

```ts
function planIntegrityReasons(plan: Goalplan): string[] {
  return [
    ...goalplanDefinitionIntegrityReasons(plan),
    ...goalplanDependencyCompletionReasons(plan),
  ];
}

function runReady(args: GoalplanCliArgs): GoalplanCliResult {
  if (typeof args.session === "string" && args.session.length > 0 && !isCanonicalSessionId(args.session)) {
    return { output: "loop ready: session id is not canonical", code: 1 };
  }
  const slug = resolveSlug(args);
  if (!slug) return { output: "loop ready: --slug, --objective, or a bound --session is required", code: 1 };
  const read = readGoalplanDetailed(args.cwd, slug);
  if (!read.plan) return { output: describeReadFailure(read, "ready", slug), code: 1 };
  const reasons = planIntegrityReasons(read.plan);
  if (reasons.length > 0) {
    return { output: `loop ready: invalid goalplan: ${reasons.join("; ")}`, code: 1 };
  }
  const phases = readyWorkPhases(read.plan);
  const tasks = readyTasks(read.plan);
  if (args.json) {
    return { code: 0, output: JSON.stringify({
      slug,
      readyWorkPhases: phases.map((wp) => ({
        id: wp.id,
        title: wp.title,
        status: wp.status,
        dependsOn: wp.dependsOn ?? [],
      })),
      readyTasks: tasks.map(({ workPhaseId, task }) => ({ workPhaseId, ...task })),
    }) };
  }
  return { code: 0, output: [
    `[codexclaw loop ready: ${slug}]`,
    `workPhases: ${phases.length}`,
    ...phases.map((wp) => `  - ${wp.id} [${wp.status}] ${wp.title}`),
    `tasks: ${tasks.length}`,
    ...tasks.map(({ workPhaseId, task }) => `  - ${workPhaseId}/${task.id} [${task.status}] ${task.title}`),
  ].join("\n") };
}
```

인자 검사는 락 밖에서 해도 된다. plan 읽기, 무결성 검사, 순수 전이, write, append는 한 callback에 둔다.

```ts
function commitLifecycle(
  args: GoalplanCliArgs,
  slug: string,
  mutate: (plan: Goalplan) => GoalplanLifecycleResult,
  ledgerFor: () => {
    event: "task_done" | "criterion_met" | "dependency_registered";
    detail: string;
  } | null,
): GoalplanCliResult {
  const locked = withGoalplanWriteLock(args.cwd, slug, (plan): GoalplanCliResult => {
    const reasons = planIntegrityReasons(plan);
    if (reasons.length > 0) {
      return { output: `loop ${args.verb}: invalid goalplan: ${reasons.join("; ")}`, code: 1 };
    }
    const result = mutate(plan);
    if (result.kind === "rejected") return { output: `loop ${args.verb}: ${result.reason}`, code: 1 };
    if (result.kind === "unchanged") {
      return { output: `loop ${args.verb}: ${result.reason}; nothing to do`, code: 0 };
    }
    writeGoalplan(args.cwd, result.plan);
    const ledger = ledgerFor();
    let warning: string | null = null;
    if (ledger) {
      try {
        appendGoalplanLedger(args.cwd, slug, {
          ts: new Date().toISOString(), slug, event: ledger.event, detail: ledger.detail,
        });
      } catch (err) {
        warning =
          `warning: goalplan state was committed, but ledger append failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    return {
      output: [renderPlan(result.plan), warning].filter((line): line is string => line !== null).join("\n"),
      code: 0,
    };
  });
  return locked.kind === "ok"
    ? locked.value
    : { output: `loop ${args.verb}: ${locked.reason}`, code: 1 };
}

function runLifecycle(args: GoalplanCliArgs): GoalplanCliResult {
  const session = (args.session ?? "").trim();
  if (!session) return { output: `loop ${args.verb}: --session <id> is required`, code: 1 };
  if (!isCanonicalSessionId(session)) return { output: `loop ${args.verb}: session id is not canonical`, code: 1 };
  const slug = readState(args.cwd, session).slug;
  if (!slug) return { output: `loop ${args.verb}: session '${session}' has no bound goalplan`, code: 1 };

  if (args.verb === "add-task") {
    const workPhaseId = (args.workPhaseId ?? "").trim();
    const id = (args.id ?? "").trim();
    const title = (args.title ?? "").trim();
    if (!workPhaseId || !id || !title) {
      return { output: "loop add-task: --work-phase, --id, and --title are required", code: 1 };
    }
    const dependsOn = args.dependsOn ?? [];
    return commitLifecycle(
      args,
      slug,
      (plan) => addGoalplanTask(plan, workPhaseId, { id, title, dependsOn }),
      () => dependsOn.length > 0
        ? { event: "dependency_registered", detail: `${workPhaseId}/${id} dependsOn=${dependsOn.join(",")}` }
        : null,
    );
  }

  if (args.verb === "complete-task") {
    const workPhaseId = (args.workPhaseId ?? "").trim();
    const id = (args.id ?? "").trim();
    const outcome = (args.outcome ?? "").trim();
    if (!workPhaseId || !id || !outcome) {
      return { output: "loop complete-task: --work-phase, --id, and non-empty --outcome are required", code: 1 };
    }
    return commitLifecycle(
      args,
      slug,
      (plan) => completeGoalplanTask(plan, workPhaseId, id, outcome),
      () => ({ event: "task_done", detail: outcome }),
    );
  }

  const id = (args.id ?? "").trim();
  const evidence = (args.evidence ?? "").trim();
  if (!id || !evidence) {
    return { output: "loop meet-criterion: --id and non-empty --evidence are required", code: 1 };
  }
  return commitLifecycle(
    args,
    slug,
    (plan) => meetGoalplanCriterion(plan, id, evidence),
    () => ({ event: "criterion_met", detail: `met ${id}: ${evidence}` }),
  );
}
```

`writeGoalplan()` 성공이 권위 commit point다. 그 뒤 `appendGoalplanLedger()`가 실패해도 plan 변경은
되돌리지 않으며 code 0과 `warning: goalplan state was committed, but ledger append failed: ...`를
반환한다. 원장은 역사라서 권위 plan commit의 성공 여부를 뒤집지 않는다. 경고를 숨기지는 않는다.
`runGoalplanCli()`에는 다음 분기를 넣는다.

```ts
if (args.verb === "ready") return runReady(args);
if (args.verb === "add-task" || args.verb === "complete-task" || args.verb === "meet-criterion") {
  return runLifecycle(args);
}
```

`renderGoalplanHelp()`는 일부 usage 조각이 아니라 함수 전체를 아래처럼 바꾼다. 현재의 `init`,
`show`, `validate`, `steer`, `add-criterion`, `--slug`, `--help`, Notes, steering batch 설명을 모두
남기고 새 공개 명령을 추가한다.

```ts
export function renderGoalplanHelp(): string {
  return [
    "cxc loop — durable goalplan for a multi-cycle PABCD loop",
    "",
    "Usage:",
    "  cxc loop init --objective <text> --session <id> [--criterion <text>]... [--cwd <path>]",
    "  cxc loop show (--slug <slug> | --objective <text>) [--cwd <path>]",
    "  cxc loop validate --slug <slug> [--cwd <path>]",
    "  cxc loop steer --session <id> --batch-json <path-or-json> [--cwd <path>]",
    "  cxc loop add-work-phase --session <id> --id <id> --title <text> [--depends-on <id>]... [--cwd <path>]",
    "  cxc loop add-criterion --session <id> --criterion <text> [--surface logic|web|tui] [--cwd <path>]",
    "  cxc loop ready (--slug <slug> | --objective <text> | --session <id>) [--json] [--cwd <path>]",
    "  cxc loop add-task --session <id> --work-phase <id> --id <id> --title <text> [--depends-on <task-id>]... [--cwd <path>]",
    "  cxc loop complete-task --session <id> --work-phase <id> --id <id> --outcome <text> [--cwd <path>]",
    "  cxc loop meet-criterion --session <id> --id <id> --evidence <text> [--cwd <path>]",
    "  cxc loop --help",
    "",
    "Notes:",
    "  Mutating verbs require --session <id>; show, validate, and ready are read-only.",
    "  The goalplan lives at <cwd>/.codexclaw/goalplans/<slug>/goalplan.json, so --cwd",
    "  matters when the process cwd is not the workspace you are planning in.",
    "  Repeat --depends-on once per prerequisite; add-task accepts only existing task ids",
    "  from the same work phase; comma-separated values are one id.",
    "  complete-task requires non-empty outcome evidence and never replaces a stored outcome.",
    "  meet-criterion requires non-empty evidence and keeps the first stored evidence.",
    "",
    "steer --batch-json expects an object with:",
    '  { "idempotencyKey": "<unique>", "rationale": "<why>", "evidence": "<proof>",',
    '    "ops": [ { "kind": "annotate", "note": "..." } ] }',
    "  op kinds: annotate | add-criterion | add-work-phase (all additive — steering",
    "  cannot weaken a completion criterion).",
  ].join("\n");
}
```

### MODIFY — `plugins/codexclaw/components/pabcd-state/src/hook.ts`

before (`hook.ts:46`, wp5가 락과 D-close를 적용한 뒤):

```ts
// wp5 최종 import After 그대로: 선행 wp4가 추가한 dependencyDeadlock,
// effectiveActiveWorkPhaseId와 선행 wp5가 추가한 fs/path/ledger/recovery/integrity 이름을 모두 보존
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendLedger,
  ensureState,
  LEDGER_FILE,
  matchesDcloseRecovery,
  readState,
  STATE_DIR,
  writeState,
  type Phase,
  type State,
} from "./state.ts";
import { applyHumanTransition, clearedIdle, type ApplyResult } from "./orchestrate-apply.ts";
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  GOALPLAN_LEDGER_FILE,
  goalplanDir,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  nextOpenTask,
  readGoalplan,
  unmetCriteria,
  withGoalplanWriteLock,
  writeGoalplan,
  absentSuccessorDetail,
  closeFixedWorkPhase,
  resumeAbsentTarget,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";
```

after:

```ts
// wp5 최종 import After + wp6 추가분
// 선행 wp4가 추가: dependencyDeadlock, effectiveActiveWorkPhaseId
// 선행 wp5가 추가: goalplanDefinitionIntegrityReasons, goalplanDependencyCompletionReasons
// 선행 wp5가 추가: withGoalplanWriteLock과 fs/path/ledger/recovery 이름
// wp6: dependencyWaitReasons, readyWorkPhases, readyTasks
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendLedger,
  ensureState,
  LEDGER_FILE,
  matchesDcloseRecovery,
  readState,
  STATE_DIR,
  writeState,
  type Phase,
  type State,
} from "./state.ts";
import { applyHumanTransition, clearedIdle, type ApplyResult } from "./orchestrate-apply.ts";
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  dependencyWaitReasons,
  effectiveActiveWorkPhaseId,
  GOALPLAN_LEDGER_FILE,
  goalplanDir,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  nextOpenTask,
  readGoalplan,
  readyWorkPhases,
  readyTasks,
  unmetCriteria,
  withGoalplanWriteLock,
  writeGoalplan,
  absentSuccessorDetail,
  closeFixedWorkPhase,
  resumeAbsentTarget,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";
```

before (`hook.ts:1081-1085`, `:1113-1118`, `:1165-1178`):

```ts
// wp5 적용 후 상태
export interface StopWorkContext {
  nextTaskTitle: string | null;
  expectedEvidence: string | null;
  dependencyBlockedReason: string | null;
  ledgerPath: string | null;
}

if (work) {
  if (work.nextTaskTitle) lines.push(`Remaining work: ${work.nextTaskTitle}`);
  if (work.expectedEvidence) lines.push(`Required evidence: ${work.expectedEvidence}`);
  if (work.dependencyBlockedReason) lines.push(work.dependencyBlockedReason);
  if (work.ledgerPath) lines.push(`Record progress in: ${work.ledgerPath}`);
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

after:

```ts
export interface StopWorkContext {
  readyWorkPhases: Array<{ id: string; title: string }>;
  readyTasks: Array<{ workPhaseId: string; id: string; title: string }>;
  waitingOn: string[];
  expectedEvidence: string | null;
  ledgerPath: string | null;
}

function appendStopWorkLines(lines: string[], work: StopWorkContext): void {
  if (work.readyWorkPhases.length > 0) {
    lines.push(`Ready work phases: ${work.readyWorkPhases.map((wp) => `${wp.id} (${wp.title})`).join("; ")}`);
  }
  if (work.readyTasks.length > 0) {
    lines.push(`Ready tasks: ${work.readyTasks.map((task) => `${task.workPhaseId}/${task.id} (${task.title})`).join("; ")}`);
  }
  if (work.waitingOn.length > 0) lines.push(`Waiting on: ${work.waitingOn.join("; ")}`);
  if (work.expectedEvidence) lines.push(`Required evidence: ${work.expectedEvidence}`);
  if (work.ledgerPath) lines.push(`Record progress in: ${work.ledgerPath}`);
}

if (work) appendStopWorkLines(lines, work);

export function readStopWorkContext(cwd: string, state: State): StopWorkContext | null {
  const slug = state.slug;
  if (!slug) return null;
  const plan = readGoalplan(cwd, slug);
  if (!plan) return null;

  // 감사 라운드 1 High: `loop ready` refuses an invalid plan, so Stop must not answer the
  // same question from one. Measured on a plan with two tasks sharing an id: ready exits 1
  // with `duplicate task id 'dup'`, while an ungated Stop listed BOTH `wp-1/dup (first)`
  // and `wp-1/dup (second)` as runnable. The user then follows that guidance into a
  // complete-task refusal. One gate, both surfaces — and the diagnostic replaces the ready
  // list rather than sitting beside it, because a list built from an ambiguous graph has no
  // meaning to sit beside.
  const invalidReasons = [
    ...goalplanDefinitionIntegrityReasons(plan),
    ...goalplanDependencyCompletionReasons(plan),
  ];
  if (invalidReasons.length > 0) {
    return {
      readyWorkPhases: [],
      readyTasks: [],
      waitingOn: [`the goalplan is invalid: ${invalidReasons.join("; ")}`],
      expectedEvidence: null,
      ledgerPath: `.codexclaw/goalplans/${slug}/ledger.jsonl`,
    };
  }

  const phases = readyWorkPhases(plan);
  const tasks = readyTasks(plan);
  const partialWaitReasons = dependencyWaitReasons(plan);
  const deadlock = dependencyDeadlock(plan);
  const waitingOn = deadlock?.reasons ?? partialWaitReasons;

  const unmet = unmetCriteria(plan);
  if (phases.length === 0 && tasks.length === 0 && waitingOn.length === 0 && unmet.length === 0) return null;
  return {
    readyWorkPhases: phases.map(({ id, title }) => ({ id, title })),
    readyTasks: tasks.map(({ workPhaseId, task }) => ({ workPhaseId, id: task.id, title: task.title })),
    waitingOn,
    expectedEvidence: unmet[0]?.expectedEvidence ?? null,
    ledgerPath: `.codexclaw/goalplans/${slug}/ledger.jsonl`,
  };
}
```

`buildGoalIdleBlock()`도 같은 context를 소비하므로 옛 필드 접근을 남기지 않는다.

before (`hook.ts:1187-1192`):

```ts
// wp5 적용 후 상태
const work = readStopWorkContext(cwd, state);
if (work) {
  if (work.nextTaskTitle) lines.push(`Remaining work: ${work.nextTaskTitle}`);
  if (work.expectedEvidence) lines.push(`Required evidence: ${work.expectedEvidence}`);
  if (work.dependencyBlockedReason) lines.push(work.dependencyBlockedReason);
  if (work.ledgerPath) lines.push(`Record progress in: ${work.ledgerPath}`);
} else if (plan && plan.workPhases.length === 0 && plan.criteria.length === 0) {
```

after:

```ts
const work = readStopWorkContext(cwd, state);
if (work) {
  appendStopWorkLines(lines, work);
} else if (plan && plan.workPhases.length === 0 && plan.criteria.length === 0) {
```

이 변경은 Stop이 만든 현재 턴의 안내만 풍부하게 한다. 큐를 돌리거나 새 턴을 만들지 않으며,
ready 목록의 실제 병렬도는 호스트가 정한다.

### MODIFY — `plugins/codexclaw/skills/loop/SKILL.md`

before (`SKILL.md:241-268`):

```md
<!-- wp5 적용 후 상태 -->
This is the on-disk shape under `.codexclaw/goalplans/<slug>/goalplan.json`
(+ `ledger.jsonl`). Fill these fields; do not invent parallel ones:

- `objective`, `slug`, `createdAt`, `updatedAt`.
- `workPhases[]` — each `{ id, title, status: pending|in_progress|done, tasks[], criteriaIds[] }`;
  `tasks[]` are `{ id, title, status: pending|done }`; `activeWorkPhaseId` marks the current one.
  `workPhases[]` is APPEND-friendly mid-loop: when a new independent unit is discovered
  (LOOP-UNIT-CHAIN-01), add its work-phase (+ criteria) as a P-phase amendment instead of
  treating the plan as frozen at init or ending the goal.
- `criteria[]` — each `{ id, scenario, expectedEvidence, capturedEvidence, status: open|met }`.
  A criterion only reaches `met` when `capturedEvidence` is non-empty (fresh proof, not memory).
- `host` — `GoalplanHostLink { armed, armedAt, source: freeze|none }`. `armed` is provenance,
  intended to read true only after a freeze-boundary arm (the MAIN session created a host goal).
  No shipped CLI flips it automatically and codexclaw never writes the goal DB itself; treat it
  as the slot that records that boundary, not an auto-managed flag.

### CLI surface

- `cxc loop init --objective "<text>" [--session <id>]` — creates the local
  artifact and binds it to the session when a session id is supplied; it never
  writes the host goal DB.
- `cxc loop show --slug "<text>"` — renders the current plan summary.
- `cxc loop validate --slug "<text>"` — runs the E8 quality gate; it FAILS
  unless the plan is complete and every `met` criterion carries `capturedEvidence`.
- `cxc goalplan *` — deprecated alias for the same behavior during migration.

Ledger events are `created`, `workphase_started`, `workphase_done`,
`task_done`, `criterion_met`, and `host_armed`.
```

after:

```md
This is the on-disk shape under `.codexclaw/goalplans/<slug>/goalplan.json`
(+ `ledger.jsonl`). Fill these fields; do not invent parallel ones:

- `objective`, `slug`, `createdAt`, `updatedAt`.
- `workPhases[]` — each `{ id, title, status: pending|in_progress|done, dependsOn?, tasks[], criteriaIds[] }`.
  `workPhase.dependsOn` names prerequisite work phases. `activeWorkPhaseId` marks the current one.
  `workPhases[]` is APPEND-friendly mid-loop: when a new independent unit is discovered
  (LOOP-UNIT-CHAIN-01), add its work-phase (+ criteria) as a P-phase amendment instead of
  treating the plan as frozen at init or ending the goal.
  `tasks[]` are `{ id, title, status: pending|done, dependsOn?, outcome? }`.
  Task ids and task dependency references are phase-local: `task.dependsOn` names existing task ids in
  the same work phase, never a task in another phase. A done task carries a non-empty `outcome`; a pending
  task has no outcome.
- `criteria[]` — each `{ id, scenario, expectedEvidence, capturedEvidence, status: open|met }`.
  A criterion only reaches `met` when `capturedEvidence` is non-empty (fresh proof, not memory).
- `host` — `GoalplanHostLink { armed, armedAt, source: freeze|none }`. `armed` is provenance,
  intended to read true only after a freeze-boundary arm (the MAIN session created a host goal).
  No shipped CLI flips it automatically and codexclaw never writes the goal DB itself; treat it
  as the slot that records that boundary, not an auto-managed flag.

### CLI surface

- `cxc loop init --objective "<text>" [--session <id>]` — creates the local
  artifact and binds it to the session when a session id is supplied; it never
  writes the host goal DB.
- `cxc loop show --slug "<text>"` — renders the current plan summary.
- `cxc loop validate --slug "<text>"` — runs the E8 quality gate; it FAILS
  unless the plan is complete and every `met` criterion carries `capturedEvidence`.
- `cxc loop ready (--slug <slug> | --objective <text> | --session <id>) [--json]`
- `cxc loop add-work-phase --session <id> --id <id> --title <text> [--depends-on <id>]...`
- `cxc loop add-task --session <id> --work-phase <id> --id <id> --title <text> [--depends-on <task-id>]...`
- `cxc loop complete-task --session <id> --work-phase <id> --id <id> --outcome <text>`
- `cxc loop meet-criterion --session <id> --id <id> --evidence <text>`
- `cxc goalplan *` — deprecated alias for the same behavior during migration.

Repeat `--depends-on` once per prerequisite; comma-separated values are one id. Existing dependencies are
not edited after creation. `complete-task` and `meet-criterion` require non-empty proof text.

Ledger events are `created`, `workphase_started`, `workphase_done`, `task_done`, `criterion_met`,
`dependency_registered`, and `host_armed`. `dependency_registered` records only accepted definitions.
```

### NEW — `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts`

아래 파일을 그대로 만든다.

```ts
// wp6 신규 파일 import 전체; 선행 wp 추가 이름 없음
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  advanceWorkPhase, buildGoalplan, goalplanDir, readGoalplan, readyTasks,
  readyWorkPhases, writeGoalplan, type Goalplan,
} from "../src/goalplan.ts";
import {
  parseGoalplanCliArgs, renderGoalplanHelp, runGoalplanCli, type GoalplanCliArgs,
} from "../src/goalplan-cli.ts";
import { defaultState, writeState } from "../src/state.ts";

function fixture(): Goalplan {
  const plan = buildGoalplan({
    objective: "public surface fixture",
    criteria: [{ scenario: "contract is verified", expectedEvidence: "node --test exits 0" }],
    now: () => "2026-08-29T00:00:00.000Z",
  });
  plan.schemaVersion = 3;
  plan.activeWorkPhaseId = "wp-live";
  plan.workPhases = [
    {
      id: "wp-base", title: "base", status: "done", dependsOn: [], criteriaIds: [],
      tasks: [
        { id: "shared", title: "base task", status: "done", dependsOn: [], outcome: "base shipped" },
        { id: "base-only", title: "base-only task", status: "done", dependsOn: [], outcome: "base only shipped" },
      ],
    },
    {
      id: "wp-live", title: "live", status: "in_progress", dependsOn: ["wp-base"], criteriaIds: ["c-1"],
      tasks: [
        { id: "shared", title: "local prerequisite", status: "done", dependsOn: [], outcome: "local ready" },
        { id: "ready-task", title: "ready task", status: "pending", dependsOn: ["shared"] },
        { id: "blocked-task", title: "blocked task", status: "pending", dependsOn: ["later"] },
        { id: "later", title: "later task", status: "pending", dependsOn: [] },
      ],
    },
    {
      id: "wp-blocked", title: "blocked", status: "pending", dependsOn: ["wp-live"], criteriaIds: [],
      tasks: [{ id: "ready-task", title: "same id elsewhere", status: "pending", dependsOn: [] }],
    },
  ];
  return plan;
}

function workspace(plan: Goalplan): { cwd: string; session: string } {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-public-"));
  const session = "sess-public";
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState(session), slug: plan.slug });
  return { cwd, session };
}

function planText(cwd: string, slug: string): string {
  return readFileSync(join(goalplanDir(cwd, slug), "goalplan.json"), "utf8");
}

function ledgerText(cwd: string, slug: string): string {
  const path = join(goalplanDir(cwd, slug), "ledger.jsonl");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function cli(cwd: string, argv: string[]) {
  const parsed = parseGoalplanCliArgs(argv, cwd);
  assert.equal("error" in parsed, false);
  return runGoalplanCli(parsed as GoalplanCliArgs);
}

test("ready APIs honor phase-local task dependencies", () => {
  const plan = fixture();
  assert.deepEqual(readyWorkPhases(plan).map((wp) => wp.id), ["wp-live"]);
  assert.deepEqual(
    readyTasks(plan).map(({ workPhaseId, task }) => `${workPhaseId}/${task.id}`),
    ["wp-live/ready-task", "wp-live/later"],
  );
});

test("parser accumulates repeated depends-on and keeps commas in one id", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-parser-"));
  const repeated = parseGoalplanCliArgs([
    "add-work-phase", "--depends-on", "wp-a", "--depends-on", "wp-b",
  ], cwd) as GoalplanCliArgs;
  assert.deepEqual(repeated.dependsOn, ["wp-a", "wp-b"]);
  const comma = parseGoalplanCliArgs(["add-work-phase", "--depends-on", "wp-a,wp-b"], cwd) as GoalplanCliArgs;
  assert.deepEqual(comma.dependsOn, ["wp-a,wp-b"]);
  assert.deepEqual(
    parseGoalplanCliArgs(["add-work-phase", "--depends-on", "wp-a", "--depends-on", "wp-a"], cwd),
    { error: "--depends-on must not repeat prerequisite id 'wp-a'" },
  );
  assert.deepEqual(
    parseGoalplanCliArgs(["add-work-phase", "--depends-on", "   "], cwd),
    { error: "--depends-on requires one non-empty prerequisite id" },
  );
});

test("ready json returns dependency-filtered arrays", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const result = cli(cwd, ["ready", "--session", session, "--json"]);
  assert.equal(result.code, 0);
  const body = JSON.parse(result.output);
  assert.deepEqual(body.readyWorkPhases, [
    { id: "wp-live", title: "live", status: "in_progress", dependsOn: ["wp-base"] },
  ]);
  assert.deepEqual(body.readyTasks.map((task: { workPhaseId: string; id: string }) =>
    `${task.workPhaseId}/${task.id}`), ["wp-live/ready-task", "wp-live/later"]);
});

test("ready rejects a non-canonical session before a sanitized collision can expose a plan", () => {
  const plan = fixture();
  const cwd = mkdtempSync(join(tmpdir(), "cxc-ready-session-"));
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState("a-b"), slug: plan.slug });

  const result = cli(cwd, ["ready", "--session", "a/b", "--json"]);

  assert.equal(result.code, 1);
  assert.equal(result.output, "loop ready: session id is not canonical");
  assert.doesNotMatch(result.output, new RegExp(plan.slug));
  assert.doesNotMatch(result.output, /wp-live|ready-task|Ready task/);
});

test("add-work-phase without dependencies reuses the pre-upgrade idempotency key", () => {
  const plan = fixture();
  plan.steeringLog = [{
    // sha256("wp-new: new").slice(0, 12) === "c90b4bd0e709"
    idempotencyKey: "add-work-phase-c90b4bd0e709",
    rationale: "cxc loop add-work-phase",
    evidence: "wp-new: new",
    appliedAt: "2026-08-28T00:00:00.000Z",
    summary: "1 op(s): add-work-phase",
  }];
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);

  const result = cli(cwd, [
    "add-work-phase", "--session", session, "--id", "wp-new", "--title", "new",
  ]);

  assert.equal(result.code, 0);
  assert.match(result.output, /already applied/);
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  assert.equal(readGoalplan(cwd, plan.slug)?.workPhases.some((wp) => wp.id === "wp-new"), false);
});

test("add-task uses phase-local uniqueness and terminal rejection writes nothing", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const crossPhase = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-blocked", "--id", "shared", "--title", "local shared",
  ]);
  assert.equal(crossPhase.code, 0);
  assert.equal(readGoalplan(cwd, plan.slug)?.workPhases[2].tasks.at(-1)?.id, "shared");
  const duplicate = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-live", "--id", "shared", "--title", "duplicate",
  ]);
  assert.equal(duplicate.code, 1);
  assert.equal(duplicate.output, "loop add-task: task 'wp-live/shared' is already in this work phase");
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const terminal = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-base", "--id", "new", "--title", "new",
  ]);
  assert.equal(terminal.code, 1);
  assert.equal(terminal.output, "loop add-task: work phase 'wp-base' is done and cannot accept a new task");
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("add-task accepts same-phase dependencies and rejects cross-phase, self, and comma references", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const accepted = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-live", "--id", "dependent",
    "--title", "same-phase dependent", "--depends-on", "shared", "--depends-on", "later",
  ]);
  assert.equal(accepted.code, 0);
  assert.deepEqual(
    readGoalplan(cwd, plan.slug)?.workPhases[1].tasks.find((task) => task.id === "dependent")?.dependsOn,
    ["shared", "later"],
  );
  assert.match(ledgerText(cwd, plan.slug), /"event":"dependency_registered"/);

  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const cases = [
    {
      argv: ["--id", "cross-phase", "--title", "cross phase", "--depends-on", "base-only"],
      output: "loop add-task: task wp-live/cross-phase depends on unknown task 'base-only' in the same work phase",
    },
    {
      argv: ["--id", "self", "--title", "self", "--depends-on", "self"],
      output: "loop add-task: task wp-live/self depends on itself",
    },
    {
      argv: ["--id", "comma", "--title", "comma", "--depends-on", "shared,later"],
      output: "loop add-task: task wp-live/comma depends on unknown task 'shared,later' in the same work phase",
    },
  ];
  for (const { argv, output } of cases) {
    const result = cli(cwd, ["add-task", "--session", session, "--work-phase", "wp-live", ...argv]);
    assert.equal(result.code, 1);
    assert.equal(result.output, output);
    assert.equal(planText(cwd, plan.slug), beforePlan);
    assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  }
});

test("complete-task stores trimmed outcome and appends identical detail", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const result = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "  node --test: 24 pass  ",
  ]);
  assert.equal(result.code, 0);
  const stored = readGoalplan(cwd, plan.slug)!;
  assert.equal(stored.workPhases[1].tasks[1].status, "done");
  assert.equal(stored.workPhases[1].tasks[1].outcome, "node --test: 24 pass");
  assert.equal(stored.workPhases[1].status, "in_progress");
  assert.equal(stored.activeWorkPhaseId, "wp-live");
  assert.equal(stored.criteria[0].status, "open");
  const entries = ledgerText(cwd, plan.slug).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(entries.length, 1);
  assert.deepEqual({ event: entries[0].event, detail: entries[0].detail },
    { event: "task_done", detail: "node --test: 24 pass" });
});

test("ledger append failure keeps the committed lifecycle state and returns code 0 with a warning", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const ledgerPath = join(goalplanDir(cwd, plan.slug), "ledger.jsonl");
  mkdirSync(ledgerPath, { recursive: false });

  const result = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "authoritative plan proof",
  ]);

  assert.equal(result.code, 0);
  assert.match(
    result.output,
    /warning: goalplan state was committed, but ledger append failed:/,
  );
  const stored = readGoalplan(cwd, plan.slug)!;
  assert.equal(stored.workPhases[1].tasks[1].status, "done");
  assert.equal(stored.workPhases[1].tasks[1].outcome, "authoritative plan proof");
  assert.equal(existsSync(ledgerPath), true);
});

test("missing and blank outcome leave plan and ledger unchanged", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  for (const tail of [[], ["--outcome", "   "]]) {
    const result = cli(cwd, [
      "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task", ...tail,
    ]);
    assert.equal(result.code, 1);
    assert.equal(result.output, "loop complete-task: --work-phase, --id, and non-empty --outcome are required");
  }
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("complete-task rejects task and phase dependency blockers without writes", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const taskBlocked = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "blocked-task",
    "--outcome", "must not commit",
  ]);
  assert.equal(taskBlocked.code, 1);
  assert.equal(taskBlocked.output, "loop complete-task: task 'wp-live/blocked-task' is not ready");
  const phaseBlocked = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-blocked", "--id", "ready-task",
    "--outcome", "must not commit",
  ]);
  assert.equal(phaseBlocked.code, 1);
  assert.equal(phaseBlocked.output, "loop complete-task: task 'wp-blocked/ready-task' is not ready");
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("complete-task retry preserves first outcome and skips write and append", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "first proof",
  ]).code, 0);
  const afterPlan = planText(cwd, plan.slug);
  const afterLedger = ledgerText(cwd, plan.slug);
  const retry = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "replacement proof",
  ]);
  assert.equal(retry.code, 0);
  assert.equal(retry.output, "loop complete-task: task 'wp-live/ready-task' is already done; nothing to do");
  assert.equal(planText(cwd, plan.slug), afterPlan);
  assert.equal(ledgerText(cwd, plan.slug), afterLedger);
  assert.equal(readGoalplan(cwd, plan.slug)?.workPhases[1].tasks[1].outcome, "first proof");
});

test("criterion evidence is trimmed and retry keeps the first evidence", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-1", "--evidence", "  exit 0  ",
  ]).code, 0);
  const afterPlan = planText(cwd, plan.slug);
  const afterLedger = ledgerText(cwd, plan.slug);
  const retry = cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-1", "--evidence", "replacement",
  ]);
  assert.equal(retry.code, 0);
  assert.equal(readGoalplan(cwd, plan.slug)?.criteria[0].capturedEvidence, "exit 0");
  assert.equal(planText(cwd, plan.slug), afterPlan);
  assert.equal(ledgerText(cwd, plan.slug), afterLedger);
});

test("missing criterion and blank evidence leave plan and ledger unchanged", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const missing = cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-404", "--evidence", "proof",
  ]);
  assert.equal(missing.code, 1);
  assert.equal(missing.output, "loop meet-criterion: criterion 'c-404' is not in this plan");
  const blank = cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-1", "--evidence", "   ",
  ]);
  assert.equal(blank.code, 1);
  assert.equal(blank.output, "loop meet-criterion: --id and non-empty --evidence are required");
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("lock contention fails closed and leaves both files unchanged", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  mkdirSync(join(goalplanDir(cwd, plan.slug), ".goalplan.lock"), { recursive: false });
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const result = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "must not commit",
  ]);
  assert.equal(result.code, 1);
  assert.match(result.output, /\.goalplan\.lock/);
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("public pending task keeps D-close at tasks_pending until completion", () => {
  const plan = fixture();
  plan.workPhases[1].tasks = [];
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-live", "--id", "new-task", "--title", "new work",
  ]).code, 0);
  const pending = advanceWorkPhase(readGoalplan(cwd, plan.slug)!);
  assert.equal(pending.kind, "tasks_pending");
  if (pending.kind === "tasks_pending") assert.deepEqual(pending.pending.map((task) => task.id), ["new-task"]);
  assert.equal(cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "new-task",
    "--outcome", "new work shipped",
  ]).code, 0);
  assert.equal(advanceWorkPhase(readGoalplan(cwd, plan.slug)!).kind, "ok");
});

test("help lists repeated dependency syntax and required outcome", () => {
  const help = renderGoalplanHelp();
  assert.match(help, /cxc loop init --objective/);
  assert.match(help, /cxc loop show \(--slug <slug> \| --objective <text>\)/);
  assert.match(help, /cxc loop validate --slug <slug>/);
  assert.match(help, /cxc loop steer --session <id> --batch-json/);
  assert.match(help, /cxc loop add-work-phase --session <id> --id <id>/);
  assert.match(help, /cxc loop add-criterion --session <id> --criterion <text>/);
  assert.match(help, /\[--depends-on <id>\]\.\.\./);
  assert.match(help, /ready .*--json/);
  assert.match(help, /add-task .*\[--depends-on <task-id>\]\.\.\./);
  assert.match(help, /complete-task .*--outcome <text>/);
  assert.match(help, /meet-criterion .*--evidence <text>/);
  assert.match(help, /Repeat --depends-on once per prerequisite/);
});
```

### MODIFY — `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`

020~050 적용 뒤 import 전체를 출발점으로 삼아 `goalplanWriteLockDir`를 추가한다. 020의
`readGoalplanDetailed`·`effectiveSchemaVersion`, 040의 `dependencyDeadlock`을 지우지 않는다. 030과
050은 이 파일 import에 이름을 추가하지 않았다.

```ts
// wp5 적용 후 + wp6 추가분
// 선행 wp2: readGoalplanDetailed, effectiveSchemaVersion
// 선행 wp3: 없음
// 선행 wp4: dependencyDeadlock
// 선행 wp5: 없음
// wp6: goalplanWriteLockDir
import {
  buildGoalplan,
  readGoalplan,
  readGoalplanDetailed,
  writeGoalplan,
  appendGoalplanLedger,
  dependencyDeadlock,
  goalplanDir,
  goalplanWriteLockDir,
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

기존 `030.2: init requires a real objective, then show/validate work` case의 show assertion을 아래처럼
갱신한다. lock path는 `resolve()` 결과라 절대 경로다. 락이 있으면 나이 숫자가 보인다.

before (`goalplan.test.ts:193-196`):

```ts
// show by objective
const show = runGoalplanCli(parseGoalplanCliArgs(["show", "--objective", "Ship the loop"], cwd) as any);
assert.equal(show.code, 0);
assert.match(show.output, /criteria: 1 \(unmet 1\)/);
```

after:

```ts
// show by objective
const show = runGoalplanCli(parseGoalplanCliArgs(["show", "--objective", "Ship the loop"], cwd) as any);
assert.equal(show.code, 0);
assert.match(show.output, /criteria: 1 \(unmet 1\)/);
const lockPath = goalplanWriteLockDir(cwd, slug);
assert.ok(show.output.includes(`writeLock: absent path=${lockPath}`));

mkdirSync(lockPath, { recursive: false });
const lockedShow = runGoalplanCli(parseGoalplanCliArgs(["show", "--objective", "Ship the loop"], cwd) as any);
assert.equal(lockedShow.code, 0);
assert.ok(lockedShow.output.includes(`writeLock: present path=${lockPath}`));
assert.match(lockedShow.output, /ageMs=\d+/);
```

### MODIFY — `plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts`

기존 `loop ${token} prints usage and exits 0` case의 세 assertion 뒤에 아래를 추가한다. 정확한 help
문법을 기존 help 회귀가 직접 기다리게 한다.

```ts
assert.match(r.output, /ready .*--json/);
assert.match(r.output, /cxc loop init --objective/);
assert.match(r.output, /cxc loop show \(--slug <slug> \| --objective <text>\)/);
assert.match(r.output, /cxc loop validate --slug <slug>/);
assert.match(r.output, /cxc loop steer --session <id> --batch-json/);
assert.match(r.output, /cxc loop add-work-phase --session <id> --id <id>/);
assert.match(r.output, /cxc loop add-criterion --session <id> --criterion <text>/);
assert.match(r.output, /add-task .*\[--depends-on <task-id>\]\.\.\./);
assert.match(r.output, /complete-task .*--outcome <text>/);
assert.match(r.output, /meet-criterion .*--evidence <text>/);
assert.match(r.output, /Repeat --depends-on once per prerequisite/);
```

### MODIFY — `plugins/codexclaw/components/pabcd-state/test/steering.test.ts`

기존 `steering.test.ts:130-150`의 의존 없는 case는 그대로 둔다. 특히 `:136`의
`{ kind: "add-work-phase", id: "wp99-new", title: "Newly scoped work" }` fixture를 지우거나
`dependsOn: []`로 고치지 않는다. optional 타입의 하위 호환을 이 fixture가 컴파일과 실행으로
증명한다. 기존 `workspace()`, `batch()`, `ledgerText()`를 써서 아래 case를 추가한다.

```ts
test("add-work-phase stores dependencies and records one success event", () => {
  const cwd = workspace();
  const plan = readGoalplan(cwd, SLUG)!;
  plan.workPhases = [
    { id: "wp-a", title: "A", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-b", title: "B", status: "done", tasks: [], criteriaIds: [] },
  ];
  writeGoalplan(cwd, plan);
  const result = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-add-wp-deps",
    ops: [{ kind: "add-work-phase", id: "wp-c", title: "C", dependsOn: ["wp-a", "wp-b"] }],
  }));
  assert.equal(result.kind, "applied");
  assert.deepEqual(readGoalplan(cwd, SLUG)?.workPhases.at(-1)?.dependsOn, ["wp-a", "wp-b"]);
  const entries = ledgerText(cwd).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(entries.filter((entry) => entry.event === "dependency_registered").length, 1);
  assert.equal(entries.find((entry) => entry.event === "dependency_registered")?.detail,
    "wp-c dependsOn=wp-a,wp-b");
});

test("same-batch backward reference succeeds and forward reference is rejected as dangling", () => {
  const cwd = workspace();
  const valid = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-same-batch",
    ops: [
      { kind: "add-work-phase", id: "wp-a", title: "A", dependsOn: [] },
      { kind: "add-work-phase", id: "wp-b", title: "B", dependsOn: ["wp-a"] },
    ],
  }));
  assert.equal(valid.kind, "applied");
  const stored = readGoalplan(cwd, SLUG)!;
  assert.deepEqual(
    stored.workPhases.filter((wp) => wp.id === "wp-a" || wp.id === "wp-b").map((wp) => wp.id),
    ["wp-a", "wp-b"],
  );
  assert.deepEqual(stored.workPhases.find((wp) => wp.id === "wp-b")?.dependsOn, ["wp-a"]);
  assert.equal(stored.steeringLog?.at(-1)?.summary, "2 op(s): add-work-phase, add-work-phase");
  const beforePlan = readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8");
  const beforeLedger = ledgerText(cwd);
  const invalid = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-forward-dangling",
    ops: [
      { kind: "add-work-phase", id: "wp-x", title: "X", dependsOn: ["wp-y"] },
      { kind: "add-work-phase", id: "wp-y", title: "Y", dependsOn: ["wp-x"] },
    ],
  }));
  assert.equal(invalid.kind, "rejected");
  assert.equal(
    (invalid as { kind: "rejected"; reason: string }).reason,
    "work phase wp-x depends on unknown work phase 'wp-y'",
  );
  assert.equal(readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8"), beforePlan);
  assert.equal(ledgerText(cwd), beforeLedger);
});

test("duplicate dependencies are rejected before write", () => {
  const cwd = workspace();
  const beforePlan = readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8");
  const beforeLedger = ledgerText(cwd);
  const result = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-duplicate-deps",
    ops: [{ kind: "add-work-phase", id: "wp-c", title: "C", dependsOn: ["wp-a", "wp-a"] }],
  }));
  assert.equal(result.kind, "rejected");
  assert.equal((result as { kind: "rejected"; reason: string }).reason,
    "ops[0].dependsOn must not contain duplicate ids");
  assert.equal(readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8"), beforePlan);
  assert.equal(ledgerText(cwd), beforeLedger);
});
```

`applyOps()`는 첫 op 뒤 즉시 integrity를 검사하므로 위 두 번째 batch는 `wp-y`를 붙이기 전에
dangling으로 끝난다. 공개 mutation 경로에서 cycle을 기대하지 않는다. cycle 검출 본문은
`030_wp3_integrity.md`의 순수 `goalplanDefinitionIntegrityReasons()` 테스트가 소유한다.

### MODIFY — `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts`

040은 §35에 따라 `dependencyDeadlock(plan).reasons`와 `dependencyWaitReasons(plan)` 순수 helper
golden만 남긴다. `readStopWorkContext()` 필드와 Stop 출력 단언은 모두 060이 소유한다. 아래 diff는
현재 checkout의 기존 Stop 소비 경로 두 곳과 040 초안에서 넘겨받은 context 단언 세 묶음을 새 shape로
고친다. helper 반환값만 검사하지 않고 `handleStop()`이 내보낸 실제 `reason`도 검사한다.

기존 두 소비 경로의 assertion은 새 목록 문구로 바꾼다.

before (`hook-continuation.test.ts:504-506`, `:690-694`):

```ts
// wp5 적용 후 상태
assert.match(reason, /Remaining work: Stop hook → goal-idle block/);
assert.match(reason, /Required evidence: node --test green/);
assert.doesNotMatch(reason, /cxc loop init/, "bound session must not be told to re-init");

assert.match(reason, /continue PABCD/);
assert.match(reason, /Remaining work: Backend → add endpoint/);
assert.match(reason, /Required evidence: npm test green/);
assert.match(reason, new RegExp(`Record progress in: \\.codexclaw/goalplans/${plan.slug}/ledger\\.jsonl`));
assert.match(reason, /cxc orchestrate C --session [-\w]+ --attest/);
assert.match(reason, /D is not a resting state/);
```

after:

```ts
assert.match(reason, /Ready work phases: wp-1 \(Stop hook\)/);
assert.match(reason, /Ready tasks: wp-1\/t-1 \(goal-idle block\)/);
assert.match(reason, /Required evidence: node --test green/);
assert.doesNotMatch(reason, /cxc loop init/, "bound session must not be told to re-init");

assert.match(reason, /continue PABCD/);
assert.match(reason, /Ready work phases: wp-1 \(Backend\)/);
assert.match(reason, /Ready tasks: wp-1\/t-1 \(add endpoint\)/);
assert.match(reason, /Required evidence: npm test green/);
assert.match(reason, new RegExp(`Record progress in: \\.codexclaw/goalplans/${plan.slug}/ledger\\.jsonl`));
assert.match(reason, /cxc orchestrate C --session [-\w]+ --attest/);
assert.match(reason, /D is not a resting state/);
```

040 초안에서 빠지는 `nextTaskTitle`·`dependencyBlockedReason` 단언은 버리지 않고 다음 세 테스트로
이관한다. 첫 테스트는 실행 불가 task가 `readyTasks`에 섞이지 않는지, 둘째는 전역 교착 reason의
글자와 순서, 셋째는 legacy plan의 새 context 전체 shape를 잠근다.

세 테스트는 040의 옛 단언 세 건과 일대일 대응한다. 첫 테스트는 옛 `nextTaskTitle` ready-parent
단언을 두 ready 배열과 `waitingOn`으로 바꾸고, 둘째는 옛 `dependencyBlockedReason` 교착 단언을
빈 ready 배열 둘과 `waitingOn`으로 바꾸며, 셋째는 옛 legacy context golden을 새 다섯 필드 전체
객체로 바꾼다.

```ts
test("wp6: Stop context excludes a task whose dependency is unmet", () => {
  const cwd = freshCwd();
  try {
    const plan = buildGoalplan({ objective: "dependency-aware stop" });
    plan.schemaVersion = 3;
    plan.workPhases = [{
      id: "build",
      title: "Build",
      status: "pending",
      dependsOn: [],
      criteriaIds: [],
      tasks: [
        { id: "blocked", title: "blocked child", status: "pending", dependsOn: ["ready"] },
        { id: "ready", title: "ready parent", status: "pending", dependsOn: [] },
      ],
    }];
    writeGoalplan(cwd, plan);

    const context = readStopWorkContext(cwd, { ...defaultState("stop-deps"), slug: plan.slug });
    assert.deepEqual(context?.readyWorkPhases, [{ id: "build", title: "Build" }]);
    assert.deepEqual(context?.readyTasks, [
      { workPhaseId: "build", id: "ready", title: "ready parent" },
    ]);
    assert.deepEqual(context?.waitingOn, [
      "task build/blocked waits for task build/ready (pending)",
    ]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp6: Stop context exposes deadlock reasons in waitingOn", () => {
  const cwd = freshCwd();
  try {
    const plan = buildGoalplan({ objective: "dependency deadlock" });
    plan.schemaVersion = 3;
    plan.activeWorkPhaseId = null;
    plan.workPhases = [
      {
        id: "wp1", title: "Upstream", status: "blocked", blockedReason: "vendor",
        dependsOn: [], tasks: [], criteriaIds: [],
      },
      {
        id: "wp2", title: "Downstream", status: "pending", dependsOn: ["wp1"],
        tasks: [{ id: "t2", title: "ship", status: "pending", dependsOn: [] }], criteriaIds: [],
      },
    ];
    writeGoalplan(cwd, plan);

    const context = readStopWorkContext(cwd, { ...defaultState("stop-deadlock"), slug: plan.slug });
    assert.deepEqual(context?.readyWorkPhases, []);
    assert.deepEqual(context?.readyTasks, []);
    assert.deepEqual(context?.waitingOn, [
      "work-phase wp1 is blocked (vendor)",
      "work-phase wp2 waits for work-phase wp1 (blocked)",
    ]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp6: legacy plan Stop context uses the ready arrays shape", () => {
  const cwd = freshCwd();
  try {
    const plan = buildGoalplan({
      objective: "legacy stop",
      criteria: [{ scenario: "tests", expectedEvidence: "node --test green" }],
    });
    plan.workPhases = [{
      id: "legacy",
      title: "Legacy",
      status: "in_progress",
      tasks: [{ id: "t-1", title: "first task", status: "pending" }],
      criteriaIds: ["c-1"],
    }];
    writeGoalplan(cwd, plan);

    const context = readStopWorkContext(cwd, { ...defaultState("legacy-stop"), slug: plan.slug });
    assert.deepEqual(context, {
      readyWorkPhases: [{ id: "legacy", title: "Legacy" }],
      readyTasks: [{ workPhaseId: "legacy", id: "t-1", title: "first task" }],
      waitingOn: [],
      expectedEvidence: "node --test green",
      ledgerPath: `.codexclaw/goalplans/${plan.slug}/ledger.jsonl`,
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

```ts
test("wp6: Stop reason lists ready work and partial dependency waits together", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "wp6-ready", status: "active" }], () => {
      const plan = buildGoalplan({
        objective: "Expose dependency-aware Stop guidance",
        criteria: [{ scenario: "Stop shows executable work", expectedEvidence: "node --test green" }],
      });
      plan.schemaVersion = 3;
      plan.activeWorkPhaseId = "wp-live";
      plan.workPhases = [
        {
          id: "wp-base", title: "Base", status: "done", dependsOn: [], criteriaIds: [],
          tasks: [{ id: "base", title: "Base task", status: "done", dependsOn: [], outcome: "base done" }],
        },
        {
          id: "wp-live", title: "Live", status: "in_progress", dependsOn: ["wp-base"], criteriaIds: ["c-1"],
          tasks: [
            { id: "ready", title: "Ready task", status: "pending", dependsOn: [] },
            { id: "blocked", title: "Blocked task", status: "pending", dependsOn: ["later"] },
            { id: "later", title: "Later task", status: "pending", dependsOn: [] },
          ],
        },
        {
          id: "wp-blocked", title: "Blocked phase", status: "pending", dependsOn: ["wp-live"],
          criteriaIds: [], tasks: [],
        },
      ];
      writeGoalplan(cwd, plan);
      writeState(cwd, {
        ...defaultState("wp6-ready"),
        phase: "B",
        orchestrationActive: true,
        lastInjectedPhase: "B",
        slug: plan.slug,
      });

      const context = readStopWorkContext(cwd, readState(cwd, "wp6-ready"));
      assert.ok(context);
      assert.deepEqual(context.waitingOn, [
        "task wp-live/blocked waits for task wp-live/later (pending)",
        "work-phase wp-blocked waits for work-phase wp-live (in_progress)",
      ]);

      const output = handleStop(stop(cwd, "wp6-ready"));
      assert.notEqual(output, "");
      const reason = (JSON.parse(output.trim()) as { reason: string }).reason;
      assert.match(reason, /Ready work phases: wp-live \(Live\)/);
      assert.match(reason, /Ready tasks: wp-live\/ready \(Ready task\); wp-live\/later \(Later task\)/);
      assert.match(
        reason,
        /Waiting on: task wp-live\/blocked waits for task wp-live\/later \(pending\); work-phase wp-blocked waits for work-phase wp-live \(in_progress\)/,
      );
      assert.match(reason, /Required evidence: node --test green/);
      assert.match(reason, /cxc orchestrate C --session wp6-ready --attest/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

`dependencyWaitReasons()`는 ready가 있는 상태에서도 아직 충족되지 않은 phase/task 의존을 선언
순서대로 낸다. 첫 fixture는 ready phase/task와 `Waiting on:`을 함께 표시해 c-5를 닫는다. 이 helper는
blocked 자체를 사유로 만들지 않으므로 전역 교착 때는 `dependencyDeadlock().reasons`를 쓴다. 따라서
ready가 0건이고 `dependsOn`도 없는 단일 blocked phase에서도 `readStopWorkContext()`는 null을
반환하지 않는다.

```ts
test("wp6: Stop reason keeps a single blocked phase when no work is ready", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "wp6-blocked", status: "active" }], () => {
      const plan = buildGoalplan({ objective: "Expose one blocked phase" });
      plan.schemaVersion = 3;
      plan.activeWorkPhaseId = null;
      plan.workPhases = [{
        id: "wp-blocked",
        title: "Blocked phase",
        status: "blocked",
        blockedReason: "vendor release",
        dependsOn: [],
        criteriaIds: [],
        tasks: [],
      }];
      writeGoalplan(cwd, plan);
      writeState(cwd, {
        ...defaultState("wp6-blocked"),
        phase: "B",
        orchestrationActive: true,
        lastInjectedPhase: "B",
        slug: plan.slug,
      });

      const context = readStopWorkContext(cwd, readState(cwd, "wp6-blocked"));
      assert.ok(context);
      assert.deepEqual(context.readyWorkPhases, []);
      assert.deepEqual(context.readyTasks, []);
      assert.deepEqual(context.waitingOn, [
        "work-phase wp-blocked is blocked (vendor release)",
      ]);

      const output = handleStop(stop(cwd, "wp6-blocked"));
      const reason = (JSON.parse(output.trim()) as { reason: string }).reason;
      assert.doesNotMatch(reason, /Ready work phases:|Ready tasks:/);
      assert.match(reason, /Waiting on: work-phase wp-blocked is blocked \(vendor release\)/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

공개 표면 테스트 파일에는 다음 case도 넣는다.

```ts
test("comma dependency is rejected while repeated flags persist dependencies", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const comma = cli(cwd, [
    "add-work-phase", "--session", session, "--id", "wp-new", "--title", "new",
    "--depends-on", "wp-base,wp-live",
  ]);
  assert.equal(comma.code, 1);
  assert.equal(
    comma.output,
    "loop add-work-phase: work phase wp-new depends on unknown work phase 'wp-base,wp-live'",
  );
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  const accepted = cli(cwd, [
    "add-work-phase", "--session", session, "--id", "wp-new", "--title", "new",
    "--depends-on", "wp-base", "--depends-on", "wp-live",
  ]);
  assert.equal(accepted.code, 0);
  assert.deepEqual(readGoalplan(cwd, plan.slug)?.workPhases.at(-1)?.dependsOn, ["wp-base", "wp-live"]);
  assert.match(ledgerText(cwd, plan.slug), /"event":"dependency_registered"/);
});
```

## 변경하지 않는 파일

- `plugins/codexclaw/components/pabcd-state/src/cli.ts`: 기존 loop argv 위임을 쓴다.
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`: `tasks_pending` 거부를 유지한다.
- `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts`: wp3 검증 연결을 쓴다.
- `plugins/codexclaw/components/pabcd-state/src/atomic-write.ts`: wp5 락과 rename 구현을 쓴다.
- `plugins/codexclaw/components/pabcd-state/src/review-round-cli.ts`: 변경 없음.
- `plugins/codexclaw/components/pabcd-state/src/review-observer.ts`: 변경 없음.

### import 적층 감사

§36에 맞춰 이 문서가 손대는 파일의 import를 선행 문서 최종 After에서 다시 확인했다.

| 파일 | import 처분 |
| --- | --- |
| `src/goalplan.ts` | wp5의 `node:fs` After를 보존한다. wp5 추가 이름은 `closeSync`, `fsConstants`, `lstatSync`, `statSync`, `writeSync`이며 wp6 import 추가는 없다. |
| `src/steering.ts` | wp5의 `withGoalplanWriteLock`, `GoalplanWriteLockOptions`를 보존하고 wp6 `goalplanDefinitionIntegrityReasons`, `goalplanDependencyCompletionReasons`를 더한다. 뒤 이름은 감사 라운드 1 High가 요구한 completion 검사가 쓴다. |
| `src/goalplan-cli.ts` | wp2 `readGoalplanDetailed`, wp3 두 integrity helper, wp5 `goalplanWriteLockStatus`, `withGoalplanWriteLock`, `GoalplanWriteLockStatus`를 보존하고 wp6 공개 lifecycle 이름을 더한다. |
| `src/hook.ts` | wp4 `dependencyDeadlock`, `effectiveActiveWorkPhaseId`와 wp5 fs/path/ledger/recovery 이름, `goalplanDefinitionIntegrityReasons`, `goalplanDependencyCompletionReasons`, `withGoalplanWriteLock`, `closeFixedWorkPhase`, 그리고 §53 공유 판정 `absentSuccessorDetail`·`resumeAbsentTarget`을 모두 보존하고 wp6 `dependencyWaitReasons`·`readyWorkPhases`·`readyTasks`를 더한다. 뒤 두 이름은 채팅 D-close의 대상 부재 복구 경로가 쓰므로 빠지면 `TS2304`와 `ReferenceError`가 난다. |
| `test/goalplan-public-surface.test.ts` | wp6 신규 파일 전체 import다. 선행 wp 추가 이름은 없다. |
| `test/goalplan.test.ts` | wp2 `readGoalplanDetailed`, `effectiveSchemaVersion`과 wp4 `dependencyDeadlock`을 보존하고 wp6 `goalplanWriteLockDir`를 더한다. |
| `test/help-verbs.test.ts` | import 변경 없음. |
| `test/steering.test.ts` | import 변경 없음. |
| `test/hook-continuation.test.ts` | import 변경 없음. |
| `skills/loop/SKILL.md`, `dist/*.js` | import 명세를 직접 편집하지 않는다. |

## 검증

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/steering.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts
node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts
```

각 focused test 기대값은 exit 0, fail 0이다. import와 공개 경로의 실행 자립성 게이트는
`goalplan-public-surface.test.ts`, `goalplan.test.ts`, `hook-continuation.test.ts`의 focused 실행이다.
세 테스트는 각각 새 CLI 공개 경로, 누적 import를 쓰는 goalplan API, 새 Stop context 소비를 실제
호출한다.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
fixture_cwd="$(mktemp -d)"
trap 'rm -rf "$fixture_cwd"' EXIT

node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop init --objective "wp6 executable fixture" --session sess-ready --criterion "public surface verified" --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop add-work-phase --session sess-ready --id wp2 --title "public surface" --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop add-task --session sess-ready --work-phase wp2 --id t-1 --title "first task" --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop complete-task --session sess-ready --work-phase wp2 --id t-1 --outcome "first task passed" --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop add-task --session sess-ready --work-phase wp2 --id t-2 --title "second task" --depends-on t-1 --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop ready --session sess-ready --json --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop complete-task --session sess-ready --work-phase wp2 --id t-2 --outcome "node --test: 24 pass" --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop meet-criterion --session sess-ready --id c-1 --evidence "node --test: 24 pass" --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop show --session sess-ready --cwd "$fixture_cwd"
node --experimental-strip-types plugins/codexclaw/components/pabcd-state/src/cli.ts loop --help

node --input-type=module - "$fixture_cwd" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.argv[2];
const planPath = join(cwd, ".codexclaw", "goalplans", "wp6-executable-fixture", "goalplan.json");
const ledgerPath = join(cwd, ".codexclaw", "goalplans", "wp6-executable-fixture", "ledger.jsonl");
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const task = plan.workPhases.find((phase) => phase.id === "wp2").tasks.find((item) => item.id === "t-2");
const criterion = plan.criteria.find((item) => item.id === "c-1");
const ledger = readFileSync(ledgerPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
assert.deepEqual({ status: task.status, outcome: task.outcome }, {
  status: "done",
  outcome: "node --test: 24 pass",
});
assert.equal(criterion.status, "met");
assert.equal(criterion.capturedEvidence, "node --test: 24 pass");
assert.ok(ledger.some((entry) => entry.event === "task_done" && entry.detail === "node --test: 24 pass"));
NODE

rm -rf "$fixture_cwd"
trap - EXIT
```

블록 전체 기대값은 exit 0이다. 저장 plan의 `t-2.status`는 `done`, `t-2.outcome`은
`node --test: 24 pass`, `c-1.status`는 `met`이다. 원장의 `task_done.detail`도
`node --test: 24 pass`다. help에는 `ready --json`, `add-task`, `complete-task --outcome`,
`meet-criterion --evidence`, 반복 `--depends-on` 문법이 모두 보인다.

### 락 임계 구역 AST oracle 갱신 — wp5 §10.5 소유권 인계

감사 라운드 1 BLOCKER: wp5 §10.5의 감사는 `writeGoalplan()` 호출 수를 하드코딩으로 고정한다. wp6의
`commitLifecycle()`이 락 callback 안에 write를 하나 더하므로 그 기대값이 확정 실패한다.

```text
wp5 현재:  total 8, unlocked init 1, locked 7
wp6 적용:  total 9, unlocked init 1, locked 8
```

`050_wp5_write_serialization.md` §10.5의 네 단언을 아래로 갱신하는 것은 이 문서가 맡는다. 구조 조건
(`goalplan-cli.ts` init만 락 밖, 나머지는 전부 `withGoalplanWriteLock()`의 세 번째 인자 callback 안)은
그대로 두고 개수만 옮긴다. 개수를 지우고 구조 조건만 남기지 않는다 — 개수가 없으면 mutation 하나가
조용히 락 밖으로 새는 것을 못 잡는다.

```bash
assert.equal(calls.length, 9, JSON.stringify(calls));
assert.equal(initCalls.length, 1, JSON.stringify(calls));
assert.deepEqual(escapedMutations, [], JSON.stringify(escapedMutations));
assert.equal(lockedMutations.length, 8, JSON.stringify(calls));
```

`add-work-phase`와 `add-criterion`은 `applySteeringBatch()`를 지나므로 새 write를 만들지 않는다.
`add-task`, `complete-task`, `meet-criterion` 셋도 `commitLifecycle()` 하나를 공유하므로 늘어나는
호출은 정확히 하나다.

focused 검증이 모두 끝난 뒤 아래 순서로 저장소 게이트를 실행한다.

```bash
npm run build
npm test
npm run gate
```

세 명령 기대값은 차례대로 exit 0이다. `npm run build`가 변경한 네 `src/*.ts`와 같은 basename의
tracked `dist/*.js`를 먼저 갱신한다. 그 다음 `npm test`가 dist byte equality를 포함해 fail 0으로
끝나고, 마지막 `npm run gate`가 exit 0으로 끝난다. build는 타입·import 오류를 검출하는 근거가
아니며 배포 파일 생성과 manifest 검사만 맡는다.

### 미해석 식별자 게이트 — focused보다 먼저

감사 라운드 1 High: 계약 §37 W5의 첫 단계가 빠져 있었다. `--experimental-strip-types`와
`npm run build`는 타입을 지우고 컴파일하므로 import 누락이나 type-only 오류를 잡지 못한다. 실제로
이 라운드의 BLOCKER — hook `import`에서 `absentSuccessorDetail`·`resumeAbsentTarget`이 사라진 것 —
는 focused 스위트를 통과하고 런타임 `ReferenceError`로만 드러난다.

wp5가 `050_wp5_write_serialization.md` §10.7에 만든 게이트를 그대로 먼저 실행한다. wp6은 새 게이트를
만들지 않고 baseline fixture `test/fixtures/tsc-diagnostic-baseline.txt`를 재사용한다. wp6이 만드는
신규 파일 `test/goalplan-public-surface.test.ts`도 root에 포함되므로 새 진단은 신규 fingerprint로
잡힌다. wp6 변경으로 선행 진단이 사라지면 `comm -13`이 신규만 보므로 게이트가 막지 않는다.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
pab=plugins/codexclaw/components/pabcd-state
test -f "$pab/test/fixtures/tsc-diagnostic-baseline.txt"
gate_tmp="$(mktemp -d)"
trap 'rm -rf "$gate_tmp"' EXIT
tsc_log="$gate_tmp/tsc.log"
set +e
node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --module nodenext \
  --target es2023 --moduleResolution nodenext --skipLibCheck --types node \
  "$pab"/src/*.ts "$pab"/test/*.ts > "$tsc_log" 2>&1
tsc_status=$?
set -e
test "$tsc_status" -eq 0 -o "$tsc_status" -eq 2
rg '^[^ ].*: error TS[0-9]+:' "$tsc_log" \
  | sed -E 's/\(([0-9]+),([0-9]+)\)//' \
  | sort -u > "$gate_tmp/fingerprints.txt"
comm -13 "$pab/test/fixtures/tsc-diagnostic-baseline.txt" "$gate_tmp/fingerprints.txt" > "$gate_tmp/novel.txt"
if test -s "$gate_tmp/novel.txt"; then
  echo 'new tsc diagnostics appeared:' >&2
  cat "$gate_tmp/novel.txt" >&2
  exit 1
fi
```

기대값은 exit 0이고 신규 fingerprint 0건이다. `tsc` 종료 코드는 선행 부채 때문에 0 또는 2다.

### 담당 문서 추적 검사

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
doc=devlog/_plan/260829_goalplan-dependency-execution/060_wp6_public_surface.md
test -f "$doc"
git ls-files --error-unmatch "$doc" >/dev/null
! git status --porcelain -- "$doc" | rg -q '^\?\? '
git diff --check -- "$doc"
```

감사 라운드 1 Medium: 이 문서는 이미 tracked이므로 `?? …060….md` 기대는 거짓이었다. 그리고
`git diff --no-index /dev/null <문서>`는 내용과 무관하게 항상 exit 1이라 `test "$status" -eq 1`이
아무것도 검증하지 않는 false-green이었다. wp5 §10.6과 같은 형태로 바꿨다 — `git ls-files`가 추적을,
`git diff --check`가 공백 오류를 실제로 판정한다.

## 완료 조건

- 공개 API 이름은 정본 §2와 같다.
- `readyTasks()`는 phase runnable 여부와 같은 phase의 task 의존을 모두 검사한다.
- task id 중복은 같은 phase 안에서만 거부한다.
- work phase와 task의 `--depends-on`은 반복 지정하며 콤마 문자열을 분해하지 않는다.
- `ready --session`은 `resolveSlug()`보다 먼저 canonical session id를 검사해 `a/b`가 `a-b`의
  goalplan을 읽거나 출력하지 못한다.
- 의존 없는 `add-work-phase`는 업그레이드 전 summary와 idempotency key를 그대로 써서 기존
  `steeringLog`가 있으면 duplicate no-op으로 끝난다. 의존이 있을 때만 `dependsOn=` suffix를 붙인다.
- add-task는 같은 phase의 기존 task 의존만 저장하고 다른 phase·자기 자신·콤마 참조를 wp3 정본
  문자열로 거부한다.
- 빈 outcome은 code 1이며 plan과 원장을 바꾸지 않는다.
- outcome은 권위 필드와 `task_done.detail`에 같은 trim 문자열로 남는다.
- done task 재실행은 plan write와 append를 모두 생략한다.
- 모든 쓰기는 wp5 공통 락 안에서 최신 plan을 읽고 처리한다.
- 새 event는 성공한 `dependency_registered` 하나다.
- steering `add-work-phase.dependsOn`은 optional이고 기존 의존 없는 fixture가 그대로 통과한다.
- steering 공개 mutation은 op마다 임시 plan의 integrity를 검사하고 성공하면 다음 op로 이어간다.
  `[wp-a, wp-b dependsOn wp-a]`의 두 phase를 모두 저장하며 forward 참조는 dangling으로 거부한다.
- lifecycle plan commit 뒤 원장 append가 실패하면 권위 상태를 유지하고 code 0과 경고를 반환한다.
- Stop 안내는 ready work phase와 ready task를 실제 `reason`에 싣는다.
  `dependencyWaitReasons(plan)`의 부분 대기 사유도 `Waiting on:`에 그대로 실어 ready와 함께 표시한다.
  전역 교착은 `dependencyDeadlock().reasons`를 우선해 ready가 0건인 단일 blocked phase도 wp4 사유를
  잃지 않고 context를 반환한다.
- `cxc loop show`는 락 디렉터리 절대 경로와 존재 시 나이를 표시한다. wp5의 락 상태 helper는
  네 번째 `stat` seam을 보존하고 `existsSync()`와 `stat(path)` 사이 ENOENT를 absent로 정규화한다.
- help 전체 After는 `steer`, `add-work-phase`, `add-criterion`에서 `--slug <slug>`를 지운다. 세 verb는 세션 바인딩 slug만 읽으므로 그 인자가 실행되지 않는 문법이었다. `show`·`validate`·`ready`는 `resolveSlug()`로 실제 인자를 쓰므로 그대로 둔다.
- `plugins/codexclaw/skills/loop/SKILL.md`가 스키마, CLI 동사, event, phase-local task 의존을 안내한다.
- 공개 lifecycle 뒤에도 pending task D-close 거부가 유지된다.

DONE: 060_wp6_public_surface.md — W1 hook import 적층, W5 dist manifest·검증 순서, no-index 종료 코드 정규화
