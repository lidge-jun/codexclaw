import { test } from "node:test";
import assert from "node:assert/strict";
import {
  triageContradiction,
  autoResolveToAssumption,
  AUTO_RESOLVE_RHYTHM_LIMIT,
} from "../src/triage.ts";
import type { Contradiction } from "../src/interview.ts";

test("L10.2: low/medium -> recorded assumption; high (manual) -> ask_user", () => {
  assert.equal(triageContradiction("low", "manual", 0).action, "record_assumption");
  assert.equal(triageContradiction("medium", "manual", 0).action, "record_assumption");
  assert.equal(triageContradiction("high", "manual", 0).action, "ask_user");
});

test("L10.2: high severity in manual interview CANNOT be safe-defaulted", () => {
  const d = triageContradiction("high", "manual", 0);
  assert.equal(d.action, "ask_user");
  assert.equal(d.assumptionSeverity, undefined);
});

test("L10.2: goal-backfill high -> high-severity recorded assumption requiring review", () => {
  const d = triageContradiction("high", "goal-backfill", 0);
  assert.equal(d.action, "record_assumption");
  assert.equal(d.assumptionSeverity, "high");
});

test("L10.2: rhythm guard escalates after N consecutive auto-resolves", () => {
  // below the limit a low stays auto
  assert.equal(triageContradiction("low", "manual", AUTO_RESOLVE_RHYTHM_LIMIT - 1).action, "record_assumption");
  // at the limit, even a low is escalated to the user
  assert.equal(triageContradiction("low", "manual", AUTO_RESOLVE_RHYTHM_LIMIT).action, "ask_user");
});

test("L10.2: autoResolveToAssumption moves contradiction -> recorded assumption (with write proof) + bumps counter", () => {
  const c: Contradiction = { contradictionId: "1-contrarian", severity: "low", summary: "x" };
  const r = autoResolveToAssumption({
    contradictions: [c], assumptions: [], target: c,
    assumptionText: "Assume X holds (low severity)", consecutiveAutoResolves: 0,
    writtenToOpenAssumptions: true,
  });
  assert.equal(r.contradictions.length, 0);
  assert.equal(r.assumptions.length, 1);
  assert.equal(r.assumptions[0].recorded, true);
  assert.equal(r.assumptions[0].id, "1-contrarian");
  assert.equal(r.assumptions[0].severity, "low"); // severity carried
  assert.equal(r.consecutiveAutoResolves, 1);
});

test("L10.2: autoResolveToAssumption WITHOUT write proof -> recorded:false (fail-closed)", () => {
  const c: Contradiction = { contradictionId: "2-evaluator", severity: "high", summary: "y" };
  const r = autoResolveToAssumption({
    contradictions: [c], assumptions: [], target: c,
    assumptionText: "deferred high gap", consecutiveAutoResolves: 0,
    writtenToOpenAssumptions: false, requiresUserReview: true,
  });
  assert.equal(r.assumptions[0].recorded, false); // no proof -> not recorded -> keeps blocking readiness
  assert.equal(r.assumptions[0].requiresUserReview, true);
  assert.equal(r.assumptions[0].severity, "high"); // goal-backfill review metadata retained
});

test("L10.2: autoResolveToAssumption does not mutate input arrays", () => {
  const c: Contradiction = { contradictionId: "3-socratic", severity: "medium", summary: "z" };
  const contradictions = [c];
  const assumptions: never[] = [];
  autoResolveToAssumption({ contradictions, assumptions, target: c, assumptionText: "t", consecutiveAutoResolves: 0, writtenToOpenAssumptions: true });
  assert.equal(contradictions.length, 1); // unchanged
  assert.equal(assumptions.length, 0);
});
