import { test } from "node:test";
import assert from "node:assert/strict";
import type { RunnerEvent } from "../src/runner.ts";
import {
  createToolProgressPolicy,
  DEFAULT_TOOL_PROGRESS,
  TOOL_PROGRESS_MODES,
} from "../src/tool-progress.ts";

const started = (callId = "1", name = "read", input = '{"path":"a.ts"}'): RunnerEvent => ({
  kind: "tool_call", phase: "started", callId, name, input,
});
const completed = (
  callId = "1",
  outcome?: "success" | "error",
  resultSummary = "done",
): RunnerEvent => ({
  kind: "tool_call", phase: "completed", callId, name: "read", input: '{"path":"a.ts"}',
  ...(outcome ? { outcome } : {}), resultSummary,
});

test("canonical modes and default are stable", () => {
  assert.deepEqual(TOOL_PROGRESS_MODES, ["off", "new", "all", "verbose"]);
  assert.equal(DEFAULT_TOOL_PROGRESS, "new");
});

test("mode table gates lifecycle exactly", () => {
  const expected = {
    off: [],
    new: ["▶ read {\"path\":\"a.ts\"}"],
    all: ["▶ read {\"path\":\"a.ts\"}", "✓ read"],
    verbose: ["▶ read {\"path\":\"a.ts\"}", "✓ read — done"],
  } as const;
  for (const mode of TOOL_PROGRESS_MODES) {
    const policy = createToolProgressPolicy(mode);
    const lines = [policy.render(started()), policy.render(completed("1", "success"))]
      .flatMap((line) => line ? [line.text] : []);
    assert.deepEqual(lines, expected[mode], mode);
  }
});

test("deduplicates per call id and phase while repeated names with distinct ids survive", () => {
  const policy = createToolProgressPolicy("all");
  assert.ok(policy.render(started("1")));
  assert.equal(policy.render(started("1")), null);
  assert.ok(policy.render(started("2")));
  assert.equal(policy.render(started("2")), null);
  assert.ok(policy.render(completed("1", "error")));
  assert.equal(policy.render(completed("1", "error")), null);
  policy.reset();
  assert.ok(policy.render(started("1")));
});

test("completion markers include neutral absence and verbose-only summaries", () => {
  const all = createToolProgressPolicy("all");
  assert.equal(all.render(completed("ok", "success"))?.text, "✓ read");
  assert.equal(all.render(completed("bad", "error"))?.text, "✗ read");
  assert.equal(all.render(completed("unknown"))?.text, "■ read");

  const verbose = createToolProgressPolicy("verbose");
  assert.equal(verbose.render(completed("unknown"))?.text, "■ read — done");
});

test("sanitizes mentions, secrets, newlines, and bounds verbose summaries", () => {
  const policy = createToolProgressPolicy("verbose");
  const start = policy.render(started("1", "notify @everyone <@123>", "token=abc\nnext"));
  assert.equal(start?.text, "▶ notify [everyone] @user token=[redacted] next");
  const line = policy.render(completed("1", "success", `Bearer abc.def\n${"x".repeat(400)}`));
  assert.equal(line?.text.includes("abc.def"), false);
  assert.equal(line?.text.includes("\n"), false);
  assert.ok((line?.text.length ?? 0) <= "✓ read — ".length + 300);
});

test("shell commands use the same variant and non-tool events are rejected", () => {
  const policy = createToolProgressPolicy("all");
  assert.equal(policy.render(started("cmd", "$ echo hi", ""))?.text, "▶ $ echo hi");
  assert.equal(policy.render({ kind: "thinking", text: "hmm" }), null);
  assert.equal(policy.render({ kind: "file_change", path: "a", action: "modify" }), null);
  assert.equal(policy.render({ kind: "status", label: "working" }), null);
  assert.equal(policy.render({ kind: "message", text: "answer" }), null);
});
