import { test } from "node:test";
import assert from "node:assert/strict";
import { canEnter, nextPhase, ORDER, isAuditGateOpen, isBuildGateOpen, isDone } from "../src/fsm.ts";
import { VALID_TRANSITIONS, isLegalEdge } from "../src/fsm.ts";
import { defaultState, type State } from "../src/state.ts";

function withFlags(partial: Partial<State["flags"]>, phase: State["phase"] = "I"): State {
  return { ...defaultState("t"), phase, flags: { interview: false, auditPassed: false, checkPassed: false, ...partial } };
}

test("I->P blocked without interview flag, allowed with it", () => {
  assert.equal(canEnter("P", withFlags({ interview: false })).ok, false);
  assert.equal(canEnter("P", withFlags({ interview: true })).ok, true);
});

test("A enterable from P (legal edge), illegal from I", () => {
  // L2: A is only reachable from P per VALID_TRANSITIONS; I->A is illegal.
  assert.equal(canEnter("A", withFlags({}, "P")).ok, true);
  assert.equal(canEnter("A", withFlags({}, "I")).ok, false);
});

test("B blocked without auditPassed (from A)", () => {
  assert.equal(canEnter("B", withFlags({ auditPassed: false }, "A")).ok, false);
  assert.equal(canEnter("B", withFlags({ auditPassed: true }, "A")).ok, true);
});

test("D blocked without checkPassed (from C)", () => {
  assert.equal(canEnter("D", withFlags({ checkPassed: false }, "C")).ok, false);
  assert.equal(canEnter("D", withFlags({ checkPassed: true }, "C")).ok, true);
});

test("nextPhase follows ORDER and closes D->IDLE (R-4)", () => {
  assert.equal(nextPhase(withFlags({}, "I")), "P");
  assert.equal(nextPhase(withFlags({}, "C")), "D");
  assert.equal(nextPhase(withFlags({}, "D")), "IDLE");
});

test("ORDER is the canonical I..D sequence", () => {
  assert.deepEqual([...ORDER], ["I", "P", "A", "B", "C", "D"]);
});

test("gate helpers", () => {
  assert.equal(isAuditGateOpen(withFlags({}, "A")), true);
  assert.equal(isAuditGateOpen(withFlags({ auditPassed: true }, "B")), true);
  assert.equal(isBuildGateOpen(withFlags({ auditPassed: false })), false);
  assert.equal(isDone(withFlags({ checkPassed: true }, "D")), true);
  assert.equal(isDone(withFlags({ checkPassed: true }, "C")), false);
});

// ── L1.4: IDLE/complete + structural attest enforcement (007 R-2/R-4) ──
import { transition, isIdle } from "../src/fsm.ts";

test("defaultState rests at IDLE (R-4 closed state)", () => {
  assert.equal(defaultState("t").phase, "IDLE");
  assert.equal(isIdle(defaultState("t")), true);
});

test("IDLE->P is allowed without interview; nextPhase(D)=IDLE", () => {
  assert.equal(canEnter("P", withFlags({}, "IDLE")).ok, true);
  assert.equal(nextPhase(withFlags({}, "D")), "IDLE");
  assert.equal(nextPhase(withFlags({}, "IDLE")), null);
});

test("transition A->B is rejected without a valid attestation (R-2)", () => {
  const r = transition(withFlags({}, "A"), "B");
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /attestation|did/i);
});

test("transition A->B flips auditPassed only with did + auditOutput + auditVerdict (WP3)", () => {
  // did alone is rejected — the audit gate needs the reviewer verdict paste
  const noAudit = transition(withFlags({}, "A"), "B", { from: "A", to: "B", did: "challenged the plan" });
  assert.equal(noAudit.ok, false);
  assert.match(noAudit.reason ?? "", /auditOutput/);
  const noVerdict = transition(withFlags({}, "A"), "B", {
    from: "A",
    to: "B",
    did: "challenged the plan",
    auditOutput: "reviewer verdict: GO; no blockers",
  });
  assert.equal(noVerdict.ok, false);
  assert.match(noVerdict.reason ?? "", /auditVerdict/);
  const r = transition(withFlags({}, "A"), "B", {
    from: "A",
    to: "B",
    did: "challenged the plan",
    auditOutput: "reviewer verdict: GO; no blockers",
    auditVerdict: "pass",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state?.phase, "B");
  assert.equal(r.state?.flags.auditPassed, true);
});

test("transition C->D requires passing checkOutput, then flips checkPassed", () => {
  const fail = transition(withFlags({}, "C"), "D", { from: "C", to: "D", did: "ran tests", checkOutput: "x", exitCode: 1 });
  assert.equal(fail.ok, false);
  const ok = transition(withFlags({}, "C"), "D", { from: "C", to: "D", did: "ran tests", checkOutput: "77 pass", exitCode: 0 });
  assert.equal(ok.ok, true);
  assert.equal(ok.state?.flags.checkPassed, true);
});

test("transition D->IDLE closes the cycle and resets gate flags", () => {
  const closed = transition(withFlags({ auditPassed: true, checkPassed: true }, "D"), "IDLE");
  assert.equal(closed.ok, true);
  assert.equal(closed.state?.phase, "IDLE");
  assert.equal(closed.state?.flags.auditPassed, false);
  assert.equal(closed.state?.flags.checkPassed, false);
  assert.equal(closed.state?.orchestrationActive, false);
});

// ── L8.2: flags.interview derived from readiness predicate ──
import { deriveInterviewFlag } from "../src/fsm.ts";
import { defaultInterview, DIMENSIONS as FSM_DIMENSIONS } from "../src/interview.ts";

test("deriveInterviewFlag: false when tracker not ready, true when ready; canEnter(P) follows", () => {
  const base = defaultState("t");
  // no tracker -> flag false -> P blocked (from I)
  const noTracker = deriveInterviewFlag({ ...base, phase: "I" });
  assert.equal(noTracker.flags.interview, false);
  assert.equal(canEnter("P", noTracker).ok, false);
  // ready tracker -> flag true -> P allowed
  const tracker = defaultInterview("r");
  for (const d of FSM_DIMENSIONS) tracker.dimensions[d] = { level: "max", known: [], unknown: [], confidence: 1 };
  // 131/D2': readiness requires scan-evidence too.
  tracker.scanRounds = 1;
  const ready = deriveInterviewFlag({ ...base, phase: "I", interview: tracker });
  assert.equal(ready.flags.interview, true);
  assert.equal(canEnter("P", ready).ok, true);
});

// ── L2/020: legal-transition adjacency table ──

test("VALID_TRANSITIONS matches the cli-jaw table byte-for-byte", () => {
  assert.deepEqual(VALID_TRANSITIONS, {
    IDLE: ["I", "P"],
    I: ["P", "IDLE"],
    P: ["I", "A"],
    A: ["I", "B"],
    B: ["I", "C"],
    C: ["I", "D", "B", "P"],
    D: ["I", "IDLE"],
  });
});

test("isLegalEdge: legal forward + backward edges, illegal jumps", () => {
  // legal forward
  for (const [from, to] of [["IDLE", "P"], ["P", "A"], ["A", "B"], ["B", "C"], ["C", "D"], ["D", "IDLE"]] as const) {
    assert.equal(isLegalEdge(from, to), true, `${from}->${to} should be legal`);
  }
  // legal backward / replan
  assert.equal(isLegalEdge("C", "B"), true);
  assert.equal(isLegalEdge("C", "P"), true);
  // illegal jumps
  for (const [from, to] of [["IDLE", "A"], ["IDLE", "B"], ["I", "A"], ["P", "C"], ["A", "D"], ["B", "D"]] as const) {
    assert.equal(isLegalEdge(from, to), false, `${from}->${to} should be illegal`);
  }
});

test("canEnter rejects illegal jumps with an 'illegal transition' reason", () => {
  const r = canEnter("A", withFlags({}, "IDLE"));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /illegal transition IDLE->A/);
});

test("positive gate flags do NOT bypass adjacency", () => {
  // auditPassed cannot authorize I->B; checkPassed cannot authorize I->D.
  assert.equal(canEnter("B", withFlags({ auditPassed: true }, "I")).ok, false);
  assert.equal(canEnter("D", withFlags({ checkPassed: true }, "I")).ok, false);
});

test("only D and I may close to IDLE; mid-cycle ->IDLE is illegal", () => {
  assert.equal(canEnter("IDLE", withFlags({}, "D")).ok, true);
  assert.equal(canEnter("IDLE", withFlags({}, "I")).ok, true);
  for (const from of ["P", "A", "B", "C"] as const) {
    assert.equal(canEnter("IDLE", withFlags({}, from)).ok, false, `${from}->IDLE should be illegal`);
  }
});

test("C->P (replan) is legal without the interview flag; C->B (rebuild) still needs auditPassed", () => {
  // Replan: C->P is a legal adjacency and must not demand the interview flag.
  assert.equal(canEnter("P", withFlags({ interview: false }, "C")).ok, true);
  // Rebuild: C->B is a legal adjacency, but B entry is still flag-gated on
  // auditPassed (which is already true mid-loop after A->B). Without it, blocked.
  assert.equal(canEnter("B", withFlags({ auditPassed: false }, "C")).ok, false);
  assert.equal(canEnter("B", withFlags({ auditPassed: true }, "C")).ok, true);
});

test("every nextPhase() output is a legal edge of its from-state", () => {
  for (const from of ["I", "P", "A", "B", "C", "D"] as const) {
    const to = nextPhase(withFlags({}, from));
    if (to !== null) {
      assert.equal(isLegalEdge(from, to), true, `nextPhase(${from})=${to} must be a legal edge`);
    }
  }
});

test("transition B->C rejected without attest, accepted with a real did", () => {
  const blocked = transition(withFlags({ auditPassed: true }, "B"), "C");
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason ?? "", /attestation|did/i);
  const ok = transition(withFlags({ auditPassed: true }, "B"), "C", { from: "B", to: "C", did: "implemented the audited plan" });
  assert.equal(ok.ok, true);
  assert.equal(ok.state?.phase, "C");
});

test("transition P->A is now gated: rejected without attest, accepted with a real did", () => {
  const blocked = transition(withFlags({}, "P"), "A");
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason ?? "", /attestation|did/i);
  const ok = transition(withFlags({}, "P"), "A", { from: "P", to: "A", did: "wrote the diff-level plan" });
  assert.equal(ok.ok, true);
  assert.equal(ok.state?.phase, "A");
});
