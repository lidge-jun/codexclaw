import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAttest, coerceAttest, GATED_TRANSITIONS, hasFailVerdictTail } from "../src/attest.ts";
import { validateWorkPhaseBinding } from "../src/attest.ts";

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
});

test("WP3: A->B additionally requires auditOutput (reviewer verdict paste)", () => {
  // did alone no longer passes — the audit gate needs the reviewer verdict tail
  const noAudit = validateAttest("A", "B", { from: "A", to: "B", did: "audited the plan" });
  assert.equal(noAudit.ok, false);
  assert.match(noAudit.reason ?? "", /auditOutput/);
  const noVerdict = validateAttest("A", "B", {
    from: "A",
    to: "B",
    did: "audited the plan",
    auditOutput: "reviewer: GO-WITH-FIXES; 2 blockers folded back",
  });
  assert.equal(noVerdict.ok, false);
  assert.match(noVerdict.reason ?? "", /auditVerdict/);
  assert.equal(
    validateAttest("A", "B", {
      from: "A",
      to: "B",
      did: "audited the plan",
      auditOutput: "reviewer: GO-WITH-FIXES; 2 blockers folded back",
      auditVerdict: "near-pass",
      auditResidual: "2 blockers folded back: (1) rollback gap -> plan amended, (2) phantom constant -> rebutted",
    }).ok,
    true,
  );
});

test("A->B auditVerdict=fail is rejected with re-audit guidance", () => {
  const r = validateAttest("A", "B", {
    from: "A",
    to: "B",
    did: "audited the plan",
    auditOutput: "VERDICT: FAIL",
    auditVerdict: "fail",
  });
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /SAME reviewer/);
  assert.match(r.reason ?? "", /LOOP-REPAIR-01/);
});

test("A->B near-pass without auditResidual is rejected", () => {
  const r = validateAttest("A", "B", {
    from: "A",
    to: "B",
    did: "audited the plan",
    auditOutput: "VERDICT: GO-WITH-FIXES (blockers=1)",
    auditVerdict: "near-pass",
  });
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /auditResidual/);
});

test("A->B pass with clean output advances", () => {
  const r = validateAttest("A", "B", {
    from: "A",
    to: "B",
    did: "audited the plan",
    auditOutput: "review complete\nVERDICT: PASS",
    auditVerdict: "pass",
  });
  assert.equal(r.ok, true);
});

test("A->B FAIL-tail contradiction is rejected", () => {
  const r = validateAttest("A", "B", {
    from: "A",
    to: "B",
    did: "audited the plan",
    auditOutput: "findings fixed\nVERDICT: FAIL",
    auditVerdict: "pass",
  });
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /contradict/i);
});

test("A->B mid-text FAIL mention does not trip the tail", () => {
  const r = validateAttest("A", "B", {
    from: "A",
    to: "B",
    did: "audited the plan",
    auditOutput: "scanned for FAIL markers; none apply\nVERDICT: PASS",
    auditVerdict: "pass",
  });
  assert.equal(r.ok, true);
});

test("A->B earlier FAIL corrected by final PASS does not trip", () => {
  const r = validateAttest("A", "B", {
    from: "A",
    to: "B",
    did: "audited the plan",
    auditOutput: "VERDICT: FAIL\nround 2 after fixes:\nVERDICT: PASS",
    auditVerdict: "pass",
  });
  assert.equal(r.ok, true);
});

test("hasFailVerdictTail detects only the last verdict-shaped line in the final five lines", () => {
  assert.equal(hasFailVerdictTail("notes\nVERDICT: FAIL"), true);
  assert.equal(hasFailVerdictTail("scanned for FAIL markers; none apply\nVERDICT: PASS"), false);
  assert.equal(hasFailVerdictTail("notes\nverdict = fail"), true);
  assert.equal(hasFailVerdictTail("VERDICT: FAIL\n1\n2\n3\n4\n5"), false);
  assert.equal(hasFailVerdictTail("VERDICT: FAIL\nround 2 after fixes:\nVERDICT: PASS"), false);
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

test("260714 wp2: coerceAttest carries trimmed planUnit/planPaths (drops wrong types)", () => {
  const a = coerceAttest({
    from: "P",
    to: "A",
    did: "x",
    planUnit: "  devlog/_plan/260714_slug  ",
    planPaths: ["  devlog/_plan/260714_slug/010_x.md ", 42, ""],
  });
  assert.equal(a?.planUnit, "devlog/_plan/260714_slug");
  assert.deepEqual(a?.planPaths, ["devlog/_plan/260714_slug/010_x.md"]);
  const b = coerceAttest({ from: "P", to: "A", did: "x", planUnit: 7, planPaths: "not-an-array" });
  assert.equal(b?.planUnit, undefined);
  assert.equal(b?.planPaths, undefined);
});

test("260714 wp4: validateWorkPhaseBinding — null target ok; missing id fails; mismatch fails; match ok", () => {
  // no goalplan bound (or empty plan) → HITL unchanged
  assert.equal(validateWorkPhaseBinding(null, null).ok, true);
  assert.equal(validateWorkPhaseBinding({ from: "P", to: "A", did: "x" }, null).ok, true);
  // bound: bare attest / missing field names the requirement
  const missing = validateWorkPhaseBinding(null, "wp2");
  assert.equal(missing.ok, false);
  assert.match(missing.reason ?? "", /workPhaseId/);
  assert.match(missing.reason ?? "", /LOOP-UNIT-CHAIN-01/);
  // mismatch names both ids
  const mismatch = validateWorkPhaseBinding({ from: "B", to: "C", did: "x", workPhaseId: "wp9" }, "wp2");
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.reason ?? "", /wp9/);
  assert.match(mismatch.reason ?? "", /wp2/);
  // match passes
  assert.equal(validateWorkPhaseBinding({ from: "B", to: "C", did: "x", workPhaseId: "wp2" }, "wp2").ok, true);
  // coercion carries the field
  assert.equal(coerceAttest({ from: "B", to: "C", did: "x", workPhaseId: " wp2 " })?.workPhaseId, "wp2");
});

test("WP3: coerceAttest carries trimmed audit fields (drops wrong types)", () => {
  const a = coerceAttest({
    from: "A",
    to: "B",
    did: "x",
    auditOutput: "  verdict tail  ",
    auditVerdict: " NEAR-PASS ",
    auditResidual: "  residuals folded  ",
    auditRounds: 2,
  });
  assert.equal(a?.auditOutput, "verdict tail");
  assert.equal(a?.auditVerdict, "near-pass");
  assert.equal(a?.auditResidual, "residuals folded");
  assert.equal(a?.auditRounds, 2);
  const b = coerceAttest({ from: "A", to: "B", did: "x", auditOutput: 42, auditRounds: "2" });
  assert.equal(b?.auditOutput, undefined);
  assert.equal(b?.auditRounds, undefined);
});

test("131: coerceAttest carries a typed override boolean (ignores non-boolean)", () => {
  const on = coerceAttest({ from: "I", to: "P", did: "accept", override: true });
  assert.equal(on?.override, true);
  const off = coerceAttest({ from: "I", to: "P", did: "x", override: "yes" });
  assert.equal(off?.override, undefined, "non-boolean override must be dropped");
  const none = coerceAttest({ from: "I", to: "P", did: "x" });
  assert.equal(none?.override, undefined);
});
