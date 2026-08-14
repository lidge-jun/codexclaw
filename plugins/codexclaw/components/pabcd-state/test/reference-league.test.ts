/**
 * reference-league.test.ts — benchmark framework tests (issue #19).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateManifest,
  computeLeagueReport,
  MANIFEST_SCHEMA_VERSION,
  type BenchmarkManifest,
} from "../src/reference-league.ts";

function makeManifest(overrides: Partial<BenchmarkManifest> = {}): BenchmarkManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    createdAt: "2026-08-15T00:00:00Z",
    repositories: [
      { id: "ts-cli", name: "TypeScript CLI", category: "typescript-cli", source: { type: "fixture", path: "fixtures/ts-cli" } },
    ],
    tasks: [
      { id: "task-1", prompt: "Fix the bug", verifier: "npm test", expectedClass: "C1", targetRepos: ["ts-cli"] },
    ],
    harnesses: [
      { name: "bare-codex", invocation: "codex", available: true },
      { name: "codexclaw", invocation: "cxc", available: true },
    ],
    results: [],
    ...overrides,
  };
}

test("validateManifest: valid manifest returns no errors", () => {
  assert.deepEqual(validateManifest(makeManifest()), []);
});

test("validateManifest: null returns error", () => {
  assert.ok(validateManifest(null).length > 0);
});

test("validateManifest: wrong schema version returns error", () => {
  assert.ok(validateManifest(makeManifest({ schemaVersion: 99 } as any)).some(e => e.includes("schemaVersion")));
});

test("validateManifest: missing arrays return errors", () => {
  const errors = validateManifest({ schemaVersion: MANIFEST_SCHEMA_VERSION });
  assert.ok(errors.some(e => e.includes("repositories")));
  assert.ok(errors.some(e => e.includes("tasks")));
});

test("computeLeagueReport: empty results", () => {
  const report = computeLeagueReport(makeManifest());
  assert.deepEqual(report.harnessScores, {});
  assert.deepEqual(report.taskSummary, {});
});

test("computeLeagueReport: computes rates correctly", () => {
  const manifest = makeManifest({
    results: [
      { taskId: "t1", repoId: "r1", harness: "codexclaw", runNumber: 1, verifierPassed: true, userIntervention: false, modelConfig: { model: "gpt-5.5" }, timestamp: "2026-08-15" },
      { taskId: "t1", repoId: "r1", harness: "codexclaw", runNumber: 2, verifierPassed: true, userIntervention: false, modelConfig: { model: "gpt-5.5" }, timestamp: "2026-08-15" },
      { taskId: "t1", repoId: "r1", harness: "bare-codex", runNumber: 1, verifierPassed: false, userIntervention: true, modelConfig: { model: "gpt-5.5" }, timestamp: "2026-08-15" },
    ],
  });
  const report = computeLeagueReport(manifest);
  assert.equal(report.harnessScores["codexclaw"].rate, 1.0);
  assert.equal(report.harnessScores["bare-codex"].rate, 0.0);
  assert.equal(report.taskSummary["t1"].bestHarness, "codexclaw");
});

test("MANIFEST_SCHEMA_VERSION is 1", () => {
  assert.equal(MANIFEST_SCHEMA_VERSION, 1);
});

