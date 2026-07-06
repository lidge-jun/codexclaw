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
