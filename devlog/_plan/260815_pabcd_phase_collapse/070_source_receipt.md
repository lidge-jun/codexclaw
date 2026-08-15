---
created: 2026-08-15
status: design
workPhase: wp7
tags: [codexclaw, source-receipt, c-to-d]
---

# 070 — C>D exitCode 필수화

## 결함

C>D는 `checkOutput` 문자열을 요구하지만 `exitCode`는 **optional**이다
(`attest.ts:190`). 따라서 checkOutput에 "passed" 한 마디만 넣어도 통과한다
(`attest.test.ts:137`이 그 동작을 고정한다).

## 기존 자산

`source-receipt.ts`의 `parseSourceBoundReceipt()`가
SourceBoundReceipt(kind: test | qa)를 파싱한다. 검증 결과를 실행 당시의
소스 정체성에 결속하므로, 옛 트리에서 돌린 테스트 결과를 새 트리의 증거로
재사용할 수 없다.

## 코드 실측 (wp7 P)

`attest.ts:190`의 C>D 검사는 두 가지뿐이다:

```ts
if (!att.checkOutput) return { ok: false, ... };                      // 문자열 존재
if (typeof att.exitCode === "number" && att.exitCode !== 0) return ...; // 있을 때만 검사
```

`exitCode`가 optional이므로 `checkOutput: "passed"` 한 마디로 통과한다.
`attest.test.ts` 마지막 줄이 그 관용을 **명시적으로 고정**한다:

```ts
assert.equal(validateAttest("C","D",{...base, checkOutput:"77 pass"}).ok, true); // exitCode optional
```

`source-receipt.ts`의 `parseSourceBoundReceipt(path, expectedKind)`는
`.codexclaw/evidence` 안, symlink 아님, realpath도 안쪽, 정규 파일, 비어있지 않음
다섯 가지를 `hasValidReceipt`에 위임해 검사하고, `SourceBoundReceipt`에
`kind`/`sourceIdentity`/`command`/`exitCode`/`createdAt`를 담는다.

## 변경

### `attest.ts` — exitCode 필수화

C>D에서 exitCode를 필수로 만든다. 없으면 거부한다.
`attest.test.ts:137`은 의도적으로 반전한다 — 그 테스트가 고정하던 관용이
바로 결함이다.

### `pabcd/SKILL.md` — 공개 지침 동기화

세 곳이 아직 exitCode를 optional이라 적는다(`:73`, `:89`, `:102`).
게이트를 바꾸면서 지침을 두면 문서가 거짓말을 한다.

## 범위 축소 (감사 R1 반영)

초안은 exitCode 필수화와 source-bound receipt 배선을 한 work-phase에 묶었다.
리뷰어가 receipt 쪽에 blocker 넷을 냈고, 전부 타당하다:

1. `Attestation`에 receipt 경로 필드가 없어 CLI/채팅 어느 쪽도 게이트까지
   전달할 수 없다(`attest.ts:23,75`).
2. `command`/`exitCode`가 optional이고 `createdAt`도 누락 시 epoch로
   대체되므로, `sourceIdentity`만 복사한 수기 JSON이 test receipt로 파싱된다.
   지금 판정은 identity만 비교하므로 **또 하나의 의식적 게이트**가 된다.
3. 채팅 C>D는 `validateAttest`를 아예 타지 않으므로(`orchestrate-apply.ts:93`)
   exitCode 필수화만으로는 채팅에 아무 영향이 없다.
4. producer가 identity 캡처 후 `.codexclaw/evidence`에 쓰면 트리가 달라진다 —
   050에서 이미 겪은 자기오염 문제다.

기존 `.codexclaw/evidence` 파일 216개도 대체물이 아니다. 구조화 receipt를
발급하는 표면은 QA validator뿐이고 `kind:"qa"`를 쓰며, parser가 QA receipt로
test 슬롯을 채우는 것을 명시적으로 거부한다(`source-receipt.test.ts:46`).

**따라서 이 work-phase는 exitCode 필수화로 축소하고, receipt 배선은
`075`(wp8)로 분리해 등록했다.** 리뷰어도 "재계획하면 가능하지만 현재
범위에서는 회피"라고 했으므로, goalplan에 실제로 등록하는 것이 조건이다.

## activation scenario

| 시나리오 | 트리거 | 관측 효과 |
|----------|--------|-----------|
| exitCode 누락 | `checkOutput`만으로 D | 거부 |
| 실패 검증 | `exitCode: 1` | 거부 (기존 동작 유지) |
| 정상 | `exitCode: 0` | 통과 |

함수 단위 반전만으로는 부족하다. **실제 CLI에서 exitCode 누락 시 phase와 ledger가
불변임을 고정하는 통합 테스트**를 함께 쓴다 — 030/050이 세운 규율이다.

## 한계

`checkOutput` 텍스트와 `exitCode` 값 자체의 진위는 검증하지 못한다.
이 변경이 막는 것은 **누락**뿐이다 — "돌렸다고 말하되 결과를 대지 않는 것".
조작 위험을 줄이는 것은 075의 몫이며, 그조차 위조를 완전히 막지는 못한다.
