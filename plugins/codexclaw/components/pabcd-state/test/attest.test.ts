import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAttest, coerceAttest, GATED_TRANSITIONS } from "../src/attest.ts";

test("only A->B and C->D are gated", () => {
  assert.deepEqual([...GATED_TRANSITIONS].sort(), ["A>B", "C>D"]);
  // ungated transitions pass with no attestation
  assert.equal(validateAttest("P", "A", null).ok, true);
  assert.equal(validateAttest("B", "C", null).ok, true);
  assert.equal(validateAttest("IDLE", "P", null).ok, true);
});

test("A->B requires a non-empty, non-placeholder did", () => {
  assert.equal(validateAttest("A", "B", null).ok, false);
  assert.equal(validateAttest("A", "B", { from: "A", to: "B", did: "" }).ok, false);
  assert.equal(validateAttest("A", "B", { from: "A", to: "B", did: "done" }).ok, false); // placeholder
  assert.equal(validateAttest("A", "B", { from: "A", to: "B", did: "audited the plan" }).ok, true);
});

test("A->B rejects mismatched from/to", () => {
  assert.equal(validateAttest("A", "B", { from: "C", to: "D", did: "x" }).ok, false);
});

test("C->D requires did + checkOutput + passing exitCode", () => {
  const base = { from: "C", to: "D", did: "ran npm test" } as const;
  assert.equal(validateAttest("C", "D", { ...base }).ok, false); // no checkOutput
  assert.equal(validateAttest("C", "D", { ...base, checkOutput: "77 pass", exitCode: 1 }).ok, false);
  assert.equal(validateAttest("C", "D", { ...base, checkOutput: "77 pass", exitCode: 0 }).ok, true);
  assert.equal(validateAttest("C", "D", { ...base, checkOutput: "77 pass" }).ok, true); // exitCode optional
});

test("coerceAttest validates shape", () => {
  assert.equal(coerceAttest(null), null);
  assert.equal(coerceAttest({ from: 1, to: "B", did: "x" }), null);
  const a = coerceAttest({ from: "A", to: "B", did: "  trimmed  ", exitCode: 0 });
  assert.equal(a?.did, "trimmed");
  assert.equal(a?.exitCode, 0);
});
