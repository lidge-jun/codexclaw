# 002 — Hook 아키텍처 탐색 보고 (탐색 에이전트 Plato, gpt-5.6-sol)

수집: 2026-07-10, 사이클 1 P단계 병렬 탐색. 읽기 전용. 사이클 1 B의 근거 소스.
경로 표기: 이하 `components/` = `plugins/codexclaw/components/`, `hooks/` = `plugins/codexclaw/hooks/`.

## 1) Hook 이벤트 맵

> `cli/package.json`은 `src/index.ts`를 엔트리로 선언하지만 실제 `cli/src`는 비어 있다(`cli/package.json:10`). 활성 hook은 플러그인 manifest가 등록한 컴포넌트에서 실행된다(`plugins/codexclaw/.codex-plugin/plugin.json:22`).

| 이벤트 | 설정 및 핸들러 | 책임 |
|---|---|---|
| `UserPromptSubmit` | `hooks/user-prompt-submit-checking-pabcd-trigger.json:3` → `components/pabcd-state/src/cli.ts:134` → `hook.ts:332` handleUserPromptSubmit | orchestrate 명령 FSM 전이, 자연어 trigger 감지, turn 중복 억제, phase directive 주입 |
| `PreToolUse` | goal dispatcher `cli.ts:122`, `goal-gate.ts:217` handlePreToolUseFailClosed; spawn `components/subagent-config/src/spawn-attach-hook.ts:169`; edit lint `comment-lint.ts:90` | create_goal 추가 키 거부(`goal-gate.ts:89`), goal 중 사용자 질문 거부(`goal-gate.ts:112`), goal 완료 gate(`goal-gate.ts:178`), spawn leaf topology/model routing, patch 정적 lint |
| `PostToolUse` | interview `hooks/post-tool-use-capturing-interview-answers.json:3` → `hook.ts:863`; render `hooks/post-tool-use-tracking-render-observations.json:3` → `cli.ts:170` | request_user_input Q/A ledger 기록, I-phase rescan 재주입; render 관찰 기록(`render-observations.ts:149`, `:172`) |
| `Stop` | `hooks/stop-checking-pabcd-continuation.json:3` → `cli.ts:137` → `hook.ts:754` handleStop | 활성 goal PABCD 지속, IDLE goal 재무장, stagnation/context-pressure 해제, plateau divergence |
| `SessionStart` | provider `components/provider-bridge/src/cli.ts:44`; map/session binding `components/cxc-ops/src/map-affordance.ts:155` | ocx status 주입(`provider-bridge/src/cli.ts:45`); session ID/repo map/skill-search/한국어 affordance 주입(`map-affordance.ts:176`) |

## 2) Stop-continuation 구현

- 상태: `phase`, `orchestrationActive`, `stopBlockPhase`, `stopBlockCount` (`components/pabcd-state/src/state.ts:18`).
- 순서: phase I 해제 → goal 활성 조회 → in-flight 판정 → IDLE 처리 → no-goal 해제 → context-pressure 해제 → stagnation 증가 → plateau → 일반 block (`hook.ts:754`).
- GOAL-IDLE-CONTINUE-01: 활성 goal + cycle 없음 → `cxc orchestrate P --session ...` 또는 정직한 종료 요구, goalplan 잔여 작업 첨부 (`hook.ts:661`).
- `MAX_STOP_BLOCKS = 3`: 같은 phase 3회 block 후 다음 호출은 counter 초기화+해제 (`hook.ts:538`, `:552`); 실제 전이가 counter 리셋 (`hook.ts:491`, `orchestrate-cli.ts:309`).
- context-pressure: transcript 마지막 64KiB에서 marker 3종 발견 시 즉시 해제 (`transcript.ts:17`, `:64`, `hook.ts:790`).
- plateau: maximize goal에서만 (`hook.ts:720`); 같은 metric 최근 2개 값 비개선 시 flat (`metrics.ts:198`); 같은 3회 한도 내 (`hook.ts:793`).

## 3) Guard/Gate 구현

- spawn guard: `^spawn_agent$` matcher (`hooks/pre-tool-use-attaching-skills.json:8`); V2 판별 `task_name`/`fork_turns` (`spawn-attach-hook.ts:143`); subagent 재spawn은 `CXC-SUBSPAWN-ALLOWED` 없으면 deny (`spawn-attach-hook.ts:180`); 일반 V2 spawn에 leaf block prepend (`spawn-attach-hook.ts:199`); V1은 설정 model만 주입 (`spawn-attach-hook.ts:218`).
- reasoning_effort는 현재 주입되지 않음: 저장소는 effort를 보존·resolve하지만(`store.ts:35`, `:171`) V2 builder/hook 모두 payload에 넣지 않음(`spawn-wrapper.ts:371`, `spawn-attach-hook.ts:197`).
- GOAL-COMPLETE-GATE-01: `update_goal {status:"complete"}`만 대상 (`goal-gate.ts:178`); cycle 진행 중(`goal-gate.ts:184`) 또는 bound goalplan E8 실패(`goal-gate.ts:190`) 시 deny; E8 실패 조건은 empty plan/미완 phase/unmet criterion/evidence 없는 met (`goalplan.ts:275`); blocked와 IO 오류는 통과 (`goal-gate.ts:172`).

## 4) 발견 사항

1. **[High] 손상·누락 bound goalplan이 완료 gate를 우회.** `goal-gate.ts:190`의 `if (plan)` — `readGoalplan()`이 null(파일 부재/파싱 오류 모두)이면 완료 허용 (`goalplan.ts:161`).
2. **[High] CXC-SUBSPAWN-ALLOWED는 subagent가 자가 우회 가능.** leaf 지시문이 토큰명을 child에 노출(`spawn-attach-hook.ts:48`), deny는 `!outgoing.includes(SUBSPAWN_TOKEN)` 단순 검사(`spawn-attach-hook.ts:187`).
3. **[Med] 토큰이 재spawn 제한뿐 아니라 전체 leaf guard 제거.** 지시문은 constraint (1)만 해제한다지만(`spawn-attach-hook.ts:54`), 구현은 토큰 존재 시 guard 전체가 ""(`spawn-attach-hook.ts:203`).
4. **[Med] effort 설정이 동작하지 않는 dead configuration.** `RoleConfig.effort` 존재(`store.ts:40`, `:166`)하나 runtime은 "no effort inference"(`spawn-attach-hook.ts:197`).
5. **[Med] 자연어 trigger가 directive와 FSM 상태를 분리.** loose trigger는 `orchestrationActive: true`+`lastInjectedPhase`만 저장, phase 미변경(`hook.ts:358`); 기본 phase IDLE(`state.ts:62`) → Stop이 IDLE goal로 오판(`hook.ts:764`).
6. **[Med] render ledger가 session별 미격리.** row에 sessionId 있으나(`render-observations.ts:54`) 조회는 kind만(`render-observations.ts:124`), cycle 시작이 공용 파일 전체 삭제(`render-observations.ts:115`).
7. **[Med] plateau 판정이 work phase 경계 무시.** record에 workPhaseId 저장(`metrics.ts:8`)되나 판정은 metricName filter만(`metrics.ts:205`).
8. **[Med] context-pressure bail이 recovery보다 오래 지속 가능.** 마지막 64KiB 어디든 marker면 참(`transcript.ts:37`, `:65`) → tail에서 밀려날 때까지 조기 해제 지속(`hook.ts:790`).
9. **[Med] FSM state와 ledger 쓰기 비원자적.** state 저장 후 ledger append(`hook.ts:485`, `:496`); 후자 실패 시 CLI fail-open catch가 삼킴(`cli.ts:131`) → phase만 전진.

## 5) 검증에 쓴 명령어

```bash
rg -n 'UserPromptSubmit|PreToolUse|PostToolUse|Stop|SessionStart|GOAL-IDLE-CONTINUE-01|MAX_STOP_BLOCKS|CXC-SUBSPAWN-ALLOWED|reasoning_effort|GOAL-COMPLETE-GATE-01' ...
node --test --test-concurrency=1 <hook/continuation/goal-gate/spawn-attach 테스트>  # 총 167개 통과
git status --short  # 리뷰 전후 동일, 무수정
```
