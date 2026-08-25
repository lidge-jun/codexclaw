/**
 * interview-readiness.test.ts — 260825.
 *
 * isInterviewReady demanded level "max" on all four dimensions, and no shipped
 * writer could produce it: deriveLevel tops out at "high" and `--dim <d>=max` is
 * rejected. Every interview therefore dead-ended or spent an attested override,
 * which made the override's ledger row meaningless — it recorded "bypassed the
 * gate" for the thorough interview and the skipped one alike.
 *
 * Accepting "high" alone would have been the opposite failure. Measured before
 * the fix was written: four `--known` flags reach all-high in one command. So
 * the gate now asks the append-only Q&A ledger where a "high" came from.
 *
 * The load-bearing test here is the trivial-path one. Without it the change is
 * indistinguishable from simply lowering the bar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseScanCliArgs, runScanCli } from "../src/scan-cli.ts";
import { evaluateInterviewGate, isInterviewReady, DIMENSIONS } from "../src/interview.ts";
import { dimensionsBackedByAnswers, captureInterviewAnswers } from "../src/interview-ledger.ts";
import { readState, writeState, defaultState } from "../src/state.ts";

function freshSession(): string {
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-ivready-"));
  writeState(cwd, { ...defaultState("s1"), phase: "I" });
  return cwd;
}

/** Drive the REAL capture writer: the transport shape request_user_input produces. */
function askAndAnswer(cwd: string, questionId: string, dimension: string, answer: string): void {
  captureInterviewAnswers({
    cwd,
    sessionId: "s1",
    turnId: "t1",
    toolInput: JSON.stringify({ questions: [{ id: questionId, header: "h", question: `what about ${dimension}?`, options: [] }] }),
    toolResponse: JSON.stringify({ answers: { [questionId]: { answers: [answer] } } }),
  });
}

function scan(cwd: string, argv: string[]): { output: string; code: number } {
  const args = parseScanCliArgs(["record", "--session", "s1", "--cwd", cwd, ...argv], cwd);
  assert.ok(!("error" in args), `scan args rejected: ${(args as { error?: string }).error}`);
  return runScanCli(args as never);
}

function gateOf(cwd: string) {
  const st = readState(cwd, "s1");
  return {
    tracker: st.interview,
    gate: evaluateInterviewGate(st.interview, { backedDimensions: dimensionsBackedByAnswers(cwd, "s1") }),
  };
}

const MAPPED = ["q1=goal", "q2=constraint", "q3=success", "q4=ontology"];
const PAIRS: Array<[string, string]> = [["q1", "goal"], ["q2", "constraint"], ["q3", "success"], ["q4", "ontology"]];

test("a real interview reaches ready with NO override", () => {
  const cwd = freshSession();
  for (const [qid, dim] of PAIRS) askAndAnswer(cwd, qid, dim, `the user's answer about ${dim}`);
  scan(cwd, ["--derive", ...MAPPED.flatMap((m) => ["--map", m])]);

  const { tracker, gate } = gateOf(cwd);
  for (const d of DIMENSIONS) assert.equal(tracker.dimensions[d].level, "high", `${d} derives to high`);
  assert.equal(gate.ready, true, "an answered, mapped, scanned interview is ready");
  assert.deepEqual(gate.warnings, []);
});

test("the trivial path does NOT reach ready: four --known flags are not an interview", () => {
  const cwd = freshSession();
  // The exact command measured while designing the fix.
  scan(cwd, ["--known", "goal=x", "--known", "constraint=x", "--known", "success=x", "--known", "ontology=x"]);

  const { tracker, gate } = gateOf(cwd);
  // The SHAPE is satisfied — this is precisely why shape alone cannot be the gate.
  assert.equal(isInterviewReady(tracker), true, "all four reach high, so the shape check passes");
  assert.equal(gate.ready, false, "but no dimension traces to an answered question");
  assert.match(gate.warnings.join(" "), /without an answered question in the interview ledger/);
});

test("an unanswered question leaves its dimension at mid and blocks", () => {
  const cwd = freshSession();
  for (const [qid, dim] of PAIRS.slice(0, 3)) askAndAnswer(cwd, qid, dim, "answered");
  // q4 asked, never answered.
  captureInterviewAnswers({
    cwd, sessionId: "s1", turnId: "t1",
    toolInput: JSON.stringify({ questions: [{ id: "q4", header: "h", question: "what about ontology?", options: [] }] }),
    toolResponse: JSON.stringify({ answers: {} }),
  });
  scan(cwd, ["--derive", ...MAPPED.flatMap((m) => ["--map", m])]);

  const { tracker, gate } = gateOf(cwd);
  assert.equal(tracker.dimensions.ontology.level, "mid", "an open gap pins the dimension at mid");
  assert.equal(gate.ready, false);
});

test("--known on top of a derived dimension does not un-derive it", () => {
  const cwd = freshSession();
  for (const [qid, dim] of PAIRS) askAndAnswer(cwd, qid, dim, "answered");
  scan(cwd, ["--derive", ...MAPPED.flatMap((m) => ["--map", m])]);
  scan(cwd, ["--known", "goal=an extra fact recorded later"]);

  const { gate } = gateOf(cwd);
  assert.equal(gate.ready, true, "adding a fact is additive, not destructive");
});

test("--known cannot lend provenance to a dimension that never had a question", () => {
  const cwd = freshSession();
  for (const [qid, dim] of PAIRS.slice(0, 3)) askAndAnswer(cwd, qid, dim, "answered");
  scan(cwd, ["--derive", "--map", "q1=goal", "--map", "q2=constraint", "--map", "q3=success"]);
  // ontology gets a typed fact only.
  scan(cwd, ["--known", "ontology=asserted without ever asking"]);

  const { tracker, gate } = gateOf(cwd);
  assert.equal(tracker.dimensions.ontology.level, "high", "the typed fact still reaches high");
  assert.equal(gate.ready, false, "but high without an answer is not readiness");
  assert.match(gate.warnings.join(" "), /ontology reached "high"/);
});

test("max still satisfies readiness without ledger backing", () => {
  const cwd = freshSession();
  scan(cwd, ["--known", "goal=x"]);
  const st = readState(cwd, "s1");
  const tracker = { ...st.interview };
  for (const d of DIMENSIONS) tracker.dimensions[d] = { level: "max", known: ["k"], unknown: [], confidence: 1 };
  writeState(cwd, { ...st, interview: tracker });

  const { gate } = gateOf(cwd);
  assert.equal(gate.ready, true, "max is a deliberate assertion, not a derived level");
});

test("the untouched conditions still block a fully derived interview", () => {
  const cwd = freshSession();
  for (const [qid, dim] of PAIRS) askAndAnswer(cwd, qid, dim, "answered");
  scan(cwd, ["--derive", ...MAPPED.flatMap((m) => ["--map", m])]);
  assert.equal(gateOf(cwd).gate.ready, true, "baseline for this test");

  const st = readState(cwd, "s1");
  writeState(cwd, {
    ...st,
    interview: { ...st.interview, contradictions: [{ contradictionId: "c1", severity: "high", summary: "conflict" }] },
  });
  assert.equal(gateOf(cwd).gate.ready, false, "one contradiction still blocks");

  const st2 = readState(cwd, "s1");
  writeState(cwd, {
    ...st2,
    interview: { ...st2.interview, contradictions: [], assumptions: [{ id: "a1", text: "unrecorded", recorded: false }] },
  });
  assert.equal(gateOf(cwd).gate.ready, false, "one unrecorded assumption still blocks");
});

test("without ledger evidence the gate degrades to shape, and says nothing false", () => {
  const cwd = freshSession();
  for (const [qid, dim] of PAIRS) askAndAnswer(cwd, qid, dim, "answered");
  scan(cwd, ["--derive", ...MAPPED.flatMap((m) => ["--map", m])]);

  // The human free-pass path has no cwd, so it calls the gate without evidence.
  const shapeOnly = evaluateInterviewGate(readState(cwd, "s1").interview);
  assert.equal(shapeOnly.ready, true, "shape-only stays the old contract for the human path");
});

