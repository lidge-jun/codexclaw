import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  handleRenderObservationCapture,
  handleRenderArtifactCapture,
  readRenderObsRows,
  hasRenderObservation,
  hasRenderArtifactModified,
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
import { GOALS_DB_FILENAME } from "../src/goal-active.ts";
import type { PostToolUsePayload } from "../src/hook.ts";

const nodeRequire = createRequire(import.meta.url);

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-render-obs-"));
}

function obsPayload(cwd: string, toolName: string): PostToolUsePayload {
  return {
    hook_event_name: "PostToolUse",
    session_id: "s1",
    cwd,
    tool_name: toolName,
    tool_input: {},
    tool_response: "ok",
    tool_use_id: "t1",
    turn_id: "turn1",
  };
}

function patchPayload(cwd: string, file: string): PostToolUsePayload {
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
    session_id: "s1",
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

test("readRenderObsRows: missing ledger returns []", () => {
  const cwd = tmp();
  assert.deepEqual(readRenderObsRows(cwd), []);
});

// --- renderGroundingAdvisoryForStop --------------------------------------------

test("advisory fires: phase C + artifact modified + no observation", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "index.html"));
  const result = renderGroundingAdvisoryForStop(cwd, "C");
  assert.notEqual(result, null);
  assert.ok(result!.includes("C-RENDER-GROUNDING-01"));
  assert.ok(result!.includes("Render-artifact"));
});

test("advisory does NOT fire: phase C + artifact modified + observation present", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "index.html"));
  handleRenderObservationCapture(obsPayload(cwd, "view_image"));
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C"), null);
});

test("advisory does NOT fire: phase C + no artifact modified", () => {
  const cwd = tmp();
  assert.equal(renderGroundingAdvisoryForStop(cwd, "C"), null);
});

test("advisory does NOT fire: non-C phase + artifact modified", () => {
  const cwd = tmp();
  handleRenderArtifactCapture(patchPayload(cwd, "index.html"));
  assert.equal(renderGroundingAdvisoryForStop(cwd, "B"), null);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "D"), null);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "P"), null);
  assert.equal(renderGroundingAdvisoryForStop(cwd, "IDLE"), null);
});

// --- handleStop integration: interactive session advisory -----------------------

test("handleStop: interactive session at C with render artifacts emits advisory (not block)", () => {
  const cwd = tmp();
  try {
    // Set up: active orchestration at phase C, no goal
    writeState(cwd, { ...defaultState("s-int"), phase: "C", orchestrationActive: true });
    // Record a render-artifact modification
    handleRenderArtifactCapture(patchPayload(cwd, "dashboard.html"));
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
    handleRenderArtifactCapture(patchPayload(cwd, "page.html"));
    handleRenderObservationCapture(obsPayload(cwd, "view_image"));
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
    handleRenderArtifactCapture(patchPayload(cwd, "app.tsx"));
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
