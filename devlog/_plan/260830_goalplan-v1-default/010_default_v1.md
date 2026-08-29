# 010 wp2 — new plans default to v1, higher versions become opt-in

Depends on: 000, 001. Types touched: `NewGoalplanInput`, `Goalplan.schemaVersion`,
`GoalplanCliArgs`.

## Decision

`buildGoalplan()` stops declaring the newest schema and declares v1, the version
whose rules are all reachable. A caller that wants v2/v3 asks for it explicitly.
`SUPPORTED_MAX_SCHEMA_VERSION` keeps its meaning — the highest version this build
can *read* — and the read/refuse logic at `:496`, `:789`, `:1406` is untouched.

Rejected alternative A: keep the v3 default and skip `finalGateReasons` when no
gate-producing verb exists. That makes the v2/v3 gate silently unenforceable for
everyone, including plans that deliberately opted in, and shipping a working
`--lane final_gate` later would silently re-arm it for every existing v3 plan.
The gate should stand; only the automatic enrollment should go.

Rejected alternative B (raised by audit round 2): decouple the finalGate
requirement from the version ladder — keep the newest default and gate the
finalGate on its own opt-in field. Cleaner in the abstract, but it changes what
`schemaVersion` 2 and 3 MEAN for plans already on disk, which is a migration, not
a fix. The default flip changes only what NEW plans claim; every existing file
validates exactly as before. Reversibility is the tie-breaker.

**Audit round 2's underlying finding is accepted, and it changes this plan.**
Dropping the default to v1 would also drop the two task-outcome checks at
`:1304-1312`, which are reachable and worth keeping. Measured on the built
artifact: a `done` task with no `outcome` yields `[]` at v1 and
`"task wp1/t1 is done but has no non-empty outcome"` at v3. So this unit must also
lift those two checks OUT of the version branch (section below). Without that, the
change would buy completability by quietly reducing validation.

## Field chain (PLAN-FIELD-CHAIN-01)

`schemaVersion` is an existing field, so the chain is about the new *input* path.

| Stage | Path |
|-------|------|
| creation | `NewGoalplanInput.schemaVersion?` (new, optional) -> `buildGoalplan` |
| CLI creation | `GoalplanCliArgs.schemaVersion?` <- `--schema-version <n>` on `loop init` |
| serialization | unchanged: `writeGoalplan` serializes the whole plan object |
| deserialization | unchanged: `reviveGoalplan` already reads `o.schemaVersion` (`:576`) and defaults absent to 1 (`:462`) |
| consumers | unchanged: `effectiveSchemaVersion` (`:1382`), `finalGateReasons` (`:1499`), the v3 task-outcome block (`:1304`), the read-refusal checks (`:496`, `:789`, `:1406`) |

No consumer needs editing: they all already branch on the declared number. That
is why the fix is small — the version was always a parameter, just never exposed.

## Change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

Extend the input type (after `:876`):

```diff
 export interface NewGoalplanInput {
   objective: string;
   /** seeded acceptance criteria (e.g. from the freeze EvidenceBundle). */
   criteria?: Array<{ scenario: string; expectedEvidence?: string; surface?: CriterionSurface }>;
   host?: Partial<GoalplanHostLink>;
+  /**
+   * Schema the new plan DECLARES. Defaults to `DEFAULT_NEW_SCHEMA_VERSION` (1),
+   * whose rules are all reachable by shipped commands. Ask for 2 or 3 only when
+   * the caller intends to satisfy the final-gate requirement those versions add.
+   */
+  schemaVersion?: number;
   now?: () => string;
 }
```

Add the constant next to `SUPPORTED_MAX_SCHEMA_VERSION` (`:53`):

```diff
 export const SUPPORTED_MAX_SCHEMA_VERSION = 3;
+
+/**
+ * Schema a NEW plan declares when the caller does not choose one.
+ *
+ * NOT `SUPPORTED_MAX_SCHEMA_VERSION`. Those two constants answer different
+ * questions: the max is what this build can READ, this is what a fresh plan
+ * should CLAIM. Defaulting to the max enrolled every new plan into the
+ * schemaVersion >= 2 final-gate requirement, and no shipped verb can produce a
+ * `final_gate` review round to satisfy it (`review-round-cli.ts` hardcodes
+ * `plan_audit`; `--lane` is parsed nowhere), so every new plan validated with a
+ * permanent failure reason and `update_goal complete` was denied for all of
+ * them. v1 rules are the ones a user can actually discharge.
+ */
+export const DEFAULT_NEW_SCHEMA_VERSION = 1;
```

Use it in `buildGoalplan` (`:897`):

```diff
   return {
     objective: input.objective,
     slug: deriveSlug(input.objective),
-    schemaVersion: SUPPORTED_MAX_SCHEMA_VERSION,
+    schemaVersion: normalizeNewSchemaVersion(input.schemaVersion),
     createdAt: ts,
```

And a normalizer beside it, so a nonsense request cannot mint an unreadable plan:

```diff
+/**
+ * Clamp a requested new-plan schema into [1, SUPPORTED_MAX_SCHEMA_VERSION].
+ * A plan declaring more than this build can read is refused on the next read
+ * (`:496`), so minting one would create a file its own writer cannot reopen.
+ */
+function normalizeNewSchemaVersion(requested?: number): number {
+  if (typeof requested !== "number" || !Number.isFinite(requested)) {
+    return DEFAULT_NEW_SCHEMA_VERSION;
+  }
+  const floored = Math.floor(requested);
+  if (floored < 1) return DEFAULT_NEW_SCHEMA_VERSION;
+  return Math.min(floored, SUPPORTED_MAX_SCHEMA_VERSION);
+}
```

### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts`

Audit blocker 2: the first draft of these two hunks elided the real surrounding
lines and read as replacements, which would have deleted the `--criterion` body
and unbalanced the brace chain. Corrected against the actual file below.

Args field — insert AFTER the existing `surface?: string;` at `:76`:

```diff
   /** `init` / `add-criterion`: the criterion surface (logic|web|tui). */
   surface?: string;
+  /**
+   * `init` only: the schemaVersion the new plan DECLARES. Absent means
+   * `DEFAULT_NEW_SCHEMA_VERSION` (1). 2 and 3 add a finalGate requirement no
+   * shipped verb can currently satisfy, so they are opt-in.
+   */
+  schemaVersion?: number;
   /** `add-work-phase`, `add-task`, `complete-task`, `meet-criterion`. */
   id?: string;
```

Parser branch — a NEW `else if` in the existing chain. The `--criterion` body at
`:135-138` stays exactly as it is; the new branch goes after `--outcome` (`:145`):

```diff
     else if (a === "--outcome") out.outcome = argv[++i];
+    else if (a === "--schema-version") {
+      const raw = argv[++i];
+      const parsed = Number(raw);
+      if (Number.isFinite(parsed)) out.schemaVersion = parsed;
+    }
```

```diff
     const plan = buildGoalplan({
       objective,
       criteria: args.criteria.map((scenario) => ({ scenario })),
+      schemaVersion: args.schemaVersion,
     });
```

Help text gains the flag on the `init` usage line and one note: choosing 2 or 3
means committing to a final gate that no shipped verb can currently produce.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`

Audit blocker 1: `:239` is a test named
`"schema v3: buildGoalplan declares schemaVersion 3"` asserting
`plan.schemaVersion === 3` and `effectiveSchemaVersion(plan, false) === 3`. The
reviewer simulated the one-line default change in a detached worktree at
`05db9d07` and measured 1097 tests / 1096 pass / 1 fail — this test and nothing
else. It must be retargeted in the same commit, or `npm test` goes red and 030
step 2 cannot pass.

```diff
-test("schema v3: buildGoalplan declares schemaVersion 3", () => {
-  // arrange and act
-  const plan = buildGoalplan({ objective: "new v3 plan" });
-
-  // assert
-  assert.equal(plan.schemaVersion, 3);
-  assert.equal(effectiveSchemaVersion(plan, false), 3);
-});
+test("a new plan declares v1 by default, and v3 only on request", () => {
+  // arrange and act
+  const byDefault = buildGoalplan({ objective: "new default plan" });
+  const optedIn = buildGoalplan({ objective: "opted into v3", schemaVersion: 3 });
+
+  // assert — the default is the version whose rules are all reachable
+  assert.equal(byDefault.schemaVersion, DEFAULT_NEW_SCHEMA_VERSION);
+  assert.equal(byDefault.schemaVersion, 1);
+  assert.equal(effectiveSchemaVersion(byDefault, false), 1);
+
+  // assert — opting in still declares v3, so the v2+ rules still apply
+  assert.equal(optedIn.schemaVersion, 3);
+  assert.equal(effectiveSchemaVersion(optedIn, false), 3);
+});
```

The import list gains `DEFAULT_NEW_SCHEMA_VERSION`.

## Accept criteria

1. `buildGoalplan({objective})` -> `schemaVersion === 1`; a satisfied plan
   validates clean with no `finalGate`. Activation: assert on the returned object
   and on the reasons array from `validateGoalplan` being empty.
2. `buildGoalplan({objective, schemaVersion: 3})` -> `3`, and validation still
   reports the finalGate reason. Activation: same call, opposite expectation —
   this is the row that proves the gate was not weakened.
3. `schemaVersion: 99` clamps to 3; `0`, `-1`, `NaN`, `undefined` fall to 1.
   Activation: table test over those inputs.
4. v3 opt-in keeps its own rules: a `done` task with no `outcome` under
   `schemaVersion: 3` still fails. Activation: build a v3 plan with such a task.
5. `cxc loop init --schema-version 3` writes a plan declaring 3; without the flag
   it writes 1. Activation: run the CLI in a temp cwd and read the file back.

## Bypass (PLAN-BYPASS-NAMED-01)

- Tier: E8 (validation), reached through the `GOAL-COMPLETE-GATE-01` PreToolUse hook.
- Executing surface: `validateGoalplan` in-process; the hook for `update_goal`.
- Known bypass: hand-editing `schemaVersion` in `goalplan.json`, which is already
  documented as normal workflow, and hand-writing a `finalGate` object.
- Residual risk: someone who WANTS the v2/v3 discipline must now ask for it, so a
  plan that should have been v3 could stay v1 by omission.
- Wording downgrade: none. This change removes an unreachable requirement from
  the default path; it does not relabel enforcement as advice.
- Final enforcement layer: none, and that is unchanged — a user with an editor can
  always rewrite their own plan file.

## Unversioning the task-outcome checks — WITHDRAWN, see 012

> **This section is superseded.** It was implemented and then reverted: two tests
> encode a deliberate v1/v2 exemption, and removing it made an existing legacy
> plan un-completable. The version guard stays at `>= 3`. Kept here because `012`
> refers to it; do not implement it. Rationale and disposition: `012`.

The pair at `:1304-1312` is version-gated only because it arrived with v3. It has
nothing to do with the final gate, and `cxc loop complete-task --outcome` always
writes an outcome (`:1154`), so making it unconditional breaks no CLI-driven plan.
A hand-written plan with a `done` task and no outcome now gets a reason at every
version — which is the point: a done task with no recorded evidence is the
lazy-completion pattern the ledger exists to catch.

Replace the version guard with an unconditional walk, keeping both pushes
byte-identical:

- DELETE the `if ((plan.schemaVersion ?? 1) >= 3) {` wrapper and its closing brace.
- KEEP the two `reasons.push(...)` statements and their conditions exactly as they
  are, now directly inside the existing `for (const task of phase.tasks)` walk.
- ADD a comment recording why: these rules are about task evidence, not the schema
  ladder, and leaving them behind `>= 3` meant flipping the default to v1 would
  silently stop checking that a done task records what it produced.

### Consequence for the regression suite

`goalplan-regression.test.ts` currently asserts the opposite. Its `outcomePlan`
helper walks `[undefined, 2]` and expects NO outcome reason at those versions.
Those expectations invert and must move in the same commit: a done task without an
outcome is now a reason at every version. A deliberate behavior change, recorded
here rather than discovered in C.

### MODIFY test comments that cite the old default

`goal-gate.test.ts:399`, `final-gate.test.ts:68`, and `work-phase-states.test.ts:36`
each explain their `schemaVersion: 1` pin with "buildGoalplan() declares v3 since
wp2 (260829)". That premise inverts here. The pins stay — explicit beats inherited
— but the comments must say the version is pinned deliberately rather than to
escape a v3 default.

## Accept criteria added by audit round 2

6. A `done` task with no `outcome` produces the outcome reason at schemaVersion 1,
   2, AND 3. Activation: re-run the probe — v1 must stop returning `[]`.
7. A `pending` task carrying an `outcome` produces its reason at v1 as well.
8. `goalplan-regression.test.ts` asserts the new version-independent behavior, and
   the three stale pin comments no longer claim buildGoalplan declares v3.
