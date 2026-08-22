/**
 * hook-bench-compare.test.mjs - wp10: the perf gate compares PER HOOK.
 *
 * A trim that helps one hook and hurts another nets to noise in a total, so a
 * total-only comparison would let a real regression ship.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareReports } from "../scripts/hook-bench-compare.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const compareScript = resolve(here, "..", "scripts", "hook-bench-compare.mjs");

function report(hooks, spawnFloorP50 = 50) {
  return {
    schemaVersion: 1,
    platform: "linux",
    iterations: 25,
    spawnFloorMs: { p50: spawnFloorP50, p95: spawnFloorP50 + 5 },
    hooks: hooks.map((h) => ({
      name: h.name,
      event: h.event || "PreToolUse",
      warmP50Ms: spawnFloorP50 + h.above,
      aboveFloorMs: h.above,
    })),
  };
}

function runCompare(before, after, pct) {
  const dir = mkdtempSync(join(tmpdir(), "cxc-cmp-"));
  try {
    const beforePath = join(dir, "before.json");
    const afterPath = join(dir, "after.json");
    writeFileSync(beforePath, JSON.stringify(before), "utf8");
    writeFileSync(afterPath, JSON.stringify(after), "utf8");
    return spawnSync(process.execPath, [compareScript, beforePath, afterPath, "--max-regression-pct", String(pct)], {
      encoding: "utf8",
      timeout: 30000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("an identical report compares clean", () => {
  const r = report([{ name: "guard", above: 10 }, { name: "capture", above: 4 }]);
  const res = runCompare(r, r, 10);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test("a 50% per-hook regression fails at threshold 10 and passes at 60", () => {
  const before = report([{ name: "guard", above: 10 }]);
  const after = report([{ name: "guard", above: 15 }]);
  assert.equal(runCompare(before, after, 10).status, 1);
  assert.equal(runCompare(before, after, 60).status, 0);
});

test("a regression in one hook fails even when the TOTAL improved", () => {
  const before = report([{ name: "guard", above: 10 }, { name: "capture", above: 40 }]);
  // total: 50 -> 26, a clear win, but the guard doubled.
  const after = report([{ name: "guard", above: 20 }, { name: "capture", above: 6 }]);
  const res = runCompare(before, after, 10);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout, /REGRESSION: guard/);
});

test("a hook present in before and absent in after is a failure, not a silent pass", () => {
  const before = report([{ name: "guard", above: 10 }, { name: "capture", above: 4 }]);
  const after = report([{ name: "guard", above: 10 }]);
  const res = runCompare(before, after, 10);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout, /MISSING IN AFTER: capture/);
});

test("comparison uses aboveFloorMs, not wall time", () => {
  // Same hook cost above the floor, wildly different process-creation cost:
  // this is the Windows-vs-Linux case and it must compare clean.
  const before = report([{ name: "guard", above: 10 }], 5);
  const after = report([{ name: "guard", above: 10 }], 95);
  const res = runCompare(before, after, 0);
  assert.equal(res.status, 0, res.stdout);
  const result = compareReports(before, after, 0);
  assert.equal(result.rows[0].deltaMs, 0);
  assert.equal(result.rows[0].source, "aboveFloorMs");
});
