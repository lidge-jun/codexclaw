# 005 — 계약 정본 (A 감사 라운드 2 반영)

독립 감사가 두 라운드 모두 fail을 냈다. 라운드 1은 decade 문서를 병렬로 쓰다가 phase 사이
이름·범위·의미가 어긋난 것이 원인이었고, 라운드 2는 이 정본만 고치고 실제 PRD 본문을 안 고쳐서
blocker가 닫히지 않은 것이 원인이었다. 이 문서가 wp2~wp7의 **단일 정본**이며 decade 문서와
충돌하면 이 문서가 이긴다. 각 decade 문서를 고치는 작업자는 이 문서 전문을 먼저 읽는다.

## 0. 감사 blocker 대장

| # | 라운드 | 지적 | 처분 |
| --- | --- | --- | --- |
| B1 | 1 | task 의존 권위 범위가 wp3(phase-local)·wp4(전역 flatMap)·wp6(미검사) 3중 불일치 | §1 phase-local 고정 |
| B2 | 1 | complete-task가 증거 없이 done을 만들어 D-close 게이트 뒷문 | §4 outcome 필수 |
| B3 | 1 | `dependency_rejected` 원장 append가 "잘못된 정의는 상태를 만들지 않는다" 위반 | §5 거부 이벤트 제거 |
| B4 | 1 | wp6이 존재하지 않는 `add-dependency` op를 전제 | §3 범위 밖 |
| B5 | 1 | 자동 stale-lock 회수에 fencing 경쟁 | §6 자동 회수 제거 |
| B6 | 1 | 공개 mutation이 공통 락보다 먼저 와서 lost update 노출 | §7 순서 wp5 락 → wp6 표면 |
| B7 | 1 | API 이름·호환 의미·인용·legacy 1건 불일치 | §2, §8, §9 |
| R2-1 | 2 | outcome 최소안(원장 detail만)은 원장 append가 plan commit과 원자적이지 않아 증거 소실 | §4 `GoalplanTask.outcome` 권위 필드로 확정 |
| R2-2 | 2 | §4가 outcome 결정을 wp5에 위임했으나 §7에서 wp5는 락, lifecycle은 wp6 | §4·§7 결정 소유 phase 명시 |
| R2-3 | 2 | fail-open 의미가 뭉개져 락 실패 시 기록만 버리고 D-close 진행 | §11 operation fail-closed / hook process fail-open 이분 |
| R2-4 | 2 | `020_wp2:790` verifier가 존재하지 않는 `010_phase2_schema_v3.md`를 검사하는 false-green | §14 파일명 정본 + verifier 경로 갱신 |
| R2-5 | 2 | §10의 "테스트 본문은 후속 P에서" 는 DIFFLEVEL-ROADMAP-01 오독 | §10 폐기, 지금 본문까지 채운다 |

## 1. task 의존은 phase-local이다 (B1)

실측 근거: 디스크 89개 plan 중 `codexclaw-hitl-1-lazycodex-omo-oh-my-openagent-n`이 phase 간
중복 task id `t1, t2, t3`을 갖고 있다. 전역 flatMap 조회는 잘못된 phase의 상태를 읽는다.

확정 계약:

- task id는 **소속 work phase 안에서만** 유일하다. plan 전역 유일을 요구하지 않으며, 요구하는
  문장은 삭제한다.
- `task.dependsOn`의 원소는 **같은 work phase의 task id**만 가리킨다. phase를 넘는 task 의존은 없다.
- 의존 판정 helper는 owning phase를 인자로 받는다. 전역 배열을 만들지 않는다.
- phase 간 의존은 `workPhase.dependsOn`으로만 표현한다.

시그니처 고정:

```ts
// 같은 phase 안에서만 조회한다. 전역 flatMap 금지.
function taskDependenciesMet(phase: GoalplanWorkPhase, task: GoalplanTask): boolean;
function workPhaseDependenciesMet(plan: Goalplan, phase: GoalplanWorkPhase): boolean;
```

wp6의 `readyTasks()`는 소속 phase가 runnable인지만 보지 않고 `task.dependsOn`을 **반드시**
검사한다. wp4가 정한 의미와 같아야 한다.

## 2. 공개 API 이름 (B7)

wp3이 내보내고 wp4~wp7이 그대로 쓴다. 다른 이름을 만들지 않는다.

```ts
// wp3 신설
export function goalplanDefinitionIntegrityReasons(plan: Goalplan): string[];
export function goalplanDependencyCompletionReasons(plan: Goalplan): string[];

// wp4 변경 (내부 helper는 §1 시그니처)
export function effectiveActiveWorkPhaseId(plan: Goalplan): string | null;

// wp6 신설
export function readyWorkPhases(plan: Goalplan): GoalplanWorkPhase[];
export function readyTasks(plan: Goalplan): Array<{ workPhaseId: string; task: GoalplanTask }>;
```

`goalplanDependencyErrors()`는 존재하지 않는다. 그 이름을 import하는 문장은 정본 이름으로 고친다.

## 3. 의존 등록 입구는 한 곳이다 (B4)

- `cxc loop add-work-phase --depends-on <id>`를 **반복 지정**한다. 콤마 구분 문법은 채택하지
  않는다. `--depends-on a,b`는 id `a,b` 하나로 읽혀 참조 무결성에서 거부된다.
- steering `add-work-phase` op에 `dependsOn?: string[]`을 추가한다.
- **기존 phase의 의존을 사후 편집하는 연산(`add-dependency` 등)은 이번 goal 범위 밖이다.**
  진행 중 phase의 의존을 바꾸면 downstream 재판정·멱등성·무효화 규칙이 필요한데 설계되지 않았다.
  필요성이 실증되면 별도 goal로 올린다. 이 이름을 전제하는 문장·코드·테스트는 전부 삭제한다.
- 등록 입구는 wp3 검증을 통과하지 못하면 상태를 만들지 않는다.

## 4. 완료 증거 경계 (B2, R2-1, R2-2)

"완료는 검증 가능한 증거와 함께만 인정한다"를 두 층으로 나눈다.

- **criterion**: `meet-criterion --evidence <text>` 필수. 공백은 거부한다. `capturedEvidence`에
  저장되며 validateGoalplan이 이미 공백 met을 실패로 본다.
- **task**: `complete-task --outcome <text>` 필수. 공백은 거부한다.

**outcome은 권위 상태에 저장한다.** `GoalplanTask.outcome?: string`을 wp2 스키마에서 신설하고
wp6 lifecycle이 채운다. 원장 detail 기록만 두는 최소안은 **채택하지 않는다.** 근거: 원장 append와
plan commit이 한 개의 원자적 rename이 아니다(`goalplan.ts`의 write와 `appendGoalplanLedger`는
별개 호출). 원장 append가 실패하거나 원장이 잘려도 plan에는 `done`만 남아 증거가 소실되고,
"완료는 증거와 함께만"이 무너진다. 권위 필드에 두면 상태와 증거가 같은 rename에 실려 함께 커밋된다.

- 저장 형식: `outcome`은 trim 후 비어 있지 않은 문자열. `status === "done"`인 task는 outcome이
  있어야 하고, `pending` task는 outcome을 갖지 않는다.
- 검증: wp3의 `goalplanDefinitionIntegrityReasons()`가 "done인데 outcome 없음"과 "pending인데
  outcome 있음"을 각각 사유로 낸다. **단 legacy 하위 호환 예외**: 이번 변경 이전에 done이 된
  task는 outcome이 없다. 따라서 검증은 `schemaVersion >= 3` plan에만 적용한다. 이는 §8의
  "버전으로 실행 의미를 분기하지 않는다"와 충돌하지 않는다. 실행 선택이 아니라 **저장 검증
  경계**이기 때문이다.
- 원장에는 `task_done` 이벤트의 `detail`로 같은 문자열을 함께 남긴다. 원장은 역사이고 권위가
  아니므로 여기서 소실되어도 상태는 온전하다.
- D-close의 pending task 거부 게이트는 그대로 둔다. complete-task는 게이트 우회 통로가 아니라
  게이트가 요구하는 일을 기록하는 지원된 방법이다.

**결정 소유**: outcome의 스키마 필드·reviver 보존은 **wp2**, 무결성 검증은 **wp3**, CLI 인자와
lifecycle 기록은 **wp6**이 소유한다. wp5는 락만 다루며 outcome 결정을 하지 않는다. 라운드 1
정본이 이 결정을 "wp5에서 결정"이라고 쓴 것은 파일 재번호화 이전의 문장이며 무효다.

## 5. 거부는 아무것도 쓰지 않는다 (B3)

최소 불변식 1번("유효하지 않은 정의는 상태를 하나도 만들지 않는다")이 원장에도 적용된다.

- 의존 검증 실패, outcome 누락, 증거 공백 등 **모든 거부는 goalplan.json과 ledger.jsonl을
  한 바이트도 바꾸지 않는다.**
- `dependency_rejected` 이벤트는 채택하지 않는다. 이 이름이 나오는 타입 union, append 호출,
  테스트는 전부 삭제한다. 거부는 종료 코드와 stderr 메시지로만 보고한다.
- 원장에 추가하는 이벤트는 성공한 변경만이다. 새 이벤트는 `dependency_registered` 하나이며,
  실제로 의존이 저장된 경우에만 붙는다.

## 6. 락은 자동 회수하지 않는다 (B5)

감사가 지적한 경쟁이 실재한다. 두 회수자가 같은 죽은 소유자를 확인한 뒤 하나가 디렉터리를
지우고 새 writer가 획득하면, 다른 회수자의 재귀 삭제가 살아 있는 락을 지운다. token 확인과
삭제가 원자적이지 않기 때문이다.

확정 계약:

- 획득은 `mkdirSync(lockDir, {recursive:false})` 하나뿐이다.
- 획득 후 goalplan을 **락 안에서 다시 읽는다.** 락 밖 스냅샷을 쓰지 않는다.
- goalplan.json 커밋과 그로 인한 원장 append를 같은 임계 구역에서 한다.
- 대기 상한 75ms(5+10+20+40). 초과하면 **자동 회수 없이 실패**하고, 오류 메시지가 락 경로와
  수동 정리 방법을 알린다. 기존 `.steer.lock`도 stale 자동 회수가 없어 관례와 일관된다.
- `reapDeadGoalplanLock()`, PID 생존 판정, hostname 비교, token fencing, quarantine rename,
  heartbeat를 넣지 않는다. 이 이름을 쓰는 함수와 회수 테스트는 전부 삭제한다. 003의 과잉 판정과
  일치한다. `owner.json`은 진단 표시용으로만 남기고 판정 입력으로 쓰지 않는다.
- 읽기 경로는 락을 잡지 않는다. `readGoalplan()`은 계속 throw하지 않고 null을 반환한다.

## 7. phase 순서와 결정 소유 (B6, R2-2)

공개 mutation이 공통 락보다 먼저 오면 그 사이 기간의 데이터가 안전하지 않다. 락이 먼저다.

| wp | 문서 | 내용 | 이 wp가 소유하는 결정 |
| --- | --- | --- | --- |
| wp1 | 010_wp1_roadmap.md | 로드맵 (완료) | 슬라이스 경계 |
| wp2 | 020_wp2_schema_v3.md | 스키마 v3 저장·복원·버전 경계 | `dependsOn`·`outcome` 필드 정의와 reviver 보존 |
| wp3 | 030_wp3_integrity.md | 순수 무결성 검증 + validateGoalplan/goal-gate 연동 | 무결성 사유 문구, DAG 검출, outcome 검증 |
| wp4 | 040_wp4_dependency_aware.md | 의존 인식 선택 (순수 함수) | ready 판정 의미, 순회 방향 |
| wp5 | 050_wp5_write_serialization.md | 공통 락과 RMW 직렬화 | 임계 구역 경계, 대기 정책, fail 의미 |
| wp6 | 060_wp6_public_surface.md | 공개 표면: 등록·조회·lifecycle | CLI 인자, 원장 이벤트, 멱등성 |
| wp7 | 070_wp7_regression.md | 회귀 확정 | fixture corpus, 동등성 oracle |

wp3의 `add-work-phase --depends-on` 입구도 wp6으로 옮긴다. wp3는 순수 검증 함수와 기존
validateGoalplan 연동까지만 한다. 새 mutation 입구는 락이 선 다음에만 열린다.

goalplan의 wp 제목은 이 순서로 steering annotate를 남겨 갱신한다(기존 id는 바꾸지 않는다).

## 8. 하위 호환은 필드 기반이다 (B7)

- `dependsOn`이 `undefined`거나 `[]`이면 "의존 없음"이고 동작이 동일하다. 둘을 구분하지 않는다.
- **선택 로직을 `schemaVersion`으로 분기하지 않는다.** `const dependencyAware = plan.schemaVersion === 3`
  같은 가드를 두지 않는다. 버전은 저장·검증 경계이고 실행 의미가 아니다.
- 이유: v3 plan에도 의존 없는 항목이 대부분이고, 버전 분기는 같은 데이터에 두 가지 실행 의미를
  만든다. 의존이 없으면 새 알고리즘이 기존 순차 결과와 동일해야 하며, 그것을 테스트로 증명한다.
- §4의 outcome 검증만 예외적으로 버전 경계를 쓴다. 이는 **검증**이고 선택이 아니다.
- v1/v2 회귀 테스트는 "의존 필드가 없는 plan의 선택 결과가 변경 전후 동일"을 증명한다.

## 9. legacy plan 1건과 인용 정정 (B7)

실측: 89개 중 `opaque-surface-gradient-discipline-3-lane-gpt-5`가 `criteria[].text`를 쓰는
legacy 형식이라 현재 reviver가 거부한다. **이번 작업이 만든 회귀가 아니라 기존 상태다.**

처분: wp7의 회귀 기준은 "89/89 파싱"이 아니라 "**이번 변경 전후의 파싱 결과 집합이 동일**"이다.
기존에 실패하던 1건은 계속 실패해도 통과다. legacy `text` 읽기 호환 추가는 별도 관심사이며
범위 밖이다. **wp2에 backpatch를 요구하는 문장은 삭제한다.**

인용 정정(감사 확인, 본체 재검증):

- `atomic-write.ts:14`는 import다. 재시도 상수는 `:16`, 실행은 `:38`.
- `firstInvalidField()`는 `goalplan.ts:594`부터(`:568`은 reviver 호출).
- `created` producer는 `goalplan-cli.ts:341`부터.
- `steered` producer는 `steering.ts:316`부터, 생성 shape는 `:242`, write는 `:313`.
- review ignored producer는 `review-observer.ts:123`부터.
- stale-round write는 `orchestrate-cli.ts:734`, append는 `:736`.
- D-close pending 거부는 `orchestrate-cli.ts:633`부터(`:632`는 advance 호출).
- 채팅 D-close advance는 `hook.ts:839`, write는 `:898`.
- goal-gate read는 `goal-gate.ts:271`, validation은 `:276`.
- 003의 `recovery.ts:422`는 listRunRecords 선언이며 checkpoint 정의 포함 근거는 `manager.ts:346`.
- 훅 동시 실행 근거는 `dispatcher.rs:124~156`(`:123`은 선언부).
- 동시 spawn 기본값은 `core/src/config/mod.rs:229`(`:228` 아님).

## 10. diff-level 부채는 지금 갚는다 (R2-5)

라운드 1 정본은 "테스트 본문은 각 구현 사이클의 P에서 채운다"고 썼다. **이는
DIFFLEVEL-ROADMAP-01 오독이며 폐기한다.** 스킬 원문은 첫 P가 "every phase's decade doc written
to full diff-level precision — each one a copy-paste-executable PRD"를 내놓아야 하고,
"Scaffolding empty decade files to fill per cycle does NOT satisfy this rule"를 명시 금지한다.
후속 사이클 P의 역할은 "채우기"가 아니라 **stale check와 amend**다.

따라서 이 P를 닫기 전에 wp2~wp7 문서의 테스트가 이름과 `...`만 남은 곳을 **본문까지 채운다.**
채울 때 지켜야 할 최소선:

- 각 테스트는 arrange(입력 fixture) / act(호출) / assert(구체 기대값)를 실제 코드로 적는다.
- 조건 분기를 추가하는 테스트는 활성 시나리오를 명시한다(C-ACTIVATION-GROUNDING-01).
- 기대값에 "적절히", "정상적으로" 같은 서술을 쓰지 않는다. 문자열·상태·종료 코드를 적는다.

## 11. fail 의미는 두 종류다 (R2-3, 006 §4)

라운드 1 정본의 "락 획득 실패도 fail-open"은 층을 뭉갰다. 분리한다.

**operation fail-closed** — goalplan 상태를 바꾸려는 연산(CLI lifecycle, steering apply, D-close
plan commit)이 락을 못 잡으면 **그 연산은 실패한다.** 종료 코드가 0이 아니고, plan과 원장은
그대로다. 특히 D-close는 락 실패 시 **전이를 진행하지 않는다.** 기록만 버리고 phase를 넘기면
"게이트가 통과했다는 상태"와 "그 근거가 기록되지 않았다"가 어긋나 라운드 1이 잡은 불일치가
재발한다.

**hook process fail-open** — 훅 프로세스 자체는 호스트 관례대로 세션을 막지 않는다. 락을 못
잡은 훅은 0이 아닌 코드로 죽지 않고, 자기가 하려던 **부수적 기록만 포기하고** 사람이 읽는
경고를 낸다. 호스트 기준: 훅 기본 타임아웃 600초이고 설정으로 줄여도 최소 1초
(`hooks/src/engine/discovery.rs:727`)이므로 75ms 대기는 최소 예산의 7.5%로 안전하다.
동기 훅들은 `FuturesUnordered`로 **동시 실행**되므로(`dispatcher.rs:124~156`) 락 경합은 실전이다.

**락 실패는 Stop block 사유가 아니다.** Stop block 반복 상한이 호스트에 없어
(`core/src/session/turn.rs:505`) 락 실패가 블록 사유가 되면 무한 반복을 호스트가 막아주지 않는다.

경계 규칙: 훅이 상태 전이를 대행하는 경로(`hook.ts`의 채팅 D-close)는 **부수 기록이 아니라
연산이다.** 따라서 fail-closed를 적용해 전이를 하지 않고, 훅 프로세스는 그래도 0으로 끝나며
사용자에게 "D-close를 적용하지 못했다"를 알린다.

## 12. 실행 드라이버를 만들지 않는다 (006 §2)

호스트는 goal이 active인 동안 스레드가 idle이 되면 continuation steering으로 **새 턴을 자동
생성한다**(`ext/goal/src/extension.rs:148`, `runtime.rs:363`). 호스트가 이미 continuation
드라이버다. Stop 훅은 턴 생성기가 아니라 **같은 턴 안의 guard**다.

goalplan이 하는 것: 의존 그래프 저장·검증, 실행 가능 항목 계산과 보고, 상태 전이 기록과 증거 결박.

하지 않는 것:

- 큐를 돌며 다음 항목을 자동 착수하는 루프
- 턴 생성이나 재시작 유발
- 동시 실행 상한 관리. 호스트가 `max_concurrent_threads_per_session` 기본 4(현재 에이전트 포함,
  실질 자식 3)로 이미 제한한다(`core/src/config/mod.rs:229`). ready 목록이 10개여도 실제 병렬도는
  호스트가 정한다. 우리는 **ready/dependency 판정의 정확성**만 보장한다.

이것이 claim/lease를 범위 밖으로 둔 근거를 강화한다.

## 13. 호스트와 중복 아님이 확인됨 (006 §3)

호스트 `agent-graph-store`는 스레드 spawn 계보를 저장한다. 노드가 ThreadId, 엣지가 "A가 B를
spawn했다", 자식당 부모 1개, 상태는 open/closed 2종, 사이클 검출 없음
(`agent-graph-store/src/lib.rs:1`, `state/migrations/0021_thread_spawn_edges.sql:1`).

우리 `dependsOn`은 노드가 계획 단위, 엣지가 "B 전에 A가 충족돼야 한다", 다중 선행 필수,
실행 전에도 존재. **다른 층이므로 중복이 아니다.**

호스트 goal에 task/criterion/dependency/evidence/phase가 하나도 없다는 점도 확인했다
(`state/src/model/thread_goal.rs:60`). goalplan이 그 구조를 소유하는 것이 맞다.

## 14. 문서 파일명 정본과 verifier 경로 (R2-4)

이 유닛의 파일은 아래가 전부다. 다른 이름을 인용하거나 검사하는 문장은 false-green이므로 고친다.

```
000_plan.md  001_goalplan_anatomy.md  002_blast_radius.md  003_dag_lessons.md
004_execution_owner.md  005_contract.md  006_host_runtime.md
010_wp1_roadmap.md  020_wp2_schema_v3.md  030_wp3_integrity.md
040_wp4_dependency_aware.md  050_wp5_write_serialization.md
060_wp6_public_surface.md  070_wp7_regression.md
```

존재하지 않는 이름: `010_phase1.md`, `010_phase2_schema_v3.md`, `030_phase4*.md`,
`040_phase5*.md`, `050_phase6*.md`, `060_phase7*.md`. 각 decade 문서는 다음을 모두 고친다.

- 문서 첫 줄 제목의 번호와 wp 번호를 §7 표에 맞춘다. 예: `040_wp4` 문서의 제목이 `# 030 — wp4`인
  것은 오류다.
- "선행 조건" 줄의 참조 파일명을 위 목록의 실제 이름으로 바꾼다.
- 본문의 "wp5 범위" / "wp6 범위" 서술을 §7 표의 새 소유로 바꾼다. 락은 wp5, 공개 표면은 wp6이다.
- `git diff --check` / `git diff --name-only` 같은 verifier 명령의 문서 경로 인자를 실제
  파일명으로 바꾼다. 존재하지 않는 경로는 git이 조용히 무시해 검사가 통과한 것처럼 보인다.


## 15. diff는 적층된다 (라운드 3 Critical/High)

두 리뷰어가 독립적으로 같은 구조 결함을 짚었다. 각 decade 문서가 **현재 HEAD를 Before로** 써서
선행 wp의 After를 덮어쓴다. 문서를 순서대로 적용하면 앞 phase의 변경이 지워진다.

확정 계약:

- **각 decade 문서의 Before는 "선행 wp가 모두 적용된 뒤의 코드"다.** 현재 HEAD가 아니다.
  Before 블록 머리에 `// wp2 적용 후 상태`처럼 기준을 적는다.
- 선행 wp가 이미 그 함수를 고쳤다면, After는 선행 변경을 **보존한 채** 자기 변경을 덧붙인다.
- 확인된 적층 충돌과 처분:

| # | 충돌 | 처분 |
| --- | --- | --- |
| S1 | 030의 `validateGoalplan()` After가 020이 넣은 미래 버전(v4) 거부 가드를 지운다 | 030 Before를 wp2 적용 후로 갱신하고, After에 버전 가드를 남긴 뒤 integrity 사유를 그 뒤에 붙인다 |
| S2 | 050의 D-close After가 040이 넣은 `dependencyDeadlock()` 안내를 옛 문자열로 되돌린다 | 050 After는 040 문구를 유지하고 락 실패 분기만 추가한다. CLI와 hook 양쪽 모두 |
| S3 | 050 §6이 `completeTask()`/`{kind:"ok"}`를 호출한다 | 060의 `completeGoalplanTask()`와 `changed｜unchanged｜rejected` 결과로 교체하거나, 함수명을 빼고 락 순서만 남긴다 |
| S4 | 050이 본문 없는 `renderOpenPacket()`을 호출한다 | 실제 함수명으로 고치거나 before/after에 본문을 포함한다 |
| S5 | 030의 verifier `! rg 'flatMap\(.*tasks'`가 060의 `readyWorkPhases(plan).flatMap((wp) => wp.tasks)`를 거짓 실패시킨다 | 030 grep 패턴을 `plan\.workPhases\.flatMap` 한정으로 좁힌다. 금지 대상은 **plan 전역 flatMap**이고 ready 목록 평탄화는 허용이다 |

## 16. 사유 문자열은 030이 정본이다 (라운드 3 High)

같은 사유를 두 문서가 다르게 적어 테스트가 확정 실패한다. **`030_wp3_integrity.md`가 모든
무결성·의존 사유 문자열의 정본**이며 다른 문서는 그 문자열을 그대로 인용한다.

확정 문자열(030 본문 기준):

```
work phase <id> depends on unknown work phase '<dep>'
work phase <id> depends on itself
work phase <id> has duplicate task id '<id>', so task dependency references are ambiguous
task <phase>/<task> depends on unknown task '<dep>' in the same work phase
task <phase>/<task> depends on itself
task <phase>/<task> is pending but has outcome
duplicate work phase id '<id>' makes dependency references ambiguous
work phase <id> references unknown criterion '<id>'
```

- 070의 `pending but already has outcome`은 오류다. `pending but has outcome`으로 고친다.
- 060의 콤마 거부 테스트는 `work phase 'wp-base,wp-live' does not exist`를 기대하는데 존재하지
  않는 문구다. 실제 경로는 030의 dangling 사유이고 CLI가 `loop add-work-phase: <reason>`으로
  감싼다. assert를 그 실제 문자열로 고친다.
- 문자열을 바꾸려면 030을 먼저 고치고 인용하는 모든 문서를 같이 고친다.

## 17. 공개 표면에는 SKILL.md가 포함된다 (라운드 3 High)

`000_plan.md`의 write scope와 `002_blast_radius.md`가 `plugins/codexclaw/skills/loop/SKILL.md`를
필수 변경으로 두는데 050과 060의 변경 목록에 없다. 현재 SKILL.md는 task를 `{id,title,status}`로만
설명하고 `ready`, `add-task`, `complete-task`, `meet-criterion`, `dependsOn`, `outcome`을 안내하지
않는다.

- **wp6이 SKILL.md MODIFY를 소유한다.** 스키마(`dependsOn`, `outcome`), CLI 동사, 새 원장 이벤트,
  task 의존이 phase-local이라는 점을 정본과 맞춘다.
- 이것은 에이전트가 읽는 정본이므로 코드만 바꾸고 문서를 두면 shipped 계약이 거짓이 된다.
- help 문자열도 같은 문제다. 060의 help After에 `ready --json`, `add-task`, `complete-task`
  `--outcome`, `meet-criterion --evidence`, `--depends-on` 반복 지정을 모두 넣는다. 같은 문서의
  `/ready .*--json/` 테스트가 그것을 요구한다. c-5의 "도움말에 노출"이 여기에 걸린다.

## 18. task 의존의 등록 입구를 연다 (라운드 3, 정본 §3 개정)

두 리뷰어가 같은 구멍을 짚었다. `task.dependsOn`을 wp4/wp6이 읽는데 그것을 만드는 공개 경로가
없어서 fixture와 손편집으로만 생긴다. "지원되는 public lifecycle을 닫는다"는 이 goal의 본질과
어긋난다.

정본 §3을 다음으로 개정한다.

- `cxc loop add-task --work-phase <id> --id <id> --title <text> [--depends-on <task-id>]...`
  **생성 시점의 의존 지정을 허용한다.** `--depends-on`은 반복 지정이고 콤마 문법은 없다.
- 참조 대상은 **같은 work phase의 기존 task id**만이다. 다른 phase의 task나 자신을 가리키면
  030의 사유로 거부하고 상태를 만들지 않는다.
- `addGoalplanTask()`가 `{ id, title, dependsOn? }`을 받는다.
- **사후 편집(`add-dependency` 등)은 여전히 범위 밖이다.** 생성 시점 지정은 새 항목의 정의를
  완성하는 additive 입력이므로 downstream 재판정 문제가 없다. 기존 항목의 의존을 바꾸는 것과는
  다르다. steering `add-work-phase`에 `dependsOn`을 허용한 것과 같은 논리다.
- steering op 타입은 `dependsOn?: string[]` **optional**이다. 필수로 만들면 기존
  `test/steering.test.ts:136`의 `{kind:"add-work-phase", id, title}` fixture가 타입 에러가 된다.
  기존 의존 없는 테스트를 지우지 말고 남긴다.

## 19. D-close 다중 파일 커밋 (라운드 3 High)

두 리뷰어가 짚은 재시도 위험이 실재한다. 현재 코드는 성공 시 FSM을 먼저 IDLE로 닫고
(`orchestrate-cli.ts:610` 부근) goalplan write는 catch로 감싼 fail-open이다
(`orchestrate-cli.ts:671` 부근). wp5안이 순서를 바꾸면 새 구멍이 생긴다. goalplan이 다음
phase로 갔는데 state write가 실패하면 세션은 C에 남고, 같은 D-close 재시도가
`advanceWorkPhase()`로 **다음 phase를 또 닫는다.** task 없는 phase면 한 번의 검증으로 두 phase가
닫힌다.

락 하나로는 못 막는다. 락은 동시 writer를 막지만 순차 재시도를 막지 않는다.

확정 계약:

- **멱등 가드를 둔다.** D-close는 자기가 닫으려는 phase id를 결정한 뒤, 그 phase가 이미 `done`이면
  plan을 다시 바꾸지 않고 남은 state 정리만 끝낸다. "다음 pending을 찾아 닫는다"가 아니라
  "이 phase를 닫는다"로 대상을 고정한다.
- 커밋 순서를 문서에 명시한다. 락 안에서 goalplan.json → goalplan 원장. 락을 놓고 state → PABCD
  원장. 각 단계 실패 시 관측 상태와 재시도가 어떻게 되는지 표로 적는다.
- 실패 주입 테스트 세 개를 wp5가 소유한다. goalplan commit 직후 실패, state write 직후 실패,
  PABCD ledger append 직후 실패. 각각 재시도가 phase를 두 번 닫지 않음을 확인한다.
- 분산 트랜잭션이나 복구 journal은 만들지 않는다. 멱등 재시도가 같은 목적을 더 적은 기계로 달성한다.

## 20. ready 목록의 소비 경로 (라운드 3 High #8)

정본 §12는 실행 드라이버를 만들지 않는다고 정했다. 그 결정은 유지한다. 다만 리뷰어 지적이 맞다.
계산한 ready 목록을 아무도 읽지 않으면 "의존 인식 실행 기반"이 아니라 조회 명령 하나가 늘어난
것이다. 현재 Stop 표면은 `nextOpenTask()` 한 건만 노출한다(`hook.ts:1165~1178`,
선언 `:1165`, `nextOpenTask()` 호출 `:1170`).

확정 계약:

- **wp6이 Stop 표면을 확장한다.** `readStopWorkContext()`가 다음 task 한 건 대신 ready work phase와
  ready task 목록을 담고, Stop 안내가 "지금 착수할 수 있는 것들"과 "무엇을 기다리는지"를 함께
  보여준다. 이것은 호스트가 만든 턴 안에서 에이전트가 읽는 정보이고, 새 턴을 만들지 않으므로
  §12와 충돌하지 않는다.
- 목표 명칭도 정직하게 쓴다. 이 goal이 만드는 것은 **dependency-aware control plane**이다.
  스케줄러도 실행기도 아니다. 000_plan.md의 서술을 이 표현에 맞춘다.
- 회귀는 Stop 안내에 ready 목록이 실제로 나타나는지 확인한다. helper 단위 호출만으로는 소비 경로가
  증명되지 않는다.

## 21. fixture 비식별화 (라운드 3 High #7)

070의 redaction은 정해진 key만 치환한 뒤 plan 전체를 저장한다. 실측에서 `ownerSessionId`,
`reviewerSession`, `launchId`, `planPath`, `roundId`, `planEpoch`와 해시가 치환 대상에서 빠졌다.
운영 goalplan의 세션·리뷰 식별자가 저장소로 들어간다.

- **denylist 방식을 금지하고 allowlist로 뒤집는다.** enum·status·boolean·숫자만 원본을 유지하고,
  그 밖의 모든 문자열은 scope-stable alias로 치환한다. parser가 보는 shape만 보존하면 충분하다.
- fixture 생성 뒤 privacy scan을 verifier에 넣는다. UUID 형태, 절대 경로, 40자 hex가 남아 있으면
  실패한다.
- baseline 생성 시점 문제도 함께 고친다. 070이 "wp2 구현 전에 실행"을 요구하면 phase 순서와
  모순이다. **baseline 생성과 corpus 체크인은 wp1/wp2 산출물로 옮기거나**, 070이 고정 pre-change
  SHA의 별도 worktree에서 그 시점 parser를 호출한다고 명시한다.

## 22. verifier 명령 정본 (라운드 3 Medium #11)

- 이 유닛의 문서는 현재 전부 untracked다. `git diff --name-only -- <문서>`는 빈 문자열을 낸다.
  문서 존재 검사는 `test -f`, 변경 검사는 `git status --porcelain -- <path>`를 쓴다.
  `git diff --check`로 공백을 볼 때는 `git diff --no-index /dev/null <path>`를 쓴다.
- 테스트 러너를 통일한다. 이 저장소의 루트 게이트는 `npm test`, `npm run build`, `npm run gate`다.
  `npm test`는 `node --test --test-concurrency=1`로 컴포넌트 테스트를 돈다. 개별 파일은
  `node --test <경로>`다. **`bun test`를 검증 명령으로 쓰지 않는다.** decade 문서마다 갈라진
  러너 표기를 이것으로 통일한다.
- 000_plan.md의 "디스크 기존 goalplan 전수 파싱"도 정본 §9의 "88 parse + 기존 invalid 1건, 변경
  전후 결과 집합 동일"로 고친다.

## 23. 000번대 조사 문서의 현행 결론 동기화 (라운드 3 Medium #10)

000번대는 조사 기록이지만 현행 결론과 어긋난 서술이 남아 오독을 만든다.

- `004_execution_owner.md`와 `003_dag_lessons.md`의 쓰기 직렬화·lifecycle 소유 wp 번호를 §7 표대로.
- `006_host_runtime.md`의 "락 실패는 fail-open" 한 줄에 정본 §11 포인터를 달고 operation
  fail-closed와 구분한다.
- `000_plan.md`와 `001_goalplan_anatomy.md`의 `atomic-write.ts:14` 인용을 상수 `:16`, 실행
  `:38~45`로 고친다.
- `020_wp2_schema_v3.md`의 `firstInvalidField()` 인용 `:568~612`를 `:594~612`로 고친다.
  `:568`은 `reviveGoalplan()` 호출이다.
- 역사 기록을 지우지는 않는다. 현행 결론과 다른 대목에는 "정본 §N이 최종"이라는 포인터를 남긴다.

## 24. 락 누수의 운영 표면 (라운드 3 Medium #13)

자동 회수는 정본 §6대로 넣지 않는다. 대신 사람이 빠르게 회복할 수 있게 한다.

- 락 획득 실패 메시지에 락 디렉터리 절대 경로와 삭제 명령을 그대로 적는다.
- `cxc loop show`(또는 동등한 조회 표면)가 락 디렉터리 존재와 나이를 표시한다.
- `owner.json`은 사람이 읽는 진단용으로만 남긴다. 판정 입력으로 쓰지 않는다(§6).


## 25. 적층 위반 2차 목록 (라운드 4 Critical)

라운드 3 처방으로 `validateGoalplan()`과 wp4→wp5 D-close는 보존됐다. 남은 두 곳이 Critical이다.

| # | 위반 | 처분 소유 |
| --- | --- | --- |
| S6 | 060의 `readStopWorkContext()` Before에 wp4가 넣은 `dependencyDeadlock` import, `dependencyBlockedReason`, 교착 계산이 없다. 060의 import After가 `dependencyDeadlock`을 빼는데 wp5의 채팅 D-close는 계속 호출한다. 순서대로 적용하면 **미정의 식별자로 build가 깨진다.** 단일 blocked phase가 `waitingOn`에도 안 잡혀 `readStopWorkContext()`가 null을 낸다 | wp6(060) |
| S7 | wp2 baseline 생성기 산출 shape와 wp7 소비 계약이 다르다. 020은 corpus 전역 alias map과 `{slug, plan}` 저장, invalid 결과에 `field` 없음. 070은 fixture별 alias, `ordinal`, `sourceClass`, `expected`, normalized `field`를 요구한다. 070의 privacy gate·legacy 검색·deep-equal이 전부 실패한다 | wp2(020)가 070 스키마에 맞춘다 |

S6 처분 상세: 060의 Before를 wp5 적용 후 상태와 일치시키고 `dependencyDeadlock` import를 보존한다.
Stop 표면을 ready 목록으로 바꾸더라도 **blocked/deadlock 사유를 잃지 않는다.** `waitingOn`이나
별도 필드에 유지하고, ready가 0건이면서 대기 사유가 있는 상태를 반드시 표현한다.

S7 처분 상세: **070이 소비 스키마의 정본이다.** 020의 생성기 After를 070이 읽는 shape로 다시 쓴다.
비식별 fixture를 임시 디렉터리에 풀어 재파싱한 결과가 원본 normalized 결과와 같다는 검사도 넣는다.

## 26. corpus 수를 코드에 박지 않는다 (라운드 4 High)

실측이 이미 어긋났다. 2026-08-29 재측정에서 `.codexclaw/goalplans/` 디렉터리 91개,
`goalplan.json` **90개**다. 라운드 1 조사 시점의 89개가 아니다. 생성기가 `expected 89`를 단언하면
구현 시작 직후 실패한다.

확정 계약:

- **corpus 수를 소스에 상수로 넣지 않는다.** 생성기는 발견한 파일을 그대로 처리하고 개수를 보고만
  한다. 체크인된 baseline JSON에 그 시점 manifest(파일 목록)와 개수를 함께 기록한다.
- 회귀 판정은 개수 일치가 아니라 **manifest에 적힌 항목들의 변경 전후 결과 집합 동일**이다.
  운영 디렉터리에 plan이 새로 생겨도 회귀가 깨지지 않는다.
- 문서에 개수를 쓸 때는 측정 날짜를 함께 적는다. "89개"처럼 날짜 없는 절대값을 검증 기준으로
  쓰지 않는다. 정본 §9의 legacy 1건 서술도 "측정 시점" 표현으로 읽는다.

## 27. D-close recovery는 marker로 판정한다 (라운드 4 High)

§19의 멱등 가드에 구멍이 있다. `recoveringDclose`가 "attested phase가 plan에서 done인지"만 보면
**과거에 닫힌 phase id를 넣어 현재 C 게이트를 우회**할 수 있다. binding, `transition()`,
receipt 검증을 전부 건너뛰고 state를 IDLE로 만들 수 있다.

확정 계약:

- recovery 판정은 plan 상태가 아니라 **durable marker**다. marker는 `sessionId`, `checkEpoch`,
  `closedWorkPhaseId` 세 값을 결박한다. 세 값이 현재 state와 모두 일치할 때만 recovery다.
- marker가 없거나 어긋나면 정상 D-close 경로를 타고, 정상 게이트(binding·전이·receipt)를 전부 통과해야 한다.
- 음성 테스트를 wp5가 소유한다. 과거 done phase id를 C에서 attest → 거부. IDLE에서 attest → 거부.
  세션이 다른 marker → 거부.
- 채팅 D-close의 `closePhaseId`는 `command.attest.workPhaseId`에서 온다. 이 값이 **필수**임을
  공개 안내와 모든 채팅 fixture에 반영한다. wp7의 채팅 성공 fixture에 `workPhaseId`가 없어
  현재는 빈 target 거부가 나고 테스트가 실패한다.

## 28. 기존 테스트 갱신 의무 (라운드 4 High)

새 진단 문구를 넣으면 그 문구를 기다리는 기존 테스트를 같은 wp가 고친다. "유지한다"고 적고 실제로는
깨지는 것이 반복됐다.

- `test/orchestrate-cli.test.ts:886`의 `D-close is refused when every remaining work-phase is blocked`가
  `/blocked or superseded/`를 요구한다. wp4의 새 출력은 `Dependency deadlock: work-phase wp-1 is blocked`다.
  **wp4가 이 기존 assert를 새 문구로 갱신하는 diff를 자기 문서에 포함한다.**
- 각 decade 문서는 "이 wp가 바꾸는 출력 문자열"과 "그 문자열을 기다리는 기존 테스트 목록"을
  한 표로 적고, 기존 테스트 갱신 diff를 포함한다. `rg`로 실제 검색해 목록을 만든다.

## 29. steering batch 검증 시점 (라운드 4 High)

`applyOps()`가 op마다 즉시 integrity를 검사한다. 따라서 batch 안에서 나중에 추가될 phase를 먼저
참조하면 cycle이 아니라 **dangling으로 즉시 거부**된다. 060의 cycle 테스트가 도달 불가능한 상태를
전제한다.

- 공개 mutation 테스트는 **dangling 거부를 기대**한다. cycle 검출은 순수 integrity 테스트(030)가 소유한다.
- batch 전체를 stage한 뒤 한 번 검증하는 방식으로 바꾸려면 계약부터 바꿔야 하고, 이번 범위 밖이다.
  현재 동작(op별 즉시 검증)을 명시하고 테스트를 그것에 맞춘다.

## 30. 락 운영 표면의 소비 (라운드 4 Medium)

§24가 `cxc loop show`에 락 상태를 표시하라고 했는데 060의 변경 목록·import·렌더 함수에 그 변경이 없다.

- **wp6이 `cxc loop show`에 락 상태 표시를 실제 diff로 넣는다.** 락 디렉터리 절대 경로와 나이를 낸다.
- `goalplanWriteLockStatus()`는 `existsSync()` 뒤 `statSync()` 사이에 락이 풀리면 ENOENT를 던진다.
  catch해서 `{ exists: false }`로 정규화한다. 진단 함수가 예외로 세션을 흔들면 안 된다.

## 31. 검증 블록은 자립해야 한다 (라운드 4 Medium)

- 060의 검증이 정의되지 않은 `$fixture_cwd`와 존재하지 않는 seeded session을 쓴다. 임시 cwd 생성,
  fixture seed, 정리까지 **한 블록 안에서 자립**하게 만든다. `mktemp -d`로 만들고 끝에 지운다.
- 050의 lifecycle 예시가 `GoalplanLedgerEntry`에 없는 `workPhaseId`, `taskId`를 객체 literal에 넣어
  그대로 붙이면 타입 오류다. 060의 정본 shape로 바꾸거나 ledger 타입 확장을 실제 diff에 넣는다.
- 원칙: 문서의 모든 bash·ts 블록은 **복사해서 그대로 실행**할 수 있어야 한다. 정의되지 않은 변수,
  존재하지 않는 fixture, 타입에 없는 필드는 DIFFLEVEL 위반이다.

## 32. 호스트 인용 재정정 (라운드 4 Low)

`006_host_runtime.md`가 `dispatcher.rs:123`과 `config/mod.rs:228`을 다시 쓴다. 정본 §9의 정정값
`dispatcher.rs:124~156`, `config/mod.rs:229`로 고친다. 호스트 checkout은 `89650c66f` 기준이다.


## 33. 라운드 4 2차 리뷰어 추가 지적 (Noether)

리뷰어 2기가 §25 S6/S7을 독립적으로 같이 짚었다. 그 밖에 새로 드러난 것들이다.

| # | 지적 | 처분 소유 |
| --- | --- | --- |
| N1 | 060의 `GoalplanLedgerEvent` **Before가 `review_signoff_ignored`에서 끊긴다.** 현재 union에는 `review_round_superseded`가 있고(`goalplan.ts:192` 부근) After도 그것을 빠뜨린 채 `dependency_registered`만 끼운다. 그대로 붙이면 050이 쓰는 superseded 이벤트가 타입에서 사라진다 | wp6(060) |
| N2 | 050의 D-close가 빈 plan에서도 `work-phase <id> is not in the bound goalplan`을 먼저 낸다. 기존 `orchestrate-cli.test.ts:864` 부근 빈 plan 테스트는 `/the plan is empty/`를 기대한다. **빈 plan은 기존 문구를 유지**하고 target 검사를 그 뒤에 둔다 | wp5(050) |
| N3 | 060의 help After가 새 usage 8줄만 주고 현재 help의 `init`/`show`/`validate`/`steer`/`add-criterion`/`--slug` 줄을 지운다. `renderGoalplanHelp()` **전체 After**를 적고 기존 줄도 테스트에서 단언한다 | wp6(060) |
| N4 | 대기 사유 문구가 표면마다 갈라진다. 040은 `work-phase wp2 waits for work-phase wp1 (blocked)`, 060의 Stop `waitingOn`은 `wp-blocked waits for work phase: wp-live`다. **040의 진단 문자열이 정본**이고 Stop이 그것을 재사용한다 | wp4가 문자열 소유, wp6이 재사용 |
| N5 | 020의 baseline 생성기가 `.mjs`에서 `../../src/goalplan.ts`를 import한다. 루트 `npm test`는 `node --test`로 `test/*.test.ts`만 돌고 이 스크립트의 타입 제거 로더 가정이 문서에 없다. `node --experimental-strip-types`를 명시하거나 생성기를 `.ts`로 옮긴다 | wp2(020) |
| N6 | 060은 기존 `Remaining work` 단언을 Ready 목록으로 바꾸고 070은 그 040 테스트를 남기라고 한다. **소비 경로 정본은 060 After 한 곳**이고 070은 그 문자열만 인용한다 | wp6이 정본, wp7이 인용 |
| N7 | 채팅 락 실패 메시지는 한국어, CLI는 영어다. **운영 메시지는 영어로 통일**한다. 코드 안 사용자 노출 문자열은 기존 관례를 따른다(문서 본문은 한국어) | wp5(050) |

N4 보충: 대기 사유는 사람이 읽는 진단이므로 한 문장 형식을 공유해야 한다. wp4가
`dependencyDeadlock()`의 reason 문자열 형식을 확정하고, wp6의 Stop `waitingOn`은 그 함수의 출력을
그대로 담는다. 새 문장을 만들지 않는다.

N6 보충: 같은 테스트 파일의 같은 단언을 두 문서가 반대로 적는 상황을 금지한다. 어떤 기존 단언을
바꾸는 문서가 그 단언의 **유일한 소유자**이고, 다른 문서는 바꾼 뒤의 문자열을 인용만 한다.
§28의 "출력 문자열 → 기존 테스트 목록" 표에 소유자를 함께 적는다.


## 34. 라운드 5 지적 (Newton) — 구현 세부 결함

라운드 4의 대형 구조 결함(S6·S7·event union·빈 plan·recovery marker·호스트 인용)은 폐쇄가 확인됐다.
남은 것은 순차 적용 시 build를 깨거나 테스트를 확정 실패시키는 구현 세부다.

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| T1 | Critical | wp5의 `hook.ts` 명세가 `hasPabcdCloseRow()`를 호출하는데 그 함수는 `orchestrate-cli.ts` 블록에만 있다. hook의 최종 import에 `GOALPLAN_LEDGER_FILE`, `goalplanDir`, `STATE_DIR`, `LEDGER_FILE`, `join`, `existsSync`, `readFileSync`가 없다 | wp5 |
| T2 | Critical | wp5의 `orchestrate-cli.ts` 추가 import에 `LEDGER_FILE`이 없는데 `hasPabcdCloseRow()`가 그것을 쓴다 | wp5 |
| T3 | Critical | wp6의 `applyOps()` After가 첫 `add-work-phase` 직후 루프 안에서 `return`한다. batch `[wp-a, wp-b dependsOn wp-a]`의 두 번째 op가 적용되지 않고, 원장 summary는 2 ops라 적는다 | wp6 |
| T4 | Critical | wp6이 wp5가 만든 `goalplanWriteLockStatus(..., stat = statSync)` 네 번째 seam 인자를 삭제한다. wp5의 ENOENT 경쟁 테스트가 실제 `statSync()`를 타서 실패한다 | wp6 |
| T5 | High | `dependencyDeadlock()`은 ready가 하나라도 있으면 null이다. wp6은 `waitingOn = dependencyDeadlock()?.reasons ?? []`로 만들고 ready fixture에서 `Waiting on:` 부재를 단언하는데, wp7은 같은 mixed 상태에서 대기 사유를 요구한다 | wp4가 helper 신설, wp6·wp7이 소비 |
| T6 | High | 030이 goal-gate 문구를 `fails the E8 quality gate` → `fails the E8 quality/integrity gate`로 바꾸는데 기존 `test/goal-gate.test.ts:305~316`의 옛 정규식 갱신 diff가 없다 | wp3 |
| T7 | High | wp5가 `.steer.lock`과 `wslDeps`를 제거하는데 기존 `test/steering-ops.test.ts:22~72`가 `.steer.lock`을 만들고 drvfs/9p 문구를 기다린다 | wp5 |
| T8 | High | `hasPabcdCloseRow()`가 `(sessionId, from=C, to=IDLE, reason=done)`만 봐서 같은 세션의 두 번째 cycle이 과거 행을 자기 것으로 오인한다 | wp5 |
| T9 | High | `commitLifecycle()`이 plan commit 후 ledger append를 한다. append가 throw하면 "실패했지만 상태는 바뀐" 결과가 되고 재시도는 `unchanged`로 끝나 원장을 복구하지 못한다 | wp6 |
| T10 | High | `000_plan.md`가 여전히 "89개 중 88 parse"를 수용 기준으로 고정한다. §26의 manifest 계약과 충돌한다 | 000 |
| T11 | High | wp6의 `renderGoalplanHelp()` 전체 After가 현재 `add-work-phase`/`add-criterion` help 줄의 `--slug <slug>`를 지운다 | wp6 |
| T12 | High | `000_plan.md`의 write scope에 `state.ts`가 없는데 wp5가 recovery marker 때문에 필수로 수정한다 | 000 |

T5 처분: `dependencyDeadlock()`은 **전역 교착 판정 전용**으로 유지한다. 부분 대기 사유는
`dependencyWaitReasons(plan)` 순수 helper를 **wp4가 신설**해 계산한다. Stop의 `waitingOn`은 새
helper를 소비하고, ready가 있으면서 동시에 대기 중인 항목이 있는 상태를 표현한다. c-5의 "ready
목록과 대기 사유를 함께 표시"가 이것으로 충족된다. wp6과 wp7의 단언을 이 helper 기준으로 통일한다.

T9 처분: **plan commit이 권위 commit point**다. ledger append 실패는 연산 실패로 보지 않고
code 0 + 경고로 보고한다. steering의 기존 관례와 같다. 원장은 역사이고 권위가 아니라는 §4의
결정과 일관된다. ledger append 실패 주입 테스트를 wp6이 소유한다.

T8 처분: PABCD close 행의 중복 판정 키를 `(sessionId, checkEpoch, closedWorkPhaseId)`로 바꾼다.
recovery marker와 같은 세 값이다. 같은 세션에서 두 cycle을 연속으로 닫는 회귀를 wp5가 소유한다.

T1·T2·T4 공통 원칙: **함수를 호출하는 파일마다 그 함수와 필요한 import 전체를 그 파일의 After에
포함한다.** 다른 파일 블록에 있는 helper를 "복사하라"고만 적는 것은 §31 위반이다. seam 인자를
가진 함수는 그 seam을 소비하는 문서가 Before/After에서 반드시 보존한다.


## 35. D-close 경로 보존 (라운드 5 2차 리뷰어)

락과 marker를 넣으면서 D-close의 **기존 정상 경로 두 개가 죽는다.** 우회를 막는 것과 정상 경로를
막는 것은 다르다.

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| U1 | Critical | HITL D-close(`state.slug === ""`)가 bound 분기 밖의 `withGoalplanWriteLock(cwd, state.slug!, …)`까지 떨어진다. `validateGoalplanSlug("")`가 throw하므로 unbound 성공 경로가 예외로 죽는다(`orchestrate-cli.test.ts:908`) | wp5 |
| U2 | Critical | 050 After가 `#49` all-done 특례를 지운다. 전부 `done`인 plan의 C→IDLE이 `every remaining work-phase is blocked or superseded`로 거부되고, marker는 그 앞에서 쓰이지 않아 재시도로도 못 닫는다. 기존 성공 테스트 `D-close succeeds when every work-phase is already done`이 거부로 뒤집힌다 | wp5 |
| U3 | Critical | 040이 `hook-continuation.test.ts`에 `nextTaskTitle`·`dependencyBlockedReason` 단언 3개를 넣는데 060 After가 그 필드를 지운다. 060이 고치는 기존 단언은 2개뿐이라 040 테스트가 컴파일·런타임 둘 다 깨진다 | 040이 단언 축소, 060이 갱신 소유 |
| U4 | High | 060의 검증 블록이 `node .../src/cli.ts`를 그대로 실행한다. TypeScript라 `--experimental-strip-types`가 필요하다(020은 이미 명시) | wp6 |
| U5 | High | 050의 §28 표가 HITL 성공 테스트와 성공 문구 변경을 소유하지 않는다. After가 성공 출력을 `close target <id> is complete`로 바꾸는데 HITL은 `workPhaseId`가 없어 `close target `가 된다 | wp5 |
| U6 | High | 040의 Stop 교착 테스트가 `dependencyBlockedReason`에서 `/wp2 waits for work-phase wp1 \(blocked\)/`를 기다린다. 060의 `waitingOn`은 prefix 없이 reasons만 담아 어긋난다 | 040 |

U1 처분: **slug 없는 D-close는 기존 경로를 그대로 탄다.** `writeState` + `appendLedger` + 옛 성공
문구로 즉시 return한다. 락 획득, marker 정리, `close target … is complete` 문구는 **bound 성공
뒤에만** 온다. bound 분기와 unbound 분기를 코드 구조에서 명확히 분리하고, 그 분리를 diff로 보인다.

U2 처분: 빈 plan 거부 뒤에 **all-done 특례를 복원**한다. `workPhases.length > 0`이고 전부 `done`이면
marker 없이 cycle만 IDLE로 닫는다. 문구에 blocked/superseded를 쓰지 않는다. marker는 "과거 done id로
현재 C를 건너뛰는 우회"만 막는 용도이고, "이미 다 끝난 plan의 정상 cycle 종료"를 막는 용도가 아니다.
기존 성공 테스트 `D-close succeeds when every work-phase is already done`이 그대로 통과해야 한다.

U3·U6 처분: **Stop 표면 단언의 유일한 소유자는 060이다**(§33 N6 재확인). 040은 순수 helper의
golden만 잠근다 — `dependencyDeadlock(plan).reasons`와 `dependencyWaitReasons(plan)`의 반환값이다.
`readStopWorkContext()`의 필드나 Stop 출력 문자열을 040이 단언하지 않는다. 040이 이미 넣은 Stop
단언 3개는 040에서 제거하고, 필요하면 060이 자기 After shape로 다시 만든다.

D-close 검사 순서 정본(wp5가 이 순서를 그대로 구현한다):

1. slug 없음(HITL) → 기존 경로, 즉시 return
2. 빈 plan → 기존 `the plan is empty` 문구로 거부
3. 전부 done → all-done 특례로 cycle만 닫음(marker 불필요)
4. recovery marker 일치 → 남은 정리만 수행
5. target phase가 plan에 없음 → 거부
6. pending task 남음 → `tasks_pending` 거부
7. 의존 교착 → `dependencyDeadlock()` 진단으로 거부
8. 정상 close → 락 안에서 plan commit + goalplan 원장, 락 밖에서 state + PABCD 원장


## 36. import 적층 규칙과 라운드 6 지적

리뷰어 2기가 독립적으로 같은 근본 원인을 지목했다. **테스트·소스 파일의 "전체 import After"를 쓸 때
선행 wp가 추가한 import를 지운다.** 이것이 라운드 6 Critical 전부의 원인이다.

확정 계약:

- **import 블록의 After는 "선행 wp가 추가한 모든 이름 + 이 wp가 추가하는 이름"이다.**
  "전체 After"라고 쓰면서 현재 HEAD 기준으로 다시 쓰는 것을 금지한다.
- import를 바꾸는 문서는 **선행 문서의 import After를 직접 열어 읽고** 그 목록을 출발점으로 삼는다.
- 각 import After 블록 위에 `// wpN 적용 후 + 이 wp 추가분` 주석과, 선행 wp가 넣은 이름을 명시한다.
- **`npm run build`는 이 결함을 잡지 못한다.** `plugins/codexclaw/scripts/build.mjs`는 타입 제거와
  파일 복사만 하고 심볼 해석을 하지 않는다. 따라서 build exit 0은 실행 자립성의 증거가 아니다.
  각 단계의 게이트는 **변경된 공개 경로를 실제로 호출하는 focused test**다. 문서의 검증 절에서
  "build가 타입·import 오류를 검출한다"는 주장을 삭제한다.

### 라운드 6 지적 대장

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| V1 | Critical | 040의 `goalplan.test.ts` 전체 import After가 020이 넣은 `readGoalplanDetailed`, `effectiveSchemaVersion`을 지운다 | wp4 |
| V2 | Critical | 060의 `goalplan.test.ts` 전체 import After가 위 둘과 040의 `dependencyDeadlock`까지 지운다 | wp6 |
| V3 | Critical | `review-round-cli.ts`와 `review-observer.ts`가 `withGoalplanWriteLock()`을 호출하는데 두 파일의 import After가 없다. 현재 import에도 그 이름이 없다(`review-round-cli.ts:18`, `review-observer.ts:42`) | wp5 |
| V4 | Critical | unbound HITL D-close가 bound 분기 밖 cleanup에서 `withGoalplanWriteLock(cwd, state.slug!, …)`를 무조건 호출한다(§35 U1과 동일 원인, cleanup 경로에 남아 있음) | wp5 |
| V5 | Critical | 채팅 D-close recovery의 합성 `ApplyResult`에 `ledger`가 없다. append 조건이 `result.ledger && …`이므로 state write 직후 실패한 재시도가 PABCD close 행을 영구 누락시킨다 | wp5 |
| V6 | High | `defaultState()`에 `dcloseRecovery: null`을 추가하면서 `state.test.ts:34`의 exact persisted shape 단언을 갱신하지 않았다 | wp5 |
| V7 | High | `hasPabcdCloseRow()` + `appendLedger()`가 락 밖의 check-then-append다. 동시 recovery 두 개가 같은 3-tuple을 두 번 append할 수 있다 | wp5 |
| V8 | High | `clearedIdle()`이 새 필드를 spread로 보존해 IDLE+marker에서 reset이 no-op이 되고 marker가 영구 잔존한다. 실제 소유는 `src/orchestrate-apply.ts`이며 write scope에 없다 | wp5 + 000 |
| V9 | High | 060의 Stop 단언 갱신이 040이 넘긴 세 테스트를 포함하지 않는다(§35 U3의 갱신 소유 쪽) | wp6 |
| V10 | High | 새 `ready --session`이 canonical session을 검사하지 않는다. `readState()`가 session을 sanitize하므로 `a/b`가 `a-b`의 goalplan을 읽는다 | wp6 |
| V11 | High | 의존 없는 `add-work-phase`의 steering summary가 `${id}: ${title}; dependsOn=`으로 바뀌어 idempotency key(summary hash)가 깨진다. 업그레이드 전 명령 재실행이 duplicate-id 거부가 된다 | wp6 |
| V12 | High | 락 테스트가 절대 경로를 `startsWith("/")`로 단언하고 복구 안내를 POSIX `rm -rf` 하나로 고정한다. Windows에서 확정 실패하고 실행 불가능한 안내를 준다 | wp5 |
| V13 | High | D-close mutation이 `goalplanDefinitionIntegrityReasons()`와 `goalplanDependencyCompletionReasons()`를 호출하지 않아 invalid v3 plan을 닫는다. §5 위반 | wp5 |
| V14 | High | tracked `dist/*.js`가 write scope에 없다. `npm run build`가 재생성하고 `test/dist-freshness.test.mjs`가 검사한다 | 000 |

V11 처분: `dependsOn.length === 0`이면 **기존 summary 문자열을 그대로** 쓴다. 비어 있지 않을 때만
suffix를 붙인다. 업그레이드 전 steeringLog key fixture로 회귀를 잠근다.

V12 처분: 테스트는 `node:path`의 `isAbsolute()`를 쓴다. 복구 안내는 플랫폼 중립적으로 경로만
제시하거나 플랫폼별 명령을 나란히 준다.

V13 처분: 락 안에서 marker·write보다 **먼저** 두 integrity helper를 실행한다. 실패 시 goalplan,
state, 두 원장 모두 한 바이트도 바뀌지 않는 CLI·채팅 회귀를 둔다.

V14 처분: 000의 write scope에 `plugins/codexclaw/components/pabcd-state/dist/`의 해당 파일들을
명시하고, 각 wp의 변경 manifest에도 넣는다. 최종 완료 조건에 dist freshness test를 결박한다.


## 37. 라운드 7 지적 — 잔여 5건

리뷰어 2기가 V1~V12를 전부 폐쇄로 확인했다. 남은 것은 아래 다섯이며 둘의 지적이 일치한다.
현재 HEAD의 `npm test`는 2,086/2,086 통과가 실측으로 확인됐다.

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| W1 | Critical | 060의 `hook.ts` import After가 050이 추가한 `goalplanDefinitionIntegrityReasons`, `goalplanDependencyCompletionReasons`를 다시 지운다. 050의 채팅 D-close callback이 두 함수를 계속 호출한다(V13 재개방) | wp6 |
| W2 | Critical | 050이 `handleUserPromptSubmit(payload, platform)`의 **두 번째 인자를 `dcloseCommitHooks`로 교체**한다. 함수 안 `loopArmDirective(platform)`이 미정의 변수를 참조한다. D-close 본문은 private `handleOrchestrateCommand()` 안인데 hook 객체를 그 함수로 전달하는 diff가 없다(`hook.ts:592~607, 791~796`) | wp5 |
| W3 | High | 020에서 `buildGoalplan()` 기본값이 v3가 되고 050 D-close가 outcome 무결성을 먼저 검사하는데, 기존 성공 fixture의 done task에 `outcome`이 없다. `seedBoundCycleAtC(..., "done")`(`orchestrate-cli.test.ts:738~749`)과 채팅 fixture(`hook.test.ts:675~695`) 모두 `{status:"done"}`만 만든다 | wp5 |
| W4 | High | 채팅 D-close에 all-done 특례가 없다. bound chat이 plan을 읽기 전에 `workPhaseId` 누락을 거부하고, 줘도 all-done plan이 `no_active`로 거부된다. §35의 8단계 순서를 채팅이 위반한다 | wp5 |
| W5 | High | 각 wp manifest에 tracked `dist/*.js`가 없고, 단계 순서가 `npm test`를 `npm run build`보다 먼저 실행한다. 루트 `npm test`에 `plugins/codexclaw/test/dist-freshness.test.mjs`가 포함되고 그것이 src와 tracked dist의 byte equality를 검사하므로, **첫 src 변경인 020 직후부터 stale dist로 실패**한다 | 000 + 020~070 |

W2 처분: **기존 `platform` 인자를 보존**하고 hook을 **세 번째 인자**로 추가한다.
`handleOrchestrateCommand(..., dcloseCommitHooks)`에도 매개변수를 추가하고 호출부에서 명시적으로
전달한다. 실패 주입 테스트는 `handleUserPromptSubmit(payload, process.platform, hooks)`로 호출한다.

W3 처분: `seedBoundCycleAtC()`가 `taskStatus === "done"`일 때 비어 있지 않은 `outcome`을 넣는다.
채팅 성공 fixture도 같은 보강을 받는다. **v1로 낮추는 우회는 금지**한다 — 그러면 새 v3 D-close
경로를 검증하지 못한다. 이 갱신을 wp5의 기존 테스트 소유 표에 등록한다.

W4 처분: 채팅도 락 안에서 빈 plan을 먼저 판정하고, 비어 있지 않은 all-done plan은 target·marker
없이 cycle만 닫는다. `workPhaseId` 검사는 그 뒤로 옮긴다. `workPhaseId` 유무 두 경우 모두
marker 없이 IDLE로 닫히는 채팅 회귀를 둔다.

W5 처분: **단계별 검증 순서를 고정한다.**

```
focused test  →  npm run build  →  npm test  →  npm run gate
```

`npm run build`가 tracked dist를 재생성한 뒤에 `npm test`를 돌려야 freshness test가 통과한다.
각 wp의 변경 manifest에 변경 src와 같은 basename의 tracked dist 경로를 명시한다.
예: `src/goalplan.ts`를 바꾸면 `dist/goalplan.js`도 manifest에 들어간다.

### 비차단 잔여 (Medium)

- 050과 060의 검증 블록에서 `git diff --no-index`가 마지막 명령이라 블록 전체가 exit 1로 끝난다.
  종료 코드를 변수로 받아 `test "$status" -eq 1`로 정규화한다.
- 020의 "`npm run build`가 TypeScript 검사를 수행한다"는 서술이 §36과 충돌한다. 기대값을 dist
  생성·레이아웃 검사로 고친다.
- 050의 `rg '\.steer\.lock'` 블록이 0건을 기대하는데 `!` 없이 쓰여 성공 상태에서 exit 1이다.


## 38. 라운드 8 잔여 2건 (실측 확인)

리뷰어 2기 중 하나는 PASS, 하나는 High 2건으로 FAIL을 냈다. 두 지적을 실제 파일로 확인했고 둘 다
실재한다. W1~W3·W5는 양쪽이 폐쇄로 일치한다.

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| X1 | High | `dcloseRecovery: null`을 기본 상태에 추가하면서 `test/state.test.ts`만 갱신했다. 루트 E2E도 persisted state 전체를 `deepEqual`하며 새 필드가 없다(`plugins/codexclaw/test/hook-e2e.test.mjs:160`, `:183`). 루트 `npm test`가 `plugins/codexclaw/test/*.test.mjs`를 포함하므로 wp5에서 확정 실패한다 | wp5 |
| X2 | High | 채팅 D-close가 target 조회 **뒤에** recovery를 판정한다(`recoveringDclose && target.status === "done"`). 부분 커밋 뒤 target이 사라지면 marker가 맞아도 정리를 재개하지 못한다. 또 all-done에 `workPhaseId`가 들어오면 target 없이 닫아야 하는데 PABCD 행에 그것을 `closedWorkPhaseId`로 기록한다. 완료 기준에 all-done 특례를 부정하는 모순 문장이 남아 있다(`050:3291`) | wp5 |

X1 처분: wp5의 변경 manifest에 `plugins/codexclaw/test/hook-e2e.test.mjs`를 추가하고, 그 파일의
두 exact shape 블록에 `dcloseRecovery: null`을 넣는 diff를 포함한다. §28 소유 표에도 등록한다.
**교훈**: exact-shape `deepEqual` 단언은 `components/*/test/`뿐 아니라
`plugins/codexclaw/test/*.test.mjs`에도 있다. state 필드를 추가하는 wp는 두 곳을 모두 검색한다.

X2 처분: 채팅 D-close 순서를 정본 §35의 8단계와 정확히 맞춘다.

1. 빈 plan → 기존 문구로 거부
2. 비어 있지 않은 all-done → target·marker 없이 cycle만 닫음
3. **marker 일치 recovery → target 조회 없이 정리 재개**
4. target 검증 → 없으면 거부
5. 이하 정상 close

- recovery 판정을 target 조회보다 **앞**에 둔다. marker의 `closedWorkPhaseId`가 이미 그 대상을
  가리키므로 plan에서 다시 찾을 필요가 없다.
- all-done 경로에서 닫힌 대상이 없음을 바깥으로 전달해 PABCD 행의 `closedWorkPhaseId`를
  `null`로 고정한다. 사용자가 `workPhaseId`를 줬어도 그것을 기록하지 않는다.
- `050:3291`의 "bound 채팅 D-close fixture와 공개 안내는 all-done 특례를 빼고 `workPhaseId`를
  필수 target으로 적는다"를 **삭제**한다. §35 U2와 정면으로 충돌한다.
- 테스트 두 개를 추가한다: marker 일치 + target 부재에서 정리가 재개된다 /
  all-done + `workPhaseId` 제공에서 PABCD 행의 `closedWorkPhaseId`가 null이다.
