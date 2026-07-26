# 110 — 완료 devlog 유닛 `_fin/` 아카이브

출처: D 단계 규칙 (`plugins/codexclaw/skills/pabcd/SKILL.md:190` — "D archives to `_fin/`") ·
의존: `010`-`130` 전부 (선행 17 work-phase, 마지막에 실행) · 상태: PLANNED

## 왜 별도 슬라이스인가

아카이브는 각 사이클의 D가 자기 문서만 옮기는 게 아니라, **유닛 전체가 닫힌 뒤 한 번**
수행하는 작업이다. 이 유닛은 `000`-`002`/`009` 리서치와 `010`-`130` 구현 문서가 한 디렉터리에
있으므로, 개별 사이클이 부분 이동하면 남은 문서의 상대 인용이 깨진다.

WP1 감사에서 이 슬라이스가 로드맵에 등록되지 않은 것이 블로커로 지적돼 등록했다.
WP2 감사에서 `120`/`130`이 이월 등록되며 총 work-phase가 18개가 됐고, 이 슬라이스는
`wp18-fin`으로 마지막에 실행된다 (선행 17개).

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `devlog/_plan/260725_lazygap2_omo419_parity/` → `devlog/_fin/260725_lazygap2_omo419_parity/` | 디렉터리 이동 (`git mv`) — **이 유닛 하나만** |

**write scope는 이 유닛 하나로 고정한다 (2라운드 감사 블로커 6).** 초안은
"그 외 완료 판정된 `devlog/_plan/*` 유닛"을 wildcard로 포함했는데, 그러면
이 루프와 무관한 사용자 작업(현재 트리에 untracked로 존재하는
`devlog/_plan/260722_260722-repo-governance-config/`)까지 후보가 된다.
다른 유닛을 아카이브하려면 **그 유닛마다** 정확한 경로·소유권·완료 산출물·미해결 0건
증거를 P에서 먼저 등록한다. 이 슬라이스는 그 절차를 정의만 하고 실행하지 않는다.

## before → after

before: `devlog/_plan/260725_lazygap2_omo419_parity/` 아래 문서 22개
(`000`, `001`, `002`, `009`, `010`, `020`, `030`, `040`, `050`, `060`, `061`, `062`,
`063`, `064`, `070`, `080`, `090`, `091`, `100`, `110`, `120`, `130`)가 진행 중 유닛으로 존재한다.

after: 같은 파일들이 `devlog/_fin/260725_lazygap2_omo419_parity/` 아래에 rename으로
이동하고, `_plan` 경로는 존재하지 않는다. 파일 내용은 바뀌지 않는다 —
단 다른 문서가 이 유닛을 `devlog/_plan/...`로 인용하고 있으면 그 인용만 `_fin`으로 고친다.

## 절차

### 1. 완료 판정 — **A 감사 4라운드에서 대체됨 — 실행 조건은 §A6**

> 아래 원래 조건("선행 17개 전부 `done`, `c-fin` 외 criteria 전부 `met`")은
> **더 이상 실행 조건이 아니다.** `done`이 자동 전이된 필드라 완료를 증명하지 못한다는
> 것이 A 감사 4라운드에서 드러났고, `050`이 `blocked`로 정정되면서 전제 자체가 깨졌다.
> 실행 조건은 아래 §A6 하나뿐이다 (A5도 WP19에서 대체됐다). 이 절은 판단 이력으로만 남긴다.

`git log`에 커밋이 있다는 사실은 완료 증거가 **아니다** (2라운드 감사 블로커 6).
초안이 쓰던 `cxc loop show`는 인자 없이 실행하면 exit 1이고
(`goalplan-cli.ts:127-130`), `renderPlan`(`:81-93`)은 미충족 criteria **개수**만 내고
`capturedEvidence` 값은 보여주지 않는다.

### 2. git 추적 주의

`devlog/`는 `.gitignore:8`에서 `devlog/.lazycodex/`만 제외하고 나머지는 추적된다
(확인: `git check-ignore -v devlog/_plan/...`이 NOT IGNORED). 따라서 일반 `git mv`가 동작한다.
단 벤더 클론 `devlog/.lazycodex/`는 ignore 대상이므로 **아카이브에 포함하지 않는다.**

### 3. 이동과 인용 정정

`git mv devlog/_plan/<unit> devlog/_fin/<unit>` 후, 다른 문서가 그 유닛을
`devlog/_plan/<unit>`으로 인용하고 있으면 `devlog/_fin/<unit>`으로 갱신한다
(`rg -l 'devlog/_plan/<unit>'`로 전수 조사).

### 4. gate는 이 변경을 관측하지 않는다 (정직한 기술)

`plugins/codexclaw/scripts/gate.mjs:35-40`의 `_plan`→`_fin` 폴백은 **`mvp_hard` 유닛
전용**이다 (`:36`이 `join("devlog","_plan","mvp_hard")`). lazygap2 유닛에는
status-sync 검사가 걸리지 않는다.

따라서 `npm run gate` exit 0은 **이 아카이브가 올바르게 됐다는 증거가 아니다** —
기존 게이트가 깨지지 않았다는 회귀 확인일 뿐이다. 초안은 "게이트가 이 변경을 관측한다"고
적었는데, 그것이 바로 `PLAN-VERIFIER-REAL-01`이 금지하는 거짓 검증기 주장이다
(2라운드 감사 블로커 2). 아카이브 자체의 검증기는 아래 테스트 표의 경로 검사다.

## 테스트 (accept criteria)

| 항목 | 기대 | 검증 |
| --- | --- | --- |
| 완료 유닛 식별표가 근거와 함께 존재 | 각 유닛에 판정 + 근거 | 사람 리뷰 |
| 이 유닛이 `_fin/`으로 이동 | `devlog/_fin/260725_lazygap2_omo419_parity/` 존재 | `ls` |
| `devlog/.lazycodex/`는 이동 안 됨 | `_plan`/`_fin` 어디에도 없음 | `ls` |
| 이동한 유닛을 가리키는 인용 갱신 | `rg 'devlog/_plan/260725_lazygap2'` 결과 0건 | `rg` |
| gate 통과 | exit 0 | `npm run gate` |
| 테스트 통과 | exit 0 | `npm test` |
| 커밋에 rename으로 기록 | **12개는 rename, 10개는 add** (`git ls-files` 실측 — A 감사 4라운드) | `git log --stat` |
| `100`의 내부 인용 갱신 | `100_plan_rule_hardening.md`의 `000`/`009` 인용이 `_fin` 경로 | `rg` |

검증 명령:

- `npm run gate` — **실행 확인됨**, exit 0. 단 **이 변경을 관측하지 못한다** —
  기존 게이트 회귀 확인 용도로만 분류한다 (위 §4).
- `npm test` — **baseline 실측 (WP18 P, 2026-07-26)**: exit 0, **1,405 pass** / 0 fail.
  (초안의 1,224는 WP1 시점 값이다.)

## A 감사 4라운드 — 아카이브 조건을 다시 쓴다 (리뷰어 "Faraday")

P에서 `jq -e` 두 검사를 돌려 `true`를 받았지만, 리뷰어가 **그 검사가 완료를 증명하지
못한다**는 것을 세 갈래로 입증했다. 셋 다 실측으로 확인했다.

### (가) `done`은 자동 전이된 필드다 — pending task 42건

`advanceWorkPhase`(`goalplan.ts:757`)는 D-close 때 criteria나 task 상태와 **무관하게**
현재 phase를 `done`으로 바꾼다. `validateGoalplan`도 task를 보지 않는다(`:493`).
즉 "17개 전부 done"은 작업이 끝났다는 증거가 아니라 전이가 일어났다는 기록일 뿐이다.

실측: `done`인 work-phase 11개에 pending task **42건**이 남아 있었다.

**조치.** 실제로 구현된 10개 슬라이스(`080`, `020`, `010`, `030`, `040`, `070`, `090`,
`091`, `120`, `130`)의 task 35건을 `done`으로 닫았다 — 각 슬라이스의 커밋과 테스트
증거가 criteria에 기록돼 있고 task 제목이 그 작업과 일대일로 대응한다.
`050`의 4건은 **그대로 pending으로 둔다.** 아무것도 구현하지 않았기 때문이다.

### (나) `050`을 `done`으로 세는 것은 정직하지 않다

`050`은 5라운드 감사가 수렴하지 않아 **구현하지 않고 닫았다**(종료 조건 D2).
그런데 goalplan에는 `wp8-050: done` + `c-050: met`으로 기록돼 있었다 —
"선행 17개 완료"라는 문장이 그 미구현을 덮고 있었다.

**조치.** `wp8-050`을 **`blocked`**로 바꾸고 `blockedReason`에 defer 사유와 두 미해결
반례를 적었다. `c-050`은 `open`으로 되돌리고 증거를 비웠다.

이 상태는 **이 유닛이 WP15에서 직접 추가한 것**이다(`091`). 마침 그것이 필요한 첫
사례가 자기 자신이 됐다 — `blocked`는 "잔여 작업으로 집계되어 goal 완료를 막는다"는
의미이고, 정확히 지금 상황이다.

### (다) 22개 rename은 성립하지 않는다 — 12 tracked / 10 untracked

계획은 22개 파일 전부가 rename으로 기록되길 요구했다. 실측하면 `git ls-files`가
**12개**만 반환한다. 나머지 10개는 각 사이클에서 `git add -f`로 커밋한 문서 외의
것들로 아직 untracked다. `git check-ignore`가 NOT IGNORED인 것은 **ignore 여부**만
말하지 추적 여부를 말하지 않는다 — 계획이 그 둘을 혼동했다.

**조치.** 수용 조건을 **"12 rename + 10 add"**로 고친다. 10개를 먼저 `_plan` 경로로
커밋해 rename을 만드는 방법도 있지만, 그러면 곧 지울 경로에 커밋을 하나 더 남기는
것이라 이력이 더 지저분해진다.

### 아카이브 조건 (다시 쓴 것)

```bash
SLUG=codexclaw-lazygap2-15-pabcd-devlog-fin-100-060-0
PLAN=.codexclaw/goalplans/$SLUG/goalplan.json

# (1) 모든 work-phase가 terminal disposition에 있다 (done 또는 blocked)
#     — blocked는 "정직하게 미완"이고, 그 사유가 기록돼 있어야 한다
jq -e '[.workPhases[] | select(.id != "wp18-fin")]
       | all(.status == "done" or (.status == "blocked" and (.blockedReason // "" | length) > 0))' "$PLAN"

# (2) 모든 task가 terminal이다 (done), 단 blocked phase의 task는 제외
jq -e '[.workPhases[] | select(.id != "wp18-fin" and .status != "blocked") | .tasks[]]
       | all(.status == "done")' "$PLAN"

# (3) done phase에 대응하는 criteria가 met + 증거를 갖는다
#     blocked phase의 criterion은 open으로 남아 있어야 한다 (met이면 거짓말이다)
jq -e '[.criteria[] | select(.id != "c-fin" and .id != "c-050")]
       | all(.status == "met" and (.capturedEvidence // "" | length) > 0)' "$PLAN"
jq -e '[.criteria[] | select(.id == "c-050")] | all(.status == "open")' "$PLAN"

# (4) 트리 상태
npm test && npm run gate
```

## A 감사 5라운드 — **대체됨 (WP19에서 블로커가 제거됨)**

> **이 절 전체는 더 이상 실행 조건이 아니다.** 아래 판단은 `050`이 blocked였을 때
> 옳았고, 그 결론은 "구현하거나, 범위에서 빼거나, 새 아카이브 상태를 정의하라"였다.
> **1번을 택했다** — `050`을 구현했다(커밋 `01b66af6`). blocked가 사라졌으므로
> 이 절이 막던 이유도 사라졌다. 실행 조건은 아래 §A6이다.
>
> 판단 이력으로 남긴다: 규약을 지키지 못했을 때 규약의 뜻을 바꾸는 대신
> **막고 있던 것을 실제로 해결하는 쪽**을 택했다는 기록이다.

### (당시 판단) 아카이브를 실행하지 않는다

4라운드에서 나는 "아카이브는 작업이 끝났다가 아니라 더 할 일이 없다는 판정"이라고
적었다. 리뷰어가 그 재정의를 반박했고 근거가 맞다.

**`blocked`는 SoT에서 "완료"가 아니다.**

| 근거 | 위치 |
| --- | --- |
| `blocked`는 "not done", goal을 열어둔다 | `goalplan.ts:40` (이 유닛이 WP15에서 직접 쓴 정의) |
| `remainingWorkPhases`가 `blocked`를 잔여로 집계한다 | `goalplan.ts:493` |
| D는 work-phase에 pending work가 없어야 닫힌다 | `pabcd/SKILL.md:188` |
| `_fin`은 완료 유닛 아카이브다 | 현재 67개 유닛이 그 규약으로 쌓여 있다 |

`cxc loop validate`는 실제로 이 계획을 거부한다. 그런데도 `_fin`으로 옮기면
**이 유닛 하나 때문에 `_fin`의 의미를 바꾸는 것**이고, 그건 정확히 이 유닛이
17개 슬라이스에 걸쳐 없애온 false-enforcement다 — 규약을 지키지 못했을 때
규약의 뜻을 바꿔 통과하는 행위.

**(당시) 판정: `wp18-fin`을 BLOCKED로 닫는다.** — WP19에서 뒤집혔다.

### 무엇이 아카이브를 막고 있나

`050`(진전 인식 Stop) 하나다. 5라운드 감사가 수렴하지 않아 구현 없이 defer했고,
재개하려면 두 반례를 회귀 테스트로 먼저 넣어야 한다(`050_progress_aware_stop.md:34`).
"재개 계획이 없다"는 것이 "미완료 작업이 사라졌다"는 뜻은 아니다.

### 아카이브하려면 셋 중 하나

1. **`050`을 구현한다.** 그러면 `wp8-050`이 `done`이 되고 조건이 그대로 성립한다.
2. **`050`을 이 유닛의 범위에서 빼기로 결정한다.** 그건 목표 축소이므로
   사용자 판단이 필요하다 — 에이전트가 스스로 할 수 없다.
3. **`_deferred`/`_blocked` 아카이브 상태를 별도 규약으로 정의한다.** `_fin`의 뜻을
   건드리지 않고 "닫혔지만 미완"을 표현하는 자리를 만드는 것이고,
   67개 유닛이 쌓인 규약에 새 상태를 더하는 일이라 그 자체로 별도 슬라이스다.

**어느 것도 이 사이클 안에서 임의로 정할 수 없다.** 셋 다 사용자 결정이거나
별도 작업이므로 여기서 멈춘다.

### 이 사이클이 남기는 것

- `wp8-050`이 `blocked` + `blockedReason`으로 정직하게 기록됐다 (4라운드 산출)
- pending task 42건 중 실제 완료된 35건이 닫히고, `050`의 4건은 남았다
- 아카이브 조건이 "자동 전이된 `done`"이 아니라 task/criteria terminal disposition을
  보도록 다시 쓰였다
- 무엇이 막고 있고 어떻게 풀 수 있는지가 위 세 선택지로 기록됐다

아래 조건들은 그 재개 시점에 그대로 쓸 수 있다.

## §A6 — 실행 조건 (WP19, 유일한 predicate)

`050`이 shipped되어 blocked가 하나도 없다. 조건이 단순해졌다.

```bash
SLUG=codexclaw-lazygap2-15-pabcd-devlog-fin-100-060-0
PLAN=.codexclaw/goalplans/$SLUG/goalplan.json

# (1) 모든 work-phase가 done — 예외 없음
jq -e '[.workPhases[] | select(.id != "wp18-fin")] | all(.status == "done")' "$PLAN"

# (2) 모든 task가 done — "done은 자동 전이된 필드"라는 A4 지적의 답
jq -e '[.workPhases[] | select(.id != "wp18-fin") | .tasks[]] | all(.status == "done")' "$PLAN"

# (3) 모든 criterion이 met + 증거
jq -e '[.criteria[] | select(.id != "c-fin")]
       | all(.status == "met" and (.capturedEvidence // "" | length) > 0)' "$PLAN"

# (4) 트리 상태
npm test && npm run gate
```

**WP19 실측: 넷 다 exit 0** (`ALL_DONE_OK` / `ALL_TASKS_OK` / `ALL_CRITERIA_OK`,
`npm test` 1,418 pass, `npm run gate` exit 0 / WARN 0).

A4가 지적한 self-certification 문제는 (2)가 답한다 — `done`만 보면 자동 전이를
읽지만, task까지 보면 실제로 수행된 작업을 읽는다.

### 이동 절차

1. `git mv devlog/_plan/260725_lazygap2_omo419_parity devlog/_fin/`
   — tracked 12개는 rename, untracked 10개는 add로 기록된다 (A4 실측).
2. `100_plan_rule_hardening.md`의 `000`/`009` live citation을 `_fin` 경로로 갱신.
3. 검증: `_fin` 존재, `_plan` 부재, old-path `rg`가 allowlist 3개
   (`000_plan.md`, `009_reinforcement_roadmap.md`, `110_devlog_archive.md`) 외 0건.

### 그 밖의 실측

| 검사 | 결과 |
| --- | --- |
| 이 유닛을 `devlog/_plan/...`로 인용하는 **외부** 문서 | **0건** |
| 유닛 **내부** live citation | `100_plan_rule_hardening.md:130`이 `000`/`009`를 `_plan` 경로로 인용 — **이동 시 함께 고친다** |
| 아카이브 이력 서술의 old path | `110`뿐 아니라 **`000_plan.md:28`과 `009_reinforcement_roadmap.md:160`도** old path를 역사 서술로 보존한다 (A 감사 5라운드). old-path 검사는 **live citation만** 대상으로 하고 이 셋을 allowlist에 둔다 |
| `emergence-html-structure.test.mjs` | 다른 유닛(`260701_emergence_harness`)의 고정 `_fin` HTML만 읽는다 — 이번 이동과 무관 |
| `gate.mjs`의 `_plan`→`_fin` 폴백 | `mvp_hard` 전용(`:30`) — 이 유닛에 안 걸린다 |

`devlog/_plan/`에는 이 유닛 외 17개 디렉터리가 있고 그중
`260722_260722-repo-governance-config/`는 **무관한 사용자 작업**이다. 범위 밖 절 그대로
건드리지 않는다.
- 아카이브 자체 검증: `test -d devlog/_fin/260725_lazygap2_omo419_parity`,
  `test ! -d devlog/_plan/260725_lazygap2_omo419_parity`,
  `rg -l 'devlog/_plan/260725_lazygap2'`에서 **`000_plan.md`, `009_reinforcement_roadmap.md`,
  `110_devlog_archive.md` 셋을 제외한** 결과 0건 (셋 다 아카이브·로드맵 이력 서술이라
  old path를 의도적으로 보존한다 — A 감사 5라운드),
  `git log --stat`에 12 rename + 10 add. 이 넷이 실제 검증기다.
- `npx tsc --noEmit`은 **적지 않는다** — 이 슬라이스는 코드를 바꾸지 않고,
  root `tsconfig.json`이 없어 그 명령은 아무것도 검사하지 않는다.

## 범위 밖

- **이 유닛 외 다른 `devlog/_plan/` 유닛의 이동** — 특히 무관한 사용자 작업인
  `devlog/_plan/260722_260722-repo-governance-config/`는 건드리지 않는다.
- `devlog/.lazycodex/` (ignore 대상 벤더 클론).
- `devlog/_fin/` 안에 이미 있는 유닛의 재구성.
