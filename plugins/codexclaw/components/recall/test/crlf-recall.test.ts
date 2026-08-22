/**
 * crlf-recall.test.ts - CRLF tolerance in recall's readers (wp08).
 *
 * memory-search folded a hand-rolled CR strip into the shared idiom; these cases
 * prove that fold-in was not a regression. rollout reads codex-written JSONL that
 * this repo did not author, so it is checked against a CRLF rewrite too.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { paragraphChunks } from "../src/memory-search.ts";
import { parseRollout } from "../src/rollout.ts";

test("memory-search CRLF content chunks identically to LF", () => {
  const lfDoc = "a\nb\n\nc\n\n\nd\n";
  const lf = paragraphChunks(lfDoc);
  const crlf = paragraphChunks(lfDoc.replace(/\n/g, "\r\n"));
  assert.deepEqual(crlf, lf, "CRLF markdown must chunk identically");
  assert.deepEqual(
    lf.map((c) => [c.text, c.startLine]),
    [["a\nb", 1], ["c", 4], ["d", 7]],
    "the LF baseline is unchanged by the idiom swap",
  );
  for (const chunk of crlf) {
    assert.equal(chunk.text.includes("\r"), false, "no CR may reach a rendered chunk");
  }
});

test("memory-search start lines survive a CRLF document", () => {
  const doc = "intro\r\n\r\nsecond para\r\n\r\nthird\r\n";
  const chunks = paragraphChunks(doc);
  assert.deepEqual(chunks.map((c) => c.startLine), [1, 3, 5], "jump-to-source lines must stay correct");
});

function responseItem(text: string): string {
  return JSON.stringify({
    type: "response_item",
    timestamp: "2026-08-21T00:00:00Z",
    payload: { type: "message", role: "user", content: [{ type: "input_text", text }] },
  });
}

test("a CRLF rollout file parses to the same entries as LF", () => {
  const lfDoc = [responseItem("first"), responseItem("second"), ""].join("\n");
  const lf = parseRollout(lfDoc, true);
  const crlf = parseRollout(lfDoc.replace(/\n/g, "\r\n"), true);
  assert.equal(lf.length, 2, "LF baseline must read both entries");
  assert.deepEqual(crlf, lf, "a CRLF rollout must parse identically");
});
