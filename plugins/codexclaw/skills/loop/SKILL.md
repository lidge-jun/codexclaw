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

## Contract

- `cxc-loop` is an overlay on `cxc-pabcd`, not a replacement. Before claiming a
  loop is active, follow `cxc-pabcd` phase semantics and enter a real PABCD state
  with `cxc orchestrate I|P` (or the human free-pass chat surface).
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
- One work-phase maps to one full PABCD cycle.
- D closes the current work-phase and returns the phase to `IDLE`.
- If work remains and a goal is active, **the agent** starts the next work-phase by
  running `cxc orchestrate P` after recording evidence. Nothing transitions the phase
  automatically — the Stop hook only blocks premature termination so the agent does
  this; it never re-enters `P` for you (see Stop-continuation below).
- There is no I -> P auto-advance. The agent advances every phase, including I -> P,
  by running the explicit `cxc orchestrate <phase> --attest` command. The hook does
  not move phases AUTONOMOUSLY. (It does persist a transition when the agent submits an
  explicit chat `orchestrate <verb>` command — that is the agent acting, not the hook
  advancing on its own. Nothing transitions without an explicit agent/CLI command.)
- The Stop guard blocks termination based on coarse state signals (active goal +
  in-flight cycle + stagnation budget), not a content check for "pending work." It
  keeps the turn alive so the agent can self-advance; the agent decides whether real
  work remains.
- When a goalplan is bound to the session (`cxc loop init --session`), the block
  reason MAY also name the next concrete task + the evidence it should produce + the
  goalplan ledger path. This is text enrichment only: it does not gate on that content,
  does not change when the hook blocks vs releases, and never transitions a phase. With
  no bound goalplan the reason is unchanged.
- Goal mode is PABCD-only: while a goal is active the Interview NEVER fires (entry is
  suppressed and `request_user_input` is hard-denied). The Interview is HITL-only and
  runs only with no active goal; the Stop hook never drives the Interview.

## HOTL Goal-Setting Rule

When entering HOTL mode, the main agent MUST create a host goal with
`create_goal` before relying on Stop-continuation. The objective should be
detailed, concrete, and approach the host limit of 5000 characters.

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

When the objective maximizes a score/metric against an evaluator, apply the
plateau discipline owned by `cxc-pabcd` (LOOP-PHASE-DEATH / LOOP-CONTINUITY /
CANDIDATE-ANCHOR / GATE-ORACLE-VALIDITY): track discarded candidates by
killing phase + change class and after N consecutive same-class deaths (start
N=3, tune per domain) target the evaluation gate itself; each new work phase
quotes the previous conclusion from the ledger; source candidates from
domain-state evidence, not only existing parameters; an optimistic local proxy
is never sole acceptance evidence.

### Goal state

codexclaw does NOT own a goal store. Goal state lives in the host Codex
`goals_1.sqlite`; the `pabcd-state` goal-active gate reads it read-only to
decide HITL vs HOTL. An ACTIVE goal is what ARMS the L6 Stop-continuation loop:
while a goal is active and a PABCD cycle is in flight, the Stop hook BLOCKS
premature termination (it returns `{decision:"block"}`) so the agent keeps
self-advancing with explicit `cxc orchestrate <phase> --attest ...` commands
(agent-gated). The hook does NOT transition phases AUTONOMOUSLY and does NOT
re-enter `P` itself — it only persists a transition in response to an explicit
chat `orchestrate <verb>` command (the agent acting). After the agent closes a
cycle to IDLE, the AGENT runs `cxc orchestrate P` to start the next work-phase.
Without an active goal, the loop never arms and PABCD pauses for the human
(HITL).

This is goalplan discipline: represent goals, work phases, success criteria,
checkpoints, evidence, and OPEN ASSUMPTIONS. It does not create a new goal
database.

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
- **Audit completion against current repo state, not memory.** Before any `D`/completion claim,
  inspect the actual tree/build/tests — a remembered "it passed" is not evidence (see `dev`
  FAMILY-PROOF-01).
- **Read durable state first.** When a goalplan is bound, use `cxc loop show` for the summary
  and inspect `.codexclaw/goalplans/<slug>/goalplan.json` + `ledger.jsonl` directly for full state,
  to recover which work-phases/criteria remain before planning the next pass.
- **IDLE is not the end while work remains.** After `D` closes to IDLE, if any work-phase or
  unmet criterion remains under an active goal, start the next work-phase at `P`.

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

## Loop archetype by problem type (LOOP-ARCHETYPE-01)

Classify the work-phase before choosing the loop shape:

- **Spec-satisfaction repair** — the verifier defines done (tests, typecheck,
  contracts, acceptance criteria). Keep one strategy, run the repair loop above, and
  collapse at P once the plan is checkable.
- **Open-ended optimization explore-and-select** — the verifier defines better, not
  done (scores, win rates, adversarial evaluators). Generate diverse candidates from
  domain-state evidence, evaluate them on the same instances, keep best-so-far, and
  regenerate from the winner. If the verifier only reports scalar outcome, add telemetry
  before candidate work. Stop on plateau or resource budget; the terminal outcome is
  `BUDGET_EXHAUSTED` with best-so-far evidence, not `DONE`, unless the plan named a fixed
  pass threshold up front.

A repair loop applied to an optimization problem is a category error; change the loop
shape instead of adding more cycles.

## Analysis before regeneration (LOOP-REANALYZE-01)

In explore-and-select loops, each generation starts with an analysis deliverable before
new patches or candidates:

- **Updated problem/opponent model** from telemetry, replays, failure deltas, or other
  evidence: what actually happened, and what does it imply?
- **Capability-gap hypotheses** naming what the artifact cannot yet sense or do. A gap
  may expand the allowed patch surface, but only through a P-phase amendment.

Source the next candidates from those hypotheses and quote them in the next P via
`cxc-pabcd` LOOP-CONTINUITY-01. A generation that regenerates straight from scores is a
repair loop wearing an explore costume.

## Emergence / Divergence Layer

PABCD is convergence-first by default. For ordinary build or bug-fix goals, keep one
strategy and execute it. Divergence is a **PABCD-layer mode** and the Codexclaw
machinery for the open-ended-optimization archetype above, not a standing habit: it can
be selected deliberately in HITL PABCD during I/P, or automatically prompted in goal
mode when a maximize objective records non-improving metrics (`cxc metric`) and the
Stop hook emits the objective-plateau directive. The plateau-triggered mode is the
shipped automatic entry, not the only valid entry.

In HITL PABCD, use deliberate I/P divergence when the user's intent is open, the
algorithmic approach is genuinely uncertain, the objective is maximize/deceptive, or
the user explicitly asks to compare alternatives. The P/A/B pause semantics remain:
no hook builds candidates, races worktrees, or bypasses confirmation. In goal mode,
the Stop hook can only keep the turn alive and tell the agent to re-plan; it still
does not ask the user or move phases by itself.

When divergence is ON:

- Record mode explicitly: `cxc divergence mode --session <id> on --collapse P|D --reason <why>`.
- I/P records at least two candidates in the archive. If the user intent is clear, do
  not ask a fake menu question; record `strong-1` plus `add-1` silently. If intent is
  genuinely open, ask the user to choose or constrain the candidates.
- Every candidate must carry `cxc-search` provenance: `strong-1` should be Tier 2
  proven; `add-1` must be at least Tier 1 discovered. Record it with
  `cxc divergence candidate add ... --source <url>`.
- When candidate work happens in a git worktree, record archive entries into the owner
  worktree, not the child. Run `cxc divergence ... --cwd <owner-repo-root>` from child
  worktrees so the collapse owner sees every candidate.
- Collapse early at P for satisfy-spec work (pass/fail, locally checkable). Collapse
  late at D for maximize-metric work where the local metric can deceive: build
  candidates in isolated worktrees, run the same `evaluate.sh`, then keep/discard by
  the recorded metric.
- For maximize goals, build or validate `evaluate.sh` before any candidate build. It
  must be deterministic, use fixed seeds/folds, and emit `METRIC name=value`; ingest
  with `cxc metric ingest --session <id>`.
- If local metrics improve while holdout/true metrics stall or fall, treat it as an
  overfitting stop signal. Do not celebrate or keep the candidate without a re-plan.
- After the plateau is broken or a candidate is kept/discarded, turn divergence off:
  `cxc divergence mode --session <id> off --reason resolved`, then return to the
  normal N=1 loop.

This section is E7 doctrine plus project-local evidence files. The only shipped E2
lever is the goal-mode Stop hook's plateau block; HITL divergence entry is valid but
human/agent selected, not hook-enforced. Worktree creation, harness execution, and
candidate races are still agent-executed work, not background automation. The
`.codexclaw/divergence/` files are durable evidence, not an automatic control source;
forgotten active mode cannot move phases or build candidates by itself.

## Stop-continuation (shipped, L6)

The continuation is enforced by the active Stop hook (`handleStop`), not just this
discipline doc. It returns `{"decision":"block","reason":...}` to keep the agent
advancing while a PABCD cycle is in flight under an ACTIVE goal. Termination is total
via:

- **Guard 1** — `stop_hook_active`: codex is already in a continuation → release.
- **Guard 2** — phase is `IDLE` / orchestration inactive / no active goal → release
  (a plain interactive session never enters the loop; it pauses for the human at P/A/B).
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
