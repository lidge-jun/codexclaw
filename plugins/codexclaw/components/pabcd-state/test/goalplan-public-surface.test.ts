// wp6 신규 파일 import 전체; 선행 wp 추가 이름 없음
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  advanceWorkPhase, askGoalplanDecision, buildGoalplan, goalplanDir, readGoalplan, readyTasks,
  readyWorkPhases, writeGoalplan, type Goalplan,
} from "../src/goalplan.ts";
import {
  parseGoalplanCliArgs, renderGoalplanHelp, runGoalplanCli, type GoalplanCliArgs,
} from "../src/goalplan-cli.ts";
import { defaultState, writeState } from "../src/state.ts";

function fixture(): Goalplan {
  const plan = buildGoalplan({
    objective: "public surface fixture",
    criteria: [{ scenario: "contract is verified", expectedEvidence: "node --test exits 0" }],
    now: () => "2026-08-29T00:00:00.000Z",
  });
  plan.schemaVersion = 3;
  plan.activeWorkPhaseId = "wp-live";
  plan.workPhases = [
    {
      id: "wp-base", title: "base", status: "done", dependsOn: [], criteriaIds: [],
      tasks: [
        { id: "shared", title: "base task", status: "done", dependsOn: [], outcome: "base shipped" },
        { id: "base-only", title: "base-only task", status: "done", dependsOn: [], outcome: "base only shipped" },
      ],
    },
    {
      id: "wp-live", title: "live", status: "in_progress", dependsOn: ["wp-base"], criteriaIds: ["c-1"],
      tasks: [
        { id: "shared", title: "local prerequisite", status: "done", dependsOn: [], outcome: "local ready" },
        { id: "ready-task", title: "ready task", status: "pending", dependsOn: ["shared"] },
        { id: "blocked-task", title: "blocked task", status: "pending", dependsOn: ["later"] },
        { id: "later", title: "later task", status: "pending", dependsOn: [] },
      ],
    },
    {
      id: "wp-blocked", title: "blocked", status: "pending", dependsOn: ["wp-live"], criteriaIds: [],
      tasks: [{ id: "ready-task", title: "same id elsewhere", status: "pending", dependsOn: [] }],
    },
  ];
  return plan;
}

function workspace(plan: Goalplan): { cwd: string; session: string } {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-public-"));
  const session = "sess-public";
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState(session), slug: plan.slug });
  return { cwd, session };
}

function planText(cwd: string, slug: string): string {
  return readFileSync(join(goalplanDir(cwd, slug), "goalplan.json"), "utf8");
}

function ledgerText(cwd: string, slug: string): string {
  const path = join(goalplanDir(cwd, slug), "ledger.jsonl");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function cli(cwd: string, argv: string[]) {
  const parsed = parseGoalplanCliArgs(argv, cwd);
  assert.equal("error" in parsed, false);
  return runGoalplanCli(parsed as GoalplanCliArgs);
}

test("ready APIs honor phase-local task dependencies", () => {
  const plan = fixture();
  assert.deepEqual(readyWorkPhases(plan).map((wp) => wp.id), ["wp-live"]);
  assert.deepEqual(
    readyTasks(plan).map(({ workPhaseId, task }) => `${workPhaseId}/${task.id}`),
    ["wp-live/ready-task", "wp-live/later"],
  );
});

test("parser accumulates repeated depends-on and keeps commas in one id", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-parser-"));
  const repeated = parseGoalplanCliArgs([
    "add-work-phase", "--depends-on", "wp-a", "--depends-on", "wp-b",
  ], cwd) as GoalplanCliArgs;
  assert.deepEqual(repeated.dependsOn, ["wp-a", "wp-b"]);
  const comma = parseGoalplanCliArgs(["add-work-phase", "--depends-on", "wp-a,wp-b"], cwd) as GoalplanCliArgs;
  assert.deepEqual(comma.dependsOn, ["wp-a,wp-b"]);
  assert.deepEqual(
    parseGoalplanCliArgs(["add-work-phase", "--depends-on", "wp-a", "--depends-on", "wp-a"], cwd),
    { error: "add-work-phase: --depends-on must not repeat prerequisite id 'wp-a'" },
  );
  assert.deepEqual(
    parseGoalplanCliArgs(["add-work-phase", "--depends-on", "   "], cwd),
    { error: "add-work-phase: --depends-on requires one non-empty prerequisite id" },
  );
});

test("per-verb flag table accepts every documented combination", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-parser-table-"));
  const root = join(cwd, "project");
  const cases: { argv: string[]; expected: Partial<GoalplanCliArgs> }[] = [
    { argv: ["init", "--objective", "Ship", "--session", "s", "--criterion", "A", "--criterion", "B", "--schema-version", "1"], expected: { verb: "init", objective: "Ship", session: "s", criteria: ["A", "B"], schemaVersion: 1 } },
    { argv: ["show", "--session", "s"], expected: { verb: "show", session: "s" } },
    { argv: ["validate", "--session", "s", "--slug", "ship"], expected: { verb: "validate", session: "s", slug: "ship" } },
    { argv: ["steer", "--session", "s", "--batch-json", "{}"], expected: { verb: "steer", session: "s", batchJson: "{}" } },
    { argv: ["add-criterion", "--session", "s", "--criterion", "A", "--surface=desktop"], expected: { verb: "add-criterion", session: "s", criteria: ["A"], surface: "desktop", surfaceGiven: true } },
    { argv: ["add-work-phase", "--session", "s", "--id", "wp2", "--title", "Second", "--depends-on", "wp0", "--depends-on", "wp1"], expected: { verb: "add-work-phase", session: "s", id: "wp2", title: "Second", dependsOn: ["wp0", "wp1"] } },
    { argv: ["ready", "--session", "s", "--json"], expected: { verb: "ready", session: "s", json: true } },
    { argv: ["add-task", "--session", "s", "--work-phase", "wp2", "--id", "t", "--title", "Task", "--depends-on", "a", "--depends-on", "b"], expected: { verb: "add-task", session: "s", workPhaseId: "wp2", id: "t", title: "Task", dependsOn: ["a", "b"] } },
    { argv: ["complete-task", "--session", "s", "--work-phase", "wp2", "--id", "t", "--outcome", "Done"], expected: { verb: "complete-task", session: "s", workPhaseId: "wp2", id: "t", outcome: "Done" } },
    { argv: ["meet-criterion", "--session", "s", "--id", "c-1", "--evidence", "Proof"], expected: { verb: "meet-criterion", session: "s", id: "c-1", evidence: "Proof" } },
  ];
  for (const { argv, expected } of cases) {
    const parsed = parseGoalplanCliArgs([...argv, "--cwd", root], cwd);
    assert.equal("error" in parsed, false, JSON.stringify(parsed));
    assert.deepEqual({ ...parsed, ...expected }, parsed);
    assert.equal((parsed as GoalplanCliArgs).cwd, root);
  }
  for (const token of ["help", "--help", "-h"]) {
    assert.deepEqual(parseGoalplanCliArgs([token], cwd), { verb: "help", cwd, criteria: [] });
  }
});

test("unknown flags are rejected for the selected verb before dispatch", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const cases = [
    ["steer", "--session", session, "--surface", "desktop"],
    ["add-work-phase", "--session", session, "--id", "new", "--title", "New", "--surface", "desktop"],
    ["add-task", "--session", session, "--work-phase", "wp-live", "--id", "new", "--title", "New", "--surface", "desktop"],
    ["complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task", "--outcome", "Done", "--surface", "desktop"],
    ["meet-criterion", "--session", session, "--id", "c-1", "--evidence", "Proof", "--surface", "desktop"],
    ["show", "--slug", plan.slug, "--json"],
    ["add-criterion", "--session", session, "--criterion", "New", "--bogus", "native"],
  ];
  for (const argv of cases) {
    const parsed = parseGoalplanCliArgs(argv, cwd);
    assert.ok("error" in parsed, argv.join(" "));
    assert.match(parsed.error, new RegExp(`^${argv[0]}: unknown flag`));
    assert.equal(planText(cwd, plan.slug), beforePlan);
    assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  }
});

test("positionals, missing values, and singleton repeats are rejected before writes", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const cases: [string[], RegExp][] = [
    [["ready", "extra"], /^ready: unexpected positional/],
    [["add-task", "--session", session, "--work-phase"], /^add-task: --work-phase requires a value/],
    [["add-criterion", "--session", session, "--criterion", "x", "--surface", "--cwd", cwd], /^add-criterion: --surface needs a value/],
    [["add-criterion", "--session", session, "--criterion", "x", "--surface="], /^add-criterion: --surface needs a value/],
    [["validate", "--slug", plan.slug, "--session", session, "--session", "other"], /^validate: --session may be provided only once/],
    [["init", "--objective", "x", "--schema-version", "nope"], /^init: --schema-version requires a finite number/],
    [["init", "--objective"], /^init: --objective requires a value/],
    [["help", "extra"], /^help: unexpected argument/],
    [["--help", "extra"], /^help: unexpected argument/],
    [["-h", "extra"], /^help: unexpected argument/],
    [["show", "--help", "extra"], /^show: unknown flag/],
  ];
  for (const [argv, error] of cases) {
    const parsed = parseGoalplanCliArgs(argv, cwd);
    assert.ok("error" in parsed, argv.join(" "));
    assert.match(parsed.error, error);
    assert.equal(planText(cwd, plan.slug), beforePlan);
    assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  }
});

test("ready json returns dependency-filtered arrays", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const result = cli(cwd, ["ready", "--session", session, "--json"]);
  assert.equal(result.code, 0);
  const body = JSON.parse(result.output);
  assert.deepEqual(body.readyWorkPhases, [
    { id: "wp-live", title: "live", status: "in_progress", dependsOn: ["wp-base"] },
  ]);
  assert.deepEqual(body.readyTasks.map((task: { workPhaseId: string; id: string }) =>
    `${task.workPhaseId}/${task.id}`), ["wp-live/ready-task", "wp-live/later"]);
});

test("ready rejects a non-canonical session before a sanitized collision can expose a plan", () => {
  const plan = fixture();
  const cwd = mkdtempSync(join(tmpdir(), "cxc-ready-session-"));
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState("a-b"), slug: plan.slug });

  const result = cli(cwd, ["ready", "--session", "a/b", "--json"]);

  assert.equal(result.code, 1);
  assert.equal(result.output, "loop ready: session id is not canonical");
  assert.doesNotMatch(result.output, new RegExp(plan.slug));
  assert.doesNotMatch(result.output, /wp-live|ready-task|Ready task/);
});

test("add-work-phase without dependencies reuses the pre-upgrade idempotency key", () => {
  const plan = fixture();
  plan.steeringLog = [{
    // sha256("wp-new: new").slice(0, 12) === "c90b4bd0e709"
    idempotencyKey: "add-work-phase-c90b4bd0e709",
    rationale: "cxc loop add-work-phase",
    evidence: "wp-new: new",
    appliedAt: "2026-08-28T00:00:00.000Z",
    summary: "1 op(s): add-work-phase",
  }];
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);

  const result = cli(cwd, [
    "add-work-phase", "--session", session, "--id", "wp-new", "--title", "new",
  ]);

  assert.equal(result.code, 0);
  assert.match(result.output, /already applied/);
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  assert.equal(readGoalplan(cwd, plan.slug)?.workPhases.some((wp) => wp.id === "wp-new"), false);
});

test("add-task uses phase-local uniqueness and terminal rejection writes nothing", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const crossPhase = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-blocked", "--id", "shared", "--title", "local shared",
  ]);
  assert.equal(crossPhase.code, 0);
  assert.equal(readGoalplan(cwd, plan.slug)?.workPhases[2].tasks.at(-1)?.id, "shared");
  const duplicate = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-live", "--id", "shared", "--title", "duplicate",
  ]);
  assert.equal(duplicate.code, 1);
  assert.equal(duplicate.output, "loop add-task: task 'wp-live/shared' is already in this work phase");
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const terminal = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-base", "--id", "new", "--title", "new",
  ]);
  assert.equal(terminal.code, 1);
  assert.equal(terminal.output, "loop add-task: work phase 'wp-base' is done and cannot accept a new task");
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("add-task accepts same-phase dependencies and rejects cross-phase, self, and comma references", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const accepted = cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-live", "--id", "dependent",
    "--title", "same-phase dependent", "--depends-on", "shared", "--depends-on", "later",
  ]);
  assert.equal(accepted.code, 0);
  assert.deepEqual(
    readGoalplan(cwd, plan.slug)?.workPhases[1].tasks.find((task) => task.id === "dependent")?.dependsOn,
    ["shared", "later"],
  );
  assert.match(ledgerText(cwd, plan.slug), /"event":"dependency_registered"/);

  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const cases = [
    {
      argv: ["--id", "cross-phase", "--title", "cross phase", "--depends-on", "base-only"],
      output: "loop add-task: task wp-live/cross-phase depends on unknown task 'base-only' in the same work phase",
    },
    {
      argv: ["--id", "self", "--title", "self", "--depends-on", "self"],
      output: "loop add-task: task wp-live/self depends on itself",
    },
    {
      argv: ["--id", "comma", "--title", "comma", "--depends-on", "shared,later"],
      output: "loop add-task: task wp-live/comma depends on unknown task 'shared,later' in the same work phase",
    },
  ];
  for (const { argv, output } of cases) {
    const result = cli(cwd, ["add-task", "--session", session, "--work-phase", "wp-live", ...argv]);
    assert.equal(result.code, 1);
    assert.equal(result.output, output);
    assert.equal(planText(cwd, plan.slug), beforePlan);
    assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  }
});

test("complete-task stores trimmed outcome and appends identical detail", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const result = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "  node --test: 24 pass  ",
  ]);
  assert.equal(result.code, 0);
  const stored = readGoalplan(cwd, plan.slug)!;
  assert.equal(stored.workPhases[1].tasks[1].status, "done");
  assert.equal(stored.workPhases[1].tasks[1].outcome, "node --test: 24 pass");
  assert.equal(stored.workPhases[1].status, "in_progress");
  assert.equal(stored.activeWorkPhaseId, "wp-live");
  assert.equal(stored.criteria[0].status, "open");
  const entries = ledgerText(cwd, plan.slug).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(entries.length, 1);
  assert.deepEqual({ event: entries[0].event, detail: entries[0].detail },
    { event: "task_done", detail: "node --test: 24 pass" });
});

test("ledger append failure keeps the committed lifecycle state and returns code 0 with a warning", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const ledgerPath = join(goalplanDir(cwd, plan.slug), "ledger.jsonl");
  mkdirSync(ledgerPath, { recursive: false });

  const result = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "authoritative plan proof",
  ]);

  assert.equal(result.code, 0);
  assert.match(
    result.output,
    /warning: goalplan state was committed, but ledger append failed:/,
  );
  const stored = readGoalplan(cwd, plan.slug)!;
  assert.equal(stored.workPhases[1].tasks[1].status, "done");
  assert.equal(stored.workPhases[1].tasks[1].outcome, "authoritative plan proof");
  assert.equal(existsSync(ledgerPath), true);
});

test("missing and blank outcome leave plan and ledger unchanged", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  for (const tail of [[], ["--outcome", "   "]]) {
    const result = cli(cwd, [
      "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task", ...tail,
    ]);
    assert.equal(result.code, 1);
    assert.equal(result.output, "loop complete-task: --work-phase, --id, and non-empty --outcome are required");
  }
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("complete-task rejects task and phase dependency blockers without writes", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const taskBlocked = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "blocked-task",
    "--outcome", "must not commit",
  ]);
  assert.equal(taskBlocked.code, 1);
  assert.equal(taskBlocked.output, "loop complete-task: task 'wp-live/blocked-task' is not ready");
  const phaseBlocked = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-blocked", "--id", "ready-task",
    "--outcome", "must not commit",
  ]);
  assert.equal(phaseBlocked.code, 1);
  assert.equal(phaseBlocked.output, "loop complete-task: task 'wp-blocked/ready-task' is not ready");
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("complete-task retry preserves first outcome and skips write and append", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "first proof",
  ]).code, 0);
  const afterPlan = planText(cwd, plan.slug);
  const afterLedger = ledgerText(cwd, plan.slug);
  const retry = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "replacement proof",
  ]);
  assert.equal(retry.code, 0);
  assert.equal(retry.output, "loop complete-task: task 'wp-live/ready-task' is already done; nothing to do");
  assert.equal(planText(cwd, plan.slug), afterPlan);
  assert.equal(ledgerText(cwd, plan.slug), afterLedger);
  assert.equal(readGoalplan(cwd, plan.slug)?.workPhases[1].tasks[1].outcome, "first proof");
});

test("criterion evidence is trimmed and retry keeps the first evidence", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-1", "--evidence", "  exit 0  ",
  ]).code, 0);
  const afterPlan = planText(cwd, plan.slug);
  const afterLedger = ledgerText(cwd, plan.slug);
  const retry = cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-1", "--evidence", "replacement",
  ]);
  assert.equal(retry.code, 0);
  assert.equal(readGoalplan(cwd, plan.slug)?.criteria[0].capturedEvidence, "exit 0");
  assert.equal(planText(cwd, plan.slug), afterPlan);
  assert.equal(ledgerText(cwd, plan.slug), afterLedger);
});

test("missing criterion and blank evidence leave plan and ledger unchanged", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const missing = cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-404", "--evidence", "proof",
  ]);
  assert.equal(missing.code, 1);
  assert.equal(missing.output, "loop meet-criterion: criterion 'c-404' is not in this plan");
  const blank = cli(cwd, [
    "meet-criterion", "--session", session, "--id", "c-1", "--evidence", "   ",
  ]);
  assert.equal(blank.code, 1);
  assert.equal(blank.output, "loop meet-criterion: --id and non-empty --evidence are required");
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("lock contention fails closed and leaves both files unchanged", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  mkdirSync(join(goalplanDir(cwd, plan.slug), ".goalplan.lock"), { recursive: false });
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const result = cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "ready-task",
    "--outcome", "must not commit",
  ]);
  assert.equal(result.code, 1);
  assert.match(result.output, /\.goalplan\.lock/);
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("public pending task keeps D-close at tasks_pending until completion", () => {
  const plan = fixture();
  plan.workPhases[1].tasks = [];
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, [
    "add-task", "--session", session, "--work-phase", "wp-live", "--id", "new-task", "--title", "new work",
  ]).code, 0);
  const pending = advanceWorkPhase(readGoalplan(cwd, plan.slug)!);
  assert.equal(pending.kind, "tasks_pending");
  if (pending.kind === "tasks_pending") assert.deepEqual(pending.pending.map((task) => task.id), ["new-task"]);
  assert.equal(cli(cwd, [
    "complete-task", "--session", session, "--work-phase", "wp-live", "--id", "new-task",
    "--outcome", "new work shipped",
  ]).code, 0);
  assert.equal(advanceWorkPhase(readGoalplan(cwd, plan.slug)!).kind, "ok");
});

test("help lists repeated dependency syntax and required outcome", () => {
  const help = renderGoalplanHelp();
  assert.match(help, /cxc loop init --objective/);
  assert.match(help, /cxc loop show \(--slug <slug> \| --objective <text> \| --session <id>\)/);
  assert.match(help, /cxc loop validate \(--slug <slug> \| --objective <text> \| --session <id>\)/);
  assert.match(help, /cxc loop ready \(--slug <slug> \| --objective <text> \| --session <id>\)/);
  assert.match(help, /cxc loop steer --session <id> --batch-json/);
  assert.match(help, /cxc loop add-work-phase --session <id> --id <id>/);
  assert.match(help, /cxc loop add-criterion --session <id> --criterion <text>/);
  assert.match(help, /add-criterion .*\[--surface logic\|web\|tui\|desktop\]/);
  assert.match(help, /\[--depends-on <id>\]\.\.\./);
  assert.match(help, /ready .*--json/);
  assert.match(help, /add-task .*\[--depends-on <task-id>\]\.\.\./);
  assert.match(help, /complete-task .*--outcome <text>/);
  assert.match(help, /meet-criterion .*--evidence <text>/);
  assert.match(help, /Repeat --depends-on once per prerequisite/);
  assert.match(help, /Unknown flags, stray positionals, missing values, and flags on the wrong verb are rejected before dispatch/);
  assert.match(help, /add-criterion .*\[--presented native\]/);
  for (const verb of ["init", "show", "validate", "steer", "add-criterion", "add-work-phase", "ready", "add-task", "complete-task", "meet-criterion"]) {
    const line = help.split("\n").find((row) => row.startsWith(`  cxc loop ${verb} `));
    assert.ok(line?.includes("[--cwd <path>]"), verb);
  }

  // 라운드 3 High: 산문이 약속한 두 회귀를 이 case 안에 담는다. 새 test로 빼면 신규 개수가
  // 18에서 19로 바뀌어 §검증의 1087·2262까지 흔들리므로 단언만 더한다.
  // mutating verb 셋은 세션 바인딩 slug만 읽으므로 usage 줄에 --slug가 없어야 한다.
  for (const verb of ["steer", "add-work-phase", "add-criterion"]) {
    const line = help.split("\n").find((row) => row.includes(`cxc loop ${verb} `));
    assert.ok(line, `usage line missing for ${verb}`);
    assert.equal(line!.includes("--slug"), false, line!);
  }

  // unknown-verb 거부 문구가 새 동사 넷을 포함하고 기존 여섯을 순서대로 남긴다.
  // 다음 verb 추가가 이 문구를 다시 빠뜨리면 여기서 RED가 난다.
  assert.deepEqual(parseGoalplanCliArgs(["redy"], "/tmp"), {
    error: "unknown loop verb 'redy' (expected init|show|validate|steer|add-criterion|add-work-phase|ready|add-task|complete-task|meet-criterion|ask|decide); run cxc loop --help",
  });
});

test("add-criterion takes --surface desktop, refuses unknown or valueless surfaces, and init refuses --surface", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const ok = cli(cwd, ["add-criterion", "--session", session, "--criterion", "tray popup matrix", "--surface", "desktop"]);
  assert.equal(ok.code, 0, ok.output);
  assert.equal(readGoalplan(cwd, plan.slug)?.criteria.find((c) => c.scenario === "tray popup matrix")?.surface, "desktop");

  const before = planText(cwd, plan.slug);
  const unknown = cli(cwd, ["add-criterion", "--session", session, "--criterion", "x", "--surface", "native"]);
  assert.equal(unknown.code, 1);
  assert.match(unknown.output, /logic\|web\|tui\|desktop/);
  const valueless = parseGoalplanCliArgs(["add-criterion", "--session", session, "--criterion", "x", "--surface"], cwd);
  assert.ok("error" in valueless);
  assert.match(valueless.error, /--surface needs a value/);
  assert.equal(planText(cwd, plan.slug), before);

  const eq = cli(cwd, ["add-criterion", "--session", session, "--criterion", "equals form", "--surface=desktop"]);
  assert.equal(eq.code, 0, eq.output);
  assert.equal(readGoalplan(cwd, plan.slug)?.criteria.find((c) => c.scenario === "equals form")?.surface, "desktop");
  const afterEq = planText(cwd, plan.slug);
  for (const argv of [
    ["add-criterion", "--session", session, "--criterion", "y", "--surface="],
    ["add-criterion", "--session", session, "--surface", "--criterion", "y"],
  ]) {
    const r = parseGoalplanCliArgs(argv, cwd);
    assert.ok("error" in r);
    assert.match(r.error, /--surface needs a value/);
  }
  assert.equal(planText(cwd, plan.slug), afterEq);

  const fresh = mkdtempSync(join(tmpdir(), "cxc-init-surface-"));
  const attempts = [
    ["init", "--objective", "surface refusal", "--criterion", "c", "--surface", "desktop"],
    ["init", "--objective", "surface refusal", "--surface"],
    ["init", "--objective", "surface refusal", "--surface=desktop", "--criterion", "c"],
  ];
  for (const argv of attempts) {
    const r = parseGoalplanCliArgs(argv, fresh);
    assert.ok("error" in r);
    assert.match(r.error, /--surface is not applied at init/);
    assert.match(r.error, /Nothing was written/);
    assert.equal(existsSync(join(fresh, ".codexclaw", "goalplans")), false);
  }
});

test("add-criterion stores presented native only for desktop in both value forms", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  for (const [scenario, flag] of [["native app", "--presented"], ["native dialog", "--presented=native"]]) {
    const argv = flag.includes("=")
      ? ["add-criterion", "--session", session, "--criterion", scenario, "--surface=desktop", flag]
      : ["add-criterion", "--session", session, "--criterion", scenario, "--surface", "desktop", flag, "native"];
    const result = cli(cwd, argv);
    assert.equal(result.code, 0, result.output);
    const criterion = readGoalplan(cwd, plan.slug)?.criteria.find((c) => c.scenario === scenario);
    assert.equal(criterion?.surface, "desktop");
    assert.equal(criterion?.presented, "native");
  }
});

test("goalplan reviver retains native presentation and drops unknown values", () => {
  const plan = buildGoalplan({
    objective: "presentation round trip",
    criteria: [{ scenario: "native", surface: "desktop", presented: "native" }],
  });
  const { cwd } = workspace(plan);
  assert.equal(readGoalplan(cwd, plan.slug)?.criteria[0]?.presented, "native");
  const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.criteria[0].presented = "web";
  writeFileSync(path, JSON.stringify(raw));
  assert.equal(readGoalplan(cwd, plan.slug)?.criteria[0]?.presented, undefined);
});

test("add-criterion rejects presented without desktop or with an unknown value without writing", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  for (const argv of [
    ["add-criterion", "--session", session, "--criterion", "native", "--presented", "native"],
    ["add-criterion", "--session", session, "--criterion", "web", "--surface", "web", "--presented", "native"],
    ["add-criterion", "--session", session, "--criterion", "unknown", "--surface", "desktop", "--presented=web"],
  ]) {
    const result = cli(cwd, argv);
    assert.equal(result.code, 1);
    assert.match(result.output, /--presented native requires --surface desktop/);
    assert.equal(planText(cwd, plan.slug), beforePlan);
    assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  }
});

test("parser rejects missing presented values and presented on other verbs before dispatch", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  for (const argv of [
    ["add-criterion", "--session", session, "--criterion", "x", "--surface", "desktop", "--presented"],
    ["add-criterion", "--session", session, "--criterion", "x", "--surface", "desktop", "--presented="],
  ]) {
    const parsed = parseGoalplanCliArgs(argv, cwd);
    assert.ok("error" in parsed);
    assert.match(parsed.error, /--presented requires a value/);
  }
  for (const verb of ["init", "show", "validate", "steer", "add-work-phase", "ready", "add-task", "complete-task", "meet-criterion"]) {
    const parsed = parseGoalplanCliArgs([verb, "--presented", "native"], cwd);
    assert.ok("error" in parsed, verb);
    assert.match(parsed.error, /unknown flag/);
  }
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
});

test("comma dependency is rejected while repeated flags persist dependencies", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const beforePlan = planText(cwd, plan.slug);
  const beforeLedger = ledgerText(cwd, plan.slug);
  const comma = cli(cwd, [
    "add-work-phase", "--session", session, "--id", "wp-new", "--title", "new",
    "--depends-on", "wp-base,wp-live",
  ]);
  assert.equal(comma.code, 1);
  assert.equal(
    comma.output,
    "loop add-work-phase: work phase wp-new depends on unknown work phase 'wp-base,wp-live'",
  );
  assert.equal(planText(cwd, plan.slug), beforePlan);
  assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
  const accepted = cli(cwd, [
    "add-work-phase", "--session", session, "--id", "wp-new", "--title", "new",
    "--depends-on", "wp-base", "--depends-on", "wp-live",
  ]);
  assert.equal(accepted.code, 0);
  assert.deepEqual(readGoalplan(cwd, plan.slug)?.workPhases.at(-1)?.dependsOn, ["wp-base", "wp-live"]);
  assert.match(ledgerText(cwd, plan.slug), /"event":"dependency_registered"/);
});

test("value flags accept the equals form, including values that start with --", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const title = parseGoalplanCliArgs(["add-task", "--session", session, "--work-phase", "wp-live", "--id", "dash", "--title=--x"], cwd);
  assert.ok(!("error" in title), JSON.stringify(title));
  assert.equal((title as GoalplanCliArgs).title, "--x");
  const evidence = parseGoalplanCliArgs(["meet-criterion", "--session=" + session, "--id=c-1", "--evidence=--flag proof"], cwd);
  assert.ok(!("error" in evidence), JSON.stringify(evidence));
  assert.equal((evidence as GoalplanCliArgs).evidence, "--flag proof");
  assert.equal((evidence as GoalplanCliArgs).session, session);
  const spaced = parseGoalplanCliArgs(["add-task", "--session", session, "--work-phase", "wp-live", "--id", "dash", "--title", "--x"], cwd);
  assert.ok("error" in spaced);
  assert.match(spaced.error, /--title requires a value \(use --title=<value> for a value that starts with --\)/);
  const emptyEquals = parseGoalplanCliArgs(["add-task", "--session", session, "--work-phase", "wp-live", "--id", "dash", "--title="], cwd);
  assert.ok("error" in emptyEquals);
  assert.match(emptyEquals.error, /--title requires a value$/);
  const jsonValue = parseGoalplanCliArgs(["ready", "--session", session, "--json=1"], cwd);
  assert.ok("error" in jsonValue);
  assert.match(jsonValue.error, /--json takes no value/);
  const initSurface = parseGoalplanCliArgs(["init", "--objective", "x", "--surface=web"], cwd);
  assert.ok("error" in initSurface);
  assert.match(initSurface.error, /--surface is not applied at init/);
});

test("the built CLI rejects a misplaced or misspelled flag before any write", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
  for (const entry of [join(root, "bin", "codexclaw.mjs"), join(root, "plugins", "codexclaw", "bin", "cxc.mjs")]) {
    for (const kind of ["loop", "goalplan"]) {
      const plan = fixture();
      const { cwd, session } = workspace(plan);
      const beforePlan = planText(cwd, plan.slug);
      const beforeLedger = ledgerText(cwd, plan.slug);
      for (const argv of [
        [kind, "add-task", "--session", session, "--work-phase", "wp-live", "--id", "n", "--title", "N", "--surface", "web"],
        [kind, "add-task", "--session", session, "--work-phse", "wp-live", "--id", "n", "--title", "N"],
      ]) {
        const res = spawnSync(process.execPath, [entry, ...argv, "--cwd", cwd], { cwd, encoding: "utf8" });
        assert.equal(res.status, 1, entry + " " + argv.join(" ") + ": " + res.stdout + res.stderr);
        assert.match(res.stderr + res.stdout, /add-task: unknown flag/);
        assert.equal(planText(cwd, plan.slug), beforePlan);
        assert.equal(ledgerText(cwd, plan.slug), beforeLedger);
      }
    }
  }
});

test("ask records an open decision and hides only linked work phases", () => {
  const plan = fixture();
  plan.workPhases.push({ id: "wp-free", title: "free", status: "pending", tasks: [{ id: "free-task", title: "free", status: "pending" }], criteriaIds: [] });
  const { cwd, session } = workspace(plan);
  const asked = cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API", "--recommendation", "Use v2", "--work-phase", "wp-live"]);
  assert.equal(asked.code, 0, asked.output);
  const back = readGoalplan(cwd, plan.slug)!;
  assert.equal(back.decisions?.[0]?.status, "open");
  assert.match(back.decisions?.[0]?.askedAt ?? "", /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(back.workPhases.find((wp) => wp.id === "wp-live")?.awaitsDecision, ["dec-1"]);
  assert.deepEqual(readyWorkPhases(back).map((wp) => wp.id), ["wp-free"]);
  assert.deepEqual(readyTasks(back).map(({ workPhaseId }) => workPhaseId), ["wp-free"]);
  const ready = cli(cwd, ["ready", "--session", session, "--json"]);
  assert.equal(ready.code, 0, ready.output);
  const data = JSON.parse(ready.output);
  assert.equal(data.openDecisions[0].id, "dec-1");
  assert.deepEqual(data.awaitingDecisions, [{ workPhaseId: "wp-live", decisionIds: ["dec-1"] }]);
  assert.match(cli(cwd, ["show", "--session", session]).output, /Choose API[\s\S]*waiting: wp-live/);
});

test("decide releases linked phases without unblocking explicit blocks", () => {
  const plan = fixture();
  plan.workPhases.push({ id: "wp-explicit", title: "explicit", status: "blocked", blockedReason: "vendor", tasks: [], criteriaIds: [] });
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API", "--work-phase", "wp-live", "--work-phase", "wp-explicit"]).code, 0);
  assert.equal(cli(cwd, ["decide", "--session", session, "--id", "dec-1", "--answer", "Use v2"]).code, 0);
  const back = readGoalplan(cwd, plan.slug)!;
  assert.equal(back.decisions?.[0]?.answer, "Use v2");
  assert.equal(back.decisions?.[0]?.status, "decided");
  assert.match(back.decisions?.[0]?.decidedAt ?? "", /^\d{4}-/);
  assert.deepEqual(readyWorkPhases(back).map((wp) => wp.id), ["wp-live"]);
  assert.equal(back.workPhases.find((wp) => wp.id === "wp-explicit")?.blockedReason, "vendor");
  assert.deepEqual(JSON.parse(cli(cwd, ["ready", "--session", session, "--json"]).output).awaitingDecisions, []);
});

test("ask rejects duplicate open question and unknown phase without a write", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API", "--work-phase", "wp-live"]).code, 0);
  const before = planText(cwd, plan.slug), ledger = ledgerText(cwd, plan.slug);
  const duplicate = cli(cwd, ["ask", "--session", session, "--id", "dec-2", "--question", " Choose API "]);
  assert.equal(duplicate.code, 1);
  assert.match(duplicate.output, /dec-1/);
  const unknown = cli(cwd, ["ask", "--session", session, "--id", "dec-2", "--question", "Other", "--work-phase", "ghost"]);
  assert.equal(unknown.code, 1);
  assert.match(unknown.output, /ghost/);
  assert.equal(planText(cwd, plan.slug), before);
  assert.equal(ledgerText(cwd, plan.slug), ledger);
});

test("ask and decide enforce per-verb flags before writing", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const before = planText(cwd, plan.slug), ledger = ledgerText(cwd, plan.slug);
  for (const argv of [
    ["ask", "--session", session, "--id", "dec-1", "--answer", "x"],
    ["decide", "--session", session, "--id", "dec-1", "--question", "x"],
    ["ask", "--session", session, "--id", "dec-1", "--question", "x", "--question", "y"],
    ["ask", "--session", session, "--id", "dec-1", "--question", "x", "--work-phase", "wp-live", "--work-phase", "wp-live"],
    ["ask", "--session", session, "--id", "dec-1", "--question="],
    ["decide", "--session", session, "--id", "dec-1", "--answer"],
  ]) assert.equal("error" in parseGoalplanCliArgs(argv, cwd), true, argv.join(" "));
  assert.equal(planText(cwd, plan.slug), before);
  assert.equal(ledgerText(cwd, plan.slug), ledger);
  assert.match(renderGoalplanHelp(), /ask --session <id> --id <id> --question <text>/);
  assert.match(renderGoalplanHelp(), /decide --session <id> --id <id> --answer <text>/);
});

test("decide is idempotent only for the same answer", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API"]);
  assert.equal(cli(cwd, ["decide", "--session", session, "--id", "dec-1", "--answer", "Use v2"]).code, 0);
  const before = planText(cwd, plan.slug);
  assert.equal(cli(cwd, ["decide", "--session", session, "--id", "dec-1", "--answer", "Use v2"]).code, 0);
  assert.equal(planText(cwd, plan.slug), before);
  assert.equal(cli(cwd, ["decide", "--session", session, "--id", "dec-1", "--answer", "Use v3"]).code, 1);
  assert.equal(planText(cwd, plan.slug), before);
});

test("ready rejects dangling and duplicate decision references", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  plan.workPhases.find((wp) => wp.id === "wp-live")!.awaitsDecision = ["ghost"];
  writeGoalplan(cwd, plan);
  const dangling = cli(cwd, ["ready", "--session", session]);
  assert.equal(dangling.code, 1);
  assert.match(dangling.output, /awaits unknown decision 'ghost'/);
  plan.decisions = [{ id: "ghost", question: "Choose", status: "open", askedAt: "2026-09-28T00:00:00.000Z" }];
  plan.workPhases.find((wp) => wp.id === "wp-live")!.awaitsDecision = ["ghost", "ghost"];
  writeGoalplan(cwd, plan);
  assert.match(cli(cwd, ["ready", "--session", session]).output, /more than once/);
  plan.workPhases.find((wp) => wp.id === "wp-live")!.awaitsDecision = ["ghost"];
  plan.decisions.push({ ...plan.decisions[0], question: "Again" });
  writeGoalplan(cwd, plan);
  assert.match(cli(cwd, ["ready", "--session", session]).output, /duplicate decision id/);
});


// #262 follow-up (issue train 0930, devlog/_plan/260930_issue_train/030): decision options

test("ask records options and ready/show expose them", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const asked = cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API",
    "--option", "A", "--option", "B", "--recommendation", "A", "--work-phase", "wp-live"]);
  assert.equal(asked.code, 0, asked.output);
  assert.deepEqual(readGoalplan(cwd, plan.slug)!.decisions?.[0]?.options, ["A", "B"]);
  const data = JSON.parse(cli(cwd, ["ready", "--session", session, "--json"]).output);
  assert.deepEqual(data.openDecisions[0].options, ["A", "B"]);
  assert.match(cli(cwd, ["show", "--session", session]).output, /options: A \| B \(recommended: A\)/);
  assert.match(renderGoalplanHelp(), /\[--option <text>\]\.\.\./);
});

test("ask rejects a recommendation outside the options without a write", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const before = planText(cwd, plan.slug), ledger = ledgerText(cwd, plan.slug);
  const res = cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API",
    "--option", "A", "--option", "B", "--recommendation", "C"]);
  assert.equal(res.code, 1);
  assert.match(res.output, /must be one of the options/);
  assert.equal(planText(cwd, plan.slug), before);
  assert.equal(ledgerText(cwd, plan.slug), ledger);
});

test("ask rejects blank and repeated options at parse time", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  const before = planText(cwd, plan.slug);
  const blank = parseGoalplanCliArgs(["ask", "--session", session, "--id", "dec-1", "--question", "Q", "--option", " "], cwd);
  assert.match((blank as { error: string }).error, /--option requires one non-empty value/);
  const repeated = parseGoalplanCliArgs(["ask", "--session", session, "--id", "dec-1", "--question", "Q", "--option", "A", "--option", " A"], cwd);
  assert.match((repeated as { error: string }).error, /--option must not repeat 'A'/);
  const misplaced = parseGoalplanCliArgs(["decide", "--session", session, "--id", "dec-1", "--answer", "x", "--option", "A"], cwd);
  assert.match((misplaced as { error: string }).error, /unknown flag '--option/);
  const equalsForm = parseGoalplanCliArgs(["ask", "--session", session, "--id", "dec-1", "--question", "Q", "--option=A", "--option=--x"], cwd);
  assert.deepEqual((equalsForm as GoalplanCliArgs).options, ["A", "--x"]);
  assert.equal(planText(cwd, plan.slug), before);
});

test("ask without --option stores no options key", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API"]).code, 0);
  const raw = JSON.parse(planText(cwd, plan.slug));
  assert.equal("options" in raw.decisions[0], false);
  const data = JSON.parse(cli(cwd, ["ready", "--session", session, "--json"]).output);
  assert.equal("options" in data.openDecisions[0], false);
});

test("decide keeps options and accepts a free-form answer", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API", "--option", "A", "--option", "B"]);
  const decided = cli(cwd, ["decide", "--session", session, "--id", "dec-1", "--answer", "something else"]);
  assert.equal(decided.code, 0, decided.output);
  const back = readGoalplan(cwd, plan.slug)!.decisions![0];
  assert.equal(back.status, "decided");
  assert.equal(back.answer, "something else");
  assert.deepEqual(back.options, ["A", "B"]);
  cli(cwd, ["ask", "--session", session, "--id", "dec-2", "--question", "Pick a region", "--option", "eu", "--option", "us"]);
  const shown = cli(cwd, ["show", "--session", session]).output;
  assert.match(shown, /options: eu \| us$/m);
  assert.doesNotMatch(shown, /recommended: undefined/);
});

test("reviver fails closed on malformed options", () => {
  const plan = fixture();
  const { cwd, session } = workspace(plan);
  assert.equal(cli(cwd, ["ask", "--session", session, "--id", "dec-1", "--question", "Choose API", "--option", "A", "--recommendation", "A"]).code, 0);
  const good = JSON.parse(planText(cwd, plan.slug));
  const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  for (const mutate of [
    (d: any) => { d.options = {}; },
    (d: any) => { d.options = []; },
    (d: any) => { d.options = [" "]; },
    (d: any) => { d.options = ["A", "A "]; },
    (d: any) => { d.options = [1]; },
    (d: any) => { d.options = ["B"]; },
  ]) {
    const bad = JSON.parse(JSON.stringify(good));
    mutate(bad.decisions[0]);
    writeFileSync(path, JSON.stringify(bad, null, 2));
    assert.equal(readGoalplan(cwd, plan.slug), null, JSON.stringify(bad.decisions[0].options));
    assert.match(cli(cwd, ["show", "--session", session]).output, /field 'decisions'/);
  }
  const padded = JSON.parse(JSON.stringify(good));
  padded.decisions[0].options = [" A "];
  writeFileSync(path, JSON.stringify(padded, null, 2));
  assert.deepEqual(readGoalplan(cwd, plan.slug)!.decisions![0].options, [" A "]);
});

test("askGoalplanDecision rejects empty, blank and repeated options (library)", () => {
  const plan = fixture();
  const base = { id: "dec-1", question: "Choose API", workPhaseIds: [], askedAt: "2026-09-30T00:00:00.000Z" };
  const reason = (options: string[]) => {
    const res = askGoalplanDecision(plan, { ...base, options });
    assert.equal(res.kind, "rejected");
    return (res as { reason: string }).reason;
  };
  assert.match(reason([]), /must not be empty/);
  assert.match(reason([" "]), /non-empty text/);
  assert.match(reason(["A", " A"]), /duplicate decision option 'A'/);
  const ok = askGoalplanDecision(plan, { ...base, options: [" A ", "B"], recommendation: " A" });
  assert.equal(ok.kind, "changed");
  const stored = (ok as { plan: Goalplan }).plan.decisions![0];
  assert.deepEqual(stored.options, ["A", "B"]);
  assert.equal(stored.recommendation, "A");
});


test("loop mutation receipts keep item/count facts without echoing a long objective", () => {
  const plan = fixture();
  const objective = "objective payload ".repeat(150);
  plan.objective = objective;
  const { cwd, session } = workspace(plan);
  const cases = [
    { argv: ["add-work-phase", "--session", session, "--id", "wp-receipt", "--title", "Receipt"],
      prefix: "loop add-work-phase: public-surface-fixture wp-receipt applied", counts: "phases=4 remaining=3, criteria=1 unmet=1" },
    { argv: ["add-criterion", "--session", session, "--criterion", "receipt criterion"],
      prefix: "loop add-criterion: public-surface-fixture c-2 applied", counts: "phases=4 remaining=3, criteria=2 unmet=2" },
    { argv: ["add-task", "--session", session, "--work-phase", "wp-live", "--id", "receipt-task", "--title", "Receipt task"],
      prefix: "loop add-task: public-surface-fixture receipt-task applied", counts: "phases=4 remaining=3, criteria=2 unmet=2" },
    { argv: ["complete-task", "--session", session, "--work-phase", "wp-live", "--id", "receipt-task", "--outcome", "verified receipt"],
      prefix: "loop complete-task: public-surface-fixture receipt-task applied", counts: "phases=4 remaining=3, criteria=2 unmet=2" },
    { argv: ["meet-criterion", "--session", session, "--id", "c-2", "--evidence", "verified criterion"],
      prefix: "loop meet-criterion: public-surface-fixture c-2 applied", counts: "phases=4 remaining=3, criteria=2 unmet=1" },
  ];
  for (const { argv, prefix, counts } of cases) {
    const result = cli(cwd, argv);
    assert.equal(result.code, 0, result.output);
    assert.equal(result.output, `${prefix} (${counts}); full plan: cxc loop show --session sess-public`);
    assert.ok(Buffer.byteLength(result.output) <= 250);
    assert.doesNotMatch(result.output, /objective payload|Receipt task|verified receipt/);
    assert.equal(readGoalplan(cwd, plan.slug)?.objective, objective);
  }
  const show = cli(cwd, ["show", "--session", session]);
  assert.equal(show.code, 0);
  assert.ok(show.output.includes(`objective: ${objective}`));
  const validate = cli(cwd, ["validate", "--session", session]);
  assert.equal(validate.code, 1);
  assert.match(validate.output, /FAIL/);
});
