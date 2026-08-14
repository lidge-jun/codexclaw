// hook-bench smoke test — validates the benchmark harness runs and produces valid schema.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const benchScript = resolve(here, "..", "scripts", "hook-bench.mjs");

test("hook-bench produces valid JSON schema with --json --iterations 1", () => {
  // Skip on Windows CI: benchmark spawns 21 child processes, routinely times out.
  if (process.platform === "win32" && process.env.CI) return;

  const result = spawnSync("node", [benchScript, "--json", "--iterations", "1"], {
    timeout: 120000,
    cwd: "/tmp",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, "hook-bench exited non-zero: " + (result.stderr || "").toString().slice(0, 500));

  const output = result.stdout.toString();
  const report = JSON.parse(output);

  assert.equal(report.schemaVersion, 1);
  assert.equal(typeof report.timestamp, "string");
  assert.equal(report.iterations, 1);
  assert.ok(Array.isArray(report.hooks));
  assert.ok(report.hooks.length >= 15, "expected at least 15 hooks, got " + report.hooks.length);

  // Validate each entry has required fields
  for (const h of report.hooks) {
    assert.ok(h.name, "hook missing name");
    assert.ok(h.event, "hook missing event");
    assert.ok(h.category, "hook missing category");
    assert.equal(typeof h.invocations, "number");
    assert.ok(h.p50.endsWith("ms"), "p50 not formatted: " + h.p50);
    assert.ok(h.p95.endsWith("ms"), "p95 not formatted: " + h.p95);
  }

  // Verify category coverage
  const categories = new Set(report.hooks.map(h => h.category));
  assert.ok(categories.has("session-once"), "missing session-once category");
  assert.ok(categories.has("hot-path-guard"), "missing hot-path-guard category");
  assert.ok(categories.has("prompt-routing"), "missing prompt-routing category");
});
