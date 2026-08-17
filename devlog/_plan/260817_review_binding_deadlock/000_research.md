---
created: 2026-08-17
status: research
tags: [codexclaw, review-binding, deadlock, observer]
session: 01a005f6-9189-74f1-bf5d-03608a638a01
---

# 000 — 감사는 끝났는데 게이트가 못 읽는다

## 신고

> A에서 서브에이전트 gate를 기록했는데 못 읽는 그런 문제

## 실측 — opencodex 세션 01a00d34

그 세션의 goalplan을 열어보면 r8은 **정상적으로 승인돼 있다**:

```
activePlanAuditRoundId: r8
{ id: r8, status: approved, verdict: pass,
  launch: r8-20260817030633,
  owner: 01a00d34-...,  wp: wp0,
  epoch: e-20260817015434-a2123d }
```

그런데 세션 state는:

```
phase: B   slug: opencodex-gui-1m-...
planEpoch: null   planUnit: null
```

라운드는 epoch를 들고 있는데 세션은 ${BT}null${BT}이다. A>B 게이트의
`round.planEpoch !== state.planEpoch` 검사가 여기서 막는다.

## 두 경로를 격리 프로브로 확정했다

### 1. 재계획 레이스 (주 원인)

실패 세션의 ledger를 보면 ${BT}A>P${BT} 재계획을 **두 번** 했다:

```
01:19:29 P>A
01:48:02 A>P    <- LOOP-REPAIR-01, 3라운드 연속 FAIL
01:49:04 P>A
01:53:27 A>P    <- 5라운드 FAIL 누적, overlay 설계 폐기
01:54:34 P>A
03:18:56 A>B
```

프로브로 재현한 순서:

```
[1] open ok, launch=r1-20260817032250
[2] 재계획 후 새 epoch=e-20260817032250-e0d6b
[3] 늦은 서명 후: status=in_flight verdict=-
    라운드 epoch=e-20260817032250-2b397
[4] A>B exit=1  the latest audit round r1 is in_flight, not approved
```

${BT}A>P${BT}가 새 epoch를 발급하면, 그 전에 파견된 리뷰어가 늦게 종료했을 때
observer의 ${BT}round.planEpoch !== state.planEpoch${BT} 검사에 걸린다. observer는
**조용히 ${BT}return ""${BT}** 하고, 라운드는 ${BT}in_flight${BT}로 영구 정지한다.

### 2. 채팅 경로 producer 누락

```
[1] 채팅 P>A 후      phase=A planEpoch=NULL
[2] review-round open exit=1
    no plan binding on this session
```

`hook.ts`의 채팅 writer는 ${BT}checkEpoch${BT}는 다루면서
`planUnit`/`planEpoch`는 아예 쓰지 않는다. CLI 경로
(${BT}orchestrate-cli.ts:538${BT})에만 producer를 배선하고 채팅을 빠뜨렸다.
075에서 ${BT}checkEpoch${BT}를 넣을 때는 양쪽을 다 했는데, 060의 ${BT}planEpoch${BT}는
한쪽만 했다.

## 진짜 원인은 침묵이다

두 경로 모두 고칠 수 있다. 그러나 이 결함을 **진단 불가능하게** 만든 것은
따로 있다: observer가 결속 불일치를 만나면 아무것도 남기지 않는다.

```ts
if (round.planEpoch !== state.planEpoch) return "";
```

리뷰어는 PASS를 반환했고, 사용자는 그것을 봤다. 그런데 게이트는 라운드가
안 닫혔다고 한다. 그 사이에 무슨 일이 있었는지 **어디에도 기록이 없다.**
사용자가 "기록했는데 못 읽는다"고 말한 것이 정확히 이 상태다.

fail-open은 옳은 설계다 — observer가 던지면 무관한 서브에이전트의 종료가
깨진다. 그러나 fail-open과 fail-silent는 다르다. 아무것도 하지 않는 것과
아무 말도 하지 않는 것은 같지 않다.

## 설계 제약

1. **결속 자체를 없애면 안 된다.** ${BT}planEpoch${BT}는 재사용 차단이 존재 이유다
   (감사 R6이 찾은 구멍). 느슨하게 만들면 그 구멍이 돌아온다.
2. **우회 플래그를 만들지 않는다.**
3. **fail-open을 유지한다.** 기록이 실패해도 서브에이전트 종료를 막지 않는다.
4. **라운드를 손으로 approved로 만들 수 있게 하지 않는다.** 그건 060이 없애려던
   자기 증명이다.

## 다음 문서

- ${BT}010${BT} — observer 침묵 제거: 불일치 사유를 남긴다
- ${BT}020${BT} — 채팅 경로 producer 배선
- ${BT}030${BT} — 정지 라운드 복구 경로
- ${BT}040${BT} — 검증 + 푸시 + 배포 + 로컬 갱신
