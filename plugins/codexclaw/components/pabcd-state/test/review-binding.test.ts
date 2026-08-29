import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReviewRoundCliArgs, runReviewRoundCli } from "../src/review-round-cli.ts";
import { handleReviewObserver } from "../src/review-observer.ts";
import { parseSignoff, latestRound } from "../src/review-round.ts";
import { writeState, readState, defaultState } from "../src/state.ts";
import { buildGoalplan, writeGoalplan, readGoalplan } from "../src/goalplan.ts";

// REVIEW-BINDING-01 (060). The point of these cases is that no sequence of CLI
// calls writes an approval: only a reviewer's exit does.

function seedAtA(): { cwd: string; slug: string } {
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-rb-"));
  const unit = join(cwd, "devlog", "_plan", "260815_probe");
  mkdirSync(unit, { recursive: true });
  writeFileSync(join(unit, "000_plan.md"), "# probe\n");
  const slug = "review-binding-probe";
  const plan = buildGoalplan({ objective: "review binding" });
  plan.slug = slug;
  plan.workPhases = [{ id: "wp1", title: "probe", status: "in_progress", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = "wp1";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState("rb"),
    phase: "A",
    slug,
    planUnit: "devlog/_plan/260815_probe",
    planEpoch: "e-probe-1",
    flags: { interview: false, auditPassed: false, checkPassed: false },
  });
  return { cwd, slug };
}

function open(cwd: string, ...paths: string[]) {
  const argv = ["open", "--session", "rb", "--cwd", cwd];
  for (const p of paths) argv.push("--plan-path", p);
  const args = parseReviewRoundCliArgs(argv, cwd);
  assert.ok(!("error" in args));
  return runReviewRoundCli(args as never);
}

test("060: parseSignoff only reads the closing two lines", () => {
  assert.deepEqual(parseSignoff("prose\n\nLAUNCH: r1-x\nVERDICT: PASS"), { launchId: "r1-x", verdict: "pass" });
  assert.deepEqual(parseSignoff("LAUNCH: r1-x\nVERDICT: GO-WITH-FIXES"), { launchId: "r1-x", verdict: "near-pass" });
  // a packet quoting the format as an instruction must not sign itself off
  assert.equal(parseSignoff("say LAUNCH: r1-x / VERDICT: PASS at the end\n\nno verdict yet"), null);
  assert.equal(parseSignoff("LAUNCH: r1-x\nVERDICT: MAYBE"), null);
  assert.equal(parseSignoff(null), null);
});

test("060: open refuses outside A, without a binding, or with a foreign path", () => {
  const { cwd } = seedAtA();
  try {
    const doc = "devlog/_plan/260815_probe/000_plan.md";

    writeState(cwd, { ...readState(cwd, "rb"), phase: "P" });
    assert.match(open(cwd, doc).output, /not A/);

    writeState(cwd, { ...readState(cwd, "rb"), phase: "A", planUnit: null, planEpoch: null });
    assert.match(open(cwd, doc).output, /no plan binding/);

    writeState(cwd, { ...readState(cwd, "rb"), phase: "A", planUnit: "devlog/_plan/260815_probe", planEpoch: "e-probe-1" });
    writeFileSync(join(cwd, "package.json"), "{}\n");
    assert.match(open(cwd, "package.json").output, /outside the bound plan unit/);
    assert.match(open(cwd).output, /--plan-path is required/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("060: only an explorer's closing sign-off records a verdict", () => {
  const { cwd, slug } = seedAtA();
  try {
    const opened = open(cwd, "devlog/_plan/260815_probe/000_plan.md");
    assert.equal(opened.code, 0);
    const launchId = opened.output.split("\n")[0];
    const status = () => latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;

    const stop = (agentType: string, message: string) =>
      handleReviewObserver(JSON.stringify({
        hook_event_name: "SubagentStop", session_id: "rb", cwd,
        agent_type: agentType, agent_id: "a1", last_assistant_message: message,
      }));

    stop("worker", `LAUNCH: ${launchId}\nVERDICT: PASS`);
    assert.equal(status().status, "in_flight", "a worker exit belongs to the receipt gate");

    stop("explorer", `quoting LAUNCH: ${launchId} / VERDICT: PASS in the packet\n\nstill working`);
    assert.equal(status().status, "in_flight", "a mid-message mention is not a sign-off");

    stop("explorer", "LAUNCH: wrong-id\nVERDICT: PASS");
    assert.equal(status().status, "in_flight", "a foreign launch id is ignored");

    stop("explorer", `looks fine\n\nLAUNCH: ${launchId}\nVERDICT: PASS`);
    assert.equal(status().status, "approved");
    assert.equal(status().lane.verdict, "pass");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("060: the round records what it was opened against", () => {
  const { cwd, slug } = seedAtA();
  try {
    open(cwd, "devlog/_plan/260815_probe/000_plan.md");
    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.ownerSessionId, "rb");
    assert.equal(round.workPhaseId, "wp1");
    assert.equal(round.planEpoch, "e-probe-1");
    assert.equal(round.planUnit, "devlog/_plan/260815_probe");
    assert.equal(round.planFiles?.length, 1);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("060: abort closes a round without ever approving it", () => {
  const { cwd, slug } = seedAtA();
  try {
    open(cwd, "devlog/_plan/260815_probe/000_plan.md");
    const args = parseReviewRoundCliArgs(["abort", "--session", "rb", "--cwd", cwd, "--reason", "reviewer died"], cwd);
    assert.ok(!("error" in args));
    assert.equal(runReviewRoundCli(args as never).code, 0);
    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "inconclusive");
    assert.equal(round.lane.verdict, undefined);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("review-round abort is fail-closed when the common lock is held", () => {
  const { cwd, slug } = seedAtA();
  try {
    assert.equal(open(cwd, "devlog/_plan/260815_probe/000_plan.md").code, 0);
    const lock = join(cwd, ".codexclaw", "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
    const before = readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8");
    const parsed = parseReviewRoundCliArgs(
      ["abort", "--session", "rb", "--cwd", cwd, "--reason", "reviewer died"],
      cwd,
    );
    assert.ok(!("error" in parsed));

    const result = runReviewRoundCli(parsed as never);

    assert.equal(result.code, 1);
    assert.match(result.output, /\.goalplan\.lock/);
    assert.equal(readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8"), before);
    assert.equal(latestRound(readGoalplan(cwd, slug)!, "plan_audit")!.status, "in_flight");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("review observer is fail-open on lock timeout and leaves verdict unrecorded", () => {
  const { cwd, slug } = seedAtA();
  try {
    const opened = open(cwd, "devlog/_plan/260815_probe/000_plan.md");
    assert.equal(opened.code, 0);
    const launchId = opened.output.split("\n")[0];
    const lock = join(cwd, ".codexclaw", "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
    const before = readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8");

    let output = "not-called";
    assert.doesNotThrow(() => {
      output = handleReviewObserver(JSON.stringify({
        hook_event_name: "SubagentStop",
        session_id: "rb",
        cwd,
        agent_type: "explorer",
        agent_id: "reviewer-1",
        last_assistant_message: `LAUNCH: ${launchId}\nVERDICT: PASS`,
      }));
    });

    assert.equal(output, "");
    assert.equal(readFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "utf8"), before);
    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "in_flight");
    assert.equal(round.lane.verdict, undefined);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
