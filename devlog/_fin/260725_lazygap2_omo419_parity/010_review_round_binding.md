# 010 — 리뷰 라운드 상태 + A→B attest 결박

출처: `001` #4 (ADAPT / E8) · 의존: `020`(`ReviewLane.sourceIdentity`가 `SourceIdentity`를 직접 사용) · 상태: PLANNED

## 문제

A→B는 리뷰어 출력 문자열과 메인 판단만 요구한다
(`plugins/codexclaw/components/pabcd-state/src/attest.ts:170-189` — WP10 P 실측 정정,
초안의 `:148-190`은 `from/to` 검증과 `did` 검사까지 포함한 범위였다). 그래서 다음이
통과한다:

- 승인받은 뒤 계획을 바꾸고 그 승인으로 B에 진입.
- 라운드 1의 verdict를 붙여넣고 라운드 2를 건너뛰기.
- 리뷰어를 실제로 띄우지 않고 텍스트만 작성.

게이트가 form-only라 provenance를 못 본다는 것은 설계된 한계지만, 라운드 정체성과
계획 해시는 **로컬에서 확인 가능한** 사실이라 게이트가 볼 수 있어야 한다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | 타입 추가 (`ReviewRoundState`, `ReviewLane`) |
| 위 파일의 `reviveGoalplan` (`:100-158`) | **필수** — 미지 필드를 버리므로 revive 분기와 반환 객체를 함께 확장 |
| `plugins/codexclaw/components/pabcd-state/src/review-round.ts` | 신규 — 라운드 수명 관리 |
| `plugins/codexclaw/components/pabcd-state/test/review-round.test.ts` | 신규 테스트 |

**후속 조각으로 미룬 파일** (이 슬라이스에서 건드리지 않는다):
`src/attest.ts`(`A>B` 검증 확장, `:170-189` 블록), `src/orchestrate-cli.ts`
(`review-round` 서브버브 배선 — 현재 phase verb만 파싱한다: `:36-38`, `:101-143`,
`:262-288`), `skills/pabcd/SKILL.md`(A 단계 절차 문서화).

### 범위 판단 (WP10 P)

이 슬라이스는 **타입 + 순수 상태 기계 + 왕복 보존**까지만 한다. 즉:

- `goalplan.ts` 타입/revive 확장
- `review-round.ts` 5함수 (순수 함수 — 파일 IO 없음, `Goalplan`을 받아 새 `Goalplan`을 반환)
- 테스트

**`attest.ts` 결박과 `orchestrate-cli.ts` 배선은 이 슬라이스에서 하지 않는다.**
근거: attest 게이트를 켜는 순간 **지금 진행 중인 이 루프 자신이** 매 A→B마다
`review-round open`을 요구받는다. 아직 CLI가 없는 상태에서 게이트만 켜면 루프가
스스로를 막는다. 배선과 게이트는 CLI가 함께 들어가는 후속 조각으로 분리하고,
이 슬라이스는 그것이 딛고 설 상태 기계를 정확하게 만든다.

이 결정으로 아래 "테스트" 절의 attest 관련 4행(`in_flight` 상태로 A>B, verdict 불일치,
미결박 세션 통과, 승인 후 수정)은 **이 슬라이스의 수용 기준이 아니다** — 후속 조각으로
넘긴다. `staleness`는 순수 함수이므로 여기서 만들고 단위 테스트한다.

## before → after

### `goalplan.ts` — 타입 추가

before: `Goalplan`에 리뷰 관련 필드가 없다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:63-73` — WP10 P 실측 정정).

**WP10 P 실측 — `reviveGoalplan`이 미지 필드를 조용히 버린다.** `goalplan.ts:148-158`의
반환 객체는 알려진 8개 필드를 **명시적으로 나열**한다. 즉 `reviewRounds`를 타입에만
추가하면 `readGoalplan` → `writeGoalplan` 왕복에서 **소리 없이 사라진다.**
revive와 반환 객체 양쪽을 반드시 함께 고쳐야 하고, 그 왕복 보존을 테스트로 고정한다.
이건 새 필드를 더하는 모든 슬라이스에 해당하는 함정이다.

after: 아래를 추가한다.

```ts
export type ReviewRoundStatus =
  | "pending" | "launching" | "in_flight"
  | "approved" | "changes_requested" | "inconclusive";

/** 라운드의 용도. A→B 계획 감사와 최종 코드 gate는 서로 재사용할 수 없다 (3라운드 감사 2). */
export type ReviewPurpose = "plan_audit" | "final_gate";

export interface ReviewLane {
  launchId: string;          // 이 라운드에서 발급, spawn 패킷에 실려 나간다
  reviewerSession?: string;  // 리뷰어가 영수증에 적어 돌려주는 값
  workspaceRoot: string;     // 리뷰어가 본 트리
  artifactSha256?: string;   // 리뷰어가 낸 verdict 문서의 해시
  sourceIdentity?: SourceIdentity; // 리뷰어가 실제로 본 소스 상태 (`020`)
  verdict?: "pass" | "near-pass" | "fail";
}

export interface ReviewRoundState {
  roundId: string;           // `r1`, `r2`, ... 단조 증가
  purpose: ReviewPurpose;    // 필수 — 용도가 다른 라운드는 서로 대체하지 못한다
  planPath: string;          // 감사 대상 계획 문서
  planSha256: string;        // 라운드 개시 시점의 계획 해시
  status: ReviewRoundStatus;
  lane: ReviewLane;          // base reviewer 하나 (역할 증설 금지)
  openedAt: string;
  closedAt?: string;
}
```

`Goalplan`에 `reviewRounds?: ReviewRoundState[]`와 **용도별 활성 커서**
`activePlanAuditRoundId?: string`, `activeFinalGateRoundId?: string`을 더한다.
기존 필드는 건드리지 않는다 (하위 호환: 두 필드 모두 optional).

**용도 분리 (3라운드 감사 2):** 단일 `activeReviewRoundId`를 쓰면 A→B 계획 감사 라운드가
`030`의 최종 gate에 그대로 통용된다 — 계획 리뷰를 받고 코드 gate를 통과한 셈이 된다.
커서를 용도별로 두고, `030`은 `purpose === "final_gate"`인 라운드만 인정한다.
`purpose`는 optional이 아니다. 구버전 계획에는 `reviewRounds`가 아예 없으므로 문제되지 않는다.

리뷰어가 본 소스 상태(`lane.sourceIdentity`)도 라운드에 기록한다. `030`은 이 값이
`finalGate.sourceIdentity`와 같은지 확인해, "리뷰어는 다른 커밋을 봤다"를 잡아낸다.

### `review-round.ts` — 신규

공개 함수 5개. 전이 하나당 함수 하나로 나눈다 (재감사 8 — 한 함수가 두 전이를 하면
중간 실패 시 상태가 모호해진다).

| 함수 | 전이 | CAS 기대 상태 |
| --- | --- | --- |
| `openRound(plan, purpose, planPath, planSha256)` | (없음) → `pending` | 해당 `purpose`의 활성 라운드 없음 |
| `markLaunching(plan, roundId, launchId, workspaceRoot)` | `pending` → `launching` | `pending` |
| `markInFlight(plan, roundId, launchId)` | `launching` → `in_flight` | `launching` |
| `recordVerdict(plan, roundId, launchId, verdict, artifactSha256, reviewerSession, sourceIdentity)` | `in_flight` → 종단 | `in_flight` |
| `staleness(plan, roundId, currentPlanSha)` | 읽기 전용 | — |

#### `planSha256`은 호출자가 넘긴다 (A 감사 1 — High 1)

`openRound`는 **순수 함수**다. 파일을 읽지 않으므로 계획 문서의 해시를 스스로 만들 수
없다. 경로만 해싱하면 문서가 바뀌어도 값이 그대로라 stale 판정이 무의미해진다.
`020`의 `SourceIdentity`도 답이 아니다 — 그건 git 트리 정체성이지 특정 문서의
해시가 아니다(`source-identity.ts:14-24`).

그래서 `planSha256`을 **명시 입력**으로 받는다. 파일 읽기와 SHA-256 계산은 후속
조각의 CLI가 소유한다. 이 모듈은 받은 값을 저장하고 비교만 한다.
빈 문자열은 거부한다 — 해시 없는 라운드는 stale을 판정할 수 없으므로 열리면 안 된다.

#### verdict → 종단 상태 표 (A 감사 1 — High 2)

초안은 "종단"이라고만 적어 구현자마다 매핑이 달라질 수 있었다. 못 박는다.

| `verdict` | 종단 status | 후속 `030`이 최종 gate로 인정하는가 |
| --- | --- | --- |
| `"pass"` | `approved` | 인정 |
| `"near-pass"` | `approved` | 인정 — **단 아래 freshness 규칙이 실질 조건이다** |
| `"fail"` | `changes_requested` | 인정하지 않음 |

`inconclusive`는 verdict로 도달하지 않는다 — `openRound`가 활성 라운드를 강제로 닫을
때만 붙는다.

**near-pass와 freshness의 관계 (A 감사 2 — Medium 2).** 현행 near-pass 계약은
"folded into plan / rebutted" 둘 다 허용한다(`attest.ts:34-36,177-184`). 그런데
**folded면 계획 문서 바이트가 바뀌므로 `planSha256`이 달라지고, `staleness`가
`"stale"`을 낸다.** 즉 status만 `approved`이고 실제로는 통과하지 못한다.

이 모순을 이렇게 정리한다 — **freshness가 최종 판정이고 status는 그 앞단이다.**

| near-pass의 실제 내용 | 결과 |
| --- | --- |
| 전부 rebutted (문서 바이트 불변) | `approved` + `staleness === "fresh"` → 후속 A→B 통과 |
| 하나라도 folded (문서 편집됨) | `approved`이지만 `staleness === "stale"` → **새 라운드를 열고 재감사**해야 한다 |

이건 버그가 아니라 의도한 동작이다: 계획을 고쳤으면 고친 계획을 리뷰받아야 한다.
지금까지 이 루프가 라운드를 반복해 온 방식과 정확히 같다. 문서에 못 박아 구현자가
"near-pass면 무조건 통과"로 오해하지 않게 한다. R13이 이 경로를 관측한다.

#### 모든 전이 함수의 반환형

```ts
export type ReviewRoundResult =
  | { kind: "ok"; plan: Goalplan; round: ReviewRoundState }
  | { kind: "stale"; reason: string }        // 지난 라운드/지난 launchId — 무시했다
  | { kind: "cas_failed"; reason: string; actual: ReviewRoundStatus }
  | { kind: "not_found"; reason: string }
  | { kind: "invalid_input"; reason: string };  // 전이 이전의 입력 오류 (빈 planSha256 등)
```

`invalid_input`은 상태를 보기 전에 걸러지는 입력 오류다 — `not_found`나
`cas_failed`로 뭉개면 호출자가 "라운드가 없다"와 "인자가 틀렸다"를 구분할 수 없다
(A 감사 2 — Medium 1).

`compareSource`와 같은 이유로 판별 유니온이다. 소비자는 `switch (r.kind)`에
`assertNever`를 붙인다 (`020`이 export한 것을 재사용한다).

**늦은 완료의 단일 규칙 (High 2):** `recordVerdict`가 `stale`을 반환하는 조건을
status가 아니라 **정체성**으로 정한다.

1. `roundId`가 그 `purpose`의 **현재 커서가 아니면** → `stale`. status는 보지 않는다.
   (r2를 연 뒤 r1의 올바른 `launchId`로 늦게 도착해도 `stale`이다 — 초안의
   "launchId 불일치면 stale" 조건만으로는 이 케이스가 CAS 실패로 새어 R2 기대와
   충돌했다.)
2. 커서 라운드이지만 `launchId`가 다르면 → `stale`.
3. 커서 + 올바른 `launchId`인데 status가 `in_flight`가 아니면 → `cas_failed`.
   (같은 라운드에 verdict 두 번 = R3가 여기 해당한다. 첫 값은 그대로 유지된다.)
4. 그 외 → `ok`.

#### 커서 무결성과 pending 재사용 (A 감사 1 — Medium)

커서를 맹신하지 않는다. 기존 `effectiveActiveWorkPhaseId`(`goalplan.ts:341-349`)가
ghost 커서를 목록에서 복구하는 것과 같은 방침이다.

- 커서가 가리키는 라운드가 **없거나**, `purpose`가 다르거나, 이미 종단이면
  → 커서를 무시하고 **목록에서** 같은 `purpose`의 비종단 라운드를 찾는다.
  둘 이상이면 `roundId`가 가장 큰 것을 활성으로 보고 나머지는 `openRound` 시점에
  `inconclusive`로 닫는다.
- `pending` 재사용은 **`planPath`가 같을 때만** 한다. 경로가 다르면 다른 문서를 감사하는
  것이므로 그 `pending`을 `inconclusive`로 닫고 새 라운드를 연다. 같으면 `planSha256`을
  갱신한다.

각 CAS는 현재 status가 기대값이 아니면 쓰지 않고 실패를 반환한다. 각 함수는 `purpose`별
커서만 본다 — 계획 감사 라운드가 진행 중이어도 최종 gate 라운드를 열 수 있다.
`recordVerdict`는 `launchId`가 현재 라운드의 것과 다르면 **무시**하고 `stale`을 반환한다
(지난 라운드의 늦은 완료가 현재 라운드를 오염시키지 못한다).
`staleness`는 `approved` 이후 계획 파일이 바뀌었는지 판정한다.

**`openRound`의 단일 결정 (재감사 8):** 활성(비종단) 라운드가 있을 때 동작을 하나로 고정한다 —
`launching` 또는 `in_flight` 라운드는 **자동으로 `inconclusive`로 닫고 새 라운드를 개시한다.**
거부하지 않는다. 근거: 프로세스가 영수증 전에 끊기는 것은 정상적으로 발생하고,
그때 사람이 수동으로 상태를 치워야 한다면 게이트가 작업을 막는 도구가 된다.
닫힌 라운드는 ledger에 남으므로 감사 가능성은 유지된다.
`pending` 라운드(아직 launch 안 됨)는 재사용한다 — 새로 만들지 않고 계획 해시만 갱신한다.

### `attest.ts` — `A>B` 확장

before (`plugins/codexclaw/components/pabcd-state/src/attest.ts:148-190`): `did` 비어있지 않음, `auditOutput` 비어있지 않음,
`auditVerdict ∈ {pass, near-pass, fail}`, `fail`은 전진 불가, 붙여넣은 꼬리의 FAIL 감지.

after: 위를 모두 유지하고, **goalplan이 결박된 세션에서만** 추가로 요구한다.

1. `activePlanAuditRoundId`가 존재한다. 없으면 `cxc orchestrate review-round open` 안내와 함께 거부.
   (`activeFinalGateRoundId`는 A→B와 무관하다.)
2. 그 라운드의 status가 **`approved`다** (`in_flight`·`pending`·`launching`·
   `inconclusive`·`changes_requested`는 모두 거부). 초안은 `changes_requested`도
   허용했지만 그 상태는 `fail` verdict로만 만들어지고, 기존 A→B는 `auditVerdict === "fail"`을
   항상 거부한다(`attest.ts:178-181`) — 도달 불가능한 분기였다 (A 감사 2 — Low).
3. `staleness(...) === "fresh"` — 승인 이후 계획 파일이 바뀌지 않았다.
   바뀌었으면 "계획이 승인 후 수정됐다. 새 라운드를 열고 재감사하라"로 거부.
4. `att.auditVerdict`가 라운드에 기록된 `lane.verdict`와 일치한다. 불일치는 거부.

goalplan이 없는 세션(HITL 단발)에서는 기존 동작 그대로 — 이 기능이 가벼운 사용을 막지 않는다.

### `orchestrate-cli.ts` — 배선

`cxc orchestrate review-round <open|launched|verdict|show> --session <id> [...]` 추가.
기존 phase 버브 파싱을 건드리지 않고 분기 하나를 더한다.

## 테스트 (accept criteria)

| # | 시나리오 | 기대 |
| --- | --- | --- |
| R1 | `openRound`로 첫 라운드 개시 | `r1`, status `pending`, `activePlanAuditRoundId === "r1"`, `planSha256`이 넘긴 값 그대로 |
| R1b | `planSha256`이 빈 문자열 | `{kind:"invalid_input"}` — 라운드를 열지 않는다 |
| R2 | r2 진행 중, r1의 **올바른 `launchId`로** 늦은 verdict 도착 | `{kind:"stale"}`, r1·r2 status 모두 불변 (커서가 아니면 status를 보지 않는다) |
| R2b | 커서 라운드인데 `launchId`가 다름 | `{kind:"stale"}` |
| R3 | 같은 라운드에 verdict 두 번 | 두 번째는 `{kind:"cas_failed", actual:"approved"}`, 첫 값 유지 |
| R3b | verdict별 종단 상태 | `pass`→`approved`, `near-pass`→`approved`, `fail`→`changes_requested` |
| R4 | `openRound` 시 `in_flight` 라운드 존재 | 그 라운드를 `inconclusive`로 닫고 새 라운드 개시 (단일 결정) |
| R5 | `openRound` 시 `launching` 라운드 존재 | 동일 — `inconclusive`로 닫고 개시 |
| R6 | `openRound` 시 `pending` 라운드 존재 | 재사용, 계획 해시만 갱신 (새 라운드 만들지 않음) |
| R6b | `openRound` 시 `pending` 라운드가 있으나 `planPath`가 다름 | 그 `pending`을 `inconclusive`로 닫고 새 라운드 개시 |
| R7 | `markInFlight`를 `pending` 상태에서 호출 | CAS 실패 (`launching`을 건너뛸 수 없다) |
| R8 | `recordVerdict`를 `launching` 상태에서 호출 | CAS 실패 |
| R9 | 계획 감사 라운드 진행 중 최종 gate 라운드 개시 | 허용 (커서가 다르다), 두 커서가 각각 자기 라운드를 가리킨다 |
| R10 | `purpose` 없는 라운드 객체 역직렬화 | 그 라운드만 버려진다 (다른 라운드는 보존) |
| R11 | `recordVerdict`가 `sourceIdentity`를 기록 | `lane.sourceIdentity`에 저장 |
| R12 | `staleness` — 승인 시점 해시와 같은 값 | `"fresh"` |
| R13 | `staleness` — 승인 후 계획 해시가 바뀜 (= folded near-pass의 실제 모습) | `"stale"` |
| R14 | `staleness` — 종단이 아닌 라운드 | `"open"` |
| R14b | 커서가 없는/종단인/purpose가 다른 라운드를 가리킴 | 목록에서 같은 purpose의 비종단 라운드를 복구해 동작 |
| R14c | 같은 purpose 비종단 라운드가 목록에 둘 | 가장 큰 `roundId`를 활성으로, 나머지는 `openRound`에서 `inconclusive` |
| R15 | **왕복 보존** — `reviewRounds`가 있는 goalplan을 write → read | 라운드 배열과 두 커서가 그대로 살아 있다 (revive 확장 회귀) |
| R16 | 구버전 goalplan (`reviewRounds` 없음) | 읽기 성공, `reviewRounds`는 `undefined`, 기존 필드 불변 |

attest 게이트 케이스(`in_flight`로 A>B 거부, verdict 불일치 거부, 미결박 세션 통과,
승인 후 수정 거부)는 **후속 조각의 수용 기준**이다 — 위 범위 판단 참조.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 exit 0, **1,264 pass**. 사슬: `package.json:24` glob이
  `components/pabcd-state/test/*.ts`를 포함한다. → **주 검증기.**
- 좁은 타입체크 (**B 이후 유효**, 신규 파일이라 지금은 `TS6053`):

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext --strict \
    plugins/codexclaw/components/pabcd-state/src/review-round.ts \
    plugins/codexclaw/components/pabcd-state/test/review-round.test.ts
  ```

  `goalplan.ts`는 이 명령에 넣지 않는다 — `--strict`로 돌리면 기존 파일들의 `TS2352`
  계열이 딸려 나온다(WP8에서 5건 실측). 신규 두 파일만 exit 0을 요구한다.
- `npm run build` — 신규 `.ts`가 dist로 컴파일된다(113 → 114). → 관측한다.
- `npm run gate` — 이 슬라이스를 **관측하지 않는다**. 비관측 baseline 회귀 확인용
  (현재 exit 0, WARN 5).

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **없음 (이 조각에서는)** — 상태 기계만 만들고 게이트를 켜지 않는다 |
| 실행 주체 | 아직 없다. 후속 조각의 `attest.ts` `A>B` 검증과 `orchestrate review-round` CLI가 소비자 |
| 알려진 우회 | 게이트가 켜진 뒤에도 provenance는 증명 불가다 — 리뷰어를 안 띄우고 라운드만 열어 verdict를 직접 기록할 수 있다. 이 슬라이스가 잡는 것은 **라운드 정체성과 계획 해시**뿐이다 |
| 잔여 위험 | 후속 조각이 오지 않으면 dead code다. `020`과 같은 처지이고 같은 이유로 수용한다 |
| 표현 강등 | "리뷰를 강제한다"가 아니라 **"라운드 경계와 계획 해시를 로컬에서 검증 가능하게 만든다"** |
| 최종 강제층 | 없음 (`final layer: none`) |

## PLAN-FIELD-CHAIN-01

| 타입 | 생성 | 직렬화 | 역직렬화 | 소비 |
| --- | --- | --- | --- | --- |
| `ReviewRoundState` | `openRound()` | `writeGoalplan` → `goalplan.json` | `reviveGoalplan` **확장 필수** — 현재 반환 객체가 알려진 필드만 나열해 미지 필드를 버린다(`goalplan.ts:148-158`) | `markLaunching`/`markInFlight`/`recordVerdict`/`staleness`, 후속 조각의 `attest.ts` |
| `planSha256` (문자열) | **호출자** — 후속 CLI가 계획 파일을 읽어 SHA-256을 계산한다. 이 모듈은 만들지 않는다 | 위와 동일 (라운드 안에 중첩) | 위와 동일 | `staleness(plan, roundId, currentPlanSha)`의 비교 한 곳 |
| `ReviewRoundResult` | 전이 함수 4개 각각 | N/A — 프로세스 내 반환값 | N/A | 호출자의 `switch (r.kind)` + `assertNever` (`020`에서 재사용) |
| `ReviewLane` | `openRound()`가 `launchId`와 함께 생성, `recordVerdict`가 나머지를 채운다 | 위와 동일 (중첩) | 위와 동일 | `030`이 `lane.sourceIdentity`를 최종 gate와 대조 (후속) |
| `ReviewPurpose` | 호출자가 리터럴로 넘긴다 (`"plan_audit"` / `"final_gate"`) | 위와 동일 | revive에서 두 값 중 하나가 아니면 **그 라운드를 버린다** (R10) | 커서 선택 — `activePlanAuditRoundId` vs `activeFinalGateRoundId` |

## 범위 밖

- 리뷰어 provenance의 암호학적 증명 — 불가능하고 목표도 아니다.
- 전용 리뷰어 역할 추가.
- 여러 리뷰 레인 (upstream의 이중 역할 토폴로지).
