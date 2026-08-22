/**
 * hook-bench-report.test.mjs - wp10: the bench report must be comparable across
 * platforms and runs. Cold-vs-warm and the spawn floor are what make a Windows
 * number attributable instead of just large.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeTimings, percentile, measureSpawnFloor } from "../scripts/hook-bench.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const benchScript = resolve(here, "..", "scripts", "hook-bench.mjs");

test("the report carries schemaVersion, platform, and spawnFloorMs", () => {
  if (process.platform === "win32" && process.env.CI) return;
  const result = spawnSync(process.execPath, [benchScript, "--json", "--iterations", "2"], {
    timeout: 180000,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0, (result.stderr || "").toString().slice(0, 400));
  const report = JSON.parse(result.stdout.toString());
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.platform, process.platform);
  assert.equal(typeof report.release, "string");
  assert.equal(report.nodeVersion, process.version);
  assert.equal(typeof report.spawnFloorMs.p50, "number");
  assert.equal(typeof report.spawnFloorMs.p95, "number");
  for (const hook of report.hooks) {
    assert.ok(hook.command, "hook missing command");
    assert.equal(typeof hook.coldMs, "number");
  }
});

test("cold is excluded from the warm percentiles", () => {
  // The Defender first-touch case: a 500ms scan must not become the hook's p50.
  const summary = summarizeTimings([500, 10, 10, 10], 0);
  assert.equal(summary.coldMs, 500);
  assert.equal(summary.warmP50Ms, 10);
  assert.equal(summary.warmP95Ms, 10);
});

test("aboveFloorMs can be negative and is not clamped", () => {
  // A hook faster than the floor means the floor sample was noisy. Hiding that
  // behind Math.max(0, ...) would disguise an unreliable measurement.
  const summary = summarizeTimings([100, 20, 20, 20], 30);
  assert.equal(summary.warmP50Ms, 20);
  assert.equal(summary.aboveFloorMs, -10);
});

test("a single iteration yields null warm percentiles rather than NaN", () => {
  const summary = summarizeTimings([42], 10);
  assert.equal(summary.coldMs, 42);
  assert.equal(summary.warmP50Ms, null);
  assert.equal(summary.warmP95Ms, null);
  assert.equal(summary.aboveFloorMs, null);
  assert.equal(percentile([], 50), null);
});

test("the spawn floor measures a real node process", () => {
  const floor = measureSpawnFloor(3);
  assert.equal(floor.samples, 3);
  assert.ok(floor.p50 > 0, "spawning node cannot cost zero");
  assert.ok(floor.p95 >= floor.p50);
});
