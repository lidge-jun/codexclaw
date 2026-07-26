# 120 — doc-sync 테스트를 구조화 계약 비교로 재작성

출처: `060` WP2 A 감사 2라운드에서 이월 (리뷰어 "Meitner" 블로커 1·2) ·
의존: `060` (`TEST-PROMPT-SEAM-01`과 그 판정 기준이 먼저 존재해야 한다) ·
쓰기 범위: 테스트 2개 + 스킬 frontmatter/구조화 블록 · 상태: PLANNED

## 문제

두 테스트가 문서 동기화를 지킨다고 하면서 실제로는 **각 파일에 특정 문구가 있는지만**
검사한다. 소스 간 비교가 하나도 없다.

- `plugins/codexclaw/test/loop-activation-doc-sync.test.mjs:24-29`는 `loopSkill`에 6개
  정규식, `:31-34`는 `pabcdSkill`에 4개 정규식을 각각 적용한다. 두 값을 뽑아 비교하는
  구조(`assert.deepEqual(loopContract, pabcdContract)`)가 없다.
- `plugins/codexclaw/test/emergence-doc-sync.test.mjs:27-52`는 `plan070`, `loopSkill`,
  `devSkill`, `searchSkill`, `html` 다섯 소스에 독립 정규식을 적용한다. 직접 `assert.*`
  호출은 25곳이고 두 루프가 전개되면 실행 단정은 36회다.

`060`이 설치한 `TEST-PROMPT-SEAM-01` 기준으로 둘 다 위반이다. 다만 그 테스트가 지키려던
것(스킬 간 계약 동기화)은 실재하므로 삭제가 아니라 **재작성**이 답이다.

`060`에서 이월한 이유: 제대로 고치려면 스킬에 구조화된 계약 필드를 신설해야 하고,
그것은 테스트 규율 규칙 설치와 다른 작업이다.

## 변경 파일 맵

**A 감사 2라운드 정정:** 초안의 변경 파일 맵은 emergence 테스트가 실제로 읽는 5개 소스 중
3개를 빠뜨렸다. 실측 (`plugins/codexclaw/test/emergence-doc-sync.test.mjs:21-25`):
`loop/SKILL.md`, `dev/SKILL.md`, `search/SKILL.md`,
`devlog/_fin/260701_emergence_harness_impl/070_docs_sync_falsifiability.md`,
`devlog/_fin/260701_emergence_harness/emergence_gap.html`.

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/skills/loop/SKILL.md` | frontmatter `metadata.contract` 추가 (activation + collapse 양쪽 키) |
| `plugins/codexclaw/skills/pabcd/SKILL.md` | 동일 키의 `metadata.contract` 추가 |
| `plugins/codexclaw/test/loop-activation-doc-sync.test.mjs` | 두 계약 블록을 파싱해 `assert.deepEqual` 비교로 재작성 |
| `plugins/codexclaw/test/emergence-doc-sync.test.mjs` | 아래 §emergence 범위 결정에 따라 재작성 |
| `plugins/codexclaw/test/_helpers/frontmatter.mjs` | 신규 — frontmatter 파서 (이 슬라이스의 두 테스트 전용. `130`은 자동 계약을 포기해 파서를 쓰지 않는다) |

### emergence 범위 결정 (5소스 → 2소스)

5개 소스를 전부 구조화하는 것은 이 슬라이스 범위를 넘는다. 특히 두 개는
`devlog/_fin/` 아래 **종료된 유닛**이라 계약 필드를 새로 심는 것이 부적절하고,
`110` 아카이브 규칙과도 충돌한다.

| 소스 | 처리 | 근거 |
| --- | --- | --- |
| `plugins/codexclaw/skills/loop/SKILL.md` | 구조화 — `metadata.contract.collapse` | 살아있는 스킬 |
| `plugins/codexclaw/skills/pabcd/SKILL.md` | 구조화 — 동일 키 | 살아있는 스킬 |
| `plugins/codexclaw/skills/dev/SKILL.md` | **단정 제거 → human review** | collapse 계약의 소유자가 아니다 |
| `plugins/codexclaw/skills/search/SKILL.md` | **단정 제거 → human review** | 동일 |
| `_fin/.../070_docs_sync_falsifiability.md` | **단정 제거** | 종료 유닛. 역사 기록이지 살아있는 계약이 아니다 |
| `_fin/.../emergence_gap.html` | **단정 제거** | 동일. `data-contract` 주입 계획은 철회한다 |

**포기하는 보호를 명시한다:** doctrine 문서·visual HTML·`dev`/`search` 스킬이 collapse
모델을 서로 다르게 말해도 자동으로 잡히지 않는다 → human review 잔여 항목.
남는 자동 보호는 `loop`↔`pabcd` 두 스킬의 계약 일치뿐이다.

## before → after

### 계약 블록 형태

산문은 그대로 두고, 기계가 읽을 요약을 frontmatter `metadata`에 넣는다. 산문과 블록이
어긋나면 사람이 잡고, 블록끼리 어긋나면 테스트가 잡는다.

```yaml
metadata:
  contract:
    hotl-arming: ["active-host-goal", "in-flight-pabcd-cycle"]
    hitl-arming: ["pabcd-only"]
    goal-owner: "main-session"
    stop-arms-under: "hotl-only"
```

`loop/SKILL.md`와 `pabcd/SKILL.md`가 **같은 키에 같은 값**을 선언한다.

### 테스트 재작성

before (`loop-activation-doc-sync.test.mjs:24-34`): 소스별 정규식 10개.

after: 두 파일의 frontmatter를 파싱해 `metadata.contract`를 뽑고
`assert.deepEqual(loopContract, pabcdContract)` 한 번으로 비교한다. 한쪽만 바뀌면
깨지고, 깨진 상태는 두 스킬이 실제로 모순인 상태다.

`emergence-doc-sync`도 같은 2-소스 방식이다 — collapse point(`P`/`D`), divergence 진입 조건,
shipped lever 이름을 `loop`/`pabcd` 두 스킬의 `metadata.contract.collapse`에 선언하고
그 둘을 비교한다. **doctrine 문서·visual HTML·`dev`/`search` 단정은 삭제한다**
(위 §emergence 범위 결정). HTML `data-contract` 주입 계획은 철회했다 —
`devlog/_fin/` 아래 종료 유닛에 계약 필드를 심는 것은 `110` 아카이브 규칙과 충돌한다.

## WP5에서 이월된 항목 (2026-07-26)

`063`이 NOOP으로 닫히면서 실물 공백 하나가 여기로 넘어왔다: **`interrupt_agent`가
현재 턴만 멈추고 에이전트를 재사용 가능한 상태로 남긴다는 사실이 어느 문서에도 없다.**
리뷰어가 `codex-cli 0.144.5` 런타임에서 직접 확인했다.

`metadata.contract` 블록을 만들 때 이 값을 함께 선언한다:

```yaml
metadata:
  contract:
    v2-interrupt-semantics: "stops-current-turn-only"   # 에이전트는 재사용 가능
    v2-has-close: false                                  # close_agent/resume_agent는 V1 전용
```

`loop`↔`pabcd` 비교 대상에 이 두 키를 포함한다.

## PLAN-FIELD-CHAIN-01

`metadata.contract`는 새 필드이므로 사슬을 적는다.

| 단계 | 경로 또는 N/A |
| --- | --- |
| 생성 | 사람이 SKILL.md frontmatter에 직접 작성 (빌더 없음) |
| 직렬화 | N/A — YAML frontmatter가 곧 저장 형태다 |
| 역직렬화 | 테스트의 frontmatter 파서 (신규 헬퍼). 런타임은 이 필드를 읽지 않는다 |
| 소비 | `loop-activation-doc-sync.test.mjs`, `emergence-doc-sync.test.mjs` 두 곳뿐 |

**주의:** 런타임이 이 필드를 소비하지 않는다는 사실을 명시한다. 이것은 테스트 전용
계약이고, 그 한계를 숨기면 `PLAN-VERIFIER-REAL-01` 위반이다.

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E8** (테스트가 실패로 막는다) |
| 실행 주체 | `npm test` |
| 알려진 우회 | 두 파일의 `metadata.contract`를 같이 잘못 바꾸면 통과한다. 산문과 블록이 어긋나도 테스트는 모른다 |
| 잔여 위험 | 블록이 산문의 요약일 뿐이므로, 산문만 바뀌는 drift는 사람 리뷰에 남는다 |
| 표현 강등 | "문서 동기화를 보장한다"고 쓰지 않는다 — "선언된 계약 블록의 일치를 보장한다" |
| 최종 강제층 | `npm test` (블록 일치에 한해) |

## 테스트 (accept criteria)

| 항목 | 기대 | 검증 유형 |
| --- | --- | --- |
| 두 스킬에 동일 키의 `metadata.contract` 존재 | 파싱 성공 | 자동 |
| 재작성된 테스트가 두 계약을 비교 | `assert.deepEqual` 1회로 대체, 개별 정규식 0개 | 자동 |
| 한쪽 계약값 변경 | 테스트 RED (mutation 확인 후 복원) | 자동 (mutation) |
| 양쪽 동일 변경 | 통과 — 우회 가능성을 인정하는 확인 | 자동 |
| emergence 2-소스 비교 | `loop`↔`pabcd`의 `metadata.contract.collapse` 일치 | 자동 |
| 삭제된 4소스 단정 | `dev`/`search`/doctrine/HTML 단정이 전부 사라진다 | 자동 (rg 검사) |
| 포기한 보호 기록 | 그 4소스의 collapse 정합은 human review임을 문서에 명시 | **사람 리뷰** |
| 산문 정규식 잔존 0건 | 두 파일에서 `assert.match(<source>, /산문/)` 형태 제거 | 자동 (rg 검사) |
| 전체 스위트 | 실패 0 | 자동 — `npm test` |
| 산문과 블록의 의미 일치 | 사람이 읽어 확인 | **사람 리뷰** — 어떤 명령도 관측하지 않는다 |

검증 명령 (PLAN-VERIFIER-REAL-01 — 현재 baseline과 구현 후 기대를 분리한다):

- `npm test` — **현재 baseline 실측** (2026-07-26): exit 0, 1,224 pass / 0 fail.
  **구현 후 기대**: exit 0, 단정 수는 교체로 감소, 실패 0.
  관측 근거: `package.json:24`의 glob `plugins/codexclaw/test/*.test.mjs`가 두 파일을 포함한다.
- `rg -c 'assert\.(match|doesNotMatch)' plugins/codexclaw/test/loop-activation-doc-sync.test.mjs plugins/codexclaw/test/emergence-doc-sync.test.mjs`
  — **현재 baseline 실측**: `loop-activation-doc-sync` 10건, `emergence-doc-sync` 24건.
  **구현 후 기대**: 두 파일 모두 0건.
- `npx tsc --noEmit`은 **적지 않는다** — root `tsconfig.json`이 없어 아무것도 검사하지 않는다.
- 산문과 계약 블록의 의미 일치: **어떤 자동 명령도 관측하지 않는다.** 사람 리뷰다.

## 범위 밖

- 런타임이 `metadata.contract`를 소비하게 만드는 것 (별건).
- 다른 스킬로 계약 블록 확산.
- 산문 자체의 재작성.
