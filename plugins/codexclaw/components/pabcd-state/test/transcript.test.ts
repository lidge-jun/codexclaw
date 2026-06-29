import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readTranscriptTail,
  hasStageMarkerForPhase,
  isContextPressureTail,
  CONTEXT_PRESSURE_MARKERS,
} from "../src/transcript.ts";

test("readTranscriptTail: missing/empty path -> '' (fail-open)", () => {
  assert.equal(readTranscriptTail(null), "");
  assert.equal(readTranscriptTail(undefined), "");
  assert.equal(readTranscriptTail("/no/such/file/here.jsonl"), "");
});

test("readTranscriptTail: returns the byte-bounded tail", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-tr-"));
  try {
    const f = join(cwd, "t.jsonl");
    writeFileSync(f, "AAAA\nBBBB\ntail-here");
    assert.match(readTranscriptTail(f, 9), /tail-here/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("hasStageMarkerForPhase: matches both directive head and stage header", () => {
  const directiveLine = JSON.stringify({
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "[codexclaw: PLAN]\nWrite a diff-level plan" },
  });
  assert.equal(hasStageMarkerForPhase(directiveLine, "P"), true);
  assert.equal(hasStageMarkerForPhase("[codexclaw — A: AUDIT]", "A"), true);
  assert.equal(hasStageMarkerForPhase(directiveLine, "B"), false);
  assert.equal(hasStageMarkerForPhase("", "P"), false);
  assert.equal(hasStageMarkerForPhase("noise", "IDLE"), false);
});

test("isContextPressureTail: detects compaction recovery markers", () => {
  assert.equal(isContextPressureTail("... Compacted Session Handoff ..."), true);
  assert.equal(isContextPressureTail("the conversation history has been summarized to free up"), true);
  assert.equal(isContextPressureTail("ordinary transcript text"), false);
  assert.ok(CONTEXT_PRESSURE_MARKERS.length >= 2);
});
