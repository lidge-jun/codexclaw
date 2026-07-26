# 130 — removed-backend 리뷰 규칙 (자동 계약 없음)

출처: `060` WP2 A 감사 2라운드에서 이월 (리뷰어 "Meitner" 블로커 1) ·
의존: `060` (삭제가 먼저 일어나야 한다) ·
쓰기 범위: `dev-code-reviewer/SKILL.md` 산문 1문단 · 상태: PLANNED

## 문제

`plugins/codexclaw/test/manifest-policy.test.mjs:122-133`은 `search/SKILL.md`의 각 줄을 훑어
제거된 백엔드 이름(`progrok`, `web-AI`, `Grok Expert`, `GPT Pro`, `Exa`, `Tavily`,
`Perplexity`, `Brave`)이 나오면 그 줄에 `do **not**|reintroduce|removed|non-goal|carry over`
같은 부정 표현이 함께 있는지 확인한다.

지키려는 것은 실재한다 — **제거된 백엔드가 사용 가능한 것처럼 문서에 적히면 안 된다.**
그러나 검사 방식은 한 소스의 산문을 정규식으로 읽는 것이라 `060`이 설치하는
`TEST-PROMPT-SEAM-01` 위반이다. 문장을 다듬으면 깨지고, 깨져도 실제로 틀린 동작이 없다.

`060`에서 이월한 이유: 제대로 하려면 제거된 백엔드 목록을 **구조화 값**으로 선언하고
실제 사용 가능한 백엔드 목록과 비교해야 한다. 그것은 스킬 스키마 작업이다.

## 판정: 자동 계약 포기 — human review로 분류 (A 감사 3라운드)

초안은 `search/SKILL.md` frontmatter에 `removed-backends`와 `active-backends` 두 배열을
선언하고 교집합이 비었는지 검사하자고 했다. 리뷰어가 이를 반박했고 맞다:

**두 배열이 같은 파일에 사람이 같이 적는 값이라 독립 오라클이 아니다.** `060`이 요구하는
"두 소스에서 값을 추출해 비교"가 아니라 한 소스의 자기일관성 검사이고, 두 배열을 함께
잘못 적으면 실제 available backend와 완전히 무관해도 항상 통과한다.

독립 소스가 실재하는지 찾아봤다. 없다:

- `plugins/codexclaw/skills/search/SKILL.md:43-123`의 ladder는 백엔드를 **산문으로만**
  서술한다 (Tier 1 hosted `web_search`, Tier 2 browser, Tier 3 explorer swarm).
- 코드에 사용 가능 백엔드를 열거한 registry/상수가 없다. `web_search`는 호스트 제공
  도구이고 codexclaw이 목록을 소유하지 않는다.

따라서 **이 슬라이스는 자동 계약을 만들지 않는다.** `manifest-policy.test.mjs:113-149`는
`060`에서 삭제되고, 그것이 지키던 보호는 human review로 이전한다.

### 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` | 리뷰 체크리스트에 항목 1개 추가 |

추가할 문장:

> **REVIEW-REMOVED-BACKEND-01 (DEFAULT).** `search/SKILL.md`를 수정하는 변경은,
> 제거된 백엔드(`progrok`, `web-AI`, `Grok Expert`, `GPT Pro`, `Exa`, `Tavily`,
> `Perplexity`, `Brave`)가 사용 가능한 것처럼 다시 적히지 않았는지 확인한다.
> 이들은 non-goal 문맥에서만 등장해야 한다. 자동 검사는 없다 — 이 확인은 리뷰어의 몫이다.

### 이 슬라이스가 포기하는 것 (정직한 기록)

- 제거된 백엔드가 문서에 다시 등장하는 것을 **자동으로 막지 못한다.**
- Tier heading 개수, 섹션 순서, 한국어 트리거 단어 존재도 자동 검사가 사라진다.
- 이 전부가 human review 잔여 항목이고, 그것을 규칙 한 줄로 명시하는 것이 이 슬라이스의 산출이다.

만약 나중에 백엔드 registry가 코드에 생기면 그때 자동 계약을 다시 검토한다.

## PLAN-FIELD-CHAIN-01

**N/A — 타입 필드나 열거값을 추가하지 않는다** (자동 계약을 포기했으므로).

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E7** (산문) |
| 실행 주체 | A 단계 리뷰어 (사람) |
| 알려진 우회 | 리뷰어가 확인하지 않으면 그만이다 |
| 잔여 위험 | 제거된 백엔드가 문서에 다시 등장해도 자동으로 잡히지 않는다 |
| 표현 강등 | "자동 검사는 없다"를 규칙 문장 안에 직접 적는다 |
| 최종 강제층 | **none** |

## 테스트 (accept criteria)

| 항목 | 기대 | 검증 유형 |
| --- | --- | --- |
| `REVIEW-REMOVED-BACKEND-01`이 `dev-code-reviewer/SKILL.md`에 존재 | 8개 백엔드 이름 열거 + "자동 검사 없음" 명시 | **사람 리뷰** |
| 포기한 보호 3건 기록 | 이 문서에 존재 | **사람 리뷰** |
| 게이트 회귀 | exit 0 유지 | 자동 — `npm run gate` |
| 스위트 회귀 | 실패 0 | 자동 — `npm test` |

검증 명령 (PLAN-VERIFIER-REAL-01):

- `npm run gate` — **baseline 실측 (WP17 P, 2026-07-26)**: exit 0, **WARN 0건**.
  (초안이 적은 WARN 7건은 WP1 시점 값이고, 이후 슬라이스들이 죽은 검증 명령을 전부 고쳤다.)
  **이 슬라이스의 변경을 관측하지 않는다** — `dev-code-reviewer/SKILL.md`의 산문 한 문단은
  false-enforcement 3패턴에 걸리지 않는다. 회귀 확인용으로만 분류한다.
- `npm test` — **baseline 실측 (WP17 P)**: exit 0, **1,405 pass** / 0 fail.
  이 슬라이스는 테스트를 추가하지도 삭제하지도 않는다 — 개수 불변이 기대값이다.

### WP17 P 실측 — 두 전제 확인

| 전제 | 확인 |
| --- | --- |
| `060`이 removed-backend 검사를 이미 삭제했다 | **참.** `manifest-policy.test.mjs:113-116`에 삭제 주석이 남아 있고, 그 주석이 **"The removed-backend protection moves to REVIEW-REMOVED-BACKEND-01 (review, not a test)"**라고 이 규칙을 명시적으로 가리킨다 |
| `REVIEW-REMOVED-BACKEND-01`이 아직 없다 | **참.** `rg -c` 결과 `dev-code-reviewer/SKILL.md`에 0건 |
| 코드에 백엔드 registry가 없다 | **참.** `rg -l 'progrok\|Tavily\|Perplexity' --glob '*.ts' --glob '*.mjs'` 결과 0건. 유일한 등장은 `search/SKILL.md` 산문 |

즉 **지금 트리에는 명시적으로 이관된 보호가 받는 쪽 없이 떠 있다.** 이 슬라이스가
그것을 받는다. 자동 계약을 포기한 판단도 세 번째 행이 뒷받침한다 — 비교할 코드 소스가
실재하지 않는다.
- `npx tsc --noEmit`은 **적지 않는다** — root `tsconfig.json`이 없다.
- 규칙 문장의 존재와 내용: **어떤 자동 명령도 관측하지 않는다.** 사람 리뷰다.

## 범위 밖

- 백엔드 registry를 코드에 신설하는 것 (그것이 생기면 자동 계약을 재검토한다).
- `search/SKILL.md` 본문 재작성.
- frontmatter 스키마 변경 — 이 슬라이스는 스킬 frontmatter를 건드리지 않는다.
