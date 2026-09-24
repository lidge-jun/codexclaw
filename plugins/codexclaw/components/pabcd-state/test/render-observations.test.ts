import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  handleRenderObservationCapture,
  handleRenderArtifactCapture,
  readRenderObsRows,
  resetRenderLedger,
  hasRenderObservation,
  hasRenderArtifactModified,
  hasNativeObservation,
  nativeObservationRows,
  isRenderArtifact,
  renderGroundingAdvisory,
  RENDER_ARTIFACT_EXTENSIONS,
  RENDER_OBSERVATION_TOOLS,
} from "../src/render-observations.ts";
import {
  handleStop,
  renderGroundingAdvisoryForStop,
  buildContextOutput,
  type StopPayload,
} from "../src/hook.ts";
import { defaultState, writeState } from "../src/state.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { GOALS_DB_FILENAME } from "../src/goal-active.ts";
import type { PostToolUsePayload } from "../src/hook.ts";

const nodeRequire = createRequire(import.meta.url);

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-render-obs-"));
}

function obsPayload(cwd: string, toolName: string, sessionId = "s1"): PostToolUsePayload {
  return {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    cwd,
    tool_name: toolName,
    tool_input: {},
    tool_response: "ok",
    tool_use_id: "t1",
    turn_id: "turn1",
  };
}

function patchPayload(cwd: string, file: string, sessionId = "s1"): PostToolUsePayload {
  const command = [
    "*** Begin Patch",
    `*** Update File: ${file}`,
    "@@",
    " context",
    "-old line",
    "+new line",
    "*** End Patch",
  ].join("\n");
  return {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    cwd,
    tool_name: "apply_patch",
    tool_input: { command },
    tool_response: "Done",
    tool_use_id: "t1",
    turn_id: "turn1",
  };
}

function withGoalsDb(rows: Array<{ thread_id: string; status: string }>, fn: () => void): void {
  const home = mkdtempSync(join(tmpdir(), "cxc-goalsenv-"));
  const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(join(home, GOALS_DB_FILENAME));
  db.exec(`CREATE TABLE thread_goals (thread_id TEXT PRIMARY KEY NOT NULL, goal_id TEXT NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL);`);
  const ins = db.prepare("INSERT INTO thread_goals (thread_id, goal_id, objective, status) VALUES (?,?,?,?)");
  for (const r of rows) ins.run(r.thread_id, `g-${r.thread_id}`, "obj", r.status);
  db.close();
  const prev = process.env.CODEX_SQLITE_HOME;
  process.env.CODEX_SQLITE_HOME = home;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.CODEX_SQLITE_HOME;
    else process.env.CODEX_SQLITE_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  }
}

// --- isRenderArtifact -----------------------------------------------------------

test("isRenderArtifact: recognizes all render-artifact extensions", () => {
  assert.ok(isRenderArtifact("index.html"));
  assert.ok(isRenderArtifact("chart.svg"));
  assert.ok(isRenderArtifact("layout.css"));
  assert.ok(isRenderArtifact("App.jsx"));
  assert.ok(isRenderArtifact("Page.tsx"));
  assert.ok(isRenderArtifact("src/components/Dashboard.tsx"));
});

test("isRenderArtifact: rejects non-render extensions", () => {
  assert.ok(!isRenderArtifact("server.ts"));
  assert.ok(!isRenderArtifact("config.json"));
  assert.ok(!isRenderArtifact("README.md"));
  assert.ok(!isRenderArtifact("main.py"));
  assert.ok(!isRenderArtifact("Makefile"));
});

// --- handleRenderObservationCapture -------------------------------------------

test("render observation capture: records observation tool calls", () => {
  const cwd = tmp();
  for (const tool of RENDER_OBSERVATION_TOOLS) {
    handleRenderObservationCapture(obsPayload(cwd, tool));
  }
  const rows = readRenderObsRows(cwd);
  assert.equal(rows.length, RENDER_OBSERVATION_TOOLS.size);
  assert.ok(rows.every((r) => r.kind === "observation"));
});

test("render observation capture: ignores non-observation tools", () => {
  const cwd = tmp();
  handleRenderObservationCapture(obsPayload(cwd, "apply_patch"));
  handleRenderObservationCapture(obsPayload(cwd, "Bash"));
  handleRenderObservationCapture(obsPayload(cwd, "request_user_input"));
  assert.deepEqual(readRenderObsRows(cwd), []);
});

test("render observation capture: returns empty string (side-effect only)", () => {
  const cwd = tmp();
  const out = handleRenderObservationCapture(obsPayload(cwd, "view_image"));
  assert.equal(out, "");
});

test("render observation capture: wrong event name returns empty string", () => {
  const cwd = tmp();
  const payload = obsPayload(cwd, "view_image");
  payload.hook_event_name = "UserPromptSubmit" as "PostToolUse";
  assert.equal(handleRenderObservationCapture(payload), "");
});

// --- handleRenderArtifactCapture -----------------------------------------------

test("render artifact capture: records when render-artifact files are modified", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "src/index.html"));
  handleRenderArtifactCapture(patchPayload(cwd, "chart.svg"));
  const rows = readRenderObsRows(cwd);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.kind === "artifact-modified"));
  assert.equal(rows[0].detail, "src/index.html");
  assert.equal(rows[1].detail, "chart.svg");
});

test("render artifact capture: ignores non-render files", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "src/server.ts"));
  handleRenderArtifactCapture(patchPayload(cwd, "config.json"));
  assert.deepEqual(readRenderObsRows(cwd), []);
});

test("render artifact capture: ignores non-apply_patch tools", () => {
  const cwd = tmp();
  const payload = patchPayload(cwd, "index.html");
  payload.tool_name = "Bash";
  handleRenderArtifactCapture(payload);
  assert.deepEqual(readRenderObsRows(cwd), []);
});

test("render artifact capture: returns empty string (side-effect only)", () => {
  const cwd = tmp();
  assert.equal(handleRenderArtifactCapture(patchPayload(cwd, "index.html")), "");
});

// --- hasRenderObservation / hasRenderArtifactModified ---------------------------

test("hasRenderObservation: true when observation rows exist", () => {
  const cwd = tmp();
  assert.ok(!hasRenderObservation(cwd));
  handleRenderObservationCapture(obsPayload(cwd, "view_image"));
  assert.ok(hasRenderObservation(cwd));
});

test("hasRenderArtifactModified: true when artifact-modified rows exist", () => {
  const cwd = tmp();
  assert.ok(!hasRenderArtifactModified(cwd));
  handleRenderArtifactCapture(patchPayload(cwd, "page.html"));
  assert.ok(hasRenderArtifactModified(cwd));
});

test("render ledger queries: filter by session when provided", () => {
  const cwd = tmp();
  handleRenderObservationCapture(obsPayload(cwd, "view_image", "other"));
  handleRenderArtifactCapture(patchPayload(cwd, "page.html", "other"));

  assert.equal(hasRenderObservation(cwd, "current"), false);
  assert.equal(hasRenderArtifactModified(cwd, "current"), false);
  assert.equal(hasRenderObservation(cwd, "other"), true);
  assert.equal(hasRenderArtifactModified(cwd, "other"), true);
  assert.equal(hasRenderObservation(cwd), true, "omitting sessionId preserves all-session matching");
  assert.equal(hasRenderArtifactModified(cwd), true, "omitting sessionId preserves all-session matching");
});

test("readRenderObsRows: missing ledger returns []", () => {
  const cwd = tmp();
  assert.deepEqual(readRenderObsRows(cwd), []);
});

// --- renderGroundingAdvisoryForStop --------------------------------------------

test("advisory fires: phase C + artifact modified + no observation", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "index.html"));
  const result = renderGroundingAdvisoryForStop(cwd, "C", "s1", "");
  assert.notEqual(result, null);
  assert.ok(result!.includes("C-RENDER-GROUNDING-01"));
  assert.ok(result!.includes("Render-artifact"));
});

test("advisory does NOT fire: phase C + artifact modified + observation present", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "index.html"));
  handleRenderObservationCapture(obsPayload(cwd, "view_image"));
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", ""), null);
});

test("advisory does NOT fire: phase C + no artifact modified", () => {
  const cwd = tmp();
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", ""), null);
});

test("advisory does NOT fire: non-C phase + artifact modified", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "index.html"));
  assert.equal(renderGroundingAdvisoryForStop(cwd, "B", "s1", ""), null);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "D", "s1", ""), null);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "P", "s1", ""), null);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "IDLE", "s1", ""), null);
});

function nativePlan(cwd: string, linked = true): string {
  const plan = buildGoalplan({
    objective: "native observation fixture",
    criteria: [{ scenario: "tray", surface: "desktop", presented: "native" }],
  });
  plan.activeWorkPhaseId = "wp-live";
  plan.workPhases = [{ id: "wp-live", title: "live", status: "in_progress", tasks: [], criteriaIds: linked ? ["c-1"] : [] }];
  writeGoalplan(cwd, plan);
  return plan.slug;
}

test("explicit computer-use app records a native row with structured metadata", () => {
  const cwd = tmp();
  const payload = obsPayload(cwd, "computer-use:computer-use");
  payload.tool_input = { appName: "Finder", criterionId: "c-1" };
  handleRenderObservationCapture(payload);
  assert.equal(hasNativeObservation(cwd, "s1"), true);
  assert.deepEqual(nativeObservationRows(cwd, "s1").map((r) => [r.nativeApp, r.criterionId]), [["Finder", "c-1"]]);
  assert.equal(hasNativeObservation(cwd, "other"), false);
});

test("view_image records only a declared QA screenshot", () => {
  const cwd = tmp();
  const scenario = join(cwd, ".codexclaw", "evidence", "s1", "qa", "D-TRAY");
  mkdirSync(scenario, { recursive: true });
  writeFileSync(join(scenario, "verdict.json"), JSON.stringify({ artifactRefs: ["tray.png"] }));
  const payload = obsPayload(cwd, "view_image");
  payload.tool_input = { path: join(scenario, "other.png") };
  handleRenderObservationCapture(payload);
  assert.equal(hasNativeObservation(cwd, "s1"), false);
  payload.tool_input = { path: join(scenario, "tray.png"), criterionId: "c-1" };
  handleRenderObservationCapture(payload);
  assert.equal(nativeObservationRows(cwd, "s1")[0]?.screenshotPath, join(scenario, "tray.png"));
  assert.equal(nativeObservationRows(cwd, "s1")[0]?.criterionId, "c-1");
});

test("browser, shell and unstructured CUA payloads do not create native rows", () => {
  const cwd = tmp();
  handleRenderObservationCapture(obsPayload(cwd, "browser:control-in-app-browser"));
  handleRenderObservationCapture(obsPayload(cwd, "Bash"));
  const cua = obsPayload(cwd, "computer-use:computer-use");
  cua.tool_response = "Finder app shown";
  handleRenderObservationCapture(cua);
  assert.equal(hasNativeObservation(cwd, "s1"), false);
});

test("native advisory fires without artifact edit and clears with an observed app", () => {
  const cwd = tmp();
  const slug = nativePlan(cwd);
  const advisory = renderGroundingAdvisoryForStop(cwd, "C", "s1", slug);
  assert.match(advisory ?? "", /D5\.2.*c-1/);
  assert.equal(hasRenderArtifactModified(cwd, "s1"), false);
  const payload = obsPayload(cwd, "computer-use:computer-use");
  payload.tool_response = { application: "Finder" };
  handleRenderObservationCapture(payload);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", slug), null,
    `criterion c-1 cleared by ${nativeObservationRows(cwd, "s1")[0]?.nativeApp}`);
});

test("native and ordinary render advisories can appear together", () => {
  const cwd = tmp();
  const slug = nativePlan(cwd);
  handleRenderArtifactCapture(patchPayload(cwd, "window.tsx"));
  const advisory = renderGroundingAdvisoryForStop(cwd, "C", "s1", slug);
  assert.match(advisory ?? "", /D5\.2.*c-1/);
  assert.match(advisory ?? "", /C-RENDER-GROUNDING-01/);
});

test("native advisory ignores package-only criteria and future linked criteria", () => {
  const cwd = tmp();
  const slug = nativePlan(cwd);
  const path = join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json");
  const plan = JSON.parse(readFileSync(path, "utf8"));
  plan.criteria.push({ id: "c-2", scenario: "package", surface: "desktop", status: "open", expectedEvidence: "", capturedEvidence: null });
  plan.workPhases[0].criteriaIds = ["c-2"];
  writeFileSync(path, JSON.stringify(plan));
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", slug), null);
  plan.workPhases[0].criteriaIds = [];
  writeFileSync(path, JSON.stringify(plan));
  assert.match(renderGroundingAdvisoryForStop(cwd, "C", "s1", slug) ?? "", /c-1/);
  plan.criteria[0].status = "met";
  plan.criteria[0].capturedEvidence = "observed";
  writeFileSync(path, JSON.stringify(plan));
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", slug), null);
  plan.workPhases = [];
  plan.activeWorkPhaseId = null;
  plan.criteria[0].status = "open";
  plan.criteria[0].capturedEvidence = null;
  writeFileSync(path, JSON.stringify(plan));
  assert.match(renderGroundingAdvisoryForStop(cwd, "C", "s1", slug) ?? "", /c-1/);
});

test("native advisory fails open for absent or malformed bound plan", () => {
  const cwd = tmp();
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", "missing"), null);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", "../bad"), null);
  const slug = nativePlan(cwd);
  writeFileSync(join(cwd, ".codexclaw", "goalplans", slug, "goalplan.json"), "{bad");
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", slug), null);
  writeFileSync(join(cwd, ".codexclaw", "render-observations.jsonl"), "{bad\n");
  assert.equal(hasNativeObservation(cwd, "s1"), false);
  const restored = nativePlan(cwd);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C", "s1", restored), null);
  writeFileSync(join(cwd, ".codexclaw", "render-observations.jsonl"),
    JSON.stringify({ kind: "native-observation", detail: "view_image", sessionId: "s1", nativeApp: "" }) + "\n");
  assert.equal(hasNativeObservation(cwd, "s1"), false);
});

// --- handleStop integration: interactive session advisory -----------------------

test("handleStop: interactive session at C with render artifacts emits advisory (not block)", () => {
  const cwd = tmp();
  try {
    // Set up: active orchestration at phase C, no goal
    writeState(cwd, { ...defaultState("s-int"), phase: "C", orchestrationActive: true });
    // Record a render-artifact modification
    handleRenderArtifactCapture(patchPayload(cwd, "dashboard.html", "s-int"));
    const payload: StopPayload = {
      hook_event_name: "Stop",
      session_id: "s-int",
      cwd,
      transcript_path: null,
      turn_id: "t1",
      stop_hook_active: false,
      last_assistant_message: "done",
    };
    const out = handleStop(payload);
    assert.notEqual(out, "", "should emit advisory");
    const parsed = JSON.parse(out.trimEnd());
    // Advisory uses hookSpecificOutput, NOT decision:"block"
    assert.ok(parsed.hookSpecificOutput, "should use hookSpecificOutput envelope");
    assert.ok(parsed.hookSpecificOutput.additionalContext.includes("C-RENDER-GROUNDING-01"));
    assert.equal(parsed.decision, undefined, "must NOT be a block decision");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleStop: interactive session at C without render artifacts emits nothing", () => {
  const cwd = tmp();
  try {
    writeState(cwd, { ...defaultState("s-clean"), phase: "C", orchestrationActive: true });
    const payload: StopPayload = {
      hook_event_name: "Stop",
      session_id: "s-clean",
      cwd,
      transcript_path: null,
      turn_id: "t1",
      stop_hook_active: false,
      last_assistant_message: "done",
    };
    assert.equal(handleStop(payload), "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleStop: interactive session at C with observation present emits nothing", () => {
  const cwd = tmp();
  try {
    writeState(cwd, { ...defaultState("s-obs"), phase: "C", orchestrationActive: true });
    handleRenderArtifactCapture(patchPayload(cwd, "page.html", "s-obs"));
    handleRenderObservationCapture(obsPayload(cwd, "view_image", "s-obs"));
    const payload: StopPayload = {
      hook_event_name: "Stop",
      session_id: "s-obs",
      cwd,
      transcript_path: null,
      turn_id: "t1",
      stop_hook_active: false,
      last_assistant_message: "done",
    };
    assert.equal(handleStop(payload), "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- handleStop integration: goal session advisory in block ---------------------

test("handleStop: goal session at C with render artifacts appends advisory to block reason", () => {
  const cwd = tmp();
  try {
    writeState(cwd, { ...defaultState("s-goal"), phase: "C", orchestrationActive: true });
    handleRenderArtifactCapture(patchPayload(cwd, "app.tsx", "s-goal"));
    withGoalsDb([{ thread_id: "s-goal", status: "active" }], () => {
      const payload: StopPayload = {
        hook_event_name: "Stop",
        session_id: "s-goal",
        cwd,
        transcript_path: null,
        turn_id: "t1",
        stop_hook_active: false,
        last_assistant_message: "building",
      };
      const out = handleStop(payload);
      assert.notEqual(out, "");
      const parsed = JSON.parse(out.trimEnd());
      // Goal mode: decision IS "block" (existing behavior)
      assert.equal(parsed.decision, "block");
      // The render advisory is appended to the reason
      assert.ok(parsed.reason.includes("C-RENDER-GROUNDING-01"), "advisory appended to block reason");
      assert.ok(parsed.reason.includes("continue PABCD"), "original block reason preserved");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleStop: goal session at C without render artifacts has normal block (no advisory)", () => {
  const cwd = tmp();
  try {
    writeState(cwd, { ...defaultState("s-goal2"), phase: "C", orchestrationActive: true });
    withGoalsDb([{ thread_id: "s-goal2", status: "active" }], () => {
      const payload: StopPayload = {
        hook_event_name: "Stop",
        session_id: "s-goal2",
        cwd,
        transcript_path: null,
        turn_id: "t1",
        stop_hook_active: false,
        last_assistant_message: "checking",
      };
      const out = handleStop(payload);
      assert.notEqual(out, "");
      const parsed = JSON.parse(out.trimEnd());
      assert.equal(parsed.decision, "block");
      assert.ok(!parsed.reason.includes("C-RENDER-GROUNDING-01"), "no advisory without artifacts");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- renderGroundingAdvisory text -----------------------------------------------

test("renderGroundingAdvisory includes key information", () => {
  const text = renderGroundingAdvisory();
  assert.ok(text.includes("C-RENDER-GROUNDING-01"));
  assert.ok(text.includes("Render-artifact"));
  assert.ok(text.includes("view_image"));
  assert.ok(text.includes("1280x720"));
  assert.ok(text.includes("not correct"));
});

// --- resetRenderLedger (cycle scoping) -------------------------------------------

test("resetRenderLedger empties the ledger so past-cycle rows neither suppress nor trigger", () => {
  const cwd = tmp();
  try {
    handleRenderObservationCapture(obsPayload(cwd, "view_image"));
    handleRenderArtifactCapture(patchPayload(cwd, "index.html"));
    assert.equal(hasRenderObservation(cwd), true);
    assert.equal(hasRenderArtifactModified(cwd), true);
    resetRenderLedger(cwd);
    assert.equal(readRenderObsRows(cwd).length, 0);
    assert.equal(hasRenderObservation(cwd), false);
    assert.equal(hasRenderArtifactModified(cwd), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("resetRenderLedger on a missing ledger is a no-op (FAIL-OPEN)", () => {
  const cwd = tmp();
  try {
    resetRenderLedger(cwd);
    assert.equal(readRenderObsRows(cwd).length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
