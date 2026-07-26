# 050 — 진전 인식 Stop 정체 판정

출처: `001` #9 (ADAPT / E2) · 의존: 없음 (기존 필드만 읽는다) · 상태: **DEFERRED (WP8)**

> ## WP8 종결: 설계 보존 후 정지
>
> A 감사 **5라운드**를 돌렸고 블로커가 5 → 3 → 3 → 2 → 2로 수렴하지 않았다. 마지막
> 두 라운드가 모두 High 2건이고, 같은 결함 계열(**metric 지문과 plateau 판정의 동치**)이
> 라운드 3·4·5 연속으로 재발했다. 기록된 종료 조건(사용자 결정 D2 — "같은 결함 계열이
> 2라운드 연속 재발하거나 blocker 수가 감소하지 않으면 슬라이스를 정지하고 설계 자산을
> 보존한 채 다음으로 넘어간다")에 정확히 해당한다. **구현하지 않고 닫는다.**
>
> ### 왜 수렴하지 않았나
>
> 슬라이스의 전제가 "Stop 정체 판정에 진전 신호를 하나 더 넣는다"인데, 이 저장소에는
> 이미 **두 번째 진전 판정기**가 있다 — `objectivePlateau`(`hook.ts:904-912`). 둘이
> 같은 데이터(`.codexclaw/metrics.jsonl`)를 다른 규칙으로 읽으면 반드시 어긋난다.
> 감사 라운드마다 어긋나는 지점이 하나씩 드러났고, 매번 지문을 plateau 쪽으로 좁혔지만
> 완전한 동치를 문자열 지문으로 달성하지 못했다.
>
> 마지막까지 남은 두 반례(라운드 5, 둘 다 유효):
>
> 1. **flat key 재방문.** `score=10,10` → `latency=1` → `score=10`이면 이전 key와
>    다르므로 "진전"이지만, 최신 `score` 창은 `[10,10]`이라 plateau는 flat이다.
>    key 변경을 무조건 진전으로 보면 안 되고, 창 길이가 1일 때(첫 기록)만 자동 진전이어야
>    한다. phase/work-phase 전환도 metric ledger가 flat인 채로 일어날 수 있으므로
>    "metric 동치" 주장 밖으로 명시해야 한다.
> 2. **delimiter 주입.** `cxc metric record --work-phase`는 값을 검증하지 않고
>    (`metric-cli.ts:82`), goalplan work-phase id도 임의 문자열이다(`goalplan.ts:113`).
>    `|`가 든 id는 파이프 구분 지문의 파싱을 깨고, 파싱 실패가 "이전 관측 없음 →
>    진전"으로 처리되므로 매 Stop이 count 1로 재시작한다. JSON 직렬화나 명시적
>    escaping이 필요하다.
>
> ### 재개할 때의 출발점
>
> 아래 설계는 라운드 5까지의 결론을 담고 있고 그대로 쓸 수 있다. 재개한다면 먼저
> **판정기를 두 개 두지 않는 쪽**을 검토할 것 — `objectivePlateau`가 이미 창 상승을
> 판정하므로, 별도 지문 대신 `bumpStopCounter`가 그 결과를 직접 소비하는 설계가
> 동치 문제를 원천적으로 없앤다. 다만 그건 호출 순서(`hook.ts:974` → `:975`)를
> 바꾸는 일이라 이 슬라이스보다 큰 변경이다.
>
> 위 두 반례는 재개 시 **반드시 회귀 테스트로 먼저 넣을 것.**
>
> 확정된 산출(재조사 불필요): `bumpStopCounter`는 `hook.ts:721-731`, 호출부는
> `:955`/`:974` 두 곳, 계획이 지목했던 `stop-continuation.test.ts`는 **없고** 실제
> 파일은 `hook-continuation.test.ts`, 좁은 타입체크 baseline은 exit 2 / `TS2352` 5건
> (`interview-ledger.ts:70`, `interview.ts:318-321`)이며 `hook.ts`/`state.ts` 자체는
> 0건, `hook.ts`의 raw `readGoalplan` 호출은 `:291`·`:673`·`:813`·`:846` 네 곳이다.
>
> **slug containment 결함은 이 슬라이스와 독립적으로 실재한다** —
> `readState`는 문자열 검사만 하고(`state.ts:146,151`) `goalplanDir`은 containment
> 없이 `join`한다(`goalplan.ts:90`). 별도 슬라이스로 다룰 값어치가 있다.

## 문제

Stop 정체 카운터는 **단계 전이**에서만 리셋된다. 현행 판정은 `state.stopBlockPhase ===
state.phase` 한 줄이 전부다 (`hook.ts:721-731`, WP8 P 실측 — 초안이 적은 `:708-730`에서
밀렸다).

```ts
const samePhase = state.stopBlockPhase === state.phase;
const nextCount = samePhase ? state.stopBlockCount + 1 : 1;
```

그래서 B 단계에서 여러 작업을 실제로 끝내며 진전하는 중에도 같은 단계에 머물면
`MAX_STOP_BLOCKS`(=3, `hook.ts:708`)를 소진해 루프가 해제된다. 정체 상한은 무한 루프
방지용인데, 정상 진전을 정체로 오판하는 것이 현재 동작이다. 이번 WP7만 해도 A 감사가
5라운드였고 그동안 단계는 A에 고정돼 있었다.

upstream은 ledger 라인 수 변화로 strike를 리셋한다
(`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/stop-resume-hook.ts:61-88`).

### WP8 P 실측: 호출부가 goalplan을 넘겨주지 않는다

| 사실 | 근거 |
| --- | --- |
| `bumpStopCounter(cwd, state)`는 인자가 둘뿐이다 | `hook.ts:721` |
| 호출부도 둘 — guard 2a(IDLE+goal)와 본 루프 | `hook.ts:955`, `hook.ts:974` |
| goalplan은 `state.slug`로만 찾을 수 있다 | `readGoalplan(cwd, slug)` — `goalplan.ts:162` |
| `slug`는 이미 state에 있다 | `state.ts:22` |
| `readGoalplan`은 절대 throw하지 않는다 (없으면 null) | `goalplan.ts:162-169` |

즉 **시그니처를 바꿀 필요가 없다.** `bumpStopCounter` 안에서 `state.slug`로 직접
`readGoalplan`을 부르면 된다. 초안이 우려한 "호출 순서 변경"은 불필요하다.

### 계획 앵커 정정 — 테스트 파일이 다르다

초안은 `test/stop-continuation.test.ts`를 지목했지만 **그런 파일은 없다.**
Stop 정체 테스트의 실제 위치는 `test/hook-continuation.test.ts`(675행)이고,
관련 케이스는 `:322`(guard-1 제거), `:443`(정체 상한), `:460`(단계 전이 리셋)이다.

### A 감사 1라운드 정정 — 진전 신호를 무엇으로 잡을 것인가

리뷰어가 초안 시그니처(`ledger 행 수 | goalplan.updatedAt | activeWorkPhaseId`)를
두 갈래로 반박했고, **둘 다 맞다.**

**(가) 같은 단계에서 그 세 값을 움직이는 런타임 생산자가 없다.** `writeGoalplan`과
`appendGoalplanLedger`의 호출자는 `goalplan init`(`goalplan-cli.ts:102`)과
**D-close**(`orchestrate-cli.ts:342,349,357`)뿐이다. `activeWorkPhaseId`도
`advanceWorkPhase`(`goalplan.ts:298`)에서만 바뀌고 그것 역시 D-close다. 즉 초안
시그니처는 **단계 전이에서만 변한다** — 지금 `stopBlockPhase` 비교와 사실상 동일하고,
슬라이스가 아무것도 하지 않는다.

**(나) `updatedAt`/행 수는 진전이 아니라 기록 행위를 센다.** `writeGoalplan`은 내용이
같아도 `updatedAt`을 새로 찍고(`goalplan.ts:171`), ledger append는 중복 검사가 없다
(`goalplan.ts:191`). 그러면 의미 없는 재저장을 반복하는 것만으로 `MAX_STOP_BLOCKS`가
영구 재충전되고, `hook.ts:914,925`가 명시한 **총 종료 보장이 사라진다.**

#### 실재하는 생산자: `cxc metric record`

같은 단계 안에서 진전을 기록하는 공개 명령이 이미 있다.

| 사실 | 근거 |
| --- | --- |
| `metric record/ingest/show/kind` 서브커맨드가 라우팅돼 있다 | `cli.ts:93-94`, `metric-cli.ts:17-27` |
| 각 기록은 `.codexclaw/metrics.jsonl`에 append되고 `best`를 누적한다 | `metrics.ts:115-132` |
| Stop이 **이미** 이 데이터를 읽는다 — plateau 판정 | `hook.ts:901-906`, `hook.ts:975` |
| plateau는 `workPhaseId`별로 최근 2건을 본다 | `metrics.ts:198-217` |

즉 "같은 단계에서 실제로 나아졌다"의 정답 신호는 **objective metric의 `best` 상승**이다.
이건 합성이 아니라 이미 배선된 경로이고, plateau 판정과 같은 데이터를 쓰므로
두 장치가 서로 모순되지 않는다.

#### 정정된 시그니처 — plateau와 같은 키 (A 라운드 2)

라운드 2 리뷰어가 bare `bestMetric`을 반박했고 맞다. `best`는 metric **이름별**로
누적되고(`metrics.ts:115-120`), plateau는 마지막 행의 `(metricName, workPhaseId)`
창을 본다(`metrics.ts:208-217`). 숫자 하나만 지문에 넣으면 `score=10` 다음
`latency=10`을 기록했을 때 지문은 그대로인데 plateau는 non-flat이 되어 **두 장치가
반대 판정을 낸다.**

#### 진전 판정은 "지문 비교"가 아니라 "최근 창 상승"이다

라운드 3까지는 지문 문자열 하나로 판정하려 했는데, 어떤 스칼라를 넣어도 plateau와
어긋난다. 라운드 4 반례가 결정적이다: 같은 키에서 `20 → 10 → 15`면 all-history max는
계속 20이라 지문이 안 움직이는데(정체 판정), plateau는 최근 창 `10 → 15`를 상승으로
본다(`metrics.ts:211-217`).

그래서 **plateau와 같은 관측을 공유한다.**

```
observation = {
  phase,
  activeWorkPhaseId,
  metricKey: `${metricName}/${metricWorkPhaseId}`,   // 최신 행 기준
  window: 그 키의 최근 PLATEAU_METRIC_RECORDS(=2)개 value,   // metrics.ts:210-211과 동일
}
```

판정 규칙 (`bumpStopCounter`):

| 조건 | 결과 |
| --- | --- |
| `phase` 또는 `activeWorkPhaseId`가 이전과 다름 | **진전** — count 1 |
| `metricKey`가 이전과 다름 (새 metric·새 work-phase의 첫 기록) | **진전** — count 1 |
| 같은 키, 최근 창이 **상승** (`max(window) > window[0]`) | **진전** — count 1 |
| 같은 키, 창이 flat이거나 하락 | **정체** — count + 1 |
| metric 기록 없음 (`metricKey === "-/-"`) | 위 두 줄 중 phase/workPhase 비교만 적용 |

상승 판정식 `max(window) > window[0]`은 `checkObjectivePlateau`의
`bestInWindow <= first + noiseFloor` (`noiseFloor = 0`, `hook.ts:710`)의 **정확한
부정**이다. 즉 plateau가 flat이라고 말하는 창에서는 정체 카운터가 오르고, non-flat인
창에서는 리셋된다 — 두 장치가 절대 반대 판정을 내지 않는다.

`20 → 10 → 15`: 창이 `[10, 15]`, `15 > 10`이므로 진전. plateau도 non-flat. 일치한다.
`10 → 10`: 창이 `[10, 10]`, 상승 아님 → 정체. plateau도 flat. 일치한다.

**저장된 `best` 필드는 쓰지 않는다.** `recordObjectiveMetric`은 `metricName`만으로
필터해 누적하므로(`metrics.ts:117-119`) work-phase가 다르면 값이 어긋난다.
**`recordCount`도 쓰지 않는다** — 같은 값 재기록으로 지문이 바뀌면 `bumpStopCounter`가
plateau보다 먼저 돌아(`hook.ts:974` → `:975`) 이미 예산을 재충전한 뒤다. 게다가
`objectivePlateau`는 `readObjectiveKind`가 `maximize`일 때만 동작하므로
(`hook.ts:906`) `satisfy` 세션에는 divergence 방어 자체가 없다.

#### 직렬화 형태

관측을 문자열로 굳혀 `stopProgressSignature`에 넣는다 — 창까지 포함해야 다음 Stop이
"직전 창"과 비교할 수 있다.

```
signature = `${phase}|${activeWorkPhaseId ?? "-"}|${metricKey}|${window.join(",")}`
```

비교는 문자열 동일성이 **아니다.** 역직렬화해서 위 표의 규칙을 적용한다.
metric 기록이 없으면 `-/-|` (빈 창)이다.

**goalplan done/met 카운트는 지문에서 뺀다 (라운드 2 Medium 1).** 그 값을 같은 단계에서
움직이는 공개 생산자가 없다 — `advanceWorkPhase`(`goalplan.ts:303`)는 D-close 전용이고
`goalplan-cli`는 `init/show/validate`뿐이다(`goalplan-cli.ts:28`). 없는 생산자를
전제한 지문 조각은 합성 fixture를 부를 뿐이다. `activeWorkPhaseId`는 남기는데, 그건
D-close에서 바뀌는 값이고 단계 전이 리셋과 같은 방향이라 모순이 없다.

#### 종료 보장: 독립 하드 캡

진전 리셋만 두면 상한이 이론적으로 무한 연장될 수 있다. 그래서 리셋과 무관한
**누적 카운터**를 함께 둔다.

```
MAX_STOP_BLOCKS = 3          # 기존, 정체 판정용 (진전 시 리셋)
MAX_STOP_BLOCKS_TOTAL = 24   # 신규, 세션당 누적 (절대 리셋 안 됨)
```

`stopBlockTotal`이 24를 넘으면 진전 여부와 무관하게 해제한다. 24는 슬라이스 8개분
(3×8) — 이번 goalplan의 work-phase 하나가 대략 그 규모다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/components/pabcd-state/src/state.ts` | `stopProgressSignature: string \| null` + `stopBlockTotal: number` 필드 (default·revive 양쪽) |
| `plugins/codexclaw/components/pabcd-state/src/hook.ts` | `bumpStopCounter` 로직 변경 (시그니처는 그대로 `(cwd, state)`) + `observeProgress`/`serializeObservation`/`parseObservation`/`isProgress` 신설 + `safeReadBoundGoalplan` 신설 후 raw `readGoalplan` 호출 **네 곳**(`:291` `activeWorkPhaseOpts`, `:673` D-close 전진, `:813` `readStopWorkContext`, `:846` `buildGoalIdleBlock`)을 전부 그것으로 교체 |
| `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts` | 케이스 추가 (**초안의 `stop-continuation.test.ts`는 존재하지 않는다**) |
| `plugins/codexclaw/components/pabcd-state/test/state.test.ts` | **필수** — `:27-45`가 persisted 객체를 deep-equal로 고정한다. 신규 필드 2개를 추가하지 않으면 `npm test`가 깨진다 (A 감사 블로커 3) |

## before → after

### 시그니처 정의

```
signature = `${phase}|${activeWorkPhaseId ?? "-"}|${metricKey}|${window.join(",")}`
```

모든 값이 이미 존재한다 — goalplan에도 metrics에도 새 필드를 만들지 않는다.
metric 기록이 없는 세션에서는 조각이 `-/-|`(빈 창)로 고정되므로 **현재 동작과 동일**해진다
(하위 호환).

**미결박·무기록 세션의 시그니처는 정확히 `${phase}|-|-/-|` 이다** — `phase`만
남기는 것이 아니라 나머지를 고정 상수로 채운다. 그래야 "첫 metric이 기록됐다"도
진전으로 잡힌다.

**slug 경로 안전 (블로커 5 + 라운드 2 Medium 2).** `readState`는 slug가 문자열인지만
본다(`state.ts:146,151`)고, `goalplanDir`은 containment 검사 없이 `join`한다
(`goalplan.ts:90`). 검증을 시그니처 계산에만 넣으면 같은 Stop 경로의 다른 reader가
그대로 뚫린다 — `readStopWorkContext:813`과 `buildGoalIdleBlock:846`이 raw slug로
`readGoalplan`을 부른다.

그래서 검증을 **한 곳에 모은다**:

```ts
// hook.ts
export function safeReadBoundGoalplan(cwd: string, slug: string): Goalplan | null {
  // 정규식만으로는 부족하다: "." 과 ".." 는 문자 클래스를 통과하지만 join() 이
  // goalplans/ 밖(.codexclaw/ 자체)으로 해석한다 (goalplan.ts:90, 라운드 3 Medium).
  if (slug === "." || slug === "..") return null;
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return null;   // traversal -> 파일을 읽지 않는다
  return readGoalplan(cwd, slug);
}
```

`hook.ts`의 **모든** goalplan reader가 이것을 쓴다 — `:291`(`activeWorkPhaseOpts`,
UserPromptSubmit 경로. 라운드 3에서 누락이 지적됐다), `:673`(D-close 전진),
`:813`(`readStopWorkContext`), `:846`(`buildGoalIdleBlock`), 그리고 신규 시그니처 계산.
`goalplan.ts`는 건드리지 않는다 — orchestrate-cli 등 다른 호출자의 계약을 바꾸지
않기 위해서다.

**`stopBlockPhase`는 삭제하지 않는다.** 기존 테스트가 그 값을 직접 단정하고
(`hook-continuation.test.ts:370`, `:469`) 상태 파일 호환도 걸려 있다. 시그니처와
병행 기록한다 — 판정만 시그니처로 바뀐다.

**카운트는 1부터 시작한다 (기존 규칙 보존).** 초안 pseudocode는 첫 관측을 0으로
시작해 `MAX_STOP_BLOCKS` 소진 시점을 한 번 늦췄다. 현행은 `nextCount = samePhase ?
count + 1 : 1`로 **첫 블록이 1**이고, `hook-continuation.test.ts:371`(`stopBlockCount === 1`)과
`:452`(`=== MAX_STOP_BLOCKS`)가 그것을 단정한다. 정정된 형태는 아래와 같다.

### `bumpStopCounter` 변경

before: `state.phase`가 이전과 같으면 `stopBlockCount++`, 다르면 0으로 리셋.

after:

```
const obs = observeProgress(cwd, state);                // safeReadBoundGoalplan + metrics 최근 창
const sig = serializeObservation(obs);
const prev = parseObservation(state.stopProgressSignature);   // null이면 진전으로 간주
const stalled = !isProgress(prev, obs);                 // 위 판정표
const nextCount = stalled ? state.stopBlockCount + 1 : 1;   // 진전이면 1로 재시작
const nextTotal = state.stopBlockTotal + 1;
// 독립 하드 캡: 진전 리셋과 무관하게 세션당 누적 상한을 지킨다.
if (nextCount > MAX_STOP_BLOCKS || nextTotal > MAX_STOP_BLOCKS_TOTAL) {
  writeState(cwd, { ...state, stopBlockPhase: null, stopBlockCount: 0, stopProgressSignature: null, stopBlockTotal: nextTotal });
  return "release";
}
writeState(cwd, { ...state, stopBlockPhase: state.phase, stopBlockCount: nextCount, stopProgressSignature: sig, stopBlockTotal: nextTotal });
return nextCount;
```

`stopBlockTotal`은 **어떤 경로에서도 감소하지 않는다** — 해제 시에도 누적값을 남긴다.
이것이 총 종료 보장의 근거다 (`hook.ts:914,925`의 계약 유지).

`computeProgressSignature`는 **fail-open**이다. `readGoalplan`이 null이거나 ledger를
읽지 못하면 그 조각을 `-`/`0`으로 채우고 절대 throw하지 않는다 — Stop 훅에서 예외가
나면 루프 전체가 죽는다.

### 보존해야 하는 기존 규칙 (전부 그대로)

- 활성 goal 없음 → 해제.
- 단계 `I` → 항상 해제.
- 컨텍스트 압력 → 해제.
- `MAX_STOP_BLOCKS` 도달 → 해제 (상한 자체는 유지, 성공 신호가 아님).
- goal/work-phase id는 상태 경로 도출 전에 검증한다 (경로 주입 방지).

`stop-checking-ulw-loop-resume.json` 같은 **두 번째 Stop 훅은 추가하지 않는다.**

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E2** (런타임 Stop 훅) |
| 실행 주체 | Codex가 Stop 이벤트마다 호출하는 `stop-checking-pabcd-continuation.json` → `pabcd-state/dist/cli.js hook stop` |
| 알려진 우회 | 훅을 끄거나 플러그인을 제거하면 판정 자체가 사라진다. 또한 이것은 **차단이 아니라 연장**이다 — 진전 오판을 줄일 뿐, 에이전트가 멈추기로 하면 멈춘다 |
| 잔여 위험 | 시그니처 값이 모두 그대로인 실제 진전(코드만 고치고 metric도 criterion도 안 건드린 경우)은 여전히 정체로 잡힌다. 상한이 3이므로 최악의 경우 기존과 동일하게 해제된다. 반대로 metric을 의도적으로 올려 예산을 늘릴 수도 있는데, `MAX_STOP_BLOCKS_TOTAL`이 그 상한이다 |
| 표현 강등 | "정체 오판을 없앤다"가 아니라 **"ledger/goalplan에 기록된 진전에 한해 예산을 재충전한다"**로 적는다 |
| 최종 강제층 | 없음 (`final layer: none`) — 이 슬라이스는 강제 장치가 아니라 기존 상한의 오탐을 줄이는 완화다 |

## PLAN-FIELD-CHAIN-01

신규 필드는 둘이다.

**`State.stopProgressSignature: string | null`**

| 단계 | 경로 |
| --- | --- |
| 생성 | `observeProgress(cwd, state)` — `hook.ts` 신규. 입력은 `state.phase`, `safeReadBoundGoalplan()`의 `activeWorkPhaseId`, `readObjectiveMetrics(cwd, state.sessionId)` 최신 행의 `(metricName, workPhaseId)` 키와 **그 키의 최근 `PLATEAU_METRIC_RECORDS`개 value 창** |
| 직렬화 | `serializeObservation(obs)` → `writeState`가 세션 JSON에 문자열로 기록 (`state.ts`) |
| 역직렬화 | `readState` revive는 문자열/`null`만 판정. 의미 파싱은 `parseObservation()`이 하고, 파싱 실패나 `null`이면 "이전 관측 없음"으로 다뤄 첫 Stop이 진전(카운트 1)이 된다 — 구버전 상태 파일도 이 경로로 안전하게 흡수된다 |
| 소비 | `isProgress(prev, obs)` 한 곳 → `bumpStopCounter`의 `stalled` 분기. **문자열 동일성 비교가 아니다** — 창 상승 규칙을 적용한다 |

**`State.stopBlockTotal: number`**

| 단계 | 경로 |
| --- | --- |
| 생성 | `bumpStopCounter` 내부 `state.stopBlockTotal + 1` |
| 직렬화 | `writeState` — 해제 경로에서도 기록한다 (감소 없음) |
| 역직렬화 | `readState` revive — 유한한 0 이상 숫자가 아니면 `0`. `stopBlockCount`의 기존 revive(`state.ts:177-180`)와 같은 형태 |
| 소비 | `bumpStopCounter`의 하드 캡 비교 한 곳 |

`defaultState`(`state.ts:79-92`)에 둘 다 추가한다 — 그래야 `state.test.ts:27-45`의
deep-equal 계약이 명시적으로 갱신된다.

## 테스트 (accept criteria)

전부 `test/hook-continuation.test.ts`에 추가한다. 기대값은 하드코딩하고 DUT 출력에서
파생시키지 않는다 (`TEST-ORACLE-INDEPENDENCE-01`).

| # | 시나리오 | 기대 | 검증 |
| --- | --- | --- | --- |
| S1 | 같은 단계, goalplan 없음, 3회 Stop | `stopBlockCount` 1 → 2 → 3, 4번째 호출이 `""`(해제) | 자동 |
| S2 | 같은 단계, 2회 Stop 사이에 **공개 CLI** `runMetricCli(["record","--session",id,"--name","score","--value","1"])` → `--value 2` | 두 번째도 `stopBlockCount === 1` (best 상승 = 진전) | 자동 (activation) |
| S2b | metric **이름이 바뀜** (`score=10` → `latency=10`) | `stopBlockCount === 1` — 지문이 metricName을 포함하므로 plateau와 같은 판정 (라운드 2 High) | 자동 |
| S2c | 같은 이름, `--work-phase`만 다름 | `stopBlockCount === 1` — 지문이 workPhaseId도 포함 | 자동 |
| S2d | `--session` 누락 | CLI가 exit 1 (`metric-cli.ts:76`) — 상태가 변하지 않으므로 다음 Stop은 `stopBlockCount === 2` | 자동 |
| S4 | 같은 단계, 사이에 goalplan을 **내용 변화 없이 재저장**(`updatedAt`만 갱신) | `stopBlockCount === 2` — **진전이 아니다** (블로커 2 회귀 방지) | 자동 |
| S4b | 같은 단계, 같은 키에 같은 값을 재기록 | `stopBlockCount === 2` — 지문이 불변이므로 진전이 아니다. `recordCount`를 뺐기 때문에 성립한다 (라운드 3 High 1) | 자동 |
| S4c | `wp-a`에서 `score=100` → `wp-b`에서 `score=10` → `wp-b`에서 `score=20` | 마지막 Stop이 `stopBlockCount === 1`. 저장된 `best`(=100)를 썼다면 실패한다 (라운드 3 High 2) | 자동 |
| S4d | 같은 키에서 `20 → 10 → 15` | 마지막 Stop이 `stopBlockCount === 1`. all-history max(=20)를 썼다면 실패한다 (라운드 4 High) | 자동 |
| S4e | 같은 키에서 `20 → 15 → 10` (하락) | `stopBlockCount`가 증가한다 — 하락은 진전이 아니다 | 자동 |
| S4f | **plateau 동치** — S4b/S4d/S4e 각 시점에 `checkObjectivePlateau`를 직접 불러 `flat` 값과 `isProgress` 결과가 **항상 반대**임을 단정 | 모든 케이스에서 `flat === !isProgress` | 자동 |
| S5 | 단계 전이(B→C) | 기존 케이스 `:460`이 **무수정** 통과 | 자동 (회귀) |
| S7 | `MAX_STOP_BLOCKS` 도달 후 해제 시 | `stopProgressSignature`도 `null`로 리셋 | 자동 |
| S8 | 기존 Stop 케이스 전부 | `hook-continuation.test.ts` 무수정 통과 — `:322`, `:371`, `:443`, `:469` | 자동 (회귀) |
| S9 | 구버전 상태 파일(신규 필드 없음) | revive가 `null`/`0`, 첫 Stop이 count 1 | 자동 |
| S10 | **하드 캡** — metric을 매번 올려 진전을 위조하며 Stop 반복 | `MAX_STOP_BLOCKS_TOTAL` 초과 시 해제. 무한 재충전 불가 (블로커 2) | 자동 |
| S11 | slug traversal (`"../../evil"`) — 그 위치에 **유효한 goalplan fixture**를 실제로 놓는다 | 시그니처가 미결박 형태로 축약되고, **`buildGoalIdleBlock` 출력에도 그 goalplan 내용이 유입되지 않는다** (`safeReadBoundGoalplan` 중앙화 확인, 라운드 2 Medium 2) | 자동 |
| S11c | `slug: ".."` + `.codexclaw/goalplan.json`에 유효 fixture | 읽히지 않는다. 정규식만으로는 통과하는 케이스라 별도 단정 (라운드 3 Medium) | 자동 |
| S11d | `slug: ".."`로 UserPromptSubmit B-directive | `activeWorkPhaseOpts`(`hook.ts:291`)도 그 fixture를 읽지 않는다 | 자동 |
| S11b | 정상 slug | `readStopWorkContext`/`buildGoalIdleBlock`의 기존 enrichment가 그대로 동작 | 자동 (회귀) |
| S12 | `state.test.ts` default deep-equal | 신규 필드 2개 포함해 갱신, round-trip 일치 (블로커 3) | 자동 |

**호출 순서 주의:** `bumpStopCounter`는 plateau 검사보다 먼저 돈다(`hook.ts:974` →
`:975`). 그래서 "plateau가 나중에 막아줄 것"에 기대는 지문 조각을 넣으면 안 된다 —
그 시점엔 이미 예산이 재충전된 뒤다. `recordCount`를 뺀 이유가 이것이고, S4b가 그
계약을 고정한다.

**S3(criterion/task 카운트)는 삭제했다** — 지문에서 뺐으므로 검증 대상이 아니다.

**S6은 S1과 중복이라 삭제했다** (둘 다 미결박 세션). `activeWorkPhaseId`는 시그니처
문자열에만 쓰고 경로로 만들지 않으므로 그쪽 traversal 케이스는 없다 — 실제 경로 입력은
`slug`이고 그건 S11이 덮는다.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 exit 0, 1,243 pass. 사슬: `package.json:24` glob이
  `components/pabcd-state/test/*.ts`를 포함한다. → **이 슬라이스를 관측하는 주 검증기.**
- 좁은 타입체크 — **baseline-aware**다 (A 감사 블로커 4). 이 명령은 지금도 exit 2다:

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext \
    plugins/codexclaw/components/pabcd-state/src/hook.ts \
    plugins/codexclaw/components/pabcd-state/src/state.ts
  ```

  **변경 전 baseline 실측(WP8 A 라운드 1, 실제 RUN):** exit 2, `error TS` **5건**.
  전부 이 슬라이스가 손대지 않는 파일의 기존 `TS2352`다 —
  `interview-ledger.ts:70`, `interview.ts:318`, `:319`, `:320`, `:321`.
  `hook.ts`/`state.ts` 자체 오류는 **0건**이다.

  수용 조건은 exit 0이 아니라 **"오류 5건 그대로, 신규 0건"**이다. 비교는
  `... 2>&1 | grep 'error TS' | sed 's/:.*error/ error/' | sort -u` 출력이 위 5줄과
  일치하는지로 한다. 인자 없는 `npx tsc --noEmit`은 **적지 않는다**
  (root `tsconfig.json` 없음).
- `npm run build` — dist 재생성이 필요하다 (`hook.js`, `state.js`). → 관측한다.
- `npm run gate` — 이 슬라이스를 **관측하지 않는다**. `walkSkillMds`는 `SKILL.md`만 읽고
  이 변경은 컴포넌트 소스다. 비관측 baseline 회귀 확인용.

## 범위 밖

- local-plan-only Stop 무장 (활성 native goal 요구를 유지).
- stuck 마커 파일 — 기존 상한 해제로 충분.
