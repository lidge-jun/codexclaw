# 061 — slop 정리 안전성 규칙

출처: `002` #10 (ADOPT / E7) · 의존: 없음 · 상태: PLANNED

## 문제

`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:343-358`은 AI slop 목록을 가지고 있고
`plugins/codexclaw/skills/dev/SKILL.md:297-332`는 필요성·재사용 사다리를 가지고 있다.
빠진 것은 하나다: **신뢰 경계 가드를 "불필요한 방어 코드"로 오인해 삭제하는 것**을 막는 장치.

upstream이 이 지점을 명시했다
(`devlog/.lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md:52-55,86-87,141-163`).
삭제 사다리 자체는 codexclaw에 이미 등가로 있으므로 중복하지 않는다.

## A 감사에서 드러난 것: 이 슬라이스는 대부분 중복이었다

리뷰어가 기존 규칙을 전수 조사한 결과, 초안이 추가하려던 것 대부분이 이미 있다.

| 초안이 추가하려던 것 | 이미 있는 곳 |
| --- | --- |
| 삭제 전 green test로 동작 고정 | `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:345-346` "Lock behavior with green tests before deletion" |
| 불필요한 방어 코드 분류 | 같은 파일 `:351` (row 2 Over-defense) |
| 동작 변경 시 regression 요구 | 같은 파일 `:358` (row 9 Missing behavior tests) |
| 신뢰 경계 미검증은 High | 같은 파일 `:234` (Missing validation → **High**) |
| malformed/hostile 입력 regression | `plugins/codexclaw/skills/dev-testing/SKILL.md:333` |
| mutation RED/GREEN 확인 | `plugins/codexclaw/skills/dev-testing/SKILL.md:443-444` (WP2가 방금 넣음) |

따라서 `dev-testing/SKILL.md` 변경은 **철회한다** — `:443-444`가 이미 같은 것을 말한다.

### 초안의 논리 오류 (리뷰어 블로커 1)

초안은 "guard를 제거한 상태에서 반드시 실패해야 한다"를 삭제의 정당화로 요구했다.
그런데 그 테스트가 정말 guard 제거로 RED라면, **최종 삭제 상태도 RED다** — 즉
그 guard는 중복이 아니라 load-bearing이고 삭제하면 안 된다는 뜻이 된다.
요구 자체가 삭제를 부정한다.

두 경우를 갈라야 한다:

- **대체·이동 삭제** (검증이 다른 곳으로 옮겨감): 기존 guard 삭제 후에도 GREEN이어야 하고,
  남은 경계 검증까지 지웠을 때 RED여야 한다.
- **대체 없는 삭제**: mutation이 RED면 그 guard는 load-bearing이므로 **삭제 금지**.

### 남는 순증분

기존 규칙들은 "regression coverage가 있어야 한다"는 일반론이고, **삭제 변경에 대해
그 경로를 실제로 발화시키는 테스트를 blocker로 결합하지는 않는다.** 그 결합 하나와
대체/비대체 구분이 이 슬라이스의 실제 산출이다 — 리뷰어도 이 순증분은 별도 규칙으로
둘 가치가 있다고 확인했다. prose-seam은 재진술이므로 owner 포인터 한 줄로 줄였다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` | slop 표(`:350-358`) 마지막 행 뒤, `---`(`:360`) 앞에 문단 2개 삽입 |

**WP3 P 실측 앵커 (A 감사 정정):** header `:343`, 표 header/separator `:348-349`,
데이터 9행 `:350-358`, 빈 줄 `:359`, `---` `:360`, 다음 절 `:362`.
초안이 적은 `:348-361 / :363 / :365`는 실제보다 3행 뒤였다.

## before → after

### 삽입할 문단 (복사 실행 가능)

> **REVIEW-GUARD-REMOVAL-01 (DEFAULT).** 신뢰 경계의 입력 검증이나 오류 처리를
> **삭제**하는 변경은 **삭제 대상 경로를 실제로 발화시키는** regression 테스트를
> 동반해야 한다. 입력 검증 guard라면 malformed/hostile 입력이고, 오류 처리 handler라면
> 그 handler를 타게 하는 장애 주입이다 — network timeout, connection reset,
> filesystem I/O 실패, subprocess 실패 등. 무관한 입력 테스트를 붙여 형식만 채우는 것은
> 이 요구를 만족하지 않는다. 동반하지 않으면 High blocker다 — 위 표의 row 2(Over-defense)는
> "이 guard가 불필요하다"의 근거가 되지 못한다. 신뢰 경계란 외부 입력이 처음 도달하는
> 지점이다: 훅 stdin, CLI 인자, 파일 파싱, 네트워크 응답, 서브에이전트 출력.
>
> 삭제 유형을 구분해 판정한다. **대체·이동 삭제**(검증이 다른 지점으로 옮겨간 경우)는
> 삭제 후에도 regression이 GREEN이어야 하고, 남은 경계 검증까지 제거했을 때 RED여야
> 한다. **대체 없는 삭제**는 regression이 RED가 되는 순간 그 guard가 load-bearing임이
> 증명된 것이므로 삭제를 승인하지 않는다.
>
> 산문 파일의 문구 변경에 대한 테스트 적합성은 `dev-testing`의 `TEST-PROMPT-SEAM-01`을
> 적용한다 — test adequacy의 owner는 `dev-testing`이다 (`:35`). 여기서 재진술하지 않는다.

## PLAN-BYPASS-NAMED-01 기록 (다섯 필드)

이 슬라이스는 리뷰 규칙 2개를 추가하므로 강제 기록 의무가 있다
(`plugins/codexclaw/skills/pabcd/SKILL.md:131`).

| 필드 | 값 |
| --- | --- |
| tier | **E7** (산문). 두 규칙 모두 `DEFAULT` 표기 — 런타임 강제가 없으므로 STRICT를 쓰지 않는다 |
| 실행 주체 | A 단계 리뷰어 (사람) |
| 알려진 우회 | 리뷰어가 규칙을 로드하지 않거나 읽고 넘어가면 그만이다. 게이트가 검사하지 않는다 |
| 잔여 위험 | guard 삭제가 regression 없이 통과할 수 있다. 실제로 자동 탐지 수단이 없다 |
| 표현 강등 | "게이트가 막는다"고 쓰지 않는다. High blocker는 리뷰어 판정이라는 뜻이다 |
| 최종 강제층 | **none** |

## PLAN-FIELD-CHAIN-01

**N/A — 타입 필드나 열거값을 추가하지 않는다.**

## 테스트 (accept criteria)

| 항목 | 기대 | 검증 유형 |
| --- | --- | --- |
| `REVIEW-GUARD-REMOVAL-01`이 표 마지막 행(`:358`) 뒤·`---`(`:360`) 앞에 존재 | 신뢰 경계 5종 열거 + 삭제 대상 경로를 발화시키는 stimulus 요구(입력 검증=malformed/hostile, 오류 처리=장애 주입) + 대체/비대체 구분 + `DEFAULT` 표기 | **사람 리뷰** |
| prose 테스트 적합성 포인터 1줄이 같은 위치에 존재 | `dev-testing`의 `TEST-PROMPT-SEAM-01`을 owner로 지목하고 재진술하지 않는다 | **사람 리뷰** |
| slop 표 9행 보존 | 표가 깨지지 않는다 | **사람 리뷰** — 게이트는 markdown 표를 파싱하지 않는다 (`gate.mjs:147-175`는 줄 단위 정규식 3개뿐) |
| bypass 다섯 필드 기록 | 이 문서에 존재 | **사람 리뷰** (A 체크 (e)) |
| 중복 제거 기록 | 기존 규칙 6곳과의 중복 표가 문서에 존재 | **사람 리뷰** |
| 게이트 회귀 | exit 0 유지 | **자동** — `npm run gate` |
| 스위트 회귀 | 1,224 pass 유지 (테스트 변경 없음) | **자동** — `npm test` |

검증 명령 (PLAN-VERIFIER-REAL-01 적용):

- `npm run gate` — **현재 baseline 실측** (2026-07-26): exit 0 + WARN 7건.
  리뷰어가 현재 삽입 블록 17개 물리 행을 `FORBIDDEN_PATTERNS`에 재대입해 match 0을 확인했다.
  단 **이 변경의 내용을 관측하지는 않는다** — 회귀 확인용이다.
- `npm test` — **현재 baseline 실측**: exit 0, 1,224 pass / 0 fail.
  이 슬라이스는 테스트를 건드리지 않으므로 개수가 그대로여야 한다.
- 규칙 문장의 존재와 내용: **어떤 자동 명령도 관측하지 않는다.** 사람 리뷰다.
- `npx tsc --noEmit`은 **적지 않는다** — root `tsconfig.json`이 없다.

## 범위 밖

- 삭제/재사용/native/단순화 사다리 재작성 (이미 등가 존재).
- 자동 guard 감지 도구.
