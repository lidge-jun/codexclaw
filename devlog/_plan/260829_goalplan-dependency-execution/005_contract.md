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

> **§39 Y2로 개정됨.** 3번과 4번의 순서가 뒤바뀐다. marker 일치 recovery가 all-done보다 **앞**이며,
> recovery는 고정 대상의 상태를 확인해 멱등 commit까지 수행한다. 구현은 §39의 개정된 8단계를 따른다.

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
미해석 식별자 검사  →  focused test  →  npm run build  →  npm test  →  npm run gate
```

`npm run build`가 tracked dist를 재생성한 뒤에 `npm test`를 돌려야 freshness test가 통과한다.
각 wp의 변경 manifest에 변경 src와 같은 basename의 tracked dist 경로를 명시한다.
예: `src/goalplan.ts`를 바꾸면 `dist/goalplan.js`도 manifest에 들어간다.

미해석 식별자 검사가 맨 앞에 오는 이유는 `node --experimental-strip-types`와 `npm run build`가
둘 다 타입을 지우고 지나가기 때문이다. 나머지 네 단계는 없는 이름을 참조하는 계획서를 조용히
통과시켰다. 오류 코드를 열거하는 방식은 열거가 끝나는 자리마다 뚫린다 — `TS2305`·`TS2724`를 넣어도
`TS2459`가, 그것까지 넣어도 `TS2614`가 빠져나갔다. 그래서 방향을 뒤집어 선행 타입 호환성 부류
(`TS2339`·`TS2352`·`TS2345`·`TS2741`·`TS2554`·`TS2322`)만 허용하고 나머지 진단 전부를 실패로 본다.
허용 목록 밖에 남는 것은 위치까지 고정한 선행 `TS2459` 한 건뿐이다. `tsc` 실행 성공은 종료 코드
(0 또는 2)와 `@types/node` 적재 양성 확인으로 판정하며 계수와 분리한다 — `| rg -c … || echo 0`은
잘못된 플래그와 binary 부재까지 0으로 접어 게이트 자체를 false-green으로 만든다. 정본 스크립트는
050 §10.7에 있다.

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

> **§39 Y1·Y2로 개정됨.** marker 일치 recovery가 all-done보다 **앞**에 온다(1 → recovery → all-done →
> target 검증). 그리고 recovery는 marker의 `closedWorkPhaseId`로 plan에서 대상을 찾아 아직 `done`이
> 아니면 그 phase만 멱등하게 닫는다. 이 조회는 아래가 금지한 "target 검증"이 아니다 — 없으면 거부하지
> 않고 이미 커밋됐다고 판정한다.

- recovery 판정을 target 조회보다 **앞**에 둔다. marker의 `closedWorkPhaseId`가 이미 그 대상을
  가리키므로 plan에서 다시 찾을 필요가 없다.
- all-done 경로에서 닫힌 대상이 없음을 바깥으로 전달해 PABCD 행의 `closedWorkPhaseId`를
  `null`로 고정한다. 사용자가 `workPhaseId`를 줬어도 그것을 기록하지 않는다.
- `050:3291`의 "bound 채팅 D-close fixture와 공개 안내는 all-done 특례를 빼고 `workPhaseId`를
  필수 target으로 적는다"를 **삭제**한다. §35 U2와 정면으로 충돌한다.
- 테스트 두 개를 추가한다: marker 일치 + target 부재에서 정리가 재개된다 /
  all-done + `workPhaseId` 제공에서 PABCD 행의 `closedWorkPhaseId`가 null이다.

## 39. 라운드 9 — marker recovery의 lost update 폐쇄 (실측 확인)

P-phase stale check 리뷰어가 §27·§35·§38의 조합에서 lost update 두 건을 재현 가능한 형태로 지적했고,
050의 명세 코드로 확인했다. 둘 다 실재한다.

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| Y1 | Critical | marker는 plan commit **앞**에 기록되는데(§19 1단계), marker 일치 recovery는 `if (!recoveringDclose)` 블록 안에서만 `writeClosedPlan = true`가 된다. marker 직후 crash한 뒤 재시도하면 plan은 닫히지 않은 채 `workphase_done` 원장 행과 IDLE state만 생긴다. 원장은 닫혔다고 말하고 plan은 열려 있다 | wp5 |
| Y2 | Critical | §35-3 all-done이 §35-4 marker recovery보다 앞이다. 마지막 work-phase의 plan commit 직후 crash하면 plan은 이미 전부 `done`이므로 재시도가 all-done 특례로 들어가 `closedWorkPhaseId: null`로 기록한다. marker가 지목한 실제 대상이 원장에서 사라진다 | wp5 |

두 지적의 뿌리는 하나다. marker가 "어느 대상을 닫는 중"만 말하고 "어디까지 커밋했는지"는 말하지
않는데, recovery 경로가 커밋 여부를 확인하지 않고 남은 단계로 건너뛴다.

### Y1·Y2 처분 — recovery는 고정 대상의 상태를 확인하고 멱등 commit한다

marker에 stage 필드를 넣지 않는다. 단계를 늘리면 그 단계 자체가 또 crash 지점이 된다. 대신 recovery가
고정 대상의 현재 상태를 보고 필요한 commit만 다시 수행한다. marker의 `closedWorkPhaseId`는 여전히
target을 **조회하지 않고** 고정하는 근거지만, 그 대상이 plan에서 이미 `done`인지는 확인한다.

확정 계약:

- recovery 분기는 marker의 `closedWorkPhaseId`로 plan에서 해당 phase를 찾는다. 이 조회는 §38 X2가
  금지한 "target 검증"이 아니다. 없으면 거부하지 않고, 이미 커밋됐다고 판정해 plan write를 생략한다.
- 찾았고 status가 `done`이 아니면 그 phase만 `done`으로 만들어 plan을 commit한다. 커서 이동은
  `advanceWorkPhase()`를 다시 부르지 않고, 첫 시도가 남긴 plan 상태를 존중한다. 즉 recovery의 plan
  commit은 대상 phase status 하나만 멱등하게 맞춘다.
- 찾았고 이미 `done`이면 plan write를 생략하고 원장·state 정리로 넘어간다.
- **검사 순서에서 marker recovery가 all-done보다 앞이다.** §35의 8단계와 §38 X2의 5단계를 아래로
  개정한다.

개정된 D-close 검사 순서 정본:

1. slug 없음(HITL) → 기존 경로, 즉시 return
2. 빈 plan → 기존 `the plan is empty` 문구로 거부
3. **recovery marker 일치 → 고정 대상의 멱등 commit과 남은 정리만 수행**
4. 전부 done → all-done 특례로 cycle만 닫음(marker 불필요, `closedWorkPhaseId`는 null)
5. target phase가 plan에 없음 → 거부
6. pending task 남음 → `tasks_pending` 거부
7. 의존 교착 → `dependencyDeadlock()` 진단으로 거부
8. 정상 close → 락 안에서 plan commit + goalplan 원장, 락 밖에서 state + PABCD 원장

3번이 4번보다 앞이면 Y2가 닫힌다. 마지막 phase를 커밋한 뒤 crash해도 marker가 남아 있으므로 재시도가
recovery 분기로 들어가고, `closedWorkPhaseId`가 원장에 정확히 남는다. marker가 없는 all-done plan은
여전히 4번에서 정상으로 닫힌다 — §35 U2가 지킨 경로는 그대로다.

3번 안의 멱등 commit이 Y1을 닫는다. marker 직후 crash에서는 대상이 아직 `done`이 아니므로 recovery가
plan을 닫고, plan commit 직후 crash에서는 이미 `done`이므로 write를 건너뛴다. 두 경우 모두 원장과 plan이
같은 사실을 말한다.

### Y3 — 최종화 락 실패는 전이를 진행하지 않는다

050 §5 마지막 문단이 "최종화 락을 못 잡으면 CLI는 code 1로 close는 반영됐고 finalization이 남았다고
알린다"고 적는데, 이건 §11의 operation fail-closed와 충돌한다. 4단계 state write는 이미 락 밖이고
5·6단계는 다시 락 안이므로, 최종화 락 실패 시점에는 FSM이 이미 IDLE이다. 전이를 되돌리지 않는다.

확정: 최종화 락 실패는 **거부가 아니라 미완 보고**다. §5의 "거부는 아무것도 쓰지 않는다"는 최초
거부에만 적용되고, 이 지점은 이미 게이트를 통과한 뒤다. CLI는 code 1을 쓰지 않고 code 0으로 닫되
출력에 marker가 남아 다음 요청이 정리를 끝낸다는 사실을 적는다. 채팅 훅도 같은 문구를 내고 프로세스
code 0을 지킨다. §11 표의 `CLI D-close` 행은 **최초 락 실패**만 가리킨다는 단서를 붙인다.

### Y4 — verifier의 문서 상태 기대는 tracked 기준이다

§22와 각 decade 문서의 §10이 담당 문서가 untracked라고 전제하고 `git status --porcelain`이 `??` 한 줄을
낸다고 단언한다. 020·030·040·050은 이미 커밋됐으므로 이 기대는 거짓이고, 출력을 검사하지 않기 때문에
조용히 통과한다.

확정: 담당 문서 확인은 tracked 여부를 가정하지 않는다. `git ls-files --error-unmatch <문서>`로 저장소에
등록됐음을 확인하고, 변경이 있으면 `git diff --stat -- <문서>`로 보인다. `git diff --no-index /dev/null`은
쓰지 않는다. 그 명령은 파일 내용과 무관하게 항상 exit 1이라 아무것도 검증하지 않는다.

## 40. 라운드 10 — recovery 커서 손상과 all-done 최종화 폐쇄 (감사 2기 독립 재현)

§39를 넣은 뒤 A-phase 감사관 2기가 같은 BLOCKER 2건을 각각 실측으로 재현했다. §39가 lost update는
닫았지만 새 손상을 만들었다.

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| Z1 | BLOCKER | §39의 "대상 phase status 하나만 멱등하게 맞춘다"가 커서를 손상시킨다. marker 직후 crash 상태는 `activeWorkPhaseId=wp-1`, `wp-1=in_progress`, `wp-2=pending`이다. status만 바꾸면 `activeWorkPhaseId`가 done인 `wp-1`을 계속 가리키고 `wp-2`는 pending으로 남는다. 그리고 `startedId = closedPlan.activeWorkPhaseId`이므로 원장에 거짓 `started wp-1`이 들어간다. 정상 close는 `active=wp-2`, `wp-2=in_progress`를 만든다 | wp5 |
| Z2 | BLOCKER | all-done 특례는 marker를 만들지 않고 IDLE state를 먼저 쓴다. 그 뒤 최종화 락이 실패하면 §39 Y3대로 code 0을 내지만 PABCD close row가 없고 marker도 없다. 같은 D 재시도는 marker가 없어 `IDLE -> D` illegal transition으로 거부되므로 close row가 영구 누락된다 | wp5 |

### Z1 처분 — recovery와 정상 close가 같은 함수로 plan을 만든다

status 하나만 고치는 특수 경로를 없앤다. 두 경로가 같은 plan 변환을 쓰지 않으면 어느 한쪽이 반드시
어긋난다는 것이 이번 감사의 결론이다.

확정 계약:

- `goalplan.ts`에 `closeFixedWorkPhase(plan, workPhaseId)`를 추가한다. 지정한 phase를 `done`으로 만들고,
  그 phase를 기준으로 `advanceWorkPhase()`와 **같은 after-then-wrap 순서와 같은 dependency readiness**로
  다음 후보를 골라 `activeWorkPhaseId`와 successor `in_progress`까지 설정한다. 반환 타입은
  `AdvanceResult`와 같은 `{ kind: "ok"; plan; closedId }`다.
- `advanceWorkPhase()`는 effective 커서로 대상을 정한 뒤 이 함수에 위임한다. 정상 close와 recovery가
  같은 코드로 plan을 만든다.
- recovery 분기는 고정 대상이 plan에 있고 `done`이 아니면 `closeFixedWorkPhase()`를 부른다. 이미 `done`이면
  plan write를 생략한다. 없으면 나중 편집이 지운 것이므로 write 없이 정리로 넘어간다.
- `workphase_started` 행은 항상 이 함수가 계산한 `activeWorkPhaseId`를 쓴다. marker 직후 crash 재시도가
  `started wp-2`를 정확히 한 번 남긴다.
- 회귀 테스트: CLI와 채팅 각각 `afterRecoveryMarkerWrite`에서 실패를 주입해 marker 직후 crash를 만들고,
  재시도 뒤 `wp-1=done`, `wp-2=in_progress`, `activeWorkPhaseId=wp-2`, `started wp-2` 1건, `closed wp-1`
  1건을 단언한다. 정상 close 결과와 recovery 결과가 같은 plan인지 `deepEqual`로 묶는다.

### Z2 처분 — all-done은 두 번째 락을 쓰지 않는다

all-done에 marker를 도입하지 않는다. marker는 "닫는 중인 대상"을 가리키는 값인데 all-done에는 그런
대상이 없다. 대신 all-done의 커밋을 나누지 않는다.

확정 계약:

- all-done cycle close는 **첫 락 임계 구역 안에서** PABCD close row 확인·append까지 끝낸다. `closedWorkPhaseId`는
  `null`이다. plan write와 goalplan 원장 행은 여전히 없다.
- IDLE state write는 그 락을 놓은 뒤 실행한다. state write가 실패해도 close row는 이미 있고, 같은 요청을
  다시 실행하면 `hasPabcdCloseRow()` 확인이 중복 append를 막는다.
- 따라서 all-done 경로에는 최종화 락이 없다. §39 Y3의 "최종화 락 실패는 미완 보고"는 marker를 남기는
  정상 close와 recovery에만 적용된다.
- 회귀 테스트: all-done close에서 최종화 락 획득 시도가 0회임을 확인한다. 그리고 IDLE state write 직후
  실패를 주입한 뒤 같은 요청을 다시 실행해도 close row가 1건인지 단언한다.

### Z3 — 채팅 state write는 기존 필드를 모두 보존한다

감사관 2기가 High로 지적했다. 현재 채팅 D-close의 state write는 `injectedTurns`에 현재 turn을 넣고
`stopBlockPhase`·`stopBlockCount`를 지운다. 050의 교체 write는 `result.state`, `checkEpoch`, marker만
적어서 same-turn dedup과 Stop 정리가 사라진다.

확정: 교체 write는 기존 state augmentation을 한 글자도 빼지 않고 그 위에 recovery 필드만 덧씌운다.
같은 turn 재실행이 빈 출력인지, IDLE state의 Stop 필드가 초기화됐는지 각각 단언한다.

### Z4 — 순서 진술을 한 곳으로 통일한다

§39가 순서를 뒤바꿨는데 050의 §5 서두, CLI 단계 표, §11 완료 기준에는 옛 순서가 남았다. 두 감사관이
모두 같은 지점을 지적했다.

확정 순서(모든 규범 표면이 이 문장을 그대로 쓴다):

1. slug 없음(HITL) → 기존 경로, 즉시 return
2. 빈 plan → 기존 문구로 거부
3. marker 일치 recovery → 고정 대상 상태 확인 후 `closeFixedWorkPhase()`로 멱등 commit, 남은 정리 재개
4. 전부 done → all-done 특례, 첫 락 안에서 close row까지, `closedWorkPhaseId`는 null
5. target phase가 plan에 없음 → 거부
6. pending task 남음 → `tasks_pending` 거부
7. 의존 교착 → `dependencyDeadlock()` 진단으로 거부
8. 정상 close → marker → `closeFixedWorkPhase()` plan commit → goalplan 원장 → IDLE state → 최종화 락에서 PABCD 원장·marker 삭제

3번의 대상 조회는 "부재 시 거부하는 target 검증"이 아니라 "이미 커밋됐는지 판정하는 상태 확인"이다.
§38 X2의 "target 조회 없이"는 이 뜻으로 읽는다.

## 41. 라운드 11 — 공유 close helper가 게이트를 우회하지 않는다

§40 Z1의 공유 helper를 넣은 뒤 재감사에서 새 BLOCKER가 나왔다. helper가 대상 존재만 확인하고 바로
`done`으로 만들기 때문에, 그 helper를 직접 부르는 recovery가 `advanceWorkPhase()`의 pending-task
거부와 `no_active` 판정을 건너뛴다. 감사관이 임시 적용본으로 실측했다: pending task가 있는 phase에
`advanceWorkPhase()`는 `tasks_pending`을 내지만 `closeFixedWorkPhase()`는 `ok`를 내고 그 phase를 닫는다.

도달 가능한 경로다. §39가 marker 이후의 편집을 인정하고 wp6 `add-task`가 live phase에 pending task를
넣으므로, marker 직후 crash와 recovery 사이에 task가 추가되면 미완 task를 가진 phase가 닫힌다.

| # | 심각도 | 지적 | 소유 |
| --- | --- | --- | --- |
| W1 | BLOCKER | `closeFixedWorkPhase()`가 pending task와 blocked/superseded 상태를 검사하지 않아 recovery가 두 거부를 우회한다 | wp5 |
| W2 | BLOCKER | 050 §6.4 Z3 After가 `nextInjectedTurns`를 참조하는데 `hook.ts`에 그 식별자가 없다. 현재 코드는 객체 literal 안에서 `turn ? appendTurn(state.injectedTurns, turn) : state.injectedTurns`를 직접 계산한다 | wp5 |
| W3 | BLOCKER | §3 실패 표가 CLI만 최초/최종화 락으로 나누고 채팅은 한 행으로 남아 §39 Y3와 어긋난다 | wp5 |
| W4 | High | §40이 요구한 회귀 세 묶음이 050에 없다: 채팅 marker-직후 crash, all-done state-write 실패 후 재시도, Z3 필드와 same-turn dedup 단언 | wp5 |

### W1 처분 — helper가 자기 게이트를 소유한다

`closeFixedWorkPhase()`의 반환 타입을 넓혀 거부를 표현한다. 판정 소유가 호출자에 흩어지면 recovery
경로가 다시 게이트를 놓친다.

```ts
export type CloseFixedResult =
  | { kind: "ok"; plan: Goalplan; closedId: string }
  | { kind: "absent" }
  | { kind: "not_runnable"; status: WorkPhaseStatus }
  | { kind: "tasks_pending"; workPhaseId: string; pending: GoalplanTask[] };
```

- `absent`: 대상이 plan에 없다. recovery는 이미 커밋됐다고 판정해 plan write를 생략한다.
- `not_runnable`: 대상이 `blocked` 또는 `superseded`다. 정상 경로에서는 `advanceWorkPhase()`가 애초에
  이 대상을 고르지 않으므로 나타나지 않고, recovery에서는 marker 이후 상태가 바뀐 경우다.
- `tasks_pending`: 대상에 미완 task가 남았다. 정상 경로의 기존 거부와 같은 의미다.
- `ok`: 대상을 `done`으로 만들고 커서를 `advanceWorkPhase()`와 같은 after-then-wrap dependency 순서로
  옮긴 plan을 돌려준다.

확정 계약:

- `advanceWorkPhase()`는 effective 커서로 대상을 정한 뒤 이 helper에 위임하고, `tasks_pending`을 기존
  `AdvanceResult`의 같은 variant로 그대로 전달한다. 기존 거부 문구는 바뀌지 않는다.
- recovery는 `tasks_pending`과 `not_runnable`에서 **marker를 지우지 않고 fail-closed한다.** 원장과
  state를 바꾸지 않고 사람이 읽는 사유를 낸다. marker가 남으므로 운영자가 plan을 고친 뒤 같은 요청으로
  정리를 끝낼 수 있다. marker를 지우면 복구 경로가 사라지므로 절대 지우지 않는다.
- 회귀: marker 직후 crash 뒤 대상에 pending task를 추가하고 재시도하면 거부되고 marker가 남는지,
  대상을 `blocked`로 바꾼 뒤 재시도해도 같은지, 대상의 phase 의존이 미충족으로 바뀐 뒤 재시도해도
  같은지 CLI·채팅 각각 단언한다.

### W5 — helper는 dependency readiness까지 검사한다 (라운드 12)

§41 W1 수리 뒤 재감사에서 같은 우회가 한 겹 더 남은 것이 실측으로 확인됐다. wp4의 runnable 정의는
status만이 아니라 `workPhaseDependenciesMet()`까지 요구한다. helper가 blocked/superseded와 pending
task만 보면, 의존 phase가 marker 이후 `blocked`로 바뀐 경우 `advanceWorkPhase()`는 `no_active`를
내는데 helper는 `ok`를 내고 대상을 닫는다.

확정: `closeFixedWorkPhase()`는 status 검사와 pending-task 검사 사이에
`workPhaseDependenciesMet(plan, current)`를 검사한다. 미충족이면 `{ kind: "dependencies_unmet";
unmet: string[] }`으로 거부하고, recovery는 marker를 남긴 채 fail-closed한다. `advanceWorkPhase()`는
이 variant를 기존 `no_active`로 접어 넣는다 — effective 커서가 애초에 미충족 phase를 고르지 않으므로
정상 경로에서는 도달하지 않고, 반환 shape도 바뀌지 않는다.

### W6 — 채팅 marker seam 테스트는 marker 없는 fixture에서 시작한다 (라운드 12)

`afterRecoveryMarkerWrite`는 `if (!recoveringDclose)` 안에서만 호출된다. 그런데 초안의 채팅 회귀는
marker를 미리 심은 fixture로 시작해 recovery 요청에 seam을 넘겼다. seam이 호출되지 않으므로
`assert.throws()`가 실패한다.

확정: marker seam을 쓰는 회귀는 **marker 없는 정상 C fixture와 유효한 receipt**로 시작한다. 첫 요청이
marker를 쓴 직후 seam에서 실패하고, 두 번째 요청이 recovery가 되어 parity를 검증한다. CLI 회귀도 같은
규칙을 따른다(`seedBoundCycleAtC()`는 marker를 심지 않으므로 이미 맞다).

### W2 처분 — 존재하는 식만 인용한다

050 §6.4의 state write After는 `nextInjectedTurns`를 새로 만들지 않는다. 현재 객체 literal의
`injectedTurns: turn ? appendTurn(state.injectedTurns, turn) : state.injectedTurns`를 그대로 옮겨
쓴다. Before 블록에도 이 줄을 포함해 적층이 보이게 한다.

### W3 처분 — 채팅도 두 행으로 나눈다

§3 실패 표에 `채팅 D-close (최초 락)`과 `채팅 D-close (최종화 락)`을 별도 행으로 둔다. 최초 락은
전이 없음 + 경고 + hook code 0, 최종화 락은 FSM이 이미 IDLE인 미완 보고 + marker 잔존 + hook code 0이다.
표 아래 설명도 최초 락에만 한정한다.

### W4 처분 — 요구한 회귀를 모두 적는다

§40이 글로만 요구하고 050이 코드로 적지 않은 세 묶음을 추가한다. 채팅 seam에
`afterRecoveryMarkerWrite`를 넣고, all-done 테스트에 state-write 실패와 재시도를 넣고, 채팅 state
write 회귀에 `injectedTurns` 유지·Stop 필드 초기화·같은 turn 재실행 빈 출력을 단언한다. 추가 뒤 §10.1의
개수 oracle을 실제 선언 수로 다시 계산한다.

## 42. 라운드 13 — `done`만으로 plan commit을 단정하지 않는다

§40 Z1은 recovery가 status 하나만 고치는 것을 막았다. 그런데 반대 방향이 열려 있었다. recovery가
고정 대상이 이미 `done`이면 `closeFixedWorkPhase()`를 호출하지 않고 원장·state 정리로 넘어간다.
`done`을 plan commit이 끝났다는 증거로 단독 사용한 것이다.

marker 직후 crash 상태는 `activeWorkPhaseId=wp-1`, `wp-1=in_progress`다. 여기서 plan을 손편집해
`wp-1.status="done"`만 기록하고 커서를 그대로 두면 recovery가 아래를 전부 건너뛴다.

- helper의 not_runnable·dependencies_unmet·tasks_pending 세 게이트
- plan write. 커서가 done인 `wp-1`에 그대로 남는다
- 그 결과 `startedId`가 `wp-1`이 되어 거짓 `started wp-1` 행을 기록한다
- successor `wp-2`는 pending으로 남고 state는 IDLE, marker는 삭제된다

§40 Z1이 막으려던 커서 손상이 같은 모양으로 다시 열린다. 계약은 marker 이후 외부 편집(대상 삭제
포함)을 이미 인정하므로 status만 바뀐 편집도 배제할 수 없다.

처분: **commit 판정에 커서를 함께 본다.** 정상 close는 `closeFixedWorkPhase()`가 대상을 `done`으로
만들고 커서를 대상에서 옮긴다. 따라서 commit이 끝났다는 증거는 두 조건이 함께 참인 것이다.

```ts
const committed = fixed?.status === "done" && plan.activeWorkPhaseId !== closePhaseId;
```

`committed`가 거짓이면 helper를 다시 실행한다. helper는 `done` 대상을 받아들이므로 멱등하며, 세
게이트를 그대로 통과시키고 커서까지 정리한다. CLI와 채팅 두 표면이 같은 문장을 쓴다.

회귀는 두 표면 각각에 marker 직후 crash 뒤 status만 `done`으로 바꾸는 fixture를 두고, 재시도가
커서를 successor로 옮기고 `started wp-2` 행을 남기며 거짓 `started wp-1`을 만들지 않는지 단언한다.

## 43. 라운드 14 — commit 판정은 helper만 한다

§42는 `done`만으로 commit을 단정하는 것을 막고 커서까지 함께 보게 했다. 그런데 커서가 실제로
옮겨진 경우, 즉 plan commit이 정말 끝난 뒤 crash한 경우가 여전히 열려 있었다. 그때는 `committed`가
참이므로 helper를 아예 호출하지 않는다.

재현 상태는 아래다.

- marker가 `wp-1`을 지목
- plan commit 완료: `wp-1=done`, `wp-2=in_progress`, 커서 `wp-2`
- 재시도 전 손편집으로 `wp-1`에 pending task 추가

D-close가 호출하는 두 integrity helper는 이 상태를 거부하지 않는다. `goalplan.ts:943`의
`doneWorkPhasesWithPendingTasks()`가 바로 이 모양을 잡는 함수인데 D-close 경로가 쓰지 않는다.
실측 preflight는 `definition: []`, `dependency: []`, `doneWithPending: ["wp-1"]`이었다. 그래서
recovery가 `workphase_done` 원장과 IDLE state를 확정하고, plan에는 pending task를 숨긴 done phase가
남는다. 기존 pending·blocked·dependency 회귀는 모두 target이 아직 `in_progress`인 marker 직후만
검사하므로 이 분기를 잡지 못한다.

처분: **호출자는 commit 여부를 판정하지 않는다.** 고정 대상이 plan에 있으면 status와 무관하게 항상
`closeFixedWorkPhase()`를 호출한다. helper는 not_runnable·dependencies_unmet·tasks_pending 세
게이트를 먼저 통과시킨 뒤에만, 그리고 대상이 `done`이고 커서가 대상을 벗어난 경우에만
`already_done`을 답한다. `already_done`은 plan write가 필요 없다는 뜻이며 그 판단은 게이트 뒤에서만
나온다.

```ts
if (current.status === "done" && plan.activeWorkPhaseId !== workPhaseId) {
  return { kind: "already_done" };
}
```

`already_done`과 `absent`는 둘 다 plan write 없이 남은 정리만 진행한다. CLI와 채팅이 같다.

회귀는 두 표면 각각에 plan commit 뒤 crash를 주입하고, done인 `wp-1`에 pending task를 넣은 뒤
재시도가 `tasks_pending`으로 거부되고 marker가 남는지 단언한다.

## 44. 라운드 15 — commit은 plan 전체 모양으로 판정한다

§43은 호출자에게서 판정을 빼앗아 helper로 옮겼다. 그런데 helper의 `already_done` 조건이 여전히
`done` + 커서 이동 두 개뿐이었다. 손편집으로 둘을 함께 만들면 위조된다.

```text
wp-1.status = done
activeWorkPhaseId = wp-2
wp-2.status = pending      <- 활성화되지 않았다
```

이 상태에서 `already_done`을 답하면 `started wp-2` 행을 기록하는데 plan의 `wp-2`는 pending이다.
커서를 `null`로 바꾸면 successor 활성화와 `workphase_started` 행이 함께 사라지고, 다른 phase를
가리키면 엉뚱한 phase가 started로 기록된다.

처분: **완료된 close가 남기는 모양 전체와 대조한다.** 정상 close 뒤 plan은 둘 중 하나다.

- 커서가 대상이 아닌 `in_progress` phase를 가리킨다
- 남은 runnable pending phase가 없어 커서가 `null`이다

두 모양 중 하나에 정확히 맞을 때만 `already_done`이다. 아니면 아래 변환으로 떨어져 정상 close와
같은 after-then-wrap으로 커서와 successor를 다시 세운다.

감사관이 지적한 재적용 위험도 이 판정으로 닫힌다. 정상 commit된 plan은 `settled`가 참이라 변환에
도달하지 않으므로, `in_progress` successor를 pending 후보로 찾지 못해 커서가 `null`이 되는 경로가
생기지 않는다. 위조된 모양만 변환을 타며 그때 커서 복구가 정확히 필요한 동작이다.

회귀는 marker 직후 crash 뒤 `wp-1=done`·커서 `wp-2`·`wp-2=pending`으로 손편집하고, 재시도가
`wp-2`를 `in_progress`로 만들고 `started wp-2` 행이 실제 활성화와 일치하는지 단언한다.

## 45. 라운드 16 — commit 판정은 술어가 아니라 동일성이다

§42는 커서를 함께 보게 했고 §43은 판정을 helper로 옮겼고 §44는 완료 모양 두 가지와 대조하게 했다.
그런데 술어를 정교하게 만드는 방향은 매번 새 위조를 낳았다. 감사에서 실측으로 확인된 위조가 네 개다.

| 위조 | 옛 술어 결과 |
| --- | --- |
| 커서가 `pending` phase를 가리킨다 | §44 이전 settled |
| 커서 phase가 `in_progress`지만 의존이 미충족 | §44도 settled |
| 커서가 진짜 successor가 아닌 임의 phase | §44도 settled |
| 커서 `null`인데 `in_progress` phase가 남아 있다 | §44도 settled |

처분: **술어를 버리고 동일성으로 판정한다.** helper는 게이트를 통과한 뒤 이 close가 만들 plan을
먼저 계산하고, 입력 plan이 그것과 구조적으로 같을 때만 `already_done`을 답한다. 위조는 어딘가
반드시 계산 결과와 다르므로 빠져나갈 틈이 없다.

```ts
if (samePlanShape(plan, settledPlan)) return { kind: "already_done" };
return { kind: "ok", closedId: workPhaseId, plan: settledPlan };
```

`samePlanShape()`는 close가 쓰는 필드만 본다 — 커서, 그리고 각 phase의 id·status·dependsOn과 task의
id·status다. 전체 JSON을 비교하면 timestamp와 산문 때문에 이유 없이 깨진다.

후보 선택에는 한 가지 정규화가 필요하다. 재시도 시점의 plan에는 앞선 시도가 활성화한 successor가
`in_progress`로 남아 있을 수 있고, `pending`만 찾으면 아무것도 못 골라 커서를 `null`로 만들어
이미 올바른 plan을 망친다. 그래서 대상이 아닌 `in_progress` phase는 **선택 단계에서만** `pending`으로
읽는다. 기록되는 plan은 정규화 전 status를 쓰므로 선택되지 않은 phase의 status는 그대로다.

커서가 가리키는 phase만 정규화하는 초안은 부족했다. 커서를 `null`로 위조해 `in_progress` phase를
고립시키면 계산 결과와 일치해 settled가 되었다. 실측으로 재현했다.

실측 검증: 이 명세를 실제 `goalplan.ts`에 적용해 goalplan·work-phase-states·orchestrate-cli·goal-gate
네 파일을 실행하면 `tests 162 / pass 162 / fail 0`이며, 직접 호출 probe 일곱 경우가 아래처럼 나온다.

| 입력 | 결과 |
| --- | --- |
| 첫 실행 (`wp-1` in_progress, `wp-2` pending) | `ok`, 커서 `wp-2` |
| 진짜 commit 재적용 | `already_done` |
| 커서가 pending phase | `ok`, `wp-2`를 in_progress로 복구 |
| 커서 phase의 의존 미충족 | `ok`, 커서 `null`로 정직하게 정리 |
| 커서 null + 고립된 in_progress | `ok`, 커서 `wp-2`로 복구 |
| 전부 done, 커서 null | `already_done` |
| 무관한 running phase 존재 | `ok`, 그 phase는 강등되지 않음 |

회귀는 위조 네 가지 중 CLI에 커서-pending, 커서 null+고립, 의존 미충족 세 경우를 두고 채팅에
커서-pending 한 경우를 둔다.

비교에서 빠진 필드로 위조가 되는지도 실측했다. `title`, `criteriaIds`, task `outcome`이 달라도
`already_done`이 나오는데 이것이 옳다 — close는 그 필드를 쓰지 않으므로 다르다는 사실이 재작성
사유가 되지 않는다. done task의 `outcome` 부재는 wp3 schema 무결성이 소유한다. phase 순서를 바꾼
plan과 pending phase가 하나 더 붙은 plan도 `already_done`이며, 두 경우 모두 그 입력이 실제로 이
close가 만들 모양과 같기 때문이다. 한 번에 한 phase만 도는 계약에서 뒤에 붙은 pending phase는
건드릴 대상이 아니다.

## 46. 라운드 17 — 선택 정규화는 recovery 재적용에만 적용한다

§45의 선택 정규화가 정상 close에도 적용되어 wp4가 잠근 pending-only after-then-wrap을 바꿨다.
`goalplanDefinitionIntegrityReasons()`는 복수 `in_progress`를 거부하지 않으므로 도달 가능한 입력이다.
실측 비교는 아래다.

```text
입력: wp-1=in_progress(대상), wp-2=in_progress, wp-3=pending
advanceWorkPhase():            커서 wp-3
무조건 정규화한 helper:         커서 wp-2   <- wp4 규칙 위반
```

구현하면 이미 실행 중인 `wp-2`에 `started wp-2`를 다시 기록하고 시작해야 할 `wp-3`를 남긴다.
§45의 “무관한 running phase는 강등되지 않는다” 확인은 status만 봤기 때문에 이 커서 변경을 놓쳤다.

처분: 정규화 조건을 **재적용일 때로만** 좁힌다. 재적용은 진입 시점에 대상이 이미 `done`인 경우다.

```ts
const reapplying = current.status === "done";
const selectable = reapplying
  ? closedWorkPhases.map((wp) =>
      wp.id !== workPhaseId && wp.status === "in_progress"
        ? { ...wp, status: "pending" as const }
        : wp
    )
  : closedWorkPhases;
```

첫 close는 정규화하지 않으므로 wp4 선택이 그대로 유지된다. 재적용에서만 앞선 시도가 활성화한
successor를 후보로 되읽는다.

실측 재검증: 이 조건을 적용하면 같은 입력에서 `advanceWorkPhase()`와 `closeFixedWorkPhase()`가 둘 다
커서 `wp-3`를 낸다. §45 probe 일곱 경우와 4파일 `tests 162 / pass 162 / fail 0`도 그대로다.

회귀는 대상 외 `in_progress` phase가 있는 plan에서 두 함수의 결과 plan을 한 `deepEqual`로 묶는다.

`reapplying`을 `current.status === "done"`으로 판정하는 것이 충분한지도 실측했다. 사용자가 대상을
수동으로 `done` 표시한 뒤 첫 close를 요청하는 경우가 이 조건에 걸린다. 그때 `wp-1=done`·커서 `wp-1`·
`wp-2=in_progress`·`wp-3=pending`이면 helper는 커서를 `wp-2`로 정리하고, 같은 입력의
`advanceWorkPhase()`는 `wp-3`를 낸다. 이 차이는 결함이 아니다 — `advanceWorkPhase()`는 effective
커서를 스스로 골라 `wp-2`를 닫는 반면 helper는 `wp-1`을 닫으라고 지시받았다. 서로 다른 대상을 닫으므로
결과가 다른 것이 고정 target 계약의 정의다. helper의 결과는 정직하다: `wp-1`은 done이고 실제로 실행
중인 `wp-2`가 커서가 된다. §46 parity 회귀는 대상이 `in_progress`인 입력, 즉 두 함수가 같은 대상을
닫는 경우만 묶는다.

## 47. 라운드 18 — 정규화 대상은 커서가 지목한 phase 하나뿐이다

§46은 정규화를 재적용으로 좁혔지만 재적용 안에서는 여전히 대상 외 모든 `in_progress` phase를 훑었다.
그 결과 정상 close의 결과 plan을 그대로 다시 넣으면 `already_done`이 나오지 않는다. 첫 close가 대상을
`done`으로 만들고 successor를 `in_progress`로 올려두었으니 재입력은 `current.status === "done"`을
만족해 재적용으로 판정되고, 그때 successor보다 앞서 실행 중이던 다른 phase까지 `pending`으로 강등되어
후보 검색이 그 phase를 고른다. 커서가 뒤로 밀리고 `samePlanShape()`가 어긋나 두 번째 write가 나간다.
crash 재시도가 의존하는 멱등성이 바로 이 지점에서 깨진다.

실측:

```text
입력: wp-1=in_progress(대상), wp-2=in_progress, wp-3=pending
첫 close 결과:  커서 wp-3, [wp-1=done, wp-2=in_progress, wp-3=in_progress]
그 결과 재입력: §46 판본은 wp-2를 강등해 커서를 wp-2로 되돌린다  <- 멱등성 위반
```

처분: 정규화 대상을 **커서가 지목한 phase 하나**로 좁힌다. 그 phase가 곧 앞선 시도가 활성화한
successor이므로 recovery가 되읽어야 하는 것은 그것뿐이다.

```ts
const selectable = closedWorkPhases.map((wp) =>
  wp.id !== workPhaseId
    && wp.status === "in_progress"
    && plan.activeWorkPhaseId === wp.id
    && current.status === "done"
    ? { ...wp, status: "pending" as const }
    : wp
);
```

네 조건이 각각 무엇을 막는지: `wp.id !== workPhaseId`는 대상 자신을 되돌리지 않고,
`status === "in_progress"`는 이미 끝난 phase를 되살리지 않고, `plan.activeWorkPhaseId === wp.id`는
커서가 가리키지 않는 무관한 running phase를 보호하고, `current.status === "done"`은 첫 close에서
정규화가 일어나지 않게 해 wp4 parity를 지킨다.

실측 재검증 넷을 모두 확인했다. wp4 parity 입력에서 `advanceWorkPhase()`와 `closeFixedWorkPhase()`가
둘 다 커서 `wp-3`를 냈다. §45 probe 일곱 경우가 그대로였고, 특히 7번 "무관한 running phase는 강등되지
않는다"가 유지됐다. 새 왕복 probe 다섯 경우 — 단순 pending successor, 다른 phase 실행 중, 수동 done
대상, 앞으로 감싸는 후보, successor 없음 — 에서 첫 close 결과를 다시 넣으면 전부 `already_done`이었다.
`goalplan.test.ts`, `work-phase-states.test.ts`, `orchestrate-cli.test.ts`, `goal-gate.test.ts`
네 파일이 `tests 162 / pass 162 / fail 0`, exit 0이었다. 확인 뒤 원본과 바이트 동일로 복원했다.

회귀 둘을 추가한다. 하나는 정상 close 결과를 helper에 다시 넣어 `already_done`을 단언하는 왕복
테스트다. 다른 하나는 marker 직후 status-only 편집이 끼어들고 기존 `in_progress` phase와 pending
successor가 함께 있는 plan에서 재시도가 커서를 뒤로 밀지 않는지 본다.

§43과의 관계도 같이 정리한다. 표 §6.3의 recovery 행에 "대상이 아직 `done`이 아니면 helper를 부른다"가
남아 있었는데, 이는 판정을 호출자에게 되돌려주는 문구여서 §43과 어긋났다. 대상이 plan에 있으면 상태를
보지 않고 항상 helper를 부르고, `already_done`일 때만 plan write를 생략한다로 통일한다.

## 48. 라운드 19 — 의도한 successor를 marker에 남긴다

§47까지 다섯 판본이 모두 같은 레버를 돌렸다. plan 파일 내용만 보고 "내 close가 이미 반영됐는가"를
판정하려 했고, 매번 그 판정을 통과하는 손편집이 나왔다. 라운드 18에서 감사관이 확정한 반례가 이
접근의 한계를 보여준다.

```text
파일 상태: wp-1=done(대상), wp-2=in_progress, wp-3=pending, 커서=wp-2

역사 A: 첫 시도가 wp-2를 successor로 골라 commit을 끝냈다 -> already_done이 맞다
역사 B: wp-2는 원래부터 실행 중이었고 정상 close는 wp-3를 골라야 한다 -> ok가 맞다
```

같은 바이트가 두 역사와 모두 정합적이다. plan 안에는 둘을 구별할 정보가 없다. 커서를 보든, status를
보든, 계산한 모양과 동일성을 비교하든 마찬가지다 — 동일성 비교는 "역사 A가 맞다면 이 모양"을 계산하는
것이므로 역사 B의 파일이 우연히 그 모양이면 구별하지 못한다. §47이 커서를 신뢰해 위조를 허용한 것도,
§45가 커서 `null` 위조를 복구하려다 §47에서 그 경로를 닫은 것도 같은 뿌리다.

처분: 판정을 plan에서 빼내 marker로 옮긴다. marker는 이미 durable하고 이미 세 값을 담고 있으므로
네 번째 값을 더한다. 첫 시도가 고른 successor를 plan commit **전에** 기록하므로, 재시도는 파일을
심문하는 대신 자기가 무엇을 하려 했는지 읽는다.

```ts
export interface DcloseRecoveryMarker {
  sessionId: string;
  checkEpoch: string;
  closedWorkPhaseId: string;
  nextWorkPhaseId: string | null;
}
```

helper는 세 번째 인자로 그 값을 받는다. 첫 시도는 인자를 주지 않으므로 wp4 선택이 그대로 쓰이고,
재시도만 지목된 phase 하나를 후보로 되읽는다.

```ts
const selectable = intendedNextId
  ? closedWorkPhases.map((wp) =>
      wp.id === intendedNextId && wp.id !== workPhaseId && wp.status === "in_progress"
        ? { ...wp, status: "pending" as const }
        : wp
    )
  : closedWorkPhases;
```

`samePlanShape()` 동일성 판정은 그대로 남는다. 다만 이제 그것이 판정의 전부가 아니다. 재시도는
"내가 의도한 successor를 되읽은 뒤 계산한 모양"과 비교하므로, 역사 A와 역사 B가 서로 다른
`intendedNextId`를 낳고 두 경우가 분리된다.

marker에 successor가 없는 경우도 정직하게 처리된다. `nextWorkPhaseId: null`은 첫 시도가 후보를 찾지
못했다는 뜻이고, 그때 정규화할 대상도 없다. `readStateStrict()`는 이 필드가 문자열이거나 없을 때만
marker를 복원하며, 없으면 `null`로 채운다. 기존 세 값 marker가 남아 있는 state도 그대로 읽힌다 —
정규화 없이 재시도하면 wp4 선택 규칙이 적용되고, 그것이 §47 이전의 동작이다.

실측 검증. 이 명세를 실제 `goalplan.ts`에 적용해 확인했다.

| 입력 | `intendedNextId` | 결과 |
| --- | --- | --- |
| wp-1 in_progress(대상), wp-2 in_progress, wp-3 pending | 없음 (첫 시도) | `ok`, 커서 `wp-3` — `advanceWorkPhase()`와 동일 |
| wp-1 done, wp-2 in_progress, 커서 wp-2 | `wp-2` | `already_done` |
| wp-1 done, wp-2 pending, 커서 wp-2 | `wp-2` | `ok`, `wp-2`를 in_progress로 복구 |
| wp-1 done, wp-2 in_progress, 커서 `null` | `wp-2` | `ok`, 커서 `wp-2`로 복구 |
| wp-1 in_progress, wp-2 pending, 커서 wp-1 | `wp-2` | `ok`, 정상 close |
| wp-1 done, wp-2 in_progress, wp-3 pending, 커서 위조 wp-2 | `wp-3` | `ok`, 커서 `wp-3` — 위조 무시 |
| 위 결과 그대로 재입력 | `wp-3` | `already_done` |

왕복 세 경우 — pending successor, 다른 phase 실행 중, successor 없음 — 도 첫 결과의 커서를
`intendedNextId`로 넣으면 전부 `already_done`이었다. `goalplan.test.ts`,
`work-phase-states.test.ts`, `orchestrate-cli.test.ts`, `goal-gate.test.ts` 네 파일이
`tests 162 / pass 162 / fail 0`, exit 0이었다. 확인 뒤 원본과 바이트 동일로 복원했다.

§47 판본을 되돌려 같은 입력을 넣어 두 판본을 나란히 비교했다. 커서 `null`+고립 위조에서 §47은
`already_done`을 내고 §48은 `ok`, 커서 `wp-2`를 낸다. §45가 그 입력에 확정한 답이 후자이므로 §47은
계약을 깨는 판본이었다. 새 위조-커서 회귀도 §47 판본에서 실제로 실패하며, 왕복 회귀만으로는 §47이
통과하므로 위조 회귀가 실질 방어선이다.
§45가 세운 위조 회귀 세 건이 그대로 성립한다. 커서-pending, 커서 `null`+고립, 의존 미충족 모두
`intendedNextId`가 있으면 복구되고, 의존 미충족은 helper의 readiness 게이트가 먼저 거부한다.
§46 parity 회귀도 첫 시도 경로이므로 인자 없이 호출되어 그대로다.

두 표면의 marker 기록 지점도 함께 바뀐다. CLI와 채팅 모두 정상 close에서 `advanceWorkPhase()`
결과의 `activeWorkPhaseId`를 marker에 담아야 하므로, marker write가 plan 계산 **뒤**로 이동한다.
§40 Z4 8단계 순서는 그대로다 — marker는 여전히 plan commit 전에 기록된다.

회귀를 하나 더 둔다. 정상 close의 marker를 읽어 `nextWorkPhaseId`가 실제 successor와 같은지 단언하고,
그 marker로 재시도했을 때 커서가 뒤로 밀리지 않는지 본다. 위조된 커서로 재시도하는 회귀도 CLI에 둔다 —
marker가 `wp-3`를 가리키는데 파일 커서가 `wp-2`면 복구 결과는 `wp-3`여야 한다.

## 49. 라운드 20 — 복구도 자기 선택을 marker에 다시 남긴다

§48 자체 검증에서 결함을 찾았다. `nextWorkPhaseId`가 가리키는 phase가 재시도 시점에 후보가 될 수 없으면
복구는 다른 phase를 고르는데, marker는 낡은 값을 그대로 갖고 있다. 그래서 그 결과를 다시 넣으면
정규화가 걸리지 않고 후보 검색이 실패해 커서가 `null`로 밀린다. 정상 plan이 손상되고, 한 번 더 넣으면
그 손상 상태가 `already_done`으로 확정된다.

```text
입력: wp-1=done(대상), wp-3=pending, 커서 null, marker의 successor=wp-2 (삭제됨)
1차: ok  커서 wp-3, [wp-1=done, wp-3=in_progress]      <- 정직한 복구
2차: ok  커서 null,  [wp-1=done, wp-3=in_progress]      <- 손상
3차: already_done                                       <- 손상 확정
```

의도한 successor가 삭제된 경우, `blocked`가 된 경우, 손으로 `done` 표시된 경우, 의존이 끊긴 경우,
marker가 대상 자신을 가리키는 경우 다섯 가지가 모두 같은 방식으로 발산했다.

처분: 복구가 helper에서 `ok`를 받으면 plan commit **전에** marker의 `nextWorkPhaseId`를 그 결과의
`activeWorkPhaseId`로 갱신한다. 정상 close가 이미 그 순서로 marker를 기록하므로 규칙이 하나로 통일된다 —
plan을 쓰기 직전의 marker는 언제나 그 write가 만들 커서를 담는다.

```ts
if (closed.kind === "ok") {
  // §49: the marker must describe the write that is about to happen, not the one an
  // earlier attempt planned. If the recorded successor vanished or became unusable,
  // this close picks a different one, and leaving the stale id behind makes the next
  // retry re-read a phase that is no longer a candidate — nulling the cursor on a
  // plan that was already correct.
  if (closed.plan.activeWorkPhaseId !== state.dcloseRecovery.nextWorkPhaseId) {
    writeState(args.cwd, {
      ...state,
      dcloseRecovery: { ...state.dcloseRecovery, nextWorkPhaseId: closed.plan.activeWorkPhaseId },
    });
  }
  closedPlan = closed.plan;
  writeClosedPlan = true;
}
```

실측으로 여섯 경우를 확인했다. 갱신을 넣으면 삭제·blocked·수동 done·의존 끊김·대상 자신 지목·위조 커서
모두 한 번의 write 뒤 두 번째 호출에서 `already_done`으로 정착한다. 갱신이 없으면 앞의 다섯 경우가
`ok -> ok -> already_done`으로 발산한다.

이 갱신은 §40 Z4 8단계 순서를 바꾸지 않는다. marker는 여전히 plan commit 전에 기록되고, 복구가 marker를
지우는 시점도 그대로 둘째 락 안이다. 갱신 자체가 실패하면 marker는 낡은 값으로 남고 plan은 아직 쓰이지
않았으므로, 다음 재시도가 같은 판단을 다시 해서 같은 갱신을 시도한다.

채팅 경로도 같은 갱신을 한다. 두 표면이 같은 helper를 쓰므로 한쪽만 고치면 §40 Z1이 깨진다.

회귀는 의도한 successor가 삭제된 plan에서 복구를 두 번 돌려 두 번째가 `already_done`이고 커서가
그대로인지 단언한다. marker의 `nextWorkPhaseId`가 갱신됐는지도 함께 본다.

## 50. 라운드 21 — marker의 successor는 힌트가 아니라 강제다

§48이 successor를 marker에 남겼지만 helper는 그 값을 후보 하나를 되읽는 힌트로만 썼고, 정규화 뒤에는
다시 plan 전체를 after-then-wrap으로 검색했다. 감사관 2기가 각각 같은 결함을 재현했다: 기록된
successor를 쓸 수 없게 되면 helper가 조용히 **다른** phase를 골라 그것으로 close를 확정한다.

```text
marker next=wp-3, wp-3 삭제, wp-2=pending          -> 커서 wp-2, started wp-2
marker next=wp-3, wp-3=blocked, wp-2=pending       -> 커서 wp-2, started wp-2
marker next=wp-3, wp-3 앞에 wp-2=pending 삽입      -> 커서 wp-2, started wp-2
marker next=null, 재시도 전 wp-2=pending 추가      -> 커서 wp-2, started wp-2
```

네 경우 모두 marker가 보존한 의도와 다른 close를 plan에 쓰고 원장에 기록한 뒤 marker를 지운다.
§49가 이 fallback을 "정직한 복구"로 보고 marker를 갱신하는 처방을 냈는데, 그것이 틀렸다. 복구는
자기 판단을 새로 하는 것이 아니라 앞선 시도가 확정한 판단을 완성하는 것이다.

`undefined`와 `null`을 truthiness 하나로 합친 것도 결함이다. 두 값의 뜻이 다르다.

| 값 | 뜻 | 동작 |
| --- | --- | --- |
| `undefined` | 최초 close다. 아직 아무 결정도 없다 | wp4 after-then-wrap으로 successor를 계산한다 |
| `null` | 앞선 시도가 "successor 없음"을 확정했다 | successor를 `null`로 고정하고 검색하지 않는다 |
| 문자열 | 앞선 시도가 그 phase를 골랐다 | 정확히 그 phase만 successor가 된다 |

처분: 세 상태를 분리하고, 문자열 intent가 쓸 수 없는 상태면 다른 phase로 넘어가지 않고 fail-closed
한다. 새 variant `successor_lost`가 그 사유를 담는다.

```ts
  let next: { id: string } | undefined;
  if (recordedNext === undefined) {
    const after = closedWorkPhases.slice(currentIdx + 1).find(
      (wp) => wp.status === "pending" && workPhaseDependenciesMet(closedPlan, wp),
    );
    next = after ?? closedWorkPhases.slice(0, currentIdx).find(
      (wp) => wp.status === "pending" && workPhaseDependenciesMet(closedPlan, wp),
    );
  } else if (recordedNext === null) {
    next = undefined;
  } else {
    const named = closedWorkPhases.find((wp) => wp.id === recordedNext);
    if (!named) return { kind: "successor_lost", successorId: recordedNext, reason: "absent" };
    if (named.status !== "pending" && named.status !== "in_progress") {
      return { kind: "successor_lost", successorId: recordedNext, reason: "not_runnable" };
    }
    if (!workPhaseDependenciesMet(closedPlan, named)) {
      return { kind: "successor_lost", successorId: recordedNext, reason: "dependencies_unmet" };
    }
    next = named;
  }
```

문자열 경로에는 §47까지의 status 정규화가 아예 없다. 지목된 phase가 `pending`이든 `in_progress`든
똑같이 successor가 되므로, "앞선 시도가 활성화해 둔 phase를 후보로 되읽는다"는 우회가 필요 없다.
이것이 다섯 판본을 괴롭힌 정규화 자체를 없앤다.

`successor_lost`는 다른 거부와 같은 fail-closed 규칙을 따른다. marker를 남겨 두어 사람이 plan을
고치고 같은 D 요청으로 마칠 수 있게 한다. 거부 문구는 사유별로 다르다.

```text
absent:            recovery target wp-1 was closed with successor wp-3, which is no longer in the plan
not_runnable:      ... successor wp-3, which is now blocked
dependencies_unmet: ... successor wp-3, which now waits for wp-4
```

실측 검증. 이 명세를 실제 `goalplan.ts`에 적용해 확인했다.

| 입력 | 결과 |
| --- | --- |
| 첫 close (인자 없음), wp-1 in_progress·wp-2 in_progress·wp-3 pending | `ok` 커서 `wp-3` — `advanceWorkPhase()`와 동일 |
| 기록 `wp-3` 삭제, wp-2 pending | `successor_lost` `wp-3`/absent |
| 기록 `wp-3` blocked, wp-2 pending | `successor_lost` `wp-3`/not_runnable |
| 기록 `wp-3` 앞에 wp-2 pending 삽입 | `ok` 커서 `wp-3` — 삽입이 의도를 바꾸지 못한다 |
| 기록 `null`, wp-2 pending 추가 | `already_done` — successor 없음이 유지된다 |
| 기록 `wp-2` 의존 미충족 | `successor_lost` `wp-2`/dependencies_unmet |
| 커서 `null` + 고립 wp-2, 기록 `wp-2` | `ok` 커서 `wp-2` — §45 복구 유지 |
| 커서가 pending wp-2, 기록 `wp-2` | `ok` 커서 `wp-2` |
| 위조 커서 `wp-2`, 기록 `wp-3` | `ok` 커서 `wp-3` |
| 진짜 commit 재입력, 기록 `wp-2` | `already_done` |
| marker 직후 crash, 기록 `wp-2` | `ok` 커서 `wp-2` |
| 단일 phase, 기록 `null` | `ok` 커서 `null`, 재입력 `already_done` |

왕복 세 경우도 첫 결과의 커서를 그대로 넣으면 `already_done`이다. 네 파일이
`tests 162 / pass 162 / fail 0`, exit 0이었고 확인 뒤 원본과 바이트 동일로 복원했다.

§49의 marker 갱신은 이 판본에서 필요 없다. 복구가 다른 successor를 고르는 일이 아예 없으므로 갱신할
낡은 값이 생기지 않는다. §49가 막으려던 발산(`ok -> ok -> already_done`)도 fallback이 사라져 발생하지
않는다. 두 표면의 복구 분기에서 갱신 코드를 걷어내고, 대신 `successor_lost` 거부를 넣는다.

legacy marker에 안전한 해석이 없다는 것도 실측으로 확정했다. 필드 없는 marker는 두 상태에서 존재할 수 있다.

```text
L1 marker 직후 crash:   wp-1=in_progress, wp-2=pending, 커서 wp-1
L2 plan commit 직후 crash: wp-1=done, wp-2=in_progress, 커서 wp-2
```

`undefined`로 취급하면 L1은 `ok` 커서 `wp-2`로 올바르게 끝나지만 L2는 pending 후보가 없어 `ok` 커서
`null`로 정상 plan을 망가뜨린다. `null`로 취급하면 L1이 successor를 시작하지 않고 끝나고 L2도 여전히
커서를 `null`로 덮는다. 대상 status를 판별자로 쓰는 것도 안 된다 — 대상이 `done`이면서 커서가 위조된
L3에서는 `already_done`이 나와야 하고, 그 입력은 L2와 status가 같다.

그래서 필드 부재는 `null`과 구별해 보존하고 그 marker는 fail-closed한다. `readStateStrict()`가
`nextWorkPhaseId` 키의 존재 자체를 보고 `legacy: true`를 표시하며, 복구 분기는 그 marker에서 아무
write도 하지 않고 아래 진단으로 거부한다.

```text
orchestrate D: the recovery marker for wp-1 predates the successor field, so this retry
cannot tell whether the plan commit landed. The marker was kept; inspect the goalplan,
set the work-phase statuses and activeWorkPhaseId by hand, then run
`cxc orchestrate reset --session <id>` to clear the marker. Nothing was written.
```

이 경로가 실제로 도달 가능한 창은 좁다 — §48 이전 버전이 D-close 도중 죽고, 업그레이드 뒤 같은 세션이
같은 요청을 다시 내는 경우뿐이다. 그래도 조용히 plan을 망가뜨리는 대신 사람에게 넘긴다.

회귀 둘을 둔다. 하나는 `nextWorkPhaseId` 키가 없는 marker를 state에 심어 CLI가 code 1과 이 진단을 내고
plan 바이트와 marker가 그대로인지 단언한다. 다른 하나는 `readStateStrict()`가 그 marker를 `legacy: true`로
복원하고 새 형식 marker는 `legacy` 없이 복원하는지 본다.

## 51. 라운드 22 — 완주한 successor는 잃어버린 successor가 아니다

§50을 자체 검증하다 `successor_lost`가 만드는 영구 교착을 찾았다. marker가 지목한 successor가 자기
cycle을 정상적으로 끝내 `done`이 되면, 남아 있던 marker의 재시도가 `not_runnable`로 막힌다. 탈출하려면
완료된 work-phase를 `pending`으로 되돌리거나 marker를 버려야 한다.

```text
wp-1 close가 marker 정리 전에 죽었고, 그 사이 wp-2가 자기 cycle로 완주했다
입력: wp-1=done, wp-2=done, 커서 null, marker의 successor=wp-2
§50: successor_lost wp-2/not_runnable   <- 갇힌다
정답: already_done                       <- 이 close는 실제로 끝났다
```

`done`은 "이 phase를 시작할 수 없다"가 아니라 "이미 시작했고 끝났다"는 뜻이다. marker가 그것을
activate하려 했고 그 일은 벌어졌다. 그래서 활성화할 것이 남지 않았다고 보고 successor를 비운 뒤
settled-shape 비교에 맡긴다. 그 비교가 `already_done`을 내며, 그것이 이 close의 진실이다.

```ts
    if (named.status === "done") {
      next = undefined;
    } else if (named.status !== "pending" && named.status !== "in_progress") {
      return { kind: "successor_lost", successorId: recordedNext, reason: "not_runnable" };
    } else if (!workPhaseDependenciesMet(closedPlan, named)) {
      return { kind: "successor_lost", successorId: recordedNext, reason: "dependencies_unmet" };
    } else {
      next = named;
    }
```

marker가 대상 자신을 successor로 지목한 경우는 전용 가드로 먼저 잡는다. close는 자기가 방금 끝낸
phase를 activate하지 않으므로 그런 marker는 손상된 것이다. 가드가 없으면 위 `done` 규칙이 그것을
삼키고, 대상이 아직 열려 있는 경우에는 커서를 조용히 `null`로 만든다. 실측으로 두 경우 모두 확인했다.

`blocked`와 `superseded`는 그대로 거부한다. 두 상태는 "시작한 적 없고 지금도 시작할 수 없다"이므로
marker의 의도가 아직 이뤄지지 않았고, 사람이 plan을 고쳐야 한다.

빈 문자열도 함께 막았다. `readStateStrict()`가 이미 `null`로 정규화하지만 손으로 쓴 state 파일이
들어오면 `successorId`가 비어 있는 거부 문구가 나온다. helper에서 `null`과 같이 취급한다.

실측으로 확인한 경계 일곱 가지다.

| 입력 | 결과 |
| --- | --- |
| 빈 문자열 intent | successor 없음으로 취급 |
| intent가 대상 자신, 대상 done | `successor_lost` `wp-1`/not_runnable — 전용 가드가 잡는다 |
| intent가 대상 자신, 대상 open | 같음 |
| 같은 id 중복, 앞이 blocked | `successor_lost`/not_runnable — 첫 일치만 본다 |
| successor superseded | `successor_lost`/not_runnable |
| successor done | `already_done` — §51 처분 |
| 사람이 successor를 pending으로 복구 | `ok` — 거부에서 탈출 가능하다 |

마지막 줄이 `successor_lost`가 진짜 교착이 아님을 보인다. `absent`는 phase를 다시 등록하면 풀리고,
`not_runnable`은 `blocked`를 풀면, `dependencies_unmet`은 선행을 끝내면 풀린다. 세 경우 모두 사람이
plan만 고치면 같은 D 요청으로 마칠 수 있고, 그것이 거부 문구가 안내하는 절차다.

§50의 열두 경우와 4파일 `tests 162 / pass 162 / fail 0`도 그대로다.

회귀 하나를 더 둔다. wp-1 marker가 남은 상태에서 wp-2를 정상 close한 뒤 그 marker로 재시도해 code 0과
`already_done` 경로, 그리고 plan이 그대로임을 단언한다.

감사관이 같은 라운드에서 두 가지를 더 지적했고 둘 다 실질이다.

첫째, `nextWorkPhaseId` 키가 있는데 값이 숫자·객체·빈 문자열이면 §50 초안은 그것을 `null`로 승격했다.
`null`은 "이 close에는 successor가 없었다"는 권위 있는 결정이므로, 손상된 marker가 정상 marker처럼
행세해 실제 successor를 건너뛴다. 그래서 값 검증 실패는 네 번째 상태로 다룬다.

| 지속된 값 | 판정 |
| --- | --- |
| 키 부재 | pre-§48 marker — fail-closed |
| `null` | successor 없음이 확정됐다 |
| 비어 있지 않은 문자열 | 기록된 successor |
| 그 밖 | 손상된 marker — fail-closed |

둘째, 거부 문구가 안내하는 `cxc orchestrate reset`이 실제로 실행되지 않는다. mutating verb는
`--session <id>`가 필수이므로 그 인자 없는 명령은 code 1로 거부된다. 안내를
`cxc orchestrate reset --session <id>`로 고친다.

관련해서 self-successor marker의 탈출로도 손봤다. `successor_lost`의 다른 세 사유는 사람이 plan을
고치면 풀리지만 이 경우는 marker 자체가 틀렸으므로 "그 work-phase를 복구하라"는 안내가 성립하지 않는다.
전용 사유 `corrupt`를 두어 reset을 가리키게 한다.

`done` successor를 통과시키면 원장이 빠지지 않는지도 확인했다. (§52에서 이 확인이 불완전했음이 드러났다 —
`started` 행의 출처가 틀렸다.) `already_done`은 plan write만 생략하고
뒤이은 `hasGoalplanRow` 가드가 `closed wp-1`을 채우며, 최종화 락 안의 `hasPabcdCloseRow` 가드가 PABCD
close 행을 채운다. `started` 행의 대상은 지속된 커서에서 온다 — 그것이 옳다. 이 close가 실제로 활성화한
phase가 그 뒤 자기 cycle을 끝냈다면 커서는 이미 넘어갔고 그 phase의 `started` 행은 그것을 실행한
cycle이 이미 남겼다. 두 가드가 어느 경우든 멱등이다. 회귀에서 `closed wp-1` 1건, `started wp-2` 1건,
`closedWorkPhaseId: "wp-1"`인 PABCD 행 1건을 모두 단언한다.

회귀 둘을 더 둔다. 하나는 `nextWorkPhaseId`가 숫자인 marker를 심어 `readStateStrict()`가 `legacy: true`로
복원하고 CLI가 아무 write 없이 거부하는지 본다. 다른 하나는 self-successor marker에서 거부 문구가
`--session`을 포함한 reset을 안내하는지 단언한다.

## 52. 라운드 23 — 재개는 파일이 아니라 marker를 원장의 근거로 쓴다

§51의 `done` successor 처분이 반쪽이었다. 감사관이 세 결함을 재현했고 전부 실질이다.

### 진행된 커서를 지우는 문제

`done`일 때 `next = undefined`로 두면 settled shape가 `activeWorkPhaseId: null`을 주장한다. 그런데
successor가 자기 cycle을 끝내면서 그 다음 phase를 시작해 둘 수 있다.

```text
marker: closed=wp-1, next=wp-2
plan:   wp-1=done, wp-2=done, wp-3=in_progress, 커서 wp-3
§51:    ok, 커서 null   <- 정상 진행을 끊는다
```

이 close는 커서에 관해 할 말이 없다. 그래서 계산하지 않고 즉시 `already_done`을 답한다.

```ts
    if (named.status === "done") {
      return { kind: "already_done" };
    }
```

### `started` 행이 빠지는 문제

`startedId`를 지속된 커서에서 읽으면 재개에서 그 값이 이 close가 활성화한 phase가 아니다. plan commit
직후 crash한 뒤 successor가 완주하면 커서는 `null`이거나 그 뒤 phase이므로, 이 close가 남겨야 할
`started` 행이 영구히 빠진다. 라운드 22에서 그 값이 옳다고 적었는데 틀렸다.

marker가 그 값을 갖고 있으므로 재개는 marker를 쓴다. 새 close만 자기가 계산한 커서를 쓴다.

```ts
const startedId = recoveringDclose
  ? state.dcloseRecovery.nextWorkPhaseId
  : closedPlan.activeWorkPhaseId;
```

`hasGoalplanRow` 가드가 그대로 있으므로 행이 이미 있으면 다시 쓰지 않는다.

### 대상이 사라진 재개가 successor를 버리는 문제

고정 대상이 plan에 없으면 §51까지는 helper를 건너뛰고 원장·state 정리만 했다. 그런데 marker는 여전히
이 close가 활성화한 successor를 알고 있다. marker 직후 crash한 뒤 대상만 지워지면, 정리로 넘어가는
판본은 successor를 시작하지 않은 채 cycle을 닫는다 — 원장은 닫혔다고 말하고 아무 일도 예약되지 않는다.

그래서 대상이 없어도 기록된 successor를 강제한다. 그 phase가 `pending`이면 활성화하고, 그것마저 plan에
없으면 fail-closed한다. successor를 기록하지 않은 marker(`null`)만 곧바로 정리로 간다.

```ts
if (!fixed && state.dcloseRecovery.nextWorkPhaseId) {
  const orphan = plan.workPhases.find(
    (workPhase) => workPhase.id === state.dcloseRecovery.nextWorkPhaseId,
  );
  if (!orphan) return /* fail-closed, marker 보존, reset 안내 */;
  if (orphan.status === "pending") {
    closedPlan = { ...plan, activeWorkPhaseId: orphan.id, /* orphan을 in_progress로 */ };
    writeClosedPlan = true;
  }
}
```

### 빈 문자열

`readStateStrict()`는 빈 문자열을 손상으로 보고 fail-closed하는데 helper는 그것을 explicit `null`처럼
다뤘다. 두 표면의 계약이 갈라지므로 helper도 `corrupt`로 거부한다.

### 실측

| 입력 | 결과 |
| --- | --- |
| wp-1 done, wp-2 done, wp-3 in_progress, 커서 wp-3, 기록 wp-2 | `already_done` — 커서 보존 |
| wp-1 done, wp-2 done, 커서 null, 기록 wp-2 | `already_done` |
| wp-1 done, wp-2 done, wp-3 pending, 기록 wp-2 | `already_done` |
| 빈 문자열 기록 | `successor_lost`/corrupt |

§50·§51의 경계 열아홉 가지가 모두 유지된다. 4파일 `tests 162 / pass 162 / fail 0`도 그대로다.

회귀 둘을 더 둔다. 대상이 없고 기록된 successor가 `pending`인 재개는 그 phase를 활성화하고 `started`
행 하나를 남긴다. 대상과 successor가 둘 다 없으면 code 1로 거부하고 plan·marker·원장을 전부 보존한다.
라운드 22의 successor 완주 회귀는 이제 `started wp-2` 단언이 실제로 성립한다 — 그전에는 커서가 `null`이라
그 행이 쓰이지 않아 회귀 자체가 구현 후 실패했다.

## 53. 라운드 24 — 대상이 열려 있으면 정착이 아니다

§52의 `done` successor 즉시 정착이 대상 status를 보지 않았다. 감사관이 그 구멍과 함께 두 표면의 어긋남을
찾았고 셋 다 실질이다.

### 열린 대상을 정착으로 보고하는 문제

marker는 plan commit 전에 기록되므로 대상이 아직 `in_progress`인 채 marker만 남을 수 있다. 그때 다른
세션이나 편집으로 successor만 끝나면 §52는 `already_done`을 답한다. 결과는 최악이다 — 원장에
`closed wp-1`·PABCD close 행이 기록되고 marker가 지워지는데 plan의 `wp-1`은 계속 열려 있다.

```text
marker: closed=wp-1, next=wp-2
plan:   wp-1=in_progress, wp-2=done, 커서 null
§52:    already_done   <- 원장은 닫혔다고, plan은 열렸다고 말한다
§53:    ok, wp-1=done, 커서 null
```

`already_done`은 대상까지 `done`일 때만 성립한다. 대상이 열려 있으면 실제로 닫고, 기록된 successor는
이미 끝났으므로 활성화할 것이 없다.

```ts
    if (named.status === "done") {
      if (current.status !== "done") {
        next = undefined;
      } else {
        return { kind: "already_done" };
      }
    }
```

### 대상 부재 경로가 게이트를 건너뛰는 문제

§52는 orphan이 `pending`이면 무조건 활성화했다. 그래서 의존이 끊긴 `pending`도 시작하고,
`blocked`·`superseded`는 plan을 그대로 두면서 `started` 행만 남겼다. 고정 대상 경로가 지키는 게이트가
이 경로에는 없었다.

### 두 표면이 갈라지는 문제

§52는 CLI에만 적용됐다. 같은 marker와 `pending` successor에서 CLI는 그 phase를 활성화하고 채팅은
plan을 건드리지 않은 채 `started` 행만 기록한다. 계약 §40 Z1이 요구하는 동일성이 깨진다.

### 처분 — 공유 판정

세 문제를 한 helper로 묶는다. 두 표면이 같은 함수를 부르므로 다시 갈라질 수 없다.

```ts
export type ResumeAbsentTargetResult =
  | { kind: "activate"; plan: Goalplan }
  | { kind: "cleanup" }
  | { kind: "successor_lost"; successorId: string; reason: "absent" | "not_runnable" | "dependencies_unmet" };
```

| orphan 상태 | 판정 |
| --- | --- |
| marker에 successor 없음 | `cleanup` — 이 close는 plan을 끝냈다 |
| plan에 없음 | `successor_lost`/absent |
| `done` | `cleanup` — 활성화는 이미 일어났고 원장만 남았다 (§54가 `in_progress`를 분리했다) |
| `pending`, 의존 충족 | `activate` |
| `pending`, 의존 미충족 | `successor_lost`/dependencies_unmet |
| `blocked`·`superseded` | `successor_lost`/not_runnable |

거부 문구도 `absentSuccessorDetail()` 하나에서 나오므로 두 표면이 같은 상태를 다르게 설명하지 못한다.

### 실측

| 입력 | 결과 |
| --- | --- |
| 대상 in_progress, successor done | `ok`, wp-1=done, 커서 null |
| 대상 pending, successor done | `ok`, wp-1=done, 커서 null |
| 대상 done, successor done | `already_done` |
| 대상 done, successor done, 커서 wp-3 진행 | `already_done` — 커서 보존 |

대상이 열려 있고 기록된 successor가 끝난 경우 커서를 `null`로 두는 것이 옳은지도 실측했다. 같은 plan에
`wp-3`가 `pending`으로 있어도 재개는 커서를 `null`로 남긴다. 재개는 앞선 시도가 내린 결정을 완성하는
일이고 그 결정은 `wp-2`였다. `wp-3`를 시작하는 것은 그 시도가 하지 않은 새 결정이므로 재개가 대신
내릴 수 없다. 같은 plan을 새로 close하면 `wp-3`를 시작하는 것과 대조된다 — 두 결과가 다른 것이 고정
target 계약의 정의다. 그 결과를 같은 marker로 다시 넣으면 `already_done`이므로 멱등이다. 커서가 `null`인
상태에서 남은 `pending` phase는 다음 P가 집어 든다.

§50~§52의 경계 스물세 가지가 모두 유지된다.

회귀 하나를 더 둔다. 채팅에서 대상이 없고 기록된 successor가 `pending`인 재개가 그 phase를 활성화하는지
단언한다. 기존 채팅 대상-부재 테스트는 successor를 미리 `in_progress`로 두어 이 차이를 가렸다.

## 54. 라운드 25 — 재개는 진행을 되돌리지 않는다

§53 판본에서 감사관이 세 결함을 찾았다. 하나는 계획서 코드의 명백한 버그이고 둘은 커서 손상이다.

### 채팅이 공유 판정 결과를 덮어쓰는 문제

대상 부재 분기에서 `closeResult`를 활성화한 plan으로 설정했는데, 바로 뒤 `closed` 분기의 absent 경로가
그것을 원본 plan으로 다시 덮었다. `writeClosedPlan`은 `true`인데 쓰이는 것은 활성화 전 plan이므로,
successor는 `pending`인 채 원장에 `started` 행만 남는다. 채팅 회귀가 구현 후 실패한다.

활성화 결과를 `resumedAbsent`에 담아 그 분기를 지나 전달한다. 분기 안에서 `closeResult`를 쓰는 것으로는
부족하다.

```ts
let resumedAbsent: Goalplan | null = null;
// ... 대상 부재 분기에서 resumedAbsent = orphan.plan;
if (closed.kind === "ok") {
  closeResult = { kind: "ok" as const, closedId: closed.closedId, plan: closed.plan };
  writeClosedPlan = true;
} else if (resumedAbsent) {
  closeResult = { kind: "ok" as const, closedId: closePhaseId, plan: resumedAbsent };
  writeClosedPlan = true;
} else {
  closeResult = { kind: "ok" as const, closedId: closePhaseId, plan };
}
```

### 진행된 커서를 지우는 문제

§53은 대상이 열려 있고 successor가 끝났으면 `next = undefined`로 두었다. 그러면 settled shape가 항상
커서 `null`을 주장한다. 그런데 successor가 끝나면서 그 다음 phase를 시작해 둘 수 있다.

```text
marker: closed=wp-1, next=wp-2
plan:   wp-1=in_progress, wp-2=done, wp-3=in_progress, 커서 wp-3
§53:    ok, 커서 null   <- wp-3 진행을 끊는다
§54:    ok, 커서 wp-3   <- 진행 보존
```

커서가 **다른** phase를 가리키고 그 phase가 정말 `in_progress`일 때만 보존한다. 대상 자신을 가리키는
커서나 `pending` phase를 가리키는 커서는 진행이 아니다 — §45가 후자를 위조로 확정했다.

```ts
next = closedWorkPhases.find(
  (wp) => wp.id === plan.activeWorkPhaseId && wp.id !== workPhaseId
    && wp.status === "in_progress",
);
```

실측 네 경우다.

| 커서 | 결과 |
| --- | --- |
| `wp-3`, wp-3가 `in_progress` | 커서 `wp-3` 보존 |
| 대상 자신 | 커서 `null` |
| `null` | 커서 `null` |
| `wp-3`, wp-3가 `pending` | 커서 `null` — 위조 무시 |

### 대상 부재의 `in_progress` cleanup이 고립을 허용하는 문제

공유 helper는 기록된 successor가 `in_progress`면 커서를 보지 않고 `cleanup`을 답했다. 그러면 커서가
`null`이거나 다른 phase를 가리키는 상태로 marker가 지워져, 그 successor가 커서 없이 고립된다. §45가
복구 대상으로 확정한 바로 그 손상이다.

커서가 그 successor를 가리킬 때만 `cleanup`이고, 아니면 커서를 복구한다.

```ts
  if (named.status === "in_progress") {
    return plan.activeWorkPhaseId === named.id
      ? { kind: "cleanup" }
      : { kind: "activate", plan: { ...plan, activeWorkPhaseId: named.id } };
  }
```

§53 상태 표의 `in_progress` 또는 `done` 행은 아래로 대체된다.

| orphan 상태 | 판정 |
| --- | --- |
| `done` | `cleanup` |
| `in_progress`, 커서가 그것을 가리킴 | `cleanup` |
| `in_progress`, 커서가 다름 | `activate` — 커서만 복구, status는 그대로 |

보존하는 커서에 readiness를 걸지 않았던 판단은 §55에서 철회했다.

`activate`가 status를 바꾸지 않고 커서만 옮기는 것도 무결성과 충돌하지 않는다. 커서 `null`에 running
phase가 있는 plan과 커서를 그 phase로 옮긴 plan 모두 `goalplanDefinitionIntegrityReasons()`가 빈
배열을 낸다. 두 상태가 다 유효하고, 후자가 실제 진행을 정직하게 반영한다.

§50~§53의 경계와 4파일 `tests 162 / pass 162 / fail 0`이 유지된다.

회귀 둘을 더 둔다. 대상이 열려 있고 successor가 끝났으며 커서가 진행 중인 phase를 가리키는 plan에서
그 커서가 살아남는지 단언한다. 대상 부재 + `in_progress` successor + 커서 `null`에서 커서가 그
successor로 복구되는지도 단언한다. 기존 두 테스트는 커서와 status를 미리 맞춰 두 창을 모두 가렸다.

## 55. 라운드 26 — 커서는 지금 읽히는 커서와 같아야 한다

§54가 남긴 두 구멍을 감사관이 독립으로 찾았다. 둘 다 dependency readiness를 어디까지 보는가의 문제다.

### 보존한 커서가 지금 읽히는 커서와 어긋난다

§54는 보존할 커서에 readiness를 걸지 않았고, 그 근거를 "이미 실행 중인 phase를 멈추는 것은 재개의
일이 아니다"로 적었다. 근거는 맞지만 결론이 틀렸다. `effectiveActiveWorkPhaseId()`는 `isRunnablePhase()`로
커서를 검사해서 의존 미충족 커서를 이미 무시한다(`goalplan.ts:1467-1485`). 그러니 그런 커서를 파일에
써 두면 저장된 커서와 계산된 커서가 갈린다.

```text
marker: closed=wp-1, next=wp-2
plan:   wp-1=in_progress, wp-2=done, wp-3=in_progress(dependsOn wp-4), wp-4=pending, 커서 wp-3
§54:    ok, 커서 wp-3   <- 파일은 wp-3, effective는 wp-4
§55:    ok, 커서 null   <- 파일은 null, effective는 wp-4 (해석이 일치)
```

저장된 커서가 `null`이 되는 것이지 파일이 wp-4를 가리키는 것은 아니다. 하는 일은 다음 cycle이 따르지
않을 낡은 명시 커서를 지우는 것이고, 그러면 `effectiveActiveWorkPhaseId()`의 해석이 유일한 답이 된다.

커서를 지우는 것이 wp-3를 멈추지도 않는다. status는 `in_progress`로 그대로 남고 실행 중인 것은 계속
실행 중이다. 바뀌는 것은 다음 cycle이 무엇을 고를지 두 읽는 쪽이 같은 답을 낸다는 점뿐이다.
`workPhaseDependenciesMet()`를 같은 술어에 더한다. §54가 잠근 네 경우는 `dependsOn`이 없어 그대로다.

| 커서 | §54 | §55 |
| --- | --- | --- |
| `wp-3`, `in_progress`, 의존 충족 | `wp-3` | `wp-3` |
| `wp-3`, `in_progress`, 의존 미충족 | `wp-3` | `null` |
| 대상 자신 | `null` | `null` |
| `null` | `null` | `null` |
| `wp-3`, `pending` | `null` | `null` |

### 대상 삭제 여부가 판정을 가른다

공유 helper는 `in_progress` orphan을 readiness 없이 통과시켰다. 그런데 같은 successor 상태에서 대상이
plan에 남아 있으면 `closeFixedWorkPhase()`가 `successor_lost/dependencies_unmet`으로 거부한다.

```text
plan:   wp-2=in_progress(dependsOn wp-9), wp-9=pending, wp-3=in_progress, 커서 wp-3
대상 있음: successor_lost wp-2/dependencies_unmet
§54 대상 없음: activate, 커서 wp-2   <- 삭제가 판정을 바꿨다
§55 대상 없음: successor_lost wp-2/dependencies_unmet
```

readiness 검사를 두 분기보다 앞으로 올린다. `pending` 분기는 §53부터 이미 같은 입력을 거부했으니,
`in_progress`만 통과시킨 것이 비대칭이었다.

```ts
  if (named.status !== "pending" && named.status !== "in_progress") {
    return { kind: "successor_lost", successorId: recordedNext, reason: "not_runnable" };
  }
  if (!workPhaseDependenciesMet(plan, named)) {
    return { kind: "successor_lost", successorId: recordedNext, reason: "dependencies_unmet" };
  }
  if (named.status === "in_progress") {
    return plan.activeWorkPhaseId === named.id
      ? { kind: "cleanup" }
      : { kind: "activate", plan: { ...plan, activeWorkPhaseId: named.id } };
  }
```

대상이 삭제된 plan에서 successor의 `dependsOn`이 그 대상을 가리키면 이제 미충족이 된다. 그런데 그
입력은 두 표면에서 이 helper에 닿지도 않는다. 락 안 첫 검사인 `goalplanDefinitionIntegrityReasons()`가
`depends on unknown work phase 'wp-1'`을 내고 `invalid goalplan`으로 먼저 거부한다. helper 단독
호출에서 미충족으로 읽히는 것은 그 선행 게이트와 같은 방향이고, `pending` 분기도 §53부터 같은 입력을
거부해 왔다. 손으로 망가뜨린 dependency를 재개가 대신 고쳐 주는 것은 이 helper의 일이 아니다.

### §54 근거 문단 철회

§54 끝의 "보존하는 커서에 readiness 검사를 걸지 않는 이유" 문단은 철회한다. 그 문단은 커서를 지우면
진행이 끊긴다고 했는데, 실측하면 status는 그대로 남고 `effectiveActiveWorkPhaseId()`가 같은 phase를
다시 고를 수도 있다. 커서를 지우는 것과 phase를 멈추는 것은 다른 일이다.

회귀 둘을 둔다. 의존 미충족 phase를 가리키는 커서가 close 뒤 `null`이 되고 그 phase의 status는
`in_progress`로 남는지 단언한다. 대상 부재 + 의존 미충족 `in_progress` successor에서 CLI가 exit 1,
plan 파일 무변경, marker 보존으로 답하는지도 단언한다.

§50~§54의 나머지 경계와 4파일 `tests 162 / pass 162 / fail 0`이 유지된다.

## 56. 라운드 27 — 이미 done인 대상도 커서를 정규화한다

§55는 readiness를 `current.status !== "done"` 분기 안에만 넣었다. 대상까지 done이면 그 앞에서
`already_done`으로 즉시 반환하므로 정규화 자체가 실행되지 않는다. 같은 손상이 그 문으로 다 통과했다.

```text
marker: closed=wp-1, next=wp-2
plan:   wp-1=done, wp-2=done, wp-3=in_progress(dependsOn wp-4), wp-4=pending, 커서 wp-3
§55:    already_done, 파일 커서 wp-3 그대로   <- effective는 wp-4
§56:    ok, 커서 null
```

대상 자신을 가리키는 커서도 마찬가지였다. wp-1이 done인데 커서가 wp-1이면 §55는 그것을 손대지 않았다.
`effectiveActiveWorkPhaseId()`가 무시해 주니 실행은 굴러가지만, 파일에는 끝난 phase를 가리키는 거짓
주장이 남는다.

두 done 분기를 합친다. 정규화를 먼저 하고, 정착 여부는 그 뒤 settled shape 비교에 맡긴다. 그 비교가
`already_done`을 판정하는 유일한 곳이라는 §45의 원칙이 여기서도 적용된다 — 정규화 전 커서와 비교하면
비교 자체가 손상을 승인한다.

```ts
      next = closedWorkPhases.find(
        (wp) => wp.id === plan.activeWorkPhaseId && wp.id !== workPhaseId
          && wp.status === "in_progress" && workPhaseDependenciesMet(closedPlan, wp),
      );
```

대상 done 다섯 경우를 실측했다.

| 커서 | §55 | §56 |
| --- | --- | --- |
| `wp-3`, `in_progress`, 의존 미충족 | `already_done`, 커서 wp-3 | `ok`, 커서 `null` |
| 대상 자신 (done) | `already_done`, 커서 wp-1 | `ok`, 커서 `null` |
| `wp-3`, `pending` | `already_done`, 커서 wp-3 | `ok`, 커서 `null` |
| `null` | `already_done` | `already_done` |
| `wp-3`, `in_progress`, 의존 충족 | `already_done` | `already_done` |

뒤 두 줄이 §51을 지킨다. 정말 정착한 plan은 정규화해도 같은 shape가 나오므로 비교가 `already_done`을
답하고 plan write가 일어나지 않는다. §51 회귀는 커서 `null` 경로라 그대로 통과한다.

### §55 문구 정정

"저장된 커서와 계산된 커서가 같은 답을 낸다"는 표현을 고친다. 결과는 저장값 `null`, 해석값 `wp-4`다.
하는 일은 다음 cycle이 따르지 않을 낡은 명시 커서를 지우는 것이고, 그러면 해석이 유일한 답이 된다.
회귀에서 `effectiveActiveWorkPhaseId()` 결과도 함께 단언해 그 설명을 직접 검증한다.

§50~§55의 나머지 경계와 4파일 `tests 162 / pass 162 / fail 0`이 유지된다.

회귀 하나를 더 둔다. 대상과 successor가 모두 done이고 커서가 의존 미충족 phase를 가리키는 plan에서
커서가 `null`로 정규화되고 그 phase의 status는 `in_progress`로 남는지 단언한다.

## 57. B 구현 중 발견 — §9 소유 표가 놓친 문구 하나

`steering.ts`를 공통 락으로 옮기면서 §9 표에 없는 기존 단언이 하나 깨졌다. `steering.test.ts`의
`an unbound slug is refused before anything is touched`가 `/no goalplan found/`를 기다리는데, 그
문구는 삭제한 `existsSync` preflight에서만 나왔다. 공통 락은 같은 상황을
`goalplan '<slug>' does not exist`라는 `unreadable` 사유로 답하고, §6.2의 교체 코드는 그것을
`is unusable - ...`로 감싼다.

`existsSync` preflight를 되살리지 않고 락의 절대 사유를 원래 문구로 매핑했다. 락이 이미 파일 존재를
판정하므로 검사를 두 번 하지 않고, 사용자가 보는 문구는 그대로다.

```ts
    if (locked.reason === `goalplan '${slug}' does not exist`) {
      return { kind: "rejected", reason: `no goalplan found at slug '${slug}'` };
    }
```

§9 표에 `no goalplan found` 행이 없었다는 것이 이 발견의 요지다. 문자열 소유 표는 새로 만드는 문구를
다 적었지만, 삭제하는 코드가 내던 문구를 빠뜨렸다. 나머지 소스 파일에서도 같은 종류를 찾으려면 지우는
블록의 출력 문구를 먼저 grep해야 한다.

## 58. B 구현 중 발견 — §45 위조 목록과 §55가 겹쳤다

§8.3의 §45 위조 시나리오 넷 중 하나가 §55 이후 성립하지 않는다. `an in_progress cursor whose
dependency is unmet`은 커서를 successor wp-2 자신에 두고 wp-2의 의존을 끊는데, §55는 그 입력을
`successor_lost/dependencies_unmet`으로 거부한다. 위조를 무시하고 계산된 shape로 착지하는 것이
§45의 요지인데, 이 경우는 착지 자체가 없다.

시나리오를 커서만 위조하는 형태로 바꿨다. 커서를 실행 불가한 제3의 phase에 두고 recorded successor는
멀쩡히 둔다. 그러면 §45가 원래 보이려던 것 — 파일의 커서가 판정을 바꾸지 못한다 — 이 그대로 남고,
의존 미충족 successor 거부는 전용 테스트가 이미 따로 덮는다.

```text
이전: 커서 wp-2, wp-2 dependsOn wp-3(blocked)     -> §55에서 거부, code 1
이후: 커서 wp-3(blocked), wp-2는 pending 그대로   -> ok, 커서 wp-2
```

같은 절의 문구 단언 하나도 실제 생산 문자열과 달랐다. 계획서는
`/so is the successor wp-2 it recorded/`를 기다리는데, `absentSuccessorDetail("absent")`는
`is gone too`를 내므로 실제 문장은 `the successor wp-2 it recorded is gone too`다. 단언을 생산
문자열에 맞췄다. §53에서 문구를 한 곳으로 모을 때 이 테스트가 같이 갱신되지 않았다.
