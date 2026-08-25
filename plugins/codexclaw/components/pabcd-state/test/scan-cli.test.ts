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
    // "max" satisfies readiness with no ledger backing, so a heuristic must never
    // grant it. Derivation tops out at "high", which the I->P gate then checks
    // against the answer ledger (interview-readiness.test.ts).
    assert.equal(readState(cwd, "s-max").interview?.dimensions.goal.level, "high");

    // Nor can an operator flag grant it: that would be readiness with no evidence
    // and no attestation.
    const denied = parseScanCliArgs(["record", "--session", "s-max", "--dim", "goal=max"], cwd);
    assert.ok("error" in denied);

    // A lower explicit level still overrides derivation.
    run(cwd, ["record", "--session", "s-max", "--derive", "--map", "q1=goal", "--dim", "goal=mid"]);
    assert.equal(readState(cwd, "s-max").interview?.dimensions.goal.level, "mid", "explicit assertion wins over derivation");
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

// ── WP3 audit round 2 remediation ────────────────────────────────────────────

test("scan record: a prototype-named questionId cannot crash the derivation", () => {
  const cwd = freshCwd();
  try {
    // parseQuestions applies no id filter, so a payload can legitimately carry
    // these. On a plain object literal `map["toString"]` resolves to an inherited
    // function, defeating the unmapped-skip and throwing mid-write -- which left
    // a scan_completed ledger row with no matching state write (counter drift).
    captureInterviewAnswers({
      cwd, sessionId: "s-proto", turnId: "t1",
      toolInput: { questions: [
        { id: "toString", question: "hostile id?" },
        { id: "hasOwnProperty", question: "another?" },
        { id: "q_real", question: "legit?" },
      ] },
      toolResponse: { answers: { q_real: { answers: ["fine"] } } },
    });
    const res = run(cwd, ["record", "--session", "s-proto", "--derive", "--map", "q_real=goal"]);
    assert.equal(res.code, 0, res.output);
    const tracker = readState(cwd, "s-proto").interview;
    assert.deepEqual(tracker?.dimensions.goal.known, ["fine"]);
    // The both-counters contract must survive a hostile id.
    assert.equal(tracker?.scanRounds, 1);
    assert.equal(tracker?.lastScanRoundId, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan parse: --dim cannot grant max (that bypasses the attested I->P override)", () => {
  const parsed = parseScanCliArgs(["record", "--session", "s", "--dim", "goal=max"], "/tmp");
  assert.ok("error" in parsed);
  assert.match(parsed.error, /cannot set 'max'/);
  assert.match(parsed.error, /override.*true/, "the error must name the sanctioned path");
  // The other three levels stay available.
  for (const lvl of ["low", "mid", "high"]) {
    assert.ok(!("error" in parseScanCliArgs(["record", "--session", "s", "--dim", `goal=${lvl}`], "/tmp")));
  }
});

test("scan parse: --confidence rejects a numeric prefix like 0.5abc", () => {
  for (const bad of ["0.5abc", "abc", "", " ", "1.5", "-0.1"]) {
    const parsed = parseScanCliArgs(["record", "--session", "s", "--confidence", `goal=${bad}`], "/tmp");
    assert.ok("error" in parsed, `expected rejection for '${bad}'`);
  }
  assert.ok(!("error" in parseScanCliArgs(["record", "--session", "s", "--confidence", "goal=0.5"], "/tmp")));
});

test("scan record: answering a question retires its own gap", () => {
  const cwd = freshCwd();
  try {
    captureInterviewAnswers({
      cwd, sessionId: "s-retire", turnId: "t1",
      toolInput: { questions: [{ id: "q1", question: "What is the goal?" }] },
      toolResponse: {},
    });
    run(cwd, ["record", "--session", "s-retire", "--derive", "--map", "q1=goal"]);
    let goal = readState(cwd, "s-retire").interview?.dimensions.goal;
    assert.deepEqual(goal?.unknown, ["What is the goal?"], "asked but unanswered is an open gap");
    assert.equal(goal?.level, "mid");

    // Same question, now answered in a later turn.
    captureInterviewAnswers({
      cwd, sessionId: "s-retire", turnId: "t2",
      toolInput: { questions: [{ id: "q1", question: "What is the goal?" }] },
      toolResponse: { answers: { q1: { answers: ["ship it"] } } },
    });
    run(cwd, ["record", "--session", "s-retire", "--derive", "--map", "q1=goal"]);
    goal = readState(cwd, "s-retire").interview?.dimensions.goal;
    assert.deepEqual(goal?.known, ["ship it"]);
    assert.deepEqual(goal?.unknown, [], "a resolved gap must not stay listed");
    assert.equal(goal?.level, "high", "no open gap -> high");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: answers to the same id across turns accumulate", () => {
  const cwd = freshCwd();
  try {
    for (const [turn, answer] of [["t1", "first"], ["t2", "second"]] as const) {
      captureInterviewAnswers({
        cwd, sessionId: "s-merge", turnId: turn,
        toolInput: { questions: [{ id: "q1", question: "Q?" }] },
        toolResponse: { answers: { q1: { answers: [answer] } } },
      });
    }
    run(cwd, ["record", "--session", "s-merge", "--derive", "--map", "q1=goal"]);
    assert.deepEqual(readState(cwd, "s-merge").interview?.dimensions.goal.known, ["first", "second"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: re-deriving is idempotent past the array cap", () => {
  const cwd = freshCwd();
  try {
    const questions = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, question: `Q${i}?` }));
    const answers: Record<string, { answers: string[] }> = {};
    for (let i = 0; i < 60; i += 1) answers[`q${i}`] = { answers: [`fact-${i}`] };
    captureInterviewAnswers({
      cwd, sessionId: "s-cap", turnId: "t1",
      toolInput: { questions },
      toolResponse: { answers },
    });
    const argv = ["record", "--session", "s-cap", "--derive", ...questions.flatMap((q) => ["--map", `${q.id}=goal`])];
    run(cwd, argv);
    const pass1 = readState(cwd, "s-cap").interview?.dimensions.goal.known ?? [];
    run(cwd, argv);
    const pass2 = readState(cwd, "s-cap").interview?.dimensions.goal.known ?? [];
    assert.equal(pass1.length, 50, "capped at MAX_TRACKER_ARRAY");
    assert.deepEqual(pass2, pass1, "a no-op re-derive must reach a fixed point, not rotate the window");
    assert.equal(pass1[0], "fact-0", "keep-first: the earliest answers are the foundational ones");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: --known alone still moves the level off low", () => {
  const cwd = freshCwd();
  try {
    run(cwd, ["record", "--session", "s-manual", "--known", "goal=a foundational fact"]);
    const goal = readState(cwd, "s-manual").interview?.dimensions.goal;
    assert.deepEqual(goal?.known, ["a foundational fact"]);
    assert.equal(goal?.level, "high", "a dimension holding a fact cannot claim nothing is known");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: a --dim assertion survives later unrelated scans", () => {
  const cwd = freshCwd();
  try {
    run(cwd, ["record", "--session", "s-persist", "--dim", "goal=high", "--dim", "constraint=mid"]);
    let dims = readState(cwd, "s-persist").interview?.dimensions;
    assert.equal(dims?.goal.level, "high");
    assert.equal(dims?.constraint.level, "mid");

    // A routine scan round -- the command's original purpose -- must not wipe an
    // operator assertion just because it recomputes coverage.
    run(cwd, ["record", "--session", "s-persist", "--contradictions", "2", "--high", "1"]);
    dims = readState(cwd, "s-persist").interview?.dimensions;
    assert.equal(dims?.goal.level, "high", "an untouched dimension keeps its asserted level");
    assert.equal(dims?.constraint.level, "mid");

    // Touching a DIFFERENT dimension must also leave the assertions alone.
    run(cwd, ["record", "--session", "s-persist", "--known", "ontology=an entity"]);
    dims = readState(cwd, "s-persist").interview?.dimensions;
    assert.equal(dims?.goal.level, "high");
    assert.equal(dims?.ontology.level, "high", "the touched dimension is recomputed");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("scan record: --derive without --map warns instead of reporting a silent no-op", () => {
  const cwd = freshCwd();
  try {
    captureInterviewAnswers({
      cwd, sessionId: "s-warn", turnId: "t1",
      toolInput: { questions: [{ id: "q1", question: "Q?" }] },
      toolResponse: { answers: { q1: { answers: ["A"] } } },
    });
    // Every question is skipped when unmapped, so this writes an empty tracker.
    // Exiting 0 with no signal is the original blank-slate bug wearing a passing
    // command; the operator has to be told.
    const noMap = run(cwd, ["record", "--session", "s-warn", "--derive"]);
    assert.equal(noMap.code, 0);
    assert.match(noMap.output, /derived=0/);
    assert.match(noMap.output, /WARNING: no --map given/);

    // A map that matches nothing is a different mistake and says so.
    const wrongMap = run(cwd, ["record", "--session", "s-warn", "--derive", "--map", "nonexistent=goal"]);
    assert.match(wrongMap.output, /WARNING: nothing matched/);

    // A correct map stays quiet.
    const ok = run(cwd, ["record", "--session", "s-warn", "--derive", "--map", "q1=goal"]);
    assert.match(ok.output, /derived=1/);
    assert.doesNotMatch(ok.output, /WARNING/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
