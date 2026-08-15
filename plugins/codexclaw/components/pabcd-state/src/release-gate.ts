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
export type ReceiptStatus = "present" | "missing" | "failed" | "deferred";

/** A required receipt linked to a release candidate. */
export interface RequiredReceipt {
  /** Receipt name (maps to an execution track). */
  name: string;
  /** Which issue or track produces this receipt. */
  source: string;
  /** Current status. */
  status: ReceiptStatus;
  /** Evidence path or description when present. */
  evidence?: string;
  /** Reason when deferred. */
  deferredReason?: string;
  /** RFC3339 timestamp when this receipt was captured. */
  capturedAt?: string;
  /** The commit this receipt was measured on. Must equal candidateSha. */
  capturedSha?: string;
}

/** Measured test-suite evidence for the candidate commit. */
export interface TestSuiteEvidence {
  pass: number;
  fail: number;
  /**
   * Total tests the runner reported. The published badge counts TESTS, not passes,
   * and CI skips environment-dependent cases (the repo-map live smoke), so pass
   * alone is not comparable across environments.
   */
  total?: number;
  /** The commit the suite was measured on. */
  measuredSha: string;
}

/** What the published documentation currently claims, measured from the docs. */
export interface PublishedCounts {
  tests: number;
  skills: number;
  hooks: number;
}

/** Platform-specific test evidence. */
export interface PlatformEvidence {
  /** Platform identifier. */
  platform: "ubuntu" | "windows" | "macos";
  /** Whether CI passed on this platform. */
  ciPassed: boolean;
  /** Exact SHA tested. */
  testedSha: string;
  /** CI run URL or identifier. */
  ciRun?: string;
}

/** MLB 1.0 release candidate manifest. */
export interface CandidateManifest {
  schemaVersion: number;
  /** Exact candidate SHA. */
  candidateSha: string;
  /** Release version. */
  version: string;
  /** Candidate creation timestamp. */
  createdAt: string;
  /** Required receipts from all execution tracks. */
  receipts: RequiredReceipt[];
  /** Platform-specific evidence. */
  platforms: PlatformEvidence[];
  /** Target scorecard (from the roadmap). */
  scorecard: Record<string, { baseline: number; target: number; achieved?: number }>;
  /** Release non-goals explicitly documented. */
  nonGoals: string[];
  /** sha256: of the canonical inventory.json (inventory.mjs --hash). */
  inventoryHash?: string;
  /** Measured suite result for candidateSha. */
  testSuite?: TestSuiteEvidence;
  /** Measured doc claims (inventory.mjs --published). */
  publishedCounts?: PublishedCounts;
  /** Recorded when verification ran with --allow-deferred. */
  allowedDeferred?: boolean;
}

/** Validate a candidate manifest. Returns error messages or empty array. */
export function validateCandidateManifest(manifest: unknown): string[] {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== "object") return ["manifest must be a non-null object"];
  const m = manifest as Record<string, unknown>;
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
      const r = raw as Record<string, unknown>;
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
    const t = m.testSuite as Record<string, unknown>;
    if (!t || typeof t !== "object") errors.push("testSuite must be an object");
    else {
      if (!Number.isInteger(t.pass) || (t.pass as number) < 0) errors.push("testSuite.pass must be a non-negative integer");
      if (!Number.isInteger(t.fail) || (t.fail as number) < 0) errors.push("testSuite.fail must be a non-negative integer");
      if (t.total !== undefined && (!Number.isInteger(t.total) || (t.total as number) < 0)) {
        errors.push("testSuite.total must be a non-negative integer");
      }
      if (typeof t.measuredSha !== "string" || !t.measuredSha) errors.push("testSuite.measuredSha required");
    }
  }

  if (m.inventoryHash !== undefined && !/^sha256:[0-9a-f]{64}$/.test(String(m.inventoryHash))) {
    errors.push("inventoryHash must look like sha256:<64 hex>");
  }

  if (m.publishedCounts !== undefined) {
    const c = m.publishedCounts as Record<string, unknown>;
    for (const k of ["tests", "skills", "hooks"]) {
      if (!Number.isInteger(c?.[k])) errors.push("publishedCounts." + k + " must be an integer");
    }
  }

  return errors;
}

/** Check if a candidate is ready for release. */
export interface ReleaseReadyOptions {
  /** Permit deferred receipts (prerelease trains). Recorded in the manifest. */
  allowDeferred?: boolean;
  /** Freshly recomputed inventory hash from the checkout being released. */
  actualInventoryHash?: string;
}

export function isReleaseReady(
  manifest: CandidateManifest,
  options: ReleaseReadyOptions = {},
): {
  ready: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  
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
export const MLB_1_0_RECEIPTS: RequiredReceipt[] = [
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

