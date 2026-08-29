# 012 second plan correction — the unversioning amendment was reverted

Record doc. `010`'s "Unversioning the task-outcome checks" section is WITHDRAWN;
this doc says why, so the next cycle does not retry it.

## What happened

Audit round 2 found that flipping the new-plan default to v1 also drops the two
task-outcome checks at `goalplan.ts:1304`, and recommended making them
version-independent. I measured the gap, agreed, amended `010`, and implemented it.

`npm test` then failed 2 of 2273 tests — and both failures were the contract
telling me the recommendation was wrong:

```
goalplan-integrity.test.ts:163  "schema v1 and v2 allow legacy done tasks without outcome"
goal-gate.test.ts:394           "valid legacy v1 goalplan at IDLE -> complete passes"
```

The second one is decisive. It builds a complete v1 plan with a `done` task that
has no `outcome`, and asserts `update_goal complete` is ALLOWED. Under the
unversioned rule the gate denied it with
`task wp-1/t-1 is done but has no non-empty outcome`.

## Why that is a defect, not a stale test

The v1/v2 exemption is deliberate: those plans were written before the rule
existed. Applying it retroactively means an existing plan that was completable
yesterday is not completable today, for a reason its author could not have
anticipated — the same class of surprise blocker this whole unit exists to remove.
Fixing one unreachable completion gate by adding another would be a poor trade.

## Disposition

The version guard stays at `>= 3`. The coverage the default path gives up is
bounded and worth stating precisely:

- `cxc loop complete-task --outcome <text>` refuses empty outcome text and always
  writes one, so no CLI-driven plan can produce an unchecked done task.
- Only a hand-edited plan can, and hand-editing `goalplan.json` is already
  documented as normal workflow with its own bypasses.
- `cxc loop init --schema-version 3` opts back into the strict rule.

Round 2's finding was still valuable: it forced the trade-off to be measured and
named rather than shipped silently. What it got wrong was the remedy.

## Method note

Both audit rounds reasoned from source and were right about the code. Neither ran
the suite — round 1 was explicitly told not to, round 2 inferred from reading. The
contract that refuted the remedy lived in a test, not in the source. Reviewer
analysis is not a substitute for running the gate.
