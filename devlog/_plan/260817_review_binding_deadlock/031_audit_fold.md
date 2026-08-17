---
created: 2026-08-17
status: design
workPhase: wp4
supersedes: [030_stuck_round_recovery.md]
tags: [codexclaw, recovery, round-selection]
---

# 031 — 감사 반영: 정지 경로가 하나가 아니었다

## 리뷰어가 찾은 두 번째 경로 (BLOCKER)

030은 epoch 불일치만 다뤘다. 그런데 **같은 epoch 안에서도** 정지한다.

`effectiveRound()`는 유효한 cursor를 우선하고(`review-round.ts:77-80`),
`latestRound()`는 항상 최대 번호를 고른다. 두 함수가 갈라지는 순간:

```
r1 (cursor, in_flight)   <- observer가 여기를 본다
r2 (in_flight)           <- A>B 게이트가 여기를 본다

r2의 서명 도착 → observer는 r1과 대조 → launchId 불일치 → 무시
A>B → latestRound=r2가 in_flight → 거부
```

둘 다 같은 epoch라 030의 정리가 닿지 않는다. 기존 테스트 ${BT}R14d${BT}가
이 cursor 우선 동작을 의도적으로 고정하고 있으므로(${BT}review-round.test.ts:264${BT}),
동작을 바꾸는 게 아니라 **두 함수가 갈라질 수 있다는 사실 자체**를 없애야 한다.

## 처방 — 선택 규칙을 하나로 합친다

observer와 게이트가 서로 다른 라운드를 보는 것이 결함의 뿌리다.
두 소비자가 같은 함수를 쓰게 한다.

```ts
/**
 * The one round both the observer and the A>B gate act on.
 * Splitting this decision across two functions is what let a sign-off land on
 * one round while the gate waited on another.
 */
export function activeAuditRound(plan: Goalplan, purpose: ReviewPurpose): ReviewRoundState | null
```

규칙: **cursor가 유효하면 cursor, 아니면 최대 번호.** ${BT}effectiveRound${BT}의
기존 규칙이되 terminal도 포함해서 돌려준다 — 게이트는 approved를 봐야 하고
observer는 비terminal만 다루면 되므로, 호출부가 각자 필터한다.

동시에 ${BT}openRound()${BT}가 새 라운드를 열 때 **같은 purpose의 비terminal 라운드를
전부 닫는다.** 이미 그렇게 하고 있지만(${BT}review-round.ts:143-148${BT}),
pending 재사용 분기가 예외를 만든다. 그 분기도 cursor를 갱신하게 한다.

## 처방 — epoch 정리의 원자적 순서 (감사 MAJOR)

030의 자동 정리는 옳다고 확인받았다. 순서만 명세한다:

1. write **전에** 이전 ${BT}state.planEpoch${BT}를 캡처한다
2. 같은 ${BT}ownerSessionId${BT} + 같은 purpose + **그 이전 epoch**인 비terminal 라운드만 닫는다
3. 닫는 이유를 ${BT}lane.reviewerSession${BT}이 아니라 ledger에 남긴다
4. 그 다음 새 binding을 state에 쓴다

다른 세션의 라운드나 현재 epoch의 라운드는 건드리지 않는다.

## 010 보강 — ledger 스키마 (감사 MAJOR)

리뷰어 지적대로 ${BT}GoalplanLedgerEvent${BT} union에 새 event가 없고,
detail 문자열만으로는 "어느 라운드의" 무시인지 안정적으로 못 읽는다.

```ts
// goalplan.ts
export type GoalplanLedgerEvent =
  | ... 기존 ...
  | "review_signoff_ignored"
  | "review_round_superseded";

export interface GoalplanLedgerEntry {
  // ... 기존 ...
  /** 060/031: which round the entry is about, so `show` can filter by round. */
  roundId?: string;
  launchId?: string;
}
```

`show`는 **표시 중인 라운드의** ${BT}roundId${BT}로 필터해서 렌더한다.
r2가 열린 뒤에도 r1의 진단이 r1을 보여줄 때 나온다.

## 020 보강 — 채팅 binding도 CLI와 같은 검증 (감사 MAJOR)

단순 ${BT}bindingFromAttest()${BT}는 060 우회다. 채팅도 CLI와 동일하게:

1. ${BT}validatePlanArtifacts(attest, cwd)${BT} 통과 — 실제 번호 문서가 있는 unit인지
2. bound goalplan의 ${BT}effectiveActiveWorkPhaseId${BT} 존재
3. 둘 다 통과할 때만 binding 발급

검증 실패 시 위상은 옮기되(human free-pass 보존) binding은 null로 둔다.

### 채팅 A>B free-pass 정책 (감사 MAJOR)

리뷰어 지적: attest 없이 채팅으로 A에 간 사용자는 "막히는" 게 아니라
채팅 A>B free-pass로 **review round 자체를 우회**한다.

이 정책은 **유지한다.** 근거는 060이 세운 것과 같다 — 사람이 직접 위상을
옮기는 것은 back-fill이 아니고, ${BT}pabcd/SKILL.md:55${BT}의 계약이다.
이 유닛은 "기록했는데 못 읽는" 결함을 고치는 것이지 free-pass 정책을
바꾸는 게 아니다. 다만 그 사실을 020에 명시적으로 적는다.

## 테스트 보강 (감사 MAJOR)

리뷰어가 셋 다 약하다고 했고 맞다:

| 문제 | 수정 |
|------|------|
| ESM에서 ${BT}require${BT} 사용 | 상단 ${BT}import${BT}로 |
| epoch 직접 변조 | 실제 ${BT}A>P>A${BT} CLI 전이로 |
| binding 필드만 확인 | plan-gate 거부, 새 라운드 서명, A>B 복구까지 |

추가: cursor/latest 갈라짐 재현(r1 cursor + r2 open → 서명이 어디로 가는지).

## MINOR — observer 검사 순서

${BT}phase !== "A"${BT}도 진단 대상이므로, phase 검사보다 **먼저** slug로 라운드를
식별해 둔다. 그래야 "A를 떠난 뒤 리뷰어가 끝났다"도 기록할 수 있다.
