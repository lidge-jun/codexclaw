/**
 * dispatch-contract.test.ts — DispatchPacket and DispatchReceipt tests (issue #17).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePacket,
  validateReceipt,
  receiptSatisfiesPacket,
  verifierPreflight,
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
  assert.deepEqual(result.missing, []);
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


test('architect packet roundtrips with main judgment ownership', () => {
  const packet = makePacket({ role: 'architect', objective: 'Propose interfaces' });
  assert.deepEqual(validatePacket(JSON.parse(JSON.stringify(packet))), []);
  assert.ok(validatePacket({ ...packet, judgmentOwnership: 'architect' }).includes('judgmentOwnership must be main'));
});


// #276 / #277 (issue train 0930, devlog/_plan/260930_issue_train/010)

function twoCommandPacket(overrides: Partial<DispatchPacket> = {}): DispatchPacket {
  return makePacket({ verifierCommands: ["first-check", "second-check"], ...overrides });
}

test("receiptSatisfiesPacket: #276 repro — unrelated single result for two required commands", () => {
  const result = receiptSatisfiesPacket(
    twoCommandPacket(),
    makeReceipt({ commandsRun: ["unrelated-check"], verifierResult: { command: "unrelated-check", exitCode: 0, output: "ok" } }),
  );
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("unrelated command")));
  assert.ok(result.reasons.some(r => r.includes("incomplete")));
  assert.deepEqual(result.missing, ["first-check", "second-check"]);
});

test("receiptSatisfiesPacket: single mismatched command is rejected", () => {
  const result = receiptSatisfiesPacket(
    makePacket({ verifierCommands: ["npm test"] }),
    makeReceipt({ verifierResult: { command: "npm run test", exitCode: 0, output: "ok" } }),
  );
  assert.equal(result.satisfied, false);
  assert.deepEqual(result.missing, ["npm test"]);
});

test("receiptSatisfiesPacket: two required commands with one matching verifierResults entry", () => {
  const result = receiptSatisfiesPacket(
    twoCommandPacket(),
    makeReceipt({ verifierResult: undefined, verifierResults: [{ command: "first-check", exitCode: 0, output: "ok" }] }),
  );
  assert.equal(result.satisfied, false);
  assert.deepEqual(result.missing, ["second-check"]);
  assert.ok(result.reasons.some(r => r.includes("missing verifier result")));
});

test("receiptSatisfiesPacket: legacy single matching result with two required commands is incomplete", () => {
  const result = receiptSatisfiesPacket(
    twoCommandPacket(),
    makeReceipt({ verifierResult: { command: "first-check", exitCode: 0, output: "ok" } }),
  );
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("legacy verifierResult") && r.includes("incomplete")));
});

test("receiptSatisfiesPacket: verifierResults covering every command is satisfied", () => {
  const result = receiptSatisfiesPacket(
    twoCommandPacket(),
    makeReceipt({ verifierResult: undefined, verifierResults: [
      { command: "first-check", exitCode: 0, output: "ok" },
      { command: "second-check", exitCode: 0, output: "ok" },
    ] }),
  );
  assert.equal(result.satisfied, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.missing, []);
});

test("receiptSatisfiesPacket: unrelated extra result fails even with full coverage", () => {
  const result = receiptSatisfiesPacket(
    twoCommandPacket(),
    makeReceipt({ verifierResult: undefined, verifierResults: [
      { command: "first-check", exitCode: 0, output: "ok" },
      { command: "second-check", exitCode: 0, output: "ok" },
      { command: "extra-check", exitCode: 0, output: "ok" },
    ] }),
  );
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("unrelated command") && r.includes("extra-check")));
});

test("receiptSatisfiesPacket: duplicate and padded packet commands match trimmed results", () => {
  const result = receiptSatisfiesPacket(
    makePacket({ verifierCommands: [" npm test ", "npm test"] }),
    makeReceipt({ verifierResult: { command: "npm test", exitCode: 0, output: "ok" } }),
  );
  assert.equal(result.satisfied, true);
  assert.deepEqual(result.missing, []);
});

test("receiptSatisfiesPacket: nonzero matching result in verifierResults fails", () => {
  const result = receiptSatisfiesPacket(
    twoCommandPacket(),
    makeReceipt({ verifierResult: undefined, verifierResults: [
      { command: "first-check", exitCode: 0, output: "ok" },
      { command: "second-check", exitCode: 2, output: "boom" },
    ] }),
  );
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("exit code 2")));
});

test("receiptSatisfiesPacket: malformed unvalidated result does not throw", () => {
  for (const verifierResults of [[{ command: 1 }], {}]) {
    const result = receiptSatisfiesPacket(
      makePacket(),
      makeReceipt({ verifierResult: undefined, verifierResults: verifierResults as any }),
    );
    assert.equal(result.satisfied, false);
    assert.ok(result.reasons.some(r => r.includes("malformed verifier results")));
  }
});

test("validateReceipt: rejects malformed verifier results", () => {
  const legacy = makeReceipt({ verifierResult: { command: "npm test", exitCode: "0" as any, output: "" } });
  assert.ok(validateReceipt(legacy).some(e => e.startsWith("verifierResult must be")));
  const notArray = makeReceipt({ verifierResults: {} as any });
  assert.ok(validateReceipt(notArray).some(e => e.startsWith("verifierResults must be")));
  const badEntry = makeReceipt({ verifierResults: [{ command: 1 }] as any });
  assert.ok(validateReceipt(badEntry).some(e => e.startsWith("verifierResults must be")));
  assert.deepEqual(validateReceipt(makeReceipt({ verifierResults: [{ command: "npm test", exitCode: 0, output: "" }] })), []);
});

test("validatePacket: rejects blank verifier command entries", () => {
  const errors = validatePacket(makePacket({ verifierCommands: ["npm test", "  "] }));
  assert.ok(errors.includes("verifierCommands entries must be non-empty strings"));
});

test("validatePacket: verifierEffects shape", () => {
  const unknown = validatePacket(makePacket({ verifierEffects: [{ command: "other", expectedWrites: [] }] }));
  assert.ok(unknown.some(e => e.includes("is not in verifierCommands")));
  const duplicate = validatePacket(makePacket({ verifierEffects: [
    { command: "npm test", expectedWrites: [] }, { command: " npm test", expectedWrites: [] },
  ] }));
  assert.ok(duplicate.some(e => e.includes("more than once")));
  const writes = validatePacket(makePacket({ verifierEffects: [{ command: "npm test", expectedWrites: "x" as any }] }));
  assert.ok(writes.some(e => e.includes("expectedWrites")));
  const isolation = validatePacket(makePacket({ verifierEffects: [{ command: "npm test", expectedWrites: [], runInIsolation: "yes" as any }] }));
  assert.ok(isolation.some(e => e.includes("runInIsolation")));
  assert.deepEqual(validatePacket(makePacket({ verifierEffects: [{ command: "npm test", expectedWrites: [] }] })), []);
});

test("validatePacket: verifierEffects container and entry guards", () => {
  assert.ok(validatePacket(makePacket({ verifierEffects: {} as any })).includes("verifierEffects must be an array"));
  assert.ok(validatePacket(makePacket({ verifierEffects: [null] as any })).includes("verifierEffects entries must be objects"));
  assert.ok(validatePacket(makePacket({ verifierEffects: [{ command: "  ", expectedWrites: [] }] }))
    .includes("verifierEffects command must be a non-empty string"));
});

test("verifierPreflight: shared-read flags undeclared and writing verifiers", () => {
  const rows = verifierPreflight(makePacket({
    worktreePolicy: "shared-read",
    verifierCommands: ["undeclared", "read-only", "writer", "isolated"],
    verifierEffects: [
      { command: "read-only", expectedWrites: [] },
      { command: "writer", expectedWrites: ["cache.db"] },
      { command: "isolated", expectedWrites: [], runInIsolation: true },
    ],
  }));
  assert.deepEqual(rows.map(r => [r.command, r.declared, r.needsIsolation]), [
    ["undeclared", false, true],
    ["read-only", true, false],
    ["writer", true, true],
    ["isolated", true, true],
  ]);
  assert.ok(rows[2].reason.includes("cache.db"));
});

test("verifierPreflight: isolated-write accepts declared writes", () => {
  const rows = verifierPreflight(makePacket({
    worktreePolicy: "isolated-write",
    verifierCommands: ["writer"],
    verifierEffects: [{ command: "writer", expectedWrites: ["out/"] }],
  }));
  assert.deepEqual(rows, [{ command: "writer", declared: true, needsIsolation: false, reason: "packet is isolated-write" }]);
});


test("receiptSatisfiesPacket: legacy verifierResult merges with verifierResults", () => {
  const result = receiptSatisfiesPacket(
    twoCommandPacket(),
    makeReceipt({
      verifierResults: [{ command: "first-check", exitCode: 0, output: "ok" }],
      verifierResult: { command: "second-check", exitCode: 0, output: "ok" },
    }),
  );
  assert.equal(result.satisfied, true);
  assert.ok(!result.reasons.some(r => r.includes("legacy")));
});

test("receiptSatisfiesPacket: no required commands accepts a stray passing result", () => {
  const result = receiptSatisfiesPacket(
    makePacket({ verifierCommands: [] }),
    makeReceipt({ verifierResult: { command: "extra-check", exitCode: 0, output: "ok" } }),
  );
  assert.equal(result.satisfied, true);
});

test("receiptSatisfiesPacket: no results reports one reason and lists every missing command", () => {
  const result = receiptSatisfiesPacket(twoCommandPacket(), makeReceipt({ verifierResult: undefined }));
  assert.equal(result.satisfied, false);
  assert.deepEqual(result.missing, ["first-check", "second-check"]);
  assert.ok(result.reasons.includes("packet has verifier commands but receipt has no verifier result"));
  assert.ok(!result.reasons.some(r => r.startsWith("missing verifier result")));
});

test("receiptSatisfiesPacket: a present but falsy legacy verifierResult is malformed", () => {
  const result = receiptSatisfiesPacket(
    makePacket(),
    makeReceipt({ verifierResult: null as any, verifierResults: [{ command: "npm test", exitCode: 0, output: "ok" }] }),
  );
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("malformed verifier results")));
});

test("unvalidated packets with non-string commands fail closed without throwing", () => {
  const packet = makePacket({ verifierCommands: ["npm test", 1 as any] });
  const result = receiptSatisfiesPacket(packet, makeReceipt());
  assert.equal(result.satisfied, false);
  assert.ok(result.reasons.some(r => r.includes("malformed verifier commands")));
  const rows = verifierPreflight(packet);
  assert.deepEqual(rows.map(r => [r.command, r.needsIsolation]), [["npm test", true], ["1", true]]);
  assert.ok(rows[1].reason.includes("malformed verifier command"));
});

test("validatePacket: verifierEffects expectedWrites entries must be non-blank strings", () => {
  const errors = validatePacket(makePacket({ verifierEffects: [{ command: "npm test", expectedWrites: ["out/", " "] }] }));
  assert.ok(errors.some(e => e.includes("expectedWrites") && e.includes("non-empty strings")));
});


test("verifierPreflight: malformed effects are ignored and the command stays undeclared", () => {
  for (const verifierEffects of [{}, [null], [{ command: 1, expectedWrites: [] }], [{ command: "npm test" }]]) {
    const rows = verifierPreflight(makePacket({ verifierEffects: verifierEffects as any }));
    assert.deepEqual(rows.map(r => [r.command, r.declared, r.needsIsolation]), [["npm test", false, true]]);
  }
});
