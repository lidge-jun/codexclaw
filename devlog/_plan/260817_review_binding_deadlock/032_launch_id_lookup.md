---
created: 2026-08-17
status: design
workPhase: wp4
supersedes: [030_stuck_round_recovery.md, 031_audit_fold.md]
tags: [codexclaw, recovery, round-selection]
---

# 032 — 라운드를 고르지 말고 launchId로 찾는다

## 031이 틀린 이유

리뷰어가 두 가지를 짚었고 둘 다 맞다.

1. ${BT}activeAuditRound()${BT}를 "cursor 우선"으로 통합하면 r1/r2 상황에서
   **둘 다 r1을 본다.** 일치는 하지만 r2 서명은 여전히 무시되고 r1은
   ${BT}in_flight${BT}로 남는다. 정지가 안 풀린다.
2. terminal cursor r1(approved) + 더 높은 r2(in_flight)일 때 r1 승인을
   소비하게 된다. 게이트가 ${BT}latestRound${BT}를 쓰는 이유가 정확히 이 경우다.

통합의 방향이 틀렸다. 두 소비자는 **다른 질문**을 하고 있다:

| 소비자 | 질문 |
|--------|------|
| observer | "이 서명은 어느 라운드 것인가?" |
| A>B 게이트 | "지금 통과시켜도 되는가?" |

같은 답을 강요할 이유가 없다. observer는 **고를 필요가 없다** —
서명이 ${BT}launchId${BT}를 들고 오기 때문이다.

## 처방 1 — observer는 launchId로 조회한다

```ts
/** The round a launch id belongs to, regardless of cursor or ordering.
 *  A sign-off names its own round; making the observer guess which round is
 *  'active' is what let a verdict land nowhere. */
export function roundByLaunchId(
  plan: Goalplan, purpose: ReviewPurpose, launchId: string,
): ReviewRoundState | null
```

observer는 ${BT}effectiveRound${BT}를 쓰지 않는다. ${BT}roundByLaunchId${BT}로 찾고,
찾은 라운드에 대해 결속을 검사한다. r1이 cursor여도 r2 서명은 r2에 기록된다.

${BT}effectiveRound${BT}의 R14d 계약은 **그대로 둔다.** 그건 "다음에 뭘 할까"를
묻는 함수이고 이 문제와 무관하다.

## 처방 2 — recordVerdict도 launchId로 찾는다

리뷰어 지적: ${BT}recordVerdict${BT}가 ${BT}requireCursorRound${BT}(내부에서
${BT}effectiveRound${BT})를 거치므로 r2를 stale 처리한다(${BT}review-round.ts:170${BT}).
observer만 고쳐서는 소용이 없다.

${BT}advance()${BT}의 조회를 ${BT}roundByLaunchId${BT} 기반으로 바꾼다:

기존 ${BT}stale${BT}/${BT}cas_failed${BT}/${BT}not_found${BT} 계약을 그대로 보존해야 한다
(감사 R3 MAJOR). ${BT}review-round.test.ts:72,89${BT}가 고정하고 있다.

핵심은 **superseded 판정이 CAS보다 먼저**라는 것이다(감사 R4). r1이
${BT}inconclusive${BT}로 밀려난 뒤 올바른 launchId로 늦은 verdict가 와도 ${BT}stale${BT}이어야
한다 — ${BT}cas_failed${BT}가 아니다. R2가 그것을 고정한다(${BT}review-round.test.ts:72${BT}).

```ts
function requireRound(plan, purpose, roundId, launchId) {
  const byLaunch = roundByLaunchId(plan, purpose, launchId);

  if (byLaunch && byLaunch.roundId === roundId) {
    // 이 라운드가 이미 밀려났다면, 늦게 온 서명은 CAS 이전에 stale이다.
    // status만 보면 '두 번째 verdict'(cas_failed)와 구분되지 않는다.
    if (isSuperseded(plan, purpose, byLaunch)) {
      return { kind: "stale", reason: `round ${roundId} was superseded before this verdict arrived` };
    }
    return byLaunch;
  }

  const byId = rounds(plan).find((r) => r.purpose === purpose && r.roundId === roundId);
  if (byId) return { kind: "stale", reason: `launch ${launchId} was superseded by ${byId.lane.launchId}` };

  return { kind: "not_found", reason: `no ${purpose} round for launch ${launchId}` };
}

/** 이 라운드보다 뒤에 열린 같은 purpose의 라운드가 있으면 밀려난 것이다. */
function isSuperseded(plan, purpose, round) {
  return rounds(plan).some((r) =>
    r.purpose === purpose && roundOrder(r.roundId) > roundOrder(round.roundId));
}
```

| 상황 | 결과 | 고정 테스트 |
|------|------|-------------|
| launch가 그 roundId를 가리키고 뒤에 열린 라운드 없음 | 반환 → ${BT}advance${BT}가 status 대조 | R1 |
| **뒤에 더 높은 라운드가 있음** (올바른 launch라도) | **${BT}stale${BT}** | **R2** |
| roundId는 있는데 launch 불일치 | ${BT}stale${BT} | R2b |
| 같은 라운드에 두 번째 verdict (밀려나지 않음) | ${BT}cas_failed${BT} | R3 |
| roundId도 launch도 모름 | ${BT}not_found${BT} | — |

${BT}isSuperseded${BT}를 status가 아니라 **순서**로 판정하는 이유: r1이 아직
${BT}in_flight${BT}인데 r2가 열린 손상 상태에서도 r1은 밀려난 것이 맞다.

cursor는 여전히 ${BT}openRound${BT}가 관리한다. 달라지는 것은 **이미 열린 라운드를
닫을 때 cursor를 볼 이유가 없다**는 점이다 — launchId가 더 정확한 주소다.

${BT}markLaunching${BT}/${BT}markInFlight${BT}도 같은 경로를 타므로 함께 정확해진다.

## 처방 2b — observer는 phase보다 먼저 라운드를 찾는다 (감사 R3 MAJOR)

지금 observer는 ${BT}phase !== "A"${BT}면 plan을 열기도 전에 반환한다
(${BT}review-observer.ts:43${BT}). 그래서 **A를 떠난 뒤 도착한 서명**은 남길 ledger
항목 자체가 없고, ${BT}show${BT}가 보여줄 것도 없다. 010이 없애려던 침묵이 거기 남는다.

순서를 바꾼다:

1. 서명 파싱 (실패면 침묵 — 무관한 서브에이전트)
2. ${BT}state.slug${BT} 확인 (없으면 침묵 — bound 세션이 아님)
3. **${BT}roundByLaunchId${BT}로 라운드 조회** (없으면 침묵 — 남의 launch)
4. 여기서부터는 "이 세션의 이 라운드"가 확정됐으므로, 이후 모든 거부를
   ${BT}review_signoff_ignored${BT}로 **기록한다**:
   - ${BT}phase !== "A"${BT} → "the session left A before the reviewer finished"
   - epoch 불일치 → "the plan was re-planned after this round opened"
   - session/work-phase 불일치 → 각각의 사유
5. 전부 통과하면 ${BT}recordVerdict${BT}

## 처방 3 — 게이트는 latestRound를 유지한다

"최신 라운드가 미완료면 통과 불가"는 옳은 계약이다. 리뷰어가 그 이유를
확인해줬으므로 건드리지 않는다.

대신 **정지를 만들지 않는다.** 두 라운드가 동시에 열리는 상황 자체를 줄인다:
${BT}openRound${BT}는 이미 같은 purpose의 비terminal을 전부 ${BT}inconclusive${BT}로
닫는다(${BT}review-round.ts:143-148${BT}). 그래서 r1/r2 동시 개방은 정상 CLI
경로로는 만들어지지 않는다 — 리뷰어가 든 예는 손으로 조작한 상태다.

실제 정지 경로는 하나로 좁혀진다: **epoch 불일치로 서명이 무시되는 것.**
그건 030의 자동 정리와 010의 기록이 함께 해결한다.

## 처방 4 — epoch 정리 (030 유지, 순서 명세)

1. write **전에** 이전 ${BT}state.planEpoch${BT} 캡처
2. 같은 ${BT}ownerSessionId${BT} + 같은 purpose + **그 이전 epoch**인 비terminal만 닫기
3. 이유를 ledger에 ${BT}review_round_superseded${BT}로
4. 그 다음 새 binding write

## 처방 5 — show가 ledger를 읽는다 (감사 MAJOR)

리뷰어 지적대로 지금 ${BT}show${BT}는 ledger를 안 읽는다. 계약으로 만든다:

```ts
// review-round-cli.ts
function ignoredSignoffsFor(cwd, slug, roundId): string[]  // ledger를 roundId로 필터
```

${BT}show${BT}는 표시 중인 라운드의 무시 기록을 함께 렌더한다. ${BT}--json${BT}에도 넣는다.

## 처방 6 — 채팅 binding은 workPhaseId까지 (감사 MAJOR)

CLI는 ${BT}validatePlanArtifacts${BT} + ${BT}validateWorkPhaseBinding${BT} 둘 다 한다
(${BT}orchestrate-cli.ts:337${BT}). 채팅도 같게 한다 — ${BT}effectiveActiveWorkPhaseId${BT}
존재 확인만으로는 attest의 ${BT}workPhaseId${BT}가 다른 phase를 가리켜도 통과한다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| ${BT}src/review-round.ts${BT} | ${BT}roundByLaunchId()${BT}, ${BT}advance${BT}의 조회 교체, ${BT}supersedeStaleRounds()${BT} |
| ${BT}src/review-observer.ts${BT} | launchId 조회 + 불일치 사유 기록 |
| ${BT}src/goalplan.ts${BT} | ledger event union 2개 + optional roundId/launchId |
| ${BT}src/review-round-cli.ts${BT} | ${BT}show${BT}가 ledger 진단을 렌더 |
| ${BT}src/hook.ts${BT} | 채팅 binding producer (plan-gate + workPhase 검증) |
| ${BT}src/orchestrate-cli.ts${BT} | epoch 정리 호출, 거부 메시지 |
| 테스트 | 아래 |

## 테스트

| 케이스 | 검증 |
|--------|------|
| r1 cursor + r2 서명 | r2에 기록된다 (launchId 조회) |
| terminal cursor + 더 높은 open | 게이트가 거부 (latestRound 유지) |
| 재계획 후 늦은 서명 | ledger에 사유, show에 표시 |
| 재계획이 이전 epoch 라운드 정리 | inconclusive |
| 채팅 attest 진입 | binding 발급, open 성공 |
| 채팅 workPhaseId 불일치 | binding 없음 |
| 복구 후 새 라운드 | A>B 통과 |
| R2 재현: terminal 라운드에 재기록 | ${BT}cas_failed${BT} 유지 |
| R2b 재현: launch 불일치 | ${BT}stale${BT} 유지 |
| A를 떠난 뒤 늦은 서명 | ledger에 기록된다 |
