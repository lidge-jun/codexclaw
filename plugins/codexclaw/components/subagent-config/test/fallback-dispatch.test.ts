import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, mkdirSync } from "node:fs";
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
