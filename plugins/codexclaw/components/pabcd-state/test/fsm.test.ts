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

test("nextPhase follows ORDER and terminates at D", () => {
  assert.equal(nextPhase(withFlags({}, "I")), "P");
  assert.equal(nextPhase(withFlags({}, "C")), "D");
  assert.equal(nextPhase(withFlags({}, "D")), null);
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
