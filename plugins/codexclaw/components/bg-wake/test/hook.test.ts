/**
 * hook.test.ts — the switch, the wake, and the fail-open contract.
 *
 * These three are the ones that can hurt a user: a hook that blocks forever, a hook
 * that swallows a completion, and a hook that reports an error in a way Codex reads
 * as a block. Everything else is convenience.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleSessionStart, handleStop, handleUserPromptSubmit } from "../src/hook.ts";
import { readRecord, writeRecord, type BgRecord } from "../src/registry.ts";
import { atomicWrite, disabledPath, ensureDir } from "../src/store.ts";

function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "bgwake-"));
  mkdirSync(join(dir, ".codexclaw"), { recursive: true });
  ensureDir(dir);
  return dir;
}

function done(cwd: string, id: string, sessionId: string | null, over: Partial<BgRecord> = {}): BgRecord {
  const rec: BgRecord = {
    id,
    sessionId,
    adoptedBy: null,
    cwd,
    command: ["npm", "run", "build"],
    note: null,
    pid: null,
    startToken: null,
    status: "complete",
    exitCode: 0,
    startedAt: "2026-09-09T00:00:00.000Z",
    endedAt: "2026-09-09T00:04:12.000Z",
    deliveredAt: null,
    ...over,
  };
  writeRecord(rec);
  return rec;
}

const NO_ENV = {} as NodeJS.ProcessEnv;

test("Stop blocks once for an undelivered completion, then releases", () => {
  const cwd = workspace();
  done(cwd, "build1", "S1");
  const first = handleStop({ session_id: "S1", cwd }, cwd, NO_ENV);
  const parsed = JSON.parse(first);
  assert.equal(parsed.decision, "block");
  assert.ok(parsed.reason.length > 0, "an empty reason is a Failed hook, not a block");
  assert.match(parsed.reason, /build1/);
  assert.equal(readRecord(cwd, "build1")?.deliveredAt !== null, true);
  // The second Stop is the one that would loop forever if deliveredAt were not stamped.
  assert.equal(handleStop({ session_id: "S1", cwd }, cwd, NO_ENV), "");
});

test("Stop releases when nothing has completed", () => {
  const cwd = workspace();
  // startedAt must be recent: an old pid-less record now reconciles to failed, which
  // is the point of the spawn-failure backstop.
  done(cwd, "still", "S1", { status: "running", endedAt: null, exitCode: null, startedAt: new Date().toISOString() });
  assert.equal(handleStop({ session_id: "S1", cwd }, cwd, NO_ENV), "");
});

test("Stop does not wake another session's task", () => {
  const cwd = workspace();
  done(cwd, "theirs", "OTHER");
  assert.equal(handleStop({ session_id: "S1", cwd }, cwd, NO_ENV), "");
});

test("the off flag silences every hook immediately", () => {
  const cwd = workspace();
  done(cwd, "build1", "S1");
  atomicWrite(disabledPath(cwd), new Date().toISOString());
  assert.equal(handleStop({ session_id: "S1", cwd }, cwd, NO_ENV), "");
  assert.equal(handleUserPromptSubmit({ session_id: "S1", cwd }, cwd, NO_ENV), "");
  assert.equal(handleSessionStart({ session_id: "S1", cwd }, cwd, NO_ENV), "");
  assert.equal(readRecord(cwd, "build1")?.deliveredAt, null, "a silenced hook must not consume the completion");
});

test("CXC_BGWAKE=0 silences every hook", () => {
  const cwd = workspace();
  done(cwd, "build1", "S1");
  const env = { CXC_BGWAKE: "0" } as NodeJS.ProcessEnv;
  assert.equal(handleStop({ session_id: "S1", cwd }, cwd, env), "");
  assert.equal(handleUserPromptSubmit({ session_id: "S1", cwd }, cwd, env), "");
  assert.equal(readRecord(cwd, "build1")?.deliveredAt, null);
});

test("UserPromptSubmit injects and never decides", () => {
  const cwd = workspace();
  done(cwd, "build1", "S1");
  const out = handleUserPromptSubmit({ session_id: "S1", cwd }, cwd, NO_ENV);
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(parsed.hookSpecificOutput.additionalContext, /build1/);
  assert.equal("decision" in parsed, false, "a decision here would reject the user's prompt");
});

test("SessionStart adopts a previous session's undelivered completion", () => {
  const cwd = workspace();
  done(cwd, "old", "GONE");
  const out = handleSessionStart({ session_id: "S2", cwd }, cwd, NO_ENV);
  assert.match(out, /hookSpecificOutput/);
  assert.equal(readRecord(cwd, "old")?.adoptedBy, "S2");
  // Adoption is not delivery: the next Stop is what actually hands it over.
  assert.equal(readRecord(cwd, "old")?.deliveredAt, null);
  const parsed = JSON.parse(handleStop({ session_id: "S2", cwd }, cwd, NO_ENV));
  assert.equal(parsed.decision, "block");
});

test("a corrupt record never blocks the session", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, ".codexclaw", "bg", "broken.json"), "{ not json", "utf8");
  assert.equal(handleStop({ session_id: "S1", cwd }, cwd, NO_ENV), "");
  assert.equal(handleUserPromptSubmit({ session_id: "S1", cwd }, cwd, NO_ENV), "");
  assert.equal(handleSessionStart({ session_id: "S1", cwd }, cwd, NO_ENV), "");
});

test("a missing registry is silence, not an error", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bgwake-bare-"));
  assert.equal(handleStop({ session_id: "S1", cwd }, cwd, NO_ENV), "");
  assert.equal(handleSessionStart({ session_id: "S1", cwd }, cwd, NO_ENV), "");
});

test("a wake carries at most five completions", () => {
  const cwd = workspace();
  for (let i = 0; i < 8; i += 1) done(cwd, "t" + i, "S1", { endedAt: "2026-09-09T00:0" + i + ":00.000Z" });
  const parsed = JSON.parse(handleStop({ session_id: "S1", cwd }, cwd, NO_ENV));
  assert.match(parsed.reason, /5건/);
  const remaining = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"].filter((id) => readRecord(cwd, id)?.deliveredAt === null);
  assert.equal(remaining.length, 3);
});

