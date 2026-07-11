// parse.test.ts — subagent hook-payload discrimination (260709 subagent hook guard).
//
// isSubagentHookPayload is the cli.ts choke-point predicate: turn-level hooks
// no-op when codex-rs stamps agent_id/agent_type into the stdin payload
// (thread-spawned subagent turns). The `subagent-stop` exemption lives in
// cli.ts event branching, NOT here — this predicate is payload-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSubagentHookPayload, parseSessionStart } from "../src/parse.ts";

const root = {
  hook_event_name: "UserPromptSubmit",
  session_id: "s1",
  cwd: "/tmp/x",
  prompt: "interview me",
  turn_id: "t1",
};

test("SessionStart parser: accepts a canonical root payload and preserves validated strings", () => {
  assert.deepEqual(
    parseSessionStart(JSON.stringify({
      hook_event_name: "SessionStart",
      session_id: "session-1",
      cwd: "/tmp/workspace",
    })),
    {
      hook_event_name: "SessionStart",
      session_id: "session-1",
      cwd: "/tmp/workspace",
    },
  );
});

test("SessionStart parser: malformed, wrong-event, and missing inputs return null", () => {
  for (const raw of [
    "",
    "   ",
    "{not json",
    "[]",
    JSON.stringify({ session_id: "s1", cwd: "/tmp/x" }),
    JSON.stringify({ hook_event_name: "Stop", session_id: "s1", cwd: "/tmp/x" }),
    JSON.stringify({ hook_event_name: "SessionStart", cwd: "/tmp/x" }),
    JSON.stringify({ hook_event_name: "SessionStart", session_id: "s1" }),
  ]) {
    assert.equal(parseSessionStart(raw), null, raw);
  }
});

test("SessionStart parser: empty, whitespace, or rewritten identities return null", () => {
  for (const payload of [
    { hook_event_name: "SessionStart", session_id: "", cwd: "/tmp/x" },
    { hook_event_name: "SessionStart", session_id: " \t\n", cwd: "/tmp/x" },
    { hook_event_name: "SessionStart", session_id: "  session-1  ", cwd: "/tmp/x" },
    { hook_event_name: "SessionStart", session_id: "../session-1", cwd: "/tmp/x" },
    { hook_event_name: "SessionStart", session_id: "세션-1", cwd: "/tmp/x" },
    { hook_event_name: "SessionStart", session_id: "s1", cwd: "" },
    { hook_event_name: "SessionStart", session_id: "s1", cwd: " \t\n" },
  ]) {
    assert.equal(parseSessionStart(JSON.stringify(payload)), null);
  }
});

test("subagent-guard: root payload (no agent fields) -> false", () => {
  assert.equal(isSubagentHookPayload(JSON.stringify(root)), false);
});

test("subagent-guard: agent_type present -> true", () => {
  assert.equal(isSubagentHookPayload(JSON.stringify({ ...root, agent_type: "worker" })), true);
});

test("subagent-guard: agent_id alone -> true", () => {
  assert.equal(isSubagentHookPayload(JSON.stringify({ ...root, agent_id: "a-1" })), true);
});

test("subagent-guard: empty-string agent fields do not count", () => {
  assert.equal(isSubagentHookPayload(JSON.stringify({ ...root, agent_id: "", agent_type: "" })), false);
});

test("subagent-guard: non-string agent fields do not count", () => {
  assert.equal(isSubagentHookPayload(JSON.stringify({ ...root, agent_id: 7, agent_type: null })), false);
});

test("subagent-guard: empty/malformed stdin -> false (fail-open for root)", () => {
  assert.equal(isSubagentHookPayload(""), false);
  assert.equal(isSubagentHookPayload("   "), false);
  assert.equal(isSubagentHookPayload("{not json"), false);
  assert.equal(isSubagentHookPayload("[1,2]"), false);
});

test("subagent-guard: SubagentStop payload is detected (cli exempts it by event, not here)", () => {
  const payload = {
    hook_event_name: "SubagentStop",
    session_id: "s1",
    cwd: "/tmp/x",
    agent_type: "worker",
    agent_id: "a-1",
  };
  assert.equal(isSubagentHookPayload(JSON.stringify(payload)), true);
});
