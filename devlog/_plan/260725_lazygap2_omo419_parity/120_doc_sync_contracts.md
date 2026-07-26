# 120 — 산문 전용 doc-sync 검사 제거 (HTML 구조 검사는 보존)

출처: `060` WP2 A 감사 2라운드에서 이월 (리뷰어 "Meitner" 블로커 1·2) ·
의존: `060` (`TEST-PROMPT-SEAM-01`과 그 판정 기준이 먼저 존재해야 한다) ·
쓰기 범위: 테스트 파일 2개 삭제/분리 + `dev-testing/SKILL.md` 기록 · 상태: PLANNED

> **A 감사 3~5라운드에서 방향이 두 번 바뀌었다.** 초안은 "구조화 계약 비교로 재작성"이었고
> 그 다음은 "코드 동작 검사로 승격"이었다. 둘 다 리뷰어가 반박했고 근거가 맞았다 —
> 전자는 런타임이 읽지 않는 제3의 진실원천을 만들고, 후자는 이미 있는 테스트를
> 복제할 뿐이었다. 최종 형태는 **산문 단정을 제거하고 구조 검사만 남기는 것**이다.
> 아래 세 라운드 절에 판단 근거를 그대로 남긴다.

## 문제

두 테스트가 문서 동기화를 지킨다고 하면서 실제로는 **각 파일에 특정 문구가 있는지만**
검사한다. 소스 간 비교가 하나도 없다.

- `plugins/codexclaw/test/loop-activation-doc-sync.test.mjs:24-34`는 `loopSkill`에 6개,
  `pabcdSkill`에 4개 정규식을 각각 적용한다. 두 값을 뽑아 비교하는 구조가 없다.
- `plugins/codexclaw/test/emergence-doc-sync.test.mjs:27-52`는 다섯 소스에 독립 정규식을
  적용한다. 같은 파일의 `:55-67`은 **성격이 다르다** — 태그 개수를 비교하는 구조 검사다
  (A 감사 5라운드).

`060`이 설치한 `TEST-PROMPT-SEAM-01` 기준으로 산문 단정 34건은 위반이다.
그 단정들이 지키려던 것(스킬 간 doctrine 정합)은 실재하지만, **비교할 코드 관측점이
없으므로 자동 검사로 승격할 수 없다.** 승격 불가를 인정하고 제거한 뒤 human review로
내리는 것이 정직하다 — 가짜 comparator를 만드는 것보다 낫다.

## A 감사 3라운드 — 설계 전환 (리뷰어 "Newton")

리뷰어가 초안의 방향을 뒤집었고 그 판정이 맞다: **`metadata.contract`는 보호를 늘리는
것이 아니라 줄인다.** 5개 실제 표면을 읽던 24개 단정을, 서로를 베낀 두 블록의 동일성
검사로 바꾸는 것이기 때문이다. 런타임은 그 필드를 읽지 않으므로
(`spawn-attach-hook.ts:505`가 frontmatter에서 읽는 것은 `name`/`description`뿐),
새로운 제3의 진실원천만 하나 더 생긴다 — 이 유닛이 없애려는 false-enforcement와
같은 종류다.

**`metadata.contract`를 만들지 않는다.** frontmatter 파서도, V2 lifecycle 키도 함께
철회한다 (파서가 없으므로 Low 지적도 소멸한다).

### A 감사 4라운드 — 신규 activation 테스트도 철회한다

3라운드에서 "산문 검사를 코드 동작 검사로 승격한다"고 했는데, 리뷰어가 그 다섯 조합이
**이미 전부 존재함**을 줄 번호로 입증했다 (`hook-continuation.test.ts`):

| 조합 | 기존 테스트 |
| --- | --- |
| goal active + in-flight | `:272` L6 blocks mid-cycle under an active goal |
| goal active + IDLE | `:354` GOAL-IDLE-CONTINUE-01 |
| goal inactive + in-flight | `:420` guard 2b — no active goal releases |
| goal inactive + IDLE | `:341` guard 2a |
| phase `I` | `:430` L17 firewall |

같은 것을 다른 파일에 한 벌 더 쓰는 것은 보호가 아니라 중복이다. 그리고 그 중복으로
"24개를 지웠지만 5개를 더했다"고 적으면 **삭제를 상쇄한 것처럼 보이게 만드는 회계**가
된다 — 이 유닛이 없애려는 종류의 거짓말이다.

**따라서 `loop-activation-doc-sync.test.mjs`도 삭제한다.** activation 런타임 계약의
단일 소유자는 `hook-continuation.test.ts`이고, 그 사실을 명시한다.

**이 슬라이스는 산문 검사 삭제 + 구조 검사 이동이다.** 정직한 요약은 이렇다:

- 런타임 보호: **변화 없음** (기존 커버리지가 그대로 소유)
- 자동 semantic 문서 보호: **34개 단정 → 0** (10 + 24), E7 human review로 내려간다
- 자동 구조 보호(HTML 태그 균형): **유지** (파일만 옮긴다)
- 얻는 것: `TEST-PROMPT-SEAM-01` 위반 34건 제거, 그리고 "문서 동기화가 지켜진다"는
  거짓 신호의 제거

거짓 초록을 지우는 것은 그 자체로 가치가 있다 — 하지만 **보호가 늘었다고 적지 않는다.**

### A 감사 5라운드 — emergence는 통째로 지우지 않는다

리뷰어가 내가 놓친 것을 잡았다. `emergence-doc-sync.test.mjs`는 테스트가 **둘**이고
성격이 다르다:

| 테스트 | 성격 | 처리 |
| --- | --- | --- |
| `:20` "docs, HTML, and skills preserve the collapse-point doctrine" | 5소스 산문 단정 | **삭제** — `TEST-PROMPT-SEAM-01` 위반 |
| `:55` "HTML keeps the expected section and tag balance" | **태그 open/close 개수 비교** | **보존** — 위반이 아니다 |

`:61-66`은 각 태그의 여는 개수와 닫는 개수를 세어 `assert.equal(open, close)`로 비교한다.
이것은 한 소스에서 문구를 찾는 것이 아니라 **값 대 값 비교**이고, 잡는 것도
"문서가 무슨 말을 하는가"가 아니라 **잘린 닫는 태그 같은 구조 손상**이다.
`TEST-PROMPT-SEAM-01`이 금지하는 대상이 아니다(`dev-testing/SKILL.md:410-418`).

**그래서 파일을 분리한다:**

- doctrine 테스트(`:20-52`) → 삭제
- tag-balance 테스트(`:55-67`) → `emergence-html-structure.test.mjs`로 이동
- 단 그 안의 section-label 단정(`:57-59`, `<span class="n">07</span>` 존재 검사)은
  산문성 존재 검사이므로 **함께 제거**한다. 남기는 것은 태그 균형 루프뿐이다.

정직한 회계를 다시 고친다:

- 런타임 보호: 변화 없음
- 자동 **semantic** 문서 보호: 34 → 0 (감소)
- 자동 **구조** 보호(HTML 태그 균형): **유지**

`search/SKILL.md:25`의 divergence provenance는 여전히 자동 검사를 잃는다 —
코드와 비교할 방법이 생기면 되살린다.

**`_fin` 충돌 주장은 철회한다.** 리뷰어 확인대로 `110`은 이동 시 내용 보존만 말하고
`_fin` 편집을 금지하지 않는다(`110_devlog_archive.md:35`). tag-balance 테스트가
`_fin` 아래 HTML을 계속 읽는 것도 그래서 문제가 없다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/test/loop-activation-doc-sync.test.mjs` | **삭제** — 10개 단정 전부 산문 검사이고, 그 계약의 런타임 검증은 `hook-continuation.test.ts`가 이미 소유한다 |
| `plugins/codexclaw/test/emergence-doc-sync.test.mjs` | **삭제** — doctrine 테스트(`:20-52`)는 산문 검사이고 대응 런타임 관측점이 없다 |
| `plugins/codexclaw/test/emergence-html-structure.test.mjs` | **신규** — 기존 tag-balance 검사(`:55-67`)를 옮긴다. section-label 존재 검사는 제거하고 태그 균형 루프만 남긴다 |
| `plugins/codexclaw/skills/dev-testing/SKILL.md` | 두 삭제의 근거와 human-review 잔여 항목 기록 |

**스킬 frontmatter는 건드리지 않는다.** `metadata.contract`, frontmatter 파서,
V2 lifecycle 키 전부 철회했다.

## WP5에서 이월된 항목 — 되돌려 보낸다 (A 감사 3라운드)

`063`이 NOOP으로 닫히면서 "`interrupt_agent`가 현재 턴만 멈춘다는 사실이 어느 문서에도
없다"가 여기로 넘어왔다. **그 전제가 틀렸다** — 리뷰어가 확인했듯 V2 재사용성,
V1 전용 `close`/`resume`, V2 전용 `interrupt`는 이미 구조 문서에 있다
(`structure/20_pabcd_dispatch_doctrine.md:127`, `structure/60_native_capabilities.md:30`).

게다가 그 항목은 이 슬라이스의 activation/collapse 주제와 무관하다. `loop`/`pabcd`
frontmatter에만 값을 넣으면 실제 owner 문서와 연결되지 않은 또 하나의 false contract가
된다. **이 슬라이스에서 제거한다.** 보강이 필요하다면 구조 문서를 owner로 하는 별도
조각이고, 그때는 "현재 턴만 중단"의 직접 런타임 근거를 함께 대야 한다.

## PLAN-FIELD-CHAIN-01

**신규 필드 없음.** `metadata.contract`를 철회했으므로 사슬을 적을 대상이 없다.
이 슬라이스는 산문 단정 34건을 지우고, 구조 검사 하나를 별도 파일로 옮긴다.

## PLAN-BYPASS-NAMED-01

두 갈래로 나눠 적는다 — 하나는 강제층을 없애고, 하나는 그대로 유지하기 때문이다
(A 감사 6라운드).

**(가) semantic doc-sync 계약 — 없앤다**

| 필드 | 값 |
| --- | --- |
| tier | **없음** — 이 슬라이스가 거짓 강제층을 제거한다 |
| 실행 주체 | N/A |
| 알려진 우회 | N/A — 막는 것이 없다 |
| 잔여 위험 | 삭제한 34개 단정이 지키려던 doctrine **정합**(collapse point, `search`의 divergence provenance, HTML 산문 설명, archived SOT)은 이제 자동 검사가 없다. 사람 리뷰에만 남는다 |
| 표현 강등 | "문서 동기화를 개선한다"가 **아니다**. **"아무것도 증명하지 못하던 34개 단정과 그것이 주던 거짓 초록을 제거한다"** |
| 최종 강제층 | 없음 (`final layer: none`) |

**(나) HTML 태그 균형 — 그대로 유지한다**

| 필드 | 값 |
| --- | --- |
| tier | **E8** — `npm test`가 실패로 막는다 (기존과 동일, 파일만 옮긴다) |
| 실행 주체 | `npm test` (`package.json:24` glob이 신규 파일도 포함한다) |
| 알려진 우회 | 태그를 여는 쪽과 닫는 쪽을 **같이** 지우면 개수가 맞아 통과한다. 개수 비교이지 중첩 구조 파싱이 아니다 |
| 잔여 위험 | 잘못된 중첩(`<div><p></div></p>`)은 개수가 맞아 잡히지 않는다 |
| 표현 강등 | "HTML이 유효하다"가 아니라 **"열고 닫는 태그 개수가 일치한다"** |
| 최종 강제층 | `npm test` (개수 일치에 한해) |

**"순수 삭제"라는 표현은 철회한다.** 정확히는 **산문 검사 삭제 + 구조 검사 이동**이다.

## 테스트 (accept criteria)

| # | 항목 | 기대 | 검증 유형 |
| --- | --- | --- | --- |
| A1 | `loop-activation-doc-sync.test.mjs` 부재 | 파일 없음 | 자동 |
| A2 | `emergence-doc-sync.test.mjs` 부재 | 파일 없음 | 자동 |
| A2b | `emergence-html-structure.test.mjs` 존재 + 통과 | 태그 균형 검사가 살아 있다 | 자동 |
| A2c | **in-memory mutation** — 읽어들인 HTML 문자열에서 `</tbody>` 하나를 지운 사본으로 같은 균형 검사를 돌린다 | `assert.throws` — 구조 보호가 실제로 작동한다. **작업 트리의 파일은 건드리지 않는다** | 자동 (테스트 내부 fixture) |
| A3 | activation 런타임 커버리지 유지 | `hook-continuation.test.ts`의 다섯 케이스(`:272`, `:341`, `:354`, `:420`, `:430`)가 **무수정 통과** | 자동 |
| A4 | 삭제 근거 기록 | `dev-testing/SKILL.md`에 무엇을·왜 지웠는지와 human-review 잔여가 적혀 있다 | **사람 리뷰** |
| A5 | 전체 스위트 | 실패 0, 총 개수는 삭제분만큼 감소 | 자동 — `npm test` |
| A6 | gate | exit 0 유지 — 추가 산문이 forbidden-claim 스캔에 걸리지 않는다 | 자동 |

**A5의 감소를 상쇄로 포장하지 않는다.** 정확한 회계는 이렇다:

- 런타임 보호: **변화 없음**
- 자동 **semantic** 문서 보호: 34 → 0 (**감소**, E7 human review로)
- 자동 **구조** 보호(HTML 태그 균형): **유지**

D 요약에 이 세 줄을 그대로 적는다.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — **baseline 실측 (WP16 P)**: exit 0, **1,406 pass**.
  구현 후 기대: exit 0, 실패 0, 총 개수 감소.
- `test ! -e plugins/codexclaw/test/loop-activation-doc-sync.test.mjs && test ! -e plugins/codexclaw/test/emergence-doc-sync.test.mjs && test -e plugins/codexclaw/test/emergence-html-structure.test.mjs`
  — 삭제 둘과 신규 하나를 함께 확인. `ls`는 쓰지 않는다 (성공 상태가 non-zero라 판정이 뒤집힌다).
- `node --test plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts`
  — A3. 이 파일을 건드리지 않았으므로 통과가 곧 커버리지 유지 증거다.
- `npm run gate` — **이 슬라이스를 부분적으로 관측한다.** `walkSkillMds`가 모든
  `SKILL.md`를 순회하므로(`gate.mjs:147`) `dev-testing/SKILL.md`에 추가하는 문구는
  **forbidden-claim 스캔 대상**이다. 다만 삭제 근거의 의미가 옳은지는 관측하지 않는다.
  현재 exit 0 / WARN 0.
- `npx tsc --noEmit`은 적지 않는다 — root `tsconfig.json`이 없고 대상이 `.mjs`다.

## 범위 밖

- 런타임이 `metadata.contract`를 소비하게 만드는 것 (별건).
- 다른 스킬로 계약 블록 확산.
- 산문 자체의 재작성.
