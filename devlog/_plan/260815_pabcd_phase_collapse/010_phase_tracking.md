---
created: 2026-08-15
status: design
tags: [codexclaw, pabcd, state, phase-tracking]
unit: 260815_pabcd_phase_collapse
---

# 010 — 위상 체류/활동 추적을 State에 도입

전제: 000이 규명했듯 게이트가 시간을 못 보는 이유는 볼 데이터가 없기 때문이다.
이 문서는 데이터를 만드는 단계만 다룬다. 거부 로직은 020이 담당한다.

## 무엇을 기록할 것인가

두 축이 필요하다. 시간 하나만으로는 오탐이 난다(000 제약 1).

1. **체류 시각** — 현재 위상에 언제 들어왔는가.
2. **활동량** — 그 위상에서 실제로 파일 편집이 몇 번 일어났는가.

두 축을 결합하면 "짧지만 정직한 위상"과 "짧고 비어 있는 위상"을 구분할 수 있다.
1분 만에 끝난 A 위상이라도 감사 파견 흔적이 있으면 정상이고, 0초에 활동도 0이면
back-fill이다.

## State 스키마 변경

`src/state.ts`의 `State` 인터페이스에 두 필드를 추가한다.

```ts
export interface State {
  // ... 기존 필드 ...

  /**
   * PHASE-DWELL-01: 현재 위상에 진입한 시각(ISO). transition()이 위상을 바꿀 때
   * 갱신된다. null은 "추적 이전에 만들어진 상태" — 게이트는 이를 fail-open으로
   * 다룬다(오래된 세션을 소급 처벌하지 않는다).
   */
  phaseEnteredAt: string | null;

  /**
   * PHASE-DWELL-01: 현재 위상에서 관측된 구조적 편집(apply_patch/Write/Edit) 횟수.
   * 위상이 바뀌면 0으로 리셋된다. 편집만 세는 것은 한계이자 의도다 — 셸 쓰기는
   * 보이지 않지만(edit-shape.ts와 같은 계열의 정직한 한계), 구현 작업의 압도적
   * 다수는 apply_patch를 거친다.
   */
  phaseEditCount: number;
}
```

`defaultState()`는 `phaseEnteredAt: new Date().toISOString()`, `phaseEditCount: 0`으로 시작한다.

## readState 재구성 (하위호환)

기존 필드들과 동일한 엄격 재구성 패턴을 따른다. 새 필드가 없는 90여 개의 기존
state.json이 깨지지 않아야 한다(000 제약 4).

```ts
phaseEnteredAt:
  typeof parsed.phaseEnteredAt === "string" && parsed.phaseEnteredAt.length > 0
    ? parsed.phaseEnteredAt
    : null,
phaseEditCount:
  typeof parsed.phaseEditCount === "number" && Number.isFinite(parsed.phaseEditCount) && parsed.phaseEditCount >= 0
    ? Math.floor(parsed.phaseEditCount)
    : 0,
```

핵심 결정: 없으면 `null`이지 `defaultState`의 현재 시각이 아니다. 현재 시각으로
채우면 업그레이드 직후 모든 오래된 세션이 "방금 위상에 들어온" 것처럼 보여
첫 전이가 부당하게 거부된다. `null`은 020에서 "판정 불가 → 통과"로 매핑된다.

## transition()에서의 갱신

`src/fsm.ts`의 `transition()`은 순수 함수이고 그 성질을 유지한다. 시각은 인자로 받는다.

```ts
export function transition(
  state: State,
  to: Phase,
  attest?: Attestation | null,
  now: Date = new Date(),
): TransitionResult {
```

기본값 `new Date()` 덕분에 기존 호출부는 전부 그대로 컴파일된다. 테스트는
`now`를 주입해 시간을 조작할 수 있다 — 이게 이 설계에서 테스트 가능성의 핵심이다.

위상이 실제로 바뀔 때만 추적을 리셋한다:

```ts
// D->IDLE 닫기 분기
return {
  ok: true,
  state: {
    ...state,
    phase: "IDLE",
    flags: { interview: false, auditPassed: false, checkPassed: false },
    orchestrationActive: false,
    lastInjectedPhase: null,
    phaseEnteredAt: now.toISOString(),
    phaseEditCount: 0,
  },
};

// 일반 전이 분기
return {
  ok: true,
  state: {
    ...state,
    phase: to,
    flags,
    ...(to === from ? {} : { phaseEnteredAt: now.toISOString(), phaseEditCount: 0 }),
  },
};
```

`to === from`인 자기 전이는 추적을 리셋하지 않는다. 같은 위상을 다시 선언하는 것이
카운터를 씻어내는 우회로가 되면 안 된다.

## 편집 카운터 증가 지점

`src/idle-edit.ts`의 `handleIdleEditAdvisory()`가 이미
`^(apply_patch|Write|Edit)$` matcher로 PreToolUse에 등록돼 있다. 같은 훅에서
카운터를 올린다 — 새 훅을 등록하지 않는다(000의 스코프 유지).

문제는 현재 구조다:

```ts
const state = readState(cwd, sessionId);
if (state.phase !== "IDLE" || state.orchestrationActive) return "";   // ← 여기서 즉시 이탈
```

이 조기 이탈이 P 위상 편집을 보이지 않게 만든다(000 원인 3). 순서를 뒤집는다:
**먼저 세고, 그다음 권고 여부를 판단한다.**

```ts
const state = readState(cwd, sessionId);

// PHASE-DWELL-01: 위상 활동 계수는 IDLE 여부와 무관하게 먼저 일어난다.
// 이 카운터가 020의 붕괴 게이트에 "이 위상에서 실제 작업이 있었나"를 답한다.
if (state.phase !== "IDLE") {
  try {
    writeState(cwd, { ...state, phaseEditCount: state.phaseEditCount + 1 });
  } catch {
    // 계수 실패가 편집을 막지 않는다 (fail-open)
  }
  return "";   // 무장된 위상에서의 편집은 권고 대상이 아니다
}
if (state.orchestrationActive) return "";
```

IDLE 권고의 기존 동작은 그대로다. 달라지는 것은 IDLE이 아닐 때 침묵하되
**세고 나서 침묵한다**는 점뿐이다.

## 파일별 변경 요약

| 파일 | 변경 |
|------|------|
| `src/state.ts` | `State`에 2필드, `defaultState()` 초기값, `readState()` 재구성 2블록 |
| `src/fsm.ts` | `transition()`에 `now` 인자, 두 반환 분기에서 추적 리셋 |
| `src/idle-edit.ts` | 조기 이탈 순서 반전 + 카운터 증가 |
| `test/state.test.ts` | 기본값 / 하위호환 재구성(누락 시 null) 테스트 |
| `test/fsm.test.ts` | `now` 주입 시 추적 갱신, 자기 전이 시 미리셋 |
| `test/idle-edit.test.ts` | 비IDLE 위상에서 카운터 증가, IDLE 권고 회귀 없음 |

## 이 단계에서 하지 않는 것

- 거부하지 않는다. 010 이후에도 모든 전이는 지금과 똑같이 통과한다.
  관측만 켜는 단계다.
- ledger 스키마는 건드리지 않는다. 기존 `LedgerEntry`로 충분하다.
- 셸 경유 파일 쓰기는 추적하지 않는다. 알려진 한계로 문서에 남긴다.

