# 100 — P/A 단계 규칙 보강 (프롬프트 엔지니어링)

출처: 이 유닛의 감사 4라운드 + Interview Mind 5명이 드러낸 **설계 결함 계열** ·
의존: 없음 (다른 슬라이스의 타입/코드를 쓰지 않음) ·
쓰기 범위: 산문 3파일 + `gate.mjs` 코드 1파일 + 신규 테스트 1파일 ·
소유권 주의: `plugins/codexclaw/skills/dev-testing/SKILL.md`를 `060`/`061`과 공유 —
아래 "소유권 충돌" 절 참조 · 상태: PLANNED

## 왜 이 슬라이스가 존재하는가

## 이 보강의 성격: 규칙 3 + 코드 2 (사용자 질문에 대한 답)

"규칙적 보강인가 코드적 보강인가" — **둘 다 섞여 있고, 비율은 3:2다.**
저장소 자신의 enforcement 사다리(`structure/40_enforcement_methods.md`) 용어로 갈라 적는다.

| 성격 | tier | 파일 | 넣는 것 | 실제로 막아주는가 |
| --- | --- | --- | --- | --- |
| **규칙(산문)** | E7 | `plugins/codexclaw/skills/pabcd/SKILL.md` P 절 | 규칙 3개 | **아니오** — 모델이 읽고 따르는 지침 |
| **규칙(산문)** | E7 | 같은 파일 A 절 | 리뷰어 체크 5개 | 아니오 |
| **규칙(산문)** | E7 | `plugins/codexclaw/skills/dev-testing/SKILL.md` | `TEST-ROW-REACHABLE-01` | 아니오 |
| **코드** | E8 | `plugins/codexclaw/scripts/gate.mjs` | 미작동 검증 명령 탐지 | 일부 — WARN만, 차단은 안 함 |
| **코드** | E8 | `plugins/codexclaw/test/gate-verifier-claims.test.mjs` | 위 검사의 테스트 | 예 (테스트 자체는 실패로 막힘) |

E7의 한계는 저장소가 이미 못 박아 뒀다: "산문의 모든 MUST는 E1/E2/E3 분기가 뒷받침하지
않으면 여전히 E7이다. 모순 등록부가 존재하는 이유는 E7이 반복적으로 강제로 오표기됐기
때문이다" (`structure/40_enforcement_methods.md:98-101`).

즉 이 슬라이스의 3/5는 **강제력이 없다.** 그것을 숨기지 않고 위 표로 적는다.

### 실측: 타입체크를 진짜로 만들면 얼마인가 (Mind "Pasteur", 2026-07-26)

`npx tsc --noEmit`을 실제로 작동하게 만드는 선택지를 평가하려고 실측했다.
명령과 결과를 그대로 남긴다 (TypeScript 5.9.3, Node v24.17.0).

| 대상 | 결과 |
| --- | --- |
| 현재 root `npx tsc --noEmit` | exit 1, 진단 0건, 도움말 141줄 — 아무것도 검사하지 않음 |
| component source 111개 (`--allowImportingTsExtensions --module nodenext`) | exit 2, **타입 오류 23건** |
| 같은 대상 + `--strict` | exit 2, **오류 27건** (상당수가 sibling `dist/*.js` declaration 부재 TS7016) |
| source + tests 204개 | exit 2, **오류 37건** |

따라서 "root tsconfig를 만든다"와 "타입체크가 통과한다"는 같은 작업이 아니다.
**기존 부채 23~37건을 먼저 갚아야 한다.**

추가 제약:

- 소스가 `.ts` 확장자로 상대 import한다 (83개 파일에 283건). 따라서 config에
  `noEmit: true` + `allowImportingTsExtensions: true`가 결박되고, 이는 emit용으로
  재사용할 수 없는 계약이다.
- 빌드는 tsc를 쓰지 않는다 — Node의 `stripTypeScriptTypes`로 타입만 제거한다
  (`plugins/codexclaw/scripts/build.mjs:2-4,65-67`). 그래서 root tsconfig 추가는
  `npm run build`에 무해하지만, **빌드 성공이 타입 정합을 보장하지 않는 상태가 유지된다.**
- TypeScript는 root가 아니라 GUI workspace의 devDependency다
  (`plugins/codexclaw/gui/package.json:16-20`). root gate가 쓰려면 소유권을 옮겨야 한다.
- 범위 정의가 필요하다. GUI는 `moduleResolution: "bundler"` + JSX + DOM
  (`plugins/codexclaw/gui/tsconfig.json:2-14`), docs-site는 Astro strict
  (`docs-site/tsconfig.json:1-5`), 컴포넌트는 NodeNext — 하나의 root config로 덮을 수 없다.

### 더 중요한 발견: `020`의 타입 안전 주장이 거짓이다

`020`은 `compareSource`를 객체 반환으로 바꾸면 `if (compareSource(...))` 오용이
"불가능해진다"고 적었다. 실제로 시험했다 (메인 에이전트가 재현 확인):

```
npx tsc --strict --noEmit --module nodenext --target es2022 \
  --moduleResolution nodenext /tmp/codexclaw-compare-source-truthiness.ts
→ exit 0, 오류 0건
```

TypeScript는 함수가 반환한 객체의 truthiness 검사를 금지하지 않는다. 반환값이나
`assertNever` 같은 장치 없는 `void` switch도 완전성을 검사하지 않는다.
**타입체크를 진짜로 만들어도 이 오용은 안 잡힌다.** `020`은 해당 주장을
"`assertNever` 헬퍼로 완전성을 강제한다"로 고쳐야 한다 — 그 슬라이스 P의 몫이다.

### 네 번째 선택지 (Mind가 지적)

제시된 3개 선택지에 빠진 것이 있다: **config 파일 없이 명시 flag + entry 파일로
컴포넌트 단위 타입체크가 이미 가능하다.** 대표 entry 중
`skill-search/src/sources.ts`는 오류 0건이었다. 즉 "root config 전면 도입"과
"작동하지 않는 명령 유지" 사이에 측정 가능한 중간 상태가 존재한다.
슬라이스별로 자기 컴포넌트만 타입체크하면 부채 23건을 한 번에 갚지 않아도 된다.

감사 4라운드에서 blocker 35건이 나왔고 blocker 수가 9→8→9→9로 줄지 않았다. 원인을
"내가 실수했다"로 두면 재발한다. Mind 조사 결과 결함이 **특정 계열로 반복**되며, 그 계열은
현행 P/A 규칙이 요구하지 않는 것들이다. 즉 개인 실수가 아니라 **규칙의 공백**이다.

이 슬라이스는 그 공백을 메운다. 대상이 upstream 파리티가 아니라 **codexclaw 자신의
계획 규율**이므로 `010`-`091`과 다른 decade(`100`)를 쓴다.

(`010`-`091`이 전부 upstream 채택이라는 뜻은 아니다 — `020`은 codexclaw 쪽 신설 기반이다
(`009_reinforcement_roadmap.md:21-23`). 구분 기준은 "upstream 델타에서 파생됐는가"이고,
`100`은 이 유닛의 감사 경험에서 파생됐다.)

## 자기 적용 (이 문서가 자신의 규칙을 지키는지)

Mind "Bohr"가 초안에서 모순 9건을 잡았고 전부 반영했다. 이 문서가 자신이 만드는 규칙을
어기면 규칙 전체의 신뢰가 사라지므로, 어긴 지점과 수정을 여기 남긴다.

| 초안의 위반 | 위반한 자기 규칙 | 수정 |
| --- | --- | --- |
| 헤더가 "순수 산문·의존 없음"인데 본문은 `gate.mjs` 코드와 테스트를 바꿨다 | 헤더 의존 드리프트 금지 | 헤더에 쓰기 범위를 명시 |
| `npm run gate`/`npm test`를 검증기로 적었으나 둘 다 산문 규칙 8개를 관측하지 못한다 | `PLAN-VERIFIER-REAL-01` | 산문 부분은 "사람 리뷰"로 정직하게 재분류 (아래 검증 표) |
| "실제 유닛에서 최소 1건 FAIL"과 "`npm run gate` exit 0 유지"를 동시에 요구했다 | `TEST-ROW-REACHABLE-01` | 상호 배타 해소 — fixture로 FAIL을 확인하고 실제 트리는 WARN으로 처리 |
| 산문 규칙을 `STRICT`로 표기 | E7 실체와 불일치 (`structure/40_enforcement_methods.md:18-32`) | 티어를 E7로 명시하고 강도 표기를 조정 |
| 기존 gate 동작을 "SKILL.md 3패턴과 카운트만"으로 축소 서술 | 관측 범위를 정확히 조사하라는 자기 규칙 | 실제 범위로 정정 (아래) |
| `100`이 로드맵/문서 맵에 등록되지 않았다 | DIFFLEVEL-ROADMAP-01 1:1 대응 | `000`/`009`에 등록 (이 슬라이스의 작업 항목) |

## 결함 계열 → 규칙 공백 매핑

| 반복된 결함 | 실제 사례 | 현행 규칙이 요구하는 것 | 빠진 것 |
| --- | --- | --- | --- |
| **검증 명령이 존재하지 않음** | 7개 문서가 `npx tsc --noEmit`을 타입 검증기로 적었으나 root `tsconfig.json`이 없어 도움말만 출력한다 (`package.json:21-24`에 typecheck script 없음) | `plugins/codexclaw/skills/pabcd/SKILL.md:125` — "Verifier (command/gate and what it measures)"를 loop-spec에 적어라 | 그 명령을 **실제로 실행해 작동을 확인하라**는 요구가 없다 |
| **검증기가 변경을 볼 수 없음** | `061`/`062`/`063`/`064`가 `npm run gate`를 검증기로 지정했으나 `plugins/codexclaw/scripts/gate.mjs:147-176`은 SKILL.md만 훑고 references/를 읽지 않는다 | 같은 줄 — "what it measures"를 적어라 | 검증기의 **관측 범위가 변경 대상을 포함하는지** 확인하라는 요구가 없다 |
| **타입만 추가하고 생성 경로 누락** | `040`이 `CriterionSurface`를 추가했으나 reviver·builder·CLI를 안 바꿔 값을 만들 방법이 없었다 (`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:128-139,198-216`) | `:125` — "file change map"을 적어라 | 새 필드의 **생성→직렬화→역직렬화→소비 사슬 전체**를 열거하라는 요구가 없다 |
| **새 상태의 기존 소비자 누락** | `091`이 `blocked`/`superseded`를 추가했으나 `nextOpenTask`·`effectiveActiveWorkPhaseId`·`advanceWorkPhase`가 `done`만 보는 것을 놓쳤다 (`goalplan.ts:241-248,303-330,341-349`) | 위와 같음 | 기존 열거형에 값을 더할 때 **그 열거형을 읽는 모든 지점을 찾으라**는 요구가 없다 |
| **게이트가 우회 가능한데 강제라고 서술** | `040`이 마커 없으면 통과, `030`이 `schemaVersion` 삭제로 우회 가능 | `plugins/codexclaw/scripts/gate.mjs:122-172`가 false-enforcement 산문을 정규식으로 잡지만 영문 3패턴뿐 | 설계 문서에 **우회 경로를 명시하고 최종 강제층을 지목하라**는 요구가 없다 |
| **테스트가 도달 불가능한 조건을 요구** | `091`의 "active가 blocked일 때 advance 거부"는 helper가 그 커서를 이미 제외하므로 도달 불가. `050`의 "악의적 work-phase id 경로 거부"는 경로 도출 지점이 없다 | `:125` — C-ACTIVATION-GROUNDING-01은 조건부 경로의 활성화 시나리오를 요구한다 | 그 요구가 **테스트 표의 각 행**에는 적용되지 않는다 (계획의 조건부 경로에만 적용) |
| **문서 간 필드 계약 불일치** | `030`의 파서는 `kind`/`sourceIdentity`/`createdAt`을, `070`은 `capturedAt`/`sourceSnapshotAt`/`captureChecks`를 쓰는데 "같은 값을 공유한다"고 주장했다 | DIFFLEVEL-ROADMAP-01은 각 phase에 diff-level 문서를 요구한다 | 여러 문서가 **공유 타입을 언급할 때 필드명까지 일치하는지** 검사하라는 요구가 없다 |
| **헤더 의존 선언이 본문과 드리프트** | `010` 헤더는 "의존 없음"인데 본문은 `020`의 타입을 쓴다. `090` 헤더는 `010` 의존인데 로드맵은 가짜 의존이라고 제거했다 | PHASE-SPLIT-01은 의존 순서 배열을 요구한다 | 문서 **헤더의 의존 선언과 본문의 실제 사용을 대조**하라는 요구가 없다 |

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/skills/pabcd/SKILL.md` | P 단계(`:125`)에 규칙 3개 추가: `PLAN-VERIFIER-REAL-01`, `PLAN-FIELD-CHAIN-01`, `PLAN-BYPASS-NAMED-01` |
| `plugins/codexclaw/skills/pabcd/SKILL.md` | A 단계(`:126`) 리뷰어 체크리스트에 항목 5개 추가 |
| `plugins/codexclaw/skills/dev-testing/SKILL.md` | `TEST-ROW-REACHABLE-01` 추가 (테스트 표 각 행의 도달 가능성) |
| `plugins/codexclaw/scripts/gate.mjs` | `checkVerifierClaims` 신규 + `runGate` warnings 필드 + CLI 양쪽 출력 경로 |
| `plugins/codexclaw/test/gate-verifier-claims.test.mjs` | 신규 테스트 |
| `devlog/_fin/260725_lazygap2_omo419_parity/000_plan.md` | 문서 맵에 `100`/`110` 등록 |
| `devlog/_fin/260725_lazygap2_omo419_parity/009_reinforcement_roadmap.md` | decade 맵에 `100`/`110` 등록 (슬라이스 16개로 갱신) |

### 삽입 위치 (감사 블로커 4 반영)

`## Phases`(`plugins/codexclaw/skills/pabcd/SKILL.md:120`) 아래는 `0.`~`5.` 번호 목록이고
각 단계가 긴 단일 행이다. 그 사이에 `###` 헤딩을 넣으면 목록이 끊긴다.

저장소가 이미 쓰는 방식을 따른다 — `:127`이 A 항목의 **들여쓴 continuation 문단**이다.
같은 형태로 넣는다.

| 규칙 | 위치 |
| --- | --- |
| `PLAN-VERIFIER-REAL-01` | P 항목(`:125`) 뒤 3-space 들여쓴 continuation 문단 |
| `PLAN-FIELD-CHAIN-01` | 같은 위치, 위 문단 다음 |
| `PLAN-BYPASS-NAMED-01` | 같은 위치, 위 문단 다음 |
| A 리뷰어 체크 5항목 | A 항목(`:126`) 뒤, 기존 `:127` continuation **앞**에 같은 형태로 |

`###` 독립 절은 만들지 않는다. 번호 목록 구조를 보존한다.

## 소유권 충돌 (Mind 지적 반영)

`plugins/codexclaw/skills/dev-testing/SKILL.md`를 세 슬라이스가 만진다 —
`060`(오라클 규칙 3개), `061`(guard-removal 문장), `100`(`TEST-ROW-REACHABLE-01`).
`dev-code-reviewer/SKILL.md`는 `061`과 `062`가 공유한다.

별도 브랜치로 병렬 실행하면 hunk 충돌이 나고, 순차 실행이면 물리 충돌은 없지만
**뒤에 오는 슬라이스의 P가 앞선 변경을 반영해 stale 검사를 해야 한다.**
따라서 이 셋은 "독립"이 아니라 **같은 파일 소유권을 순차 공유**하는 관계다.
`009`의 독립 선언을 그렇게 정정한다.

## before → after

### `PLAN-VERIFIER-REAL-01` (E7 규율, P 단계)

before: `plugins/codexclaw/skills/pabcd/SKILL.md:125`는 loop-spec에
"Verifier (command/gate and what it measures)"를 적으라고만 한다.

after: 아래를 추가한다.

> **PLAN-VERIFIER-REAL-01 (DEFAULT — E7 규율, 런타임 강제 없음).** 계획에 검증 명령을 적기 전에 **그 명령을 실행해
> 본다.** 존재하지 않거나(스크립트/설정 부재) 대상 파일을 읽지 않는 명령은 검증기가
> 아니다. 각 검증 명령 옆에 무엇을 관측했는지 한 줄로 적는다 — exit code와,
> 그 명령이 이번 변경 대상을 실제로 읽는지 여부.
>
> 특히 흔한 두 가지 함정: (1) `npx tsc --noEmit`처럼 설정 파일이 없으면 조용히
> 아무것도 검사하지 않는 명령, (2) 산문 규칙을 추가하면서 그것을 읽지 않는 게이트를
> 검증기로 지목하는 것. 검증기가 변경을 볼 수 없으면 그 계획의 수용 기준은
> "사람이 읽어서 확인"이라고 정직하게 적는다 — 게이트가 지켜준다고 쓰지 않는다.
>
> **포함 증명 (감사 블로커 3):** "대상 파일을 읽는다"를 주장할 때는 아래 중 하나를
> 근거로 적는다. 느낌으로 판정하지 않는다.
>
> | 근거 유형 | 무엇을 적는가 |
> | --- | --- |
> | 직접 인자 | 명령줄에 대상 경로가 있다 |
> | glob/스크립트 정의 | `package.json` 스크립트의 glob이 대상을 포함한다 (그 glob을 인용) |
> | config include | 설정 파일의 `include`/`files`가 대상을 포함한다 (그 항목을 인용) |
> | 호출 체인 | 그 명령이 호출하는 하위 스크립트가 대상을 읽는다 (파일:행으로 그 지점 인용) |
> | 관측 없음 | 위 어느 것도 아니다 → **"이 명령은 이 변경을 보지 못한다"고 적고 사람 리뷰로 분류** |

### `PLAN-FIELD-CHAIN-01` (E7 규율, P 단계)

> **PLAN-FIELD-CHAIN-01 (DEFAULT — E7 규율).** 타입에 필드를 더하거나 열거형에 값을 더하는 계획은
> 그 값의 **전체 사슬**을 파일 변경 맵에 열거한다: 생성(입력 타입·builder·CLI 인자) →
> 직렬화 → 역직렬화(reviver, 미지값 처리) → 소비 지점 전부.
>
> 열거형에 값을 더할 때는 그 열거형을 읽는 모든 분기를 검색해 목록화한다
> (`rg`로 기존 값들을 찾아 분기 지점을 전수 조사). 소비자를 빠뜨리면 새 값이 어느
> 집계에도 안 잡히는 유령 상태가 된다. 생성 경로를 빠뜨리면 값을 만들 방법이 없어
> 그 필드에 의존하는 조건이 영원히 무장하지 않는다.
>
> **검색 대상 (감사 블로커 3):** 기존 값 문자열만 찾으면 놓친다. 셋 다 검색한다 —
> 타입 이름, 필드 이름, 기존 열거값 전부. 그리고 값 비교가 아닌 소비 형태도 확인한다:
> 구조분해/별칭(`const {status: s} = wp`), `default` 분기, 제네릭 술어
> (`(x) => x.status !== "done"`), 그리고 그 타입을 인자로 받는 함수 전부.
>
> **각 단계에 경로 또는 N/A:** 생성 → 직렬화 → 역직렬화 → 소비 네 단계를 표로 적고,
> 해당 없는 단계는 빈칸으로 두지 말고 **`N/A + 이유`**를 적는다
> (예: "직렬화 N/A — 이 값은 런타임 전용이고 디스크에 쓰지 않는다").
> 빈칸은 "확인 안 함"과 구분되지 않는다.

### `PLAN-BYPASS-NAMED-01` (DEFAULT) — P 단계

> **PLAN-BYPASS-NAMED-01 (DEFAULT).** 강제(enforcement)를 추가하는 계획은 **그것을
> 우회하는 방법**을 함께 적는다. 마커를 생략하면 되는지, 필드를 지우면 되는지,
> 파일을 편집하면 되는지. 그리고 우회 불가능한 최종 층이 무엇인지 지목한다.
> 우회 가능한 층은 "조기 경고"라고 부르고 "강제"라고 부르지 않는다.
>
> **기록 항목 (감사 블로커 3):** 강제 하나당 다섯 줄을 적는다 —
> ① tier(E1-E8), ② 실행 주체(어느 훅/스크립트/사람), ③ 알려진 우회 경로,
> ④ 잔여 위험, ⑤ 표현 강등 여부("강제" → "조기 경고"로 바꿨는지).
>
> **최종 층이 없어도 된다.** `최종 강제층: none`을 허용한다 — 이 규칙의 목적은
> 우회 불가를 만들어내는 게 아니라 **없는 강제를 있다고 쓰지 않게** 하는 것이다.
> 실제로 이 문서의 gate WARN 검사도 실행 생략·문구 변경·파일 이동으로 우회되며,
> 그 사실을 위 gate 절에 적어 뒀다. 우회 경로가 없다는 주장에는 근거를 붙인다 —
> 대개 그 주장은 틀린다.

### A 단계 리뷰어 체크리스트 (5항목 추가)

`plugins/codexclaw/skills/pabcd/SKILL.md:126`의 "reviewer also checks" 목록에 추가한다.

> 리뷰어는 추가로 확인한다: (a) 계획이 지목한 검증 명령이 실제로 존재하고 변경 대상을
> 읽는가 (PLAN-VERIFIER-REAL-01) — 리뷰어가 직접 실행해 확인한다; (b) 새 필드/열거값의
> 생성→소비 사슬이 전부 열거됐는가 (PLAN-FIELD-CHAIN-01); (c) 여러 문서가 공유 타입을
> 언급할 때 필드명이 일치하는가; (d) 각 문서 헤더의 의존 선언이 본문의 실제 타입 사용과
> 일치하는가; **(e) 강제를 추가하는 계획이 `PLAN-BYPASS-NAMED-01`의 다섯 필드
> (tier / 실행 주체 / 알려진 우회 경로 / 잔여 위험 / 표현 강등)를 기록했고, 최종 강제층을
> 지목했거나 `none`으로 명시했는가** (2라운드 감사 블로커 5 — 이 항목이 없으면
> P 규칙 위반이 이 A gate를 그대로 통과한다). 다섯 중 하나라도 어긋나면 blocker다.

### `TEST-ROW-REACHABLE-01` (DEFAULT) — dev-testing

> **TEST-ROW-REACHABLE-01 (DEFAULT).** 수용 기준 표의 각 행은 그 전제 조건을 **실제로
> 만들 수 있어야** 한다. 행을 쓸 때 자문한다: 이 상태에 도달하는 호출 경로가 있는가?
> 앞선 가드가 이 조건을 먼저 소비해 버리지 않는가? 이 값을 만드는 op이 존재하는가?
>
> 도달 불가능한 행은 검증이 아니라 장식이다 — 구현자가 그 테스트를 쓰려다 못 쓰고
> 조용히 지운다. C-ACTIVATION-GROUNDING-01이 계획의 조건부 경로에 요구하는 것을
> 테스트 표의 각 행에도 적용한다.

### `gate.mjs` 신규 검사 (WARN 등급) — A 감사 반영 재설계

before (정정된 실제 범위): `gate.mjs`는 세 검사를 돌린다 —
`checkStatusSync`(mvp_hard INDEX 상태 동기, `:88-120`),
`checkForbiddenClaims`(false-enforcement 산문 3패턴, **SKILL.md와 `structure/*.md` 둘 다**, `:147-176`),
`checkCounts`(매니페스트 카운트, `:179-204`). 위반이 하나라도 있으면 `ok: false`이고
CLI는 exit 1이다 (`:193-216`).

after: 계획 문서의 검증 명령 주장을 검사하는 네 번째 검사를 더한다.

#### 함수 계약 (감사 블로커 2·5 반영)

```js
/** @returns {{ ok: true, warnings: string[] }} — 이 검사는 violations를 내지 않는다. */
export function checkVerifierClaims(repoRoot = REPO_ROOT)
```

- `ok`은 항상 `true`다. 이 검사는 **차단하지 않는다.**
- `runGate`의 반환형을 additive로 확장한다:
  `{ ok, checks, violations, warnings }`. `warnings`는 신규 필드이므로
  기존 소비자(`gate.mjs` CLI, `plugins/codexclaw/test/gate.test.mjs:19-20`,
  개별 check 테스트들)를 깨지 않는다.
- **CLI 출력 경로를 양쪽 다 고친다** (블로커 2의 핵심 — 안 고치면 경고가 보이지 않는다):
  성공 경로(`gate.mjs:209-212`)와 실패 경로(`:213-216`) 모두에서
  `warnings`가 비어있지 않으면 `[codexclaw gate] WARN — N verifier-claim issue(s):`와
  각 항목을 stderr로 출력한다. exit code는 `violations`만으로 결정한다
  (경고만 있으면 exit 0).
- 모든 fixture 테스트는 `runGate(tempRoot)`가 아니라 **`checkVerifierClaims(tempRoot)`를
  직접 호출한다** — `runGate`를 임시 트리에 돌리면 `checkStatusSync`의 INDEX 부재와
  `checkCounts`의 manifest 부재가 무관하게 터진다 (블로커 5).

#### 검출 문법: 자유 산문이 아니라 지정 블록만 (블로커 1 반영)

초안은 문서 전체에서 명령 문자열을 찾으려 했다. 실제로 세어 보니 이 유닛에서
`npx tsc --noEmit`이 매치되는 문서는 7개가 아니라 **8개**이고, 그 8번째가 바로
이 문서(`100`)다 — 여기서는 그 명령을 "쓰지 말라"고 설명하는 맥락으로 8번 등장한다.
기존 면제 장치(`gate.mjs:134-141`의 `NEGATION_CUE`/`META_CUE`)는 영어 단어 기반이라
"적지 않는다", "함정" 같은 한국어 부정·메타를 걸러내지 못한다.

그래서 **자유 산문을 스캔하지 않는다.** 검출 대상을 문법으로 좁힌다.

**두 가지 형태를 모두 파싱해야 한다** (2라운드 감사 블로커 1 — 초안은 불릿만 읽어서
실제 대상 7건을 하나도 못 읽었다). 실제 트리를 확인한 결과:

- 인라인 형태 (실제 7건 전부 이 형태): `검증 명령: \`npm test\`, \`npx tsc --noEmit\`, ...`
  — 한 줄 문단이다. 예: `010_review_round_binding.md:144`, `020_source_identity_receipts.md:128`,
  `030_final_gate_state.md:268`, `040_final_gate_spawn_guard.md:147`,
  `050_progress_aware_stop.md:76`, `090_steering_transaction_substrate.md:88`,
  `091_steering_mutation_families.md:151`.
- 불릿 형태 (`100`과 `110`이 쓰는 형태): `검증 명령` 문단 다음에 `- \`cmd\` — 설명` 목록.

파서 규칙:

1. 줄이 `검증 명령`으로 시작하면 그 줄 자체에서 백틱 명령을 추출한다 (인라인 형태).
2. 이어서 다음 빈 줄 이후 불릿(`- `)이 나오면 그 목록도 파싱하고, 비불릿 줄에서 중단한다.
3. 후보 줄에 `**적지 않는다**`가 있으면 면제, `**실행 확인됨**`이 있으면 통과로 읽는다.
4. 표 행(`|`로 시작), 코드펜스 내부, 그 밖의 산문은 전부 제외한다.

이 문법이면 `100` 자신의 9건 매치(`:32,37,112,175,283,302,310,328,354`)와 `110`의 1건
(`:69`)이 모두 제외된다 — `검증 명령` 블록에 있는 것은 `100:354`와 `110:69` 둘뿐이고
양쪽 다 `**적지 않는다**` 표기가 붙어 있다. 나머지는 표·설명·측정 결과·인용문이다.

(초안은 `100`의 매치를 8건으로 적었는데 실제는 9건이고, `110` 추가로 매치 파일도
8개→9개가 됐다. 2라운드 감사에서 정정.)

#### 판정 규칙

- `npx tsc --noEmit`이 후보인데 저장소에 `tsconfig.json`이 없으면 → WARN,
  파일·행과 "이 명령은 아무것도 검사하지 않는다"를 보고한다.
- `node --test <path>`가 후보인데 경로가 없으면 → WARN. **단 면제 조건은
  같은 문서의 변경 파일 맵에서 그 정확한 경로가 `신규`로 표시된 경우로 한정한다**
  (블로커 5 — 문서 어딘가에 "신규"라는 단어가 있으면 전부 면제되는 느슨한 해석 금지).
  경로에 glob(`*`)이 있으면 존재 판정을 하지 않고 건너뛴다.
- 이 검사는 `devlog/_plan/`에만 적용하고 종료된 `devlog/_fin/`은 제외한다.

**WARN인 이유:** 현재 이 유닛의 7개 문서가 `검증 명령` 블록에서 `npx tsc --noEmit`을
적고 있다 (`010`, `020`, `030`, `040`, `050`, `090`, `091` 각 1건). FAIL로 만들면
`npm run gate`가 즉시 exit 1이 되어 모든 작업이 막힌다. 그 7건을 고치는 것은 각
슬라이스 P의 몫이므로, 검사는 보고만 하고 차단하지 않는다.

**설치 payload에서의 한계 (Mind 지적 반영):** 마켓플레이스 payload는
`./plugins/codexclaw`뿐이다 (`.agents/plugins/marketplace.json:6-12`). `devlog/`는
payload에 없으므로 이 검사는 **저장소 체크아웃에서만 동작한다.** 설치된 플러그인에서는
검사 대상이 없어 조용히 통과한다. 이것은 결함이 아니라 범위이고, 그 사실을 코드 주석과
이 문서에 적는다 — "설치본에서도 계획 규율을 강제한다"고 쓰지 않는다.

검사가 실제로 동작하는지는 **fixture로** 확인한다 (실제 트리를 FAIL시키지 않고).

## 테스트 (accept criteria)

| 시나리오 | 기대 |
| --- | --- |
| **기계 검증 (신규 테스트가 실행)** | |
| fixture: `tsconfig.json` 없는 임시 트리 + `npx tsc --noEmit` 주장 | WARN 1건, 파일·행 명시 |
| fixture: `tsconfig.json` 있음 | WARN 0건 |
| fixture: `devlog/_fin/` 아래 같은 주장 | 검사 제외 (WARN 0건) |
| fixture: `node --test` 미존재 경로 + "신규" 표시 | WARN 0건 |
| fixture: `node --test` 미존재 경로 + 표시 없음 | WARN 1건 |
| fixture: `devlog/` 자체가 없는 트리 (payload 모사) | 조용히 통과, 오류 없음 |
| 실제 저장소에서 `npm run gate` | **exit 0 유지** (WARN은 violations에 안 들어감) |
| 실제 저장소에서 WARN 출력 | 현재 7건 보고 (`010`·`020`·`030`·`040`·`050`·`090`·`091`) |
| 기존 3검사 (`statusSync`·`forbiddenClaims`·`counts`) | 회귀 없음 |
| `npm test` | 통과 |
| **사람 리뷰 (기계가 못 봄 — 정직한 분류)** | |
| P 규칙 3개가 `pabcd/SKILL.md`에 존재하고 함정 예시 포함 | 리뷰어 확인 |
| A 리뷰어 체크 (a)-(e) 존재 | 리뷰어 확인 |
| `TEST-ROW-REACHABLE-01`이 `dev-testing/SKILL.md`에 존재 | 리뷰어 확인 |
| `000`/`009`에 `100` 등록 | 리뷰어 확인 |

산문 4행을 자동 검증하지 않는 이유: 그러려면 SKILL.md 문구를 단정해야 하고, 그것은
`060`이 도입하는 `TEST-PROMPT-SEAM-01` 위반이다. 자기 규칙끼리 충돌하지 않도록
사람 리뷰로 분류하는 것이 정직한 처리다.

검증 명령 (PLAN-VERIFIER-REAL-01을 이 문서 자신에게 적용):

- `npm run gate` — **실행 확인됨**, exit 0. `gate.mjs` 코드 변경은 이 명령이 실행하므로
  관측된다. 단 **산문 4행은 관측하지 못한다** (위 표에서 사람 리뷰로 분류).
- `npm test` — **실행 확인됨**, exit 0, 1,213 tests pass. 신규 테스트를
  `plugins/codexclaw/test/*.test.mjs`에 두면 `package.json:24`의 glob이 포함한다.
- `npx tsc --noEmit` — **적지 않는다.** root `tsconfig.json`이 없어 아무것도 검사하지 않음을
  확인했다 (도움말 출력). 이 문서가 고치려는 바로 그 함정이다.

## 범위 밖

- 새 훅 추가 (기존 gate 확장으로 충분).
- 영문 false-enforcement 정규식 확장 (별건).
- 이 유닛의 `010`-`091` 문서 자체 수정 — 이 슬라이스는 규칙만 바꾼다.
  규칙 적용으로 드러나는 기존 문서의 결함은 해당 슬라이스 P에서 처리한다.
