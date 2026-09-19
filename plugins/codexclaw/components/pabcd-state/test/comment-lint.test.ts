import { test } from "node:test";
import assert from "node:assert/strict";
import { lintApplyPatch, addedLines, addedRecords, handleApplyPatchLint, FORBIDDEN_PATTERNS } from "../src/comment-lint.ts";

// Issue #196 fixtures. These strings must contain the forbidden patterns to be useful,
// so the source lines carry the lint's own justification escape. The escape lives on the
// SOURCE line, not inside the fixture value, so the linted content stays unjustified.
const PROSE_SENTENCE =
  "which is the reason to treat it as the test rather than as any of them"; // justified: issue #196 prose fixture
const REAL_CAST = "const v = foo as any;"; // justified: issue #196 code fixture

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

test("#196: prose in a Markdown target is not scanned as code", () => {
  const patch = ["*** Add File: docs/report.md", "+" + PROSE_SENTENCE].join("\n");
  assert.equal(lintApplyPatch(patch).ok, true);
});

test("#196: a quoted bug report in Markdown is allowed, including a fenced code sample", () => {
  const patch = [
    "*** Update File: devlog/_plan/260919_issue_sweep/001_advisor_findings.md",
    "+The linter denied this sentence:",
    "+",
    "+> " + PROSE_SENTENCE,
    "+",
    "+```ts",
    "+" + REAL_CAST,
    "+```",
  ].join("\n");
  assert.equal(lintApplyPatch(patch).ok, true);
});

test("#196: .txt and the other prose extensions are exempt; case is ignored", () => {
  for (const name of ["notes.txt", "NOTES.TXT", "a.markdown", "b.mdx", "c.rst", "d.adoc"]) {
    assert.equal(lintApplyPatch("*** Add File: " + name + "\n+" + PROSE_SENTENCE).ok, true, name);
  }
});

test("#196: a real cast in a source target is still denied", () => {
  const r = lintApplyPatch("*** Update File: src/x.ts\n+" + REAL_CAST);
  assert.equal(r.ok, false);
});

test("#196: a mixed patch is still denied for its source hunk, and the target resets", () => {
  const patch = [
    "*** Add File: docs/report.md",
    "+" + PROSE_SENTENCE,
    "*** Update File: src/x.ts",
    "+" + REAL_CAST,
  ].join("\n");
  assert.equal(lintApplyPatch(patch).ok, false);
});

test("#196: a source file under /tmp is still scanned", () => {
  assert.equal(lintApplyPatch("*** Add File: /tmp/example.ts\n+" + REAL_CAST).ok, false);
});

test("#196: a Move directive retargets subsequent added lines", () => {
  assert.equal(lintApplyPatch("*** Move to: docs/moved.md\n+" + PROSE_SENTENCE).ok, true);
  assert.equal(lintApplyPatch("*** Move to: src/moved.ts\n+" + REAL_CAST).ok, false);
});

test("#196: an added line with no known target is still scanned (fail-safe)", () => {
  assert.equal(lintApplyPatch("+" + REAL_CAST).ok, false);
});

test("#196: CRLF patches carry the target through", () => {
  assert.equal(lintApplyPatch("*** Add File: docs/report.md\r\n+" + PROSE_SENTENCE + "\r\n").ok, true);
  assert.equal(lintApplyPatch("*** Add File: src/x.ts\r\n+" + REAL_CAST + "\r\n").ok, false);
});

test("#196: addedRecords pairs each added line with its target; addedLines is unchanged", () => {
  const patch = ["*** Add File: docs/a.md", "+alpha", "*** Update File: src/b.ts", "+beta"].join("\n");
  assert.deepEqual(addedRecords(patch), [
    { line: "alpha", target: "docs/a.md" },
    { line: "beta", target: "src/b.ts" },
  ]);
  assert.deepEqual(addedLines(patch), ["alpha", "beta"]);
});

test("#196: the deny envelope is not produced for a Markdown target", () => {
  const payload = JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "apply_patch",
    tool_input: { command: "*** Add File: docs/report.md\n+" + PROSE_SENTENCE },
  });
  assert.equal(handleApplyPatchLint(payload), "");
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
