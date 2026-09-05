import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildStageHeader,
  handleUserPromptSubmit,
  handleStop,
  MAX_STOP_BLOCKS,
  MAX_STOP_BLOCKS_TOTAL,
  phaseDirective,
  interviewDirective,
  QUESTION_SHAPE_DIRECTIVE,
  withFooter,
  buildStopBlock,
  readStopWorkContext,
  handlePostCompact,
  type UserPromptSubmitPayload,
  type StopPayload,
} from "../src/hook.ts";
import { GOALS_DB_FILENAME } from "../src/goal-active.ts";
import { defaultState, readState, writeState } from "../src/state.ts";
import { checkObjectivePlateau, recordObjectiveMetric, writeObjectiveKind } from "../src/metrics.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { recordDivergenceCandidate } from "../src/divergence.ts";

const nodeRequire = createRequire(import.meta.url);

// B1 (260724 WP1): emit sites resolve the `cxc` invocation per-machine (PATH scan /
// payload dispatcher). Pin the literal so command-string assertions below stay
// deterministic on machines without `cxc` on PATH. Each test FILE is its own
// node --test process, so this setup pin needs no restore.
process.env.CODEXCLAW_CXC = "cxc";

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

test("L11: inactive goal allows I advice without automatic phase entry", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "sg2", status: "complete" }], () => {
      const out = handleUserPromptSubmit(ups("please interview me", cwd, "sg2", "t1"));
      assert.notEqual(out, "", "inactive goal must allow the interview directive");
      const st = readState(cwd, "sg2");
      assert.equal(st.phase, "IDLE");
      assert.equal(st.orchestrationActive, false);
      assert.equal(st.lastInjectedPhase, null);
      assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /IPABCD: IDLE \(IDLE\)/);
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

// 260802 WP4 — the I directive is what actually reaches the model, so the
// grounding rules are asserted on the EMITTED text, not on a standalone
// constant. QUESTION_SHAPE_DIRECTIVE is the cautionary case: it has always
// carried the right words and has never been injected anywhere.
test("WP4: the emitted interview directive names the state-grounding loop", () => {
  const d = interviewDirective();
  // Without this citation no agent has any reason to run the deriver, so the
  // tracker stays empty and every question is generated from a blank slate.
  assert.match(d, /cxc scan record[^\n]*--derive/, "must cite the deriver command");
  assert.match(d, /--map/, "must show how questions are attributed to a dimension");
  assert.match(d, /known\[\]/, "must name where answers land");
  assert.match(d, /unknown\[\]/, "must name where gaps land");
  assert.match(d, /\.codexclaw\/sessions/, "must say where to read the state back");
  assert.match(d, /INTERVIEW-GROUND-01/);
});

test("WP4: the emitted interview directive requires a pre-question status render", () => {
  const d = interviewDirective();
  assert.match(d, /INTERVIEW-RENDER-01/);
  assert.match(d, /weakest/i, "the render must name the weakest dimension");
  assert.match(d, /before the question/i);
});

test("WP4: batching is governed by independence, not a count", () => {
  const d = interviewDirective();
  assert.match(d, /INTERVIEW-INDEPENDENT-01/);
  assert.match(d, /INDEPENDENT/);
  assert.match(d, /independence governs, not a count/i);
});

test("WP4: the directive still fits the injection budget", () => {
  // Injected context is capped and shared with the Mind-dispatch block and the
  // phase footer; gjc-scale prose would simply be truncated away.
  const d = interviewDirective();
  assert.ok(d.length < 8000, `interview directive grew to ${d.length} chars`);
});

// The three tests above call interviewDirective() directly, so they prove the
// directive's CONTENTS but not its DELIVERY. A reviewer demonstrated the gap by
// mutation: swapping interviewDirective() for phaseDirective("I") at the
// injection sites severed the grounding block from the hook output and the whole
// suite stayed green, because the generic /INTERVIEW/ assertion still matched.
// These assert the grounding rules on actual hook STDOUT, so the wiring cannot be
// cut silently -- the exact failure QUESTION_SHAPE_DIRECTIVE has been living for
// months.

function groundingContext(out: string): string {
  assert.notEqual(out, "", "hook emitted nothing");
  return JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
}

test("WP4 delivery: the passive I-phase injection carries the grounding rules", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("gr1"), phase: "I", orchestrationActive: true, lastInjectedPhase: "P" });
    const ctx = groundingContext(handleUserPromptSubmit(ups("continue", cwd, "gr1", "t-gr1")));
    assert.match(ctx, /INTERVIEW-GROUND-01/, "grounding rule must reach the model");
    assert.match(ctx, /cxc scan record[^\n]*--derive/, "the deriver command must reach the model");
    assert.match(ctx, /INTERVIEW-RENDER-01/);
    assert.match(ctx, /INTERVIEW-INDEPENDENT-01/);
    assert.match(ctx, /Mind dispatch/i, "the Mind contract must still ride along");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("WP4 delivery: the explicit I trigger carries the grounding rules", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("gr2"), phase: "IDLE" });
    const ctx = groundingContext(handleUserPromptSubmit(ups("interview me about this", cwd, "gr2", "t-gr2")));
    assert.match(ctx, /INTERVIEW-GROUND-01/);
    assert.match(ctx, /--map/);
    assert.equal(readState(cwd, "gr2").phase, "IDLE");
    assert.equal(readState(cwd, "gr2").orchestrationActive, false);
    assert.equal(readState(cwd, "gr2").lastInjectedPhase, null);
    assert.match(ctx, /IPABCD: IDLE \(IDLE\)/);
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
    assert.equal(parsed.hookSpecificOutput.additionalContext, withFooter(phaseDirective("A"), "A"));
    assert.match(parsed.hookSpecificOutput.additionalContext, /\$codexclaw:cxc-pabcd/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /\$codexclaw:cxc-dev-code-reviewer/);
    assert.equal(readState(cwd, "s1").lastInjectedPhase, "A");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp3: passive phase pointers carry limits while mode3 and dedup remain unchanged", () => {
  for (const phase of ["P", "A", "B", "C", "D"] as const) {
    const cwd = freshCwd();
    try {
      const session = "wp3-passive";
      writeState(cwd, { ...defaultState(session), phase,
        orchestrationActive: true, lastInjectedPhase: "I" });
      const first = handleUserPromptSubmit(ups("Read-only; no-tests; no-delegation; no-FSM.", cwd, session, "p1"));
      const ctx = groundingContext(first);
      assert.match(ctx, /Apply this pointer and its owners within exact user limits and permissions/);
      assert.match(ctx, /No-delegation means no dispatch/);
      assert.doesNotMatch(ctx, /forbids tests\/build\/typecheck|forbid agent goal\/state commands/);
      assert.ok(ctx.includes(`IPABCD: ${phase} (`));
      assert.equal(readState(cwd, session).phase, phase);
      assert.equal(readState(cwd, session).lastInjectedPhase, phase);
      assert.equal(handleUserPromptSubmit(ups("Read-only; no-tests.", cwd, session, "p1")), "");
      const second = groundingContext(handleUserPromptSubmit(ups("Read-only; no-tests.", cwd, session, "p2")));
      assert.equal(second, withFooter(buildStageHeader(phase), phase));
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});

test("wp3: I preserves Mind delivery and explicitly scopes it under no-delegation", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([], () => {
      const ctx = groundingContext(handleUserPromptSubmit(ups(
        "Interview me only; no delegation, no tests, no implementation.", cwd, "wp3-i", "i1")));
      assert.match(ctx, /No-delegation means no dispatch/);
      assert.match(ctx, /This also scopes the Mind instructions below/);
      assert.match(ctx, /Mind dispatch/);
      assert.match(ctx, /INTERVIEW-GROUND-01/);
      assert.match(ctx, /INTERVIEW-RENDER-01/);
      assert.match(ctx, /INTERVIEW-INDEPENDENT-01/);
      assert.match(ctx, /Report unmet actions, not false readiness/);
      assert.equal(readState(cwd, "wp3-i").phase, "IDLE");
      assert.equal(readState(cwd, "wp3-i").orchestrationActive, false);
      assert.equal(readState(cwd, "wp3-i").lastInjectedPhase, null);
      assert.match(ctx, /IPABCD: IDLE \(IDLE\)/);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("wp3: unarmed active or blocked goal still receives inspect-before-create guidance", () => {
  for (const status of ["active", "blocked"] as const) {
    const cwd = freshCwd();
    try {
      withGoalsDb([{ thread_id: "wp3-resume", status }], () => {
        const ctx = groundingContext(handleUserPromptSubmit(ups(
          "cxc-loop: resume the matching unfinished goal; do not create another goal or reinitialize its plan.",
          cwd, "wp3-resume", "r1")));
        assert.match(ctx, /Inspect the host goal with get_goal first/);
        assert.match(ctx, /Resume a matching unfinished goal; do not duplicate it/);
        assert.match(ctx, /Only when no unfinished goal exists and new HOTL is authorized, create_goal/);
        assert.match(ctx, /different unfinished goal or unsupported resume, report the conflict/);
        assert.match(ctx, /On resume inspect\/reuse the bound goalplan; do not reinitialize it/);
        assert.ok(ctx.indexOf("get_goal first") < ctx.indexOf("create_goal"));
        assert.equal(readState(cwd, "wp3-resume").phase, "IDLE");
        assert.equal(readState(cwd, "wp3-resume").orchestrationActive, false);
        assert.equal(readState(cwd, "wp3-resume").loopArmSeen, true);
      });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
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
      { thread_id: "l8-a", status: "active" },
      { thread_id: "l8-b", status: "active" },
      { thread_id: "l8-c", status: "active" },
      { thread_id: "l8-d", status: "active" },
    ], () => {
      midCycle(cwd, "l8-a", "A");
      const aReason = JSON.parse(handleStop(stop(cwd, "l8-a")).trim()).reason;
      assert.doesNotMatch(aReason, /<next>/);
      assert.match(aReason, /cxc orchestrate B --session l8-a --attest/, "G3: continuation must carry --session");
      assert.match(aReason, /auditOutput/, "WP3: A next-command must carry the reviewer verdict field");

      midCycle(cwd, "l8-b", "B");
      const bReason = JSON.parse(handleStop(stop(cwd, "l8-b")).trim()).reason;
      assert.doesNotMatch(bReason, /<next>/);
      assert.match(bReason, /cxc orchestrate C --session l8-b --attest/);

      midCycle(cwd, "l8-c", "C");
      const cReason = JSON.parse(handleStop(stop(cwd, "l8-c")).trim()).reason;
      assert.doesNotMatch(cReason, /<next>/);
      assert.match(cReason, /cxc orchestrate D --session l8-c --attest/);
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

test("260709: guard-1 removed — a stop_hook_active continuation still blocks (bounded by the cap)", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b2", status: "active" }], () => {
      midCycle(cwd, "b2", "B");
      // old behavior: one continuation per turn (second Stop released on the flag).
      // new behavior: the chain keeps blocking until progress stops for MAX_STOP_BLOCKS.
      for (let i = 0; i < MAX_STOP_BLOCKS; i++) {
        const out = handleStop(stop(cwd, "b2", true));
        assert.notEqual(out, "", `stop_hook_active block ${i + 1} must still block`);
        assert.match(JSON.parse(out.trim()).reason, /continue PABCD/);
      }
      // total termination stays guaranteed by the stagnation cap.
      assert.equal(handleStop(stop(cwd, "b2", true)), "");
      assert.equal(readState(cwd, "b2").stopBlockCount, 0);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L6: guard 2a — IDLE / inactive orchestration releases for a plain session (no goal)", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "b3", status: "paused" }], () => {
      writeState(cwd, { ...defaultState("b3"), phase: "IDLE", orchestrationActive: false });
      assert.equal(handleStop(stop(cwd, "b3")), "");
      assert.equal(readState(cwd, "b3").stopBlockCount, 0);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// ── 260709 GOAL-IDLE-CONTINUE-01: active goal + no in-flight cycle = bounded arming block ──

test("GOAL-IDLE-CONTINUE-01: active goal at IDLE blocks with the arming command", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "gi1", status: "active" }], () => {
      // no state file at all (019f4407 shape: goal created, FSM never entered)
      const out = handleStop(stop(cwd, "gi1"), "linux");
      const parsed = JSON.parse(out.trim());
      assert.equal(parsed.decision, "block");
      assert.match(parsed.reason, /goal continuation/);
      assert.match(parsed.reason, /GOAL-IDLE-CONTINUE-01/);
      // `--attest` is a PREFIX of `--attest-file`, so the old assertion passed on
      // win32 by accident. Pin the POSIX form explicitly; the win32 branch is
      // asserted separately below.
      assert.match(parsed.reason, /cxc orchestrate P --session gi1 --attest '\{/);
      assert.match(parsed.reason, /update_goal/);
      assert.match(parsed.reason, /LOOP-UNIT-CHAIN-01/, "IDLE block must teach heterogeneous work-phase chaining");
      assert.match(parsed.reason, /cxc loop init/, "unbound session must be pointed at loop init");
      // the counter write bootstraps the session file, keyed at IDLE
      const st = readState(cwd, "gi1");
      assert.equal(st.stopBlockPhase, "IDLE");
      assert.equal(st.stopBlockCount, 1);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// fuck-powershell#6: the IDLE block is a Stop surface like stopNextCommand, and it
// degraded the same way - the probe shows the inline JSON arriving as
// {from:IDLE,to:P,evidence:<diff-level plan for the next work-phase>}.
// Platform is injected so Linux CI drives the win32 branch.
test("GOAL-IDLE-CONTINUE-01: the win32 block teaches the file flag, not inline attest", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "gi1", status: "active" }], () => {
      const parsed = JSON.parse(handleStop(stop(cwd, "gi1"), "win32").trim());
      assert.equal(parsed.decision, "block");
      assert.doesNotMatch(parsed.reason, /--attest '\{/);
      assert.match(parsed.reason, /--attest-file \.codexclaw\/attest\.json/);
      // The recipe, not just the flag: a negative alone would pass on text that is
      // merely different rather than usable.
      assert.match(parsed.reason, /Set-Content -Encoding utf8 \.codexclaw\/attest\.json/);
      // The rest of the block must survive the branch.
      assert.match(parsed.reason, /GOAL-IDLE-CONTINUE-01/);
      assert.match(parsed.reason, /update_goal/);
      assert.match(parsed.reason, /LOOP-UNIT-CHAIN-01/);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-IDLE-CONTINUE-01: bounded — releases after MAX_STOP_BLOCKS blocks at IDLE", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "gi2", status: "active" }], () => {
      for (let i = 0; i < MAX_STOP_BLOCKS; i++) {
        assert.notEqual(handleStop(stop(cwd, "gi2")), "", `IDLE block ${i + 1} should block`);
      }
      assert.equal(handleStop(stop(cwd, "gi2")), "");
      assert.equal(readState(cwd, "gi2").stopBlockCount, 0);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-IDLE-CONTINUE-01: bound goalplan names remaining work in the IDLE block", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "gi3", status: "active" }], () => {
      const plan = buildGoalplan({ objective: "Ship the loop patch", criteria: [{ scenario: "tests", expectedEvidence: "node --test green" }] });
      plan.workPhases = [
        { id: "wp-1", title: "Stop hook", status: "pending", tasks: [{ id: "t-1", title: "goal-idle block", status: "pending" }], criteriaIds: ["c-1"] },
      ];
      writeGoalplan(cwd, plan);
      writeState(cwd, { ...defaultState("gi3"), phase: "IDLE", orchestrationActive: false, slug: plan.slug });
      const reason = JSON.parse(handleStop(stop(cwd, "gi3")).trim()).reason;
      // 060 wp6: the Stop block lists every runnable item instead of one next task, so the
      // terminal (`cxc loop ready`) and this reason cannot disagree.
      assert.match(reason, /Ready work phases: wp-1 \(Stop hook\)/);
      assert.match(reason, /Ready tasks: wp-1\/t-1 \(goal-idle block\)/);
      assert.doesNotMatch(reason, /Remaining work:/);
      assert.match(reason, /Required evidence: node --test green/);
      assert.doesNotMatch(reason, /cxc loop init/, "bound session must not be told to re-init");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("GOAL-IDLE-CONTINUE-01: bound but EMPTY goalplan is told to register the plan", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "gi4", status: "active" }], () => {
      const plan = buildGoalplan({ objective: "Empty shell plan" });
      writeGoalplan(cwd, plan);
      writeState(cwd, { ...defaultState("gi4"), phase: "IDLE", orchestrationActive: false, slug: plan.slug });
      const reason = JSON.parse(handleStop(stop(cwd, "gi4")).trim()).reason;
      assert.match(reason, /EMPTY: register workPhases/);
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
      assert.match(parsed.reason, /LOOP-CANDIDATE-ANCHOR-01/);
      assert.doesNotMatch(parsed.reason, /FORBIDDEN: another/);
      assert.doesNotMatch(parsed.reason, /request_user_input/);
      assert.equal(readState(cwd, "flat1").stopBlockCount, 1);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("emergence 020: flat maximize plateau forbids another same-class candidate after discard streak", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "flat-streak", status: "active" }], () => {
      midCycle(cwd, "flat-streak", "B");
      for (let i = 0; i < 3; i++) {
        recordDivergenceCandidate(cwd, {
          sessionId: "flat-streak",
          kind: "add-1",
          title: `Threshold tweak ${i + 1}`,
          rationale: "same parameter-space lever",
          sourceUrls: [`https://example.com/tweak-${i + 1}`],
          status: "discarded",
          changeClass: "parameter-tweak",
          killedAtPhase: "D",
          now: () => `2026-07-01T00:0${i}:00.000Z`,
        });
      }
      recordObjectiveMetric(cwd, { sessionId: "flat-streak", metricName: "score", value: 10, source: "operator-entered" });
      recordObjectiveMetric(cwd, { sessionId: "flat-streak", metricName: "score", value: 10, source: "operator-entered" });
      const parsed = JSON.parse(handleStop(stop(cwd, "flat-streak")).trim());
      assert.equal(parsed.decision, "block");
      assert.match(
        parsed.reason,
        /FORBIDDEN: another parameter-tweak candidate — 3 consecutive parameter-tweak candidates were discarded/,
      );
      assert.match(parsed.reason, /Threshold tweak 1 \[parameter-tweak\]/);
      assert.match(parsed.reason, /Threshold tweak 3 \[parameter-tweak\]/);
      assert.match(parsed.reason, /Record each candidate WITH its changeClass/);
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

// ── 040: work-aware Stop enrichment (text-only; null context == byte-identical) ──

test("040: buildStopBlock(phase) is byte-identical to buildStopBlock(phase, null)", () => {
  for (const p of ["P", "A", "B", "C", "D"] as const) {
    assert.equal(buildStopBlock(p), buildStopBlock(p, null), `phase ${p} must be byte-identical`);
  }
});

test("G3: buildStopBlock with sessionId injects --session into the next command", () => {
  for (const p of ["P", "A", "B", "C"] as const) {
    const reason = (JSON.parse(buildStopBlock(p, null, null, "sess-9").trim()) as { reason: string }).reason;
    assert.match(reason, /cxc orchestrate \w+ --session sess-9/, `phase ${p} must carry --session`);
  }
  // without sessionId the command stays bare (byte-compat with shipped reason)
  const bare = (JSON.parse(buildStopBlock("P").trim()) as { reason: string }).reason;
  assert.doesNotMatch(bare, /--session/);
});

test("040: readStopWorkContext returns null without a session-bound slug (no dir scan)", () => {
  const cwd = freshCwd();
  try {
    // even with a goalplan on disk, no state.slug => null (no directory-scan fallback)
    const plan = buildGoalplan({ objective: "Unbound plan", criteria: [{ scenario: "x", expectedEvidence: "ev" }] });
    writeGoalplan(cwd, plan);
    const state = { ...defaultState("unbound"), slug: "" };
    assert.equal(readStopWorkContext(cwd, state), null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("040: with a session-bound slug + goalplan, the block reason names remaining work", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "wp1", status: "active" }], () => {
      const plan = buildGoalplan({ objective: "Ship feature", criteria: [{ scenario: "tests pass", expectedEvidence: "npm test green" }] });
      plan.workPhases = [
        { id: "wp-1", title: "Backend", status: "in_progress", tasks: [{ id: "t-1", title: "add endpoint", status: "pending" }], criteriaIds: ["c-1"] },
      ];
      writeGoalplan(cwd, plan);
      // session-bound slug (030.3)
      writeState(cwd, { ...defaultState("wp1"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B", slug: plan.slug });
      const reason = JSON.parse(handleStop(stop(cwd, "wp1")).trim()).reason;
      assert.match(reason, /continue PABCD/);
      assert.match(reason, /Ready work phases: wp-1 \(Backend\)/);
      assert.match(reason, /Ready tasks: wp-1\/t-1 \(add endpoint\)/);
      assert.doesNotMatch(reason, /Remaining work:/);
      assert.match(reason, /Required evidence: npm test green/);
      assert.match(reason, new RegExp(`Record progress in: \\.codexclaw/goalplans/${plan.slug}/ledger\\.jsonl`));
      // enrichment never replaces the phase command or the closing note
      assert.match(reason, /cxc orchestrate C --session [-\w]+ --attest/);
      assert.match(reason, /D is not a resting state/);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("040: no goalplan for the bound slug => byte-identical shipped reason", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "wp2", status: "active" }], () => {
      writeState(cwd, { ...defaultState("wp2"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B", slug: "ghost-slug" });
      const reason = JSON.parse(handleStop(stop(cwd, "wp2")).trim()).reason;
      assert.equal(reason, JSON.parse(buildStopBlock("B", null, null, "wp2").trim()).reason);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// ── 050: PostCompact recovery (side-effect-only cursor reset) ──

function postCompact(cwd: string, sessionId: string) {
  return { hook_event_name: "PostCompact" as const, session_id: sessionId, cwd, trigger: "auto" };
}

test("050: resets lastInjectedPhase to null on an active cycle (phase/flags/counter untouched)", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("pc1"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B", stopBlockPhase: "B", stopBlockCount: 2 });
    assert.equal(handlePostCompact(postCompact(cwd, "pc1")), "");
    const s = readState(cwd, "pc1");
    assert.equal(s.lastInjectedPhase, null, "cursor reset");
    assert.equal(s.phase, "B", "phase untouched");
    assert.equal(s.orchestrationActive, true);
    assert.equal(s.stopBlockPhase, "B", "stagnation phase untouched");
    assert.equal(s.stopBlockCount, 2, "stagnation counter untouched");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050: no-op when idle or no in-flight cycle", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("pc2"), phase: "IDLE", orchestrationActive: false, lastInjectedPhase: null });
    const before = readState(cwd, "pc2").updatedAt;
    assert.equal(handlePostCompact(postCompact(cwd, "pc2")), "");
    assert.equal(readState(cwd, "pc2").updatedAt, before, "idle state must be untouched (no write)");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050: wrong event name is a no-op", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("pc3"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B" });
    const bogus = { ...postCompact(cwd, "pc3"), hook_event_name: "Stop" as unknown as "PostCompact" };
    assert.equal(handlePostCompact(bogus), "");
    assert.equal(readState(cwd, "pc3").lastInjectedPhase, "B", "unrecognized event must not mutate state");
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

// ── 050: progress-aware stagnation counter ──────────────────────────────────
//
// The counter used to reset only on a phase transition, so an audit that took
// five rounds inside A burned the budget and released a loop that was working.
// Progress is now three things: a phase change, a work-phase change, or a metric
// observation that is both NEW (ledger cursor) and BETTER (plateau check).
//
// This slice was deferred once after five non-converging audit rounds. X1 and X2
// are the two counterexamples that stopped it; the resume note in
// 050_progress_aware_stop.md requires them as the first regressions.

function metricSession(cwd: string, sessionId: string, phase: "P" | "A" | "B" | "C" | "D" = "B"): void {
  midCycle(cwd, sessionId, phase);
  writeObjectiveKind(cwd, sessionId, "maximize");
}

function record(cwd: string, sessionId: string, metricName: string, value: number, workPhaseId?: string): void {
  recordObjectiveMetric(cwd, { sessionId, metricName, value, source: "operator-entered", workPhaseId });
}

function blockCount(cwd: string, sessionId: string): number {
  return readState(cwd, sessionId).stopBlockCount;
}

test("050 X1: revisiting a flat metric key is not progress", () => {
  // score=10,10 -> latency=1 -> score=10. The key changed and changed back, but
  // the latest score window is [10,10]: flat. Judging on key identity alone
  // would call this progress; judging with the same window function does not.
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "x1", status: "active" }], () => {
      metricSession(cwd, "x1");
      record(cwd, "x1", "score", 10);
      record(cwd, "x1", "score", 10);
      handleStop(stop(cwd, "x1"));
      assert.equal(blockCount(cwd, "x1"), 1);

      record(cwd, "x1", "latency", 1);
      record(cwd, "x1", "score", 10);
      handleStop(stop(cwd, "x1"));
      assert.equal(blockCount(cwd, "x1"), 2, "a flat window is not progress even after a key detour");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 X2: a work-phase id containing a pipe is handled as a value", () => {
  // The abandoned design serialised observations into a pipe-delimited string,
  // where an id like this broke parsing and every Stop read as "no prior
  // observation". Nothing is assembled now, so the character is unremarkable.
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "x2", status: "active" }], () => {
      metricSession(cwd, "x2");
      record(cwd, "x2", "score", 1, "wp|evil");
      handleStop(stop(cwd, "x2"));
      assert.equal(blockCount(cwd, "x2"), 1);
      handleStop(stop(cwd, "x2"));
      assert.equal(blockCount(cwd, "x2"), 2, "no new observation, so the counter advances");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S1: with no metrics at all the counter still reaches the cap", () => {
  // checkObjectivePlateau reports flat:false when there are no records. Gating on
  // the cursor first is what stops that from reading as perpetual progress.
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s1", status: "active" }], () => {
      midCycle(cwd, "s1", "B");
      for (let i = 1; i <= MAX_STOP_BLOCKS; i++) {
        assert.notEqual(handleStop(stop(cwd, "s1")), "", `block ${i}`);
        assert.equal(blockCount(cwd, "s1"), i);
      }
      assert.equal(handleStop(stop(cwd, "s1")), "", "the cap still releases");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S2: an improving metric recharges the budget", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s2", status: "active" }], () => {
      metricSession(cwd, "s2");
      record(cwd, "s2", "score", 1);
      handleStop(stop(cwd, "s2"));
      assert.equal(blockCount(cwd, "s2"), 1);
      record(cwd, "s2", "score", 2);
      handleStop(stop(cwd, "s2"));
      assert.equal(blockCount(cwd, "s2"), 1, "new and better -> back to 1");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S2c: one recording is progress once, not on every later Stop", () => {
  // The window stays non-flat until the next recording arrives. Without the
  // cursor, a single improvement would refill the budget indefinitely.
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s2c", status: "active" }], () => {
      metricSession(cwd, "s2c");
      record(cwd, "s2c", "score", 1);
      record(cwd, "s2c", "score", 2);
      handleStop(stop(cwd, "s2c"));
      assert.equal(blockCount(cwd, "s2c"), 1);
      handleStop(stop(cwd, "s2c"));
      assert.equal(blockCount(cwd, "s2c"), 2, "no new observation");
      handleStop(stop(cwd, "s2c"));
      assert.equal(blockCount(cwd, "s2c"), 3);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S2b: re-recording the same value is new but not better", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s2b", status: "active" }], () => {
      metricSession(cwd, "s2b");
      record(cwd, "s2b", "score", 1);
      handleStop(stop(cwd, "s2b"));
      record(cwd, "s2b", "score", 1);
      handleStop(stop(cwd, "s2b"));
      assert.equal(blockCount(cwd, "s2b"), 2, "a flat window is not progress");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S3/S3b: a first recording counts once", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s3", status: "active" }], () => {
      metricSession(cwd, "s3");
      handleStop(stop(cwd, "s3"));
      assert.equal(blockCount(cwd, "s3"), 1);
      record(cwd, "s3", "coverage", 42);
      handleStop(stop(cwd, "s3"));
      assert.equal(blockCount(cwd, "s3"), 1, "a new key's first row is progress");
      handleStop(stop(cwd, "s3"));
      assert.equal(blockCount(cwd, "s3"), 2, "but only once");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S6: switching work phase is progress", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s6", status: "active" }], () => {
      const plan = buildGoalplan({ objective: "work phase switch fixture" });
      const two = {
        ...plan,
        workPhases: [
          { id: "wpA", title: "a", status: "in_progress" as const, tasks: [], criteriaIds: [] },
          { id: "wpB", title: "b", status: "pending" as const, tasks: [], criteriaIds: [] },
        ],
      };
      writeGoalplan(cwd, two);
      writeState(cwd, { ...defaultState("s6"), phase: "B", orchestrationActive: true, slug: plan.slug });

      handleStop(stop(cwd, "s6"));
      assert.equal(blockCount(cwd, "s6"), 1);
      handleStop(stop(cwd, "s6"));
      assert.equal(blockCount(cwd, "s6"), 2);

      writeGoalplan(cwd, {
        ...two,
        workPhases: [
          { ...two.workPhases[0], status: "done" as const },
          { ...two.workPhases[1], status: "in_progress" as const },
        ],
      });
      handleStop(stop(cwd, "s6"));
      assert.equal(blockCount(cwd, "s6"), 1, "the active work phase moved");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S10/S14: the absolute cap holds against forged progress", () => {
  // Recording a better value before every Stop keeps the per-phase counter at 1
  // forever. stopBlockTotal is what actually terminates the loop.
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s10", status: "active" }], () => {
      metricSession(cwd, "s10");
      let released = 0;
      for (let i = 1; i <= MAX_STOP_BLOCKS_TOTAL + 1; i++) {
        record(cwd, "s10", "score", i);
        if (handleStop(stop(cwd, "s10")) === "") released = i;
      }
      assert.equal(released, MAX_STOP_BLOCKS_TOTAL + 1, "released exactly at the absolute cap");
      const st = readState(cwd, "s10");
      assert.equal(st.stopBlockTotal, MAX_STOP_BLOCKS_TOTAL + 1, "the total never resets");
      assert.equal(st.stopMetricCursor, MAX_STOP_BLOCKS_TOTAL + 1, "the cursor advances on release too");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S15: a truncated ledger cannot replay old observations", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s15", status: "active" }], () => {
      metricSession(cwd, "s15");
      record(cwd, "s15", "score", 1);
      record(cwd, "s15", "score", 2);
      handleStop(stop(cwd, "s15"));
      assert.equal(blockCount(cwd, "s15"), 1);
      const cursor = readState(cwd, "s15").stopMetricCursor;
      assert.equal(cursor, 2);

      const ledger = join(cwd, ".codexclaw", "metrics.jsonl");
      const kept = readFileSync(ledger, "utf8").split("\n").filter((l) => l.trim()).slice(0, 1);
      writeFileSync(ledger, `${kept.join("\n")}\n`);

      handleStop(stop(cwd, "s15"));
      assert.equal(blockCount(cwd, "s15"), 2, "fewer rows than the cursor is not progress");
      assert.equal(readState(cwd, "s15").stopMetricCursor, 2, "the cursor is a high-water mark");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S11: a traversal slug is refused before the goalplan is read", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s11", status: "active" }], () => {
      writeState(cwd, { ...defaultState("s11"), phase: "B", orchestrationActive: true, slug: "../../evil" });
      assert.doesNotThrow(() => handleStop(stop(cwd, "s11")));
      assert.equal(blockCount(cwd, "s11"), 1);
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S9: a pre-upgrade session file reads as a fresh counter", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s9", status: "active" }], () => {
      const dir = join(cwd, ".codexclaw", "sessions");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "s9.json"),
        JSON.stringify({
          phase: "B", sessionId: "s9", slug: "", updatedAt: new Date().toISOString(),
          flags: { interview: false, auditPassed: false, checkPassed: false },
          supersededBy: null, injectedTurns: [], lastInjectedPhase: "B",
          orchestrationActive: true, interview: null,
          stopBlockPhase: "B", stopBlockCount: 1,
        }),
      );
      const revived = readState(cwd, "s9");
      assert.equal(revived.stopMetricCursor, 0);
      assert.equal(revived.stopBlockTotal, 0);
      assert.equal(revived.stopBlockWorkPhaseId, null);
      handleStop(stop(cwd, "s9"));
      assert.equal(blockCount(cwd, "s9"), 2, "the old phase counter carries over");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050 S13: progress agrees with the plateau verdict when an observation is new", () => {
  // Not a tautology worth skipping: it pins that the counter and the divergence
  // block read the same window function, which five audit rounds failed to
  // achieve with a parallel fingerprint.
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "s13", status: "active" }], () => {
      metricSession(cwd, "s13");
      record(cwd, "s13", "score", 1);
      record(cwd, "s13", "score", 2);
      handleStop(stop(cwd, "s13"));
      const rising = checkObjectivePlateau(cwd, "s13", { minRecords: 2, noiseFloor: 0 });
      assert.equal(rising.flat, false);
      assert.equal(blockCount(cwd, "s13"), 1, "non-flat window -> progress");

      record(cwd, "s13", "score", 2);
      handleStop(stop(cwd, "s13"));
      const flat = checkObjectivePlateau(cwd, "s13", { minRecords: 2, noiseFloor: 0 });
      assert.equal(flat.flat, true);
      assert.equal(blockCount(cwd, "s13"), 2, "flat window -> no progress");
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("wp6: Stop context excludes a task whose dependency is unmet", () => {
  const cwd = freshCwd();
  try {
    const plan = buildGoalplan({ objective: "dependency-aware stop" });
    plan.schemaVersion = 3;
    plan.workPhases = [{
      id: "build",
      title: "Build",
      status: "pending",
      dependsOn: [],
      criteriaIds: [],
      tasks: [
        { id: "blocked", title: "blocked child", status: "pending", dependsOn: ["ready"] },
        { id: "ready", title: "ready parent", status: "pending", dependsOn: [] },
      ],
    }];
    writeGoalplan(cwd, plan);

    const context = readStopWorkContext(cwd, { ...defaultState("stop-deps"), slug: plan.slug });
    assert.deepEqual(context?.readyWorkPhases, [{ id: "build", title: "Build" }]);
    assert.deepEqual(context?.readyTasks, [
      { workPhaseId: "build", id: "ready", title: "ready parent" },
    ]);
    assert.deepEqual(context?.waitingOn, [
      "task build/blocked waits for task build/ready (pending)",
    ]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp6: Stop context exposes deadlock reasons in waitingOn", () => {
  const cwd = freshCwd();
  try {
    const plan = buildGoalplan({ objective: "dependency deadlock" });
    plan.schemaVersion = 3;
    plan.activeWorkPhaseId = null;
    plan.workPhases = [
      {
        id: "wp1", title: "Upstream", status: "blocked", blockedReason: "vendor",
        dependsOn: [], tasks: [], criteriaIds: [],
      },
      {
        id: "wp2", title: "Downstream", status: "pending", dependsOn: ["wp1"],
        tasks: [{ id: "t2", title: "ship", status: "pending", dependsOn: [] }], criteriaIds: [],
      },
    ];
    writeGoalplan(cwd, plan);

    const context = readStopWorkContext(cwd, { ...defaultState("stop-deadlock"), slug: plan.slug });
    assert.deepEqual(context?.readyWorkPhases, []);
    assert.deepEqual(context?.readyTasks, []);
    assert.deepEqual(context?.waitingOn, [
      "work-phase wp1 is blocked (vendor)",
      "work-phase wp2 waits for work-phase wp1 (blocked)",
    ]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp6: legacy plan Stop context uses the ready arrays shape", () => {
  const cwd = freshCwd();
  try {
    const plan = buildGoalplan({
      objective: "legacy stop",
      criteria: [{ scenario: "tests", expectedEvidence: "node --test green" }],
    });
    plan.workPhases = [{
      id: "legacy",
      title: "Legacy",
      status: "in_progress",
      tasks: [{ id: "t-1", title: "first task", status: "pending" }],
      criteriaIds: ["c-1"],
    }];
    writeGoalplan(cwd, plan);

    const context = readStopWorkContext(cwd, { ...defaultState("legacy-stop"), slug: plan.slug });
    assert.deepEqual(context, {
      readyWorkPhases: [{ id: "legacy", title: "Legacy" }],
      readyTasks: [{ workPhaseId: "legacy", id: "t-1", title: "first task" }],
      waitingOn: [],
      expectedEvidence: "node --test green",
      ledgerPath: `.codexclaw/goalplans/${plan.slug}/ledger.jsonl`,
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp6: Stop reason lists ready work and partial dependency waits together", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "wp6-ready", status: "active" }], () => {
      const plan = buildGoalplan({
        objective: "Expose dependency-aware Stop guidance",
        criteria: [{ scenario: "Stop shows executable work", expectedEvidence: "node --test green" }],
      });
      plan.schemaVersion = 3;
      plan.activeWorkPhaseId = "wp-live";
      plan.workPhases = [
        {
          id: "wp-base", title: "Base", status: "done", dependsOn: [], criteriaIds: [],
          tasks: [{ id: "base", title: "Base task", status: "done", dependsOn: [], outcome: "base done" }],
        },
        {
          id: "wp-live", title: "Live", status: "in_progress", dependsOn: ["wp-base"], criteriaIds: ["c-1"],
          tasks: [
            { id: "ready", title: "Ready task", status: "pending", dependsOn: [] },
            { id: "blocked", title: "Blocked task", status: "pending", dependsOn: ["later"] },
            { id: "later", title: "Later task", status: "pending", dependsOn: [] },
          ],
        },
        {
          id: "wp-blocked", title: "Blocked phase", status: "pending", dependsOn: ["wp-live"],
          criteriaIds: [], tasks: [],
        },
      ];
      writeGoalplan(cwd, plan);
      writeState(cwd, {
        ...defaultState("wp6-ready"),
        phase: "B",
        orchestrationActive: true,
        lastInjectedPhase: "B",
        slug: plan.slug,
      });

      const context = readStopWorkContext(cwd, readState(cwd, "wp6-ready"));
      assert.ok(context);
      assert.deepEqual(context.waitingOn, [
        "task wp-live/blocked waits for task wp-live/later (pending)",
        "work-phase wp-blocked waits for work-phase wp-live (in_progress)",
      ]);

      const output = handleStop(stop(cwd, "wp6-ready"));
      assert.notEqual(output, "");
      const reason = (JSON.parse(output.trim()) as { reason: string }).reason;
      assert.match(reason, /Ready work phases: wp-live \(Live\)/);
      assert.match(reason, /Ready tasks: wp-live\/ready \(Ready task\); wp-live\/later \(Later task\)/);
      assert.match(
        reason,
        /Waiting on: task wp-live\/blocked waits for task wp-live\/later \(pending\); work-phase wp-blocked waits for work-phase wp-live \(in_progress\)/,
      );
      assert.match(reason, /Required evidence: node --test green/);
      assert.match(reason, /cxc orchestrate C --session wp6-ready --attest/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp6: Stop reason keeps a single blocked phase when no work is ready", () => {
  const cwd = freshCwd();
  try {
    withGoalsDb([{ thread_id: "wp6-blocked", status: "active" }], () => {
      const plan = buildGoalplan({ objective: "Expose one blocked phase" });
      plan.schemaVersion = 3;
      plan.activeWorkPhaseId = null;
      plan.workPhases = [{
        id: "wp-blocked",
        title: "Blocked phase",
        status: "blocked",
        blockedReason: "vendor release",
        dependsOn: [],
        criteriaIds: [],
        tasks: [],
      }];
      writeGoalplan(cwd, plan);
      writeState(cwd, {
        ...defaultState("wp6-blocked"),
        phase: "B",
        orchestrationActive: true,
        lastInjectedPhase: "B",
        slug: plan.slug,
      });

      const context = readStopWorkContext(cwd, readState(cwd, "wp6-blocked"));
      assert.ok(context);
      assert.deepEqual(context.readyWorkPhases, []);
      assert.deepEqual(context.readyTasks, []);
      assert.deepEqual(context.waitingOn, [
        "work-phase wp-blocked is blocked (vendor release)",
      ]);

      const output = handleStop(stop(cwd, "wp6-blocked"));
      const reason = (JSON.parse(output.trim()) as { reason: string }).reason;
      assert.doesNotMatch(reason, /Ready work phases:|Ready tasks:/);
      assert.match(reason, /Waiting on: work-phase wp-blocked is blocked \(vendor release\)/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
