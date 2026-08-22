import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAttest, coerceAttest } from "../src/attest.ts";

test("#31: A>B with only did returns every A>B field in one rejection", () => {
  const r = validateAttest("A", "B", coerceAttest({ from: "A", to: "B", did: "audited the plan" }));
  assert.equal(r.ok, false);
  assert.equal(r.reasons?.length, 2);
  assert.match(r.reason ?? "", /auditOutput/);
  assert.match(r.reason ?? "", /auditVerdict/);
});

test("#31: near-pass without residual batches the residual demand", () => {
  const r = validateAttest("A", "B", coerceAttest({
    from: "A", to: "B", did: "audited the plan", auditVerdict: "near-pass",
  }));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /auditOutput/);
  assert.match(r.reason ?? "", /auditResidual/);
  // the verdict IS valid, so its own missing-field reason must not appear
  assert.doesNotMatch(r.reason ?? "", /requires "auditVerdict"/);
});

test("#31: contradiction checks stay silent while fields are missing", () => {
  const missing = validateAttest("A", "B", coerceAttest({
    from: "A", to: "B", did: "audited the plan", auditVerdict: "fail",
  }));
  assert.equal(missing.ok, false);
  assert.doesNotMatch(missing.reason ?? "", /is blocked/);
  const complete = validateAttest("A", "B", coerceAttest({
    from: "A", to: "B", did: "audited the plan", auditVerdict: "fail", auditOutput: "VERDICT: PASS",
  }));
  assert.equal(complete.ok, false);
  assert.match(complete.reason ?? "", /is blocked/);
});

test("#31: single-reason failures render exactly as before", () => {
  const r = validateAttest("P", "A", coerceAttest({ from: "P", to: "A", did: "tbd" }));
  assert.equal(r.ok, false);
  assert.equal(r.reasons?.length, 1);
  assert.equal(r.reason, r.reasons?.[0]);
  assert.ok(!(r.reason ?? "").startsWith("(1/"), "a lone reason is never numbered");
});

test("#31: C>D batches checkOutput + exitCode + testReceiptPath", () => {
  const bare = validateAttest("C", "D", coerceAttest({ from: "C", to: "D", did: "ran the suite" }));
  assert.equal(bare.ok, false);
  assert.equal(bare.reasons?.length, 3);
  assert.match(bare.reason ?? "", /checkOutput/);
  assert.match(bare.reason ?? "", /exitCode/);
  assert.match(bare.reason ?? "", /testReceiptPath/);
  // a COMPLETE attest whose check merely failed draws the exit reason alone
  const failing = validateAttest("C", "D", coerceAttest({
    from: "C", to: "D", did: "ran the suite", checkOutput: "3 failing", exitCode: 1,
  }));
  assert.equal(failing.ok, false);
  assert.equal(failing.reasons?.length, 1);
  assert.match(failing.reason ?? "", /exitCode 1/);
  assert.doesNotMatch(failing.reason ?? "", /testReceiptPath/);
});

test("#31: ungated transitions still pass", () => {
  assert.equal(validateAttest("C", "B", null).ok, true);
});

test("#31: the A>B reviewer wording names a real agent_type", () => {
  const r = validateAttest("A", "B", coerceAttest({ from: "A", to: "B", did: "audited the plan" }));
  const auditOutputReason = (r.reasons ?? []).find((x) => x.includes("auditOutput")) ?? "";
  assert.match(auditOutputReason, /agent_type "explorer"/);
  assert.doesNotMatch(auditOutputReason, /agent_type "reviewer"/);
});
