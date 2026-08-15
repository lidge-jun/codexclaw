---
created: 2026-08-15
status: design-final
supersedes: [010_phase_tracking.md, 020_collapse_gate.md, 021_audit_fold_redesign.md]
tags: [codexclaw, pabcd, goalplan, cycle-granularity]
unit: 260815_pabcd_phase_collapse
---

# 022 — 3라운드 재설계: 사이클 개수를 겨냥한다

## 두 번의 FAIL이 가르쳐 준 것

라운드 1(020)은 시간 임계값으로 갔다가 **정상 감사를 거부하는** 게이트를 만들었다.
라운드 2(021)는 위상별 증거로 옮겼지만 감사관의 마지막 질문에 무너졌다:

> 021은 일부 edge collapse를 더 어렵게 하지만 cycle granularity와 pending-task
> D-close를 막지 않아 5–6개 단위를 1–2사이클로 축약할 수 있습니다.
> 현재 형태는 또 다른 대리 지표입니다.

맞다. 사용자가 신고한 것은 **"5-6번 돌 것을 1-2번에 처리한다"**는 사이클 개수
문제인데, 나는 두 라운드 내내 **한 사이클 내부의 엣지**만 만지고 있었다.
사이클을 아무리 엄격하게 만들어도 사이클이 1개면 소용이 없다.

## 진짜 기계장치 — 코드로 확인

`advanceWorkPhase()`는 현재 work-phase를 `done`으로 바꾸면서
**그 안의 pending task를 전혀 보지 않는다**(`goalplan.ts:832`).
그리고 기존 테스트가 그 동작을 명시적으로 고정한다:

```ts
// goalplan.test.ts:224
const advanced = advanceWorkPhase(plan);
assert.equal(advanced!.workPhases[0].status, "done");
assert.equal(advanced!.workPhases[0].tasks[0].status, "pending");   // ← task는 pending인 채로 done
```

완료 판정도 이걸 못 잡는다. `remainingWorkPhases()`는 phase status만 보고
`done` 안의 pending task는 들여다보지 않는다(`goalplan.ts:568`).

따라서 지금은 이렇게 하면 통과한다:

1. work-phase 1개에 task 5개를 몰아넣는다.
2. PABCD를 한 바퀴 돈다.
3. D를 닫으면 `advanceWorkPhase()`가 task 5개를 pending인 채로 phase를 done 처리한다.
4. `validateGoalplan()`은 remaining이 0이므로 완료를 승인한다.

**5-6 사이클이 1 사이클로 접힌다.** 이것이 사용자가 본 현상의 실제 기계장치다.
attest 게이트를 아무리 조여도 이 경로는 그대로 남아 있었다.

## 설계 — 세 겹

우선순위를 뒤집는다. 사이클 개수가 1순위, 엣지 증거가 2순위다.

### 1순위: CYCLE-GRANULARITY-01 — 미완 task로는 work-phase를 닫지 못한다

`advanceWorkPhase(plan)`에 강제 조건을 넣는다.

```ts
export type AdvanceResult =
  | { kind: "ok"; plan: Goalplan }
  | { kind: "tasks_pending"; pending: GoalplanTask[]; workPhaseId: string }
  | { kind: "no_active" };
```

현재 work-phase에 `pending` task가 남아 있으면 `tasks_pending`을 돌려주고
phase를 닫지 않는다. 호출부(`hook.ts:689`, `orchestrate-cli.ts:362`)는
D-close 시 이 결과를 받아 사용자에게 남은 task를 이름으로 알린다.

**이것이 사이클 개수를 강제하는 지점이다.** task 5개짜리 work-phase는 D를
다섯 번 닫아야 소진된다. 각 D는 자기 앞에 P/A/B/C를 요구하므로, 5개 task는
5 사이클이 된다 — 사용자가 원래 기대한 바로 그 동작이다.

`validateGoalplan()`에도 대응 검사를 넣는다: `done`인데 pending task를
가진 work-phase는 E8 게이트에서 거부한다. 과거에 만들어진 그런 plan은
데이터로 존재할 수 있으므로 이건 완료 승인 시점에만 막는다.

**반환형 변경 주의**: 기존 시그니처는 `Goalplan | null`이다. 호출부 2곳과
테스트를 함께 고쳐야 한다. `goalplan.test.ts:224`와 `:316`은 지금 결함을
고정하고 있으므로 **의도적으로 갱신**한다 — 주석에 왜 뒤집는지 남긴다.

### 2순위: 자연어 트리거는 위상을 움직이지 않는다

라운드 2에서 감사관이 지적한 모순: phase는 IDLE인데 BUILD directive를 주는 것은
"구현하라고 시키면서 기록은 안 하는" 최악의 조합이다(`hook.ts:266`의 B
directive는 즉시 구현을 지시한다).

021의 "전진 점프만 차단"은 `isLegalEdge`로 구현 불가능하다는 지적도 옳다 —
그 함수는 방향이 아니라 인접성을 판정하며, `A→B`는 legal forward고
`B→P`는 illegal backward다. 정책과 도구가 안 맞는다.

그래서 더 단순하고 정직한 규칙으로 간다:

**자연어 트리거는 phase를 절대 쓰지 않는다. 명시적 `orchestrate` 명령만
phase 권한을 갖는다.**

- `detectTrigger`의 매핑은 그대로 둔다(테스트 `hook.test.ts:42` 보존).
- mode 1은 directive를 주입하되 `phase`는 쓰지 않는다.
- 대신 "실제로 위상을 옮기려면 `cxc orchestrate <verb>`를 쓰라"는 안내를 붙인다.
- `IDLE`에서 P/I 진입까지 막으면 기존 워크플로가 깨지므로
  (`hook.test.ts:137`, `:485`가 IDLE→P를 고정한다) **그 두 경우는 예외로 허용**한다.
  진입은 무해하고, 문제는 중간 위상 점프다.

감사관 확인 결과 이 변경으로 깨지는 기존 테스트는 **0개**다. 다만 그건
"해당 실패 모드의 테스트가 아예 없다"는 뜻이므로 새로 추가한다.

### 3순위: 엣지 증거는 기존 자산을 재사용한다

바퀴를 다시 발명하지 않는다. 021이 만들려던 트리 해시는 이미 있다.

`source-identity.ts`의 `captureSourceIdentity()`는 HEAD SHA + porcelain +
**dirty 파일 내용 해시**까지 계산하고, `-uall`과 `-z` 플래그로
021이 놓친 구멍(untracked 디렉터리가 한 줄로 접히는 문제, 경로 인용 문제)을
이미 막아 놨다. `RM` 상태가 유지되는 후속 편집까지 주석에 명시돼 있다.

`B>C`는 B 진입 시 `captureSourceIdentity()`를 찍고, B>C에서
`compareSource()`로 비교한다. `same`이면 B에서 아무 구현도 없었다는 뜻이다.

정직한 한계 (감사관 지적 그대로 수용):

- P에서 만든 dirty 변경을 B에서 커밋만 해도 HEAD가 바뀌어 통과한다.
  스냅샷 비교는 **상태 변화**를 증명하지 미 **인과성**을 증명하지 못한다.
- 공유 워크트리에서 다른 세션의 변화가 이 세션 것으로 오인될 수 있다.
- git이 없으면 fail-open.

이 한계를 알면서도 넣는 이유는, 1순위 게이트가 사이클 개수를 이미 강제하므로
`B>C`는 **보조 신호**로 충분하기 때문이다. 완벽한 인과 증명을 위해
더 복잡한 장치를 만드는 것은 이 유닛의 범위를 넘는다.

`A>B`는 **이번 유닛에서 손대지 않는다.** 감사관은 `review-round.ts`를
배선하라고 권했고 그 모듈은 실제로 `plan_audit` 라운드, plan hash,
verdict lifecycle을 갖추고 "A→B 배선만 남았다"고 주석에 적어 놨다. 하지만
그건 CLI 표면(`review-round open/close`)이 필요한 독립적인 작업이며,
그 자체로 온전한 PABCD 사이클 하나에 해당한다. **다음 work-phase로 등록한다** —
이것이 LOOP-UNIT-CHAIN-01이 말하는 올바른 처리이지, 이번 사이클에 욱여넣는 게 아니다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/goalplan.ts` | `advanceWorkPhase()` 반환형 + pending task 강제, `validateGoalplan()` 검사 |
| `src/hook.ts` | D-close 호출부 갱신, mode 1에서 phase 쓰기 제거 |
| `src/orchestrate-cli.ts` | D-close 호출부 갱신, B>C 소스 비교 배선 |
| `src/state.ts` | `phaseEntrySource` 필드(SourceIdentity 직렬화) + 재구성 |
| `src/orchestrate-apply.ts` | 채팅 경로 B 진입 시 스냅샷 |
| `test/goalplan.test.ts` | **224/316 의도적 반전** + pending task 거부 |
| `test/hook.test.ts` | 자연어 트리거 phase 불변, IDLE→P/I 예외 |
| `test/orchestrate-cli.test.ts` | D-close 거부, B>C 비교 |
| `test/state.test.ts` | default assertion, 하위호환 |

## 이번 유닛에서 하지 않는 것 (다음 work-phase로)

- `A>B`의 `review-round` 배선 — 독립 사이클로 등록한다.
- `C>D`의 `source-receipt` 배선 — 같은 이유로 분리한다.
- P 게이트의 "이번 위상에서 생성됐는가" 판정 — docs-first 흐름에서
  문서가 이전 사이클부터 존재하는 것이 정상이므로 별도 설계가 필요하다.

## 사용자 문제와의 대조

> "PABCD 5-6번 돌 것을 1-2번에, B에서 전부 구현, 심지어 A도 안 간다"

- **5-6번 → 1-2번**: 1순위가 직접 막는다. task N개는 D를 N번 닫아야 한다.
- **B에서 전부 구현**: 3순위의 소스 비교가 보조 신호를 준다.
- **A도 안 간다**: 자연어 `IDLE→B` 직행을 2순위가 막는다.
  감사 품질 자체는 다음 work-phase의 `review-round` 배선이 맡는다.

