/**
 * release-gate.ts — MLB 1.0 exact-head evidence gate (issue #21).
 *
 * Defines the machine-readable candidate manifest schema that links every
 * required receipt for an MLB 1.0 release. Does not create another runtime
 * subsystem — it consumes the other tracks.
 *
 * Schema v2 (260815 release train) adds the fields that make the gate FAIL CLOSED
 * rather than merely describable:
 *  - receipt capturedSha/capturedAt, so a receipt earned on another commit is stale
 *    rather than silently reusable;
 *  - testSuite, so a release cannot ship beside a red or foreign-commit suite;
 *  - inventoryHash + publishedCounts, so a fresh test receipt cannot sit next to a
 *    stale public badge (the exact drift that made v0.1.0 misdescribe the product).
 */

/** Schema version for the release candidate manifest. */
export const CANDIDATE_SCHEMA_VERSION = 2;

/** Status of a required receipt. */


/** A required receipt linked to a release candidate. */

















/** Measured test-suite evidence for the candidate commit. */







/** What the published documentation currently claims, measured from the docs. */






/** Platform-specific test evidence. */











/** MLB 1.0 release candidate manifest. */


























/** Validate a candidate manifest. Returns error messages or empty array. */
export function validateCandidateManifest(manifest         )           {
  const errors           = [];
  if (!manifest || typeof manifest !== "object") return ["manifest must be a non-null object"];
  const m = manifest                           ;
  if (m.schemaVersion !== CANDIDATE_SCHEMA_VERSION) {
    errors.push("schemaVersion must be " + CANDIDATE_SCHEMA_VERSION);
  }
  if (typeof m.candidateSha !== "string" || !m.candidateSha) errors.push("candidateSha required");
  if (typeof m.version !== "string" || !m.version) errors.push("version required");
  if (!Array.isArray(m.receipts)) errors.push("receipts must be an array");
  if (!Array.isArray(m.platforms)) errors.push("platforms must be an array");
  if (!m.scorecard || typeof m.scorecard !== "object") errors.push("scorecard must be an object");
  if (!Array.isArray(m.nonGoals)) errors.push("nonGoals must be an array");

  // v2: a present receipt without provenance is indistinguishable from an asserted one.
  if (Array.isArray(m.receipts)) {
    for (const raw of m.receipts) {
      const r = raw                           ;
      const name = typeof r?.name === "string" ? r.name : "<unnamed>";
      if (r?.status === "present") {
        if (typeof r.capturedSha !== "string" || !r.capturedSha) {
          errors.push(name + ": present receipt requires capturedSha");
        }
        if (typeof r.capturedAt !== "string" || !r.capturedAt) {
          errors.push(name + ": present receipt requires capturedAt");
        }
      }
      if (r?.status === "deferred" && (typeof r.deferredReason !== "string" || !r.deferredReason)) {
        errors.push(name + ": deferred receipt requires deferredReason");
      }
    }
  }

  if (m.testSuite !== undefined) {
    const t = m.testSuite                           ;
    if (!t || typeof t !== "object") errors.push("testSuite must be an object");
    else {
      if (!Number.isInteger(t.pass) || (t.pass          ) < 0) errors.push("testSuite.pass must be a non-negative integer");
      if (!Number.isInteger(t.fail) || (t.fail          ) < 0) errors.push("testSuite.fail must be a non-negative integer");
      if (typeof t.measuredSha !== "string" || !t.measuredSha) errors.push("testSuite.measuredSha required");
    }
  }

  if (m.inventoryHash !== undefined && !/^sha256:[0-9a-f]{64}$/.test(String(m.inventoryHash))) {
    errors.push("inventoryHash must look like sha256:<64 hex>");
  }

  if (m.publishedCounts !== undefined) {
    const c = m.publishedCounts                           ;
    for (const k of ["tests", "skills", "hooks"]) {
      if (!Number.isInteger(c?.[k])) errors.push("publishedCounts." + k + " must be an integer");
    }
  }

  return errors;
}

/** Check if a candidate is ready for release. */







export function isReleaseReady(
  manifest                   ,
  options                      = {},
)


  {
  const blockers           = [];

  // All required receipts must be present
  const missing = manifest.receipts.filter(r => r.status !== "present");
  for (const r of missing) {
    if (r.status === "deferred") {
      // A prerelease may ship with deferred receipts, but only explicitly: the flag is
      // recorded on the manifest so the published artifact states what it skipped.
      if (options.allowDeferred) continue;
      blockers.push(r.name + " deferred: " + (r.deferredReason || "no reason"));
    } else {
      blockers.push(r.name + " is " + r.status);
    }
  }

  // At least Ubuntu and one other platform must pass
  const passed = manifest.platforms.filter(p => p.ciPassed);
  const hasUbuntu = passed.some(p => p.platform === "ubuntu");
  if (!hasUbuntu) blockers.push("Ubuntu CI not passed");
  if (passed.length < 2) blockers.push("fewer than 2 platforms passed");

  // All platforms must test the exact candidate SHA
  for (const p of manifest.platforms) {
    if (p.testedSha !== manifest.candidateSha) {
      blockers.push(p.platform + " tested different SHA: " + p.testedSha);
    }
  }

  // v2 rule 1-2: a receipt measured on another commit proves nothing about this one.
  for (const r of manifest.receipts) {
    if (r.status !== "present") continue;
    if (!r.capturedSha) {
      blockers.push(r.name + " is present but carries no capturedSha");
    } else if (r.capturedSha !== manifest.candidateSha) {
      blockers.push(r.name + " captured on " + r.capturedSha + ", candidate is " + manifest.candidateSha);
    }
  }

  // v2 rule 3: the suite must be green AND measured on this commit.
  if (!manifest.testSuite) {
    blockers.push("testSuite evidence missing");
  } else {
    if (manifest.testSuite.fail > 0) {
      blockers.push("test suite has " + manifest.testSuite.fail + " failure(s)");
    }
    if (manifest.testSuite.measuredSha !== manifest.candidateSha) {
      blockers.push(
        "test suite measured on " + manifest.testSuite.measuredSha + ", candidate is " + manifest.candidateSha,
      );
    }
  }

  // v2 rule 4: the inventory the docs were generated from must be the one shipping.
  if (!manifest.inventoryHash) {
    blockers.push("inventoryHash missing");
  } else if (options.actualInventoryHash && options.actualInventoryHash !== manifest.inventoryHash) {
    blockers.push(
      "inventory hash mismatch: manifest " + manifest.inventoryHash + ", checkout " + options.actualInventoryHash,
    );
  }

  // v2 rule 5: a fresh test receipt beside a stale public badge is the drift that made
  // v0.1.0 misdescribe the product. Bind the published number to the measured one.
  if (!manifest.publishedCounts) {
    blockers.push("publishedCounts missing");
  } else if (manifest.testSuite && manifest.publishedCounts.tests !== manifest.testSuite.pass) {
    blockers.push(
      "published tests=" + manifest.publishedCounts.tests + " but the measured suite passed " + manifest.testSuite.pass,
    );
  }

  return { ready: blockers.length === 0, blockers };
}

/** The required receipts for MLB 1.0. */
export const MLB_1_0_RECEIPTS                    = [
  { name: "activation-baseline", source: "#11 + #18", status: "missing" },
  { name: "hook-benchmark", source: "#13", status: "missing" },
  { name: "doctor-lifecycle", source: "#15", status: "missing" },
  { name: "capability-lock", source: "#16", status: "missing" },
  { name: "dispatch-contracts", source: "#17", status: "missing" },
  { name: "rule-impact-report", source: "#18", status: "missing" },
  { name: "reference-league", source: "#19", status: "missing" },
  { name: "scouting-bundle", source: "#20", status: "missing" },
  { name: "provenance-security", source: "#8 + #10 + #12", status: "missing" },
];

