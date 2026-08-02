/**
 * interview-ledger.test.ts — L12 WP4 PostToolUse answer capture.
 *
 * Records request_user_input question + answer into the per-session interview
 * ledger, dedups by derived event id, and fails safe on malformed payloads.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// B1 (260724 WP1): the L18 reinjection resolves the `cxc` invocation per-machine,
// so the equality assertion against RESCAN_REINJECT_DIRECTIVE needs the literal
// pinned (each test file is its own node --test process — no restore needed).
process.env.CODEXCLAW_CXC = "cxc";

import {
  captureInterviewAnswers,
  readQaEvents,
  deriveEventId,
  parseQuestions,
  parseAnswers,
} from "../src/interview-ledger.ts";
import { handlePostToolUse, RESCAN_REINJECT_DIRECTIVE, type PostToolUsePayload } from "../src/hook.ts";
import { defaultState, writeState } from "../src/state.ts";

function tmp() {
  return mkdtempSync(join(tmpdir(), "cxc-iledger-"));
}

const TOOL_INPUT = {
  questions: [
    { id: "q_scope", header: "Scope", question: "How wide should the rescan be?" },
    { id: "q_chat", header: "ChatSearch", question: "Remove or keep chat-search?" },
  ],
};
const TOOL_RESPONSE = {
  answers: {
    q_scope: { answers: ["adaptive 1-N"] },
    q_chat: { answers: ["remove it"] },
  },
};

test("parseQuestions + parseAnswers extract the request_user_input shape", () => {
  const qs = parseQuestions(TOOL_INPUT);
  assert.deepEqual(qs.map((q) => q.questionId), ["q_scope", "q_chat"]);
  assert.equal(qs[0].question, "How wide should the rescan be?");
  const ans = parseAnswers(TOOL_RESPONSE);
  assert.deepEqual(ans.q_scope, ["adaptive 1-N"]);
});

test("captureInterviewAnswers records question + answer events per question", () => {
  const cwd = tmp();
  const res = captureInterviewAnswers({
    cwd,
    sessionId: "sess-1",
    turnId: "turn-1",
    toolInput: TOOL_INPUT,
    toolResponse: TOOL_RESPONSE,
  });
  // 2 questions -> 2 asked + 2 answered
  assert.equal(res.written.length, 4);
  const events = readQaEvents(cwd, "sess-1");
  assert.equal(events.filter((e) => e.event === "question_asked").length, 2);
  assert.equal(events.filter((e) => e.event === "answer_recorded").length, 2);
  const answered = events.find((e) => e.event === "answer_recorded" && e.questionId === "q_chat");
  assert.deepEqual(answered?.answers, ["remove it"]);
});

// 260802 wp2 — the host may serialize request_user_input payloads as JSON STRINGS.
// Before this fix, a string tool_response silently produced ZERO answer_recorded
// events (222 question_asked / 0 answer_recorded across every shipped ledger), so
// the interview never accumulated a single answer. See
// devlog/_plan/260802_interview_answer_capture/.

test("parseAnswers accepts a JSON-string tool_response (host wire shape)", () => {
  const ans = parseAnswers(JSON.stringify(TOOL_RESPONSE));
  assert.deepEqual(ans.q_scope, ["adaptive 1-N"]);
  assert.deepEqual(ans.q_chat, ["remove it"]);
});

test("parseQuestions accepts a JSON-string tool_input (host wire shape)", () => {
  const qs = parseQuestions(JSON.stringify(TOOL_INPUT));
  assert.deepEqual(qs.map((q) => q.questionId), ["q_scope", "q_chat"]);
  assert.equal(qs[0].question, "How wide should the rescan be?");
});

test("captureInterviewAnswers records answers when tool_response is a JSON string", () => {
  const cwd = tmp();
  const res = captureInterviewAnswers({
    cwd,
    sessionId: "sess-str",
    turnId: "turn-1",
    toolInput: TOOL_INPUT,
    toolResponse: JSON.stringify(TOOL_RESPONSE),
  });
  assert.equal(res.written.length, 4);
  const events = readQaEvents(cwd, "sess-str");
  assert.equal(events.filter((e) => e.event === "answer_recorded").length, 2);
  const answered = events.find((e) => e.event === "answer_recorded" && e.questionId === "q_scope");
  assert.deepEqual(answered?.answers, ["adaptive 1-N"]);
});

test("captureInterviewAnswers handles a fully stringified round (both sides)", () => {
  const cwd = tmp();
  const res = captureInterviewAnswers({
    cwd,
    sessionId: "sess-both",
    turnId: "turn-1",
    toolInput: JSON.stringify(TOOL_INPUT),
    toolResponse: JSON.stringify(TOOL_RESPONSE),
  });
  assert.equal(res.written.length, 4);
  const events = readQaEvents(cwd, "sess-both");
  assert.equal(events.filter((e) => e.event === "question_asked").length, 2);
  assert.equal(events.filter((e) => e.event === "answer_recorded").length, 2);
});

test("malformed string payloads stay total and record nothing", () => {
  // Each of these must return empty rather than throwing: truncated JSON, a
  // valid-JSON non-object, an array, and a bare scalar.
  for (const bad of ["{", "null", "[]", "[1,2]", "5", '"str"', ""]) {
    assert.deepEqual(parseAnswers(bad), {});
    assert.deepEqual(parseQuestions(bad), []);
  }
  const cwd = tmp();
  const res = captureInterviewAnswers({
    cwd,
    sessionId: "sess-bad",
    turnId: "turn-1",
    toolInput: "{",
    toolResponse: "{",
  });
  assert.equal(res.written.length, 0);
});

// 260802 wp2, audit round 2 — the reviewer showed the JSON-string hypothesis is
// one member of an equivalence class: SEVEN distinct tool_response shapes all
// reproduce the 222/0 signature. Handle every recoverable member, since we
// still have no direct observation of the hook wire (A-WIRE-01).

test("parseAnswers decodes every recoverable transport shape", () => {
  const body = { answers: { q_scope: { answers: ["adaptive 1-N"] } } };
  const expect = (v: unknown, label: string) =>
    assert.deepEqual(parseAnswers(v).q_scope, ["adaptive 1-N"], label);

  expect(body, "plain object");
  expect(JSON.stringify(body), "json string");
  expect(JSON.stringify(JSON.stringify(body)), "double-encoded string");
  expect([body], "array of one object");
  expect([{ type: "input_text", text: JSON.stringify(body) }], "content blocks");
  expect({ output: JSON.stringify(body) }, "nested under output");
  expect({ text: body }, "nested under text as object");
});

test("unrecoverable shapes still degrade to empty", () => {
  for (const bad of [undefined, null, 42, true, "plain prose, not json", [], [null], {}]) {
    assert.deepEqual(parseAnswers(bad), {});
  }
});

test("a __proto__ question id cannot forge an answer", () => {
  const hostile = '{"answers":{"__proto__":{"answers":["pwn"]},"q_real":{"answers":["ok"]}}}';
  const out = parseAnswers(hostile);
  assert.deepEqual(out.q_real, ["ok"], "legitimate answer still parses");
  // Before the guard, out["__proto__"] = [...] replaced the map's prototype, so
  // an unrelated lookup could surface the attacker's array as a real answer.
  assert.equal(Object.getPrototypeOf(out), null, "prototype must not be replaced");
  assert.equal(out.anything_else, undefined, "no forged answer leaks through lookup");
  assert.deepEqual(Object.getOwnPropertyNames({}), [], "global Object.prototype untouched");
});

test("goal-firewall capture also holds for string payloads", () => {
  // Mirror of the object-shaped firewall case: capture is a pure recorder and
  // must behave identically regardless of payload transport (audit C-5).
  const cwd = tmp();
  const res = captureInterviewAnswers({
    cwd,
    sessionId: "sess-fw-str",
    turnId: "turn-1",
    toolInput: JSON.stringify(TOOL_INPUT),
    toolResponse: JSON.stringify(TOOL_RESPONSE),
  });
  assert.equal(res.written.length, 4);
  const events = readQaEvents(cwd, "sess-fw-str");
  assert.equal(events.filter((e) => e.event === "answer_recorded").length, 2);
});

test("captureInterviewAnswers is idempotent for the same (turn,question,kind)", () => {
  const cwd = tmp();
  const first = captureInterviewAnswers({ cwd, sessionId: "s", turnId: "t1", toolInput: TOOL_INPUT, toolResponse: TOOL_RESPONSE });
  assert.equal(first.written.length, 4);
  // re-fire same turn -> nothing new
  const again = captureInterviewAnswers({ cwd, sessionId: "s", turnId: "t1", toolInput: TOOL_INPUT, toolResponse: TOOL_RESPONSE });
  assert.equal(again.written.length, 0);
  assert.equal(readQaEvents(cwd, "s").length, 4);
  // a NEW turn re-asks the same questions -> new events
  const t2 = captureInterviewAnswers({ cwd, sessionId: "s", turnId: "t2", toolInput: TOOL_INPUT, toolResponse: TOOL_RESPONSE });
  assert.equal(t2.written.length, 4);
});

test("deriveEventId is stable + distinct per kind", () => {
  assert.equal(deriveEventId("t", "q", "question_asked"), "t:q:question_asked");
  assert.notEqual(deriveEventId("t", "q", "question_asked"), deriveEventId("t", "q", "answer_recorded"));
});

test("question with no recorded answer yields only a question_asked event", () => {
  const cwd = tmp();
  const res = captureInterviewAnswers({
    cwd,
    sessionId: "s",
    turnId: "t",
    toolInput: { questions: [{ id: "q1", question: "unanswered?" }] },
    toolResponse: { answers: {} },
  });
  assert.equal(res.written.length, 1);
  assert.equal(res.written[0].event, "question_asked");
});

test("malformed payloads fail safe: no events, no throw", () => {
  const cwd = tmp();
  assert.doesNotThrow(() => captureInterviewAnswers({ cwd, sessionId: "s", turnId: "t", toolInput: null, toolResponse: "garbage" }));
  assert.equal(readQaEvents(cwd, "s").length, 0);
  // missing sessionId -> no write
  const res = captureInterviewAnswers({ cwd, sessionId: "", turnId: "t", toolInput: TOOL_INPUT, toolResponse: TOOL_RESPONSE });
  assert.equal(res.written.length, 0);
});

test("handlePostToolUse captures only request_user_input; non-I phase returns empty", () => {
  const cwd = tmp();
  const base: PostToolUsePayload = {
    hook_event_name: "PostToolUse",
    session_id: "s",
    cwd,
    tool_name: "request_user_input",
    tool_input: TOOL_INPUT,
    tool_response: TOOL_RESPONSE,
    turn_id: "t1",
  };
  // no session state -> phase IDLE -> capture only, no reinjection
  assert.equal(handlePostToolUse(base, { goalStatus: () => "inactive" }), "");
  assert.equal(readQaEvents(cwd, "s").length, 4);

  // a different tool is a no-op
  const other = { ...base, tool_name: "shell", session_id: "s2" };
  assert.equal(handlePostToolUse(other, { goalStatus: () => "inactive" }), "");
  assert.equal(readQaEvents(cwd, "s2").length, 0);
});

test("handlePostToolUse L18: I-phase + no goal => rescan directive reinjected as additionalContext", () => {
  const cwd = tmp();
  writeState(cwd, { ...defaultState("s"), phase: "I", orchestrationActive: true });
  const base: PostToolUsePayload = {
    hook_event_name: "PostToolUse",
    session_id: "s",
    cwd,
    tool_name: "request_user_input",
    tool_input: TOOL_INPUT,
    tool_response: TOOL_RESPONSE,
    turn_id: "t1",
  };
  const out = handlePostToolUse(base, { goalStatus: () => "inactive" });
  assert.notEqual(out, "");
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.equal(parsed.hookSpecificOutput.additionalContext, RESCAN_REINJECT_DIRECTIVE);
  // capture still happened alongside the reinjection
  assert.equal(readQaEvents(cwd, "s").length, 4);
});

test("handlePostToolUse L18: goal active or unreadable => capture only, no reinjection (firewall)", () => {
  for (const status of ["active", "unreadable"] as const) {
    const cwd = tmp();
    writeState(cwd, { ...defaultState("s"), phase: "I", orchestrationActive: true });
    const base: PostToolUsePayload = {
      hook_event_name: "PostToolUse",
      session_id: "s",
      cwd,
      tool_name: "request_user_input",
      tool_input: TOOL_INPUT,
      tool_response: TOOL_RESPONSE,
      turn_id: "t1",
    };
    assert.equal(handlePostToolUse(base, { goalStatus: () => status }), "");
    assert.equal(readQaEvents(cwd, "s").length, 4, `capture must still run when goal is ${status}`);
  }
});
