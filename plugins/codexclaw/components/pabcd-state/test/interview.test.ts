import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIMENSIONS,
  MAX_TRACKER_ARRAY,
  defaultInterview,
  reconstructInterview,
  isInterviewReady,
  evaluateInterviewGate,
  type InterviewTracker,
} from "../src/interview.ts";

function readyTracker(): InterviewTracker {
  const t = defaultInterview("r1");
  for (const d of DIMENSIONS) t.dimensions[d] = { level: "max", known: ["x"], unknown: [], confidence: 1 };
  // 131/D2': readiness now also requires scan-evidence (a contradiction scan ran).
  t.scanRounds = 1;
  t.lastScanRoundId = 1;
  return t;
}

test("DIMENSIONS are the four IPABCD interview axes in order", () => {
  assert.deepEqual([...DIMENSIONS], ["goal", "constraint", "success", "ontology"]);
});

test("defaultInterview is not ready (all dimensions low)", () => {
  assert.equal(isInterviewReady(defaultInterview()), false);
});

test("isInterviewReady: true only for all-max + no contradictions + recorded assumptions", () => {
  const t = readyTracker();
  assert.equal(isInterviewReady(t), true);
  // any non-max dimension -> false
  t.dimensions.goal.level = "high";
  assert.equal(isInterviewReady(t), false);
});

test("isInterviewReady: a single contradiction blocks readiness", () => {
  const t = readyTracker();
  t.contradictions = [{ contradictionId: "c1", severity: "low", summary: "x" }];
  assert.equal(isInterviewReady(t), false);
});

test("isInterviewReady: an unrecorded assumption blocks readiness", () => {
  const t = readyTracker();
  t.assumptions = [{ id: "a1", text: "assume X", recorded: false }];
  assert.equal(isInterviewReady(t), false);
  t.assumptions[0].recorded = true;
  assert.equal(isInterviewReady(t), true);
});

test("isInterviewReady: null/malformed -> false (fail-closed)", () => {
  assert.equal(isInterviewReady(null), false);
  assert.equal(isInterviewReady({} as unknown as InterviewTracker), false);
});

// ── 131/D2': scan-evidence readiness + soft-gate evaluation ──

test("131: scan-evidence is required for readiness (scanRounds:0 blocks, :1 allows)", () => {
  const t = readyTracker();
  t.scanRounds = 0;
  assert.equal(isInterviewReady(t), false, "maxed dims + empty contradictions but no scan -> NOT ready");
  t.scanRounds = 1;
  assert.equal(isInterviewReady(t), true);
});

test("131: reconstruct defaults scan fields to 0 (legacy trackers are not silently ready)", () => {
  const dims = {} as Record<string, unknown>;
  for (const d of DIMENSIONS) dims[d] = { level: "max", known: ["k"], unknown: [], confidence: 1 };
  // legacy persisted tracker WITHOUT scanRounds/lastScanRoundId
  const r = reconstructInterview({ roundId: 1, dimensions: dims, contradictions: [], assumptions: [{ id: "a", text: "x", recorded: true }] });
  assert.equal(r?.scanRounds, 0);
  assert.equal(r?.lastScanRoundId, 0);
  assert.equal(isInterviewReady(r), false, "legacy ready-shaped tracker must not pass without scan-evidence");
});

test("131: evaluateInterviewGate reports scanRan/high-contradiction/warnings", () => {
  const t = readyTracker();
  const ok = evaluateInterviewGate(t);
  assert.equal(ok.ready, true);
  assert.equal(ok.scanRan, true);
  assert.equal(ok.highContradictionCount, 0);
  assert.equal(ok.warnings.length, 0);

  t.scanRounds = 0;
  t.contradictions = [{ contradictionId: "c1", severity: "high", summary: "x" }];
  const bad = evaluateInterviewGate(t);
  assert.equal(bad.ready, false);
  assert.equal(bad.scanRan, false);
  assert.equal(bad.highContradictionCount, 1);
  assert.ok(bad.warnings.length >= 2);

  assert.equal(evaluateInterviewGate(null).ready, false);
});

test("reconstructInterview: null/non-object -> null", () => {
  assert.equal(reconstructInterview(null), null);
  assert.equal(reconstructInterview(undefined), null);
  assert.equal(reconstructInterview("nope"), null);
  assert.equal(reconstructInterview(42), null);
});

test("reconstructInterview: invalid level->low, invalid confidence->0 (T3 fail-closed)", () => {
  const r = reconstructInterview({
    roundId: "r",
    dimensions: { goal: { level: "ZZZ", confidence: 9, known: "bad", unknown: ["ok"] } },
  });
  assert.equal(r?.dimensions.goal.level, "low");
  assert.equal(r?.dimensions.goal.confidence, 0);
  assert.deepEqual(r?.dimensions.goal.known, []); // non-array known dropped
  assert.deepEqual(r?.dimensions.goal.unknown, ["ok"]);
  assert.equal(isInterviewReady(r), false);
});

test("reconstructInterview: legacy assumption w/o recorded -> recorded:false (T3)", () => {
  const r = reconstructInterview({ assumptions: [{ id: "a", text: "t" }] });
  assert.equal(r?.assumptions[0].recorded, false);
});

test("reconstructInterview: unknown contradiction severity -> high (blocks readiness)", () => {
  const r = reconstructInterview({ contradictions: [{ id: "c", severity: "weird", summary: "s" }] });
  assert.equal(r?.contradictions[0].severity, "high");
});

test("reconstructInterview: arrays capped at MAX_TRACKER_ARRAY (T2)", () => {
  const big = Array.from({ length: MAX_TRACKER_ARRAY + 20 }, (_, i) => ({ contradictionId: `c${i}`, severity: "low", summary: "s" }));
  const r = reconstructInterview({ contradictions: big });
  assert.equal(r?.contradictions.length, MAX_TRACKER_ARRAY);
  // drop-oldest: the last item survives
  assert.equal(r?.contradictions.at(-1)?.contradictionId, `c${MAX_TRACKER_ARRAY + 19}`);
});

// ── L8 A-gate regression: reviewer blockers (T3 fail-closed) ──
import { normalizeInterview } from "../src/interview.ts";

test("CRITICAL-1: malformed persisted contradiction/assumption entries BLOCK readiness", () => {
  // all-max dimensions but malformed (non-object) array entries must NOT become ready
  const dims = {};
  for (const d of DIMENSIONS) dims[d] = { level: "max", known: [], unknown: [], confidence: 1 };
  const rc = reconstructInterview({ roundId: 1, dimensions: dims, contradictions: ["bad"], assumptions: [] });
  assert.equal(rc?.contradictions.length, 1, "malformed contradiction must be kept as a blocker, not dropped");
  assert.equal(isInterviewReady(rc), false);
  const ra = reconstructInterview({ roundId: 1, dimensions: dims, contradictions: [], assumptions: ["legacy", null] });
  assert.equal(ra?.assumptions.every((a) => a.recorded === false), true);
  assert.equal(isInterviewReady(ra), false);
});

test("CRITICAL-2: a partial {level:'max'} dimension is NOT ready (full shape required)", () => {
  const partial = { roundId: 1, dimensions: {}, contradictions: [], assumptions: [] };
  for (const d of DIMENSIONS) partial.dimensions[d] = { level: "max" }; // missing known/unknown/confidence
  assert.equal(isInterviewReady(partial), false);
});

test("HIGH-2: normalizeInterview caps oversized arrays for the write path (T2)", () => {
  const t = defaultInterview(3);
  t.dimensions.goal.known = Array.from({ length: MAX_TRACKER_ARRAY + 7 }, (_, i) => `k${i}`);
  t.contradictions = Array.from({ length: MAX_TRACKER_ARRAY + 9 }, (_, i) => ({ contradictionId: `c${i}`, severity: "low", summary: "s" }));
  t.assumptions = Array.from({ length: MAX_TRACKER_ARRAY + 5 }, (_, i) => ({ id: `a${i}`, text: "t", recorded: true }));
  const n = normalizeInterview(t);
  assert.equal(n?.dimensions.goal.known.length, MAX_TRACKER_ARRAY);
  assert.equal(n?.contradictions.length, MAX_TRACKER_ARRAY);
  assert.equal(n?.assumptions.length, MAX_TRACKER_ARRAY);
  assert.equal(n?.roundId, 3);
});

test("T6: roundId is a non-negative integer (monotonic horizon)", () => {
  assert.equal(defaultInterview().roundId, 0);
  assert.equal(reconstructInterview({ roundId: "bad" })?.roundId, 0);
  assert.equal(reconstructInterview({ roundId: 7.9 })?.roundId, 7);
});
