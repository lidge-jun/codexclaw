import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// B1 (260724 WP1): the advisory resolves the `cxc` invocation per-machine. Pin the
// literal so the command assertion stays deterministic without `cxc` on PATH
// (each test file is its own node --test process — no restore needed).
process.env.CODEXCLAW_CXC = "cxc";

import { handleIdleEditAdvisory } from "../src/idle-edit.ts";
import { writeState, readState, defaultState } from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-idleedit-"));
}

function payload(cwd: string, sessionId: string, tool = "apply_patch"): string {
  return JSON.stringify({ hook_event_name: "PreToolUse", session_id: sessionId, cwd, tool_name: tool });
}

test("IDLE-EDIT-ADVISORY-01: IDLE + loopArmSeen -> allow envelope with additionalContext", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("s1"), loopArmSeen: true });
    const out = handleIdleEditAdvisory(payload(cwd, "s1"));
    assert.notEqual(out, "");
    const parsed = JSON.parse(out.trimEnd());
    assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
    assert.match(parsed.hookSpecificOutput.additionalContext, /IDLE-EDIT/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /cxc orchestrate status --session s1/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /UNIT-RESIDENCE-01/);
    // counter incremented
    assert.equal(readState(cwd, "s1").idleEditNudges, 1);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("IDLE-EDIT-ADVISORY-01: silent without loopArmSeen/goal; silent when FSM armed; non-edit tools ignored", () => {
  const cwd = freshCwd();
  try {
    // plain IDLE session, no flag, no goal DB in tmp HOME-less env -> silent
    writeState(cwd, defaultState("s2"));
    assert.equal(handleIdleEditAdvisory(payload(cwd, "s2")), "");
    // armed FSM -> silent even with flag
    writeState(cwd, { ...defaultState("s3"), phase: "B", orchestrationActive: true, loopArmSeen: true });
    assert.equal(handleIdleEditAdvisory(payload(cwd, "s3")), "");
    // non-edit tool -> silent
    writeState(cwd, { ...defaultState("s4"), loopArmSeen: true });
    assert.equal(handleIdleEditAdvisory(payload(cwd, "s4", "Bash")), "");
    // malformed stdin -> silent (fail-open)
    assert.equal(handleIdleEditAdvisory("{not json"), "");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("IDLE-EDIT-ADVISORY-01: frequency guard — only every 5th gated edit injects", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("s5"), loopArmSeen: true });
    const results: boolean[] = [];
    for (let i = 0; i < 11; i++) results.push(handleIdleEditAdvisory(payload(cwd, "s5")) !== "");
    // fires on counts 0, 5, 10 -> calls 1, 6, 11
    assert.deepEqual(results, [true, false, false, false, false, true, false, false, false, false, true]);
    assert.equal(readState(cwd, "s5").idleEditNudges, 11);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
