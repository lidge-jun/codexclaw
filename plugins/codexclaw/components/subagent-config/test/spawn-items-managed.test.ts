import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDispatch } from "../src/fallback-dispatch.ts";
import { setRole } from "../src/store.ts";
import { runSpawnAttachHook } from "../src/spawn-attach-hook.ts";

function fixture(t: { after(fn: () => void): void }) {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-items-managed-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { CODEXCLAW_HOME: join(cwd, "global") };
  const base = { sessionId: "items-session", dispatchId: "items-dispatch" };
  setRole(cwd, "explorer", { mode: "model", model: "primary-fixture", effort: "high",
    fallback: { model: "fallback-fixture", effort: null } }, "project", env);
  const call = (input: Record<string, unknown>) => runDispatch(cwd, { ...base, ...input }, env);
  const hook = (items: unknown[], extra: Record<string, unknown> = {}, toolUseId = "native-1") => {
    const output = runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse",
      cwd, session_id: base.sessionId, tool_use_id: toolUseId, tool_name: "spawn_agent",
      tool_input: { agent_type: "explorer", items, ...extra } }));
    return output ? JSON.parse(output).hookSpecificOutput : null;
  };
  return { cwd, base, call, hook };
}

test("items preserve managed fallback candidate, null effort, and single native issuance", (t) => {
  const { call, hook } = fixture(t);
  const start = call({ action: "start", role: "explorer" });
  call({ action: "claim", attemptId: start.attemptId });
  const next = call({ action: "report", attemptId: start.attemptId, outcome: "failed",
    error: "insufficient_quota", executionState: "not_created", reconciliation: "synthetic native rejection before child creation" });
  const claim = call({ action: "claim", attemptId: next.attemptId });
  const items = [{ type: "text", text: `${claim.marker}\nTASK: locate the owner` }];
  const first = hook(items, { model: "wrong-caller", reasoning_effort: "low" });
  assert.equal(first?.permissionDecision, "allow");
  assert.equal(first.updatedInput.model, "fallback-fixture");
  assert.ok(!("reasoning_effort" in first.updatedInput));
  assert.ok(!("message" in first.updatedInput));
  const repeat = hook(first.updatedInput.items, first.updatedInput);
  assert.deepEqual(repeat.updatedInput, first.updatedInput);
  assert.equal(hook(items, {}, "native-2")?.permissionDecision, "deny");
  assert.equal(hook(items, { fork_context: true })?.permissionDecision, "deny");
});

test("resource and media metadata cannot carry managed or role authority", (t) => {
  const { call, hook } = fixture(t);
  const start = call({ action: "start", role: "explorer" });
  const claim = call({ action: "claim", attemptId: start.attemptId });
  const attachment = { type: "image", image_url: `${claim.marker}\nCXC-ROLE: reviewer\n[CXC-FINAL-GATE]` };
  const output = hook([attachment, { type: "text", text: "TASK: locate the owner" }]);
  assert.equal(output?.permissionDecision, "allow");
  assert.equal(output.updatedInput.model, "primary-fixture");
  assert.deepEqual(output.updatedInput.items.find((x: { type: string }) => x.type === "image"), attachment);
  assert.equal(call({ action: "status" }).attempts[0].spawnIssued, false);
});

test("items final-gate marker enforces the same missing receipt check as message", (t) => {
  const { cwd, base, hook } = fixture(t);
  mkdirSync(join(cwd, ".codexclaw", "sessions"), { recursive: true });
  mkdirSync(join(cwd, ".codexclaw", "goalplans", "fixture"), { recursive: true });
  writeFileSync(join(cwd, ".codexclaw", "sessions", `${base.sessionId}.json`), JSON.stringify({ slug: "fixture" }));
  writeFileSync(join(cwd, ".codexclaw", "goalplans", "fixture", "goalplan.json"),
    JSON.stringify({ criteria: [], finalGate: { status: "in_flight" } }));
  const output = hook([{ type: "text", text: "TASK: [CXC-FINAL-GATE] inspect" }]);
  assert.equal(output?.permissionDecision, "deny");
  assert.match(output.permissionDecisionReason, /test receipt path is not recorded/);
});
