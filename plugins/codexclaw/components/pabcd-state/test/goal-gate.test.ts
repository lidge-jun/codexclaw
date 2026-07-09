import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parsePreToolUse,
  applyGoalBudgetGuard,
  applyGoalModeInterviewGuard,
  applyGoalCompleteGuard,
  handlePreToolUseFailClosed,
  rawLooksLikeRequestUserInput,
  type PreToolUsePayload,
} from "../src/goal-gate.ts";
import type { GoalActiveDeps } from "../src/goal-active.ts";
import { defaultState, writeState } from "../src/state.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";

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

function ptuAt(cwd: string, sessionId: string, toolName: string, toolInput: unknown): PreToolUsePayload {
  return { ...ptu(toolName, toolInput), cwd, session_id: sessionId };
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

// --- handlePreToolUseFailClosed (L11.2 A-gate: deny must survive a throw) -----

function rawPtu(toolName: string, toolInput: unknown = {}): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd: "/tmp/x",
    tool_name: toolName,
    tool_input: toolInput,
  });
}

test("rawLooksLikeRequestUserInput: detects request_user_input, rejects others/garbage", () => {
  assert.equal(rawLooksLikeRequestUserInput(rawPtu("request_user_input")), true);
  assert.equal(rawLooksLikeRequestUserInput(rawPtu("shell")), false);
  assert.equal(rawLooksLikeRequestUserInput("not json"), false);
  assert.equal(rawLooksLikeRequestUserInput(""), false);
});

test("handlePreToolUseFailClosed: throwing status lookup on request_user_input -> DENY (fail closed)", () => {
  // Simulate the A-gate hole: getGoalActiveStatus throws (not its own internal
  // catch — an unexpected throw). The dispatcher must DENY, not fail open.
  const throwingDeps: GoalActiveDeps = {
    dbPath: realDbPath(),
    openDb: () => {
      throw new Error("boom");
    },
  };
  // openDb throwing is caught inside getGoalActiveStatus -> "unreadable" -> deny.
  const out = handlePreToolUseFailClosed(rawPtu("request_user_input"), throwingDeps);
  assert.notEqual(out, "");
  assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, /goal-active=unreadable/);
});

test("handlePreToolUseFailClosed: deps that throw OUTSIDE getGoalActiveStatus still DENY request_user_input", () => {
  // dbPath getter that throws synchronously when resolved would escape the
  // inner catch; emulate by passing a deps object whose dbPath access throws.
  const hostileDeps = Object.create(null, {
    dbPath: {
      enumerable: true,
      get() {
        throw new Error("dbPath explode");
      },
    },
  }) as GoalActiveDeps;
  const out = handlePreToolUseFailClosed(rawPtu("request_user_input"), hostileDeps);
  assert.notEqual(out, "", "request_user_input must DENY even when the guard throws");
  assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecision, /deny/);
});

test("handlePreToolUseFailClosed: throw on a NON-interview tool -> passthrough '' (fail open is fine)", () => {
  const hostileDeps = Object.create(null, {
    dbPath: {
      enumerable: true,
      get() {
        throw new Error("dbPath explode");
      },
    },
  }) as GoalActiveDeps;
  // shell never reaches the status lookup, but even if a throw happened the
  // non-interview path is allowed to fail open.
  assert.equal(handlePreToolUseFailClosed(rawPtu("shell", { command: "ls" }), hostileDeps), "");
});

test("handlePreToolUseFailClosed: active goal request_user_input -> deny via normal path", () => {
  const out = handlePreToolUseFailClosed(rawPtu("request_user_input"), depsWithStatus("active"));
  assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, /goal-active=active/);
});

test("handlePreToolUseFailClosed: create_goal budget guard still fires through dispatcher", () => {
  const out = handlePreToolUseFailClosed(rawPtu("create_goal", { objective: "x", token_budget: 5 }));
  assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecisionReason, /token_budget/);
});

test("handlePreToolUseFailClosed: malformed JSON -> passthrough ''", () => {
  assert.equal(handlePreToolUseFailClosed("not json"), "");
  assert.equal(handlePreToolUseFailClosed(""), "");
});

// --- L12.2 regression guard: "no interview during a goal" (real status path) ----
// Asserts the boundary on the REAL goal-status code path with an injected openDb stub
// (status='active'), not via a missing DB (which would be a false green).
test("L12.2 boundary: goal active DENIES request_user_input; inactive ALLOWS it", () => {
  // active goal -> interview/request_user_input is denied (goal mode is PABCD-only).
  const denied = handlePreToolUseFailClosed(rawPtu("request_user_input"), depsWithStatus("active"));
  assert.notEqual(denied, "", "active goal must deny request_user_input");
  assert.match(JSON.parse(denied.trimEnd()).hookSpecificOutput.permissionDecision, /deny/);
  // inactive goal -> interview is allowed (HITL interactive interview).
  const allowed = handlePreToolUseFailClosed(rawPtu("request_user_input"), depsWithStatus("complete"));
  assert.equal(allowed, "", "inactive goal must allow request_user_input (interactive interview)");
});

// --- GOAL-COMPLETE-GATE-01 (260709): deterministic anti-lazy-completion --------

function freshGateCwd(): string {
  return mkdtempSync(join(tmpdir(), "cxc-goal-complete-"));
}

test("GOAL-COMPLETE-GATE-01: non-update_goal and non-complete updates pass through", () => {
  assert.equal(applyGoalCompleteGuard(ptu("create_goal", { objective: "x" })), "");
  assert.equal(applyGoalCompleteGuard(ptu("update_goal", { status: "blocked" })), "");
  assert.equal(applyGoalCompleteGuard(ptu("update_goal", "complete")), "");
});

test("GOAL-COMPLETE-GATE-01: complete with no session state passes through (nothing to judge)", () => {
  const cwd = freshGateCwd();
  try {
    assert.equal(applyGoalCompleteGuard(ptuAt(cwd, "gc0", "update_goal", { status: "complete" })), "");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-COMPLETE-GATE-01: complete mid-cycle -> deny (close through D first)", () => {
  const cwd = freshGateCwd();
  try {
    writeState(cwd, { ...defaultState("gc1"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B" });
    const out = applyGoalCompleteGuard(ptuAt(cwd, "gc1", "update_goal", { status: "complete" }));
    assert.notEqual(out, "");
    const parsed = JSON.parse(out.trimEnd()).hookSpecificOutput;
    assert.equal(parsed.permissionDecision, "deny");
    assert.match(parsed.permissionDecisionReason, /GOAL-COMPLETE-GATE-01/);
    assert.match(parsed.permissionDecisionReason, /phase B/);
    assert.match(parsed.permissionDecisionReason, /--session gc1/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-COMPLETE-GATE-01: bound goalplan failing E8 -> deny with the validate reasons", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "Ship it", criteria: [{ scenario: "tests", expectedEvidence: "green" }] });
    writeGoalplan(cwd, plan); // one open criterion -> validate fails
    writeState(cwd, { ...defaultState("gc2"), phase: "IDLE", orchestrationActive: false, slug: plan.slug });
    const out = applyGoalCompleteGuard(ptuAt(cwd, "gc2", "update_goal", { status: "complete" }));
    assert.notEqual(out, "");
    const reason = JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecisionReason as string;
    assert.match(reason, /fails the E8 quality gate/);
    assert.match(reason, /unmet criterion/);
    assert.match(reason, /cxc loop validate/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-COMPLETE-GATE-01: EMPTY bound goalplan -> deny (register the plan first)", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "Shell only" });
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("gc3"), phase: "IDLE", orchestrationActive: false, slug: plan.slug });
    const out = applyGoalCompleteGuard(ptuAt(cwd, "gc3", "update_goal", { status: "complete" }));
    assert.notEqual(out, "");
    assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecisionReason, /plan is empty/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-COMPLETE-GATE-01: valid goalplan at IDLE -> complete passes", () => {
  const cwd = freshGateCwd();
  try {
    const plan = buildGoalplan({ objective: "Done for real", criteria: [{ scenario: "tests", expectedEvidence: "green" }] });
    plan.criteria[0] = { ...plan.criteria[0], status: "met", capturedEvidence: "node --test: 0 fail" };
    plan.workPhases = [{ id: "wp-1", title: "All", status: "done", tasks: [{ id: "t-1", title: "x", status: "done" }], criteriaIds: ["c-1"] }];
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("gc4"), phase: "IDLE", orchestrationActive: false, slug: plan.slug });
    assert.equal(applyGoalCompleteGuard(ptuAt(cwd, "gc4", "update_goal", { status: "complete" })), "");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-COMPLETE-GATE-01: fires through the fail-closed dispatcher", () => {
  const cwd = freshGateCwd();
  try {
    writeState(cwd, { ...defaultState("gc5"), phase: "C", orchestrationActive: true, lastInjectedPhase: "C" });
    const raw = JSON.stringify({
      hook_event_name: "PreToolUse",
      session_id: "gc5",
      cwd,
      tool_name: "update_goal",
      tool_input: { status: "complete" },
    });
    const out = handlePreToolUseFailClosed(raw);
    assert.notEqual(out, "");
    assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecisionReason, /GOAL-COMPLETE-GATE-01/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
