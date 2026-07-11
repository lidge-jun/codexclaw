# 000 — 리서치: 루프가 "안 도는" 갭 — orchestrate 강제 지점

- Date: 2026-07-11
- 요청: "cxc-loop에서 orchestrate 명령어를 반드시 사용하도록 강제. 다른 사이드
  스킬들도 점검. 자꾸 안 도는 경우가 생겨서."

## 갭 분석 (file:line)

- `detectTrigger()` (pabcd-state/src/hook.ts:116)에는 I/P/A/B/C 트리거만 존재 —
  **루프 계열 요청("cxc-loop", "HOTL", "goalplan", "끝까지", "continue until
  done")을 잡는 트리거가 전혀 없음.** 루프 요청이 와도 어떤 directive도 주입되지
  않는다.
- `handleUserPromptSubmit`의 fail-closed 분기(hook.ts:395): orchestration 미가동
  세션은 침묵. `orchestrationActive`는 IDLE 로드시 강제 false (state.ts:160) —
  즉 D-클로즈 직후와 미가동 세션의 루프 요청은 전부 이 침묵 분기로 떨어진다.
  **여기가 "루프가 내레이션으로만 시작되고 FSM은 안 도는" 지점.**
- 턴 종료 쪽은 이미 커버: GOAL-IDLE-CONTINUE-01(260709)이 활성 골 + IDLE에서
  Stop을 블록하고 arming 커맨드를 명시. 빠진 건 **프롬프트 타임** 절반.
- 사이드 스킬 점검: pabcd SKILL.md는 커맨드 문법은 상세하나 "내레이션 금지"
  명제가 없음; interview SKILL.md의 closeout fork `proceed`가 커맨드를 명명하지
  않음; dev SKILL.md:109는 재진입 커맨드는 명명하나 edge-attest 강제 문구 없음;
  orchestrate/goalplan 스킬은 deprecated 리다이렉트(정상).

## 선례 (패턴 재사용)

- `detectAgbrowseSearchRequest` + `AGBROWSE_SEARCH_DIRECTIVE` (hook.ts:130s,269s):
  "요청 감지 → 미가동 분기에서 directive 주입, FSM은 건드리지 않음" — 동일 결로
  루프 arming directive를 추가한다. 트리거 우선순위(모드 1 승리)도 동일.
