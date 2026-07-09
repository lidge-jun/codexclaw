# 006 — Second Audit: 소스 대조 검증 (모델 교체 후 재감사)

- Date: 2026-07-05
- Method: 004/005 감사 결과를 hook json + `pabcd-state/src` 실제 소스와 대조
- Verdict: **Phase 1/2 Go 유지. Phase 3는 Conditional Go — REMOVE 목록 2건 재분류 필요.**

---

## Finding 1 (Blocker): `user-prompt-submit-checking-pabcd-trigger`는 REMOVE 불가

004는 이 hook을 "trigger regex 감지 → implicit pabcd skill로 대체 가능"으로 분류했으나,
실제 `handleUserPromptSubmit` (hook.ts:316)은 단순 감지기가 아니라 **PABCD 상태 머신의
주입 엔진 전체**다:

1. **L3b parser-first authoritative path**: 채팅 `orchestrate <verb>` 명령(human
   free-pass)이 FSM을 실제로 움직이는 유일한 통로. 제거하면 사용자가 채팅으로
   `orchestrate P`를 쳐도 아무 일도 안 일어남.
2. **mode 2/3 재주입**: orchestration active 상태에서 phase directive / stage header를
   매 턴 재주입 (compaction-immune). skill로 대체 불가 — 에이전트가 "매 턴 주입"을
   스스로 할 수 없음.
3. **PostCompact 의존성**: KEEP #4 `post-compact-resetting-reinject-cursor`는
   `lastInjectedPhase = null`로 리셋만 함 (hook.ts:731). 실제 재주입은 이
   UserPromptSubmit hook의 mode 2가 수행. 이걸 제거하면 KEEP #4가 무의미해짐.
4. **agbrowse 검색 directive 주입** + goal-mode interview 억제 (L11/L17) +
   `injectedTurns` 상태 기록.

→ **재분류: KEEP.** "trigger 감지" 부분만 implicit skill이 보완하는 관계이지 대체 관계가 아님.

## Finding 2 (Major): `subagent-stop-verifying-evidence`는 004의 자체 기준으로 KEEP

004는 "결과에 패턴 있는지 체크 → 경고 수준"이라 했으나, `subagent-evidence.ts`는
`decision:"block"`으로 **worker 자식의 턴을 직접 re-prompt하는 fail-closed 게이트**다
(MAX_ATTEMPTS=3 bounded). 메인 에이전트는 자식이 끝난 *후에야* 결과를 보므로,
자식이 끝나기 전에 잡아 되돌리는 이 동작을 skill 규칙으로 재현할 수 없다.
004의 KEEP 기준 "Hard gate (차단/거부)"에 정확히 해당.

→ **재분류: KEEP.**

## Finding 3 (Minor): friction capture 제거 시 Stop hook 부가기능 상실 + 스키마 불일치

- KEEP #2 Stop hook의 `buildStopBlock`은 `peakFrictionVerdict(cwd)`로
  `.codexclaw/friction.jsonl`을 읽어 escalate 조언을 붙임 (hook.ts:664).
- `post-tool-use-capturing-shell-friction` 제거 시 이 파일이 안 쌓여 verdict가 항상
  null → fail-open이라 깨지진 않지만 기능은 소실.
- 000_plan의 흡수 규칙은 "friction.log에 기록"이라고 썼으나 실제 파일은
  **friction.jsonl + (tool, normalized-error) signature 스키마**. 에이전트가 자유
  포맷으로 쓰면 `peakFrictionVerdict`가 파싱 못 함.

→ 선택지: (a) capture hook 1개만 유지하고 advise hook만 제거, (b) 기능 소실을
  수용하고 dev skill 규칙은 파일 기록 없이 "반복 에러 시 접근 전환"으로만 명시.
  권고: **(b)** — 단순함 우선, 필요 시 복원.

## Finding 4 (Info): recall 3종 + edit-shape + project-rules 제거는 소스 확인 결과 타당

- recall hooks: `additionalContext` 주입만 하는 순수 advisory (recall/src/hook.ts) — 제거 OK.
- edit-shape: one-time nudge advisory — 제거 OK.
- project-rules: `.codexclaw/rules/` 부재 + root AGENTS.md도 부재 → 이 리포에선
  현재 완전 무음(no-op) 상태 (B-phase 리뷰어 정정: "중복"이 아니라 "무음").
  AGENTS.md 있는 리포에서만 네이티브 주입과 중복이 됨. 어느 쪽이든 제거 OK.

## Finding 5 (Info): latency 추정 보정

004의 "user message → 0 hook"은 Finding 1 반영 시 "user message → 1 hook (pabcd,
recall만 제거)"로 보정. Bash 0, apply_patch 1(lint), session-start 1(bridge)은 유지.

---

## 수정된 최종 분류: KEEP 10 / REMOVE 7

KEEP (10) = 기존 8 + `user-prompt-submit-checking-pabcd-trigger`
  + `subagent-stop-verifying-evidence`

REMOVE (7):
1. post-tool-use-capturing-shell-friction (기능 소실 수용, Finding 3-b)
2. pre-tool-use-advising-on-friction
3. post-tool-use-detecting-edit-shapes
4. session-start-injecting-project-rules
5. session-start-advertising-recall
6. user-prompt-submit-suggesting-recall
7. post-compact-suggesting-recall

## Phase 1/2 재확인

- implicit 현황 실측: 23 skill 중 `dev`만 true — 000_plan 기술과 일치.
- 6개 승격 대상의 openai.yaml 구조 동일 (`policy.allow_implicit_invocation`) — 작업 그대로 유효.
- agbrowse: dev SKILL.md 한 줄 추가 방안 유효. 추가 확인 — UserPromptSubmit hook에
  이미 `AGBROWSE_SEARCH_DIRECTIVE` 주입 경로가 있으므로(hook.ts) dev 한 줄과 이중
  안전망이 됨. hook 쪽은 Finding 1로 KEEP이므로 그대로 시너지.

## 판정

- Phase 1 (implicit 6개): **Go**
- Phase 2 (agbrowse note): **Go**
- Phase 3 (hook diet): **Go with amendments** — 17→10 (9개 아닌 7개 제거),
  hook json은 `_deprecated/`로 이동
- Phase 4 (dormant pool): 기존대로 optional, Phase 1-3 후 판단
