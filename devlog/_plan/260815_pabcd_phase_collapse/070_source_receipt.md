---
created: 2026-08-15
status: design
workPhase: wp6
tags: [codexclaw, source-receipt, c-to-d]
---

# 070 — C>D source-bound test receipt

## 결함

C>D는 `checkOutput` 문자열을 요구하지만 `exitCode`는 **optional**이다
(`attest.ts:190`). 따라서 checkOutput에 "passed" 한 마디만 넣어도 통과한다
(`attest.test.ts:137`이 그 동작을 고정한다).

## 기존 자산

`source-receipt.ts`의 `parseSourceBoundReceipt()`가
SourceBoundReceipt(kind: test | qa)를 파싱한다. 검증 결과를 실행 당시의
소스 정체성에 결속하므로, 옛 트리에서 돌린 테스트 결과를 새 트리의 증거로
재사용할 수 없다.

## 변경

### `attest.ts` — exitCode 필수화

C>D에서 exitCode를 필수로 만든다. 없으면 거부한다.
`attest.test.ts:137`은 의도적으로 반전한다 — 그 테스트가 고정하던 관용이
바로 결함이다.

### 소스 결속 receipt

bound goalplan이 있는 세션에서는 소스 결속 receipt를 받는다. receipt의
SourceIdentity가 현재 트리와 different면 거부한다 — 검증 후 코드가 바뀌었다는 뜻이다.

HITL 세션은 기존 form 게이트를 유지한다(fail-open).

## activation scenario

| 시나리오 | 트리거 | 관측 효과 |
|----------|--------|-----------|
| exitCode 누락 | checkOutput만으로 D | 거부 |
| 실패 검증 | exitCode 1 | 거부 (기존 동작 유지) |
| stale receipt | 검증 후 코드 수정하고 D | 거부 |
| 정상 | 테스트 통과 후 즉시 D | 통과 |

## 한계

checkOutput 텍스트 자체의 진위는 여전히 검증하지 못한다.
exitCode 필수화와 소스 결속은 **재사용과 누락**을 막지, 조작을 막지 않는다.

