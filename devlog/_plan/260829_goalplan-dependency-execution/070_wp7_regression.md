# 070 — wp7: 회귀 확정

> 선행 조건: `020_wp2_schema_v3.md`, `030_wp3_integrity.md`,
> `040_wp4_dependency_aware.md`, `050_wp5_write_serialization.md`,
> `060_wp6_public_surface.md` 구현 완료
>
> 범위: manifest 기반 변경 전 parser 결과 집합, 필드 기반 선택 호환, outcome 검증 경계, 다섯 RMW
> 소비자의 `dependsOn`·`outcome` 보존, 라운드 5 소유 회귀 재실행, 저장소 게이트
>
> 범위 밖: legacy `criteria[].text` 지원, 실행 드라이버, 새 mutation, 자동 lock 회수

## 0. 확정 계약

- wp2는 스키마 v3의 `dependsOn`·`outcome` 저장과 reviver 보존을 맡는다.
- wp3는 `goalplanDefinitionIntegrityReasons()`와
  `goalplanDependencyCompletionReasons()`를 맡는다.
- wp4는 의존 인식 선택을 맡는다. 선택 로직은 `schemaVersion`으로 갈라지지 않는다.
- wp4의 부분 대기 순수 helper 시그니처는
  `export function dependencyWaitReasons(plan: Goalplan): string[];`이다. ready 존재 여부와 무관하게
  `work-phase <id> waits for work-phase <id> (<status>)`와
  `task <phase-id>/<task-id> waits for task <phase-id>/<task-id> (<status>)`를 계산한다.
- `dependencyDeadlock()`은 ready task나 닫을 수 있는 phase가 없는 전역 교착만 판정한다. mixed
  상태의 Stop `waitingOn`은 `dependencyWaitReasons(plan)` 결과를 쓴다.
- wp5는 공통 lock과 RMW 직렬화를 맡는다.
- wp6는 등록·조회·lifecycle 공개 표면을 맡는다.
- wp2는 비식별 baseline corpus 생성기와 JSON 체크인도 맡는다. wp7은 체크인된 JSON을 입력으로
  소비하며 다시 생성하지 않는다.
- wp7은 동등성 oracle과 공개 소비 경로 회귀만 추가한다. production source는 고치지 않는다.
- T3·T9·T11과 Stop 최종 문자열 단언은 wp6이, T8 연속 cycle 단언은 wp5가 소유한다. wp7은 같은
  테스트를 복제하거나 문자열을 다시 정의하지 않고 소유 테스트 파일을 집중 suite에서 재실행한다.

wp7 P 실측값은 `goalplan.json` 91개다(디렉터리 92개 중 하나는 `goalplan.json` 없는 껍데기고,
`.DS_Store`는 slug 검증이 거부한다). 체크인된 baseline이 이미 `sourceCount: 91`이라 산문보다 최신이었다.
개수는 운영 중 계속 바뀌므로 회귀 기준으로
고정하지 않는다. wp2 baseline에 기록된 manifest 각 항목의 변경 전 normalized 결과와 wp7이 같은
fixture를 새 parser로 읽은 변경 후 normalized 결과를 비교한다. manifest 밖에 운영 plan이 새로
생겨도 이 회귀는 깨지지 않는다. 측정 당시 `opaque-surface-gradient-discipline-3-lane-gpt-5` 한 건은
`criteria[].text`를 써서 변경 전 parser가 `invalid-shape`로 거부했다. 이 실패는 이번 변경 전부터
있었다. legacy `text` 호환은 넣지 않으며 이를 위한 wp2 backpatch도 요구하지 않는다.

선택 호환은 필드만 본다. `dependsOn`이 없거나 빈 배열이면 의존 없음이다.
schema version 값을 비교하는 선택 분기는 금지한다. 단, done/pending task의 `outcome` 무결성 검사는
`schemaVersion >= 3`에서만 켠다. 이는 저장 검증 경계이며 실행 후보 선택이 아니다.

## 1. 현재 소스 근거

아래 줄은 2026-08-29 checkout에서 직접 확인했다.

줄 번호가 아니라 **심볼 이름**으로 앵커를 잡는다. wp1~wp6 구현이 이 표를 세 번 밀었고, wp7
구현 중에도 또 밀릴 수 있다. 아래 실측 위치는 참고값이며 판정 기준은 심볼이다.

| 경로 | 앵커 심볼 | 실측 위치 | wp7이 고정할 성질 |
| --- | --- | --- | --- |
| `src/goalplan.ts` | `readGoalplanDetailed()` | `:607` | corpus 결과 수집 |
| `src/goalplan.ts` | `reviveGoalplan()` | `:486` | JSON parse와 shape 거부 구분 |
| `src/goalplan.ts` | `firstInvalidField()` | `:784` | legacy 한 건의 `invalid-shape` field |
| `src/goalplan.ts` | `nextOpenTask()` | `:963` | v1/v2 선언 순서 oracle |
| `src/goalplan.ts` | `advanceWorkPhase()` | `:1906` | 기존 close·wrap oracle. wp5 이후 이 함수는 위임만 한다 |
| `src/goalplan.ts` | `closeFixedWorkPhase()` | `:1691` | wrap 순서의 실제 소유자. 현재 phase 뒤를 먼저 찾는 성질이 여기 있다 |
| `src/goalplan.ts` | `effectiveActiveWorkPhaseId()` | `:1948` | explicit, in-progress, pending 순서 |
| `src/goalplan.ts` | `validateGoalplan(plan, ctx?)` | `:1402` | outcome 사유와 다른 gate 사유를 분리해 검사 |
| `src/goalplan.ts` | `finalGateReasons(plan, ctx)` | `:1499` | `ok` 전체값을 outcome oracle로 쓰지 않음 |
| `src/orchestrate-cli.ts` | D-close `writeGoalplan` | `:917` | RMW 보존 |
| `src/orchestrate-cli.ts` | sweep `writeGoalplan` | `:1040` | RMW 보존 |
| `src/hook.ts` | 채팅 D-close `writeGoalplan` | `:1231` | RMW 보존 |
| `src/steering.ts` | steering `writeGoalplan` | `:274` | RMW 보존 |
| `src/review-round-cli.ts` | open `writeGoalplan` | `:267` | open 체크포인트 |
| `src/review-round-cli.ts` | abort `writeGoalplan` | `:283` | abort 체크포인트 |
| `src/review-observer.ts` | verdict `writeGoalplan` | `:156` | observer RMW 보존 |
| `src/goal-gate.ts` | `readGoalplan()` | `:271` | 공개 completion gate 입력 |
| `src/goal-gate.ts` | `validateGoalplan()` 호출 | `:276` | outcome 검증 경계 |
| `src/goalplan-cli.ts` | lifecycle `writeGoalplan` | `:475` | wp6 소유. 여섯 번째 RMW이며 T9가 outcome 보존을 검사한다 |
| `src/goalplan-cli.ts` | init `writeGoalplan` | `:596` | 락 밖 유일 write. 새 plan 생성이라 경합 대상이 아니다 |

## 2. 변경 지도

| 표기 | 경로 | 변경 |
| --- | --- | --- |
| wp2 산출물 소비 | `plugins/codexclaw/components/pabcd-state/test/fixtures/goalplans-pre-change-baseline.json` | wp2가 체크인한 비식별 입력 corpus와 변경 전 결과 snapshot을 읽기만 함 |
| NEW | `plugins/codexclaw/components/pabcd-state/test/goalplan-regression.test.ts` | 결과 집합, v1/v2 oracle, outcome 경계 검사 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts` | CLI D-close 뒤 두 필드 재독 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/hook.test.ts` | 채팅 D-close 뒤 두 필드 재독 |
| wp6 산출물 재실행 | `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts` | wp6 소유 Stop 회귀가 ready phase/task와 부분 대기 사유를 최종 문자열로 함께 단언하는지 검사 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/steering.test.ts` | steering annotate 뒤 두 필드 재독 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/review-binding.test.ts` | open, abort, observer 뒤 두 필드 재독 |
| wp5 산출물 재실행 | `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts` | 같은 세션의 연속 두 cycle이 서로 다른 close key와 원장 행을 남기는지 검사 |
| wp6 산출물 재실행 | `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts` | lifecycle 원장 실패의 code 0·경고와 권위 plan commit을 검사 |
| wp6 산출물 재실행 | `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts` | T11의 `--slug` 양방향 고정을 검사. wp7 P 실측: `help-verbs.test.ts`에는 `renderGoalplanHelp` 참조가 0건이고 goalplan help 회귀를 하나도 갖고 있지 않다. wp6이 `goalplan-public-surface.test.ts`의 `help lists repeated dependency syntax and required outcome` case 안에 담았다 |
| dist 변경 없음 | `plugins/codexclaw/components/pabcd-state/dist/` | wp7은 src를 바꾸지 않으므로 새 dist manifest 항목이 없고, 기존 tracked dist freshness만 최종 검사 |
| DELETE | 없음 | 기존 fixture와 테스트를 지우지 않음 |

## 3. wp2 baseline 인수와 parser 결과 동등성

### 3.1 wp2 산출물 인수 계약과 소비 타입 정본

baseline 생성과 체크인은 **wp2 산출물**이다. wp7 실행 중 운영 plan을 다시 읽어 baseline을
만들지 않는다. 이 변경으로 "wp7에서 만들면서 wp2 구현 전에 실행"하던 시간 모순을 없앤다.

3.3의 `GoalplanBaselineSnapshot` 타입이 baseline JSON의 **유일한 소비 스키마 정본**이다. 020의
생성기는 반드시 그 타입을 산출한다. 020 안에 더 작거나 다른 임시 shape를 두지 않는다.
`sourceCount`는 생성 시 발견 개수를 보고하는 값일 뿐이며 특정 숫자와 비교하지 않는다.
`manifest`는 fixture별 alias와 변경 전 결과를 고정한다. 회귀 판정은 이 manifest 항목만 대상으로
한다.

`ordinal`은 1부터 시작하며 manifest 순서대로 연속 증가한다. `alias`는 원본 slug가 아니라
`fixture-<ordinal>`이다. 문자열 치환 map도 fixture마다 새로 만든다. fixture 안의 같은 원문은 같은
별칭을 받지만 다른 fixture와 map을 공유하지 않는다. `sourceClass`는 legacy fixture를 원본 이름 없이
찾는 표식이다. `expected`는 변경 전 normalized 결과다. `invalid-shape` 결과는 원문 diagnostic을
저장하지 않고 normalized `field`를 반드시 가진다.

wp2 생성기는 denylist를 두지 않는다. fixture 하나마다 문자열 alias map을 하나 만들고, 같은 원문
문자열은 같은 alias를 받는다. status·phase·surface·verdict·parser kind처럼 parser가 enum으로 읽는
값만 원본을 유지한다. boolean과 숫자도 원본을 유지한다. 그 밖의 문자열은 key 이름과 상관없이
`fixture-<ordinal>-string-<sequence>`로 바꾼다. 따라서 `ownerSessionId`, `reviewerSession`,
`launchId`, `planPath`, `roundId`, `planEpoch`, commit hash도 자동으로 치환된다. id와 `dependsOn`
참조는 같은 fixture scope에서 같은 alias를 받아 관계를 보존한다.
snapshot의 `capturedAt`과 `sourceCommit`은 parser oracle에 필요하지 않으므로 저장하지 않는다. 이 두
필드를 남겨 commit hash를 보관하는 방식도 금지한다.

```js
// wp1 적용 후 상태: wp2가 baseline 생성기에 넣는 allowlist 핵심
const preservedEnumsByKey = new Map([
  ["status", new Set([
    "pending", "in_progress", "done", "blocked", "superseded",
    "open", "met", "launching", "in_flight", "approved", "changes_requested", "inconclusive",
  ])],
  ["surface", new Set(["logic", "web", "tui"])],
  ["source", new Set(["freeze", "none"])],
  ["purpose", new Set(["plan_audit", "final_gate"])],
  ["verdict", new Set(["pass", "near-pass", "fail"])],
  ["kind", new Set([
    "resolved", "unavailable", "parsed", "absent", "unreadable", "invalid-json", "invalid-shape",
  ])],
  ["sourceClass", new Set(["normal", "legacy-text-criterion"])],
  ["field", new Set(["criteria-shape", "other-shape"])],
]);

function aliasFixtureStrings(value, ordinal, aliases = new Map(), key = "") {
  if (Array.isArray(value)) {
    return value.map((item) => aliasFixtureStrings(item, ordinal, aliases, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [
      childKey,
      aliasFixtureStrings(child, ordinal, aliases, childKey),
    ]));
  }
  if (typeof value !== "string" || preservedEnumsByKey.get(key)?.has(value)) return value;
  if (!aliases.has(value)) {
    aliases.set(value, `fixture-${ordinal}-string-${String(aliases.size + 1).padStart(4, "0")}`);
  }
  return aliases.get(value);
}
```

legacy invalid-shape의 diagnostic field는 plan 문자열과 섞지 않고 generator의
`normalizedResult()`에서 `"criteria-shape"` enum으로 정규화한다. wp7의 `normalize()`도 같은 enum을
내므로 운영 문구를 fixture에 남기지 않으면서 변경 전후 실패 종류를 비교할 수 있다.
wp2 생성기는 각 비식별 plan을 임시 디렉터리에 쓴 뒤 parser 결과를 원본의 normalized result와
비교한다. 문자열 치환 때문에 `parsed`/`invalid-shape` 결과가 달라지면 JSON을 체크인하지 않고
실패한다.

### 3.2 기존 baseline JSON shape·privacy gate

wp7은 wp2가 체크인한 `test/fixtures/goalplans-pre-change-baseline.json`을 읽는다. 수동 축약본이나
새 parser로 다시 만든 baseline은 받지 않는다. 아래 gate를 먼저 실행한다.

```bash
node --input-type=module <<'NODE'
import snapshot from "./plugins/codexclaw/components/pabcd-state/test/fixtures/goalplans-pre-change-baseline.json" with { type: "json" };
if (snapshot.measuredOn !== "2026-08-29") process.exit(1);
if (snapshot.sourceCount !== snapshot.manifest.length) process.exit(2);
if (snapshot.fixtures.length !== snapshot.manifest.length) process.exit(3);
for (const [index, fixture] of snapshot.fixtures.entries()) {
  const manifest = snapshot.manifest[index];
  if (fixture.ordinal !== index + 1 || manifest.ordinal !== fixture.ordinal) process.exit(4);
  if (fixture.alias !== `fixture-${fixture.ordinal}` || manifest.alias !== fixture.alias) process.exit(5);
  if (manifest.sourceClass !== fixture.sourceClass) process.exit(6);
  if (JSON.stringify(manifest.expected) !== JSON.stringify(fixture.expected)) process.exit(7);
  if (fixture.expected.kind === "invalid-shape"
    && !["criteria-shape", "other-shape"].includes(fixture.expected.field)) process.exit(8);
}

const strings = [];
function collectStrings(value) {
  if (typeof value === "string") strings.push(value);
  else if (Array.isArray(value)) value.forEach(collectStrings);
  else if (value && typeof value === "object") Object.values(value).forEach(collectStrings);
}
collectStrings(snapshot);
// 감사 라운드 1: 세 패턴 모두 도달 불가였다. 실측 근거와 함께 넓힌다.
//
// uuid — version nibble을 [1-5]로 못박으면 이 저장소의 세션 id를 하나도 못 잡는다. 운영 corpus의
// ownerSessionId·reviewerSession 32건이 전부 UUIDv7이라 nibble이 7이다. 계약 §21이 요구한 것은
// "UUID 형태"이고 특정 버전이 아니다.
// absolutePath — ^ 앵커는 값 선두만 본다. collectStrings()가 문자열 전체를 하나로 넘기므로
// objective나 detail 안에 박힌 경로는 선두가 아니다.
// sha1 — \b{40}\b는 64자 sha256을 놓친다. fixture 키에 planSha256과 sha256이 실재한다.
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const absolutePath = /(?:^|\s)\/[A-Za-z0-9._-]+\/|[A-Za-z]:[\\/]/;
const hash = /\b[0-9a-f]{32,}\b/i;
if (strings.some((value) => uuid.test(value))) process.exit(9);
if (strings.some((value) => absolutePath.test(value))) process.exit(10);
if (strings.some((value) => hash.test(value))) process.exit(11);
// 개수 하한. 구조 검사가 전부 상대 비교라 빈 baseline이 통과했다. 개수를 박는 것이 아니라
// 0 초과만 요구하므로 계약 §26의 개수 고정 금지와 양립한다.
if (!(snapshot.sourceCount > 0)) process.exit(12);
NODE
```

기대 종료 코드는 `0`이다. schema·manifest가 어긋나면 exit `1`~`8`, UUID 형태·절대 경로·32자 이상 hex가
남으면 exit `9`~`11`, corpus가 비면 exit `12`가 난다. 발견 개수를 특정 숫자와 비교하는 단언은 없다 —
`12`는 하한이지 고정값이 아니다.

감사 라운드 1이 이 게이트를 14종 변이 baseline에 돌려 exit 9·10·11 셋이 도달 불가임을 실측했다.
넓힌 패턴을 같은 변이에 다시 돌린 결과다.

```text
실측 세션 id(UUIDv7)      옛 정규식 false  →  넓힌 정규식 true
문장 중간 절대 경로        옛 정규식 false  →  넓힌 정규식 true
64자 sha256                옛 정규식 false  →  넓힌 정규식 true
enum 문자열 오탐          넓힌 경로 정규식이 in_progress·logic 둘 다 false
```

실효 방어선은 이 정규식이 아니라 alias 불변식이다 — wp2 테스트의 `assertAliased()`가 91개 fixture에
enum·`fixture-N`·`fixture-N-string-NNNN` 밖의 문자열이 0건임을 강제한다. 이 게이트는 이중 확인이며,
이중 확인이 도달 불가면 이중이 아니다.

생성기 `capture-goalplan-baseline.mjs`의 `PRIVACY_PATTERNS`도 같은 세 결함을 갖고 있다. wp7은
production을 고치지 않으므로(§0) 생성기 backpatch는 이번 범위 밖이고, wp7은 게이트 쪽만 넓힌다.
생성기 결함은 별도 항목으로 남긴다.

### 3.3 NEW — `test/goalplan-regression.test.ts`

before:

```text
// wp6 적용 후 상태: 파일 없음
```

after:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOALPLAN_FILE,
  advanceWorkPhase,
  buildGoalplan,
  effectiveActiveWorkPhaseId,
  goalplanDefinitionIntegrityReasons,
  goalplanDir,
  nextOpenTask,
  readGoalplanDetailed,
  validateGoalplan,
  type Goalplan,
  type GoalplanTask,
} from "../src/goalplan.ts";

type NormalizedField = "criteria-shape" | "other-shape";

type NormalizedParserResult =
  | { kind: "parsed" }
  | { kind: "absent" | "unreadable" | "invalid-json" }
  | { kind: "invalid-shape"; field: NormalizedField };

type FixtureAlias = `fixture-${number}`;

interface GoalplanBaselineManifestEntry {
  ordinal: number;
  alias: FixtureAlias;
  sourceClass: "normal" | "legacy-text-criterion";
  expected: NormalizedParserResult;
}

interface GoalplanBaselineFixture extends GoalplanBaselineManifestEntry {
  plan: Record<string, unknown>;
}

interface GoalplanBaselineSnapshot {
  measuredOn: "2026-08-29";
  sourceCount: number;
  manifest: GoalplanBaselineManifestEntry[];
  fixtures: GoalplanBaselineFixture[];
}

const here = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(
  readFileSync(join(here, "fixtures", "goalplans-pre-change-baseline.json"), "utf8"),
) as GoalplanBaselineSnapshot;

function normalize(result: ReturnType<typeof readGoalplanDetailed>): NormalizedParserResult {
  if (result.plan && result.diagnostic === null) return { kind: "parsed" };
  assert.ok(result.diagnostic);
  return result.diagnostic.kind === "invalid-shape"
    ? {
        kind: result.diagnostic.kind,
        field: result.diagnostic.field === "criteria[] entries (each needs scenario/expectedEvidence/status)"
          ? "criteria-shape"
          : "other-shape",
      }
    : { kind: result.diagnostic.kind };
}

test("wp7 corpus keeps the pre-change parser result set", () => {
  assert.equal(snapshot.sourceCount, snapshot.manifest.length);
  assert.equal(snapshot.fixtures.length, snapshot.manifest.length);
  // 감사 라운드 1: 아래 deepEqual은 manifest를 자기 자신과 비교하므로 manifest가 축소되면 축소된
  // 채로 동등해진다. 감사관이 legacy 1건만 남기고 재번호한 baseline에서 3건 전부 통과를 실측했다.
  // 개수를 박지 않고 하한만 둔다 — corpus가 정상 항목을 하나도 안 갖는 상태는 회귀 대상이 아니라
  // baseline이 망가진 상태다.
  assert.ok(snapshot.manifest.length > 1, JSON.stringify({ manifest: snapshot.manifest.length }));
  assert.ok(
    snapshot.manifest.some((entry) => entry.sourceClass === "normal"),
    "corpus must keep at least one normal fixture",
  );
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-goalplan-regression-"));
  try {
    for (const fixture of snapshot.fixtures) {
      const dir = goalplanDir(cwd, fixture.alias);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, GOALPLAN_FILE), `${JSON.stringify(fixture.plan, null, 2)}\n`);
    }
    const actual = snapshot.fixtures.map((fixture) => ({
      ordinal: fixture.ordinal,
      alias: fixture.alias,
      sourceClass: fixture.sourceClass,
      expected: normalize(readGoalplanDetailed(cwd, fixture.alias)),
    }));
    assert.deepEqual(actual, snapshot.manifest);
    const legacy = snapshot.fixtures.find((fixture) => fixture.sourceClass === "legacy-text-criterion");
    assert.ok(legacy);
    assert.deepEqual(
      actual.find((entry) => entry.alias === legacy.alias)?.expected,
      { kind: "invalid-shape", field: "criteria-shape" },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function legacyPlan(schemaVersion: undefined | 2): Goalplan {
  const plan = buildGoalplan({ objective: `legacy selector ${schemaVersion ?? 1}` });
  if (schemaVersion === undefined) delete plan.schemaVersion;
  else plan.schemaVersion = schemaVersion;
  plan.workPhases = [
    { id: "wp-a", title: "A", status: "pending", tasks: [{ id: "a1", title: "A1", status: "pending" }], criteriaIds: [] },
    { id: "wp-b", title: "B", status: "in_progress", tasks: [{ id: "b1", title: "B1", status: "done" }], criteriaIds: [] },
    { id: "wp-c", title: "C", status: "pending", tasks: [{ id: "c1", title: "C1", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "ghost";
  return plan;
}

function oldNextOpenTask(plan: Goalplan): { workPhaseId: string; taskId: string } | null {
  for (const phase of plan.workPhases) {
    if (phase.status === "done" || phase.status === "blocked" || phase.status === "superseded") continue;
    for (const task of phase.tasks) {
      if (task.status !== "done") return { workPhaseId: phase.id, taskId: task.id };
    }
  }
  return null;
}

function oldEffectiveActiveWorkPhaseId(plan: Goalplan): string | null {
  const explicit = plan.workPhases.find((phase) => phase.id === plan.activeWorkPhaseId);
  if (explicit && explicit.status !== "done" && explicit.status !== "blocked" && explicit.status !== "superseded") return explicit.id;
  return plan.workPhases.find((phase) => phase.status === "in_progress")?.id
    ?? plan.workPhases.find((phase) => phase.status === "pending")?.id
    ?? null;
}

function oldAdvanceSummary(plan: Goalplan) {
  const currentId = oldEffectiveActiveWorkPhaseId(plan);
  if (!currentId) return { kind: "no_active" as const };
  const currentIndex = plan.workPhases.findIndex((phase) => phase.id === currentId);
  const current = plan.workPhases[currentIndex];
  const pendingTasks = current.tasks.filter((task) => task.status !== "done");
  if (pendingTasks.length > 0) {
    return { kind: "tasks_pending" as const, workPhaseId: current.id, taskIds: pendingTasks.map((task) => task.id) };
  }
  const after = plan.workPhases.slice(currentIndex + 1).find((phase) => phase.status === "pending");
  const next = after ?? plan.workPhases.slice(0, currentIndex).find((phase) => phase.status === "pending");
  return {
    kind: "ok" as const,
    closedId: current.id,
    activeWorkPhaseId: next?.id ?? null,
    statuses: plan.workPhases.map((phase) => phase.id === current.id
      ? "done"
      : phase.id === next?.id ? "in_progress" : phase.status),
    taskStatuses: plan.workPhases.map((phase) => phase.tasks.map((task) => task.status)),
  };
}

function newAdvanceSummary(plan: Goalplan) {
  const result = advanceWorkPhase(plan);
  if (result.kind === "no_active") return { kind: "no_active" as const };
  if (result.kind === "tasks_pending") {
    return { kind: result.kind, workPhaseId: result.workPhaseId, taskIds: result.pending.map((task) => task.id) };
  }
  return {
    kind: result.kind,
    closedId: result.closedId,
    activeWorkPhaseId: result.plan.activeWorkPhaseId,
    statuses: result.plan.workPhases.map((phase) => phase.status),
    taskStatuses: result.plan.workPhases.map((phase) => phase.tasks.map((task) => task.status)),
  };
}

test("wp7 compat keeps v1 and v2 selector results when dependency fields are absent", () => {
  for (const schemaVersion of [undefined, 2] as const) {
    const plan = legacyPlan(schemaVersion);
    assert.equal(plan.workPhases.some((phase) => "dependsOn" in phase), false);
    assert.equal(plan.workPhases.some((phase) => phase.tasks.some((task) => "dependsOn" in task)), false);
    const selected = nextOpenTask(plan);
    assert.deepEqual(
      selected && { workPhaseId: selected.wp.id, taskId: selected.task.id },
      oldNextOpenTask(plan),
    );
    assert.equal(effectiveActiveWorkPhaseId(plan), oldEffectiveActiveWorkPhaseId(plan));
    assert.deepEqual(newAdvanceSummary(plan), oldAdvanceSummary(plan));

    plan.activeWorkPhaseId = "wp-a";
    assert.equal(effectiveActiveWorkPhaseId(plan), "wp-a");
    plan.activeWorkPhaseId = null;
    plan.workPhases[1].status = "done";
    assert.equal(effectiveActiveWorkPhaseId(plan), "wp-a");
  }
});

function outcomePlan(schemaVersion: undefined | 2 | 3, task: GoalplanTask): Goalplan {
  const plan = buildGoalplan({ objective: `outcome validation ${schemaVersion ?? 1}` });
  if (schemaVersion === undefined) delete plan.schemaVersion;
  else plan.schemaVersion = schemaVersion;
  plan.workPhases = [{ id: "wp1", title: "one", status: "done", tasks: [task], criteriaIds: [] }];
  plan.activeWorkPhaseId = null;
  return plan;
}

test("wp7 outcome validation starts at schema v3 and is not a selector version branch", () => {
  for (const schemaVersion of [undefined, 2] as const) {
    const legacy = outcomePlan(schemaVersion, { id: "t1", title: "done legacy task", status: "done" });
    assert.deepEqual(goalplanDefinitionIntegrityReasons(legacy).filter((reason) => reason.includes("outcome")), []);
    assert.equal(validateGoalplan(legacy).reasons.some((reason) => reason.includes("outcome")), false);
  }

  const missing = outcomePlan(3, { id: "t1", title: "done v3 task", status: "done" });
  assert.deepEqual(
    goalplanDefinitionIntegrityReasons(missing).filter((reason) => reason.includes("outcome")),
    ["task wp1/t1 is done but has no non-empty outcome"],
  );
  assert.equal(
    validateGoalplan(missing).reasons.includes("task wp1/t1 is done but has no non-empty outcome"),
    true,
  );

  const premature = outcomePlan(3, {
    id: "t1", title: "pending v3 task", status: "pending", outcome: "must not exist yet",
  });
  premature.workPhases[0].status = "in_progress";
  assert.deepEqual(
    goalplanDefinitionIntegrityReasons(premature).filter((reason) => reason.includes("outcome")),
    ["task wp1/t1 is pending but has outcome"],
  );
  assert.equal(
    validateGoalplan(premature).reasons.includes("task wp1/t1 is pending but has outcome"),
    true,
  );

  const valid = outcomePlan(3, { id: "t1", title: "done v3 task", status: "done", outcome: "tests: 12 passed" });
  assert.deepEqual(goalplanDefinitionIntegrityReasons(valid).filter((reason) => reason.includes("outcome")), []);
  assert.equal(validateGoalplan(valid).reasons.some((reason) => reason.includes("outcome")), false);
});
```

`oldNextOpenTask()`, `oldEffectiveActiveWorkPhaseId()`, `oldAdvanceSummary()`는 변경 전
`goalplan.ts:707`, `:1082`, `:1029` 의미를 test-local oracle로 동결한다. 새 구현과 코드를
공유하지 않는다. 이 테스트가 v1/v2 선택 결과의 동등성을 판정한다. `outcome` 테스트만 버전 경계를
쓴다. `goalplan.ts:791~818`의 전체 `ok`는 final gate까지 합친 값이다. 특히 `:871~879` 때문에
context 없는 v2/v3 fixture는 outcome이 정상이어도 `ok === false`일 수 있다. 이 테스트는 관심사인
outcome 사유의 포함 여부만 판정한다.

## 4. 다섯 RMW 공개 경로의 필드 보존

공통 기대값은 아래와 같다.

```ts
const expectedTaskFields = [
  { id: "t-1", dependsOn: [], outcome: "first task verified" },
  { id: "t-2", dependsOn: ["t-1"], outcome: "second task verified" },
];

function taskFields(plan: Goalplan) {
  return plan.workPhases[0].tasks.map(({ id, dependsOn, outcome }) => ({ id, dependsOn, outcome }));
}
```

각 테스트는 공개 진입점을 호출한 뒤 `readGoalplan()`로 디스크를 다시 읽는다. 반환 객체만 검사하거나
`writeGoalplan()` 왕복으로 바꾸면 실패다.

### 4.1 MODIFY — `test/orchestrate-cli.test.ts`

before:

```ts
// wp6 적용 후 상태
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
```

after:

```ts
import { buildGoalplan, readGoalplan, writeGoalplan } from "../src/goalplan.ts";
```

기존 D-close harness 아래에 다음 테스트를 추가한다.

```ts
test("wp7 preservation: CLI D-close keeps dependsOn and outcome", () => {
  const cwd = boundCwd();
  const id = "wp7-cli-d";
  const slug = "wp7-cli-d";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  seeded.schemaVersion = 3;
  seeded.workPhases[0].tasks = [
    { id: "t-1", title: "first", status: "done", dependsOn: [], outcome: "first task verified" },
    { id: "t-2", title: "second", status: "done", dependsOn: ["t-1"], outcome: "second task verified" },
  ];
  writeGoalplan(cwd, seeded);

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const result = runOrchestrateCli(args as never);

  assert.equal(result.code, 0, result.output);
  assert.equal(readState(cwd, id).phase, "IDLE");
  const saved = readGoalplan(cwd, slug)!;
  assert.equal(saved.workPhases[0].status, "done");
  assert.equal(saved.workPhases[1].status, "in_progress");
  assert.deepEqual(taskFields(saved), expectedTaskFields);
});
```

### 4.2 MODIFY — `test/hook.test.ts`

before:

```ts
// wp6 적용 후 상태
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
```

after:

```ts
import { buildGoalplan, readGoalplan, writeGoalplan } from "../src/goalplan.ts";
```

```ts
test("wp7 preservation: chat D-close keeps dependsOn and outcome", () => {
  const cwd = gitRepoForHook();
  try {
    const slug = "wp7-chat-d";
    const plan = buildGoalplan({ objective: "wp7 chat D" });
    plan.slug = slug;
    plan.schemaVersion = 3;
    plan.workPhases = [{
      id: "wp-1", title: "first", status: "in_progress", criteriaIds: [],
      tasks: [
        { id: "t-1", title: "first", status: "done", dependsOn: [], outcome: "first task verified" },
        { id: "t-2", title: "second", status: "done", dependsOn: ["t-1"], outcome: "second task verified" },
      ],
    }];
    plan.activeWorkPhaseId = "wp-1";
    writeGoalplan(cwd, plan);
    writeState(cwd, {
      ...defaultState("wp7-chat-d"), phase: "C", slug, orchestrationActive: true,
      checkEpoch: "wp7-check", flags: { interview: false, auditPassed: true, checkPassed: true },
    });
    seedChatReceipt(cwd, "wp7-chat-d", "wp7-check");
    const attest = JSON.stringify({
      from: "C", to: "D", did: "ran wp7 suite", checkOutput: "12 passed", exitCode: 0,
      workPhaseId: "wp-1",
      testReceiptPath: ".codexclaw/evidence/wp7-chat-d/test-receipt.json",
    });

    const output = handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, "wp7-chat-d", "turn-1"));

    assert.doesNotMatch(output, /refused/);
    assert.equal(readState(cwd, "wp7-chat-d").phase, "IDLE");
    const saved = readGoalplan(cwd, slug)!;
    assert.equal(saved.workPhases[0].status, "done");
    assert.deepEqual(taskFields(saved), expectedTaskFields);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

### 4.3 MODIFY — `test/steering.test.ts`

현재 import에는 `readGoalplan()`이 이미 있다. 새 import는 없다.

before:

```ts
// wp6 적용 후 상태
test("a valid batch applies once, records the entry and one ledger line", () => {
```

after에는 기존 테스트를 유지하고 아래 테스트를 덧붙인다.

```ts
test("wp7 preservation: steering RMW keeps dependsOn and outcome", () => {
  const cwd = workspace();
  const seeded = readGoalplan(cwd, SLUG)!;
  seeded.schemaVersion = 3;
  seeded.workPhases = [{
    id: "wp-1", title: "first", status: "in_progress", criteriaIds: [],
    tasks: [
      { id: "t-1", title: "first", status: "done", dependsOn: [], outcome: "first task verified" },
      { id: "t-2", title: "second", status: "done", dependsOn: ["t-1"], outcome: "second task verified" },
    ],
  }];
  seeded.activeWorkPhaseId = "wp-1";
  writeGoalplan(cwd, seeded);

  const result = applySteeringBatch(cwd, SLUG, batch(), { now: () => "2026-08-29T00:00:00.000Z" });

  assert.equal(result.kind, "applied");
  const saved = readGoalplan(cwd, SLUG)!;
  assert.equal(saved.steeringLog?.length, 1);
  assert.deepEqual(taskFields(saved), expectedTaskFields);
});
```

### 4.4 MODIFY — `test/review-binding.test.ts`: open과 abort

현재 import에는 `readGoalplan()`이 이미 있다.

before:

```ts
// wp6 적용 후 상태
test("060: abort closes a round without ever approving it", () => {
```

after에는 기존 테스트를 유지하고 helper와 테스트를 덧붙인다.

```ts
function seedWp7ReviewFields(cwd: string, slug: string): void {
  const plan = readGoalplan(cwd, slug)!;
  plan.schemaVersion = 3;
  plan.workPhases[0].tasks = [
    { id: "t-1", title: "first", status: "done", dependsOn: [], outcome: "first task verified" },
    { id: "t-2", title: "second", status: "done", dependsOn: ["t-1"], outcome: "second task verified" },
  ];
  writeGoalplan(cwd, plan);
}

test("wp7 preservation: review-round open and abort keep dependsOn and outcome", () => {
  const { cwd, slug } = seedAtA();
  try {
    seedWp7ReviewFields(cwd, slug);

    const opened = open(cwd, "devlog/_plan/260815_probe/000_plan.md");

    assert.equal(opened.code, 0, opened.output);
    const afterOpen = readGoalplan(cwd, slug)!;
    assert.equal(latestRound(afterOpen, "plan_audit")?.status, "in_flight");
    assert.deepEqual(taskFields(afterOpen), expectedTaskFields);

    const args = parseReviewRoundCliArgs([
      "abort", "--session", "rb", "--cwd", cwd, "--reason", "reviewer stopped",
    ], cwd);
    assert.ok(!("error" in args));
    const aborted = runReviewRoundCli(args as never);

    assert.equal(aborted.code, 0, aborted.output);
    const afterAbort = readGoalplan(cwd, slug)!;
    assert.equal(latestRound(afterAbort, "plan_audit")?.status, "inconclusive");
    assert.deepEqual(taskFields(afterAbort), expectedTaskFields);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

open 직후와 abort 직후를 따로 읽는다. `review-round-cli.ts:237`에서 필드를 잃은 뒤 `:263`이 빈
값을 보존하는 결함을 최종 상태만 보고 놓치지 않는다.

### 4.5 MODIFY — `test/review-binding.test.ts`: observer verdict

before:

```ts
// wp6 적용 후 상태
test("060: only an explorer's closing sign-off records a verdict", () => {
```

after에는 기존 테스트를 유지하고 아래 테스트를 덧붙인다.

```ts
test("wp7 preservation: review observer verdict keeps dependsOn and outcome", () => {
  const { cwd, slug } = seedAtA();
  try {
    seedWp7ReviewFields(cwd, slug);
    const opened = open(cwd, "devlog/_plan/260815_probe/000_plan.md");
    assert.equal(opened.code, 0, opened.output);
    const launchId = opened.output.split("\n")[0];

    const output = handleReviewObserver(JSON.stringify({
      hook_event_name: "SubagentStop",
      session_id: "rb",
      cwd,
      agent_type: "explorer",
      agent_id: "reviewer-wp7",
      last_assistant_message: `review complete\n\nLAUNCH: ${launchId}\nVERDICT: PASS`,
    }));

    assert.equal(output, "");
    const saved = readGoalplan(cwd, slug)!;
    const round = latestRound(saved, "plan_audit")!;
    assert.equal(round.status, "approved");
    assert.equal(round.lane.verdict, "pass");
    assert.equal(round.lane.reviewerSession, "reviewer-wp7");
    assert.deepEqual(taskFields(saved), expectedTaskFields);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

`review-observer.ts:123`은 ignored sign-off의 ledger 기록이다. 위 payload는 그 분기를 타지 않고
`:164` 승인 write를 타야 한다. `approved`, `pass`, reviewer id 세 값을 함께 검사해 활성 시나리오를
고정한다.

### 4.6 인용·재실행 — `test/hook-continuation.test.ts`: Stop ready·waiting 소비 경로

Stop 최종 문자열과 그 단언은 §33 N6에 따라 wp6만 소유한다. wp7은 테스트를 새로 추가하거나 정규식을
느슨하게 다시 쓰지 않는다. wp6의 `wp6: Stop reason lists ready work and partial dependency waits
together`를 아래에 발췌하고 §7.2에서 재실행한다. 정본은 `test/hook-continuation.test.ts`의 현재 본문이며,
발췌와 어긋나면 소유 파일이 이긴다.

```ts
test("wp6: Stop reason lists ready work and partial dependency waits together", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "wp6-ready", status: "active" }], () => {
      const plan = buildGoalplan({
        objective: "Expose dependency-aware Stop guidance",
        criteria: [{ scenario: "Stop shows executable work", expectedEvidence: "node --test green" }],
      });
      plan.schemaVersion = 3;
      plan.activeWorkPhaseId = "wp-live";
      plan.workPhases = [
        {
          id: "wp-base", title: "Base", status: "done", dependsOn: [], criteriaIds: [],
          tasks: [{ id: "base", title: "Base task", status: "done", dependsOn: [], outcome: "base done" }],
        },
        {
          id: "wp-live", title: "Live", status: "in_progress", dependsOn: ["wp-base"], criteriaIds: ["c-1"],
          tasks: [
            { id: "ready", title: "Ready task", status: "pending", dependsOn: [] },
            { id: "blocked", title: "Blocked task", status: "pending", dependsOn: ["later"] },
            { id: "later", title: "Later task", status: "pending", dependsOn: [] },
          ],
        },
        {
          id: "wp-blocked", title: "Blocked phase", status: "pending", dependsOn: ["wp-live"],
          criteriaIds: [], tasks: [],
        },
      ];
      writeGoalplan(cwd, plan);
      writeState(cwd, {
        ...defaultState("wp6-ready"),
        phase: "B",
        orchestrationActive: true,
        lastInjectedPhase: "B",
        slug: plan.slug,
      });

      const output = handleStop(stop(cwd, "wp6-ready"));
      assert.notEqual(output, "");
      const reason = (JSON.parse(output.trim()) as { reason: string }).reason;
      assert.match(reason, /Ready work phases: wp-live \(Live\)/);
      assert.match(reason, /Ready tasks: wp-live\/ready \(Ready task\); wp-live\/later \(Later task\)/);
      assert.match(
        reason,
        /Waiting on: task wp-live\/blocked waits for task wp-live\/later \(pending\); work-phase wp-blocked waits for work-phase wp-live \(in_progress\)/,
      );
      assert.match(reason, /Required evidence: node --test green/);
      assert.match(reason, /cxc orchestrate C --session wp6-ready --attest/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

`wp-live/ready`와 `wp-live/later`가 실행 가능하므로 `dependencyDeadlock(plan)`은 `null`이다. 그래도
`dependencyWaitReasons(plan)`은 아래 두 원소를 선언 순서대로 반환하고, Stop은 ready 두 줄과
`Waiting on:` 한 줄을 함께 낸다.

```text
task wp-live/blocked waits for task wp-live/later (pending)
work-phase wp-blocked waits for work-phase wp-live (in_progress)
```

따라서 이 회귀는 전역 교착 사유에 기대지 않는다. 전역 교착 결과만 읽는 구현이면
정확한 `Waiting on:` 단언이 실패한다.

### 4.7 MODIFY — `test/goalplan.test.ts`: `show`의 락 표시 렌더 경로

wp7 P stale check이 잡은 항목이다. §6.2가 이 회귀를 wp6 산출물로 인수하려 했으나 실측하니 없다.

```bash
rg -c 'writeLock' plugins/codexclaw/components/pabcd-state/test/
# → 0건
```

production은 실제로 두 줄을 낸다(`goalplan-cli.ts`의 `renderPlanLines()`).

```text
writeLock: present path=<절대 경로> ageMs=<숫자>
writeLock: absent path=<절대 경로>
```

있는 것은 helper 직접 호출뿐이다 — `goalplan-concurrency.test.ts:359`가 `status.ageMs`를,
`:373`이 `{ path, exists: false, ageMs: null }`을 검사한다. §6이 "helper 직접 호출 결과만으로
대체하지 않는다"고 못 박은 바로 그 형태다. `show` 렌더 경로는 지금 무방비다.

wp7은 production을 고치지 않는다(§0 범위). 테스트 2건만 더한다.

```ts
test("wp7 preservation: show renders the write lock path and age", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-wp7-lock-"));
  const plan = buildGoalplan({ objective: "Ship the loop", criteria: [], now: () => NOW });
  writeGoalplan(cwd, plan);

  // 락 없음: absent 줄이 절대 경로를 담고 ageMs를 붙이지 않는다.
  const absent = runGoalplanCli(
    parseGoalplanCliArgs(["show", "--slug", plan.slug, "--cwd", cwd], cwd) as GoalplanCliArgs,
  );
  assert.equal(absent.code, 0);
  const lockDir = goalplanWriteLockDir(cwd, plan.slug);
  assert.match(absent.output, new RegExp(`^writeLock: absent path=${escapeRe(lockDir)}$`, "m"));
  assert.doesNotMatch(absent.output, /ageMs=/);

  // 락 있음: present 줄이 같은 경로와 숫자 나이를 담는다.
  mkdirSync(lockDir, { recursive: true });
  const present = runGoalplanCli(
    parseGoalplanCliArgs(["show", "--slug", plan.slug, "--cwd", cwd], cwd) as GoalplanCliArgs,
  );
  assert.equal(present.code, 0);
  assert.match(present.output, new RegExp(`^writeLock: present path=${escapeRe(lockDir)} ageMs=\\d+$`, "m"));

  // 기존 요약 줄은 두 경우 모두 그대로다. 새 줄이 기존 출력을 밀어내지 않는다.
  for (const out of [absent.output, present.output]) {
    assert.match(out, /^\[codexclaw loop: /m);
    assert.match(out, /^criteria: 0 \(unmet 0\)$/m);
    assert.match(out, /^complete: /m);
  }
});

test("wp7 preservation: show survives a lock that vanishes between exists and stat", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-wp7-race-"));
  const plan = buildGoalplan({ objective: "Ship the loop", criteria: [], now: () => NOW });
  writeGoalplan(cwd, plan);
  const lockDir = goalplanWriteLockDir(cwd, plan.slug);
  mkdirSync(lockDir, { recursive: true });

  // exists 뒤 stat 사이에 락이 사라지는 경우. 주입 seam은 wp5가 만든 네 번째 인자다.
  const status = goalplanWriteLockStatus(cwd, plan.slug, Date.now(), () => {
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  });
  assert.deepEqual(status, { path: lockDir, exists: false, ageMs: null });

  // 그 정규화가 렌더까지 전달되는지: show는 예외 없이 absent를 낸다.
  rmSync(lockDir, { recursive: true, force: true });
  const rendered = runGoalplanCli(
    parseGoalplanCliArgs(["show", "--slug", plan.slug, "--cwd", cwd], cwd) as GoalplanCliArgs,
  );
  assert.equal(rendered.code, 0);
  assert.match(rendered.output, new RegExp(`^writeLock: absent path=${escapeRe(lockDir)}$`, "m"));
});
```

`escapeRe()`와 `NOW`는 이 파일 helper 구역에 둔다. 락 경로가 `mktemp` 절대 경로라 정규식 특수문자를
담을 수 있고, `NOW`는 이 파일에 아직 없다 — stale check 실측에서 `rg -n '\bNOW\b' test/goalplan.test.ts`가
0건이었다. 두 이름 모두 위 두 테스트가 참조하므로 같은 커밋에서 helper 구역에 신설한다.

```ts
const NOW = "2026-08-29T00:00:00.000Z";

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

import 추가는 `goalplanWriteLockDir`, `goalplanWriteLockStatus`, `mkdirSync`, `rmSync`,
`parseGoalplanCliArgs`, `runGoalplanCli`, `type GoalplanCliArgs`다. 앞 둘은 `goalplan.ts`,
뒤 셋은 `goalplan-cli.ts`에서 온다. 이 파일에 이미 있는 이름은 다시 넣지 않는다.

## 5. 공통 helper 배치

`expectedTaskFields`와 `taskFields()`는 각 test file 상단 helper 구역에 같은 내용으로 둔다. 별도
production helper를 만들지 않는다. 네 파일의 helper 변경은 아래 형태다.

before:

```ts
// wp6 적용 후 상태
// wp7 field snapshot helper 없음
```

after:

```ts
const expectedTaskFields = [
  { id: "t-1", dependsOn: [], outcome: "first task verified" },
  { id: "t-2", dependsOn: ["t-1"], outcome: "second task verified" },
];

function taskFields(plan: { workPhases: Array<{ tasks: Array<{
  id: string;
  dependsOn?: string[];
  outcome?: string;
}> }> }) {
  return plan.workPhases[0].tasks.map(({ id, dependsOn, outcome }) => ({ id, dependsOn, outcome }));
}
```

## 6. outcome 회귀 목록

아래 항목은 3.3과 4.1~4.5의 wp7 추가 코드, 4.6의 wp6 소유 회귀가 직접 검사한다.

- done task의 `outcome`이 CLI D-close, 채팅 D-close, steering, review-round CLI,
  review observer RMW 뒤에도 정확한 문자열로 남는다.
- 의존 task의 `dependsOn: ["t-1"]`도 같은 다섯 경로 뒤에 남는다.
- v1/v2 plan의 done task에 `outcome`이 없어도
  `goalplanDefinitionIntegrityReasons()`와 `validateGoalplan().reasons`에 outcome 사유가 없다. context
  없는 v2 plan의 전체 `ok` 값은 final gate 거부 때문에 oracle로 쓰지 않는다.
- v3 done task의 outcome 누락은
  `task wp1/t1 is done but has no non-empty outcome` 한 건을 낸다.
- v3 pending task의 outcome 선기록은
  `task wp1/t1 is pending but has outcome` 한 건을 낸다.
- v3 done task의 `outcome: "tests: 12 passed"`는 outcome 사유를 내지 않는다.
- Stop 안내에는 `readyWorkPhases()`와 `readyTasks()` 결과가 실제 목록으로 나타나고, blocked
  phase와 task가 기다리는 선행 id도 나타난다. helper 직접 호출 결과만으로 대체하지 않는다.
- `cxc loop show`는 goalplan write lock이 있으면 락 디렉터리 절대 경로와 나이를 표시하고, 락이
  없으면 예외 없이 정상 plan 요약을 표시한다. `existsSync()`와 `statSync()` 사이에 락이 사라지는
  경우도 `{ exists: false }`로 정규화한다. 이 회귀는 §4.7이 **wp7 소유로 신설**한다 — stale check
  실측에서 `rg -c writeLock test/`가 0건이었다.

### 6.1 라운드 5 소유 회귀 인수 목록

wp7은 아래 테스트 본문을 다른 파일에 복제하지 않는다. wp5·wp6의 최종 테스트를 인수하고 §7.2에서
각 소유 파일을 재실행한다.

아래 네 코드 블록(T3·T8·T9·T11)은 **인수 대상을 식별하는 발췌**다. 정본은 각 항목이 밝힌 소유 파일의
현재 본문이며, 발췌와 소유 파일이 어긋나면 소유 파일이 이긴다. wp7 B는 이 블록을 붙여넣지 않고
§7.2에서 소유 파일을 그대로 재실행한다. §4.6의 Stop 인용도 같은 규칙을 따른다.

#### T3 — steering batch의 모든 op 적용

소유: wp6 `test/steering.test.ts`. arrange에서 뒤 op가 앞 op를 참조하는 두 op batch를 만들고,
act에서 `applySteeringBatch()`를 한 번 호출한다. assert는 두 phase의 저장 순서, `wp-b.dependsOn`,
summary를 모두 고정한다.

```ts
test("same-batch backward reference succeeds and forward reference is rejected as dangling", () => {
  const cwd = workspace();
  const valid = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-same-batch",
    ops: [
      { kind: "add-work-phase", id: "wp-a", title: "A", dependsOn: [] },
      { kind: "add-work-phase", id: "wp-b", title: "B", dependsOn: ["wp-a"] },
    ],
  }));

  assert.equal(valid.kind, "applied");
  const stored = readGoalplan(cwd, SLUG)!;
  assert.deepEqual(
    stored.workPhases.filter((wp) => wp.id === "wp-a" || wp.id === "wp-b").map((wp) => wp.id),
    ["wp-a", "wp-b"],
  );
  assert.deepEqual(stored.workPhases.find((wp) => wp.id === "wp-b")?.dependsOn, ["wp-a"]);
  assert.equal(stored.steeringLog?.at(-1)?.summary, "2 op(s): add-work-phase, add-work-phase");

  const beforePlan = readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8");
  const beforeLedger = ledgerText(cwd);
  const invalid = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-forward-dangling",
    ops: [
      { kind: "add-work-phase", id: "wp-x", title: "X", dependsOn: ["wp-y"] },
      { kind: "add-work-phase", id: "wp-y", title: "Y", dependsOn: ["wp-x"] },
    ],
  }));

  assert.equal(invalid.kind, "rejected");
  assert.equal(
    (invalid as { kind: "rejected"; reason: string }).reason,
    "work phase wp-x depends on unknown work phase 'wp-y'",
  );
  assert.equal(readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8"), beforePlan);
  assert.equal(ledgerText(cwd), beforeLedger);
});
```

#### T8 — 같은 세션의 연속 두 cycle close 원장

소유: wp5 `test/orchestrate-cli.test.ts`. 첫 cycle을 닫은 뒤 같은 session id에 새 `checkEpoch`와
`workPhaseId`를 묶어 둘째 cycle을 닫는다. PABCD close 원장은 두 3-tuple을 각각 보존해야 한다.

```ts
test("one session closes two consecutive cycles with distinct close keys", () => {
  const cwd = boundCwd();
  const id = "two-cycles-one-session";
  const slug = "two-cycles-one-session-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");

  const first = runOrchestrateCli(parsedDclose(cwd, id));
  assert.equal(first.code, 0, first.output);
  assert.equal(readGoalplan(cwd, slug)!.activeWorkPhaseId, "wp-2");

  const secondEpoch = "c-second-cycle";
  writeState(cwd, {
    ...readState(cwd, id),
    phase: "C",
    checkEpoch: secondEpoch,
    dcloseRecovery: null,
    flags: { interview: false, auditPassed: true, checkPassed: true },
  });
  seedReceipt(cwd, id, secondEpoch);
  const secondAttest = JSON.stringify({
    from: "C",
    to: "D",
    did: "verified the second cycle",
    checkOutput: "tests passed",
    exitCode: 0,
    workPhaseId: "wp-2",
    testReceiptPath: `.codexclaw/evidence/${id}/test-receipt.json`,
  });
  const secondArgs = parseOrchestrateCliArgs(
    ["d", "--session", id, "--cwd", cwd, "--attest", secondAttest],
    cwd,
  );
  assert.ok(!("error" in secondArgs));

  const second = runOrchestrateCli(secondArgs as never);

  assert.equal(second.code, 0, second.output);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.deepEqual(
    ledgerLines(cwd)
      .filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE")
      .map((row) => [row.checkEpoch, row.closedWorkPhaseId]),
    [["c-test-epoch", "wp-1"], [secondEpoch, "wp-2"]],
  );
  assert.equal(readGoalplan(cwd, slug)!.workPhases[1].status, "done");
});
```

#### T9 — lifecycle plan commit 뒤 ledger append 실패

소유: wp6 `test/goalplan-public-surface.test.ts`. ledger 경로에 디렉터리를 만들어 append만 실패시킨다.
권위 plan은 완료 상태와 outcome을 보존하고 CLI는 code `0`과 정확한 경고 prefix를 반환해야 한다.

```ts
test("ledger append failure keeps the committed lifecycle state and returns code 0 with a warning", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const ledgerPath = join(goalplanDir(cwd, plan.slug), "ledger.jsonl");
  mkdirSync(ledgerPath, { recursive: false });

  const result = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "authoritative plan proof",
  ]);

  assert.equal(result.code, 0);
  assert.match(
    result.output,
    /warning: goalplan state was committed, but ledger append failed:/,
  );
  const stored = readGoalplan(cwd, plan.slug)!;
  assert.equal(stored.workPhases[1].tasks[1].status, "done");
  assert.equal(stored.workPhases[1].tasks[1].outcome, "authoritative plan proof");
  assert.equal(existsSync(ledgerPath), true);
});
```

#### T11 — 읽기 verb의 `--slug` 보존과 mutating verb의 `--slug` 부재

소유: wp6 `test/help-verbs.test.ts`와 `test/goalplan-public-surface.test.ts`.

wp6 라운드 1 High가 방향을 뒤집었다. `runSteer()`와 `runAddOp()`는 `readState(cwd, session).slug`만 읽고
`args.slug`를 무시하므로 `steer`·`add-work-phase`·`add-criterion` usage의 `--slug <slug>`는 실행되지 않는
문법이었다. 그 세 줄은 060이 help에서 지운다. 그래서 이 회귀는 "보존"이 아니라 **양방향 고정**이다.
읽기 verb 셋(`show`·`validate`·`ready`)은 `resolveSlug()`로 실제 인자를 쓰므로 `--slug`가 남고, mutating
verb 셋에는 없어야 한다. parser의 `--slug` 처리와 `loop ready`의 인자 없음 오류 문구는 그대로다.

```ts
test("help lists repeated dependency syntax and required outcome", () => {
  const help = renderGoalplanHelp();

  assert.match(help, /cxc loop init --objective/);
  assert.match(help, /cxc loop show \(--slug <slug> \| --objective <text>\)/);
  assert.match(help, /cxc loop validate --slug <slug>/);
  assert.match(help, /cxc loop ready \(--slug <slug> \| --objective <text> \| --session <id>\)/);
  // 라운드 3 관찰: 글자 그대로의 정규식은 `--slug`가 인자 순서를 바꿔 되돌아오면 놓친다.
  // 감사관이 실측한 누락 셋 — slug가 session 앞, 대괄호 optional, awp 줄 꼬리. verb usage 줄을
  // 먼저 잡고 그 줄 안 `--slug` 유무를 보면 위치와 무관하게 잡힌다.
  for (const verb of ["steer", "add-work-phase", "add-criterion"]) {
    const line = help.split("\n").find((row) => row.includes(`cxc loop ${verb} `));
    assert.ok(line, `usage line missing for ${verb}`);
    assert.equal(line!.includes("--slug"), false, line!);
  }
  assert.match(help, /cxc loop steer --session <id> --batch-json/);
  assert.match(help, /cxc loop add-work-phase --session <id> --id <id>/);
  assert.match(help, /cxc loop add-criterion --session <id> --criterion <text>/);
  assert.match(help, /\[--depends-on <id>\]\.\.\./);
  assert.match(help, /ready .*--json/);
  assert.match(help, /add-task .*\[--depends-on <task-id>\]\.\.\./);
  assert.match(help, /complete-task .*--outcome <text>/);
  assert.match(help, /meet-criterion .*--evidence <text>/);
  assert.match(help, /Repeat --depends-on once per prerequisite/);
});
```

줄 단위 부재 검사가 이 회귀의 핵심이다. 누군가 나중에 `--slug`를 세 mutating usage에 되돌리면 그 인자가
다시 무시되는데, `match`만 있는 테스트는 그것을 잡지 못한다. 라운드 3 감사관이 `doesNotMatch` 형태의
탐지 범위를 실측해 세 가지 누락을 찾았다 — `--slug`가 `--session` 앞에 오는 형태, `[--slug <slug>]`
대괄호 형태, `add-work-phase` 줄 꼬리에 붙는 형태. 정규식이 옛 문자열 순서를 그대로 담고 있어야만
잡히기 때문이다. verb usage 줄을 먼저 찾고 그 줄에 `--slug`가 있는지 보는 형태로 바꾸면 위치와
무관하게 잡는다. 실측으로 확인했다 — 꼬리 되돌림이 RED가 되고 읽기 verb 셋은 그대로 통과한다.

### 6.2 출력 문자열과 기존 테스트 검색

wp7은 production 출력 문자열을 바꾸지 않는다. 그래도 wp7이 회귀로 고정하는 wp4·wp6 문자열을
기다리는 기존 테스트가 있는지 2026-08-29 checkout에서 아래 명령으로 검색했다.

```bash
rg -n --fixed-strings \
  -e 'blocked or superseded' \
  -e 'Dependency deadlock: work-phase' \
  -e 'Ready work phases:' \
  -e 'Ready tasks:' \
  -e 'Waiting on:' \
  -e 'Lock path:' \
  plugins/codexclaw/components/pabcd-state/test || true
```

| 출력 문자열 | 기존 테스트 검색 결과 | wp7 처분 |
| --- | --- | --- |
| `Dependency deadlock: work-phase wp-1 is blocked` | wp4가 갱신을 이미 완료했다. wp7 P 실측: `:927`이 이 문구를 `assert.match`로 기다리고, `/blocked or superseded/`를 담은 세 곳(`hook.test.ts:982`·`:1028`, `orchestrate-cli.test.ts:879`)은 전부 `doesNotMatch`다 | 갱신할 assert가 없다. wp7은 새 문구가 유지되는지 집중 suite로 재검증만 한다 |
| `Ready work phases:`, `Ready tasks:`, `Waiting on:` | 변경 전 literal assert 없음 | wp6 소유 Stop 회귀가 `Ready work phases: wp-live (Live)`, `Ready tasks: wp-live/ready (Ready task); wp-live/later (Later task)`, 두 helper 사유가 이어진 `Waiting on:`을 고정한다. wp7은 §4.6에서 인용하고 재실행한다. |
| `cxc loop show`의 락 경로·나이 label | 기존 literal assert 없음. wp7 P 실측: `rg -c writeLock test/`가 0건이다 — wp6은 이 회귀를 만들지 않았다 | **wp7이 직접 만든다.** 인수 대상이 없으므로 §4.7로 신설한다. 있는 것은 `goalplan-concurrency.test.ts:359`·`:373`의 helper 직접 호출뿐이고, §6이 금지한 바로 그 형태다 |

따라서 wp7 자체에는 기존 출력 assert 갱신 diff가 없다. 기존 `/blocked or superseded/` 갱신은 문자열을
바꾸는 wp4 소유다.

## 7. 검증 명령

### 7.1 문서 정합성

```bash
test -f devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md
test -f plugins/codexclaw/components/pabcd-state/test/fixtures/goalplans-pre-change-baseline.json
test "$(sed -n '1p' devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md)" = '# 070 — wp7: 회귀 확정'
test "$(rg -c 'assert\.deepEqual\(actual, snapshot\.manifest\);' \
  devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md)" = 1
! rg -n 'sourceCount\s*!==\s*(89|90)|sourceCount,\s*(89|90)|length,\s*(88|89|90)' \
  devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md
whitespace="$(git diff --no-index --check /dev/null \
  devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md 2>&1 || true)"
test -z "$whitespace"
```

기대 종료 코드는 모두 `0`이다. `git diff --no-index --check` 자체는 새 파일 diff 때문에 `1`을
반환하지만 command substitution 안에서 실행하며, 공백 진단이 없다는 `test -z`가 gate다.
`schemaVersion >= 3`은 허용되며 금지 regex에 넣지 않는다.

### 7.2 wp7 집중 테스트

```bash
node --test plugins/codexclaw/components/pabcd-state/test/goalplan-regression.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/hook.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/steering.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/review-binding.test.ts
```

기대: exit `0`, fail `0`. corpus 테스트는 체크인 manifest 항목의 변경 전후 normalized 결과 집합을
비교한다. 항목 개수나 parsed 개수를 코드에 박지 않는다. `orchestrate-cli.test.ts`는 같은 세션의 연속
두 cycle close 행, `steering.test.ts`는 batch의 모든 op 적용, `goalplan-public-surface.test.ts`는 plan
commit 뒤 ledger append 실패의 code `0`·경고와 T11의 `--slug` 양방향 고정을
검사한다. `help-verbs.test.ts`는 goalplan help 회귀를 갖고 있지 않으므로 이 목록에서 빼도 되지만,
`plan`/`scan` help 계약 회귀를 위해 남긴다. `hook-continuation.test.ts`는 mixed 상태의 ready 목록과 부분 대기 사유를 한 Stop reason에서
함께 검사한다.

### 7.3 저장소 게이트

```bash
npm run build
npm test
npm run gate
```

각 명령 기대 종료 코드는 `0`이다. build 마지막 출력은 `[codexclaw] build OK`를 포함하며 tracked
dist를 먼저 다시 만든다. 뒤따른 루트 `npm test`의 `dist-freshness.test.mjs`는 src와 tracked dist의
byte equality를 확인한다. root에는 typecheck script와 root `tsconfig.json`이 없으므로 인자 없는
`npx tsc --noEmit`을 성공 게이트로 쓰지 않는다.

`npm test`는 단독으로 돌린다. wp7이 더하는 `test()`는 10건이다 — §3.3이 3건, §4.1·§4.2가 각 1건,
§4.3·§4.4·§4.5·§4.7이 각 2건이고, §4.6은 wp6 소유 테스트의 재실행이라 0건이다. 그래서 기대 총계는
컴포넌트 `1087 + 10 = 1097`, 루트 `2262 + 10 = 2272`다. 총계가 줄었으면 통과 개수만 보고 넘기지 말고
계약서 §64의 C10 경쟁(`build.mjs`의 `rmSync(distDir)`가 다른 실행의 dist 독자를 죽인다)을 의심하고,
병렬 실행을 멈춘 뒤 단독으로 다시 돌린다.

컴포넌트 스위트는 `npm test`(= 인자 없는 `node --test`)가 아니라 루트와 같은 glob으로 돌린다.

```bash
cd plugins/codexclaw/components/pabcd-state && node --test 'test/*.test.ts'
```

인자 없는 `node --test`는 `test/fixtures/capture-goalplan-baseline.mjs`까지 실행 대상으로 줍는다. 그
생성기는 `process.argv[1]`이 자기 파일명으로 끝나면 `captureBaseline()`을 부르는데, `node --test`도
`argv[1]`을 그 파일로 채우므로 가드가 뚫린다. 그러면 컴포넌트 cwd에 없는 `.codexclaw/goalplans`를
`readdirSync`해 `ENOENT`로 죽는다. 실측: 컴포넌트에서 `npm test`는 `pass 1087 fail 1`, 같은 트리에서
`node --test 'test/*.test.ts'`는 `pass 1087 fail 0`이다. 루트 `npm test`는 `test/*.test.ts` glob이라
이 파일을 애초에 줍지 않는다.

이 결함은 wp2가 `d9259ca6`에서 들여왔고 wp7 범위가 아니다(§0: production source를 고치지 않으며 이
파일은 wp2 소유다). wp7은 게이트 명령을 정확히 적어 우회하고, 남은 처분은 §9 뒤 후속으로 넘긴다.

### 7.4 변경 범위

```bash
git status --porcelain -- \
  devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md
```

이번 P 문서 재작성의 기대 출력은 아래 한 줄뿐이다. 이 파일은 wp5에서 이미 tracked가 되었으므로
`??`가 아니라 수정 표시가 나온다.

```text
 M devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md
```

## 8. 롤백 경계

| 결함 위치 | 닫을 동작 | 남길 호환 바닥 |
| --- | --- | --- |
| wp2 스키마 | 새 v3 write | v3 parse와 `dependsOn`·`outcome` 보존 |
| wp3 무결성 | 새 정의·완료 사유 연결 | v3 reviver |
| wp4 선택 | 의존 인식 선택 | 필드 보존; v1/v2 oracle 결과 |
| wp5 직렬화 | 공통 lock 진입 | 자동 lock 회수 금지, v3 reviver |
| wp6 공개 표면 | 등록·조회·lifecycle mutation | read-only 조회와 v3 reviver |
| wp7 회귀 | 잘못 만든 test | wp2가 체크인한 변경 전 baseline JSON과 SHA256 |

v3 파일을 한 번 쓴 뒤 pre-v3 reviver로 완전 downgrade하지 않는다. `dependsOn`이나 `outcome`을
버리면 실행 순서나 완료 증거가 사라진다. ledger는 역사이며 권위 상태 복구본이 아니다.

## 9. 완료 조건

- [ ] 제목이 `# 070 — wp7: 회귀 확정`이다.
- [ ] legacy `criteria[].text` 호환과 이를 위한 wp2 backpatch 요구가 없다.
- [ ] fixture와 manifest 항목 수가 같고 `sourceCount`는 그 수를 보고만 한다.
- [ ] baseline은 wp2 산출물이며 wp7은 운영 plan에서 다시 만들지 않는다.
- [ ] fixture의 문자열은 enum allowlist 밖에서 scope-stable alias이고 privacy scan이 UUID·절대
  경로·40자 hex 잔존을 거부한다.
- [ ] manifest 항목들의 변경 후 normalized 결과 집합이 변경 전 `expected` 집합과 같다.
- [ ] v1/v2 무의존 plan의 세 공개 선택 결과가 test-local 변경 전 oracle과 같다.
- [ ] 선택 로직에 schema version 분기를 요구하지 않는다.
- [ ] outcome 무결성만 `schemaVersion >= 3` 경계를 쓴다.
- [ ] v1/v2 done task의 outcome 누락이 검증 실패를 만들지 않는다.
- [ ] 다섯 공개 RMW 경로 뒤 디스크 재독에서 `dependsOn`과 `outcome`이 같다.
- [ ] review-round open과 abort를 각 write 직후 따로 검사한다.
- [ ] mixed Stop 안내에 `Ready work phases: wp-live (Live)`,
  `Ready tasks: wp-live/ready (Ready task); wp-live/later (Later task)`,
  `Waiting on: task wp-live/blocked waits for task wp-live/later (pending); work-phase wp-blocked waits for work-phase wp-live (in_progress)`가 함께 나타난다.
- [ ] steering batch `[wp-a, wp-b dependsOn wp-a]`의 두 op가 모두 저장되고 summary가
  `2 op(s): add-work-phase, add-work-phase`다.
- [ ] 같은 session id의 연속 두 cycle이 `(c-test-epoch, wp-1)`과
  `(c-second-cycle, wp-2)` close 원장 행을 각각 남긴다.
- [ ] lifecycle ledger append 실패 뒤 task status는 `done`, outcome은
  `authoritative plan proof`, 종료 코드는 `0`, 출력에는
  `warning: goalplan state was committed, but ledger append failed:`가 있다.
- [ ] help의 읽기 verb 셋(`show`·`validate`·`ready`)에는 `--slug`가 남고, mutating verb
  셋(`steer`·`add-work-phase`·`add-criterion`)에는 `--slug`가 없다. 뒤 셋은 `doesNotMatch`로 고정한다.
- [ ] `cxc loop show`가 락 디렉터리 절대 경로와 나이를 표시하며 락 소멸 race를 정상화한다. §4.7이 신설하는 두 테스트가 렌더 경로를 검사하고, helper 직접 호출로 대체하지 않는다.
- [ ] 모든 테스트가 arrange, act, 구체 assert 본문을 갖는다.
- [ ] 루트 `dist-freshness.test.mjs`에서 tracked dist가 src와 byte-equal이다.
- [ ] 집중 테스트와 저장소 게이트가 모두 exit `0`이다.
- [ ] wp7이 더한 `test()`가 정확히 10건이고 컴포넌트 총계가 `1087 + 10 = 1097`, 루트 총계가
  `2262 + 10 = 2272`다.
- [ ] 컴포넌트 게이트를 `node --test 'test/*.test.ts'`로 돌린다. 인자 없는 `node --test`는 wp2 생성기를
  주워 `ENOENT`로 죽으므로 게이트로 쓰지 않는다(§7.3).
- [ ] wp5는 lock, wp6는 공개 표면으로만 서술된다.

DONE: 070_wp7_regression.md — W5 build 선행 게이트와 tracked dist byte equality 최종 조건을 닫음
