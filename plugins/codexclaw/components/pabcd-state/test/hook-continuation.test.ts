import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildStageHeader,
  handleUserPromptSubmit,
  handleStop,
  MAX_STOP_BLOCKS,
  phaseDirective,
  interviewDirective,
  QUESTION_SHAPE_DIRECTIVE,
  withFooter,
  type UserPromptSubmitPayload,
  type StopPayload,
} from "../src/hook.ts";
import { GOALS_DB_FILENAME } from "../src/goal-active.ts";
import { defaultState, readState, writeState } from "../src/state.ts";
import { recordObjectiveMetric, writeObjectiveKind } from "../src/metrics.ts";

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

test("L17 firewall: active goal suppresses PASSIVE I re-injection (phase=I already armed)", () => {
  const cwd = freshCwd();
  try {
    // session already armed in phase I, then a native goal becomes active.
    writeState(cwd, { ...defaultState("g-int"), phase: "I", orchestrationActive: true, lastInjectedPhase: "P" });
    withGoalsDb([{ thread_id: "g-int", status: "active" }], () => {
      const out = handleUserPromptSubmit(ups("continue", cwd, "g-int", "t9"));
      assert.equal(out, "", "passive I re-injection must be suppressed under an active goal");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L17 firewall: with NO goal, passive I phase still re-injects the interview directive", () => {
  const cwd = freshCwd();
  try {
    // no goals DB -> getGoalActiveStatus inactive -> interview allowed (HITL).
    writeState(cwd, { ...defaultState("ni"), phase: "I", orchestrationActive: true, lastInjectedPhase: "P" });
    const out = handleUserPromptSubmit(ups("continue", cwd, "ni", "t9"));
    assert.notEqual(out, "", "without a goal the interview must still drive (HITL)");
    const parsed = JSON.parse(out.trimEnd());
    assert.match(parsed.hookSpecificOutput.additionalContext, /INTERVIEW/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L17 wiring: interviewDirective carries the Mind-dispatch contract", () => {
  const d = interviewDirective();
  assert.match(d, /INTERVIEW/);
  assert.match(d, /Mind dispatch/i);
  assert.match(d, /contradiction/i);
});

test("hybrid mode 2: active + phase changed -> full directive for new phase", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("s1"), phase: "A", orchestrationActive: true, lastInjectedPhase: "P" });
    const out = handleUserPromptSubmit(ups("here is my work", cwd, "s1", "t2"));
    const parsed = JSON.parse(out.trimEnd());
    assert.equal(parsed.hookSpecificOutput.additionalContext, withFooter(phaseDirective("A"), "A"));
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
    assert.equal(parsed.hookSpecificOutput.additionalContext, withFooter(buildStageHeader("A"), "A"));
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

// ── L6/060: active Stop-continuation loop with the stagnation guard ──

function stop(cwd: string, sessionId: string, stopHookActive = false): StopPayload {
  return {
    hook_event_name: "Stop",
    session_id: sessionId,
    cwd,
    transcript_path: null,
    turn_id: "t1",
    stop_hook_active: stopHookActive,
    last_assistant_message: "done",
  };
}

function midCycle(cwd: string, sessionId: string, phase: "P" | "A" | "B" | "C" | "D"): void {
  writeState(cwd, { ...defaultState(sessionId), phase, orchestrationActive: true, lastInjectedPhase: phase });
}

test("L6: blocks mid-cycle under an active goal", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b1", status: "active" }], () => {
      midCycle(cwd, "b1", "B");
      const out = handleStop(stop(cwd, "b1"));
      const parsed = JSON.parse(out.trim());
      assert.equal(parsed.decision, "block");
      assert.match(parsed.reason, /B \(BUILD\)/);
      assert.equal(readState(cwd, "b1").stopBlockCount, 1);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L8: Stop continuation prints concrete next commands, never <next>", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([
      { thread_id: "l8-b", status: "active" },
      { thread_id: "l8-c", status: "active" },
      { thread_id: "l8-d", status: "active" },
    ], () => {
      midCycle(cwd, "l8-b", "B");
      const bReason = JSON.parse(handleStop(stop(cwd, "l8-b")).trim()).reason;
      assert.doesNotMatch(bReason, /<next>/);
      assert.match(bReason, /cxc orchestrate C --attest/);

      midCycle(cwd, "l8-c", "C");
      const cReason = JSON.parse(handleStop(stop(cwd, "l8-c")).trim()).reason;
      assert.doesNotMatch(cReason, /<next>/);
      assert.match(cReason, /cxc orchestrate D --attest/);
      assert.match(cReason, /checkOutput/);
      assert.match(cReason, /exitCode/);

      midCycle(cwd, "l8-d", "D");
      const dReason = JSON.parse(handleStop(stop(cwd, "l8-d")).trim()).reason;
      assert.doesNotMatch(dReason, /<next>/);
      assert.match(dReason, /cxc orchestrate reset/);
      assert.doesNotMatch(dReason, /orchestrate IDLE/);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L6: guard 1 — stop_hook_active releases immediately", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b2", status: "active" }], () => {
      midCycle(cwd, "b2", "B");
      assert.equal(handleStop(stop(cwd, "b2", true)), "");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L6: guard 2a — IDLE / inactive orchestration releases", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b3", status: "active" }], () => {
      writeState(cwd, { ...defaultState("b3"), phase: "IDLE", orchestrationActive: false });
      assert.equal(handleStop(stop(cwd, "b3")), "");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L6: guard 2b — no active goal releases even mid-cycle (interactive pause)", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b4", status: "paused" }], () => {
      midCycle(cwd, "b4", "B");
      assert.equal(handleStop(stop(cwd, "b4")), "");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L17 firewall: Stop NEVER drives an active-goal phase=I session (interview is HITL-only)", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "i1", status: "active" }], () => {
      // a session armed at phase=I with an active goal must NOT be continued by Stop.
      writeState(cwd, { ...defaultState("i1"), phase: "I", orchestrationActive: true, lastInjectedPhase: "I" });
      assert.equal(handleStop(stop(cwd, "i1")), "", "Stop must release at phase=I under an active goal");
      // and the stop-block counter must not have been armed.
      assert.equal(readState(cwd, "i1").stopBlockCount, 0);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L6: stagnation cap — releases after MAX_STOP_BLOCKS same-phase blocks", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b5", status: "active" }], () => {
      midCycle(cwd, "b5", "B");
      // first MAX_STOP_BLOCKS calls block; the next releases.
      for (let i = 0; i < MAX_STOP_BLOCKS; i++) {
        assert.notEqual(handleStop(stop(cwd, "b5")), "", `block ${i + 1} should still block`);
      }
      assert.equal(readState(cwd, "b5").stopBlockCount, MAX_STOP_BLOCKS);
      // the cap+1 call releases and resets the counter.
      assert.equal(handleStop(stop(cwd, "b5")), "");
      assert.equal(readState(cwd, "b5").stopBlockCount, 0);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L6: progress resets the stagnation counter (phase change re-arms the budget)", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b6", status: "active" }], () => {
      midCycle(cwd, "b6", "B");
      handleStop(stop(cwd, "b6")); // block at B, count=1
      assert.equal(readState(cwd, "b6").stopBlockCount, 1);
      // a real transition advances to C and resets the guard (simulated via chat wire).
      handleUserPromptSubmit(ups("orchestrate c", cwd, "b6", "tt1"));
      assert.equal(readState(cwd, "b6").stopBlockPhase, null);
      assert.equal(readState(cwd, "b6").stopBlockCount, 0);
      // now blocking at C starts a fresh count.
      handleStop(stop(cwd, "b6"));
      assert.equal(readState(cwd, "b6").stopBlockCount, 1);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("emergence 020: flat maximize metric arms a diverge re-plan Stop block", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "flat1", status: "active" }], () => {
      midCycle(cwd, "flat1", "B");
      recordObjectiveMetric(cwd, { sessionId: "flat1", metricName: "score", value: 10, source: "operator-entered" });
      recordObjectiveMetric(cwd, { sessionId: "flat1", metricName: "score", value: 10, source: "operator-entered" });
      const out = handleStop(stop(cwd, "flat1"));
      const parsed = JSON.parse(out.trim());
      assert.equal(parsed.decision, "block");
      assert.match(parsed.reason, /objective plateau/);
      assert.match(parsed.reason, /divergence/);
      assert.doesNotMatch(parsed.reason, /request_user_input/);
      assert.equal(readState(cwd, "flat1").stopBlockCount, 1);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("emergence 020: improving maximize metric keeps normal continuation", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "up1", status: "active" }], () => {
      midCycle(cwd, "up1", "B");
      recordObjectiveMetric(cwd, { sessionId: "up1", metricName: "score", value: 10, source: "operator-entered" });
      recordObjectiveMetric(cwd, { sessionId: "up1", metricName: "score", value: 11, source: "operator-entered" });
      const reason = JSON.parse(handleStop(stop(cwd, "up1")).trim()).reason;
      assert.match(reason, /continue PABCD/);
      assert.doesNotMatch(reason, /objective plateau/);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("emergence 020: explicit satisfy objective never arms plateau divergence", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "sat1", status: "active" }], () => {
      midCycle(cwd, "sat1", "B");
      writeObjectiveKind(cwd, "sat1", "satisfy");
      recordObjectiveMetric(cwd, { sessionId: "sat1", metricName: "score", value: 10, source: "operator-entered" });
      recordObjectiveMetric(cwd, { sessionId: "sat1", metricName: "score", value: 10, source: "operator-entered" });
      const reason = JSON.parse(handleStop(stop(cwd, "sat1")).trim()).reason;
      assert.match(reason, /continue PABCD/);
      assert.doesNotMatch(reason, /objective plateau/);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("emergence 020: malformed metric ledger fails open to normal continuation", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "badmetric", status: "active" }], () => {
      midCycle(cwd, "badmetric", "B");
      mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
      writeFileSync(join(cwd, ".codexclaw", "metrics.jsonl"), "{not json}\n", { flag: "a" });
      const reason = JSON.parse(handleStop(stop(cwd, "badmetric")).trim()).reason;
      assert.match(reason, /continue PABCD/);
      assert.doesNotMatch(reason, /objective plateau/);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
