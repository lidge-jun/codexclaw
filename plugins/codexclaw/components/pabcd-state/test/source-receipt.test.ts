/**
 * source-receipt parser tests (WP11 / plan 030).
 *
 * Adversarial by design: the parser is the thing standing between the final
 * gate and a hand-written file claiming the tests passed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
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

function manifestFixture(cwd: string): { rel: string; dir: string; receipt: Record<string, unknown> } {
  const dir = join(cwd, ".codexclaw", "evidence", "qa", "D-PACKAGE");
  mkdirSync(dir, { recursive: true });
  const verdict = { scenario: "D-PACKAGE", desktopArtifact: true, criterionIds: ["c-3"], artifactRefs: ["artifact-identity.json"] };
  writeFileSync(join(dir, "verdict.json"), JSON.stringify(verdict));
  writeFileSync(join(dir, "artifact-identity.json"), JSON.stringify({ version: 1 }));
  const digest = (name: string) => createHash("sha256").update(readFileSync(join(dir, name))).digest("hex");
  const receipt: Record<string, unknown> = { kind: "qa", sourceIdentity: IDENTITY, createdAt: IDENTITY.capturedAt,
    artifactManifest: [
      { path: "qa/D-PACKAGE/verdict.json", kind: "verdict", sha256: digest("verdict.json"), criterionIds: ["c-3"] },
      { path: "qa/D-PACKAGE/artifact-identity.json", kind: "artifact-identity", sha256: digest("artifact-identity.json"), criterionIds: ["c-3"] },
    ] };
  const rel = writeReceipt(cwd, "qa-receipt.json", receipt);
  return { rel, dir, receipt };
}

test("validated manifest rechecks linked verdict and identity bytes", () => {
  const cwd = workspace();
  const { rel, dir } = manifestFixture(cwd);
  const parsed = parseSourceBoundReceipt(rel, cwd, "qa");
  assert.ok(!isReceiptError(parsed), JSON.stringify(parsed));
  assert.deepEqual(parsed.artifactManifest?.[1].criterionIds, ["c-3"]);
  writeFileSync(join(dir, "artifact-identity.json"), "changed");
  const changed = parseSourceBoundReceipt(rel, cwd, "qa");
  assert.ok(isReceiptError(changed));
  assert.match(changed.error, /digest does not match/);
});

test("legacy QA receipt without manifest remains readable", () => {
  const cwd = workspace();
  const rel = writeReceipt(cwd, "legacy.json", { kind: "qa", sourceIdentity: IDENTITY, createdAt: IDENTITY.capturedAt });
  const parsed = parseSourceBoundReceipt(rel, cwd, "qa");
  assert.ok(!isReceiptError(parsed));
  assert.equal(parsed.artifactManifest, undefined);
});

test("manifest rejects malformed paths, hashes, kinds and criterion metadata", () => {
  const changes: Array<(receipt: Record<string, unknown>) => void> = [
    (r) => { (r.artifactManifest as Record<string, unknown>[])[0].path = "../outside/verdict.json"; },
    (r) => { (r.artifactManifest as Record<string, unknown>[])[0].sha256 = "BAD"; },
    (r) => { (r.artifactManifest as Record<string, unknown>[])[0].kind = "artifact-identity"; },
    (r) => { (r.artifactManifest as Record<string, unknown>[])[1].criterionIds = ["c-4"]; },
    (r) => { (r.artifactManifest as Record<string, unknown>[])[1].criterionIds = ["c-3", "c-3"]; },
    (r) => { (r.artifactManifest as Record<string, unknown>[])[1].path = "qa/D-PACKAGE/missing/artifact-identity.json"; },
    (r) => { (r.artifactManifest as Record<string, unknown>[]).pop(); },
  ];
  for (const change of changes) {
    const cwd = workspace();
    const { rel, receipt } = manifestFixture(cwd);
    change(receipt);
    writeFileSync(join(cwd, rel), JSON.stringify(receipt));
    assert.ok(isReceiptError(parseSourceBoundReceipt(rel, cwd, "qa")), String(change));
  }
});

test("manifest refuses a direct symlink and an escaping parent", (t) => {
  if (!supportsSymlinks().file || !supportsSymlinks().dir) { t.skip("symlinks unavailable"); return; }
  const cwd = workspace();
  const { rel, dir } = manifestFixture(cwd);
  const outside = mkdtempSync(join(tmpdir(), "cxc-manifest-outside-"));
  const identity = join(dir, "artifact-identity.json");
  writeFileSync(join(outside, "artifact-identity.json"), readFileSync(identity));
  unlinkSync(identity);
  symlinkSync(join(outside, "artifact-identity.json"), identity);
  const direct = parseSourceBoundReceipt(rel, cwd, "qa");
  assert.ok(isReceiptError(direct));
  assert.match(direct.error, /symlink/);
  const cwd2 = workspace();
  const fixture = manifestFixture(cwd2);
  const parentOutside = mkdtempSync(join(tmpdir(), "cxc-manifest-parent-"));
  writeFileSync(join(parentOutside, "artifact-identity.json"), readFileSync(join(fixture.dir, "artifact-identity.json")));
  const linked = join(fixture.dir, "linked");
  symlinkDirSync(parentOutside, linked);
  const data = fixture.receipt.artifactManifest as Record<string, unknown>[];
  data[1].path = "qa/D-PACKAGE/linked/artifact-identity.json";
  writeFileSync(join(cwd2, fixture.rel), JSON.stringify(fixture.receipt));
  const escaped = parseSourceBoundReceipt(fixture.rel, cwd2, "qa");
  assert.ok(isReceiptError(escaped));
  assert.match(escaped.error, /outside the evidence root/);
});

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
