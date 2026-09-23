# wp2: `desktop` criterion surface

Adds one value to the goalplan criterion surface so a native desktop criterion can require QA evidence at the final gate. Existing `logic`, `web` and `tui` plans keep working unchanged. No schemaVersion change (002 D4).

## Field chain (PLAN-FIELD-CHAIN-01)

| Stage | Path | Change |
|---|---|---|
| Creation: type | components/pabcd-state/src/goalplan.ts:75 | add `"desktop"` |
| Creation: CLI flag | components/pabcd-state/src/goalplan-cli.ts:78, :287, :314, :569 | doc comment, allowed set, error text, usage line |
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
+  /** `init` / `add-criterion`: the criterion surface (logic|web|tui|desktop). */
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

durable-goalplan.md:60-62: the `criteria[]` bullet names the allowed values (`logic` default, `web`, `tui`, `desktop`) and says `web`, `tui` and `desktop` make the final gate require a QA receipt. :84: `[--surface logic|web|tui]` becomes `[--surface logic|web|tui|desktop]`.

## Tests

| File | Change | Activation and observable effect |
|---|---|---|
| pabcd-state/test/final-gate.test.ts (computeQaRequired case ≈313) | add a `desktop` criterion plan asserting `true` | computeQaRequired returns true for desktop |
| pabcd-state/test/final-gate.test.ts (round trip ≈318) | new test: write a plan whose criterion surface is `desktop`, read it back, assert `desktop`; write `native`, read back, assert undefined; a schemaVersion 2 plan with that dropped value fails validation with the four-value message from goalplan.ts:1567 | revive keeps known, drops unknown; v2 refuses the silent QA exemption (the D4 downgrade hazard on the reader side) |
| pabcd-state/test/final-gate.test.ts | table test over logic/web/tui/desktop/api: computeQaRequired is true exactly for web, tui, desktop | pins the QA set that final-gate-guard mirrors |
| pabcd-state/test/goalplan.test.ts:366 and test/fixtures/capture-goalplan-baseline.mjs:31 | add `desktop` to both preserved surface sets | the two sets stay equal |
| pabcd-state/test/steering.test.ts (after ≈126) | add-criterion with `surface: "desktop"` applies and persists; `surface: "native"` is rejected with the four-value message | steering allowed set |
| pabcd-state/test/goalplan-public-surface.test.ts | new test with its own fixture: a plan bound to a canonical session id through writeState, then `runGoalplanCli` add-criterion `--surface desktop` exits 0 and the stored criterion has surface desktop; `--surface native` exits 1 naming `logic|web|tui|desktop`; the existing help test also asserts the usage line lists desktop | CLI allowed set and usage, executed through runGoalplanCli |
| subagent-config/test/final-gate-guard.test.ts (≈73, ≈120) | fixture qaRequired includes desktop; new test "a desktop criterion demands a QA receipt"; table test over logic/web/tui/desktop/api asserting the guard demands QA exactly for web, tui, desktop | the inlined guard matches computeQaRequired's table |

## Verification

`npm run build` exit 0, then `npm test` with 0 failures (skips only the three pre-existing platform skips), and `git diff --stat` limited to the files above plus regenerated dist.
