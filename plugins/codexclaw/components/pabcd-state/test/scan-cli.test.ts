/**
 * scan-cli.test.ts — `cxc scan record` writer (260724 WP1, A-round H4).
 *
 * The previously-phantom "cxc scan evidence" recorder: verifies arg parsing
 * failure modes, the null-tracker init path (fresh session → round 1), roundId
 * monotonicity, the both-counters contract (scanRounds AND lastScanRoundId move
 * together, A2-round B2), the durable ledger append
 * (.codexclaw/interviews/<id>.jsonl scan_completed rows), and that one record
 * satisfies the scanRan half of the I->P readiness soft-gate.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseScanCliArgs, runScanCli, type ScanCliArgs } from "../src/scan-cli.ts";
import { readInterviewEvents, readState } from "../src/state.ts";
import { evaluateInterviewGate } from "../src/interview.ts";
import { captureInterviewAnswers } from "../src/interview-ledger.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-scancli-"));
}

// ── parseScanCliArgs ─────────────────────────────────────────────────────────

test("scan parse: missing --session is an error (no latest-session fallback)", () => {
  const parsed = parseScanCliArgs(["record"], "/tmp");
  assert.ok("error" in parsed);
  assert.match(parsed.error, /--session <id> is required/);
});

test("scan parse: unknown action and unknown argument are errors", () => {
  const badAction = parseScanCliArgs(["evidence"], "/tmp");
  assert.ok("error" in badAction);
  assert.match(badAction.error, /unknown scan action 'evidence'/);

  const noAction = parseScanCliArgs([], "/tmp");
  assert.ok("error" in noAction);
  assert.match(noAction.error, /unknown scan action/);

  const badArg = parseScanCliArgs(["record", "--session", "s1", "--nope"], "/tmp");
  assert.ok("error" in badArg);
  assert.match(badArg.error, /unknown argument '--nope'/);
});

test("scan parse: negative or non-numeric counts are rejected", () => {
  const negContra = parseScanCliArgs(["record", "--session", "s1", "--contradictions", "-1"], "/tmp");
  assert.ok("error" in negContra);
  assert.match(negContra.error, /--contradictions must be a non-negative integer/);

  const negHigh = parseScanCliArgs(["record", "--session", "s1", "--high", "-2"], "/tmp");
  assert.ok("error" in negHigh);
  assert.match(negHigh.error, /--high must be a non-negative integer/);

  const nanContra = parseScanCliArgs(["record", "--session", "s1", "--contradictions", "abc"], "/tmp");
  assert.ok("error" in nanContra);
  assert.match(nanContra.error, /--contradictions must be a non-negative integer/);
});

test("scan parse: well-formed args parse with defaults 0/0 and the given cwd", () => {
  const parsed = parseScanCliArgs(["record", "--session", "s1"], "/some/cwd");
  assert.ok(!("error" in parsed));
  assert.deepEqual(parsed, {
    action: "record",
    sessionId: "s1",
    contradictionCount: 0,
    highContradictionCount: 0,
    cwd: "/some/cwd",
  } satisfies ScanCliArgs);
});

// ── runScanCli ───────────────────────────────────────────────────────────────

function record(cwd: string, sessionId: string, contradictions = 0, high = 0) {
  const parsed = parseScanCliArgs(
    ["record", "--session", sessionId, "--contradictions", String(contradictions), "--high", String(high)],
    cwd,
  );
  assert.ok(!("error" in parsed), "args must parse");
  return runScanCli(parsed);
}

test("scan record: fresh session (interview null) initializes the tracker and records round 1", () => {
  const cwd = freshCwd();
  try {
    // Precondition: no session state exists yet -> readState yields interview: null.
    assert.equal(readState(cwd, "s-fresh").interview, null);

    const res = record(cwd, "s-fresh", 2, 1);
    assert.equal(res.code, 0);
    assert.match(res.output, /round 1 recorded for session s-fresh/);
    assert.match(res.output, /contradictions=2, high=1/);

    const tracker = readState(cwd, "s-fresh").interview;
    assert.ok(tracker, "null tracker must be initialized by the first record");
    // B2: both counters move together or they drift.
    assert.equal(tracker.scanRounds, 1);
    assert.equal(tracker.lastScanRoundId, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: second record is monotonic (round 2) and keeps both counters in lockstep", () => {
  const cwd = freshCwd();
  try {
    record(cwd, "s-mono");
    const res2 = record(cwd, "s-mono", 3, 0);
    assert.equal(res2.code, 0);
    assert.match(res2.output, /round 2 recorded/);

    const tracker = readState(cwd, "s-mono").interview;
    assert.ok(tracker);
    assert.equal(tracker.scanRounds, 2);
    assert.equal(tracker.lastScanRoundId, 2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: appends scan_completed rows to .codexclaw/interviews/<id>.jsonl", () => {
  const cwd = freshCwd();
  try {
    record(cwd, "s-ledger", 1, 1);
    record(cwd, "s-ledger", 0, 0);

    // Raw file: two JSONL rows at the documented path.
    const raw = readFileSync(join(cwd, ".codexclaw", "interviews", "s-ledger.jsonl"), "utf8");
    const rows = raw.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.equal(rows.length, 2);
    for (const row of rows) assert.equal(row.event, "scan_completed");

    // Filtered reader agrees (durable source of record; tracker is the cache).
    const events = readInterviewEvents(cwd, "s-ledger");
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((e) => e.roundId), [1, 2]);
    assert.equal(events[0].contradictionCount, 1);
    assert.equal(events[0].highContradictionCount, 1);
    assert.equal(events[0].sessionId, "s-ledger");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: one record satisfies the gate's scan requirement (scanRan half only)", () => {
  const cwd = freshCwd();
  try {
    // Before: no scan recorded -> gate flags the missing scan.
    const before = evaluateInterviewGate(readState(cwd, "s-gate").interview);
    assert.equal(before.scanRan, false);
    assert.ok(before.warnings.some((w) => /no contradiction scan/.test(w)));

    record(cwd, "s-gate");

    const tracker = readState(cwd, "s-gate").interview;
    const after = evaluateInterviewGate(tracker);
    // Only the scanRan half is asserted: dimensions/assumptions also gate
    // `ready`, and this writer intentionally does not touch them.
    assert.equal(after.scanRan, true);
    assert.ok(!after.warnings.some((w) => /no contradiction scan/.test(w)));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ── 260802 WP3: the dimension writer ─────────────────────────────────────────
//
// Until now `readQaEvents` had no production consumer: answers were captured
// (WP2) but never read, so dimensions stayed unwritten and every interview
// question was generated from a blank slate. These cover the reader.

function run(cwd: string, argv: string[]): { output: string; code: number } {
  const parsed = parseScanCliArgs(argv, cwd);
  assert.ok(!("error" in parsed), "error" in parsed ? parsed.error : "");
  return runScanCli(parsed as ScanCliArgs);
}

test("scan parse: dimension flags validate fail-closed", () => {
  const bad = [
    [["record", "--session", "s", "--dim", "nope=high"], /unknown dimension 'nope'/],
    [["record", "--session", "s", "--dim", "goal=enormous"], /invalid level 'enormous'/],
    [["record", "--session", "s", "--dim", "goal"], /--dim expects/],
    [["record", "--session", "s", "--confidence", "goal=7"], /within \[0,1\]/],
    [["record", "--session", "s", "--confidence", "goal=abc"], /within \[0,1\]/],
    [["record", "--session", "s", "--known", "goal="], /must not be empty/],
    [["record", "--session", "s", "--map", "q1=bogus"], /unknown dimension 'bogus'/],
  ] as const;
  for (const [argv, re] of bad) {
    const parsed = parseScanCliArgs([...argv], "/tmp");
    assert.ok("error" in parsed, `expected an error for ${argv.join(" ")}`);
    assert.match(parsed.error, re);
  }
});

test("scan record: --dim promotes only the named dimension", () => {
  const cwd = freshCwd();
  try {
    run(cwd, ["record", "--session", "s-dim", "--dim", "goal=high"]);
    const dims = readState(cwd, "s-dim").interview?.dimensions;
    assert.equal(dims?.goal.level, "high");
    assert.equal(dims?.constraint.level, "low");
    assert.equal(dims?.success.level, "low");
    assert.equal(dims?.ontology.level, "low");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: --known/--unknown accumulate and survive a value containing = and :", () => {
  const cwd = freshCwd();
  const tricky = "endpoint=https://x/y?a=b:c";
  try {
    run(cwd, ["record", "--session", "s-acc", "--known", `goal=${tricky}`]);
    run(cwd, ["record", "--session", "s-acc", "--known", "goal=second fact", "--unknown", "success=how do we measure it"]);
    const dims = readState(cwd, "s-acc").interview?.dimensions;
    assert.deepEqual(dims?.goal.known, [tricky, "second fact"], "first-= split must preserve the value verbatim");
    assert.deepEqual(dims?.success.unknown, ["how do we measure it"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: --derive folds CAPTURED ANSWERS into dimensions (the WP2->WP3 seam)", () => {
  const cwd = freshCwd();
  try {
    // A real interview round lands in the ledger via the WP2 capture path,
    // including the JSON-string transport that used to drop every answer.
    captureInterviewAnswers({
      cwd,
      sessionId: "s-derive",
      turnId: "t1",
      toolInput: JSON.stringify({
        questions: [
          { id: "q_goal", question: "What is the core outcome?" },
          { id: "q_success", question: "How will we verify it?" },
        ],
      }),
      // Only q_goal is answered; q_success stays open.
      toolResponse: JSON.stringify({ answers: { q_goal: { answers: ["ship the reader"] } } }),
    });

    run(cwd, [
      "record", "--session", "s-derive", "--derive",
      "--map", "q_goal=goal",
      "--map", "q_success=success",
    ]);

    const dims = readState(cwd, "s-derive").interview?.dimensions;
    // The answer the user actually gave is now interview state.
    assert.deepEqual(dims?.goal.known, ["ship the reader"]);
    assert.equal(dims?.goal.level, "high", "answered with no open gap -> high");
    // The unanswered question is an explicit open gap, not silence.
    assert.deepEqual(dims?.success.unknown, ["How will we verify it?"]);
    assert.equal(dims?.success.level, "mid", "asked but unanswered -> mid");
    // Unmapped dimensions are never guessed at.
    assert.equal(dims?.ontology.level, "low");
    assert.deepEqual(dims?.ontology.known, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: --derive never hands out max, and an explicit --dim wins", () => {
  const cwd = freshCwd();
  try {
    captureInterviewAnswers({
      cwd, sessionId: "s-max", turnId: "t1",
      toolInput: { questions: [{ id: "q1", question: "Q?" }] },
      toolResponse: { answers: { q1: { answers: ["A"] } } },
    });
    run(cwd, ["record", "--session", "s-max", "--derive", "--map", "q1=goal"]);
    // "max" gates I->P via isInterviewReady, so a heuristic must never grant it.
    assert.equal(readState(cwd, "s-max").interview?.dimensions.goal.level, "high");

    run(cwd, ["record", "--session", "s-max", "--derive", "--map", "q1=goal", "--dim", "goal=max"]);
    assert.equal(readState(cwd, "s-max").interview?.dimensions.goal.level, "max", "explicit assertion wins over derivation");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: no dimension flags leaves the tracker exactly as before", () => {
  const cwd = freshCwd();
  try {
    record(cwd, "s-noop");
    const tracker = readState(cwd, "s-noop").interview;
    for (const d of ["goal", "constraint", "success", "ontology"] as const) {
      assert.equal(tracker?.dimensions[d].level, "low");
      assert.deepEqual(tracker?.dimensions[d].known, []);
      assert.deepEqual(tracker?.dimensions[d].unknown, []);
      assert.equal(tracker?.dimensions[d].confidence, 0);
    }
    // The both-counters contract is untouched by the new code path.
    assert.equal(tracker?.scanRounds, 1);
    assert.equal(tracker?.lastScanRoundId, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
