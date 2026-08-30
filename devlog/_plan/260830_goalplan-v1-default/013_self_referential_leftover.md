# 013 the self-referential leftover — this unit's own goalplan is stranded at v3

Record doc. Not a defect in the fix; a consequence of when the plan was created.

## What it is

This unit's goalplan was created BEFORE the fix landed, so `buildGoalplan()` was
still declaring v3 and stamped `"schemaVersion": 3` into it. All four work phases
are done and all seven criteria are met, yet `cxc loop validate` still fails:

```
schemaVersion 3 requires an approved finalGate, and no command in this build
opens a final-gate review round - either record the gate another way or declare
schemaVersion 1, which new plans now use by default
```

That is the corrected wording doing its job — it names the true state and the
escape, rather than pointing at a `--lane` flag that never existed.

## Why it was left alone

Editing `schemaVersion` in this plan's own `goalplan.json` would let the change
certify itself by lowering the bar it was measured against. The honest record is a
plan that cannot close under the rules it was created with, next to a fix that is
verified working for every plan created after it.

## Scope of the leftover

Measured across this machine's store: **92 goalplans, 1 stranded at v2/v3** — this
one. The other 91 already declared v1 and were never affected. Combined with the
new default, the migration population is effectively empty, which is why no
migration command was written.

A user who does hit this has two documented moves, both named in the reason text:
declare `schemaVersion` 1 in the file (hand-editing `goalplan.json` is already
normal workflow), or record the gate another way. Neither needs new code.
