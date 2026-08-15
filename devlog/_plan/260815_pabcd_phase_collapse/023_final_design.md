---
created: 2026-08-15
status: design-final
supersedes: [010_phase_tracking.md, 020_collapse_gate.md, 021_audit_fold_redesign.md, 022_cycle_granularity.md]
tags: [codexclaw, pabcd, goalplan, roadmap-lock]
unit: 260815_pabcd_phase_collapse
---

# 023 — 최종 설계: 세 번의 FAIL을 접고

## 감사 이력

한 리뷰어(gpt-5.6-sol, high)와 세 라운드를 돌았고 **세 번 다 FAIL**이었다.

| 라운드 | 설계 | 무엇이 틀렸나 |
|--------|------|---------------|
| 1 | 020: 시간 임계값 + 편집 카운트 | **정상 감사를 거부한다.** A 위상은 원래 파일을 안 고친다 |
| 2 | 021: 위상별 증거 (porcelain 해시) | 바퀴 재발명 — `source-identity.ts`가 이미 더 낫게 해결 |
| 3 | 022: task 기반 사이클 강제 | **task는 사이클 단위가 아니다.** 저장소 계약은 work-phase = 1 사이클 |

세 라운드 모두 같은 병을 앓았다. 나는 **관측하기 쉬운 대리 지표**(시간, 편집 수,
task 수)를 붙잡았고, 리뷰어는 매번 그것이 대리 지표일 뿐임을 보여줬다.

## 사이클 개수는 어디서 정해지는가

라운드 3에서 확정된 사실이다. 저장소 계약은 명시적이다:

> One work-phase maps to one full PABCD cycle. (`loop/SKILL.md:69`)
> The roadmap cycle's D is the roadmap lock. Closing it finalizes the goalplan:
> `workPhases[]` are refined to map 1:1 onto the decade docs. (`loop/SKILL.md:100`)

즉 **사이클 개수 = 로드맵 락에서 등록된 work-phase 개수**다.
task는 work-phase 내부 체크리스트일 뿐이고, task 5개를 done으로 찍고
D를 한 번 닫으면 그만이다(`advanceWorkPhase()`는 task를 소비하지 않는다).

그러므로 "5-6번 돌 것을 1-2번에"는 **로드맵 락 단계에서 구현 단위를 coarse하게
묶어 등록하는 것**이 원인이다. 런타임 게이트로 사후에 만들어낼 수 없다.

이 유닛이 정직하게 할 수 있는 일은 두 가지로 나뉜다:

1. **런타임이 막을 수 있는 것** — 미완 상태로 사이클을 닫는 것, 위상 기록 없이
   구현하는 것, 아무 작업 없이 위상을 통과하는 것.
2. **런타임이 막을 수 없는 것** — 애초에 work-phase를 몇 개로 쪼갤지.
   이건 P 위상의 판단이며, 계약은 이미 문서에 있다.

2번을 게이트로 위장하지 않는다. 그게 세 라운드의 교훈이다.

## 구현 단위 (decade 문서와 1:1)

goalplan에 실제로 등록했다. 문서로만 미루지 않는다 — 라운드 3의 MAJOR 3 지적.

### 030 — CYCLE-COMPLETION-01: 미완 사이클을 닫지 못한다

`advanceWorkPhase()`가 pending task를 무시하고 work-phase를 done 처리하는
문제(`goalplan.ts:832`)를 고친다. 실물 조사 결과 이 게이트는 안전하다:
83개 goalplan에서 task 814개 중 759개(93%)가 done으로 관리되고 있고,
done인 work-phase 227개 중 pending task를 가진 것은 **3개(1%)뿐**이다.
정상 사용을 막지 않고 그 1%만 걸린다.

라운드 3의 BLOCKER 2가 결정적이다. **preflight 위치가 핵심이다.**
현재 두 경로 모두 IDLE state와 ledger를 **먼저 쓰고** 그 다음
`advanceWorkPhase()`를 부른다(`hook.ts:663→683`,
`orchestrate-cli.ts:342→357`). 여기서 거부하면
"FSM은 IDLE, ledger는 done, goalplan은 미완"이라는 불일치가 생긴다.

따라서 preflight는 `transition()`/`applyHumanTransition()`과
모든 state·ledger 쓰기보다 **앞에** 둔다. 거부 시:

- state.phase는 `C` 그대로
- ledger 무기록
- goalplan 무변경

그리고 bound slug가 있는데 goalplan이 unreadable이면 **fail-closed**로 간다
(라운드 3 MAJOR 4). 이 저장소는 goalplan 수동 편집이 정상 워크플로이므로
파일이 사라지면 게이트가 열리는 구멍은 실질적이다.

`isGoalplanComplete()`도 함께 고친다(MINOR 1) — 안 그러면
`loop show`는 complete=true인데 `loop validate`는 실패하는 모순이 생긴다.

반환형은 판별 유니온으로 바꾼다. 소비자는 production 2곳 + 테스트 **11곳**
(`goalplan.test.ts` 8곳, `work-phase-states.test.ts` 3곳 —
라운드 3이 찾아준 누락 파일).

`goalplan.test.ts:224/316`은 의도적으로 반전하되, 316이 지키던
"D가 task를 자동 done 처리하지 않는다"는 불변식은 **유지한다**. 새 테스트는
결과가 `tasks_pending`이면서 입력 plan과 task status가 불변임을 함께 검증한다.

### 040 — TRIGGER-AUTHORITY-01: 자연어는 위상을 못 움직인다

자연어 트리거가 `phase`를 직접 쓰는 문제(`hook.ts:524`).
`detectTrigger` 매핑은 보존하고, mode 1에서 phase 쓰기만 제거한다.
`IDLE→P/I`는 예외로 허용한다(기존 테스트 보존, 진입은 무해).

라운드 3의 BLOCKER 3을 반영해 **순서도 뒤집는다.** 지금은 trigger 분기가
먼저 반환해버려서(`hook.ts:515`) "pabcd 여러 번 돌려서 구현해" 같은
프롬프트가 loop-arm 분기(`hook.ts:542`)에 도달하지 못한다. 결과는
IDLE + BUILD directive라는 최악의 조합이다. loop-arm이 걸린 프롬프트는
BUILD가 아니라 **arming mandate**를 받아야 한다.

`hook.test.ts:254/296`이 이 잘못된 우선순위를 고정하고 있으므로
의도적으로 반전한다.

### 050 — B>C 소스 델타

`captureSourceIdentity()`를 재사용한다. 직접 만들지 않는다 —
그 모듈은 `-uall`/`-z`와 dirty 파일 내용 해시까지 이미 갖췄다.

한계를 문서에 남긴다: P에서 만든 변경을 B에서 커밋만 해도 통과하고,
공유 워크트리에서는 오귀속이 가능하며, git이 없으면 fail-open이다.
**보조 신호**이지 주 방어선이 아니다.

### 060 — 검증 + 푸시 + 배포

`npm run build`(루트, canonical)로 dist를 동기화한다. 훅이
`dist/cli.js`를 직접 실행하므로 이걸 빠뜨리면 설치본에서 수정이 동작하지 않는다.
테스트 파일은 43개다.

### 070 — A>B review-round 배선

감사 위상 붕괴가 전체의 38%로 가장 크다. `review-round.ts`는 이미
`plan_audit` 라운드, plan hash, verdict lifecycle을 갖추고 주석에
"A→B 배선만 남았다"고 적어 놨다. CLI 표면이 필요한 독립 작업이므로
**별도 work-phase(wp6)로 등록했다.**

### 080 — C>D source-bound receipt

`exitCode`가 optional이라 `checkOutput:"passed"` 문자열만으로 통과한다
(`attest.ts:190`). `parseSourceBoundReceipt`를 배선하고 exitCode를
필수화한다. **별도 work-phase(wp7)로 등록했다.**

## 이 설계가 사용자 문제에 답하는 방식

> "PABCD 5-6번 돌 것을 1-2번에, B에서 전부 구현, 심지어 A도 안 간다"

| 신고 | 처방 | 정직한 평가 |
|------|------|-------------|
| 5-6번 → 1-2번 | 030이 미완 사이클 닫기를 막는다 | **부분적.** 근본은 로드맵 락의 분해 품질이며 그건 P의 판단이다 |
| B에서 전부 구현 | 050이 소스 델타를 본다 | 보조 신호. 커밋 우회 가능 |
| A도 안 간다 | 040이 자연어 직행을 막고, 070이 감사 실물을 요구한다 | 070이 실질적 답 |

세 라운드를 거쳐 배운 것을 한 줄로: **런타임 게이트는 규율을 대체하지 못한다.
게이트가 할 수 있는 일은 규율을 어기는 것을 눈에 보이게 만드는 것이다.**

