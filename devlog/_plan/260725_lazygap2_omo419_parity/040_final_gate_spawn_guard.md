# 040 — 최종 gate 선행조건 spawn 가드

출처: `001` #8 (ADAPT / E1) · 의존: `030`(gate 상태), `020`(소스 정체성) · 상태: PLANNED

## WP12 P 실측 — 계획의 절반이 이미 끝났다

`030`(WP11)이 방금 `CriterionSurface`와 관련 사슬을 전부 넣었다. 이 문서가 요구하던
것 중 아래는 **이미 존재한다** (커밋 `215ba65c`):

| 초안 요구 | 현재 상태 |
| --- | --- |
| `CriterionSurface` 타입 + `GoalplanCriterion.surface?` | **완료** (`goalplan.ts`) |
| criterion reviver가 `surface`를 읽고 검증 | **완료** — 단 미지값을 "계획 전체 거부"가 아니라 `undefined`로 남기고 v2 검증기가 거부한다 (`030` A 감사 결론) |
| `qaRequired` 판정 | **완료** — `computeQaRequired`가 계획 전체를 스캔한다 |

**enum도 정정한다.** 초안은 `logic | cli | web | tui | api` 다섯 값이었지만 `030`이
**`logic | web | tui` 셋**으로 확정했다. QA 영수증을 요구하는 기준이 "시각적 표면인가"
하나뿐이라 `cli`와 `api`는 `logic`과 동작이 같았다 — 구분이 관측되지 않는 값은 넣지
않는다. 이 문서에서 `cli`/`api`를 언급하는 부분은 전부 무효다.

따라서 이 사이클의 실제 범위는 **spawn 가드 하나**다:

| 파일 | 변경 |
| --- | --- |
| `components/subagent-config/src/final-gate-guard.ts` | 신규 |
| `components/subagent-config/src/spawn-attach-hook.ts` | allow 직전에 가드 호출 |
| `components/subagent-config/test/final-gate-guard.test.ts` | 신규 |

### 컴포넌트 경계 문제 (WP12 P 실측)

가드는 goalplan을 읽어야 하는데 **`subagent-config`는 `pabcd-state`를 import한 적이
없다** (`rg "from \"../../pabcd-state" components/subagent-config/src` → 0건).
빌드는 컴포넌트별로 `src/*.ts` → `dist/*.js`를 컴파일하고 상대 스펙만 재작성하므로
(`build.mjs:25-27`), `../../pabcd-state/src/goalplan.ts`를 import하면 dist에서
`../../pabcd-state/src/goalplan.js`를 찾는다 — **그 경로에는 파일이 없다**
(소스는 `src/`, 산출물은 `dist/`).

선택지는 둘이다.

1. `../../pabcd-state/dist/goalplan.js`를 직접 import — dist가 dist를 부르므로 경로는
   맞지만, 소스에서 테스트를 돌릴 때 dist가 낡아 있으면 다른 코드를 시험하게 된다.
2. **goalplan JSON을 가드가 직접 읽는다** — `pabcd-state`에 의존하지 않고
   `.codexclaw/goalplans/<slug>/goalplan.json`을 파싱한다.

**2를 택한다.** 가드가 필요한 것은 `finalGate.testReceiptPath`/`qaReceiptPath`와
각 영수증의 `sourceIdentity`뿐이고, 전부 JSON에서 직접 읽을 수 있다. 컴포넌트 간
런타임 결합을 만들지 않는 편이 `hook-trust`나 빌드 순서 같은 곳에 파장을 남기지 않는다.
대신 **스키마 지식이 두 곳에 생긴다**는 비용이 있으므로, 가드는 스키마가 어긋나면
deny가 아니라 **allow(fail-open)** 한다 — 조기 경고 층이 스키마 드리프트로 작업을
막으면 안 된다. 진짜 강제는 `030`이 한다.

## 문제

C 단계 산문은 테스트와 독립 리뷰를 요구하지만 PreToolUse는 선행 산출물을 확인하지 않는다
(`plugins/codexclaw/components/pabcd-state/src/hook.ts:257-267`;
spawn 훅은 토폴로지·스킬·라우팅만 처리 —
`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:705-845`).
그래서 테스트를 돌리지 않고 최종 리뷰어를 띄울 수 있다.

## before → after

### `surface`는 `030`이 이미 넣었다

타입(`CriterionSurface = "logic" | "web" | "tui"`, `goalplan.ts:37`), reviver의
보존 규칙(유효 enum만 남기고 미지값은 `undefined`), `computeQaRequired`의 계획 전체
스캔이 전부 커밋 `215ba65c`에 있다. 이 슬라이스는 **읽기만 한다.**

QA 영수증을 요구하는 조건: **계획 전체**의 criteria 중 `surface`가 `"web"` 또는
`"tui"`인 것이 하나라도 있을 때. 활성 work-phase 기준은 안 된다 — 마지막 D가 닫히면
`activeWorkPhaseId`가 null이 되어 요구가 사라진다(`030` 결론). 필드가 없거나 미지값인
criterion은 QA를 요구하지 않는다. 미지값을 거부하는 것은 `030`의 v2 검증기 몫이고,
조기 경고 층인 여기서 막으면 스키마 드리프트가 작업을 세운다.

표면을 지칭할 때는 항상 enum 값(`logic`/`web`/`tui`)을 쓴다 — "browser"나 "GUI" 같은
enum 밖 용어를 섞지 않는다. `cli`/`api`는 확정 enum에 없다.

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
  packetText: string,
  sessionId: string,
  cwd: string,
  /** test seam: 실제 git 캡처 대신 주입한다. 기본값은 진짜 캡처. */
  captureIdentity?: () => SourceIdentityLite,
): FinalGateCheck;
```

### 세션 → goalplan 결박 경로 (A 감사 Medium 2)

`sessionId` 하나로는 goalplan에 닿을 수 없다. 실제 사슬은 다음과 같다
(`goal-gate.ts:210`이 쓰는 것과 동일한 경로):

```
payload.session_id
  → .codexclaw/sessions/<sanitize(session_id)>.json  의 `slug`   (state.ts:19, :98)
  → .codexclaw/goalplans/<slug>/goalplan.json        의 `finalGate` / `criteria`
  → finalGate.testReceiptPath / qaReceiptPath        의 `sourceIdentity`
```

`sanitize`는 `state.ts`의 것과 같은 규칙을 쓴다. 아래는 **전부 allow**다 —
어느 단계에서 끊겼는지로 동작이 갈리지 않는다:

- `session_id`가 없거나 빈 문자열
- 세션 state 파일이 없거나 JSON이 깨짐
- `slug`가 비어 있음
- goalplan 파일이 없거나 JSON이 깨짐
- `finalGate`가 없음 (v1 계획이거나 gate 미개시)

### `compareSource` 복제 규칙 (A 감사 Medium 3)

`020`의 `compareSource`(`source-identity.ts:159-173`)와 판정이 갈리면 안 되므로
**네 분기를 순서까지 그대로** 옮긴다:

| 순서 | 조건 | 결과 |
| --- | --- | --- |
| 1 | 한쪽이라도 `kind === "unavailable"` | `unavailable` — 이 가드는 **allow** |
| 2 | `commitSha` 불일치 | `different` → deny |
| 3 | `dirty` 불일치 | `different` → deny |
| 4 | `(treeHash ?? "")` 불일치 | `different` → deny |
| — | 그 외 | `same` → allow |

`unavailable`을 빈 SHA와 동치로 다루지 않는다 — 1번이 2번보다 먼저다.
다섯 케이스(`unavailable` / SHA 불일치 / clean↔dirty / dirty treeHash 불일치 / 완전
일치)를 표 기반 회귀로 고정한다.

판정 순서:

1. 패킷에 `[CXC-FINAL-GATE]`가 없으면 `{ok: true}` (관여하지 않음).
2. 세션에 결박된 goalplan이 없으면 `{ok: true}` (가벼운 사용 차단 금지, fail-open).
3. `finalGate.testReceiptPath`가 없거나 파일이 없거나 0바이트 → deny, 누락 경로 명시.
4. **계획 전체**의 criteria 중 `surface`가 정확히 `"web"` 또는 `"tui"`인 것이 있을 때만
   `qaReceiptPath`를 같은 방식으로 요구. 없으면 요구하지 않는다.
   (`030`이 확인한 대로 활성 work-phase 기준은 안 된다 — 마지막 D가 닫히면
   `activeWorkPhaseId`가 null이 되어 요구가 사라진다.)
5. **SHA 결박:** 각 영수증에 기록된 `SourceIdentity`가 현재 소스와 `compareSource(...).kind === "same"`인지 확인.
  `false`면 deny하고 "어느 영수증이 어느 SHA에 묶였는지"를 모두 나열한다.
  `"unavailable"`(git 없음)이면 이 가드는 **allow**한다 — 조기 경고 층이므로 막지 않고,
  실제 거부는 `030`이 한다 (`020`의 소비자 표).
6. 위 어느 단계에서든 예외·JSON 파손·스키마 불일치가 나면 `{ok: true}`.

`compareSource`와 `SourceIdentity` 비교는 `pabcd-state`를 import하지 않고 가드 안에
**최소 구현**을 둔다 — `commitSha` 동일성과 `dirty`/`treeHash` 동일성만 본다.
`020`의 `compareSource`와 판정이 갈리면 안 되므로 그 규칙을 그대로 옮기고, 원본
위치를 주석에 남긴다.

### `spawn-attach-hook.ts` — 호출 지점

before (`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:705-845`): 재귀 deny → 페이로드 검증 → 역할/스킬 라우팅 → allow 또는 rewrite.

after: 재귀 deny(`:732`)와 페이로드 검증 이후, **`cwd`가 확정되는 지점(`:813`) 뒤,
최종 no-op/allow(`:865`) 직전**에 `checkFinalGatePrereqs`를 호출한다.
deny는 기존 `denyEnvelope`(`:330`)를 그대로 쓴다. 훅은 예외에서 fail-open한다.

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
| `surface` 필드 없는 구버전 계획 | `logic` 취급, QA 미요구 |
| `surface`에 enum 밖 값 | QA를 **요구한다고 보지 않는다** — 가드는 조기 경고이므로 여기서 막지 않고 `030`이 거부한다 |
| `compareSource(...).kind === "unavailable"` | allow (거부는 `030`이 담당) |
| 마커를 생략한 최종 gate spawn | allow — 이 가드는 우회 가능하며 `030`이 최종 강제층 |
| 영수증 SHA ≠ 현재 소스 | deny, 두 SHA 모두 표시 |
| 영수증 SHA = 현재 소스, 전부 유효 | allow |
| 가드 내부 예외 발생 | allow (fail-open), stderr 경고 |
| 4가지 도구 토큰 변형 | 동일하게 동작 |
| goalplan JSON이 깨짐 / 스키마 불일치 | allow (fail-open) — 스키마 드리프트가 작업을 막지 않는다 |
| 마커 있음, `finalGate` 자체가 없음 | allow (fail-open) — v1 계획이거나 gate 미개시 |
| `session_id` 없음 / 세션 state 없음 / `slug` 빔 | 각각 allow |
| `compareSource` 5벡터 (unavailable / SHA / clean↔dirty / treeHash / 일치) | 표대로 — `020`과 판정 동일 |

### fixture 방법 (A 감사 Medium 4)

표의 행들이 실제로 관측되려면 두 가지를 fixture가 갖춰야 한다.

**세 파일을 만든다.** 임시 `cwd`에 `.codexclaw/sessions/<id>.json`(`slug` 포함),
`.codexclaw/goalplans/<slug>/goalplan.json`, `.codexclaw/evidence/*.json`을 쓴다.
세 파일 중 하나만 빠져도 allow가 되므로, deny 케이스는 전부 세 파일이 갖춰진
상태에서만 성립한다.

**SHA 결박은 주입 seam으로 시험한다.** 일반 tmpdir에는 git이 없어 `unavailable`이
되고, 그러면 규칙 1에 걸려 무조건 allow다 — 임시 git 저장소를 만들어 커밋까지 하는
방법도 있지만 테스트가 느려지고 git 설정에 의존한다. 그래서 `checkFinalGatePrereqs`의
네 번째 인자로 `captureIdentity`를 받아 테스트가 현재 정체성을 직접 지정한다.
프로덕션 경로는 기본값(실제 캡처)을 쓰므로 seam이 동작을 바꾸지 않는다.

**네 토큰을 매개화한다.** 기존 테스트 헬퍼는 `spawn_agent` 하나로 고정돼 있고
(`spawn-attach-hook.test.ts:77`), 실동작 경로 테스트도 `collaborationspawn_agent`
하나뿐이다(`:739`). 신규 테스트는 `spawn_agent`, `collaborationspawn_agent`,
`collaboration.spawn_agent`, `collaboration_spawn_agent` 넷을 루프로 돌려 같은
deny/allow가 나오는지 확인하고, 페이로드에 `session_id`를 반드시 넣는다.

**CLI `--criterion-surface` 관련 행은 전부 삭제했다.** `030`이 `surface`를 이미
넣었고 CLI 입력 문법은 그 슬라이스에서도 범위 밖이었다 — 계획 JSON을 직접 쓰는 것이
현재 유일한 등록 경로다. CLI 플래그가 필요해지면 별도 조각으로 다룬다.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 exit 0, **1,331 pass**. 사슬: `package.json:24` glob이
  `components/subagent-config/test/*.ts`를 포함한다. → **주 검증기.**
- 좁은 타입체크 (**B 이후 유효**):

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext \
    plugins/codexclaw/components/subagent-config/src/final-gate-guard.ts \
    plugins/codexclaw/components/subagent-config/test/final-gate-guard.test.ts
  ```

  신규 파일이라 baseline 오류가 없다 — 수용 조건은 **exit 0**이다.
- `npm run build` — 신규 `.ts`가 dist로 컴파일된다(115 → 116). → 관측한다.
- `npm run gate` — 이 슬라이스를 **관측하지 않는다**. 비관측 baseline 회귀 확인용
  (현재 exit 0, WARN 3).

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E1** (PreToolUse spawn 훅) |
| 실행 주체 | Codex가 spawn 호출마다 부르는 `spawn-attach-hook.js` |
| 알려진 우회 | **패킷에 `[CXC-FINAL-GATE]` 마커를 안 붙이면 그냥 통과한다.** 또한 goalplan 미결박·JSON 파손·git 부재·gate 미개시가 전부 allow다 — 조기 경고 층이라 의도한 fail-open이다 |
| 잔여 위험 | 영수증의 `sourceIdentity`는 영수증을 쓰는 쪽이 적으므로 위조 가능하다. 이 가드가 잡는 것은 "테스트 이후 트리가 움직였다"이지 "테스트가 실제로 있었다"가 아니다 |
| 표현 강등 | "훅이 최종 gate를 강제한다"가 **아니다**. **"마커를 붙인 spawn에 한해, 선행 영수증 부재를 미리 알려준다"** |
| 최종 강제층 | **`030`의 완료 검증기** — `schemaVersion >= 2` 계획은 gate가 `approved`가 아니면 `update_goal complete`가 거부된다. `040`은 그 거부를 앞당겨 보여줄 뿐이다 |

## PLAN-FIELD-CHAIN-01

| 타입 | 생성 | 직렬화 | 역직렬화 | 소비 |
| --- | --- | --- | --- | --- |
| `FinalGateCheck` | `checkFinalGatePrereqs` 내부 | N/A — 프로세스 내 반환값 | N/A | `runSpawnAttachHook`의 deny 분기 하나 |

읽기만 하는 값(`finalGate.*`, 영수증의 `sourceIdentity`)은 `030`이 이미 사슬을
정의했다. 이 슬라이스는 **소비자만 추가**하므로 새 필드가 없다.

## 범위 밖

- 전용 gate-reviewer 역할 (역할 증설 금지).
- 총 fan-out 상한 (DEFER, `001` A2 참조).
