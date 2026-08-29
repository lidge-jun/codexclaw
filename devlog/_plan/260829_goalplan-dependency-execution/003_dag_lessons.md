# 003 — senpi-task DAG에서 가져올 것과 버릴 것

출처: T3 파견. 대상 devlog/.omo/packages/senpi-task/src/dag (HEAD 84f98d8bd).
목적은 코드 이식이 아니라 설계 판단 근거다. 실측 규모는 코어 4,441줄 + 테스트 약 1만 줄.

## 컴파일 시점 — 영속화 전에 거부한다

별도 define 단계가 없다. `manager.start()`가 정의를 접수하자마자, 실행 레코드·키·이벤트를
만들기 **전에** 동기적으로 컴파일한다(manager.ts:219, 305). 컴파일 실패면 run, key, event를
하나도 만들지 않는다(309). 사이클은 다른 구조 오류가 없을 때 검출하고 경로를 `A -> B -> A`
형태로 보고한다(graph.ts:225). 모든 컴파일 오류는 fatal이고 그래프를 반환하지 않는다(43).

우리 교훈: 그래프 유효성 검사는 "실행 직전"이 아니라 "정의를 영속화하기 전"의 입구 검사다.
잘못된 정의가 상태나 식별자를 점유하면 안 된다. 조사 당시에는 wp3의 등록 시점 거부로 적었지만,
순수 검증은 wp3, 락은 wp5, 공개 등록 입구는 wp6이 소유한다. 정본 §7이 최종이다.

## dependency-frontier — 선언한 것보다 강한 동기화를 부과하지 않는다

입학 조건 셋: 상태가 미완료(pending/blocked), 모든 직접 의존이 정확히 completed,
실제 실행 슬롯 확보 가능(scheduler.ts:725).

슬롯은 미리 숫자로 판단하지 않는다. 시도해서 거절되면 FIFO 대기열에 넣고, 실행 중 하나가
끝날 때마다 가장 오래 기다린 것부터 재시도한다(493, 514, 526).

이전 strict barrier를 버린 이유가 핵심이다. 같은 그룹의 무관한 느린 형제가 끝날 때까지 이미
모든 실제 의존이 끝난 downstream을 막았고, 선언된 dependsOn보다 강한 조건을 몰래 부과해
starvation을 만들었다(452). 그래서 이제 wave는 실행 장벽이 아니라 표시·이벤트 그룹이다(558).

실패 전파도 즉시 하지 않는다. 실행 중 형제가 하나도 없는 quiescence에서만 dependent skip을
적용한다. 실패 항목이 아직 살아날 수 있는데 일찍 downstream을 접으면 복구 가능성을 닫기
때문이다(463, 709).

우리 교훈: 입학 조건은 "미완료 + 모든 직접 의존 완료" 하나로 유지한다. 배열 순서나 그룹을
추가 장벽으로 쓰지 않는다. 이것이 wp4의 설계 원칙이다.

## WAL — 뺄 수 없는 것과 줄일 수 있는 것

단조 seq는 뺄 수 없다. append 시 로그 tail과 checkpoint seq 중 큰 값에 1을 더하고(journal.ts:90),
store도 tail의 다음이 아니면 거절한다(store.ts:152). 재생은 checkpointSeq 이후만 적용한다(158).
seq가 없으면 순서 복원, catch-up 커서, 중복 소비 억제, checkpoint 접합점을 모두 잃는다.

체크포인트는 이 구현에서는 뺄 수 없다. 최초 checkpoint에 전체 정의와 상태가 들어가고
`dag.run.created` 이벤트에는 전체 정의가 없기 때문이다(manager.ts:346, recovery.ts:422).
다만 우리 규모에서 "매 이벤트마다 최신 checkpoint"는 필수가 아니다. 전체 정의가 담긴 durable
초기 스냅샷 + 단조 seq + 마지막 checkpoint 이후 멱등 replay면 충분하다.

중복 배달 방지는 층을 나눠야 한다. journal subscriber 자체는 exactly-once가 아니다(150, 236).
필수는 "정확히 한 번 배달"이 아니라 `(runId, seq)` 커서와 멱등 소비자다. 반면 항목의 중복
실행 방지는 필수이고, owner identity를 `fingerprint + nodeId + execAttempt`로 고정해 재시도가
같은 실행을 다시 만들지 않게 한다(scheduler.ts:789).

순서도 중요하다. 완료 이벤트의 WAL보다 결과 artifact를 먼저 준비해 "완료는 기록됐는데 결과가
없는" 창을 줄인다(journal.ts:102).

우리 적용: 자체 WAL 엔진을 만들지 않고 기존 ledger.jsonl을 역사로 유지한다. 대신 "완료는
검증 가능한 증거와 함께만 인정한다"는 불변식을 validateGoalplan이 이미 절반 갖고 있으니
(공백 증거 met 거부) 그 방향을 강화한다.

## 복구 — 모호한 실행을 추측하지 않는다

신뢰 순서: checkpoint + 이후 WAL 재생 projection → stable owner로 조회되는 기존 작업 →
durable 결과 artifact → 살아 있는 lease holder.

완료 항목은 durable 결과가 있을 때만 출력을 재사용한다(recovery.ts:222). 주의할 점이 있다.
`state === completed`인데 결과가 없어도 이 구현은 재실행하지 않고 그냥 넘어간다. 즉 "완료 상태
재사용"과 "출력 재사용"의 조건이 다르다. 우리가 가져갈 때는 이를 더 강하게 묶는 편이 안전하다.

진행 중이던 항목은 taskId나 stable owner로 기존 작업을 찾고(240), 살아 있으면 재부착하고(284),
없으면 같은 owner로 재시도하고(244), 결과만 있으면 완료로 접고(262), 둘 다 없으면 함부로
재실행하지 않고 실패시킨다(270).

우리 교훈: 상태가 모호할 때 임의로 되돌리거나 다시 실행하지 않는다. 재시도는 완료 기록을
되돌리지 않고 새 항목을 만든다(과거 G2 판정과 일치).

## amend — 변경 closure 전체를 무효화한다

run이 진행 중이면 거절하고, 변경·삭제 대상 중 진행 중 항목이 있어도 거절한다(441, 453).
무효화 대상은 fingerprint가 바뀐 항목 + 새 항목 + 그들의 모든 transitive dependent이며,
새 항목 자체는 목록에서 제외한다(457, 610). 기존 무효 항목은 pending으로 되돌리고 오류·결과
메타·시간을 지우고 execAttempt를 올린다(469). fingerprint에는 id, label, 의존성, prompt, route,
summary, description이 들어간다(590). load_skills만 바꾼 amendment는 재실행하지 않는다(146).

우리 규모 적용: amend 런타임은 범위 밖이지만, "의존 구조를 고치면 downstream 판정도 다시
해야 한다"는 원칙은 wp3 검증에 반영한다.

## retry — 표시 카운터와 실행 카운터를 구분한다

대상 상태는 failed/cancelled/skipped만(node-retry.ts:16). 기본 선택은 실패 항목과 그로 인해
skip된 transitive dependent(116). skip만 재시도하려면 원인 조상도 같은 호출에 포함해야
한다(165). 완료 항목은 retry 불가이고 amend로 새 실행 의도를 만들어야 한다(149).

`attempt`는 부착 횟수 표시용(scheduler.ts:622), `execAttempt`는 새 실행 의도를 나타내는 durable
카운터로 owner identity를 바꾼다(node-retry.ts:94). 복구 재부착 때문에 표시용 attempt가 달라질
수 있으니 중복 방지 키에 쓰면 안 된다(recovery.ts:447).

## 규모 무관 필수 (우리가 재현할 것)

1. 영속화 전 전체 검증과 사이클 검출 → wp3
2. 의존만을 입학 조건으로 삼기 → wp4
3. 명시적 상태와 terminal 상태 → 이미 있음
4. 완료 상태와 검증 가능 증거의 결합 → wp6 task/criterion lifecycle(정본 §4·§7이 최종)
5. 모호한 상태를 임의 재실행/되돌리기 금지 → 전 phase 원칙
6. 변경 시 downstream 재판정 → wp3
7. 실패 dependent 처리를 성급히 하지 않기 → wp4 교착 보고

## 우리 규모(항목 5~15개, 세션 단위)에서 과잉

critical path/bottleneck 분석(graph.ts:295), 실행과 무관한 wave 이벤트 세분, 1,000개 subscriber
ring과 overflow 복구 커서, 17종 boundary 이벤트, PID 기반 외부 run adoption과 이전 lease holder
추적, 다중 프로세스 stale-lock 승계와 quarantine/restore, 세션별 run cap과 retention GC와
history pagination, 매 이벤트 체크포인트 atomic rename.

단 "과잉"이 전부 버리라는 뜻은 아니다. 단일 세션에도 쓰기 직렬화용 공통 락과 durable append는
필요하다. PID adoption과 범용 stale-lock 승계까지는 필요 없다는 뜻이다. 공통 락은 wp5,
공개 lifecycle은 wp6이 소유하며 정본 §6~§7이 최종이다.
