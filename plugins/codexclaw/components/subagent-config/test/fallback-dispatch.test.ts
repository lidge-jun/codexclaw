import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDispatch, managedSpawn } from "../src/fallback-dispatch.ts";
import { decodeDispatchFailure } from "../src/fallback-errors.ts";
import { setRole, ROLES } from "../src/store.ts";
import { runSpawnAttachHook } from "../src/spawn-attach-hook.ts";

function fixture(role: typeof ROLES[number] = "executor") {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-fallback-"));
  const env = { CODEXCLAW_HOME: join(cwd, "global") };
  setRole(cwd, role, { mode: "model", model: "xai/grok-4.6", effort: "high", fallback: { model: "cursor/grok-4.6", effort: null } }, "project", env);
  const base = { sessionId: "session-test", dispatchId: "task-test" };
  const call = (input: Record<string, unknown>) => runDispatch(cwd, { ...base, ...input }, env);
  const start = call({ action: "start", role });
  return { cwd, base, call, start };
}

// Captured from real Codex 0.153.4 wait_agent results against a loopback provider.
const nativeFailures = [
  ["exceeded retry limit, last status: 429 Too Many Requests", "rate_limit_exceeded"],
  ["Quota exceeded. Check your plan and billing details.", "insufficient_quota"],
  ["rate limit exceeded: Cursor rate limit exceeded: fixture exhausted", "rate_limit_exceeded"],
  ["We're currently experiencing high demand, which may cause temporary errors.", "upstream_server_error"],
] as const;

test("native wait errors retain fallback eligibility after Codex rewrites provider codes", () => {
  for (const [message, code] of nativeFailures) {
    assert.deepEqual(decodeDispatchFailure(message), { code, action: "next" });
    assert.equal(decodeDispatchFailure({ error: { code: "permission_denied", message } }).action, "stop");
    assert.equal(decodeDispatchFailure(`Task output: ${message}`).action, "unknown");
  }
  for (const message of [
    "exceeded retry limit, last status: 403 Forbidden",
    "unexpected status 403 Forbidden: Quota exceeded. Check your plan and billing details.",
    "Quota exceeded. Check your plan and billing details. Permission denied.",
    "We're currently experiencing high demand, which may cause temporary errors. Permission denied.",
    "rate limit exceededness",
  ]) assert.equal(decodeDispatchFailure(message).action, "unknown");
});

for (const role of ROLES) test(`${role}: native errors select fallback only after child reconciliation`, () => {
  for (const [error] of nativeFailures) {
    const { call, start } = fixture(role);
    call({ action: "claim", attemptId: start.attemptId });
    call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "native-first" });
    const report = { action: "report", attemptId: start.attemptId, outcome: "failed", error, agentId: "native-first" };
    assert.equal(call({ ...report, executionState: "unknown" }).action, "reconcile");
    const next = call({ ...report, executionState: "stopped", reconciliation: "native wait terminal; close completed; inspected workspace" });
    assert.equal(next.action, "ready");
    const claim = call({ action: "claim", attemptId: next.attemptId });
    assert.equal(claim.candidate?.model, "cursor/grok-4.6");
    const end = call({ action: "report", attemptId: next.attemptId, outcome: "failed", error, executionState: "not_created", reconciliation: "native creation rejected without child" });
    assert.equal(end.action, "main-direct");
    assert.equal(end.independentReviewRequired, role === "reviewer");
  }
});

test("unknown and policy failures never offer fallback or main-direct", () => {
  for (const error of ["some vague failure", { error: { code: "permission_denied" } }, { code: "cyber_policy" }, "client_cancelled"]) {
    const { call, start } = fixture();
    call({ action: "claim", attemptId: start.attemptId });
    const out = call({ action: "report", attemptId: start.attemptId, outcome: "failed", error, executionState: "not_created", reconciliation: "native spawn returned denial; no child created" });
    assert.ok(["stop", "reconcile"].includes(out.action)); assert.equal(out.candidate, undefined);
    assert.equal(out.attempts.length, 1);
  }
});
test("timeout/unknown execution and duplicate claims never authorize another spawn", () => {
  const { call, start } = fixture();
  const claim = call({ action: "claim", attemptId: start.attemptId }); assert.equal(claim.action, "spawn");
  assert.equal(call({ action: "claim", attemptId: start.attemptId }).action, "reconcile");
  const out = call({ action: "report", attemptId: start.attemptId, outcome: "failed", error: { code: "insufficient_quota" }, executionState: "unknown" });
  assert.equal(out.action, "reconcile"); assert.equal(out.candidate, undefined);
  assert.equal(call({ action: "status" }).action, "reconcile");
  assert.throws(() => call({ action: "start", role: "executor" }), /already exists/);
});
test("mid-task failure needs stopped child identity and reconciliation", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a", observedModel: "ocx-rewritten/model" });
  const failure = { action: "report", attemptId: start.attemptId, outcome: "failed", error: { code: "upstream_server_error" } };
  assert.equal(call({ ...failure, executionState: "running" }).action, "reconcile");
  assert.throws(() => call({ ...failure, executionState: "not_created", reconciliation: "guess" }), /must be stopped/);
  assert.throws(() => call({ ...failure, executionState: "stopped", agentId: "child-a" }), /reconciliation/);
  const out = call({ ...failure, executionState: "stopped", agentId: "child-a", reconciliation: "child stopped; inspected diff and preserved edits; remaining task prepared" });
  assert.equal(out.action, "ready"); assert.equal(out.attempts[0].observedModel, "ocx-rewritten/model");
  assert.equal(out.attempts[0].candidate.model, "xai/grok-4.6");
});
for (const role of ROLES) test(`${role}: primary -> first fallback -> main-direct, restart-safe`, () => {
  const { call, start, cwd, base } = fixture(role);
  const first = call({ action: "claim", attemptId: start.attemptId });
  assert.equal(first.candidate?.model, "xai/grok-4.6");
  const next = call({ action: "report", attemptId: first.attemptId, outcome: "failed", error: "Cursor rate limit exceeded: exhausted", executionState: "not_created", reconciliation: "native creation failed with explicit no-child result" });
  assert.equal(next.action, "ready");
  const second = call({ action: "claim", attemptId: next.attemptId });
  assert.deepEqual(second.candidate, { model: "cursor/grok-4.6", effort: null });
  assert.equal(managedSpawn(cwd, base.sessionId, second.marker + "\nTASK")?.role, role);
  assert.throws(() => call({ action: "report", attemptId: first.attemptId, outcome: "failed" }), /stale/);
  const end = call({ action: "report", attemptId: second.attemptId, outcome: "failed", error: '{"error":{"code":"insufficient_quota"}}', executionState: "not_created", reconciliation: "second native creation explicitly failed without child" });
  assert.equal(end.action, "main-direct"); assert.equal(end.attempts.length, 2);
  assert.equal(end.independentReviewRequired, role === "reviewer");
  assert.equal(end.attempts[0].observedModel, null);
  assert.equal(call({ action: "status" }).action, "main-direct");
  const raw = readFileSync(join(cwd, ".codexclaw", "dispatches", base.sessionId, base.dispatchId + ".json"), "utf8");
  assert.equal(JSON.parse(raw).attempts.length, 2);
});
test("managed hook preserves fallback null effort and logical reviewer role", () => {
  const { call, start, cwd, base } = fixture("reviewer");
  call({ action: "claim", attemptId: start.attemptId });
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "failed", error: "insufficient_quota", executionState: "not_created", reconciliation: "no child created" });
  const claim = call({ action: "claim", attemptId: next.attemptId });
  const output = JSON.parse(runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", cwd, session_id: base.sessionId, tool_name: "spawn_agent", tool_input: { agent_type: "explorer", model: "wrong-primary", reasoning_effort: "high", message: claim.marker + "\nInvestigate the file" } })));
  assert.equal(output.hookSpecificOutput.updatedInput.model, "cursor/grok-4.6");
  assert.equal(output.hookSpecificOutput.updatedInput.reasoning_effort, undefined);
  const fork = JSON.parse(runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", cwd, session_id: base.sessionId, tool_name: "spawn_agent", tool_input: { fork_context: true, message: claim.marker + "\nTASK" } })));
  assert.equal(fork.hookSpecificOutput.permissionDecision, "deny");
});
test("invalid IDs, foreign sessions and concurrent lock fail closed", () => {
  const { call, start, cwd, base } = fixture();
  assert.throws(() => call({ action: "status", dispatchId: "../escape" }), /invalid/);
  assert.throws(() => runDispatch(cwd, { ...base, action: "status" }, { CODEX_THREAD_ID: "other" }), /native main session/);
  mkdirSync(join(cwd, ".codexclaw", "dispatches", base.sessionId, base.dispatchId + ".json.lock"));
  assert.throws(() => call({ action: "claim", attemptId: start.attemptId }), /EEXIST/);
});
test("error decoder honors envelope code and does not mine quoted task content", () => {
  assert.equal(decodeDispatchFailure({ error: { code: "permission_denied", message: "Cursor rate limit exceeded" } }).action, "stop");
  assert.equal(decodeDispatchFailure("The task says insufficient_quota").action, "unknown");
  assert.equal(decodeDispatchFailure({ content: { error: { code: "insufficient_quota" } } }).action, "unknown");
  assert.equal(decodeDispatchFailure("You've hit your usage limit. Try later").code, "insufficient_quota");
});
test("managed marker cannot authorize two different native calls; same hook id is idempotent", () => {
  const { call, start, cwd, base } = fixture();
  const claim = call({ action: "claim", attemptId: start.attemptId });
  const payload = { hook_event_name: "PreToolUse", cwd, session_id: base.sessionId, tool_use_id: "native-call-1", tool_name: "spawn_agent", tool_input: { agent_type: "executor", message: claim.marker + "\nTASK: implement" } };
  const first = JSON.parse(runSpawnAttachHook(JSON.stringify(payload))).hookSpecificOutput;
  assert.equal(first.permissionDecision, "allow");
  const repeated = JSON.parse(runSpawnAttachHook(JSON.stringify({ ...payload, tool_input: first.updatedInput }))).hookSpecificOutput;
  assert.equal(repeated.permissionDecision, "allow");
  const duplicate = JSON.parse(runSpawnAttachHook(JSON.stringify({ ...payload, tool_use_id: "native-call-2" }))).hookSpecificOutput;
  assert.equal(duplicate.permissionDecision, "deny");
});
test("direct caller overrides remain intact even with role fallback enabled", () => {
  const { cwd, base } = fixture();
  const out = JSON.parse(runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", cwd, session_id: base.sessionId, tool_name: "spawn_agent", tool_input: { agent_type: "executor", model: "explicit/other", reasoning_effort: "low", message: "Implement file" } }))).hookSpecificOutput;
  assert.equal(out.updatedInput.model, "explicit/other");
  assert.equal(out.updatedInput.reasoning_effort, "low");
  assert.match(out.additionalContext, /not managed/);
});
test("hosts without tool-use IDs cannot replay an issued marker", () => {
  const { call, start, cwd, base } = fixture();
  const claim = call({ action: "claim", attemptId: start.attemptId });
  const payload = { hook_event_name: "PreToolUse", cwd, session_id: base.sessionId, tool_name: "spawn_agent", tool_input: { agent_type: "executor", message: claim.marker + "\nTASK: implement" } };
  assert.equal(JSON.parse(runSpawnAttachHook(JSON.stringify(payload))).hookSpecificOutput.permissionDecision, "allow");
  assert.equal(JSON.parse(runSpawnAttachHook(JSON.stringify(payload))).hookSpecificOutput.permissionDecision, "deny");
});
test("unavailable native tool returns main-direct only with no-child evidence", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  assert.equal(call({ action: "report", attemptId: start.attemptId, outcome: "unavailable", executionState: "unknown" }).action, "reconcile");
  assert.throws(() => call({ action: "report", attemptId: start.attemptId, outcome: "unavailable", executionState: "not_created" }), /reconciliation/);
  const out = call({ action: "report", attemptId: start.attemptId, outcome: "unavailable", executionState: "not_created", reconciliation: "native tool catalog has no spawn tool, no call was made" });
  assert.equal(out.action, "main-direct"); assert.equal(out.attempts.length, 1);
});
test("candidate snapshot remains stable if role settings change after start", () => {
  const { call, start, cwd } = fixture();
  setRole(cwd, "executor", { fallback: { model: "different/provider", effort: "low" } });
  call({ action: "claim", attemptId: start.attemptId });
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "failed", error: "rate_limit_exceeded", executionState: "not_created", reconciliation: "native creation returned no child" });
  assert.equal(call({ action: "claim", attemptId: next.attemptId }).candidate?.model, "cursor/grok-4.6");
});

test("confirmed task failure recovers through the next candidate, then main-direct", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const next = call({
    action: "report", attemptId: start.attemptId, outcome: "task_failed",
    agentId: "child-a", executionState: "stopped",
    reconciliation: "child stopped; inspected diff and preserved edits",
    taskFailure: { kind: "unusable_output", evidence: "final message contained no findings or diff for the packet" },
  });
  assert.equal(next.action, "ready");
  assert.equal(next.attempts[0].taskFailure?.kind, "unusable_output");
  assert.equal(next.attempts[0].code, null);
  const claim = call({ action: "claim", attemptId: next.attemptId });
  assert.equal(claim.candidate?.model, "cursor/grok-4.6");
  call({ action: "report", attemptId: next.attemptId, outcome: "created", agentId: "child-b" });
  const end = call({
    action: "report", attemptId: next.attemptId, outcome: "task_failed",
    agentId: "child-b", executionState: "stopped",
    reconciliation: "second child stopped; partial work inspected",
    taskFailure: { kind: "stagnation", evidence: "no new edits or output at the stated review point" },
  });
  assert.equal(end.action, "main-direct");
  assert.equal(end.attempts.length, 2);
  assert.equal(end.attempts[1].taskFailure?.kind, "stagnation");
});

for (const role of ROLES) test(`${role}: task failure on the last candidate returns main-direct`, () => {
  const { call, start } = fixture(role);
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; partial edits inspected", taskFailure: { kind: "stagnation", evidence: "no advancement at the stated review point" } });
  const second = call({ action: "claim", attemptId: next.attemptId });
  call({ action: "report", attemptId: second.attemptId, outcome: "created", agentId: "child-b" });
  const end = call({ action: "report", attemptId: second.attemptId, outcome: "task_failed", agentId: "child-b", executionState: "stopped", reconciliation: "second child stopped; output unusable", taskFailure: { kind: "unusable_output", evidence: "final message unrelated to the packet" } });
  assert.equal(end.action, "main-direct");
  assert.equal(end.attempts.length, 2);
  assert.equal(end.independentReviewRequired, role === "reviewer");
});

test("dispatch state without taskFailure stays readable and recovers; malformed metadata fails closed", () => {
  const { call, start, cwd, base } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const path = join(cwd, ".codexclaw", "dispatches", base.sessionId, base.dispatchId + ".json");
  const legacy = JSON.parse(readFileSync(path, "utf8"));
  delete legacy.attempts[0].taskFailure;
  writeFileSync(path, JSON.stringify(legacy));
  assert.equal(call({ action: "status" }).attempts[0].taskFailure, null);
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; inspected", taskFailure: { kind: "stagnation", evidence: "no advancement at the stated review point" } });
  assert.equal(next.action, "ready");
  const corrupt = JSON.parse(readFileSync(path, "utf8"));
  corrupt.attempts[0].taskFailure = { kind: "timeout", evidence: "x" };
  writeFileSync(path, JSON.stringify(corrupt));
  assert.throws(() => call({ action: "status" }), /taskFailure kind/);
});

test("task failure needs a recorded stopped child before any handoff", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const taskFailure = { kind: "unusable_output", evidence: "final message unusable" };
  for (const executionState of ["running", "unknown"]) {
    const out = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState, reconciliation: "still checking", taskFailure });
    assert.equal(out.action, "reconcile");
    assert.equal(out.attempts.length, 1);
  }
  assert.throws(() => call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", executionState: "not_created", reconciliation: "x", taskFailure }), /recorded stopped child/);
  assert.throws(() => call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-b", executionState: "stopped", reconciliation: "x", taskFailure }), /stopped and identified/);
  assert.throws(() => call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", taskFailure }), /reconciliation/);
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; inspected", taskFailure });
  assert.equal(next.action, "ready");
});

test("task failure without a recorded child is rejected", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  assert.throws(() => call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "ghost", executionState: "stopped", reconciliation: "claimed child stopped", taskFailure: { kind: "stagnation", evidence: "no output" } }), /record created agent/);
});

test("invalid taskFailure payloads are rejected without state advancement", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const report = { action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; inspected" };
  assert.throws(() => call({ ...report }), /JSON object/);
  assert.throws(() => call({ ...report, taskFailure: "stagnation" }), /JSON object/);
  assert.throws(() => call({ ...report, taskFailure: { kind: "stagnation", evidence: "x", extra: 1 } }), /taskFailure key/);
  assert.throws(() => call({ ...report, taskFailure: { kind: "timeout", evidence: "x" } }), /taskFailure kind/);
  assert.throws(() => call({ ...report, taskFailure: { kind: "stagnation", evidence: "  " } }), /evidence/);
  assert.throws(() => call({ ...report, taskFailure: { kind: "stagnation", evidence: 42 } }), /evidence/);
  assert.throws(() => call({ ...report, taskFailure: { kind: "stagnation", evidence: "x".repeat(2001) } }), /evidence/);
  const status = call({ action: "status" });
  assert.equal(status.attempts.length, 1);
  assert.equal(status.attempts[0].status, "running");
  assert.equal(status.attempts[0].taskFailure, null);
});

test("provider error decoding wins over the task_failed label", () => {
  // A decoded stop wins before the child-state gate, even while the child is live.
  for (const [error, code, executionState] of [
    [{ code: "permission_denied" }, "permission_denied", "running"],
    ["client_cancelled", "client_cancelled", "unknown"],
    [{ code: "cyber_policy" }, "cyber_policy", "running"],
  ] as const) {
    const { call, start } = fixture();
    call({ action: "claim", attemptId: start.attemptId });
    call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
    const stop = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", error, agentId: "child-a", executionState, reconciliation: "still live", taskFailure: { kind: "stagnation", evidence: "x" } });
    assert.equal(stop.action, "stop");
    assert.equal(stop.attempts[0].code, code);
    const again = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "x", taskFailure: { kind: "stagnation", evidence: "x" } });
    assert.equal(again.action, "stop");
    assert.equal(again.attempts.length, 1);
  }

  const unknown = fixture();
  unknown.call({ action: "claim", attemptId: unknown.start.attemptId });
  unknown.call({ action: "report", attemptId: unknown.start.attemptId, outcome: "created", agentId: "child-a" });
  const rec = unknown.call({ action: "report", attemptId: unknown.start.attemptId, outcome: "task_failed", error: "vague prose", agentId: "child-a", executionState: "stopped", reconciliation: "x", taskFailure: { kind: "stagnation", evidence: "x" } });
  assert.equal(rec.action, "reconcile");
  assert.equal(rec.attempts.length, 1);

  const mixed = fixture();
  mixed.call({ action: "claim", attemptId: mixed.start.attemptId });
  mixed.call({ action: "report", attemptId: mixed.start.attemptId, outcome: "created", agentId: "child-a" });
  assert.throws(() => mixed.call({ action: "report", attemptId: mixed.start.attemptId, outcome: "task_failed", error: "insufficient_quota", agentId: "child-a", executionState: "stopped", reconciliation: "x", taskFailure: { kind: "stagnation", evidence: "x" } }), /outcome failed/);
  const next = mixed.call({ action: "report", attemptId: mixed.start.attemptId, outcome: "failed", error: "insufficient_quota", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; inspected" });
  assert.equal(next.action, "ready");
  assert.equal(next.attempts[0].code, "insufficient_quota");
});

test("a plain failed report with task metadata never implies task recovery", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const out = call({ action: "report", attemptId: start.attemptId, outcome: "failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; inspected", taskFailure: { kind: "unusable_output", evidence: "no usable output" } });
  assert.equal(out.action, "reconcile");
  assert.equal(out.attempts.length, 1);
  assert.equal(out.attempts[0].taskFailure, null);
});

test("terminal dispatch states never reopen for a task report", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  call({ action: "report", attemptId: start.attemptId, outcome: "complete", agentId: "child-a" });
  const out = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "x", taskFailure: { kind: "stagnation", evidence: "x" } });
  assert.equal(out.action, "complete");
  assert.equal(out.attempts.length, 1);
});

test("task failure before claim or on a stale attempt is rejected", () => {
  const { call, start } = fixture();
  assert.throws(() => call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", executionState: "stopped", reconciliation: "x", taskFailure: { kind: "stagnation", evidence: "x" } }), /claim the attempt/);
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; inspected", taskFailure: { kind: "stagnation", evidence: "no advancement at the stated review point" } });
  assert.equal(next.action, "ready");
  assert.throws(() => call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "x", taskFailure: { kind: "stagnation", evidence: "x" } }), /stale/);
});
test("a reconciled provider report followed by task failure clears the stale code", () => {
  const { call, start } = fixture();
  call({ action: "claim", attemptId: start.attemptId });
  call({ action: "report", attemptId: start.attemptId, outcome: "created", agentId: "child-a" });
  const rec = call({ action: "report", attemptId: start.attemptId, outcome: "failed", error: "insufficient_quota", agentId: "child-a", executionState: "running" });
  assert.equal(rec.action, "reconcile");
  assert.equal(rec.attempts[0].code, "insufficient_quota");
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; inspected", taskFailure: { kind: "unusable_output", evidence: "final message unusable" } });
  assert.equal(next.action, "ready");
  assert.equal(next.attempts[0].code, null);
  assert.equal(next.attempts[0].taskFailure?.kind, "unusable_output");
});
