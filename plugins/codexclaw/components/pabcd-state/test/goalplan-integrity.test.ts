import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGoalplan,
  goalplanDefinitionIntegrityReasons,
  goalplanDependencyCompletionReasons,
  validateGoalplan,
  type Goalplan,
  type GoalplanWorkPhase,
} from "../src/goalplan.ts";

function planWith(workPhases: GoalplanWorkPhase[], schemaVersion = 3): Goalplan {
  const plan = buildGoalplan({ objective: "integrity fixture" });
  plan.schemaVersion = schemaVersion;
  plan.workPhases = workPhases;
  plan.criteria = [];
  return plan;
}

test("definition integrity: work-phase dangling and self dependencies name exact reasons", () => {
  const dangling = planWith([
    { id: "wp-b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["ghost"] },
  ]);
  const self = planWith([
    { id: "wp-a", title: "a", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["wp-a"] },
  ]);

  const danglingReasons = goalplanDefinitionIntegrityReasons(dangling);
  const selfReasons = goalplanDefinitionIntegrityReasons(self);

  assert.deepEqual(danglingReasons, ["work phase wp-b depends on unknown work phase 'ghost'"]);
  assert.deepEqual(selfReasons, ["work phase wp-a depends on itself"]);
  assert.equal(selfReasons.some((reason) => reason.includes("dependency cycle")), false);
});

test("definition integrity: work-phase cycle reports a closed deterministic path", () => {
  const plan = planWith([
    { id: "b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
    { id: "a", title: "a", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["b"] },
  ]);

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, ["work phase dependency cycle: a -> b -> a"]);
});

test("definition integrity: task dependency is phase-local", () => {
  const plan = planWith([
    { id: "wp-a", title: "a", status: "pending", tasks: [
      { id: "shared", title: "shared a", status: "pending" },
      { id: "only-in-a", title: "only a", status: "pending" },
    ], criteriaIds: [] },
    { id: "wp-b", title: "b", status: "pending", tasks: [
      { id: "shared", title: "shared b", status: "pending" },
      { id: "leaf", title: "leaf", status: "pending", dependsOn: ["shared", "only-in-a"] },
    ], criteriaIds: [] },
  ]);

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, [
    "task wp-b/leaf depends on unknown task 'only-in-a' in the same work phase",
  ]);
  assert.equal(reasons.some((reason) => reason.includes("duplicate task id 'shared'")), false);
});

test("definition integrity: task self edge and cycle have distinct reasons", () => {
  const self = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "a", title: "a", status: "pending", dependsOn: ["a"] },
  ], criteriaIds: [] }]);
  const cycle = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "b", title: "b", status: "pending", dependsOn: ["a"] },
    { id: "a", title: "a", status: "pending", dependsOn: ["b"] },
  ], criteriaIds: [] }]);

  const selfReasons = goalplanDefinitionIntegrityReasons(self);
  const cycleReasons = goalplanDefinitionIntegrityReasons(cycle);

  assert.deepEqual(selfReasons, ["task wp-a/a depends on itself"]);
  assert.deepEqual(cycleReasons, ["task dependency cycle in work phase wp-a: a -> b -> a"]);
});

test("definition integrity: duplicate ids and dangling criteria use their authority scopes", () => {
  const plan = planWith([
    { id: "wp-a", title: "a1", status: "pending", tasks: [
      { id: "dup-task", title: "one", status: "pending" },
      { id: "dup-task", title: "two", status: "pending" },
    ], criteriaIds: ["missing-criterion"] },
    { id: "wp-a", title: "a2", status: "pending", tasks: [
      { id: "dup-task", title: "other phase", status: "pending" },
    ], criteriaIds: [] },
  ]);
  plan.criteria = [
    { id: "c-dup", scenario: "one", expectedEvidence: "one", capturedEvidence: null, status: "open" },
    { id: "c-dup", scenario: "two", expectedEvidence: "two", capturedEvidence: null, status: "open" },
  ];

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, [
    "duplicate work phase id 'wp-a' makes dependency references ambiguous",
    "work phase wp-a has duplicate task id 'dup-task', so task dependency references are ambiguous",
    "duplicate criterion id 'c-dup' makes criteriaIds references ambiguous",
    "work phase wp-a references unknown criterion 'missing-criterion'",
  ]);
});

test("completion integrity: done phase rejects each non-done dependency status", () => {
  for (const status of ["pending", "in_progress", "blocked", "superseded"] as const) {
    const plan = planWith([
      { id: "base", title: "base", status, tasks: [], criteriaIds: [] },
      { id: "leaf", title: "leaf", status: "done", tasks: [], criteriaIds: [], dependsOn: ["base"] },
    ]);

    const reasons = goalplanDependencyCompletionReasons(plan);

    assert.deepEqual(reasons, [
      "work phase leaf is done while dependency work phase(s) are not done: base",
    ], status);
  }
  const done = planWith([
    { id: "base", title: "base", status: "done", tasks: [], criteriaIds: [] },
    { id: "leaf", title: "leaf", status: "done", tasks: [], criteriaIds: [], dependsOn: ["base"] },
  ]);
  assert.deepEqual(goalplanDependencyCompletionReasons(done), []);
});

test("completion integrity: done task reads dependencies from its own phase", () => {
  const plan = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "base", title: "base", status: "pending" },
    { id: "leaf", title: "leaf", status: "done", outcome: "leaf finished", dependsOn: ["base"] },
  ], criteriaIds: [] }]);

  const pendingReasons = goalplanDependencyCompletionReasons(plan);
  plan.workPhases[0].tasks[0] = {
    ...plan.workPhases[0].tasks[0], status: "done", outcome: "base finished",
  };
  const doneReasons = goalplanDependencyCompletionReasons(plan);

  assert.deepEqual(pendingReasons, [
    "task wp-a/leaf is done while dependency task(s) are not done: base",
  ]);
  assert.deepEqual(doneReasons, []);
});

test("definition integrity: schema v3 enforces done and pending outcome states", () => {
  const plan = planWith([{ id: "wp-a", title: "a", status: "pending", tasks: [
    { id: "done-missing", title: "done", status: "done" },
    { id: "done-blank", title: "blank", status: "done", outcome: "   " },
    { id: "pending-present", title: "pending", status: "pending", outcome: "premature" },
    { id: "done-valid", title: "valid", status: "done", outcome: "node --test: 8 pass, 0 fail" },
  ], criteriaIds: [] }]);

  const reasons = goalplanDefinitionIntegrityReasons(plan);

  assert.deepEqual(reasons, [
    "task wp-a/done-missing is done but has no non-empty outcome",
    "task wp-a/done-blank is done but has no non-empty outcome",
    "task wp-a/pending-present is pending but has outcome",
  ]);
});

test("definition integrity: schema v1 and v2 allow legacy done tasks without outcome", () => {
  for (const schemaVersion of [1, 2]) {
    const plan = planWith([{ id: "wp-a", title: "legacy", status: "done", tasks: [
      { id: "legacy-done", title: "done before v3", status: "done" },
    ], criteriaIds: [] }], schemaVersion);

    const reasons = goalplanDefinitionIntegrityReasons(plan);

    assert.deepEqual(reasons, [], `schemaVersion ${schemaVersion}`);
  }
});

test("validateGoalplan places definition and completion reasons first", () => {
  const plan = planWith([
    { id: "base", title: "base", status: "pending", tasks: [], criteriaIds: [] },
    { id: "leaf", title: "leaf", status: "done", tasks: [
      { id: "done-missing", title: "done", status: "done" },
    ], criteriaIds: [], dependsOn: ["base"] },
  ]);

  const verdict = validateGoalplan(plan);

  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.reasons.slice(0, 2), [
    "task leaf/done-missing is done but has no non-empty outcome",
    "work phase leaf is done while dependency work phase(s) are not done: base",
  ]);
});

test("a joining DAG is not a cycle at either layer", () => {
  // 감사 라운드 1 BLOCKER 2: 기존 cycle 테스트는 2-node 순환만 봐서
  // findDependencyCycle()의 visited 재방문 분기(합류 지점)를 아무도 밟지 않았다.
  // diamond는 d를 두 경로로 두 번 만나므로 그 분기를 정확히 통과한다.
  const plan = planWith([
    { id: "a", title: "a", status: "pending", tasks: [], criteriaIds: [] },
    { id: "b", title: "b", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
    { id: "c", title: "c", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["a"] },
    { id: "d", title: "d", status: "pending", tasks: [], criteriaIds: [], dependsOn: ["b", "c"] },
    { id: "solo", title: "disconnected", status: "pending", tasks: [
      { id: "t-a", title: "a", status: "pending" },
      { id: "t-b", title: "b", status: "pending", dependsOn: ["t-a"] },
      { id: "t-c", title: "c", status: "pending", dependsOn: ["t-a"] },
      { id: "t-d", title: "d", status: "pending", dependsOn: ["t-b", "t-c"] },
    ], criteriaIds: [] },
  ]);

  assert.deepEqual(goalplanDefinitionIntegrityReasons(plan), []);
});

test("a repeated dependency reference is reported once, leaving room for other reasons", () => {
  // 감사 라운드 1 BLOCKER 1: raw 배열을 순회하면 같은 dangling 문장이 네 번 나와
  // goal-gate의 slice(0, 4)가 한 진단으로 소진된다. 중복은 첫 등장만 남는다.
  const plan = planWith([
    { id: "wp-1", title: "phase", status: "pending", tasks: [
      { id: "t-1", title: "task", status: "pending", outcome: "premature" },
    ], criteriaIds: ["c-missing"], dependsOn: ["ghost", "ghost", "ghost", "ghost"] },
  ]);

  assert.deepEqual(goalplanDefinitionIntegrityReasons(plan), [
    "work phase wp-1 depends on unknown work phase 'ghost'",
    "task wp-1/t-1 is pending but has outcome",
    "work phase wp-1 references unknown criterion 'c-missing'",
  ]);
});
