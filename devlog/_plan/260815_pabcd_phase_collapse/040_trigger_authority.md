---
created: 2026-08-15
status: design
workPhase: wp3
tags: [codexclaw, hook, trigger]
---

# 040 — mid-cycle phase authority 회수

명칭 주의(감사 MINOR 2): "자연어는 위상을 못 움직인다"가 아니라
**"자연어는 사이클 중간 위상을 못 움직인다"**가 정확하다. IDLE→P/I 진입은 허용한다.

## 결함

`hook.ts:524`의 mode 1은 자연어 트리거만으로 `phase`를 직접 쓴다.
adjacency 검사도, attest도, ledger append도 없다. `detectTrigger`가
"구현해"/"build this"를 B로 매핑하므로(`hook.ts:156`)
`IDLE → B` 직행이 성립한다. P도 A도 거치지 않으며 ledger에 흔적도 없다.

## 변경 1 — phase 쓰기 제거

mode 1은 directive를 주입하되 `phase`를 쓰지 않는다.
예외: `IDLE→P`, `IDLE→I`는 기존대로 허용한다
(`hook.test.ts:137`, `:485` 보존, 진입 자체는 무해).

대신 "실제로 위상을 옮기려면 `cxc orchestrate <verb>`를 쓰라"는 안내를 붙인다.
`detectTrigger` 매핑 자체는 건드리지 않는다(`hook.test.ts:42` 보존).

## 변경 2 — loop-arm 우선순위 (감사 BLOCKER 3 + MAJOR 3)

"pabcd 여러 번 돌려서 구현해"는 `detectTrigger`에서 B이고
`detectLoopArmRequest`에서도 true다. 그런데 trigger 분기가 먼저 반환하므로
(`hook.ts:515`) loop-arm 분기(`hook.ts:542`)에 도달하지 못한다.
결과는 IDLE + BUILD directive라는 최악의 조합이다.

감사관 지적대로 **분기 전체를 옮기면 안 된다** — 현재 unarmed 분기는
`agbrowseRequested || loopArmRequested`를 함께 처리하므로,
"build this using agbrowse"가 BUILD 대신 검색 directive로 바뀐다.

정확한 순서:

1. parser command (명시적 `orchestrate`)
2. trigger / loop-arm / agbrowse 세 신호를 **먼저 계산**
3. `!state.orchestrationActive && loopArmRequested`만 우선 처리 (agbrowse 조합 보존)
4. trigger 처리 (phase 쓰기 없이)
5. 남은 unarmed agbrowse 처리
6. passive modes (2/3)

## 상태 행렬 (감사 라운드 6 요구)

mode 1이 지금 한 번에 바꾸는 필드는 셋이다: `phase`, `orchestrationActive`,
`lastInjectedPhase`. 셋을 어떻게 나눌지 정하지 않으면 구현자가 판단해야 하고,
잘못 나누면 `phase=IDLE`인데 `orchestrationActive=true`가 되어 다음 턴의
passive mode가 IDLE directive를 주입하는 불일치가 생긴다(`hook.ts:598`).

| 입력 | phase | orchestrationActive | lastInjectedPhase | loopArmSeen | 주입 내용 |
|------|-------|--------------------|--------------------|-------------|-----------|
| `IDLE` + P/I 트리거 | 트리거값 | true | 트리거값 | loop면 true | 해당 위상 directive |
| unarmed + loop-arm (트리거 유무 무관) | 불변 | 불변(false) | 불변 | true | arming mandate |
| `IDLE` + A/B/C 트리거 | **불변** | **불변** | **불변** | loop면 true | directive + orchestrate 안내 |
| mid-cycle 트리거 (모든 위상) | **불변** | **불변** | **불변** | loop면 true | directive + orchestrate 안내 |
| unarmed + agbrowse만 | 불변 | 불변 | 불변 | 불변 | 검색 directive |
| **armed + 순수 loop-arm** | 불변 | 불변 | 기존 passive 규칙 | **true** | mandate 재주입 없음, passive 계속 |
| **armed + loop-arm + agbrowse** | 불변 | 불변 | 기존 passive 규칙 | **true** | passive directive/header + 검색 합성 |

### stale-spread 방지 (감사 라운드 7)

`loopArmSeen=true`를 먼저 쓰더라도, 이후 passive write들이 낡은 `...state`를
펼치면 **다시 false로 덮인다**. 해당 write는 셋이다: `hook.ts:584`(stage marker),
`:598`(mode 2), `:612`(mode 3). 전부 함수 진입 시점의 `state`를 spread한다.

따라서 `loopArmSeen` 갱신 이후로는 **working state 하나를 만들어 그 뒤의 모든
write가 그것을 spread**한다. 원본 `state`를 다시 펼치지 않는다.

```ts
// 신호 계산 직후 한 번만 만든다
const working = loopArmRequested && !state.loopArmSeen
  ? { ...state, loopArmSeen: true }
  : state;
// 이후 모든 writeState는 { ...working, ... } 을 쓴다
```

### turnless 계약 (감사 라운드 7)

지금 trigger의 state write는 `if (turn)` 안에 있어(`hook.ts:527`),
turn_id가 없는 payload는 위 표대로 동작하지 않는다. 계약을 명시한다:

| 상황 | turn 있음 | turn 없음 |
|------|-----------|-----------|
| `IDLE` + P/I 진입 | phase/active/lastInjected + injectedTurns | **phase/active/lastInjected는 저장**, injectedTurns 생략 |
| loop-arm (unarmed/armed 무관) | `loopArmSeen` + injectedTurns | **`loopArmSeen`은 저장**, injectedTurns 생략 |
| 이동 금지 A/B/C·mid-cycle (loop 없음) | injectedTurns만 | **write 불필요** |

원칙: `injectedTurns`만 turn-guard 안에 두고, 의미 있는 상태 변화는 turn 없이도
저장한다. 260714 wp3이 loop-arm에 대해 이미 같은 결론을 내렸다(unarmed 분기의
"persist loopArmSeen OUTSIDE the turn guard" 주석).

테스트: turnless P/I 진입, turnless unarmed loop, turnless armed loop 3개.

### working 객체만으로는 부족하다 (감사 라운드 8)

`working`은 메모리 객체일 뿐이다. armed 상태의 순수 loop 요청이
context-pressure 억제나 turnless stage-marker/mode2/mode3 경로로 **후속 write 없이
반환**하면 `loopArmSeen`이 디스크에 남지 않는다.

따라서 passive pipeline 진입 전(`hook.ts:582` 부근)에 `working !== state`이면
**한 번 저장**하고, 이후 write들이 `working`을 spread한다.

관련 write 지점은 다섯이다(전수 확인): trigger `:527`, unarmed `:552`,
stage-marker `:586`, mode2 `:603`, mode3 `:614`.

### armed + loop 표현 정정

"passive 출력을 반드시 한다"가 아니라 **기존 passive pipeline으로 진입한다**가
정확하다. L17 goal-active I firewall(`hook.ts:568`)과 R-11 transcript
suppression(`:577`)은 그대로 적용되므로, 조건에 따라 아무것도 출력하지 않을 수 있다.

### 추가 테스트 (감사 라운드 8)

turnless 3개에 더해, **turn이 있는 armed-loop**로 stage-marker / mode2 / mode3
각각에서 최종 `loopArmSeen=true`를 고정한다 — stale overwrite를 실제로 검증하는
것은 이쪽이다.

### footer 처리 (감사 라운드 7 정정)

`withFooter` 인자를 단순히 `state.phase`로 바꾸면 안 된다 — write 후에도
로컬 `state`는 여전히 IDLE이므로 허용된 `IDLE→P` 진입까지 IDLE로 찍혀
기존 테스트 3개가 깨진다(`hook.test.ts:132`, `:343`, `:491`).

**분기별 effective phase**를 계산한다:

- 허용된 `IDLE→P/I` 진입 → `trigger` (실제로 그 위상이 됐으므로)
- 이동 금지 분기 → `state.phase` (안 움직였으므로)

핵심: **위상을 안 옮기는 경우 세 필드를 모두 건드리지 않는다.** 일부만 쓰는 것이
가장 나쁜 선택지다.

### footer 처리

`withFooter(directive, trigger)`는 지금 요청된 트리거를 찍는다(`hook.ts:539`).
위상을 안 옮기면서 `IPABCD: B`를 출력하면 상태를 거짓 표시하는 것이므로,
**실제 persisted phase**를 footer로 쓴다.

### 분기 순서

`!state.orchestrationActive && loopArmRequested`만 trigger 앞으로 승격한다.
unarmed 분기 전체를 옮기면 안 된다 — 그 분기는 `agbrowseRequested || loopArmRequested`를
함께 처리하므로 통째로 옮기면 agbrowse 단독 요청까지 순서가 뒤바뀐다.

1. parser command (명시적 `orchestrate`)
2. trigger / loop-arm / agbrowse 세 신호 계산
3. `!orchestrationActive && loopArmRequested` → mandate (+ agbrowse면 합성)
4. trigger 처리 (위 행렬대로)
5. 남은 unarmed agbrowse
6. passive modes

## activation scenario

| 프롬프트 | 이전 | 이후 |
|----------|------|------|
| "이거 구현해줘" (IDLE) | phase=B | phase 불변, directive + orchestrate 안내 |
| "계획 세워줘" (IDLE) | phase=P | phase=P (변경 없음) |
| "pabcd 여러 번 돌려서 구현해" (unarmed) | BUILD directive | arming mandate |
| "plan this and then loop until done" (unarmed) | PLAN directive, loopArmSeen=true | **arming mandate** (기존 테스트 반전) |
| "build this using agbrowse" | BUILD only | BUILD only (변경 없음) |
| `agbrowse로 검증하면서 cxc-loop 돌려줘` | mandate + 검색 | 동일 (보존) |
| mid-cycle "구현해줘" | phase=B 덮어씀 | phase 불변 |

**감사 지적 정정**: 021/022는 `"build this using agbrowse"`의 기존 동작을
"BUILD + 검색"이라 적었으나 틀렸다. trigger 분기가 먼저 반환하므로 검색
directive는 사라지고 BUILD만 나간다(`hook.test.ts:337`이 고정). 표를 정정했다.

## 반전할 기존 테스트

- `hook.test.ts:254` — "trigger + loop phrase가 P를 arm한다"
  → unarmed + loop-arm이면 mandate가 우선하므로 phase는 불변.
- `hook.test.ts:296` — "explicit trigger가 loop-arm보다 우선한다"
  → unarmed 상태에서는 mandate가 이긴다. armed 상태의 우선순위는 그대로.
- `hook.test.ts:312`(agbrowse 합성) — **보존**.
- `hook.test.ts:42`(detectTrigger 매핑) — **보존**.

## 테스트

`hook.test.ts:254`, `:296`이 잘못된 우선순위를 고정하므로 의도적으로 반전한다.
`:312`의 agbrowse 조합은 반드시 보존한다.
신규: fresh IDLE의 자연어 B/A/C, adjacent forward, backward, same-phase, loop-arm+B 조합.
감사관 확인 결과 현재 이 실패 모드의 테스트가 **0개**이므로 전부 새로 쓴다.

## 알려진 한계

이 변경은 phase 기록을 막을 뿐 **편집 자체를 차단하지 않는다**(감사 MAJOR 1).
사용자가 "구현해줘"라고 하면 모델은 여전히 구현할 수 있다. 달라지는 것은
그것이 PABCD 사이클로 **위장되지 않는다**는 점이다.
