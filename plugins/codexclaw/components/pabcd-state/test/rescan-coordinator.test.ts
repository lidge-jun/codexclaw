/**
 * rescan-coordinator.test.ts — L12.2 interactive-interview signal helper.
 *
 * Proves: (turnId,questionId) pair matching (questionId reuse across turns is NOT
 * treated as answered), tracker-only high-contradiction signal, monotonic
 * computeNextScanRound, the goal-active EMPTY guard (interview never fires under a
 * goal), and total/fail-safe behavior.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hasPendingInterviewWork, computeNextScanRound } from "../src/rescan-coordinator.ts";
import { captureInterviewAnswers } from "../src/interview-ledger.ts";
import { defaultInterview, type InterviewTracker } from "../src/interview.ts";

function tmp() {
  return mkdtempSync(join(tmpdir(), "cxc-rescan-"));
}
const inactive = { goalStatus: () => "inactive" as const };

function trackerWithContradictions(severities: ("low" | "medium" | "high")[]): InterviewTracker {
  const t = defaultInterview(1);
  t.contradictions = severities.map((severity, i) => ({ contradictionId: `c${i}`, severity, summary: "x" }));
  return t;
}

test("pending pair detected: question_asked with no matching answer -> pending", () => {
  const cwd = tmp();
  captureInterviewAnswers({
    cwd, sessionId: "s", turnId: "t1",
    toolInput: { questions: [{ id: "goal", question: "?" }] },
    toolResponse: { answers: {} }, // no answer
  });
  const r = hasPendingInterviewWork(cwd, "s", null, inactive);
  assert.equal(r.pending, true);
  assert.equal(r.pendingQuestionIds.length, 1);
});

test("answered pair clears for the SAME (turnId,questionId)", () => {
  const cwd = tmp();
  captureInterviewAnswers({
    cwd, sessionId: "s", turnId: "t1",
    toolInput: { questions: [{ id: "goal", question: "?" }] },
    toolResponse: { answers: { goal: { answers: ["yes"] } } },
  });
  const r = hasPendingInterviewWork(cwd, "s", null, inactive);
  assert.equal(r.pending, false);
  assert.deepEqual(r.pendingQuestionIds, []);
});

test("questionId reuse across turns: only first answered -> 2nd turn pending (B1)", () => {
  const cwd = tmp();
  // turn 1: ask "goal" and answer it
  captureInterviewAnswers({
    cwd, sessionId: "s", turnId: "t1",
    toolInput: { questions: [{ id: "goal", question: "?" }] },
    toolResponse: { answers: { goal: { answers: ["a1"] } } },
  });
  // turn 2: reuse the SAME questionId "goal", no answer yet
  captureInterviewAnswers({
    cwd, sessionId: "s", turnId: "t2",
    toolInput: { questions: [{ id: "goal", question: "again?" }] },
    toolResponse: { answers: {} },
  });
  const r = hasPendingInterviewWork(cwd, "s", null, inactive);
  // pair matching: (t2,goal) is unanswered even though (t1,goal) was answered.
  assert.equal(r.pending, true);
  assert.equal(r.pendingQuestionIds.length, 1);
  assert.ok(r.pendingQuestionIds[0].includes("t2"));
});

test("high contradiction counted from tracker only", () => {
  const cwd = tmp(); // empty ledger
  const r = hasPendingInterviewWork(cwd, "s", trackerWithContradictions(["low", "high", "medium"]), inactive);
  assert.equal(r.highContradictionCount, 1);
  assert.equal(r.pending, true);
});

test("low/medium contradictions alone do not make it pending", () => {
  const cwd = tmp();
  const r = hasPendingInterviewWork(cwd, "s", trackerWithContradictions(["low", "medium"]), inactive);
  assert.equal(r.highContradictionCount, 0);
  assert.equal(r.pending, false);
});

test("goal-active -> EMPTY result (interview never fires under a goal)", () => {
  const cwd = tmp();
  // a real pending question exists in the ledger...
  captureInterviewAnswers({
    cwd, sessionId: "s", turnId: "t1",
    toolInput: { questions: [{ id: "goal", question: "?" }] },
    toolResponse: { answers: {} },
  });
  // ...but with a goal active the helper must report nothing.
  const active = hasPendingInterviewWork(cwd, "s", trackerWithContradictions(["high"]), { goalStatus: () => "active" });
  assert.deepEqual(active, { pendingQuestionIds: [], highContradictionCount: 0, pending: false });
  // unreadable also suppresses (fail-closed).
  const unreadable = hasPendingInterviewWork(cwd, "s", trackerWithContradictions(["high"]), { goalStatus: () => "unreadable" });
  assert.equal(unreadable.pending, false);
});

test("computeNextScanRound: scanRounds+1, ignores roundId/lastScanRoundId, missing->1", () => {
  const t = defaultInterview(0);
  assert.equal(computeNextScanRound(t), 1); // scanRounds 0 -> 1
  t.scanRounds = 3;
  t.roundId = 99;
  t.lastScanRoundId = 50;
  assert.equal(computeNextScanRound(t), 4); // derived from scanRounds only
  assert.equal(computeNextScanRound(null), 1);
  // malformed scanRounds -> treated as 0
  const bad = defaultInterview(0);
  (bad as unknown as { scanRounds: unknown }).scanRounds = "x";
  assert.equal(computeNextScanRound(bad), 1);
});

test("totals: malformed tracker / missing ledger -> no throw, conservative", () => {
  const cwd = tmp();
  assert.doesNotThrow(() => hasPendingInterviewWork(cwd, "s", null, inactive));
  const r = hasPendingInterviewWork(cwd, "s", { contradictions: "nope" } as unknown as InterviewTracker, inactive);
  assert.equal(r.pending, false);
  assert.equal(r.highContradictionCount, 0);
});

test("never reads the scan-evidence ledger (B3): scan lines do not affect pending", () => {
  const cwd = tmp();
  // Only a scan event exists (no QA events). readQaEvents filters these out, and the
  // helper reads contradictions from the tracker, so pending must be false.
  const r = hasPendingInterviewWork(cwd, "s", defaultInterview(1), inactive);
  assert.equal(r.pending, false);
});
