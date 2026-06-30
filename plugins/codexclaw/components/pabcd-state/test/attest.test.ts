import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAttest, coerceAttest, GATED_TRANSITIONS } from "../src/attest.ts";

test("all four forward edges are gated (L2 parity)", () => {
  assert.deepEqual([...GATED_TRANSITIONS].sort(), ["A>B", "B>C", "C>D", "P>A"]);
  // ungated transitions pass with no attestation
  assert.equal(validateAttest("IDLE", "P", null).ok, true);
  assert.equal(validateAttest("C", "B", null).ok, true); // backward rebuild
  assert.equal(validateAttest("C", "P", null).ok, true); // backward replan
  assert.equal(validateAttest("D", "IDLE", null).ok, true); // cycle close
});

test("P->A and B->C now require a non-empty, non-placeholder did (L2)", () => {
  assert.equal(validateAttest("P", "A", null).ok, false);
  assert.equal(validateAttest("P", "A", { from: "P", to: "A", did: "tbd" }).ok, false);
  assert.equal(validateAttest("P", "A", { from: "P", to: "A", did: "wrote the plan" }).ok, true);
  assert.equal(validateAttest("B", "C", null).ok, false);
  assert.equal(validateAttest("B", "C", { from: "B", to: "C", did: "built the feature" }).ok, true);
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

test("131: coerceAttest carries a typed override boolean (ignores non-boolean)", () => {
  const on = coerceAttest({ from: "I", to: "P", did: "accept", override: true });
  assert.equal(on?.override, true);
  const off = coerceAttest({ from: "I", to: "P", did: "x", override: "yes" });
  assert.equal(off?.override, undefined, "non-boolean override must be dropped");
  const none = coerceAttest({ from: "I", to: "P", did: "x" });
  assert.equal(none?.override, undefined);
});
