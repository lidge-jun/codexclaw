# wp2: `desktop` criterion surface

Adds one value to the goalplan criterion surface so a native desktop criterion can require QA evidence at the final gate. Existing `logic`, `web` and `tui` plans keep working unchanged. No schemaVersion change (002 D4).

## Activation scenario (C-ACTIVATION-GROUNDING-01)

New plans default to schemaVersion 1 (goalplan.ts:67) and `finalGateReasons` returns nothing below 2 (goalplan.ts:1551), so on a default plan without a recorded `finalGate`, `desktop` is a classification that skills and people read; it changes no gate. Two layers enforce the QA receipt: plan validation on schemaVersion 2 or 3 plans (`cxc loop init --schema-version 2`, or the schema marker) that record a `finalGate` (`validateGoalplan` reports a missing `qaReceiptPath`, goalplan.ts:1590, :1644), and the final-gate spawn guard on any plan with a recorded `finalGate`, regardless of schemaVersion (final-gate-guard.ts:115-136 never reads the version; it denies a `[CXC-FINAL-GATE]` spawn without the QA receipt). Tests exercise both with hand-built plans, which is how qa/SKILL.md:115-117 already documents the QA receipt path.

## Bypass record (PLAN-BYPASS-NAMED-01)

| Field | Value |
|---|---|
| Tier | E1 PreToolUse denies: the final-gate spawn guard (spawn-attach-hook.ts:1074-1079) and the update_goal completion gate (goal-gate.ts:280-292), plus E8 CLI validation (`cxc loop validate`) |
| Executing surface | `validateGoalplan` via `cxc loop validate` and the goal-gate completion hook; the subagent-config final-gate spawn guard |
| Known bypass | classify the criterion `logic`; stay on schemaVersion 1 without a recorded finalGate; delete the schema marker; edit goalplan.json by hand; write the plan with a ≤0.2.36 build, which drops the unknown value on read and saves the plan without it; final-gate reviews started without the `[CXC-FINAL-GATE]` marker; `--surface` passed to verbs other than add-criterion and init is still parsed and ignored (steer, add-work-phase, add-task, meet-criterion; residual); both hooks fail open: goal-gate returns no denial on errors and final-gate-guard.ts:116-128 allows when session, slug, plan or gate is missing |
| Residual risk | a desktop criterion can still close without QA on v1 plans or through the bypasses above; mixed-version hosts silently erase the value |
| Wording downgrade | yes: docs say "QA receipt enforced by validation on v2+ plans with a final gate, and by the spawn guard on any plan with a recorded finalGate; otherwise a classification", never "desktop enforces QA" |
| Final enforcement layer | none; the v2+ final gate is the strongest layer and remains bypassable |

## `loop init` and `--surface`

`parseGoalplanCliArgs` accepts `--surface` for every verb (goalplan-cli.ts:150), but `init` builds criteria without it (goalplan-cli.ts:619-623), so `cxc loop init --criterion X --surface desktop` exits 0 and stores the default. That silently escapes classification. Change: the parser records that the flag was present (`surfaceGiven: true` on `GoalplanCliArgs`, set even when no value follows), and `init` refuses it before the existing-plan check and any write. Other verbs that ignore the flag stay as they are (residual above).

```diff
@@ GoalplanCliArgs
   surface?: string;
+  /** True when --surface appeared at all, even without a value; init refuses it. */
+  surfaceGiven?: boolean;
@@ parseGoalplanCliArgs (≈150)
-    else if (a === "--surface") out.surface = argv[++i];
+    else if (a === "--surface") { out.surfaceGiven = true; out.surface = argv[++i]; }
```

```diff
     if (objective.length === 0) {
       return { output: "loop init: --objective \"<text>\" is required", code: 1 };
     }
+    if (args.surfaceGiven) {
+      return {
+        output: "loop init: --surface is not applied at init; bind the plan with --session and register each surfaced criterion with cxc loop add-criterion --session <id> --criterion <text> --surface <logic|web|tui|desktop>\nNothing was written.",
+        code: 1,
+      };
+    }
```

Activation: `cli(cwd, ["init", "--objective", "o", "--criterion", "c", "--surface", "desktop"])` and `cli(cwd, ["init", "--objective", "o", "--surface"])` both exit 1 and no goalplan directory exists afterwards.

`add-criterion` gets the same presence check: in `runAddOp`, `args.surfaceGiven && args.surface === undefined` returns exit 1 (`loop add-criterion: --surface needs a value (logic|web|tui|desktop)`) instead of storing the default. Activation: `cli(cwd, ["add-criterion", "--session", <canonical id>, "--criterion", "x", "--surface"])` exits 1 and the plan is unchanged; the goalplan-public-surface test covers it.

## Field chain (PLAN-FIELD-CHAIN-01)

| Stage | Path | Change |
|---|---|---|
| Creation: type | components/pabcd-state/src/goalplan.ts:75 | add `"desktop"` |
| Creation: CLI flag | components/pabcd-state/src/goalplan-cli.ts:78, :287, :314, :569, init path ≈600 | doc comment (`add-criterion` only; `init` rejects it), allowed set, error text, usage line, init refusal |
| Creation: steering op | components/pabcd-state/src/steering.ts:44, :86, :108, :113 | op type, allowed set, error text, cast |
| Creation: init API | goalplan.ts:893 | N/A: uses `CriterionSurface`, widens automatically |
| Serialization | writeGoalplan (JSON.stringify of the plan) | N/A: value written as-is |
| Deserialization | goalplan.ts:564 | keep `desktop` on read; unknown values still dropped |
| Consumer: QA requirement | goalplan.ts:1438-1439 | include `desktop` |
| Consumer: v2 validation text | goalplan.ts:1567 | list four values |
| Consumer: gate mismatch | goalplan.ts:1590 | N/A: calls computeQaRequired |
| Consumer: inlined guard | components/subagent-config/src/final-gate-guard.ts:133 | include `desktop` |
| Consumer: docs | skills/loop/references/durable-goalplan.md:60-62 and :84 | list allowed values and the QA rule; `--surface logic|web|tui|desktop` |
| Build output | components/pabcd-state/dist/*, components/subagent-config/dist/final-gate-guard.js | regenerate with `npm run build` |

## Diffs

goalplan.ts:

```diff
-export type CriterionSurface = "logic" | "web" | "tui";
+export type CriterionSurface = "logic" | "web" | "tui" | "desktop";
@@ revive (≈564)
-      ...(cc.surface === "logic" || cc.surface === "web" || cc.surface === "tui"
+      ...(cc.surface === "logic" || cc.surface === "web" || cc.surface === "tui" || cc.surface === "desktop"
@@ computeQaRequired (≈1437)
-/** True when any criterion in the WHOLE plan exercises a visual surface. */
+/**
+ * True when any criterion in the WHOLE plan needs QA evidence: a visual surface
+ * (web, tui) or a native desktop surface, whose UI, bundled-runtime and packaging
+ * rows are QA verdicts rather than unit tests.
+ */
 export function computeQaRequired(plan: Goalplan): boolean {
-  return plan.criteria.some((c) => c.surface === "web" || c.surface === "tui");
+  return plan.criteria.some((c) => c.surface === "web" || c.surface === "tui" || c.surface === "desktop");
@@ validation (≈1567)
-no valid surface ("logic" | "web" | "tui")
+no valid surface ("logic" | "web" | "tui" | "desktop")
```

goalplan-cli.ts:

```diff
-  /** `init` / `add-criterion`: the criterion surface (logic|web|tui). */
+  /** `add-criterion`: the criterion surface (logic|web|tui|desktop). `init` rejects it. */
-const SURFACES: ReadonlySet<string> = new Set(["logic", "web", "tui"]);
+const SURFACES: ReadonlySet<string> = new Set(["logic", "web", "tui", "desktop"]);
-      return { output: `loop add-criterion: --surface must be logic|web|tui (got '${args.surface}')`, code: 1 };
+      return { output: `loop add-criterion: --surface must be logic|web|tui|desktop (got '${args.surface}')`, code: 1 };
-    "  cxc loop add-criterion --session <id> --criterion <text> [--surface logic|web|tui] [--cwd <path>]",
+    "  cxc loop add-criterion --session <id> --criterion <text> [--surface logic|web|tui|desktop] [--cwd <path>]",
```

steering.ts:

```diff
-      surface?: "logic" | "web" | "tui";
+      surface?: CriterionSurface;
-  const SURFACES: ReadonlySet<string> = new Set(["logic", "web", "tui"]);
+  const SURFACES: ReadonlySet<string> = new Set(["logic", "web", "tui", "desktop"]);
-        return { error: `ops[${i}].surface must be "logic", "web", or "tui"` };
+        return { error: `ops[${i}].surface must be "logic", "web", "tui", or "desktop"` };
-        surface: (op.surface as "logic" | "web" | "tui" | undefined) ?? "logic",
+        surface: (op.surface as CriterionSurface | undefined) ?? "logic",
```

steering.ts:20-31 does not import `CriterionSurface` today; add `type CriterionSurface` to its existing import from ./goalplan.ts.

final-gate-guard.ts:

```diff
-    const qaRequired = criteria.some((c) => c?.surface === "web" || c?.surface === "tui");
+    const qaRequired = criteria.some((c) => c?.surface === "web" || c?.surface === "tui" || c?.surface === "desktop");
```

durable-goalplan.md:60-62: the `criteria[]` bullet names the allowed values (`logic` default, `web`, `tui`, `desktop`), says `surface` comes from `add-criterion --surface` on a session-bound plan (`init` rejects the flag), and says `web`, `tui` and `desktop` make the QA receipt mandatory through validation on schemaVersion 2+ plans with a final gate and through the spawn guard on any plan with a recorded finalGate. :84: `[--surface logic|web|tui]` becomes `[--surface logic|web|tui|desktop]`.

## Tests

| File | Change | Activation and observable effect |
|---|---|---|
| pabcd-state/test/final-gate.test.ts (computeQaRequired case ≈313) | add a `desktop` criterion plan asserting `true` | computeQaRequired returns true for desktop |
| pabcd-state/test/final-gate.test.ts (round trip ≈318) | new test: write a plan whose criterion surface is `desktop`, read it back, assert `desktop`; write `native`, read back, assert undefined; a schemaVersion 2 plan with that dropped value fails validation with the four-value message from goalplan.ts:1567 | revive keeps known, drops unknown; v2 refuses the silent QA exemption (the D4 downgrade hazard on the reader side) |
| pabcd-state/test/final-gate.test.ts | table test over logic/web/tui/desktop/api: computeQaRequired is true exactly for web, tui, desktop | pins the QA set that final-gate-guard mirrors |
| pabcd-state/test/goalplan.test.ts:366 and test/fixtures/capture-goalplan-baseline.mjs:31 | add `desktop` to both preserved surface sets | the two sets stay equal |
| pabcd-state/test/steering.test.ts (after ≈126) | add-criterion with `surface: "desktop"` applies and persists; `surface: "native"` is rejected with the four-value message | steering allowed set |
| pabcd-state/test/goalplan-public-surface.test.ts | new test with its own fixture: a plan bound to a canonical session id through writeState, then `runGoalplanCli` add-criterion `--surface desktop` exits 0 and the stored criterion has surface desktop; `--surface native` exits 1 naming `logic|web|tui|desktop`; `init ... --surface desktop` and `init ... --surface` (no value) exit 1 and write no plan; the existing help test also asserts the usage line lists desktop | CLI allowed set, usage and init refusal, executed through runGoalplanCli |
| subagent-config/test/final-gate-guard.test.ts | the fixture has no schemaVersion (v1) and a recorded finalGate; the desktop test therefore also pins that the guard enforces regardless of version | guard layer independent of schemaVersion |
| subagent-config/test/final-gate-guard.test.ts (≈73, ≈120) | fixture qaRequired includes desktop; new test "a desktop criterion demands a QA receipt"; table test over logic/web/tui/desktop/api asserting the guard demands QA exactly for web, tui, desktop | the inlined guard matches computeQaRequired's table |

## C finding folded (reviewer 01a0cca9, GO-WITH-FIXES blockers=1)

The parser skipped unknown tokens, so `--surface=desktop` escaped both the init refusal and add-criterion classification. Fix: `--surface=<value>` is parsed as the same flag (empty value counts as missing), and a following token that starts with `--` is not consumed as the value, so `--surface --cwd x` reports a missing surface instead of the surface "--cwd". Tests in goalplan-public-surface cover the equals form on add-criterion (stored desktop) and init (refused), `--surface=` and `--surface --criterion y` (needs a value, plan unchanged).

## Verification

`npm run build` exit 0, then `npm test` with 0 failures (skips only the three pre-existing platform skips), and `git diff --stat` limited to the files above plus regenerated dist.

## wp2 D

Shipped at d0c09a79 and dd7f6e25. Full suite under `cxc receipt test` at dd7f6e25: 3528 tests, 3525 pass, 0 fail, 3 pre-existing skips (was 3522 at 0.2.36). Real CLI invocations in a temporary git repository: init with `--surface` refused and wrote nothing, add-criterion stored `desktop`, `native` and a valueless flag were refused, help lists desktop. The adversarial reviewer found the equals-form escape; after dd7f6e25 it returned PASS. The worktree had no node_modules, so the first full run failed only in gui/test/router.test.ts on a missing `react`; `npm ci` in this worktree fixed the environment.

What did not improve: `--surface` stays ignored on steer, add-work-phase, add-task and meet-criterion, and misspelled flags such as `--surfaces=` are still skipped silently by the parser. The QA evidence schema still has no `desktop` surface; wp3 maps desktop UI rows to `gui` and runtime/packaging rows to `cli`. Next: wp3 from 020.
