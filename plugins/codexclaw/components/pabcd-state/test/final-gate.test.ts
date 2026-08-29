/**
 * validateGoalplan v2 final-gate checks (WP11 / plan 030).
 *
 * The gate exists because "every task done and every criterion has evidence"
 * used to be enough to complete a goal, even when nothing had reviewed the
 * result and even when the tree moved afterwards.
 *
 * This slice ships the verification core plus the read-only CLI consumer; the
 * lifecycle writer (final-gate open/verdict, marker writing, init at v2) and the
 * goal-gate deny wiring are a separate piece, so gates here are built as
 * fixtures.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGoalplan,
  computeQaRequired,
  effectiveSchemaVersion,
  goalplanDir,
  readGoalplan,
  schemaMarkerPath,
  validateGoalplan,
  writeGoalplan,
  type FinalGateState,
  type Goalplan,
  type GoalplanValidationCtx,
  type ReviewRoundState,
} from "../src/goalplan.ts";
import type { SourceIdentity } from "../src/source-identity.ts";

const HERE: SourceIdentity = { kind: "resolved", commitSha: "aaaaaaa", dirty: false, capturedAt: "2026-01-01T00:00:00.000Z" };
const ELSEWHERE: SourceIdentity = { kind: "resolved", commitSha: "bbbbbbb", dirty: false, capturedAt: "2026-01-01T00:00:00.000Z" };
const NOWHERE: SourceIdentity = { kind: "unavailable", commitSha: "", dirty: false, capturedAt: "2026-01-01T00:00:00.000Z" };

function round(over: Partial<ReviewRoundState> = {}): ReviewRoundState {
  return {
    roundId: "r1",
    purpose: "final_gate",
    planPath: "p.md",
    planSha256: "c".repeat(64),
    status: "approved",
    lane: { launchId: "r1-x", verdict: "pass", sourceIdentity: HERE },
    openedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function gate(over: Partial<FinalGateState> = {}): FinalGateState {
  return {
    status: "approved",
    reviewRoundId: "r1",
    sourceIdentity: HERE,
    testReceiptPath: ".codexclaw/evidence/test.json",
    verdict: "pass",
    qaRequired: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

/** A plan whose v1 checks all pass, so any failure below is a v2 failure. */
function plan(over: Partial<Goalplan> = {}): Goalplan {
  const base = buildGoalplan({ objective: "final gate fixture" });
  return {
    ...base,
    // buildGoalplan() declares v3 since wp2 (260829). The v1 tests below assert v1
    // semantics, so they pin the version instead of inheriting the new default;
    // the v2+ tests in this file override schemaVersion themselves.
    schemaVersion: 1,
    workPhases: [{ id: "wp1", title: "t", status: "done", tasks: [], criteriaIds: ["c-1"] }],
    criteria: [{ id: "c-1", scenario: "s", expectedEvidence: "e", capturedEvidence: "done", status: "met", surface: "logic" }],
    ...over,
  };
}

function ctx(cwd: string, current: SourceIdentity = HERE, receipts: Record<string, SourceIdentity | string> = {}): GoalplanValidationCtx {
  return {
    cwd,
    captureSourceIdentity: () => current,
    compareSource: (a, b) => {
      if (a.kind === "unavailable" || b.kind === "unavailable") return { kind: "unavailable", reason: "no git" };
      return a.commitSha === b.commitSha ? { kind: "same" } : { kind: "different", detail: `${a.commitSha} vs ${b.commitSha}` };
    },
    readReceipt: (path, expectedKind) => {
      const hit = receipts[`${expectedKind}:${path}`] ?? receipts[path];
      if (hit === undefined) return { sourceIdentity: HERE };
      if (typeof hit === "string") return { error: hit };
      return { sourceIdentity: hit };
    },
  };
}

function cwd(): string {
  return mkdtempSync(join(tmpdir(), "cxc-gate-"));
}

function reasons(p: Goalplan, c?: GoalplanValidationCtx): string {
  return validateGoalplan(p, c).reasons.join(" | ");
}

test("v1: a finished plan with no final gate still passes", () => {
  const v = validateGoalplan(plan());
  assert.equal(v.ok, true, v.reasons.join("; "));
});

test("v1: a criterion with an unknown surface is not a v1 problem", () => {
  const p = plan({ criteria: [{ id: "c-1", scenario: "s", expectedEvidence: "e", capturedEvidence: "d", status: "met" }] });
  assert.equal(validateGoalplan(p).ok, true);
});

test("v2 without a validation context refuses rather than passing quietly", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  const v = validateGoalplan(p);
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(" "), /without a validation context/);
});

test("v2 with everything in order passes", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  const v = validateGoalplan(p, ctx(cwd()));
  assert.equal(v.ok, true, v.reasons.join("; "));
});

test("v2 without a finalGate is a schema violation", () => {
  const p = plan({ schemaVersion: 2 });
  assert.match(reasons(p, ctx(cwd())), /requires a finalGate/);
});

test("v2 rejects a gate that is still pending or in flight", () => {
  for (const status of ["pending", "in_flight", "inconclusive"] as const) {
    const p = plan({ schemaVersion: 2, finalGate: gate({ status }), reviewRounds: [round()] });
    assert.match(reasons(p, ctx(cwd())), new RegExp(`final gate is ${status}`));
  }
});

test("v2 rejects a criterion with no valid surface", () => {
  const p = plan({
    schemaVersion: 2,
    finalGate: gate(),
    reviewRounds: [round()],
    criteria: [{ id: "c-1", scenario: "s", expectedEvidence: "e", capturedEvidence: "d", status: "met" }],
  });
  assert.match(reasons(p, ctx(cwd())), /no valid surface/);
});

test("v2 rejects an unknown surface the same way it rejects a missing one, after a round trip", () => {
  const dir = cwd();
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  writeGoalplan(dir, p);
  const file = join(goalplanDir(dir, p.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  (raw.criteria as Record<string, unknown>[])[0].surface = "api";
  writeFileSync(file, JSON.stringify(raw));
  const back = readGoalplan(dir, p.slug);
  assert.ok(back);
  assert.equal(back.criteria[0]?.surface, undefined, "revive must not normalize an unknown surface");
  assert.match(reasons(back, ctx(dir)), /no valid surface/);
});

test("v2 rejects a plan audit round standing in for the final gate", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round({ purpose: "plan_audit" })] });
  assert.match(reasons(p, ctx(cwd())), /plan audit cannot stand in/);
});

test("v2 rejects a round that is not approved", () => {
  for (const status of ["changes_requested", "inconclusive", "in_flight"] as const) {
    const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round({ status })] });
    assert.match(reasons(p, ctx(cwd())), new RegExp(`is ${status}, not approved`));
  }
});

test("v2 rejects a round with no verdict and a verdict that disagrees", () => {
  const noVerdict = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round({ lane: { launchId: "x", sourceIdentity: HERE } })] });
  assert.match(reasons(noVerdict, ctx(cwd())), /recorded no verdict/);

  const mismatch = plan({
    schemaVersion: 2,
    finalGate: gate({ verdict: "pass" }),
    reviewRounds: [round({ lane: { launchId: "x", verdict: "near-pass", sourceIdentity: HERE } })],
  });
  assert.match(reasons(mismatch, ctx(cwd())), /but the final gate says/);
});

test("v2 accepts a matching near-pass", () => {
  const p = plan({
    schemaVersion: 2,
    finalGate: gate({ verdict: "near-pass" }),
    reviewRounds: [round({ lane: { launchId: "x", verdict: "near-pass", sourceIdentity: HERE } })],
  });
  assert.equal(validateGoalplan(p, ctx(cwd())).ok, true);
});

test("v2 rejects a missing reviewRoundId and one that names no round", () => {
  const none = plan({ schemaVersion: 2, finalGate: gate({ reviewRoundId: undefined }), reviewRounds: [round()] });
  assert.match(reasons(none, ctx(cwd())), /no reviewRoundId/);

  const ghost = plan({ schemaVersion: 2, finalGate: gate({ reviewRoundId: "r9" }), reviewRounds: [round()] });
  assert.match(reasons(ghost, ctx(cwd())), /not in the plan/);
});

test("v2 rejects a gate with no recorded source identity", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate({ sourceIdentity: undefined }), reviewRounds: [round()] });
  assert.match(reasons(p, ctx(cwd())), /must record the tree it approved/);
});

test("v2 rejects an approval made against a different tree", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate({ sourceIdentity: ELSEWHERE }), reviewRounds: [round()] });
  assert.match(reasons(p, ctx(cwd())), /final gate describes a different source/);
});

test("v2 rejects a reviewer who looked at a different tree", () => {
  const p = plan({
    schemaVersion: 2,
    finalGate: gate(),
    reviewRounds: [round({ lane: { launchId: "x", verdict: "pass", sourceIdentity: ELSEWHERE } })],
  });
  assert.match(reasons(p, ctx(cwd())), /the reviewer describes a different source/);
});

test("v2 rejects a receipt produced against a different tree", () => {
  const dir = cwd();
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  assert.match(reasons(p, ctx(dir, HERE, { "test:.codexclaw/evidence/test.json": ELSEWHERE })), /test receipt describes a different source/);
});

test("v2 reports a receipt the parser refused", () => {
  const dir = cwd();
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  assert.match(reasons(p, ctx(dir, HERE, { "test:.codexclaw/evidence/test.json": "kind mismatch" })), /test receipt is not usable/);
});

test("v2 rejects a missing test receipt path", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate({ testReceiptPath: undefined }), reviewRounds: [round()] });
  assert.match(reasons(p, ctx(cwd())), /test receipt path is missing/);
});

test("a web criterion demands a QA receipt even after the work phase cursor is gone", () => {
  const p = plan({
    schemaVersion: 2,
    activeWorkPhaseId: null,
    criteria: [{ id: "c-1", scenario: "s", expectedEvidence: "e", capturedEvidence: "d", status: "met", surface: "web" }],
    finalGate: gate({ qaRequired: true, qaReceiptPath: undefined }),
    reviewRounds: [round()],
  });
  assert.match(reasons(p, ctx(cwd())), /QA receipt path is missing/);
});

test("a logic-only plan needs no QA receipt", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  assert.equal(validateGoalplan(p, ctx(cwd())).ok, true);
});

test("adding a web criterion after the gate opened forces a re-open", () => {
  const p = plan({
    schemaVersion: 2,
    criteria: [{ id: "c-1", scenario: "s", expectedEvidence: "e", capturedEvidence: "d", status: "met", surface: "web" }],
    finalGate: gate({ qaRequired: false }),
    reviewRounds: [round()],
  });
  assert.match(reasons(p, ctx(cwd())), /criteria changed after the gate opened/);
});

test("v2 cannot be certified without git", () => {
  const p = plan({ schemaVersion: 2, finalGate: gate({ sourceIdentity: NOWHERE }), reviewRounds: [round()] });
  assert.match(reasons(p, ctx(cwd(), NOWHERE)), /cannot be certified without git; use the v1 flow/);
});

test("v1 is untouched when git is unavailable", () => {
  assert.equal(validateGoalplan(plan(), ctx(cwd(), NOWHERE)).ok, true);
});

test("a capture failure becomes a reason, not an exception", () => {
  const dir = cwd();
  const broken: GoalplanValidationCtx = {
    ...ctx(dir),
    captureSourceIdentity: () => {
      throw new Error("git exploded");
    },
  };
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  assert.match(reasons(p, broken), /could not capture the current source identity: git exploded/);
});

test("the marker promotes a plan that still claims v1, and refuses the downgrade", () => {
  const dir = cwd();
  const p = plan({ finalGate: gate(), reviewRounds: [round()] });
  mkdirSync(goalplanDir(dir, p.slug), { recursive: true });
  writeFileSync(schemaMarkerPath(dir, p.slug), "promoted");
  assert.match(reasons(p, ctx(dir)), /restore "schemaVersion": 2/);
});

test("marker and plan agreeing at v2 validates normally", () => {
  const dir = cwd();
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  mkdirSync(goalplanDir(dir, p.slug), { recursive: true });
  writeFileSync(schemaMarkerPath(dir, p.slug), "promoted");
  assert.equal(validateGoalplan(p, ctx(dir)).ok, true);
});

test("no marker and no schemaVersion is genuinely legacy", () => {
  assert.equal(effectiveSchemaVersion(plan(), false), 1);
  assert.equal(effectiveSchemaVersion(plan(), true), 2);
  assert.equal(effectiveSchemaVersion(plan({ schemaVersion: 3 }), true), 3);
});

test("computeQaRequired scans the whole plan", () => {
  assert.equal(computeQaRequired(plan()), false);
  const web = plan({ criteria: [{ id: "c-1", scenario: "s", expectedEvidence: "e", capturedEvidence: "d", status: "met", surface: "tui" }] });
  assert.equal(computeQaRequired(web), true);
});

test("finalGate, schemaVersion and surface survive a write/read round trip", () => {
  const dir = cwd();
  const p = plan({ schemaVersion: 2, finalGate: gate({ qaRequired: true, qaReceiptPath: ".codexclaw/evidence/qa.json" }), reviewRounds: [round()] });
  writeGoalplan(dir, p);
  const back = readGoalplan(dir, p.slug);
  assert.equal(back?.schemaVersion, 2);
  assert.equal(back?.finalGate?.qaRequired, true);
  assert.equal(back?.finalGate?.qaReceiptPath, ".codexclaw/evidence/qa.json");
  assert.equal(back?.finalGate?.sourceIdentity?.commitSha, "aaaaaaa");
  assert.equal(back?.criteria[0]?.surface, "logic");
});

test("a finalGate missing qaRequired is dropped rather than half-trusted", () => {
  const dir = cwd();
  const p = plan({ schemaVersion: 2, finalGate: gate(), reviewRounds: [round()] });
  writeGoalplan(dir, p);
  const file = join(goalplanDir(dir, p.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  delete (raw.finalGate as Record<string, unknown>).qaRequired;
  writeFileSync(file, JSON.stringify(raw));
  const back = readGoalplan(dir, p.slug);
  assert.equal(back?.finalGate, undefined);
  assert.match(reasons(back as Goalplan, ctx(dir)), /requires a finalGate/);
});
