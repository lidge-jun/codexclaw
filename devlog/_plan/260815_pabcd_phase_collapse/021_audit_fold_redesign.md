---
created: 2026-08-15
status: superseded
supersededBy: 023_final_design.md
warning: 폐기됨 — porcelain 해시는 source-identity.ts의 열등한 재발명이었다.
supersedes: [010_phase_tracking.md, 020_collapse_gate.md]
tags: [codexclaw, pabcd, attest, gate, audit-fold]
unit: 260815_pabcd_phase_collapse
---

# 021 — 감사 반영 재설계: 시간이 아니라 실물 증거

## 감사 결과

wp1의 A 위상에서 독립 리뷰어(gpt-5.6-sol, high)가 **VERDICT: FAIL**을 냈다.
BLOCKER 3건, MAJOR 3건, MINOR 3건. 지적을 코드로 재확인한 결과 전부 사실이었다.
이 문서가 010/020을 대체한다.

## 접어야 했던 지적들

### BLOCKER 1 — 네 번째 원인을 놓쳤다

000은 원인을 3개로 정리했지만, 실제로 위상을 건너뛰는 **직접 phase 쓰기 경로**가
있다. `hook.ts:524`의 mode 1은 자연어 트리거를 받으면

```ts
writeState(payload.cwd, { ...state, phase: trigger, orchestrationActive: true, ... });
```

로 phase를 **직접 쓴다**. adjacency 검사도, attest도, ledger append도 없다.
`detectTrigger`는 "구현해"/"build this"를 `B`로 해석하므로(`hook.ts:156`),
사용자가 "이거 구현해줘"라고 말하는 것만으로 `IDLE → B` 직행이 성립한다.
P도 A도 거치지 않는다. 사용자가 신고한 "심지어 A도 안 간다"의 가장 곧은 경로다.

더 나쁜 것은 이 경로가 ledger에 아무것도 남기지 않는다는 점이다
(`hook.test.ts:485`가 그 동작을 고정하고 있다). 그래서 000의 ledger 통계는
이 경로를 **관측조차 하지 못했다**. "전부 P에서 했다"는 000의 결론은 ledger에
남은 사례에 한해서만 참이다.

### BLOCKER 2 — 게이트가 정상 감사를 거부한다

020의 판정은 "20초 미만 AND 편집 0회 → 거부"였다. 그런데 **A 위상의 정상 행위는
파일을 고치지 않는 것**이다. 리뷰어를 파견하고 회신을 받는 게 전부다. 깨끗한
PASS라면 편집은 0회가 맞다. C 위상도 마찬가지로 테스트를 돌릴 뿐 편집하지 않는다.

즉 020은 잡으려던 것(back-fill)과 지키려던 것(정상 감사)을 **반대로 처벌한다**.
설계 실패다.

게다가 "서브에이전트를 파견하면 20초는 넘는다"는 전제도 보장이 없다. 작은 모델의
빠른 감사는 19초에 끝날 수 있다.

### BLOCKER 3 — 20초 sleep이면 뚫린다

시간 임계값의 근본 문제다. 에이전트가 `sleep 20` 네 번이면 80초 만에 전체
back-fill이 완성된다. 무관한 편집 한 번으로도 통과권이 생기며, 카운터가
PreToolUse에서 증가하므로 **실패한 편집조차** 통과권이 된다.

시간은 작업의 대리 지표(proxy)일 뿐이고, 대리 지표는 언제나 대리로만 만족된다.

### MAJOR 1 — phase writer가 여러 개다

`transition()`에만 추적 리셋을 넣으려 했지만 실제 writer는 넷이다:
`hook.ts:524`(자연어), `orchestrate-apply.ts:168`(채팅),
`orchestrate-cli.ts:293`(I→P override), `orchestrate-apply.ts:40`(clearedIdle).
한 곳만 고치면 나머지 경로로 낡은 값이 새 위상에 전달된다.

### MAJOR 3 — 기존 테스트가 깨진다

`fsm.test.ts`는 갓 만든 `defaultState()`에서 즉시 gated 전이를 수행한다.
20초 게이트를 넣으면 이 테스트들이 전부 실패한다. "컴파일된다"와
"동작이 보존된다"는 다른 말이다.

## 새 설계 — PHASE-EVIDENCE-01

시간을 버린다. 위상마다 **그 위상에서만 만들어질 수 있는 실물**을 요구한다.
이 저장소에 이미 옳은 선례가 있다 — `plan-gate.ts`는 P>A를 시간이 아니라
**디스크의 번호 붙은 문서**로 게이트한다. 그 패턴을 나머지 엣지로 확장한다.

| 엣지 | 요구 증거 | 왜 위조하기 어려운가 |
|------|-----------|----------------------|
| `P>A` | 계획 유닛의 번호 문서 (**기존 `plan-gate.ts`, 변경 없음**) | 문서를 실제로 써야 한다 |
| `A>B` | 이 세션에서 파견된 서브에이전트의 완료 흔적 | 리뷰어를 실제로 띄워야 생긴다 |
| `B>C` | B 진입 이후의 **작업트리 변화** (git 기준) | 구현을 B 안에서 해야 한다 |
| `C>D` | `checkOutput` (**기존 게이트, 변경 없음**) | 이미 있다 |

핵심 원리: **각 위상은 자기 고유의 부산물로 자신을 증명한다.** A는 감사 흔적으로,
B는 코드 변화로. 남의 위상 부산물로는 증명할 수 없다.

### A>B — 서브에이전트 파견 흔적

`subagent-evidence.ts`가 이미 `.codexclaw/evidence/`와
`.codexclaw/evidence-attempts/`에 `sessionId-agentId` 키로 receipt를
남긴다. 216개가 쌓여 있다. A>B는 **A 위상 진입 이후 이 세션 이름으로 생긴
receipt/attempt 파일**을 요구한다.

정직한 한계: `explorer` 타입(읽기 전용 감사)은 receipt 게이트를 우회하도록
설계돼 있어(DISPATCH-AGENT-TYPE-01) 파일이 안 생길 수 있다. 그래서 이 엣지는
**hard block이 아니라 강한 경고 + ledger 기록**으로 간다. 확실한 위조 방지보다
정상 사용 보호가 우선이다(BLOCKER 2의 교훈).

### B>C — 작업트리 변화

B는 구현 위상이다. 구현했다면 트리가 변한다. B 진입 시점의
`git status --porcelain` 해시를 기록해두고, B>C에서 다시 계산해 비교한다.
동일하면 **B에서 아무것도 구현하지 않은 것**이다 — 000이 관측한
"P에서 다 하고 B는 도장만 찍기"가 정확히 여기서 걸린다.

편집 카운터와 달리 이건 실패한 편집이나 무관한 파일 터치로 못 채운다.
실제로 트리가 달라져야 한다. git이 없거나 실패하면 fail-open.

## PHASE-ENTRY-01 — writer 통합

MAJOR 1의 처방을 그대로 받는다. `state.ts`에 단일 invariant owner를 둔다.

```ts
/**
 * PHASE-ENTRY-01: 모든 위상 진입은 여기를 지난다. 위상이 실제로 바뀔 때만
 * 진입 시각과 위상 부산물 스냅샷을 리셋한다. 자기 전이는 리셋하지 않는다
 * (같은 위상 재선언이 스냅샷을 씻는 우회로가 되면 안 된다).
 */
export function enterPhase(state: State, to: Phase, now: Date, treeHash: string | null): State {
  if (state.phase === to) return { ...state, phase: to };
  return { ...state, phase: to, phaseEnteredAt: now.toISOString(), phaseEntryTreeHash: treeHash };
}
```

네 writer 전부 이 함수를 쓴다. 시간 필드는 **게이트가 아니라 telemetry로만**
남긴다 — ledger 분석(000이 한 것)을 계속 가능하게 하되 판정에는 쓰지 않는다.

## BLOCKER 1 처방 — 자연어 트리거 무해화

가장 중요한 수정이다. mode 1의 직접 phase 쓰기를 **전진 방향에 한해** 막는다.

- 자연어 트리거가 현재 위상보다 **앞으로** 점프하려 하면(`IDLE→B` 등):
  phase를 바꾸지 않고, directive와 함께 "실제로 옮기려면 `orchestrate` 명령을
  쓰라"는 안내를 주입한다.
- 같은 위상이거나 뒤로 가는 경우는 기존대로 둔다.
- `IDLE→P`, `IDLE→I`는 정상 진입이므로 허용한다(adjacency가 이미 허용).

판정은 `fsm.ts`의 `isLegalEdge`를 재사용한다. 새 규칙을 만들지 않고
이미 있는 adjacency 표를 자연어 경로에도 적용하는 것뿐이다.

## 변경 파일 (감사 지적 반영해 전부 나열)

| 파일 | 변경 |
|------|------|
| `src/state.ts` | `phaseEnteredAt`/`phaseEntryTreeHash` 필드, `enterPhase()`, readState 재구성 |
| `src/phase-evidence.ts` (신규) | 트리 해시, 서브에이전트 흔적 조회, A>B/B>C 판정 |
| `src/fsm.ts` | `transition()`에서 `enterPhase()` 사용 |
| `src/orchestrate-apply.ts` | `applyHumanTransition`/`clearedIdle`에 `enterPhase()` |
| `src/orchestrate-cli.ts` | I→P override 경로, B>C/A>B 증거 게이트 배선 |
| `src/hook.ts` | mode 1 전진 점프 차단 |
| `test/state.test.ts` | default state assertion 갱신, 하위호환 |
| `test/fsm.test.ts` | `enterPhase` 동작, **기존 테스트 무회귀** |
| `test/orchestrate-cli.test.ts` | 증거 게이트 거부/통과 |
| `test/hook.test.ts` | 자연어 전진 점프 차단, ledger 0건 테스트 갱신 |
| `test/phase-evidence.test.ts` (신규) | 판정 로직 + fail-open |
| `test/orchestrate-apply.test.ts` | 채팅 경로 추적 리셋 |

## MINOR 반영

- 030의 "40개 테스트 파일" → 실제 43개로 정정.
- 빌드 명령은 루트 `npm run build`가 canonical.
- "순수 함수 유지" 표현 철회 — `now`를 주입받는 것이지 벽시계 의존을 없앤 게 아니다.
- `state.test.ts:27`의 exact default assertion을 새 필드에 맞춰 갱신.

## 남는 한계 (정직하게)

A>B 경고는 우회 가능하다. explorer 파견은 흔적을 안 남기므로 hard block을
못 건다. 이건 감사 게이트의 구조적 한계이며, 잘못 막는 것보다 놓치는 쪽을
택한 의도적 선택이다. B>C의 트리 변화 게이트가 실질적 방어선이 된다.
