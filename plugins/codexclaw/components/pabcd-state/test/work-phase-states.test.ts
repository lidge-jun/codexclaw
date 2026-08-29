/**
 * blocked / superseded work-phase states (WP15 / plan 091).
 *
 * The mutation ops that produce these states are a later slice, so the states
 * are built as fixtures here. The read side has to be right first: shipping an
 * op that creates a state the helpers mishandle would produce data the loop
 * then reasons about incorrectly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  advanceWorkPhase,
  buildGoalplan,
  effectiveActiveWorkPhaseId,
  goalplanDir,
  nextOpenTask,
  readGoalplan,
  remainingWorkPhases,
  validateGoalplan,
  writeGoalplan,
  type Goalplan,
  type GoalplanWorkPhase,
  type WorkPhaseStatus,
} from "../src/goalplan.ts";

function phase(id: string, status: WorkPhaseStatus, over: Partial<GoalplanWorkPhase> = {}): GoalplanWorkPhase {
  return { id, title: `phase ${id}`, status, tasks: [], criteriaIds: [], ...over };
}

function plan(workPhases: GoalplanWorkPhase[], over: Partial<Goalplan> = {}): Goalplan {
  // schemaVersion 1 keeps these tests about work-phase state transitions: since wp2
  // (260829) buildGoalplan() declares v3, whose final-gate rule would add unrelated
  // reasons to every validateGoalplan() assertion here.
  return { ...buildGoalplan({ objective: "work phase states" }), schemaVersion: 1, workPhases, ...over };
}

const OPEN_TASK = { tasks: [{ id: "t1", title: "t", status: "pending" as const }] };

// ── remaining work ──

test("superseded leaves the remaining work; blocked stays in it", () => {
  const p = plan([phase("a", "done"), phase("b", "blocked"), phase("c", "superseded", { supersededBy: "d" }), phase("d", "pending")]);
  assert.deepEqual(remainingWorkPhases(p).map((wp) => wp.id), ["b", "d"]);
});

test("a blocked phase keeps the goal open", () => {
  const p = plan([phase("a", "blocked", { blockedReason: "waiting on an upstream release" })]);
  const v = validateGoalplan(p);
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(" "), /1 work phase\(s\) not done: a/);
});

test("a plan whose only unfinished phase is superseded can complete", () => {
  const p = plan([phase("a", "done"), phase("b", "superseded", { supersededBy: "a" })]);
  const v = validateGoalplan(p);
  assert.equal(v.ok, true, v.reasons.join("; "));
});

// ── supersededBy integrity ──

test("a superseded phase must name what replaced it", () => {
  const p = plan([phase("a", "done"), phase("b", "superseded")]);
  assert.match(validateGoalplan(p).reasons.join(" "), /does not name what replaced it/);
});

test("a phase cannot supersede itself", () => {
  const p = plan([phase("a", "done"), phase("b", "superseded", { supersededBy: "b" })]);
  assert.match(validateGoalplan(p).reasons.join(" "), /supersede itself/);
});

test("the replacement must exist in the plan", () => {
  const p = plan([phase("a", "done"), phase("b", "superseded", { supersededBy: "ghost" })]);
  assert.match(validateGoalplan(p).reasons.join(" "), /not in this plan/);
});

test("the replacement cannot itself be superseded, which also rules out cycles", () => {
  const p = plan([
    phase("a", "superseded", { supersededBy: "b" }),
    phase("b", "superseded", { supersededBy: "a" }),
  ]);
  const reasons = validateGoalplan(p).reasons.join(" ");
  assert.match(reasons, /itself superseded/);
});

test("a well-formed supersede passes integrity", () => {
  const p = plan([phase("a", "done"), phase("b", "superseded", { supersededBy: "a" })]);
  assert.equal(validateGoalplan(p).ok, true, validateGoalplan(p).reasons.join("; "));
});

// ── next open task ──

test("a superseded phase does not offer the next task", () => {
  const p = plan([phase("a", "superseded", { supersededBy: "b", ...OPEN_TASK }), phase("b", "pending", OPEN_TASK)]);
  assert.equal(nextOpenTask(p)?.wp.id, "b");
});

test("a blocked phase does not offer the next task either", () => {
  const p = plan([phase("a", "blocked", { blockedReason: "x", ...OPEN_TASK }), phase("b", "pending", OPEN_TASK)]);
  assert.equal(nextOpenTask(p)?.wp.id, "b");
});

test("with only blocked and superseded phases there is no next task", () => {
  const p = plan([phase("a", "blocked", OPEN_TASK), phase("b", "superseded", { supersededBy: "a", ...OPEN_TASK })]);
  assert.equal(nextOpenTask(p), null);
});

// ── effective cursor ──

test("a cursor pointing at a blocked phase falls through to the next workable one", () => {
  const p = plan([phase("a", "blocked"), phase("b", "pending")], { activeWorkPhaseId: "a" });
  assert.equal(effectiveActiveWorkPhaseId(p), "b");
});

test("a cursor pointing at a superseded phase does the same", () => {
  const p = plan([phase("a", "superseded", { supersededBy: "b" }), phase("b", "in_progress")], { activeWorkPhaseId: "a" });
  assert.equal(effectiveActiveWorkPhaseId(p), "b");
});

test("with nothing workable the cursor resolves to null", () => {
  const p = plan([phase("a", "blocked"), phase("b", "superseded", { supersededBy: "a" })], { activeWorkPhaseId: "a" });
  assert.equal(effectiveActiveWorkPhaseId(p), null);
});

// ── advance ──

test("advancing past a blocked cursor closes the next phase, not the blocked one", () => {
  const p = plan([phase("a", "blocked", { blockedReason: "x" }), phase("b", "pending")], { activeWorkPhaseId: "a" });
  const advanced = advanceWorkPhase(p);
  assert.equal(advanced.kind, "ok");
  const next = (advanced as { kind: "ok"; plan: Goalplan }).plan;
  assert.equal(next.workPhases.find((wp) => wp.id === "a")?.status, "blocked", "a blocked phase must never become done");
  assert.equal(next.workPhases.find((wp) => wp.id === "b")?.status, "done");
});

test("advancing past a superseded cursor behaves the same", () => {
  const p = plan([phase("a", "superseded", { supersededBy: "b" }), phase("b", "pending")], { activeWorkPhaseId: "a" });
  const advanced = advanceWorkPhase(p);
  assert.equal(advanced.kind, "ok");
  const next = (advanced as { kind: "ok"; plan: Goalplan }).plan;
  assert.equal(next.workPhases.find((wp) => wp.id === "a")?.status, "superseded");
  assert.equal(next.workPhases.find((wp) => wp.id === "b")?.status, "done");
});

test("with every phase blocked or superseded there is nothing to advance", () => {
  const p = plan([phase("a", "blocked"), phase("b", "superseded", { supersededBy: "a" })], { activeWorkPhaseId: "a" });
  assert.equal(advanceWorkPhase(p).kind, "no_active");
});

// ── persistence ──

function roundTrip(p: Goalplan): Goalplan | null {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-wps-"));
  writeGoalplan(cwd, p);
  return readGoalplan(cwd, p.slug);
}

test("the new states and their fields survive a write/read round trip", () => {
  const p = plan([
    phase("a", "blocked", { blockedReason: "waiting on vendor" }),
    phase("b", "superseded", { supersededBy: "a" }),
  ]);
  const back = roundTrip(p);
  assert.equal(back?.workPhases[0]?.status, "blocked");
  assert.equal(back?.workPhases[0]?.blockedReason, "waiting on vendor");
  assert.equal(back?.workPhases[1]?.status, "superseded");
  assert.equal(back?.workPhases[1]?.supersededBy, "a");
});

test("an unrecognized status still degrades to pending", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-wps-"));
  const p = plan([phase("a", "pending")]);
  writeGoalplan(cwd, p);
  const file = join(goalplanDir(cwd, p.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  (raw.workPhases as Record<string, unknown>[])[0].status = "abandoned";
  writeFileSync(file, JSON.stringify(raw));
  assert.equal(readGoalplan(cwd, p.slug)?.workPhases[0]?.status, "pending");
});

test("a hand-edited superseded phase cannot buy completion", () => {
  // The path the integrity check exists for: mark the phase superseded in the
  // file and leave supersededBy off, hoping it just drops out of the count.
  const cwd = mkdtempSync(join(tmpdir(), "cxc-wps-"));
  const p = plan([phase("a", "done"), phase("b", "pending")]);
  writeGoalplan(cwd, p);
  const file = join(goalplanDir(cwd, p.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  (raw.workPhases as Record<string, unknown>[])[1].status = "superseded";
  writeFileSync(file, JSON.stringify(raw));

  const back = readGoalplan(cwd, p.slug);
  assert.ok(back);
  assert.equal(remainingWorkPhases(back).length, 0, "it does leave the remaining count");
  assert.equal(validateGoalplan(back).ok, false, "but completion is still refused");
  assert.match(validateGoalplan(back).reasons.join(" "), /does not name what replaced it/);
});

test("a legacy plan with only the original three statuses is unaffected", () => {
  const p = plan([phase("a", "done"), phase("b", "in_progress"), phase("c", "pending")]);
  const back = roundTrip(p);
  assert.deepEqual(back?.workPhases.map((wp) => wp.status), ["done", "in_progress", "pending"]);
  assert.deepEqual(remainingWorkPhases(back as Goalplan).map((wp) => wp.id), ["b", "c"]);
});
