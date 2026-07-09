# Loop-Engineering Alignment — Full Rules (dev-pabcd §11)

Canonical full text for the §11 stub in `../SKILL.md`. Rule IDs and section numbers
are stable; the router keeps a one-line summary per rule and this file holds the
complete wording. Genealogy and sources: `backlog/260702_loop_engineering_backlog.md`
in the initiative repo.

## Context

PABCD is the macro loop: phase-level control with gates. Loop engineering supplies the
micro-loop rules inside each phase. This file holds the adopted subset in full.

### §11.1 Loop values (DEFAULT)

- **Feedback must change the next action.** A cycle whose result does not alter the next
  step is not a loop — it is a retry. Read the failure delta before acting again.
- **The verifier outranks the prompt.** Prefer deterministic evidence (tests, exit codes,
  diffs) over model self-assessment; the maker does not grade its own homework when a
  stronger verifier exists.
- **Memory lives on disk**, not in the transcript: worklog, devlog, attestations. The
  next iteration must be able to resume from artifacts alone.
- **Budget exhaustion ≠ done.** Never report a budget stop as success.
- **Context pressure ≠ budget exhaustion.** Compaction is survivable BY DESIGN because
  memory lives on disk: an approaching context limit means checkpoint durable state
  (goalplan, ledger, devlog) and continue after the flush — it is never grounds to close
  the goal, shrink the plan, or report `DONE`/`BUDGET_EXHAUSTED`. `BUDGET_EXHAUSTED`
  requires a bound the plan actually stated (tokens, cost, wall-clock).
- **Interview does not "solve" intent transfer** — it produces a testable initial
  loop-spec. Later evidence may force an Interview return; that return path existing is
  the design's own admission that intent is refined cyclically, not settled up front.

### §11.2 Terminal-state vocabulary (DEFAULT)

D is the success exit, not the only exit. Reports must name which terminal state the
close-out actually represents: `DONE` (verified success) · `NOOP` (nothing needed) ·
`BLOCKED` (external dependency) · `UNSAFE` (needs a human risk decision) · `NEEDS_HUMAN`
(judgment only the user can make) · `BUDGET_EXHAUSTED` (resources ran out — adopt
best-so-far and say so). These are agent-recognized report states, not FSM states: the
FSM still closes via D or `reset`; the D summary states the real terminal state.

### §11.3 Repair-loop discipline (C→B returns)

The B/C inner loop is: implement → run verifier → read the failure delta → repair only
the failing delta → re-verify.

- **DEFAULT (LOOP-REPAIR-01):** 2 consecutive failed repairs of the same failure → stop
  patching, enter root-cause mode (`dev-debugging`). 3 → escalate: replan (return to P)
  or Interview return. "One more attempt" past these thresholds is the doom loop.
- **HEURISTIC (LOOP-DOOM-01):** 3 attestation failures in the same phase within one
  work-phase → treat as no-progress and force an Interview return. Self-applied for now;
  server-side enforcement is recorded as backlog.
- **DEFAULT (REVIEW-SYNTHESIS-01):** after a reviewer/verifier FAIL verdict, the main
  session records a synthesis BEFORE re-patching or re-dispatching: per-blocker root
  cause, conflicts between blockers (and against the standing plan), and an explicit
  accept/rebut decision per point. Mechanically patching each reviewer comment and
  throwing it back ("patch-to-reviewer") is a retry, not a loop — a re-dispatch without
  synthesis counts as a failed repair under LOOP-REPAIR-01. E7 guidance (agent-followed,
  not hook-enforced). Lineage: jawcode devlog `260615_pabcd_synthesis_review_loops`
  (design-note lineage, not production-validated). Reviewer lifecycle across rounds is
  owned by `structure/20_pabcd_dispatch_doctrine.md` §3 (DISPATCH-ACTOR-01 /
  DISPATCH-RETIRE-01).

### §11.4 Loop archetype by problem type (DEFAULT, LOOP-ARCHETYPE-01)

Classify the work-phase's problem type before choosing the inner loop shape:

- **Spec-satisfaction** — the verifier defines *done* (tests, contracts, tsc). Use the
  §11.3 repair loop; it converges. Iterate until green.
- **Open-ended optimization** — the verifier only defines *better* (scores, win rates,
  adversarial opponents). Repair loops plateau at local optima here: they polish the
  current strategy instead of finding the missing one. Use an **explore-and-select
  loop**: generate diverse candidates in parallel (different strategies, not parameter
  tweaks — LOOP-CANDIDATE-ANCHOR-01 in §10), evaluate all on the same instances, keep
  best-so-far, regenerate from the winner. Stop on plateau (LOOP-PHASE-DEATH-01) or
  budget; the exit state is `BUDGET_EXHAUSTED` with the best candidate adopted — not
  `DONE`.

A repair loop applied to an optimization problem is a category error; the fix is loop
shape, not more cycles. A full paper-grounded explore-and-select workflow proposal
(LOOP-EXPLORE-SELECT-01: StrategyCard candidates, descriptor archive, opponent
portfolio, evaluation cascade, restart ladder) is recorded in
`backlog/260702_explore_select_research.md` — pending adoption via a normal PABCD pass.

### §11.4a Analysis-before-regeneration (DEFAULT, LOOP-REANALYZE-01)

Repair fixes actions; only analysis revises the model that generates them (single- vs
double-loop learning). In an explore-and-select loop, every generation MUST begin with
an **analysis deliverable** — not a patch:

1. **Updated problem/opponent model** from the evidence (telemetry, replays, failure
   deltas): what did the opponent/environment actually do, and what does it imply?
2. **Capability-gap hypotheses**: what can the artifact not currently *sense* or *do*
   (e.g. opponent tracking, scouting, income estimation)? A gap hypothesis may propose
   **expanding the allowed patch surface** — that is a P-level amendment, which is
   exactly why new capabilities can never emerge from a surface-bounded repair loop.

Candidates are then sourced from these hypotheses (§10 LOOP-CANDIDATE-ANCHOR-01), and
the next P quotes them (§10 LOOP-CONTINUITY-01). A generation that skips analysis and
regenerates straight from scores is a repair loop wearing an explore costume.

### §11.4b Mechanism activation proof (DEFAULT, LOOP-MECHANISM-PROOF-01)

Scores select candidates; only traces verify mechanisms. When a candidate's value is a
new branch (a defense mode, an endgame converter, a special-case handler), adoption
requires **activation evidence**: a debug counter, stderr line, or replay trace showing
the branch fired on the instances it was built for, with the intended effect.

Failure signatures that mandate instrumentation before the next candidate:

- **Zero-delta ablation:** the solo candidate scores exactly baseline on its target
  instances. The correct read is "the mechanism probably never ran", not "the
  mechanism is weak". A branch that runs and loses moves the metric somewhere
  (different HP, different turn counts); byte-identical outcomes mean dead code path.
- **Combo masking:** the mechanism ships inside a multi-feature combo whose aggregate
  score improves. The combo's gain proves nothing about THIS branch; without
  activation evidence a dead mechanism rides along and its target failures persist
  as "residual" losses that look opponent-caused.

Real case (2026-07, NEXT NATION bot): an endgame HP-race branch (bank gold from T150,
upgrade HQ to win TURN_LIMIT ties) was adopted inside a combo that raised the loss-gate
1.5 -> 7.5. Its solo ablation had scored baseline-exact 1.5 — recorded as "weak alone"
and never instrumented. The branch was in fact never arming: two early-return trainers
drained the bank every turn, and a warriors-at-HQ precondition kept cancelling the
reserve. The residual draws were attributed to the opponent ("they also stall") until a
colleague's hand-tuned bot won the same official battle with plain late HQ upgrades.
One NN_GOLD_DEBUG stderr line (gold/reserve/atHQ per turn) exposed the leak in minutes;
the same line at adoption time would have caught it one work-phase earlier.

Corollary (LOOP-RESIDUAL-TRACE-01): every residual failure carried through D gets a
mechanism-level trace ("branch X armed at T150, banked 2400 by T174, upgraded") or the
explicit label `unexplained`. Plausible environment stories are hypotheses, not
evidence. And when a peer artifact achieves the objective on an instance we fail
(LOOP-PEER-CONTRAST-01), the next generation's first deliverable is the behavioral diff
of the two traces — the peer's trace is a free counterexample to the environment story.

### §11.5 Unattended-loop resource policy (DEFAULT)

Goal-mode (unattended) loop-specs must state: tool/credential scope (what the loop may
touch), token/cost budget, and a wall-clock bound. For C4 surfaces, an unattended loop
with unstated scope is an ESCALATE-class omission — stop and ask before running it.
