/**
 * source-receipt parser tests (WP11 / plan 030).
 *
 * Adversarial by design: the parser is the thing standing between the final
 * gate and a hand-written file claiming the tests passed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supportsSymlinks, symlinkDirSync } from "../test-support/symlink-support.ts";
import { isReceiptError, parseSourceBoundReceipt } from "../src/source-receipt.ts";

const IDENTITY = { kind: "resolved", commitSha: "abc1234", dirty: false, capturedAt: "2026-01-01T00:00:00.000Z" };

function workspace(): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-receipt-"));
  mkdirSync(join(cwd, ".codexclaw", "evidence"), { recursive: true });
  return cwd;
}

function writeReceipt(cwd: string, name: string, body: unknown): string {
  const rel = join(".codexclaw", "evidence", name);
  writeFileSync(join(cwd, rel), typeof body === "string" ? body : JSON.stringify(body));
  return rel;
}

test("a well-formed test receipt parses", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "t.json", { kind: "test", sourceIdentity: IDENTITY, command: "npm test", exitCode: 0, createdAt: "2026-01-01T00:00:00.000Z" });
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(!isReceiptError(r));
  assert.equal(r.kind, "test");
  assert.equal(r.sourceIdentity.commitSha, "abc1234");
  assert.equal(r.command, "npm test");
});

test("a test receipt cannot satisfy the QA slot", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "t.json", { kind: "test", sourceIdentity: IDENTITY, createdAt: "x" });
  const r = parseSourceBoundReceipt(rel, cwd, "qa");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /kind mismatch/);
});

test("a QA receipt cannot satisfy the test slot", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "q.json", { kind: "qa", sourceIdentity: IDENTITY, createdAt: "x" });
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /kind mismatch/);
});

test("an empty path is rejected", () => {
  assert.ok(isReceiptError(parseSourceBoundReceipt("", workspace(), "test")));
});

test("a zero-byte receipt is rejected by the evidence-root guard", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "empty.json", "");
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /evidence-root guard/);
});

test("a receipt reached through a linked directory inside the evidence root is rejected", (t) => {
  // Companion to the leaf-link case above, reaching the same realpath guard
  // through a DIRECTORY link. Junctions need no elevation, so this half of the
  // symlink coverage runs on a stock Windows checkout.
  if (!supportsSymlinks().dir) {
    t.skip("directory links unavailable on this host: linked-directory escape not exercised");
    return;
  }
  const cwd = workspace();
  const outside = mkdtempSync(join(tmpdir(), "cxc-receipt-outside-"));
  writeFileSync(join(outside, "r.json"), JSON.stringify({ kind: "test", sourceIdentity: IDENTITY, createdAt: "x" }));
  symlinkDirSync(outside, join(cwd, ".codexclaw", "evidence", "linked"));
  // Lexically inside the evidence root; the realpath still lands outside it.
  const r = parseSourceBoundReceipt(join(".codexclaw", "evidence", "linked", "r.json"), cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /evidence-root guard/);
});

test("malformed JSON is rejected", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "bad.json", "{not json");
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /not valid JSON/);
});

test("a JSON array is not a receipt", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "arr.json", [1, 2]);
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /JSON object/);
});

test("a receipt without sourceIdentity is rejected", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "noid.json", { kind: "test", createdAt: "x" });
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /sourceIdentity/);
});

test("a malformed sourceIdentity is rejected", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "badid.json", { kind: "test", sourceIdentity: { kind: "nope" }, createdAt: "x" });
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /sourceIdentity/);
});

test("an unknown kind is rejected", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "k.json", { kind: "smoke", sourceIdentity: IDENTITY, createdAt: "x" });
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /"test" or "qa"/);
});

test("a receipt outside the evidence root is rejected", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "outside.json"), JSON.stringify({ kind: "test", sourceIdentity: IDENTITY, createdAt: "x" }));
  const r = parseSourceBoundReceipt("outside.json", cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /evidence-root guard/);
});

test("a symlink into the evidence root is rejected", (t) => {
  // The link must point at a receipt FILE, so a directory junction cannot
  // stand in for it on an unprivileged Windows host.
  if (!supportsSymlinks().file) {
    t.skip("file symlinks unavailable on this host: evidence-root symlink refusal not exercised");
    return;
  }
  const cwd = workspace();
  const real = join(cwd, "elsewhere.json");
  writeFileSync(real, JSON.stringify({ kind: "test", sourceIdentity: IDENTITY, createdAt: "x" }));
  const rel = join(".codexclaw", "evidence", "link.json");
  symlinkSync(real, join(cwd, rel));
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /evidence-root guard/);
});

test("a directory is not a receipt", () => {
  const cwd = workspace();
  const rel = join(".codexclaw", "evidence", "dir.json");
  mkdirSync(join(cwd, rel), { recursive: true });
  const r = parseSourceBoundReceipt(rel, cwd, "test");
  assert.ok(isReceiptError(r));
  assert.match(r.error, /evidence-root guard/);
});
