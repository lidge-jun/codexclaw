/** output-formatter.test.ts — platform output segmentation and file decisions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatForDiscord,
  formatForTelegram,
  sendFormattedDiscordOutput,
  segmentOutput,
  shouldSendAsFile,
} from "../src/output-formatter.ts";
import type { DiscordApi } from "../src/discord-api.ts";

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

test("sendFormattedDiscordOutput returns a checked aggregate and continues after a failed chunk", async () => {
  let calls = 0;
  const api = {
    sendMessage: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 500, error: "first failed" }
        : { ok: true, status: 200, data: { id: String(calls) } };
    },
  } as unknown as DiscordApi;
  const result = await sendFormattedDiscordOutput(api, "channel", `${"a".repeat(1990)}\n${"b".repeat(1990)}`);
  assert.deepEqual(result, { ok: false, error: "first failed" });
  assert.equal(calls, 2);

  calls = 0;
  const successApi = {
    sendMessage: async () => {
      calls += 1;
      return { ok: true, status: 200, data: { id: String(calls) } };
    },
  } as unknown as DiscordApi;
  assert.deepEqual(await sendFormattedDiscordOutput(successApi, "channel", "ok"), { ok: true });
});
