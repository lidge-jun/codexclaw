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
- If work remains and a goal is active, **the agent** starts the next work-phase by
  running `cxc orchestrate P --session <id>` after recording evidence. Nothing transitions the phase
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

When the objective maximizes a score/metric against an evaluator, apply the
plateau discipline owned by `cxc-pabcd` (LOOP-PHASE-DEATH / LOOP-CONTINUITY /
CANDIDATE-ANCHOR / GATE-ORACLE-VALIDITY): track discarded candidates by
killing phase + change class and after N consecutive same-class deaths (start
N=3, tune per domain) target the evaluation gate itself; each new work phase
quotes the previous conclusion from the ledger; source candidates from
domain-state evidence, not only existing parameters; an optimistic local proxy
is never sole acceptance evidence.

Mechanism-level additions (owned by `cxc-pabcd` §Optimization-Loop Meta-Rules):

- **LOOP-MECHANISM-PROOF-01** — a new-branch candidate needs activation evidence
  (the branch demonstrably fired on its target instances), not just aggregate
  score movement; a zero-delta solo ablation means "presume dead, instrument
  first", not "weak feature".
- **LOOP-RESIDUAL-TRACE-01** — residual failures carried through D get a
  mechanism-level trace or the label `unexplained`; a plausible opponent story
  is not evidence that our own branch armed.
- **LOOP-PEER-CONTRAST-01** — when a peer/reference artifact beats an instance
  we fail, the next generation starts with a behavioral diff of the two traces
  before any new candidate.

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
cycle to IDLE, the AGENT runs `cxc orchestrate P --session <id>` to start the next work-phase.
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
  rounds reuse the SAME reviewer — `followup_task` to its task_name (v2: triggers a
  turn when idle; the agent keeps its context, no resume needed; `send_message` for
  context-only delivery) — passing the synthesis plus a change-diff summary so the
  reviewer keeps its context.
  The final C adversarial gate (or any contaminated reviewer) gets a fresh reviewer or
  a direct independent audit instead. Normative lifecycle rules: DISPATCH-ACTOR-01 /
  DISPATCH-RETIRE-01 in `structure/20_pabcd_dispatch_doctrine.md` §3.

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
- **Cost tiers (DEFAULT, DIVERGE-TIER-01):** divergence defaults to CONCEPTUAL
  candidates. Tier 0 — inline brainstorm in the plan, no dispatch. Tier 1 (the
  divergence default) — 2-3 parallel candidate lanes, each yielding ONE one-page
  candidate direction doc (no code, no worktrees) with mandatory front-matter:
  `assumptions`, `risks`, `kill-criteria`, `evidence-needed`. Lane research is done
  by read-only EXPLORER subagents that return findings/evidence only; the candidate
  DOC itself is written by the MAIN session from those findings, or by a scoped
  WORKER whose write scope is the devlog unit / `.codexclaw/divergence/` (explorers
  never write files — dispatch doctrine). The front-matter lives in the candidate
  DOC file, while `cxc divergence candidate add` records the archive row
  (kind/title/rationale/`--source`) alongside it. The MAIN session (collapse owner)
  critiques/triages directly — a separate cross-critique round is waste and is NOT
  a gate condition. Collapse gate: N candidate docs with filled front-matter AND
  per-candidate provenance (the existing `cxc-search` provenance rule below — Tier
  1 tightens it, never relaxes it). Tier 2 (rare escalation) — the
  worktree/`evaluate.sh` candidate-race lane below, ONLY when the choice is
  load-bearing AND Tier-1 candidates genuinely conflict AND judgment needs running
  code; expected 0-1 per unit, entry recorded as a P-level decision. Tier inflation
  (defaulting to Tier 2 because subagents are cheap) and tier deflation (collapsing
  a load-bearing conflict from paper alone) are both violations: the scarce budget
  is wall-clock and collapse-owner triage attention, not tokens. Minds are NOT
  Tier-1 candidate authors — they remain interview-time contradiction lenses. The
  first Tier-1 dispatch of a research-heavy unit SHOULD be a blindspot/unknowns
  pass so candidates are sourced from evidence, not parameter tweaks. Topology is
  star, not mesh: subagents neither message each other nor spawn workers; exchange
  is file-mediated through `.codexclaw/divergence/` and the devlog unit.
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
advancing under an ACTIVE goal — mid-cycle (continue the phase) and, since 260709,
at IDLE with no in-flight cycle (GOAL-IDLE-CONTINUE-01: the block names the
`cxc orchestrate P --session <id>` arming command, the bound goalplan's remaining
work, and the honest close-out via `update_goal` complete/blocked; its counter
write also bootstraps the session state file so the suggested command passes the
unknown-session guard). Termination is total via:

- **Guard 2** — no active goal → release (a plain interactive session never enters
  the loop; it pauses for the human at P/A/B, and IDLE without a goal stays silent).
  Phase `I` always releases (the Interview is HITL-only).
- **Context-pressure bail** — don't pile on during compaction recovery.
- **Stagnation cap** — a bounded `stopBlockCount` per phase; after `MAX_STOP_BLOCKS`
  consecutive blocks at the same phase with no transition, the loop releases so it can
  never trap a session. A real transition (chat or CLI) resets the counter, so each
  phase of a healthy P→A→B→C→D gets a fresh budget. This is the runtime companion to
  LOOP-DOOM-01, not a success signal; after release, apply the no-progress discipline
  before retrying the same phase. With the old unconditional `stop_hook_active`
  release removed (260709 — it capped an armed loop at ONE continuation per turn,
  producing the step-by-step cut), this cap is the single total-termination bound.
- **Objective plateau block** — for active maximize goals with session-scoped metrics,
  two non-improving same-metric rows switch the block reason from plain continuation
  to "step back and re-plan with divergence." This still uses the same bounded
  `MAX_STOP_BLOCKS` release path and never asks the user inside goal mode.
