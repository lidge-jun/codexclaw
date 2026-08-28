# 030 — wp4: interview 기본 진입 정책

## 문제 재정의

사용자 관찰은 "interview가 기본으로 안 켜져서 문제"다. 이 문장에는 세 개의 다른 대상이 겹쳐 있다.
고칠 대상을 잘못 고르면 게이트가 무력화된다.

| 후보 | 정체 | 기본화 대상인가 |
|---|---|---|
| `flags.interview` | `isInterviewReady()`의 **파생 결과**. `state.ts:392`가 재계산한다 | 아니다. true는 "인터뷰가 이미 끝났다"는 뜻이라 의도의 역이고, `orchestrate-cli.ts:513` 소프트 게이트를 자동 통과시킨다 |
| FSM 단계 `"I"` | `detectTrigger`가 반환할 때만 진입. `hook.ts:204` | **여기가 맞다** |
| `interviewDirective()` 주입 | 단계에 붙어 나오는 지시문 | 단계가 결정되면 따라온다 |

즉 고칠 곳은 `hook.ts:204` 한 줄의 **키워드 전용 진입 규칙**이다. 지금은 이렇다.

    if (/\binterview\b|인터뷰|\borchestrate i\b/.test(p)) return "I";

바로 위 주석이 의도를 명시한다: "Explicit only — no goal-mode branch (A3 decision, see 022.3)".
그러니 이건 버그가 아니라 결정이었다. 우리는 그 결정을 **정책으로 승격**한다. 기본값을 뒤집는 게 아니라,
사용자가 고를 수 있게 만든다.

## 정책 세 값

| 값 | 동작 | 용도 |
|---|---|---|
| `off` | 현재와 동일. 키워드만 | 지금 동작을 원하는 사용자 |
| `new-unit` | **기본값 후보**. PABCD 트리거(P/A/B/C)가 감지되었고 세션에 아직 PABCD 상태가 없을 때, P 대신 I로 진입 | 새 작업의 첫 계획 요청에만 인터뷰가 붙는다 |
| `always` | PABCD 트리거가 감지되면 상태 유무와 무관하게 I 우선 | 요구사항이 계속 흔들리는 작업 |

`new-unit`을 기본값으로 제안하는 이유: 인터뷰의 값은 **작업 시작 시점**에 가장 크고, 이미 진행 중인
사이클에 끼어들면 오히려 흐름을 끊는다. 그리고 키워드 없이도 첫 계획 요청은 인터뷰를 거치므로
사용자가 관찰한 문제("기본으로 안 켜짐")가 실제로 해소된다.

## 절대 보존해야 하는 억제 (c4)

정책이 `always`여도 다음은 그대로 유지한다. 이건 타협 대상이 아니다.

- goal 활성 시 미진입. `goal-active.ts:87` `suppressesInterview`는 `active`와 **`unreadable`** 둘 다 true를
  반환하는 fail-closed 설계다. 정책 검사는 이 함수 **뒤에** 온다.
- `request_user_input` 하드 거부. `goal-gate.ts:61` `GOAL_MODE_DENY_REASON`. 손대지 않는다.
- `hook.ts:707` 수동 경로 방화벽. 그대로 둔다.
- C0/C1 경량 작업 제외. 한 줄 수정 요청에 인터뷰가 뜨면 정책이 즉시 미움받는다. 트리거 자체가
  P/A/B/C 감지에 걸리지 않으면 아무 일도 없으므로 이 조건은 자동 충족된다.

## 파일 변경 맵

| 파일 | 동작 |
|---|---|
| `pabcd-state/src/interview-policy.ts` | NEW — 정책 읽기 + 순수 결정 함수 |
| `pabcd-state/src/hook.ts` | MODIFY — `detectTrigger` 결과에 정책 적용 |
| `pabcd-state/test/interview-policy.test.ts` | NEW |

## 설계

정책은 **프로젝트 로컬 파일**에 둔다. `~/.codex/config.toml`이 아니라 `.codexclaw/config.json`이다.
근거: 인터뷰 필요는 저장소마다 다르고, config.toml에 넣으면 wp2/wp3의 화이트리스트·되돌리기 부담이
아무 이득 없이 늘어난다. 그리고 codexclaw가 사용자 전역 설정에 키를 하나라도 덜 심는 게 낫다.

    // interview-policy.ts
    export type InterviewPolicy = "off" | "new-unit" | "always";
    export const DEFAULT_INTERVIEW_POLICY: InterviewPolicy = "new-unit";

    export function readInterviewPolicy(cwd: string): InterviewPolicy;   // .codexclaw/config.json, 파싱 실패 시 기본값

    export interface EntryDecisionInput {
      trigger: Phase | null;        // detectTrigger 결과
      policy: InterviewPolicy;
      hasExistingState: boolean;    // 세션에 PABCD 상태 파일이 있는가
      goalSuppresses: boolean;      // suppressesInterview 결과
    }

    export function decideInterviewEntry(input: EntryDecisionInput): Phase | null;

결정 규칙:

    if (goalSuppresses) return trigger;            // 억제 절대 우선. 승격 없음
    if (trigger === null) return null;             // 트리거 없으면 아무것도 안 함 (C0/C1 보호)
    if (trigger === "I") return "I";               // 명시 키워드는 정책과 무관하게 항상 통과
    if (policy === "off") return trigger;
    if (policy === "always") return "I";
    if (policy === "new-unit") return hasExistingState ? trigger : "I";

`hook.ts`에서는 `detectTrigger` 직후에 이 함수를 한 번 통과시킨다. 순수 함수라 hook 본문은
배선만 늘고 분기는 늘지 않는다.

## 테스트 (c4 활성화 시나리오)

| # | policy | trigger | goalSuppresses | hasState | 기대 |
|---|---|---|---|---|---|
| 1 | always | P | **true** | false | `P` — 억제가 이긴다 |
| 2 | always | P | true(unreadable 유래) | false | `P` — fail-closed 경로도 동일 |
| 3 | always | P | false | true | `I` |
| 4 | new-unit | P | false | false | `I` |
| 5 | new-unit | P | false | true | `P` — 진행 중 사이클에 끼어들지 않음 |
| 6 | off | P | false | false | `P` |
| 7 | 아무 값 | null | false | false | `null` — C0/C1 보호 |
| 8 | off | I | false | false | `I` — 명시 키워드 우선 |
| 9 | `.codexclaw/config.json` 없음 | — | — | — | `new-unit` |
| 10 | 손상된 JSON | — | — | — | `new-unit`, 예외 없음 |

## 범위 경계

IN: 위 세 파일. OUT: `goal-gate.ts`(억제 로직 자체), `interview.ts` 준비도 예측자,
`flags.interview` 계산, hook JSON 재구성.

## 검증

`node --test` 신규 테스트 + `npm test` 전체 + `cxc doctor`(hook 해시 영향 확인).


## A-phase 감사 정정 (인라인 감사, 260829)

파견 감사자가 3회 대기 무응답으로 은퇴(DISPATCH-RETIRE-01)해 본체가 직접 호출 지점을 읽고 세 곳을 고쳤다.

### 1. `hasExistingState`의 실체 — 파일 존재가 아니라 `state.orchestrationActive`

`hook.ts:607`의 호출 지점은 이미 `state`를 들고 있다. 별도 파일 조회가 필요 없다.
같은 함수 안에서 `state.orchestrationActive`와 `state.phase`를 쓰는 선례가 `hook.ts:640`
(`!state.orchestrationActive && loopArmRequested`)와 `hook.ts:653`
(`mayEnter = state.phase === "IDLE" && ...`)에 있다. 따라서 입력 필드를 바꾼다.

    hasExistingState  ->  orchestrationActive: boolean   // state.orchestrationActive 그대로

### 2. 억제 검사 위치 — 기존 검사는 `trigger === "I"`에만 걸려 있다

현재 코드는 이렇다(`hook.ts:611-613`).

    if (trigger === "I" && suppressesInterview(getGoalActiveStatus(payload.session_id))) {
      return "";
    }

정책이 `P`를 `I`로 승격하면 이 검사를 **승격 후 값**에 적용해야 한다. 순서를 지킨다.

    const rawTrigger = detectTrigger(payload.prompt);
    const goalSuppresses = suppressesInterview(getGoalActiveStatus(payload.session_id));
    const trigger = decideInterviewEntry({
      trigger: rawTrigger,
      policy: readInterviewPolicy(payload.cwd),
      orchestrationActive: state.orchestrationActive,
      goalSuppresses,
    });
    if (trigger === "I" && goalSuppresses) return "";   // 기존 줄 그대로 유지

`decideInterviewEntry`가 억제 시 승격하지 않으므로 두 번째 줄은 사실 도달 불가에 가깝지만,
명시 키워드 `I` 경로를 위해 **그대로 남긴다**. 방어선을 두 겹으로 두는 편이 낫고,
`getGoalActiveStatus` 호출이 한 번으로 줄어드는 이득도 있다.

### 3. 명시 `orchestrate p` 는 승격 대상이 아니다

`hook.ts:600`의 `parseOrchestrateCommand`가 먼저 돌고, 매치되면 `handleOrchestrateCommand`가
값을 반환해 조기 종료한다. 정책 층은 그 **아래** 느슨한 경로에만 붙으므로, 사용자가 명령형으로
`orchestrate p`를 쓴 경우는 정책과 무관하게 P로 간다. 의도한 동작이고, 테스트 케이스로 고정한다.

| # | 입력 | 기대 |
|---|---|---|
| 11 | `parseOrchestrateCommand`가 P를 반환 (정책 always) | 조기 종료 경로, 승격 없음 |

### 확인된 사항 (변경 불필요)

- `build.mjs:75` `listTsFiles(srcDir)`가 `src/`를 재귀 탐색한다. 신규 파일에 대한 명시 목록 갱신이 없다.
  `COMPONENTS` 배열(`build.mjs:27`)에 `config-guard`·`pabcd-state` 둘 다 이미 있다.
- `config-guard/test/activate.test.ts`가 `mkdtempSync` + 가짜 `CodexRunner` + `assertNotRealCodexHome`
  가드로 주입 이음새를 이미 갖췄다. 020/040의 테스트 계획이 그대로 성립한다.

