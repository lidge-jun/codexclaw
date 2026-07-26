# 090 — steering 트랜잭션 기반

출처: `001` #12 전반부 (ADAPT / E8) · 의존: 없음 (`steeringLog`/ledger 이벤트만 추가 — 3라운드 감사에서 가짜 `090→010` 의존 제거) · 상태: PLANNED

## 문제

`plugins/codexclaw/skills/loop/SKILL.md:196-208`은 steering 결정을 근거와 함께 기록하고
완료 기준을 약화시키는 steering을 거부한다고 약속한다. 그런데 shipped 상태에는 그 기능이 없다 —
ledger는 6개 lifecycle 이벤트만 지원하고 steering 상태가 아예 없다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:156`).

즉 스킬이 약속한 것과 코드가 하는 것이 다르다. 이는 codexclaw이 스스로 금지한
false-enforcement 산문에 해당한다.

**이 슬라이스만으로는 그 간극이 닫히지 않는다 (A 감사 1).** 산문은 두 가지를
약속하는데(`loop/SKILL.md:206-207`), 이 슬라이스가 실현하는 것은 **앞의 하나뿐**이다:

| 산문의 약속 | 상태 |
| --- | --- |
| "steering 결정을 근거와 함께 기록한다" | 이 슬라이스가 실현 (`steeringLog` + `steered` ledger) |
| "완료 기준을 약화시키는 steering을 거부한다" | **`091` 전까지 여전히 미구현** — 이 슬라이스는 `annotate`만 지원하므로 거부할 대상 자체가 없다 |

따라서 이 슬라이스를 "false-enforcement 해소"라고 적지 않는다. 절반이다.

이 슬라이스는 **트랜잭션 기반만** 만든다. mutation 종류별 검증 규칙은 `091`이다.
`001` A6를 두 사이클로 나눈 이유는 리뷰어 블로커 7 — 하나의 사이클에 CLI·lock·ledger·
여러 mutation class·criterion 편집·prompt 안내를 다 넣는 것은 한 PABCD 단위가 아니다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/components/pabcd-state/src/steering.ts` | 신규 — 트랜잭션 엔진 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | ledger 이벤트 타입 + `steeringLog` |
| `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts` | `steer` 서브버브 파싱 + 실행 (기존 `loop` CLI 소유자) |
| `plugins/codexclaw/components/pabcd-state/src/cli.ts` | 없음 — `loop`/`goalplan` 분기(`plugins/codexclaw/components/pabcd-state/src/cli.ts:101-112`)가 이미 `parseGoalplanCliArgs`/`runGoalplanCli`로 위임하므로 배선 변경 불필요 |
| `plugins/codexclaw/bin/cxc.mjs` | help 텍스트에 `loop steer` 추가 |
| `plugins/codexclaw/components/pabcd-state/test/steering.test.ts` | 신규 |

**소유자 정정 (재감사 7):** 초기 초안은 신규 `loop-cli.ts`를 만들려 했으나, 실제
`loop` 명령은 `plugins/codexclaw/components/pabcd-state/src/cli.ts:101-112`가
`goalplan-cli.ts`로 위임한다. 새 파일을 만들지 않고 기존 소유자를 확장한다.

## before → after

### 트랜잭션 계약

```
cxc loop steer --session <id> --batch-json <path-or-json>
```

`--session`은 **canonical이어야 한다** (A 감사 1 — Medium 1). `state.ts:75`의
`isCanonicalSessionId`를 그대로 쓴다 — 이미 존재하는 함수다. 검증 없이 받으면
`a/b`가 sanitize돼 `a-b` 세션의 계획을 steering한다. 쓰기 명령이 alias를 따라 다른
목표를 고치는 것은 조용한 데이터 손상이므로 거부한다.

배치 형태:

```json
{
  "idempotencyKey": "<caller-stable>",
  "rationale": "왜 이 조정이 필요한가",
  "evidence": "근거 (파일 경로 / 명령 출력 / ledger 위치)",
  "ops": [ { "kind": "...", "...": "..." } ]
}
```

엔진 규칙 (이 슬라이스의 핵심):

1. **전부-또는-무 — 단 범위는 `goalplan.json` 한 파일이다.** 계획을 복제해 배치 전체를
   적용해 본 뒤, 모든 op이 유효할 때만 실제 파일에 한 번 쓴다. op 하나가 무효면
   배치 전체를 거부한다.

   **ledger는 이 트랜잭션에 들어가지 않는다 (A 감사 1 — High 1).** `writeGoalplan`은
   tmp+rename이고(`goalplan.ts:366-380`), `appendGoalplanLedger`는 별도 append다
   (`:386-392`). 두 파일을 한 번에 커밋할 수단이 없으므로, 있는 척하지 않고 순서와
   실패 정책을 못 박는다:

   ```
   1. goalplan.json 쓰기 (steeringLog 포함)   ← 여기가 커밋 지점
   2. ledger에 steered append
   ```

   2번이 실패하면 **전체를 실패로 보고하지 않는다** — 1번은 이미 커밋됐고 되돌리면
   더 나쁜 상태(부분 롤백)가 된다. 대신 **경고와 함께 성공**을 반환하고, 메시지에
   "감사 항목이 누락됐다"와 ledger 경로를 적는다. 재실행은 idempotency 때문에 no-op이
   되므로 사용자가 ledger를 손으로 보정해야 한다는 사실도 함께 적는다.

   커밋 지점을 `goalplan.json`으로 정한 이유: idempotency 판정이 그 파일을 보므로,
   그것이 써진 시점이 "이 배치는 일어났다"의 유일한 진실이다. ledger는 감사 기록이지
   상태가 아니다.
2. **idempotency.** 같은 `idempotencyKey`가 이미 `steeringLog`에 있으면 no-op으로
   성공 반환한다 (중복 적용 방지).
3. **lock.** 프로젝트 로컬 mutation lock 아래에서만 쓴다. 임시파일 rename으로 원자적 기록.

   **WP14 P 실측 — 저장소에 락 구현이 없다.** `rg -i lock components/pabcd-state/src`는
   무관한 산문만 나온다. 기존 원자성 수단은 `writeGoalplan`의 tmp+rename뿐이다
   (`goalplan.ts:366-380`). 그래서 락도 이 슬라이스가 만들어야 하고, 의미를 못 박는다:

   - `.codexclaw/goalplans/<slug>/.steer.lock` 디렉터리를 `mkdirSync`로 만든다
     (`recursive: false`). 이미 있으면 `EEXIST`가 나므로 그것이 곧 획득 실패다 —
     POSIX·Windows 양쪽에서 원자적이고 의존성이 없다.
   - 그 안에 `owner.json`으로 `{pid, acquiredAt}`을 쓴다. **stale 판정은 하지 않는다** —
     시계·PID 재사용에 기대는 자동 회수는 조용한 이중 쓰기를 만든다. 대신 실패
     메시지가 락 경로와 `owner.json` 내용을 그대로 보여주고, 사람이 지우게 한다.
   - 해제는 `rmSync(lockDir, { recursive: true, force: true })` — `owner.json`이
     안에 있으므로 `recursive`가 필요하다.
   - `finally`에서 반드시 해제한다. 프로세스가 죽어 남으면 위 메시지가 안내한다.

   **보호 구간은 read-modify-write 전체다 (A 감사 1 — High 2).** 획득 → `readGoalplan`
   → idempotency 검사 → 복제·검증 → `writeGoalplan` → ledger append → 해제.
   쓰기 직전에만 잡으면 두 프로세스가 같은 구버전을 읽은 뒤 후발자가 선행
   `steeringLog`를 덮어쓴다. 락이 읽기까지 감싸야 그 창이 닫힌다.
   - 이것은 **협조적 락**이다. `writeGoalplan`을 직접 부르는 다른 경로(D-close 등)는
     이 락을 보지 않는다. 정직하게 적는다 — steering끼리의 경합만 막는다.
4. **필수 필드.** `rationale`, `evidence`, `idempotencyKey`가 없으면 거부.
5. **ledger는 컴팩트하게.** before/after에 계획 전체 2부를 넣지 않는다. 계획 카운터
   (work phase 수, 미충족 criterion 수)와 **변경된 work phase만** 기록한다.
6. **host goal은 건드리지 않는다.** steering은 프로젝트 로컬 상태만 변경한다.

이 슬라이스는 op 종류를 **하나만** 지원한다: `annotate` (ledger에 근거 있는 주석 추가).
**"상태를 바꾸지 않는다"는 표현은 틀렸다** (A 감사 1) — `annotate`도 `steeringLog`에
항목을 남기므로 idempotency 상태를 바꾼다. 정확히는 **완료 판정에 영향을 주는 상태를
바꾸지 않는다.** 그래서 트랜잭션·락·idempotency 기반을 완결된 수직 슬라이스로 검증하면서도
계획의 완료 조건은 건드리지 않는다. 실제 계획 변경 op은 `091`에서 추가한다.

### ledger 이벤트

기존 6개(`created`, `workphase_started`, `workphase_done`, `task_done`,
`criterion_met`, `host_armed`)에 `steered`를 추가한다 (`goalplan.ts:156`의 union — A 감사 앵커 정정).

### `steeringLog`와 revive (WP14 P 실측)

`Goalplan`에 `steeringLog?: SteeringEntry[]`를 더한다. **`010`/`030`에서 반복 확인된
함정이 그대로 적용된다** — `reviveGoalplan`은 알려진 필드를 명시 나열하므로
(`goalplan.ts:281` 이하 — A 감사 앵커 정정), revive를 함께 고치지 않으면 write/read 왕복에서 사라진다.
왕복 보존 테스트를 반드시 넣는다.

```ts
export interface SteeringEntry {
  idempotencyKey: string;
  rationale: string;
  evidence: string;
  appliedAt: string;
  /** 배치가 실제로 바꾼 것의 요약 — 계획 전체를 담지 않는다. */
  summary: string;
}
```

idempotency 판정은 `steeringLog`의 `idempotencyKey` 존재 여부로 한다. ledger 파일을
파싱하지 않는다 — ledger는 append-only 감사 기록이고 상태 조회용이 아니다.

**revive는 fail-closed다 (A 감사 2 — Medium 2).** `steeringLog`는 idempotency의
진실 원천이므로, 다른 배열들처럼 "깨진 항목만 조용히 버린다"로 하면 **그 키의 배치가
중복 적용된다.** 항목 하나가 사라지면 재실행이 no-op이 아니라 실제 적용이 되기 때문이다.

| 상황 | 처리 |
| --- | --- |
| `steeringLog`가 없음 | `undefined` — 구버전 계획 (정상) |
| `steeringLog`가 배열이 아님 | **계획 전체를 `null`로 거부** (`readGoalplan`이 null 반환) |
| 항목에 `idempotencyKey`/`rationale`/`evidence`/`appliedAt`/`summary` 중 하나라도 문자열이 아님 | **계획 전체 거부** |

`ReviewRoundState`가 깨진 라운드만 버리는 것(`030` R10)과 다른 정책이고, 이유가 다르다 —
라운드는 버려도 "리뷰가 없었다"가 되어 안전한 쪽으로 실패하지만, steering 항목은
버리면 "그 배치는 없었다"가 되어 **위험한 쪽으로** 실패한다.

깨진 `steeringLog`를 담은 계획 파일로 왕복하는 회귀 테스트를 넣는다.

## 테스트 (accept criteria)

| 시나리오 | 기대 |
| --- | --- |
| 유효한 `annotate` 배치 | 적용, ledger에 `steered` 1건, 계획 파일 1회 쓰기 |
| 같은 `idempotencyKey` 재실행 | no-op 성공, ledger 추가 없음 |
| `rationale` 누락 | 거부, 파일 미변경 |
| `evidence` 누락 | 거부 |
| op 3개 중 하나 무효 | 배치 전체 거부, 파일 미변경 |
| 알 수 없는 op kind | 거부 (`091` 전까지 `annotate`만 허용) |
| lock 경합 | 락 디렉터리를 **먼저 만들어 둔 상태**에서 호출 → 획득 실패, 메시지에 락 경로와 `owner.json` 내용 |
| ledger 항목 크기 | 계획 전체를 담지 않음 (카운터 + 변경분만) |
| 세션에 goalplan 미결박 | 명확한 오류 (조용한 실패 아님) |
| `steeringLog`가 write/read 왕복에서 보존됨 | revive 확장 회귀 (`010` R15와 같은 함정) |
| 락이 이미 존재 | 획득 실패, 메시지에 락 경로와 `{pid, acquiredAt}` 표시 |
| 성공·실패 어느 쪽이든 락 해제 | `finally` 경로 확인 — 락 디렉터리가 남지 않는다 |
| `--batch-json`이 깨진 JSON | 거부, 파싱 오류 명시 |
| `ops`가 빈 배열 | 거부 — 바꿀 것이 없는 배치는 기록할 것도 없다 |
| ledger append 실패 (`ledger.jsonl`을 **디렉터리로** 미리 생성) | **경고와 함께 성공**(exit 0), 메시지에 ledger 경로, `steeringLog` 항목은 보존 |

**실패 주입은 `ledger.jsonl`을 디렉터리로 만들어서 한다 (A 감사 2 — Medium 1).**
"쓰기 권한 제거"를 디렉터리에 걸면 `writeGoalplan`의 tmp 생성이 **먼저** 실패해
(`goalplan.ts:368`) post-commit 경고 경로에 도달하지 못한다. 같은 이름의 디렉터리는
`appendFileSync`만 `EISDIR`로 실패시키므로 커밋 이후 지점을 정확히 겨냥한다.
테스트는 exit code, 경고 문구, 그리고 `steeringLog`가 실제로 남았는지를 함께 단정한다.
| 비-canonical `--session` (`a/b`) | 거부 — sanitize가 `a-b` 세션을 가리키므로 다른 계획을 steering할 수 있다 |
| 깨진 `steeringLog`를 담은 계획 파일 | `readGoalplan`이 `null` — 항목을 조용히 버려 중복 적용을 부르지 않는다 |

**"동시 두 호출" 테스트는 넣지 않는다 (A 감사 1 — High 2).** 리뷰어가 실측했듯
`mkdirSync`는 동기라 같은 프로세스의 `Promise.all`은 순차 실행되고 둘 다 성공한다 —
그 테스트는 경합을 관측하지 못하면서 관측한 척한다. 대신 **락을 미리 만들어 둔 상태**를
시험한다. 그것이 "다른 프로세스가 잡고 있다"와 파일시스템 상태가 정확히 같고,
결정적이며, 실제로 `EEXIST` 경로를 탄다.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 exit 0, **1,362 pass**. 사슬: `package.json:24` glob이
  `components/pabcd-state/test/*.ts`를 포함한다. → **주 검증기.**
- 좁은 타입체크 (**B 이후 유효**):

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext \
    plugins/codexclaw/components/pabcd-state/src/steering.ts \
    plugins/codexclaw/components/pabcd-state/test/steering.test.ts
  ```

  의존 그래프를 타고 기존 `interview.ts`의 `TS2352` 4건이 함께 나온다(WP10 실측).
  수용 조건은 **신규 파일 오류 0건**이다. 다만 `... | grep | wc -l`이 `0`인지만 보면
  **tsc가 아예 실행되지 않아도 0이 나온다** (A 감사 1 — Medium 2). 그래서 세 값을
  함께 확인한다:

  1. 전체 `error TS` 개수가 **정확히 4**인지 (컴파일러가 실제로 돌았다는 증거)
  2. 그 4건이 전부 `interview.ts`인지
  3. `interview.ts` 밖의 오류가 0건인지

  1번이 0이면 통과가 아니라 **의심**이다 — baseline이 4건이므로 0은 tsc가 안 돌았다는
  뜻이다. 인자 없는 `npx tsc --noEmit`은 적지 않는다 (root `tsconfig.json` 없음).
- `npm run build` — 신규 `.ts`가 dist로 컴파일된다(116 → 117). → 관측한다.
- `npm run gate` — **`loop/SKILL.md`를 건드리지 않으므로 이 슬라이스를 관측하지 않는다.**
  비관측 baseline 회귀 확인용 (현재 exit 0, WARN 2).

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E8** (명시 CLI) — 훅이 아니다 |
| 실행 주체 | 사람 또는 에이전트가 `cxc loop steer`를 직접 호출한다 |
| 알려진 우회 | **goalplan.json을 직접 편집하면 그만이다.** 그건 정상 워크플로이기도 하다(`skills/loop/SKILL.md:147-150`). 이 슬라이스가 막는 것은 "steering CLI를 통한 부분 적용"이지 "계획 편집" 자체가 아니다. 락도 협조적이라 `writeGoalplan`을 직접 부르는 D-close와는 경합을 막지 못한다 |
| 잔여 위험 | `rationale`/`evidence`는 내용이 검증되지 않는다 — 빈 문자열만 막는다. "근거를 적게 강제한다"이지 "근거가 참임을 보장한다"가 아니다 |
| 표현 강등 | "steering을 강제·검증한다"가 아니라 **"steering 배치를 전부-또는-무로 적용하고 그 사실을 기록한다"** |
| 최종 강제층 | 없음 (`final layer: none`) — 완료 기준 약화 거부는 `091`의 mutation 규칙이 담당하고, 이 슬라이스는 `annotate`만 지원한다 |

## PLAN-FIELD-CHAIN-01

| 타입 | 생성 | 직렬화 | 역직렬화 | 소비 |
| --- | --- | --- | --- | --- |
| `SteeringEntry` | `applySteeringBatch` 성공 시 | `writeGoalplan` → `goalplan.json`의 `steeringLog` | `reviveGoalplan` **확장 필수** | idempotency 조회(`idempotencyKey` 존재 여부), 사람 리뷰 |
| `steered` ledger 이벤트 | 같음 | `appendGoalplanLedger` → `ledger.jsonl` | 없음 (append-only 감사 기록) | 사람 리뷰. **idempotency 판정에 쓰지 않는다** |
| `SteerBatch` (입력) | 호출자가 `--batch-json`으로 넘긴다 | N/A — 프로세스 경계에서만 존재 | CLI가 JSON 파싱 | `applySteeringBatch`의 검증 |

## 범위 밖

- 계획 변경 op 전체 (`091`).
- UserPromptSubmit 안내 주입 — `091`도 아니고 이 유닛 어디에도 없다 (3라운드 감사 8).
  상태 변경 경계는 명시 CLI로 유지하며, 안내가 필요해지면 별도 decade로 다룬다.
- host goal DB 쓰기 (어느 슬라이스에서도 하지 않는다).
