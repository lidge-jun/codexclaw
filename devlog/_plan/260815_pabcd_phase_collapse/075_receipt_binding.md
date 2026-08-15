---
created: 2026-08-15
status: design
workPhase: wp8
tags: [codexclaw, source-receipt, c-to-d, producer]
---

# 075 — C>D source-bound test receipt

070이 `exitCode` **누락**을 막았다. 이 문서는 그 값이 실제 실행에서 나왔는지를
다룬다. 감사가 070 초안에 낸 blocker 넷이 그대로 이 유닛의 요구사항이다.

## 감사가 지적한 네 가지

1. `Attestation`에 receipt 경로 필드가 없어 CLI/채팅 어느 쪽도 게이트까지
   전달할 수 없다(`attest.ts:23,75`).
2. `command`/`exitCode`가 optional이고 `createdAt`도 누락 시 epoch로
   대체되므로(`source-receipt.ts:104-107`), 유효한 `sourceIdentity`만 복사한
   수기 JSON이 `kind:"test"` receipt로 파싱된다.
3. 채팅 C>D는 `validateAttest`를 아예 타지 않는다(`orchestrate-apply.ts:93`).
4. producer가 identity를 캡처한 뒤 `.codexclaw/evidence`에 쓰면 트리가 달라진다 —
   050에서 겪은 자기오염.

## 1. producer — `cxc receipt test`

기존 evidence 파일은 대체물이 아니다. 구조화 receipt를 발급하는 표면은 QA
validator뿐이고 `kind:"qa"`를 쓰며, parser가 QA로 test 슬롯을 채우는 것을
거부한다(`source-receipt.test.ts:46`).

```
cxc receipt test --session <id> -- <command...>
  → 명령을 실제로 실행하고, 종료 후 receipt를 .codexclaw/evidence/에 쓴다.
  → stdout에 receipt 경로. exit는 실행한 명령의 exit code를 그대로 물려준다.
```

**producer를 쓴 경우에 한해** `command`와 `exitCode`는 관측값이다 —
`spawnSync`가 돌린 결과를 그대로 기록하므로 에이전트가 숫자를 고르지 않는다.
게이트는 producer provenance를 인증하지 않으므로 "에이전트가 값을 적을 수 없다"는
주장은 하지 않는다(아래 한계).

`spawnSync` 계약: `shell: false`, argv 비어있지 않음, `cwd`는 세션 cwd,
`stdio: "inherit"`. spawn 실패나 시그널로 `status === null`이면 receipt를
발급하지 않고 비영으로 종료한다 — 문자열을 셸로 재실행하면 기록한 command와
실제 argv가 갈라진다.

### identity 캡처 규칙 (감사 R2 BLOCKER 1)

**producer와 게이트가 같은 규칙을 써야 한다.** 한쪽만 `.codexclaw`를 제외하면
receipt는 발급 즉시 stale이다. `source-identity.ts:147` 주석대로 기본 캡처는
`.codexclaw`를 포함하므로 자동으로 맞지 않는다.

따라서 producer의 실행 전·후 캡처와 `check-gate.ts`의 현재 캡처를 **모두**
`excludeCodexclawArtifacts: true`로 고정한다.

기존 final-gate validation(`goalplan.ts:842`)은 기본 캡처를 쓰므로, 이 receipt를
그 경로에서 재사용하지 않는다 — 스키마는 공유하되 소비 지점은 분리한다.

### 실행 전후 캡처 (감사 R2 BLOCKER 3)

실행 전 identity 하나만 저장하면, **명령 자체가 소스를 바꾸는 경우**(생성 파일,
포매터, 스냅샷 갱신) receipt가 발급되자마자 stale이다.

- 실행 **전** 캡처 → 실행 → 실행 **후** 캡처
- `compareSource()`가 `different`면 성공 receipt를 발급하지 않는다(비영 종료 + 사유).
  명령이 트리를 바꿨다면 그 결과로 D를 닫는 것 자체가 옳지 않다.
- `unavailable`(git 없음/해석 실패)도 발급하지 않는다 — `different`와 별개
  분기이며(`source-identity.ts:180`), "모르겠다"를 "같다"로 읽으면 안 된다.
- `same`일 때만 **실행 후** identity를 기록한다.

receipt 경로는 세션당 결정적이다: `.codexclaw/evidence/<session>/test-receipt.json`.
producer는 **실행 시작 시 그 경로를 제거**한다 — QA producer와 같은 방식
(`validate-evidence.mjs:170`). 결정적 경로가 아니면 실패한 재실행 뒤에도
이전 성공본이 다른 이름으로 살아남아 그대로 소비된다.

## 세션·사이클 결속 (감사 R2 BLOCKER 2)

`--session`을 받으면서 receipt에도 게이트에도 세션 정보를 남기지 않았다.
경로 가드는 `.codexclaw/evidence` 아래 **아무 파일이나** 허용하므로,
다른 세션이나 이전 사이클이 같은 트리에서 발급한 receipt가 그대로 통과한다.
그러면 c9의 `reuse` 거부 주장은 성립하지 않는다.

060의 `planEpoch`와 같은 처방을 쓴다.

```ts
/** CHECK-BINDING-01: minted on entry to C, cleared on entry to any other phase.
 *  A receipt records the epoch it was produced under; C>D requires a match, so a
 *  receipt from an earlier check — or from another session — cannot be spent. */
checkEpoch: string | null;   // State에 추가, planEpoch와 같은 lifecycle
```

receipt 스키마에도 두 필드를 넣는다:

| 필드 | 용도 |
|------|------|
| `ownerSessionId` | 다른 세션의 receipt를 빌려올 수 없다 |
| `checkEpoch` | 이전 C 사이클의 receipt를 재사용할 수 없다 |

producer는 `phase === "C"`를 요구하고 `state.checkEpoch`를 receipt에 복사한다.
게이트는 `receipt.ownerSessionId === sessionId`와
`receipt.checkEpoch === state.checkEpoch`를 요구한다.

`planUnit`/`planEpoch`가 A에서만 사는 것처럼, `checkEpoch`는 C에서만 산다.
`clearedIdle`과 P/I 진입에서 null이 되고, 같은 writer 목록을 탄다.

## 2. 검증 경계 — generic parser는 건드리지 않는다 (감사 R3 BLOCKER 1)

초안은 `parseSourceBoundReceipt`의 `kind:"test"` 계약 자체를 강화하려 했다.
그건 틀렸다. final-gate validation이 **같은 함수를** `"test"` 인자로 호출하므로
(`goalplan.ts:858`, `goal-gate.ts:224`), 강화하는 순간
`ownerSessionId`/`checkEpoch`가 없는 기존 final-gate receipt가 전부 무효가 된다.
"재사용하지 않는다"고 선언해도 호출 그래프는 바뀌지 않는다.

**generic parser의 수락 규칙은 그대로 둔다.** 추가 조건은 `check-gate.ts`가
C>D 경로에서만 검사한다. `plan-gate.ts`가 P>A 전용 검사를 소유하는 것과 같은 구조다.

다만 **반환 shape는 넓혀야 한다**(감사 R4 BLOCKER 1). 지금 parser는
`ownerSessionId`/`checkEpoch`를 아예 버리고, 누락된 `createdAt`을 epoch
문자열로 덮는다(`source-receipt.ts:101`). 그러면 downstream이 "진짜 1970년"과
"누락"을 구분할 수 없어, 막으려던 위장이 그대로 남는다.

```ts
export interface SourceBoundReceipt {
  // ... 기존 필드 ...
  /** C>D 결속용. generic 수락에는 영향 없음 — 있으면 보존, 없으면 undefined. */
  ownerSessionId?: string;
  checkEpoch?: string;
  /** 원본에 createdAt이 있었고 유효한 ISO였는지. 기본값 대체와 구분하기 위함. */
  createdAtProvided: boolean;
}
```

수락 규칙은 한 줄도 바뀌지 않으므로 final-gate와 `final-gate-guard.ts`의
동작은 그대로다. C>D만 새 필드를 읽는다.

이러면 `final-gate-guard.ts:97`의 중복 파서도 손댈 필요가 없다 — split-brain
걱정 자체가 사라진다. 한 계약을 둘로 나누는 대신, 새 요구를 새 소비 지점에만 둔다.

### `check-gate.ts`가 C>D에서 추가로 요구하는 것

| 필드 | 조건 | 이유 |
|------|------|------|
| `command` | 비어있지 않은 문자열 | 무엇을 돌렸는지 없는 receipt는 증거가 아니다 |
| `exitCode` | `=== 0` | 실패한 실행의 receipt로 D를 닫을 수 없다 |
| `createdAt` | 유효한 ISO 문자열 | epoch 기본값은 "언제인지 모름"을 "1970년"으로 위장한다 |
| `ownerSessionId` | 비어있지 않은 문자열 | 세션 결속 |
| `checkEpoch` | 비어있지 않은 문자열 | 사이클 결속 |

`kind: "qa"`도, `kind: "test"`의 generic 계약도 건드리지 않는다.

## 3. attest 필드 + coercion

```ts
/** C>D (075): path to a test receipt under .codexclaw/evidence. */
testReceiptPath?: string;
```

`coerceAttest`에 `if (typeof rec.testReceiptPath === "string") att.testReceiptPath = rec.testReceiptPath.trim();`

## 4. 게이트 배선 — 양쪽 경로

`attest.ts`는 순수하고 IO가 없으므로 파일 검증은 거기 두지 않는다.
`plan-gate.ts`가 P>A에 대해 하는 것과 같은 구조로 별도 모듈이 소유한다.

**CLI** (`orchestrate-cli.ts`): `transition()` 성공 후, D-close preflight 및
모든 write보다 **앞**.

**채팅** (`hook.ts`): `applyHumanTransition()` 성공 및 status/noop 반환 후,
`advanceWorkPhase()`와 모든 write보다 **앞**. 030이 이미 그 자리에 preflight를
두었으므로 같은 블록에서 함께 검사한다.

거부 시 state·PABCD ledger·goalplan 무기록 — 030/050이 세운 규율.

### 적용 범위

bound goalplan 세션(`state.slug` 존재)에만 요구한다. HITL은 070의 form
게이트만 적용한다. 단 **slug가 있는데 goalplan이 unreadable이면 fail-closed** —
감사 지적대로 HITL로 간주하지 않는다.

### 판정표

| 상태 | 판정 |
|------|------|
| `testReceiptPath` 없음 | 거부 |
| 경로 가드 위반 (evidence 밖/symlink/비정규/빈 파일) | 거부 |
| `kind` 불일치 (qa를 test 슬롯에) | 거부 |
| `command` 없음 / `exitCode !== 0` / `createdAt` 무효 | 거부 |
| `ownerSessionId` ≠ 현재 세션 | 거부 — 남의 receipt |
| `checkEpoch` ≠ `state.checkEpoch` | 거부 — 이전 사이클의 receipt |
| receipt identity ≠ 현재 트리 | 거부 — 검증 후 코드가 바뀌었다 |
| identity `unavailable` | 거부 (bound 세션에서는 fail-closed) |
| 전부 통과 | 통과 |

### 업그레이드 케이스 (감사 R3 MAJOR)

이미 `phase=C`인 세션은 `checkEpoch`가 없다. 게이트는 fail-closed이므로
그 세션의 D-close는 거부된다. 복구는 간단하고 안내에 담는다:

> 이 사이클은 검증 결속 이전에 시작됐습니다. `cxc orchestrate B`로 물러났다
> `cxc orchestrate C`로 다시 들어오면 새 epoch가 발급됩니다.

C 재진입이 epoch를 발급하므로 reset까지 갈 필요는 없다. 이 경로도 테스트로 고정한다.

## activation scenario

| 시나리오 | 트리거 | 관측 효과 |
|----------|--------|-----------|
| receipt 없음 | `testReceiptPath` 없이 D | 거부, phase=C 유지 |
| 수기 JSON | command 없는 파일 지목 | 거부 |
| stale | receipt 발급 후 코드 수정하고 D | 거부 |
| reuse | 이전 C 사이클의 receipt로 D | 거부 |
| 실행이 트리를 바꿈 | 포매터/생성기를 receipt 명령으로 | receipt 미발급 |
| 실패 실행 | `exitCode: 1` receipt | 거부 |
| 정상 | `cxc receipt test -- npm test` → D | 통과 |
| HITL | slug 없는 세션 | 070 게이트만 |

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/receipt-cli.ts` (신규) | `cxc receipt test` producer |
| `src/source-receipt.ts` | 반환 shape 확장(ownerSessionId/checkEpoch 보존, createdAtProvided) — **수락 규칙 불변** |
| `src/attest.ts` | `testReceiptPath` 필드 + coercion |
| `src/state.ts` | `checkEpoch` 필드 + 재구성 (C에서만 non-null) |
| `test/state.test.ts` / `test/hook-e2e.test.mjs` | exact default·SessionStart 계약에 `checkEpoch` 추가 |
| `src/orchestrate-apply.ts` | `clearedIdle`에서 `checkEpoch` null |
| `src/orchestrate-cli.ts` (`:519`) | **B→C write에서 새 epoch 발급**, 그 외 phase write는 null, I→P 직접 writer도 null |
| `src/hook.ts` (`:772`) | 채팅 B→C write에서 동일 |
| `src/check-gate.ts` (신규) | 파일 검증 + identity 비교 (attest는 순수 유지) |
| `src/orchestrate-cli.ts` | CLI preflight 배선 |
| `src/hook.ts` | 채팅 preflight 배선 (030 블록에 합류) |
| `src/cli.ts` / `bin/codexclaw.mjs` / `bin/cxc.mjs` | `receipt` verb |
| `test/receipt-binding.test.ts` (신규) | producer, check-gate 판정표 전 행, 양쪽 경로 무기록, 업그레이드 복구 |
| `test/source-receipt.test.ts` | 새 필드 보존 + **기존 수락 케이스 무회귀** |

**중복 parser**: `subagent-config/src/final-gate-guard.ts:97`에 별도 파서가 있지만,
수락 규칙을 바꾸지 않으므로 드리프트가 생기지 않는다. 손대지 않는다.
이것이 C>D 전용 경계를 택한 두 번째 이유다.

## 한계

producer를 거치지 않고 손으로 쓴 receipt는 여전히 가능하다. 필드를 아무리 늘려도
**인증되지 않은 필드는 위조를 막지 못한다** — 완성된 수기 JSON은 통과한다.
감사 표현대로 **"missing/malformed/nonzero/stale/reuse는 거부하되 위조 자체는
막지 못한다."**

진짜 provenance는 producer 서명이나 실행 로그 결속이 필요하며, 이 유닛의
범위를 넘는다. 그것을 하기 전까지 이 게이트가 올리는 것은 문턱이지 벽이 아니다.

`final-gate-guard.ts`의 중복 파서는 구형 관용을 유지하므로, 그 경로로
소비되는 receipt에는 이 강화가 적용되지 않는다.
