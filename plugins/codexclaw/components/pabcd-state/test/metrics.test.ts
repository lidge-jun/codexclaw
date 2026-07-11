import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkObjectivePlateau,
  parseMetricLine,
  readExplicitObjectiveKind,
  readObjectiveKind,
  readObjectiveMetrics,
  recordMetricsFromText,
  recordObjectiveMetric,
  writeObjectiveKind,
} from "../src/metrics.ts";
import { runMetricCli } from "../src/metric-cli.ts";
import { STATE_DIR } from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-metrics-"));
}

test("recordObjectiveMetric: appends metric rows with baseline and best", () => {
  const cwd = freshCwd();
  try {
    const first = recordObjectiveMetric(cwd, {
      sessionId: "s1",
      metricName: "score",
      value: 10,
      source: "operator-entered",
      now: () => "2026-07-01T00:00:00.000Z",
    });
    const second = recordObjectiveMetric(cwd, {
      sessionId: "s1",
      metricName: "score",
      value: 12,
      source: "operator-entered",
      now: () => "2026-07-01T00:01:00.000Z",
    });
    assert.equal(first.baseline, 10);
    assert.equal(first.best, 10);
    assert.equal(second.baseline, 10);
    assert.equal(second.best, 12);
    assert.equal(readObjectiveMetrics(cwd, "s1").length, 2);
    assert.ok(existsSync(join(cwd, STATE_DIR, "metrics.jsonl")));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("objective kind: defaults satisfy, infers maximize from session metrics, explicit wins", () => {
  const cwd = freshCwd();
  try {
    assert.equal(readObjectiveKind(cwd, "s2"), "satisfy");
    writeFileSync(join(cwd, "evaluate.sh"), "#!/bin/sh\n");
    assert.equal(readObjectiveKind(cwd, "s2"), "satisfy", "a stale cwd-level harness alone must not flip a session to maximize");
    writeObjectiveKind(cwd, "s2", "satisfy");
    assert.equal(readExplicitObjectiveKind(cwd, "s2"), "satisfy");
    assert.equal(readObjectiveKind(cwd, "s2"), "satisfy");

    recordObjectiveMetric(cwd, { sessionId: "s3", metricName: "score", value: 1, source: "operator-entered" });
    assert.equal(readObjectiveKind(cwd, "s3"), "maximize");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("parseMetricLine and ingest: records METRIC name=value lines only", () => {
  const cwd = freshCwd();
  try {
    assert.deepEqual(parseMetricLine("METRIC score=12.5"), { metricName: "score", value: 12.5 });
    assert.equal(parseMetricLine("not a metric"), null);
    const records = recordMetricsFromText(cwd, {
      sessionId: "s4",
      text: "hello\nMETRIC score=2\nMETRIC win-rate=0.75\n",
      source: "evaluate.sh",
    });
    assert.equal(records.length, 2);
    assert.deepEqual(readObjectiveMetrics(cwd, "s4").map((r) => r.metricName), ["score", "win-rate"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("checkObjectivePlateau: flat/falling window arms; improving window does not", () => {
  const cwd = freshCwd();
  try {
    recordObjectiveMetric(cwd, { sessionId: "flat", metricName: "score", value: 10, source: "operator-entered" });
    recordObjectiveMetric(cwd, { sessionId: "flat", metricName: "score", value: 10, source: "operator-entered" });
    assert.equal(checkObjectivePlateau(cwd, "flat").flat, true);

    recordObjectiveMetric(cwd, { sessionId: "up", metricName: "score", value: 10, source: "operator-entered" });
    recordObjectiveMetric(cwd, { sessionId: "up", metricName: "score", value: 11, source: "operator-entered" });
    assert.equal(checkObjectivePlateau(cwd, "up").flat, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("checkObjectivePlateau: ignores metric records from earlier work phases", () => {
  const cwd = freshCwd();
  try {
    recordObjectiveMetric(cwd, {
      sessionId: "phased",
      workPhaseId: "phase-1",
      metricName: "score",
      value: 10,
      source: "operator-entered",
    });
    recordObjectiveMetric(cwd, {
      sessionId: "phased",
      workPhaseId: "phase-2",
      metricName: "score",
      value: 10,
      source: "operator-entered",
    });

    assert.deepEqual(checkObjectivePlateau(cwd, "phased"), {
      flat: false,
      metricName: "score",
      values: [10],
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("runMetricCli: record/show/kind/ingest", () => {
  const cwd = freshCwd();
  try {
    assert.equal(runMetricCli(["record", "--session", "cli", "--name", "score", "--value", "4", "--json"], cwd).code, 0);
    const show = runMetricCli(["show", "--session", "cli", "--json"], cwd);
    assert.equal(show.code, 0);
    assert.equal(JSON.parse(show.output).records.length, 1);

    const kind = runMetricCli(["kind", "--session", "cli", "satisfy", "--json"], cwd);
    assert.equal(kind.code, 0);
    assert.equal(JSON.parse(kind.output).kind, "satisfy");

    const ingest = runMetricCli(["ingest", "--session", "cli"], cwd, "METRIC score=5\n");
    assert.equal(ingest.code, 0);
    assert.match(ingest.output, /recorded 1/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
