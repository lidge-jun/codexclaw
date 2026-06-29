import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreToolUse, applyGoalBudgetGuard, type PreToolUsePayload } from "../src/goal-gate.ts";

function ptu(toolName: string, toolInput: unknown): PreToolUsePayload {
  return {
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd: "/tmp/x",
    tool_name: toolName,
    tool_input: toolInput,
    turn_id: "t1",
    transcript_path: null,
  };
}

test("applyGoalBudgetGuard: create_goal with objective only -> passthrough ''", () => {
  assert.equal(applyGoalBudgetGuard(ptu("create_goal", { objective: "do x" })), "");
});

test("applyGoalBudgetGuard: create_goal with token_budget -> deny", () => {
  const out = applyGoalBudgetGuard(ptu("create_goal", { objective: "do x", token_budget: 1000 }));
  assert.notEqual(out, "");
  assert.ok(out.endsWith("\n"));
  const parsed = JSON.parse(out.trimEnd());
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(typeof parsed.hookSpecificOutput.permissionDecisionReason === "string");
  assert.ok(parsed.hookSpecificOutput.permissionDecisionReason.includes("token_budget"));
});

test("applyGoalBudgetGuard: create_goal with any extra key -> deny", () => {
  const out = applyGoalBudgetGuard(ptu("create_goal", { objective: "do x", foo: 1 }));
  assert.notEqual(out, "");
});

test("applyGoalBudgetGuard: non-create_goal tool -> passthrough ''", () => {
  assert.equal(applyGoalBudgetGuard(ptu("shell", { command: "ls", token_budget: 5 })), "");
});

test("applyGoalBudgetGuard: create_goal with empty input -> passthrough ''", () => {
  assert.equal(applyGoalBudgetGuard(ptu("create_goal", {})), "");
});

test("applyGoalBudgetGuard: create_goal with non-object input -> passthrough ''", () => {
  assert.equal(applyGoalBudgetGuard(ptu("create_goal", null)), "");
  assert.equal(applyGoalBudgetGuard(ptu("create_goal", "objective")), "");
});

test("parsePreToolUse: valid payload roundtrips", () => {
  const raw = JSON.stringify({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd: "/tmp/x",
    tool_name: "create_goal",
    tool_input: { objective: "y", token_budget: 9 },
    turn_id: "t9",
  });
  const p = parsePreToolUse(raw);
  assert.ok(p);
  assert.equal(p?.tool_name, "create_goal");
});

test("parsePreToolUse: empty / corrupt / wrong-event -> null", () => {
  assert.equal(parsePreToolUse(""), null);
  assert.equal(parsePreToolUse("{ not json"), null);
  assert.equal(parsePreToolUse(JSON.stringify({ hook_event_name: "Stop", session_id: "s", cwd: "/t" })), null);
  assert.equal(parsePreToolUse(JSON.stringify({ hook_event_name: "PreToolUse" })), null);
});

test("parse -> guard end to end: budgeted create_goal denied", () => {
  const raw = JSON.stringify({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd: "/tmp/x",
    tool_name: "create_goal",
    tool_input: { objective: "y", token_budget: 9 },
  });
  const p = parsePreToolUse(raw);
  assert.ok(p);
  const out = applyGoalBudgetGuard(p as PreToolUsePayload);
  assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecision, "deny");
});
