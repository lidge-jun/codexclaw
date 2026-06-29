import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
  detectTrigger,
  buildContextOutput,
  handleUserPromptSubmit,
  handleStop,
  phaseDirective,
  buildStageHeader,
  type UserPromptSubmitPayload,
  type StopPayload,
} from "../src/hook.ts";
import { STATE_DIR, LEDGER_FILE, readState, writeState, defaultState } from "../src/state.ts";
import { GOALS_DB_FILENAME } from "../src/goal-active.ts";

const nodeRequire = createRequire(import.meta.url);

// Build a real goals_1.sqlite under a temp CODEX_SQLITE_HOME so hook.ts's
// getGoalActiveStatus(session_id) (which reads process.env) resolves it.
function withGoalsDb(rows: Array<{ thread_id: string; status: string }>, fn: () => void): void {
  const home = mkdtempSync(join(tmpdir(), "codexclaw-goalsenv-"));
  const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(join(home, GOALS_DB_FILENAME));
  db.exec(`CREATE TABLE thread_goals (thread_id TEXT PRIMARY KEY NOT NULL, goal_id TEXT NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL);`);
  const ins = db.prepare("INSERT INTO thread_goals (thread_id, goal_id, objective, status) VALUES (?,?,?,?)");
  for (const r of rows) ins.run(r.thread_id, `g-${r.thread_id}`, "obj", r.status);
  db.close();
  const prev = process.env.CODEX_SQLITE_HOME;
  process.env.CODEX_SQLITE_HOME = home;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.CODEX_SQLITE_HOME;
    else process.env.CODEX_SQLITE_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  }
}

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

test("L11: active goal suppresses I-trigger (no directive, no interview state)", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "sg1", status: "active" }], () => {
      const out = handleUserPromptSubmit(ups("please interview me", cwd, "sg1", "t1"));
      assert.equal(out, "", "I-trigger must be suppressed while the native goal is active");
      const st = readState(cwd, "sg1");
      assert.equal(st.orchestrationActive, false, "suppressed I must not activate orchestration");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L11: inactive goal allows I-trigger (interview directive injected)", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "sg2", status: "complete" }], () => {
      const out = handleUserPromptSubmit(ups("please interview me", cwd, "sg2", "t1"));
      assert.notEqual(out, "", "inactive goal must allow the interview directive");
      const st = readState(cwd, "sg2");
      assert.equal(st.orchestrationActive, true);
      assert.equal(st.lastInjectedPhase, "I");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("hybrid mode 2: active + phase changed -> full directive for new phase", () => {
  const cwd = freshCwd();
  try {
    // seed: orchestration active, currently phase A, last injected was P
    writeState(cwd, { ...defaultState("s1"), phase: "A", orchestrationActive: true, lastInjectedPhase: "P" });
    const out = handleUserPromptSubmit(ups("here is my work", cwd, "s1", "t2"));
    const parsed = JSON.parse(out.trimEnd());
    assert.equal(parsed.hookSpecificOutput.additionalContext, phaseDirective("A"));
    assert.equal(readState(cwd, "s1").lastInjectedPhase, "A");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("hybrid mode 3: active + same phase -> short stage header every new turn", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("s1"), phase: "A", orchestrationActive: true, lastInjectedPhase: "A" });
    const out = handleUserPromptSubmit(ups("more work", cwd, "s1", "t3"));
    const parsed = JSON.parse(out.trimEnd());
    assert.equal(parsed.hookSpecificOutput.additionalContext, buildStageHeader("A"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("hybrid: idempotent within same (session,turn) across modes", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("s1"), phase: "A", orchestrationActive: true, lastInjectedPhase: "A" });
    const first = handleUserPromptSubmit(ups("x", cwd, "s1", "tDup"));
    const second = handleUserPromptSubmit(ups("x", cwd, "s1", "tDup"));
    assert.notEqual(first, "");
    assert.equal(second, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("hybrid: injectedTurns is bounded to 50 (audit blocker #2)", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("s1"), phase: "A", orchestrationActive: true, lastInjectedPhase: "A" });
    for (let n = 0; n < 60; n++) {
      handleUserPromptSubmit(ups("work", cwd, "s1", `turn-${n}`));
    }
    const st = readState(cwd, "s1");
    assert.ok(st.injectedTurns.length <= 50, `expected <=50, got ${st.injectedTurns.length}`);
    // most recent turn retained, oldest evicted
    assert.ok(st.injectedTurns.includes("turn-59"));
    assert.equal(st.injectedTurns.includes("turn-0"), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ── L2.4: transcript-marker idempotency + context-pressure suppression (R-11) ──
import { writeFileSync } from "node:fs";

test("R-11: passive re-fire with phase marker already in transcript -> no re-inject", () => {
  const cwd = freshCwd();
  try {
    const tpath = join(cwd, "transcript.jsonl");
    // transcript tail already shows the BUILD stage was injected this phase
    writeFileSync(
      tpath,
      JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "[codexclaw — B: BUILD]" } }) + "\n",
    );
    // active orchestration, phase B, last injected already B (mode 3 territory)
    writeState(cwd, { ...defaultState("s1"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B" });
    const payload: UserPromptSubmitPayload = {
      hook_event_name: "UserPromptSubmit",
      session_id: "s1",
      cwd,
      prompt: "keep going", // no explicit trigger
      transcript_path: tpath,
      turn_id: "fresh-turn-after-compaction",
    };
    const out = handleUserPromptSubmit(payload);
    assert.equal(out, "", "should suppress re-injection when marker present in transcript tail");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("R-11: context-pressure transcript suppresses passive injection", () => {
  const cwd = freshCwd();
  try {
    const tpath = join(cwd, "transcript.jsonl");
    writeFileSync(tpath, "# Compacted Session Handoff\nsummary...\n");
    writeState(cwd, { ...defaultState("s2"), phase: "C", orchestrationActive: true, lastInjectedPhase: "B" });
    const payload: UserPromptSubmitPayload = {
      hook_event_name: "UserPromptSubmit",
      session_id: "s2",
      cwd,
      prompt: "continue",
      transcript_path: tpath,
      turn_id: "t-after-compact",
    };
    assert.equal(handleUserPromptSubmit(payload), "", "context-pressure tail must suppress injection");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("R-11: explicit trigger still injects even if a marker is present", () => {
  const cwd = freshCwd();
  try {
    const tpath = join(cwd, "transcript.jsonl");
    writeFileSync(tpath, "[codexclaw — B: BUILD]\n");
    writeState(cwd, { ...defaultState("s3"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B" });
    const payload: UserPromptSubmitPayload = {
      hook_event_name: "UserPromptSubmit",
      session_id: "s3",
      cwd,
      prompt: "orchestrate c now", // explicit trigger overrides dedup
      transcript_path: tpath,
      turn_id: "t-trigger",
    };
    const out = handleUserPromptSubmit(payload);
    assert.match(out, /CHECK/, "explicit trigger must inject despite transcript marker");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ── L10.1: question-shape directive ──
import { QUESTION_SHAPE_DIRECTIVE } from "../src/hook.ts";

test("L10.1: question directive mandates background + recommendation-first options + impact + request_user_input", () => {
  assert.match(QUESTION_SHAPE_DIRECTIVE, /request_user_input only/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /background/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /recommendation FIRST/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /impact\/tradeoff/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /2-3 concrete options/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /subagents never generate/i);
});
