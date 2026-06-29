import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildStageHeader,
  handleUserPromptSubmit,
  phaseDirective,
  QUESTION_SHAPE_DIRECTIVE,
  type UserPromptSubmitPayload,
} from "../src/hook.ts";
import { GOALS_DB_FILENAME } from "../src/goal-active.ts";
import { defaultState, readState, writeState } from "../src/state.ts";

const nodeRequire = createRequire(import.meta.url);

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
    for (let n = 0; n < 60; n++) handleUserPromptSubmit(ups("work", cwd, "s1", `turn-${n}`));
    const st = readState(cwd, "s1");
    assert.ok(st.injectedTurns.length <= 50, `expected <=50, got ${st.injectedTurns.length}`);
    assert.ok(st.injectedTurns.includes("turn-59"));
    assert.equal(st.injectedTurns.includes("turn-0"), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("R-11: passive re-fire with phase marker already in transcript -> no re-inject", () => {
  const cwd = freshCwd();
  try {
    const tpath = join(cwd, "transcript.jsonl");
    writeFileSync(tpath, JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "[codexclaw — B: BUILD]" } }) + "\n");
    writeState(cwd, { ...defaultState("s1"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B" });
    const out = handleUserPromptSubmit({
      hook_event_name: "UserPromptSubmit",
      session_id: "s1",
      cwd,
      prompt: "keep going",
      transcript_path: tpath,
      turn_id: "fresh-turn-after-compaction",
    });
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
    assert.equal(handleUserPromptSubmit({
      hook_event_name: "UserPromptSubmit",
      session_id: "s2",
      cwd,
      prompt: "continue",
      transcript_path: tpath,
      turn_id: "t-after-compact",
    }), "", "context-pressure tail must suppress injection");
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
    const out = handleUserPromptSubmit({
      hook_event_name: "UserPromptSubmit",
      session_id: "s3",
      cwd,
      prompt: "orchestrate c now",
      transcript_path: tpath,
      turn_id: "t-trigger",
    });
    assert.match(out, /CHECK/, "explicit trigger must inject despite transcript marker");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L10.1: question directive mandates background + recommendation-first options + impact + request_user_input", () => {
  assert.match(QUESTION_SHAPE_DIRECTIVE, /request_user_input only/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /background/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /recommendation FIRST/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /impact\/tradeoff/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /2-3 concrete options/i);
  assert.match(QUESTION_SHAPE_DIRECTIVE, /subagents never generate/i);
});
