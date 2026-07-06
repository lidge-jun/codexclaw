# 020 — Phase 2: CLI Surface Unification

## Objective
Rename `cxc goalplan` CLI to `cxc loop` with `goalplan` as deprecated alias.

## File Change Map

### MODIFY `components/pabcd-state/src/cli.ts`

**Current (line 83-93):**
```typescript
  // `goalplan` command path (030.2): project-local goalplan init/show/validate.
  if (kind === "goalplan") {
    const parsed = parseGoalplanCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`goalplan: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runGoalplanCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }
```

**After:**
```typescript
  // `loop` command path: project-local loop/goalplan init/show/validate.
  // `goalplan` is a deprecated alias for `loop`.
  if (kind === "loop" || kind === "goalplan") {
    const label = kind === "goalplan" ? "goalplan (deprecated, use 'loop')" : "loop";
    const parsed = parseGoalplanCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`${label}: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runGoalplanCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }
```

**Diff:** Line 84 condition changes from `kind === "goalplan"` to
`kind === "loop" || kind === "goalplan"`. Add deprecation label variable.
Error message uses `label` instead of hardcoded `"goalplan"`.

### MODIFY `components/pabcd-state/src/goalplan-cli.ts`

**Output label changes (3 locations):**

1. `renderPlan()` line ~87: `[codexclaw goalplan: ${plan.slug}]`
   -> `[codexclaw loop: ${plan.slug}]`

2. `runGoalplanCli()` init error line ~99: `"goalplan init: --objective ..."`
   -> `"loop init: --objective ..."`

3. `runGoalplanCli()` init duplicate error line ~103:
   `"goalplan init: a plan already exists..."`
   -> `"loop init: a plan already exists..."`

4. `runGoalplanCli()` show/validate no-slug error line ~118:
   `"goalplan ${args.verb}: --slug ..."`
   -> `"loop ${args.verb}: --slug ..."`

5. `runGoalplanCli()` show/validate no-plan error line ~122:
   `"goalplan ${args.verb}: no plan found..."`
   -> `"loop ${args.verb}: no plan found..."`

6. Validate OK output line ~127:
   `[codexclaw goalplan validate: ${slug}]`
   -> `[codexclaw loop validate: ${slug}]`

7. Validate FAIL output line ~131:
   `[codexclaw goalplan validate: ${slug}]`
   -> `[codexclaw loop validate: ${slug}]`

**No type/function renames needed.** The internal types (GoalplanCliArgs,
runGoalplanCli, etc.) stay as-is since they're implementation detail, not
user-facing. Only the output strings change.

## Scope Boundary
- IN: cli.ts routing, goalplan-cli.ts output labels
- OUT: goalplan.ts data model (unchanged), hook.ts (unchanged)

## Accept Criteria
1. `cxc loop init --objective "test"` produces output starting with `[codexclaw loop:`
2. `cxc goalplan init --objective "test2"` still works (deprecated alias)
3. `cxc loop show`, `cxc loop validate` work identically to goalplan equivalents
4. No existing test breaks (test output assertions updated in Phase 4)
