# L6 / 060 — Stop-Continuation Loop (omo two-guard pattern)

Status: P (plan) · 2026-06-30 · mvp_hard loop L6 · class C3 (turn-control behavior, cross-session)

> The Stop hook is registered and wired (`stop-checking-pabcd-continuation.json` →
> `cli.js hook stop`) but `handleStop` is a no-op (passive Pass 2). L6 makes it active:
> when a PABCD cycle is genuinely in flight, Stop returns `{"decision":"block","reason":
> <directive>}` to keep the agent going, with omo's TWO termination guards so the loop
> both starts and ends correctly.

## The continuation signal (codexclaw has no omo checklist)

omo blocks while a boulder checklist has `remaining > 0`. codexclaw has no per-task
checklist; its "work remaining" signal is: **an active goal AND a mid-cycle PABCD
phase** (phase ∉ {IDLE}). Rationale:
- IDLE = no cycle in flight → nothing to continue (let the turn end).
- A work phase I/P/A/B/C/D with `orchestrationActive` = a cycle is running → if the
  user/goal wants autonomy, nudge the agent to advance it.
- Gated by an ACTIVE goal so a plain interactive session (no goal) never gets trapped
  in a block loop — interactive PABCD pauses for the human at P/A/B by design.

So: **block iff** `goalActive AND orchestrationActive AND phase !== "IDLE"` AND neither
termination guard fires.

## The two termination guards (must-copy from omo)

1. `if (stop_hook_active) return "";` — the Stop hook is re-entrant; when codex reports
   it is already in a stop-hook-driven continuation, returning "" releases the turn.
   Without this the block loop never ends.
2. State guard — return "" (allow stop) when there is nothing to continue:
   `phase === "IDLE"` (cycle closed) OR goal inactive/unreadable OR orchestration not
   active. Without this the loop never starts correctly / blocks a finished cycle.
   Plus the existing context-pressure tail bail (don't pile on during compaction).

## Reference (verified)

- omo runStopHook: guard `stop_hook_active`, context-pressure bail, state===null release,
  else `{decision:"block",reason}` ([codex-hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/codex-hook.ts:6)).
- codexclaw passive handleStop ([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts) handleStop).
- StopPayload already carries `stop_hook_active`, `transcript_path`, `session_id`, `cwd`.
- goal-active status reader ([goal-active.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/goal-active.ts:62)).
- context-pressure tail detector ([transcript.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/transcript.ts)).

## File change map (IN scope)

1. MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`
   - Rewrite `handleStop(payload)`:
     - guard 1: `if (payload.stop_hook_active) return "";`
     - read state; guard 2a: `if (!state.orchestrationActive || state.phase === "IDLE") return "";`
     - guard 2b: `if (getGoalActiveStatus(payload.session_id) !== "active") return "";`
       (only an ACTIVE goal arms the autonomous block loop; interactive sessions pause.)
     - context-pressure bail: `if (isContextPressureTail(readTranscriptTail(transcript_path))) return "";`
     - else return `buildStopBlock(state.phase)` =
       `JSON.stringify({decision:"block", reason:<continuation directive for state.phase>})`.
   - NEW `export function buildStopBlock(phase): string` — the `{decision:"block",reason}`
     envelope; reason = a short "continue the cycle: you are in <phase>, self-advance with
     orchestrate <next> --attest …" directive (reuses phaseDirective + the footer rule).
2. MODIFY tests `test/hook-continuation.test.ts` (the right home):
   - stop_hook_active=true → "" (guard 1).
   - IDLE / orchestration inactive → "" (guard 2a).
   - active goal + mid-cycle phase (e.g. B) + not stop_hook_active → `{decision:"block"}`
     naming the phase (use the goal-active dep injection already used in this file).
   - goal inactive → "" even mid-cycle (interactive pause, guard 2b).
   - context-pressure tail → "" (bail).

## Scope boundary

- IN: `handleStop` rewrite + `buildStopBlock` + continuation tests.
- OUT: `$cxc-goalplan`/`$cxc-loop` skills (L7) — L6 reuses the EXISTING goal-active DB
  signal; it does not create goal state. No new state fields. The Stop hook JSON
  registration already exists (no manifest change).

## Accept criteria (testable)

- `handleStop` returns "" when `stop_hook_active` is true (guard 1), when phase is IDLE
  or orchestration inactive (guard 2a), when no active goal (guard 2b), and under
  context pressure.
- `handleStop` returns a `{"decision":"block","reason":...}` JSON string naming the
  current phase when goalActive + orchestrationActive + mid-cycle + none of the guards.
- The existing passive-Stop test (`handleStop: always '' ...`) is updated to reflect the
  new active behavior (it currently asserts always "").
- `npm test` green (count grows); `npm run build` idempotent.

## Risk / rollback

- Risk: a block loop that never terminates. Mitigation: BOTH omo guards (stop_hook_active
  + IDLE/inactive) plus the active-goal gate; an interactive (no-goal) session can never
  enter the loop. Test each guard independently.
- Risk: blocking a session the user wants to end. Mitigation: only an ACTIVE goal arms it;
  `orchestrate reset` (→IDLE) or goal pause/cancel releases it immediately.
- Rollback: restore `handleStop` to `return ""` (one-line revert); no state/schema change.

## Audit focus (for A gate)

- Are the two guards sufficient to guarantee termination? Walk: cycle closes (D→IDLE) →
  guard 2a releases. Goal paused/cancelled → guard 2b releases. stop_hook_active set by
  codex on the continuation turn → guard 1 releases.
- Does keying the block on `orchestrationActive && phase!==IDLE` correctly avoid trapping
  an interactive session that legitimately pauses at P/A/B? (The active-goal gate is the
  backstop — confirm interactive sessions have no active goal.)
- Is `{decision:"block"}` the correct codex Stop output shape (vs the
  hookSpecificOutput/additionalContext envelope used for UserPromptSubmit)? Confirm
  against omo + codex-rs stop event.

## Audit verdict (A gate — independent reviewer, 2026-06-30) — BLOCKED, then revised

First audit returned **PLAN BLOCKED**: the termination proof was invalid because
`handleStop` does not advance state, so a continued turn that fails to transition can
re-block at the same phase forever (agent forward edges are attest-gated, so a stalled
agent never progresses). Confirmed-correct: the `{decision:"block",reason}` Stop shape,
`StopPayload.session_id` as the goal key, and interactive (no-goal) release.

### Revision (folds the blockers in; re-audited below)

1. **STAGNATION GUARD (the missing termination proof)** — add a bounded
   consecutive-same-phase block counter so the loop ALWAYS terminates even if the agent
   never advances:
   - New State fields: `stopBlockPhase: Phase | null` and `stopBlockCount: number`
     (added to `state.ts` defaultState + strict reconstruction, default null/0).
   - In `handleStop`, before blocking: if the current phase equals `stopBlockPhase`,
     increment; else reset to this phase with count 1. If the count would exceed
     `MAX_STOP_BLOCKS` (e.g. 3), RELEASE (`return ""`) — the agent is stuck; do not trap.
   - On any successful transition (UserPromptSubmit wire OR CLI), reset
     `stopBlockPhase=null, stopBlockCount=0` (progress detected). This is the
     "progress resets the stagnation counter" signal the auditor required.
   - Persist the counter when blocking (so it survives across Stop turns).
2. **`stop_hook_active` fail-open** — treat a missing/non-boolean `stop_hook_active` as
   "active" (release) rather than blocking: `if (payload.stop_hook_active !== false) ...`
   No — be explicit: release when `stop_hook_active === true` OR when it is undefined
   AND we cannot prove a fresh turn. Simplest safe rule: `if (payload.stop_hook_active)
   return "";` AND the stagnation guard bounds the rest. Keep the parser accepting
   undefined (fail-open via the stagnation cap).
3. **Autonomous D-close** — the CLI agent path advances C->D but does not close to IDLE.
   For L6's termination, the Stop directive at phase D tells the agent to close the
   cycle (`cxc orchestrate reset` or a new explicit close), and the stagnation guard
   guarantees release if it doesn't. (A full autonomous D->IDLE verb is L7/goal-loop
   territory; L6 only must PROVE the loop cannot trap — the stagnation cap does that.)
   Document that D is a terminal-of-cycle: blocking at D nudges close, capped by the guard.
4. **Test-injection reality** — `hook-continuation.test.ts` uses a temp sqlite DB +
   `CODEX_SQLITE_HOME`, not injected `GoalActiveDeps`. handleStop will read goal status
   via the same `getGoalActiveStatus(session_id)` env path; tests set up the temp DB the
   same way the existing L11 tests do. (No new DI surface required.)
5. **Added release tests**: stop_hook_active=true; IDLE/inactive orchestration; no active
   goal (inactive); paused/cancelled (maps to inactive); unreadable DB (fail-closed
   release); context-pressure tail; AND the stagnation cap (same phase blocked
   MAX_STOP_BLOCKS times → release); AND progress resets the counter.

### Revised termination proof

The loop terminates via ANY of: (a) guard 1 `stop_hook_active`; (b) cycle closes to IDLE
(guard 2a); (c) goal no longer active (guard 2b); (d) context pressure; (e) the NEW
stagnation cap — after `MAX_STOP_BLOCKS` consecutive blocks at the same phase with no
transition, Stop releases unconditionally. (e) is the backstop that makes termination
total: even an agent that never advances and a goal that stays active cannot loop more
than `MAX_STOP_BLOCKS` times. Progress (a real transition) resets the counter so a
healthy multi-phase cycle is never prematurely released.

### Revised file change map additions

- `state.ts`: add `stopBlockPhase`/`stopBlockCount` to `State`, `defaultState`, and the
  strict `readState` reconstruction (fail-safe defaults).
- `fsm.ts` transition() OR the apply/CLI persist sites: reset the two fields on a
  successful phase change. (Cleaner: reset in the persist sites — hook wire + CLI — to
  keep `transition()` pure. Decide in build; prefer the persist sites.)
- `hook.ts`: `handleStop` implements guards + stagnation cap + `buildStopBlock`.

### Re-audit verdict (A gate, revision) — 2026-06-30

**PLAN OK with fixes** (no remaining blockers). Termination is now total: worst case
(active goal, agent never transitions, `stop_hook_active` absent) accumulates
`stopBlockCount` per persisted block and releases after `MAX_STOP_BLOCKS`. Strict
`readState` MUST gain explicit reconstruction lines for the two fields or accumulation
breaks across turns. Reset the counter ONLY at real transition persist sites — hook-wire
transition write, CLI reset write, CLI phase-transition write — NOT in the passive/loose
UserPromptSubmit injection writes. `MAX_STOP_BLOCKS=3` with reset-on-progress gives each
phase its own budget, so a healthy P→A→B→C→D never hits the cap.
