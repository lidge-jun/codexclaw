# 050 — wp5: goalplan 쓰기 직렬화와 의존 원장

> 상태: 구현 전 P-phase PRD.
> 선행 조건: `020_wp2_schema_v3.md`, `030_wp3_integrity.md`,
> `040_wp4_dependency_aware.md`가 확정한 저장 형식·무결성·선택 의미.
> 후속 작업: `060_wp6_public_surface.md`가 등록·조회·lifecycle 공개 표면을 추가한다.

## 1. 범위와 불변식

wp5는 공개 mutation보다 먼저 공통 락을 세운다. 현재 steering 전용 `.steer.lock`을
`.codexclaw/goalplans/<slug>/.goalplan.lock`으로 바꾸고, 기존 goalplan RMW 경로를 모두 이 락으로
감싼다. wp6은 이 API가 합쳐진 뒤에만 공개 mutation을 추가한다.

확정 불변식은 아래와 같다.

1. 락 획득은 `mkdirSync(lockDir, { recursive: false })` 한 호출로만 판정한다.
2. 획득 뒤 `goalplan.json`을 다시 읽고 callback에는 그 객체만 넘긴다. 락 밖 snapshot은 쓰지 않는다.
3. 생산 코드 기본 대기는 5ms, 10ms, 20ms, 40ms로 총 75ms다.
4. 75ms가 지나도 락이 있으면 자동 회수 없이 실패한다.
5. `owner.json`은 PID와 획득 시각을 보여 주는 진단 파일이다. 생존 판정, hostname 비교, token 비교,
   삭제 판정에는 쓰지 않는다.
6. 오류 문구는 락 디렉터리 절대 경로를 적는다. 자동 삭제 명령은 만들지 않는다. 운영자가 writer
   부재를 확인한 뒤 자기 플랫폼에 맞는 도구로 이 경로를 지우게 한다.
7. `goalplan.json` 커밋과 그 변경이 만든 `ledger.jsonl` append는 같은 임계 구역에 둔다.
8. 읽기 API는 락을 잡지 않는다. `readGoalplan()`의 null-on-failure 계약도 유지한다.
9. 락 실패는 Stop block 사유가 아니다.
10. read-only 락 상태 helper는 절대 경로, 존재 여부, 나이만 반환한다. `owner.json` 내용은 읽지 않는다.
11. D-close recovery는 plan의 `done` 상태로 판정하지 않는다. 세션 state의 durable marker가
    `sessionId`, `checkEpoch`, `closedWorkPhaseId`를 모두 현재 요청과 결박할 때만 recovery다.
12. marker는 정상 C→D 게이트를 모두 통과한 뒤 goalplan 락 안에서 기록한다. state와 PABCD 원장까지
    정상 완료한 뒤 같은 락을 다시 잡아 marker를 지운다.
13. `goalplanWriteLockStatus()`는 `existsSync()` 다음 `statSync()`에서 난 `ENOENT`를
    `{ exists: false, ageMs: null }`로 정규화한다.

다음 항목은 넣지 않는다.

- stale-lock 자동 회수 helper, PID probe, hostname 판정, token fencing, quarantine rename, heartbeat
- 기존 phase의 의존을 사후 편집하는 steering op
- 거부 사실을 원장에 쓰는 이벤트와 거부 사유용 원장 필드
- scheduler, claim/lease 실행기, WAL, ledger replay
- wp6 소유인 lifecycle CLI 인자와 `dependency_registered` 생산 코드

### 1.1 §36 라운드 6 반영 대장

| 지적 | 이 문서의 처분 |
| --- | --- |
| V3 | review CLI·observer의 누적 전체 import Before/After를 추가한다. |
| V4 | marker 최종화는 bound slug 분기 안에서만 실행하고 unbound는 즉시 반환한다. |
| V5 | 채팅 recovery 합성 `ApplyResult`에 PABCD close ledger를 넣고 state/append 직후 실패를 재시도한다. |
| V6 | exact persisted shape와 valid·foreign·IDLE epoch 복원 회귀를 `state.test.ts`에 추가한다. |
| V7 | close-row 확인·append·marker cleanup을 한 락 임계 구역에 두고 동시 소비를 검증한다. |
| V8 | `orchestrate-apply.ts`를 write scope에 넣고 IDLE+marker reset을 실제 write로 바꾼다. |
| V12 | 절대 경로는 `isAbsolute()`로 검사하고 복구 안내는 경로만 적는다. |
| V13 | 두 integrity helper를 락 안 첫 검사로 두고 네 저장소 byte 불변을 CLI·채팅에서 검증한다. |

## 2. 현재 소스 근거

아래 앵커는 wp4 적용 뒤 HEAD `8321b2d7` 기준이다. 기존 수치는 wp4 삽입분만큼 밀렸다.

- `goalplan.ts:694-715`는 tmp 파일을 쓴 뒤 rename하는 plan publish 경로다.
- `goalplan.ts:717-737`의 ledger append는 별도 `openSync(O_APPEND)`, `writeSync`, `closeSync`로 구성된다.
- `atomic-write.ts:16`은 rename 재시도 간격 상수, `atomic-write.ts:38-45`는 재시도 실행부다.
- `steering.ts:68-128`은 `.steer.lock` 경로와 전용 획득·해제 helper다.
  `steering.ts:80-85` 주석은 stale lock을 자동 회수하지 않으며 이 락이 steering끼리만 막는다고 명시한다.
- `steering.ts:193-200`의 `ApplyOptions`에는 `now`와 `wslDeps`만 있다. 공통 락 대기·실패 주입 옵션은 아직 없다.
- `steering.ts:274-334`는 `.steer.lock`을 잡고 plan을 다시 읽은 뒤 plan commit과 `steered` append를 실행하고 락을 푼다.
  plan write는 `steering.ts:313`, 원장 append는 `steering.ts:316-321`이다.
- 실제 HEAD의 `orchestrate-cli.ts:599-705`가 CLI D-close다. 성공 시 `writeState()`로 FSM을 먼저
  `IDLE`로 닫는 지점은 `orchestrate-cli.ts:666`, PABCD 원장 append는
  `orchestrate-cli.ts:667-674`다. goalplan write는 그 뒤 `orchestrate-cli.ts:679`,
  `workphase_done` append는 `orchestrate-cli.ts:680-691`, `workphase_started` append는
  `orchestrate-cli.ts:693-699`이며 모두 `orchestrate-cli.ts:678-703`의 fail-open catch 안에 있다.
  이 순서를 goalplan-first로 바꿀 때 attest의 `workPhaseId`를 닫을 phase id로 고정하지 않으면
  state write 실패 뒤 재시도가 다음 pending phase를 한 번 더 닫는다.
- `orchestrate-cli.ts:727-756`은 P→A stale-round 청소 RMW다. plan write는
  `orchestrate-cli.ts:742`, 닫힌 round 원장 append는 `orchestrate-cli.ts:743-750`이다.
- `hook.ts:839-880`은 채팅 D-close preflight다. state write는 `hook.ts:898-911`,
  PABCD 원장 append는 `hook.ts:913`이다. plan과 goalplan 원장 write 블록은
  `hook.ts:920-944`이며, plan write는 `hook.ts:925`, `workphase_done` append는
  `hook.ts:926-932`, `workphase_started` append는 `hook.ts:934-939`다.
- `review-round-cli.ts:201-237`은 open RMW, `review-round-cli.ts:257-264`는 abort RMW다.
- `review-observer.ts:73-99`는 진단 append helper와 sign-off 파싱 실패 호출부이고,
  `review-observer.ts:119-135`는 알려진 round의 거부 진단 append다.
  `review-observer.ts:104-165`는 plan read, round·epoch·reviewer 검사, `recordVerdict()`,
  plan write까지 이어지는 verdict RMW다.
- `goalplan-cli.ts:326-353`의 init은 신규 plan 생성 경로다. plan build와 write는
  `goalplan-cli.ts:336-340`, `created` append는 `goalplan-cli.ts:341-346`, 선택적인 세션 바인딩
  state write는 `goalplan-cli.ts:349-352`다. 기존 goalplan은 `goalplan-cli.ts:332-335`에서
  거부하므로 이번 공통 callback 이관 대상에서 제외한다.

## 3. 실패 의미

| 경로 | 분류 | 락 실패 결과 |
| --- | --- | --- |
| CLI D-close (최초 락) | operation fail-closed | code 1, phase 전이 없음, plan·두 원장 불변 |
| CLI D-close (최종화 락) | 미완 보고 | code 0, FSM은 이미 IDLE, marker 잔존, 다음 요청이 정리 완료 |
| 채팅 D-close | operation fail-closed + hook process fail-open | D-close 전이 없음, 사람이 읽는 경고 반환, hook 프로세스 code 0 |
| steering apply | operation fail-closed | `kind: "locked"`, plan·goalplan 원장 불변 |
| review-round open/abort | operation fail-closed | code 1, round 불변 |
| review observer | hook process fail-open | verdict와 진단 append 포기, 빈 문자열 반환 |
| P→A stale-round 청소 | 부수 기록 fail-open | P→A 전이는 진행, stale-round 변경과 append만 포기 |
| wp6 lifecycle mutation | operation fail-closed | code != 0, plan·goalplan 원장 불변 |

채팅 D-close는 일반 hook 부수 기록이 아니다. hook이 상태 전이를 대행하는 연산이므로 락을 못 잡으면
phase를 `IDLE`로 바꾸지 않는다. 반환 context에는 `D-close was not applied`와 수동 락 확인 안내를
넣는다. CLI entry의 기존 catch는 hook 프로세스를 code 0으로 끝내므로 세션은 막히지 않는다.

`handleStop()`에는 락 경합 분기를 추가하지 않는다. 락 경합은 Stop block을 만들지 않으며
`stopBlockCount`나 `stopBlockTotal`도 올리지 않는다. 호스트에는 Stop 반복 상한이 없으므로 락 경합을
block으로 바꾸면 같은 실패가 끝없이 다시 실행될 수 있다.

## 4. 변경 manifest

| 구분 | 경로 | 책임 |
| --- | --- | --- |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | 공통 락 API, 75ms 대기, 수동 정리 진단, read-only lock status |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/state.ts` | D-close recovery marker 저장·복원, recovery 중 IDLE check epoch 보존 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/orchestrate-apply.ts` | reset 시 marker·check epoch 삭제, IDLE+marker를 실제 reset으로 처리 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/steering.ts` | `.steer.lock` 삭제, 공통 락 적용 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts` | D-close fail-closed, stale-round 청소 fail-open |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/hook.ts` | 채팅 D-close 연산 거부와 hook code 0 경계 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/review-round-cli.ts` | open/abort RMW 직렬화 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/review-observer.ts` | verdict·진단 append 직렬화, hook fail-open |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/goalplan.js` | `src/goalplan.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/state.js` | `src/state.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/orchestrate-apply.js` | `src/orchestrate-apply.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/steering.js` | `src/steering.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/orchestrate-cli.js` | `src/orchestrate-cli.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/hook.js` | `src/hook.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/review-round-cli.js` | `src/review-round-cli.ts` build 산출물 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/dist/review-observer.js` | `src/review-observer.ts` build 산출물 |
| NEW | `plugins/codexclaw/components/pabcd-state/test/goalplan-concurrency.test.ts` | 공통 락 단위 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/steering.test.ts` | 공통 락 경합 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts` | 전용 WSL 락 단언을 공통 락 경로 단언으로 교체 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts` | CLI D-close 락 실패 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/hook.test.ts` | 채팅 D-close 락 실패 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/review-binding.test.ts` | review CLI·observer 경합 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/state.test.ts` | persisted shape와 marker 복원 회귀 |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/orchestrate-apply.test.ts` | IDLE+marker reset 회귀 |
| MODIFY | `plugins/codexclaw/test/hook-e2e.test.mjs` | compiled SessionStart persisted state exact shape에 recovery 기본값 반영 |

`goalplan-cli.ts`, `goal-gate.ts`, `atomic-write.ts`, `skills/loop/SKILL.md`는 wp5에서 수정하지 않는다.
`skills/loop/SKILL.md` 변경은 wp6 소유다. wp6이 lifecycle과 의존 등록 표면을 추가할 때
`goalplan-cli.ts`와 SKILL 문서를 함께 갱신한다.

## 5. D-close marker와 멱등 커밋 계약

D-close는 CLI의 `args.attest.workPhaseId`, 채팅의 `command.attest.workPhaseId`를 trim한 값을
`closePhaseId`로 고정한다. slug가 없는 HITL D-close는 이 값을 요구하지 않고 기존 경로로 즉시
끝낸다. bound goalplan에서는 빈 plan과 all-done 특례를 먼저 판정한다. 그 밖의 bound close에서
빈 값은 target 조회 단계에서 `attest.workPhaseId is required`로 거부한다.

durable marker의 저장 위치는 `.codexclaw/sessions/<sessionId>.json` 안
`dcloseRecovery` 필드다. 별도 journal은 만들지 않는다. JSON shape는 아래 하나다.

```ts
export interface DcloseRecoveryMarker {
  sessionId: string;
  checkEpoch: string;
  closedWorkPhaseId: string;
}
```

정상 경로는 binding, `transition()`, receipt 검증을 먼저 모두 통과한다. 그 뒤 goalplan 락 안에서
target과 pending task를 다시 검사하고, plan을 쓰기 직전에 marker를 state에 기록한다. marker가
있는 IDLE state만 `checkEpoch`를 잠시 보존한다. plan·goalplan 원장, IDLE state, PABCD 원장까지
끝나면 goalplan 락을 다시 잡고 `dcloseRecovery: null`, `checkEpoch: null`로 state를 쓴다.

recovery 판정은 아래 세 비교가 모두 참일 때뿐이다. plan의 phase status와 기존 원장 행은 recovery
자격을 주지 않는다. marker가 맞으면 `closedWorkPhaseId`가 대상을 고정하므로 정상 경로의 target
검증(없으면 거부)은 건너뛴다. 다만 계약 §39 Y1에 따라 **그 고정 대상이 plan에서 이미 `done`인지는
확인하고, 아직 아니면 그 phase만 멱등하게 닫는다.** marker는 plan commit보다 먼저 기록되므로,
확인 없이 원장·state 정리로 건너뛰면 원장은 닫혔다고 말하고 plan은 열려 있는 상태가 남는다.
CLI와 채팅 모두 빈 plan, **marker recovery**, all-done, target 검증 순서를 같게 둔다. recovery가
all-done보다 앞인 이유는 계약 §39 Y2다. 마지막 work-phase를 커밋한 직후 crash하면 plan이 전부
`done`이 되므로, all-done이 먼저 오면 재시도가 `closedWorkPhaseId: null`로 기록하고 marker가
지목한 실제 대상이 원장에서 사라진다.

```ts
export function matchesDcloseRecovery(
  state: State,
  closePhaseId: string,
): state is State & { dcloseRecovery: DcloseRecoveryMarker } {
  const marker = state.dcloseRecovery;
  return marker !== null
    && marker.sessionId === state.sessionId
    && marker.checkEpoch === state.checkEpoch
    && marker.closedWorkPhaseId === closePhaseId;
}
```

marker가 없거나 세 값 중 하나라도 다르면 정상 D-close 경로를 탄다. 따라서 C에서는 active
work-phase binding, `transition()`, receipt를 다시 검사하고, IDLE에서는 기존 illegal transition으로
거부한다. 다만 work-phase가 하나 이상이고 모두 `done`이면 #49 정상 특례로 cycle만 IDLE로 닫는다.
이때 marker와 goalplan commit은 필요 없다. marker는 과거 done id로 현재 C를 건너뛰는 우회만 막으며,
이미 다 끝난 plan의 정상 cycle 종료를 막지 않는다. recovery가 맞으면 첫 시도에서 이미 통과한 gate를
다시 소비하지 않고 고정 target의 남은 커밋만 보충한다.

| 순서 | 락 | 커밋 | 직후 실패 시 관측 상태 | 같은 marker·target 재시도 |
| --- | --- | --- | --- | --- |
| 1 | 안 | session state에 marker 기록, phase는 C 유지 | marker 있음, plan 미변경 | recovery가 고정 대상이 `done`이 아님을 보고 2번을 멱등 수행 |
| 2 | 안 | `goalplan.json`: `closePhaseId`를 `done`으로 commit | target done, goalplan 원장 없음, state C+marker | recovery가 고정 대상이 이미 `done`임을 보고 plan write를 건너뛰고 3번부터 진행 |
| 3 | 안 | goalplan 원장: `workphase_done`, 필요하면 `workphase_started` append | plan·goalplan 원장 완료, state C+marker | 기존 행 확인 뒤 4번부터 진행 |
| 4 | 밖 | state를 IDLE로 write, marker와 check epoch는 잠시 보존 | FSM IDLE, PABCD 원장 없음 | IDLE recovery가 5번만 진행 |
| 5 | 다시 안 | PABCD 원장의 같은 3-tuple 확인·append | 기능 커밋 완료, marker 남음 | 같은 락 안 확인으로 중복 append 불가 |
| 6 | 5와 같은 임계 구역 | state의 marker와 check epoch 삭제 | 정상 완료 | 다음 D 요청은 recovery가 아니며 IDLE에서 거부 |

goalplan 원장 append나 PABCD append가 실제 write 뒤 throw해도 행 존재 확인으로 중복을 막는다.
PABCD close-row 확인·append·marker cleanup은 한 goalplan 락 callback 안에 있으며 check-then-append
경쟁이 없다.

1번 직후와 2번 직후의 재시도가 서로 다른 일을 하는 것이 계약 §39 Y1의 핵심이다. recovery는 marker의
`closedWorkPhaseId`로 plan에서 phase를 찾고, 없으면 이미 커밋됐다고 판정해 write를 생략하고, 있는데
`done`이 아니면 그 phase status 하나만 `done`으로 맞춰 commit한다. `advanceWorkPhase()`를 다시
부르지 않는다 — 커서는 첫 시도가 남긴 상태를 존중한다.

최종화 락 실패는 거부가 아니다. 계약 §39 Y3에 따라 4번 state write가 이미 락 밖에서 끝나 FSM이 IDLE이
된 뒤이므로, 전이를 되돌리지 않는다. CLI는 **code 0**으로 닫고 출력에 marker가 남아 다음 요청이 정리를
끝낸다는 사실을 적는다. 채팅 훅도 같은 문구를 내고 프로세스 code 0을 지킨다. §3 표의 `CLI D-close`
fail-closed 행은 **최초 락 실패**만 가리킨다. `owner.json`은 recovery 판정에 참여하지 않는다.

## 6. 파일별 diff

### 6.1 MODIFY — `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

#### before — 저수준 write만 존재

```ts
// wp4 적용 후 상태
/** Write a goalplan atomically (tmp + rename), refreshing updatedAt. */
export function writeGoalplan(cwd: string, plan: Goalplan): void {
```

#### after — 공통 락 API

상수는 `GOALPLAN_LEDGER_FILE` 다음에 추가한다. 타입과 함수는 `readGoalplan()` 다음,
`firstInvalidField()` 앞에 추가한다.

```ts
export const GOALPLAN_LOCK_DIR = ".goalplan.lock";
export const GOALPLAN_LOCK_OWNER_FILE = "owner.json";
export const GOALPLAN_LOCK_RETRY_DELAYS_MS = [5, 10, 20, 40] as const;

export interface GoalplanWriteLockOptions {
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => void;
  now?: () => string;
}

export type GoalplanWriteLockResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "locked"; reason: string }
  | { kind: "unreadable"; reason: string };

function sleepGoalplanLock(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function goalplanWriteLockDir(cwd: string, slug: string): string {
  return resolve(goalplanDir(cwd, slug), GOALPLAN_LOCK_DIR);
}

export interface GoalplanWriteLockStatus {
  path: string;
  exists: boolean;
  ageMs: number | null;
}

export function goalplanWriteLockStatus(
  cwd: string,
  slug: string,
  nowMs: number = Date.now(),
  stat: (path: string) => { mtimeMs: number } = statSync,
): GoalplanWriteLockStatus {
  const path = goalplanWriteLockDir(cwd, slug);
  if (!existsSync(path)) return { path, exists: false, ageMs: null };
  try {
    const ageMs = Math.max(0, nowMs - stat(path).mtimeMs);
    return { path, exists: true, ageMs };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { path, exists: false, ageMs: null };
    }
    throw err;
  }
}

function readGoalplanLockOwnerText(dir: string): string {
  try {
    return readFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "utf8").trim() || "(empty owner.json)";
  } catch {
    return "(owner.json unavailable)";
  }
}

export function withGoalplanWriteLock<T>(
  cwd: string,
  slug: string,
  fn: (plan: Goalplan) => T,
  options: GoalplanWriteLockOptions = {},
): GoalplanWriteLockResult<T> {
  validateGoalplanSlug(slug);
  const dir = goalplanWriteLockDir(cwd, slug);
  const delays = options.retryDelaysMs ?? GOALPLAN_LOCK_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? sleepGoalplanLock;
  const ownerPath = join(dir, GOALPLAN_LOCK_OWNER_FILE);

  if (!existsSync(goalplanPath(cwd, slug))) {
    return { kind: "unreadable", reason: `goalplan '${slug}' does not exist` };
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      mkdirSync(dir, { recursive: false });
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
      if (attempt >= delays.length) {
        const owner = readGoalplanLockOwnerText(dir);
        return {
          kind: "locked",
          reason:
            `goalplan '${slug}' is busy. Lock directory: ${dir}. owner=${owner}. `
            + `Inspect ${ownerPath}. After verifying no writer is active, remove that lock directory `
            + `with a tool for this platform.`,
        };
      }
      sleep(delays[attempt]);
    }
  }

  try {
    try {
      writeFileSync(
        ownerPath,
        `${JSON.stringify({ pid: process.pid, acquiredAt: (options.now ?? (() => new Date().toISOString()))() })}\n`,
        { mode: 0o600 },
      );
    } catch {
      // Diagnostic only. The directory itself is the lock.
    }

    const read = readGoalplanDetailed(cwd, slug);
    if (!read.plan) {
      return {
        kind: "unreadable",
        reason: read.diagnostic?.detail ?? `goalplan '${slug}' could not be read`,
      };
    }
    return { kind: "ok", value: fn(read.plan) };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // The next acquire reports the leftover path for platform-appropriate cleanup.
    }
  }
}
```

`owner.json`의 값은 오류 문자열에만 포함한다. 획득 루프는 파일을 읽지 않으며 `EEXIST`이면 정해진
대기 뒤 다시 `mkdirSync`만 실행한다.

`writeGoalplan()` 주석은 아래로 바꾼다.

```ts
/**
 * Low-level atomic publication (tmp + rename), refreshing updatedAt.
 * A new-plan create path may call this directly. A mutation of an existing plan
 * MUST call it inside withGoalplanWriteLock().
 */
export function writeGoalplan(cwd: string, plan: Goalplan): void {
```

`GoalplanLedgerEvent`와 `GoalplanLedgerEntry`는 wp5에서 바꾸지 않는다. 거부 이벤트와 거부 detail
필드도 추가하지 않는다.

선행 wp의 `node:fs` After를 출발점으로 삼아 `statSync`만 더한다. `node:path`의 `resolve`는 이미
선행 상태에 있으므로 다시 쓰지 않는다.

```ts
// wp4 적용 후 node:fs import 전체; 선행 wp 추가 이름 없음
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  rmSync,
  writeSync,
} from "node:fs";
```

```ts
// wp4 적용 후 + wp5 추가분: 기존 이름 전체 보존; wp5 statSync 추가
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
```
`goalplanWriteLockDir()`가 상대 `cwd`를 받아도 오류 문구에는 플랫폼 중립적인 절대 경로만 나온다.

`goalplanWriteLockStatus()`의 네 번째 인자는 ENOENT 경쟁을 결정적으로 재현하는 테스트 seam이다.
생산 호출은 넘기지 않는다. `EACCES`, `ENOTDIR` 같은 오류는 “락 없음”으로 숨기지 않고 그대로 던진다.

### 6.1.1 MODIFY — `plugins/codexclaw/components/pabcd-state/src/state.ts`

`DcloseRecoveryMarker`와 `State.dcloseRecovery`를 추가한다. marker는 plan의 `done` 상태나 원장
문구를 대신 읽는 힌트가 아니라 recovery 권위 상태다.

```ts
export interface DcloseRecoveryMarker {
  sessionId: string;
  checkEpoch: string;
  closedWorkPhaseId: string;
}

export interface State {
  // 기존 필드는 그대로 둔다.
  checkEpoch: string | null;
  dcloseRecovery: DcloseRecoveryMarker | null;
}

export interface LedgerEntry {
  // 기존 필드는 그대로 둔다.
  /** D-close 중복 판정 키. bound close가 아니면 null이다. */
  checkEpoch?: string | null;
  closedWorkPhaseId?: string | null;
}
```

`defaultState()`에는 `dcloseRecovery: null`을 넣는다. `readStateStrict()`는 세 문자열이 모두
비어 있지 않은 marker만 복원하며, marker의 `sessionId`가 현재 state key와 다르면 `null`로
정규화한다. C 또는 유효 marker가 남은 IDLE에서만 `checkEpoch`를 복원한다.

```ts
function reconstructDcloseRecovery(raw: unknown, sessionId: string): DcloseRecoveryMarker | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const marker = raw as Record<string, unknown>;
  if (marker.sessionId !== sessionId) return null;
  if (typeof marker.checkEpoch !== "string" || marker.checkEpoch.length === 0) return null;
  if (typeof marker.closedWorkPhaseId !== "string" || marker.closedWorkPhaseId.length === 0) return null;
  return {
    sessionId,
    checkEpoch: marker.checkEpoch,
    closedWorkPhaseId: marker.closedWorkPhaseId,
  };
}

const dcloseRecovery = reconstructDcloseRecovery(parsed.dcloseRecovery, sessionId);
const keepDcloseEpoch = parsed.phase === "IDLE" && dcloseRecovery !== null;

const rebuilt: State = {
  // 기존 복원 필드는 그대로 둔다.
  checkEpoch:
    (parsed.phase === "C" || keepDcloseEpoch)
      && typeof parsed.checkEpoch === "string"
      && parsed.checkEpoch.length > 0
      ? parsed.checkEpoch
      : null,
  dcloseRecovery,
};
```

같은 파일에서 `matchesDcloseRecovery()`를 export한다. §5의 본문을 그대로 쓰며 CLI와 채팅 경로가
하나의 predicate만 import한다. 각 경로에 느슨한 복사본을 만들지 않는다.

`writeState()`는 기존 atomic tmp+rename을 그대로 쓴다. marker 생성과 삭제 호출은 D-close 코드가
goalplan 락 안에서만 실행한다.

### 6.1.2 MODIFY — `plugins/codexclaw/components/pabcd-state/src/orchestrate-apply.ts`

이 파일은 `clearedIdle()`과 reset no-op 판정의 실제 소유자이므로 wp5 write scope에 넣는다. import는
바꾸지 않는다. `clearedIdle()`은 새 recovery 필드를 spread로 보존하지 않고 명시해서 지운다.

```diff
@@ export function clearedIdle(state: State): State {
     planUnit: null,
     planEpoch: null,
     checkEpoch: null,
+    dcloseRecovery: null,
   };
 }
@@ if (verb === "reset") {
-    if (state.phase === "IDLE") {
+    if (state.phase === "IDLE" && state.checkEpoch === null && state.dcloseRecovery === null) {
       return { ok: true, control: "reset", noop: true };
     }
```

따라서 정상 reset은 시작 phase와 무관하게 `checkEpoch: null`, `dcloseRecovery: null`을 저장한다.
IDLE이어도 marker나 check epoch가 남아 있으면 실제 reset state와 원장 행을 만들며 no-op이 아니다.

### 6.2 MODIFY — `plugins/codexclaw/components/pabcd-state/src/steering.ts`

#### before — 전용 락 import와 옵션

```ts
// wp4 적용 후 상태
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendGoalplanLedger,
  goalplanDir,
  readGoalplanDetailed,
  writeGoalplan,
  type Goalplan,
  type SteeringEntry,
} from "./goalplan.ts";
import { filesystemTier, type WslDeps } from "./wsl.ts";

export interface ApplyOptions {
  now?: () => string;
  /**
   * Filesystem probes for the lock-contention diagnostic. Injected so the drvfs
   * branch is reachable from a test on any OS; production reads /proc/mounts.
   */
  wslDeps?: WslDeps;
}
```

#### after — 공통 락 import와 옵션

wp4가 남긴 이름은 `appendGoalplanLedger`, `writeGoalplan`, `Goalplan`, `SteeringEntry`다. wp5는
`withGoalplanWriteLock`, `GoalplanWriteLockOptions`를 더하고, 삭제한 전용 락만 쓰던 이름은 제거한다.

```ts
// wp4 적용 후 + wp5 추가분: withGoalplanWriteLock, GoalplanWriteLockOptions
import {
  appendGoalplanLedger,
  withGoalplanWriteLock,
  writeGoalplan,
  type Goalplan,
  type GoalplanWriteLockOptions,
  type SteeringEntry,
} from "./goalplan.ts";

export interface ApplyOptions {
  now?: () => string;
  lock?: GoalplanWriteLockOptions;
}
```

`steering.ts:68-128`의 `lockDir`, `ownerPath`, `acquireLock`, `releaseLock`을 DELETE한다.
`applySteeringBatch()`의 현재 `existsSync` preflight부터 `finally`까지 다음으로 교체한다.

```ts
  const locked = withGoalplanWriteLock(cwd, slug, (plan): SteerResult => {
    const existing = (plan.steeringLog ?? []).find(
      (entry) => entry.idempotencyKey === batch.idempotencyKey,
    );
    if (existing) return { kind: "duplicate", entry: existing };

    const entry: SteeringEntry = {
      idempotencyKey: batch.idempotencyKey,
      rationale: batch.rationale,
      evidence: batch.evidence,
      appliedAt: now(),
      summary: `${batch.ops.length} op(s): ${batch.ops.map((op) => op.kind).join(", ")}`,
    };
    const applied = applyOps(plan, batch.ops);
    if ("error" in applied) return { kind: "rejected", reason: applied.error };

    const next: Goalplan = {
      ...applied.plan,
      steeringLog: [...(plan.steeringLog ?? []), entry],
    };
    writeGoalplan(cwd, next);
    try {
      appendGoalplanLedger(cwd, slug, {
        ts: entry.appliedAt,
        slug,
        event: "steered",
        detail: `${entry.idempotencyKey}: ${entry.summary} — ${entry.rationale}`,
      });
    } catch (err) {
      return {
        kind: "applied",
        plan: next,
        entry,
        warning:
          `the batch was applied but its ledger entry could not be written to `
          + `.codexclaw/goalplans/${slug}/ledger.jsonl `
          + `(${err instanceof Error ? err.message : String(err)}). `
          + `Re-running is a no-op because the key is recorded.`,
      };
    }
    return { kind: "applied", plan: next, entry };
  }, options.lock);

  if (locked.kind === "locked") return { kind: "locked", reason: locked.reason };
  if (locked.kind === "unreadable") {
    return { kind: "rejected", reason: `goalplan at slug '${slug}' is unusable - ${locked.reason}` };
  }
  return locked.value;
```

`SteerOp`은 wp5에서 확장하지 않는다. wp6이 기존 `add-work-phase`에 `dependsOn?: string[]`만 붙인다.

### 6.3 MODIFY — `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`

실제 현재 파일의 `node:fs` import에는 `existsSync`, `readFileSync`가 있고 `node:path` import에는
`join`이 있다. 둘은 helper가 그대로 재사용한다. goalplan import와 state import는 wp4 적용 후
상태를 보존한 아래 **누적 전체 After**로 교체한다. wp4 추가 이름은 `dependencyDeadlock`이다.
특히 PABCD 원장 경로에 쓰는 `LEDGER_FILE`을 빼지
않는다. 다른 read-only 호출이 남아 있으므로 `readGoalplan`도 유지한다.

```ts
// wp4 적용 후 + wp5 추가분: wp4 dependencyDeadlock 보존; wp5 lock/ledger/recovery/integrity 이름 추가
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  GOALPLAN_LEDGER_FILE,
  goalplanDir,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  readGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";
import {
  appendLedger,
  findForeignSessionCopies,
  LEDGER_FILE,
  matchesDcloseRecovery,
  readState,
  SESSIONS_SUBDIR,
  STATE_DIR,
  writeState,
  type Phase,
  type State,
} from "./state.ts";
```

#### before — wp4의 의존 교착 안내가 적용된 D-close

```ts
// wp4 적용 후 상태
if (advanced.kind === "no_active") {
  const closable = plan.workPhases.length > 0 && plan.workPhases.every((wp) => wp.status === "done");
  if (closable) {
    advanced = { kind: "ok", closedId: null, plan };
  } else {
    const deadlock = dependencyDeadlock(plan);
    const reason = plan.workPhases.length === 0
      ? "the plan is empty — register workPhases[] first"
      : deadlock
        ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
        : "every remaining work-phase is blocked or superseded — unblock one";
    return {
      code: 1,
      output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${state.slug}" has no work-phase to close (CYCLE-COMPLETION-01): ${reason}. Nothing was written.`,
    };
  }
}

writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
appendLedger(args.cwd, {
  ts: new Date().toISOString(),
  sessionId: state.sessionId,
  from: state.phase,
  to: "IDLE",
  reason: "done",
  ...(args.attest?.did ? { evidence: args.attest.did } : {}),
});
if (advanced && advanced.kind === "ok") {
  writeGoalplan(args.cwd, advanced.plan);
  appendGoalplanLedger(args.cwd, state.slug, {
    ts: new Date().toISOString(),
    slug: state.slug,
    event: "workphase_done",
    detail: advanced.closedId
      ? `closed ${advanced.closedId}`
      : "cycle closed over an already-complete plan",
  });
}
```

#### after — 닫기 대상을 고정한 멱등 D-close

위 전체 After import를 적용한 뒤 아래 helper 세 개를 같은 파일에 둔다.
`runOrchestrateCli()`에는 테스트 전용 두 번째 인자 `commitHooks: OrchestrateCommitHooks = {}`를
추가한다. production caller는 두 번째 인자를 넘기지 않는다.

```ts
export interface OrchestrateCommitHooks {
  afterRecoveryMarkerWrite?: () => void;
  afterGoalplanCommit?: () => void;
  afterStateWrite?: () => void;
  afterPabcdLedgerAppend?: () => void;
}

function readJsonlObjects(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function hasGoalplanRow(cwd: string, slug: string, event: string, detail: string): boolean {
  return readJsonlObjects(join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE))
    .some((row) => row.event === event && row.detail === detail);
}

function hasPabcdCloseRow(
  cwd: string,
  sessionId: string,
  checkEpoch: string | null,
  closedWorkPhaseId: string | null,
): boolean {
  return readJsonlObjects(join(cwd, STATE_DIR, LEDGER_FILE)).some(
    (row) => row.sessionId === sessionId && row.from === "C"
      && row.to === "IDLE" && row.reason === "done"
      && row.checkEpoch === checkEpoch
      && row.closedWorkPhaseId === closedWorkPhaseId,
  );
}
```

기존 선언 한 줄은 아래 선언으로 교체하고 함수 본문은 이어 붙인다.

```ts
export function runOrchestrateCli(args: OrchestrateCliArgs | OrchestrateCliHelpArgs, commitHooks: OrchestrateCommitHooks = {}): CliResult {
```

`const state = readState(args.cwd, sessionId)` 직후, 기존 binding gate와 `transition()`보다 먼저 아래
값을 정한다.

```ts
const closePhaseId = args.verb === "D" ? args.attest?.workPhaseId?.trim() ?? "" : "";
const recoveringDclose = args.verb === "D" && matchesDcloseRecovery(state, closePhaseId);
```

`recoveringDclose`일 때만 기존 effective-active binding, `transition()`, receipt 재검증을 건너뛴다.
marker가 없거나 어긋나면 정상 gate를 전부 실행한다. all-done 특례는 별도 정상 종료로 이어진다.
`closePhaseId`가 빈 bound D-close는 빈 plan·all-done 판정 뒤 5번 target 단계에서 확정 실패한다.

receipt 검증 다음의 bound-plan 분기를 아래로 교체한다.

CLI D-close 검사 순서는 §35의 여덟 단계로 고정한다. slug 없는 HITL을 먼저 끝내므로 빈 slug가
`withGoalplanWriteLock()`에 들어갈 수 없다. bound callback은 빈 plan과 all-done을 target보다 먼저
판정한다. `attest.workPhaseId` 필수 검사는 5번 target 검사에 포함한다.

| 순서 | 검사 | 결과·실패 문자열 | 기존 단언 처분 |
| --- | --- | --- | --- |
| 1 | slug가 없는 HITL인가 | `writeState` + PABCD `appendLedger` 뒤 옛 성공 문구로 즉시 return | `orchestrate-cli.test.ts:908`에 옛 문구 단언을 추가한다 |
| 2 | bound plan의 `workPhases.length === 0`인가 | `the plan is empty — register workPhases[] first`로 거부 | 기존 `/the plan is empty/` 단언을 그대로 둔다 |
| 3 | work-phase가 하나 이상이고 모두 `done`인가 | 새 marker 없이 cycle만 IDLE로 닫는다 | 기존 all-done 성공 테스트를 그대로 성공으로 둔다 |
| 4 | recovery marker의 세 값이 모두 맞는가 | 이미 통과한 gate를 다시 쓰지 않고 남은 commit만 보충한다 | 세 실패 주입 재시도 테스트가 맡는다 |
| 5 | target이 plan에 있는가 | 빈 id는 `attest.workPhaseId is required`, 없는 id는 `work-phase <id> is not in the bound goalplan`로 거부 | wp5 고정 target 음성 경로 |
| 6 | target에 pending task가 남았는가 | 기존 `tasks_pending` 문구로 거부 | 기존 open-task 단언을 보존한다 |
| 7 | 남은 work-phase가 의존 교착인가 | `dependencyDeadlock()`의 `Dependency deadlock: ...` 진단으로 거부 | wp4 After를 보존한다 |
| 8 | 정상 close인가 | 락 안에서 plan commit + goalplan 원장, 락 밖에서 state + PABCD 원장 | bound 성공 문구와 멱등 테스트를 wp5가 맡는다 |

```ts
    // §35-1: unbound HITL keeps the pre-wp5 path byte-for-byte. It never takes a
    // goalplan lock and never enters marker cleanup.
    if (!state.slug) {
      writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
      appendLedger(args.cwd, {
        ts: new Date().toISOString(),
        sessionId: state.sessionId,
        from: state.phase,
        to: "IDLE",
        reason: "done",
        ...(args.attest?.did ? { evidence: args.attest.did } : {}),
      });
      return { code: 0, output: `orchestrate D: current=${state.phase} -> IDLE (${state.phase} → IDLE, cycle closed, session ${sessionId})` };
    }

    const slug = state.slug;
    let allDoneClose = false;
    const locked = withGoalplanWriteLock(args.cwd, slug, (plan) => {
        // §5: integrity is checked inside the lock, before marker or any write.
        const integrityReasons = [
          ...goalplanDefinitionIntegrityReasons(plan),
          ...goalplanDependencyCompletionReasons(plan),
        ];
        if (integrityReasons.length > 0) {
          return {
            code: 1 as const,
            allDone: false as const,
            output: `orchestrate D: invalid goalplan: ${integrityReasons.join("; ")}. Nothing was written.`,
          };
        }
        // §35-2: preserve the existing empty-plan refusal before target lookup.
        if (plan.workPhases.length === 0) {
          return {
            code: 1 as const,
            allDone: false as const,
            output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${slug}" has no work-phase to close (CYCLE-COMPLETION-01): the plan is empty — register workPhases[] first. Nothing was written.`,
          };
        }

        // §39 Y2: recovery comes BEFORE the all-done special case. Crashing right
        // after the final work-phase was committed leaves an all-done plan, so
        // checking all-done first would re-enter it as a plain cycle close and
        // record closedWorkPhaseId: null — losing the target the marker names.
        let closedPlan = plan;
        let writeClosedPlan = false;
        if (recoveringDclose) {
          // §39 Y1: the marker is written BEFORE the plan commit, so a matching
          // marker does not prove the plan was closed. Look the fixed target up —
          // this is not the §38 X2 "target validation" that refuses on absence.
          // Absent means a later edit removed it and the commit is not ours to
          // redo; present-but-open means the marker-then-crash case and we close
          // exactly that phase. advanceWorkPhase() is NOT called again: the cursor
          // belongs to whatever the first attempt already persisted.
          const fixed = plan.workPhases.find((workPhase) => workPhase.id === closePhaseId);
          if (fixed && fixed.status !== "done") {
            closedPlan = {
              ...plan,
              workPhases: plan.workPhases.map((workPhase) =>
                workPhase.id === closePhaseId ? { ...workPhase, status: "done" as const } : workPhase
              ),
            };
            writeClosedPlan = true;
          }
        } else {
          // §35-3 / #49: an already-complete non-empty plan closes the cycle only.
          // No marker, plan write, or goalplan ledger row is needed. This is now
          // inside the non-recovery branch so a matching marker always wins.
          if (plan.workPhases.every((workPhase) => workPhase.status === "done")) {
            return { code: 0 as const, allDone: true as const };
          }
          // §35-5: input and target membership checks follow all-done and recovery.
          if (!closePhaseId) {
            return {
              code: 1 as const,
              allDone: false as const,
              output: "orchestrate D: attest.workPhaseId is required. Nothing was written.",
            };
          }
          const target = plan.workPhases.find((workPhase) => workPhase.id === closePhaseId);
          if (!target) {
            return {
              code: 1 as const,
              allDone: false as const,
              output: `orchestrate D: work-phase ${closePhaseId} is not in the bound goalplan. Nothing was written.`,
            };
          }
          const advanced = advanceWorkPhase(plan);
          // §35-6: pending tasks are refused before no-active/deadlock handling.
          if (advanced.kind === "tasks_pending") {
            const open = advanced.pending.map((task) => `${task.id} (${task.title})`).join("; ");
            return {
              code: 1 as const,
              allDone: false as const,
              output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; work-phase ${advanced.workPhaseId} still has ${advanced.pending.length} open task(s), so this cycle cannot close (CYCLE-COMPLETION-01): ${open}. Nothing was written.`,
            };
          }
          // §35-7: all-done was consumed above, so no_active now means a real
          // unavailable/deadlocked remainder. Prefer dependencyDeadlock() detail.
          if (advanced.kind === "no_active") {
            const deadlock = dependencyDeadlock(plan);
            const reason = deadlock
              ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
              : "every remaining work-phase is blocked or superseded — unblock one";
            return {
              code: 1 as const,
              allDone: false as const,
              output: `orchestrate D: ${renderPhaseContext(state, sessionId)}; the bound goalplan "${slug}" has no work-phase to close (CYCLE-COMPLETION-01): ${reason}. Nothing was written.`,
            };
          }
          if (advanced.closedId !== closePhaseId) {
            return {
              code: 1 as const,
              allDone: false as const,
              output: `orchestrate D: fixed close target ${closePhaseId} does not match active work-phase ${advanced.closedId}. Nothing was written.`,
            };
          }
          closedPlan = advanced.plan;
          writeClosedPlan = true;

          // §35-8: only the normal bound close mints a marker and commits the plan.
          if (state.phase !== "C" || !state.checkEpoch) {
            return {
              code: 1 as const,
              allDone: false as const,
              output: "orchestrate D: current C check epoch is required. Nothing was written.",
            };
          }
          writeState(args.cwd, {
            ...state,
            dcloseRecovery: {
              sessionId: state.sessionId,
              checkEpoch: state.checkEpoch,
              closedWorkPhaseId: closePhaseId,
            },
          });
          commitHooks.afterRecoveryMarkerWrite?.();
        }
        if (writeClosedPlan) {
          writeGoalplan(args.cwd, closedPlan);
          commitHooks.afterGoalplanCommit?.();
        }

        if (!hasGoalplanRow(args.cwd, slug, "workphase_done", `closed ${closePhaseId}`)) {
          appendGoalplanLedger(args.cwd, slug, {
            ts: new Date().toISOString(), slug, event: "workphase_done",
            detail: `closed ${closePhaseId}`,
          });
        }
        const startedId = closedPlan.activeWorkPhaseId;
        if (startedId && !hasGoalplanRow(args.cwd, slug, "workphase_started", `started ${startedId}`)) {
          appendGoalplanLedger(args.cwd, slug, {
            ts: new Date().toISOString(), slug, event: "workphase_started",
            detail: `started ${startedId}`,
          });
        }
        return { code: 0 as const, allDone: false as const };
      });

    if (locked.kind === "locked") {
      return { code: 1, output: `orchestrate D: ${locked.reason} D-close was not applied. Nothing was written.` };
    }
    if (locked.kind === "unreadable") {
      return { code: 1, output: `orchestrate D: the bound goalplan "${slug}" could not be read (CYCLE-COMPLETION-01): ${locked.reason}. Nothing was written.` };
    }
    if (locked.value.code !== 0) return locked.value;
    allDoneClose = locked.value.allDone;

    const recovery = readState(args.cwd, sessionId).dcloseRecovery;
    const closeCheckEpoch = recovery?.checkEpoch ?? state.checkEpoch;
    const closedWorkPhaseId = allDoneClose ? null : closePhaseId;
    if (state.phase !== "IDLE") {
      writeState(args.cwd, {
        ...clearedIdle(state),
        checkEpoch: allDoneClose ? null : recovery?.checkEpoch ?? null,
        dcloseRecovery: allDoneClose ? null : recovery,
        stopBlockPhase: null,
        stopBlockCount: 0,
      });
      commitHooks.afterStateWrite?.();
    }
    // check + append + marker cleanup is one critical section. Two recoveries
    // cannot both observe an absent 3-tuple.
    const finalize = withGoalplanWriteLock(args.cwd, slug, () => {
      if (!hasPabcdCloseRow(args.cwd, sessionId, closeCheckEpoch, closedWorkPhaseId)) {
        appendLedger(args.cwd, {
          ts: new Date().toISOString(), sessionId: state.sessionId, from: "C", to: "IDLE", reason: "done",
          checkEpoch: closeCheckEpoch,
          closedWorkPhaseId,
          ...(args.attest?.did ? { evidence: args.attest.did } : {}),
        });
        commitHooks.afterPabcdLedgerAppend?.();
      }
      const current = readState(args.cwd, sessionId);
      if (matchesDcloseRecovery(current, closePhaseId)) {
        writeState(args.cwd, { ...current, checkEpoch: null, dcloseRecovery: null });
      }
    });
    if (finalize.kind !== "ok") {
      return {
        // §39 Y3: not a refusal. The state write above already moved the FSM to
        // IDLE outside the lock, so returning code 1 here would report a failure
        // for a cycle that is functionally closed. The marker survives and the
        // next D request for the same tuple finishes the cleanup.
        code: 0,
        output: `orchestrate D: close target ${closePhaseId} is committed and the cycle is closed, but ledger/marker finalization is pending: ${finalize.reason}. Run the same D request again once the lock clears.`,
      };
    }
    return { code: 0, output: `orchestrate D: close target ${closePhaseId} is complete (cycle closed, session ${sessionId})` };
```

`dependencyDeadlock()`이 내는 `reasons`는 wp3의 정본 문자열을 그대로 전달한다. all-done plan은
marker 없이 기존 #49 특례로 cycle만 닫는다. plan 일부만 done인 상태에서 과거 phase id를 attest하는
요청은 성공 특례가 아니다. marker가 없으므로 정상 binding과 transition gate에서 거부한다.

wp4가 신설하는 `dependencyWaitReasons(plan)`은 ready 항목이 남은 부분 대기를 열거한다. 이
문서의 `dependencyDeadlock(plan)` 호출은 ready가 하나도 없는 **전역 교착 판정 전용**이므로
교체하지 않는다. 두 helper의 역할은 겹치지 않는다.

bound plan의 plan write와 goalplan 원장 append는 callback 안에 한 번만 둔다. 기존
`orchestrate-cli.ts:667-695` 블록은 DELETE한다. slug가 없는 HITL D-close는 위 첫 분기에서 기존
state/PABCD 원장과 옛 성공 문구를 남긴 뒤 즉시 return한다. 따라서 락 획득, marker 정리,
`close target ... is complete` 문구는 bound 성공 뒤에서만 실행된다.

P→A stale-round 청소는 read부터 append까지 callback에 넣는다. 락 결과가 `ok`가 아니어도 예외를
던지지 않고 다음 `writeState`로 간다.

```ts
  if (planBinding && state.slug) {
    try {
      withGoalplanWriteLock(args.cwd, state.slug, (plan) => {
        const stranded = (plan.reviewRounds ?? []).find(
          (round) => round.purpose === "plan_audit"
            && round.ownerSessionId === sessionId
            && round.planEpoch !== undefined
            && round.planEpoch !== planBinding.epoch
            && round.status !== "approved"
            && round.status !== "changes_requested"
            && round.status !== "inconclusive",
        );
        const swept = supersedeStaleRounds(
          plan,
          "plan_audit",
          sessionId,
          stranded?.planEpoch ?? null,
        );
        if (swept.closed.length === 0) return;
        writeGoalplan(args.cwd, swept.plan);
        for (const roundId of swept.closed) {
          appendGoalplanLedger(args.cwd, state.slug!, {
            ts: new Date().toISOString(),
            slug: state.slug!,
            event: "review_round_superseded",
            detail: "the plan was re-planned, so this round can no longer be spent",
            roundId,
          });
        }
      });
    } catch {
      // Housekeeping is fail-open. The P-to-A edge continues.
    }
  }
```

### 6.4 MODIFY — `plugins/codexclaw/components/pabcd-state/src/hook.ts`

채팅 D-close도 `withGoalplanWriteLock()` callback 안에서 plan을 재독·검사·커밋한다. 락 실패 시
`writeState()`와 `appendLedger()`에 도달하지 않는다.

실제 현재 `hook.ts`에는 `node:fs`와 `node:path` import가 없고 state import는 한 줄이다. wp4
After와 현재 import를 적층한 최종 import는 아래와 같다. 이 파일이 호출하는 helper의 의존성을
다른 파일에 맡기지 않는다.

```ts
// wp4 적용 후 + wp5 추가분: wp4 dependencyDeadlock 보존; wp5 fs/path/ledger/recovery/integrity 이름 추가
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendLedger,
  ensureState,
  LEDGER_FILE,
  matchesDcloseRecovery,
  readState,
  STATE_DIR,
  writeState,
  type Phase,
  type State,
} from "./state.ts";
import { applyHumanTransition, clearedIdle, type ApplyResult } from "./orchestrate-apply.ts";
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  GOALPLAN_LEDGER_FILE,
  goalplanDir,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  nextOpenTask,
  readGoalplan,
  unmetCriteria,
  withGoalplanWriteLock,
  writeGoalplan,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";
```

위 import 바로 뒤의 private helper After도 이 파일 안에 전부 둔다.

```ts
function readJsonlObjects(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function hasGoalplanRow(cwd: string, slug: string, event: string, detail: string): boolean {
  return readJsonlObjects(join(goalplanDir(cwd, slug), GOALPLAN_LEDGER_FILE))
    .some((row) => row.event === event && row.detail === detail);
}

function hasPabcdCloseRow(
  cwd: string,
  sessionId: string,
  checkEpoch: string | null,
  closedWorkPhaseId: string | null,
): boolean {
  return readJsonlObjects(join(cwd, STATE_DIR, LEDGER_FILE)).some(
    (row) => row.sessionId === sessionId && row.from === "C"
      && row.to === "IDLE" && row.reason === "done"
      && row.checkEpoch === checkEpoch
      && row.closedWorkPhaseId === closedWorkPhaseId,
  );
}
```

채팅 경로도 실패 지점을 정확히 주입할 수 있게 생산 기본값이 빈 객체인 seam을 둔다.

```ts
export interface HookDcloseCommitHooks {
  afterStateWrite?: () => void;
  afterPabcdLedgerAppend?: () => void;
}

export function handleUserPromptSubmit(
  payload: UserPromptSubmitPayload,
  platform: NodeJS.Platform = process.platform,
  dcloseCommitHooks: HookDcloseCommitHooks = {},
): string {
```

기존 `platform` 두 번째 인자는 `loopArmDirective(platform)`의 입력이므로 그대로 둔다. parser 경로는
hook 객체를 private handler에 명시적으로 넘긴다. 선언과 호출 diff는 아래와 같다.

```diff
@@ export function handleUserPromptSubmit(
-    const out = handleOrchestrateCommand(payload, state, turn, command);
+    const out = handleOrchestrateCommand(payload, state, turn, command, dcloseCommitHooks);

@@ function handleOrchestrateCommand(
   command: NonNullable<ReturnType<typeof parseOrchestrateCommand>>,
+  dcloseCommitHooks: HookDcloseCommitHooks,
 ): string | null {
```

#### before — wp4 의존 교착 안내 적용 후

```ts
// wp4 적용 후 상태
plan = readGoalplan(payload.cwd, state.slug);
advanced = advanceWorkPhase(plan);
if (advanced.kind === "no_active") {
  const deadlock = dependencyDeadlock(plan);
  const detail = deadlock
    ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
    : `the bound goalplan "${state.slug}" has no active work-phase to close`;
  return buildContextOutput(
    "UserPromptSubmit",
    `[codexclaw — refused: ${detail} (CYCLE-COMPLETION-01). Nothing was written.]`,
  );
}
writeState(payload.cwd, result.state);
appendLedger(payload.cwd, result.ledger);
writeGoalplan(payload.cwd, advanced.plan);
```

#### after — 락 결과 경계

현재 `applyHumanTransition()` 호출보다 앞에서는 `closePhaseId` 값만 읽고 recovery 후보를 판정한다.
bound `workPhaseId` 필수 검사는 락 안의 빈 plan·all-done 검사 뒤에 둔다. marker가 맞는 재시도만
기존 C→D 결과를 합성하며, 그 밖에는 기존 transition 결과를 그대로 쓴다.

```ts
const closePhaseId = command.verb === "D" ? command.attest?.workPhaseId?.trim() ?? "" : "";
const recoveringDclose = command.verb === "D" && matchesDcloseRecovery(state, closePhaseId);
let closedWorkPhaseId: string | null = closePhaseId || null;
const result: ApplyResult = recoveringDclose
  ? {
      ok: true as const,
      control: "done" as const,
      state: { ...clearedIdle(state), checkEpoch: state.checkEpoch, dcloseRecovery: state.dcloseRecovery },
      ledger: {
        ts: new Date().toISOString(),
        sessionId: state.sessionId,
        from: "C",
        to: "IDLE",
        reason: "done",
        ...(command.attest?.did ? { evidence: command.attest.did } : {}),
      },
      noop: false,
    }
  : applyHumanTransition(state, command.verb, command.attest);
```

recovery가 아닌 요청만 기존 binding, `applyHumanTransition()`, receipt 검증을 탄다. recovery에서는
PABCD close row가 없을 때만 `{ from: "C", to: "IDLE", reason: "done" }` 행을 합성해 append한다.
`orchestrate-apply.ts` import에는 `clearedIdle`, `type ApplyResult`를 추가한다.

```ts
    // wp4 적용 후 상태에 wp5 락과 고정 target만 덧붙인다.
    const locked = withGoalplanWriteLock(payload.cwd, state.slug, (plan) => {
      // §5: integrity is checked inside the lock, before marker or any write.
      const integrityReasons = [
        ...goalplanDefinitionIntegrityReasons(plan),
        ...goalplanDependencyCompletionReasons(plan),
      ];
      if (integrityReasons.length > 0) {
        return {
          output: buildContextOutput(
            "UserPromptSubmit",
            `[codexclaw — refused: invalid goalplan: ${integrityReasons.join("; ")}. Nothing was written.]`,
          ),
          advanced: null,
        };
      }
      if (plan.workPhases.length === 0) {
        return {
          output: buildContextOutput(
            "UserPromptSubmit",
            `[codexclaw — refused: the bound goalplan "${state.slug}" has no active work-phase to close (CYCLE-COMPLETION-01). Nothing was written.]`,
          ),
          advanced: null,
        };
      }
      // §35-3: a non-empty all-done plan closes only the cycle. It needs no
      // target and writes no recovery marker or goalplan row.
      if (plan.workPhases.every((workPhase) => workPhase.status === "done")) {
        closedWorkPhaseId = null;
        return { output: "", advanced: null };
      }
      // §35-4: a matching marker resumes cleanup without target lookup. The
      // marker's closedWorkPhaseId remains authoritative even if that phase no
      // longer appears in the partially committed plan.
      let closeResult: AdvanceResult;
      let writeClosedPlan = false;
      if (recoveringDclose) {
        closeResult = { kind: "ok" as const, closedId: closePhaseId, plan };
      } else {
        // §35-5: target validation follows empty-plan, all-done, and recovery.
        if (!closePhaseId) {
          return {
            output: buildContextOutput(
              "UserPromptSubmit",
              "[codexclaw — refused: bound chat D-close requires attest.workPhaseId. Nothing was written.]",
            ),
            advanced: null,
          };
        }
        const target = plan.workPhases.find((workPhase) => workPhase.id === closePhaseId);
        if (!target) {
          return {
            output: buildContextOutput(
              "UserPromptSubmit",
              `[codexclaw — refused: work-phase ${closePhaseId} is not in the bound goalplan. Nothing was written.]`,
            ),
            advanced: null,
          };
        }
        closeResult = advanceWorkPhase(plan);
        writeClosedPlan = true;
      }
      if (closeResult.kind === "tasks_pending") {
        const open = closeResult.pending.map((task) => `${task.id} (${task.title})`).join("; ");
        return {
          output: buildContextOutput(
            "UserPromptSubmit",
            `[codexclaw — refused: work-phase ${closeResult.workPhaseId} still has `
              + `${closeResult.pending.length} open task(s), so this cycle cannot close `
              + `(CYCLE-COMPLETION-01): ${open}. Nothing was written.]`,
          ),
          advanced: null,
        };
      }
      if (closeResult.kind === "no_active") {
        const deadlock = dependencyDeadlock(plan);
        const detail = deadlock
          ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
          : `the bound goalplan "${state.slug}" has no active work-phase to close`;
        return {
          output: buildContextOutput(
            "UserPromptSubmit",
            `[codexclaw — refused: ${detail} (CYCLE-COMPLETION-01). Nothing was written.]`,
          ),
          advanced: null,
        };
      }

      if (!recoveringDclose && closeResult.closedId !== closePhaseId) {
        return {
          output: buildContextOutput(
            "UserPromptSubmit",
            `[codexclaw — refused: fixed close target ${closePhaseId} does not match active work-phase ${closeResult.closedId}. Nothing was written.]`,
          ),
          advanced: null,
        };
      }
      if (!recoveringDclose) {
        if (state.phase !== "C" || !state.checkEpoch) {
          return {
            output: buildContextOutput(
              "UserPromptSubmit",
              "[codexclaw — refused: current C check epoch is required. Nothing was written.]",
            ),
            advanced: null,
          };
        }
        writeState(payload.cwd, {
          ...state,
          dcloseRecovery: {
            sessionId: state.sessionId,
            checkEpoch: state.checkEpoch,
            closedWorkPhaseId: closePhaseId,
          },
        });
      }
      if (writeClosedPlan) {
        writeGoalplan(payload.cwd, closeResult.plan);
      }
      if (!hasGoalplanRow(payload.cwd, state.slug!, "workphase_done", `closed ${closePhaseId}`)) {
        appendGoalplanLedger(payload.cwd, state.slug!, {
          ts: new Date().toISOString(),
          slug: state.slug!,
          event: "workphase_done",
          detail: `closed ${closePhaseId}`,
        });
      }
      const startedId = closeResult.plan.activeWorkPhaseId;
      if (startedId && !hasGoalplanRow(payload.cwd, state.slug!, "workphase_started", `started ${startedId}`)) {
        appendGoalplanLedger(payload.cwd, state.slug!, {
          ts: new Date().toISOString(), slug: state.slug!, event: "workphase_started",
          detail: `started ${startedId}`,
        });
      }
      return { output: "", advanced: closeResult };
    });

    if (locked.kind === "locked") {
      return buildContextOutput(
        "UserPromptSubmit",
        `[codexclaw — D-close was not applied: ${locked.reason} `
          + `The phase and goalplan ledger were not changed.]`,
      );
    }
    if (locked.kind === "unreadable") {
      return buildContextOutput(
        "UserPromptSubmit",
        `[codexclaw — D-close was not applied: the bound goalplan could not be read `
          + `(${locked.reason}). Nothing was written.]`,
      );
    }
    if (locked.value.output) return locked.value.output;
    advanced = locked.value.advanced;
```

hook retry는 marker가 일치하면 `closePhaseId`를 plan에서 찾지 않고 plan도 다시 바꾸지 않는다.
all-done 분기의 `{ output: "", advanced: null }`은 target·marker·goalplan 원장 없이 아래
state/PABCD cycle close만 실행하며 `closedWorkPhaseId`를 `null`로 고정한다. 사용자가
`workPhaseId`를 넣어도 이 값을 원장에 복사하지 않는다. wp4의
`Dependency deadlock: ${deadlock.reasons.join("; ")}` 문구는 바꾸지 않는다.

이 블록이 성공한 뒤에만 IDLE state를 쓴다. IDLE write는 marker와 check epoch를 보존한다. 그 뒤
goalplan 락을 다시 잡아 PABCD 원장의 3-tuple 확인·append와 marker 삭제를 한 임계 구역에서 끝낸다.

```ts
const recovery = readState(payload.cwd, payload.session_id).dcloseRecovery;
const closeCheckEpoch = recovery?.checkEpoch ?? state.checkEpoch;
writeState(payload.cwd, {
  ...result.state!,
  checkEpoch: recovery?.checkEpoch ?? null,
  dcloseRecovery: recovery,
});
dcloseCommitHooks.afterStateWrite?.();
const finalize = withGoalplanWriteLock(payload.cwd, state.slug, () => {
  if (result.ledger && !hasPabcdCloseRow(
    payload.cwd,
    payload.session_id,
    closeCheckEpoch,
    closedWorkPhaseId,
  )) {
    appendLedger(payload.cwd, {
      ...result.ledger,
      checkEpoch: closeCheckEpoch,
      closedWorkPhaseId,
    });
    dcloseCommitHooks.afterPabcdLedgerAppend?.();
  }
  const current = readState(payload.cwd, payload.session_id);
  if (matchesDcloseRecovery(current, closePhaseId)) {
    writeState(payload.cwd, { ...current, checkEpoch: null, dcloseRecovery: null });
  }
});
if (finalize.kind !== "ok") {
  return buildContextOutput(
    "UserPromptSubmit",
    `[codexclaw — D-close was committed, but ledger/marker finalization is pending: ${finalize.reason}]`,
  );
}
```

현재 `hook.ts:894-916`의 plan write 블록은 DELETE한다. outer hook dispatcher는
`cli.ts:307-390`의 catch와 `process.exit(0)`을 유지한다. `hook.ts`의 state import에는
`matchesDcloseRecovery`, goalplan import에는 `dependencyDeadlock`을 남긴다.

#### wp6가 이어받을 최종 hook import와 호출 위치

060의 Before는 아래 **wp5 적용 후 상태**를 그대로 쓴다. import 일부만 발췌한 블록이 아니라
wp5가 바꾼 네 import의 전체 After다. helper 세 개의 본문은 §6.4의 After를 함께 보존한다.

```ts
// wp4 적용 후 + wp5 추가분: wp4 dependencyDeadlock 보존; wp5 fs/path/ledger/recovery/integrity 이름 추가
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendLedger,
  ensureState,
  LEDGER_FILE,
  matchesDcloseRecovery,
  readState,
  STATE_DIR,
  writeState,
  type Phase,
  type State,
} from "./state.ts";
import { applyHumanTransition, clearedIdle, type ApplyResult } from "./orchestrate-apply.ts";
import {
  advanceWorkPhase,
  appendGoalplanLedger,
  dependencyDeadlock,
  effectiveActiveWorkPhaseId,
  GOALPLAN_LEDGER_FILE,
  goalplanDir,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  nextOpenTask,
  readGoalplan,
  unmetCriteria,
  withGoalplanWriteLock,
  writeGoalplan,
  type AdvanceResult,
  type Goalplan,
} from "./goalplan.ts";

// wp5 적용 후 hook.ts 채팅 D-close callback 안의 no_active 분기
if (closeResult.kind === "no_active") {
  const deadlock = dependencyDeadlock(plan);
  const detail = deadlock
    ? `Dependency deadlock: ${deadlock.reasons.join("; ")}`
    : `the bound goalplan "${state.slug}" has no active work-phase to close`;
  return {
    output: buildContextOutput(
      "UserPromptSubmit",
      `[codexclaw — refused: ${detail} (CYCLE-COMPLETION-01). Nothing was written.]`,
    ),
    advanced: null,
  };
}
```

060은 ready 목록을 더할 때 위 `dependencyDeadlock` import와 호출을 보존해야 하며, `waitingOn`
또는 동등한 필드에 이 사유를 남긴다.

#### 공개 채팅 D-close 안내

`loopArmDirective()`의 bound 안내에 아래 한 줄을 추가하고, 같은 파일의 C phase 예시에 이미 있는
`workPhaseId`와 `testReceiptPath`는 유지한다.

```ts
"   Bound chat D-close requires workPhaseId as the fixed close target unless every work-phase is already done.",
```

`hook.test.ts`의 pinned POSIX snapshot에도 같은 위치와 문자열을 추가한다. CLI help의 bound C→D
예시는 이미 `workPhaseId`를 포함하므로 바꾸지 않는다.

### 6.5 MODIFY — `plugins/codexclaw/components/pabcd-state/src/review-round-cli.ts`

`show`는 계속 `readGoalplan()`을 쓴다. `open`은 plan 파일 hash 계산 뒤 plan RMW만 공통 락에서
실행한다. `abort`도 같은 API를 쓴다.

현재 HEAD와 선행 wp 문서를 대조한 누적 import Before/After다. 선행 wp가 이 파일에 넣은 새 import
이름은 없으며, wp5가 `withGoalplanWriteLock`, `ReviewRoundState`를 더한다.

```ts
// wp4 적용 후 import 전체; 선행 wp 추가 이름 없음
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { readState } from "./state.ts";
import { readGoalplan, writeGoalplan, effectiveActiveWorkPhaseId, type Goalplan } from "./goalplan.ts";
import { openRound, markLaunching, markInFlight, latestRound, abortRound, staleness } from "./review-round.ts";
import type { PlanFileHash } from "./freeze.ts";
import { splitLines } from "./text-lines.ts";
```

```ts
// wp4 적용 후 + wp5 추가분: withGoalplanWriteLock, ReviewRoundState
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { readState } from "./state.ts";
import {
  effectiveActiveWorkPhaseId,
  readGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
  type Goalplan,
  type ReviewRoundState,
} from "./goalplan.ts";
import { openRound, markLaunching, markInFlight, latestRound, abortRound, staleness } from "./review-round.ts";
import type { PlanFileHash } from "./freeze.ts";
import { splitLines } from "./text-lines.ts";
```

#### before

```ts
// wp4 적용 후 상태
let plan: Goalplan | null = null;
try {
  plan = readGoalplan(args.cwd, state.slug);
} catch {
  plan = null;
}
if (!plan) {
  return { output: `review-round open: the bound goalplan "${state.slug}" could not be read`, code: 1 };
}
const workPhaseId = effectiveActiveWorkPhaseId(plan);
if (!workPhaseId) return { output: "review-round open: the bound goalplan has no active work-phase", code: 1 };

const collected = collectPlanFiles(args.cwd, state.planUnit, args.planPaths);
if ("error" in collected) return { output: `review-round open: ${collected.error}`, code: 1 };

const opened = openRound(plan, {
  purpose: "plan_audit",
  planPath: state.planUnit,
  planSha256: planFilesHash(collected.files),
});
if (opened.kind !== "ok") return { output: `review-round open: ${"reason" in opened ? opened.reason : opened.kind}`, code: 1 };

// Bind before launching: a round that exists without its identity could be
// matched by a later cycle.
let next = opened.plan;
next = {
  ...next,
  reviewRounds: (next.reviewRounds ?? []).map((r) =>
    r.roundId === opened.round.roundId
      ? { ...r, ownerSessionId: session, workPhaseId, planUnit: state.planUnit!, planEpoch: state.planEpoch!, planFiles: collected.files }
      : r,
  ),
};
const launchId = opened.round.lane.launchId;
const launching = markLaunching(next, "plan_audit", opened.round.roundId, launchId);
if (launching.kind !== "ok") return { output: `review-round open: ${"reason" in launching ? launching.reason : launching.kind}`, code: 1 };
const inFlight = markInFlight(launching.plan, "plan_audit", opened.round.roundId, launchId);
if (inFlight.kind !== "ok") return { output: `review-round open: ${"reason" in inFlight ? inFlight.reason : inFlight.kind}`, code: 1 };
writeGoalplan(args.cwd, inFlight.plan);
```

#### after — open commit

```ts
function renderOpenPacket(round: ReviewRoundState, fileCount: number): string {
  const launchId = round.lane.launchId;
  return [
    launchId,
    "",
    `Round ${round.roundId} is in flight over ${fileCount} file(s).`,
    v2SpawnSurface()
      ? "Dispatch an independent reviewer (agent_type explorer) and require it to end its"
      : "Dispatch an independent reviewer and require it to end its",
    "final message with exactly these two lines:",
    "",
    `  LAUNCH: ${launchId}`,
    "  VERDICT: PASS | NEAR-PASS | FAIL",
    "",
    "The verdict is recorded when that reviewer exits. There is no way to write it here.",
  ].join("\n");
}

    const collected = collectPlanFiles(args.cwd, state.planUnit, args.planPaths);
    if ("error" in collected) {
      return { output: `review-round open: ${collected.error}`, code: 1 };
    }
    const locked = withGoalplanWriteLock(args.cwd, state.slug, (plan): ReviewRoundCliResult => {
      const workPhaseId = effectiveActiveWorkPhaseId(plan);
      if (!workPhaseId) {
        return { output: "review-round open: the bound goalplan has no active work-phase", code: 1 };
      }
      const opened = openRound(plan, {
        purpose: "plan_audit",
        planPath: state.planUnit!,
        planSha256: planFilesHash(collected.files),
      });
      if (opened.kind !== "ok") {
        return { output: `review-round open: ${"reason" in opened ? opened.reason : opened.kind}`, code: 1 };
      }
      const bound = {
        ...opened.plan,
        reviewRounds: (opened.plan.reviewRounds ?? []).map((round) =>
          round.roundId === opened.round.roundId
            ? {
                ...round,
                ownerSessionId: session,
                workPhaseId,
                planUnit: state.planUnit!,
                planEpoch: state.planEpoch!,
                planFiles: collected.files,
              }
            : round,
        ),
      };
      const launchId = opened.round.lane.launchId;
      const launching = markLaunching(bound, "plan_audit", opened.round.roundId, launchId);
      if (launching.kind !== "ok") {
        return { output: `review-round open: ${"reason" in launching ? launching.reason : launching.kind}`, code: 1 };
      }
      const inFlight = markInFlight(launching.plan, "plan_audit", opened.round.roundId, launchId);
      if (inFlight.kind !== "ok") {
        return { output: `review-round open: ${"reason" in inFlight ? inFlight.reason : inFlight.kind}`, code: 1 };
      }
      writeGoalplan(args.cwd, inFlight.plan);
      return { output: renderOpenPacket(opened.round, collected.files.length), code: 0 };
    });
    if (locked.kind !== "ok") {
      return { output: `review-round open: ${locked.reason}; retry`, code: 1 };
    }
    return locked.value;
```

`ReviewRoundState` import를 `goalplan.ts`에서 추가한다. `renderOpenPacket()`은 실제 HEAD
`review-round-cli.ts:238-254`의 배열 본문을 이름만 붙여 옮긴 private 함수다. 실제 소스에는
`renderOpenPacket` 함수가 없으므로 호출만 추가하지 않는다.

#### after — abort commit

```ts
    const locked = withGoalplanWriteLock(args.cwd, state.slug, (plan): ReviewRoundCliResult => {
      const aborted = abortRound(plan, "plan_audit", args.reason ?? "aborted by the agent");
      if (aborted.kind !== "ok") {
        return { output: `review-round abort: ${"reason" in aborted ? aborted.reason : aborted.kind}`, code: 1 };
      }
      writeGoalplan(args.cwd, aborted.plan);
      return { output: `review-round abort: ${aborted.round.roundId} closed as inconclusive`, code: 0 };
    });
    if (locked.kind !== "ok") {
      return { output: `review-round abort: ${locked.reason}; retry`, code: 1 };
    }
    return locked.value;
```

### 6.6 MODIFY — `plugins/codexclaw/components/pabcd-state/src/review-observer.ts`

sign-off 유무와 무관하게 plan 조회, 판정, 진단 append, verdict write를 callback 안에 둔다. 결과가
`locked` 또는 `unreadable`이면 `""`를 반환한다. callback이나 append가 throw해도 outer catch가
`""`를 반환한다.

현재 HEAD와 선행 wp 문서를 대조한 누적 import Before/After다. 선행 wp가 이 파일에 넣은 새 import
이름은 없으며, wp5가 `withGoalplanWriteLock`을 더한다.

```ts
// wp4 적용 후 import 전체; 선행 wp 추가 이름 없음
import { readState } from "./state.ts";
import { readGoalplan, writeGoalplan, effectiveActiveWorkPhaseId, appendGoalplanLedger } from "./goalplan.ts";
import { roundByLaunchId, parseSignoff, recordVerdict } from "./review-round.ts";
import type { SubagentStopPayload } from "./hook.ts";
```

```ts
// wp4 적용 후 + wp5 추가분: withGoalplanWriteLock
import { readState } from "./state.ts";
import {
  appendGoalplanLedger,
  effectiveActiveWorkPhaseId,
  readGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
} from "./goalplan.ts";
import { roundByLaunchId, parseSignoff, recordVerdict } from "./review-round.ts";
import type { SubagentStopPayload } from "./hook.ts";
```

#### before

```ts
// wp4 적용 후 상태
const plan = readGoalplan(cwd, state.slug);
if (!plan) return "";

// Find the round by its launch id before checking anything else. The sign-off
// names its own round, and looking it up first means every refusal below is
// about a round we can name.
const round = roundByLaunchId(plan, "plan_audit", signoff.launchId);
if (!round) {
  return note(
    "review_signoff_ignored",
    `${signoff.verdict} sign-off named launch ${signoff.launchId}, which belongs to no plan_audit round`,
    signoff.launchId,
  );
}

// ignore() appends a diagnostic row and returns "". FAIL-OPEN throughout: a note
// that cannot be written must not break the child's exit.
if (state.phase !== "A") return ignore("the session left A before the reviewer finished");
if (round.ownerSessionId !== sessionId) return ignore("the round belongs to another session");
if (round.planEpoch !== state.planEpoch) return ignore("the plan was re-planned after this round opened");
const agentId = payload.agent_id ?? "";
const boundReviewer = round.lane.reviewerSession;
if (boundReviewer !== undefined && boundReviewer !== agentId) {
  return ignore(`round ${round.roundId} was already signed by ${boundReviewer}`);
}
const activeWp = effectiveActiveWorkPhaseId(plan);
if (round.workPhaseId !== activeWp) {
  return ignore(`the round audited work-phase ${round.workPhaseId ?? "none"}, but ${activeWp ?? "none"} is active`);
}

const result = recordVerdict(plan, {
  purpose: "plan_audit",
  roundId: round.roundId,
  launchId: signoff.launchId,
  verdict: signoff.verdict,
  reviewerSession: agentId,
});
if (result.kind !== "ok") {
  return ignore("reason" in result ? result.reason : result.kind);
}
writeGoalplan(cwd, result.plan);
```

#### after — verdict RMW 골격

```ts
    if (!state.slug) return "";
    const locked = withGoalplanWriteLock(cwd, state.slug, (plan): string => {
      if (!signoff) {
        const waiting = plan.reviewRounds?.some(
          (round) => round.purpose === "plan_audit" && round.status === "in_flight",
        );
        if (state.phase === "A" && waiting) {
          return note(
            "review_signoff_unparsed",
            (
              "a subagent exited with no parseable sign-off while a plan_audit round was in flight; "
              + "the closing two lines must be exactly LAUNCH then VERDICT"
            ),
          );
        }
        return "";
      }

      const round = roundByLaunchId(plan, "plan_audit", signoff.launchId);
      if (!round) {
        return note(
          "review_signoff_ignored",
          `${signoff.verdict} sign-off named launch ${signoff.launchId}, which belongs to no plan_audit round`,
          signoff.launchId,
        );
      }
      const ignore = (reason: string): string => {
        appendGoalplanLedger(cwd, state.slug!, {
          ts: new Date().toISOString(),
          slug: state.slug!,
          event: "review_signoff_ignored",
          detail: `${signoff.verdict} sign-off was not recorded: ${reason}`,
          roundId: round.roundId,
          launchId: signoff.launchId,
        });
        return "";
      };
      if (state.phase !== "A") return ignore("the session left A before the reviewer finished");
      if (round.ownerSessionId !== sessionId) return ignore("the round belongs to another session");
      if (round.planEpoch !== state.planEpoch) return ignore("the plan was re-planned after this round opened");
      const agentId = payload.agent_id ?? "";
      if (round.lane.reviewerSession !== undefined && round.lane.reviewerSession !== agentId) {
        return ignore(`round ${round.roundId} was already signed by ${round.lane.reviewerSession}`);
      }
      const activeWorkPhaseId = effectiveActiveWorkPhaseId(plan);
      if (round.workPhaseId !== activeWorkPhaseId) {
        return ignore(
          `the round audited work-phase ${round.workPhaseId ?? "none"}, `
            + `but ${activeWorkPhaseId ?? "none"} is active`,
        );
      }
      const recorded = recordVerdict(plan, {
        purpose: "plan_audit",
        roundId: round.roundId,
        launchId: signoff.launchId,
        verdict: signoff.verdict,
        reviewerSession: agentId,
      });
      if (recorded.kind !== "ok") {
        return ignore("reason" in recorded ? recorded.reason : recorded.kind);
      }
      writeGoalplan(cwd, recorded.plan);
      return "";
    });
    return locked.kind === "ok" ? locked.value : "";
```

## 7. wp6 소비자 계약

wp5는 lifecycle CLI 인자를 정의하지 않는다. wp6의 mutation handler는 아래 순서만 지킨다.

wp6의 `cxc loop show`는 wp5가 내보낸 `goalplanWriteLockStatus()`를 읽어 lock directory 절대 경로와
`ageMs`를 표시한다. status helper와 show는 `owner.json`을 판정 입력으로 읽지 않는다.

1. 입력과 참조 무결성을 락 안에서 판정한다.
2. 거부면 callback에서 plan write와 ledger append를 모두 건너뛴다.
3. 성공이면 권위 상태를 담은 plan을 먼저 commit하고 성공 원장 행을 같은 callback에서 append한다.
4. `dependency_registered`는 실제 의존 배열이 저장된 성공 건에만 한 번 쓴다.
5. `complete-task` 성공 시 trim된 결과 문자열은 권위 필드 `GoalplanTask.outcome`에 저장한다.
6. `task_done.detail`은 같은 문자열의 부차적 사본이다. plan의 outcome이 증거 정본이다.

이번 goal에서 신설하는 원장 이벤트는 `dependency_registered` 하나뿐이며 생산 코드는 wp6이 소유한다.

따라서 complete-task의 임계 구역 모양은 다음과 같다. 이 코드는 CLI 인자 파서를 정의하지 않는다.

```ts
function commitCompletedTask(
  cwd: string,
  slug: string,
  workPhaseId: string,
  taskId: string,
  outcome: string,
  now: () => string = () => new Date().toISOString(),
): GoalplanCliResult {
  const outcomeText = outcome.trim();
  if (!outcomeText) return { code: 1, output: "task outcome must not be empty" };
  const locked = withGoalplanWriteLock(cwd, slug, (plan): GoalplanCliResult => {
    const result = completeGoalplanTask(plan, workPhaseId, taskId, outcomeText);
    if (result.kind === "rejected") return { code: 1, output: result.reason };
    if (result.kind === "unchanged") return { code: 0, output: result.reason };
    writeGoalplan(cwd, result.plan);
    appendGoalplanLedger(cwd, slug, {
      ts: now(),
      slug,
      event: "task_done",
      detail: outcomeText,
    });
    return { code: 0, output: `task ${taskId}: done` };
  });
  if (locked.kind !== "ok") return { code: 1, output: locked.reason };
  return locked.value;
}
```

`completeGoalplanTask()`와 `GoalplanLifecycleResult`의 `changed | unchanged | rejected` union은
`060_wp6_public_surface.md`가 정본이다. wp5는 lifecycle 함수를 새로 만들지 않고 락 안의 호출 순서만
정한다. 실제 `goalplan.ts:215-225`의 `GoalplanLedgerEntry`에는 `workPhaseId`, `taskId`가 없으므로
객체 literal에도 넣지 않는다. task 식별자는 권위 plan에서 읽고 원장의 `task_done.detail`은 outcome
사본으로만 쓴다. 구조화 ledger 필드 확장은 이번 wp 범위 밖이다.

의존 검증 실패, outcome 누락, 공백 증거를 포함한 모든 거부는 `goalplan.json`과 `ledger.jsonl`을
한 바이트도 바꾸지 않는다.

## 8. 테스트 diff

아래 테스트는 이름만 적은 목록이 아니다. 각 블록을 해당 파일에 그대로 넣을 수 있어야 한다.

### 8.1 NEW — `plugins/codexclaw/components/pabcd-state/test/goalplan-concurrency.test.ts`

파일 전체 내용:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
  GOALPLAN_LOCK_OWNER_FILE,
  buildGoalplan,
  goalplanDir,
  goalplanWriteLockDir,
  goalplanWriteLockStatus,
  readGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
} from "../src/goalplan.ts";

function workspace(objective: string): { cwd: string; slug: string } {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-goalplan-lock-"));
  const plan = buildGoalplan({ objective });
  writeGoalplan(cwd, plan);
  return { cwd, slug: plan.slug };
}

// A same-process sequential A-then-B call proves nothing: B reads what A already
// persisted whether or not a lock exists. These writers run in real child
// processes and signal through files, so removing the lock lets both callbacks be
// active at once and the overlap sentinel appears.
const GOALPLAN_WRITER_SCRIPT = String.raw`
import { existsSync, rmSync, writeFileSync } from "node:fs";

const [
  goalplanUrl, cwd, slug, writer, enteredPath, activePath, peerActivePath,
  contendedPath, overlapPath, releasePath, donePath, mode,
] = process.argv.slice(1);
const { withGoalplanWriteLock, writeGoalplan } = await import(goalplanUrl);

function waitForAny(paths) {
  const deadline = Date.now() + 10_000;
  while (!paths.some((path) => path !== "-" && existsSync(path))) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for: " + paths.join(", "));
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}

const delays = [];
try {
  const retryDelaysMs = mode === "timeout" ? [5, 10, 20, 40] : [50, 50, 50, 50];
  const options = writer === "b"
    ? {
        retryDelaysMs,
        sleep(ms) {
          delays.push(ms);
          writeFileSync(contendedPath, String(ms) + "\n");
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
        },
      }
    : {};

  const result = withGoalplanWriteLock(cwd, slug, (plan) => {
    writeFileSync(activePath, writer + "\n");
    try {
      if (peerActivePath !== "-" && existsSync(peerActivePath)) {
        writeFileSync(overlapPath, writer + " overlapped its peer\n");
      }
      writeGoalplan(cwd, {
        ...plan,
        workPhases: [
          ...plan.workPhases,
          { id: "wp-" + writer, title: writer.toUpperCase(), status: "pending", tasks: [], criteriaIds: [] },
        ],
      });
      writeFileSync(enteredPath, writer + "\n");
      if (writer === "a") waitForAny(releasePath === "-" ? [contendedPath, overlapPath] : [releasePath]);
      return writer;
    } finally {
      rmSync(activePath, { force: true });
    }
  }, options);

  process.stdout.write(JSON.stringify({ result, delays }));
} finally {
  if (donePath !== "-") writeFileSync(donePath, writer + "\n");
}
`;

interface GoalplanWriterRun {
  cwd: string;
  slug: string;
  writer: "a" | "b";
  enteredPath: string;
  activePath: string;
  peerActivePath?: string;
  contendedPath: string;
  overlapPath: string;
  releasePath?: string;
  donePath?: string;
  mode: "holder" | "handoff" | "timeout";
}

function runGoalplanWriter(run: GoalplanWriterRun): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [
      "--experimental-strip-types", "--input-type=module", "-e", GOALPLAN_WRITER_SCRIPT,
      new URL("../src/goalplan.ts", import.meta.url).href,
      run.cwd, run.slug, run.writer, run.enteredPath, run.activePath,
      run.peerActivePath ?? "-", run.contendedPath, run.overlapPath,
      run.releasePath ?? "-", run.donePath ?? "-", run.mode,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectChild);
    child.on("close", (status) => resolveChild({ status, stdout, stderr }));
  });
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 5));
  }
}

test("real concurrent writers never overlap and preserve both updates", async () => {
  const { cwd, slug } = workspace("preserve concurrent updates");
  const enteredA = join(cwd, "writer-a-entered");
  const activeA = join(cwd, "writer-a-active");
  const enteredB = join(cwd, "writer-b-entered");
  const activeB = join(cwd, "writer-b-active");
  const contendedB = join(cwd, "writer-b-contended");
  const overlap = join(cwd, "writers-overlapped");

  try {
    const first = runGoalplanWriter({
      cwd, slug, writer: "a", enteredPath: enteredA, activePath: activeA,
      contendedPath: contendedB, overlapPath: overlap, mode: "holder",
    });
    await waitForFile(enteredA);

    const second = runGoalplanWriter({
      cwd, slug, writer: "b", enteredPath: enteredB, activePath: activeB,
      peerActivePath: activeA, contendedPath: contendedB, overlapPath: overlap, mode: "handoff",
    });
    const [a, b] = await Promise.all([first, second]);

    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(JSON.parse(a.stdout).result.kind, "ok");
    assert.equal(JSON.parse(b.stdout).result.kind, "ok");
    assert.equal(existsSync(contendedB), true, "writer B must observe the held lock");
    assert.equal(existsSync(overlap), false, "writer callbacks must never overlap");
    assert.deepEqual(readGoalplan(cwd, slug)!.workPhases.map((workPhase) => workPhase.id), ["wp-a", "wp-b"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a real contender waits 75ms, times out, and never enters its callback", async () => {
  const { cwd, slug } = workspace("bounded lock wait");
  const dir = goalplanWriteLockDir(cwd, slug);
  const enteredA = join(cwd, "timeout-holder-entered");
  const activeA = join(cwd, "timeout-holder-active");
  const enteredB = join(cwd, "timeout-contender-entered");
  const activeB = join(cwd, "timeout-contender-active");
  const contendedB = join(cwd, "timeout-contender-contended");
  const overlap = join(cwd, "timeout-writers-overlapped");
  const contenderDone = join(cwd, "timeout-contender-done");

  try {
    const holder = runGoalplanWriter({
      cwd, slug, writer: "a", enteredPath: enteredA, activePath: activeA,
      contendedPath: contendedB, overlapPath: overlap, releasePath: contenderDone, mode: "holder",
    });
    await waitForFile(enteredA);

    const contender = runGoalplanWriter({
      cwd, slug, writer: "b", enteredPath: enteredB, activePath: activeB,
      peerActivePath: activeA, contendedPath: contendedB, overlapPath: overlap,
      donePath: contenderDone, mode: "timeout",
    });
    const [a, b] = await Promise.all([holder, contender]);

    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    const report = JSON.parse(b.stdout) as { result: { kind: string; reason?: string }; delays: number[] };
    assert.equal(report.result.kind, "locked");
    assert.deepEqual(report.delays, [5, 10, 20, 40]);
    assert.equal(report.delays.reduce((sum, delay) => sum + delay, 0), 75);
    assert.equal(existsSync(contendedB), true, "the second process must hit EEXIST");
    assert.equal(existsSync(enteredB), false, "the timed-out callback must not run");
    assert.equal(existsSync(overlap), false, "timed-out writers must not overlap");
    assert.equal(report.result.reason?.includes(`Lock directory: ${dir}`), true);
    assert.deepEqual(readGoalplan(cwd, slug)!.workPhases.map((workPhase) => workPhase.id), ["wp-a"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("owner metadata is diagnostic only and cannot trigger automatic deletion", () => {
  const { cwd, slug } = workspace("owner is diagnostic");
  const dir = goalplanWriteLockDir(cwd, slug);
  mkdirSync(dir, { recursive: false });
  writeFileSync(
    join(dir, GOALPLAN_LOCK_OWNER_FILE),
    `${JSON.stringify({ pid: -1, hostname: "same-host", token: "old", acquiredAt: "2000-01-01T00:00:00.000Z" })}\n`,
  );

  const result = withGoalplanWriteLock(cwd, slug, () => "entered", {
    retryDelaysMs: [],
    sleep: () => assert.fail("no sleep is configured"),
  });

  assert.equal(result.kind, "locked");
  assert.equal(existsSync(dir), true);
  assert.match(readFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "utf8"), /"token":"old"/);
});

test("read-only lock status reports absolute path and age without consulting owner metadata", () => {
  const { cwd, slug } = workspace("lock status");
  const dir = goalplanWriteLockDir(cwd, slug);
  mkdirSync(dir, { recursive: false });
  writeFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "{not-json\n");
  const acquiredAt = new Date("2026-08-29T00:00:00.000Z");
  utimesSync(dir, acquiredAt, acquiredAt);

  const status = goalplanWriteLockStatus(
    cwd,
    slug,
    new Date("2026-08-29T00:00:02.500Z").getTime(),
  );

  assert.equal(status.path, dir);
  assert.equal(isAbsolute(status.path), true);
  assert.equal(status.exists, true);
  assert.equal(status.ageMs, 2_500);
  assert.equal(readFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "utf8"), "{not-json\n");
});

test("read-only lock status normalizes exists-to-stat ENOENT as absent", () => {
  const { cwd, slug } = workspace("lock status race");
  const dir = goalplanWriteLockDir(cwd, slug);
  mkdirSync(dir, { recursive: false });

  const status = goalplanWriteLockStatus(cwd, slug, Date.now(), (path) => {
    rmSync(path, { recursive: true, force: true });
    throw Object.assign(new Error("lock vanished"), { code: "ENOENT" });
  });

  assert.deepEqual(status, { path: dir, exists: false, ageMs: null });
});

test("an unreadable plan releases the acquired lock", () => {
  const { cwd, slug } = workspace("unreadable releases lock");
  writeFileSync(join(goalplanDir(cwd, slug), "goalplan.json"), "{not-json");

  const result = withGoalplanWriteLock(cwd, slug, () => assert.fail("callback must not run"), {
    retryDelaysMs: [],
  });

  assert.equal(result.kind, "unreadable");
  assert.equal(existsSync(goalplanWriteLockDir(cwd, slug)), false);
});
```

### 8.2 MODIFY — `plugins/codexclaw/components/pabcd-state/test/steering.test.ts`

기존 held-lock 테스트와 release 테스트를 다음 두 블록으로 교체한다.

```ts
test("a held common lock blocks the batch and preserves plan and ledger bytes", () => {
  const cwd = workspace();
  const lock = join(goalplanDir(cwd, SLUG), ".goalplan.lock");
  mkdirSync(lock, { recursive: false });
  writeFileSync(
    join(lock, "owner.json"),
    `${JSON.stringify({ pid: 4242, acquiredAt: "2026-08-29T00:00:00.000Z" })}\n`,
  );
  const planPath = join(goalplanDir(cwd, SLUG), "goalplan.json");
  const beforePlan = readFileSync(planPath, "utf8");
  const beforeLedger = ledgerText(cwd);

  const result = applySteeringBatch(cwd, SLUG, batch(), {
    lock: { retryDelaysMs: [], sleep: () => assert.fail("no sleep is configured") },
  });

  assert.equal(result.kind, "locked");
  assert.match(result.kind === "locked" ? result.reason : "", /4242/);
  assert.match(result.kind === "locked" ? result.reason : "", /\.goalplan\.lock/);
  assert.equal(readFileSync(planPath, "utf8"), beforePlan);
  assert.equal(ledgerText(cwd), beforeLedger);
});

test("the common lock is released after an applied or rejected batch", () => {
  const cwd = workspace();
  const lock = join(goalplanDir(cwd, SLUG), ".goalplan.lock");

  const appliedResult = applySteeringBatch(cwd, SLUG, batch());
  assert.equal(appliedResult.kind, "applied");
  assert.equal(existsSync(lock), false);

  const rejectedResult = applySteeringBatch(
    cwd,
    SLUG,
    batch({ idempotencyKey: "k2", ops: [{ kind: "nope" }] }),
  );
  assert.equal(rejectedResult.kind, "rejected");
  assert.equal(existsSync(lock), false);
});
```

### 8.2.1 MODIFY — `plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts`

현재 `:22~72`는 `.steer.lock`을 미리 만들고 `{ wslDeps }`를 넘겨 drvfs/9p 전용 문구를 기다린다.
wp5 After에서는 그 디렉터리와 seam을 읽지 않으므로 batch가 실제 적용되고 `locked` 단언이 깨진다.
파일 전체를 공통 락 계약에 맞춰 아래처럼 교체한다.

```diff
--- a/plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts
+++ b/plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts
@@
-/**
- * steering-ops.test.ts - wp07 (plan 060).
- *
- * The lock-contention message names the filesystem tier when the lock lives on
- * drvfs or 9p, where directory-create atomicity is the driver's guarantee rather
- * than the kernel's. Contention is produced by pre-creating the lock directory,
- * matching the technique in steering.test.ts, and the filesystem probes are
- * injected so both branches run on any OS.
- */
+/** steering mutation uses the same goalplan lock and manual recovery contract. */
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { mkdirSync, mkdtempSync } from "node:fs";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import { buildGoalplan, goalplanDir, writeGoalplan } from "../src/goalplan.ts";
 import { applySteeringBatch, type SteerResult } from "../src/steering.ts";
-import type { WslDeps } from "../src/wsl.ts";
@@
-  const lockDir = join(goalplanDir(cwd, SLUG), ".steer.lock");
+  const lockDir = join(goalplanDir(cwd, SLUG), ".goalplan.lock");
   mkdirSync(lockDir, { recursive: true });
   return { cwd, lockDir };
 }

-function mountsFor(lockDir: string, type: string): string {
-  return ["/dev/root / ext4 rw 0 0", `dev ${lockDir} ${type} rw 0 0`].join("\n");
-}
-
-function locked(cwd: string, wslDeps: WslDeps): Extract<SteerResult, { kind: "locked" }> {
+function locked(cwd: string): Extract<SteerResult, { kind: "locked" }> {
   const r = applySteeringBatch(
@@
-    { wslDeps },
+    { lock: { retryDelaysMs: [] } },
   );
@@
-test("the lock-contention message names the filesystem tier on drvfs", () => {
+test("the common lock refusal names its platform-neutral lock path", () => {
   const ws = contendedWorkspace();
-  const r = locked(ws.cwd, { platform: "linux", procMounts: mountsFor(ws.lockDir, "drvfs") });
-  assert.match(r.reason, /holds the lock/);
-  assert.match(r.reason, /This lock lives on drvfs/);
-});
-
-test("9p gets the same tier note", () => {
-  const ws = contendedWorkspace();
-  const r = locked(ws.cwd, { platform: "linux", procMounts: mountsFor(ws.lockDir, "9p") });
-  assert.match(r.reason, /This lock lives on 9p/);
-});
-
-test("the lock-contention message carries no tier note on a native filesystem", () => {
-  const ws = contendedWorkspace();
-  const r = locked(ws.cwd, { platform: "linux", procMounts: mountsFor(ws.lockDir, "ext4") });
-  assert.match(r.reason, /holds the lock/);
-  assert.doesNotMatch(r.reason, /This lock lives on/);
+  const r = locked(ws.cwd);
+  assert.match(r.reason, /goalplan '.+' is busy/);
+  assert.match(r.reason, /After verifying no writer is active/);
+  assert.ok(r.reason.includes(ws.lockDir));
 });
```

적용 뒤 파일 전체 After는 아래다. 위 diff의 생략되지 않은 정본이며 그대로 복사해 실행할 수 있다.

```ts
/** steering mutation uses the same goalplan lock and platform-neutral recovery path. */
// wp4 적용 후 + wp5 추가분: 전용 WslDeps 제거, 공통 락 테스트 import 전체
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGoalplan, goalplanDir, writeGoalplan } from "../src/goalplan.ts";
import { applySteeringBatch, type SteerResult } from "../src/steering.ts";

const OBJECTIVE = "steering tier fixture";
const SLUG = buildGoalplan({ objective: OBJECTIVE }).slug;

function contendedWorkspace(): { cwd: string; lockDir: string } {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-steer-tier-"));
  writeGoalplan(cwd, buildGoalplan({ objective: OBJECTIVE }));
  const lockDir = join(goalplanDir(cwd, SLUG), ".goalplan.lock");
  mkdirSync(lockDir, { recursive: true });
  return { cwd, lockDir };
}

function locked(cwd: string): Extract<SteerResult, { kind: "locked" }> {
  const result = applySteeringBatch(
    cwd,
    SLUG,
    {
      idempotencyKey: "k1",
      rationale: "the scope shifted after the audit",
      evidence: "devlog/_plan/260821_win-linux-optimization/060_wsl.md:1",
      ops: [{ kind: "annotate", note: "narrowed to the parser" }],
    },
    { lock: { retryDelaysMs: [] } },
  );
  assert.equal(result.kind, "locked", "expected a locked result from a pre-created lock dir");
  return result as Extract<SteerResult, { kind: "locked" }>;
}

test("the common lock refusal names its platform-neutral lock path", () => {
  const workspace = contendedWorkspace();
  const result = locked(workspace.cwd);
  assert.match(result.reason, /goalplan '.+' is busy/);
  assert.match(result.reason, /After verifying no writer is active/);
  assert.ok(result.reason.includes(workspace.lockDir));
});
```

WSL tier 진단은 `.steer.lock` 전용 `filesystemTier()`와 `{ wslDeps }` seam에 딸린 기능이다. 공통
락은 OS별 판정 없이 절대 경로를 내는 계약이므로 drvfs/9p/native 세 테스트는
삭제한다. 진단을 다른 테스트로 옮기거나 유지한다고 쓰지 않는다.

### 8.2.2 MODIFY — `plugins/codexclaw/components/pabcd-state/test/state.test.ts`

import는 바꾸지 않는다. 현재 import에 필요한 `readState`, `writeState`, `defaultState`, `readFileSync`가
이미 모두 있다. exact persisted shape에 새 기본 필드를 넣는다.

```diff
@@ test("SessionStart ensureState: fresh session creates the exact default IDLE state without temp files", () => {
       planEpoch: null,
       checkEpoch: null,
+      dcloseRecovery: null,
     });
```

같은 파일에 복원 경계를 추가한다.

```ts
test("wp5: valid D-close marker restores with its IDLE check epoch", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, {
      ...defaultState("marker-valid"),
      checkEpoch: "c-valid",
      dcloseRecovery: {
        sessionId: "marker-valid",
        checkEpoch: "c-valid",
        closedWorkPhaseId: "wp-1",
      },
    });
    const restored = readState(cwd, "marker-valid");
    assert.equal(restored.checkEpoch, "c-valid");
    assert.deepEqual(restored.dcloseRecovery, {
      sessionId: "marker-valid",
      checkEpoch: "c-valid",
      closedWorkPhaseId: "wp-1",
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("wp5: foreign D-close marker is dropped and cannot retain an IDLE epoch", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, {
      ...defaultState("marker-owner"),
      checkEpoch: "c-foreign",
      dcloseRecovery: {
        sessionId: "other-session",
        checkEpoch: "c-foreign",
        closedWorkPhaseId: "wp-1",
      },
    });
    const restored = readState(cwd, "marker-owner");
    assert.equal(restored.dcloseRecovery, null);
    assert.equal(restored.checkEpoch, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

### 8.2.3 MODIFY — `plugins/codexclaw/test/hook-e2e.test.mjs`

루트 `npm test`가 `plugins/codexclaw/test/*.test.mjs`를 실행한다. 실제 파일 전체에서
`rg -n 'deepEqual' plugins/codexclaw/test/`를 실행한 결과 persisted state 전체 shape는
`hook-e2e.test.mjs:160-184` 한 블록뿐이다. 계약의 `:160`, `:183`은 각각 이 객체의 시작과 마지막
기존 필드를 가리킨다. 나머지는 배열, 프로세스 인자, 파일 바이트의 동일성 단언이라 state 필드 추가와
무관하다. component state 테스트와 이 루트 E2E, 두 exact shape를 함께 갱신한다.

```diff
@@ test("SessionStart state bootstrap: fresh compiled hook creates exact IDLE state and immediate orchestrate P succeeds", () => {
       planEpoch: null,
       checkEpoch: null,
+      dcloseRecovery: null,
     });
```

### 8.2.4 MODIFY — `plugins/codexclaw/components/pabcd-state/test/orchestrate-apply.test.ts`

import는 바꾸지 않는다. `applyHumanTransition`, `defaultState`가 이미 있다. 기존 IDLE no-op 테스트는
marker와 epoch가 없는 상태에 그대로 남기고 아래 회귀를 더한다.

```ts
test("reset from IDLE clears a D-close marker and check epoch instead of becoming a no-op", () => {
  const state = {
    ...at("IDLE"),
    checkEpoch: "c-recovery",
    dcloseRecovery: {
      sessionId: "t",
      checkEpoch: "c-recovery",
      closedWorkPhaseId: "wp-1",
    },
  };
  const result = applyHumanTransition(state, "reset");
  assert.equal(result.ok, true);
  assert.notEqual(result.noop, true);
  assert.equal(result.state?.checkEpoch, null);
  assert.equal(result.state?.dcloseRecovery, null);
  assert.equal(result.ledger?.reason, "reset");
});
```

### 8.3 MODIFY — `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`

CYCLE-COMPLETION 테스트 구역의 기존 bound 성공과 HITL 성공을 먼저 분리해 잠근다. bound만 새
`close target <id> is complete` 문구를 쓰고, `orchestrate-cli.test.ts:908`의 HITL은 옛 문구를
그대로 쓴다.

020 적용 뒤 `buildGoalplan()`은 v3를 만든다. 기존 성공 helper의 done task도 v3 outcome 무결성을
만족해야 한다. schemaVersion을 낮추지 않고 task literal만 보강한다.

```diff
@@ function seedBoundCycleAtC(cwd: string, id: string, slug: string, taskStatus: "pending" | "done") {
-    { id: "wp-1", title: "first", status: "in_progress", tasks: [{ id: "t-1", title: "the work", status: taskStatus }], criteriaIds: [] },
+    {
+      id: "wp-1",
+      title: "first",
+      status: "in_progress",
+      tasks: [{
+        id: "t-1",
+        title: "the work",
+        status: taskStatus,
+        ...(taskStatus === "done" ? { outcome: "focused tests passed" } : {}),
+      }],
+      criteriaIds: [],
+    },
```

```diff
@@ test("D-close succeeds once the tasks are done, closing the phase and starting the next", () => {
   assert.equal(r.code, 0);
+  assert.match(r.output, /close target wp-1 is complete/);
   assert.equal(readState(cwd, id).phase, "IDLE");

@@ test("an unbound (HITL) session closes its cycle exactly as before", () => {
   assert.equal(r.code, 0);
+  assert.equal(
+    r.output,
+    `orchestrate D: current=C -> IDLE (C → IDLE, cycle closed, session ${id})`,
+  );
+  assert.doesNotMatch(r.output, /close target/);
   assert.equal(readState(cwd, id).phase, "IDLE");
```

기존 all-done 성공 테스트는 거부 테스트로 바꾸지 않는다. marker 없이 cycle만 닫았고 교착 문구를
쓰지 않았음을 두 단언으로 보강한다.

```diff
@@ test("D-close succeeds when every work-phase is already done", () => {
   assert.equal(r.code, 0, r.output);
+  assert.doesNotMatch(r.output, /blocked or superseded/);
   assert.equal(readState(cwd, id).phase, "IDLE");
+  assert.equal(readState(cwd, id).dcloseRecovery, null);
   assert.equal(ledgerLines(cwd).length, 1);
 });
```

그 뒤 다음 helper와 실패 주입 테스트를 추가한다. 선행 wp가 이 테스트의 `goalplan.ts` import에
추가한 이름은 없고, wp5가 `readGoalplan`을 더한다.

```ts
// wp4 적용 후 + wp5 추가분: 선행 wp 추가 이름 없음; wp5 readGoalplan 추가
import { buildGoalplan, readGoalplan, writeGoalplan } from "../src/goalplan.ts";
```

```ts
function goalplanLedgerRows(cwd: string, slug: string): Array<Record<string, unknown>> {
  const path = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function parsedDclose(cwd: string, id: string) {
  const parsed = parseOrchestrateCliArgs(
    ["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)],
    cwd,
  );
  assert.ok(!("error" in parsed));
  return parsed as never;
}

function assertOnlyFirstPhaseClosed(cwd: string, slug: string): void {
  const plan = readGoalplan(cwd, slug)!;
  assert.equal(plan.workPhases.find((workPhase) => workPhase.id === "wp-1")?.status, "done");
  assert.equal(plan.workPhases.find((workPhase) => workPhase.id === "wp-2")?.status, "in_progress");
  assert.equal(plan.activeWorkPhaseId, "wp-2");
  assert.equal(
    goalplanLedgerRows(cwd, slug).filter(
      (row) => row.event === "workphase_done" && row.detail === "closed wp-1",
    ).length,
    1,
  );
}

test("past done phase id in C does not become a recovery marker", () => {
  const cwd = boundCwd();
  const id = "past-done-c";
  const slug = "past-done-c-plan";
  const plan = buildGoalplan({ objective: "past done phase" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-1", title: "past", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "current", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    phase: "C",
    slug,
    checkEpoch: "c-past",
    flags: { interview: false, auditPassed: true, checkPassed: true },
  });
  seedReceipt(cwd, id, "c-past");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /active work-phase is wp-2/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assert.equal(readGoalplan(cwd, slug)!.workPhases[1].status, "in_progress");
});

test("IDLE D attest without a matching marker is refused", () => {
  const cwd = boundCwd();
  const id = "idle-no-marker";
  const slug = "idle-no-marker-plan";
  const plan = buildGoalplan({ objective: "idle without marker" });
  plan.slug = slug;
  plan.workPhases = [{ id: "wp-1", title: "past", status: "done", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState(id), slug });

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /cannot transition|illegal|IDLE/);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("a marker from another session cannot authorize recovery", () => {
  const cwd = boundCwd();
  const id = "marker-owner";
  const slug = "marker-owner-plan";
  const plan = buildGoalplan({ objective: "foreign marker" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-1", title: "past", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "current", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    phase: "C",
    slug,
    checkEpoch: "c-owner",
    dcloseRecovery: {
      sessionId: "different-session",
      checkEpoch: "c-owner",
      closedWorkPhaseId: "wp-1",
    },
  });
  seedReceipt(cwd, id, "c-owner");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /active work-phase is wp-2/);
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assert.equal(readGoalplan(cwd, slug)!.workPhases[1].status, "in_progress");
});

test("D-close retry after goalplan commit closes the fixed phase only once", () => {
  const cwd = boundCwd();
  const id = "retry-after-goalplan";
  const slug = "retry-after-goalplan-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterGoalplanCommit: () => { throw new Error("fail after goalplan commit"); },
    }),
    /fail after goalplan commit/,
  );
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(
    goalplanLedgerRows(cwd, slug).filter((row) => row.detail === "closed wp-1").length,
    0,
  );
  assert.deepEqual(readState(cwd, id).dcloseRecovery, {
    sessionId: id,
    checkEpoch: "c-test-epoch",
    closedWorkPhaseId: "wp-1",
  });

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 0, retry.output);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );
});

test("CLI D-close recovery resumes when the marker target is absent from the plan", () => {
  const cwd = boundCwd();
  const id = "cli-recovery-target-absent";
  const slug = "cli-recovery-target-absent-plan";
  const plan = buildGoalplan({ objective: "resume a partially committed CLI close" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-2", title: "next", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    slug,
    checkEpoch: "c-cli-recovery",
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-cli-recovery",
      closedWorkPhaseId: "wp-1",
    },
  });
  const planPath = goalplanPath(cwd, slug);
  const beforePlan = readFileSync(planPath, "utf8");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 0, result.output);
  assert.equal(
    result.output,
    `orchestrate D: close target wp-1 is complete (cycle closed, session ${id})`,
  );
  assert.doesNotMatch(result.output, /not in the bound goalplan/);
  assert.equal(readFileSync(planPath, "utf8"), beforePlan);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE"
        && row.checkEpoch === "c-cli-recovery" && row.closedWorkPhaseId === "wp-1",
    ).length,
    1,
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).checkEpoch, null);
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("D-close retry after state write appends only the missing PABCD row", () => {
  const cwd = boundCwd();
  const id = "retry-after-state";
  const slug = "retry-after-state-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterStateWrite: () => { throw new Error("fail after state write"); },
    }),
    /fail after state write/,
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    0,
  );

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 0, retry.output);
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );
});

test("D-close retry after PABCD append is a no-op and does not close wp-2", () => {
  const cwd = boundCwd();
  const id = "retry-after-pabcd-ledger";
  const slug = "retry-after-pabcd-ledger-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterPabcdLedgerAppend: () => { throw new Error("fail after PABCD append"); },
    }),
    /fail after PABCD append/,
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 0, retry.output);
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );
});

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
    [
      ["c-test-epoch", "wp-1"],
      [secondEpoch, "wp-2"],
    ],
  );
  assert.equal(readGoalplan(cwd, slug)!.workPhases[1].status, "done");
});
```

앞의 세 테스트는 각각 arrange에서 두 phase plan과 C state를 만들고, act에서 한 지점만 throw한 뒤 같은
attest를 재시도하며, assert에서 `wp-1=done`, `wp-2=in_progress`, close row 1개를 확인한다.
마지막 테스트는 같은 session id를 유지한 채 check epoch와 close target을 바꿔 두 번째 cycle을
닫고, PABCD 원장에 두 3-tuple이 각각 한 번 남는지 확인한다. 첫 행이 있다는 이유만으로 둘째 append를
건너뛰면 이 테스트가 행 1개 차이로 실패한다.

락 실패 테스트도 이어서 추가한다.

```ts
test("D-close lock timeout returns code 1 and leaves phase, plan, and both ledgers unchanged", () => {
  const cwd = boundCwd();
  const id = "cycle-lock-timeout";
  const slug = "cycle-gate-lock-timeout";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const lock = join(cwd, STATE_DIR, "goalplans", slug, ".goalplan.lock");
  mkdirSync(lock, { recursive: false });
  writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
  const planPath = goalplanPath(cwd, slug);
  const goalplanLedgerPath = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
  const beforePlan = readFileSync(planPath, "utf8");
  const beforePabcdLedger = ledgerLines(cwd);
  const beforeGoalplanLedger = existsSync(goalplanLedgerPath)
    ? readFileSync(goalplanLedgerPath, "utf8")
    : "";

  const parsed = parseOrchestrateCliArgs(
    ["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)],
    cwd,
  );
  assert.ok(!("error" in parsed));
  const result = runOrchestrateCli(parsed as never);

  assert.equal(result.code, 1);
  assert.match(result.output, /\.goalplan\.lock/);
  assert.match(result.output, /D-close was not applied/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(readFileSync(planPath, "utf8"), beforePlan);
  assert.deepEqual(ledgerLines(cwd), beforePabcdLedger);
  assert.equal(
    existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "",
    beforeGoalplanLedger,
  );
});
```

무결성 helper는 락 안 첫 검사다. invalid v3 plan은 marker보다 먼저 거부하며 네 저장소 바이트가
그대로여야 한다.

```ts
test("CLI D-close rejects an invalid v3 dependency plan before every write", () => {
  const cwd = boundCwd();
  const id = "invalid-v3-cli-close";
  const slug = "invalid-v3-cli-close-plan";
  const plan = buildGoalplan({ objective: "invalid dependency close" });
  plan.slug = slug;
  plan.schemaVersion = 3;
  plan.workPhases = [
    { id: "wp-1", title: "broken", status: "in_progress", dependsOn: ["missing"], tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id), phase: "C", slug, checkEpoch: "c-invalid",
    flags: { interview: false, auditPassed: true, checkPassed: true },
  });
  seedReceipt(cwd, id, "c-invalid");
  const statePath = join(cwd, STATE_DIR, SESSIONS_SUBDIR, `${id}.json`);
  const planPath = goalplanPath(cwd, slug);
  const pabcdPath = join(cwd, STATE_DIR, LEDGER_FILE);
  const goalplanLedgerPath = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
  const before = {
    state: readFileSync(statePath, "utf8"),
    plan: readFileSync(planPath, "utf8"),
    pabcd: existsSync(pabcdPath) ? readFileSync(pabcdPath, "utf8") : "",
    goalplan: existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "",
  };

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /invalid goalplan/);
  assert.equal(readFileSync(statePath, "utf8"), before.state);
  assert.equal(readFileSync(planPath, "utf8"), before.plan);
  assert.equal(existsSync(pabcdPath) ? readFileSync(pabcdPath, "utf8") : "", before.pabcd);
  assert.equal(existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "", before.goalplan);
});
```

P→A stale-round 청소가 락 경합을 Stop block으로 바꾸지 않는지는 다음 테스트로 고정한다.

```ts
test("P-to-A continues when stale-round housekeeping cannot acquire the common lock", () => {
  const cwd = freshCwd();
  try {
    const id = "housekeeping-lock";
    const slug = "housekeeping-lock-plan";
    const planUnit = seedPlanUnit(cwd);
    const plan = buildGoalplan({ objective: "housekeeping lock plan" });
    plan.slug = slug;
    plan.workPhases = [
      { id: "wp1", title: "one", status: "in_progress", tasks: [], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp1";
    plan.reviewRounds = [
      {
        roundId: "r1",
        purpose: "plan_audit",
        planPath: planUnit,
        planSha256: "a".repeat(64),
        status: "in_flight",
        lane: { launchId: "r1-launch" },
        openedAt: "2026-08-28T00:00:00.000Z",
        ownerSessionId: id,
        workPhaseId: "wp1",
        planUnit,
        planEpoch: "e-old",
      },
    ];
    plan.activePlanAuditRoundId = "r1";
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState(id), phase: "P", slug });
    const lock = join(cwd, STATE_DIR, "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);

    const result = runOrchestrateCli({
      verb: "A",
      attest: {
        from: "P",
        to: "A",
        did: "audited the plan",
        planUnit,
        workPhaseId: "wp1",
      },
      session: id,
      cwd,
      json: false,
    });

    assert.equal(result.code, 0, result.output);
    assert.equal(readState(cwd, id).phase, "A");
    assert.equal(ledgerLines(cwd).at(-1)?.to, "A");
    const stored = JSON.parse(readFileSync(goalplanPath(cwd, slug), "utf8"));
    assert.equal(stored.reviewRounds[0].status, "in_flight");
    assert.equal(existsSync(lock), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

### 8.4 MODIFY — `plugins/codexclaw/components/pabcd-state/test/hook.test.ts`

기존 bound 채팅 D-close fixture 두 개를 먼저 갱신한다. open-task 거부 fixture도 target 결박을 먼저
통과해야 의도한 `tasks_pending` 분기에 닿는다.

선행 wp import After를 출발점으로 삼은 변경 import 블록은 아래 셋이다. wp5는 path/url 이름과
`spawn`을 더하며 기존 `spawnSync`, `join`을 보존한다.

```ts
// wp4 적용 후 + wp5 추가분: 기존 join/spawnSync 보존; dirname, resolve, fileURLToPath, spawn 추가
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
```

```ts
// "chat D-close is refused while the work-phase has open tasks, and writes nothing"
const attest = JSON.stringify({
  from: "C",
  to: "D",
  did: "ran the suite",
  checkOutput: "ok",
  exitCode: 0,
  workPhaseId: "wp-1",
  testReceiptPath: ".codexclaw/evidence/chat-c/test-receipt.json",
});
```

```diff
// "chat D-close succeeds once the tasks are done"
// 020 적용 후 v3 fixture이므로 done task에는 비어 있지 않은 outcome을 둔다.
@@ test("chat D-close succeeds once the tasks are done", () => {
-      { id: "wp-1", title: "first", status: "in_progress", tasks: [{ id: "t-1", title: "the work", status: "done" }], criteriaIds: [] },
+      { id: "wp-1", title: "first", status: "in_progress", tasks: [{ id: "t-1", title: "the work", status: "done", outcome: "focused tests passed" }], criteriaIds: [] },
```

```ts
const attest = JSON.stringify({
  from: "C",
  to: "D",
  did: "ran the suite",
  checkOutput: "ok",
  exitCode: 0,
  workPhaseId: "wp-1",
  testReceiptPath: ".codexclaw/evidence/chat-d/test-receipt.json",
});
```

`loopArmDirective()` 공개 안내를 기다리는 기존 pinned snapshot에도 생산 문자열과 같은 줄을 넣는다.

```ts
"   When a goalplan is bound, include the active workPhaseId in every gated attest",
"   (one work-phase = one full PABCD cycle).",
"   Bound chat D-close requires workPhaseId as the fixed close target unless every work-phase is already done.",
```

필수 target 자체의 음성 테스트도 같은 구역에 추가한다.

```ts
test("bound chat D-close without workPhaseId is refused after empty and all-done checks", () => {
  const cwd = gitRepoForHook();
  try {
    const slug = "chat-missing-target";
    const plan = buildGoalplan({ objective: "chat missing target" });
    plan.slug = slug;
    plan.workPhases = [
      { id: "wp-1", title: "first", status: "in_progress", tasks: [], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp-1";
    writeGoalplan(cwd, plan);
    writeState(cwd, {
      ...defaultState("chat-missing-target"),
      phase: "C",
      slug,
      orchestrationActive: true,
      checkEpoch: "c-test",
      flags: { interview: false, auditPassed: true, checkPassed: true },
    });
    seedChatReceipt(cwd, "chat-missing-target", "c-test");
    const beforePlan = readFileSync(join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json"), "utf8");
    const attest = JSON.stringify({
      from: "C",
      to: "D",
      did: "ran the suite",
      checkOutput: "ok",
      exitCode: 0,
      testReceiptPath: ".codexclaw/evidence/chat-missing-target/test-receipt.json",
    });

    const output = handleUserPromptSubmit(
      ups(`orchestrate d --attest ${attest}`, cwd, "chat-missing-target", "t1"),
    );

    assert.match(output, /requires attest\.workPhaseId/);
    assert.equal(readState(cwd, "chat-missing-target").phase, "C");
    assert.equal(readFileSync(join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json"), "utf8"), beforePlan);
    assert.equal(ledgerLines(cwd).length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

비어 있지 않은 all-done plan은 target 유무와 무관하게 같은 정상 종료를 탄다. 두 경우 모두 plan과
goalplan 원장을 건드리지 않고 recovery marker 없이 IDLE로 닫힌다.

```ts
for (const workPhaseId of [undefined, "wp-finished"] as const) {
  test(`all-done bound chat closes without a marker (workPhaseId=${workPhaseId ?? "missing"})`, () => {
    const cwd = gitRepoForHook();
    try {
      const id = `chat-all-done-${workPhaseId ?? "missing"}`;
      const slug = `${id}-plan`;
      const plan = buildGoalplan({ objective: "close an all-done chat cycle" });
      plan.slug = slug;
      plan.workPhases = [
        { id: "wp-finished", title: "finished", status: "done", tasks: [], criteriaIds: [] },
      ];
      plan.activeWorkPhaseId = null;
      writeGoalplan(cwd, plan);
      writeState(cwd, {
        ...defaultState(id),
        phase: "C",
        slug,
        orchestrationActive: true,
        checkEpoch: "c-all-done",
        flags: { interview: false, auditPassed: true, checkPassed: true },
      });
      seedChatReceipt(cwd, id, "c-all-done");
      const attest = JSON.stringify({
        from: "C",
        to: "D",
        did: "verified the completed plan",
        checkOutput: "ok",
        exitCode: 0,
        ...(workPhaseId ? { workPhaseId } : {}),
        testReceiptPath: `.codexclaw/evidence/${id}/test-receipt.json`,
      });
      const planPath = join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json");
      const beforePlan = readFileSync(planPath, "utf8");

      const output = handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, id, "t1"));

      assert.doesNotMatch(output, /refused|blocked or superseded/);
      assert.equal(readState(cwd, id).phase, "IDLE");
      assert.equal(readState(cwd, id).dcloseRecovery, null);
      assert.equal(readFileSync(planPath, "utf8"), beforePlan);
      assert.equal(
        existsSync(join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl")),
        false,
      );
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
}
```

`workPhaseId`가 있는 all-done 입력도 PABCD 행에서는 닫힌 target이 없는 cycle close다. 입력 id가
원장에 새어 들어가지 않는 경계를 별도 테스트로 잠근다.

```ts
test("all-done bound chat records closedWorkPhaseId null even when workPhaseId is provided", () => {
  const cwd = gitRepoForHook();
  try {
    const id = "chat-all-done-ledger-null";
    const slug = "chat-all-done-ledger-null-plan";
    const plan = buildGoalplan({ objective: "close an all-done cycle without a target" });
    plan.slug = slug;
    plan.workPhases = [
      { id: "wp-finished", title: "finished", status: "done", tasks: [], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = null;
    writeGoalplan(cwd, plan);
    writeState(cwd, {
      ...defaultState(id),
      phase: "C",
      slug,
      orchestrationActive: true,
      checkEpoch: "c-all-done-null",
      flags: { interview: false, auditPassed: true, checkPassed: true },
    });
    seedChatReceipt(cwd, id, "c-all-done-null");
    const attest = JSON.stringify({
      from: "C",
      to: "D",
      did: "verified the completed plan",
      checkOutput: "ok",
      exitCode: 0,
      workPhaseId: "wp-finished",
      testReceiptPath: `.codexclaw/evidence/${id}/test-receipt.json`,
    });
    const planPath = join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json");
    const beforePlan = readFileSync(planPath, "utf8");

    const output = handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, id, "t1"));

    assert.doesNotMatch(output, /refused|blocked or superseded/);
    const context = JSON.parse(output.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(context, /\[codexclaw: DONE\]/);
    assert.match(context, /IPABCD: IDLE/);
    assert.equal(readState(cwd, id).phase, "IDLE");
    assert.equal(readState(cwd, id).dcloseRecovery, null);
    assert.equal(readFileSync(planPath, "utf8"), beforePlan);
    assert.deepEqual(
      ledgerLines(cwd)
        .filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE")
        .map((row) => [row.checkEpoch, row.closedWorkPhaseId]),
      [["c-all-done-null", null]],
    );
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

```ts
test("chat D-close rejects an invalid v3 dependency plan before every write", () => {
  const cwd = gitRepoForHook();
  try {
    const id = "invalid-v3-chat-close";
    const slug = "invalid-v3-chat-close-plan";
    const plan = buildGoalplan({ objective: "invalid chat dependency close" });
    plan.slug = slug;
    plan.schemaVersion = 3;
    plan.workPhases = [
      { id: "wp-1", title: "broken", status: "in_progress", dependsOn: ["missing"], tasks: [], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp-1";
    writeGoalplan(cwd, plan);
    writeState(cwd, {
      ...defaultState(id), phase: "C", slug, orchestrationActive: true, checkEpoch: "c-invalid",
      flags: { interview: false, auditPassed: true, checkPassed: true },
    });
    seedChatReceipt(cwd, id, "c-invalid");
    const statePath = join(cwd, STATE_DIR, "sessions", `${id}.json`);
    const planPath = join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json");
    const pabcdPath = join(cwd, STATE_DIR, LEDGER_FILE);
    const goalplanLedgerPath = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
    const before = {
      state: readFileSync(statePath, "utf8"),
      plan: readFileSync(planPath, "utf8"),
      pabcd: existsSync(pabcdPath) ? readFileSync(pabcdPath, "utf8") : "",
      goalplan: existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "",
    };
    const attest = JSON.stringify({
      from: "C", to: "D", did: "ran the suite", checkOutput: "ok", exitCode: 0,
      workPhaseId: "wp-1",
      testReceiptPath: `.codexclaw/evidence/${id}/test-receipt.json`,
    });

    const output = handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, id));

    assert.match(output, /invalid goalplan/);
    assert.equal(readFileSync(statePath, "utf8"), before.state);
    assert.equal(readFileSync(planPath, "utf8"), before.plan);
    assert.equal(existsSync(pabcdPath) ? readFileSync(pabcdPath, "utf8") : "", before.pabcd);
    assert.equal(existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "", before.goalplan);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

채팅 D-close 테스트 구역에 다음 테스트를 추가한다.

```ts
function seedRecoverableChatClose(cwd: string, id: string, slug: string): string {
  const plan = buildGoalplan({ objective: `recover ${id}` });
  plan.slug = slug;
  // Marker persisted, plan commit did not — the state right after step 1 of the
  // §5 table. The phase must stay open: seeding it `done` would make the plan
  // all-done, and before §39 Y2 the all-done branch consumed the retry and wrote
  // closedWorkPhaseId: null while these tests expected "wp-1". Recovery now runs
  // first and idempotently closes this fixed target (§39 Y1).
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    phase: "C",
    slug,
    orchestrationActive: true,
    checkEpoch: "c-recovery",
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-recovery",
      closedWorkPhaseId: "wp-1",
    },
  });
  return JSON.stringify({
    from: "C",
    to: "D",
    did: "ran the suite",
    workPhaseId: "wp-1",
  });
}

test("chat D-close recovery resumes when the marker target is absent from the plan", () => {
  const cwd = gitRepoForHook();
  try {
    const id = "chat-recovery-target-absent";
    const slug = "chat-recovery-target-absent-plan";
    const attest = seedRecoverableChatClose(cwd, id, slug);
    const remaining = buildGoalplan({ objective: "resume cleanup after target removal" });
    remaining.slug = slug;
    remaining.workPhases = [
      { id: "wp-2", title: "next", status: "in_progress", tasks: [], criteriaIds: [] },
    ];
    remaining.activeWorkPhaseId = "wp-2";
    writeGoalplan(cwd, remaining);
    const planPath = join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json");
    const beforePlan = readFileSync(planPath, "utf8");

    const output = handleUserPromptSubmit(
      ups(`orchestrate d --attest ${attest}`, cwd, id, "t1"),
    );

    assert.doesNotMatch(output, /refused|not in the bound goalplan/);
    const context = JSON.parse(output.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(context, /\[codexclaw: DONE\]/);
    assert.match(context, /IPABCD: IDLE/);
    assert.equal(readFileSync(planPath, "utf8"), beforePlan);
    assert.equal(
      ledgerLines(cwd).filter(
        (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE"
          && row.checkEpoch === "c-recovery" && row.closedWorkPhaseId === "wp-1",
      ).length,
      1,
    );
    assert.equal(readState(cwd, id).phase, "IDLE");
    assert.equal(readState(cwd, id).checkEpoch, null);
    assert.equal(readState(cwd, id).dcloseRecovery, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("chat D-close retry after state write appends the missing PABCD close row", () => {
  const cwd = gitRepoForHook();
  try {
    const id = "chat-retry-state";
    const attest = seedRecoverableChatClose(cwd, id, "chat-retry-state-plan");
    assert.throws(
      () => handleUserPromptSubmit(
        ups(`orchestrate d --attest ${attest}`, cwd, id, "t1"),
        process.platform,
        { afterStateWrite: () => { throw new Error("after state write"); } },
      ),
      /after state write/,
    );
    assert.equal(ledgerLines(cwd).length, 0);

    const retry = handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, id, "t2"));
    assert.doesNotMatch(retry, /refused/);
    assert.equal(ledgerLines(cwd).filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE").length, 1);
    assert.equal(readState(cwd, id).dcloseRecovery, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("chat D-close retry after PABCD append keeps one close row", () => {
  const cwd = gitRepoForHook();
  try {
    const id = "chat-retry-append";
    const attest = seedRecoverableChatClose(cwd, id, "chat-retry-append-plan");
    assert.throws(
      () => handleUserPromptSubmit(
        ups(`orchestrate d --attest ${attest}`, cwd, id, "t1"),
        process.platform,
        { afterPabcdLedgerAppend: () => { throw new Error("after PABCD append"); } },
      ),
      /after PABCD append/,
    );
    assert.equal(ledgerLines(cwd).filter((row) => row.sessionId === id).length, 1);

    handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, id, "t2"));
    assert.equal(ledgerLines(cwd).filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE").length, 1);
    assert.equal(readState(cwd, id).dcloseRecovery, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

```ts
test("chat D-close lock timeout keeps phase C, emits a warning, and writes no ledger", () => {
  const cwd = gitRepoForHook();
  try {
    const slug = "chat-cycle-lock-timeout";
    const plan = buildGoalplan({ objective: "chat lock timeout" });
    plan.slug = slug;
    plan.workPhases = [
      {
        id: "wp-1",
        title: "first",
        status: "in_progress",
        tasks: [{ id: "t-1", title: "the work", status: "done" }],
        criteriaIds: [],
      },
    ];
    plan.activeWorkPhaseId = "wp-1";
    writeGoalplan(cwd, plan);
    writeState(cwd, {
      ...defaultState("chat-lock"),
      phase: "C",
      slug,
      orchestrationActive: true,
      checkEpoch: "c-test",
      flags: { interview: false, auditPassed: true, checkPassed: true },
    });
    seedChatReceipt(cwd, "chat-lock", "c-test");
    const lock = join(cwd, STATE_DIR, "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
    const planPath = join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json");
    const beforePlan = readFileSync(planPath, "utf8");
    const attest = JSON.stringify({
      from: "C",
      to: "D",
      did: "ran the suite",
      checkOutput: "ok",
      exitCode: 0,
      workPhaseId: "wp-1",
      testReceiptPath: ".codexclaw/evidence/chat-lock/test-receipt.json",
    });

    let output = "";
    assert.doesNotThrow(() => {
      output = handleUserPromptSubmit(
        ups(`orchestrate d --attest ${attest}`, cwd, "chat-lock", "t1"),
      );
    });

    assert.match(output, /D-close was not applied/);
    assert.match(output, /\.goalplan\.lock/);
    assert.equal(readState(cwd, "chat-lock").phase, "C");
    assert.equal(readFileSync(planPath, "utf8"), beforePlan);
    assert.equal(ledgerLines(cwd).length, 0);
    assert.equal(existsSync(join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl")), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

hook entry의 code 0은 별도 subprocess assertion으로 고정한다. 같은 파일에 추가한다.

```ts
test("hook CLI exits 0 when chat D-close cannot acquire the goalplan lock", () => {
  const cwd = gitRepoForHook();
  try {
    const slug = "chat-process-lock-timeout";
    const plan = buildGoalplan({ objective: "chat process lock timeout" });
    plan.slug = slug;
    plan.workPhases = [
      { id: "wp-1", title: "first", status: "in_progress", tasks: [], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp-1";
    writeGoalplan(cwd, plan);
    writeState(cwd, {
      ...defaultState("chat-process"),
      phase: "C",
      slug,
      orchestrationActive: true,
      checkEpoch: "c-test",
      flags: { interview: false, auditPassed: true, checkPassed: true },
    });
    seedChatReceipt(cwd, "chat-process", "c-test");
    const lock = join(cwd, STATE_DIR, "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
    const attest = JSON.stringify({
      from: "C",
      to: "D",
      did: "ran the suite",
      checkOutput: "ok",
      exitCode: 0,
      workPhaseId: "wp-1",
      testReceiptPath: ".codexclaw/evidence/chat-process/test-receipt.json",
    });
    const payload = JSON.stringify(ups(
      `orchestrate d --attest ${attest}`,
      cwd,
      "chat-process",
      "t1",
    ));

    const child = spawnSync(
      process.execPath,
      ["--experimental-strip-types", resolve(dirname(fileURLToPath(import.meta.url)), "../src/cli.ts"), "hook", "user-prompt-submit"],
      { input: payload, encoding: "utf8" },
    );

    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /D-close was not applied/);
    assert.equal(readState(cwd, "chat-process").phase, "C");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

첫 프로세스가 PABCD append 직후 finalization callback 안에서 sentinel을 유지한다. 두 번째 프로세스는
그 sentinel을 확인한 뒤 같은 marker로 D-close를 시작한다. 락이 살아 있으면 두 번째 요청은 75ms 뒤
경고로 끝나고, 락을 없애면 첫 callback이 열린 동안 두 번째 요청이 완주해 overlap 파일을 남긴다.
`Promise.all`만으로 두 프로세스를 띄우면 순차 실행돼도 같은 단언이 통과하므로 시작 barrier와 임계
구역 hold 신호를 명시한다.

```ts
const HOOK_RACE_SCRIPT = String.raw`
import { existsSync, rmSync, writeFileSync } from "node:fs";

const [
  hookUrl, encodedPayload, attemptPath, insidePath, peerInsidePath,
  releasePath, overlapPath, donePath,
] = process.argv.slice(1);
const { handleUserPromptSubmit } = await import(hookUrl);
const payload = JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8"));

function waitForFile(path) {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for " + path);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}

if (attemptPath !== "-") writeFileSync(attemptPath, "attempted\n");
const hooks = insidePath === "-"
  ? {}
  : {
      afterPabcdLedgerAppend() {
        writeFileSync(insidePath, "inside finalization callback\n");
        try {
          if (peerInsidePath !== "-" && existsSync(peerInsidePath)) {
            writeFileSync(overlapPath, "callbacks overlapped\n");
          }
          if (releasePath !== "-") waitForFile(releasePath);
        } finally {
          rmSync(insidePath, { force: true });
        }
      },
    };

try {
  const output = handleUserPromptSubmit(payload, process.platform, hooks);
  // A completed second close while the peer sentinel still exists proves that its
  // transaction ran before the first finalization callback returned.
  if (output.includes("[codexclaw: DONE]") && peerInsidePath !== "-" && existsSync(peerInsidePath)) {
    writeFileSync(overlapPath, "second recovery completed inside its peer\n");
  }
  process.stdout.write(output);
} finally {
  if (donePath !== "-") writeFileSync(donePath, "done\n");
}
`;

interface HookRaceSignals {
  attemptPath?: string;
  insidePath?: string;
  peerInsidePath?: string;
  releasePath?: string;
  overlapPath?: string;
  donePath?: string;
}

function runHookProcess(
  payload: string,
  signals: HookRaceSignals = {},
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [
      "--experimental-strip-types", "--input-type=module", "-e", HOOK_RACE_SCRIPT,
      new URL("../src/hook.ts", import.meta.url).href,
      Buffer.from(payload, "utf8").toString("base64"),
      signals.attemptPath ?? "-",
      signals.insidePath ?? "-",
      signals.peerInsidePath ?? "-",
      signals.releasePath ?? "-",
      signals.overlapPath ?? "-",
      signals.donePath ?? "-",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectChild);
    child.on("close", (status) => resolveChild({ status, stdout, stderr }));
  });
}

async function waitForHookSignal(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 5));
  }
}

test("a second chat recovery contends while the first finalizer callback is held", async () => {
  const cwd = gitRepoForHook();
  try {
    const id = "chat-concurrent-recovery";
    const attest = seedRecoverableChatClose(cwd, id, "chat-concurrent-recovery-plan");
    const firstPayload = JSON.stringify(ups(`orchestrate d --attest ${attest}`, cwd, id, "t1"));
    const secondPayload = JSON.stringify(ups(`orchestrate d --attest ${attest}`, cwd, id, "t2"));
    const firstInside = join(cwd, "first-finalizer-inside");
    const secondAttempted = join(cwd, "second-recovery-attempted");
    const secondDone = join(cwd, "second-recovery-done");
    const overlap = join(cwd, "recovery-finalizers-overlapped");

    const first = runHookProcess(firstPayload, {
      insidePath: firstInside,
      releasePath: secondDone,
      overlapPath: overlap,
    });
    await waitForHookSignal(firstInside);

    const second = runHookProcess(secondPayload, {
      attemptPath: secondAttempted,
      peerInsidePath: firstInside,
      overlapPath: overlap,
      donePath: secondDone,
    });
    const [firstResult, secondResult] = await Promise.all([first, second]);

    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.match(firstResult.stdout, /\[codexclaw: DONE\]/);
    assert.match(secondResult.stdout, /D-close was not applied/);
    assert.equal(existsSync(secondAttempted), true);
    assert.equal(
      existsSync(overlap),
      false,
      "the second recovery must not complete while the first finalizer callback is active",
    );
    assert.equal(
      ledgerLines(cwd).filter(
        (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE"
          && row.checkEpoch === "c-recovery" && row.closedWorkPhaseId === "wp-1",
      ).length,
      1,
    );
    assert.equal(readState(cwd, id).dcloseRecovery, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

이 블록에 맞춰 `hook.test.ts` import에 `dirname`, `resolve`, `fileURLToPath`를 추가한다. 기존
`spawnSync` import는 유지하고 동시 회귀용 `spawn`을 더한다.

### 8.5 MODIFY — `plugins/codexclaw/components/pabcd-state/test/review-binding.test.ts`

review CLI operation과 observer hook의 차이를 아래 두 테스트로 고정한다.

```ts
test("review-round abort is fail-closed when the common lock is held", () => {
  const { cwd, slug } = seedAtA();
  try {
    assert.equal(open(cwd, "devlog/_plan/260815_probe/000_plan.md").code, 0);
    const lock = join(cwd, ".codexclaw", "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
    const before = readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8");
    const parsed = parseReviewRoundCliArgs(
      ["abort", "--session", "rb", "--cwd", cwd, "--reason", "reviewer died"],
      cwd,
    );
    assert.ok(!("error" in parsed));

    const result = runReviewRoundCli(parsed as never);

    assert.equal(result.code, 1);
    assert.match(result.output, /\.goalplan\.lock/);
    assert.equal(readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8"), before);
    assert.equal(latestRound(readGoalplan(cwd, slug)!, "plan_audit")!.status, "in_flight");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("review observer is fail-open on lock timeout and leaves verdict unrecorded", () => {
  const { cwd, slug } = seedAtA();
  try {
    const opened = open(cwd, "devlog/_plan/260815_probe/000_plan.md");
    assert.equal(opened.code, 0);
    const launchId = opened.output.split("\n")[0];
    const lock = join(cwd, ".codexclaw", "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
    const before = readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8");

    let output = "not-called";
    assert.doesNotThrow(() => {
      output = handleReviewObserver(JSON.stringify({
        hook_event_name: "SubagentStop",
        session_id: "rb",
        cwd,
        agent_type: "explorer",
        agent_id: "reviewer-1",
        last_assistant_message: `LAUNCH: ${launchId}\nVERDICT: PASS`,
      }));
    });

    assert.equal(output, "");
    assert.equal(readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8"), before);
    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "in_flight");
    assert.equal(round.lane.verdict, undefined);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

## 9. 출력 문자열과 기존 테스트 갱신 (§28 소유 표)

실제 검색 명령은 아래와 같다.

```bash
rg -n 'deepEqual' plugins/codexclaw/test/

rg -n 'the plan is empty|not in the bound goalplan|cycle closed|blocked or superseded|no active work-phase|could not be read|busy|D-close was not applied|workPhaseId|\.steer\.lock|drvfs|9p|holds the lock|This lock lives on' \
  plugins/codexclaw/components/pabcd-state/test/
```

검색 결과와 처분은 아래와 같다. “0건”은 pabcd-state의 기존 테스트 전체에 해당 문자열을 기다리는 assert가
없다는 뜻이다. 새 테스트는 §8에 본문까지 적었다.

| 생산 문자열 또는 동작 | rg로 찾은 기존 테스트 | 기존 단언 변경 소유자 | 갱신 |
| --- | --- | --- | --- |
| `goalplan '<slug>' is busy. Lock directory: ...` | 0건 | wp5 | §8.1 contention, §8.2 steering, §8.3 CLI, §8.4 chat, §8.5 review 테스트 신설 |
| `.steer.lock`, `holds the lock`, `This lock lives on drvfs/9p` | `steering.test.ts:161,173`, `steering-ops.test.ts:5,25,55~72` | wp5 | `steering.test.ts`는 §8.2, `steering-ops.test.ts`는 §8.2.1이 `.goalplan.lock`과 플랫폼 중립 절대 경로 단언으로 갱신. WSL tier 진단은 제거 |
| CLI `D-close was not applied` | 0건 | wp5 | §8.3 lock timeout 테스트 신설 |
| 채팅 `D-close was not applied` | 0건 | wp5 | §8.4 direct hook·subprocess 테스트 신설, 사용자 노출 문자열을 영어로 통일 |
| `the plan is empty — register workPhases[] first` | `orchestrate-cli.test.ts:863-881`의 `/the plan is empty/` | 없음 — 기존 단언 유지 | 빈 plan 검사를 target 소속 검사보다 먼저 두며 테스트 본문은 바꾸지 않음 |
| `work-phase <id> is not in the bound goalplan` | 0건 | wp5 | 빈 plan이 아닌 plan에서만 target 소속 실패로 사용 |
| `bound chat D-close requires attest.workPhaseId` | 기존 bound chat fixture 2건은 문자열 assert 없이 target 누락 | wp5 | 두 fixture에 `workPhaseId: "wp-1"`, 누락 음성 테스트 신설. 빈 plan·all-done 판정 뒤에만 거부 |
| `Bound chat D-close requires workPhaseId ... unless every work-phase is already done.` | `hook.test.ts`의 `posix arming directive is byte-identical to its pinned snapshot` | wp5 | 생산 문자열과 pinned snapshot을 같은 diff로 갱신 |
| v3 done task outcome | `orchestrate-cli.test.ts:738~750`의 `seedBoundCycleAtC()`와 `hook.test.ts:675~695`의 채팅 성공 fixture가 outcome 없는 done task 생성 | wp5 | helper는 `taskStatus === "done"`일 때 `outcome: "focused tests passed"`를 추가하고, 채팅 성공 fixture도 같은 값을 추가. schemaVersion은 v3 유지 |
| all-done plan 정상 종료 | `orchestrate-cli.test.ts:840`의 `D-close succeeds when every work-phase is already done` | wp5 | 성공 기대를 유지하고 marker 부재와 blocked/superseded 문구 부재를 추가 단언 |
| all-done bound chat 정상 종료 | 기존 채팅 회귀 없음 | wp5 | `workPhaseId` 누락·존재 두 경우를 §8.4에서 실행하고 둘 다 marker 없이 IDLE, plan byte 불변, goalplan 원장 부재를 단언 |
| `Dependency deadlock: ...` | `orchestrate-cli.test.ts`의 `D-close is refused when every remaining work-phase is blocked`가 `/blocked or superseded/` 대기 | wp4 | wp4가 §28에 따라 `/Dependency deadlock: work-phase wp-1 is blocked/`로 먼저 갱신하며 wp5는 그 After를 보존 |
| HITL 옛 성공 문구 `current=C -> IDLE ...` | `orchestrate-cli.test.ts:908`의 `an unbound (HITL) session closes its cycle exactly as before`가 code/state만 단언 | wp5 | 옛 문구 exact assert와 `/close target/` 부재 단언을 같은 테스트에 추가 |
| bound `close target <id> is complete`와 marker cleanup 경고 | 기존 문자열 단언 0건. bound 성공 테스트는 `orchestrate-cli.test.ts:803` | wp5 | 기존 bound 성공 테스트에 `/close target wp-1 is complete/`를 추가하고 §8.3 세 실패 주입 재시도가 성공·경고 경로를 고정 |
| PABCD close 중복 키 `(sessionId, checkEpoch, closedWorkPhaseId)` | 기존 테스트는 `sessionId/from/to`만 세며 둘째 cycle을 닫는 fixture 없음 | wp5 | §8.3 같은 세션 연속 두 cycle 테스트가 `c-test-epoch/wp-1`, `c-second-cycle/wp-2` 두 행을 단언 |
| persisted state exact shape의 `dcloseRecovery: null` | `components/pabcd-state/test/state.test.ts`의 fresh state shape, `plugins/codexclaw/test/hook-e2e.test.mjs:160-184`의 compiled SessionStart shape | wp5 | §8.2.2와 §8.2.3 두 객체에 `dcloseRecovery: null` 추가. 루트 test 디렉터리의 다른 `deepEqual`은 배열·인자·바이트 단언이라 변경 없음 |
| marker target이 plan에서 사라진 recovery | 기존 CLI·채팅 회귀는 target `wp-1`을 `done` 상태로 plan에 남김 | wp5 | §8.3 CLI와 §8.4 채팅에서 target 부재, 다음 `wp-2` 존재 fixture로 정리 재개와 close row 1개를 단언 |
| all-done + 입력 `workPhaseId`의 PABCD close target | 기존 all-done 채팅 회귀는 state·plan·goalplan 원장만 단언 | wp5 | §8.4 전용 테스트가 PABCD 행을 `[["c-all-done-null", null]]`로 고정 |

wp4에서 이어받는 기존 assert의 적층 기준은 아래다. 050에서 옛 assert를 다시 만들지 않는다.

```ts
// wp4 적용 후 orchestrate-cli.test.ts 상태 — wp5가 보존
assert.match(r.output, /Dependency deadlock: work-phase wp-1 is blocked/);
```

050이 직접 소유하는 기존 테스트 갱신 diff는 §8.2.2 component persisted shape, §8.2.3 루트 E2E
persisted shape, §8.3의 `seedBoundCycleAtC()` v3 outcome, bound/HITL 성공 문구 분리, all-done 성공
보강과 §8.4의 채팅 성공 fixture v3 outcome, bound chat fixture 두 건, pinned snapshot이다. 신규 문자열,
target 부재 recovery, all-done 채팅 원장 경계는 같은 절에 본문이 있다.

## 10. 검증 명령과 구체 기대값

작업 디렉터리는 `/Users/jun/Developer/new/700_projects/codexclaw`다. 계약 §37 W5에 따라 단계 게이트는
`focused test → npm run build → npm test → npm run gate` 순서를 지킨다. focused 실행 전에 신규 파일,
신규 등록 수, 삭제 수, 순증, 최종 등록 수를 각각 검사한다. 앵커 없는 선택자와 존재하지 않는 신규 파일이
함께 있으면 구현이 0건이어도 exit 0이 나는 false-green이 된다 — wp2·wp3·wp4에서 반복 확인된 결함이다.

### 10.1 focused 등록 수와 실행

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw

verification_tmp="$(mktemp -d)"
trap 'rm -rf "$verification_tmp"' EXIT
export TMPDIR="$verification_tmp"

baseline_sha=8321b2d7
new_file=plugins/codexclaw/components/pabcd-state/test/goalplan-concurrency.test.ts
existing_focused_files=(
  plugins/codexclaw/components/pabcd-state/test/state.test.ts
  plugins/codexclaw/components/pabcd-state/test/orchestrate-apply.test.ts
  plugins/codexclaw/components/pabcd-state/test/steering.test.ts
  plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts
  plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts
  plugins/codexclaw/components/pabcd-state/test/hook.test.ts
  plugins/codexclaw/components/pabcd-state/test/review-binding.test.ts
)
focused_files=(
  "$new_file"
  "${existing_focused_files[@]}"
)

# 존재하지 않는 신규 파일을 node가 조용히 무시해 GREEN을 내지 못하게 먼저 막는다.
test -f "$new_file"

baseline_focused_count="$(
  git grep -E '^[[:space:]]*test\(' "$baseline_sha" -- "${existing_focused_files[@]}" \
    | wc -l | tr -d '[:space:]'
)"
test "$baseline_focused_count" -eq 192

existing_diff="$(git diff --unified=0 "$baseline_sha" -- "${existing_focused_files[@]}")"
added_existing_declarations="$(printf '%s\n' "$existing_diff" | rg -c '^\+[[:space:]]*test\(')"
removed_declarations="$(printf '%s\n' "$existing_diff" | rg -c '^-[[:space:]]*test\(')"
new_file_declarations="$(rg -c '^[[:space:]]*test\(' "$new_file")"

# 이 한 선언은 두 workPhaseId 값으로 테스트 두 건을 등록하므로 선언 수보다 한 건 많다.
parameterized_extra_cases="$(
  rg -c '^for \(const workPhaseId of \[undefined, "wp-finished"\] as const\) \{' \
    plugins/codexclaw/components/pabcd-state/test/hook.test.ts
)"

test "$added_existing_declarations" -eq 29
test "$new_file_declarations" -eq 6
test "$parameterized_extra_cases" -eq 1
test "$removed_declarations" -eq 5

new_case_count=$((added_existing_declarations + new_file_declarations + parameterized_extra_cases))
net_case_count=$((new_case_count - removed_declarations))
test "$new_case_count" -eq 36
test "$net_case_count" -eq 31

focused_declaration_count="$(rg -n '^[[:space:]]*test\(' "${focused_files[@]}" | wc -l | tr -d '[:space:]')"
focused_case_count=$((focused_declaration_count + parameterized_extra_cases))
test "$focused_declaration_count" -eq 222
test "$focused_case_count" -eq 223

node --experimental-strip-types --test --test-concurrency=1 \
  --test-name-pattern='^' \
  "${focused_files[@]}"
```

기대값은 아래와 같다.

- 신규 파일 존재 검사 exit 0
- 기준 HEAD `8321b2d7`의 focused 등록 수 192
- 기존 파일 추가 선언 29개, 신규 파일 선언 6개
- 두 입력을 도는 parameterized 선언의 추가 등록 1개
- 계획된 신규 케이스 36개, 삭제 5개, 순증 31개
- 구현 뒤 선언 222개, 실제 focused 등록 223개
- node test exit 0, tests 223, pass 223, fail 0

락 timeout 테스트는 delay 배열 `[5, 10, 20, 40]`, 합 `75`, callback 진입 0회를 확인한다.
CLI D-close 최초 락 실패는 code 1과 phase `C`, 채팅 D-close subprocess는 code 0과 phase `C`를
확인한다. target 부재 recovery는 CLI code 0, state `IDLE`, marker `null`,
`closedWorkPhaseId: "wp-1"`인 PABCD 행 1개를 기다린다. all-done + `workPhaseId` 채팅은 state
`IDLE`과 PABCD tuple `[["c-all-done-null", null]]`을 기다린다.

이 focused gate는 `runOrchestrateCli()`, `handleUserPromptSubmit()`, `runReviewRoundCli()`,
`handleReviewObserver()`, `applyHumanTransition()`, 공통 락 API를 TypeScript 소스에서 직접
import하고 호출한다. `npm run build`는 타입 제거와 파일 복사를 맡으므로 타입·import·미정의 식별자
검증 근거로 쓰지 않는다.

### 10.2 tracked dist 생성과 레이아웃 검사

focused gate가 통과한 뒤 실행한다.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
npm run build
```

기대값은 exit 0이다. 변경한 `src/*.ts`와 같은 basename의 tracked `dist/*.js`를 재생성하고
컴포넌트 산출물 레이아웃 검사를 통과한다.

### 10.3 전체 저장소 회귀

build가 끝난 뒤 실행한다.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
npm test
```

기대값은 exit 0, tests 2198, pass 2198, fail 0이다. 기존 2167건과 wp5 순증 31건을 모두 실행하며,
루트 `dist-freshness.test.mjs`가 변경 src와 tracked dist의 byte equality를 확인한다.

### 10.4 저장소 gate

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw
npm run gate
```

기대값은 exit 0, gate 오류 0이다.

### 10.5 전용 락 잔여와 write 임계 구역 감사

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw

! rg -n '\.steer\.lock' \
  plugins/codexclaw/components/pabcd-state/src \
  plugins/codexclaw/components/pabcd-state/test
```

기대값은 0건이다.

아래 검사는 문자열 위치를 출력하는 데서 끝내지 않는다. 이전 초안은 `rg`로 9곳을 출력만 해서 항상
exit 0이었다. TypeScript AST에서 `writeGoalplan()` 호출마다 조상 callback을 조사한다. 신규 plan을
만드는 `goalplan-cli.ts` 호출 한 곳만 락 밖에 둘 수 있고, 기존 plan mutation 일곱 곳은 모두
`withGoalplanWriteLock()`의 세 번째 인자인 callback 안에 있어야 한다.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw

node --input-type=commonjs <<'NODE'
const assert = require("node:assert/strict");
const { readdirSync, readFileSync } = require("node:fs");
const { basename, join } = require("node:path");
const ts = require("typescript");

const srcDir = "plugins/codexclaw/components/pabcd-state/src";
const calls = [];

for (const name of readdirSync(srcDir).filter((entry) => entry.endsWith(".ts"))) {
  const path = join(srcDir, name);
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  function visit(node, ancestors = []) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "writeGoalplan") {
      const locked = ancestors.some((ancestor) => {
        if (!ts.isArrowFunction(ancestor) && !ts.isFunctionExpression(ancestor)) return false;
        const parent = ancestor.parent;
        return ts.isCallExpression(parent)
          && ts.isIdentifier(parent.expression)
          && parent.expression.text === "withGoalplanWriteLock"
          && parent.arguments[2] === ancestor;
      });
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      calls.push({ file: basename(path), line, locked });
    }
    ts.forEachChild(node, (child) => visit(child, [...ancestors, node]));
  }

  visit(source);
}

const initCalls = calls.filter((call) => call.file === "goalplan-cli.ts" && !call.locked);
const escapedMutations = calls.filter((call) => call.file !== "goalplan-cli.ts" && !call.locked);
const lockedMutations = calls.filter((call) => call.locked);

assert.equal(calls.length, 8, JSON.stringify(calls));
assert.equal(initCalls.length, 1, JSON.stringify(calls));
assert.deepEqual(escapedMutations, [], JSON.stringify(escapedMutations));
assert.equal(lockedMutations.length, 7, JSON.stringify(calls));

console.log(JSON.stringify(calls));
NODE
```

기대값은 exit 0이다. 출력 배열은 호출 8개를 담고, `goalplan-cli.ts` init 한 곳만 `locked: false`,
나머지 일곱 곳은 모두 `locked: true`다.

### 10.6 담당 문서 추적·공백 검사

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /Users/jun/Developer/new/700_projects/codexclaw

doc=devlog/_plan/260829_goalplan-dependency-execution/050_wp5_write_serialization.md
test -f "$doc"
git ls-files --error-unmatch "$doc" >/dev/null

doc_status="$(git status --porcelain -- "$doc")"
! printf '%s\n' "$doc_status" | rg -q '^\?\? '

git diff --check -- "$doc"
```

기대값은 `test -f`, `git ls-files`, `git diff --check`가 모두 exit 0인 것이다. 이 문서는 이미
tracked이므로 이전 초안의 `?? …050….md` 기대는 거짓이었고, 출력을 검사하지 않아 조용히 통과했다.
`/dev/null`과 비교하는 `git diff --no-index`는 쓰지 않는다 — 내용과 무관하게 항상 exit 1이라
아무것도 검증하지 않는다.

### 10.7 import 적층 감사

계약 §36에 맞춰 이 문서가 손대는 파일의 import 처분을 다시 확인한다.

| 파일 | import 처분 |
| --- | --- |
| `src/goalplan.ts` | wp4 전체 `node:fs` After를 보존하고 wp5 `statSync`만 더한다. |
| `src/state.ts` | import 변경 없음. |
| `src/orchestrate-apply.ts` | import 변경 없음. |
| `src/steering.ts` | wp4의 goalplan 이름을 보존하고 wp5 lock 이름을 더한다. 전용 락에서만 쓰던 fs/path/Wsl 이름만 지운다. |
| `src/orchestrate-cli.ts` | wp4 `dependencyDeadlock`을 보존하고 wp5 lock, recovery, 두 integrity helper를 더한다. |
| `src/hook.ts` | wp4 `dependencyDeadlock`을 보존하고 wp5 fs/path, lock, recovery, 두 integrity helper를 더한다. |
| `src/review-round-cli.ts` | 현재 전체 import를 Before로 적고 wp5 `withGoalplanWriteLock`, `ReviewRoundState`를 더한 전체 After를 적는다. |
| `src/review-observer.ts` | 현재 전체 import를 Before로 적고 wp5 `withGoalplanWriteLock`을 더한 전체 After를 적는다. |
| `test/goalplan-concurrency.test.ts` | 신규 파일 전체 import이며 `isAbsolute`와 `spawn`을 포함한다. |
| `test/steering.test.ts` | import 변경 없음. |
| `test/steering-ops.test.ts` | 전체 After에서 전용 `WslDeps`만 지운다. |
| `test/orchestrate-cli.test.ts` | 기존 goalplan import를 보존하고 `readGoalplan`을 더한다. |
| `test/hook.test.ts` | 기존 `join`, `spawnSync`를 보존하고 `dirname`, `resolve`, `fileURLToPath`, `spawn`을 더한다. |
| `test/review-binding.test.ts` | import 변경 없음. |
| `test/state.test.ts` | import 변경 없음. |
| `plugins/codexclaw/test/hook-e2e.test.mjs` | import 변경 없음. persisted state exact shape만 갱신한다. |
| `test/orchestrate-apply.test.ts` | import 변경 없음. |

## 11. 완료 기준

- wp5 선행 조건은 wp2·wp3·wp4이며 wp6 공개 표면보다 먼저 합쳐진다.
- `.goalplan.lock` 획득은 `mkdirSync(lockDir, { recursive: false })` 한 판정만 쓴다.
- 75ms 뒤 자동 회수 없이 실패하고 오류가 락 경로와 수동 정리 절차를 적는다.
- `owner.json`은 진단 전용이며 획득·회수·해제 판정 입력이 아니다.
- CLI lifecycle, steering apply, review open/abort, D-close는 락 실패 시 연산을 중단한다.
- 채팅 D-close는 전이를 중단하지만 hook 프로세스는 code 0으로 끝난다.
- observer와 stale-round housekeeping은 부수 기록만 포기한다.
- 락 실패는 Stop block을 만들지 않는다.
- 거부 경로는 plan과 goalplan 원장을 한 바이트도 바꾸지 않는다.
- 거부 이벤트, 기존 phase 의존 사후 편집 op, stale 자동 회수 코드와 관련 테스트가 없다.
- complete-task의 권위 증거는 `GoalplanTask.outcome`이며 원장 detail은 부차적 사본이다.
- D-close는 attest의 `workPhaseId`를 고정 target으로 쓰며 이미 done이면 다음 pending phase를 닫지 않는다.
- slug 없는 HITL D-close는 기존 state/PABCD 원장과 옛 성공 문구로 즉시 끝나며 goalplan 락과 marker 정리를 타지 않는다.
- 비어 있지 않은 all-done plan은 marker 없이 cycle만 IDLE로 닫고 blocked/superseded 문구를 쓰지 않는다.
- recovery는 state marker의 `sessionId`, `checkEpoch`, `closedWorkPhaseId`가 모두 맞을 때만 허용한다.
- marker가 일치한 recovery는 plan에서 target을 다시 찾지 않으며, target이 사라졌어도 남은 원장·state
  정리를 재개한다. CLI와 채팅은 빈 plan → all-done → marker recovery → target 검증 순서를 같이 쓴다.
- PABCD close 원장도 `(sessionId, checkEpoch, closedWorkPhaseId)`를 저장하고 같은 3-tuple만 중복으로 본다.
- all-done cycle close의 PABCD `closedWorkPhaseId`는 입력 `workPhaseId` 유무와 무관하게 `null`이다.
- 같은 세션의 다음 cycle은 새 check epoch와 close target으로 별도 PABCD close 행을 남긴다.
- plan 일부만 done인 상태의 과거 done phase, IDLE attest, 다른 세션 marker는 정상 gate에서 거부된다.
- marker는 정상 gate 뒤 goalplan 락 안에서 기록하고 state·두 원장 완료 뒤 같은 락 안에서 지운다.
- PABCD close-row 확인·append·marker cleanup은 같은 goalplan 락 임계 구역이며 동시 recovery도 같은
  3-tuple을 한 번만 append한다.
- D-close는 락 안에서 두 integrity helper를 marker·write보다 먼저 실행하며 invalid v3 plan 거부 시
  goalplan, state, 두 원장의 바이트가 모두 그대로다.
- reset은 IDLE+marker도 no-op으로 보지 않고 `dcloseRecovery: null`, `checkEpoch: null`로 저장한다.
- `GoalplanLedgerEntry` 객체 literal에 타입에 없는 `workPhaseId`, `taskId`를 넣지 않는다.
- `goalplanWriteLockStatus()`의 exists→stat ENOENT 경쟁은 `{ exists: false, ageMs: null }`다.
- wp6은 `cxc loop show`에서 lock status를 소비한다. 이 소비 diff는 060 소유다.
- goalplan commit, state write, PABCD append 직후 실패를 각각 재시도해도 고정 target의 close 행은 1개다.
- 커밋 순서는 첫 락 안 `goalplan.json → goalplan 원장`, 락 밖 `state`, 둘째 락 안
  `PABCD close-row 확인·append → marker cleanup`이다.
- 락 실패 문구와 테스트는 플랫폼 중립적인 절대 lock directory를 적고 `isAbsolute()`로 판정한다.
- bound CLI D-close는 빈 plan을 target 소속보다 먼저 검사하며 기존 `the plan is empty` 단언을 바꾸지 않는다.
- bound CLI D-close는 §35의 8단계 검사 순서를 지키고 `close target <id> is complete`를 bound 성공에만 쓴다.
- 채팅을 포함한 사용자 노출 락 실패·marker 정리 문구는 영어다.
- `dependencyDeadlock()`은 전역 교착 판정 전용이고 wp4의 `dependencyWaitReasons()`와 교체하지 않는다.

DONE: 050_wp5_write_serialization.md — §38 X1 루트 E2E exact shape와 X2 target 없는 recovery·all-done null 원장 경계를 닫음
