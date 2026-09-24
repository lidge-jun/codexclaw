import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { setRole } from "../src/store.ts";
import { DISPATCH_GUIDANCE, sessionFallbackNotice } from "../src/fallback-dispatch-cli.ts";
import { renderDispatchCard } from "../src/dispatch-card.ts";
const cli = resolve(dirname(fileURLToPath(import.meta.url)), "../src/fallback-dispatch-cli.ts");

test("real CLI persists route, survives separate processes, and emits startup protocol", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-dispatch-cli-"));
  const { CODEX_THREAD_ID: _nativeSession, ...inherited } = process.env;
  const env = { ...inherited, CODEXCLAW_HOME: join(cwd, "global") };
  setRole(cwd, "executor", { mode: "model", model: "xai/grok-4.6", fallback: { model: "cursor/grok-4.6", effort: "low" } }, "project", env);
  const call = (input: unknown, args: string[] = []) => {
    const child = spawnSync(process.execPath, [cli, ...args], { cwd, env, input: JSON.stringify(input), encoding: "utf8" });
    assert.equal(child.status, 0, child.stdout + child.stderr);
    return child.stdout ? JSON.parse(child.stdout) : null;
  };
  assert.match(call({ cwd }, ["hook", "session-start"]).hookSpecificOutput.additionalContext, /executor/);
  assert.equal(call({ cwd, agent_id: "child" }, ["hook", "session-start"]), null);
  const base = { sessionId: "fixture", dispatchId: "one" };
  const first = call({ ...base, action: "start", role: "executor" });
  const claim = call({ ...base, action: "claim", attemptId: first.attemptId });
  assert.equal(claim.action, "spawn"); assert.equal(claim.candidate.model, "xai/grok-4.6");
  const second = call({ ...base, action: "report", attemptId: first.attemptId, outcome: "failed", error: "insufficient_quota", executionState: "not_created", reconciliation: "native tool rejected before creation" });
  assert.equal(second.action, "ready");
  const next = call({ ...base, action: "claim", attemptId: second.attemptId });
  assert.equal(next.candidate.model, "cursor/grok-4.6");
  call({ ...base, action: "report", attemptId: next.attemptId, outcome: "created", agentId: "native-child" });
  assert.equal(call({ ...base, action: "report", attemptId: next.attemptId, outcome: "complete", agentId: "native-child" }).action, "complete");
  assert.equal(call({ ...base, action: "status" }).action, "complete");
});
test("real CLI refuses corrupt state and invalid JSON rather than resetting it", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-dispatch-cli-invalid-"));
  const { CODEX_THREAD_ID: _nativeSession, ...env } = process.env;
  const base = { sessionId: "fixture", dispatchId: "one" };
  const run = (input: string) => spawnSync(process.execPath, [cli], { cwd, env, input, encoding: "utf8" });
  assert.equal(run("{").status, 1);
  assert.equal(run(JSON.stringify({ ...base, action: "start", role: "executor" })).status, 0);
  writeFileSync(join(cwd, ".codexclaw/dispatches/fixture/one.json"), "{}");
  const out = run(JSON.stringify({ ...base, action: "status" }));
  assert.equal(out.status, 1); assert.match(out.stdout, /invalid dispatch identity/);
});
test("real CLI recovers confirmed task failures across separate processes", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-dispatch-cli-task-"));
  const { CODEX_THREAD_ID: _nativeSession, ...inherited } = process.env;
  const env = { ...inherited, CODEXCLAW_HOME: join(cwd, "global") };
  setRole(cwd, "executor", { mode: "model", model: "xai/grok-4.6", fallback: { model: "cursor/grok-4.6", effort: "low" } }, "project", env);
  const call = (input: unknown) => {
    const child = spawnSync(process.execPath, [cli], { cwd, env, input: JSON.stringify(input), encoding: "utf8" });
    assert.equal(child.status, 0, child.stdout + child.stderr);
    return child.stdout ? JSON.parse(child.stdout) : null;
  };
  const base = { sessionId: "fixture", dispatchId: "task" };
  const first = call({ ...base, action: "start", role: "executor" });
  call({ ...base, action: "claim", attemptId: first.attemptId });
  call({ ...base, action: "report", attemptId: first.attemptId, outcome: "created", agentId: "child-a" });
  const second = call({ ...base, action: "report", attemptId: first.attemptId, outcome: "task_failed", agentId: "child-a", executionState: "stopped", reconciliation: "child stopped; diff inspected", taskFailure: { kind: "unusable_output", evidence: "final message unrelated to the packet" } });
  assert.equal(second.action, "ready");
  assert.equal(second.attempts[0].taskFailure?.kind, "unusable_output");
  assert.equal(second.attempts[0].code, null);
  const claim = call({ ...base, action: "claim", attemptId: second.attemptId });
  assert.equal(claim.candidate.model, "cursor/grok-4.6");
  call({ ...base, action: "report", attemptId: second.attemptId, outcome: "created", agentId: "child-b" });
  const end = call({ ...base, action: "report", attemptId: second.attemptId, outcome: "task_failed", agentId: "child-b", executionState: "stopped", reconciliation: "second child stopped; partial work preserved", taskFailure: { kind: "stagnation", evidence: "no advancement at the stated review point" } });
  assert.equal(end.action, "main-direct");
  const status = call({ ...base, action: "status" });
  assert.equal(status.action, "main-direct");
  assert.equal(status.attempts[1].taskFailure?.kind, "stagnation");
  const raw = JSON.parse(readFileSync(join(cwd, ".codexclaw", "dispatches", "fixture", "task.json"), "utf8"));
  assert.equal(raw.attempts[0].taskFailure.kind, "unusable_output");
});

test("malformed startup payload is silent, malformed dispatch input is visible", () => {
  const hook = spawnSync(process.execPath, [cli, "hook", "session-start"], { input: "", encoding: "utf8" });
  assert.equal(hook.status, 0); assert.equal(hook.stdout, "");
  const command = spawnSync(process.execPath, [cli], { input: "", encoding: "utf8" });
  assert.equal(command.status, 1); assert.ok(JSON.parse(command.stdout).error);
});

test("session card appears without fallback and repeats for each startup", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-card-no-fallback-"));
  const first = JSON.parse(sessionFallbackNotice(cwd)).hookSpecificOutput;
  const second = JSON.parse(sessionFallbackNotice(cwd)).hookSpecificOutput;
  assert.equal(first.hookEventName, "SessionStart");
  assert.equal(first.additionalContext, renderDispatchCard());
  assert.deepEqual(second, first);
  const child = spawnSync(process.execPath, [cli, "hook", "session-start"], { cwd, input: JSON.stringify({ cwd, agent_id: "child" }), encoding: "utf8" });
  assert.equal(child.status, 0);
  assert.equal(child.stdout, "");
});

test("managed protocol precedes card and combined context is bounded", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-card-fallback-"));
  setRole(cwd, "executor", { fallback: { model: "provider/fallback", effort: "low" } }, "project");
  const context: string = JSON.parse(sessionFallbackNotice(cwd)).hookSpecificOutput.additionalContext;
  const prefix = `[codexclaw] First fallback configured for executor. ${DISPATCH_GUIDANCE}`;
  assert.ok(context.startsWith(prefix + "\n"));
  assert.equal(context.slice(prefix.length + 1), renderDispatchCard());
  assert.ok(context.length <= 4096);
  assert.ok(renderDispatchCard().length <= 1200);
  assert.throws(() => sessionFallbackNotice(cwd, () => "x".repeat(4097)), /SessionStart dispatch context exceeds 4096 characters/);
});
