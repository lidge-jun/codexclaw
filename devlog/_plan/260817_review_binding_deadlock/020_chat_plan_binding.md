---
created: 2026-08-17
status: design
workPhase: wp3
tags: [codexclaw, hook, plan-binding]
---

# 020 — 채팅 경로에도 plan binding을 기록한다

## 문제

`hook.ts`의 채팅 writer는 ${BT}checkEpoch${BT}를 다루면서
${BT}planUnit${BT}/${BT}planEpoch${BT}는 쓰지 않는다. 결과:

```
채팅 P>A 후 → planEpoch=NULL → review-round open 거부
```

075에서 ${BT}checkEpoch${BT}를 넣을 때는 CLI와 채팅 양쪽을 배선했는데,
060의 ${BT}planEpoch${BT}는 CLI만 했다. 같은 실수를 두 번은 안 한다.

## 처방

CLI의 producer(${BT}orchestrate-cli.ts:519-542${BT})와 대칭으로 만든다.

```ts
// P>A일 때만 발급. plan-gate가 검증한 unit을 그대로 쓴다.
const planBinding = state.phase === "P" && result.state.phase === "A"
  ? bindingFromAttest(command.attest, payload.cwd)
  : null;
```

채팅은 attest 없이도 위상을 옮길 수 있는 human free-pass다. 따라서:

| 채팅 P>A | planUnit/planEpoch |
|----------|--------------------|
| ${BT}--attest${BT}에 유효한 ${BT}planUnit${BT}이 있고 plan-gate 통과 | 발급 |
| attest 없음 또는 planUnit 없음 | **null 유지** |

attest 없는 채팅 진입에 binding을 만들지 않는 이유: plan-gate 검증을 안 거친
unit을 결속하면 060이 막으려던 "아무 unit이나 지목"이 채팅으로 돌아온다.
그 경우 ${BT}review-round open${BT}이 거부하고, 안내는 이미 그 방향을 가리킨다
("enter A through ${BT}cxc orchestrate A${BT}").

달라지는 것은 **attest를 준 채팅 진입이 이제 동작한다**는 점이다.

## lifecycle

CLI와 같다: A가 아니면 null. ${BT}clearedIdle${BT}은 이미 두 필드를 지운다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| ${BT}src/hook.ts${BT} | 채팅 writer에 planUnit/planEpoch producer |
| ${BT}src/orchestrate-cli.ts${BT} | 발급 로직을 공유 함수로 추출 (중복 제거) |
| ${BT}test/review-binding.test.ts${BT} | attest 있는/없는 채팅 진입 각각 |
