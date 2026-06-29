# L11 (Decade 110) -- Goal-Mode Interview Hard Deny

Status: FROZEN (Q-GM-1-f resolved, codex-rs 실측 jun 2026-06-30; impl pending)
Cluster: 1 - IPABCD Interview completion - Phase: 1 - Shorthand: cxc
Source-of-record: 022.3, 023, 023.1, 080

## Resolved (jun 2026-06-30) -- goal-active 소스 확정 + 왜 hard-deny가 필수인가
- **goal 생명주기는 codex 내장 위임**(A 구조). codexclaw는 goal을 만들지 않고 FSM만 소유.
- **goal-active 감지 소스 = codex `goals_1.sqlite`를 thread_id(=hook payload의 `session_id`)로
  READ-ONLY 조회.** hook payload에는 goal 필드가 없음(INDIRECT). 자체 `.codexclaw/goal-active`
  마커는 만들지 않는다(폐기). 근거: `codex-rs/hooks/src/schema.rs:273/540/561`(goal 필드 없음),
  `codex-rs/state/src/lib.rs:82`(`goals_1.sqlite`), `state/goals_migrations/0001_thread_goals.sql:2`
  (PK `thread_id`), `state/src/model/thread_goal.rs:11`(status Active/.../Complete).
- **hard-deny가 필수인 이유**: codex의 goal 게이트 억제는 PARTIAL — continuation 프롬프트는
  "계속 전진"만 있고(`codex-rs/core/templates/goals/continuation.md`), "묻지 마"나
  `request_user_input` 비활성화는 **없다**(`request_user_input`은 mode/feature 기반,
  goal 기반 아님; `core/src/tools/handlers/request_user_input_spec.rs:85`). 따라서 "goal 모드
  인터뷰/`request_user_input` 금지"는 codexclaw PreToolUse hook이 직접 enforce해야 한다. 이것이
  HITL(IDLE-IPABCD)과 HOTL(goal) 모드 경계를 지키는 지점이다(006 설계철학).
- **실패 모드**: goal sqlite를 읽을 수 있으나 파싱 불가하면 fail-closed(deny 쪽으로). DB 자체가
  없으면(=goal 미사용 codex) goal-inactive로 간주, 정상 인터뷰 허용.

## Goal (one slice)
Add defense-in-depth enforcement so goal mode cannot enter Interview and cannot
call `request_user_input`.

This loop turns the Phase 1 advisory rule into a hard runtime deny. The
goal-active read path is now PROVEN: read `goals_1.sqlite` by `thread_id`.

## Why now / dependencies
L8 must define "interview state must not mutate in goal mode." L10 must define
the frozen spec that goal-mode PABCD consumes read-only.

L11 completes Cluster 1 by making the Interview -> freeze -> goal handoff safe:
after goal starts, only PABCD repeats; I never reopens.

## Scope (decision-complete)
- Files to add/edit after unblock:
  - `plugins/codexclaw/components/pabcd-state/src/hook.ts`
  - `plugins/codexclaw/components/pabcd-state/src/cli.ts`
  - `plugins/codexclaw/components/pabcd-state/src/goal-active.ts` (NEW: read-only
    `goals_1.sqlite` lookup by thread_id under `$CODEX_HOME`; returns
    active|inactive|unreadable)
  - `plugins/codexclaw/components/pabcd-state/test/hook.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/cli.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/goal-active.test.ts` (NEW)
  - PreToolUse matcher configuration owned by the codexclaw plugin, exact path
    to be filled from the existing hook layout.
- Enforce:
  - If a codex goal is active, suppress I-phase directive injection.
  - If a codex goal is active, deny `request_user_input`.
  - If a codex goal is active, do not create or update `state.interview`.
  - If a goal needs missing facts, use autonomous backfill only:
    `verified fact`, `contradiction`, or `assumption`.
  - User-only gaps become deferred high-severity assumptions, not interview
    questions.
- T12 checklist:
  - reconcile fail-open hook behavior with hard-deny expectations.
  - state read/write failure during active interview gating must not silently
    erase enforcement.
  - if fail-closed is not possible in the hook process, report the exact
    degraded guarantee in CLI stdout and tests.
- Must-NOT-Have:
  - No `request_user_input` in goal mode.
  - No plain-text "quick interview" fallback.
  - No new I-phase goal type in MVP.
  - No self-built goal store / no `.codexclaw/goal-active` marker (codex owns goal state).
  - No prompt-only claim of hard deny.

## IPABCD micro-cycle
- I (if interview-bearing): Not applicable in goal mode. Any user request for
  interview while a goal is active must be rejected or deferred until goal mode
  is inactive.
- P: Wire the proven goal-active source (`goals_1.sqlite` by thread_id), add the
  PreToolUse deny matcher for `request_user_input`, and keep UserPromptSubmit
  suppression aligned.
- A: Security reviewer checks for bypasses: direct tool call, advisory-only
  directive, state-write failure, and active-goal backfill disguised as
  interview.
- B: Implement goal-active read, PreToolUse denial, suppression tests, and CLI
  diagnostics.
- C: Run hook/CLI node tests and one manual CLI stdout check showing denial
  reason while goal mode is active.
- D: Done = active goal mode cannot trigger I, cannot call `request_user_input`,
  and cannot mutate interview tracker state.

## Acceptance (1-3 testable criteria)
1. With goal active, a synthetic `request_user_input` PreToolUse event is denied
   with an explicit goal-mode reason.
2. With goal active, interview trigger text does not inject the interview
   directive and does not create `state.interview`.
3. With goal inactive, normal L8-L10 interview behavior remains available.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test plugins/codexclaw/components/pabcd-state/test/hook.test.ts`
- `node --test plugins/codexclaw/components/pabcd-state/test/cli.test.ts`
- CLI stdout: `cxc goal doctor` or equivalent reports the goal-active source and
  whether the `request_user_input` hard deny is installed.

## Commit unit (one atomic conventional commit)
`fix(goal): deny interview user input during goal mode`

## Blocked-on (jun decision id, if any)
### Q-GM-1-f -- RESOLVED (jun 2026-06-30)
Resolved source = read-only `goals_1.sqlite` lookup by `thread_id` (= hook
`session_id`). Failure behavior = fail-closed when DB exists but a goal row is
present-yet-unreadable; goal-inactive when no DB / no row. No marker file, no
prompt-only deny. Implementation proceeds in B; no further jun decision needed.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/022.3_interview_goalmode_rules.md`
- `devlog/_plan/260629_codexclaw_mvp/023_goal_creation_gate.md`
- `devlog/_plan/260629_codexclaw_mvp/023.1_interview_ipabcd_prompts.md`
- `devlog/_plan/260629_codexclaw_mvp/080_pass8_interview_hardening_plan.md`
- `codex-rs/core/src/goals.rs`
- `codex-rs/protocol/src/request_user_input.rs`
- `codex-rs/state/src/lib.rs:82` (goals_1.sqlite), `state/goals_migrations/0001_thread_goals.sql:2`
- `codex-rs/state/src/model/thread_goal.rs:11` (ThreadGoalStatus)
- `codex-rs/hooks/src/schema.rs:273/540/561` (no goal field in hook payloads)
- `codex-rs/core/src/tools/handlers/request_user_input_spec.rs:85` (mode/feature based, not goal based)
