import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHumanTransition } from "../src/orchestrate-apply.ts";
import { defaultState, type State } from "../src/state.ts";
import { defaultInterview, DIMENSIONS, type InterviewTracker } from "../src/interview.ts";

function at(phase: State["phase"], partial: Partial<State["flags"]> = {}): State {
  return { ...defaultState("t"), phase, flags: { interview: false, auditPassed: false, checkPassed: false, ...partial } };
}

test("human free-pass advances forward edges WITHOUT attest", () => {
  // P->A and B->C need no flag; A->B/C->D get the flag pre-flipped.
  assert.equal(applyHumanTransition(at("P"), "A").state?.phase, "A");
  assert.equal(applyHumanTransition(at("A"), "B").state?.phase, "B");
  assert.equal(applyHumanTransition(at("B"), "C").state?.phase, "C");
  // L5: human D closes the cycle (C->D->IDLE atomically); D is not a resting state.
  const cd = applyHumanTransition(at("C"), "D");
  assert.equal(cd.control, "done");
  assert.equal(cd.state?.phase, "IDLE");
  assert.equal(cd.state?.flags.checkPassed, false); // cleared on close
  assert.equal(cd.ledger?.to, "IDLE");
  assert.equal(cd.ledger?.reason, "done");
});

test("human D from a non-C phase is refused (only C->D closes)", () => {
  assert.equal(applyHumanTransition(at("B"), "D").ok, false);
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

// ── 131/D2': I->P soft-gate ─────────────────────────────────────────────────

function readyTracker(): InterviewTracker {
  const t = defaultInterview("r1");
  for (const d of DIMENSIONS) t.dimensions[d] = { level: "max", known: ["x"], unknown: [], confidence: 1 };
  t.scanRounds = 1;
  t.lastScanRoundId = 1;
  return t;
}

function atI(interview: InterviewTracker | null): State {
  return { ...defaultState("t"), phase: "I", interview, flags: { interview: false, auditPassed: false, checkPassed: false } };
}

test("soft-gate: ready interview advances I->P", () => {
  const r = applyHumanTransition(atI(readyTracker()), "P");
  assert.equal(r.ok, true);
  assert.equal(r.state?.phase, "P");
  assert.equal(r.state?.flags.interview, true);
});

test("soft-gate: no scan recorded -> advise-block (not generic adjacency error)", () => {
  const t = readyTracker();
  t.scanRounds = 0; // a scan never ran
  t.lastScanRoundId = 0;
  const r = applyHumanTransition(atI(t), "P");
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /soft-gate/);
  assert.match(r.reason ?? "", /scan/);
});

test("soft-gate: high contradiction open -> advise-block", () => {
  const t = readyTracker();
  t.contradictions = [{ contradictionId: "c1", severity: "high", summary: "x" }];
  const r = applyHumanTransition(atI(t), "P");
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /high-severity/);
});

test("soft-gate: explicit override advances + records an audit ledger entry", () => {
  const t = readyTracker();
  t.scanRounds = 0; // unready
  const r = applyHumanTransition(atI(t), "P", { from: "I", to: "P", did: "accept risk, proceeding", override: true });
  assert.equal(r.ok, true);
  assert.equal(r.state?.phase, "P");
  assert.equal(r.ledger?.override, true);
  assert.equal(r.ledger?.actor, "human");
  assert.equal(r.ledger?.scanEvidence?.scanRounds, 0);
  assert.equal(r.ledger?.evidence, "accept risk, proceeding");
});

test("soft-gate: override is goal-mode-agnostic (operates purely on tracker state)", () => {
  // The soft-gate reads only the tracker; it does not consult goal status, so the
  // same override behavior holds regardless of any goal-mode context.
  const t = readyTracker();
  t.contradictions = [{ contradictionId: "c1", severity: "high", summary: "x" }];
  const blocked = applyHumanTransition(atI(t), "P");
  assert.equal(blocked.ok, false);
  const overridden = applyHumanTransition(atI(t), "P", { from: "I", to: "P", did: "go", override: true });
  assert.equal(overridden.ok, true);
  assert.equal(overridden.ledger?.scanEvidence?.highContradictionCount, 1);
});
