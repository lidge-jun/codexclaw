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

/** A v1-surface exit: multi_agent_v2 is off, so no agent_type reaches the hook. */
function signOffWithoutAgentType(cwd: string, id: string, launchId: string): void {
  handleReviewObserver(JSON.stringify({
    hook_event_name: "SubagentStop", session_id: id, cwd, agent_id: "e1",
    last_assistant_message: `reviewed\n\nLAUNCH: ${launchId}\nVERDICT: PASS`,
  }));
}

/** A v1 exit from a NAMED child, so two children of one session are separable. */
function signOffAs(cwd: string, id: string, agentId: string, launchId: string, verdict = "PASS"): void {
  handleReviewObserver(JSON.stringify({
    hook_event_name: "SubagentStop", session_id: id, cwd, agent_id: agentId,
    last_assistant_message: `reviewed\n\nLAUNCH: ${launchId}\nVERDICT: ${verdict}`,
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
    // path.relative() reports the platform separator, so compare on segments
    assert.deepEqual(st.planUnit?.split(/[\\/]/), ["devlog", "_plan", "260817_probe"]);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// 050 — the v1 spawn surface has no agent_type field at all, so the value a
// dispatch passes is dropped and the SubagentStop payload arrives without it.
// The observer used to require agent_type === "explorer" and returned before it
// could even name the round, so the round stayed in_flight forever and A>B was
// refused with no ledger entry to explain it.
test("a reviewer that exits without an agent_type still closes its round (v1 surface)", () => {
  const { cwd, slug } = seedAtA("v1");
  try {
    const launchId = openRoundFor(cwd, "v1");
    signOffWithoutAgentType(cwd, "v1", launchId);

    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "approved", "a v1 sign-off must be recorded, not silently dropped");
    assert.equal(round.lane.verdict, "pass");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// The separation that matters stays: a worker's exit belongs to the receipt
// gate, never to this observer, even when it carries a well-formed sign-off.
test("a worker exit is never recorded by the review observer", () => {
  const { cwd, slug } = seedAtA("wk");
  try {
    const launchId = openRoundFor(cwd, "wk");
    handleReviewObserver(JSON.stringify({
      hook_event_name: "SubagentStop", session_id: "wk", cwd,
      agent_type: "worker", agent_id: "w1",
      last_assistant_message: `done\n\nLAUNCH: ${launchId}\nVERDICT: PASS`,
    }));

    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "in_flight", "the receipt gate owns a worker exit");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// 050 §3b — dropping the agent_type test costs identity, so the round re-earns
// it. Launch ids are minted from a round number and a timestamp, and child hooks
// inherit the PARENT session id, so neither one separates two children of one
// session. The first sign-off binds the round; a second child cannot overturn it.
test("a second child cannot overwrite the verdict the reviewer already gave", () => {
  const { cwd, slug } = seedAtA("two");
  try {
    const launchId = openRoundFor(cwd, "two");
    signOffAs(cwd, "two", "reviewer-1", launchId, "FAIL");

    const afterReviewer = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(afterReviewer.lane.verdict, "fail");
    assert.equal(afterReviewer.lane.reviewerSession, "reviewer-1");

    // an unrelated child of the SAME session echoes the launch id it could see
    signOffAs(cwd, "two", "bystander", launchId, "PASS");

    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.lane.verdict, "fail", "a bystander must not flip a recorded verdict");
    assert.equal(round.lane.reviewerSession, "reviewer-1");
    assert.match(goalplanLedger(cwd, slug), /already signed by reviewer-1/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// 260818 — the deadlock that survived 050. codex-rs normalises a child spawned
// with no role to the agent_type `default`, so the registered matcher
// `^(explorer)?$` matched nothing and the observer was never invoked: eight
// rounds ran, every verdict vanished, and the ledger stayed empty because a
// refusal cannot be written by a hook that never ran.
test("a default-role child (the v1 spawn surface) is recorded, not dropped", () => {
  const { cwd, slug } = seedAtA("dflt");
  try {
    const launchId = openRoundFor(cwd, "dflt");
    handleReviewObserver(JSON.stringify({
      hook_event_name: "SubagentStop", session_id: "dflt", cwd,
      agent_type: "default", agent_id: "d1",
      last_assistant_message: `reviewed\n\nLAUNCH: ${launchId}\nVERDICT: PASS`,
    }));

    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "approved", "a default-role reviewer's verdict must land");
    assert.equal(round.lane.verdict, "pass");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// The drop that told nobody. A reviewer that ends without the exact closing two
// lines used to return silently, which is indistinguishable from a broken gate.
test("a child that exits without a parseable sign-off says so in the ledger", () => {
  const { cwd, slug } = seedAtA("noparse");
  try {
    openRoundFor(cwd, "noparse");
    handleReviewObserver(JSON.stringify({
      hook_event_name: "SubagentStop", session_id: "noparse", cwd,
      agent_type: "default", agent_id: "n1",
      last_assistant_message: "I reviewed the plan and it looks fine to me.",
    }));

    assert.match(goalplanLedger(cwd, slug), /review_signoff_unparsed/,
      "an unparseable reviewer exit must be diagnosable");
    const round = latestRound(readGoalplan(cwd, slug)!, "plan_audit")!;
    assert.equal(round.status, "in_flight", "and it must not approve anything");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// A sign-off naming a round nobody opened was the other invisible drop.
test("a sign-off for an unknown launch id is recorded as ignored", () => {
  const { cwd, slug } = seedAtA("unknown");
  try {
    openRoundFor(cwd, "unknown");
    signOffAs(cwd, "unknown", "r1", "r99-neverminted", "PASS");

    assert.match(goalplanLedger(cwd, slug), /belongs to no plan_audit round/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// The matcher is the thing that actually decides whether any of the above runs.
// Bind it to the runtime's real role vocabulary so a narrowing cannot ship again.
test("the SubagentStop observer matcher admits every non-worker role", () => {
  const hook = JSON.parse(readFileSync(
    new URL("../../../hooks/subagent-stop-observing-review.json", import.meta.url), "utf8",
  )) as { hooks: { SubagentStop: { matcher: string }[] } };
  const matcher = new RegExp(hook.hooks.SubagentStop[0].matcher);
  // "default" is what codex-rs sends for a child spawned without a role, which is
  // every multi_agent_v1 spawn: its tool schema has no agent_type argument.
  for (const role of ["default", "explorer", "reviewer", "executor", ""]) {
    assert.ok(matcher.test(role), `the observer must be reachable for agent_type "${role}"`);
  }
});

// LEAN-REVIEW-01 (260818) — the deadlock this whole unit kept re-discovering was
// structural, not a sequence of separate bugs: A>B could not advance without a
// verdict only the observer hook could write, so every reason the hook did not
// fire became a cycle that could never leave A. The round is now opt-in.
function attestB(cwd: string, id: string, verdict = "pass"): { code: number; output: string } {
  const args = parseOrchestrateCliArgs(
    ["b", "--session", id, "--cwd", cwd, "--attest", JSON.stringify({
      from: "A", to: "B", did: "audited the plan", workPhaseId: "wp0",
      auditOutput: "reviewer said: VERDICT: PASS", auditVerdict: verdict,
    })],
    cwd,
  );
  return runOrchestrateCli(args as never);
}

test("A>B advances on the attest when no audit round was ever opened", () => {
  const { cwd } = seedAtA("noround");
  try {
    const res = attestB(cwd, "noround");
    assert.equal(res.code, 0, res.output);
    assert.equal(readState(cwd, "noround").phase, "B");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// The exact shape that stranded a real session: the round is open, the reviewer
// answered, and the hook never ran — so the round sits in_flight forever.
test("A>B advances past a round left in flight by a hook that never fired", () => {
  const { cwd, slug } = seedAtA("inflight");
  try {
    openRoundFor(cwd, "inflight");
    assert.equal(latestRound(readGoalplan(cwd, slug)!, "plan_audit")!.status, "in_flight");

    const res = attestB(cwd, "inflight");
    assert.equal(res.code, 0, res.output);
    assert.equal(readState(cwd, "inflight").phase, "B");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// Leaner is not looser. An approval that DID land still cannot be contradicted.
test("an approved round still refuses an attest that contradicts the reviewer", () => {
  const { cwd } = seedAtA("contra");
  try {
    const launchId = openRoundFor(cwd, "contra");
    signOffAs(cwd, "contra", "reviewer-1", launchId, "FAIL");

    const res = attestB(cwd, "contra", "pass");
    assert.equal(res.code, 1, "attesting pass over a recorded fail must refuse");
    assert.match(res.output, /reviewer recorded/);
    assert.equal(readState(cwd, "contra").phase, "A");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// ...and an approval cannot outlive the plan it approved.
test("an approved round cannot be spent after the plan changed", () => {
  const { cwd } = seedAtA("stale");
  try {
    const launchId = openRoundFor(cwd, "stale");
    signOffAs(cwd, "stale", "reviewer-1", launchId, "PASS");
    writeFileSync(join(cwd, "devlog", "_plan", "260817_probe", "000_plan.md"), "# probe amended\n");

    const res = attestB(cwd, "stale", "pass");
    assert.equal(res.code, 1, "a changed plan invalidates the approval");
    assert.match(res.output, /the plan changed/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
