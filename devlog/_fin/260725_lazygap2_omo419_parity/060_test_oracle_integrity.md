# 060 — 테스트 오라클 독립성 규칙

출처: `002` #7 (ADOPT / E7) · 의존: 없음 · 상태: PLANNED

## 문제

`plugins/codexclaw/skills/dev-testing/SKILL.md:384-408`과
`plugins/codexclaw/skills/dev-testing/references/edge-first-testing.md:42`는 테스트 품질을
다루지만 세 가지 구체적 false-green 패턴을 명시하지 않는다. upstream이 이를 좁게 규정했다
(`devlog/.lazycodex/plugins/omo/skills/programming/SKILL.md:107-131`).

이 규칙은 codexclaw 자신에게 특히 중요하다 — 이 저장소는 산문(SKILL.md)이 제품이라
"문구를 테스트하는" 무의미한 테스트를 쓰기 쉽다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/skills/dev-testing/SKILL.md` | `## Patch Integrity Gate` heading **앞**에 규칙 3개 + 구조 판정 기준 삽입 (현재 그 heading은 `:405`) |
| `plugins/codexclaw/components/cxc-ops/test/ast-grep.test.ts` | `:61` 산문 단정 **삭제** (비교할 두 번째 소스가 없음 → human review 이전). `:51`/`:56`은 유지 |
| `plugins/codexclaw/components/subagent-config/test/catalog.test.ts` | `:9-13` 산문 정규식 단정을 상수/manifest 검사로 교체 |
| `plugins/codexclaw/test/manifest-policy.test.mjs` | `:153-169` 산문 단정 삭제 → `skill-catalog.md` **경로를 추출해 파일 존재를 확인**하는 비교로 교체. `:113-149` **전부 삭제** → `130` 이월 |

## 사전 조사 결과 (재감사 6 반영 — 범위 확정)

초기 초안은 "위반이 발견되면 고친다"고 열어 두었다. 그 열린 범위를 닫기 위해 P 단계에서
실제로 훑었다 (`rg -n "SKILL\.md" plugins/codexclaw/components/*/test/*.ts`).

발견된 위반 **2건**:

- `plugins/codexclaw/components/cxc-ops/test/ast-grep.test.ts:61` —
  `assert.match(readFileSync(.../SKILL.md), /rg first|do not use ast-grep for ordinary grep/i)`.
  SKILL.md 산문의 특정 문구를 검사한다. 문구를 다듬으면 무관하게 깨지고, 실제 라우팅
  동작은 아무것도 증명하지 않는다 — `TEST-PROMPT-SEAM-01` 위반이다.
- `plugins/codexclaw/components/subagent-config/test/catalog.test.ts:9-13` —
  `lunasearch/SKILL.md` 원문을 읽어 `assert.match(lunaSkill, /model: "gpt-5\.6-luna"/)`와
  `assert.doesNotMatch(lunaSkill, /gpt-5\.3-codex-luna/)`를 단정한다. 의도는 스킬이 선언한
  모델과 코드 상수 `NATIVE_OPENAI_MODELS`의 일치인데, 검사 방식이 산문 정규식이라
  같은 위반에 해당한다. 같은 테스트의 `NATIVE_OPENAI_MODELS.includes(...)` 단정은 정상이다.

  교체 방향은 아래 "최종 교체 대상" 절에서 확정한다 (frontmatter 파싱 + 상수 비교).
  초안에 있던 "게이트의 드리프트 검사가 담당한다"는 문장은 삭제했다 — 게이트에 그 로직이 없다.

위반 아님으로 판정한 것들 (참고):

- 같은 파일 `plugins/codexclaw/components/cxc-ops/test/ast-grep.test.ts:51`, `:56` — 파일 존재와 frontmatter 파싱. 기계 소비 이음새이므로 정상.
- `cxc-ops.test.ts:28,37` — fixture 생성(단정 아님).
- `recall/test/ranking.test.ts:28` — 경로 분류 로직 검사.
- `subagent-config/test/spawn-wrapper.test.ts:201` — SKILL.md 존재 여부 기반 동작 검사.
- `cxc-ops/test/map-affordance.test.ts:66,75,89-90` — 훅이 실제로 내보내는
  `additionalContext` 문자열을 검사한다. 산문 파일이 아니라 **런타임 출력**이고
  그 문자열이 사용자에게 주입되는 계약 자체이므로 기계 이음새다.
- `subagent-config/test/spawn-wrapper.test.ts:177,228-229,257` — spawn 페이로드가
  실제로 담는 값(스킬 경로, `skill://` 링크, 지시 블록 머리말)을 검사한다.
  이 문자열은 런타임 계약이며 산문 문서가 아니다.

## WP2 P 재조사 (`.mjs` 트리 누락 정정)

위 조사는 `components/*/test/*.ts`만 훑어 `plugins/codexclaw/test/*.mjs` 트리를 통째로
빠뜨렸다 (Mind "Linnaeus" 지적). WP2 P에서 두 트리를 모두 다시 훑었다:

```
rg -n 'SKILL\.md' plugins/codexclaw/components/*/test/*.ts
rg -n 'readFileSync.*SKILL\.md|assert\.(match|doesNotMatch)' plugins/codexclaw/test/*.mjs
```

### 판정 기준 (A 감사 2라운드에서 재작성)

초안은 "파일 헤더가 sync라고 밝히면 면제"라는 기준을 썼다. 리뷰어가 이를 반박했고
확인 결과 반박이 맞다 — `loop-activation-doc-sync.test.mjs:24-34`는 `loopSkill`에 6개,
`pabcdSkill`에 4개 문구가 **각각 존재하는지만** 본다. 두 값을 뽑아 비교하는 구조가 아니다
(`assert.deepEqual(loopContract, pabcdContract)` 같은 것이 없다).
`emergence-doc-sync.test.mjs:27-52`도 5개 소스에 독립 정규식을 적용할 뿐 소스 간 비교가 없다.

즉 **"헤더에 목적을 적었다"는 면제 사유가 아니다.** 그렇게 두면 헤더 한 줄로 임의의
산문 단정이 통과해 `TEST-PROMPT-SEAM-01`이 무력화된다.

정정된 기준 — 면제는 **구조에 근거**한다:

> **허용:** 둘 이상의 소스에서 같은 종류의 값을 각각 **추출**해 서로 **비교**한다.
> 한쪽만 바뀌면 비교가 깨지고, 깨진 상태는 실제로 두 소스가 모순인 상태다.
> (예: SKILL.md에서 모델명을 파싱해 코드 상수와 `assert.equal`)
>
> **위반:** 소스별로 특정 표현이 존재하는지만 본다. 소스가 몇 개든, 헤더에 무엇을 적었든
> 마찬가지다 — 문구를 다듬으면 깨지고, 깨져도 틀린 동작이 없다.
>
> **허용(별개):** 산문이 아닌 값을 본다 — 버전 핀, 라이선스명, 런타임 출력, CLI stdout,
> 훅 페이로드, 파일 존재. 이들은 애초에 이 규칙의 대상이 아니다.

### 재분류 결과

이 기준을 적용하면 두 doc-sync 테스트도 **위반**이다. 다만 그 테스트가 지키려던 것
(스킬 간 계약 동기화)은 실재하므로, 처리 방향을 나눈다.

| 파일 | 판정 | 처리 |
| --- | --- | --- |
| `plugins/codexclaw/components/cxc-ops/test/ast-grep.test.ts:61` | 위반 | frontmatter `description` 파싱으로 교체 (아래 근거) |
| `plugins/codexclaw/components/subagent-config/test/catalog.test.ts:9-13` | 위반 | frontmatter 파싱 + 상수 비교로 **강화** (아래 근거) |
| `plugins/codexclaw/test/manifest-policy.test.mjs:153-169` | 위반 | 산문 단정 제거, 경로 참조만 유지 |
| `plugins/codexclaw/test/manifest-policy.test.mjs:113-149` | **위반 (2라운드 신규)** | Tier heading 개수·금지어 부정문·섹션 순서·한국어 트리거 존재 — 전부 산문 결합. 아래 처리 |
| `plugins/codexclaw/test/loop-activation-doc-sync.test.mjs` (10) | **위반 (2라운드 신규)** | **이 슬라이스에서 고치지 않는다** — 아래 이월 근거 |
| `plugins/codexclaw/test/emergence-doc-sync.test.mjs` (25 호출, 루프 전개 시 36회) | **위반 (2라운드 신규)** | 동일 — 이월 |
| `plugins/codexclaw/test/repo-map-packaging.test.mjs:30-40,133-135` | 대상 아님 | 버전 핀·라이선스명 = 값 검사 |
| `plugins/codexclaw/components/pabcd-state/test/plan-cli.test.ts:33` | 대상 아님 | CLI 생성물 계약 |
| `hook-e2e.test.mjs`, `cli-usage.test.mjs` | 대상 아님 | 런타임 출력 |

### 두 doc-sync 테스트를 이월하는 근거 (범위 결정)

둘을 제대로 고치려면 `cxc-loop`/`cxc-pabcd`/`search`/`dev` 스킬에 **구조화된 계약 필드**를
새로 만들어야 한다 (지금은 계약이 산문 문장으로만 존재한다). 그것은 이 슬라이스의
목적(테스트 규율 규칙 설치)이 아니라 스킬 스키마 변경이고, 34~36개 단정을 옮기는
독립 작업이다.

따라서 **이월한다** — `009` 로드맵에 `120_doc_sync_contracts.md`를 새 슬라이스로 등록하고,
이 슬라이스는 그 사실을 명시한 채 닫는다. `TEST-PROMPT-SEAM-01` 본문에도
"기존 doc-sync 테스트 2건은 아직 이 규칙을 위반하며 `120`에서 처리한다"를 적어
규칙과 현실의 괴리를 숨기지 않는다.

### 최종 교체 대상 (A 감사 2라운드에서 재판정)

리뷰어가 초안의 두 항목이 **새 기준을 스스로 위반**한다고 지적했고 맞다. "frontmatter라서
기계 소비다" 또는 "정책 가드다"라는 이유는 면제 사유가 아니다 — 기준은 오직
**두 소스에서 값을 추출해 비교하는가**이다. 그 잣대로 다시 판정한다.

| 대상 | 재판정 | 처리 |
| --- | --- | --- |
| `subagent-config/test/catalog.test.ts:9-13` | **교체 (강화)** | 유일하게 기준을 통과한다 — 아래 근거 |
| `cxc-ops/test/ast-grep.test.ts:61` | **삭제 + human review 이전** | 비교 대상이 없다 |
| `manifest-policy.test.mjs:153-169` | **삭제 + human review 이전** | 경로 참조 검사만 유지 |
| `manifest-policy.test.mjs:113-149` | **전부 삭제 + `130`으로 이월** | forbidden-backend 포함 — 아래 근거 |

#### 1. `catalog.test.ts` — 강화 (기준 통과)

두 소스에서 값을 추출해 비교한다:
소스 A `plugins/codexclaw/skills/lunasearch/SKILL.md:3`의 frontmatter `description`에서
모델 토큰을 파싱, 소스 B `plugins/codexclaw/components/subagent-config/src/catalog.ts`의
`NATIVE_OPENAI_MODELS` 상수. `assert.ok(NATIVE_OPENAI_MODELS.includes(parsedModel))`.

**런타임이 실제로 이 필드를 읽는다**는 것도 확인했다 —
`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:519-524`의
`buildLeafSkillCatalog`가 SKILL.md 앞 1024바이트에서 `^description:\s*"?(...)"?$`를 파싱해
leaf 카탈로그를 만든다. 즉 이 필드는 산문이 아니라 런타임 입력이다.

본문 code fence(`:33`) 단정은 제거한다. **포기하는 보호를 명시한다:** 본문에 적힌 모델
표기가 frontmatter와 어긋나도 자동으로 잡히지 않는다 → human review 잔여 항목.

#### 2. `ast-grep.test.ts:61` — 삭제

초안은 frontmatter `description`을 정규식으로 검사하자고 했는데, 그것은
**한 소스에서 표현이 존재하는지만 보는 것**이라 새 기준 위반이다 (리뷰어 블로커 1).
비교할 두 번째 구조화 소스가 없다 — ast-grep의 라우팅 구분을 값으로 들고 있는 코드가 없다.

따라서 삭제하고, "ast-grep 스킬이 일상 grep 용도로 쓰이지 않게 안내한다"는 보호는
**human review로 이전**한다. 같은 파일의 `:51`(파일 존재), `:56`(frontmatter 파싱)은 유지한다.

#### 3. `manifest-policy.test.mjs:153-169` — 삭제, 경로 참조만 유지

`skill-catalog.md` 파일 존재와 `dev/SKILL.md`가 그것을 참조하는지(경로 문자열 존재)만 남긴다.
**포기하는 보호:** jaw/clawhub/hermes 소스 우선순위, `cxc skill search/show` 명령 계약.
구조화 값이 없으므로 human review로 이전한다.

#### 4. `manifest-policy.test.mjs:113-149` — 전부 삭제, `130`으로 이월

초안은 forbidden-backend 검사(`:122-133`)를 "값 검사"라며 유지하려 했으나, 실제 형태는
`한 SKILL.md의 각 줄에 backend 이름과 부정 표현이 함께 있는가`이다 — 단일 소스 산문 검사이고
새 기준 위반이다 (리뷰어 블로커 1).

이 보호는 실재한다(제거된 백엔드가 사용 가능한 것처럼 적히면 안 된다). 제대로 하려면
`metadata.removed-backends` 같은 구조화 목록과 실제 provider/catalog 목록을 비교해야 하고,
그것은 스킬 스키마 작업이다 → **`130_removed_backend_contract.md`로 이월**한다.

### 이월: `120_doc_sync_contracts.md`

`loop-activation-doc-sync`(10)와 `emergence-doc-sync`(25 호출/36 실행)는 구조화 계약 필드
신설이 필요하므로 이 슬라이스에서 다루지 않는다. `009` 로드맵에 `120`으로 등록한다.

### 삽입할 규칙 본문 (before → after, 복사 실행 가능)

`plugins/codexclaw/skills/dev-testing/SKILL.md`의 `## Patch Integrity Gate` 절
**앞**에 아래를 그대로 넣는다 (WP1 삽입 후 현재 그 heading은 `:405`).

> ## Test Oracle Integrity (TEST-PROMPT-SEAM-01 / TEST-ORACLE-INDEPENDENCE-01 / TEST-PRECEDENCE-FIXTURE-01, DEFAULT)
>
> Three narrow contracts that stop false-green. All three are **E7 prose — no gate
> enforces them**; the reviewer is the only check.
>
> **TEST-PROMPT-SEAM-01 (DEFAULT).** Do not assert on prose. A test may read a document
> only when it EXTRACTS a value and COMPARES it against a value from another source.
> Asserting that a phrase exists in a file is a violation no matter how many files you
> read or what the test's header says it is for.
>
> - Forbidden: `assert.match(readFileSync(".../SKILL.md"), /prefer rg first/i)` — one
>   source, phrase existence, breaks on harmless rewording, proves no behavior.
> - Allowed: parse the frontmatter `description`, pull the model token out of it, and
>   `assert.ok(NATIVE_OPENAI_MODELS.includes(token))` — two sources, values compared,
>   breaks only when they genuinely disagree.
> - Also allowed (out of scope for this rule): asserting on non-prose values — version
>   pins, license names, runtime output, CLI stdout, hook payloads, file existence.
>
> **Known violations remain.** `plugins/codexclaw/test/loop-activation-doc-sync.test.mjs`
> and `plugins/codexclaw/test/emergence-doc-sync.test.mjs` still assert phrase existence
> per source; fixing them needs structured contract fields in the skills and is tracked
> as its own slice. Do not cite them as precedent.
>
> **TEST-ORACLE-INDEPENDENCE-01 (DEFAULT).** Never derive the expected value from the
> code under test.
>
> - Forbidden: `assert.equal(fn(x), fn(x))`; building the expectation with a helper the
>   DUT also uses; refreshing a snapshot from current output and calling that verification.
> - Allowed: hardcode the expectation in the fixture, or compute it by an independent
>   route (a second implementation, a hand-worked example, an external spec).
>
> **TEST-PRECEDENCE-FIXTURE-01 (DEFAULT).** When testing override / default / fallback,
> the three values must all DIFFER — otherwise the test cannot tell which path ran.
>
> - Forbidden: override `"x"`, default `"x"`, fallback `"x"` — every branch passes.
> - Allowed: override `"from-flag"`, default `"from-config"`, fallback `"builtin"`, and
>   each case asserts the specific one.
>
> A regression test should FAIL when the defect is reintroduced. Confirm it once by
> mutation — break it, watch it go red, restore it, watch it go green.

### PLAN-BYPASS-NAMED-01 기록 (다섯 필드)

이 슬라이스는 규칙 3개를 추가하므로 강제 기록 의무가 있다
(`plugins/codexclaw/skills/pabcd/SKILL.md:131`).

| 필드 | 값 |
| --- | --- |
| tier | **E7** (산문) — 세 규칙 모두 `DEFAULT`로 표기한다. 런타임 강제가 없으므로 STRICT를 쓰지 않는다 |
| 실행 주체 | 작성자와 A 단계 리뷰어 (사람) |
| 알려진 우회 | 규칙을 로드하지 않거나 읽고 무시한다. 게이트가 검사하지 않는다 |
| 잔여 위험 | 산문 결합·자기충족 테스트가 계속 통과한다. 실제로 지금 2건이 이월 상태로 남는다 |
| 표현 강등 | "게이트가 막는다"고 쓰지 않는다. 규칙 본문에 E7임을 명시한다 |
| 최종 강제층 | **none** |

### PLAN-FIELD-CHAIN-01

**N/A — 이 슬라이스는 타입 필드나 열거값을 추가하지 않는다.**

## 테스트 (accept criteria)

각 행에 **검증 유형**을 명시한다 (A 감사 2라운드 블로커 4 — 자동 검증할 수 없는 행을
자동인 척 두면 순환이 된다).

| 항목 | 기대 | 검증 유형 |
| --- | --- | --- |
| `catalog.test.ts` 교체 후 | frontmatter `description`에서 모델 토큰 파싱 → `NATIVE_OPENAI_MODELS`와 비교. 본문 code fence 단정 없음 | **자동** — `node --test plugins/codexclaw/components/subagent-config/test/catalog.test.ts` |
| `catalog` mutation | `NATIVE_OPENAI_MODELS`에서 `gpt-5.6-luna`를 빼면 RED, 복원하면 GREEN | **자동 (mutation)** |
| `ast-grep.test.ts:61` 삭제 | 그 단정이 사라지고 `:51`/`:56`은 남는다 | **자동** — `node --test plugins/codexclaw/components/cxc-ops/test/ast-grep.test.ts` |
| `manifest-policy.test.mjs:153-169` 교체 | `dev/SKILL.md`에서 `skill-catalog.md` **경로를 추출**해 `existsSync`로 확인하는 비교. 단순 문구 매치 아님 | **자동** — `node --test plugins/codexclaw/test/manifest-policy.test.mjs` |
| `manifest-policy.test.mjs:113-149` 삭제 | 그 블록 전체가 사라진다 (`130` 이월) | **자동** — 같은 명령 |
| 전체 스위트 | 실패 0. 단정 삭제로 개수는 1,224보다 줄어든다 | **자동** — `npm test` |
| 게이트 | exit 0 유지 | **자동** — `npm run gate` |
| 규칙 3개 + 구조 판정 기준이 `dev-testing/SKILL.md`에 존재 | `## Patch Integrity Gate` 앞. 각 규칙에 금지/허용 예 1개 이상, 전부 `DEFAULT` 표기, "Known violations remain" 문단 포함 | **사람 리뷰** — 자동 단정하면 `TEST-PROMPT-SEAM-01` 자기 위반이다 |
| bypass 다섯 필드 기록 | 이 문서에 존재 | **사람 리뷰** (A 체크 (e)) |
| 이월 2건 명시 | `120`/`130` 등록 + 규칙 본문에 위반 잔존 고지 | **사람 리뷰** |
| 포기한 보호 기록 | ast-grep 라우팅 안내, jaw/clawhub/hermes 우선순위, `cxc skill search/show` 계약, Tier heading·섹션 순서 | **사람 리뷰** |

"문구를 무해하게 바꿔도 테스트 불변" 행은 **삭제했다** — 이월된 두 doc-sync 테스트가
그 문구를 잡으므로 같은 트리에서 성립하지 않는다 (블로커 4). 대신 위 두 mutation 행이
교체된 테스트에 대해 같은 목적을 달성한다.

### 검증 명령 (PLAN-VERIFIER-REAL-01 적용)

- `npm test` — **실행 확인됨** (2026-07-26): exit 0, 1,224 pass / 0 fail.
  관측 근거: `package.json:24`의 glob이 `plugins/codexclaw/components/*/test/*.ts`와
  `plugins/codexclaw/test/*.test.mjs`를 포함하므로 교체 대상 4건 전부를 실행한다.
- `npm run gate` — **실행 확인됨**: exit 0 + WARN 7건. 관측 범위는 status-sync,
  false-enforcement 문구 3패턴, hook 카운트, verifier-claim WARN뿐이다.
  **이 슬라이스의 규칙 3개를 관측하지 않는다** — 회귀 확인용으로만 분류한다.
- 산문 규칙 3개와 판정 기준: **어떤 자동 명령도 관측하지 않는다.** 사람 리뷰다.
  게이트가 지켜준다고 적지 않는다.
- `npx tsc --noEmit`은 **적지 않는다** — root `tsconfig.json`이 없어 아무것도 검사하지 않는다.
- 초안이 "스킬/상수 drift는 `npm run gate`가 담당한다"고 적었던 문장은 **삭제했다** —
  게이트에 lunasearch 모델과 `NATIVE_OPENAI_MODELS`를 비교하는 로직이 없다 (블로커 3).

## 범위 밖

- upstream의 `check-no-excuse-rules.ts` vendoring (REJECT, `002` #9).
- 새 lint 규칙 도입 — 프로젝트 native checker가 진실원.
