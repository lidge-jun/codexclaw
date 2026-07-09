import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGoalplan,
  readGoalplan,
  writeGoalplan,
  appendGoalplanLedger,
  goalplanDir,
  remainingWorkPhases,
  nextOpenTask,
  unmetCriteria,
  isGoalplanComplete,
  validateGoalplan,
  advanceWorkPhase,
  type Goalplan,
} from "../src/goalplan.ts";
import { deriveSlug } from "../src/freeze.ts";
import { parseGoalplanCliArgs, runGoalplanCli } from "../src/goalplan-cli.ts";
import { readState } from "../src/state.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-goalplan-"));
}

test("030: schema round-trips (write then read returns an equal Goalplan)", () => {
  const cwd = tmp();
  const plan = buildGoalplan({
    objective: "Build the Thing",
    criteria: [{ scenario: "it builds", expectedEvidence: "exit 0" }],
    now: () => "2026-07-01T00:00:00Z",
  });
  writeGoalplan(cwd, plan);
  const read = readGoalplan(cwd, plan.slug);
  assert.ok(read);
  // updatedAt is refreshed on write; compare the rest structurally.
  assert.equal(read!.objective, plan.objective);
  assert.equal(read!.slug, plan.slug);
  assert.deepEqual(read!.criteria, plan.criteria);
  assert.deepEqual(read!.host, plan.host);
});

test("030: slug-namespaced path, distinct from plan/interview dirs", () => {
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "Hello, World!!" });
  assert.equal(plan.slug, "hello-world");
  writeGoalplan(cwd, plan);
  assert.equal(goalplanDir(cwd, plan.slug), join(cwd, ".codexclaw", "goalplans", "hello-world"));
  assert.ok(existsSync(join(cwd, ".codexclaw", "goalplans", "hello-world", "goalplan.json")));
});

test("030: absent or malformed -> readGoalplan returns null (never throws)", () => {
  const cwd = tmp();
  assert.equal(readGoalplan(cwd, "missing"), null);
  // malformed JSON
  const dir = goalplanDir(cwd, "bad");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "goalplan.json"), "{ not json");
  assert.equal(readGoalplan(cwd, "bad"), null);
  // structurally invalid (missing required fields)
  writeFileSync(join(dir, "goalplan.json"), JSON.stringify({ objective: "x" }));
  assert.equal(readGoalplan(cwd, "bad"), null);
});

test("030: derived helpers (remaining/nextOpen/unmet/complete) on fixtures", () => {
  const plan: Goalplan = buildGoalplan({ objective: "loop", criteria: [{ scenario: "c" }] });
  plan.workPhases = [
    { id: "wp-1", title: "one", status: "done", tasks: [{ id: "t-1", title: "a", status: "done" }], criteriaIds: [] },
    { id: "wp-2", title: "two", status: "in_progress", tasks: [
      { id: "t-2", title: "b", status: "done" },
      { id: "t-3", title: "c", status: "pending" },
    ], criteriaIds: ["c-1"] },
  ];
  assert.deepEqual(remainingWorkPhases(plan).map((w) => w.id), ["wp-2"]);
  const next = nextOpenTask(plan);
  assert.equal(next?.task.id, "t-3");
  assert.deepEqual(unmetCriteria(plan).map((c) => c.id), ["c-1"]);
  assert.equal(isGoalplanComplete(plan), false);

  // close everything
  plan.workPhases.forEach((w) => { w.status = "done"; w.tasks.forEach((t) => (t.status = "done")); });
  plan.criteria.forEach((c) => { c.status = "met"; c.capturedEvidence = "done"; });
  assert.equal(nextOpenTask(plan), null);
  assert.equal(isGoalplanComplete(plan), true);
});

test("030: validateGoalplan rejects met-without-evidence and incomplete plans", () => {
  const plan = buildGoalplan({ objective: "v", criteria: [{ scenario: "c" }] });
  // unmet criterion -> not ok
  assert.equal(validateGoalplan(plan).ok, false);
  // mark met but no evidence -> still not ok (rubber-stamp guard)
  plan.criteria[0].status = "met";
  const r1 = validateGoalplan(plan);
  assert.equal(r1.ok, false);
  assert.ok(r1.reasons.some((x) => /no captured evidence/.test(x)));
  // with evidence + no work phases -> ok
  plan.criteria[0].capturedEvidence = "proof";
  assert.equal(validateGoalplan(plan).ok, true);
});

test("260709: validateGoalplan FAILS an EMPTY plan (no workPhases, no criteria)", () => {
  // 019f4456 regression: a `loop init`-only artifact passed the E8 gate vacuously.
  const plan = buildGoalplan({ objective: "shell only" });
  const verdict = validateGoalplan(plan);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((x) => /plan is empty/.test(x)));
  // registering EITHER a criterion or a work phase lifts the empty-plan failure.
  const withCriterion = buildGoalplan({ objective: "with criterion", criteria: [{ scenario: "c", expectedEvidence: "e" }] });
  withCriterion.criteria[0] = { ...withCriterion.criteria[0], status: "met", capturedEvidence: "proof" };
  assert.equal(validateGoalplan(withCriterion).ok, true);
});

test("030: appendGoalplanLedger is append-only JSONL", () => {
  const cwd = tmp();
  const slug = deriveSlug("led");
  appendGoalplanLedger(cwd, slug, { ts: "t1", slug, event: "created", detail: "a" });
  appendGoalplanLedger(cwd, slug, { ts: "t2", slug, event: "task_done", detail: "b" });
  const raw = readFileSync(join(goalplanDir(cwd, slug), "ledger.jsonl"), "utf8").trim().split("\n");
  assert.equal(raw.length, 2);
  assert.equal(JSON.parse(raw[0]).event, "created");
  assert.equal(JSON.parse(raw[1]).event, "task_done");
});

// ---- CLI (030.2) ----------------------------------------------------------

test("030.2: init requires a real objective, then show/validate work", () => {
  const cwd = tmp();
  // init without objective -> error
  const noObj = parseGoalplanCliArgs(["init"], cwd);
  assert.ok(!("error" in noObj));
  assert.equal(runGoalplanCli(noObj as any).code, 1);

  // init with objective -> writes plan
  const initArgs = parseGoalplanCliArgs(["init", "--objective", "Ship the loop", "--criterion", "tests green"], cwd);
  assert.ok(!("error" in initArgs));
  const init = runGoalplanCli(initArgs as any);
  assert.equal(init.code, 0);
  assert.match(init.output, /objective: Ship the loop/);
  const slug = deriveSlug("Ship the loop");
  assert.ok(readGoalplan(cwd, slug));

  // duplicate init -> error
  assert.equal(runGoalplanCli(parseGoalplanCliArgs(["init", "--objective", "Ship the loop"], cwd) as any).code, 1);

  // show by objective
  const show = runGoalplanCli(parseGoalplanCliArgs(["show", "--objective", "Ship the loop"], cwd) as any);
  assert.equal(show.code, 0);
  assert.match(show.output, /criteria: 1 \(unmet 1\)/);

  // validate fails (unmet criterion)
  const val = runGoalplanCli(parseGoalplanCliArgs(["validate", "--slug", "Ship the loop"], cwd) as any);
  assert.equal(val.code, 1);
  assert.match(val.output, /FAIL/);
});

test("030.2: unknown verb -> parse error; show/validate need a slug source", () => {
  const cwd = tmp();
  const bad = parseGoalplanCliArgs(["frobnicate"], cwd);
  assert.ok("error" in bad);
  const noSlug = runGoalplanCli(parseGoalplanCliArgs(["show"], cwd) as any);
  assert.equal(noSlug.code, 1);
  assert.match(noSlug.output, /required/);
  const missing = runGoalplanCli(parseGoalplanCliArgs(["show", "--slug", "ghost"], cwd) as any);
  assert.equal(missing.code, 1);
  assert.match(missing.output, /no plan found/);
});

test("030.3: init --session persists the derived slug into that session's state", () => {
  const cwd = tmp();
  const args = parseGoalplanCliArgs(["init", "--objective", "Bound objective", "--session", "sess-1"], cwd);
  assert.ok(!("error" in args));
  assert.equal((args as any).session, "sess-1");
  assert.equal(runGoalplanCli(args as any).code, 0);
  assert.equal(readState(cwd, "sess-1").slug, deriveSlug("Bound objective"));
});

test("030.3: init WITHOUT --session leaves session state untouched (slug stays empty)", () => {
  const cwd = tmp();
  assert.equal(runGoalplanCli(parseGoalplanCliArgs(["init", "--objective", "Unbound"], cwd) as any).code, 0);
  // a fresh read of an unknown session is the default (empty slug)
  assert.equal(readState(cwd, "never-bound").slug, "");
});


// ---- advanceWorkPhase (Phase 3: D-close auto-advance) ----------------------

test("advanceWorkPhase: marks current done, activates next in declared order", () => {
  const plan = buildGoalplan({ objective: "multi-phase" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "in_progress", tasks: [{ id: "t-1", title: "a", status: "pending" }], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "pending", tasks: [{ id: "t-2", title: "b", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  const advanced = advanceWorkPhase(plan);
  assert.ok(advanced);
  assert.equal(advanced!.workPhases[0].status, "done");
  assert.equal(advanced!.workPhases[0].tasks[0].status, "done");
  assert.equal(advanced!.workPhases[1].status, "in_progress");
  assert.equal(advanced!.activeWorkPhaseId, "wp-2");
});

test("advanceWorkPhase: returns null when no activeWorkPhaseId", () => {
  const plan = buildGoalplan({ objective: "no-active" });
  plan.activeWorkPhaseId = null;
  assert.equal(advanceWorkPhase(plan), null);
});

test("advanceWorkPhase: returns null when activeWorkPhaseId is stale (not found)", () => {
  const plan = buildGoalplan({ objective: "stale-cursor" });
  plan.workPhases = [{ id: "wp-1", title: "one", status: "pending", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = "ghost";
  assert.equal(advanceWorkPhase(plan), null);
});

test("advanceWorkPhase: sets null activeWorkPhaseId when last phase", () => {
  const plan = buildGoalplan({ objective: "last-phase" });
  plan.workPhases = [
    { id: "wp-1", title: "only", status: "in_progress", tasks: [{ id: "t-1", title: "a", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  const advanced = advanceWorkPhase(plan);
  assert.ok(advanced);
  assert.equal(advanced!.activeWorkPhaseId, null);
  assert.equal(advanced!.workPhases[0].status, "done");
});

test("advanceWorkPhase: picks next pending AFTER current, not before", () => {
  const plan = buildGoalplan({ objective: "order-test" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "pending", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "in_progress", tasks: [], criteriaIds: [] },
    { id: "wp-3", title: "third", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  const advanced = advanceWorkPhase(plan);
  assert.ok(advanced);
  // Should pick wp-3 (after wp-2), not wp-1 (before wp-2)
  assert.equal(advanced!.activeWorkPhaseId, "wp-3");
});

// ---- CLI output label (Phase 2: cxc loop) ----------------------------------

test("CLI output uses loop label, not goalplan", () => {
  const cwd = tmp();
  const args = parseGoalplanCliArgs(["init", "--objective", "Label test"], cwd);
  assert.ok(!("error" in args));
  const result = runGoalplanCli(args as any);
  assert.equal(result.code, 0);
  assert.match(result.output, /\[codexclaw loop:/);
  assert.ok(!result.output.includes("[codexclaw goalplan:"));
});
