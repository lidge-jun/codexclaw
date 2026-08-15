---
created: 2026-08-15
status: superseded
supersededBy: 023_final_design.md
warning: 폐기됨 — A/C는 파일을 안 고치는 것이 정상이므로 편집 카운트 게이트는 틀렸다.
tags: [codexclaw, pabcd, attest, gate]
unit: 260815_pabcd_phase_collapse
---

# 020 — attest 붕괴 게이트

010이 데이터를 만들었다. 이 문서는 그 데이터로 무엇을 거부할지 정한다.

## 규칙 이름

**PHASE-COLLAPSE-01** — gated forward edge는 그 위상에서 실제로 무언가가
일어났다는 최소 증거 없이 통과할 수 없다.

## 판정 로직

핵심은 "짧다"를 곧바로 "거짓"으로 읽지 않는 것이다(000 제약 1). 두 조건이
**모두** 성립할 때만 거부한다.

1. 체류 시간이 임계값 미만이고,
2. 그 위상에서 관측된 활동이 0이다.

```ts
/** PHASE-COLLAPSE-01: 이 시간 미만은 "활동이 있었다"는 증거를 요구한다. */
export const MIN_PHASE_DWELL_MS = 20_000;

export interface PhaseActivity {
  /** 현재 위상 진입 시각(ISO). null이면 판정 불가 → 통과(fail-open). */
  phaseEnteredAt: string | null;
  /** 현재 위상에서 관측된 구조적 편집 수. */
  phaseEditCount: number;
}

export function validatePhaseCollapse(
  from: Phase,
  to: Phase,
  activity: PhaseActivity | null,
  now: Date = new Date(),
): AttestResult {
  if (!GATED_TRANSITIONS.has(\`\${from}>\${to}\`)) return { ok: true };
  if (!activity) return { ok: true };
  const { phaseEnteredAt, phaseEditCount } = activity;
  if (!phaseEnteredAt) return { ok: true };        // 업그레이드 이전 상태
  const enteredMs = Date.parse(phaseEnteredAt);
  if (!Number.isFinite(enteredMs)) return { ok: true };   // 깨진 값 → fail-open
  const dwellMs = now.getTime() - enteredMs;
  if (dwellMs < 0) return { ok: true };            // 시계 역행 → fail-open
  if (dwellMs >= MIN_PHASE_DWELL_MS) return { ok: true };
  if (phaseEditCount > 0) return { ok: true };     // 짧지만 실제 작업이 있었다
  return { ok: false, reason: /* 아래 참조 */ };
}
```

fail-open 분기가 네 개다. 의도적이다. 이 게이트의 적대자는 게으름이지 악의가
아니므로(attest.ts 스레트 모델), 판정 불가는 전부 통과로 보낸다. 잡고 싶은 것은
오직 하나 — **명백한 back-fill**이다.

### 임계값 20초의 근거

000의 분포에서 정상 A>B의 최솟값은 36초였다. 붕괴는 0~1초에 몰려 있다.
그 사이의 20초는 "실제로 서브에이전트를 파견했다면 넘길 수밖에 없는" 하한이면서,
정상 사례의 최솟값보다 충분히 낮아 오탐 여지를 남긴다. 게다가 활동 조건이
AND로 걸려 있어, 20초 미만이라도 편집이 하나라도 있으면 통과한다.

### 거부 메시지

거부는 무엇을 하라는 지시까지 담아야 실효가 있다. 엣지마다 다른 문구를 준다.

```ts
const COLLAPSE_HINTS: Partial<Record<string, string>> = {
  "P>A": "P에서 계획을 세우지 않고 곧바로 A를 선언했습니다. 계획 문서를 쓰고 다시 시도하세요.",
  "A>B": "A에서 감사가 실제로 일어나지 않았습니다. 독립 리뷰어 서브에이전트를 파견하고, 그 회신을 받은 뒤 attest하세요. 이 엣지가 전체 붕괴의 38%를 차지합니다.",
  "B>C": "B에서 구현이 관측되지 않았습니다. 구현을 B 위상 안에서 수행하세요 — 앞선 위상에서 미리 해두고 B를 통과 도장으로 쓰는 것이 이 게이트가 막는 패턴입니다.",
  "C>D": "C에서 검증이 실행되지 않았습니다. 실제로 테스트를 돌리고 그 출력으로 attest하세요.",
};
```

메시지 본문은 다음 형태다:

> `from -> to`는 `Ns` 만에 요청됐고 이 위상에서 관측된 편집이 0입니다
> (PHASE-COLLAPSE-01). 한 위상의 작업을 다른 위상에서 미리 끝내고 attest만
> 몰아서 기록하는 것은 PABCD를 통과 의례로 만듭니다. <엣지별 힌트>
> 이 위상의 작업을 실제로 수행한 뒤 다시 attest하세요.

## 배선

`src/fsm.ts`의 `transition()`에서 form 게이트 **직후**에 부른다.

```ts
// 1) 구조적 증거 게이트 (form)
const gate = validateAttest(from, to, attest ?? null);
if (!gate.ok) return { ok: false, reason: gate.reason };

// 1b) PHASE-COLLAPSE-01: 위상이 실제로 살아 있었는지 (substance)
const collapse = validatePhaseCollapse(
  from, to,
  { phaseEnteredAt: state.phaseEnteredAt, phaseEditCount: state.phaseEditCount },
  now,
);
if (!collapse.ok) return { ok: false, reason: collapse.reason };
```

`transition()`에 배선하면 CLI 경로(`orchestrate-cli.ts`)와 채팅 경로가
자동으로 함께 보호된다. 각 호출부에 흩뿌리지 않는다.

### 채팅 free-pass는 어떻게 되나

`hook.ts`의 `handleOrchestrateCommand`는 사람이 채팅으로 위상을 움직이는
경로이고 attest 없이 전진할 수 있다(human free-pass). 이 경로는 **그대로 둔다**.
사람이 직접 위상을 옮기는 것은 back-fill이 아니다. PHASE-COLLAPSE-01은
`transition()`을 타는 에이전트 CLI 경로를 겨냥한다.

## 파일별 변경 요약

| 파일 | 변경 |
|------|------|
| `src/attest.ts` | `MIN_PHASE_DWELL_MS`, `PhaseActivity`, `validatePhaseCollapse()`, `COLLAPSE_HINTS` |
| `src/fsm.ts` | `transition()`에 붕괴 게이트 호출 삽입 |
| `test/attest.test.ts` | 임계값 경계, 활동 있을 때 통과, fail-open 4분기, 엣지별 힌트 |
| `test/fsm.test.ts` | 0초 연속 back-fill 거부, 정상 사이클 통과(회귀) |

## 테스트 시나리오 (선작성)

1. **붕괴 재현** — 갓 P에 진입한 상태(`phaseEnteredAt=now`, `editCount=0`)에서
   `P>A`를 즉시 요청 → 거부. 이어서 `A>B`, `B>C`도 거부.
2. **활동 면제** — 같은 조건에 `editCount=1` → 통과.
3. **시간 면제** — `phaseEnteredAt`을 21초 전으로, `editCount=0` → 통과.
4. **하위호환** — `phaseEnteredAt=null` → 통과.
5. **시계 역행** — `phaseEnteredAt`이 미래 → 통과.
6. **회귀** — 000의 정상 7월 시퀀스(수백 초 간격) → 전부 통과.

## 이 게이트가 못 잡는 것

정직하게 남긴다. 에이전트가 20초를 그냥 기다리거나, 무의미한 편집 한 번으로
카운터를 올리면 통과한다. 그건 받아들인다 — 이 모듈의 적대자는 게으름이고,
게으름은 정의상 우회에 드는 수고를 들이지 않는다. 능동적으로 게이트를 속이는
행위는 ledger에 남아 사후에 보인다.
