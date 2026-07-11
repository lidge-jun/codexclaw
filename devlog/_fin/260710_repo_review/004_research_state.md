# 004 — 상태/goalplan 스키마 탐색 보고 (탐색 에이전트 Sagan, gpt-5.6-sol)

수집: 2026-07-10, 사이클 3 선행 탐색. 읽기 전용. 사이클 3 B의 근거 소스.
경로 표기: `goalplan.ts` 등 = `plugins/codexclaw/components/pabcd-state/src/` 하위.

## 1) .codexclaw 지형 표

| 저장소 | 실측 | 스키마/예시 |
|---|---:|---|
| `.codexclaw/sessions/` | JSON 38개 | 12개 최상위 필드 동일. 예시 `.codexclaw/sessions/019f4754-031e-7fc0-b53e-cf146a123cee.json:2` |
| `.codexclaw/ledger.jsonl` | 869행 | `{ts, sessionId, from, to, reason, evidence?}`. `event` 필드 없음 |
| `.codexclaw/goalplans/` | 디렉터리 33, 파일 71 | `goalplan.json` 33, `ledger.jsonl` 33, 보조 `.md` 4 |
| `.codexclaw/interviews/` | JSONL 11개, 56행 | `question_asked` 51, `rescan_completed` 5 |
| `.codexclaw/evidence/` | 93개 | 단일 스키마 아님(증빙 가방). QA verdict JSON은 `{scenario, criterion, surface, verdict, artifactRefs, note}` |
| `.codexclaw/divergence/` | 없음 | 현재 파일 없음 |

## 2) sessions 스키마 대조

38개 파일 키 합집합 = `State` 선언(`state.ts:18-34`)과 일치: `phase`, `sessionId`, `slug`,
`updatedAt`, `flags{interview,auditPassed,checkPassed}`(`state.ts:12-16`), `supersededBy`,
`injectedTurns`, `lastInjectedPhase`, `orchestrationActive`, `interview`, `stopBlockPhase`, `stopBlockCount`.

차이/관찰:
- `lastInjectedPhase` 타입은 `Phase|null`로 `IDLE` 허용, 실파일에도 `"IDLE"` 존재
  (`.codexclaw/sessions/019f1827-abc8-7623-b899-c084e91b09a2.json:29`) — 그러나 복원기는
  `PHASES`(I..D)만 허용해 null로 강등(`state.ts:7-10`, `:113-116`).
- 11개 파일이 `phase:"IDLE"` + `orchestrationActive:true` — 교차 필드 불변식 미강제(`state.ts:117`).

## 3) goalplan 스키마 대조

SKILL.md Shipped schema(`skills/loop/SKILL.md:140-151`)와 TS 선언 일대일 일치:
`Goalplan`(`goalplan.ts:63-73`), `GoalplanWorkPhase`(`goalplan.ts:48-54`),
`GoalplanTask`(`goalplan.ts:42-46`), `GoalplanCriterion`(`goalplan.ts:34-40`),
`GoalplanHostLink`(`goalplan.ts:56-61`).

- 문서에 있고 구현에 없는 개념: Contract가 약속하는 checkpoints / OPEN ASSUMPTIONS /
  steering decisions / quality gates 전용 필드 없음(`SKILL.md:129-133` vs `goalplan.ts:63-73`).
- 구현에만 있는 필드: 없음. 단, 실데이터에 레거시 `criteria[].text` 형태 존재
  (`.codexclaw/goalplans/opaque-surface-gradient-discipline-3-lane-gpt-5/goalplan.json:74`).

## 4) E8 실패 조건 전수 + 한계

`validateGoalplan()` 실패 조건은 네 가지뿐(`goalplan.ts:295`에서 reasons 비면 통과):
1. workPhases+criteria 모두 빈 plan(`goalplan.ts:277-280`).
2. `met` criterion의 `capturedEvidence`가 공백(`goalplan.ts:282-285`).
3. `done` 아닌 work phase 존재(`goalplan.ts:235-238`, `:287-290`).
4. `open` criterion 존재(`goalplan.ts:251-254`, `:291-294`).

검증하지 못하는 것:
- capturedEvidence의 진위/최신성/경로 실존/exit code — trim 길이만 검사(`goalplan.ts:283`).
- task 상태 — E8은 task 미순회, D-close가 현 phase task 전부 자동 done(`goalplan.ts:315-321`).
- ID 중복, criteriaIds 참조 무결성, activeWorkPhaseId 일치.
- orchestrate D 경로 자체 — E8 호출은 completion guard 한 곳뿐(`goal-gate.ts:193`),
  D 경로는 advance 실패도 fail-open(`orchestrate-cli.ts:269-304`).
- malformed/missing plan — `readGoalplan()` null 반환(`goalplan.ts:161-168`) 시 guard의
  `if (plan)` 밖으로 빠져 E8 미실행(`goal-gate.ts:190-201`).

## 5) ledger 이벤트 대조

- 루트 ledger: `LedgerEntry`(`state.ts:36-49`)와 일치.
- goalplan ledger 337행: 이벤트 이름 6종(created 35 / workphase_started 55 / workphase_done 67 /
  task_done 95 / criterion_met 82 / host_armed 3)은 선언(`SKILL.md:163-164`, `goalplan.ts:75-81`)과
  완전 일치. 행 필드는 불일치: 선언은 `{ts,slug,event,detail}`(`goalplan.ts:83-88`)인데
  185/337행이 하나 이상 결여(예: `{ts,event,workPhaseId,note}` 형태 —
  `.codexclaw/goalplans/codexclaw-release-readiness-secret-scan-history/ledger.jsonl:2`).

## 6) 발견 사항

1. **High**: malformed goalplan이 completion guard 우회 — 레거시 `text`-형 criterion은
   복원기에서 null(`goalplan.ts:132`) → guard `if (plan)` 미진입(`goal-gate.ts:192-194`).
2. **High**: evidence gate가 내용 진위 미검증 — `.trim().length === 0`만(`goalplan.ts:283`).
3. **High**: D-close가 미완료 task를 증빙 없이 완료 처리(`goalplan.ts:315-321`), E8 task 미검사.
4. **Med**: 주석은 E8을 "valid for a final D-close" 게이트로 설명(`goalplan.ts:266-268`)하나
   orchestrate D 경로에 E8 호출 없음, advance 실패 fail-open(`orchestrate-cli.ts:279-304`).
5. **Med**: goalplan ledger 185/337행이 선언 타입보다 느슨.
6. **Med**: amendment/steering 이벤트 부재 — `created` 재사용 사례
   (`.../implement-the-260709-audit-nearpass-gate-unit-ha/ledger.jsonl:4`).
7. **Med**: persisted vs 복원 상태 괴리 — `"IDLE"` lastInjectedPhase가 복원 시 null;
   `IDLE`+`orchestrationActive:true` 11건.
8. **Med**: interview ledger 동일 eventId 중복 12건(예: `.codexclaw/interviews/019f4754-031e-7fc0-b53e-cf146a123cee.jsonl:1`, `:2`).
9. **Low**: Contract의 checkpoints/assumptions/steering 약속이 전용 필드 없이 자유 문자열 ledger 의존.

## 7) 사용한 명령

`find`/`wc -l`/`jq -r 'keys[]'`/`jq empty`(전 대상 파싱 통과)/`sort|uniq -c`/`nl -ba`/`rg -n`.
cxc mutating 명령 미실행, 파일 무수정.
