# 040 — 최종 gate 선행조건 spawn 가드

출처: `001` #8 (ADAPT / E1) · 의존: `030`(gate 상태), `020`(소스 정체성) · 상태: PLANNED

## 문제

C 단계 산문은 테스트와 독립 리뷰를 요구하지만 PreToolUse는 선행 산출물을 확인하지 않는다
(`plugins/codexclaw/components/pabcd-state/src/hook.ts:257-267`;
spawn 훅은 토폴로지·스킬·라우팅만 처리 —
`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:705-845`).
그래서 테스트를 돌리지 않고 최종 리뷰어를 띄울 수 있다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/components/subagent-config/src/final-gate-guard.ts` | 신규 |
| `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts` | 최종 allow 경로에서 가드 호출 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | `CriterionSurface` 타입 + `GoalplanCriterion.surface?` |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | criterion reviver(`:128-139`)가 `surface`를 읽고 검증 (미지값은 거부) |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | `NewGoalplanInput.criteria[]`(`:198-203`)에 `surface?` + `buildGoalplan`(`:210-216`)이 전달 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts` | `--criterion` 입력 문법에 surface 표기 추가 (`GoalplanCliArgs.criteria: string[]`는 현재 문자열만 받는다) |
| `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts` | reviver/builder/CLI 파싱 케이스 |
| `plugins/codexclaw/components/subagent-config/test/final-gate-guard.test.ts` | 신규 |
| `plugins/codexclaw/skills/pabcd/SKILL.md` | C 단계에 마커 규약 문서화 |

## before → after

### typed surface 필드 (재감사 5 반영)

초기 초안은 "work-phase가 browser/GUI/TUI criterion을 선언한 경우"라고 썼지만
현행 `GoalplanCriterion`에는 surface 필드가 없다 (`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:34-40` —
`id`, `scenario`, `expectedEvidence`, `capturedEvidence`, `status`뿐). 산문을 문자열 검색해
표면을 추측하는 것은 오탐/누락 둘 다 만든다. 그래서 타입을 먼저 넣는다.

```ts
export type CriterionSurface = "logic" | "cli" | "web" | "tui" | "api";
// GoalplanCriterion에 surface?: CriterionSurface (없으면 "logic"으로 취급)
```

**생성·보존 사슬 (3라운드 감사 4):** 타입만 추가하면 값을 만들 경로가 없어 QA 조건이
영원히 무장하지 않는다. 현재 사슬은 전 구간이 surface를 모른다 —
reviver(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:128-139`)는
`id`/`scenario`/`expectedEvidence`/`capturedEvidence`/`status`만 읽고,
`NewGoalplanInput.criteria`(`:198-203`)는 `{scenario, expectedEvidence?}`뿐이며,
`buildGoalplan`(`:210-216`)도 그 둘만 옮기고, CLI는 `criteria: string[]`로 문자열만 받는다
(`plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:30-40`).

그래서 네 지점을 모두 바꾼다.

1. reviver: `surface`가 있으면 enum 값인지 검증하고, 미지 값은 계획 전체를 거부한다
   (조용히 `logic`으로 떨어뜨리면 QA 요구가 사라진다). 필드가 없으면 `logic`.
2. `NewGoalplanInput.criteria[]`에 `surface?: CriterionSurface` 추가.
3. `buildGoalplan`이 그 값을 그대로 옮긴다.
4. CLI 입력: **접두 문법을 쓰지 않는다** (4라운드 감사 9). `--criterion`은 현재 임의
   문자열을 그대로 받으므로 (`plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:61-64`),
   `prefix:` 해석을 도입하면 `--criterion "Given: user is logged in"` 같은 정상 자유문이
   깨지거나 오류가 된다. 대신 **별도 플래그**를 둔다:
   `--criterion "<scenario>" --criterion-surface <enum>` — 직전 `--criterion`에 적용되고,
   생략하면 `logic`. enum 밖 값은 오류. `--criterion-surface`가 선행 `--criterion` 없이
   나오면 오류.

`091`이 criterion을 수정할 때도 `surface`를 보존해야 한다 — 그쪽 문서에 명시했다.

QA 영수증을 요구하는 조건: 활성 work-phase의 criteria 중 `surface`가 `web` 또는 `tui`인
것이 하나라도 있을 때. 그 외에는 요구하지 않는다. 필드가 없는 구버전 계획은 `logic`으로
읽히므로 QA를 요구하지 않는다 (하위 호환).

이 문서에서 표면을 지칭할 때는 항상 enum 값(`web`/`tui`/`cli`/`api`/`logic`)을 쓴다 —
"browser"나 "GUI" 같은 enum 밖 용어를 섞지 않는다.

### 마커 규약과 그 한계

최종 gate 리뷰어 패킷은 첫 줄에 `[CXC-FINAL-GATE]`를 포함한다. **"review" 같은 일반
단어로 의도를 추론하지 않는다** — 오탐이 나면 정상적인 리뷰 디스패치가 막히기 때문이다.
마커가 없는 spawn은 이 가드를 통과한다.

**정직한 한계 (재감사 5):** 따라서 이 가드는 마커를 붙이지 않으면 우회된다. 이것은
E1 런타임 강제가 아니라 **"마커를 붙인 경우의" 강제**다. 문서에 그렇게 적는다 —
"훅이 최종 gate를 강제한다"고 쓰지 않는다. 우회 불가능한 층은 `030`의 완료 검증기다:
`schemaVersion >= 2` 계획은 gate가 `approved`가 아니면 `update_goal complete`가 거부된다.
즉 **강제는 `030`이 하고, `040`은 순서를 앞당겨 알려주는 조기 경고**다. 이 역할 분담을
`040`의 목적으로 명시한다.

### `final-gate-guard.ts` — 신규

```ts
export interface FinalGateCheck {
  ok: boolean;
  reason?: string;   // deny 메시지 (누락 경로/불일치 SHA 명시)
}
export function checkFinalGatePrereqs(
  packetText: string, sessionId: string, cwd: string,
): FinalGateCheck;
```

판정 순서:

1. 패킷에 `[CXC-FINAL-GATE]`가 없으면 `{ok: true}` (관여하지 않음).
2. 세션에 결박된 goalplan이 없으면 `{ok: true}` (가벼운 사용 차단 금지, fail-open).
3. `finalGate.testReceiptPath`가 없거나 파일이 없거나 0바이트 → deny, 누락 경로 명시.
4. 활성 work-phase의 criteria 중 `surface`가 `web` 또는 `tui`인 것이 있을 때만
   `qaReceiptPath`를 같은 방식으로 요구. 없으면 요구하지 않는다.
5. **SHA 결박:** 각 영수증에 기록된 `SourceIdentity`가 현재 소스와 `compareSource(...).kind === "same"`인지 확인.
   `false`면 deny하고 "어느 영수증이 어느 SHA에 묶였는지"를 모두 나열한다.
   `"unavailable"`(git 없음)이면 이 가드는 **allow**한다 — 조기 경고 층이므로 막지 않고,
   실제 거부는 `030`이 한다 (`020`의 소비자 표).

### `spawn-attach-hook.ts` — 호출 지점

before (`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:705-845`): 재귀 deny → 페이로드 검증 → 역할/스킬 라우팅 → allow 또는 rewrite.

after: 재귀 deny와 페이로드 검증 **이후**, allow/rewrite 직전에 `checkFinalGatePrereqs`를
호출한다. deny는 기존 E1 봉투를 그대로 쓴다. 훅은 예외에서 fail-open한다 (오류 시 allow).

토큰 변형 전부 처리: `spawn_agent`, `collaborationspawn_agent`,
`collaboration.spawn_agent`, `collaboration_spawn_agent`.

## 테스트 (accept criteria)

| 시나리오 | 기대 |
| --- | --- |
| 마커 없는 일반 리뷰어 spawn | allow (가드 무관여) |
| 마커 있음, goalplan 미결박 | allow (fail-open) |
| 마커 있음, test 영수증 없음 | deny, 이유에 누락 경로 |
| 마커 있음, test 영수증 0바이트 | deny |
| 마커 있음, test 영수증 유효, `web`/`tui` criterion 없음 | allow (QA 미요구) |
| 마커 있음, `surface: "web"` criterion 있고 QA 영수증 없음 | deny |
| 마커 있음, `surface: "tui"` criterion 있고 QA 영수증 없음 | deny |
| 마커 있음, `surface: "cli"`만 있음, QA 영수증 없음 | allow |
| `surface` 필드 없는 구버전 계획 | `logic` 취급, QA 미요구 |
| `surface`에 enum 밖 값 | 계획 역직렬화 거부 (조용히 `logic` 아님) |
| CLI `--criterion "..." --criterion-surface web` | `surface: "web"`으로 생성 |
| CLI `--criterion "..."` (플래그 없음) | `surface: "logic"` |
| CLI `--criterion-surface wev` (오타) | 오류 |
| CLI `--criterion-surface`가 `--criterion` 없이 선행 | 오류 |
| CLI `--criterion "Given: user is logged in"` | 자유문 그대로 보존, `surface: "logic"` (회귀 방지) |
| `--criterion` 두 개 + 두 번째만 surface 지정 | 첫째 `logic`, 둘째 지정값 |
| `buildGoalplan`에 surface 전달 | 계획 JSON에 보존 |
| `compareSource(...).kind === "unavailable"` | allow (거부는 `030`이 담당) |
| 마커를 생략한 최종 gate spawn | allow — 이 가드는 우회 가능하며 `030`이 최종 강제층 |
| 영수증 SHA ≠ 현재 소스 | deny, 두 SHA 모두 표시 |
| 영수증 SHA = 현재 소스, 전부 유효 | allow |
| 가드 내부 예외 발생 | allow (fail-open), stderr 경고 |
| 4가지 도구 토큰 변형 | 동일하게 동작 |

검증 명령: `npm test`, `npx tsc --noEmit`, `npm run gate`.

## 범위 밖

- 전용 gate-reviewer 역할 (역할 증설 금지).
- 총 fan-out 상한 (DEFER, `001` A2 참조).
