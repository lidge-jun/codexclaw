/** output-formatter.test.ts — platform output segmentation and file decisions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatForDiscord,
  formatForTelegram,
  segmentOutput,
  shouldSendAsFile,
} from "../src/output-formatter.ts";

test("segmentOutput separates text and fenced code", () => {
  const segments = segmentOutput("hello\n\n```ts\nconst x = 1;\n```\nbye");
  assert.deepEqual(segments, [
    { type: "text", content: "hello" },
    { type: "code", content: "const x = 1;\n", language: "ts" },
    { type: "text", content: "bye" },
  ]);
});

test("shouldSendAsFile is true for long output and diff/patch segments", () => {
  assert.equal(shouldSendAsFile({ type: "text", content: "x\n".repeat(101) }), true);
  assert.equal(shouldSendAsFile({ type: "diff", content: "diff --git a/a b/a" }), true);
  assert.equal(shouldSendAsFile({ type: "code", language: "patch", content: "--- a\n+++ b" }), true);
  assert.equal(shouldSendAsFile({ type: "text", content: "short" }), false);
});

test("formatForTelegram moves diff output into upload files", () => {
  const formatted = formatForTelegram(segmentOutput("```diff\n--- a\n+++ b\n@@\n-a\n+b\n```"));
  assert.equal(formatted.files.length, 1);
  assert.equal(formatted.files[0].name, "codex-output-1.patch");
  assert.match(formatted.richHtml, /Attached/);
});

test("formatForDiscord prepares Buffer files for long output", () => {
  const formatted = formatForDiscord(segmentOutput("line\n".repeat(101)));
  assert.equal(formatted.files.length, 1);
  assert.equal(formatted.files[0].name, "codex-output-1.txt");
  assert.equal(Buffer.isBuffer(formatted.files[0].data), true);
  assert.match(formatted.content, /Attached codex-output-1\.txt/);
});
