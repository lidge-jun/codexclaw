import test from "node:test";
import assert from "node:assert/strict";
import {
  detectRecallIntent,
  handleUserPromptSubmit,
  handleSessionStart,
  handlePostCompact,
} from "../src/hook.ts";

test("recall intent: korean idioms trigger", () => {
  for (const p of [
    "그때 그 작업 이어서 해줘",
    "지난번에 하던 리팩토링 계속",
    "저번 세션에서 결정한 스키마 뭐였지",
    "예전에 만든 스크립트 찾아줘",
    "트라이그램 인덱스 어디까지 했지?",
    "그 플래그 기억나? 다시 설명해줘",
  ]) {
    assert.ok(detectRecallIntent(p), `should trigger: ${p}`);
  }
});

test("recall intent: english idioms trigger", () => {
  for (const p of [
    "continue what we did last session",
    "what did we decide about the schema?",
    "remember when we fixed the ingest race?",
    "as discussed earlier, ship the index",
    "previously we capped tool output — why?",
  ]) {
    assert.ok(detectRecallIntent(p), `should trigger: ${p}`);
  }
});

test("recall intent: neutral prompts and self-recalling prompts stay silent", () => {
  for (const p of [
    "add a --json flag to the status command",
    "빌드 돌리고 테스트 고쳐줘",
    "run cxc chat search \"trigram\" --days 0 and summarize",
    "use $cxc-recall on this",
    "",
  ]) {
    assert.equal(detectRecallIntent(p), false, `should NOT trigger: ${p}`);
  }
});

test("handler emits the pabcd-parity envelope only for recall intents", () => {
  const out = handleUserPromptSubmit({
    hook_event_name: "UserPromptSubmit",
    prompt: "지난번 세션 이어서",
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(parsed.hookSpecificOutput.additionalContext, /cxc chat search/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /cxc memory search/);
  assert.ok(out.endsWith("\n"));

  assert.equal(handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit", prompt: "hi" }), "");
  assert.equal(handleUserPromptSubmit({ hook_event_name: "Stop", prompt: "지난번" }), "");
  assert.equal(handleUserPromptSubmit({} as never), "", "fail-open on malformed payloads");
});

test("session-start advertises recall with and without index status", () => {
  const withStatus = JSON.parse(handleSessionStart("1769 files / 354798 messages, last ingest X"));
  assert.equal(withStatus.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(withStatus.hookSpecificOutput.additionalContext, /cxc chat search/);
  assert.match(withStatus.hookSpecificOutput.additionalContext, /Index: 1769 files/);
  const bare = JSON.parse(handleSessionStart(""));
  assert.match(bare.hookSpecificOutput.additionalContext, /\$cxc-recall/);
  assert.ok(!bare.hookSpecificOutput.additionalContext.includes("Index:"));
});

test("post-compact steers recovery through recall search", () => {
  const out = JSON.parse(handlePostCompact());
  assert.equal(out.hookSpecificOutput.hookEventName, "PostCompact");
  assert.match(out.hookSpecificOutput.additionalContext, /compacted/);
  assert.match(out.hookSpecificOutput.additionalContext, /cxc chat search/);
  assert.match(out.hookSpecificOutput.additionalContext, /cxc memory search/);
});
