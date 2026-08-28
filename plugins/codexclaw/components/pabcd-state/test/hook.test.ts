import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// B1 (260724 WP1): emit sites resolve the `cxc` invocation per-machine. Pin the
// literal so directive assertions stay deterministic without `cxc` on PATH
// (each test file is its own node --test process — no restore needed).
process.env.CODEXCLAW_CXC = "cxc";

import {
  detectTrigger,
  detectAgbrowseSearchRequest,
  detectLoopArmRequest,
  buildContextOutput,
  handleUserPromptSubmit,
  handleStop,
  phaseDirective,
  interviewDirective,
  loopArmDirective,
  withFooter,
  type UserPromptSubmitPayload,
  type StopPayload,
} from "../src/hook.ts";
import { STATE_DIR, LEDGER_FILE, readState, writeState, defaultState } from "../src/state.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { captureSourceIdentity } from "../src/source-identity.ts";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
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

test("phase directives use resolvable skill mentions for spawn messages", () => {
  const unresolvedBareMention = /\$cxc-[a-z0-9-]+(?![A-Za-z0-9_:-])(?!\]\(skill:\/\/[^)\n]+\))/;

  for (const phase of ["A", "B", "C"] as const) {
    assert.doesNotMatch(phaseDirective(phase), unresolvedBareMention, `${phase} directive`);
  }
});

test("detectAgbrowseSearchRequest: Korean/English search requests, including typo, are detected", () => {
  assert.equal(detectAgbrowseSearchRequest("agbrowse를 통해서 질문해줘"), true);
  assert.equal(detectAgbrowseSearchRequest("agbrowe를 통해서 질문해줘"), true);
  assert.equal(detectAgbrowseSearchRequest("use agbrowse to verify this URL"), true);
  assert.equal(detectAgbrowseSearchRequest("agbrowse hook도 넣어야될듯"), false);
  assert.equal(detectAgbrowseSearchRequest("그냥 agbrowse 참조"), false);
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
    assert.equal(parsed.hookSpecificOutput.additionalContext, withFooter(phaseDirective("P"), "P"));
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

test("handleUserPromptSubmit: agbrowse request injects search directive without activating PABCD", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("agbrowse를 통해서 질문해줘", cwd, "s1", "t1"));
    assert.notEqual(out, "");
    const parsed = JSON.parse(out.trimEnd());
    const ctx = parsed.hookSpecificOutput.additionalContext as string;
    assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.match(ctx, /\[codexclaw: SEARCH/);
    assert.match(ctx, /cxc-search/);
    assert.match(ctx, /agbrowse fetch/);
    assert.match(ctx, /Never use plain `agbrowse search/);
    const st = readState(cwd, "s1");
    assert.equal(st.orchestrationActive, false);
    assert.equal(st.lastInjectedPhase, null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// fuck-powershell#6: PowerShell strips the quotes from an inline JSON argument and,
// once you escape them, splits the value at its first space. Every gated edge needs a
// `did` narrative, which always has spaces, so no inline spelling works there. The
// directive is injected at prompt time, so handing a Windows agent the POSIX form is
// how it concludes the FSM is broken before running anything.
//
// Platform is injected so Linux CI drives the win32 branch (atomic-write.test.ts §1).
test("win32 arming directive teaches the file flag, not inline attest", () => {
  const win = loopArmDirective("win32");
  assert.match(win, /--attest-file \.codexclaw\/attest\.json/);
  assert.doesNotMatch(win, /--attest <json>/);
  // A negative alone would pass on text that is merely DIFFERENT. Assert the agent
  // actually receives the two-step recipe it needs.
  assert.match(win, /Set-Content -Encoding utf8 \.codexclaw\/attest\.json/);
  // Everything else must survive the branch.
  assert.match(win, /ORCH-MANDATE-01/);
  assert.match(win, /LOOP-UNIT-CHAIN-01/);
  assert.match(win, /ORCH-ARTIFACT-01/);
});

// The POSIX text is pinned as a LITERAL snapshot rather than compared against the
// function that produces it: a self-comparison passes no matter how badly the text is
// mangled, which is exactly the guarantee this test exists to provide.
test("posix arming directive is byte-identical to its pinned snapshot", () => {
  const expected = [
    "[codexclaw: LOOP — orchestrate arming mandate (ORCH-MANDATE-01)]",
    "A loop/goalplan claim without persisted FSM evidence is INVALID, and the PABCD FSM is not",
    "armed right now. Arm it with explicit commands before narrating any loop work:",
    "1. Session id: take it ONLY from your most recent SessionStart binding line",
    "   (SESSION-IDENTITY-01 — never an id seen in transcript history).",
    "2. `cxc orchestrate status --session <id>` — read the real phase first.",
    "3. HOTL (user asked for autonomous / continue-until-done): create_goal with a detailed",
    '   objective -> `cxc loop init --objective "<same text>" --session <id>` -> register',
    "   workPhases[] + criteria[] in the goalplan -> `cxc orchestrate P --session <id>`.",
    "   HITL (no such ask): enter the cycle explicitly via `cxc orchestrate I|P --session <id>`.",
    "4. Advance EVERY forward edge yourself with `cxc orchestrate <phase> --attest <json>` —",
    `   e.g. \`cxc orchestrate A --session <id> --attest '{\"from\":\"P\",\"to\":\"A\",\"did\":\"...\",\"planUnit\":\"devlog/_plan/YYMMDD_slug\",\"workPhaseId\":\"wp1\"}'\` —`,
    "   a phase without its persisted transition + artifact did not happen (ORCH-ARTIFACT-01).",
    '   EVERY attest carries "from" and "to" naming the edge: they are coerced before any',
    "   gate runs, so omitting them is refused on every edge (ATTEST-SHAPE-01).",
    "   When a goalplan is bound, include the active workPhaseId in every gated attest",
    "   (one work-phase = one full PABCD cycle).",
    "5. After D closes to IDLE with work remaining under an active goal, immediately re-enter",
    "   with `cxc orchestrate P --session <id>` (LOOP-UNIT-CHAIN-01).",
    "Load and obey cxc-loop + cxc-pabcd when available. Work done outside the FSM does not",
    "count as loop progress — re-enter and attest it.",
  ].join("\n");
  assert.equal(loopArmDirective("linux"), expected);
  assert.equal(loopArmDirective("darwin"), expected);
});

test("ORCH-MANDATE-01: detectLoopArmRequest catches loop/goalplan/continue-until-done intent (EN+KO)", () => {
  assert.equal(detectLoopArmRequest("cxc-loop로 진행하자"), true);
  assert.equal(detectLoopArmRequest("HOTL 모드로 돌려줘"), true);
  assert.equal(detectLoopArmRequest("goalplan 잡고 시작해"), true);
  assert.equal(detectLoopArmRequest("골플랜부터 등록해"), true);
  assert.equal(detectLoopArmRequest("continue until done, no pauses"), true);
  assert.equal(detectLoopArmRequest("루프 돌려서 처리해"), true);
  assert.equal(detectLoopArmRequest("알아서 끝까지 해줘"), true);
  assert.equal(detectLoopArmRequest("멈추지 말고 진행해"), true);
  // Negatives: code-talk about loops must NOT arm PABCD ceremony.
  assert.equal(detectLoopArmRequest("fix the for loop in parser.ts"), false);
  assert.equal(detectLoopArmRequest("이 loop 버그 좀 봐줘"), false);
  assert.equal(detectLoopArmRequest("루프백 오디오 설정"), false);
  assert.equal(detectLoopArmRequest("계속해"), false);
});

test("ORCH-ARM-PABCD-01: pabcd + strong run/repeat marker arms; questions/repeat-runs do not (260714)", () => {
  // Positives — natural phrasings for "run PABCD repeatedly".
  assert.equal(detectLoopArmRequest("pabcd 여러 번 돌려서 해결해"), true);
  assert.equal(detectLoopArmRequest("PABCD를 여러 번 돌려서 이 문제 해결해라"), true);
  assert.equal(detectLoopArmRequest("run pabcd repeatedly until this is fixed"), true);
  assert.equal(detectLoopArmRequest("pabcd multiple times please"), true);
  assert.equal(detectLoopArmRequest("ipabcd 사이클로 돌리자"), true);
  assert.equal(detectLoopArmRequest("여러 번 반복해서 해결해"), true);
  // Negatives — questions ABOUT pabcd and ordinary repeat-run asks must stay cold.
  assert.equal(detectLoopArmRequest("what is pabcd?"), false);
  assert.equal(detectLoopArmRequest("pabcd 문서 다시 보여줘"), false);
  assert.equal(detectLoopArmRequest("explain how pabcd runs internally"), false);
  assert.equal(detectLoopArmRequest("pabcd가 뭐야? 계속 헷갈리네"), false);
  assert.equal(detectLoopArmRequest("이 함수 여러 번 호출되는 버그 고쳐"), false);
  assert.equal(detectLoopArmRequest("이 테스트 여러 번 실행해봐"), false);
  assert.equal(detectLoopArmRequest("앱 아이콘 여러 번 실행해도 안 열려"), false);
  assert.equal(detectLoopArmRequest("빌드 반복 실행해서 flaky 잡아줘"), false);
  assert.equal(detectLoopArmRequest("여러 번 진행된 마이그레이션 롤백해줘"), false);
});

test("260714 wp3: loop-arm prompt persists loopArmSeen on the un-armed branch (even turnless)", () => {
  const cwd = freshCwd();
  try {
    // with turn
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려서 해결해", cwd, "la1", "t1"));
    assert.equal(readState(cwd, "la1").loopArmSeen, true);
    assert.equal(readState(cwd, "la1").orchestrationActive, false); // mandate never arms
    // turnless payload still persists the flag (audit decision a)
    handleUserPromptSubmit(ups("cxc-loop로 알아서 끝까지 해줘", cwd, "la2", ""));
    assert.equal(readState(cwd, "la2").loopArmSeen, true);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// TRIGGER-AUTHORITY-01 (040) reversed the precedence this case pinned. A prompt that
// asks for a loop AND names a phase used to get the phase directive and arm P; it now
// gets the arming mandate, because that is the request it most clearly makes. The flag
// still has to survive, which is what 260714 wp3 was protecting.
test("040: trigger + loop phrase on an un-armed FSM yields the mandate, not a phase", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this and then 루프 돌려서 끝까지 해줘", cwd, "la3", "t1"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /arming mandate/);
    const st = readState(cwd, "la3");
    assert.equal(st.phase, "IDLE"); // the mandate never arms the FSM by itself
    assert.equal(st.orchestrationActive, false);
    assert.equal(st.loopArmSeen, true); // and the flag survives (audit Med #2)
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("260714 wp4: B directive starves context to the active work-phase iff bound", () => {
  const bare = phaseDirective("B");
  assert.doesNotMatch(bare, /ACTIVE WORK-PHASE/);
  const bound = phaseDirective("B", { activeWorkPhase: { id: "wp2", title: "second slice" } });
  assert.match(bound, /ACTIVE WORK-PHASE: wp2 — second slice/);
  assert.match(bound, /OUT OF SCOPE until D closes/);
  assert.match(bound, /LOOP-UNIT-CHAIN-01/);
  // other phases ignore opts
  assert.equal(phaseDirective("C", { activeWorkPhase: { id: "wp2", title: "x" } }), phaseDirective("C"));
});

test("ORCH-MANDATE-01: loop request against un-armed FSM injects the arming mandate", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("이 유닛 cxc-loop로 알아서 끝까지 해줘", cwd, "s1", "t1"), "linux");
    assert.notEqual(out, "");
    const parsed = JSON.parse(out.trimEnd());
    const ctx = parsed.hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /orchestrate arming mandate \(ORCH-MANDATE-01\)/);
    assert.match(ctx, /cxc orchestrate status --session <id>/);
    assert.match(ctx, /cxc orchestrate P --session <id>/);
    assert.match(ctx, /--attest <json>/);
    assert.match(ctx, /cxc loop init --objective/);
    // The mandate never arms the FSM by itself — commands do.
    const st = readState(cwd, "s1");
    assert.equal(st.orchestrationActive, false);
    assert.equal(st.lastInjectedPhase, null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// TRIGGER-AUTHORITY-01 (040): the reverse of what this case used to assert. On an
// un-armed FSM the loop request is answered first — "plan this and then loop until
// done" is a request to run the loop, and answering it with a PLAN directive is how
// a loop used to begin as narration with no FSM behind it.
test("040: on an un-armed FSM the loop-arm mandate wins over a phase trigger", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this and then loop until done", cwd, "s1", "t1"));
    const parsed = JSON.parse(out.trimEnd());
    const ctx = parsed.hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /arming mandate/);
    assert.doesNotMatch(ctx, /\[codexclaw: PLAN\]/);
    const st = readState(cwd, "s1");
    assert.equal(st.lastInjectedPhase, null); // the mandate injects no phase
    assert.equal(st.loopArmSeen, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("ORCH-MANDATE-01: loop-arm and agbrowse directives compose when both are requested", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("agbrowse로 검증하면서 cxc-loop 돌려줘", cwd, "s1", "t1"));
    const parsed = JSON.parse(out.trimEnd());
    const ctx = parsed.hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /arming mandate/);
    assert.match(ctx, /\[codexclaw: SEARCH/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: agbrowse request is idempotent within same turn", () => {
  const cwd = freshCwd();
  try {
    const first = handleUserPromptSubmit(ups("agbrowe를 통해서 질문해줘", cwd, "s1", "t1"));
    const second = handleUserPromptSubmit(ups("agbrowe를 통해서 질문해줘", cwd, "s1", "t1"));
    assert.notEqual(first, "");
    assert.equal(second, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleUserPromptSubmit: PABCD trigger wins over agbrowse search directive", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this with agbrowse", cwd, "s1", "t1"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    // 260829 wp4: the default interview policy ("new-unit") advises the INTERVIEW on a
    // fresh plan request. The PHASE is still P — advisory promotion never writes I —
    // so this test's subject (PABCD beats agbrowse) is unchanged.
    assert.equal(ctx, withFooter(interviewDirective(), "P"));
    assert.doesNotMatch(ctx, /agbrowse fetch/);
    assert.equal(readState(cwd, "s1").phase, "P", "advisory promotion must not change the phase");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp4: with interview policy off, a plan trigger injects the PLAN directive as before", () => {
  const cwd = freshCwd();
  try {
    writeFileSync(join(cwd, "codexclaw.json"), JSON.stringify({ interview: "off" }), "utf8");
    const out = handleUserPromptSubmit(ups("plan this with agbrowse", cwd, "s1off", "t1"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.equal(ctx, withFooter(phaseDirective("P"), "P"));
    assert.equal(readState(cwd, "s1off").phase, "P");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleStop: releases (no block) when there is no active cycle/goal", () => {
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
    // fresh session: IDLE + orchestration inactive -> guard 2a releases.
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
    assert.equal(parsed.hookSpecificOutput.additionalContext, withFooter(phaseDirective("P"), "P"));
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
    assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, withFooter(phaseDirective("P"), "P"));
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
    assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, withFooter(phaseDirective("B"), "B"));
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
    // Loose plan triggers persist the detected phase without a command ledger entry.
    // The injected TEXT is the interview directive under the default policy (wp4);
    // the persisted PHASE is still P, which is what this test pins.
    assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, withFooter(interviewDirective(), "P"));
    assert.equal(readState(cwd, "s7").phase, "P");
    assert.equal(ledgerLines(cwd).length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ── L5/050: phase footer + status polish + D-close ──

test("L5: injected directive carries the IPABCD footer naming the phase", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("orchestrate p", cwd, "f1", "t1"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /\[codexclaw: PLAN\]/); // directive body present
    assert.match(ctx, /IPABCD: P \(PLAN\)/);   // footer present, names P
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L5: chat 'orchestrate status' returns the one-line status with flags", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("orchestrate p", cwd, "f2", "t1"));
    const out = handleUserPromptSubmit(ups("orchestrate status", cwd, "f2", "t2"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /\[codexclaw status\] IPABCD: P \(PLAN\)/);
    assert.match(ctx, /auditPassed=false/);
    assert.equal(readState(cwd, "f2").phase, "P"); // status does not move phase
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L5: chat 'orchestrate d' closes the cycle to IDLE (D is not a resting state)", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("orchestrate p", cwd, "f3", "t1"));
    handleUserPromptSubmit(ups("orchestrate a", cwd, "f3", "t2"));
    handleUserPromptSubmit(ups("orchestrate b", cwd, "f3", "t3"));
    handleUserPromptSubmit(ups("orchestrate c", cwd, "f3", "t4"));
    const out = handleUserPromptSubmit(ups("orchestrate d", cwd, "f3", "t5"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /\[codexclaw: DONE\]/);      // DONE directive shown this turn
    assert.match(ctx, /IPABCD: IDLE/);             // resting state is IDLE, not D
    const st = readState(cwd, "f3");
    assert.equal(st.phase, "IDLE");                // cycle closed
    assert.equal(st.flags.auditPassed, false);
    assert.equal(st.flags.checkPassed, false);
    assert.equal(st.orchestrationActive, false);
    const led = ledgerLines(cwd);
    assert.equal(led.at(-1)?.to, "IDLE");
    assert.equal(led.at(-1)?.reason, "done");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L5: ledger entries carry ts/from/to/reason on chat + reset paths", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("orchestrate p", cwd, "f4", "t1")); // chat
    handleUserPromptSubmit(ups("orchestrate reset", cwd, "f4", "t2")); // reset
    for (const e of ledgerLines(cwd)) {
      assert.ok(typeof e.ts === "string" && e.ts.length > 0);
      assert.ok("from" in e && "to" in e);
      assert.ok(e.reason === "chat" || e.reason === "reset");
    }
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// ── CYCLE-COMPLETION-01 (030): chat D-close preflight ───────────────────────
// Mirror of the CLI gate. The chat path writes state and the ledger before it
// ever consulted the goalplan, so a late refusal would have left the cycle as
// "FSM idle, ledger done, goalplan unfinished". The preflight now runs first.

test("chat D-close is refused while the work-phase has open tasks, and writes nothing", () => {
  const cwd = gitRepoForHook();
  try {
    const slug = "chat-cycle-pending";
    const plan = buildGoalplan({ objective: "chat cycle gate" });
    plan.slug = slug;
    plan.workPhases = [
      { id: "wp-1", title: "first", status: "in_progress", tasks: [{ id: "t-1", title: "the work", status: "pending" }], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp-1";
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("chat-c"), phase: "C", slug, orchestrationActive: true, checkEpoch: "c-test", flags: { interview: false, auditPassed: true, checkPassed: true } });
    seedChatReceipt(cwd, "chat-c", "c-test");

    const attest = JSON.stringify({ from: "C", to: "D", did: "ran the suite", checkOutput: "ok", exitCode: 0, testReceiptPath: ".codexclaw/evidence/chat-c/test-receipt.json" });
    const out = handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, "chat-c", "t1"));

    assert.match(out, /refused/);
    assert.match(out, /open task/);
    assert.match(out, /CYCLE-COMPLETION-01/);
    assert.equal(readState(cwd, "chat-c").phase, "C");
    const ledger = join(cwd, STATE_DIR, LEDGER_FILE);
    assert.equal(existsSync(ledger) ? readFileSync(ledger, "utf8").trim() : "", "");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("chat D-close succeeds once the tasks are done", () => {
  const cwd = gitRepoForHook();
  try {
    const slug = "chat-cycle-done";
    const plan = buildGoalplan({ objective: "chat cycle gate" });
    plan.slug = slug;
    plan.workPhases = [
      { id: "wp-1", title: "first", status: "in_progress", tasks: [{ id: "t-1", title: "the work", status: "done" }], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp-1";
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState("chat-d"), phase: "C", slug, orchestrationActive: true, checkEpoch: "c-test", flags: { interview: false, auditPassed: true, checkPassed: true } });
    seedChatReceipt(cwd, "chat-d", "c-test");

    const attest = JSON.stringify({ from: "C", to: "D", did: "ran the suite", checkOutput: "ok", exitCode: 0, testReceiptPath: ".codexclaw/evidence/chat-d/test-receipt.json" });
    const out = handleUserPromptSubmit(ups(`orchestrate d --attest ${attest}`, cwd, "chat-d", "t1"));

    assert.ok(!/refused/.test(out));
    assert.equal(readState(cwd, "chat-d").phase, "IDLE");
    const saved = JSON.parse(readFileSync(join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json"), "utf8"));
    assert.equal(saved.workPhases[0].status, "done");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// ── TRIGGER-AUTHORITY-01 (040) ─────────────────────────────────────────────
// A natural-language trigger may enter a cycle from IDLE but may not move one that
// is already running. Writing phase straight from a phrase skipped adjacency, the
// attest gate and the ledger, so "구현해" jumped IDLE to B leaving no trace at all.

test("040: a natural-language build trigger from IDLE leaves the phase alone", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("이거 구현해줘", cwd, "ta1", "t1"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /BUILD/);
    assert.match(ctx, /TRIGGER-AUTHORITY-01/);
    assert.match(ctx, /orchestrate/);
    const st = readState(cwd, "ta1");
    assert.equal(st.phase, "IDLE");
    assert.equal(st.orchestrationActive, false);
    assert.equal(st.lastInjectedPhase, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("040: entering P or I from IDLE still works exactly as before", () => {
  for (const [prompt, want] of [["plan this", "P"], ["interview me", "I"]] as const) {
    const cwd = freshCwd();
    try {
      handleUserPromptSubmit(ups(prompt, cwd, "ta2", "t1"));
      const st = readState(cwd, "ta2");
      assert.equal(st.phase, want);
      assert.equal(st.orchestrationActive, true);
      assert.equal(st.lastInjectedPhase, want);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});

test("040: a mid-cycle trigger cannot move the phase and the footer reports the real one", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("ta3"), phase: "P", orchestrationActive: true, lastInjectedPhase: "P" });
    const out = handleUserPromptSubmit(ups("이거 구현해줘", cwd, "ta3", "t1"));
    const ctx = JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /TRIGGER-AUTHORITY-01/);
    assert.match(ctx, /IPABCD: P/); // the phase on disk, not the one asked for
    const st = readState(cwd, "ta3");
    assert.equal(st.phase, "P");
    assert.equal(st.orchestrationActive, true);
    assert.equal(st.lastInjectedPhase, "P");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// The flag has to survive the passive pipeline. Every passive branch used to spread
// the state captured on entry, so a loopArmSeen written earlier in the same call was
// silently overwritten — these three cases pin each branch.

test("040: an armed session's loop request records loopArmSeen through the stage-marker branch", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("ar1"), phase: "B", orchestrationActive: true, lastInjectedPhase: "B" });
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려줘", cwd, "ar1", "t1"));
    assert.equal(readState(cwd, "ar1").loopArmSeen, true);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("040: same through mode 2 (phase changed since last inject)", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("ar2"), phase: "C", orchestrationActive: true, lastInjectedPhase: "B" });
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려줘", cwd, "ar2", "t1"));
    const st = readState(cwd, "ar2");
    assert.equal(st.loopArmSeen, true);
    assert.equal(st.phase, "C");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("040: same through mode 3 (same phase, header only)", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("ar3"), phase: "C", orchestrationActive: true, lastInjectedPhase: "C" });
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려줘", cwd, "ar3", "t1"));
    assert.equal(readState(cwd, "ar3").loopArmSeen, true);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// Turnless payloads: injectedTurns is the only thing gated on a turn id. Meaningful
// state changes still have to land, or a turnless prompt silently loses them.

test("040: turnless entry and turnless loop requests still persist their state", () => {
  const cwdA = freshCwd();
  try {
    handleUserPromptSubmit(ups("plan this", cwdA, "tl1", ""));
    const st = readState(cwdA, "tl1");
    assert.equal(st.phase, "P");
    assert.deepEqual(st.injectedTurns, []);
  } finally { rmSync(cwdA, { recursive: true, force: true }); }

  const cwdB = freshCwd();
  try {
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려줘", cwdB, "tl2", ""));
    assert.equal(readState(cwdB, "tl2").loopArmSeen, true);
  } finally { rmSync(cwdB, { recursive: true, force: true }); }

  const cwdC = freshCwd();
  try {
    writeState(cwdC, { ...defaultState("tl3"), phase: "C", orchestrationActive: true, lastInjectedPhase: "C" });
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려줘", cwdC, "tl3", ""));
    assert.equal(readState(cwdC, "tl3").loopArmSeen, true);
  } finally { rmSync(cwdC, { recursive: true, force: true }); }
});

// ── SOURCE-DELTA-01 (050): the chat path gets the same gate ────────────────
// Wiring only the CLI would leave a phrasing that bypasses the check entirely.


/** CHECK-BINDING-01 (075): these cases exercise CYCLE-COMPLETION-01, so they need a
 *  receipt the C>D gate accepts before they can reach it. Needs a real repo. */
function seedChatReceipt(cwd: string, id: string, epoch: string): void {
  const dir = join(cwd, STATE_DIR, "evidence", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "test-receipt.json"), JSON.stringify({
    kind: "test",
    sourceIdentity: captureSourceIdentity(cwd, { excludeCodexclawArtifacts: true }),
    command: "npm test",
    exitCode: 0,
    createdAt: new Date().toISOString(),
    ownerSessionId: id,
    checkEpoch: epoch,
  }));
}

function gitRepoForHook(): string {
  const cwd = mkdtempSync(join(tmpdir(), "codexclaw-hook-git-"));
  const run = (...a: string[]) => spawnSync("git", a, { cwd, encoding: "utf8" });
  run("init", "-q");
  run("config", "user.email", "t@example.com");
  run("config", "user.name", "t");
  writeFileSync(join(cwd, "seed.txt"), "seed\n");
  run("add", "-A");
  run("commit", "-qm", "seed");
  return cwd;
}

test("050: chat B>C is refused when the source never changed during B", () => {
  const cwd = gitRepoForHook();
  try {
    writeState(cwd, {
      ...defaultState("chat-delta"),
      phase: "B",
      orchestrationActive: true,
      lastInjectedPhase: "B",
      flags: { interview: false, auditPassed: true, checkPassed: false },
      phaseEntrySource: captureSourceIdentity(cwd, { excludeCodexclawArtifacts: true }),
    });
    const out = handleUserPromptSubmit(ups("orchestrate c", cwd, "chat-delta", "t1"));
    assert.match(out, /refused/);
    assert.match(out, /SOURCE-DELTA-01/);
    assert.equal(readState(cwd, "chat-delta").phase, "B");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050: chat A>B snapshots the source and chat B>C passes once it changed", () => {
  const cwd = gitRepoForHook();
  try {
    writeState(cwd, {
      ...defaultState("chat-life"),
      phase: "A",
      orchestrationActive: true,
      lastInjectedPhase: "A",
      flags: { interview: false, auditPassed: false, checkPassed: false },
    });
    handleUserPromptSubmit(ups("orchestrate b", cwd, "chat-life", "t1"));
    const atB = readState(cwd, "chat-life");
    assert.equal(atB.phase, "B");
    assert.ok(atB.phaseEntrySource, "entering B from chat must snapshot too");

    writeFileSync(join(cwd, "built.ts"), "export const z = 3;\n");
    handleUserPromptSubmit(ups("orchestrate c", cwd, "chat-life", "t2"));
    const atC = readState(cwd, "chat-life");
    assert.equal(atC.phase, "C");
    assert.equal(atC.phaseEntrySource, null, "a snapshot must not outlive its phase");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("050: closing or resetting a cycle clears the snapshot", () => {
  for (const verb of ["orchestrate d", "orchestrate reset"]) {
    const cwd = gitRepoForHook();
    try {
      writeState(cwd, {
        ...defaultState("chat-clear"),
        phase: "C",
        orchestrationActive: true,
        lastInjectedPhase: "C",
        flags: { interview: false, auditPassed: true, checkPassed: true },
        phaseEntrySource: captureSourceIdentity(cwd, { excludeCodexclawArtifacts: true }),
      });
      handleUserPromptSubmit(ups(verb, cwd, "chat-clear", "t1"));
      assert.equal(readState(cwd, "chat-clear").phaseEntrySource, null, verb);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});
