import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { setRole } from "../src/store.ts";
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
  assert.match(call({ cwd }, ["session-start"]).hookSpecificOutput.additionalContext, /executor/);
  assert.equal(call({ cwd, agent_id: "child" }, ["session-start"]), null);
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
test("malformed startup payload is silent, malformed dispatch input is visible", () => {
  const hook = spawnSync(process.execPath, [cli, "session-start"], { input: "", encoding: "utf8" });
  assert.equal(hook.status, 0); assert.equal(hook.stdout, "");
  const command = spawnSync(process.execPath, [cli], { input: "", encoding: "utf8" });
  assert.equal(command.status, 1); assert.ok(JSON.parse(command.stdout).error);
});
