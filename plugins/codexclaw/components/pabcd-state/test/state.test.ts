import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
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
  type State,
} from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-state-"));
}

test("readState: missing dir -> default (carries sessionId, phase I)", () => {
  const cwd = freshCwd();
  try {
    const s = readState(cwd, "sess-1");
    assert.equal(s.phase, "I");
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
    assert.equal(s.phase, "I");
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
    assert.equal(s.phase, "I");
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
    assert.equal(s.flags.interview, true);
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
    assert.equal(s.flags.interview, true);
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
