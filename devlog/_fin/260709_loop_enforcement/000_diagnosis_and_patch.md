# 260709 — Deterministic loop enforcement (lazygap lineage)

Status: DONE (shipped + tested) · 2026-07-09 · class C3 (hook/runtime semantics)

> Source incidents (session forensics, this repo + jawcode):
> - `019f4407` (jawcode patches): goal created, PABCD never entered (no session state
>   file), agent self-completed the goal twice while printing its own REMAINING list.
>   Stop hook never blocked once — guard 2a released silently at IDLE.
> - `019f4456` (design-grammar propagation): `loop init` ran but `workPhases[]`/
>   `criteria[]` were never registered (ledger = one `created` row); the empty plan
>   passed `validateGoalplan` vacuously; a 6-minute silent `wait_agent` stretch read
>   as "stopped after one work-phase" and invited an interrupt.
> - Structural: old Stop guard 1 (`stop_hook_active` → unconditional release) capped an
>   armed HOTL loop at ONE forced continuation per turn — the "step-by-step cut".

## Shipped changes

1. **E8 empty-plan failure** — `goalplan.ts validateGoalplan`: a plan with zero
   `workPhases` AND zero `criteria` now fails with a register-the-plan reason.
2. **GOAL-COMPLETE-GATE-01** — `goal-gate.ts applyGoalCompleteGuard`, wired into
   `handlePreToolUseFailClosed` + new `hooks/pre-tool-use-guarding-goal-complete.json`
   (matcher `^update_goal$`, declared in `.codex-plugin/plugin.json`, now 13 hooks).
   Denies `update_goal {status:"complete"}` when a PABCD cycle is in flight or the
   session-bound goalplan fails E8. `blocked` always passes. Fail-open on IO errors.
3. **Stop guard rework** — `hook.ts handleStop`:
   - guard 1 removed; the per-phase `MAX_STOP_BLOCKS` stagnation cap (shared helper
     `bumpStopCounter`) is the single total-termination bound.
   - GOAL-IDLE-CONTINUE-01: ACTIVE goal + no in-flight cycle → bounded block
     (`buildGoalIdleBlock`) naming the `cxc orchestrate P --session <id>` arming
     command, goalplan remaining work / empty-plan registration / `loop init`, and the
     honest close-out. Counter write bootstraps the session state file, which also
     clears the G2 unknown-session guard for the suggested command.
4. **Docs** — `skills/loop/SKILL.md` (Completion gate section, Wait visibility
   LOOP-WAIT-VISIBILITY-01, Stop-continuation rewrite), `docs-site guides/pabcd.md`,
   `hook.ts`/`cli.ts` headers.
5. **LOOP-UNIT-CHAIN-01** (follow-up, same day) — the recurring "remaining features
   each need a separate PABCD → close the goal" misread is named and blocked as a
   doctrine rule: successive work-phases in ONE session chain HETEROGENEOUS units;
   an independent feature discovered mid-loop is appended to `workPhases[]` (P-phase
   amendment) and started at P, never a session boundary. Added to `loop/SKILL.md`
   (Contract + LOOP-CONTINUE-01 + goalplan schema note), `dev/SKILL.md` §0.4, and the
   `buildGoalIdleBlock` Stop reason so the deterministic nudge teaches it too.
6. **Cross-skill value audit** (same day) — swept every skill in
   codexclaw/pabcd_initiative/cli-jaw-skills for stop-value prose. Findings: the
   completion/goal vocabulary lives ONLY in the dev/pabcd/loop family (interview, qa,
   recall, search, etc. are clean). Patched for value alignment:
   - LOOP-UNIT-CHAIN-01 propagated to `pabcd/SKILL.md` (terminology, multi-pass
     slice-map append rule, §11.6 summary) and mirrored into
     `pabcd_initiative/skills/{dev,dev-pabcd}` (+`references/loop-engineering.md`)
     and `cli-jaw-skills/{dev,dev-pabcd}` (SoT==cli-jaw parity).
   - New loop value: **context pressure ≠ budget exhaustion** — "context is getting
     large" is a checkpoint-and-continue signal, never a goal-close reason
     (019f4407 closed its goal citing context). Added to `loop-engineering.md` §11.1
     (codexclaw + initiative), the §11.1 summaries, and `loop/SKILL.md` Terminal
     outcomes (also: a remaining-features list is not BLOCKED/NEEDS_HUMAN).
   - cli-jaw-skills `dev-pabcd` is a slim variant without §11/references; it received
     the chaining notes only (the pending loop-engineering backport is a separate,
     still-active goal: 019f235c).
7. **Cross-repo sync run** (same day, 3 chained PABCD work-phases on the `cli`
   terminal session — LOOP-UNIT-CHAIN-01 dogfood):
   - WP1 `cli-jaw/skills_ref` (submodule checkout of cli-jaw-skills at d5d99c8):
     dev + dev-pabcd got the chaining notes, append-friendly slice map, §11.1
     context-pressure value, §11.6 clause.
   - WP2 `jawcode` prompting: `prompts/goals/goal-continuation.md` +
     `goal-mode-active.md` (both continuation values), `prompts/jaw/orchestrate-d.md`
     (heterogeneous chaining on the loop-continuation ladder), `orchestrate-p.md`
     (append-friendly roadmap). Stale goal-runtime test assertions ("no budget
     language" — already red at HEAD) realigned to positive honest-terminal checks;
     goals suite 52/53 (1 pre-existing unrelated fail: goal-tool op describe drift).
   - WP3 gap-fix: cli-jaw-skills dev-pabcd got the context-pressure value; final
     grep matrix shows both values in all five locations. Note: cli-jaw-skills and
     cli-jaw/skills_ref are the SAME repo at different commits — commit in one,
     pull in the other.

## Verification

- `npm test` — 1000/1000 pass (updated: hook-continuation guard-1/2a; new: 4
  GOAL-IDLE cases, 7 goal-gate complete-guard cases, empty-plan validate case,
  goal-complete e2e deny/allow; GOAL-IDLE block asserts the LOOP-UNIT-CHAIN-01 line).
- `npm run build` — 100 files compiled; plugin cache is symlinked to the repo, so
  dist + new hook JSON are live for new sessions.
- `npm run gate` — OK (hook count 13/13 after manifest update).

## Out of scope / follow-ups

- Host semantics of `stop_hook_active` chains (how many Stop events fire per
  continuation chain) are host-owned; the cap bounds us regardless.
- `wait_agent` visibility is discipline text only (no hook can force commentary).
- No change to goal DB writes: codexclaw still never writes `goals_1.sqlite`.
