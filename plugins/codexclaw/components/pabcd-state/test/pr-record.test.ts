/**
 * pr-record.test.ts — a merged or green PR is accepted as the completion record (261022).
 * gh is never called: every test injects the `gh pr view` result.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

process.env.CODEXCLAW_CXC = "cxc";

import { classifyPr, prRecordPath, prRecordSince, readPrRecord, runPrRecord, type GhPrView, type GhViewFn } from "../src/pr-record.ts";
import { applyGoalCompleteGuard, type PreToolUsePayload } from "../src/goal-gate.ts";
import { defaultState, readState, writeState } from "../src/state.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { parseOrchestrateCliArgs, runOrchestrateCli } from "../src/orchestrate-cli.ts";
import { captureSourceIdentity } from "../src/source-identity.ts";
import { parseGoalplanCliArgs } from "../src/goalplan-cli.ts";

const MERGED: GhPrView = {
  url: "https://github.com/lidge-jun/codexclaw/pull/400",
  number: 400,
  state: "MERGED",
  mergedAt: "2026-10-22T01:00:00Z",
  mergeCommit: { oid: "abc123" },
  headRefOid: "def456",
  statusCheckRollup: [{ __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: "SUCCESS" }],
};

const OPEN_GREEN: GhPrView = {
  ...MERGED,
  state: "OPEN",
  mergedAt: null,
  mergeCommit: null,
  statusCheckRollup: [
    { __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: "SUCCESS" },
    { __typename: "CheckRun", name: "lint", status: "COMPLETED", conclusion: "SKIPPED" },
    { __typename: "StatusContext", context: "ci/legacy", state: "SUCCESS" },
  ],
};

const view = (v: GhPrView): GhViewFn => () => ({ ok: true, view: v });
const fixedNow = (iso: string) => () => iso;

function ptu(cwd: string, sessionId: string): PreToolUsePayload {
  return { hook_event_name: "PreToolUse", session_id: sessionId, cwd, tool_name: "update_goal", tool_input: { status: "complete" }, turn_id: "t1", transcript_path: null };
}

function decision(out: string): string {
  return out === "" ? "allow" : JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecision;
}

function gitRepo(): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-pr-record-"));
  const run = (...a: string[]) => spawnSync("git", a, { cwd, encoding: "utf8" });
  run("init", "-q");
  run("config", "user.email", "t@example.com");
  run("config", "user.name", "t");
  writeFileSync(join(cwd, "seed.txt"), "seed\n");
  run("add", "-A");
  run("commit", "-qm", "seed");
  return cwd;
}

test("classifyPr: merged and fully green PRs qualify; everything else is refused with a reason", () => {
  assert.deepEqual(classifyPr(MERGED).ok && classifyPr(MERGED), { ok: true, verdict: "merged", checks: [{ name: "test", outcome: "SUCCESS" }] });
  const green = classifyPr(OPEN_GREEN);
  assert.ok(green.ok && green.verdict === "green");

  const pending = classifyPr({ ...OPEN_GREEN, statusCheckRollup: [{ __typename: "CheckRun", name: "test", status: "IN_PROGRESS", conclusion: "" }] });
  assert.ok(!pending.ok && /still running: test/.test(pending.reason));
  const failing = classifyPr({ ...OPEN_GREEN, statusCheckRollup: [{ __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: "FAILURE" }] });
  assert.ok(!failing.ok && /failing checks: test=FAILURE/.test(failing.reason));
  const statusFail = classifyPr({ ...OPEN_GREEN, statusCheckRollup: [{ __typename: "StatusContext", context: "ci", state: "ERROR" }] });
  assert.ok(!statusFail.ok);
  const noChecks = classifyPr({ ...OPEN_GREEN, statusCheckRollup: [] });
  assert.ok(!noChecks.ok && /no checks/.test(noChecks.reason));
  const closed = classifyPr({ ...OPEN_GREEN, state: "CLOSED" });
  assert.ok(!closed.ok && /closed/.test(closed.reason));
});

test("runPrRecord writes a session-scoped record only for a qualifying PR", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-pr-record-"));
  try {
    const refused = runPrRecord(cwd, "s-pr", "400", { view: view({ ...OPEN_GREEN, statusCheckRollup: [] }) });
    assert.equal(refused.code, 1);
    assert.match(refused.output, /Nothing was written/);
    assert.equal(existsSync(prRecordPath(cwd, "s-pr")), false);

    const ghDown = runPrRecord(cwd, "s-pr", "400", { view: () => ({ ok: false, error: "gh could not run: ENOENT" }) });
    assert.equal(ghDown.code, 1);

    const ok = runPrRecord(cwd, "s-pr", "400", { view: view(MERGED), now: fixedNow("2026-10-22T02:00:00.000Z") });
    assert.equal(ok.code, 0);
    const record = readPrRecord(cwd, "s-pr");
    assert.equal(record?.verdict, "merged");
    assert.equal(record?.mergeCommit, "abc123");
    assert.equal(readPrRecord(cwd, "other-session"), null, "records never cross sessions");

    // A hand-edited record that claims another session or a bad verdict is ignored.
    const raw = JSON.parse(readFileSync(prRecordPath(cwd, "s-pr"), "utf8"));
    writeFileSync(prRecordPath(cwd, "s-pr"), JSON.stringify({ ...raw, verdict: "approved" }));
    assert.equal(readPrRecord(cwd, "s-pr"), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("cxc loop pr-record parses as a loop verb", () => {
  const args = parseGoalplanCliArgs(["pr-record", "--session", "s1", "--pr", "https://github.com/o/r/pull/1"], "/tmp/x");
  assert.ok(!("error" in args));
  assert.equal((args as { pr?: string }).pr, "https://github.com/o/r/pull/1");
  const bad = parseGoalplanCliArgs(["pr-record", "--session", "s1", "--evidence", "x"], "/tmp/x");
  assert.ok("error" in bad);
});

test("GOAL-COMPLETE-GATE-01 accepts a merged PR record over an open cycle and an unfinished plan", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-pr-gate-"));
  try {
    const plan = buildGoalplan({ objective: "Ship the budget", criteria: [{ scenario: "tests", expectedEvidence: "green" }] });
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("g-pr"), phase: "C", orchestrationActive: true, slug: plan.slug });
    // The incident: work merged, but the cycle is still open and the plan unticked.
    assert.equal(decision(applyGoalCompleteGuard(ptu(cwd, "g-pr"))), "deny");
    assert.match(applyGoalCompleteGuard(ptu(cwd, "g-pr")), /cxc loop pr-record/);

    assert.equal(runPrRecord(cwd, "g-pr", "400", { view: view(MERGED) }).code, 0);
    assert.equal(decision(applyGoalCompleteGuard(ptu(cwd, "g-pr"))), "allow");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a PR record never covers unverified subagent work or a structurally broken plan", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-pr-gate-"));
  try {
    assert.equal(runPrRecord(cwd, "g-sub", "400", { view: view(OPEN_GREEN) }).code, 0);
    writeState(cwd, {
      ...defaultState("g-sub"),
      phase: "IDLE",
      unverifiedSubagents: [{ agentId: "a1", turnId: "t1", agentType: "worker", attempts: 3, receiptClaimed: "", recordedAt: "2026-09-28T00:00:00Z", resolvable: true }],
    });
    assert.match(applyGoalCompleteGuard(ptu(cwd, "g-sub")), /unverified subagents/);

    const plan = buildGoalplan({ objective: "Broken plan" });
    plan.schemaVersion = 3;
    plan.workPhases = [
      { id: "b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
      { id: "a", title: "a", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["b"] },
    ];
    writeGoalplan(cwd, plan);
    assert.equal(runPrRecord(cwd, "g-broken", "400", { view: view(MERGED) }).code, 0);
    writeState(cwd, { ...defaultState("g-broken"), phase: "IDLE", slug: plan.slug });
    const out = applyGoalCompleteGuard(ptu(cwd, "g-broken"));
    assert.equal(decision(out), "deny");
    assert.match(out, /structurally broken/);
    assert.match(out, /dependency cycle/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("SOURCE-DELTA-01 accepts B>C when a merged PR was recorded during this B, and only then", () => {
  const cwd = gitRepo();
  try {
    const entry = captureSourceIdentity(cwd, { excludeCodexclawArtifacts: true });
    writeState(cwd, { ...defaultState("delta-pr"), phase: "B", flags: { interview: false, auditPassed: true, checkPassed: false }, phaseEntrySource: entry });
    const attest = '{"from":"B","to":"C","did":"the slice merged as PR 400"}';
    const c = () => runOrchestrateCli(parseOrchestrateCliArgs(["c", "--session", "delta-pr", "--cwd", cwd, "--attest", attest], cwd) as never);

    // A record from before this B began does not count.
    runPrRecord(cwd, "delta-pr", "400", { view: view(MERGED), now: fixedNow("2000-01-01T00:00:00.000Z") });
    assert.equal(prRecordSince(readPrRecord(cwd, "delta-pr"), entry.capturedAt), false);
    const refused = c();
    assert.equal(refused.code, 1);
    assert.match(refused.output, /SOURCE-DELTA-01/);
    assert.match(refused.output, /cxc loop pr-record/);

    runPrRecord(cwd, "delta-pr", "400", { view: view(MERGED) });
    const accepted = c();
    assert.equal(accepted.code, 0, accepted.output);
    assert.equal(readState(cwd, "delta-pr").phase, "C");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
