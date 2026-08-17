---
created: 2026-08-17
status: design
workPhase: wp4
tags: [codexclaw, recovery]
---

# 030 — 정지한 라운드에서 빠져나온다

## 문제

재계획으로 결속이 끊긴 라운드는 ${BT}in_flight${BT}로 남는다. ${BT}latestRound${BT}가
그것을 보고 A>B를 거부하므로, 사용자는 ${BT}abort${BT}를 알기 전까지 막힌다.

실패 세션은 여기서 멈췄다.

## 처방 1 — 재계획이 자기 라운드를 정리한다

epoch가 바뀌는 순간, 이전 epoch의 비terminal 라운드는 이미 무의미하다.
새 epoch를 발급하는 producer가 그것들을 ${BT}inconclusive${BT}로 닫는다.

```ts
// P>A에서 새 binding을 발급할 때
supersedeStaleRounds(plan, "plan_audit", previousEpoch)
```

이유: 정리를 사용자에게 맡기면, 사용자는 무엇을 정리해야 하는지 모른다.
재계획이 만든 문제는 재계획이 치운다.

## 처방 2 — 거부 메시지가 길을 알려준다

현재: ${BT}the latest audit round r1 is in_flight, not approved${BT}

라운드가 현재 epoch와 다르면 그 사실을 말한다:

> round r1 audited a plan that has since been re-planned; it can no longer be
> spent. Open a fresh round for the current plan.

## 처방 3 — 늦은 서명은 이미 010이 기록한다

030은 정리와 안내만 맡는다. 무시된 서명의 사유는 010의 ledger가 남긴다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| ${BT}src/review-round.ts${BT} | ${BT}supersedeStaleRounds()${BT} |
| ${BT}src/orchestrate-cli.ts${BT} / ${BT}src/hook.ts${BT} | 새 binding 발급 시 호출 |
| ${BT}src/orchestrate-cli.ts${BT} | A>B 거부 메시지에 epoch 불일치 사유 |
| ${BT}test/review-binding.test.ts${BT} | 재계획이 정리하는지, 복구 후 정상 진행되는지 |

## activation scenario

| 시나리오 | 트리거 | 관측 효과 |
|----------|--------|-----------|
| 자동 정리 | 라운드 연 뒤 A>P>A | 이전 라운드가 inconclusive |
| 복구 후 진행 | 새 라운드 열고 서명 | A>B 통과 |
| 안내 | 옛 epoch 라운드로 A>B | 재계획 사실을 명시한 거부 |
