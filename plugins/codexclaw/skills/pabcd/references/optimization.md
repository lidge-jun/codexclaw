# Optimization-loop meta-rules

### Optimization-Loop Meta-Rules (plateau discipline)

| Rule | Trigger | Required action |
|------|---------|----------------|
| LOOP-PHASE-DEATH-01 | Same class kills 3 candidates | Target the killing mechanism |
| LOOP-CONTINUITY-01 | New cycle | Quote prior D direction |
| LOOP-CANDIDATE-ANCHOR-01 | Only parameter tweaks | Regenerate from state evidence |
| LOOP-INSTANCE-CHECK-01 | Fixed enumerable instances | Consider per-instance specialization |
| LOOP-MECHANISM-PROOF-01 | New branch/mechanism | Prove activation before adoption |
| LOOP-RESIDUAL-TRACE-01 | Residual failure | Record trace or `unexplained` |
| LOOP-PEER-CONTRAST-01 | Peer succeeds on our failure | Diff behaviors before generating |
| LOOP-FANOUT-TIMING-01 | Coarse search plateaus | Begin parallel fine-grained lanes |
| COLLAPSE-AGGREGATOR-01 | Candidates disagree on crux | Use crux-matched synthesis |

- **LOOP-PHASE-DEATH-01:** "same class" means the same candidate class
  (`parameter-tweak`, `branch-toggle`, `state-space redesign`, or `evaluator change`)
  dies at the same phase three times; target that killing mechanism next.
- **LOOP-CONTINUITY-01:** begin P by quoting the prior D conclusion and next direction;
  contradicting it requires an explicit reason, preventing amnesiac retries.
- **LOOP-CANDIDATE-ANCHOR-01:** thresholds and guards are parameter-space search;
  regenerate from logs, trajectories, instances, and failure states in state-space.
- **LOOP-INSTANCE-CHECK-01:** when instances are fixed and enumerable, evaluate
  fingerprint-plus-playbook specialization before more generic tuning.
- **LOOP-MECHANISM-PROOF-01:** require a firing counter or trace; a baseline-exact
  single-feature ablation is evidence to instrument the mechanism before combining it.
- **LOOP-RESIDUAL-TRACE-01:** explain which relevant branches fired and why, or label
  the residual `unexplained`; a plausible environmental story is not a trace.
- **LOOP-PEER-CONTRAST-01:** when a peer succeeds on the same failed instance, make a
  behavioral trace diff the next analysis deliverable before generating candidates.
- **LOOP-FANOUT-TIMING-01:** stay single-track while coarse levers move the metric;
  fan out when the plateau shifts work to fine-grained candidates.
- **COLLAPSE-AGGREGATOR-01:** "crux-matched" means the synthesizer is strongest in
  the disputed domain; it returns the verdict while the main session owns collapse.

### Optimization-loop discipline

This file owns the meta-rules; repair/archetype detail is in [Loop engineering](loop-engineering.md).

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
