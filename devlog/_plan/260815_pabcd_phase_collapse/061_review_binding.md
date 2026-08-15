---
created: 2026-08-15
status: design
workPhase: wp6
supersedes: [060_review_round.md]
tags: [codexclaw, review-round, a-to-b, observer]
---

# 061 — A>B 감사 결속: observer가 승인을 소유한다

060은 `open`/`close` CLI를 제안했다. 감사가 그 설계를 무너뜨렸다:

> `open → close(pass)`가 기존 자기 attest와 본질적으로 같습니다.
> `close`가 호출자 제공 verdict/output으로 승인할 수 있어 실제 `spawn_agent` 없이 통과합니다.

맞다. 문자열 하나가 CLI 두 번으로 바뀔 뿐이고, 그건 게이트가 아니라 의식(ritual)이다.

## 원칙 전환

**에이전트는 승인을 쓸 수 없다.** 승인은 서브에이전트가 실제로 종료했다는
런타임 이벤트에서만 나온다. 에이전트가 할 수 있는 것은 라운드를 열고
(`open`), 리뷰어를 파견하고, 결과를 조회하는 것(`show`)뿐이다.

| 행위 | 누가 |
|------|------|
| 라운드 열기 + launchId 발급 | 에이전트 (`review-round open`) |
| 리뷰어 파견 (launchId를 패킷에 실음) | 에이전트 (`spawn_agent`) |
| **verdict 기록** | **SubagentStop observer (훅)** |
| 라운드 조회 | 에이전트 (`review-round show`) |
| 수동 종료 | 에이전트, 단 `inconclusive`만 |

`close --verdict pass`는 **만들지 않는다.** 이것이 060과의 결정적 차이다.

## launchId 결속 — 실제 배선

`SubagentStopPayload`에는 `session_id`, `agent_type`, `agent_id`,
`agent_transcript_path`, `last_assistant_message`가 있고 **`launchId`는 없다**
(`hook.ts:113-125`). 따라서 결속은 리뷰어의 출력을 통해 한다.

`open`이 발급한 launchId를 리뷰어 패킷에 싣고, 리뷰어에게
**최종 메시지 마지막 줄에 그 토큰을 그대로 적으라**고 요구한다:

```
LAUNCH: r3-20260815181200
VERDICT: PASS
```

observer는 `last_assistant_message`에서만 이 두 줄을 찾는다 — transcript 꼬리
읽기는 쓰지 않는다(아래 "transcript fallback을 버린다" 참조). launchId가 활성
라운드의 것과 일치하지 않으면 무시한다.

정직한 한계: 메인 에이전트가 launchId를 알고 있으므로 위조 자체는 가능하다.
그러나 **서브에이전트 턴이 실제로 발생해야** observer가 호출되고, 그게 이
게이트가 요구하는 최소 사실이다 — "리뷰어를 안 띄웠다"는 붕괴는 막는다.
"리뷰어를 띄웠지만 형편없었다"는 막지 못한다. 그 경계를 문서에 못박는다.

## observer는 기존 deny 게이트와 분리한다

`subagent-stop-verifying-evidence.json`은 `^worker$` matcher를 쓰고
receipt 없으면 **block**한다. 감사 리뷰어는 `explorer`이므로 그 훅에 넣으면
정상 읽기 전용 감사가 receipt 때문에 막힌다(DISPATCH-AGENT-TYPE-01).

따라서 **새 훅**을 등록한다: matcher `^explorer$`,
**절대 block하지 않고** 라운드만 기록한다. worker는 이 훅을 아예 타지 않으므로
기존 receipt deny 훅과 경쟁하지 않는다. 그 훅은 손대지 않는다.

## latestRound — 오래된 승인 재사용 차단

감사 BLOCKER 2: "가장 최근 terminal 라운드" 조회는 `r1=approved` 뒤에
`r2=in_flight`가 있어도 r1을 반환해 통과시킨다.

```ts
/** terminal 여부와 무관하게 roundId가 가장 큰 라운드. 판정은 이것만 본다. */
export function latestRound(plan: Goalplan, purpose: ReviewPurpose): ReviewRoundState | null
```

`effectiveRound`(terminal 제외, 진행 중인 것을 찾는 용도)와 별개다.
게이트는 `latestRound`만 쓴다.

## 게이트 판정표 (감사 요구 그대로)

| 최신 라운드 상태 | 판정 |
|------------------|------|
| 라운드 없음 | 거부 — 리뷰어를 열어라 |
| `pending` / `launching` / `in_flight` | 거부 — 아직 회신이 없다 |
| `inconclusive` | 거부 |
| `changes_requested` | 거부 (AUDIT-LOOP-01) |
| `approved` 인데 `lane.verdict` 없음/불일치 | 거부 |
| `approved` + `stale` | 거부 — 승인 후 계획이 바뀌었다 |
| `round.planEpoch` ≠ `state.planEpoch` | 거부 — 재계획했으니 다시 감사받아라 |
| `round.ownerSessionId`/`workPhaseId` 불일치 | 거부 |
| observer `lane.verdict` ≠ attest `auditVerdict` | 거부 |
| `approved` + `fresh` + epoch/session/workPhase/verdict 일치 | **통과** |
| goalplan 또는 plan 파일 unreadable | 거부 (fail-closed) |
| `state.slug` 없음 (HITL) | 통과 (fail-open) |

## planSha256 — 무엇을 해싱하는가

감사 BLOCKER 3: 단일 `planPath`는 여러 문서를 읽는 감사 범위를 표현 못 한다.
대상은 **라운드 호출자가 선택한 파일 집합**이다. 리뷰어에게 실제 전달됐다는
보장은 없다(아래 "알려진 우회") — 그 사실을 이름에 반영해 과대 주장하지 않는다.

`freeze.ts`의 `PlanFileHash` 패턴을 재사용한다:

```ts
// open --plan-path <p> (반복 가능) 로 집합을 확정하고 라운드에 저장
planFiles?: { path: string; sha256: string }[]   // 정규화된 상대경로 순
planSha256: sha256(각 파일 sha256을 경로순으로 연결)
```

### 빈 planFiles는 거부한다 (감사 R9)

타입만으로는 부족하므로 런타임에서도 막는다: `openRound()`는
`planFiles.length === 0`을 `invalid_input`으로 거부하고,
A>B 게이트는 빈 배열을 **누락과 동일하게** fail-closed 처리한다.
파일 없는 감사는 아무것도 감사하지 않은 것이다.

### 기존 planPath와의 관계 (감사 R8 BLOCKER 2)

`OpenRoundInput`과 `ReviewRoundState`는 지금 단일 `planPath`를 필수로 쓰고
(`review-round.ts:106`, `goalplan.ts:130`), pending 재사용도 그 경로로 판정한다.
purpose별 입력 union으로 소유권을 나눈다:

```ts
export type OpenRoundInput =
  | { purpose: "plan_audit";  planFiles: [PlanFileHash, ...PlanFileHash[]]; planSha256: string; ... }
  | { purpose: "final_gate";  planPath: string;          planSha256: string; ... }; // 기존 그대로
```

`plan_audit`은 `planFiles`를 소유하고 `planPath`를 쓰지 않는다. 저장 시
`planPath`에는 표시용으로 `planUnit`을 넣어 `show` 출력이 비지 않게 한다.
`final_gate`는 손대지 않는다.

A>B에서 **저장된 동일 경로 집합**을 재계산한다. 그 파일들의 누락·내용 변경·읽기
실패가 stale이다. 집합 밖에 새 문서가 추가된 것은 보지 않는다(아래 "주장을 좁힌다").
attest의 `planPaths`는 P>A에서 존재 확인만 하고 지속되지 않으므로 재사용하지 않는다.

## CLI 표면 (diff-level)

```
cxc review-round open --session <id> --purpose plan_audit --plan-path <p> [--plan-path <p>...]
  → planUnit은 인자가 아니다. state.planUnit(P>A가 확정)을 쓴다.
  → launchId를 stdout에 출력. exit 0.
  → 전제조건 위반(phase!=A / slug 없음 / goalplan unreadable / work-phase 없음 /
    state.planUnit 없음 / state.planEpoch 없음) 또는 plan-path가 그 unit 밖·
    비번호 문서·읽기 실패: exit 1 + 사유.

cxc review-round show --session <id> [--purpose plan_audit] [--json]
  → 최신 라운드의 roundId/status/staleness/launchId/verdict. exit 0.

cxc review-round abort --session <id> --reason <text>
  → 활성 라운드를 inconclusive로 닫는다. 승인은 불가. exit 0.
```

`open`은 `openRound` 직후 `markLaunching` → `markInFlight`까지
한 번에 수행한다. 두 전이는 상태 기계가 건너뛰기를 거부하므로
(`review-round.ts:208`, `review-round.test.ts:155`) CLI가 순서대로 부른다.
파견은 CLI 밖(`spawn_agent`)에서 일어나므로 CLI가 "파견 중"까지 진행시키는 것이 맞다.

## 라운드를 A·세션·work-phase에 결속한다 (감사 R2 BLOCKER 1)

가장 큰 구멍이었다. `open`에 위상 조건이 없으면 **P에서 승인을 미리 받아두고
A를 통과할 수 있다** — 게이트를 우회하는 새 경로를 만들 뻔했다.

`open`의 전제조건:

| 조건 | 위반 시 |
|------|---------|
| persisted `phase === "A"` | 거부 — 감사는 A에서 연다 |
| `state.slug` 존재 | 거부 |
| goalplan 읽기 가능 | 거부 (fail-closed) |
| `effectiveActiveWorkPhaseId` 존재 | 거부 |
| `state.planUnit` 존재 | 거부 — P>A가 확정한 unit이 없다 |
| `state.planEpoch` 존재 | 거부 — 같은 이유 |

`ReviewRoundState`에 두 필드를 추가한다:

```ts
/** 이 라운드를 연 세션. 다른 세션의 승인을 빌려올 수 없다.
 *  optional인 이유는 아래 "스키마 정책" 참조 — 누락은 A>B가 fail-closed로 거부한다. */
ownerSessionId?: string;
/** 이 라운드가 감사한 work-phase. 다음 work-phase가 재사용할 수 없다. */
workPhaseId?: string;
```

observer도 종료 시 부모 state가 여전히 `A`이고 같은 slug/workPhase인지 확인한다.
A>B 게이트는 `latestRound`의 session/workPhase 일치까지 요구한다.

## observer는 explorer만 승인한다 (감사 R2 BLOCKER 2)

matcher가 `worker`도 받으면, 기존 receipt deny가 block하기 전에 observer가
승인을 써버릴 수 있다. plan audit 승인은 `agent_type === "explorer"`만 허용한다
(DISPATCH-AGENT-TYPE-01: 읽기 전용 감사는 explorer로 파견한다).

matcher는 `^explorer$`로 좁힌다. worker는 이 훅을 아예 타지 않는다.

### transcript fallback을 버린다

`readTranscriptTail`은 role/event를 파싱하지 않고 마지막 바이트를 통째로 읽는다
(`transcript.ts:36`). 리뷰어 **패킷에 들어 있던** `LAUNCH:`/`VERDICT:` 예시를
결과로 오인할 수 있다.

따라서 `last_assistant_message`가 없으면 **fail-closed로 무시**한다.
꼬리 읽기 fallback은 쓰지 않는다.

파싱도 엄격하게: 마지막 비어있지 않은 두 줄이 정확히 `LAUNCH:`와 `VERDICT:`
형식이어야 한다. 중간에 있는 언급은 인정하지 않는다.

`GO-WITH-FIXES`는 `near-pass`로 매핑한다(내부 union은 `pass|near-pass|fail`).

## planFiles: 주장을 좁힌다 (감사 R2 BLOCKER 3)

"추가 파일도 stale"은 저장된 경로만 재해시하는 구현으로는 불가능하다.
집합 밖의 새 문서는 보이지 않는다.

**주장을 삭제한다.** 이 해시가 보호하는 것은 *라운드 호출자가 선택한 파일 집합*이며,
그 파일들의 누락과 내용 변경만 잡는다. 계획에 새 문서가 추가된 것은
이 게이트의 관심사가 아니다 — 그건 P의 판단이다.

`--plan-path` 검증: cwd 하위 containment, regular file, symlink 거부, 중복 제거.
그렇지 않으면 안정적인 무관 파일이나 `goalplan.json` 자신을 지목해 통과할 수 있다.

## planUnit은 P>A에서 지속된다 (감사 R4 BLOCKER 1)

`--plan-unit`을 호출자가 A에서 자유롭게 고르면, 오래된 다른 unit의 `000_*.md`를
지목해 `fresh`를 얻을 수 있다. `package.json` 우회는 막아도 **무관한 번호 문서**
우회는 그대로다. plan-gate도 임의 절대·상대 경로를 허용한다(`plan-gate.ts:35`).

근본 원인: P>A가 검증한 `planUnit`이 attest에만 있고 어디에도 남지 않는다
(`rg planUnit src/state.ts` → 0건).

### 처방

`State`에 필드를 추가하고 P>A 성공 시 **정규화된 상대경로로** 저장한다.

```ts
/**
 * REVIEW-BINDING-01: the plan unit P>A validated for the current cycle, stored
 * relative to cwd. review-round open uses exactly this — letting the caller name
 * a unit at A time would let an old cycle's numbered docs buy a fresh verdict.
 * Cleared on entry to P or I, and on cycle close — the same discipline as
 * phaseEntrySource: a value never outlives the span it describes.
 */
planUnit: string | null;
```

`open`은 `--plan-unit`을 **받지 않는다**. `state.planUnit`이 비어 있으면 거부한다.
모든 `--plan-path`는 그 unit 아래 번호 문서여야 한다.

이로써 open 전제조건은 여섯이 된다: phase=A, slug 존재, goalplan 읽기 가능,
effective work-phase 존재, **`state.planUnit` 존재**, **`state.planEpoch` 존재**.

### planEpoch — 같은 unit 재진입을 구분한다 (감사 R6 BLOCKER)

`state.planUnit`만으로는 부족하다. 감사가 찾은 경로:

```
P>A(U)  → open r1 → 승인
A>P     → planUnit null
P>A(U)  → 같은 unit을 다시 확정
A>B     → r1이 여전히 같은 session/work-phase이고 파일도 fresh → 통과
```

새 라운드를 열지 않았는데 이전 승인이 재사용된다. `session/workPhase` 일치만으로는
**같은 unit으로의 재진입**을 구분할 수 없다.

따라서 P>A마다 nonce를 발급한다.

```ts
/** REVIEW-BINDING-01: minted fresh on every P>A. A round records the epoch it was
 *  opened under; A>B requires a match, so re-planning invalidates prior approvals
 *  even when the plan unit and work-phase are unchanged. */
planEpoch: string | null;   // 예: "e-20260815184500-3f2a"
```

`open`은 `state.planEpoch`를 라운드에 복사하고, A>B는
`round.planEpoch === state.planEpoch`를 요구한다. 불일치는 거부 —
"재계획했으니 다시 감사받아라"가 정확한 메시지다.

**스키마 정책**: `ReviewRoundState`는 `plan_audit`와 `final_gate`가 공유하므로
(`goalplan.ts:126`) `planEpoch`/`ownerSessionId`/`workPhaseId`/`planUnit`/
`planFiles`는 **optional**로 추가한다. 필수로 만들면 기존 final-gate 생성부가
깨진다(`final-gate.test.ts:38`). 대신 **A>B 게이트가 누락을 fail-closed로 거부**한다 —
`plan_audit` 목적의 라운드에 이 필드들이 없으면 승인으로 인정하지 않는다.
레거시 라운드도 같은 이유로 거부된다: 새 라운드를 열면 그만이다.

`planUnit`과 같은 lifecycle을 탄다: P/I 진입 시 null, P>A producer가 새로 발급.

**pending 재사용 분기 주의**: `openRound()`는 같은 `planPath`의 `pending` 라운드를
재사용하며 지금은 해시만 갱신한다(`review-round.ts:137`). identity 필드
(epoch/unit/session/workPhase **+ `planFiles` 경로 집합**)가 다르면
**기존 pending을 `inconclusive`로 닫고 새 라운드를 연다** — 재사용은 identity가
완전히 같을 때만이다. 같은 epoch에서 파일 집합만 바뀌는 것도 다른 감사이므로
덮어쓰지 않는다.

### 생성 경로 (감사 R5 BLOCKER 2)

`validatePlanArtifacts()`는 지금 `AttestResult`만 돌려주고 정규화 경로를 주지 않는다
(`plan-gate.ts:24,66`). 반환형을 넓힌다:

```ts
export type PlanArtifactResult =
  | { ok: true; unit: string }       // cwd-상대 정규화 경로
  | { ok: false; reason: string };   // 성공 시 unit 존재를 타입으로 보장한다
```

`orchestrate-cli.ts`의 P>A 분기(`:267`)에서 이 값을 받아, 전이 성공 후
state write에 실어 보낸다. 이것이 `state.planUnit`의 **유일한 producer**다.

### lifecycle — P/I 진입 시 반드시 지운다 (감사 R5 BLOCKER 1)

IDLE에서만 지우면 구멍이 남는다. 실제 시나리오:

```
CLI  P>A (planUnit=U 저장)
     A>P            <- 재계획. state를 spread하므로 U가 살아남는다
채팅 P>A            <- human free-pass, planUnit을 검증하지 않는다
     → state.planUnit은 여전히 U → open이 통과한다
```

이 세션이 실제로 밟은 경로다(사이클 1의 `A>P=594s`).

따라서 **`P` 또는 `I`로 진입할 때 항상 null로 만든다.** 다시 채우는 것은
CLI P>A의 producer뿐이다. 채팅 P>A는 planUnit을 검증하지 않으므로 null을 유지하고,
그 결과 `open`이 거부된다 — 채팅으로 재계획했다면 CLI로 A를 타라는 뜻이다.

정리하면 `phaseEntrySource`와 같은 규율이다: 한 값은 자기 구간 밖에서 살아남지 않는다.

### 소비자

`clearedIdle()`에서 null로(`phaseEntrySource`와 같은 자리),
`readState` 재구성에 문자열 검증 추가, `state.test.ts`의 exact default assertion,
`hook-e2e.test.mjs`의 exact SessionStart 계약.

## planPath 제한과 남는 우회 (감사 R3 BLOCKER 2)

containment/regular-file/symlink/중복 검사만으로는 `package.json`이나
`README.md`, 심지어 `goalplan.json` 자신을 지목하는 것을 못 막는다.
그런 파일은 사이클 내내 안정적이므로 항상 `fresh`로 통과한다.

따라서 모든 `--plan-path`를 `state.planUnit` 아래의 **번호 붙은 계획 문서**
(`^\d{3}_.+\.md$`, plan-gate와 동일 규칙)로 제한한다. `.codexclaw/**`는
명시적으로 거부한다. unit은 인자가 아니라 P>A가 확정한 값이다(아래 참조).

### 알려진 우회 (명시하고 남긴다)

**spawn packet과 planFiles가 불일치할 수 있다.** 메인이 리뷰어에게는 061을
보내면서 CLI에는 다른 번호 문서를 넣어도 관측점이 없다. 지금 보장되는 것은
"선택한 파일이 라운드에 결속됐다"이지 "리뷰어가 그 파일을 감사했다"가 아니다.

이걸 닫으려면 Pre/PostToolUse spawn 관측으로 패킷의 launchId와 경로를 검증해야
하며, wire shape 안정성 확인이 필요한 별도 작업이다. **후속 work-phase로 남긴다.**

## verdict 대조 (감사 R3 MAJOR)

observer가 `near-pass`를 기록해도 메인이 attest에 `auditVerdict:"pass"`를
제출하면 `auditResidual` 의무를 우회한다(`attest.ts:170`).

따라서 A>B 게이트는 **observer가 기록한 `lane.verdict`와 attest의
`auditVerdict`가 일치할 것**을 요구한다. 불일치는 거부한다.
`near-pass`면 기존 규칙대로 `auditResidual`도 필요하다.

## A>B preflight 위치

`orchestrate-cli.ts`에서 `transition()` 성공 직후(`:339`),
어떤 state/ledger write(`:450`)보다 **앞**이다. 030/050과 같은 원칙 —
거부 시 state·ledger·goalplan 무기록.

## abortRound (감사 R2 BLOCKER 4)

`abort`가 부를 순수 함수가 없다. `review-round.ts`에 추가한다:

```ts
/** 비terminal 라운드를 inconclusive로 닫는다. terminal이면 stale을 돌려준다. */
export function abortRound(plan: Goalplan, purpose: ReviewPurpose, reason: string): ReviewRoundResult
```

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/review-round.ts` | `latestRound()`, `abortRound()`, `OpenRoundInput` purpose union, pending identity 비교, launchId/verdict 파싱 헬퍼 |
| `test/review-round.test.ts` | plan-audit 호출부 갱신 + 빈 `planFiles` 거부 / identity 같으면 pending 재사용 / 경로집합·epoch 변경 시 새 round / `final_gate` 동작 보존 |
| `src/goalplan.ts` | `ReviewRoundState`에 optional `planFiles`/`ownerSessionId`/`workPhaseId`/`planUnit`/`planEpoch` + `reviveReviewRounds` 재구성 |
| `src/review-round-cli.ts` (신규) | open / show / abort |
| `src/review-observer.ts` (신규) | SubagentStop → verdict 기록 (non-deny) |
| `src/cli.ts` | `review-round` verb + `hook subagent-stop-review` 디스패치 |
| `bin/codexclaw.mjs` | 루트 디스패처에 verb 추가 |
| `src/state.ts` | `planUnit`/`planEpoch` 필드 + 재구성 |
| `test/state.test.ts` | exact default assertion + 하위호환 |
| `src/orchestrate-cli.ts` | P>A에서 `planUnit`+`planEpoch` 기록(producer), A>B 게이트 배선 |
| `src/plan-gate.ts` | `validatePlanArtifacts`가 정규화 unit 경로를 반환 |
| `src/fsm.ts` / `src/orchestrate-apply.ts` | P/I 진입 시 `planUnit`·`planEpoch` 둘 다 null |
| `src/orchestrate-cli.ts` I→P override writer (`:316`) | `transition()`을 우회하는 직접 writer — 여기서도 두 필드 명시적 null |
| `hooks/subagent-stop-observing-review.json` (신규) | matcher `^explorer$`, non-deny |
| `.codex-plugin/plugin.json` | 훅 등록 (21 → 22) |
| `plugins/codexclaw/test/inventory.test.mjs` | `hooks-21` 고정값 (`:145`) |
| `README.md` / `.ko` / `.zh` 산문 | 세 파일 모두 설치 문장(`:57`)과 트리 주석의 "21 hooks" — `inventory.mjs`는 배지만 고친다(`inventory.mjs:248`) |
| `test/review-round-cli.test.ts` (신규) | open 전제조건, show, abort |
| `test/review-observer.test.ts` (신규) | explorer만, 엄격 파싱, 결속 |
| `test/orchestrate-cli.test.ts` | A>B 판정표 전 행 |
| `test/hook-e2e.test.mjs` | **21 → 22 고정값** (`:127`) |
| `plugins/codexclaw/bin/cxc.mjs` | 설치본 dispatcher에 verb 추가 |
| `plugins/codexclaw/inventory.json` | 훅 수 재생성 |
| `README.md` / `.ko` / `.zh` | hooks 배지 21 → 22 |
| `structure/INDEX.md` | 21-hook SoT 갱신 (`:184`) |

**주의**: 훅을 하나 추가하면 21이 고정된 곳이 6군데 깨진다(감사 R2 BLOCKER 4).
`inventory.mjs --write`가 README 배지를 갱신하지만 e2e 상수와 INDEX 산문은 수동이다.

## 범위 명시 (감사 MAJOR)

이 게이트는 **goalplan-bound agent CLI 경로**에만 적용된다.
채팅 `orchestrate b`는 human free-pass로 남긴다 — 사람이 직접 위상을 옮기는 것은
back-fill이 아니며 `pabcd/SKILL.md:55`의 계약이다. 이를 "알려진 human override"로
문서에 기록한다.

## 보장 수위

- **보장한다**: 독립 explorer 턴이 실제로 발생했고, 그 회신이 이 세션·이 work-phase에서
  열린 라운드 ID에 결속됐으며, 그 라운드가 지목한 파일들이 승인 이후 바뀌지 않았다.
  라운드는 P>A가 확정한 계획 unit 안에서만 열 수 있다.
- **보장하지 않는다**: 리뷰어의 품질(dummy가 PASS만 뱉어도 통과), 그리고
  **리뷰어가 실제로 그 파일들을 읽었다는 사실** — 패킷과 `planFiles`를 대조할
  관측점이 아직 없다(위 "알려진 우회").
- 023의 분류로는 "런타임이 거부할 수 있는 것"에 속하되, 거부 대상은
  "리뷰어 미파견"이지 "부실한 감사"가 아니다.
