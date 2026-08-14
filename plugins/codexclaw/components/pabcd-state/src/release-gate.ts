/**
 * release-gate.ts — MLB 1.0 exact-head evidence gate (issue #21).
 *
 * Defines the machine-readable candidate manifest schema that links every
 * required receipt for an MLB 1.0 release. Does not create another runtime
 * subsystem — it consumes the other tracks.
 */

/** Schema version for the release candidate manifest. */
export const CANDIDATE_SCHEMA_VERSION = 1;

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
  return errors;
}

/** Check if a candidate is ready for release. */
export function isReleaseReady(manifest: CandidateManifest): {
  ready: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  
  // All required receipts must be present
  const missing = manifest.receipts.filter(r => r.status !== "present");
  for (const r of missing) {
    if (r.status === "deferred") {
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

