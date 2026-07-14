import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectTrigger,
  detectAgbrowseSearchRequest,
  detectLoopArmRequest,
  buildContextOutput,
  handleUserPromptSubmit,
  handleStop,
  phaseDirective,
  withFooter,
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

test("260714 wp3: mode-1 trigger + loop phrase sets loopArmSeen on the precedence path", () => {
  const cwd = freshCwd();
  try {
    handleUserPromptSubmit(ups("plan this and then 루프 돌려서 끝까지 해줘", cwd, "la3", "t1"));
    const st = readState(cwd, "la3");
    assert.equal(st.phase, "P"); // trigger precedence still arms P
    assert.equal(st.loopArmSeen, true); // and the flag survives (audit Med #2)
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("ORCH-MANDATE-01: loop request against un-armed FSM injects the arming mandate", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("이 유닛 cxc-loop로 알아서 끝까지 해줘", cwd, "s1", "t1"));
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

test("ORCH-MANDATE-01: explicit PABCD trigger wins over the loop-arm directive (mode 1 precedence)", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this and then loop until done", cwd, "s1", "t1"));
    const parsed = JSON.parse(out.trimEnd());
    const ctx = parsed.hookSpecificOutput.additionalContext as string;
    assert.match(ctx, /\[codexclaw: PLAN\]/);
    assert.doesNotMatch(ctx, /arming mandate/);
    // Trigger precedence is about which directive is injected; the FSM phase itself
    // still moves only via explicit orchestrate commands.
    assert.equal(readState(cwd, "s1").lastInjectedPhase, "P");
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
    assert.equal(ctx, withFooter(phaseDirective("P"), "P"));
    assert.doesNotMatch(ctx, /agbrowse fetch/);
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
    // Loose plan triggers inject P and persist that detected phase without a command ledger entry.
    assert.equal(JSON.parse(out.trimEnd()).hookSpecificOutput.additionalContext, withFooter(phaseDirective("P"), "P"));
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
