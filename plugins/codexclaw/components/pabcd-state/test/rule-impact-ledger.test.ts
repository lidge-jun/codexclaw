/**
 * rule-impact-ledger.test.ts — Rule Impact Ledger tests (issue #18).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateRecord,
  classifyRule,
  readLedger,
  appendRecord,
  generateReport,
  LEDGER_SCHEMA_VERSION,
  type RuleImpactRecord,
} from "../src/rule-impact-ledger.ts";

function makeRecord(overrides: Partial<RuleImpactRecord> = {}): RuleImpactRecord {
  return {
    id: "rec-1",
    ruleId: "DEV-CLASS-01",
    canonicalOwner: "dev",
    activationReason: "C2 work classified",
    violationFound: false,
    baselineMissed: false,
    addedTokenEstimate: 500,
    outcomeChanged: false,
    falseActivation: false,
    missedActivation: false,
    timestamp: "2026-08-15T00:00:00Z",
    ...overrides,
  };
}

test("validateRecord: valid record returns no errors", () => {
  assert.deepEqual(validateRecord(makeRecord()), []);
});

test("validateRecord: null returns error", () => {
  assert.ok(validateRecord(null).length > 0);
});

test("validateRecord: missing ruleId returns error", () => {
  assert.ok(validateRecord(makeRecord({ ruleId: "" })).some(e => e.includes("ruleId")));
});

test("validateRecord: negative token estimate returns error", () => {
  assert.ok(validateRecord(makeRecord({ addedTokenEstimate: -1 })).some(e => e.includes("addedTokenEstimate")));
});

test("classifyRule: empty records returns unclassified", () => {
  assert.equal(classifyRule([]), "unclassified");
});

test("classifyRule: frequent with outcome changes -> outcome-changing", () => {
  const records = [
    makeRecord({ outcomeChanged: true }),
    makeRecord({ outcomeChanged: true }),
    makeRecord({ outcomeChanged: true }),
  ];
  assert.equal(classifyRule(records), "outcome-changing");
});

test("classifyRule: rare with violations -> high-risk-targeted", () => {
  const records = [makeRecord({ violationFound: true })];
  assert.equal(classifyRule(records), "high-risk-targeted");
});

test("classifyRule: frequent no outcome change -> activation-neutral", () => {
  const records = [makeRecord(), makeRecord(), makeRecord()];
  assert.equal(classifyRule(records), "activation-neutral");
});

test("readLedger: missing file returns empty ledger", () => {
  const ledger = readLedger("/nonexistent/ledger.json");
  assert.equal(ledger.schemaVersion, LEDGER_SCHEMA_VERSION);
  assert.deepEqual(ledger.records, []);
});

test("readLedger: corrupt file returns empty ledger", () => {
  const dir = mkdtempSync(join(tmpdir(), "ril-"));
  const path = join(dir, "ledger.json");
  writeFileSync(path, "NOT JSON");
  const ledger = readLedger(path);
  assert.deepEqual(ledger.records, []);
});

test("appendRecord: appends and reads back", () => {
  const dir = mkdtempSync(join(tmpdir(), "ril-"));
  const path = join(dir, "ledger.json");
  appendRecord(path, makeRecord({ id: "r1" }));
  appendRecord(path, makeRecord({ id: "r2" }));
  const ledger = readLedger(path);
  assert.equal(ledger.records.length, 2);
  assert.equal(ledger.records[0].id, "r1");
  assert.equal(ledger.records[1].id, "r2");
});

test("generateReport: computes summary correctly", () => {
  const ledger = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    records: [
      makeRecord({ ruleId: "A", outcomeChanged: true }),
      makeRecord({ ruleId: "A", outcomeChanged: true }),
      makeRecord({ ruleId: "A", outcomeChanged: true }),
      makeRecord({ ruleId: "B", falseActivation: true }),
      makeRecord({ ruleId: "C", missedActivation: true }),
    ],
  };
  const report = generateReport(ledger);
  assert.equal(report.totalRecords, 5);
  assert.equal(report.uniqueRules, 3);
  assert.equal(report.classifications["A"], "outcome-changing");
  assert.equal(report.falseActivations, 1);
  assert.equal(report.missedActivations, 1);
});

