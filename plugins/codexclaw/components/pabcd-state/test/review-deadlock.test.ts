import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReviewRoundCliArgs, runReviewRoundCli } from "../src/review-round-cli.ts";
import { handleReviewObserver } from "../src/review-observer.ts";
import { latestRound } from "../src/review-round.ts";
import { writeState, readState, defaultState, STATE_DIR } from "../src/state.ts";
import { buildGoalplan, writeGoalplan, readGoalplan } from "../src/goalplan.ts";
import { handleUserPromptSubmit } from "../src/hook.ts";
import { parseOrchestrateCliArgs, runOrchestrateCli } from "../src/orchestrate-cli.ts";

// The deadlock reported as "the gate recorded a verdict but cannot read it".
// An A>P re-plan mints a new epoch; a reviewer dispatched before it finishes
// afterwards, and its sign-off no longer matches. The observer used to drop it
// without a word, leaving the round in_flight and A>B refused forever.

function seedAtA(id: string, epoch = "e-probe-1"): { cwd: string; slug: string } {
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-deadlock-"));
  const unit = join(cwd, "devlog", "_plan", "260817_probe");
  mkdirSync(unit, { recursive: true });
  writeFileSync(join(unit, "000_plan.md"), "# probe\n");
  const slug = "deadlock-probe";
  const plan = buildGoalplan({ objective: "deadlock" });
  plan.slug = slug;
  plan.workPhases = [{ id: "wp0", title: "probe", status: "in_progress", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = "wp0";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    phase: "A",
    slug,
    planUnit: "devlog/_plan/260817_probe",
    planEpoch: epoch,
    flags: { interview: false, auditPassed: false, checkPassed: false },
  });
  return { cwd, slug };
}

function openRoundFor(cwd: string, id: string): string {
  const args = parseReviewRoundCliArgs(
    ["open", "--session", id, "--cwd", cwd, "--plan-path", "devlog/_plan/260817_probe/000_plan.md"],
    cwd,
  );
  assert.ok(!("error" in args));
  const r = runReviewRoundCli(args as never);
  assert.equal(r.code, 0, r.output);
  return r.output.split("\n")[0];
}

function signOff(cwd: string, id: string, launchId: string): void {
  handleReviewObserver(JSON.stringify({
    hook_event_name: "SubagentStop", session_id: id, cwd,
    agent_type: "explorer", agent_id: "e1",
    last_assistant_message: `reviewed\n\nLAUNCH: ${launchId}\nVERDICT: PASS`,
  }));
}

function goalplanLedger(cwd: string, slug: string): string {
  const p = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

test("a sign-off that arrives after a re-plan is recorded as ignored, with the reason", () => {
  const { cwd, slug } = seedAtA("late");
  try {
    const launchId = openRoundFor(cwd, "late");
    // the re-plan: a new epoch, exactly what A>P then P>A produces
    writeState(cwd, { ...readState(cwd, "late"), planEpoch: "e-probe-2" });

    signOff(cwd, "late", launchId);

    const ledger = goalplanLedger(cwd, slug);
    assert.match(ledger, /review_signoff_ignored/, "the observer must say why it dropped a verdict");
    assert.match(ledger, /re-planned/, "and name the re-plan as the cause");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("a re-plan closes the rounds it just invalidated", () => {
  const { cwd, slug } = seedAtA("cleanup");
  try {
    openRoundFor(cwd, "cleanup");
    assert.equal(latestRound(readGoalplan(cwd, slug)!, "plan_audit")!.status, "in_flight");

    // A>P then P>A through the CLI mints a fresh binding
    const toP = parseOrchestrateCliArgs(["p", "--session", "cleanup", "--cwd", cwd], cwd);
    runOrchestrateCli(toP as never);
    const toA = parseOrchestrateCliArgs(["a", "--session", "cleanup", "--cwd", cwd, "--attest",
      '{"from":"P","to":"A","did":"re-planned","planUnit":"devlog/_plan/260817_probe","workPhaseId":"wp0"}'], cwd);
    runOrchestrateCli(toA as never);

    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "inconclusive", "a stranded round must not hold the gate shut");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("entering A from chat with a plan attest records the binding", () => {
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-chatbind-"));
  try {
    const unit = join(cwd, "devlog", "_plan", "260817_probe");
    mkdirSync(unit, { recursive: true });
    writeFileSync(join(unit, "000_plan.md"), "# probe\n");
    const slug = "chat-bind";
    const plan = buildGoalplan({ objective: "chat bind" });
    plan.slug = slug;
    plan.workPhases = [{ id: "wp0", title: "probe", status: "in_progress", tasks: [], criteriaIds: [] }];
    plan.activeWorkPhaseId = "wp0";
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("chat-a"), phase: "P", slug, orchestrationActive: true, lastInjectedPhase: "P" });

    const attest = JSON.stringify({ from: "P", to: "A", did: "planned", planUnit: "devlog/_plan/260817_probe", workPhaseId: "wp0" });
    handleUserPromptSubmit({
      hook_event_name: "UserPromptSubmit",
      prompt: `orchestrate a --attest ${attest}`,
      cwd, session_id: "chat-a", turn_id: "t1",
    } as never);

    const st = readState(cwd, "chat-a");
    assert.equal(st.phase, "A");
    assert.ok(st.planEpoch, "chat entry must mint a binding, the same as the CLI");
    assert.equal(st.planUnit, "devlog/_plan/260817_probe");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
