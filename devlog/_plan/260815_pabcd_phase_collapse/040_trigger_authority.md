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

## activation scenario

| 프롬프트 | 이전 | 이후 |
|----------|------|------|
| "이거 구현해줘" (IDLE) | phase=B, BUILD directive | phase=IDLE 유지, directive + orchestrate 안내 |
| "pabcd 여러 번 돌려서 구현해" | phase=B, BUILD directive | arming mandate |
| "계획 세워줘" (IDLE) | phase=P | phase=P (변경 없음) |
| "build this using agbrowse" | BUILD + 검색 | BUILD + 검색 (변경 없음) |
| 순수 loop-arm | mandate | mandate (변경 없음) |
| active 세션의 trigger+loop | — | mandate 중복 주입 안 함 |

## 테스트

`hook.test.ts:254`, `:296`이 잘못된 우선순위를 고정하므로 의도적으로 반전한다.
`:312`의 agbrowse 조합은 반드시 보존한다.
신규: fresh IDLE의 자연어 B/A/C, adjacent forward, backward, same-phase, loop-arm+B 조합.
감사관 확인 결과 현재 이 실패 모드의 테스트가 **0개**이므로 전부 새로 쓴다.

## 알려진 한계

이 변경은 phase 기록을 막을 뿐 **편집 자체를 차단하지 않는다**(감사 MAJOR 1).
사용자가 "구현해줘"라고 하면 모델은 여전히 구현할 수 있다. 달라지는 것은
그것이 PABCD 사이클로 **위장되지 않는다**는 점이다.

