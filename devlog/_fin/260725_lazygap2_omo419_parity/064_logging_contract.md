# 064 — logging 계약 reference

출처: `002` #8 (ADOPT / E7) · 의존: 없음 · 상태: PLANNED

## 문제

codexclaw에는 `observability` 주제를 `dev-backend`로 보내는 라우팅이 있고
(`plugins/codexclaw/skills/dev/SKILL.md:90`) 그 라우팅은 production 표면으로 한정된다
(`plugins/codexclaw/skills/dev/SKILL.md:121`). 하지만 CLI·라이브러리·스크립트를 포함한 **cross-surface logging 계약을 소유하는
문서가 없다.** codexclaw 자체가 훅과 CLI로 이루어진 제품이므로 이 공백이 직접 아프다.

upstream이 이 계약을 문서화했다
(`devlog/.lazycodex/plugins/omo/skills/programming/references/logging.md:9-22,34-72`).

## WP6 P 실측: 소유권 충돌 확인 및 범위 축소

리뷰어(Mind "Linnaeus")가 `dev-backend`와의 소유권 충돌을 지적했고, 실측 결과 맞다.

### 이미 있는 것

`plugins/codexclaw/skills/dev-backend/references/core/observability.md:83-99`가
**Structured Logging** 절을 소유한다:

1. production은 JSON only, free-text `console.log` 금지
2. 모든 엔트리에 `traceId`/`spanId`/`requestId`/`timestamp`/`level`
3. **절대 로그 금지**: PII, 시크릿, 전체 요청/응답 본문, **info/warn의 stack trace**
4. 레벨 정의: `error`(조치 필요) / `warn`(성능저하) / `info`(비즈니스 이벤트) / `debug`
5. 언어별 권장 라이브러리(pino/structlog/slog), OTel field convention

### 초안이 충돌했던 지점

초안은 "Error의 type·message·stack을 보존하도록 직렬화"를 무조건 요구했다.
이것은 위 규칙 3의 "info/warn에 stack trace 금지"와 정면으로 부딪힌다.
그대로 넣었으면 두 문서가 서로 반대를 말하게 된다.

### 진짜 공백

`dev-backend`는 **production 백엔드 서비스** 전용이다 — 라우팅 자체가 그렇게 한정한다
(`plugins/codexclaw/skills/dev/SKILL.md:121`). 그런데 codexclaw 자신은 훅과 CLI로 이루어져
있고, 거기에는 traceId도 OTel도 JSON 파이프라인도 없다. **CLI·스크립트·라이브러리에서
언제 무엇을 출력할지**를 다루는 문서가 없다.

즉 이 슬라이스는 `dev-backend`를 대체하지 않는다. 그 옆에 **다른 표면**을 채운다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/skills/dev/references/logging.md` | 신규 — CLI·스크립트·라이브러리 표면 전용 |
| `plugins/codexclaw/skills/dev/SKILL.md` | 라우팅 표(`:90` 부근)에 행 1개 추가 |

## before → after

### 신규 `dev/references/logging.md` 내용 (6규칙 → 2규칙(2라운드) → 3규칙(3라운드))

리뷰어가 6개 중 **3개**가 기존 문서와 중복임을 file:line으로 입증했다(1·3·4).
규칙 6은 2라운드에 중복으로 분류했으나 3라운드에서 **owner가 실제로 없음**이 밝혀져
좁힌 형태로 되살렸다(`LOG-ONCE-01`). 최종: 3개 삭제, 1개 축소 유지, 2개 신규.

| 초안 규칙 | 이미 있는 곳 | 처리 |
| --- | --- | --- |
| 1. 기존 관행 우선 | `plugins/codexclaw/skills/dev/SKILL.md:245-250` ("MUST follow existing conventions when they are clear") | 삭제, 링크로 대체 |
| 2. 소비자를 말할 수 없으면 출력 금지 | 없음 | **유지** |
| 3. 결정 지점에만 배치 | `plugins/codexclaw/skills/dev-debugging/references/methodologies.md:135-165` | 삭제, 링크 |
| 4. 레벨은 소비자 기준 | `plugins/codexclaw/skills/dev-backend/references/core/observability.md:83-89` | 삭제 — 아래 블로커 3 참조 |
| 5. stdout/stderr 의미 | 없음 (QA는 캡처 규율이지 작성 규율이 아니다) | **유지** |
| 6. 오류를 두 번 말하지 않기 | **owner 없음** — `dev:397-403`은 경계에서 표면화만 요구하고 `dev-debugging:238-242`는 boundary log-and-rethrow를 **명시적으로 허용**한다 | 좁혀서 **유지** (아래 `LOG-ONCE-01`) |

#### 문서 최종 형태

**Scope (3분할 — 블로커 2 반영).** "service면 dev-backend"는 codexclaw 자신에게
적용 불가능하다. `cxc serve`(`plugins/codexclaw/components/messenger-bridge/src/cli.ts:62-81`)는
CLI 서브커맨드이면서 HTTP 서버이고, 같은 프로그램이 service install 표면도 제공한다
(`:128-146`). backend 우선으로 읽으면 현재 free-text stdout 구현
(`:66-74`, `:111-121`)이 즉시 전부 위반이 된다.

| 표면 | 소유자 | 예 |
| --- | --- | --- |
| one-shot CLI | 이 문서 | `cxc map`, `cxc doctor` |
| long-running local server | **프로세스 stdout/stderr transport만** 이 문서. HTTP/요청 계측은 `dev-backend` | `cxc serve` |
| production-deployed service | `dev-backend` `references/core/observability.md` (JSON, traceId, OTel) | 배포된 API |

**규칙 3개를 정의한다** (2라운드 감사에서 `LOG-ONCE-01` 추가 — 그 owner가 실제로 없었다).

> **LOG-CONSUMER-01.** 출력하기 전에 "누가 이 줄을 읽고 무엇을 하는가"에 답한다.
> 답할 수 없으면 출력하지 않는다. 로그가 없던 모듈에 임의로 도입하지 않는다 —
> 없는 것도 결정이다.
>
> **LOG-STREAM-01 (one-shot CLI 한정).** 파이프로 넘어갈 산출물을 내는 명령에서
> stdout은 **성공 시의 명령 출력**이고 stderr는 **진단·진행·경고·오류**다.
> 파이프 대상 값을 stderr에 섞지 않고, 진단을 stdout에 섞지 않는다.
> (`--help`/`--version`은 성공 출력이므로 stdout이 맞다 —
> `plugins/codexclaw/skills/qa/references/cli-tui-qa.md:18-20`.)
>
> 예상된 usage error(잘못된 플래그·입력)는 error-level **telemetry**는 아니지만
> CLI에서는 **stderr + nonzero exit**를 유지한다. 두 개념을 섞지 않는다.
>
> **long-running local server는 이 규칙의 대상이 아니다.** `cxc serve`는 주입된 lifecycle
> logger를 전부 stdout으로 보내고 있고(`plugins/codexclaw/components/messenger-bridge/src/cli.ts:66`,
> `:111-118`, `bridge-controller.ts:165-166`, `:181-203`) 그 자체가 잘못이 아니다 —
> 서버 프로세스의 stdout은 파이프 산출물이 아니라 로그 스트림이기 때문이다.
> 서버 프로세스 로그 전송은 기존 관행을 따르고, 이 규칙을 소급 적용하지 않는다.

> **LOG-ONCE-01.** 중복은 **사건 동일성이 아니라 소비자·싱크**로 판정한다.
> 같은 사건이라도 소비자가 다르면 각각 한 번씩 기록해도 된다 — 지속 telemetry/이벤트
> 기록 하나와 사람이 읽는 진단 하나는 정당하다. 금지되는 것은 **같은 싱크에 같은 소비자를
> 향해 구분되지 않는 반복**을 남기는 것이다.
> 경계에서 맥락을 덧붙이는 log-and-rethrow도 허용된다
> (`plugins/codexclaw/skills/dev-debugging/SKILL.md:238-242`가 명시적으로 허용한다).
>
> 실제 예 — `cxc serve`의 adapter 실패 경로는 **위반이 아니다**:
> `bridge-controller.ts:191-196`이 지속 이벤트/메트릭에 기록하고 rethrow하며,
> `cli.ts:83-92`가 사람에게 stderr로 알린다. 싱크도 소비자도 다르다.
>
나머지는 링크로만 둔다:

> 기존 관행 준수는 `dev` §Conventions(`:245-250`), 로그 배치 지점은
> `dev-debugging/references/methodologies.md:135-165`, 비동기 실패의 경계 표면화는
> `dev` §5 Safety Rules(`:397-403`), 서비스 log level·JSON·trace field는
> `dev-backend/references/core/observability.md:83-99`가 소유한다.
> 이 문서는 그것들을 재정의하지 않는다.

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E7** (산문), `DEFAULT` |
| 실행 주체 | 작성자와 A 단계 리뷰어 |
| 알려진 우회 | 읽지 않거나 무시하면 그만이다 |
| 잔여 위험 | 노이즈 로그가 계속 들어와도 자동으로 잡히지 않는다 |
| 표현 강등 | "게이트가 막는다"고 쓰지 않는다 |
| 최종 강제층 | **none** |

## PLAN-FIELD-CHAIN-01

**N/A — 타입 필드나 열거값을 추가하지 않는다.**

## 테스트 (accept criteria)

| 항목 | 기대 | 검증 유형 |
| --- | --- | --- |
| `dev/references/logging.md` 존재 | Scope 3분할 표 + 규칙 **3개**(`LOG-CONSUMER-01`, `LOG-STREAM-01`, `LOG-ONCE-01`) + 나머지 3개 owner 링크 | **사람 리뷰** |
| `dev-backend`/`dev-debugging`과 무충돌 | stack 보존 요구 없음, 서비스 log level 미재정의, `LOG-STREAM-01`이 one-shot CLI 한정이라 현재 `cxc serve` 구현을 위반으로 만들지 않음, `LOG-ONCE-01`이 boundary log-and-rethrow를 허용 | **사람 리뷰** |
| CLI usage error 처리 | telemetry level과 CLI exit 계약을 분리해 서술 (`cli-tui-qa.md:18-20` 인용) | **사람 리뷰** |
| `dev/SKILL.md` 라우팅 행 | `observability` 행 아래, 서비스 계측은 `dev-backend`임을 명시 | **사람 리뷰** |
| 게이트 회귀 | exit 0 유지 | **자동** — 내용 미관측 |
| 스위트 회귀 | 1,224 pass 유지 | **자동** — 내용 미관측 |

**삭제한 행 (블로커 4):** "manifest 카운트 무영향 | `checkCounts`"는 거짓이었다.
`plugins/codexclaw/scripts/gate.mjs:277-288`의 `checkCounts`는 manifest hook 수와
`hooks/*.json` 파일 수만 비교한다 — skills나 references와 무관하므로 이 변경을
보호하지 않는다.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm run gate` — **실측**: exit 0 + WARN 7건.
  사슬: `package.json:23` → `gate.mjs` → `checkForbiddenClaims`가 `walkSkillMds`
  (`:147-175`)로 **`SKILL.md`만** 수집한다. 따라서 **신규 `references/logging.md`를
  읽지 않는다.** `dev/SKILL.md`의 라우팅 행은 읽지만 금지 문구 3패턴만 본다.
  → **내용 미관측 회귀 명령.**
- `npm test` — **실측**: 1,224 pass / 0 fail.
  사슬: `package.json:24` → `plugins/codexclaw/test/*.test.mjs`.
  **정정 (블로커 4):** 초안은 "WP2가 `dev/SKILL.md` 산문 단정을 전부 제거했다"고 적었으나
  틀렸다. `manifest-policy.test.mjs`의 L19가 여전히 `dev/SKILL.md`를 읽는다 — 다만 WP2가
  교체한 뒤라 **첫 `references/*.md` 경로를 추출해 파일 존재만 확인**하고 routing 의미는
  검증하지 않는다. 라우팅 행 추가가 그 테스트를 깨뜨리지 않는지는 실제로 돌려 확인한다.
  → **내용 미관측 회귀 명령.**
- Scope 3분할, 규칙 3개의 내용, 경계 판정, 라우팅 의미: **어떤 자동 명령도 관측하지 않는다.**
  전부 사람 리뷰다.
- `npx tsc --noEmit`은 **적지 않는다** — root `tsconfig.json`이 없다.

## 범위 밖

- 실제 logger 구현/교체.
- 텔레메트리 (LOCKED 비목표).
