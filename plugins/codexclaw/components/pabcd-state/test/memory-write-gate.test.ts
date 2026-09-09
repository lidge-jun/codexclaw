/**
 * memory-write-gate.test.ts — MEMORY-WRITE-GATE-01 (260909 wp1-A).
 *
 * Pins both directions: an unrequested memory write is denied, and an explicitly
 * requested one passes. The tool-name variants are pinned as a SET because the
 * hook-facing name is produced by codex-rs flat_tool_name concatenation
 * (core/src/tools/mod.rs:40-54) rather than by anything in this repo — the same
 * defensive fixing spawn-attach-hook.ts:483-488 applies to collaborationspawn_agent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  classifyMemoryWrite,
  detectMemoryWriteRequest,
  handleMemoryWriteGate,
  isMemoryPath,
  memoriesRoot,
  patchTargets,
  shellWriteDestinations,
  MEMORY_WRITE_TOOL_NAMES,
} from "../src/memory-write-gate.ts";
import { handleUserPromptSubmit } from "../src/hook.ts";
import { parseMemoryCliArgs, runMemoryCli } from "../src/memory-cli.ts";
import { readState, writeState, defaultState } from "../src/state.ts";

const SESSION = "019f9d73-4c28-7723-ab52-346aca1d9bcb";

function scratch(): { cwd: string; home: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), "cxc-memgate-"));
  const home = join(dir, "codex-home");
  return { cwd: join(dir, "work"), home, env: { CODEX_HOME: home } };
}

function ptu(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    session_id: SESSION,
    turn_id: "t1",
    cwd: "/tmp/does-not-matter",
    tool_name: "memoriesadd_ad_hoc_note",
    tool_input: { filename: "2026-09-09T10-00-00-note.md", note: "x" },
    ...overrides,
  });
}

test("T2: every flat_tool_name variant of the memory write tool is recognized", () => {
  // memoriesadd_ad_hoc_note is what flat_tool_name produces today (namespace +
  // name, no separator); the punctuated forms are defensive against an upstream
  // separator appearing later.
  for (const name of ["memoriesadd_ad_hoc_note", "memories.add_ad_hoc_note", "memories_add_ad_hoc_note"]) {
    assert.ok(MEMORY_WRITE_TOOL_NAMES.has(name), `${name} must be gated`);
    const attempt = classifyMemoryWrite(name, { filename: "n.md" }, "/w", memoriesRoot({ CODEX_HOME: "/h" }));
    assert.equal(attempt.surface, "tool", `${name} must classify as a memory write`);
  }
  // The read tools are NOT the gate's business.
  for (const name of ["memoriessearch", "memories.list", "memories.read"]) {
    assert.equal(classifyMemoryWrite(name, {}, "/w", memoriesRoot({ CODEX_HOME: "/h" })).surface, "");
  }
});

test("BLOCK: an unauthorized memory-tool write is denied with both remedies", () => {
  const { cwd } = scratch();
  const out = handleMemoryWriteGate(ptu({ cwd }));
  const env = JSON.parse(out.trim());
  assert.equal(env.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(env.hookSpecificOutput.permissionDecision, "deny");
  assert.match(env.hookSpecificOutput.permissionDecisionReason, /MEMORY-WRITE-GATE/);
  assert.match(env.hookSpecificOutput.permissionDecisionReason, /allow-write/);
  assert.match(env.hookSpecificOutput.permissionDecisionReason, /remember this/);
  // Deny-only envelope: the reason must also reach additionalContext.
  assert.equal(
    env.hookSpecificOutput.additionalContext,
    env.hookSpecificOutput.permissionDecisionReason,
  );
  assert.ok(out.endsWith("\n"));
});

test("ALLOW: a prompt that asks to remember authorizes exactly one write", () => {
  const { cwd } = scratch();
  const prompt = "이건 기억해둬, 다음에 또 쓸 거야";
  assert.equal(detectMemoryWriteRequest(prompt), true);
  handleUserPromptSubmit({
    hook_event_name: "UserPromptSubmit",
    session_id: SESSION,
    cwd,
    prompt,
    turn_id: "t1",
  } as never);
  assert.equal(readState(cwd, SESSION).memoryWriteRequested, true);

  // First write passes...
  assert.equal(handleMemoryWriteGate(ptu({ cwd })), "");
  // ...and the marker is spent, so a second unrequested write is denied again.
  assert.equal(readState(cwd, SESSION).memoryWriteRequested, false);
  assert.match(handleMemoryWriteGate(ptu({ cwd })), /"permissionDecision":"deny"/);
});

test("ALLOW: English remember idioms are recognized; recall questions are not", () => {
  for (const p of [
    "remember this for later",
    "please save that to memory",
    "add this to your memories",
    "don't forget the release date",
    "make a note of the API key location",
  ]) {
    assert.equal(detectMemoryWriteRequest(p), true, `should detect: ${p}`);
  }
  for (const p of [
    "기억 안 나는데 그때 뭐 했지?",
    "do you remember what we discussed?",
    "search my memories for the release notes",
    "fix the memory leak in the parser",
  ]) {
    assert.equal(detectMemoryWriteRequest(p), false, `should NOT detect: ${p}`);
  }
});

test("the marker is turn-scoped: a later turn cannot spend an earlier turn's request", () => {
  const { cwd } = scratch();
  handleUserPromptSubmit({
    hook_event_name: "UserPromptSubmit",
    session_id: SESSION,
    cwd,
    prompt: "기억해둬",
    turn_id: "t1",
  } as never);
  // A write attributed to a DIFFERENT turn must not consume t1's request.
  assert.match(handleMemoryWriteGate(ptu({ cwd, turn_id: "t9" })), /"permissionDecision":"deny"/);
  // The original turn still passes.
  assert.equal(handleMemoryWriteGate(ptu({ cwd, turn_id: "t1" })), "");
});

test("CLI grant: allow-write authorizes one write and is consumed by it", () => {
  const { cwd } = scratch();
  const parsed = parseMemoryCliArgs(["allow-write", "--session", SESSION], cwd);
  assert.ok(!("error" in parsed));
  const res = runMemoryCli(parsed as never);
  assert.equal(res.code, 0);
  assert.match(res.output, /ONE memory write/);
  assert.equal(readState(cwd, SESSION).memoryWriteGrant, true);

  assert.equal(handleMemoryWriteGate(ptu({ cwd })), "");
  assert.equal(readState(cwd, SESSION).memoryWriteGrant, false);
  assert.match(handleMemoryWriteGate(ptu({ cwd })), /"permissionDecision":"deny"/);
});

test("CLI grant rejects a non-canonical session id", () => {
  // "canonical" here means sanitize-stable (state.ts:239-250), not UUID-shaped: the
  // id must key the same state file the hook later reads. A value containing path
  // separators would be rewritten by sanitizeKey and land somewhere else.
  const parsed = parseMemoryCliArgs(["allow-write", "--session", "../../etc/passwd"], "/tmp");
  assert.ok("error" in parsed);
  assert.match((parsed as { error: string }).error, /canonical session id/);
  // A missing --session is refused too.
  assert.ok("error" in parseMemoryCliArgs(["allow-write"], "/tmp"));
  assert.ok("error" in parseMemoryCliArgs(["grant"], "/tmp"));
});

test("file-edit surface: an apply_patch under the memories root is gated, elsewhere is not", () => {
  const root = memoriesRoot({ CODEX_HOME: "/h" });
  const inside = "*** Add File: /h/memories/extensions/ad_hoc/notes/x.md\n+hi\n";
  assert.equal(classifyMemoryWrite("apply_patch", { command: inside }, "/w", root).surface, "edit");
  const outside = "*** Update File: /w/src/index.ts\n+hi\n";
  assert.equal(classifyMemoryWrite("apply_patch", { command: outside }, "/w", root).surface, "");
  // Unified headers name the destination too.
  assert.deepEqual(patchTargets("+++ b/a/b.md\n+x"), ["a/b.md"]);
  // A sibling directory sharing the prefix must NOT match.
  assert.equal(isMemoryPath("/h/memories-backup/x.md", root), false);
  assert.equal(isMemoryPath("/h/memories/x.md", root), true);
});

test("shell surface: a write into memories is gated; a read is not", () => {
  const root = memoriesRoot({ CODEX_HOME: "/h" });
  const gated = classifyMemoryWrite("Bash", { command: "echo hi > /h/memories/notes.md" }, "/w", root);
  assert.equal(gated.surface, "shell");
  // Reading is what cxc-recall does constantly; gating it would break recall.
  assert.equal(classifyMemoryWrite("Bash", { command: "rg foo /h/memories" }, "/w", root).surface, "");
  assert.equal(classifyMemoryWrite("Bash", { command: "cat /h/memories/MEMORY.md" }, "/w", root).surface, "");
  // A write somewhere else is none of the gate's business.
  assert.equal(classifyMemoryWrite("Bash", { command: "echo hi > /w/out.txt" }, "/w", root).surface, "");
});

test("FAIL-OPEN: malformed input, wrong event and unrelated tools all allow ('')", () => {
  assert.equal(handleMemoryWriteGate("not json"), "");
  assert.equal(handleMemoryWriteGate(""), "");
  assert.equal(handleMemoryWriteGate(JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "memoriesadd_ad_hoc_note" })), "");
  assert.equal(handleMemoryWriteGate(ptu({ tool_name: "exec_command", tool_input: { command: "ls" } })), "");
  // registry.rs:815-816 — unparseable arguments arrive as a bare JSON string, so
  // tool_input is not necessarily an object. That must not throw.
  const out = handleMemoryWriteGate(ptu({ cwd: scratch().cwd, tool_input: "{broken" }));
  assert.match(out, /"permissionDecision":"deny"/);
  // An edit tool with a string tool_input classifies as no write at all.
  assert.equal(handleMemoryWriteGate(ptu({ tool_name: "apply_patch", tool_input: "junk" })), "");
});

test("old state files read as unauthorized (no retroactive standing grant)", () => {
  const { cwd } = scratch();
  const base = defaultState(SESSION);
  writeState(cwd, base);
  const state = readState(cwd, SESSION);
  assert.equal(state.memoryWriteRequested, false);
  assert.equal(state.memoryWriteGrant, false);
  assert.equal(state.memoryWriteTurn, null);
});

test("shell surface: destination-based classification, not body path strings", () => {
  const root = memoriesRoot({ CODEX_HOME: "/h" });
  const mem = "/h/memories";
  const classify = (command: string, tool = "Bash") =>
    classifyMemoryWrite(tool, { command }, "/w", root);

  // (1) sed -n is a read.
  assert.equal(classify(`sed -n '1p' ${mem}/MEMORY.md`).surface, "");
  // (2) stderr redirect is not a write destination.
  assert.equal(classify(`rg foo ${mem}/MEMORY.md 2>/dev/null`).surface, "");
  // (3) heredoc body names the memories root; the write destination is devlog.
  const heredoc = [
    "mkdir -p /w/devlog/_plan/notes",
    `&& cat > /w/devlog/_plan/notes/00_brief.md <<'EOF'`,
    `\n${mem}\nEOF`,
  ].join(" ");
  assert.equal(classify(heredoc).surface, "");
  // (4) sed -i of a memory file remains a write.
  const sedInPlace = classify(`sed -i 's/a/b/' ${mem}/MEMORY.md`);
  assert.equal(sedInPlace.surface, "shell");
  // target is absolutized with path.resolve, so compare on the platform form (D:\h\... on Windows).
  assert.equal(sedInPlace.target, resolve(`${mem}/MEMORY.md`));
  // (5) stdout redirect into memories remains a write.
  assert.equal(classify(`echo hi > ${mem}/notes.md`).surface, "shell");
  // (A1) no-space redirections and `>|` clobber are real writes (audit round 1 found the
  // first parser draft returning [] for all three).
  assert.equal(classify(`echo hi>${mem}/n.md`).surface, "shell");
  assert.equal(classify(`echo hi>>${mem}/n.md`).surface, "shell");
  assert.equal(classify(`echo hi >| ${mem}/n.md`).surface, "shell");
  assert.equal(classify(`echo 'a>b'`).surface, "");
  assert.equal(classify(`grep -- '->' /w/f`).surface, "");

  // Live shape from notes/00 and notes/03 §6: worktree dest, tilde path in the body.
  const live = [
    "mkdir -p /Users/jun/.codex/worktrees/3412/codexclaw/devlog/_plan/260910_memory-followup-roadmap/notes /tmp/mfu-260910",
    "&& cat > /Users/jun/.codex/worktrees/3412/codexclaw/devlog/_plan/260910_memory-followup-roadmap/notes/00_brief.md <<'EOF'",
    "\n~/.codex/memories\nEOF",
  ].join(" ");
  assert.equal(classify(live).surface, "");

  // Old >>? regex false-denies (notes/03 §4, §6 table).
  assert.equal(classify(`python3 -c "from pathlib import Path; print(Path('${mem}/MEMORY.md').read_text()); print('x -> y')"`).surface, "");
  assert.equal(classify(`rg '<prose>' ${mem}/MEMORY.md`).surface, "");

  assert.equal(classify(`rg foo /w | tee ${mem}/out.md`).surface, "shell");
  assert.equal(classify(`cp /w/a.md ${mem}/b.md`).surface, "shell");
  assert.equal(classify(`cp ${mem}/a.md /w/b.md`).surface, "");
  assert.equal(classify(`mv /w/a.md ${mem}/b.md`).surface, "shell");
  assert.equal(classify(`perl -i -pe 's/a/b/' ${mem}/MEMORY.md`).surface, "shell");
  assert.equal(classify(`ruby -i -pe 's/a/b/' ${mem}/MEMORY.md`).surface, "shell");
  assert.equal(classify(`sed -n '1p' ${mem}/MEMORY.md`, "exec_command").surface, "");
  assert.equal(classify(`echo hi > ${mem}/notes.md`, "exec_command").surface, "shell");
});

test("shellWriteDestinations: stderr, arrows in prose, and heredoc bodies are not dests", () => {
  assert.deepEqual(shellWriteDestinations("rg foo /h/memories 2>/dev/null"), []);
  assert.deepEqual(shellWriteDestinations("echo 'a > b'"), []);
  assert.deepEqual(shellWriteDestinations("echo hi > /tmp/out.md"), ["/tmp/out.md"]);
  assert.deepEqual(
    shellWriteDestinations("cat > /tmp/out.md <<'EOF'\n~/.codex/memories\nEOF"),
    ["/tmp/out.md"],
  );
  assert.deepEqual(shellWriteDestinations("sed -n '1p' /h/memories/MEMORY.md"), []);
  assert.deepEqual(shellWriteDestinations("sed -i 's/a/b/' /h/memories/MEMORY.md"), ["/h/memories/MEMORY.md"]);
  assert.deepEqual(shellWriteDestinations("echo hi>/h/memories/n.md"), ["/h/memories/n.md"]);
  assert.deepEqual(shellWriteDestinations("echo hi>>/h/memories/n.md"), ["/h/memories/n.md"]);
  assert.deepEqual(shellWriteDestinations("echo hi >| /h/memories/n.md"), ["/h/memories/n.md"]);
  assert.deepEqual(shellWriteDestinations("x -> y"), []);
});
