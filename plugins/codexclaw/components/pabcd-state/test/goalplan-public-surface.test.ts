// wp6 신규 파일 import 전체; 선행 wp 추가 이름 없음
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  advanceWorkPhase, buildGoalplan, goalplanDir, readGoalplan, readyTasks,
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
    { error: "--depends-on must not repeat prerequisite id 'wp-a'" },
  );
  assert.deepEqual(
    parseGoalplanCliArgs(["add-work-phase", "--depends-on", "   "], cwd),
    { error: "--depends-on requires one non-empty prerequisite id" },
  );
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
  assert.match(help, /cxc loop show \(--slug <slug> \| --objective <text>\)/);
  assert.match(help, /cxc loop validate --slug <slug>/);
  assert.match(help, /cxc loop ready \(--slug <slug> \| --objective <text> \| --session <id>\)/);
  assert.match(help, /cxc loop steer --session <id> --batch-json/);
  assert.match(help, /cxc loop add-work-phase --session <id> --id <id>/);
  assert.match(help, /cxc loop add-criterion --session <id> --criterion <text>/);
  assert.match(help, /\[--depends-on <id>\]\.\.\./);
  assert.match(help, /ready .*--json/);
  assert.match(help, /add-task .*\[--depends-on <task-id>\]\.\.\./);
  assert.match(help, /complete-task .*--outcome <text>/);
  assert.match(help, /meet-criterion .*--evidence <text>/);
  assert.match(help, /Repeat --depends-on once per prerequisite/);

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
    error: "unknown loop verb 'redy' (expected init|show|validate|steer|add-criterion|add-work-phase|ready|add-task|complete-task|meet-criterion); run cxc loop --help",
  });
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
