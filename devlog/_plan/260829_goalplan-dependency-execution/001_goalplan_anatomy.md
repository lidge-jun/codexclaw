# 001 — goalplan 현재 구조 해부

출처: T1 파견(gpt-5.6-sol medium), 대상 plugins/codexclaw/components/pabcd-state/src/goalplan.ts(1094줄),
goalplan-cli.ts(396줄), goal-gate.ts(318줄). 본체가 스키마·CLI·원장 지점을 직접 재확인했다.

## 타입 구조

```text
Goalplan
├─ objective / slug / createdAt / updatedAt
├─ activeWorkPhaseId: string | null
├─ workPhases: GoalplanWorkPhase[]
│  ├─ id / title
│  ├─ status: pending | in_progress | done | blocked | superseded
│  ├─ tasks: GoalplanTask[]  (id / title / status: pending | done)
│  ├─ criteriaIds: string[]
│  ├─ blockedReason?  / supersededBy?
├─ criteria: GoalplanCriterion[]
│  ├─ id / scenario / expectedEvidence
│  ├─ capturedEvidence: string | null
│  ├─ status: open | met
│  └─ surface?: logic | web | tui
├─ host: { armed, armedAt, source: freeze | none }
├─ reviewRounds? / activePlanAuditRoundId? / activeFinalGateRoundId?
├─ schemaVersion?
├─ finalGate?
└─ steeringLog?
```

의존 필드는 어디에도 없다. task는 3필드뿐이다(goalplan.ts:74).

## 스키마 버전 관리

별도 reviveV1/reviveV2가 아니라 관대한 `reviveGoalplan()` 하나가 과거 형식을 복원하고,
이후 `validateGoalplan()`이 유효 버전에 맞춰 강한 규칙을 적용한다.

복원 관례:

- 잘못된 work phase status는 `pending`으로 정규화
- 잘못된 task status는 `pending`으로 정규화
- 잘못된 criterion status는 `open`으로 정규화
- criterion `surface`는 알려진 값일 때만 보존(정규화하지 않음)
- review round는 핵심 신원·해시·lane이 잘못되면 해당 round만 버림
- finalGate는 status나 qaRequired가 잘못되면 통째로 버림
- steeringLog는 일부라도 잘못되면 **plan 전체를 읽기 실패**로 처리

버전 판정: `declared = schemaVersion ?? 1`, `effective = marker 있으면 max(declared, 2)`.
marker는 올릴 수만 있다. 공백 두 개가 있다.

1. `buildGoalplan()`이 schemaVersion을 쓰지 않아 새 plan은 사실상 v1이다(goalplan.ts:669).
2. 생산 코드에 marker 생성이나 v2 승격 공개 연산이 없다. marker 작성은 테스트에서만 확인된다.
3. `validateGoalplan()`은 3도 "2 이상"으로만 본다(871) — 미지원 미래 버전 거부가 없다.

## 디스크 레이아웃과 동시 쓰기

```text
<cwd>/.codexclaw/goalplans/<slug>/
├─ goalplan.json
├─ ledger.jsonl
├─ schema-v2.marker               선택
├─ goalplan.json.<pid>.<ms>.tmp   쓰는 동안만
└─ .steer.lock/owner.json         steering 중에만
```

쓰기는 tmp 생성 → 전체 기록 → rename → 실패 시 tmp 정리다(615). Windows에서 EBUSY/EPERM/EACCES면
25ms, 50ms 두 차례 재시도한다(상수 atomic-write.ts:16, 실행 atomic-write.ts:38~45).

한계가 분명하다. 파일 한 개의 publish는 원자적이지만 read-modify-write 전체는 아니다.
compare-and-swap도 버전 카운터도 fsync도 없다. 두 writer가 같은 스냅샷을 읽으면 늦게 rename한
쪽이 먼저 쓴 변경을 덮는다.

`.steer.lock`은 mkdir 원자성을 이용하고 owner.json에 pid를 남기지만 stale 자동 회수가 없고,
주석이 명시하듯 steering 대 steering만 보호한다(steering.ts:76). D-close 등 다른
`writeGoalplan()` 호출은 이 락을 보지 않는다.

원장은 O_APPEND|O_CREAT|O_WRONLY(가능하면 O_NOFOLLOW)로 열어 한 줄을 단일 writeSync로 붙인다(638).
원장 자체 락은 없고, goalplan.json과 원장을 묶는 트랜잭션도 없다. steering에서는 JSON 쓰기가
commit point이고 원장 append 실패는 성공+경고로 반환한다.

## 원장 이벤트 — 절반이 죽어 있다

| 이벤트 | 뜻 | 생산 코드 |
| --- | --- | --- |
| created | plan 생성 | 있음 (goalplan-cli.ts:340) |
| workphase_started | 다음 phase 시작 | 있음 (orchestrate-cli.ts:671) |
| workphase_done | phase 종료 | 있음 (같은 곳) |
| task_done | task 완료 | **없음** |
| criterion_met | criterion 충족 | **없음** |
| host_armed | host goal arm | **없음** |
| steered | steering 적용 | 있음 (steering.ts:315) |
| review_signoff_ignored | sign-off 무시 사유 | 있음 (review-observer.ts:119) |
| review_round_superseded | round 폐기 | 있음 (orchestrate-cli.ts:732) |

타입은 있는데 발생 지점이 없는 세 이벤트가 곧 "public lifecycle 부재"의 증거다.

## 공개 CLI 연산

| 명령 | 종류 | 효과 |
| --- | --- | --- |
| init | 쓰기 | slug 생성, v1 plan 생성, 초기 criterion, created append, session 바인딩 |
| show | 읽기 | 상태 요약 |
| validate | 읽기 | E8 + v2 source/receipt 검증 |
| steer | 쓰기 | additive batch(annotate/add-criterion/add-work-phase) |
| add-criterion | 쓰기 | criterion 하나 추가 |
| add-work-phase | 쓰기 | 빈 task 목록의 pending phase 추가 |

init의 `--surface`는 파서와 타입에는 있지만 구현에서 쓰이지 않는다. steer/add-* 는 도움말에
`--slug`를 노출하지만 실제 대상은 `--session`에 바인딩된 slug다.

## E8 판정 로직

`update_goal {status:"complete"}`에만 적용된다. blocked는 항상 통과한다. E8 전에 먼저 막는 것:
세션 상태 읽기 불가, PABCD 진행 중, 미검증 subagent 증거, evidence-unrecordable marker,
검증 예산 소진 subagent, bound goalplan 부재/손상.

공통 규칙: workPhases와 criteria가 둘 다 비면 실패, met인데 증거가 공백이면 실패, done도
superseded도 아닌 phase가 있으면 실패, done phase 안에 pending task가 있으면 실패,
open criterion이 있으면 실패, superseded 무결성(supersededBy 없음/자기 지목/미존재 지목/
또 다른 superseded 지목) 실패.

v2 추가 규칙은 finalGate·review round·source identity·receipt 일치까지 요구한다. 다만 v2 오류
문구가 안내하는 `cxc review-round open --lane final_gate`의 `--lane`이 현재 CLI에 없어서,
공개 CLI만으로는 v2 final gate를 완성할 수 없다.

## 없는 것

task 추가·완료·수정·삭제, criterion을 met으로 바꾸기, capturedEvidence 기록, phase
block/unblock, phase supersede, host arm, v2 승격, final-gate 생성·완료 — 전부 공개 연산이 없다.
구조적으로는 task 의존 모델, 명시 순서 필드, criteriaIds 참조 무결성 검사, 전체 writer 공통 락,
JSON과 원장의 단일 트랜잭션, 동시 갱신 충돌 감지, 원장 스키마 버전, stale steering lock 회수가 없다.

D-close는 "task를 끝내고 done으로 표시하라"고 안내하지만 이를 수행하는 공개 CLI가 없다.
D-close는 대신 완료시키지 않고 pending이 있으면 거부만 한다(orchestrate-cli.ts:632).
