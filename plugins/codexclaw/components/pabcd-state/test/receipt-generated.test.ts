/**
 * receipt-generated.test.ts — issue #49: `receipt test` refused to write a receipt
 * when the check command dirtied the tree, even though the dirty files were the
 * artifacts the check exists to rebuild.
 *
 * Reported consequence: the agent committed the generated files and ran
 * `cxc receipt test -- test -f ...`, a no-op existence check, to get past D. A
 * forged receipt is strictly worse than a loose one — it defeats CHECK-BINDING-01
 * while looking like it satisfied it.
 *
 * The fix is DECLARED, not inferred: an undeclared rewrite is still refused.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { captureSourceIdentity, compareSource } from "../src/source-identity.ts";
import { parseReceiptCliArgs } from "../src/receipt-cli.ts";

function repoWithGeneratedFile(): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-gen-"));
  const git = (...a: string[]) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "build", "graph.json"), '{"nodes":0}');
  writeFileSync(join(root, "src.txt"), "source");
  git("add", "-A");
  git("commit", "-qm", "init");
  return root;
}

test("a declared generated path does not count as a source change", () => {
  const root = repoWithGeneratedFile();
  try {
    const opts = { excludeCodexclawArtifacts: true, generatedPaths: ["build"] };
    const before = captureSourceIdentity(root, opts);
    writeFileSync(join(root, "build", "graph.json"), '{"nodes":999}');
    const after = captureSourceIdentity(root, opts);
    assert.equal(compareSource(before, after).kind, "same");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an UNdeclared rewrite is still a source change", () => {
  const root = repoWithGeneratedFile();
  try {
    const opts = { excludeCodexclawArtifacts: true, generatedPaths: ["build"] };
    const before = captureSourceIdentity(root, opts);
    // src.txt was never declared — this must still be caught.
    writeFileSync(join(root, "src.txt"), "rewritten");
    const after = captureSourceIdentity(root, opts);
    assert.equal(compareSource(before, after).kind, "different");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("declaring the wrong path does not launder a real change", () => {
  const root = repoWithGeneratedFile();
  try {
    const opts = { excludeCodexclawArtifacts: true, generatedPaths: ["docs"] };
    const before = captureSourceIdentity(root, opts);
    writeFileSync(join(root, "build", "graph.json"), '{"nodes":999}');
    const after = captureSourceIdentity(root, opts);
    assert.equal(compareSource(before, after).kind, "different");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a file path declares exactly that file, not its siblings", () => {
  const root = repoWithGeneratedFile();
  try {
    const opts = { excludeCodexclawArtifacts: true, generatedPaths: ["build/graph.json"] };
    const before = captureSourceIdentity(root, opts);
    writeFileSync(join(root, "build", "graph.json"), '{"nodes":1}');
    assert.equal(compareSource(before, captureSourceIdentity(root, opts)).kind, "same");
    writeFileSync(join(root, "build", "other.json"), "{}");
    assert.equal(compareSource(before, captureSourceIdentity(root, opts)).kind, "different");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--generated is repeatable and normalizes separators", () => {
  const args = parseReceiptCliArgs(
    ["test", "--session", "s1", "--generated", "build", "--generated", ".\\docs\\api", "--", "npm", "test"],
    "/unused",
  );
  assert.ok(!("error" in args));
  assert.deepEqual((args as { generated?: string[] }).generated, ["build", "docs/api"]);
  assert.deepEqual((args as { command: string[] }).command, ["npm", "test"]);
});

test("--generated without a value is a parse error, not a silent skip", () => {
  const args = parseReceiptCliArgs(["test", "--session", "s1", "--generated"], "/unused");
  assert.ok("error" in args);
  assert.match((args as { error: string }).error, /--generated needs a repo-relative path/);
});
