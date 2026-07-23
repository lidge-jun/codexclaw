import test from "node:test";
import assert from "node:assert/strict";

// Pin the cxc-resolve seam (B1): a literal `cxc chat search` assertion below
// must not depend on whether the test runner's PATH carries a cxc binary.
process.env.CODEXCLAW_CXC = "cxc";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome, THREAD_MAIN, THREAD_SUB } from "./fixtures.ts";
import { searchMemory, paragraphChunks } from "../src/memory-search.ts";
import { formatChatResult, formatMemoryResult } from "../src/format.ts";
import { searchChat } from "../src/chat-search.ts";
import { main as cliMain } from "../src/cli.ts";

let home: string;

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-mem-"));
  buildCodexHome(home);
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("paragraphChunks: tracks 1-based start lines across blank separators", () => {
  const chunks = paragraphChunks("a\nb\n\nc\n\n\nd\n");
  assert.deepEqual(
    chunks.map((c) => [c.text, c.startLine]),
    [
      ["a\nb", 1],
      ["c", 4],
      ["d", 7],
    ],
  );
});

test("memory search hits markdown files with file:line locations", () => {
  const r = searchMemory("trigram sidecar", { home });
  assert.ok(r.hits.length >= 1);
  const fileHit = r.hits.find((h) => h.origin === "file" && h.relpath === "MEMORY.md");
  assert.ok(fileHit, "MEMORY.md paragraph hit expected");
  assert.ok(typeof fileHit.startLine === "number" && fileHit.startLine > 1);
});

test("memory search reaches stage1_outputs and dedupes md-covered threads", () => {
  const r = searchMemory("trigram", { home });
  const stage1Threads = r.hits.filter((h) => h.origin === "stage1").map((h) => h.threadId);
  assert.ok(!stage1Threads.includes(THREAD_MAIN), "md-covered thread must not duplicate via stage1");
  const dbOnly = searchMemory("quagga", { home });
  assert.equal(dbOnly.hits.length, 1, "one hit per stage1 row");
  assert.ok(dbOnly.hits.every((h) => h.origin === "stage1" && h.threadId === THREAD_SUB));
});

test("CRLF-authored memory files chunk and match cleanly", () => {
  const r = searchMemory("wombat migration", { home });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].relpath, "windows-notes.md");
  assert.ok(!r.hits[0].excerpt.includes("\r"), "excerpt must not carry CR");
});

test("memory search supports korean and AND semantics", () => {
  const r = searchMemory("한글 검색", { home });
  assert.ok(r.hits.length >= 1);
  const none = searchMemory("한글 없는단어조합", { home });
  assert.equal(none.hits.length, 0);
});

test("missing memories db degrades with a warning", () => {
  const bare = mkdtempSync(join(tmpdir(), "recall-mem-bare-"));
  try {
    const r = searchMemory("anything", { home: bare });
    assert.equal(r.hits.length, 0);
    assert.ok(r.warnings.some((w) => w.includes("memories db")));
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test("formatters render jaw-style envelopes", () => {
  const chat = formatChatResult(searchChat("트라이그램", { home, scan: true }));
  assert.match(chat, /^# \d+ hits \(\d+\/\d+ files scanned/, "chat header");
  assert.match(chat, /\(assistant\)/);
  assert.match(chat, /---/);
  const mem = formatMemoryResult(searchMemory("trigram sidecar", { home }));
  assert.match(mem, /^# \d+ memory hits/);
  assert.match(mem, /MEMORY\.md:\d+/);
  const empty = formatChatResult(searchChat("nonexistent-token-xyzzy", { home, scan: true }));
  assert.match(empty, /\(no matches\)/);
});

test("cli main: routes chat/memory search, rejects empty query, prints usage otherwise", () => {
  const captured: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.push(s);
    return true;
  };
  try {
    assert.equal(cliMain(["chat", "search", "트라이그램", "--home", home, "--scan"]), 0);
    assert.match(captured.join(""), /# \d+ hits/);
    captured.length = 0;
    assert.equal(cliMain(["memory", "search", "trigram", "--home", home, "--json"]), 0);
    const parsed = JSON.parse(captured.join(""));
    assert.ok(Array.isArray(parsed.hits) && parsed.hits.length > 0);
    captured.length = 0;
    assert.equal(cliMain(["chat", "search"]), 1, "empty query is an error");
    captured.length = 0;
    assert.equal(cliMain(["bogus"]), 0, "unknown subcommand is informational");
    assert.match(captured.join(""), /cxc chat search/);
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
  }
});
