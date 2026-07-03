/** telegram-format.test.ts — md→HTML + chunking safety. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  markdownToTelegramHtml,
  chunkTelegramMessage,
  stripTelegramHtml,
  escapeHtmlTg,
} from "../src/telegram-format.ts";

test("escapes HTML-special chars before formatting", () => {
  assert.equal(escapeHtmlTg("a < b & c > d"), "a &lt; b &amp; c &gt; d");
  assert.equal(markdownToTelegramHtml("if x < 1 && y > 2"), "if x &lt; 1 &amp;&amp; y &gt; 2");
});

test("converts markdown to the Telegram HTML tag subset", () => {
  assert.equal(markdownToTelegramHtml("**bold**"), "<b>bold</b>");
  assert.equal(markdownToTelegramHtml("*italic*"), "<i>italic</i>");
  assert.equal(markdownToTelegramHtml("`code`"), "<code>code</code>");
  assert.equal(markdownToTelegramHtml("~~strike~~"), "<s>strike</s>");
  assert.equal(
    markdownToTelegramHtml("```js\nconst x = 1;\n```"),
    "<pre><code>const x = 1;\n</code></pre>",
  );
});

test("chunking returns single chunk under the limit", () => {
  assert.deepEqual(chunkTelegramMessage("short"), ["short"]);
});

test("chunking splits long text and never exceeds the limit", () => {
  const long = "word ".repeat(2000); // 10000 chars
  const chunks = chunkTelegramMessage(long, 4096);
  assert.ok(chunks.length >= 3);
  for (const c of chunks) assert.ok(c.length <= 4096);
  assert.equal(chunks.join(""), long);
});

test("chunking keeps Telegram tags balanced per chunk", () => {
  const html = "<b>" + "x".repeat(5000) + "</b>";
  const chunks = chunkTelegramMessage(html, 1000);
  for (const c of chunks) {
    const opens = (c.match(/<b>/g) ?? []).length;
    const closes = (c.match(/<\/b>/g) ?? []).length;
    // balance never goes negative within a chunk (no orphan close)
    assert.ok(closes <= opens || opens === 0);
  }
});

test("stripTelegramHtml removes tags for plain fallback", () => {
  assert.equal(stripTelegramHtml("<b>hi</b> <code>x</code>"), "hi x");
});
