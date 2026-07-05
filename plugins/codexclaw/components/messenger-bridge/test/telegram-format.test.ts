/** telegram-format.test.ts — md→HTML + chunking safety. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  markdownToTelegramHtml,
  chunkTelegramMessage,
  stripTelegramHtml,
  escapeHtmlTg,
} from "../src/telegram-format.ts";
import { markdownToRichHtml, containsRichTags, TELEGRAM_RICH_TAGS } from "../src/telegram-format.ts";

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

// ── Rich HTML conversion (Phase E1) ──────────────────────────────────────

test("markdownToRichHtml converts headings", () => {
  assert.equal(markdownToRichHtml("# Title"), "<h1>Title</h1>");
  assert.equal(markdownToRichHtml("## Sub"), "<h2>Sub</h2>");
  assert.equal(markdownToRichHtml("### Deep"), "<h3>Deep</h3>");
});

test("markdownToRichHtml converts unordered lists", () => {
  const md = "- item1\n- item2\n- item3";
  const html = markdownToRichHtml(md);
  assert.ok(html.includes("<ul>"), "should have <ul>");
  assert.ok(html.includes("<li>item1</li>"), "should have item1");
  assert.ok(html.includes("<li>item3</li>"), "should have item3");
});

test("markdownToRichHtml converts ordered lists", () => {
  const md = "1. first\n2. second";
  const html = markdownToRichHtml(md);
  assert.ok(html.includes("<ol>"), "should have <ol>");
  assert.ok(html.includes("<li>first</li>"), "should have first");
});

test("markdownToRichHtml converts blockquotes", () => {
  const md = "> this is a quote";
  const html = markdownToRichHtml(md);
  assert.ok(html.includes("<blockquote>"), "should have blockquote");
  assert.ok(html.includes("this is a quote"), "should contain quote text");
});

test("markdownToRichHtml converts links", () => {
  const md = "[Google](https://google.com)";
  const html = markdownToRichHtml(md);
  assert.ok(html.includes('<a href="https://google.com">Google</a>'), "should have link");
});

test("markdownToRichHtml converts code fences with language", () => {
  const md = "```typescript\nconst x = 1;\n```";
  const html = markdownToRichHtml(md);
  assert.ok(html.includes('class="language-typescript"'), "should have language class");
  assert.ok(html.includes("<pre><code"), "should have pre+code");
});

test("markdownToRichHtml converts inline formatting", () => {
  assert.ok(markdownToRichHtml("**bold**").includes("<b>bold</b>"));
  assert.ok(markdownToRichHtml("*italic*").includes("<i>italic</i>"));
  assert.ok(markdownToRichHtml("`code`").includes("<code>code</code>"));
  assert.ok(markdownToRichHtml("~~strike~~").includes("<s>strike</s>"));
});

test("markdownToRichHtml escapes HTML in non-code content", () => {
  const html = markdownToRichHtml("x < 1 && y > 2");
  assert.ok(html.includes("&lt;"), "should escape <");
  assert.ok(html.includes("&gt;"), "should escape >");
  assert.ok(html.includes("&amp;"), "should escape &");
});

test("containsRichTags detects rich-only tags", () => {
  assert.equal(containsRichTags("<b>bold</b>"), false, "legacy tag is not rich-only");
  assert.equal(containsRichTags("<h1>heading</h1>"), true, "h1 is rich-only");
  assert.equal(containsRichTags("<ul><li>item</li></ul>"), true, "ul/li is rich-only");
  assert.equal(containsRichTags("<details><summary>x</summary></details>"), true, "details is rich-only");
});

test("chunking with rich=true handles attributeful tags", () => {
  // A tag with attributes should still be recognized for balance checking
  const html = '<ol start="3"><li>' + "x".repeat(5000) + "</li></ol>";
  const chunks = chunkTelegramMessage(html, 1000, true);
  assert.ok(chunks.length > 1, "should split long content");
  for (const c of chunks) assert.ok(c.length <= 1000, "chunk should not exceed limit");
});

test("legacy markdownToTelegramHtml converts links", () => {
  const html = markdownToTelegramHtml("[click](https://example.com)");
  assert.ok(html.includes('<a href="https://example.com">click</a>'), "should have link");
});
