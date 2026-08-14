/**
 * dispatch-contract.test.ts — DispatchPacket and DispatchReceipt tests (issue #17).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePacket,
  validateReceipt,
  receiptSatisfiesPacket,
  type DispatchPacket,
  type DispatchReceipt,
} from "../src/dispatch-contract.ts";

function makePacket(overrides: Partial<DispatchPacket> = {}): DispatchPacket {
  return {
    id: "pkt-1",
    objective: "Review the plan",
    inputAnchors: ["devlog/_plan/000_plan.md"],
    expectedOutput: "VERDICT: PASS | FAIL",
    decisionBoundary: "Report findings; do not implement",
    verifierCommands: ["npm test"],
    requiredSkills: ["cxc-dev", "cxc-search"],
    worktreePolicy: "shared-read",
    judgmentOwnership: "main",
    role: "reviewer",
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<DispatchReceipt> = {}): DispatchReceipt {
  return {
    packetId: "pkt-1",
    status: "complete",
    findings: "VERDICT: PASS — no blockers found",
    evidenceAnchors: ["devlog/_plan/000_plan.md:15"],
    commandsRun: ["npm test"],
    unresolvedAssumptions: [],
    verifierResult: { command: "npm test", exitCode: 0, output: "1558 pass 0 fail" },
    ...overrides,
  };
}

test("validatePacket: valid packet returns no errors", () => {
  assert.deepEqual(validatePacket(makePacket()), []);
});

test("validatePacket: null returns error", () => {
  assert.ok(validatePacket(null).length > 0);
});

test("validatePacket: missing id returns error", () => {
  const errors = validatePacket(makePacket({ id: "" }));
  assert.ok(errors.some(e => e.includes("id")));
});

test("validatePacket: invalid worktreePolicy returns error", () => {
  const pkt = makePacket();
  (pkt as any).worktreePolicy = "rw";
  assert.ok(validatePacket(pkt).some(e => e.includes("worktreePolicy")));
});

test("validatePacket: judgmentOwnership must be main", () => {
  const pkt = makePacket();
  (pkt as any).judgmentOwnership = "subagent";
  assert.ok(validatePacket(pkt).some(e => e.includes("judgmentOwnership")));
});

test("validatePacket: invalid role returns error", () => {
  const pkt = makePacket();
  (pkt as any).role = "manager";
  assert.ok(validatePacket(pkt).some(e => e.includes("role")));
});

test("validatePacket: oversized requiredSkills returns error", () => {
  const skills = Array.from({ length: 11 }, (_, i) => "skill-" + i);
  const errors = validatePacket(makePacket({ requiredSkills: skills }));
  assert.ok(errors.some(e => e.includes("maximum")));
});

test("validateReceipt: valid receipt returns no errors", () => {
  assert.deepEqual(validateReceipt(makeReceipt()), []);
});

test("validateReceipt: null returns error", () => {
  assert.ok(validateReceipt(null).length > 0);
});

test("validateReceipt: invalid status returns error", () => {
  const r = makeReceipt();
  (r as any).status = "failed";
  assert.ok(validateReceipt(r).some(e => e.includes("status")));
});

test("receiptSatisfiesPacket: matching pair is satisfied", () => {
  const result = receiptSatisfiesPacket(makePacket(), makeReceipt());
  assert.equal(result.satisfied, true);
  assert.deepEqual(result.reasons, []);
});

test("receiptSatisfiesPacket: packetId mismatch", () => {
  const result = receiptSatisfiesPacket(makePacket(), makeReceipt({ packetId: "other" }));
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("mismatch")));
});

test("receiptSatisfiesPacket: non-complete status", () => {
  const result = receiptSatisfiesPacket(makePacket(), makeReceipt({ status: "blocked" }));
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("blocked")));
});

test("receiptSatisfiesPacket: missing verifier result when required", () => {
  const result = receiptSatisfiesPacket(
    makePacket({ verifierCommands: ["npm test"] }),
    makeReceipt({ verifierResult: undefined }),
  );
  assert.equal(result.satisfied, false);
});

test("receiptSatisfiesPacket: non-zero verifier exit code", () => {
  const result = receiptSatisfiesPacket(
    makePacket(),
    makeReceipt({ verifierResult: { command: "npm test", exitCode: 1, output: "fail" } }),
  );
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("exit code")));
});

test("receiptSatisfiesPacket: no verifier commands, no verifier result is ok", () => {
  const result = receiptSatisfiesPacket(
    makePacket({ verifierCommands: [] }),
    makeReceipt({ verifierResult: undefined }),
  );
  assert.equal(result.satisfied, true);
});

