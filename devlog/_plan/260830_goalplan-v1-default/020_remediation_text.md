# 020 wp3 — the finalGate remediation message stops naming a flag that does not exist

Depends on: 010 (the default must be settled before the wording is).

## Problem

`goalplan.ts:1526-1529` tells the reader to run:

```
cxc review-round open --lane final_gate --session <id>
```

`--lane` is parsed nowhere in the repo. The flag is silently ignored, the round
opens as `plan_audit`, and `roundReasons` (`:1554`) then refuses it with "a plan
audit cannot stand in for the final code gate". Following the instruction
produces a second, more confusing failure. The comment above it (`:1523`) already
says a `final-gate` verb does not exist — the code knew, and told the user to run
it anyway.

## Decision

State what is true: this build cannot produce a final-gate round, so a plan that
declares v2/v3 must either record the gate by other means or declare v1. Do not
invent a command. `final layer: none` is an allowed answer, and so is
`no command exists`.

## Change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

```diff
   const gate = plan.finalGate;
   if (!gate) {
-    // No `final-gate` verb exists in goalplan-cli.ts or cli.ts (issue #29). Naming a
-    // command the user cannot run is worse than naming none, so this points at the
-    // review-round surface that actually produces a gate.
-    out.push(
-      "schemaVersion 2 requires a finalGate - open a final-gate review round with " +
-        "`cxc review-round open --lane final_gate --session <id>` and record its verdict",
-    );
+    // No verb in this build opens a `final_gate` round: `review-round open`
+    // hardcodes `purpose: "plan_audit"` and its parser has no `--lane`. The old
+    // text named `--lane final_gate` anyway, so following it opened a plan_audit
+    // round that `roundReasons` then refused — one dead end pointing at another.
+    // Say the true state instead, and name the escape that exists today.
+    out.push(
+      `schemaVersion ${version} requires an approved finalGate, and no command in ` +
+        "this build opens a final-gate review round - either record the gate " +
+        "another way or declare schemaVersion 1, which new plans now use by default",
+    );
     return out;
   }
```

`version` is already in scope at `:1501`. Using it removes the second lie in the
old sentence: a v3 plan was told "schemaVersion 2 requires".

## Accept criteria

1. The reason string for a gateless v2 plan contains no `--lane`. Activation:
   assert `rg`-style on the message; a substring check for `"--lane"` must fail.
2. A v3 plan's message says 3, not 2. Activation: validate a declared-v3 plan and
   match the number in the reason.
3. `--lane` appears in no remediation string the user can receive. Activation:
   `assert.doesNotMatch(reason, /--lane/)` on the value `validateGoalplan` actually
   returns — round 2 pointed out this is sturdier than grepping built `dist`, since
   it needs no build-before-test ordering. A `dist` grep stays available as a
   secondary check, but only after `npm run build`: `dist/goalplan.js:1528` holds
   the old string until then, and `dist-freshness.test.mjs` independently fails if
   `dist` is not rebuilt and committed.

## Bypass

Not an enforcement change — wording only. Tier n/a, surface n/a, no bypass, no
residual risk, no downgrade. The gate's behavior is byte-identical; only the
sentence changes.

## Existing message assertions BREAK and must be updated in the same commit

The audit claimed the new wording preserves `/requires a finalGate/`. That is
wrong, and I checked it rather than accepting it: the regex needs the literal
`requires a finalGate`, while the new text says `requires an approved finalGate`.
`node -e` on both strings against the regex returns `old: true, new: false`.

So two more assertions go red unless they move with the message:

```
final-gate.test.ts:129   assert.match(reasons(p, ctx(cwd())), /requires a finalGate/)
final-gate.test.ts:337   assert.match(reasons(back as Goalplan, ctx(dir)), /requires a finalGate/)
```

### MODIFY `plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts`

Retarget both to the new wording, and assert the absence of the phantom flag so
the fix cannot silently regress:

```diff
-  assert.match(reasons(p, ctx(cwd())), /requires a finalGate/);
+  assert.match(reasons(p, ctx(cwd())), /requires an approved finalGate/);
+  assert.doesNotMatch(reasons(p, ctx(cwd())), /--lane/);
```

```diff
-  assert.match(reasons(back as Goalplan, ctx(dir)), /requires a finalGate/);
+  assert.match(reasons(back as Goalplan, ctx(dir)), /requires an approved finalGate/);
```

Keeping the old substring by wording the message `requires a finalGate, and no
command ...` was the alternative. Rejected: `approved` is the load-bearing word —
a `pending` gate is present but does not satisfy the check (`:1531`), so the
message should say what is actually required.
