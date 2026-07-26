# 050 — 진전 인식 Stop 정체 판정

출처: `001` #9 (ADAPT / E2) · 의존: 없음 (기존 필드만 읽는다) · 상태: **RESUMED (WP19)**

> ## WP19 재개 (2026-07-26)
>
> WP8에서 5라운드 미수렴으로 defer했다. 그때 남은 것은 **설계 결함이 아니라 두 개의
> 구체적 반례**였고, 아래 "재개할 때의 출발점"이 그것을 회귀 테스트로 먼저 넣으라고
> 지시한다. 그 지시를 따른다.
>
> defer 이후 이 유닛의 후속 슬라이스들이 두 반례를 푸는 재료를 만들었다:
>
> | 반례 | 해결 재료 |
> | --- | --- |
> | flat key 재방문 (`score=10,10` → `latency=1` → `score=10`) | `checkObjectivePlateau`(`metrics.ts:198-217`)가 이미 `(metricName, workPhaseId)` 창을 계산한다. **그 함수를 직접 호출**하면 지문을 따로 만들 필요가 없다 |
> | delimiter 주입 (`\|`가 든 work-phase id) | `090`이 `JSON.stringify` 직렬화 패턴을 세웠다. 파이프 구분 문자열을 쓰지 않는다 |
>
> **핵심 설계 변경 (WP19):** 별도 지문을 만들어 plateau와 동치를 맞추려던 것이
> 5라운드 내내 실패한 원인이었다. 두 판정기를 두지 않는다 —
> `bumpStopCounter`가 **`checkObjectivePlateau`의 결과를 직접 소비**한다.
> 그러면 동치 문제가 정의상 사라진다. WP8의 마지막 메모가 가리킨 방향이 이것이다.

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

#### WP19 최종 설계 — 이벤트 커서 + plateau 판정

WP8의 다섯 라운드는 전부 "지문을 어떻게 만들어야 plateau와 어긋나지 않는가"를 풀려다
실패했다. WP19 첫 시도는 지문을 버리고 `!checkObjectivePlateau(...).flat`을 그대로 진전
판정으로 썼는데, 리뷰어가 **그것도 같은 계열의 오류**임을 보였다:

> `flat`은 **상태**이지 **이벤트**가 아니다. `[1,2]` 창은 다음 기록이 올 때까지 매 Stop마다
> `flat: false`다. 한 번의 기록이 최대 24회의 재충전 권한이 된다.
> 기록이 아예 없으면 `{flat:false}`라 `S1`(metric 없음 → count 1→2→3)이 성립조차 않는다.

정확한 지적이다. 진전 판정에는 **두 가지가 다 필요하다**:

| 질문 | 답하는 것 |
| --- | --- |
| 직전 Stop 이후 **새 관측이 있었나** | 이벤트 커서 (신규) |
| 그 관측이 **나아진 것인가** | `checkObjectivePlateau` (기존) |

둘 중 하나만으로는 안 된다. 커서만 보면 같은 값 반복 기록이 진전이 되고, plateau만 보면
위의 재충전 문제가 생긴다.

**이벤트 커서: metrics ledger의 행 수.** `.codexclaw/metrics.jsonl`은 append-only이고
(`metrics.ts:130-132`가 `appendFileSync`만 한다), `readObjectiveMetrics(cwd, sessionId)`가
그 세션의 행을 순서대로 준다. 그 **개수**가 단조 증가하는 커서다. 새 필드를 만들 필요도,
타임스탬프를 믿을 필요도 없다.

```
const rows = readObjectiveMetrics(cwd, state.sessionId);
const observedNew = rows.length > state.stopMetricCursor;
const improved = observedNew && !checkObjectivePlateau(cwd, state.sessionId, PLATEAU_OPTS).flat;

progressed =
     phase !== stopBlockPhase                    // 단계 전이 (기존 동작)
  || activeWorkPhaseId !== stopBlockWorkPhaseId  // work-phase 전환
  || improved;                                   // 새 관측이 있었고, 그것이 나아졌다
```

`stopMetricCursor`는 매 Stop마다 갱신한다 — block이든 release든. 단
**high-water mark**로 올린다 (A 감사 3라운드):

```
metricCursor = Math.max(state.stopMetricCursor, rows.length)
```

`rows`는 파일의 물리 행 수가 아니라 **유효 JSON이면서 이 세션인 행**의 수다
(`metrics.ts:74-112`, malformed 행은 의도적으로 무시된다 `:103-105`).
그래서 ledger가 손으로 잘리면 `rows.length`가 커서보다 작아질 수 있다.

그 시점은 `observedNew`가 `false`라 정체로 처리되어 안전하다. 문제는 **그 다음**이다 —
커서를 작은 값으로 낮추면, 잘린 행이 복구됐을 때 같은 관측이 다시 새 관측으로 세어진다.
`[1,2]`가 non-flat이므로 새 기록 없이 재충전되는 것이다. high-water는 그 재생을 막는다:
영구히 잘린 뒤에는 **이전 최고치를 넘길 때까지** 진전을 인식하지 않는다.

`improved`가 `observedNew`를 앞에 두는 것이 핵심이다. 기록이 없으면
`rows.length === 0 === cursor`라 `observedNew`가 `false`이고, `checkObjectivePlateau`가
반환하는 `{flat:false}`가 진전으로 새지 않는다 — `S1`이 성립한다.

**`PLATEAU_OPTS`는 상수를 공유한다.** 리뷰어 지적대로 계획에 `2/0`을 리터럴로 적으면
`objectivePlateau` 래퍼(`hook.ts:904-907`)와 우연히 같을 뿐이다.
`PLATEAU_METRIC_RECORDS`/`PLATEAU_NOISE_FLOOR`(`hook.ts:709-710`)를 그대로 쓴다.

`objectivePlateau` 래퍼 자체는 쓰지 않는다 — `readObjectiveKind`가 `maximize`일 때만
동작하는 divergence 전용 게이트라, `satisfy` 세션의 metric 진전을 못 본다.

두 반례는 이 설계에서도 그대로 풀린다 (리뷰어가 확인):

| 반례 | 결과 |
| --- | --- |
| `score=10,10` → `latency=1` → `score=10` | 최신 행이 `score`이므로 창이 `[10,10]`, flat → 진전 아님 |
| `\|`가 든 work-phase id | metric 행은 JSON, work-phase는 값 비교. 파이프를 조립·파싱하는 경로가 없다 |

#### 종료 보장: 독립 하드 캡 (WP8에서 확정, 그대로)

진전 리셋만 두면 상한이 이론적으로 무한 연장된다. 그래서 리셋과 무관한 누적 카운터를
함께 둔다.

```
MAX_STOP_BLOCKS = 3          # 기존, 정체 판정용 (진전 시 리셋)
MAX_STOP_BLOCKS_TOTAL = 24   # 신규, 세션당 누적 (절대 리셋 안 됨)
```

`stopBlockTotal`이 24를 넘으면 진전 여부와 무관하게 해제한다. **어떤 경로에서도
감소하지 않는다** — 해제 시에도 누적값을 남긴다. 이것이 총 종료 보장의 근거다
(`hook.ts:914,925`의 계약 유지).

### `bumpStopCounter` 변경

before: `state.stopBlockPhase`가 이전과 같으면 `stopBlockCount++`, 다르면 1.

after:

```
const obs = observeProgress(cwd, state);      // { progressed, metricCursor, workPhaseId }
const nextCount = obs.progressed ? 1 : state.stopBlockCount + 1;
const nextTotal = state.stopBlockTotal + 1;
// The cursor advances on EVERY Stop, block or release: an observation counts as
// progress exactly once.
const carry = { stopMetricCursor: obs.metricCursor, stopBlockTotal: nextTotal };  // high-water
if (nextCount > MAX_STOP_BLOCKS || nextTotal > MAX_STOP_BLOCKS_TOTAL) {
  writeState(cwd, { ...state, ...carry, stopBlockPhase: null,
                    stopBlockWorkPhaseId: null, stopBlockCount: 0 });
  return "release";
}
writeState(cwd, { ...state, ...carry, stopBlockPhase: state.phase,
                  stopBlockWorkPhaseId: obs.workPhaseId, stopBlockCount: nextCount });
return nextCount;
```

`observeProgress`는 **fail-open**이다. goalplan을 못 읽거나 metrics가 없으면 그 항을
`false`(진전 아님)로 두고 절대 throw하지 않는다 — Stop 훅에서 예외가 나면 루프가 죽는다.

`slug` 경로 안전은 `090`이 만든 규칙을 따른다: `readGoalplan` 호출 전에
`/^[A-Za-z0-9._-]+$/` 검사 + `.`/`..` 명시 거부.

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

신규 필드는 셋이다. **`stopProgressSignature`는 만들지 않는다** — 지문 자체를 폐기했다.

**`State.stopMetricCursor: number`** (A 감사 2라운드에서 추가)

| 단계 | 경로 |
| --- | --- |
| 생성 | `observeProgress`가 `Math.max(state.stopMetricCursor, readObjectiveMetrics(cwd, state.sessionId).length)` — **high-water mark**. 정상 경로에서는 `appendFileSync`(`metrics.ts:130-132`)라 행 수가 단조 증가하지만, 손으로 자른 뒤 복구하면 같은 관측이 재생될 수 있어 커서는 내려가지 않는다 |
| 직렬화 | `writeState` — **block/release 양쪽 경로에서 반드시 기록** |
| 역직렬화 | `readState` revive — 유한한 0 이상이 아니면 `0` |
| 소비 | `observedNew = rows.length > cursor` 한 곳 |

이것이 "상태"와 "이벤트"를 가르는 필드다. 커서 없이 `flat`만 보면 하나의 관측이
매 Stop마다 진전으로 다시 세어진다.

**`State.stopBlockWorkPhaseId: string | null`**

| 단계 | 경로 |
| --- | --- |
| 생성 | `safeReadBoundGoalplan(cwd, state.slug)`의 `effectiveActiveWorkPhaseId` |
| 직렬화 | `writeState` — 문자열 그대로, 조립하지 않는다 |
| 역직렬화 | `readState` revive — 문자열이 아니면 `null` |
| 소비 | 진전 판정의 두 번째 항 (값 비교 한 곳) |

**`State.stopBlockTotal: number`**

| 단계 | 경로 |
| --- | --- |
| 생성 | `bumpStopCounter` 내부 `+1` |
| 직렬화 | `writeState` — 해제 경로에서도 기록 (감소 없음) |
| 역직렬화 | `readState` revive — 유한한 0 이상이 아니면 `0` |
| 소비 | 하드 캡 비교 한 곳 |

`checkObjectivePlateau`의 결과는 저장하지 않는다 — 매 Stop마다 다시 계산한다.
저장하면 그 값이 plateau와 어긋날 수 있고, 그것이 WP8을 다섯 라운드 붙잡은 문제다.

## 테스트 (accept criteria)

전부 `test/hook-continuation.test.ts`에 추가한다 (WP8 실측: 초안이 지목한
`stop-continuation.test.ts`는 존재하지 않는다). 기대값은 하드코딩하고 DUT 출력에서
파생시키지 않는다.

### 재개 조건 — 두 반례를 먼저 넣는다

WP8이 defer하며 "재개 시 반드시 회귀 테스트로 먼저 넣을 것"이라고 명시한 둘이다.

| # | 반례 | 기대 |
| --- | --- | --- |
| **X1** | flat key 재방문: `score=10` → `score=10` → `latency=1` → `score=10` 기록 후 Stop | **정체로 판정** (`stopBlockCount` 증가). 최신 `score` 창이 `[10,10]`이라 `checkObjectivePlateau`가 flat이다. key가 바뀌었다는 이유로 리셋되면 실패 |
| **X2** | `\|`가 든 work-phase id (`wp\|evil`)로 metric 기록 후 Stop 2회 | 정상 동작. 문자열 조립을 하지 않으므로 파싱이 깨질 자리가 없다. 첫 Stop count 1, 둘째 2 |

### 본 케이스

| # | 시나리오 | 기대 |
| --- | --- | --- |
| S1 | 같은 단계, metric 없음, 3회 Stop | count 1 → 2 → 3, 4번째가 `""`. 기록이 없으면 `observedNew`가 `false`라 `{flat:false}`가 진전으로 새지 않는다 (A 감사 2라운드 High 1) |
| S2 | 같은 단계, 사이에 `runMetricCli(["record","--session",id,"--name","score","--value","1"])` → `--value 2` | 두 번째도 count 1 (새 관측 + 창 `[1,2]` 상승) |
| **S2c** | S2 직후 **새 기록 없이** Stop 2회 더 | count **2, 3** — 하나의 관측은 한 번만 진전이다 (A 감사 2라운드 High 2) |
| S2b | 같은 값 재기록 (`1` → `1`) | count 2 (새 관측은 있으나 창 `[1,1]`이 flat) |
| S3 | metric 이름 전환 후 그 키의 첫 기록 | count 1 — 새 관측 + 창 길이 1은 non-flat |
| **S3b** | S3 직후 **새 기록 없이** Stop | count **2** — 첫 기록도 재충전 권한이 아니다 |
| S4 | goalplan을 내용 변화 없이 재저장 | count 2 — `updatedAt`을 보지 않는다 |
| S5 | 단계 전이(B→C) | 기존 케이스 `:460` 무수정 통과 |
| S6 | `activeWorkPhaseId` 전환 | count 1 |
| S7 | `MAX_STOP_BLOCKS` 도달 해제 시 | `stopBlockWorkPhaseId`도 `null`로 리셋 |
| S8 | 기존 Stop 케이스 전부 | `hook-continuation.test.ts` 무수정 통과 (`:322`, `:371`, `:443`, `:469`) |
| S9 | 구버전 상태 파일 (신규 필드 없음) | revive가 `null`/`0`, 첫 Stop이 count 1 |
| S10 | **하드 캡** — metric을 매번 올려 진전을 위조하며 Stop 반복 | `MAX_STOP_BLOCKS_TOTAL` 초과 시 해제 |
| S11 | slug traversal (`"../../evil"`) | goalplan을 읽지 않고, 예외 없음 |
| S12 | `state.test.ts` default deep-equal | **신규 필드 3개** 포함해 갱신 (`stopMetricCursor`, `stopBlockWorkPhaseId`, `stopBlockTotal`) + 구버전 revive가 `0`/`null`인지 |
| **S15** | ledger를 잘라 `rows.length < cursor`로 만든 뒤 Stop | 정체 판정, 커서는 **내려가지 않는다** |
| **S15b** | S15 뒤 잘린 행을 복구하고 Stop | 여전히 정체 — 이전 최고치를 넘기지 않았으므로 과거 관측이 재생되지 않는다 (A 감사 3라운드) |
| S13 | **plateau 동치** — 새 관측이 있는 시점(S2/S2b/X1)에서 `flat === !progressed` | 일치. 같은 함수를 쓰므로 정의상 참이지만 회귀로 고정한다. **새 관측이 없는 시점(S2c/S3b)은 대상이 아니다** — 그때는 커서가 판정하지 plateau가 판정하지 않는다 |
| S14 | `stopMetricCursor`가 release 경로에서도 갱신됨 | 캡 초과로 해제된 뒤에도 커서가 `rows.length`와 같다 |

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 (WP19 A 감사 2라운드) exit 0, **1,405 pass**. 사슬: `package.json:24` glob이
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
