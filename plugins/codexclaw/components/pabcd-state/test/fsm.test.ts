import { test } from "node:test";
import assert from "node:assert/strict";
import { canEnter, nextPhase, ORDER, isAuditGateOpen, isBuildGateOpen, isDone } from "../src/fsm.ts";
import { defaultState, type State } from "../src/state.ts";

function withFlags(partial: Partial<State["flags"]>, phase: State["phase"] = "I"): State {
  return { ...defaultState("t"), phase, flags: { interview: false, auditPassed: false, checkPassed: false, ...partial } };
}

test("I->P blocked without interview flag, allowed with it", () => {
  assert.equal(canEnter("P", withFlags({ interview: false })).ok, false);
  assert.equal(canEnter("P", withFlags({ interview: true })).ok, true);
});

test("A is always enterable (plan exists once P done)", () => {
  assert.equal(canEnter("A", withFlags({})).ok, true);
});

test("B blocked without auditPassed", () => {
  assert.equal(canEnter("B", withFlags({ auditPassed: false })).ok, false);
  assert.equal(canEnter("B", withFlags({ auditPassed: true })).ok, true);
});

test("D blocked without checkPassed", () => {
  assert.equal(canEnter("D", withFlags({ checkPassed: false })).ok, false);
  assert.equal(canEnter("D", withFlags({ checkPassed: true })).ok, true);
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

test("transition A->B flips auditPassed only with a real did", () => {
  const r = transition(withFlags({}, "A"), "B", { from: "A", to: "B", did: "challenged the plan" });
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
  const ready = deriveInterviewFlag({ ...base, phase: "I", interview: tracker });
  assert.equal(ready.flags.interview, true);
  assert.equal(canEnter("P", ready).ok, true);
});
