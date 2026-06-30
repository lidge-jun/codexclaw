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
import { STATE_DIR, LEDGER_FILE, readState } from "../src/state.ts";
import { readFileSync } from "node:fs";

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
  assert.equal(detectTrigger("이거 감사해줘"), "A");
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

test("detectTrigger: everyday Korean words do NOT misfire (Galileo blocker #1)", () => {
  assert.equal(detectTrigger("감사합니다"), null); // "thank you" must NOT trigger AUDIT
  assert.equal(detectTrigger("정말 감사해요 도와주셔서"), null);
});

test("detectTrigger: natural Korean with particles/suffixes still matches", () => {
  assert.equal(detectTrigger("계획을 세워줘"), "P");
  assert.equal(detectTrigger("이거 감사해줘"), "A");
  assert.equal(detectTrigger("기능 구현해줘"), "B");
  assert.equal(detectTrigger("검증 좀 해줘"), "C");
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
    // loose-trigger path (parser returns null for prose) — exercises turn dedup.
    const first = handleUserPromptSubmit(ups("plan this", cwd, "s1", "t1"));
    const second = handleUserPromptSubmit(ups("plan this", cwd, "s1", "t1"));
    assert.notEqual(first, "");
    assert.equal(second, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: new turn re-injects", () => {
  const cwd = freshCwd();
  try {
    const first = handleUserPromptSubmit(ups("plan this", cwd, "s1", "t1"));
    const second = handleUserPromptSubmit(ups("plan this", cwd, "s1", "t2"));
    assert.notEqual(first, "");
    assert.notEqual(second, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: different sessions are independent", () => {
  const cwd = freshCwd();
  try {
    const a = handleUserPromptSubmit(ups("plan this", cwd, "alpha", "t1"));
    const b = handleUserPromptSubmit(ups("plan this", cwd, "beta", "t1"));
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

test("hybrid FAIL-CLOSED: fresh session, non-trigger prompt -> '' (no I-phase leak)", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("hello, can you help me", cwd, "s1", "t1"));
    assert.equal(out, "");
    // no state written either (nothing to record)
    assert.equal(existsSync(join(cwd, STATE_DIR)), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("hybrid mode 1: explicit trigger activates orchestration + injects directive", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("orchestrate P", cwd, "s1", "t1"));
    const parsed = JSON.parse(out.trimEnd());
    assert.equal(parsed.hookSpecificOutput.additionalContext, phaseDirective("P"));
    const st = readState(cwd, "s1");
    assert.equal(st.orchestrationActive, true);
    assert.equal(st.lastInjectedPhase, "P");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ── L3b/031: orchestrate command wire (parser-first, human free-pass) ──

function ledgerLines(cwd: string): Array<Record<string, unknown>> {
  const p = join(cwd, STATE_DIR, LEDGER_FILE);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

test("L3b: chat 'orchestrate p' actually moves phase to P + appends one ledger entry", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("orchestrate p", cwd, "s1", "t1"));
    assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, phaseDirective("P"));
    const st = readState(cwd, "s1");
    assert.equal(st.phase, "P"); // the missing wire: phase actually changed
    const led = ledgerLines(cwd);
    assert.equal(led.length, 1);
    assert.equal(led[0].to, "P");
    assert.equal(led[0].reason, "chat");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L3b: human free-pass advances A->B with no --attest", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("orchestrate p", cwd, "s2", "t1"));
    handleUserPromptSubmit(ups("orchestrate a", cwd, "s2", "t2"));
    const out = handleUserPromptSubmit(ups("orchestrate b", cwd, "s2", "t3"));
    assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, phaseDirective("B"));
    assert.equal(readState(cwd, "s2").phase, "B");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L3b: illegal jump 'orchestrate c' from IDLE is refused, no state/ledger", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("orchestrate c", cwd, "s3", "t1"));
    assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, /refused/);
    assert.equal(readState(cwd, "s3").phase, "IDLE");
    assert.equal(ledgerLines(cwd).length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L3b: 'orchestrate reset' returns to IDLE and clears flags", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("orchestrate p", cwd, "s4", "t1"));
    handleUserPromptSubmit(ups("orchestrate a", cwd, "s4", "t2"));
    const out = handleUserPromptSubmit(ups("orchestrate reset", cwd, "s4", "t3"));
    assert.match(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, /reset/);
    const st = readState(cwd, "s4");
    assert.equal(st.phase, "IDLE");
    assert.equal(st.flags.auditPassed, false);
    assert.equal(st.orchestrationActive, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L3b: 'orchestrate status' is read-only (no phase change, no ledger)", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("orchestrate p", cwd, "s5", "t1"));
    const before = ledgerLines(cwd).length;
    const out = handleUserPromptSubmit(ups("orchestrate status", cwd, "s5", "t2"));
    assert.notEqual(out, "");
    assert.equal(readState(cwd, "s5").phase, "P");
    assert.equal(ledgerLines(cwd).length, before); // no new ledger entry
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L3b: same-turn re-fire does NOT double-append the ledger", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("orchestrate p", cwd, "s6", "t1"));
    handleUserPromptSubmit(ups("orchestrate p", cwd, "s6", "t1")); // re-fire same turn
    assert.equal(ledgerLines(cwd).length, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L3b: a prompt with no command still falls through to the loose detectTrigger path", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this feature", cwd, "s7", "t1"));
    // loose path injects the P directive but does NOT move phase via the wire.
    assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, phaseDirective("P"));
    assert.equal(readState(cwd, "s7").phase, "IDLE"); // loose path leaves phase alone
    assert.equal(ledgerLines(cwd).length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
