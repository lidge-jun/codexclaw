import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOALPLAN_FILE,
  advanceWorkPhase,
  buildGoalplan,
  effectiveActiveWorkPhaseId,
  goalplanDefinitionIntegrityReasons,
  goalplanDir,
  nextOpenTask,
  readGoalplanDetailed,
  validateGoalplan,
  type Goalplan,
  type GoalplanTask,
} from "../src/goalplan.ts";

type NormalizedField = "criteria-shape" | "other-shape";

type NormalizedParserResult =
  | { kind: "parsed" }
  | { kind: "absent" | "unreadable" | "invalid-json" }
  | { kind: "invalid-shape"; field: NormalizedField };

type FixtureAlias = `fixture-${number}`;

interface GoalplanBaselineManifestEntry {
  ordinal: number;
  alias: FixtureAlias;
  sourceClass: "normal" | "legacy-text-criterion";
  expected: NormalizedParserResult;
}

interface GoalplanBaselineFixture extends GoalplanBaselineManifestEntry {
  plan: Record<string, unknown>;
}

interface GoalplanBaselineSnapshot {
  measuredOn: "2026-08-29";
  sourceCount: number;
  manifest: GoalplanBaselineManifestEntry[];
  fixtures: GoalplanBaselineFixture[];
}

const here = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(
  readFileSync(join(here, "fixtures", "goalplans-pre-change-baseline.json"), "utf8"),
) as GoalplanBaselineSnapshot;

function normalize(result: ReturnType<typeof readGoalplanDetailed>): NormalizedParserResult {
  if (result.plan && result.diagnostic === null) return { kind: "parsed" };
  assert.ok(result.diagnostic);
  return result.diagnostic.kind === "invalid-shape"
    ? {
        kind: result.diagnostic.kind,
        field: result.diagnostic.field === "criteria[] entries (each needs scenario/expectedEvidence/status)"
          ? "criteria-shape"
          : "other-shape",
      }
    : { kind: result.diagnostic.kind };
}

test("wp7 corpus keeps the pre-change parser result set", () => {
  assert.equal(snapshot.sourceCount, snapshot.manifest.length);
  assert.equal(snapshot.fixtures.length, snapshot.manifest.length);
  // 감사 라운드 1: 아래 deepEqual은 manifest를 자기 자신과 비교하므로 manifest가 축소되면 축소된
  // 채로 동등해진다. 감사관이 legacy 1건만 남기고 재번호한 baseline에서 3건 전부 통과를 실측했다.
  // 개수를 박지 않고 하한만 둔다 — corpus가 정상 항목을 하나도 안 갖는 상태는 회귀 대상이 아니라
  // baseline이 망가진 상태다.
  // 라운드 2: sourceClass만 보는 하한은 manifest 전부를 invalid-shape로 바꾼 변이를 통과시켰다.
  // 실측 출력 {"allInvalidWithNormalAndLegacy":"pass","parsed":0}. parsed와 normal을 한 항목에서
  // 함께 요구하면 그 변이가 RED가 된다. 실제 fixture에 normal+parsed 쌍이 90건이라 하한은 넉넉하다.
  assert.ok(snapshot.manifest.length > 1, JSON.stringify({ manifest: snapshot.manifest.length }));
  assert.ok(
    snapshot.manifest.some((entry) => entry.sourceClass === "normal" && entry.expected.kind === "parsed"),
    "corpus must keep at least one parsed normal fixture",
  );
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-goalplan-regression-"));
  try {
    for (const fixture of snapshot.fixtures) {
      const dir = goalplanDir(cwd, fixture.alias);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, GOALPLAN_FILE), `${JSON.stringify(fixture.plan, null, 2)}\n`);
    }
    const actual = snapshot.fixtures.map((fixture) => ({
      ordinal: fixture.ordinal,
      alias: fixture.alias,
      sourceClass: fixture.sourceClass,
      expected: normalize(readGoalplanDetailed(cwd, fixture.alias)),
    }));
    assert.deepEqual(actual, snapshot.manifest);
    const legacy = snapshot.fixtures.find((fixture) => fixture.sourceClass === "legacy-text-criterion");
    assert.ok(legacy);
    assert.deepEqual(
      actual.find((entry) => entry.alias === legacy.alias)?.expected,
      { kind: "invalid-shape", field: "criteria-shape" },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function legacyPlan(schemaVersion: undefined | 2): Goalplan {
  const plan = buildGoalplan({ objective: `legacy selector ${schemaVersion ?? 1}` });
  if (schemaVersion === undefined) delete plan.schemaVersion;
  else plan.schemaVersion = schemaVersion;
  plan.workPhases = [
    { id: "wp-a", title: "A", status: "pending", tasks: [{ id: "a1", title: "A1", status: "pending" }], criteriaIds: [] },
    { id: "wp-b", title: "B", status: "in_progress", tasks: [{ id: "b1", title: "B1", status: "done" }], criteriaIds: [] },
    { id: "wp-c", title: "C", status: "pending", tasks: [{ id: "c1", title: "C1", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "ghost";
  return plan;
}

function oldNextOpenTask(plan: Goalplan): { workPhaseId: string; taskId: string } | null {
  for (const phase of plan.workPhases) {
    if (phase.status === "done" || phase.status === "blocked" || phase.status === "superseded") continue;
    for (const task of phase.tasks) {
      if (task.status !== "done") return { workPhaseId: phase.id, taskId: task.id };
    }
  }
  return null;
}

function oldEffectiveActiveWorkPhaseId(plan: Goalplan): string | null {
  const explicit = plan.workPhases.find((phase) => phase.id === plan.activeWorkPhaseId);
  if (explicit && explicit.status !== "done" && explicit.status !== "blocked" && explicit.status !== "superseded") return explicit.id;
  return plan.workPhases.find((phase) => phase.status === "in_progress")?.id
    ?? plan.workPhases.find((phase) => phase.status === "pending")?.id
    ?? null;
}

function oldAdvanceSummary(plan: Goalplan) {
  const currentId = oldEffectiveActiveWorkPhaseId(plan);
  if (!currentId) return { kind: "no_active" as const };
  const currentIndex = plan.workPhases.findIndex((phase) => phase.id === currentId);
  const current = plan.workPhases[currentIndex];
  const pendingTasks = current.tasks.filter((task) => task.status !== "done");
  if (pendingTasks.length > 0) {
    return { kind: "tasks_pending" as const, workPhaseId: current.id, taskIds: pendingTasks.map((task) => task.id) };
  }
  const after = plan.workPhases.slice(currentIndex + 1).find((phase) => phase.status === "pending");
  const next = after ?? plan.workPhases.slice(0, currentIndex).find((phase) => phase.status === "pending");
  return {
    kind: "ok" as const,
    closedId: current.id,
    activeWorkPhaseId: next?.id ?? null,
    statuses: plan.workPhases.map((phase) => phase.id === current.id
      ? "done"
      : phase.id === next?.id ? "in_progress" : phase.status),
    taskStatuses: plan.workPhases.map((phase) => phase.tasks.map((task) => task.status)),
  };
}

function newAdvanceSummary(plan: Goalplan) {
  const result = advanceWorkPhase(plan);
  if (result.kind === "no_active") return { kind: "no_active" as const };
  if (result.kind === "tasks_pending") {
    return { kind: result.kind, workPhaseId: result.workPhaseId, taskIds: result.pending.map((task) => task.id) };
  }
  return {
    kind: result.kind,
    closedId: result.closedId,
    activeWorkPhaseId: result.plan.activeWorkPhaseId,
    statuses: result.plan.workPhases.map((phase) => phase.status),
    taskStatuses: result.plan.workPhases.map((phase) => phase.tasks.map((task) => task.status)),
  };
}

test("wp7 compat keeps v1 and v2 selector results when dependency fields are absent", () => {
  for (const schemaVersion of [undefined, 2] as const) {
    const plan = legacyPlan(schemaVersion);
    assert.equal(plan.workPhases.some((phase) => "dependsOn" in phase), false);
    assert.equal(plan.workPhases.some((phase) => phase.tasks.some((task) => "dependsOn" in task)), false);
    const selected = nextOpenTask(plan);
    assert.deepEqual(
      selected && { workPhaseId: selected.wp.id, taskId: selected.task.id },
      oldNextOpenTask(plan),
    );
    assert.equal(effectiveActiveWorkPhaseId(plan), oldEffectiveActiveWorkPhaseId(plan));
    assert.deepEqual(newAdvanceSummary(plan), oldAdvanceSummary(plan));

    plan.activeWorkPhaseId = "wp-a";
    assert.equal(effectiveActiveWorkPhaseId(plan), "wp-a");
    plan.activeWorkPhaseId = null;
    plan.workPhases[1].status = "done";
    assert.equal(effectiveActiveWorkPhaseId(plan), "wp-a");
  }
});

function outcomePlan(schemaVersion: undefined | 2 | 3, task: GoalplanTask): Goalplan {
  const plan = buildGoalplan({ objective: `outcome validation ${schemaVersion ?? 1}` });
  if (schemaVersion === undefined) delete plan.schemaVersion;
  else plan.schemaVersion = schemaVersion;
  plan.workPhases = [{ id: "wp1", title: "one", status: "done", tasks: [task], criteriaIds: [] }];
  plan.activeWorkPhaseId = null;
  return plan;
}

test("wp7 outcome validation starts at schema v3 and is not a selector version branch", () => {
  // 260830: the new-plan default is now v1, so this exemption is what keeps a plan
  // written before the rule existed completable. Making it version-independent was
  // tried and reverted — see the comment at goalplan.ts:1304.
  for (const schemaVersion of [undefined, 2] as const) {
    const legacy = outcomePlan(schemaVersion, { id: "t1", title: "done legacy task", status: "done" });
    assert.deepEqual(goalplanDefinitionIntegrityReasons(legacy).filter((reason) => reason.includes("outcome")), []);
    assert.equal(validateGoalplan(legacy).reasons.some((reason) => reason.includes("outcome")), false);
  }

  const missing = outcomePlan(3, { id: "t1", title: "done v3 task", status: "done" });
  assert.deepEqual(
    goalplanDefinitionIntegrityReasons(missing).filter((reason) => reason.includes("outcome")),
    ["task wp1/t1 is done but has no non-empty outcome"],
  );
  assert.equal(
    validateGoalplan(missing).reasons.includes("task wp1/t1 is done but has no non-empty outcome"),
    true,
  );

  const premature = outcomePlan(3, {
    id: "t1", title: "pending v3 task", status: "pending", outcome: "must not exist yet",
  });
  premature.workPhases[0].status = "in_progress";
  assert.deepEqual(
    goalplanDefinitionIntegrityReasons(premature).filter((reason) => reason.includes("outcome")),
    ["task wp1/t1 is pending but has outcome"],
  );
  assert.equal(
    validateGoalplan(premature).reasons.includes("task wp1/t1 is pending but has outcome"),
    true,
  );

  const valid = outcomePlan(3, { id: "t1", title: "done v3 task", status: "done", outcome: "tests: 12 passed" });
  assert.deepEqual(goalplanDefinitionIntegrityReasons(valid).filter((reason) => reason.includes("outcome")), []);
  assert.equal(validateGoalplan(valid).reasons.some((reason) => reason.includes("outcome")), false);
});
