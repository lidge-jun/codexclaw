import { test } from "node:test";
import assert from "node:assert/strict";
import { lintApplyPatch, addedLines, handleApplyPatchLint, FORBIDDEN_PATTERNS } from "../src/comment-lint.ts";

test("060.2: addedLines extracts + lines, skips +++ headers", () => {
  const patch = ["+++ b/x.ts", "+const a = 1;", " unchanged", "-removed", "+const b = 2;"].join("\n");
  assert.deepEqual(addedLines(patch), ["const a = 1;", "const b = 2;"]);
});

test("060.2: lintApplyPatch denies `as any` on an added line", () => {
  const patch = "+++ b/x.ts\n+const v = foo as any;\n";
  const r = lintApplyPatch(patch);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /as any/);
});

test("060.2: `as any` WITH // justified: is allowed", () => {
  const patch = "+++ b/x.ts\n+const v = foo as any; // justified: third-party untyped\n";
  assert.equal(lintApplyPatch(patch).ok, true);
});

test("060.2: clean patch allowed; eval and debugger denied", () => {
  assert.equal(lintApplyPatch("+++ b/x.ts\n+const x = 1;\n").ok, true);
  assert.equal(lintApplyPatch("+++ b/x.ts\n+eval(userInput);\n").ok, false);
  assert.equal(lintApplyPatch("+++ b/x.ts\n+debugger;\n").ok, false);
});

test("060.2: only ADDED lines are scanned (a removed `as any` is fine)", () => {
  assert.equal(lintApplyPatch("+++ b/x.ts\n-const v = foo as any;\n+const v: Foo = foo;\n").ok, true);
});

test("060.2: handleApplyPatchLint emits a PreToolUse deny envelope on a match", () => {
  const raw = JSON.stringify({
    hook_event_name: "PreToolUse", session_id: "s", cwd: "/tmp",
    tool_name: "apply_patch", tool_input: { command: "+++ b/x.ts\n+const v = foo as any;\n" },
  });
  const out = JSON.parse(handleApplyPatchLint(raw).trim());
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /comment-lint/);
});

test("060.2: FAIL-OPEN — clean patch, wrong tool, malformed JSON all allow ('')", () => {
  // clean apply_patch
  assert.equal(handleApplyPatchLint(JSON.stringify({
    hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command: "+++ b/x.ts\n+ok();\n" },
  })), "");
  // non-lintable tool
  assert.equal(handleApplyPatchLint(JSON.stringify({
    hook_event_name: "PreToolUse", tool_name: "exec_command", tool_input: { command: "rm as any" },
  })), "");
  // malformed JSON => fail open
  assert.equal(handleApplyPatchLint("{not json"), "");
  // wrong event
  assert.equal(handleApplyPatchLint(JSON.stringify({ hook_event_name: "Stop" })), "");
});

test("060.2: Write/Edit matcher aliases still lint (tool_name serialized as alias)", () => {
  const raw = JSON.stringify({
    hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { command: "+++ b/x.ts\n+debugger;\n" },
  });
  assert.match(JSON.parse(handleApplyPatchLint(raw).trim()).hookSpecificOutput.permissionDecisionReason, /debugger/);
});

test("060.2: forbidden set is non-empty and deterministic (static)", () => {
  assert.ok(FORBIDDEN_PATTERNS.length >= 3);
  for (const p of FORBIDDEN_PATTERNS) assert.ok(p.re instanceof RegExp && typeof p.msg === "string");
});
