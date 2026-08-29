# 000 — goalplan-dependency-execution: Plan

> DIFFLEVEL-ROADMAP-01: write this doc to full diff-level precision (exact paths,
> NEW/MODIFY/DELETE, before/after diffs) BEFORE P -> A. An empty scaffold does not
> satisfy the rule; the A-phase reviewer FAILS outline-only phase docs.

## 목표

goalplan을 순차 커서에서 **dependency-aware control plane**으로 올린다. 스케줄러나 실행기를
만들지 않고, 기존 goalplan을 유일한 상태 원천으로 유지한 채 의존 관계·무결성·공개 연산을
추가한다. 계산된 ready 목록은 wp6의 Stop 표면이 실제로 소비해 메인 에이전트에게 보여준다.

관측된 결손: goalplan의 실제 격차는 "실행 엔진이 없음"이 아니라 (1) task/criterion을 지원되는
CLI로 생성·완료·증거 결박하는 lifecycle이 없고 (2) 항목 사이에 순서·의존 개념이 전혀 없어서
병렬 안전성과 준비 상태를 판단할 수 없다는 것이다.

연결된 goal: 세션 01a0491e-d7d3-7021-adfe-f7041aa04d37, goalplan slug
`goalplan-dag-codexclaw-goalplan-plugins-codexcla` (wp1~wp7, c-1~c-8 등록됨).

작업 등급 C4. 공개 계약(스키마·CLI)을 바꾸고, 여러 소비자가 read-modify-write로 같은 파일을
만지며, 조사 당시 디스크에 83개 이상의 기존 goalplan이 존재했다. 2026-08-29 측정에서는
`goalplan.json` 90개가 관측됐다. 이 수는 검증 기준이 아니며, 정본 §26에 따라 체크인된 manifest
항목의 변경 전후 normalized 결과가 같은지를 판정한다.

## Loop-spec

- Loop archetype: verifier-defined. 각 phase의 성공은 테스트가 판정하며 모델 판단이 아니다.
- Write scope: plugins/codexclaw/components/pabcd-state/src/{goalplan,goalplan-cli,goal-gate,steering,atomic-write,state,orchestrate-apply}.ts,
  같은 컴포넌트의 test/, plugins/codexclaw/skills/loop/SKILL.md, 이 devlog 유닛.
  소비자 조정이 필요할 때만 orchestrate-cli.ts, hook.ts, review-round-cli.ts, review-observer.ts.
  `plugins/codexclaw/components/pabcd-state/dist/`도 write scope다. 구현 wp가 바꾼 각 src 파일과
  basename이 같은 tracked `dist/*.js`를 `npm run build`로 재생성해 함께 반영한다.
  `state.ts`는 wp5의 D-close recovery marker 저장·복원·reset과 marker가 남은 IDLE의 check epoch
  보존을 소유하고, `orchestrate-apply.ts`는 `clearedIdle()` reset에서 recovery marker를 실제로
  제거한다. `orchestrate-cli.ts`와 `hook.ts`는 marker를 보존한 cleared-IDLE 상태를 소비하고,
  state·두 원장 커밋 뒤 marker와 check epoch를 지우는 범위까지 wp5에서 함께 고친다.
  `plugins/codexclaw/skills/loop/SKILL.md` 수정은 wp6이 소유한다(정본 §17).
- Out-of-scope: senpi-task DAG 코드 이식, 별도 스케줄러 프로세스, 별도 상태 저장소,
  호스트 goal DB 쓰기, 자체 WAL/체크포인트 엔진, 웨이브 실행기, 노드 steer 런타임, 팀 DAG,
  devlog/.omo 및 devlog/.senpi(읽기 전용 참조 미러).
- Bounds: 한 사이클 한 decade 문서. 기존 goalplan 파일을 손상시킬 위험이 보이면 즉시 중단.

## 조사 근거 (파견 5기, gpt-5.6-sol medium)

### 지금 상태

- `GoalplanTask`는 `id/title/status` 3필드. 의존 필드가 없다. (goalplan.ts:74)
- `nextOpenTask()`는 배열 순서로 첫 pending을 반환하고, `advanceWorkPhase()`는 현재 phase 뒤의
  첫 pending phase를 활성화한다. 순회 커서이지 그래프가 아니다. (goalplan.ts:707, 1029)
- `criteriaIds`는 복원 외에 아무도 읽지 않는다. 참조 무결성 검사가 없다. (goalplan.ts:456)
- 원장 이벤트 타입에 `task_done`과 `criterion_met`이 있으나 이를 발생시키는 생산 코드가 없다.
- task 추가·완료, criterion 충족·증거 기록의 공개 연산이 전부 없다. D-close는 pending task를
  거부하기만 하고 대신 완료시키지 않는다. (orchestrate-cli.ts:632)

### 최대 함정 — reviver 필드 유실

`reviveGoalplan()`은 허용된 필드만 새 객체로 재구성한다. `dependsOn`을 JSON에 넣어도
`readGoalplan()` 직후 메모리에서 사라지고, 다음 쓰기에서 파일에서도 삭제된다.
(goalplan.ts:440, 449) read-modify-write 경로가 D-close(CLI와 채팅 양쪽), steering,
review round open/abort, review observer로 다섯 군데다. reviver를 먼저 고치지 않으면
리뷰어가 종료하기만 해도 의존 정보가 조용히 날아간다. 이것이 wp2를 첫 구현 phase로 두는 이유다.

### 동시성 실태

`goalplan.json` 개별 교체만 원자적이다(tmp + rename, Windows 재시도). 전체 read-modify-write를
직렬화하는 락은 없고 `.steer.lock`은 steering끼리만 보호한다. compare-and-swap도 버전 카운터도
없어서 두 writer가 같은 스냅샷을 읽으면 늦게 rename한 쪽이 먼저 쓴 변경을 덮는다.
(goalplan.ts:615, atomic-write.ts:16, atomic-write.ts:38~45, steering.ts:76)

### 스키마 버전 실태

`buildGoalplan()`이 `schemaVersion`을 쓰지 않아 새 plan은 사실상 v1이다. marker는 버전을 올릴
수만 있고, 현재 코드는 `schemaVersion: 3`도 "2 이상"으로만 취급한다. 구버전 바이너리가 v3 의존
정보를 모른 채 통과시킬 수 있어, v3 도입 시 미지원 미래 버전 거부가 함께 필요하다.
(goalplan.ts:669, 771, 871)

### DAG에서 가져올 최소 불변식 (senpi-task 실측)

엔진 이식은 하지 않되, 규모와 무관하게 필수인 것만 재현한다.

1. 유효하지 않은 정의는 상태를 하나도 만들지 않는다(영속화 전 검증).
2. 항목 id 유일, 모든 의존 대상 존재, 그래프는 DAG.
3. 시작 후보 조건은 "미완료 + 모든 직접 의존이 완료" 하나뿐이다.
4. 깊이·그룹은 표시 정보이고 실행 장벽이 아니다.
5. 완료 상태는 검증 가능한 증거와 함께만 인정한다.
6. 모호한 상태를 임의로 되돌리거나 재실행하지 않는다.

과잉으로 판단해 버리는 것: critical path/bottleneck 분석, 17종 세분 이벤트, subscriber ring과
overflow 복구, PID 기반 run adoption, 다중 프로세스 stale-lock 승계, 매 이벤트 체크포인트.

### 과거 판정 준수

- G8 REJECT 유지: 별도 스케줄러·중복 goal/task 저장소·두 번째 Stop 소유자를 만들지 않는다.
- G2 ADAPT 승계: `workPhases[].tasks[]`와 `criteria[]`가 유일한 권위 상태이고 원장은 역사다.
- G10 DEFER 유지: 팀 DAG는 participant identity/liveness 증명 전까지 범위 밖.
- 재시도는 완료 기록을 되돌리지 않고 새 pending 항목을 만든다.

### 실행 주체 결정

**ready/dependency 판정의 진실**은 pabcd-state에 두고 실제 파견은 메인 세션이 한다. wp6의 Stop
표면은 ready work phase와 ready task 목록, 대기 사유를 같은 턴 안에서 보여준다. 스케줄링
자체(다음 턴을 언제 만드는지, 몇 개를 동시에 돌리는지)는 호스트 소유다. codex-rs 실측 근거로
호스트가 goal이 active인 동안 idle 스레드에 continuation steering을 걸어 새 턴을 만들고
(`ext/goal/src/extension.rs:148`, `runtime.rs:363`), 동시 spawn을
`max_concurrent_threads_per_session` 기본 4로 제한한다(`core/src/config/mod.rs:229`).

Stop 훅은 턴 생성기가 아니라 **같은 턴 안의 guard**다. "실행 가능한 항목이 남았는데 멈췄다"를
알리는 감시자로만 쓰고 실행기를 넣지 않는다(짧은 동기 수명주기라 장시간 에이전트 대기·재시도·
리스 관리에 부적합). 상세는 006_host_runtime.md와 005_contract.md §11~§12.

## Work-phase map (one phase = one full PABCD cycle)

**감사 라운드 1(fail) 반영으로 순서가 바뀌었다. 계약 정본은 005_contract.md이며 decade 문서와
충돌하면 정본이 이긴다.**

| WP | Doc | Slice | Depends on | 단계 게이트 |
|----|-----|-------|------------|-------------|
| wp1 | 010 (+000~006) | 조사 종합과 로드맵 잠금 | — | focused test → `npm run build` → `npm test` → `npm run gate` |
| wp2 | 020 | 스키마 v3: 타입·reviver 보존·미래 버전 거부·왕복 테스트 | wp1 | focused test → `npm run build` → `npm test` → `npm run gate` |
| wp3 | 030 | 무결성: dangling/self/cycle 거부, validateGoalplan 확장, goal-gate 연동 (순수 검증만) | wp2 | focused test → `npm run build` → `npm test` → `npm run gate` |
| wp4 | 040 | 의존 인식 선택: effectiveActive/nextOpenTask/advanceWorkPhase, 전역 교착과 부분 대기를 나눈 `dependencyDeadlock()`·`dependencyWaitReasons()` | wp3 | focused test → `npm run build` → `npm test` → `npm run gate` |
| wp5 | 050 | 쓰기 직렬화: 공통 락, 5개 RMW 경로 보호, recovery marker, `(sessionId, checkEpoch, closedWorkPhaseId)` 중복 키를 쓰는 D-close 멱등 재시도 | wp4 | focused test → `npm run build` → `npm test` → `npm run gate` |
| wp6 | 060 | 공개 표면: phase/task 의존 등록 + ready 조회·`dependencyWaitReasons()` Stop 소비 + task/criterion lifecycle + plan 권위 commit 뒤 원장 경고 + SKILL.md 동기화 | wp5 | focused test → `npm run build` → `npm test` → `npm run gate` |
| wp7 | 070 | 회귀 확정: manifest normalized 결과 불변, mixed ready/waiting·연속 cycle·원장 실패 회귀, 소비자 비유실, 전체 게이트 | wp6 | focused test → `npm run build` → `npm test` → `npm run gate` |

순서 근거. reviver 보존(wp2)이 없으면 이후 모든 필드가 5개 read-modify-write 경로에서 유실된다.
무결성(wp3)이 없으면 의존 인식 선택(wp4)이 잘못된 그래프를 신뢰한다. **공개 mutation(wp6)은
공통 락(wp5)이 선 다음에만 열린다** — 감사가 지적한 대로 mutation이 락보다 먼저 오면 그 사이
기간의 데이터가 lost update에 노출된다. wp3는 순수 검증 함수와 기존 validateGoalplan 연동까지만
하고, 새 등록 입구는 wp6이 소유한다.

문서 파일명은 wp 번호와 decade가 1:1로 맞도록 정리했다(010=wp1부터 070=wp7까지). 각 문서 안에 남은
이전 phase 번호 표기는 정본 §7의 지도를 따른다.

wp1~wp7의 변경 manifest에는 `plugins/codexclaw/components/pabcd-state/dist/` 항목을 둔다. wp1처럼
소스를 바꾸지 않는 wp는 dist 변경 없음이라고 명시하고, 구현 wp는 변경 src와 basename이 같은 tracked
`dist/*.js`를 MODIFY로 적는다. src만 적고 배포 산출물을 빠뜨린 manifest는 완료된 manifest가 아니다.

## Accept criteria

goalplan criteria[] c-1~c-8과 1:1로 대응한다.

- c-1 wp1 로드맵 잠금: 000번대 조사 문서와 wp2~wp7 decade 문서가 diff-level로 존재
- c-2 reviver 보존: work phase/task의 `dependsOn`과 task `outcome`이 왕복 뒤에도 남고, 미래
  스키마 버전은 거부되며 선택 로직은 schemaVersion이 아니라 필드 유무로 하위 호환을 판정함.
  import After는 선행 wp 문서의 import After를 직접 읽은 목록에서 시작하고, 선행 wp가 추가한 모든
  이름과 이 wp 추가분을 합친다. 각 블록 위에는 `// wpN 적용 후 + 이 wp 추가분`과 선행 추가 이름을 적음
- c-3 무결성 거부: phase-local task 참조와 work phase 참조의 dangling/self/duplicate/cycle,
  criterion 참조, outcome 상태 불일치가 정본 사유로 거부되고 goalplan·state·두 원장에 한 바이트도
  쓰지 않음. D-close도 marker나 write보다 먼저 정의 무결성과 완료 의존 무결성을 검사하며, 변경된
  거부 공개 경로를 실제 호출하는 focused test가 wp3과 wp5의 단계 게이트임
- c-4 의존 인식 선택: work phase와 phase-local task의 미충족 의존 항목이 ready/active/next
  선택에서 빠지고, 의존이 없으면 기존 순차 결과와 같음. `dependencyDeadlock()`은 ready가 하나도
  없는 전역 교착만 판정하고, `dependencyWaitReasons(plan)`은 ready 항목이 함께 있는 상태에서도
  부분 대기 사유를 계산함. wp4의 focused test가 두 helper와 선택 공개 경로를 직접 호출하며,
  build 성공을 import 이름 보존의 증거로 쓰지 않음
- c-5 공개 표면: `add-work-phase`와 `add-task`가 생성 시점의 반복 `--depends-on`을 받고,
  task 완료 outcome·criterion evidence lifecycle과 ready 조회가 도움말에 노출됨. wp6 Stop 안내가
  ready work phase/task 목록과 `dependencyWaitReasons(plan)`의 부분 대기 사유를 mixed 상태에서도
  함께 표시함. lifecycle은 plan commit을 권위 commit point로 삼고, 뒤따른 goalplan 원장 append
  실패는 code 0과 경고로 알려 권위 상태를 실패로 되돌리지 않음. `ready --session`은 sanitize된
  별칭이 아니라 canonical session id 일치를 검사해 `a/b`가 `a-b`의 plan을 읽지 못하게 하며,
  focused CLI·Stop 테스트가 실제 공개 명령과 hook 경로를 호출함
- c-6 하위 호환: 체크인된 manifest의 각 항목이 변경 전후 같은 normalized parse 결과를 내고,
  운영 디렉터리의 현재 개수와 무관하게 판정되며 v1/v2의 의존 없는 순차 의미가 변하지 않음.
  의존 없는 `add-work-phase` steering summary는 기존 문자열을 그대로 써서 기존 summary hash 기반
  idempotency key가 유지되고, 의존이 있을 때만 suffix를 붙임
- c-7 소비자·재시도 안전: 5개 read-modify-write 경로 뒤에도 새 필드가 남음. `state.ts`가 recovery
  marker를 복원하고 marker가 남은 IDLE의 check epoch를 보존하며, `orchestrate-apply.ts`의
  `clearedIdle()`이 reset 때 marker를 지움. CLI와 채팅 D-close는 slug 없는 HITL에서 기존 state·원장
  경로로 즉시 return하고, 빈 plan 거부 뒤 전부 done인 plan을 marker 없이 IDLE로 닫는 특례를
  보존함. bound recovery만 cleared-IDLE 상태를 소비한 뒤 marker를 지움. PABCD close 중복 키는
  `(sessionId, checkEpoch, closedWorkPhaseId)`이고, 같은 세션의 연속 cycle과 goalplan commit 직후·
  state write 직후·PABCD 원장 append 직후 재시도도 phase나 close 행을 두 번 닫지 않음
- c-8 전체 게이트·fixture privacy: allowlist 비식별 fixture에 UUID·절대 경로·40자 hex가 없고,
  manifest normalized 동등성, mixed ready/waiting, 연속 cycle, plan commit 뒤 원장 append 실패 경고
  회귀가 고정됨. `npm run build`는 dist 재생성과 layout 검사만 맡으며 타입·미정의 식별자·import
  이름 오류 검출 증거로 쓰지 않음. 각 wp는 변경 공개 경로 focused test → `npm run build` →
  `npm test` → `npm run gate` 순서로 통과하고 receipt를 기록함. 루트 `npm test`에 포함된
  `plugins/codexclaw/test/dist-freshness.test.mjs`는 tracked `dist/*.js`와 src의 byte equality를 판정함

## 검증 (전 phase 공통)

- 각 단계의 첫 게이트는 해당 decade 문서에 적힌 focused test다. 이 테스트는 변경된 공개 CLI,
  hook, helper 경로를 실제 호출해야 하며 import만 하거나 build exit 0만 확인해서는 안 됨
- TypeScript focused test는 `node --experimental-strip-types --test plugins/codexclaw/components/pabcd-state/test/*.test.ts` 형식으로 실행하며, 각 decade 문서는 이 형식의 정확한 대상 파일을 적음
- `npm run build` — 타입 제거와 `dist/*.js` 재생성·layout 검사 전용. 타입·미정의 식별자·import 이름
  오류 검출 게이트로 간주하지 않음
- `npm test` — 루트 suite의 `plugins/codexclaw/test/dist-freshness.test.mjs`가 build 직후 tracked
  `dist/*.js`와 현재 src의 byte equality를 검사함
- `npm run gate`
- 체크인된 manifest 항목의 변경 전후 normalized 결과 동일(운영 디렉터리 현재 개수는 판정에 쓰지 않음)
- cxc loop validate 동작
- cxc receipt test 로 영수증 기록

DONE: 000_plan.md — W5 공통 검증 순서와 wp map의 dist freshness 결박을 닫음
