/**
 * release-gate.test.ts — MLB 1.0 release gate tests (issue #21).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_RECEIPT_NAMES,
  RECEIPT_POLICY,
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
    // The full canonical set. wp7 made completeness a validation requirement, so a
    // fixture seeded from MLB receipts alone is no longer a valid manifest.
    receipts: CANONICAL_RECEIPT_NAMES.map((name) => ({
      name,
      source: RECEIPT_POLICY[name].requiredFrom ? "mlb" : "train",
      status: "present" as const,
      evidence: "receipt.json",
      capturedSha: "abc123def456",
      capturedAt: "2026-08-15T00:00:00Z",
      ...(RECEIPT_POLICY[name].requiredFrom ? { requiredFrom: RECEIPT_POLICY[name].requiredFrom } : {}),
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

test("v2: allowDeferred excuses nothing; scope decides, and missing never qualifies", () => {
  // SUPERSEDED BY wp7. This test originally asserted that allowDeferred waives a
  // deferred receipt. That semantics let a 1.0.0-rc.1 — classified "prerelease" and
  // therefore handed the flag — skip the nine receipts the 1.0 line is defined by.
  // The flag is now provenance only: exemption comes from requiredFrom scope alone.
  const deferred = makeManifest();
  deferred.receipts[0].status = "deferred";
  deferred.receipts[0].deferredReason = "target: MLB 1.0, not required for 0.2.x";
  delete deferred.receipts[0].capturedSha;
  delete deferred.receipts[0].capturedAt;
  assert.equal(isReleaseReady(deferred).ready, false, "deferred blocks by default");
  assert.equal(
    isReleaseReady(deferred, { allowDeferred: true }).ready,
    false,
    "a receipt that is DUE at this version blocks even with allowDeferred",
  );

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

// --- scoped receipt requirements (260815 wp7) -------------------------------
//
// v0.2.0-beta.1 shipped as a prerelease, so the releases page still showed v0.1.0
// as Latest. Cutting a stable 0.2.0 was blocked by nine MLB-1.0 receipts whose own
// deferral reasons said "not required for 0.2.x" — the prose knew, the schema did
// not. These tests pin the scoping rule in BOTH directions.

import {
  compareCore,
  isPrerelease,
  isReceiptDue,
  parseVersion,
} from "../src/release-gate.ts";

/** A manifest whose receipts are the full canonical set: train present, MLB deferred. */
function scopedManifest(version: string): CandidateManifest {
  const receipts = CANONICAL_RECEIPT_NAMES.map((name) => {
    const requiredFrom = RECEIPT_POLICY[name].requiredFrom;
    return requiredFrom
      ? { name, source: "mlb", status: "deferred" as const, deferredReason: "not required for 0.2.x", requiredFrom }
      : {
          name,
          source: "train",
          status: "present" as const,
          evidence: "run://x",
          capturedSha: "abc123def456",
          capturedAt: "2026-08-15T00:00:00Z",
        };
  });
  return makeManifest({ version, receipts });
}

test("version parsing: core, prerelease, and build metadata", () => {
  assert.deepEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3, prerelease: [] });
  assert.deepEqual(parseVersion("0.2.0-beta.1")?.prerelease, ["beta", "1"]);
  // build metadata never affects precedence and must be discarded
  assert.deepEqual(parseVersion("1.0.0+codex.20260815")?.prerelease, []);
  assert.equal(parseVersion("nonsense"), null);
  assert.equal(parseVersion(""), null);
});

test("prerelease detection ignores hyphens in build metadata", () => {
  // The workflow previously used `case $VERSION in *-*)`, which called this stable
  // version a prerelease.
  assert.equal(isPrerelease("1.0.0+build-with-hyphen"), false);
  assert.equal(isPrerelease("1.0.0-rc.1"), true);
  assert.equal(isPrerelease("0.2.0"), false);
});

test("core comparison is numeric, not lexical", () => {
  const c = (a: string, b: string) => compareCore(parseVersion(a)!, parseVersion(b)!);
  assert.ok(c("0.10.0", "0.9.0") > 0, "0.10.0 must sort above 0.9.0");
  assert.ok(c("0.2.0", "1.0.0") < 0);
  assert.equal(c("1.0.0+build", "1.0.0"), 0, "build metadata is ignored");
  // the load-bearing case: an rc of 1.0 is part of the 1.0 line
  assert.equal(c("1.0.0-rc.1", "1.0.0"), 0);
});

test("a 1.0-scoped receipt is not due before the 1.0 line", () => {
  const mlb = { name: "capability-lock", source: "#16", status: "deferred" as const, requiredFrom: "1.0.0" };
  assert.equal(isReceiptDue(mlb, "0.2.0"), false);
  assert.equal(isReceiptDue(mlb, "0.2.0-beta.1"), false);
  assert.equal(isReceiptDue(mlb, "0.10.0"), false);
});

test("a 1.0-scoped receipt IS due for the whole 1.0 line, prereleases included", () => {
  const mlb = { name: "capability-lock", source: "#16", status: "deferred" as const, requiredFrom: "1.0.0" };
  for (const v of ["1.0.0", "1.0.0-rc.1", "1.0.0-alpha", "1.0.0+build", "1.2.0", "2.0.0"]) {
    assert.equal(isReceiptDue(mlb, v), true, v + " must owe 1.0 evidence");
  }
});

test("train receipts are unscoped and always due", () => {
  const train = { name: "gate", source: "gate.mjs", status: "deferred" as const };
  assert.equal(isReceiptDue(train, "0.0.1"), true);
  assert.equal(isReceiptDue(train, "9.9.9"), true);
});

test("a malformed candidate version fails closed: everything is due", () => {
  const mlb = { name: "capability-lock", source: "#16", status: "deferred" as const, requiredFrom: "1.0.0" };
  assert.equal(isReceiptDue(mlb, "not-a-version"), true);
});

test("stable 0.2.0 verifies with 1.0-scoped receipts deferred, no flag needed", () => {
  const result = isReleaseReady(scopedManifest("0.2.0"));
  assert.equal(result.ready, true, result.blockers.join(" | "));
});

test("the same receipts block 1.0.0", () => {
  const result = isReleaseReady(scopedManifest("1.0.0"));
  assert.equal(result.ready, false);
  assert.equal(result.blockers.length, 9, result.blockers.join(" | "));
});

test("1.0.0-rc.1 blocks EVEN WITH allowDeferred", () => {
  // The whole point: classify() calls an rc a prerelease, and the workflow used to
  // hand prereleases --allow-deferred. If the flag could waive a due receipt, the
  // 1.0 line would ship without the evidence that defines it.
  const result = isReleaseReady(scopedManifest("1.0.0-rc.1"), { allowDeferred: true });
  assert.equal(result.ready, false);
  assert.equal(result.blockers.length, 9, result.blockers.join(" | "));
});

test("a due deferral blocks with and without allowDeferred", () => {
  const m = scopedManifest("0.2.0");
  const train = m.receipts.find((r) => r.name === "gate")!;
  train.status = "deferred";
  train.deferredReason = "skipping on purpose";
  delete train.capturedSha;
  delete train.capturedAt;
  for (const opts of [{}, { allowDeferred: true }]) {
    const result = isReleaseReady(m, opts);
    assert.equal(result.ready, false, JSON.stringify(opts));
    assert.ok(result.blockers.some((b) => b.startsWith("gate deferred")), result.blockers.join(" | "));
  }
});

test("an empty receipt array is rejected (previously verified ready:true)", () => {
  const m = makeManifest({ version: "1.0.0", receipts: [] });
  const errors = validateCandidateManifest(m);
  assert.ok(errors.length > 0, "receipts: [] must not validate");
  assert.ok(errors.some((e) => e.startsWith("missing required receipt:")), errors.join(" | "));
});

test("omitted, duplicated, and unknown receipts are rejected", () => {
  const base = scopedManifest("0.2.0");

  const omitted = makeManifest({ receipts: base.receipts.filter((r) => r.name !== "capability-lock") });
  assert.ok(validateCandidateManifest(omitted).some((e) => e.includes("missing required receipt: capability-lock")));

  const duplicated = makeManifest({ receipts: [...base.receipts, { ...base.receipts[0] }] });
  assert.ok(validateCandidateManifest(duplicated).some((e) => e.startsWith("duplicate receipt:")));

  const unknown = makeManifest({ receipts: [...base.receipts, { name: "invented", source: "x", status: "present" as const, capturedSha: "abc123def456", capturedAt: "t" }] });
  assert.ok(validateCandidateManifest(unknown).some((e) => e.includes("unknown receipt: invented")));
});

test("a forged requiredFrom is rejected against the canonical policy", () => {
  const m = scopedManifest("1.0.0");
  // A hand-written candidate tries to push its own evidence out of scope.
  m.receipts.find((r) => r.name === "capability-lock")!.requiredFrom = "9999.0.0";
  const errors = validateCandidateManifest(m);
  assert.ok(
    errors.some((e) => e.includes("capability-lock: requiredFrom must be 1.0.0, got 9999.0.0")),
    errors.join(" | "),
  );

  // ...and a train receipt cannot invent a scope for itself either.
  const m2 = scopedManifest("0.2.0");
  m2.receipts.find((r) => r.name === "gate")!.requiredFrom = "9999.0.0";
  assert.ok(validateCandidateManifest(m2).some((e) => e.includes("gate: requiredFrom must be unset")));
});

test("a missing receipt is never excused by scope", () => {
  const m = scopedManifest("0.2.0");
  const mlb = m.receipts.find((r) => r.name === "capability-lock")!;
  mlb.status = "missing";
  const result = isReleaseReady(m);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((b) => b === "capability-lock is missing"), result.blockers.join(" | "));
});

test("an unparseable candidate version is a validation error", () => {
  const m = scopedManifest("0.2.0");
  m.version = "not-a-version";
  assert.ok(validateCandidateManifest(m).some((e) => e.startsWith("version is not valid semver")));
});
