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


























/* ------------------------------------------------------------ versioning */

/** A parsed SemVer, with build metadata discarded (it never affects precedence). */








const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Parse a SemVer string. Returns null when malformed — callers must fail closed. */
export function parseVersion(raw        )                       {
  const m = SEMVER_RE.exec(String(raw ?? "").trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split(".") : [],
  };
}

/** True when the version carries prerelease identifiers (0.2.0-beta.1, 1.0.0-rc.1). */
export function isPrerelease(raw        )          {
  const v = parseVersion(raw);
  return v !== null && v.prerelease.length > 0;
}

/**
 * Compare only major.minor.patch, ignoring prerelease identifiers.
 *
 * This is deliberately NOT SemVer precedence. Precedence puts 1.0.0-rc.1 below
 * 1.0.0, which would let a 1.0 release candidate treat 1.0-scoped evidence as
 * not-yet-due — exactly the evidence 1.0 is defined by. An rc of 1.0 belongs to the
 * 1.0 line and owes 1.0 receipts, so obligation is decided on the core alone.
 */
export function compareCore(a               , b               )         {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Canonical receipt policy: which release line each receipt becomes mandatory in.
 * This map is the authority. A candidate manifest may carry requiredFrom, but
 * validation requires it to MATCH this policy — otherwise a hand-written candidate
 * could set requiredFrom: "9999.0.0" and excuse its own evidence.
 */
export const RECEIPT_POLICY                                            = {
  // Train receipts are unscoped: due for every release, always.
  "inventory-sync": {},
  "test-suite": {},
  "gate": {},
  "build": {},
  "packed-install-lifecycle": {},
  "platform-ci": {},
  // MLB 1.0 tracks: not required before the 1.0 line.
  "activation-baseline": { requiredFrom: "1.0.0" },
  "hook-benchmark": { requiredFrom: "1.0.0" },
  "doctor-lifecycle": { requiredFrom: "1.0.0" },
  "capability-lock": { requiredFrom: "1.0.0" },
  "dispatch-contracts": { requiredFrom: "1.0.0" },
  "rule-impact-report": { requiredFrom: "1.0.0" },
  "reference-league": { requiredFrom: "1.0.0" },
  "scouting-bundle": { requiredFrom: "1.0.0" },
  "provenance-security": { requiredFrom: "1.0.0" },
};

/** Every receipt name a candidate manifest must declare. */
export const CANONICAL_RECEIPT_NAMES           = Object.keys(RECEIPT_POLICY);

/**
 * Is a receipt due for this candidate version? A scoped receipt is exempt only
 * while the candidate core is strictly below its requiredFrom core.
 */
export function isReceiptDue(receipt                 , candidateVersion        )          {
  const scope = RECEIPT_POLICY[receipt.name]?.requiredFrom;
  if (!scope) return true;
  const candidate = parseVersion(candidateVersion);
  const threshold = parseVersion(scope);
  if (!candidate || !threshold) return true; // fail closed on a malformed version
  return compareCore(candidate, threshold) >= 0;
}

/** Validate a candidate manifest. Returns error messages or empty array. */
export function validateCandidateManifest(manifest         )           {
  const errors           = [];
  if (!manifest || typeof manifest !== "object") return ["manifest must be a non-null object"];
  const m = manifest                           ;
  if (m.schemaVersion !== CANDIDATE_SCHEMA_VERSION) {
    errors.push("schemaVersion must be " + CANDIDATE_SCHEMA_VERSION);
  }
  if (typeof m.candidateSha !== "string" || !m.candidateSha) errors.push("candidateSha required");
  if (typeof m.version !== "string" || !m.version) {
    errors.push("version required");
  } else if (!parseVersion(m.version)) {
    // Fail closed: an unparseable version cannot be scope-compared, so it must not
    // silently exempt anything.
    errors.push("version is not valid semver: " + m.version);
  }
  if (!Array.isArray(m.receipts)) {
    errors.push("receipts must be an array");
  } else {
    // Completeness. Previously the gate only inspected receipts that happened to
    // exist, so a manifest with receipts: [] verified ready:true — evidence could be
    // omitted rather than deferred. The declared set must be exactly canonical.
    const names = m.receipts.map((r) => (r                           )?.name).filter((n) => typeof n === "string")            ;
    const seen = new Set        ();
    for (const n of names) {
      if (seen.has(n)) errors.push("duplicate receipt: " + n);
      seen.add(n);
      if (!(n in RECEIPT_POLICY)) errors.push("unknown receipt: " + n);
    }
    for (const expected of CANONICAL_RECEIPT_NAMES) {
      if (!seen.has(expected)) errors.push("missing required receipt: " + expected);
    }
    // Policy match. requiredFrom is authoritative in RECEIPT_POLICY; a manifest that
    // disagrees is rejected, so a hand-written candidate cannot excuse its own
    // evidence by claiming a later requiredFrom.
    for (const raw of m.receipts) {
      const r = raw                           ;
      const name = typeof r?.name === "string" ? r.name : null;
      if (!name || !(name in RECEIPT_POLICY)) continue;
      const expected = RECEIPT_POLICY[name].requiredFrom;
      const actual = r.requiredFrom;
      if ((actual ?? undefined) !== expected) {
        errors.push(
          name + ": requiredFrom must be " + (expected ?? "unset") + ", got " + (actual === undefined ? "unset" : String(actual)),
        );
      }
    }
  }
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
      if (t.total !== undefined && (!Number.isInteger(t.total) || (t.total          ) < 0)) {
        errors.push("testSuite.total must be a non-negative integer");
      }
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
      // Scope, not leniency: a receipt is exempt only while the candidate core is
      // below its requiredFrom. Once due it blocks, and no flag waives it — otherwise
      // a 1.0.0-rc.1 classified as "prerelease" would be handed --allow-deferred and
      // skip exactly the evidence the 1.0 line is defined by.
      if (!isReceiptDue(r, manifest.version)) continue;
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
  } else if (manifest.testSuite) {
    // The badge counts TESTS. Compare against the reported total when we have it;
    // pass alone drifts by environment because CI skips the repo-map live smoke.
    const measured = manifest.testSuite.total ?? manifest.testSuite.pass;
    if (manifest.publishedCounts.tests !== measured) {
      blockers.push(
        "published tests=" + manifest.publishedCounts.tests + " but the measured suite reported " + measured,
      );
    }
  }

  return { ready: blockers.length === 0, blockers };
}

/** The required receipts for MLB 1.0. */
export const MLB_1_0_RECEIPTS                    = [
  { name: "activation-baseline", source: "#11 + #18", status: "missing", requiredFrom: "1.0.0" },
  { name: "hook-benchmark", source: "#13", status: "missing", requiredFrom: "1.0.0" },
  { name: "doctor-lifecycle", source: "#15", status: "missing", requiredFrom: "1.0.0" },
  { name: "capability-lock", source: "#16", status: "missing", requiredFrom: "1.0.0" },
  { name: "dispatch-contracts", source: "#17", status: "missing", requiredFrom: "1.0.0" },
  { name: "rule-impact-report", source: "#18", status: "missing", requiredFrom: "1.0.0" },
  { name: "reference-league", source: "#19", status: "missing", requiredFrom: "1.0.0" },
  { name: "scouting-bundle", source: "#20", status: "missing", requiredFrom: "1.0.0" },
  { name: "provenance-security", source: "#8 + #10 + #12", status: "missing", requiredFrom: "1.0.0" },
];

