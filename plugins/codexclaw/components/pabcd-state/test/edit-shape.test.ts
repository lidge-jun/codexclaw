import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EDIT_SHAPE_ADVICE_THRESHOLD,
  fileEditShapes,
  handleEditShapeCapture,
  normalizeEditLine,
  readEditShapeRows,
} from "../src/edit-shape.ts";
import type { PostToolUsePayload } from "../src/hook.ts";

function patchFor(file: string, removed: string, added: string): string {
  return [
    "*** Begin Patch",
    `*** Update File: ${file}`,
    "@@",
    ` context line`,
    `-${removed}`,
    `+${added}`,
    "*** End Patch",
  ].join("\n");
}

function payloadFor(cwd: string, command: string, tool = "apply_patch"): PostToolUsePayload {
  return {
    hook_event_name: "PostToolUse",
    session_id: "s1",
    cwd,
    tool_name: tool,
    tool_input: { command },
    tool_response: "Done",
    tool_use_id: "t1",
    turn_id: "turn1",
  } as PostToolUsePayload;
}

// --- normalizeEditLine -------------------------------------------------------

test("normalizeEditLine collapses strings, numbers, identifiers, whitespace", () => {
  assert.equal(normalizeEditLine('console.log("hello", 42)'), "I.I(S, N)");
  assert.equal(normalizeEditLine("logger.info(userId)"), "I.I(I)");
  assert.equal(normalizeEditLine("  const x   = 1;"), "I I = N;");
});

test("normalizeEditLine gives same shape for same-shaped lines with different names", () => {
  const a = normalizeEditLine('console.log(userId)');
  const b = normalizeEditLine('console.log(orderTotal)');
  assert.equal(a, b);
});

test("normalizeEditLine handles escaped quotes inside strings", () => {
  assert.equal(normalizeEditLine('f("a \\" b")'), "I(S)");
});

// --- fileEditShapes ----------------------------------------------------------

test("fileEditShapes yields one signature per updated file", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: a.ts",
    "-console.log(x)",
    "+logger.info(x)",
    "*** Update File: b.ts",
    "-console.log(y)",
    "+logger.info(y)",
    "*** End Patch",
  ].join("\n");
  const shapes = fileEditShapes(patch);
  assert.equal(shapes.length, 2);
  assert.equal(shapes[0].file, "a.ts");
  assert.equal(shapes[1].file, "b.ts");
  // same shape modulo identifiers -> same key
  assert.equal(shapes[0].key, shapes[1].key);
});

test("fileEditShapes distinguishes structurally different edits", () => {
  const a = fileEditShapes(patchFor("a.ts", "console.log(x)", "logger.info(x)"));
  const b = fileEditShapes(patchFor("b.ts", "const x = 1", "const x: number = 1"));
  assert.notEqual(a[0].key, b[0].key);
});

test("fileEditShapes skips delete sections and change-free sections", () => {
  const patch = [
    "*** Begin Patch",
    "*** Delete File: gone.ts",
    "*** Update File: only-context.ts",
    " context",
    "*** End Patch",
  ].join("\n");
  assert.equal(fileEditShapes(patch).length, 0);
});

test("fileEditShapes ignores diff headers", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: a.ts",
    "--- a.ts",
    "+++ a.ts",
    "-old()",
    "+updated()",
    "*** End Patch",
  ].join("\n");
  const shapes = fileEditShapes(patch);
  assert.equal(shapes.length, 1);
});

// --- handleEditShapeCapture --------------------------------------------------

test("advisory fires once at the distinct-file threshold, then stays quiet", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-edit-shape-"));
  const files = ["a.ts", "b.ts", "c.ts", "d.ts"];
  const outputs = files.map((f) =>
    handleEditShapeCapture(payloadFor(cwd, patchFor(f, "console.log(msg)", "logger.info(msg)"))),
  );
  assert.equal(outputs[0], "");
  assert.equal(outputs[1], "");
  assert.ok(outputs[2].includes("additionalContext"), "third distinct file should advise");
  assert.ok(outputs[2].includes(`${EDIT_SHAPE_ADVICE_THRESHOLD} distinct files`));
  assert.ok(outputs[2].includes("cxc-ast-grep"));
  assert.equal(outputs[3], "", "advice is once per signature");
  const parsed = JSON.parse(outputs[2]) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  };
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PostToolUse");
});

test("same file repeated does not count as distinct files", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-edit-shape-"));
  for (let i = 0; i < 5; i++) {
    const out = handleEditShapeCapture(
      payloadFor(cwd, patchFor("same.ts", "console.log(a)", "logger.info(a)")),
    );
    assert.equal(out, "");
  }
});

test("non-apply_patch tools and malformed inputs are ignored (fail-open)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-edit-shape-"));
  assert.equal(handleEditShapeCapture(payloadFor(cwd, "*** Begin Patch", "Bash")), "");
  assert.equal(
    handleEditShapeCapture({
      hook_event_name: "PostToolUse",
      session_id: "s",
      cwd,
      tool_name: "apply_patch",
      tool_input: { notCommand: true },
      tool_response: "",
    } as unknown as PostToolUsePayload),
    "",
  );
  assert.equal(handleEditShapeCapture(payloadFor(cwd, "")), "");
});

test("ledger rows are recorded per touched file and readable", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-edit-shape-"));
  handleEditShapeCapture(payloadFor(cwd, patchFor("x.ts", "a()", "b()")));
  handleEditShapeCapture(payloadFor(cwd, patchFor("y.ts", "a()", "b()")));
  const rows = readEditShapeRows(cwd);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].key, rows[1].key);
  assert.deepEqual(
    rows.map((r) => r.file),
    ["x.ts", "y.ts"],
  );
});

test("readEditShapeRows on a missing ledger returns []", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-edit-shape-"));
  assert.deepEqual(readEditShapeRows(cwd), []);
});
