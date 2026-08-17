---
created: 2026-08-17
status: design
workPhase: wp2
tags: [codexclaw, observer, diagnosability]
---

# 010 — observer의 침묵을 없앤다

## 문제

결속 검사 다섯 개가 전부 ${BT}return ""${BT}로 끝난다:

```ts
if (round.lane.launchId !== signoff.launchId) return "";
if (round.ownerSessionId !== sessionId) return "";
if (round.planEpoch !== state.planEpoch) return "";
if (round.workPhaseId !== effectiveActiveWorkPhaseId(plan)) return "";
```

리뷰어가 PASS를 반환했는데 라운드가 안 닫히면, 사용자는 그 이유를 알 방법이 없다.

## 처방 — 무시한 이유를 goalplan ledger에 남긴다

goalplan에는 이미 append-only ledger가 있다(${BT}ledger.jsonl${BT}). 새 저장소를
만들지 않고 거기에 쓴다.

```ts
appendGoalplanLedger(cwd, slug, {
  ts, slug,
  event: "review_signoff_ignored",
  detail: `round ${roundId} ignored a ${verdict} sign-off: ${reason}`,
});
```

사유는 검사마다 구체적으로 적는다:

| 검사 | detail |
|------|--------|
| launchId 불일치 | ${BT}launch <got> does not match the open round's <want>${BT} |
| session 불일치 | ${BT}the round belongs to session <owner>${BT} |
| epoch 불일치 | ${BT}the plan was re-planned after this round opened${BT} |
| work-phase 불일치 | ${BT}the round audited <wp>, but <active> is active now${BT} |
| phase가 A가 아님 | ${BT}the session left A before the reviewer finished${BT} |

## 어디까지 기록하고 어디부터 침묵하나

모든 무시를 기록하면 노이즈가 된다. 경계를 정한다:

- **기록한다**: 서명이 파싱됐고(${BT}parseSignoff${BT} 성공), 이 세션의 goalplan에
  plan_audit 라운드가 열려 있는데도 결속이 안 맞는 경우. 사용자가 리뷰어를
  파견했고 답을 받았는데 반영이 안 된 상황이다.
- **침묵한다**: explorer가 아님, 서명 형식이 아님, 열린 라운드 자체가 없음.
  이건 이 세션과 무관한 서브에이전트의 정상 종료다.

## fail-open 유지

ledger 쓰기 자체도 ${BT}try/catch${BT} 안에 둔다. 기록 실패가 서브에이전트의
종료를 깨뜨리면 안 된다 — 진단을 위해 만든 장치가 진단 대상보다 더 큰 문제를
만드는 셈이 된다.

## review-round show가 읽는다

ledger에만 있으면 사용자가 파일을 열어야 안다. ${BT}show${BT}가 최신 라운드의
${BT}review_signoff_ignored${BT} 항목을 함께 출력한다:

```
review-round r1: status=in_flight staleness=open verdict=- launch=r1-...
  ignored 1 sign-off: the plan was re-planned after this round opened
```

## 변경 파일

| 파일 | 변경 |
|------|------|
| ${BT}src/review-observer.ts${BT} | 다섯 검사를 사유와 함께 기록하도록 재구성 |
| ${BT}src/review-round-cli.ts${BT} | ${BT}show${BT}가 무시된 서명을 함께 렌더 |
| ${BT}test/review-binding.test.ts${BT} | 각 불일치가 사유를 남기는지, 무관한 종료는 침묵하는지 |

## activation scenario

| 시나리오 | 트리거 | 관측 효과 |
|----------|--------|-----------|
| epoch 불일치 | 재계획 후 늦은 서명 | ledger에 사유, show에 표시 |
| 무관한 explorer | 다른 작업의 서브에이전트 종료 | 무기록 (침묵) |
| ledger 쓰기 실패 | 디렉터리 권한 없음 | 예외 없이 통과 |
