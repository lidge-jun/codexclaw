// Tag balance for the archived emergence visual (WP16 / plan 120).
//
// Split out of emergence-doc-sync.test.mjs, whose other test asserted that
// particular sentences appear in five documents — phrase existence, which
// TEST-PROMPT-SEAM-01 forbids and which was deleted. This one is different in
// kind: it counts opening tags against closing tags, a value compared to another
// value, and it catches a truncated close rather than a change of wording.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HTML_PATH = "devlog/_fin/260701_emergence_harness/emergence_gap.html";
const TAGS = ["div", "table", "thead", "tbody", "tr", "td", "ul", "li", "h2"];

function readHtml() {
  return readFileSync(resolve(process.cwd(), HTML_PATH), "utf8");
}

/** Throws on the first tag whose open and close counts disagree. */
function assertTagBalance(html) {
  for (const tag of TAGS) {
    const open = (html.match(new RegExp(`<${tag}(?:\\s|>)`, "g")) ?? []).length;
    const close = (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    assert.equal(open, close, `${tag} tag count drift: ${open} open vs ${close} close`);
  }
}

test("the archived emergence visual has balanced tags", () => {
  assertTagBalance(readHtml());
});

test("the balance check actually fails on a truncated close", () => {
  // Mutating in memory rather than on disk: proving the guard works should not
  // require damaging a checked-in artifact and hoping the restore lands.
  const damaged = readHtml().replace("</tbody>", "");
  assert.throws(() => assertTagBalance(damaged), /tbody tag count drift/);
});
