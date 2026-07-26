# 091 — steering mutation 계열 + 검증 규칙

출처: `001` #12 후반부 (ADAPT / E8) · 의존: `090`(트랜잭션 기반) · 상태: PLANNED

## 문제

`090`은 트랜잭션·lock·idempotency·컴팩트 ledger를 세우고 무해한 `annotate` op 하나만
지원한다. 실제로 필요한 것은 계획을 조정하는 op들이고, 각 op마다 **"조정"과 "완료 기준
약화"를 가르는 판정**이 필요하다. 그 판정이 이 슬라이스의 본체다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/components/pabcd-state/src/steering-ops.ts` | 신규 — op별 검증 |
| `plugins/codexclaw/components/pabcd-state/src/steering.ts` | op 등록 확장 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | `WorkPhaseStatus`에 `blocked`/`superseded` 추가 (`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:32`) + reviver/기본값 처리 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | `validateGoalplan` 잔여작업 판정: `blocked`는 미완, `superseded`는 잔여에서 제외 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | `nextOpenTask`(`:241-248`) — 현재 `status === "done"`만 건너뛴다. `superseded`도 건너뛰게, `blocked`는 task를 반환하지 않게 수정 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | `effectiveActiveWorkPhaseId`(`:341-349`) — 현재 `done`이 아니면 active로 인정하므로 `blocked`/`superseded`가 active가 된다. 두 상태를 커서 대상에서 제외 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | `advanceWorkPhase`(`:705-733`) — 별도 거부 분기는 넣지 않는다. `effectiveActiveWorkPhaseId`가 두 상태를 건너뛰므로 그 phase가 `done`이 될 경로가 없다 (WP15 정정) |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | criterion 수정 시 `surface`(`040`) 보존 |
| `plugins/codexclaw/components/pabcd-state/src/hook.ts` | `buildGoalIdleBlock` 잔여 열거에서 `superseded` 제외, `blocked`는 이유와 함께 표시 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts` | `loop show` 출력에 새 상태 표기 |
| `plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts` | 신규 |
| `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts` | 새 상태의 잔여작업/완료 판정 케이스 |
| `plugins/codexclaw/skills/loop/SKILL.md` | steering 절을 shipped 동작에 맞춤 |

**스키마 확장 (재감사 7):** 현행 `WorkPhaseStatus`는 `pending | in_progress | done`뿐이다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:32`). `blockWorkPhase`와
`supersedeWorkPhase`는 새 상태를 도입하므로 **타입·역직렬화·잔여작업 판정·완료 검증·
Stop 문구·`loop show` 출력 전부**를 함께 바꿔야 한다. 소비자를 빠뜨리면 새 상태가
"미완 작업"으로도 "완료"로도 집계되지 않는 유령 상태가 된다.

**커서/헬퍼 3종 (3라운드 감사 5):** 위 주장을 실제 소비자 목록으로 채운다. 세 헬퍼가
`done` 여부만 보므로 새 상태를 넣으면 즉시 오동작한다.

| 헬퍼 | 현재 동작 | 새 상태에서의 문제 | 수정 |
| --- | --- | --- | --- |
| `remainingWorkPhases` (**`:478-480`**) | `status !== "done"` 필터 | `superseded`가 잔여로 잡혀 "제외한다"는 의미가 깨진다. `validateGoalplan`과 `buildGoalIdleBlock`이 둘 다 이걸 쓴다 | `done`과 `superseded` 둘 다 제외 |
| `nextOpenTask` (**`:483-491`**) | `status === "done"`인 phase만 건너뛴다 | `superseded` phase의 task를 다음 할 일로 내놓는다 | `superseded` 건너뛰기, `blocked`는 task 반환 안 함 |
| `effectiveActiveWorkPhaseId` (**`:743-752`**) | 커서가 `done`이 아니면 그대로 active | `blocked`/`superseded`가 active로 남아 루프가 그 위에서 돈다 | 두 상태를 제외하고 다음 `pending`/`in_progress`로 넘긴다 |
| `advanceWorkPhase` (**`:705-733`**) | effective active를 `done`으로 표시하고 다음 `pending`으로 | `blocked`/`superseded` phase를 `done`으로 만들어 완료 게이트를 우회 | 두 상태에서는 advance 거부 (명시적 오류) |

`advanceWorkPhase`에 **별도 거부 분기를 만들지 않는다.** `effectiveActiveWorkPhaseId`가
두 상태를 건너뛰므로 `blocked`/`superseded` phase가 `done`이 될 경로 자체가 없다.

다만 그 결과는 "오류"가 아니라 **"건너뛰고 다음을 닫는다"**이다 (A 감사 Medium —
초안 테스트표가 "거부(오류)"를 요구해 본문과 모순됐다). 커서가 `blocked`를 가리켜도
뒤에 `pending`이 있으면 그것이 닫힌다. 모든 phase가 `blocked`/`superseded`뿐이면
effective가 `null`이고 `advanceWorkPhase`는 기존대로 `null`을 반환한다 —
닫을 것이 없다는 뜻이고 맞다. 세 경우를 각각 테스트로 고정한다.

### 전이 허용 범위 (3라운드 감사 5)

- `blockWorkPhase`: `pending` 또는 `in_progress`에서만 허용. **`done`은 거부** —
  이미 끝난 일을 막을 수 없다.
- `supersedeWorkPhase`: `pending` 또는 `in_progress`에서만 허용. `done`은 거부.
  `in_progress`를 supersede하면 활성 커서를 **대체 phase로 옮긴다** (커서가 유령 상태에
  머물지 않게).
  **`replacementId !== targetId` 필수 (4라운드 감사 7).** 자기 자신은 전이 직전까지
  "존재하고 superseded가 아닌" 조건을 만족하므로, 그 조건만 검사하면 `A → A`가 통과해
  A가 잔여 작업에서 빠진다. 즉 self-supersede는 완료 우회 경로다. 추가로 대체 사슬의
  순환(`A→B`, `B→A`)도 거부되는데, 별도 사슬 탐색이 아니라 "대상이 이미 superseded"
  규칙이 잡는다 (WP15 A 감사 — 사슬 탐색은 도달 불가 코드라 넣지 않는다).
- `blockWorkPhase`의 이유는 어디에 사는가: `GoalplanWorkPhase`에
  `blockedReason?: string`을 추가하고 거기에 저장한다 (4라운드 감사 7).
  Stop 문구와 `loop show`는 이 필드를 읽는다 — ledger를 역방향 조회하지 않는다.
  `unblockWorkPhase`는 이 필드를 지운다.
- `unblockWorkPhase`: `blocked` → `pending`만.
- 어느 전이도 `done`을 만들지 않는다.

**UserPromptSubmit 안내는 이 슬라이스에서 제외한다 (재감사 7).** "선택"으로 남겨두면
범위가 열린 상태가 된다. 안내가 없어도 기능은 완전하므로 필요해지면 별도 슬라이스로 다룬다.

## before → after

### 지원 op 목록

| op | 동작 | 허용 조건 |
| --- | --- | --- |
| `appendWorkPhase` | 새 work phase + criteria 추가 | 항상 (LOOP-UNIT-CHAIN-01이 권장하는 동작) |
| `splitWorkPhase` | pending phase를 둘로 | 대상이 `pending`, criteria가 유실 없이 재배분 |
| `reorderWorkPhases` | pending 구간 순서 변경 | `done`/`in_progress` 항목의 상대 위치 불변 |
| `revisePhaseTitle` | pending phase 문구 수정 | 대상이 `pending` |
| `reviseCriterion` | criterion 문구/기대증거 수정 | **약화 아님** (아래 판정) |
| `blockWorkPhase` | phase를 blocked로 표시 | `rationale`에 외부 차단 요인 명시 |
| `supersedeWorkPhase` | phase를 대체됨으로 표시 | 대체하는 phase id를 함께 지정 |
| `annotate` | ledger 주석 (`090`) | 항상 |

### 거부 규칙 (STRICT)

1. **완료 상태 직접 편집 금지.** `status`를 `done`으로 바꾸는 op은 없다. 완료는 실제 작업과
   D 단계를 통해서만 일어난다.
2. **증거 삭제 금지.** `capturedEvidence`를 비우거나 제거하는 op은 없다.
3. **criteria 약화 금지.** `reviseCriterion`은 다음이면 거부한다 — criterion 개수 감소,
   `expectedEvidence`가 비워짐, 검증 가능한 시나리오가 모호한 문구로 대체됨.
   판정은 기계적으로 가능한 것만 강제한다: 개수 감소, 빈 문자열, 길이가 절반 이하로 축소.
   의미적 약화는 게이트가 판별할 수 없으므로 `rationale` 필수 + ledger 기록으로 감사 가능하게 남긴다.
   (이 한계를 문서에 정직하게 적는다 — "훅이 의미적 약화를 막는다"고 쓰지 않는다.)
4. **done/in_progress 유닛 변경 금지.** 예외는 `blockWorkPhase`와 `supersedeWorkPhase`의
   명시적 전이뿐이다.
5. **host goal 필드 거부.** 배치에 host goal 관련 키가 있으면 배치 전체 거부.

### `loop/SKILL.md` 정정

현재 `plugins/codexclaw/skills/loop/SKILL.md:196-208`은 shipped되지 않은 steering을 약속한다. 이 슬라이스가 기능을 넣으므로
문구를 **실제 동작과 일치**시킨다: 지원 op 목록, `cxc loop steer` 명령형, 그리고
"의미적 약화는 게이트가 아니라 감사로 잡는다"는 한계 명시.

### 새 상태의 의미 (명확히 고정)

- `blocked` — 외부 요인으로 진행 불가. **잔여 작업으로 집계된다.** 즉 goal 완료를 막는다.
  `rationale`에 차단 요인이 있어야 하며, 해제는 별도 op이 아니라 `pending`으로 되돌리는
  `unblockWorkPhase`로 한다 (이 슬라이스에 포함).
- `superseded` — 다른 phase가 이 일을 대신한다. **잔여 작업에서 제외된다.**
  대체하는 phase id가 필수이고, 그 phase가 존재하며 `superseded`가 아니어야 한다.

두 상태 모두 `done`이 아니다 — 완료로 위장하는 경로를 만들지 않는다.

## 테스트 (accept criteria)

| 시나리오 | 기대 |
| --- | --- |
| `appendWorkPhase` + criteria | 적용, ledger 기록 |
| `splitWorkPhase`로 criteria 유실 | 거부 |
| `reorderWorkPhases`가 done 항목 위치 변경 | 거부 |
| `reviseCriterion`으로 criterion 개수 감소 | 거부 |
| `reviseCriterion`으로 `expectedEvidence` 비움 | 거부 |
| `reviseCriterion` 문구 길이 절반 이하 축소 | 거부 |
| `reviseCriterion` 정당한 명확화 (길이 유지) | 통과, ledger에 rationale 기록 |
| `capturedEvidence` 제거 시도 | 거부 |
| `status: done` 직접 설정 시도 | 거부 |
| `done` phase 문구 수정 시도 | 거부 |
| `blockWorkPhase` (rationale 있음) | 통과 |
| `blockWorkPhase` (rationale 없음) | 거부 |
| `supersedeWorkPhase` 대체 id 누락 | 거부 |
| `supersedeWorkPhase` 대체 id가 존재하지 않는 phase | 거부 |
| `supersedeWorkPhase` 대체 대상이 이미 superseded | 거부 |
| **`supersedeWorkPhase`의 대체 id가 자기 자신 (`A → A`)** | 거부 (감사 7의 핵심 회귀) |
| 대체 사슬 순환 (`A→B` 후 `B→A`) | 거부 (대상-superseded 규칙으로) — **후속 조각** |
| `blockWorkPhase` 후 `blockedReason` | 필드에 저장, Stop 문구와 `loop show`가 이 값을 표시 |
| `unblockWorkPhase` 후 `blockedReason` | 지워짐 |
| `blocked` phase가 있는 계획의 완료 검증 | 실패 (잔여 작업으로 집계) |
| `superseded` phase만 남은 계획의 완료 검증 | 통과 (잔여에서 제외) |
| `unblockWorkPhase` | `blocked → pending` 전이, ledger 기록 |
| 구버전 goalplan JSON 역직렬화 (새 상태 없음) | 정상 로드, 기존 동작 유지 |
| `loop show` 출력에 blocked/superseded 표기 | 두 상태가 구분되어 표시 |
| `nextOpenTask`, `superseded` phase에 미완 task 존재 | 그 task를 반환하지 않음 |
| `nextOpenTask`, `blocked` phase에 미완 task 존재 | 그 task를 반환하지 않음 |
| `effectiveActiveWorkPhaseId`, 커서가 `blocked` phase | 다음 `pending`/`in_progress`를 반환 |
| `effectiveActiveWorkPhaseId`, 커서가 `superseded` phase | 동일 |
| `advanceWorkPhase`, 커서가 `blocked` phase를 가리키고 뒤에 `pending`이 있음 | 그 `blocked`를 건너뛰고 **다음 phase**를 닫는다. `blocked`는 `done`이 되지 않는다 (A 감사 Medium) |
| `advanceWorkPhase`, 커서가 `superseded` | 동일 |
| `advanceWorkPhase`, 모든 phase가 `blocked`/`superseded` | `null` — 닫을 것이 없다 |
| **raw JSON에 `superseded`인데 `supersededBy` 없음** → `validateGoalplan` | 실패 (A 감사 High) |
| raw JSON에 `supersededBy`가 자기 자신 | 실패 |
| raw JSON에 `supersededBy`가 존재하지 않는 id | 실패 |
| raw JSON에 대상이 이미 `superseded` | 실패 |
| raw JSON에 순환 (`A→B`, `B→A`) | 실패 — 단 이것이 증명하는 것은 "superseded를 대상으로 지목할 수 없음"이지 순환 탐색이 아니다 |
| 위 무결성 위반 계획으로 `goal-gate` 완료 시도 | deny 봉투 — 검증 실패가 실제로 완료를 막는지 |
| 정상 `superseded` (유효한 `supersededBy`) | 완료 검증 통과 |
| `blockedReason`/`supersededBy`가 raw JSON 왕복에서 보존 | reviver 확장 회귀 |
| 구버전 JSON (`pending`/`in_progress`/`done`만) | 기존 동작 그대로 |
| **`A→P`가 합법 전이** | `canEnter("P", {phase:"A"})`가 ok — 산문(`attest.ts:181`)이 지시하는 복구 경로가 실제로 열린다 |
| `A→P`에 interview 플래그 불필요 | `C→P`와 동일하게 통과 |
| `A→P` 후에도 `A→B` 게이트 유지 | 역행이 `auditPassed`를 무력화하지 않는다 |
| `A→D`는 여전히 불법 | 역행 추가가 순서 건너뛰기를 열지 않았다 |
| `blockWorkPhase`를 `done` phase에 적용 | 거부 |
| `supersedeWorkPhase`를 `done` phase에 적용 | 거부 |
| `in_progress` phase를 supersede | 허용, 활성 커서가 대체 phase로 이동 |
| criterion 수정 후 `surface` 값 | 보존됨 (`040`의 필드) |
| host goal 키 포함 배치 | 배치 전체 거부 |
| 여러 op 혼합, 하나 무효 | 전체 거부, 파일 미변경 (`090` 규칙 유지) |

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 exit 0, **1,382 pass**. 사슬: `package.json:24` glob이
  `components/pabcd-state/test/*.ts`를 포함한다. → **주 검증기.**
- 좁은 타입체크 (**B 이후 유효**):

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext \
    plugins/codexclaw/components/pabcd-state/src/goalplan.ts \
    plugins/codexclaw/components/pabcd-state/src/fsm.ts
  ```

  수용 조건은 **전체 `error TS`가 정확히 4건이고 전부 `interview.ts`**인 것이다.
  0건이면 통과가 아니라 tsc가 안 돌았다는 뜻이다 (WP14에서 정한 규칙).
- `npm run build` — 파일 수는 **117 그대로** (신규 `.ts`가 없다). → 관측한다.
- `npm run gate` — 이 사이클은 `loop/SKILL.md`를 건드리지 않으므로 **관측하지 않는다**.
  비관측 baseline 회귀 확인용 (현재 exit 0, WARN 1).

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E8** — `validateGoalplan`의 `superseded` 무결성 검사가 완료 게이트에 얹힌다 |
| 실행 주체 | `goal-gate.ts:216-219`가 `update_goal complete` PreToolUse에서 `validateGoalplan`을 부른다 (이미 배선돼 있다) |
| 알려진 우회 | `supersededBy`를 **유효한 다른 phase로 채워** 넣으면 통과한다 — 그 phase가 정말 그 일을 대신하는지는 기계가 판별할 수 없다. 잡는 것은 "빈 값·자기참조·존재하지 않는 대상·대상이 이미 superseded" 네 가지 형식 결함뿐이다 |
| 잔여 위험 | 형식은 맞지만 의미가 거짓인 supersede는 `rationale`과 ledger로만 감사된다 (`091` 본체의 "의미적 약화는 게이트가 못 잡는다"와 같은 한계) |
| 표현 강등 | "완료 우회를 막는다"가 아니라 **"형식이 깨진 supersede로는 완료할 수 없게 한다"** |
| 최종 강제층 | **`goal-gate.ts`의 deny 봉투** — `validateGoalplan` 실패가 그대로 완료 거부가 된다 |

## PLAN-FIELD-CHAIN-01

| 필드 | 생성 | 직렬화 | 역직렬화 | 소비 |
| --- | --- | --- | --- | --- |
| `WorkPhaseStatus`의 `blocked`/`superseded` | 후속 조각의 op (이 사이클은 fixture) | `writeGoalplan` | `reviveGoalplan`의 status 분기 — 현재 `in_progress`/`done`만 인정하고 나머지를 `pending`으로 떨어뜨리므로(`goalplan.ts:336`) **반드시 확장한다.** 안 하면 새 상태가 왕복에서 `pending`으로 바뀐다 | 헬퍼 4종 + `validateGoalplan` |
| `blockedReason?: string` | `blockWorkPhase` (후속) | 같음 | 같음 — 문자열이 아니면 생략 | Stop 문구·`loop show` (후속). 이 사이클은 보존만 |
| `supersededBy?: string` | `supersedeWorkPhase` (후속) | 같음 | 같음 | **이 사이클의 `validateGoalplan` 무결성 검사** (빈 값·자기참조·대상 존재·대상이 superseded 아님) + 후속 op의 같은 검증 |

## 범위 밖

- 계획 전체 스냅샷 저장 (`090`의 컴팩트 원칙 유지).
- 의미적 약화의 자동 판정 (불가능; 감사로 처리).
- host goal 상태 변경.
## WP15 P 실측 — 앵커 전면 정정과 범위 분할

`090`이 방금 `steering.ts`를 넣었고, 그 앞의 `010`/`030`이 `goalplan.ts`를 크게 키웠다.
계획이 인용한 줄 번호가 **전부 밀렸다.**

| 초안 | 실제 | 대상 |
| --- | --- | --- |
| `:32` | `:32` | `WorkPhaseStatus` (유일하게 그대로) |
| `:241-248` | **`:483-491`** | `nextOpenTask` |
| `:341-349` | **`:743-752`** | `effectiveActiveWorkPhaseId` |
| `:303-330` | **`:705-733`** | `advanceWorkPhase` |

**계획이 빠뜨린 소비자가 하나 더 있다: `remainingWorkPhases`(`:478-480`).**
`status !== "done"`으로 필터하므로 `superseded`가 그대로 잔여 작업에 잡힌다 —
"잔여에서 제외한다"는 이 슬라이스의 핵심 의미가 여기서 깨진다. `validateGoalplan`과
`buildGoalIdleBlock`이 둘 다 이 함수를 쓰므로 여기만 고치면 두 소비자가 함께 맞는다.

### 범위 분할

초안대로면 한 사이클에서 `goalplan.ts`의 헬퍼 5종 + 신규 `steering-ops.ts` + `hook.ts` +
`goalplan-cli.ts` + `loop/SKILL.md` + 테스트 2개를 동시에 바꾼다. 그건 한 B가 아니다.

**이 사이클(WP15)의 범위 — 상태 모델:**

| 파일 | 변경 |
| --- | --- |
| `src/goalplan.ts` | `WorkPhaseStatus`에 `blocked`/`superseded`, `blockedReason`/`supersededBy` 필드, reviver, 그리고 **헬퍼 4종**(`remainingWorkPhases`, `nextOpenTask`, `effectiveActiveWorkPhaseId`, `advanceWorkPhase`) 수정 |
| `test/goalplan.test.ts` 또는 신규 | 새 상태의 잔여/완료/커서 판정 |
| `src/fsm.ts` | `A→P` 복구 간선 + parity 주석 정정 (사용자 지적) |
| `test/fsm.test.ts` | parity 테스트 이름·기대값 수정 + `A→P` 케이스 |

**후속 조각으로 미루는 것 — mutation op:**
`steering-ops.ts`(op별 검증), `steering.ts`의 op 등록 확장, `hook.ts` Stop 문구,
`goalplan-cli.ts`의 `loop show` 표기, `loop/SKILL.md` 정정.

### 함께 고치는 것: `A→P` 역행 경로 (사용자 지적)

범위 밖처럼 보이지만 **같은 계열의 false-enforcement**이고, 이 루프 자신이 방금 걸렸다.

`attest.ts:181`은 A→B가 `fail`일 때 이렇게 지시한다:

> after 3 failed rounds return to P with a changed plan (LOOP-REPAIR-01)

`pabcd/SKILL.md:132`도 같은 말을 한다. 그런데 `fsm.ts:16-24`의 전이표에는
**`A: ["I", "B"]`뿐이라 `A→P`가 없다.** 즉 코드가 자기 산문이 시키는 복구 경로를
거부한다 — `superseded`가 검증 없이 통과하는 것과 정확히 같은 종류의 결함이고,
방향만 반대다(하나는 막아야 할 것을 열고, 하나는 열어야 할 것을 막는다).

`C`는 이미 `["I", "D", "B", "P"]`로 **backward 루프 경로를 둘 갖고 있고** 주석이
"intentional loop routes"라고 명시한다(`fsm.ts:14`). A만 빠진 것은 설계 의도가 아니라
누락이다.

| 변경 | 내용 |
| --- | --- |
| `fsm.ts:20` | `A: ["I", "B"]` → `A: ["I", "B", "P"]` |
| `fsm.ts:14` 주석 | backward 경로 목록에 `A→P` 추가 |
| `canEnter`의 `case "P"` | `state.phase === "A"`도 interview 플래그 없이 허용 (`C`와 동일 근거 — 재계획은 인터뷰를 다시 요구하지 않는다) |
| `fsm.ts:8` 헤더 주석 | "byte-faithful port" 주장 정정 — 아래 참조 |
| `fsm.test.ts:134` | 기존 parity 테스트 이름·기대값 수정 — 아래 참조 |
| `fsm.test.ts` | `A→P` 합법 + interview 플래그 없이 통과 + `A→D`는 여전히 불법 + 아래 stale-flag 시퀀스 |

**parity 주장을 정직하게 고친다 (A 감사 3 — Medium 1).** `fsm.ts:8`은 이 표가 cli-jaw에서
"byte-faithful"하게 포트됐다고 하고, `fsm.test.ts:134`의 테스트 이름이
`"VALID_TRANSITIONS matches the cli-jaw table byte-for-byte"`다. 기대값만 바꾸면
**테스트 이름이 거짓말이 된다.** 그래서 둘 다 고친다:

- 테스트 이름 → `"VALID_TRANSITIONS: cli-jaw table plus the codexclaw A->P repair edge"`
- 헤더 주석 → "ported from cli-jaw, with one intentional divergence: `A->P`,
  because LOOP-REPAIR-01 (`attest.ts:181`, `pabcd/SKILL.md:132`) instructs a return
  to P after three failed audit rounds and the ported table had no such edge."

upstream cli-jaw를 바꾸는 것은 이 유닛 범위 밖이므로, divergence를 숨기지 않고 명시한다.

**게이트 유지 테스트는 `canEnter`가 아니라 실제 `transition` 시퀀스로 한다
(A 감사 3 — Medium 2).** `canEnter("B", {auditPassed:false})`만 보면 재계획 뒤에도
남아 있는 `auditPassed: true`와 새 간선의 조합을 검증하지 못한다. 정확한 시퀀스:

```
A(auditPassed: true) → transition("P")   // 새 간선
                     → transition("A")
                     → transition("B", attest 없이)   // 거부되어야 한다
```

`transition`이 A→B에서 `validateAttest`를 항상 거치므로(`fsm.ts:108-111`) 거부가
맞지만, **stale 플래그가 그것을 우회하지 않는다는 것을 실제로 관측한다.**
human 경로(`orchestrate-apply.ts:109`)는 의도적으로 플래그를 pre-flip하는 free-pass이므로
이 주장은 **agent 경로에 한정**해서 적는다.

**`auditPassed` 플래그를 건드리지 않는다.** A→P로 나가도 그 플래그는 그대로이고,
새 계획으로 A를 다시 통과해야 B로 갈 수 있다 — `transition`이 A→B에서 attest를
다시 요구하기 때문이다. 역행이 게이트를 무력화하지 않는다는 것을 테스트로 고정한다.

근거: **새 상태를 만드는 op이 없어도 상태 모델은 그 자체로 검증 가능하고, 반대는
불가능하다.** op을 먼저 넣으면 헬퍼가 유령 상태를 잘못 다루는 채로 데이터가 생긴다.
`010`/`030`/`040`에서 반복한 것과 같은 순서다 — 읽는 쪽을 먼저 맞추고 쓰는 쪽을 붙인다.

### 단 `supersededBy` 무결성 검증은 이번에 함께 넣는다 (A 감사 1 — High)

op을 미루는 것과 **검증을 미루는 것**은 다르다. `superseded`를 잔여에서 빼는 순간,
계획 JSON을 직접 편집해 phase를 `superseded`로 적으면 그것이 곧 완료 우회다 —
`readGoalplan`이 그대로 복원하고(`goalplan.ts:403`), `validateGoalplan`이
`remainingWorkPhases`만 보고(`:542`), `goal-gate.ts:216-219`가 그 판정을 그대로 믿는다.
게다가 goalplan JSON 직접 편집은 **정상 워크플로로 안내되고 있다**
(`loop/SKILL.md:147`). 즉 우회가 아니라 문서화된 사용법이다.

그래서 `validateGoalplan`에 `superseded` 무결성 검사를 **이번 사이클에** 넣는다.
`superseded` phase 각각에 대해:

| 조건 | 위반 시 |
| --- | --- |
| `supersededBy`가 비어있지 않은 문자열 | 실패 — 무엇이 대신하는지 없이 빠질 수 없다 |
| `supersededBy !== 자기 id` | 실패 — self-supersede가 가장 단순한 우회다 |
| 그 id의 phase가 계획에 존재 | 실패 |
| 대상이 `superseded`가 아님 | 실패 — 대체 사슬이 통째로 사라지는 것을 막는다 |

**순환 검사는 넣지 않는다 (A 감사 2 — Medium).** "대상이 `superseded`가 아님"이
이미 모든 순환을 잡는다 — 어떤 순환이든 최소 한 대상이 `superseded`이기 때문이다.
별도 사슬 탐색을 구현하면 **도달 불가능한 코드**가 되고, `A→B→A` 테스트는 순환
탐색이 아니라 대상-superseded 규칙만 증명한다. 그 테스트는 남기되 **무엇을 증명하는지
정확히 적는다** — "순환 거부"가 아니라 "superseded를 대상으로 지목할 수 없음"이다.

즉 **직접 대체만 허용한다.** 사슬(`A→B→C`)이 필요해지면 그때 대상-superseded 금지를
완화하고 순환 탐색을 실제로 필요한 규칙으로 만든다. 지금 없는 요구를 위해 도달 불가
분기를 만들지 않는다.

이 검사는 op이 없어도 성립하고, op이 붙은 뒤에도 그대로 유효하다 —
**op 쪽 검증과 중복되는 것이 맞다.** 계획 파일이 어떻게 그 상태가 됐든 완료 판정은
같은 기준을 적용해야 한다.

`blocked`는 이 검사가 필요 없다. 잔여로 집계되므로 완료를 막는 방향이고,
`blockedReason`이 없어도 안전한 쪽으로 실패한다.

따라서 아래 테스트표의 op 관련 행(`appendWorkPhase`, `splitWorkPhase`,
`reviseCriterion`, `blockWorkPhase` 등)은 **후속 조각의 수용 기준**이다. 이 사이클은
상태 모델 행만 담당하고, 새 상태는 테스트 fixture로 직접 만든다.
