import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHumanTransition } from "../src/orchestrate-apply.ts";
import { defaultState, type State } from "../src/state.ts";

function at(phase: State["phase"], partial: Partial<State["flags"]> = {}): State {
  return { ...defaultState("t"), phase, flags: { interview: false, auditPassed: false, checkPassed: false, ...partial } };
}

test("human free-pass advances forward edges WITHOUT attest", () => {
  // P->A and B->C need no flag; A->B/C->D get the flag pre-flipped.
  assert.equal(applyHumanTransition(at("P"), "A").state?.phase, "A");
  assert.equal(applyHumanTransition(at("A"), "B").state?.phase, "B");
  assert.equal(applyHumanTransition(at("B"), "C").state?.phase, "C");
  const cd = applyHumanTransition(at("C"), "D");
  assert.equal(cd.state?.phase, "D");
  assert.equal(cd.state?.flags.checkPassed, true);
});

test("illegal adjacency is refused (state unchanged, no ledger)", () => {
  const r = applyHumanTransition(at("P"), "C");
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /illegal transition/);
  assert.equal(r.state, undefined);
  assert.equal(r.ledger, undefined);
});

test("forward move emits a ledger entry with reason 'chat'", () => {
  const r = applyHumanTransition(at("P"), "A", { from: "P", to: "A", did: "wrote plan" });
  assert.equal(r.ledger?.to, "A");
  assert.equal(r.ledger?.reason, "chat");
  assert.equal(r.ledger?.evidence, "wrote plan");
});

test("reset from a mid-cycle phase clears flags and returns IDLE", () => {
  const r = applyHumanTransition(at("C", { auditPassed: true, checkPassed: true }), "reset");
  assert.equal(r.control, "reset");
  assert.equal(r.state?.phase, "IDLE");
  assert.equal(r.state?.flags.auditPassed, false);
  assert.equal(r.state?.flags.checkPassed, false);
  assert.equal(r.ledger?.reason, "reset");
});

test("reset from IDLE is a recognized no-op (no state, no ledger)", () => {
  const r = applyHumanTransition(at("IDLE"), "reset");
  assert.equal(r.ok, true);
  assert.equal(r.noop, true);
  assert.equal(r.state, undefined);
  assert.equal(r.ledger, undefined);
});

test("status is a read-only no-op", () => {
  const r = applyHumanTransition(at("B", { auditPassed: true }), "status");
  assert.equal(r.control, "status");
  assert.equal(r.state, undefined);
  assert.equal(r.ledger, undefined);
});

test("entering I clears stale gate flags (fresh cycle)", () => {
  // D->I is a legal edge; a stale human-flipped checkPassed must not leak in.
  const r = applyHumanTransition(at("D", { checkPassed: true, auditPassed: true }), "I");
  assert.equal(r.state?.phase, "I");
  assert.equal(r.state?.flags.checkPassed, false);
  assert.equal(r.state?.flags.auditPassed, false);
});
