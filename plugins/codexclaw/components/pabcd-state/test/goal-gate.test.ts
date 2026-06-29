import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parsePreToolUse,
  applyGoalBudgetGuard,
  applyGoalModeInterviewGuard,
  type PreToolUsePayload,
} from "../src/goal-gate.ts";
import type { GoalActiveDeps } from "../src/goal-active.ts";

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

test("applyGoalBudgetGuard: extra key denies with the SAME envelope as token_budget (L3.2)", () => {
  const budget = applyGoalBudgetGuard(ptu("create_goal", { objective: "do x", token_budget: 1000 }));
  const extra = applyGoalBudgetGuard(ptu("create_goal", { objective: "do x", foo: 1 }));
  const bp = JSON.parse(budget.trimEnd()).hookSpecificOutput;
  const ep = JSON.parse(extra.trimEnd()).hookSpecificOutput;
  assert.equal(ep.hookEventName, bp.hookEventName);
  assert.equal(ep.permissionDecision, "deny");
  assert.equal(ep.permissionDecision, bp.permissionDecision);
  assert.equal(typeof ep.permissionDecisionReason, "string");
  assert.ok(ep.permissionDecisionReason.length > 0);
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

// --- applyGoalModeInterviewGuard (L11.2 / Q-GM-1-f hard deny) ----------------

// Inject a fake goals DB so the guard never touches the real codex DB. The path
// must exist on disk (getGoalActiveStatus existsSync-gates before opening), so
// we point at a real temp file and override the opener with a stub.
function realDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "cxc-gg-"));
  const p = join(dir, "goals_1.sqlite");
  writeFileSync(p, "");
  return p;
}

function depsWithStatus(status: string | number | null): GoalActiveDeps {
  return {
    dbPath: realDbPath(),
    openDb: () => ({
      prepare: () => ({
        get: () => (status === null ? undefined : { status }),
      }),
      close: () => {},
    }),
  };
}

test("applyGoalModeInterviewGuard: active goal -> deny request_user_input", () => {
  const out = applyGoalModeInterviewGuard(ptu("request_user_input", { questions: [] }), depsWithStatus("active"));
  assert.notEqual(out, "");
  assert.ok(out.endsWith("\n"));
  const hso = JSON.parse(out.trimEnd()).hookSpecificOutput;
  assert.equal(hso.hookEventName, "PreToolUse");
  assert.equal(hso.permissionDecision, "deny");
  assert.match(hso.additionalContext, /goal-active=active/);
});

test("applyGoalModeInterviewGuard: unreadable goal DB -> deny (fail closed)", () => {
  // A non-string status column -> getGoalActiveStatus returns "unreadable" -> fail closed (deny).
  const out = applyGoalModeInterviewGuard(ptu("request_user_input", {}), depsWithStatus(123));
  assert.notEqual(out, "");
  assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, /goal-active=unreadable/);
});

test("applyGoalModeInterviewGuard: inactive goal -> passthrough ''", () => {
  assert.equal(applyGoalModeInterviewGuard(ptu("request_user_input", {}), depsWithStatus("complete")), "");
  assert.equal(applyGoalModeInterviewGuard(ptu("request_user_input", {}), depsWithStatus(null)), "");
});

test("applyGoalModeInterviewGuard: non-request_user_input tool -> passthrough '' (no DB read)", () => {
  let opened = false;
  const spyDeps: GoalActiveDeps = {
    dbPath: realDbPath(),
    openDb: () => {
      opened = true;
      return { prepare: () => ({ get: () => ({ status: "active" }) }), close: () => {} };
    },
  };
  assert.equal(applyGoalModeInterviewGuard(ptu("shell", { command: "ls" }), spyDeps), "");
  assert.equal(opened, false);
});
