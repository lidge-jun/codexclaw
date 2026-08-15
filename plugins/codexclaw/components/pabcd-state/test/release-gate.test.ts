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
    receipts: MLB_1_0_RECEIPTS.map(r => ({
      ...r,
      status: "present" as const,
      evidence: "receipt.json",
      capturedSha: "abc123def456",
      capturedAt: "2026-08-15T00:00:00Z",
    })),
    platforms: [
      { platform: "ubuntu", ciPassed: true, testedSha: "abc123def456" },
      { platform: "windows", ciPassed: true, testedSha: "abc123def456" },
    ],
    scorecard: {
      "codex-native-fit": { baseline: 80, target: 80 },
      "context-economy": { baseline: 75, target: 80 },
    },
    nonGoals: ["custom edit engine", "LSP/DAP runtime", "tmux scheduler"],
    inventoryHash: "sha256:" + "a".repeat(64),
    testSuite: { pass: 1639, fail: 0, measuredSha: "abc123def456" },
    publishedCounts: { tests: 1639, skills: 28, hooks: 21 },
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

test("CANDIDATE_SCHEMA_VERSION is 2", () => {
  assert.equal(CANDIDATE_SCHEMA_VERSION, 2);
});


// --- v2 blocker rules (260815 release train) -------------------------------
//
// Each of these is a way a release could previously claim readiness on evidence
// that did not describe the commit being shipped.

test("v2: a present receipt without capturedSha is invalid and blocks", () => {
  const manifest = makeManifest();
  delete manifest.receipts[0].capturedSha;
  assert.ok(
    validateCandidateManifest(manifest).some((e) => e.includes("requires capturedSha")),
  );
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((b) => b.includes("carries no capturedSha")), result.blockers.join(" | "));
});

test("v2: a receipt captured on another commit is stale, not reusable", () => {
  const manifest = makeManifest();
  manifest.receipts[0].capturedSha = "0000000000";
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(
    result.blockers.some((b) => b.includes("captured on 0000000000") && b.includes("candidate is abc123def456")),
    result.blockers.join(" | "),
  );
});

test("v2: a red suite blocks the release", () => {
  const manifest = makeManifest({ testSuite: { pass: 1600, fail: 3, measuredSha: "abc123def456" } });
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((b) => b.includes("3 failure(s)")), result.blockers.join(" | "));
});

test("v2: a suite measured on another commit blocks", () => {
  const manifest = makeManifest({ testSuite: { pass: 1639, fail: 0, measuredSha: "other-sha" } });
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((b) => b.includes("test suite measured on other-sha")), result.blockers.join(" | "));
});

test("v2: missing testSuite evidence blocks", () => {
  const manifest = makeManifest();
  delete manifest.testSuite;
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((b) => b === "testSuite evidence missing"), result.blockers.join(" | "));
});

test("v2: inventory hash mismatch against the checkout blocks", () => {
  const manifest = makeManifest();
  const result = isReleaseReady(manifest, { actualInventoryHash: "sha256:" + "b".repeat(64) });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((b) => b.includes("inventory hash mismatch")), result.blockers.join(" | "));
});

test("v2: a stale public test count blocks even with a green fresh suite", () => {
  // The exact v0.1.0 failure: the suite is measured and green, but the docs still
  // advertise the old number.
  const manifest = makeManifest({ publishedCounts: { tests: 1213, skills: 28, hooks: 21 } });
  const result = isReleaseReady(manifest);
  assert.equal(result.ready, false);
  assert.ok(
    result.blockers.some((b) => b.includes("published tests=1213") && b.includes("reported 1639")),
    result.blockers.join(" | "),
  );
});

test("v2: allowDeferred permits deferred receipts but not missing ones", () => {
  const deferred = makeManifest();
  deferred.receipts[0].status = "deferred";
  deferred.receipts[0].deferredReason = "target: MLB 1.0, not required for 0.2.x";
  delete deferred.receipts[0].capturedSha;
  delete deferred.receipts[0].capturedAt;
  assert.equal(isReleaseReady(deferred).ready, false, "deferred blocks by default");
  assert.equal(isReleaseReady(deferred, { allowDeferred: true }).ready, true);

  const missing = makeManifest();
  missing.receipts[1].status = "missing";
  delete missing.receipts[1].capturedSha;
  delete missing.receipts[1].capturedAt;
  const result = isReleaseReady(missing, { allowDeferred: true });
  assert.equal(result.ready, false, "allowDeferred must not excuse a MISSING receipt");
  assert.ok(result.blockers.some((b) => b.includes("is missing")), result.blockers.join(" | "));
});

test("v2: a deferred receipt without a reason is invalid", () => {
  const manifest = makeManifest();
  manifest.receipts[0].status = "deferred";
  delete manifest.receipts[0].deferredReason;
  assert.ok(
    validateCandidateManifest(manifest).some((e) => e.includes("requires deferredReason")),
  );
});

test("v2: the published badge is compared against total tests, not passes", () => {
  // CI skips the repo-map live smoke, so `pass` is environment-dependent while the
  // badge counts TESTS. Comparing against pass made the gate refuse a correct
  // release on CI (run 31870411290: published 1659 vs pass 1658).
  const ciLike = makeManifest({
    testSuite: { pass: 1658, fail: 0, total: 1659, measuredSha: "abc123def456" },
    publishedCounts: { tests: 1659, skills: 28, hooks: 21 },
  });
  assert.equal(isReleaseReady(ciLike).ready, true, isReleaseReady(ciLike).blockers.join(" | "));

  const drifted = makeManifest({
    testSuite: { pass: 1658, fail: 0, total: 1700, measuredSha: "abc123def456" },
    publishedCounts: { tests: 1659, skills: 28, hooks: 21 },
  });
  const result = isReleaseReady(drifted);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((b) => b.includes("reported 1700")), result.blockers.join(" | "));
});
