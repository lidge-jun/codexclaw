---
name: cxc-loop
description: "Use for Codexclaw PABCD work-loop planning and durable goalplans: HITL phase discipline, HOTL goal activation, work-phases, criteria, checkpoints, evidence ledgers, cxc-pabcd activation, repeated work-phases, divergence/collapse policy, Stop-continuation policy, and quality gates. Triggers: cxc-loop, loop, autonomous continuation, continue until done, HOTL, HITL PABCD, repeated PABCD, work-phase loop, goalplan, goal plan, success criteria, checkpoint, steering, quality gate, evidence ledger."
metadata:
  short-description: "PABCD continuation + durable goalplan + divergence/collapse loop contract."
---

# cxc-loop — Work-Phase Loop + Durable Goalplan

Use this skill for Codexclaw work loops that span one or more PABCD work-phases.
It covers both HITL PABCD (manual/user-confirmed phase movement) and HOTL goal
loops (Stop-hook continuation after D/IDLE).

## Orchestrate mandate (ORCH-MANDATE-01, STRICT)

A loop claim without persisted FSM evidence is INVALID. Narrating phases ("now I'm in
B", "audit passed") without their `cxc orchestrate` transitions is the exact
failure mode this rule exists to stop: the Stop hook never arms, the ledger stays
empty, and the "loop" is one ordinary turn wearing a loop costume. Mandatory sequence
for EVERY loop entry or re-entry:

1. Session id from YOUR most recent SessionStart binding line only (SESSION-IDENTITY-01).
2. `cxc orchestrate status --session <id>` — read the real phase before claiming any.
3. Arm the mode: HOTL -> `create_goal` + `cxc loop init` + goalplan registration +
   `cxc orchestrate P --session <id>`; HITL -> `cxc orchestrate I|P --session <id>`
   (or the human chat free-pass).
4. Advance the four gated work edges (P>A, A>B, B>C, C>D) with
   `cxc orchestrate <phase> --attest <json>` carrying the phase's real artifact
   (ORCH-ARTIFACT-01). Entry edges (IDLE→P, I→P) are explicit commands without an
   attest JSON — the shipped gate (`dist/attest.js` GATED_TRANSITIONS) gates exactly
   those four. A phase without its persisted transition did not happen — the
   footer/ledger is the only proof of phase.
5. After D closes to IDLE, read durable state (goalplan + ledger) to confirm remaining
   work, then re-enter P for the next work-phase with
   `cxc orchestrate P --session <id>`.

Work performed outside the FSM does not count as loop progress: re-enter and attest
it before building on it. Runtime companions (shipped): a loop/goalplan/
continue-until-done request hitting an UN-ARMED FSM gets the arming mandate injected
at prompt time (`LOOP_ARM_DIRECTIVE`, hook `UserPromptSubmit`), and an active goal
with no in-flight cycle gets the Stop-time block naming the arming command
(GOAL-IDLE-CONTINUE-01) — but neither companion moves a phase for you; the commands
remain yours to run.

## Contract

- `cxc-loop` is an overlay on `cxc-pabcd`, not a replacement. Before claiming a
  loop is active, follow `cxc-pabcd` phase semantics and enter a real PABCD state
  with `cxc orchestrate I|P --session <id>` (or the human free-pass chat surface).
  `<id>` is YOUR session id from the SessionStart binding line — never an id seen
  in transcript history (SESSION-IDENTITY-01, canonical in `cxc-pabcd` §Control
  surfaces; a forked session replaying its parent's id corrupts the parent's FSM).
- Choose the execution mode before the first work-phase:
  - **HITL loop:** PABCD is active, no ACTIVE host goal is required, and P/A/B
    remain human-confirmed pause points. The Stop-continuation hook will not arm.
  - **HOTL goal loop:** an ACTIVE host goal must exist AND a PABCD cycle must be
    in flight. The main session owns `create_goal`/`update_goal`; subagents never
    create or update host goals. If the user did not explicitly ask for
    autonomous / continue-until-done execution, stay HITL rather than silently
    creating a goal.
- Goal active without PABCD active is not a work loop; PABCD active without a
  goal is HITL, not HOTL. If either half is missing, activate the missing half or
  state the preflight failure instead of pretending Stop-continuation is armed.
  The Stop hook now enforces the arming half deterministically
  (GOAL-IDLE-CONTINUE-01): an ACTIVE goal with no in-flight cycle gets a bounded
  Stop block naming the arming command instead of a silent release, so "goal
  created but PABCD never entered" can no longer end a turn quietly.
- One work-phase maps to one full PABCD cycle. Successive work-phases in the SAME
  session may target completely different features, plans, or units
  (LOOP-UNIT-CHAIN-01 below) — the loop is a chain of cycles, not one feature's
  sub-steps.
- D closes the current work-phase and returns the phase to `IDLE`.
- Hooks may block or release termination and may enrich the block reason, but they
  never choose or advance a phase. Every transition requires an explicit agent-issued
  `cxc orchestrate` command; work edges carry `--attest`, while entry edges do not.
- The Stop guard blocks termination based on coarse state signals (active goal +
  in-flight cycle + stagnation budget), not a content check for "pending work." It
  keeps the turn alive so the agent can self-advance; the agent decides whether real
  work remains.
- A bound goalplan may enrich the block reason with the next task, expected evidence,
  and ledger path; this text does not affect blocking or transitions.
- Goal mode is PABCD-only: while a goal is active the Interview NEVER fires (entry is
  suppressed and `request_user_input` is hard-denied). The Interview is HITL-only and
  runs only with no active goal; the Stop hook never drives the Interview.

## HOTL Goal-Setting Rule

When entering HOTL mode, the main agent MUST create a host goal with
`create_goal` before relying on Stop-continuation. The objective should be
detailed, concrete, and approach the host limit of 4000 characters.

The objective must include:

- The concrete outcome to achieve.
- The file change scope and explicit out-of-scope boundaries.
- Acceptance criteria, including what counts as `DONE`, `NOOP`, `BLOCKED`,
  `UNSAFE`, `NEEDS_HUMAN`, or `BUDGET_EXHAUSTED`.
- Verification commands or evidence artifacts expected before each completion claim.
- The expected terminal outcome and the first work-phase to run.

A vague or short objective under 500 characters is a discipline violation for
HOTL mode. After `create_goal`, run `cxc loop init --objective "<same text>"
--session <id>` to create the durable local plan bound to the session.

After `loop init`, REGISTER the plan: fill `workPhases[]` (with tasks) and
`criteria[]` in the goalplan file before the first work-phase. An init-only
empty plan now FAILS `cxc loop validate` (E8), and `update_goal
{status:"complete"}` is hook-denied while the bound goalplan fails that gate
(GOAL-COMPLETE-GATE-01) — an unregistered plan cannot certify completion.

## Completion gate (GOAL-COMPLETE-GATE-01, shipped)

`update_goal {status:"complete"}` is gated by a deterministic PreToolUse hook,
not just discipline text. The hook DENIES the call when:

- a PABCD cycle is in flight (`orchestrationActive`, phase not IDLE/I) — close
  the cycle through D (or `cxc orchestrate reset`) first; or
- the session-bound goalplan fails the E8 gate (`cxc loop validate`): undone
  work phases, unmet criteria, `met` marks without `capturedEvidence`, or an
  empty unregistered plan.

`update_goal {status:"blocked"}` always passes — that is the honest escape
hatch for external blockers. The gate is fail-open on IO errors and never
fires for sessions without PABCD state or a bound goalplan. Do not shrink the
goalplan to slip past the gate; that is a LOOP-CONTINUE-01 violation and the
edit is visible in the ledger.

## Wait visibility (LOOP-WAIT-VISIBILITY-01, DEFAULT)

Long silent waits read as a dead loop to the user and invite interrupts that
kill the work-phase (019f4456: a 6-minute silent `wait_agent` stretch looked
like "stopped after one work-phase"). While waiting on subagents or long
external processes inside a loop:

- Prefer bounded waits (`wait_agent` with `timeout_ms` <= 120000) over one
  long blocking wait; between waits, emit a one-line progress update naming
  what is being waited on and the elapsed time.
- Never end the turn just because a wait timed out — re-wait or poll, and keep
  the user informed each cycle.
- If a reviewer/worker has produced nothing after ~3 wait cycles, treat it as
  a failed dispatch (DISPATCH-RETIRE-01) rather than waiting silently forever.
  That retirement CONSUMES the DISPATCH-RETIRE-01 same-agent retry: go straight
  to a fresh spawn with the failure folded into the new packet — the silent
  agent does not get a second retry.

## Speculative dispatch (DISPATCH-SPECULATE-01, HEURISTIC)

Dispatching phase-N+1 work while phase N is building is default-OFF. Only
phase-invariant external research that reads no repository state may overlap phases.
Mark its results `candidate — unverified`, then revalidate them against the landed tree
at the next P; discard them when the phase map changes. See DISPATCH-ECONOMY-01 in
`structure/20_pabcd_dispatch_doctrine.md` §3.

## Durable Goalplan

Use a durable goalplan when a Codexclaw loop needs more than a chat-local
checklist: goals, work phases, success criteria, checkpoints, evidence,
Interview OPEN ASSUMPTIONS, steering decisions, and quality gates.

### Contract

- Represent goals, work phases, success criteria, checkpoints, and evidence.
- Carry Interview OPEN ASSUMPTIONS into Plan/Audit instead of dropping them.
- Record steering decisions with rationale and evidence.
- Reject steering that weakens completion criteria or verification.
- Require a quality gate before final completion.

### Shipped schema

This is the on-disk shape under `.codexclaw/goalplans/<slug>/goalplan.json`
(+ `ledger.jsonl`). Fill these fields; do not invent parallel ones:

- `objective`, `slug`, `createdAt`, `updatedAt`.
- `workPhases[]` — each `{ id, title, status: pending|in_progress|done, tasks[], criteriaIds[] }`;
  `tasks[]` are `{ id, title, status: pending|done }`; `activeWorkPhaseId` marks the current one.
  `workPhases[]` is APPEND-friendly mid-loop: when a new independent unit is discovered
  (LOOP-UNIT-CHAIN-01), add its work-phase (+ criteria) as a P-phase amendment instead of
  treating the plan as frozen at init or ending the goal.
- `criteria[]` — each `{ id, scenario, expectedEvidence, capturedEvidence, status: open|met }`.
  A criterion only reaches `met` when `capturedEvidence` is non-empty (fresh proof, not memory).
- `host` — `GoalplanHostLink { armed, armedAt, source: freeze|none }`. `armed` is provenance,
  intended to read true only after a freeze-boundary arm (the MAIN session created a host goal).
  No shipped CLI flips it automatically and codexclaw never writes the goal DB itself; treat it
  as the slot that records that boundary, not an auto-managed flag.

### CLI surface

- `cxc loop init --objective "<text>" [--session <id>]` — creates the local
  artifact and binds it to the session when a session id is supplied; it never
  writes the host goal DB.
- `cxc loop show --slug "<text>"` — renders the current plan summary.
- `cxc loop validate --slug "<text>"` — runs the E8 quality gate; it FAILS
  unless the plan is complete and every `met` criterion carries `capturedEvidence`.
- `cxc goalplan *` — deprecated alias for the same behavior during migration.

Ledger events are `created`, `workphase_started`, `workphase_done`,
`task_done`, `criterion_met`, and `host_armed`.

### Optimization-loop discipline

Full rules: `cxc-pabcd` §Optimization-Loop Meta-Rules, including LOOP-PHASE-DEATH and
LOOP-CONTINUITY. Summary:

Use the clarification column as the minimum evidence interpretation for each rule;
the action alone does not establish that an optimization mechanism is alive or that
the next cycle preserves what the previous cycle learned.

| Rule | Trigger | Action | Clarification |
|------|---------|--------|---------------|
| LOOP-MECHANISM-PROOF-01 | New branch/mechanism | Prove activation before adoption | Aggregate score movement alone is not activation proof. A zero-delta solo ablation means presume dead and instrument first. |
| LOOP-RESIDUAL-TRACE-01 | Residual failure | Record mechanism trace or `unexplained` | A plausible opponent story is not evidence that our own mechanism armed. Record actual branch traces. |
| LOOP-PEER-CONTRAST-01 | Peer succeeds on failed instance | Diff behaviors before generating | Compare the successful peer's activated branches and decisions against ours before proposing another mechanism. |
| LOOP-PHASE-DEATH-01 | Phase-local mechanism has no measured effect | Diagnose activation and observability before tuning | Repeated parameter changes cannot revive a branch that never activates; prove phase-local effect before continuing optimization. |
| LOOP-CONTINUITY-01 | Evidence changes the problem model | Carry hypotheses and traces into the next P | Each cycle must inherit the prior cycle's mechanism evidence, residuals, and rejected explanations instead of restarting from aggregate scores. |

### Goal state

The host owns goal state in `goals_1.sqlite`; codexclaw reads it read-only to decide
HITL vs HOTL. A goalplan records work phases, criteria, evidence, and assumptions; it
is not another goal database.

## HOTL resource bounds

Goal-mode loops are unattended. The P-phase loop-spec for each HOTL work-phase must
state the tool/credential scope, write scope, token/cost budget, and wall-clock bound.
For C4 surfaces, an unstated unattended scope is an ESCALATE-class omission: stop and
ask before starting or continuing the loop. Hitting a resource bound is
`BUDGET_EXHAUSTED`, not `DONE`.

## Continuation doctrine (LOOP-CONTINUE-01)

The Stop hook keeps the turn alive, but the agent decides what "remaining work" means. When
re-entering a loop or after a `D` close:

- **Do not redefine the objective downward.** The success criteria recorded at P (or in the
  bound goalplan `criteria[]`) are the bar; shrinking scope to escape the loop is not allowed.
- **"Needs its own PABCD" is not a session boundary (LOOP-UNIT-CHAIN-01).** An
  independent feature, an unrelated follow-up, or "the next plan" discovered mid-loop
  is just the NEXT work-phase of THIS session: append a `workPhases[]` entry (+ its
  criteria) to the bound goalplan — a P-phase amendment, visible in the ledger — and
  start it with `cxc orchestrate P --session <id>`. One session can chain arbitrarily
  many heterogeneous PABCD cycles under one goal. Closing the goal while listing
  remaining features that fit the objective ("each needs a separate PABCD") is the
  lazy-completion pattern GOAL-COMPLETE-GATE-01 exists to stop; the only honest
  reasons to end the loop instead of chaining are the Terminal outcomes below
  (BLOCKED / UNSAFE / NEEDS_HUMAN / BUDGET_EXHAUSTED) with evidence.
- **Audit completion against current repo state, not memory.** Before any `D`/completion claim,
  inspect the actual tree/build/tests — a remembered "it passed" is not evidence (see `dev`
  FAMILY-PROOF-01).
- **Read durable state first.** When a goalplan is bound, use `cxc loop show` for the summary
  and inspect `.codexclaw/goalplans/<slug>/goalplan.json` + `ledger.jsonl` directly for full state,
  to recover which work-phases/criteria remain before planning the next pass.
- **IDLE is not the end while work remains.** After `D` closes to IDLE, read durable state
  (goalplan + ledger) to confirm remaining work. If any work-phase or unmet criterion remains
  under an active goal, re-enter `P` for the next work-phase.

## Terminal outcomes

D is the success close-out only when the verifier proves the recorded criteria. Every
loop report must name the actual terminal outcome:

- `DONE` — verified success.
- `NOOP` — no change was needed.
- `BLOCKED` — an external dependency prevents progress.
- `UNSAFE` — proceeding needs a human risk decision.
- `NEEDS_HUMAN` — judgment or missing intent only the user can supply.
- `BUDGET_EXHAUSTED` — resources ran out; adopt best-so-far only with evidence and
  label it as such.

`BUDGET_EXHAUSTED` requires a bound the plan actually stated (tokens, cost,
wall-clock). Context pressure or an approaching compaction is NOT budget
exhaustion: memory lives on disk, so checkpoint the goalplan/ledger and continue
after the flush. Likewise a list of remaining independent features is NOT
`BLOCKED`/`NEEDS_HUMAN` — those are the next work-phases (LOOP-UNIT-CHAIN-01).

These are report outcomes, not extra FSM phases: the shipped state still closes through
`D` or `reset`, and the D summary states the real outcome.

## Repair-loop discipline (LOOP-REPAIR-01 / LOOP-DOOM-01)

The B/C inner loop is: implement -> run verifier -> read the failure delta -> repair
only that failing delta -> re-verify. Feedback that does not change the next action is
a retry, not a loop.

- **LOOP-REPAIR-01 (DEFAULT):** 2 consecutive failed repairs of the same failure stop
  patching and enter root-cause mode (`cxc-dev-debugging`). 3 failed repairs escalate:
  return to P with a changed plan, or return to Interview when HITL clarification is
  required.
- **LOOP-DOOM-01 (HEURISTIC):** 3 attestation failures in the same PABCD-phase within
  one work-phase means no-progress. In HITL, return to Interview. In HOTL, do not
  fake Interview while a goal is active; either replan at P from the evidence already
  available, or close the work-phase as `NEEDS_HUMAN`, `BLOCKED`, or `UNSAFE`.
- **REVIEW-SYNTHESIS-01 (pointer):** after a reviewer/verifier FAIL, record the
  synthesis (per-blocker RCA, cross-blocker conflicts, accept/rebut decisions) before
  re-patching or re-dispatching; a synthesis-free re-dispatch counts as a failed repair
  under LOOP-REPAIR-01. Canonical wording: `cxc-pabcd` §11.3. A-gate exit follows
  AUDIT-LOOP-01 (`cxc-pabcd` §A): only pass or main-judged near-pass exits A>B;
  FAIL re-enters the audit loop with the same reviewer.
- **Reviewer reuse across repair rounds (pointer):** blocker-closure re-verification
  rounds reuse the SAME reviewer — V2 `followup_task` to its task_name (triggers a
  turn when idle; `send_message` is context-only) or V1 `send_input` to its agent_id —
  passing the synthesis plus a change-diff summary so the reviewer keeps its context.
  The final C adversarial gate (or any contaminated reviewer) gets a fresh reviewer or
  a direct independent audit instead. Normative lifecycle rules: DISPATCH-ACTOR-01 /
  DISPATCH-RETIRE-01 in `structure/20_pabcd_dispatch_doctrine.md` §3.

## Loop archetype by problem type (LOOP-ARCHETYPE-01)

Classify each work-phase before choosing its loop:
- **Spec-satisfaction repair:** the verifier defines done; keep one strategy and collapse
  at P once the plan is checkable.
- **Open-ended optimization:** the verifier defines better; compare evidence-sourced
  candidates on common instances, retain best-so-far, and stop at the stated threshold,
  plateau, or resource bound.
A repair loop applied to optimization is a category error; change the loop shape.

## Analysis before regeneration (LOOP-REANALYZE-01)

Before regeneration, update the problem model from telemetry and name capability-gap
hypotheses. Source candidates from those hypotheses and carry them into the next P via
`cxc-pabcd` LOOP-CONTINUITY-01; raw scores alone are insufficient.

## Emergence / Divergence Layer

PABCD is convergence-first. Activate divergence deliberately during HITL I/P when intent
is open, the approach is uncertain, the objective is maximize/deceptive, or the user asks
to compare alternatives. In goal mode, non-improving maximize metrics may prompt it via
the Stop hook. Pause semantics remain: hooks neither build candidates nor move phases.

When divergence is ON:

- Record mode explicitly: `cxc divergence mode --session <id> on --collapse P|D --reason <why>`.
- Before executing Tier 1 or Tier 2 divergence, read
  `references/divergence-tiers.md` for candidate-document format, topology rules,
  and evaluator requirements.
- Select the cost tier under DIVERGE-TIER-01: Tier 0 inline concepts, Tier 1 conceptual
  candidate docs (default), or Tier 2 isolated executable races only for load-bearing
  conflicts that paper analysis cannot resolve.
- Collapse early at P for satisfy-spec work (pass/fail, locally checkable). Collapse
  late at D for maximize-metric work where the local metric can deceive: build
  candidates in isolated worktrees, run the same `evaluate.sh`, then keep/discard by
  the recorded metric.
- After the plateau is broken or a candidate is kept/discarded, turn divergence off:
  `cxc divergence mode --session <id> off --reason resolved`, then return to the
  normal N=1 loop.

Full tier mechanics, provenance, topology, and operational rules:
[`references/divergence-tiers.md`](references/divergence-tiers.md).

## Stop-continuation (shipped, L6)

The active Stop hook (`handleStop`) returns `{"decision":"block","reason":...}` under
an ACTIVE goal, including at IDLE when GOAL-IDLE-CONTINUE-01 names the next arming
command and remaining work. Termination remains bounded by:

- **Goal/phase guard** — no active goal → release (a plain interactive session never enters
  the loop; it pauses for the human at P/A/B, and IDLE without a goal stays silent).
  Phase `I` always releases (the Interview is HITL-only).
- **Context-pressure bail** — don't pile on during compaction recovery.
- **Stagnation cap** — a bounded `stopBlockCount` per phase; after `MAX_STOP_BLOCKS`
  consecutive blocks at the same phase with no transition, the loop releases so it can
  never trap a session. A real transition (chat or CLI) resets the counter, so each
  phase of a healthy P→A→B→C→D gets a fresh budget. This is the runtime companion to
  LOOP-DOOM-01, not a success signal; after release, apply the no-progress discipline
  before retrying the same phase.
- **Objective plateau block** — for active maximize goals with session-scoped metrics,
  two non-improving same-metric rows switch the block reason from plain continuation
  to "step back and re-plan with divergence." This still uses the same bounded
  `MAX_STOP_BLOCKS` release path and never asks the user inside goal mode.

### Stop decision matrix

| Condition | Decision |
|-----------|----------|
| No active goal, or phase I | Release |
| Active goal + in-flight cycle | Bounded block (continue phase) |
| Active goal + IDLE with remaining work | Block with arming command |
| Context pressure or stagnation cap exhausted | Release (not a success signal) |
