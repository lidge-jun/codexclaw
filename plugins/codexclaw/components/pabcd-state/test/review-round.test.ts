/**
 * review-round tests (WP10 / plan 010).
 *
 * The state machine is pure, so most cases assert directly on returned plans.
 * R15/R16 go through the real writeGoalplan/readGoalplan path because the whole
 * point of extending reviveGoalplan is that a new field survives the round trip
 * — the revive function enumerates known keys, so an unlisted field vanishes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGoalplan, readGoalplan, writeGoalplan, goalplanDir, type Goalplan } from "../src/goalplan.ts";
import {
  effectiveRound,
  markInFlight,
  markLaunching,
  openRound,
  recordVerdict,
  staleness,
  type ReviewRoundResult,
} from "../src/review-round.ts";

const PLAN_PATH = "devlog/_plan/x/010.md";
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

// buildGoalplan derives the slug from the objective and starts with no work
// phases, so read/write helpers below must use the derived slug, not a literal.
function plan(): Goalplan {
  const base = buildGoalplan({ objective: "review round fixture" });
  return { ...base, workPhases: [{ id: "wp1", title: "t", status: "pending", tasks: [], criteriaIds: [] }] };
}

const SLUG = buildGoalplan({ objective: "review round fixture" }).slug;

function ok(r: ReviewRoundResult): { plan: Goalplan; round: NonNullable<Extract<ReviewRoundResult, { kind: "ok" }>["round"]> } {
  assert.equal(r.kind, "ok", `expected ok, got ${r.kind}: ${"reason" in r ? r.reason : ""}`);
  const hit = r as Extract<ReviewRoundResult, { kind: "ok" }>;
  return { plan: hit.plan, round: hit.round };
}

function opened(p: Goalplan = plan(), sha = SHA_A) {
  return ok(openRound(p, { purpose: "plan_audit", planPath: PLAN_PATH, planSha256: sha }));
}

/** pending -> launching -> in_flight, the normal path to a verdict. */
function inFlight(p: Goalplan = plan()) {
  const first = opened(p);
  const launching = ok(markLaunching(first.plan, "plan_audit", first.round.roundId, first.round.lane.launchId, "/tmp/ws"));
  const flying = ok(markInFlight(launching.plan, "plan_audit", first.round.roundId, first.round.lane.launchId));
  return { plan: flying.plan, roundId: first.round.roundId, launchId: first.round.lane.launchId };
}

test("R1: opening the first round records the caller-supplied hash and sets the cursor", () => {
  const { plan: p, round } = opened();
  assert.equal(round.roundId, "r1");
  assert.equal(round.status, "pending");
  assert.equal(round.planSha256, SHA_A);
  assert.equal(round.purpose, "plan_audit");
  assert.equal(p.activePlanAuditRoundId, "r1");
  assert.equal(p.activeFinalGateRoundId, undefined);
  assert.ok(round.lane.launchId.length > 0);
});

test("R1b: an empty plan hash is invalid input, not a missing round", () => {
  const r = openRound(plan(), { purpose: "plan_audit", planPath: PLAN_PATH, planSha256: "" });
  assert.equal(r.kind, "invalid_input");
});

test("R2: a late verdict from a superseded round is stale and changes nothing", () => {
  const first = inFlight();
  const second = opened(first.plan, SHA_B);
  assert.equal(second.round.roundId, "r2");
  const late = recordVerdict(second.plan, {
    purpose: "plan_audit",
    roundId: first.roundId,
    launchId: first.launchId, // the CORRECT launch id for r1
    verdict: "pass",
  });
  assert.equal(late.kind, "stale");
  const r1 = (second.plan.reviewRounds ?? []).find((r) => r.roundId === "r1");
  assert.equal(r1?.status, "inconclusive");
  const r2 = (second.plan.reviewRounds ?? []).find((r) => r.roundId === "r2");
  assert.equal(r2?.status, "pending");
});

test("R2b: a stale launch id on the current round is stale", () => {
  const f = inFlight();
  const r = recordVerdict(f.plan, { purpose: "plan_audit", roundId: f.roundId, launchId: "bogus", verdict: "pass" });
  assert.equal(r.kind, "stale");
});

test("R3: a second verdict on the same round fails CAS and keeps the first", () => {
  const f = inFlight();
  const first = ok(recordVerdict(f.plan, { purpose: "plan_audit", roundId: f.roundId, launchId: f.launchId, verdict: "pass" }));
  const again = recordVerdict(first.plan, {
    purpose: "plan_audit",
    roundId: f.roundId,
    launchId: f.launchId,
    verdict: "fail",
  });
  // the cursor was cleared on close, so the round is no longer active
  assert.ok(again.kind === "not_found" || again.kind === "stale" || again.kind === "cas_failed");
  const stored = (first.plan.reviewRounds ?? []).find((r) => r.roundId === f.roundId);
  assert.equal(stored?.status, "approved");
  assert.equal(stored?.lane.verdict, "pass");
});

test("R3b: each verdict maps to its terminal status", () => {
  for (const [verdict, expected] of [
    ["pass", "approved"],
    ["near-pass", "approved"],
    ["fail", "changes_requested"],
  ] as const) {
    const f = inFlight();
    const done = ok(recordVerdict(f.plan, { purpose: "plan_audit", roundId: f.roundId, launchId: f.launchId, verdict }));
    assert.equal(done.round.status, expected, `${verdict} should close as ${expected}`);
    assert.ok(done.round.closedAt);
  }
});

test("R4: opening over an in_flight round closes it inconclusive", () => {
  const f = inFlight();
  const next = opened(f.plan, SHA_B);
  const prev = (next.plan.reviewRounds ?? []).find((r) => r.roundId === f.roundId);
  assert.equal(prev?.status, "inconclusive");
  assert.equal(next.round.roundId, "r2");
});

test("R5: opening over a launching round closes it inconclusive", () => {
  const first = opened();
  const launching = ok(markLaunching(first.plan, "plan_audit", first.round.roundId, first.round.lane.launchId, "/tmp/ws"));
  const next = opened(launching.plan, SHA_B);
  assert.equal((next.plan.reviewRounds ?? []).find((r) => r.roundId === "r1")?.status, "inconclusive");
  assert.equal(next.round.roundId, "r2");
});

test("R6: a pending round on the same document is reused with a refreshed hash", () => {
  const first = opened();
  const again = opened(first.plan, SHA_B);
  assert.equal(again.round.roundId, "r1");
  assert.equal(again.round.planSha256, SHA_B);
  assert.equal((again.plan.reviewRounds ?? []).length, 1);
});

test("R6b: a pending round on a different document is closed and replaced", () => {
  const first = opened();
  const other = ok(openRound(first.plan, { purpose: "plan_audit", planPath: "devlog/_plan/x/020.md", planSha256: SHA_B }));
  assert.equal(other.round.roundId, "r2");
  assert.equal((other.plan.reviewRounds ?? []).find((r) => r.roundId === "r1")?.status, "inconclusive");
});

test("R7: markInFlight cannot skip launching", () => {
  const first = opened();
  const r = markInFlight(first.plan, "plan_audit", first.round.roundId, first.round.lane.launchId);
  assert.equal(r.kind, "cas_failed");
  assert.equal((r as Extract<ReviewRoundResult, { kind: "cas_failed" }>).actual, "pending");
});

test("R8: recordVerdict cannot fire from launching", () => {
  const first = opened();
  const launching = ok(markLaunching(first.plan, "plan_audit", first.round.roundId, first.round.lane.launchId, "/tmp/ws"));
  const r = recordVerdict(launching.plan, {
    purpose: "plan_audit",
    roundId: first.round.roundId,
    launchId: first.round.lane.launchId,
    verdict: "pass",
  });
  assert.equal(r.kind, "cas_failed");
  assert.equal((r as Extract<ReviewRoundResult, { kind: "cas_failed" }>).actual, "launching");
});

test("R9: a final gate round opens alongside a live plan audit round", () => {
  const audit = inFlight();
  const gate = ok(openRound(audit.plan, { purpose: "final_gate", planPath: PLAN_PATH, planSha256: SHA_A }));
  assert.equal(gate.plan.activePlanAuditRoundId, audit.roundId);
  assert.equal(gate.plan.activeFinalGateRoundId, gate.round.roundId);
  assert.notEqual(gate.round.roundId, audit.roundId);
  // the plan audit round is untouched by opening a final gate round
  assert.equal((gate.plan.reviewRounds ?? []).find((r) => r.roundId === audit.roundId)?.status, "in_flight");
});

test("R10: a round missing its purpose is dropped, the rest survive", () => {
  const first = opened();
  const cwd = mkdtempSync(join(tmpdir(), "cxc-rr-"));
  writeGoalplan(cwd, first.plan);
  const file = join(goalplanDir(cwd, SLUG), "goalplan.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const list = raw.reviewRounds as Record<string, unknown>[];
  list.push({ ...list[0], roundId: "r99", purpose: undefined });
  writeFileSync(file, JSON.stringify(raw));
  const back = readGoalplan(cwd, SLUG);
  assert.equal(back?.reviewRounds?.length, 1);
  assert.equal(back?.reviewRounds?.[0]?.roundId, "r1");
});

test("R11: a verdict stores the source identity the reviewer saw", () => {
  const f = inFlight();
  const done = ok(
    recordVerdict(f.plan, {
      purpose: "plan_audit",
      roundId: f.roundId,
      launchId: f.launchId,
      verdict: "pass",
      artifactSha256: SHA_B,
      reviewerSession: "sess-1",
      sourceIdentity: { kind: "resolved", commitSha: "deadbee", dirty: false, capturedAt: "2026-01-01T00:00:00.000Z" },
    }),
  );
  assert.equal(done.round.lane.sourceIdentity?.commitSha, "deadbee");
  assert.equal(done.round.lane.artifactSha256, SHA_B);
  assert.equal(done.round.lane.reviewerSession, "sess-1");
});

test("R12: an unchanged plan hash is fresh", () => {
  const f = inFlight();
  const done = ok(recordVerdict(f.plan, { purpose: "plan_audit", roundId: f.roundId, launchId: f.launchId, verdict: "pass" }));
  assert.equal(staleness(done.plan, f.roundId, SHA_A), "fresh");
});

test("R13: a plan edited after approval reads stale (what a folded near-pass looks like)", () => {
  const f = inFlight();
  const done = ok(
    recordVerdict(f.plan, { purpose: "plan_audit", roundId: f.roundId, launchId: f.launchId, verdict: "near-pass" }),
  );
  assert.equal(done.round.status, "approved");
  assert.equal(staleness(done.plan, f.roundId, SHA_B), "stale");
});

test("R14: a round with no verdict yet is open, not fresh or stale", () => {
  const first = opened();
  assert.equal(staleness(first.plan, first.round.roundId, SHA_A), "open");
  assert.equal(staleness(first.plan, "nope", SHA_A), "open");
});

test("R14b: a dangling cursor recovers the live round from the list", () => {
  const first = opened();
  const broken: Goalplan = { ...first.plan, activePlanAuditRoundId: "r404" };
  assert.equal(effectiveRound(broken, "plan_audit")?.roundId, "r1");
});

test("R14c: with a dangling cursor and two open rounds the highest id wins, and opening closes both", () => {
  const first = opened();
  const forged: Goalplan = {
    ...first.plan,
    reviewRounds: [
      ...(first.plan.reviewRounds ?? []),
      { ...first.round, roundId: "r2", status: "in_flight" },
    ],
    // a usable cursor is trusted, so the recovery path only shows up once the
    // cursor itself is unusable
    activePlanAuditRoundId: "r404",
  };
  assert.equal(effectiveRound(forged, "plan_audit")?.roundId, "r2");
  const next = ok(openRound(forged, { purpose: "plan_audit", planPath: PLAN_PATH, planSha256: SHA_B }));
  assert.equal(next.round.roundId, "r3");
  for (const id of ["r1", "r2"]) {
    assert.equal((next.plan.reviewRounds ?? []).find((r) => r.roundId === id)?.status, "inconclusive");
  }
});

test("R14d: a usable cursor is trusted even when a higher open round exists", () => {
  const first = opened();
  const forged: Goalplan = {
    ...first.plan,
    reviewRounds: [...(first.plan.reviewRounds ?? []), { ...first.round, roundId: "r2", status: "in_flight" }],
    activePlanAuditRoundId: "r1",
  };
  assert.equal(effectiveRound(forged, "plan_audit")?.roundId, "r1");
});

test("R15: review rounds and both cursors survive a write/read round trip", () => {
  const f = inFlight();
  const done = ok(
    recordVerdict(f.plan, {
      purpose: "plan_audit",
      roundId: f.roundId,
      launchId: f.launchId,
      verdict: "pass",
      sourceIdentity: { kind: "resolved", commitSha: "cafe123", dirty: true, treeHash: SHA_B, capturedAt: "2026-01-01T00:00:00.000Z" },
    }),
  );
  const withGate = ok(openRound(done.plan, { purpose: "final_gate", planPath: PLAN_PATH, planSha256: SHA_A }));
  const cwd = mkdtempSync(join(tmpdir(), "cxc-rr-"));
  writeGoalplan(cwd, withGate.plan);
  const back = readGoalplan(cwd, SLUG);
  assert.equal(back?.reviewRounds?.length, 2);
  assert.equal(back?.activeFinalGateRoundId, withGate.round.roundId);
  assert.equal(back?.activePlanAuditRoundId, undefined, "a closed round clears its cursor");
  const stored = back?.reviewRounds?.find((r) => r.roundId === f.roundId);
  assert.equal(stored?.status, "approved");
  assert.equal(stored?.lane.sourceIdentity?.treeHash, SHA_B);
  assert.equal(stored?.lane.sourceIdentity?.dirty, true);
});

test("R16: a goalplan written before this feature reads back unchanged", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-rr-"));
  writeGoalplan(cwd, plan());
  const back = readGoalplan(cwd, SLUG);
  assert.equal(back?.reviewRounds, undefined);
  assert.equal(back?.activePlanAuditRoundId, undefined);
  assert.equal(back?.workPhases.length, 1);
});
