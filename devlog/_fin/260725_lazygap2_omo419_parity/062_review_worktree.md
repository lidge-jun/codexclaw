# 062 — 리뷰 worktree 요구 좁히기

출처: `002` #11 (ADAPT / E7) · 의존: 없음 · 상태: PLANNED
소유자: `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` 단일

## 문제

upstream은 리뷰마다 전용 worktree를 요구한다
(`devlog/.lazycodex/plugins/omo/skills/review-work/SKILL.md:62-88,125-135`).
codexclaw은 exact base/head anchor는 이미 요구하지만
(`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:399-406`, `REVIEW-INTERDIFF-01`)
리뷰 실행 시 worktree 격리 조건은 없다.

무조건 요구하면 과잉이다 — 지금 내가 작업 중인 branch를 검토할 때 worktree를 또 만드는 것은
낭비다. 실제로 필요한 경우는 하나다: **외부 PR/branch를 체크아웃하거나 그 branch에서
테스트·QA를 실행할 때** (현재 작업 트리 오염 방지).

## WP4 P 실측 (초안 앵커가 틀렸다)

초안은 "§5에 추가"라고 했고 `:381-388`을 before로 인용했다. 둘 다 틀렸다.

| 항목 | 초안 | 실측 (WP1~WP3 삽입 이후) |
| --- | --- | --- |
| §5 범위 | 삽입 대상 | `:303-316` — "Requesting Code Review", 리뷰 **요청**자 지침이다 |
| `REVIEW-INTERDIFF-01` | §5 안에 있다고 가정 | `:399` 독립 절 (§6 뒤) |
| before 인용 `:381-388` | anchor/interdiff 규칙 | 실제로는 `## Changed-File Coverage Ledger`(`:380`) 구역 |

§5는 리뷰를 **요청**하는 쪽 지침이고 이 규칙은 리뷰를 **수행**하는 쪽 규율이다.
따라서 `REVIEW-INTERDIFF-01`(`:399`) 절 바로 뒤에 붙인다 — 같은 재리뷰/앵커 주제다.

### 이미 있는 것 (중복 제거)

`REVIEW-INTERDIFF-01`(`:401-406`)이 이미 다음을 요구한다:

- 이전 리뷰 커밋/범위와 새 head **둘 다**를 앵커로 기록한다.
- 앵커가 없거나 히스토리가 모호하면 full review로 되돌린다.

초안이 추가하려던 "head가 바뀌면 이전 verdict를 재사용하지 않는다 / 앵커 없으면 full
review"는 **전부 여기 있다.** 그 부분은 삭제한다.

### 남는 순증분

**실행 격리** 하나다. 기존 규칙 어디에도 "외부 branch를 체크아웃하거나 그 branch에서
테스트를 돌릴 때 전용 worktree를 쓰라"는 조건이 없다. 오염 위험은 앵커 기록으로
해결되지 않는다 — 앵커는 무엇을 봤는지 기록할 뿐 현재 트리를 지키지 않는다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` | `REVIEW-INTERDIFF-01` 절(`:399-406`) 뒤에 문단 1개 삽입 |

## before → after

before: 리뷰 실행 시 작업 트리 격리에 대한 규정이 없다. `REVIEW-INTERDIFF-01`은
앵커 기록과 full-review fallback만 다룬다 (`:401-406`).

after: 아래를 그 절 뒤에 추가한다.

> **REVIEW-WORKTREE-01 (DEFAULT).** Never check out another review ref in the worktree you
> were handed. If the review target is already checked out in the worktree the dispatcher
> assigned, review it there; otherwise create or attach a dedicated named worktree and run
> the checkout, tests and QA in that one. Record `pwd -P` and the target `HEAD` alongside
> the anchors `REVIEW-INTERDIFF-01` already requires.
>
> The condition is observable state, not ownership: a reviewer — often a subagent — cannot
> know which branch the parent session "owns", but it can always see what is checked out
> where it stands.

## 테스트 (accept criteria)

| 항목 | 기대 | 검증 유형 |
| --- | --- | --- |
| `REVIEW-WORKTREE-01`이 `REVIEW-INTERDIFF-01` 절 뒤에 존재 | 요구 조건 + **면제 조건**(현재 task 소유 branch는 중복 생성 금지) 둘 다 명시 | **사람 리뷰** |
| 중복 제거 | head 변경 시 verdict 재사용 금지·앵커 없으면 full review는 재진술하지 않고 `REVIEW-INTERDIFF-01`을 참조 | **사람 리뷰** |
| 게이트 회귀 | exit 0 유지 (금지 문구 스캔만, 규칙 의미는 미관측) | **자동** — `npm run gate` |
| 스위트 회귀 | 1,224 pass 유지 (테스트 미변경) | **자동** — `npm test` |

### PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E7** (산문), `DEFAULT` 표기 |
| 실행 주체 | A 단계 리뷰어 (사람) |
| 알려진 우회 | 리뷰어가 worktree 없이 체크아웃해도 아무것도 막지 않는다 |
| 잔여 위험 | 현재 트리 오염이 자동으로 탐지되지 않는다 |
| 표현 강등 | "격리를 보장한다"가 아니라 "격리하라는 리뷰 규율" |
| 최종 강제층 | **none** |

### PLAN-FIELD-CHAIN-01

**N/A — 타입 필드나 열거값을 추가하지 않는다.**

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm run gate` — **실측**: exit 0 + WARN 7건. **대상 파일을 실제로 읽는다** —
  `plugins/codexclaw/scripts/gate.mjs:147-175`가 skills 트리의 모든 `SKILL.md`를 재귀로 훑는다.
  다만 검사하는 것은 좁은 false-enforcement 정규식 3개뿐이고 `REVIEW-WORKTREE-01`의
  의미는 보지 않는다. 관측 범위 = 금지 문구 스캔.
- `npm test` — **실측**: 1,224 pass / 0 fail. 역시 **대상을 읽는다** —
  `plugins/codexclaw/test/gate.test.mjs:18-20`이 live gate를 호출하기 때문이다.
  관측 범위는 위와 같다. 테스트를 건드리지 않으므로 개수가 유지돼야 한다.
- 규칙 문장의 존재와 내용: **어떤 자동 명령도 관측하지 않는다.** 사람 리뷰다.
- `npx tsc --noEmit`은 **적지 않는다** — root `tsconfig.json`이 없다.

## 범위 밖

- 고정 5-lane 리뷰 (REJECT, `002` #11).
- V2 archive 문구 (`063`의 몫 — 다른 파일, 다른 문제).
