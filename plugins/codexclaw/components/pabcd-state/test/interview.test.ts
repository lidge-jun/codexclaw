import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIMENSIONS,
  MAX_TRACKER_ARRAY,
  defaultInterview,
  reconstructInterview,
  isInterviewReady,
  type InterviewTracker,
} from "../src/interview.ts";

function readyTracker(): InterviewTracker {
  const t = defaultInterview("r1");
  for (const d of DIMENSIONS) t.dimensions[d] = { level: "max", known: ["x"], unknown: [], confidence: 1 };
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
  t.contradictions = [{ id: "c1", severity: "low", summary: "x" }];
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
  const big = Array.from({ length: MAX_TRACKER_ARRAY + 20 }, (_, i) => ({ id: `c${i}`, severity: "low", summary: "s" }));
  const r = reconstructInterview({ contradictions: big });
  assert.equal(r?.contradictions.length, MAX_TRACKER_ARRAY);
  // drop-oldest: the last item survives
  assert.equal(r?.contradictions.at(-1)?.id, `c${MAX_TRACKER_ARRAY + 19}`);
});
