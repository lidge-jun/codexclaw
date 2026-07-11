# 031 - .codexclaw 상태/goalplan/E8 게이트 검토 (사이클 3)

## 1. .codexclaw 지형

가변 상태는 2026-07-10 05:48:42 KST에 읽기 전용 Python 집계와 `find`/`wc -l`로
재실측했다. 수집 시작과 종료가 같은 초였으며 mutating `cxc` 명령은 실행하지 않았다.

| 저장소 | B 시점 실측 | 스키마·관찰 |
|---|---:|---|
| `.codexclaw/sessions/` | JSON 38개 | 38개 전부 파싱 성공. 최상위 key shape 1종, key 12개 |
| `.codexclaw/ledger.jsonl` | 882행 | 882행 전부 파싱 성공. 루트 FSM ledger이며 `event` 필드 0건 |
| `.codexclaw/goalplans/` | 디렉터리 33개, 파일 71개 | typed 파일 70개: `goalplan.json` 33, `ledger.jsonl` 33, 보조 `.md` 4. 나머지 1개는 루트 `.DS_Store` |
| `.codexclaw/interviews/` | JSONL 11개, 56행 | `question_asked` 51, `rescan_completed` 5. 전부 파싱 성공 |
| `.codexclaw/evidence/` | 파일 106개 | Markdown, text, JSON, log가 섞인 증빙 가방. 단일 row schema 없음 |
| `.codexclaw/divergence/` | 디렉터리 없음 | 파일 0개 |

루트 ledger 타입은 `{ts, sessionId, from, to, reason, evidence?, actor?, override?,
scanEvidence?}`다(`plugins/codexclaw/components/pabcd-state/src/state.ts:36-49`). 실제 882행에는
goalplan ledger의 `event` 필드가 없었다. goalplan과 interview ledger는 별도 하위 저장소다.

004 수집값과 비교하면 sessions 38, goalplan 디렉터리 33, interview 11개/56행은 유지됐다.
루트 ledger는 869행에서 882행, evidence는 93개에서 106개로 증가했다. 이 절의 숫자는
05:48:42 KST 스냅샷이며 이후 실행 상태를 보증하지 않는다.

## 2. sessions 스키마 대조

`State`는 12개 최상위 필드를 선언한다
(`plugins/codexclaw/components/pabcd-state/src/state.ts:18-34`). `flags`의 세 필드는
`interview`, `auditPassed`, `checkPassed`다
(`plugins/codexclaw/components/pabcd-state/src/state.ts:12-16`). 38개 session JSON의 key
합집합과 개별 key shape가 이 선언과 일치했다.

| 항목 | 선언/복원 | 실파일 | 판정 |
|---|---|---|---|
| `phase` | `IDLE|I|P|A|B|C|D`(`plugins/codexclaw/components/pabcd-state/src/state.ts:5-10`) | 선언 밖 값 없음 | 일치 |
| `lastInjectedPhase` | 타입은 `Phase|null`, 복원은 `PHASES` 즉 I..D만 허용(`plugins/codexclaw/components/pabcd-state/src/state.ts:113-116`) | `"IDLE"` 6개. 예시 `.codexclaw/sessions/019f1827-abc8-7623-b899-c084e91b09a2.json:29` | 괴리. persisted `IDLE`은 복원 시 `null` |
| `orchestrationActive` | boolean을 독립 복원(`plugins/codexclaw/components/pabcd-state/src/state.ts:117`) | `phase:"IDLE"` + `orchestrationActive:true` 11개. 예시 `.codexclaw/sessions/019f1827-abc8-7623-b899-c084e91b09a2.json:29-30` | 교차 필드 불변식 미강제 |
| 기본 상태 | `phase:"IDLE"`, `orchestrationActive:false`, `lastInjectedPhase:null`(`plugins/codexclaw/components/pabcd-state/src/state.ts:62-75`) | 읽기 실패·malformed는 기본 상태로 강등 | 구현 계약과 일치 |

`lastInjectedPhase`의 declared type과 restore allowlist가 다르다. `orchestrationActive`도 phase와
독립 복원되므로 디스크에 존재하는 IDLE+active 조합을 정규화하지 않는다.

## 3. goalplan 계약 대조

loop skill의 shipped schema는 top-level, work phase/task, criterion, host 필드를 열거한다
(`plugins/codexclaw/skills/loop/SKILL.md:135-151`). TypeScript 선언은 `GoalplanCriterion`,
`GoalplanTask`, `GoalplanWorkPhase`, `GoalplanHostLink`, `Goalplan`으로 같은 필드를 갖는다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:34-73`). shipped schema와 구현 타입의
필드 누락은 양방향 모두 없다.

| 분류 | 문서 계약 | 구현/실데이터 | 판정 |
|---|---|---|---|
| shipped schema | `objective`, `slug`, timestamps, `activeWorkPhaseId`, work phases, tasks, criteria, host | TS interfaces가 같은 필드를 선언 | 일치 |
| 상위 Contract | checkpoints, OPEN ASSUMPTIONS, steering decisions, quality gate를 기록(`plugins/codexclaw/skills/loop/SKILL.md:123-133`) | `Goalplan` 전용 필드는 work phases, criteria, host뿐(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:63-73`) | 개념 전용 필드 없음. ledger/detail 자유 문자열에 의존 |
| 구현-only 필드 | 없음 | shipped schema 밖의 TS field 없음 | 없음 |
| legacy disk field | 문서에 없음 | `criteria[].text`가 남아 있음(`.codexclaw/goalplans/opaque-surface-gradient-discipline-3-lane-gpt-5/goalplan.json:74-78`) | 복원기는 `scenario` 필수라 plan 전체를 `null`로 처리(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:128-139`) |

`readGoalplan`은 absent, unreadable, malformed를 모두 `null`로 접는다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:161-168`). legacy `text` criterion은
호환 변환 없이 malformed 경로로 들어간다.

## 4. E8 실패 조건 전수

`validateGoalplan`은 reasons가 비어 있을 때만 통과한다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:275-295`). 실패 조건은 네 가지다.

| # | 실패 조건 | 구현 근거 |
|---:|---|---|
| 1 | `workPhases`와 `criteria`가 모두 빈 plan | `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:277-280` |
| 2 | `met` criterion의 `capturedEvidence`가 null, 빈 문자열, 공백 | `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:282-285` |
| 3 | `done`이 아닌 work phase가 하나 이상 | 파생 함수 `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:235-238`, reason `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:287-290` |
| 4 | `open` criterion이 하나 이상 | 파생 함수 `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:251-254`, reason `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:291-294` |

미검증 범위:

- `capturedEvidence`의 진위, 최신성, 경로 실존, command exit code는 검사하지 않는다. 조건은
  `(c.capturedEvidence ?? "").trim().length === 0`뿐이다
  (`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:282-284`).
- task status는 E8 순회 대상이 아니다. D-close cursor advance가 현재 work phase의 모든 task를
  자동 `done`으로 바꾼다(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:303-326`).
- ID 중복, `criteriaIds` 참조 무결성, `activeWorkPhaseId`와 status의 일치는 검사하지 않는다.
- malformed/missing plan은 `readGoalplan()`의 `null`이 되고 completion guard의 `if (plan)`을
  통과하지 못한 채 E8이 생략된다
  (`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:190-200`).
- E8 호출은 `update_goal {status:"complete"}` guard에 있다
  (`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:178-194`). orchestrate D 경로는 E8을
  호출하지 않고 goalplan advance 오류도 fail-open 처리한다
  (`plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:269-304`).

## 5. ledger 이벤트 대조

수집 시각은 2026-07-10 05:48:42 KST다. goalplan ledger 33개를 모두 파싱해 355행을
집계했다. 선언 이벤트는 `created`, `workphase_started`, `workphase_done`, `task_done`,
`criterion_met`, `host_armed` 6종이다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:75-81`,
`plugins/codexclaw/skills/loop/SKILL.md:163-164`).

| 이벤트 | 현재 행 수 |
|---|---:|
| `created` | 35 |
| `workphase_started` | 60 |
| `workphase_done` | 71 |
| `task_done` | 101 |
| `criterion_met` | 85 |
| `host_armed` | 3 |
| **합계** | **355** |

이벤트 이름 집합은 선언과 완전히 일치한다. 행 필드는 그렇지 않다. 선언 타입은
`{ts, slug, event, detail}`이다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:83-88`). 현재 355행 중 185행이
네 필드 중 하나 이상을 빠뜨린다. 예를 들어
`.codexclaw/goalplans/codexclaw-release-readiness-secret-scan-history/ledger.jsonl:2`는
`{ts,event,workPhaseId,note}` 형태다.

004의 337행과 `created 35 / workphase_started 55 / workphase_done 67 / task_done 95 /
criterion_met 82 / host_armed 3`, `185/337`은 현재 각각 355행,
`35/60/71/101/85/3`, `185/355`로 바뀌었다. `created`는 steering event 대용으로도 쓰인다.
실례는 `.codexclaw/goalplans/implement-the-260709-audit-nearpass-gate-unit-ha/ledger.jsonl:4`다.
전용 amendment/steering event가 없어 event 의미가 넓어진다.

## 6. E8 실행 증거

메인 세션이 2026-07-10 05:42 KST에 확보한 read-only `cxc loop validate` 출력:

```text
[codexclaw loop validate: codexclaw-devlog-260710-repo-review-000-plan-010] FAIL
  - 2 work phase(s) not done: wp3, wp4
  - 3 unmet criterion/criteria: c4, c5, c6
exit=1
```

이 FAIL은 정상 동작이다. 사이클 3 시점 goalplan은 wp3 `in_progress`, wp4 `pending`이고
(`.codexclaw/goalplans/codexclaw-devlog-260710-repo-review-000-plan-010/goalplan.json:64-113`),
c4, c5, c6가 `open`이다
(`.codexclaw/goalplans/codexclaw-devlog-260710-repo-review-000-plan-010/goalplan.json:138-157`).
출력의 두 reason은 구현의 remaining work phase와 unmet criterion message 형식과 일치한다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:287-294`). `no plan found`나 parse
실패가 아니라 실제 잔여 work를 거부한 증거다.

최종 E8 통과는 wp4 D-close 뒤에만 가능하다. D-close 시 `advanceWorkPhase`가 current work phase를
`done`으로 바꾸므로(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:298-326`), wp4가
끝나기 전에는 `not done` reason이 남는다. wp4 D-close 뒤 c5에 네 D 전이 증거를 기록하고
나머지 criterion을 `met`으로 닫은 다음 최종 E8을 실행해야 한다. 사이클 3의 exit 1은 실패를
숨긴 것이 아니라 아직 닫히지 않은 roadmap 상태를 정확히 반영한다.

## 7. 발견 사항

### High

**H-1. malformed bound goalplan이 completion guard를 우회한다.**
legacy criterion은 `scenario` 대신 `text`를 쓴다
(`.codexclaw/goalplans/opaque-surface-gradient-discipline-3-lane-gpt-5/goalplan.json:74-78`).
복원기는 `scenario`가 없으면 `null`을 반환하고
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:128-132`), completion guard는
`if (plan)` 안에서만 E8을 실행한다
(`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:190-200`). bound 파일 손상이나
레거시 shape가 완료 차단을 약화시킨다.

**H-2. evidence gate가 내용 진위를 검증하지 않는다.**
`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:282-284`는 evidence 문자열의 trim 후
길이만 검사한다. 존재하지 않는 경로, 오래된 출력, 실패 command, 임의 서술도 non-empty면
통과한다. E8 통과는 증거가 있다는 주장이지 증거가 참이라는 판정이 아니다.

**H-3. D-close가 미완료 task를 증빙 없이 완료 처리한다.**
`advanceWorkPhase`는 current work phase의 모든 task를 `done`으로 덮는다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:315-321`). E8은 task를 순회하지 않고
work phase와 criterion만 검사한다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:275-295`). 개별 task proof가 없어도
D-close 하나로 task ledger가 완료 상태가 된다.

### Med

**M-1. 주석의 final D-close gate 설명과 실제 호출 경로가 다르다.**
E8 주석은 plan이 `"valid for a final D-close"`라고 설명한다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:266-268`). orchestrate D는 E8을 호출하지
않고 state/ledger를 닫은 뒤 goalplan을 advance하며, advance 오류도 삼킨다
(`plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:269-304`). E8은 D-close gate가
아니라 별도 completion guard다.

**M-2. goalplan ledger 185/355행이 선언 타입보다 느슨하다.**
선언은 `{ts,slug,event,detail}`을 요구한다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:83-88`). 실측 185행은 하나 이상
결여했고, `.codexclaw/goalplans/codexclaw-release-readiness-secret-scan-history/ledger.jsonl:2`는
`slug`와 `detail` 없이 다른 필드를 쓴다. typed consumer가 누락 필드를 전제하면 과거 ledger를
읽지 못한다.

**M-3. amendment/steering 전용 event가 없다.**
event union은 6종으로 닫혀 있다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:75-81`). steering 기록이 `created`로
재사용된 사례가 있다
(`.codexclaw/goalplans/implement-the-260709-audit-nearpass-gate-unit-ha/ledger.jsonl:4`). 생성과
계획 변경을 event만으로 구분할 수 없다.

**M-4. persisted state와 복원 state가 다르다.**
실파일은 `lastInjectedPhase:"IDLE"`과 `orchestrationActive:true`를 함께 가진다
(`.codexclaw/sessions/019f1827-abc8-7623-b899-c084e91b09a2.json:29-30`). 복원은 IDLE을
`lastInjectedPhase`에서 제외하면서 active 값은 그대로 읽는다
(`plugins/codexclaw/components/pabcd-state/src/state.ts:113-117`). 현재 IDLE 저장값은 6개,
IDLE phase+active true 조합은 11개다. 같은 JSON도 디스크와 메모리의 phase marker가 달라진다.

**M-5. interview ledger에 동일 eventId 중복이 남아 있다.**
현재 중복 eventId는 12개이며 첫 행 뒤 중복 row도 12개다. 예시 파일의 1-2행은 완전히 같은
`question_asked` eventId다
(`.codexclaw/interviews/019f4754-031e-7fc0-b53e-cf146a123cee.jsonl:1-2`). 중복 집계나 replay가
idempotency를 별도로 구현하지 않으면 같은 질문을 여러 번 처리한다.

### Low

**L-1. Contract의 checkpoints/assumptions/steering 약속이 전용 필드 없이 자유 문자열에 의존한다.**
loop Contract는 checkpoints, OPEN ASSUMPTIONS, steering rationale, quality gate를 요구한다
(`plugins/codexclaw/skills/loop/SKILL.md:123-133`). 구현 top-level은 work phases, criteria,
host만 구조화한다(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:63-73`). 핵심
운영 이력이 `detail`이나 외부 문서 관례에 남아 자동 검증과 migration이 어렵다.

## 8. 리뷰어 verdict

사이클 3 A게이트 판정은 **GO-WITH-FIXES (blockers=2, 모두 Med)**다. 증거는
`.codexclaw/evidence/repo-review-cycle3-a-gate-20260710T054529+0900.md`에 있다.

폴드 내역:

- **E8 마스킹 제거.** 기존 `|| true`만으로 종료하던 검증을 예상 실패 형태 검사로 보강했다.
  최신 030은 `not done`을 필수로 요구하고 `no plan found`를 별도 실패로 거부한다
  (`devlog/_plan/260710_repo_review/030_phase3_spec_state.md:32-37`). 031 §6은 메인 세션의
  exit 1 원문과 reason을 기록했다.
- **§5 재실측 의무.** 004의 337행과 `185/337`을 복사하지 않고 05:48:42 KST에 33개 ledger를
  다시 읽었다. 현재값 355행, 이벤트 `35/60/71/101/85/3`, 선언 필드 결여 `185/355`를 §5에
  반영했다.
- **전 인용 재해석.** 004에서 채택한 정적 인용을 원본에서 모두 다시 찾았다. 채택한
  TypeScript/SKILL 정적 인용의 line 이동은 없었다. 004의 축약·ellipsis 경로는 저장소 루트
  기준 전체 경로로 교체했다.

두 blocker는 문서 작성 절차에 폴드했다. 별도 재리뷰 판정은 없으므로 기록상 최종 verdict는
**GO-WITH-FIXES (blockers=2)**로 유지한다.
