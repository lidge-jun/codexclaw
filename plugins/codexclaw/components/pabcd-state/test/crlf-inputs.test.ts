/**
 * crlf-inputs.test.ts - CRLF tolerance across pabcd-state's parse sites (wp08).
 *
 * The apply_patch cases are the load-bearing ones: a CRLF payload used to leave a
 * \r on every line, which broke the FILE-directive match and corrupted the linted
 * content. The ledger cases are a completeness sweep over the readers of section 3.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileEditShapes, readEditShapeRows, STATE_DIR } from "../src/edit-shape.ts";
import { addedLines, lintApplyPatch } from "../src/comment-lint.ts";
import { readFrictionEntries } from "../src/friction.ts";
import { readRenderObsRows } from "../src/render-observations.ts";
import { readDivergenceCandidates } from "../src/divergence.ts";
import { readObjectiveMetrics } from "../src/metrics.ts";
import { readQaEvents } from "../src/interview-ledger.ts";
import { parseReviewRoundCliArgs, runReviewRoundCli } from "../src/review-round-cli.ts";
import { writeState, defaultState, readInterviewEvents, INTERVIEWS_SUBDIR } from "../src/state.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";

const LF_PATCH = [
  "*** Begin Patch",
  "*** Update File: src/alpha.ts",
  "@@",
  " context line",
  "-const x = 1;",
  "+const x = 2;",
  "*** Update File: src/beta.ts",
  "@@",
  "-logger.info(a)",
  "+logger.info(b)",
  "*** End Patch",
].join("\n");

const CRLF_PATCH = LF_PATCH.replace(/\n/g, "\r\n");

// --- apply_patch payloads (the wrong-answer cases) ---------------------------

test("a CRLF patch payload yields the same FILE directives as LF", () => {
  const lf = fileEditShapes(LF_PATCH);
  const crlf = fileEditShapes(CRLF_PATCH);
  assert.deepEqual(crlf, lf, "CRLF must not change the parsed shapes");
  assert.deepEqual(lf.map((s) => s.file), ["src/alpha.ts", "src/beta.ts"]);
  for (const shape of crlf) {
    assert.equal(shape.file.includes("\r"), false, "no CR may survive in a file name");
  }
});

test("a CRLF patch must not report phantom findings from a trailing CR", () => {
  const lfLines = addedLines(LF_PATCH);
  const crlfLines = addedLines(CRLF_PATCH);
  assert.deepEqual(crlfLines, lfLines);
  for (const line of crlfLines) {
    assert.equal(line.endsWith("\r"), false, "a linted line must not carry a CR");
  }
});

test("a CRLF patch lints to the same verdict as its LF twin", () => {
  const offending = [
    "*** Begin Patch",
    "*** Update File: src/alpha.ts",
    "@@",
    "+  process.exit(1);",
    "*** End Patch",
  ].join("\n");
  const lf = lintApplyPatch(offending);
  const crlf = lintApplyPatch(offending.replace(/\n/g, "\r\n"));
  assert.equal(crlf.ok, lf.ok);
  if (!crlf.ok && !lf.ok) {
    assert.equal(crlf.reason, lf.reason, "the reported reason must not carry a CR");
    assert.equal(crlf.reason.includes("\r"), false);
  }
  assert.equal(lintApplyPatch(CRLF_PATCH).ok, true, "a clean CRLF patch stays clean");
});

// --- the duplicated TOML parser in review-round-cli --------------------------

function seedAtA(cwd: string, id: string): void {
  const unit = join(cwd, "devlog", "_plan", "260821_crlf");
  mkdirSync(unit, { recursive: true });
  writeFileSync(join(unit, "000_plan.md"), "# crlf probe\n");
  const plan = buildGoalplan({ objective: "crlf" });
  plan.slug = "crlf-probe";
  plan.workPhases = [{ id: "wp0", title: "probe", status: "in_progress", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = "wp0";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    phase: "A",
    slug: "crlf-probe",
    planUnit: "devlog/_plan/260821_crlf",
    planEpoch: "e-crlf-1",
    flags: { interview: false, auditPassed: false, checkPassed: false },
  });
}

function dispatchTextWithConfig(configText: string, id: string): string {
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-crlf-rr-"));
  const home = mkdtempSync(join(tmpdir(), "cxc-crlf-home-"));
  writeFileSync(join(home, "config.toml"), configText, "utf8");
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
  try {
    seedAtA(cwd, id);
    const args = parseReviewRoundCliArgs(
      ["open", "--session", id, "--cwd", cwd, "--plan-path", "devlog/_plan/260821_crlf/000_plan.md"],
      cwd,
    );
    assert.ok(!("error" in args));
    const r = runReviewRoundCli(args as never);
    assert.equal(r.code, 0, r.output);
    return r.output;
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

test("review-round-cli reads a CRLF config.toml the same as an LF one", () => {
  const toml = "[features.multi_agent_v2]\nenabled = true\n";
  const lf = dispatchTextWithConfig(toml, "crlf-lf");
  const crlf = dispatchTextWithConfig(toml.replace(/\n/g, "\r\n"), "crlf-crlf");
  const tail = (text: string): string => text.split("\n").slice(1).join("\n");
  assert.match(tail(lf), /agent_type explorer/, "LF baseline detects the v2 surface");
  assert.equal(tail(crlf), tail(lf), "CRLF must produce the same dispatch text");
});

// --- ledger readers: a CRLF-rewritten ledger reads identically ---------------

interface LedgerCase {
  name: string;
  file: string;
  rows: string[];
  read: (cwd: string) => unknown[];
}

const SESSION = "crlf-session";

const LEDGER_CASES: LedgerCase[] = [
  {
    name: "edit-shapes.jsonl",
    file: "edit-shapes.jsonl",
    rows: [
      JSON.stringify({ ts: "2026-08-21T00:00:00Z", key: "k1", file: "a.ts", advised: false }),
      JSON.stringify({ ts: "2026-08-21T00:00:01Z", key: "k2", file: "b.ts", advised: true }),
    ],
    read: (cwd) => readEditShapeRows(cwd),
  },
  {
    name: "friction.jsonl",
    file: "friction.jsonl",
    rows: [
      JSON.stringify({ ts: "2026-08-21T00:00:00Z", key: "k1", tool: "exec", normalized: "n", count: 2 }),
      JSON.stringify({ ts: "2026-08-21T00:00:01Z", key: "k2", tool: "exec", normalized: "n", count: 5 }),
    ],
    read: (cwd) => readFrictionEntries(cwd),
  },
  {
    name: "render-observations.jsonl",
    file: "render-observations.jsonl",
    rows: [
      JSON.stringify({ ts: "2026-08-21T00:00:00Z", kind: "observation", detail: "d1", sessionId: "s" }),
      JSON.stringify({ ts: "2026-08-21T00:00:01Z", kind: "artifact-modified", detail: "d2", sessionId: "s" }),
    ],
    read: (cwd) => readRenderObsRows(cwd),
  },
  {
    name: "divergence/candidates.jsonl",
    file: "divergence/candidates.jsonl",
    rows: [
      JSON.stringify({
        ts: "2026-08-21T00:00:00Z", sessionId: SESSION, id: "d1", kind: "strong-1",
        title: "t1", rationale: "r1", sourceUrls: [], status: "proposed",
      }),
      JSON.stringify({
        ts: "2026-08-21T00:00:01Z", sessionId: SESSION, id: "d2", kind: "alternative",
        title: "t2", rationale: "r2", sourceUrls: ["https://example.test"], status: "kept",
      }),
    ],
    read: (cwd) => readDivergenceCandidates(cwd),
  },
  {
    name: "metrics.jsonl",
    file: "metrics.jsonl",
    rows: [
      JSON.stringify({
        ts: "2026-08-21T00:00:00Z", sessionId: SESSION, workPhaseId: "wp0", metricName: "m",
        value: 1, baseline: 1, best: 1, source: "operator-entered",
      }),
      JSON.stringify({
        ts: "2026-08-21T00:00:01Z", sessionId: SESSION, workPhaseId: "wp0", metricName: "m",
        value: 2, baseline: 1, best: 2, source: "evaluate.sh",
      }),
    ],
    read: (cwd) => readObjectiveMetrics(cwd),
  },
  {
    name: "interviews/<session>.jsonl (Q/A reader)",
    file: INTERVIEWS_SUBDIR + "/" + SESSION + ".jsonl",
    rows: [
      JSON.stringify({ ts: "2026-08-21T00:00:00Z", sessionId: SESSION, event: "question_asked", eventId: "t1:q1:asked" }),
      JSON.stringify({ ts: "2026-08-21T00:00:01Z", sessionId: SESSION, event: "answer_recorded", eventId: "t1:q1:answered" }),
    ],
    read: (cwd) => readQaEvents(cwd, SESSION),
  },
  {
    name: "interviews/<session>.jsonl (scan reader)",
    file: INTERVIEWS_SUBDIR + "/" + SESSION + ".jsonl",
    rows: [
      JSON.stringify({ ts: "2026-08-21T00:00:00Z", sessionId: SESSION, event: "scan_started", roundId: 1, contradictionCount: 0 }),
      JSON.stringify({ ts: "2026-08-21T00:00:01Z", sessionId: SESSION, event: "scan_completed", roundId: 1, contradictionCount: 2 }),
    ],
    read: (cwd) => readInterviewEvents(cwd, SESSION),
  },
];

function ledgerFileName(cwd: string, name: string): string {
  return join(cwd, STATE_DIR, name);
}

function writeLedger(cwd: string, name: string, body: string): void {
  const path = ledgerFileName(cwd, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body, "utf8");
}

for (const c of LEDGER_CASES) {
  test("a CRLF-rewritten ledger reads identically: " + c.name, () => {
    const lfCwd = mkdtempSync(join(tmpdir(), "codexclaw-crlf-lf-"));
    const crlfCwd = mkdtempSync(join(tmpdir(), "codexclaw-crlf-cr-"));
    try {
      const body = c.rows.join("\n") + "\n";
      writeLedger(lfCwd, c.file, body);
      writeLedger(crlfCwd, c.file, body.replace(/\n/g, "\r\n"));

      const lf = c.read(lfCwd);
      const crlf = c.read(crlfCwd);
      assert.equal(lf.length, c.rows.length, "LF baseline must read every row");
      assert.deepEqual(crlf, lf, "a CRLF ledger must read identically");
    } finally {
      rmSync(lfCwd, { recursive: true, force: true });
      rmSync(crlfCwd, { recursive: true, force: true });
    }
  });
}
