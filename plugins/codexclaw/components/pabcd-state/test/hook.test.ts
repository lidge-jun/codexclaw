import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectTrigger,
  buildContextOutput,
  handleUserPromptSubmit,
  handleStop,
  phaseDirective,
  type UserPromptSubmitPayload,
  type StopPayload,
} from "../src/hook.ts";
import { STATE_DIR, LEDGER_FILE } from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-hook-"));
}

function ups(prompt: string, cwd: string, sessionId: string, turnId?: string): UserPromptSubmitPayload {
  return {
    hook_event_name: "UserPromptSubmit",
    session_id: sessionId,
    cwd,
    prompt,
    transcript_path: null,
    turn_id: turnId,
  };
}

test("detectTrigger: explicit triggers map to phases (EN + Korean)", () => {
  assert.equal(detectTrigger("please interview me"), "I");
  assert.equal(detectTrigger("인터뷰 시작하자"), "I");
  assert.equal(detectTrigger("orchestrate I"), "I");
  assert.equal(detectTrigger("orchestrate P now"), "P");
  assert.equal(detectTrigger("plan this feature"), "P");
  assert.equal(detectTrigger("계획 세워줘"), "P");
  assert.equal(detectTrigger("orchestrate A"), "A");
  assert.equal(detectTrigger("audit this plan"), "A");
  assert.equal(detectTrigger("이거 감사해"), "A");
  assert.equal(detectTrigger("orchestrate B"), "B");
  assert.equal(detectTrigger("build this"), "B");
  assert.equal(detectTrigger("이거 구현해"), "B");
  assert.equal(detectTrigger("orchestrate C"), "C");
  assert.equal(detectTrigger("check this output"), "C");
  assert.equal(detectTrigger("검증 좀"), "C");
});

test("detectTrigger: interview wins over plan when both present", () => {
  assert.equal(detectTrigger("interview then plan this"), "I");
});

test("detectTrigger: non-trigger -> null", () => {
  assert.equal(detectTrigger("just a normal message"), null);
  assert.equal(detectTrigger(""), null);
});

test("buildContextOutput: wraps in omo envelope with trailing newline", () => {
  const out = buildContextOutput("UserPromptSubmit", "hello");
  assert.ok(out.endsWith("\n"));
  const parsed = JSON.parse(out.trimEnd());
  assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.equal(parsed.hookSpecificOutput.additionalContext, "hello");
});

test("buildContextOutput: CRLF normalized + trimmed", () => {
  const out = buildContextOutput("UserPromptSubmit", "  a\r\nb\r\n  ");
  const parsed = JSON.parse(out.trimEnd());
  assert.equal(parsed.hookSpecificOutput.additionalContext, "a\nb");
});

test("buildContextOutput: empty / whitespace -> ''", () => {
  assert.equal(buildContextOutput("UserPromptSubmit", ""), "");
  assert.equal(buildContextOutput("UserPromptSubmit", "   \r\n  "), "");
});

test("buildContextOutput: caps at 32k with truncation marker", () => {
  const big = "x".repeat(40_000);
  const out = buildContextOutput("UserPromptSubmit", big);
  const parsed = JSON.parse(out.trimEnd());
  assert.ok(parsed.hookSpecificOutput.additionalContext.length <= 32_000);
  assert.ok(parsed.hookSpecificOutput.additionalContext.endsWith("[truncated]"));
});

test("handleUserPromptSubmit: trigger emits directive envelope once", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("orchestrate P", cwd, "s1", "t1"));
    assert.notEqual(out, "");
    const parsed = JSON.parse(out.trimEnd());
    assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.equal(parsed.hookSpecificOutput.additionalContext, phaseDirective("P"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: idempotent within same (session,turn)", () => {
  const cwd = freshCwd();
  try {
    const first = handleUserPromptSubmit(ups("orchestrate A", cwd, "s1", "t1"));
    const second = handleUserPromptSubmit(ups("orchestrate A", cwd, "s1", "t1"));
    assert.notEqual(first, "");
    assert.equal(second, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: new turn re-injects", () => {
  const cwd = freshCwd();
  try {
    const first = handleUserPromptSubmit(ups("orchestrate B", cwd, "s1", "t1"));
    const second = handleUserPromptSubmit(ups("orchestrate B", cwd, "s1", "t2"));
    assert.notEqual(first, "");
    assert.notEqual(second, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: different sessions are independent", () => {
  const cwd = freshCwd();
  try {
    const a = handleUserPromptSubmit(ups("orchestrate C", cwd, "alpha", "t1"));
    const b = handleUserPromptSubmit(ups("orchestrate C", cwd, "beta", "t1"));
    assert.notEqual(a, "");
    assert.notEqual(b, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: non-trigger -> '' and writes no state", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("hello there", cwd, "s1", "t1"));
    assert.equal(out, "");
    assert.equal(existsSync(join(cwd, STATE_DIR)), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleStop: always '' and creates NO ledger (passive Pass 2)", () => {
  const cwd = freshCwd();
  try {
    const payload: StopPayload = {
      hook_event_name: "Stop",
      session_id: "s1",
      cwd,
      transcript_path: null,
      turn_id: "t1",
      stop_hook_active: false,
      last_assistant_message: "done",
    };
    assert.equal(handleStop(payload), "");
    assert.equal(existsSync(join(cwd, STATE_DIR, LEDGER_FILE)), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
