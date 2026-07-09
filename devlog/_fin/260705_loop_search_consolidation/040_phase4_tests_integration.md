# 040 — Phase 4: Tests + Integration Verification

## Objective
Update existing tests for renamed outputs, add new tests for D-close auto-advance
and `cxc loop` CLI routing. Run full gate.

## File Change Map

### MODIFY `components/pabcd-state/test/goalplan.test.ts`

**Output assertion updates (7 locations where test checks string output):**

1. Line ~72: `assert.match(init.output, /objective: Ship the loop/)`
   No change needed (checks objective content, not prefix).

2. Line ~77: implicit — the `init` output starts with `[codexclaw goalplan:`
   but no test asserts that prefix. Verify by running.

3. Line ~82: `assert.match(show.output, /criteria: 1 \(unmet 1\)/)`
   No change needed.

4. Line ~86-87: `assert.match(val.output, /FAIL/)` — No change needed.

**Conclusion:** goalplan.test.ts assertions check content patterns, not the
`[codexclaw goalplan:` vs `[codexclaw loop:` prefix. Run to verify; update
only if a test fails on the new prefix.

### NEW test block in `goalplan.test.ts`: D-close auto-advance

```typescript
test("D-close auto-advance: advanceWorkPhase marks current done and activates next", () => {
  const plan = buildGoalplan({ objective: "multi-phase" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "in_progress",
      tasks: [{ id: "t-1", title: "a", status: "pending" }], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "pending",
      tasks: [{ id: "t-2", title: "b", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";

  const advanced = advanceWorkPhase(plan);
  assert.ok(advanced);
  // wp-1 should be done with all tasks done
  const wp1 = advanced!.workPhases.find((w) => w.id === "wp-1")!;
  assert.equal(wp1.status, "done");
  assert.equal(wp1.tasks[0].status, "done");
  // wp-2 should be in_progress
  const wp2 = advanced!.workPhases.find((w) => w.id === "wp-2")!;
  assert.equal(wp2.status, "in_progress");
  assert.equal(advanced!.activeWorkPhaseId, "wp-2");
});

test("D-close auto-advance: returns null when no active phase", () => {
  const plan = buildGoalplan({ objective: "no-active" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "done", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  assert.equal(advanceWorkPhase(plan), null);
});

test("D-close auto-advance: returns plan with null activeWorkPhaseId when last phase", () => {
  const plan = buildGoalplan({ objective: "last-phase" });
  plan.workPhases = [
    { id: "wp-1", title: "only", status: "in_progress",
      tasks: [{ id: "t-1", title: "a", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";

  const advanced = advanceWorkPhase(plan);
  assert.ok(advanced);
  assert.equal(advanced!.activeWorkPhaseId, null);
  assert.equal(advanced!.workPhases[0].status, "done");
});
```

### NEW test in `orchestrate-cli.test.ts`: D-close writes goalplan

```typescript
test("D-close auto-advance: orchestrate D with session-bound goalplan advances work-phase", () => {
  const cwd = freshCwd();
  // Create a session at phase C with checkPassed, ready for D
  const sid = "auto-adv";
  writeState(cwd, {
    ...defaultState(sid),
    phase: "C",
    flags: { interview: false, auditPassed: true, checkPassed: true },
    orchestrationActive: true,
    slug: "test-goal",
  });
  // Create a goalplan with two work-phases
  const plan = buildGoalplan({ objective: "test goal" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "in_progress", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  writeGoalplan(cwd, plan);

  const r = runOrchestrateCli({
    verb: "D",
    attest: { from: "C", to: "D", did: "tests pass", checkOutput: "ok", exitCode: 0 },
    session: sid, cwd, json: false,
  });
  assert.equal(r.code, 0);

  // Verify goalplan was advanced
  const updated = readGoalplan(cwd, "test-goal");
  assert.ok(updated);
  assert.equal(updated!.activeWorkPhaseId, "wp-2");
  assert.equal(updated!.workPhases[0].status, "done");
  assert.equal(updated!.workPhases[1].status, "in_progress");
});
```

### NEW test in `orchestrate-cli.test.ts`: `cxc loop` CLI alias

This is an integration test that would need to call the actual CLI binary.
Since the routing is in cli.ts (process.argv parsing), and the test suite
uses direct function calls, verify this manually:
```bash
node dist/cli.js loop init --objective "test loop alias" --cwd /tmp/test-loop
node dist/cli.js goalplan show --objective "test loop alias" --cwd /tmp/test-loop
```

## Verification Commands
```bash
cd plugins/codexclaw
npm test                    # all unit tests
node scripts/gate.mjs       # full gate
```

## Accept Criteria
1. All existing tests pass without modification (or with minimal output-string updates)
2. 3 new advanceWorkPhase unit tests pass
3. D-close auto-advance integration test passes
4. `npm test` exit code 0
5. `scripts/gate.mjs` exit code 0
