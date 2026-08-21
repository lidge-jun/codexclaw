/**
 * crlf-where.test.ts - where.exe stdout is CRLF (wp08 / 002 B9).
 *
 * detectDeps() is a private, non-injectable closure over spawnSync, so the exact
 * expression it now uses is exercised here against this package's own text-lines
 * copy. That also pins the SHARED-HELPER-01 requirement that the copy exists at
 * this path: a cross-package import would not resolve at build time.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitLines } from "../src/text-lines.ts";

/** The idiom detectDeps() uses on `where` / `command -v` stdout. */
function firstPath(stdout: string): string {
  return splitLines(stdout)[0]?.trim() ?? "";
}

test("CRLF where output yields a clean first path", () => {
  const stdout = "C:\\Program Files\\nodejs\\node.exe\r\nC:\\other\\node.exe\r\n";
  const first = firstPath(stdout);
  assert.equal(first, "C:\\Program Files\\nodejs\\node.exe");
  assert.equal(first.includes("\r"), false, "no CR may survive into a spawned path");
});

test("LF where output is unchanged by the idiom", () => {
  assert.equal(firstPath("/usr/bin/node\n/usr/local/bin/node\n"), "/usr/bin/node");
});

test("empty stdout does not throw", () => {
  // The `?? ""` guard: any future filter() would make this undefined.trim().
  assert.equal(firstPath(""), "");
  assert.doesNotThrow(() => firstPath(""));
  assert.equal(splitLines("").filter((l) => l.length > 0)[0]?.trim() ?? "", "");
});
