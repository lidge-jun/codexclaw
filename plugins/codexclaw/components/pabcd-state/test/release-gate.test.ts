/**
 * release-gate.test.ts — MLB 1.0 release gate tests (issue #21).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCandidateManifest,
  isReleaseReady,
  MLB_1_0_RECEIPTS,
  CANDIDATE_SCHEMA_VERSION,
  type CandidateManifest,
} from "../src/release-gate.ts";

function makeManifest(overrides: Partial<CandidateManifest> = {}): CandidateManifest {
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    candidateSha: "abc123def456",
    version: "1.0.0",
    createdAt: "2026-08-15T00:00:00Z",
    receipts: MLB_1_0_RECEIPTS.map(r => ({ ...r, status: "present" as const, evidence: "receipt.json" })),
    platforms: [
      { platform: "ubuntu", ciPassed: true, testedSha: "abc123def456" },
      { platform: "windows", ciPassed: true, testedSha: "abc123def456" },
    ],
    scorecard: {
      "codex-native-fit": { baseline: 80, target: 80 },
      "context-economy": { baseline: 75, target: 80 },
    },
    nonGoals: ["custom edit engine", "LSP/DAP runtime", "tmux scheduler"],
    ...overrides,
  };
}

test("validateCandidateManifest: valid manifest returns no errors", () => {
  assert.deepEqual(validateCandidateManifest(makeManifest()), []);
});

test("validateCandidateManifest: null returns error", () => {
  assert.ok(validateCandidateManifest(null).length > 0);
});

test("validateCandidateManifest: missing candidateSha returns error", () => {
  assert.ok(validateCandidateManifest(makeManifest({ candidateSha: "" })).some(e => e.includes("candidateSha")));
});

test("validateCandidateManifest: wrong schemaVersion returns error", () => {
  assert.ok(validateCandidateManifest({ ...makeManifest(), schemaVersion: 99 }).some(e => e.includes("schemaVersion")));
});

test("isReleaseReady: all receipts present and 2 platforms -> ready", () => {
  const result = isReleaseReady(makeManifest());
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("isReleaseReady: missing receipt -> not ready", () => {
  const manifest = makeManifest();
  manifest.receipts[0].status = "missing";
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some(b => b.includes("missing")));
});

test("isReleaseReady: deferred receipt includes reason", () => {
  const manifest = makeManifest();
  manifest.receipts[0].status = "deferred";
  manifest.receipts[0].deferredReason = "waiting for upstream";
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some(b => b.includes("deferred") && b.includes("upstream")));
});

test("isReleaseReady: no Ubuntu -> not ready", () => {
  const manifest = makeManifest({
    platforms: [
      { platform: "windows", ciPassed: true, testedSha: "abc123def456" },
      { platform: "macos", ciPassed: true, testedSha: "abc123def456" },
    ],
  });
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some(b => b.includes("Ubuntu")));
});

test("isReleaseReady: SHA mismatch -> not ready", () => {
  const manifest = makeManifest({
    platforms: [
      { platform: "ubuntu", ciPassed: true, testedSha: "abc123def456" },
      { platform: "windows", ciPassed: true, testedSha: "different-sha" },
    ],
  });
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some(b => b.includes("different SHA")));
});

test("isReleaseReady: fewer than 2 platforms -> not ready", () => {
  const manifest = makeManifest({
    platforms: [{ platform: "ubuntu", ciPassed: true, testedSha: "abc123def456" }],
  });
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some(b => b.includes("fewer than 2")));
});

test("MLB_1_0_RECEIPTS has 9 required receipts", () => {
  assert.equal(MLB_1_0_RECEIPTS.length, 9);
  assert.ok(MLB_1_0_RECEIPTS.every(r => r.status === "missing")); // default is missing
});

test("CANDIDATE_SCHEMA_VERSION is 1", () => {
  assert.equal(CANDIDATE_SCHEMA_VERSION, 1);
});

