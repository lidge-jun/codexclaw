/**
 * text-lines.test.ts - the newline idiom (wp08 / 002 B9, B10).
 *
 * Covers both exported splits because the whole point of naming two is that a
 * call site chooses on purpose: splitLines for reading, splitLinesByteExact
 * wherever a byte offset or length is recorded off the result.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitLines, splitLinesByteExact, dominantEol, withEol } from "../src/text-lines.ts";

test("splitLines handles LF, CRLF, and mixed", () => {
  assert.deepEqual(splitLines("a\r\nb\nc"), ["a", "b", "c"]);
  assert.deepEqual(splitLines("a\r\nb\r\nc"), ["a", "b", "c"]);
  assert.deepEqual(splitLines("a\nb\nc"), ["a", "b", "c"]);
  assert.deepEqual(splitLines(""), [""]);
});

test("splitLines leaves a lone CR alone (old-Mac endings are not supported)", () => {
  // Splitting on a bare CR would tear real content that merely contains one.
  assert.deepEqual(splitLines("a\rb"), ["a\rb"]);
  assert.equal(splitLines("a\rb").length, 1);
});

test("splitLinesByteExact keeps the CR so recorded offsets stay accurate", () => {
  assert.deepEqual(splitLinesByteExact("a\r\nb"), ["a\r", "b"]);
  // The recorded length of the first line must still count the CR byte.
  assert.equal(splitLinesByteExact("a\r\nb")[0].length, 2);
  assert.deepEqual(splitLinesByteExact("a\nb"), ["a", "b"]);
});

test("dominantEol picks CRLF only when it leads", () => {
  assert.equal(dominantEol("a\r\nb\r\nc\nd"), "\r\n");
  assert.equal(dominantEol("a\nb\r\n"), "\n");
  assert.equal(dominantEol(""), "\n");
  assert.equal(dominantEol("no newlines at all"), "\n");
});

test("withEol round-trips", () => {
  const t = "alpha\r\nbeta\ngamma\r\n";
  assert.equal(withEol(withEol(t, "\r\n"), "\n"), withEol(t, "\n"));
  assert.equal(withEol(t, "\n"), "alpha\nbeta\ngamma\n");
});

test("withEol does not double a CR", () => {
  const crlf = "alpha\r\nbeta\r\n";
  const out = withEol(crlf, "\r\n");
  assert.equal(out.includes("\r\r\n"), false);
  assert.equal(out, crlf);
});

test("withEol preserves whether the text ended with a newline", () => {
  assert.equal(withEol("a\nb", "\r\n"), "a\r\nb");
  assert.equal(withEol("a\nb\n", "\r\n"), "a\r\nb\r\n");
});
