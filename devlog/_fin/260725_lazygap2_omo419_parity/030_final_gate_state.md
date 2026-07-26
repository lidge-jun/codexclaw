# 030 — 최종 gate 상태 + 완료 검증기 + IDLE Stop 문구

출처: `001` #10 (ADAPT / E8+E2) · 의존: `010`(라운드 타입), `020`(소스 정체성) · 상태: PLANNED

## 문제

`validateGoalplan`(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:398-...`
— WP11 P 실측 정정. 초안의 `:266-295`는 `010`/`020`이 타입을 추가하기 전 위치다)은
work phase와 criteria/evidence만 본다. 그래서 "모든 작업 완료 + 증거 있음"이면
최종 검증을 아직 받지 않았어도 `update_goal complete`가 통과한다. upstream은 이 상태를
명시적으로 표현해 continuation을 유지한다
(`devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/boulder-reader.ts:37-57`).

## WP11 P: 이 슬라이스를 두 조각으로 자른다

계획대로면 한 사이클에서 `goalplan.ts`, `source-receipt.ts`(신규), `goal-gate.ts`,
`goalplan-cli.ts`, `hook.ts`와 테스트 3개를 동시에 바꾼다. 그건 하나의 B가 아니라
세 개다. 그리고 `040`이 이 산출물 위에 다시 쌓인다.

**이 사이클(WP11)의 범위 — 검증 코어:**

| 파일 | 변경 |
| --- | --- |
| `src/goalplan.ts` | `FinalGateState`·`schemaVersion` 타입, revive 확장, `validateGoalplan(plan, ctx?)` v2 검사 |
| `src/source-receipt.ts` | 신규 — fail-closed 파서 |
| `test/source-receipt.test.ts` | 신규 |
| `test/goalplan.test.ts` | v2 검증 케이스 추가 |

**후속 조각으로 미루는 것 — 배선:**
`goal-gate.ts`(ctx 구성·fail-open 경계), `goalplan-cli.ts`(`final-gate open|verdict|show`
lifecycle + 마커 쓰기), `hook.ts`(IDLE Stop 문구), `test/goal-gate.test.ts`.

근거는 `010`과 같다: **lifecycle CLI가 없는 상태에서 `loop init`을 v2로 바꾸면
새 goal이 열 수 없는 gate를 요구하게 된다.** 검증기를 먼저 정확히 만들고, 그것을
켜는 스위치는 CLI와 함께 넣는다. 이 사이클에서 `loop init`은 **v1을 계속 만든다.**

따라서 아래 본문의 "`cxc loop init`이 만드는 신규 계획은 `schemaVersion: 2`" 규칙과
마커 쓰기, lifecycle 표, IDLE Stop 문구는 **후속 조각의 계약**이다. 이 사이클은
**읽는 쪽**(유효 버전 계산, 마커 존재 시 v2 판정, v2 검증 규칙 1-11)만 구현한다.
마커를 쓰는 코드가 아직 없어도 읽는 규칙은 지금 테스트할 수 있다 — fixture로 마커
파일을 직접 놓으면 된다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `src/goalplan.ts` | `FinalGateState`·`schemaVersion` 타입, `reviveGoalplan` 확장, `validateGoalplan(plan, ctx?)` v2 검사 |
| `src/source-receipt.ts` | 신규 — `SourceBoundReceipt` 스키마 + fail-closed 파서 (`hasValidReceipt` 재사용) |
| `test/source-receipt.test.ts` | 신규 — 파서 적대적 입력 |
| `test/goalplan.test.ts` | v2 검증 케이스 추가 |
| `src/goalplan.ts` | `CriterionSurface` + `GoalplanCriterion.surface`, revive 확장 |
| `src/goalplan-cli.ts` | `validate` 경로만 read-only `ctx` 구성 (A 감사 Medium) |
| `test/goalplan-cli.test.ts` 또는 기존 CLI 테스트 | v2 계획을 CLI로 검증 가능한지 |

**후속 조각으로 미룬 파일:** `src/goal-gate.ts`(`:219` 호출부에 ctx 전달, `:232-234`
fail-open이 v2 실패를 삼키지 않게), `src/goalplan-cli.ts`의 **쓰기 경로**
(`final-gate open|verdict|show` lifecycle + 마커 쓰기 + `init`을 v2로),
`src/hook.ts`(IDLE Stop 문구), `test/goal-gate.test.ts`.

## 검증 경계 (4라운드 감사 2)

현행 `validateGoalplan(plan)`은 순수 함수다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:275-295` — IO도 cwd도 없다).
호출자 `goal-gate.ts:216-220`은 plan만 넘기고, `:233-235`의 `catch`가 모든 예외를
**fail-open**으로 삼킨다. 그런데 이 문서의 검증은 현재 트리 캡처와 영수증 파일 읽기를
필요로 한다 — 순수 함수로는 불가능하고, 그냥 IO를 넣으면 예외가 fail-open으로 새어
gate가 조용히 열린다.

정정:

```ts
export interface GoalplanValidationCtx {
  cwd: string;
  captureSourceIdentity: (cwd: string) => SourceIdentity;   // 020
  readReceipt: (path: string, expectedKind: "test" | "qa") => SourceBoundReceipt | { error: string }; // 아래 파서
}
export function validateGoalplan(plan: Goalplan, ctx?: GoalplanValidationCtx): GoalplanValidation;
```

- `ctx`가 없으면 v1 검사만 수행한다 (기존 호출자·테스트 호환).
- `schemaVersion >= 2` 계획에 `ctx`가 없으면 **`ok: false`** 와 함께
  "final gate 검증 컨텍스트가 없다"를 이유로 반환한다 — 조용한 통과를 만들지 않는다.

  **단 그 규칙 하나만으로는 `cxc loop validate`가 v2 계획을 영원히 검증 실패로
  보고한다** (A 감사 1 — Medium). `goalplan-cli.ts:140`도 `validateGoalplan(plan)`만
  부르기 때문이다. 그래서 **이 사이클에 CLI의 read-only `ctx` 구성을 포함한다** —
  `goalplan-cli.ts`의 `validate` 경로가 실제 `ctx`를 만들어 넘긴다. 상태를 바꾸지
  않는 읽기 전용 변경이라 core-first 분할을 깨지 않고, "v2 계획을 CLI로 확인할 수 없다"는
  기간을 만들지 않는다. `goal-gate.ts` 배선(deny 봉투 경로)은 여전히 후속이다.
- IO/파싱 실패는 예외를 던지지 않고 `reasons`에 담아 `ok: false`로 반환한다.
  그래야 `goal-gate.ts:233-235`의 outer `catch`(진짜 예상 못한 오류용 fail-open)에
  빠지지 않는다.
- `goal-gate.ts`는 실제 `ctx`를 구성해 넘긴다.

## 영수증 스키마와 파서 (4라운드 감사 3)

"영수증에서 `SourceIdentity`를 읽는다"만으로는 형식도, 안전 검사도 정의되지 않았다.
기존 증거 검증기는 `.codexclaw/evidence` 경로 포함·심링크·realpath를 검사한다
(`subagent-evidence.ts:98-116`, `hasValidReceipt` — WP11 P 실측). **그 함수를 그대로
호출한다.** 경로 포함·심링크·realpath 이탈·일반 파일·0바이트 다섯 검사가 이미 거기
있으므로 파서는 그 위에 JSON 파싱과 스키마 검사만 얹는다. 같은 가드를 두 번 쓰지 않는다.

주의: `hasValidReceipt`는 실패 시 `false`를 반환하는 boolean이라 **어느 검사에서
떨어졌는지 알려주지 않는다.** 파서는 `{error: "receipt failed the evidence-root guard
(outside .codexclaw/evidence, symlink, non-file, or empty): <path>"}`처럼 한 덩어리로
보고한다 — 다섯 사유를 구분하려고 가드를 복제하는 것보다 낫다.

```ts
export interface SourceBoundReceipt {
  kind: "test" | "qa";
  sourceIdentity: SourceIdentity;   // 020
  command?: string;                 // 무엇을 실행했는지
  exitCode?: number;
  createdAt: string;
}
export function parseSourceBoundReceipt(
  path: string, cwd: string, expectedKind: "test" | "qa",
): SourceBoundReceipt | { error: string };
```

**`expectedKind`가 필수 인자다 (A 감사 2 — High).** 이것 없이 "파서를 통과하는가"만
보면 `{kind:"test"}` 영수증을 `qaReceiptPath`에 넣어 web criterion의 QA 요구를
그대로 면제받는다. 호출자가 어느 자리에 쓰는지 알고 있으므로 그 기대를 인자로
명시하게 하고, 파서가 `kind` 불일치를 `{error}`로 거부한다. 검증기 쪽에서 나중에
`kind`를 한 번 더 확인하는 방식은 그 검사를 빠뜨리기 쉬워 택하지 않는다.

파서는 fail-closed다. 다음이면 `{error}`를 반환한다 — 경로가 `.codexclaw/evidence` 밖,
심링크 또는 realpath가 경로 밖으로 탈출, 일반 파일이 아님, 0바이트, JSON 파싱 실패,
`sourceIdentity` 누락 또는 형식 불일치, `kind` 불일치.
"존재하고 0바이트가 아님"만 보던 초기 초안을 이것으로 대체한다.

## before → after

### `goalplan.ts` — 타입

```ts
export interface FinalGateState {
  status: "pending" | "in_flight" | "approved" | "inconclusive";
  reviewRoundId?: string;        // 010의 라운드
  sourceIdentity?: SourceIdentity; // 020
  testReceiptPath?: string;
  qaReceiptPath?: string;
  verdict?: "pass" | "near-pass" | "fail";
  /** gate-open 시점에 계획 전체를 스캔해 고정한 값 (A 감사 1 — High 1).
   *  optional이 아니다: 없으면 "QA가 필요 없다"와 "아직 안 정했다"를 구분할 수 없다. */
  qaRequired: boolean;
  updatedAt: string;
}
```

`Goalplan`에 `finalGate?: FinalGateState` 추가 (optional — 기존 계획 파일 그대로 읽힘).

### criterion에 `surface`를 추가한다 (A 감사 1 — High 2)

`qaRequired`를 계산하려면 criterion이 어떤 표면을 검증하는지 알아야 하는데,
**현재 `GoalplanCriterion`에는 그런 필드가 없다**(`goalplan.ts:34-40`). revive도
미지 필드를 버리고(`goalplan.ts:238-247`), CLI는 `scenario`만 만든다
(`goalplan-cli.ts:107`). 즉 지금 상태로는 web/tui 여부를 저장할 수도 읽을 수도 없다.

```ts
export type CriterionSurface = "logic" | "web" | "tui";
// GoalplanCriterion에 추가:
surface?: CriterionSurface;   // 없으면 "logic"으로 읽는다
```

**v1에서는 optional, v2에서는 필수.** 근거를 나눠 적는다.

- v1 계획에는 이 필드가 아예 없다. 없는 것을 소급 요구하면 기존 계획이 전부 깨진다.
  그래서 revive는 값이 없거나 세 값 중 하나가 아니면 `"logic"`으로 읽는다.
- v2 계획에서 `surface`가 빠진 criterion은 **검증 오류**다. 여기서 기본값을 허용하면
  "분류를 안 적으면 QA를 면제받는다"가 되어 그 자체가 우회 경로가 된다.
  이건 `finalGate`를 optional로 두면 안 됐던 것과 같은 논리다.
- **v2에서 값이 세 enum 중 하나가 아닌 것도 같은 오류다** (A 감사 2 — Medium).
  누락만 막고 `surface: "api"` 같은 미지 값을 `"logic"`으로 normalize하면 오타 하나로
  QA를 면제받는다.

  **revive 알고리즘 (하나로 고정):**

  ```
  surface = (값이 "logic" | "web" | "tui" 중 하나) ? 그 값 : undefined
  ```

  즉 revive는 **normalize하지 않는다.** 유효한 enum만 보존하고, 누락과 미지 값을
  똑같이 `undefined`로 남긴다. 기본값 `"logic"`은 **소비 시점에만** 적용한다:

  | 버전 | `surface === undefined`일 때 |
  | --- | --- |
  | v1 | `?? "logic"`으로 읽는다 (하위 호환) |
  | v2 | 그 기본값을 적용하기 **전에** 검증 오류로 거부한다 |

  별도 원본 보존 필드(`surfaceRaw` 등)는 필요 없다 — 누락과 오타가 같은 결과이므로
  검증기가 둘을 구분할 필요가 없다. v2 오타 케이스는 **write/read 왕복 뒤** 검증하는
  회귀로 만든다. 메모리 상의 객체만 보면 revive를 안 거쳐 의미가 없다.

`qaRequired = 계획 전체 criteria 중 surface가 "web" 또는 "tui"인 것이 하나라도 있는가`.

### 적용 범위: schemaVersion으로 가른다 (재감사 5 반영 — 핵심 정정)

초기 초안은 `finalGate`를 optional로 두고 **없으면 통과**시켰다. 그러면 등록을 안 하는 것이
그대로 우회 경로가 되어 기존 완료 구멍이 남는다. 정정된 규칙:

- `Goalplan`에 `schemaVersion: number`를 추가한다. 기존 파일(필드 없음)은 `1`로 읽는다.
- **`cxc loop init`이 만드는 신규 계획은 `schemaVersion: 2`이고 `finalGate`를
  `{status:"pending"}`으로 필수 등록한다.** 즉 새 goal은 최종 gate를 반드시 통과해야 완료된다.
- `schemaVersion: 1` 계획은 기존 동작 유지 (진행 중 작업이 갑자기 완료 불가가 되지 않는다).
  `cxc loop final-gate open`을 실행하면 그 계획도 `2`로 승격되며, 이것이 **유일한** 승격 경로다.
- `schemaVersion: 2`인데 `finalGate`가 없으면 그 자체가 검증 오류다 (스키마 위반).

### 다운그레이드 방어 (4라운드 감사 6)

goalplan JSON을 직접 편집하는 것은 정상 워크플로다
(`plugins/codexclaw/skills/loop/SKILL.md:147-150`;
`plugins/codexclaw/components/pabcd-state/src/hook.ts:852-855`).
따라서 legacy 판정을 **계획 파일 안의 숫자 하나**에만 걸면, v2 계획에서 `schemaVersion`을
지우거나 `1`로 낮추는 것이 그대로 gate 우회가 된다.

정정: 승격 사실을 계획 파일 밖에도 기록한다.

- `cxc loop init`(v2 생성)과 `final-gate open`(승격)은 goalplan 디렉터리에
  `.codexclaw/goalplans/<slug>/schema-v2.marker`를 함께 쓴다 (내용: 승격 시각 + 이유).
- 검증 시 **유효 버전 = max(계획의 `schemaVersion`, 마커 존재 시 2)** 로 계산한다.
- 마커가 있는데 계획의 `schemaVersion`이 2보다 작거나 없으면 → **거부**하고
  "이 계획은 v2로 승격됐다. `schemaVersion`을 복원하라"를 이유로 낸다. 조용히 v1으로 읽지 않는다.
- 마커 자체를 지우는 것은 막을 수 없다(파일시스템 권한 밖). 그러나 그것은 우연한
  편집이 아니라 명시적 우회이며, ledger에 승격 이벤트가 남아 감사 가능하다.
  이 한계를 문서에 그대로 적는다 — "우회 불가"라고 주장하지 않는다.

### lifecycle: 누가 상태를 옮기는가

`pending → in_flight → approved | inconclusive`를 옮기는 주체를 명시한다.

| 전이 | 주체 | 명령 |
| --- | --- | --- |
| (없음) → `pending` | `loop init` (v2) 또는 명시 승격 | `cxc loop final-gate open` |
| `pending` → `in_flight` | 최종 gate 리뷰어 dispatch 시 | `cxc loop final-gate open --launch` |
| `in_flight` → `approved`/`inconclusive` | 리뷰어 verdict 기록 시 | `cxc loop final-gate verdict --verdict <v> --round <id>` |
| 임의 → `inconclusive` | 소스 변경 감지 (읽기 시점 판정) | 자동 |

### `approved` 전이의 필수 조건 (3라운드 감사 1·2 반영)

`approved` 기록은 다음을 **전부** 만족해야 한다. 하나라도 실패하면 거부한다.

1. `reviewRoundId`가 존재하고, 그 라운드의 `purpose === "final_gate"`다
   (`010`의 용도 분리 — 계획 감사 라운드를 코드 gate로 재사용할 수 없다).
2. **그 라운드의 `status === "approved"`다** (4라운드 감사 4). "종단"으로 두면
   `changes_requested`와 `inconclusive`도 통과하고, `lane.verdict`가 `undefined`인 경우도
   "fail이 아니다"로 새어 들어간다. 추가로 `lane.verdict ∈ {pass, near-pass}`이고
   `lane.verdict === finalGate.verdict`여야 한다. `near-pass` 허용은 A→B와 동일한 정책이고,
   `undefined`는 거부다.
3. `testReceiptPath`가 위 파서를 **`expectedKind: "test"`로** 통과한다
   (존재·0바이트 검사만이 아니다).
4. **계획 전체**의 criteria 중 `surface`가 `web` 또는 `tui`인 것이 있으면
   `qaReceiptPath`도 같은 조건을 **`expectedKind: "qa"`로** 만족한다
   (4라운드 감사 5 — 아래 절).
5. **네 소스 정체성이 모두 `compareSource(...).kind === "same"`이다** — 현재 트리,
   `finalGate.sourceIdentity`, test 영수증의 정체성, (해당 시) QA 영수증의 정체성,
   라운드의 `lane.sourceIdentity`. 하나라도 `different`면 어긋난 항목을 명시해 거부.
   `unavailable`이면 아래 git 부재 정책을 따른다.

### QA 요구 범위: 활성 phase가 아니라 계획 전체 (4라운드 감사 5)

"활성 work-phase의 criteria"를 기준으로 삼으면 마지막 D가 닫힌 뒤
`advanceWorkPhase`가 `activeWorkPhaseId`를 null로 만들므로
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:313-329`)
web/tui criterion이 있어도 활성 phase가 없어 QA 요구가 사라진다. 정확히 gate를 통과해야
하는 시점에 조건이 소멸하는 셈이다.

정정: **계획 전체의 criteria**를 본다. `finalGate`를 열 때
`finalGate.qaRequired: boolean`을 계산해 고정하고(gate-open 시점 스코프),
이후 승인·완료 검증은 그 고정값을 쓴다. 계획 전체 스캔과 고정값이 불일치하면
(예: 나중에 web criterion이 추가됨) 거부하고 gate를 다시 열게 한다.

즉 영수증 검증은 `040`(우회 가능한 조기 경고)에만 두지 않고 **여기에도 둔다.**
`040`을 건너뛰어도 이 전이를 통과할 수 없다.

### `goalplan.ts` — `validateGoalplan` 확장

before: work phase 미완, criterion 미충족, `met`인데 `capturedEvidence` 없음, 빈 계획 → 실패.

after: 위를 유지하고 `schemaVersion >= 2`인 계획에 대해 추가 검사한다.
승인 시점에 검증했더라도 **완료 시점에 다시 검증한다** (승인 후 트리가 변할 수 있다).

1. `status !== "approved"` → 실패, 이유에 현재 status 명시.
2. `sourceIdentity`가 현재 소스와 다르다 (`compareSource(...).kind === "different"`) → 실패,
   "최종 검증 이후 소스가 변경됐다. gate를 다시 통과하라".
3. `verdict === "fail"` → 실패.
4. `reviewRoundId`가 없거나, 라운드 목록에 없거나, `purpose !== "final_gate"`거나,
   `status !== "approved"`거나, `lane.verdict`가 `finalGate.verdict`와 다르다 → 실패.
5. `schemaVersion >= 2`인데 `finalGate` 자체가 없다 → 실패 (스키마 위반).
6. `testReceiptPath`가 없거나 `readReceipt(path, "test")`가 `{error}`를 반환 → 실패
   (이유에 파서 메시지). QA 영수증을 test 자리에 넣으면 여기서 걸린다.
7. `finalGate.qaRequired`인데 `qaReceiptPath`가 없거나 `readReceipt(path, "qa")`가
   실패 → 실패. test 영수증을 QA 자리에 넣으면 여기서 걸린다.
8. test/QA 영수증의 정체성 또는 `lane.sourceIdentity`가 현재 트리와 다르다 → 실패.
9. 비교 결과가 `unavailable`(git 없음)이다 → 실패, "git 없는 환경에서는 최종 gate를
   승인할 수 없다" (`020`의 정책과 일치, 아래 참조).
10. `ctx`가 없는데 `schemaVersion >= 2`다 → 실패 (위 검증 경계 절).
11. 계획 전체 스캔과 `finalGate.qaRequired`가 불일치한다 → 실패.

### git 없는 환경의 정책 (3라운드 감사 3)

`020`은 git이 없으면 `SourceIdentity`를 `unavailable`로 표시한다. 그 경우:

- **`schemaVersion >= 2` 계획은 최종 gate를 승인할 수 없다** (위 9번). 애매한 "fail-open"이
  아니라 명확한 거부다 — 소스를 특정할 수 없으면 gate가 의미를 갖지 못한다.
- `schemaVersion: 1` 계획은 영향받지 않는다 (gate를 요구하지 않으므로).
- 즉 git 없는 환경에서는 **v1 흐름을 쓰라**는 것이 정책이고, 이 사실을 오류 메시지에 적는다.

`schemaVersion: 1` 계획은 기존 동작 그대로다 — 하위 호환은 **버전으로만** 얻고,
"필드를 안 쓰면 통과"라는 우회 경로는 남기지 않는다.

**소스 변경 시 자동 무효화:** `030`은 `approved` 상태를 읽을 때마다 `compareSource`를
확인하므로, 별도 감시 없이 소스가 바뀌면 사실상 `inconclusive`처럼 동작한다.
상태 필드를 직접 되돌려 쓰지는 않는다 (읽기 시점 판정이 단일 진실원).

### `hook.ts` — IDLE Stop 문구

before (`plugins/codexclaw/components/pabcd-state/src/hook.ts:828-865`): 활성 goal + IDLE이면 다음 P 명령과 잔여 작업을 명명.

after: 잔여 work phase와 미충족 criterion이 0인데 `finalGate.status !== "approved"`이면
문구를 바꾼다 — "모든 작업이 끝났고 최종 gate만 남았다: <현재 status>. gate를 닫아라."
블록/해제 판단 로직은 바꾸지 않는다 (문구만).

## 테스트 (accept criteria)

이 사이클의 수용 기준은 **검증 코어**에 한정한다. `cxc loop init`/`final-gate` CLI와
`goal-gate.ts` 배선, IDLE Stop 문구 케이스는 후속 조각으로 넘긴다 (위 범위 절).

| 시나리오 | 기대 | 이 사이클 |
| --- | --- | --- |
| `schemaVersion: 1`, 작업·criteria 완료, `finalGate` 없음 | 통과 (하위 호환) | O |
| `schemaVersion: 2`, `finalGate` 없음 | 실패 (스키마 위반) | O |
| `cxc loop init`으로 만든 신규 계획 | `schemaVersion: 2`, `finalGate.status = "pending"` | **후속** |
| v2 계획에서 `schemaVersion` 삭제 (마커 fixture 존재) | 마커 때문에 v2로 판정, 거부 + 복원 안내 | O |
| v2 계획에서 `schemaVersion`을 `1`로 변경 (마커 fixture 존재) | 동일하게 거부 | O |
| 마커와 계획이 모두 v2 | 정상 | O |
| 마커 없고 계획도 v1 | v1 동작 (진짜 legacy) | O |
| 승격 시 마커 생성 확인 | `schema-v2.marker` 존재, ledger에 승격 이벤트 | **후속** (쓰는 쪽) |
| `schemaVersion: 2`, 작업·criteria 완료, `finalGate.status = "pending"` | 실패, 이유에 pending 명시 | O |
| `in_flight` 상태로 완료 시도 | 실패 | O |
| `finalGate.status = "approved"`, 소스 동일 | 통과 | O |
| `approved` 후 추적 파일 수정 | 실패, 이유에 "소스 변경" | O |
| `approved` 후 ignore되지 않은 untracked 파일 추가 | 실패 (`020` 정정 규칙) | O |
| `approved` 후 gitignore된 경로에만 파일 추가 | 통과 | O |
| `reviewRoundId` 없이 `approved` 기록 시도 | 거부 | O |
| `sourceIdentity` 없이 `approved` 기록 시도 | 거부 | O |
| `purpose: "plan_audit"` 라운드로 `approved` 기록 시도 | 거부 | O |
| `status: "changes_requested"` 라운드로 승인 시도 | 거부 | O |
| `status: "inconclusive"` 라운드로 승인 시도 | 거부 | O |
| `lane.verdict` undefined | 거부 | O |
| `lane.verdict` ≠ `finalGate.verdict` | 거부 | O |
| `lane.verdict: "near-pass"` + 일치 | 허용 | O |
| `testReceiptPath` 없이 `approved` 기록 시도 | 거부 | O |
| test 영수증 0바이트 / malformed JSON / `sourceIdentity` 누락 | 각각 거부 | O |
| 영수증 경로가 `.codexclaw/evidence` 밖 (절대경로) | 거부 | O |
| 영수증이 심링크로 밖을 가리킴 | 거부 | O |
| 영수증이 일반 파일이 아님 (디렉터리/fifo) | 거부 | O |
| `web` criterion 있는데 QA 영수증 없음 | 거부 | O |
| **마지막 phase done + `activeWorkPhaseId: null` + web criterion + QA 없음** | 거부 (감사 5의 핵심 회귀) | O |
| gate-open 이후 web criterion 추가 | 거부, gate 재개시 요구 | O |
| `logic` criterion만 있고 QA 영수증 없음 | 승인 가능 | O |
| `schemaVersion >= 2`인데 `ctx` 없이 `validateGoalplan` 호출 | `ok: false` (조용한 통과 없음) | O |
| v2 검증 중 IO 오류 | `ok: false` + 이유 (outer fail-open으로 새지 않음) | O |
| `goal-gate.ts` 경유 `update_goal complete` (v2, gate pending) | deny 봉투 반환 | **후속** |
| test 영수증 정체성 ≠ 현재 트리 | 거부, 어긋난 항목 명시 | O |
| `lane.sourceIdentity` ≠ `finalGate.sourceIdentity` | 거부 ("리뷰어가 다른 소스를 봤다") | O |
| 승인 후 트리 변경 → 완료 시도 | 실패 (완료 시점 재검증) | O |
| git 없는 환경, `schemaVersion: 2` | 승인 거부, 메시지에 v1 안내 | O |
| git 없는 환경, `schemaVersion: 1` | 기존 동작 (영향 없음) | O |
| `verdict = "fail"`인데 `status = "approved"` | 실패 | O |
| 잔여 0 + gate pending 상태의 IDLE Stop | 문구에 "최종 gate" 포함 | **후속** |
| `schemaVersion: 1` 계획에 `final-gate open` 실행 | `2`로 승격, `pending` 등록 | **후속** |
| `finalGate`/`schemaVersion`이 write/read 왕복에서 보존됨 | revive 확장 회귀 (`010`의 R15와 같은 함정) | O |
| `criteria[].surface`가 왕복에서 보존됨 | revive 확장 회귀 | O |
| v1 계획의 criterion에 `surface` 없음 | 소비 시점에 `"logic"`으로 읽힌다 (하위 호환) | O |
| v1 계획의 criterion에 `surface: "api"` | 동일 — v1은 관대하다 | O |
| v2 계획의 criterion에 `surface` 없음 | 검증 오류 — 기본값으로 QA를 면제받지 못한다 | O |
| v2 계획의 criterion에 `surface: "api"` (미지 enum), **write/read 왕복 후** 검증 | **동일한 검증 오류** — 오타로 QA를 면제받지 못한다 (메모리 객체가 아니라 revive를 거친 값으로 확인) | O |
| `qaReceiptPath`에 `{kind:"test"}` 영수증 | 거부 — `readReceipt(path, "qa")`가 kind 불일치를 낸다 (A 감사 2 High) | O |
| `testReceiptPath`에 `{kind:"qa"}` 영수증 | 거부 — 반대 방향도 막는다 | O |
| `cxc loop validate`로 v2 계획 검증 | CLI가 read-only `ctx`를 구성해 정상 판정 (A 감사 Medium) | O |

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 exit 0, **1,287 pass**. 사슬: `package.json:24` glob이
  `components/pabcd-state/test/*.ts`를 포함한다. → **주 검증기.**
- 좁은 타입체크 (**B 이후 유효**):

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext --strict \
    plugins/codexclaw/components/pabcd-state/src/source-receipt.ts \
    plugins/codexclaw/components/pabcd-state/test/source-receipt.test.ts
  ```

  이 명령은 의존 그래프를 타고 기존 `interview.ts`의 `TS2352` **4건**을 함께 낸다
  (WP10 실측). 수용 조건은 exit 0이 아니라 **"신규 파일 오류 0건"**이고, 비교는
  `... 2>&1 | grep 'error TS' | grep -v interview | wc -l` 이 `0`인지로 한다.
  인자 없는 `npx tsc --noEmit`은 적지 않는다 (root `tsconfig.json` 없음).
- `npm run build` — 신규 `.ts`가 dist로 컴파일된다(114 → 115). → 관측한다.
- `npm run gate` — 이 슬라이스를 **관측하지 않는다**. 비관측 baseline 회귀 확인용
  (현재 exit 0, WARN 4).

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E8** — 단, 이 사이클에서 붙는 소비자는 읽기 전용 `cxc loop validate`뿐이고, **완료를 실제로 막는 런타임 강제는 후속**이다 |
| 실행 주체 | 이 사이클: `cxc loop validate`(보고만 한다). 후속: `goal-gate.ts`가 `update_goal complete` PreToolUse에서 호출해 deny 봉투를 낸다 |
| 알려진 우회 | `schema-v2.marker` 파일을 지우면 v1으로 되돌아간다 — 파일시스템 권한 밖이라 막을 수 없다. 다만 우연한 편집이 아니라 명시적 우회이고 ledger에 승격 이벤트가 남는다. goalplan JSON 직접 편집은 정상 워크플로이므로(`skills/loop/SKILL.md:147-150`) 숫자 하나에만 의존하지 않는 이유가 이것이다 |
| 잔여 위험 | 영수증의 `sourceIdentity`는 영수증을 만든 쪽이 적는다 — 위조 가능하다. 잡는 것은 "리뷰/테스트 이후 트리가 움직였다"이지 "리뷰가 실제로 있었다"가 아니다 |
| 표현 강등 | "최종 검증을 강제한다"가 아니라 **"v2 계획에서 gate 미통과·소스 불일치를 완료 시점에 거부한다"** |
| 최종 강제층 | **`goal-gate.ts`의 deny 봉투** (후속 조각에서 연결). 이 사이클만으로는 `final layer: none` |

## PLAN-FIELD-CHAIN-01

| 타입 | 생성 | 직렬화 | 역직렬화 | 소비 |
| --- | --- | --- | --- | --- |
| `FinalGateState` | 후속 조각의 `final-gate open` (이 사이클에서는 테스트 fixture만) | `writeGoalplan` | `reviveGoalplan` **확장 필수** — 미지 필드는 버려진다 | `validateGoalplan`의 v2 검사 |
| `FinalGateState.qaRequired` | gate-open 시점의 계획 전체 스캔 (후속이 쓴다) | 위와 동일 | 위와 동일. 불리언이 아니면 스키마 오류 | v2 규칙 7·11 — 고정값과 현재 스캔이 어긋나면 거부 |
| `CriterionSurface` | 계획 작성자 (v2에서는 필수 입력) | `writeGoalplan` | `reviveGoalplan` — **유효 enum만 보존, 누락·미지 값은 `undefined`** (normalize하지 않는다) | v1: 소비 시 `?? "logic"`. v2: `undefined`면 검증 오류. 이후 `qaRequired` 계산 |
| `schemaVersion` | 후속 `loop init`/`final-gate open` | 위와 동일 | 위와 동일. 없으면 `1` | 유효 버전 계산 = `max(plan.schemaVersion, 마커 있으면 2)` |
| `SourceBoundReceipt` | 이 모듈이 아니라 **영수증을 쓰는 쪽**(테스트 러너/QA 도구) | `.codexclaw/evidence/*.json` | `parseSourceBoundReceipt` (fail-closed) | `validateGoalplan` v2 규칙 6·7·8 |
| `GoalplanValidationCtx` | 호출자 — 이 사이클에서는 테스트, 후속에서는 `goal-gate.ts` | N/A | N/A | `validateGoalplan` 내부 |

## 범위 밖

- gate 통과를 런타임에서 강제하는 spawn 가드 (`040`).
- Markdown 체크박스 파싱 — 구조화 JSON이 유일 진실원.
