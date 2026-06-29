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

test("L10.2: autoResolveToAssumption moves contradiction -> recorded assumption + bumps counter", () => {
  const c: Contradiction = { contradictionId: "1-contrarian", severity: "low", summary: "x" };
  const r = autoResolveToAssumption([c], [], c, "Assume X holds (low severity)", 0);
  assert.equal(r.contradictions.length, 0);
  assert.equal(r.assumptions.length, 1);
  assert.equal(r.assumptions[0].recorded, true);
  assert.equal(r.assumptions[0].id, "1-contrarian");
  assert.equal(r.consecutiveAutoResolves, 1);
});
