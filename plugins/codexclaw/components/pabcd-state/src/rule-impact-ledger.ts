/**
 * rule-impact-ledger.ts — opt-in Rule Impact Ledger (issue #18).
 *
 * Measures whether activated rules actually change outcomes. Records activation,
 * outcome change, and cost so the router diet can be evidence-based.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

/** Schema version for the rule impact ledger. */
export const LEDGER_SCHEMA_VERSION = 1;

/** Classification of a rule's measured impact. */
export type RuleImpactClass =
  | "outcome-changing"     // frequently activated AND changes verifier outcome
  | "high-risk-targeted"   // rare but prevents C4/C5 misses
  | "activation-neutral"   // frequently activated but no outcome change
  | "duplicate"            // same knowledge exists under another canonical owner
  | "unclassified";        // not yet measured

/** A single rule impact record for one activation in one run. */
export interface RuleImpactRecord {
  /** Unique record id. */
  id: string;
  /** Rule ID (e.g. DEV-CLASS-01, FAMILY-PROOF-01). */
  ruleId: string;
  /** Canonical skill owner of this rule (e.g. dev, dev-testing). */
  canonicalOwner: string;
  /** Why the router/reference was activated. */
  activationReason: string;
  /** Whether a violation or detail miss was found. */
  violationFound: boolean;
  /** Whether the bare/baseline run missed it. */
  baselineMissed: boolean;
  /** Added router/reference token estimate. */
  addedTokenEstimate: number;
  /** Whether verifier outcome or rework changed. */
  outcomeChanged: boolean;
  /** False activation (rule fired but was irrelevant). */
  falseActivation: boolean;
  /** Missed activation (rule should have fired but did not). */
  missedActivation: boolean;
  /** Timestamp of this record. */
  timestamp: string;
}

/** The ledger file: a versioned, bounded, append-only record. */
export interface RuleImpactLedger {
  schemaVersion: number;
  records: RuleImpactRecord[];
}

/** Validate a rule impact record. */
export function validateRecord(record: unknown): string[] {
  const errors: string[] = [];
  if (!record || typeof record !== "object") return ["record must be a non-null object"];
  const r = record as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) errors.push("id must be non-empty string");
  if (typeof r.ruleId !== "string" || !r.ruleId) errors.push("ruleId must be non-empty string");
  if (typeof r.canonicalOwner !== "string" || !r.canonicalOwner) errors.push("canonicalOwner must be non-empty string");
  if (typeof r.activationReason !== "string") errors.push("activationReason must be string");
  if (typeof r.violationFound !== "boolean") errors.push("violationFound must be boolean");
  if (typeof r.baselineMissed !== "boolean") errors.push("baselineMissed must be boolean");
  if (typeof r.addedTokenEstimate !== "number" || r.addedTokenEstimate < 0) errors.push("addedTokenEstimate must be non-negative number");
  if (typeof r.outcomeChanged !== "boolean") errors.push("outcomeChanged must be boolean");
  if (typeof r.falseActivation !== "boolean") errors.push("falseActivation must be boolean");
  if (typeof r.missedActivation !== "boolean") errors.push("missedActivation must be boolean");
  return errors;
}

/** Classify a rule based on its impact records. */
export function classifyRule(records: RuleImpactRecord[]): RuleImpactClass {
  if (records.length === 0) return "unclassified";
  const activationCount = records.length;
  const outcomeChanges = records.filter(r => r.outcomeChanged).length;
  const violations = records.filter(r => r.violationFound).length;
  
  if (outcomeChanges > 0 && activationCount >= 3) return "outcome-changing";
  if (violations > 0 && activationCount < 3) return "high-risk-targeted";
  if (activationCount >= 3 && outcomeChanges === 0) return "activation-neutral";
  return "unclassified";
}

/** Read the ledger from disk. Returns empty ledger if file does not exist. */
export function readLedger(path: string): RuleImpactLedger {
  if (!existsSync(path)) {
    return { schemaVersion: LEDGER_SCHEMA_VERSION, records: [] };
  }
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (data.schemaVersion !== LEDGER_SCHEMA_VERSION) {
      return { schemaVersion: LEDGER_SCHEMA_VERSION, records: [] };
    }
    return data as RuleImpactLedger;
  } catch {
    return { schemaVersion: LEDGER_SCHEMA_VERSION, records: [] };
  }
}

/** Append a record to the ledger on disk. */
export function appendRecord(path: string, record: RuleImpactRecord): void {
  const ledger = readLedger(path);
  ledger.records.push(record);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(ledger, null, 2));
}

/** Generate a summary report from the ledger. */
export function generateReport(ledger: RuleImpactLedger): {
  totalRecords: number;
  uniqueRules: number;
  classifications: Record<string, RuleImpactClass>;
  falseActivations: number;
  missedActivations: number;
} {
  const byRule = new Map<string, RuleImpactRecord[]>();
  let falseActivations = 0;
  let missedActivations = 0;
  for (const r of ledger.records) {
    const list = byRule.get(r.ruleId) || [];
    list.push(r);
    byRule.set(r.ruleId, list);
    if (r.falseActivation) falseActivations++;
    if (r.missedActivation) missedActivations++;
  }
  const classifications: Record<string, RuleImpactClass> = {};
  for (const [ruleId, records] of byRule) {
    classifications[ruleId] = classifyRule(records);
  }
  return {
    totalRecords: ledger.records.length,
    uniqueRules: byRule.size,
    classifications,
    falseActivations,
    missedActivations,
  };
}

