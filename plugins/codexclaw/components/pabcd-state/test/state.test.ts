import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readState,
  writeState,
  appendLedger,
  defaultState,
  sanitizeKey,
  STATE_DIR,
  SESSIONS_SUBDIR,
  LEDGER_FILE,
  INTERVIEWS_SUBDIR,
  appendInterviewEvent,
  readInterviewEvents,
  ensureState,
  isCanonicalSessionId,
  type State,
} from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-state-"));
}

test("SessionStart ensureState: fresh session creates the exact default IDLE state without temp files", () => {
  const cwd = freshCwd();
  try {
    assert.equal(ensureState(cwd, "session-start-fresh"), true);
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    const stateFile = join(dir, "session-start-fresh.json");
    const persisted = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.deepEqual(persisted, {
      phase: "IDLE",
      sessionId: "session-start-fresh",
      slug: "",
      updatedAt: persisted.updatedAt,
      flags: { interview: false, auditPassed: false, checkPassed: false },
      supersededBy: null,
      injectedTurns: [],
      lastInjectedPhase: null,
      orchestrationActive: false,
      interview: null,
      stopBlockPhase: null,
      stopBlockCount: 0,
      loopArmSeen: false,
      idleEditNudges: 0,
    });
    assert.equal(Number.isNaN(Date.parse(persisted.updatedAt)), false);
    assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("SessionStart ensureState: existing valid state is resume-safe and byte-for-byte unchanged", () => {
  const cwd = freshCwd();
  try {
    const existing = {
      ...defaultState("session-start-valid"),
      phase: "B" as const,
      slug: "resume-me",
      orchestrationActive: true,
      stopBlockPhase: "B" as const,
      stopBlockCount: 2,
    };
    writeState(cwd, existing);
    const stateFile = join(cwd, STATE_DIR, SESSIONS_SUBDIR, "session-start-valid.json");
    const before = readFileSync(stateFile);
    assert.equal(ensureState(cwd, "session-start-valid"), false);
    assert.deepEqual(readFileSync(stateFile), before);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("SessionStart ensureState: existing corrupt bytes are preserved and noncanonical IDs are rejected", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    const corruptFile = join(dir, "session-start-corrupt.json");
    const corrupt = Buffer.from("{ not valid json \u0000", "utf8");
    writeFileSync(corruptFile, corrupt);
    assert.equal(ensureState(cwd, "session-start-corrupt"), false);
    assert.deepEqual(readFileSync(corruptFile), corrupt);

    for (const noncanonicalId of ["  padded  ", "../unsafe/session", "세션"]) {
      assert.throws(
        () => ensureState(cwd, noncanonicalId),
        { name: "TypeError", message: "sessionId must be a canonical state key" },
      );
      assert.equal(existsSync(join(dir, `${sanitizeKey(noncanonicalId)}.json`)), false);
    }
    assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("readState: missing dir -> default (carries sessionId, phase IDLE)", () => {
  const cwd = freshCwd();
  try {
    const s = readState(cwd, "sess-1");
    assert.equal(s.phase, "IDLE");
    assert.equal(s.sessionId, "sess-1");
    assert.equal(s.flags.interview, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("readState: corrupt JSON -> default, never throws", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "sess-2.json"), "{ not json ");
    const s = readState(cwd, "sess-2");
    assert.equal(s.phase, "IDLE");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("readState: invalid phase value -> default", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "sess-z.json"), JSON.stringify({ phase: "Z", sessionId: "sess-z" }));
    const s = readState(cwd, "sess-z");
    assert.equal(s.phase, "IDLE");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("write -> read roundtrip + flags merge", () => {
  const cwd = freshCwd();
  try {
    const next: State = { ...defaultState("sess-3"), phase: "P", flags: { interview: true, auditPassed: false, checkPassed: false } };
    writeState(cwd, next);
    const s = readState(cwd, "sess-3");
    assert.equal(s.phase, "P");
    // HIGH-1: flags.interview is DERIVED from the tracker, not the persisted flag.
    // No tracker -> not ready -> false even though true was written.
    assert.equal(s.flags.interview, false);
    assert.equal(s.flags.auditPassed, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("session isolation: two sessionIds in one cwd do not clobber (Finding C)", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("alpha"), phase: "B", flags: { interview: true, auditPassed: true, checkPassed: false } });
    writeState(cwd, { ...defaultState("beta"), phase: "P", flags: { interview: true, auditPassed: false, checkPassed: false } });
    const a = readState(cwd, "alpha");
    const b = readState(cwd, "beta");
    assert.equal(a.phase, "B");
    assert.equal(b.phase, "P");
    assert.notEqual(a.phase, b.phase);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("appendLedger: creates ledger.jsonl with sessionId-tagged NDJSON lines", () => {
  const cwd = freshCwd();
  try {
    appendLedger(cwd, { ts: new Date().toISOString(), sessionId: "alpha", from: "P", to: "A", reason: "plan approved" });
    appendLedger(cwd, { ts: new Date().toISOString(), sessionId: "beta", from: "A", to: "B", reason: "audit passed" });
    const ledgerPath = join(cwd, STATE_DIR, LEDGER_FILE);
    assert.ok(existsSync(ledgerPath));
    const lines = readFileSync(ledgerPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    const first = JSON.parse(lines[0]);
    assert.equal(first.sessionId, "alpha");
    assert.equal(first.to, "A");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("sanitizeKey: strips unsafe chars, falls back to 'missing'", () => {
  assert.equal(sanitizeKey("019f/13ab:cd"), "019f-13ab-cd");
  assert.equal(sanitizeKey(""), "missing");
  assert.equal(sanitizeKey("///"), "missing");
});

test("isCanonicalSessionId: accepts exact state keys and rejects rewritten identities", () => {
  assert.equal(isCanonicalSessionId("019f4a8a-b1a1-7113-b72a-460a39a8f096"), true);
  assert.equal(isCanonicalSessionId("session_1.example"), true);
  for (const value of ["", "  session-1  ", "../session-1", "세션-1", "-session-1"]) {
    assert.equal(isCanonicalSessionId(value), false, value);
  }
});

test("readState: unknown persisted keys are dropped (strict reconstruction)", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "uk.json"), JSON.stringify({ phase: "P", sessionId: "uk", evil: "x", flags: { interview: true, bogus: 1 } }));
    const s = readState(cwd, "uk");
    assert.equal(s.phase, "P");
    assert.equal(Object.prototype.hasOwnProperty.call(s, "evil"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(s.flags, "bogus"), false);
    // flags.interview is derived from the tracker; no tracker here -> false.
    assert.equal(s.flags.interview, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("260714 wp3: loopArmSeen/idleEditNudges strict reconstruction (old files read false/0)", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    // old file without the fields -> defaults
    writeFileSync(join(dir, "old.json"), JSON.stringify({ phase: "P", sessionId: "old" }));
    const old = readState(cwd, "old");
    assert.equal(old.loopArmSeen, false);
    assert.equal(old.idleEditNudges, 0);
    // valid values roundtrip
    writeState(cwd, { ...defaultState("rt"), loopArmSeen: true, idleEditNudges: 7 });
    const rt = readState(cwd, "rt");
    assert.equal(rt.loopArmSeen, true);
    assert.equal(rt.idleEditNudges, 7);
    // invalid values coerce to defaults
    writeFileSync(join(dir, "bad.json"), JSON.stringify({ phase: "P", sessionId: "bad", loopArmSeen: "yes", idleEditNudges: -3 }));
    const bad = readState(cwd, "bad");
    assert.equal(bad.loopArmSeen, false);
    assert.equal(bad.idleEditNudges, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("writeState: no orphan .tmp left after a successful write", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, defaultState("clean"));
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    const leftovers = readdirSync(dir).filter((f) => f.endsWith(".tmp"));
    assert.deepEqual(leftovers, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("injectedTurns: defaults to [] on fresh state", () => {
  const cwd = freshCwd();
  try {
    const s = readState(cwd, "it-1");
    assert.deepEqual(s.injectedTurns, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("injectedTurns: roundtrips through write -> read", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("it-2"), injectedTurns: ["t1", "t2"] });
    const s = readState(cwd, "it-2");
    assert.deepEqual(s.injectedTurns, ["t1", "t2"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("injectedTurns: invalid persisted value -> [] (strict reconstruct)", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "it-3.json"), JSON.stringify({ phase: "P", sessionId: "it-3", injectedTurns: [1, 2, "ok"] }));
    const s = readState(cwd, "it-3");
    assert.deepEqual(s.injectedTurns, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("lastInjectedPhase + orchestrationActive: defaults", () => {
  const cwd = freshCwd();
  try {
    const s = readState(cwd, "li-1");
    assert.equal(s.lastInjectedPhase, null);
    assert.equal(s.orchestrationActive, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("lastInjectedPhase + orchestrationActive: roundtrip", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, {
      ...defaultState("li-2"),
      phase: "B",
      lastInjectedPhase: "B",
      orchestrationActive: true,
    });
    const s = readState(cwd, "li-2");
    assert.equal(s.lastInjectedPhase, "B");
    assert.equal(s.orchestrationActive, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("lastInjectedPhase: invalid persisted value -> null; orchestrationActive non-bool -> false", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "li-3.json"),
      JSON.stringify({ phase: "P", sessionId: "li-3", lastInjectedPhase: "Z", orchestrationActive: "yes" }),
    );
    const s = readState(cwd, "li-3");
    assert.equal(s.lastInjectedPhase, null);
    assert.equal(s.orchestrationActive, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("readState: IDLE phase forces orchestrationActive false", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, {
      ...defaultState("li-idle"),
      lastInjectedPhase: "IDLE",
      orchestrationActive: true,
    });
    const s = readState(cwd, "li-idle");
    assert.equal(s.phase, "IDLE");
    assert.equal(s.lastInjectedPhase, null);
    assert.equal(s.orchestrationActive, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ── L8: interview tracker round-trip + Phase-1 field preservation ──
import { DIMENSIONS as IV_DIMENSIONS } from "../src/interview.ts";

test("L8: readState round-trips a full InterviewTracker and preserves Phase-1 fields", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    const dims = {};
    for (const d of IV_DIMENSIONS) dims[d] = { level: "max", known: ["k"], unknown: [], confidence: 1, EVIL: 1 };
    writeFileSync(
      join(dir, "iv-1.json"),
      JSON.stringify({
        phase: "P",
        sessionId: "iv-1",
        orchestrationActive: true,
        injectedTurns: ["t1"],
        interview: { roundId: 9, dimensions: dims, contradictions: [], assumptions: [{ id: "a", text: "x", recorded: true }], EVIL: "drop" },
      }),
    );
    const s = readState(cwd, "iv-1");
    // Phase-1 fields preserved
    assert.equal(s.phase, "P");
    assert.equal(s.orchestrationActive, true);
    assert.deepEqual(s.injectedTurns, ["t1"]);
    // tracker round-tripped
    assert.equal(s.interview?.roundId, 9);
    assert.equal(s.interview?.dimensions.goal.level, "max");
    // unknown nested keys dropped (strict reconstruct)
    assert.equal("EVIL" in (s.interview?.dimensions.goal ?? {}), false);
    assert.equal("EVIL" in (s.interview ?? {}), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L8: fresh session reads interview: null", () => {
  const cwd = freshCwd();
  try {
    assert.equal(readState(cwd, "fresh").interview, null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L8 HIGH-1: persisted flags.interview:true with a non-ready tracker reads as false (no flag-trust)", () => {
  const cwd = freshCwd();
  try {
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    // a tracker that is NOT ready (default low dims) but a forged true flag
    writeFileSync(
      join(dir, "forge.json"),
      JSON.stringify({ phase: "I", sessionId: "forge", flags: { interview: true }, interview: { roundId: 1, dimensions: {}, contradictions: [], assumptions: [] } }),
    );
    const s = readState(cwd, "forge");
    assert.equal(s.flags.interview, false, "derived flag must ignore the forged persisted true");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ── 131/D2': interview scan-evidence JSONL ledger ──

test("131: appendInterviewEvent writes parseable scan events; readInterviewEvents counts them", () => {
  const cwd = freshCwd();
  try {
    appendInterviewEvent(cwd, { ts: new Date().toISOString(), sessionId: "iv", event: "scan_started", roundId: 1, contradictionCount: 3, highContradictionCount: 1 });
    appendInterviewEvent(cwd, { ts: new Date().toISOString(), sessionId: "iv", event: "scan_completed", roundId: 1, contradictionCount: 0, highContradictionCount: 0 });
    const events = readInterviewEvents(cwd, "iv");
    assert.equal(events.length, 2);
    assert.equal(events[0].event, "scan_started");
    assert.equal(events[1].event, "scan_completed");
    // file lives under .codexclaw/interviews/
    assert.ok(existsSync(join(cwd, STATE_DIR, INTERVIEWS_SUBDIR, "iv.jsonl")));
    // missing session -> []
    assert.deepEqual(readInterviewEvents(cwd, "nope"), []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("G3 (L20): readInterviewEvents returns scan-only rows from a MIXED ledger (Q/A rows ignored)", () => {
  const cwd = freshCwd();
  try {
    // a real session interleaves Q/A capture rows and scan rows in the SAME file.
    appendInterviewEvent(cwd, { ts: new Date().toISOString(), sessionId: "mix", event: "scan_started", roundId: 1, contradictionCount: 2, highContradictionCount: 1 });
    const file = join(cwd, STATE_DIR, INTERVIEWS_SUBDIR, "mix.jsonl");
    // hand-write Q/A capture rows (interview-ledger shape) into the shared ledger.
    const qa = [
      { ts: new Date().toISOString(), sessionId: "mix", turnId: "t1", event: "question_asked", questionId: "q1", eventId: "t1:q1:question_asked", question: "Goal?" },
      { ts: new Date().toISOString(), sessionId: "mix", turnId: "t1", event: "answer_recorded", questionId: "q1", eventId: "t1:q1:answer_recorded", answers: ["ship it"] },
    ];
    appendFileSync(file, qa.map((e) => JSON.stringify(e)).join("\n") + "\n");
    appendInterviewEvent(cwd, { ts: new Date().toISOString(), sessionId: "mix", event: "scan_completed", roundId: 1, contradictionCount: 0, highContradictionCount: 0 });

    const events = readInterviewEvents(cwd, "mix");
    assert.equal(events.length, 2, "only the 2 scan rows must be returned, not the Q/A rows");
    assert.deepEqual(events.map((e) => e.event), ["scan_started", "scan_completed"]);
    // every returned row must carry the structural scan fields.
    for (const e of events) {
      assert.equal(typeof e.roundId, "number");
      assert.equal(typeof e.contradictionCount, "number");
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
