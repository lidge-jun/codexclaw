/**
 * check-gate-generated.test.ts — the #49 wiring gap.
 *
 * receipt-generated.test.ts proved captureSourceIdentity honours generatedPaths.
 * Nobody proved the C->D GATE passes them on. It did not: validateCheckReceipt
 * re-captured with { excludeCodexclawArtifacts: true } only, so a receipt captured
 * WITH an exclusion was compared against a tree captured WITHOUT it. While a
 * declared path kept changing, the edge was structurally unpassable — re-running
 * the check could never help, because the mismatch was in the comparison, not the tree.
 *
 * validateCheckReceipt had no test at all before this file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { captureSourceIdentity } from "../src/source-identity.ts";
import { validateCheckReceipt } from "../src/check-gate.ts";
import type { State } from "../src/state.ts";

const EPOCH = "c-20260829000000-testep";
const SESSION = "test-session-0001";

/** A repo with a tracked source file and a tracked generated artifact. */
function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-cg-"));
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

/** Write a receipt the way `cxc receipt test` does, into the evidence root. */
function writeReceipt(root: string, generatedPaths?: string[]): string {
  const dir = join(root, ".codexclaw", "evidence", SESSION);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "test-receipt.json");
  writeFileSync(
    path,
    JSON.stringify({
      kind: "test",
      sourceIdentity: captureSourceIdentity(root, {
        excludeCodexclawArtifacts: true,
        ...(generatedPaths ? { generatedPaths } : {}),
      }),
      command: "npm test",
      exitCode: 0,
      createdAt: new Date().toISOString(),
      ownerSessionId: SESSION,
      checkEpoch: EPOCH,
      ...(generatedPaths ? { generatedPaths } : {}),
    }),
  );
  return path;
}

function stateAtC(): State {
  // Only the two fields the gate reads; the cast keeps the fixture from tracking
  // every unrelated State field.
  return { phase: "C", checkEpoch: EPOCH } as unknown as State;
}

test("a declared generated path does not break the C->D gate when it keeps changing", () => {
  const root = repo();
  try {
    const receipt = writeReceipt(root, ["build"]);
    // The declared artifact moves AFTER the receipt was written — exactly what a
    // concurrently-regenerated artifact does.
    writeFileSync(join(root, "build", "graph.json"), '{"nodes":42}');
    const res = validateCheckReceipt(stateAtC(), SESSION, receipt, root);
    assert.equal(res.ok, true, res.ok ? "" : res.reason);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an UNdeclared change still fails the C->D gate", () => {
  const root = repo();
  try {
    const receipt = writeReceipt(root, ["build"]);
    writeFileSync(join(root, "src.txt"), "rewritten");
    const res = validateCheckReceipt(stateAtC(), SESSION, receipt, root);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reason, /source changed after the check ran/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a receipt with no generatedPaths keeps the strict behaviour", () => {
  const root = repo();
  try {
    const receipt = writeReceipt(root);
    writeFileSync(join(root, "build", "graph.json"), '{"nodes":42}');
    const res = validateCheckReceipt(stateAtC(), SESSION, receipt, root);
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unchanged tree passes whether or not paths are declared", () => {
  const root = repo();
  try {
    assert.equal(validateCheckReceipt(stateAtC(), SESSION, writeReceipt(root), root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("declaring a path cannot launder a change outside it", () => {
  const root = repo();
  try {
    // "docs" does not exist; the real change is in build/, so it must still be caught.
    const receipt = writeReceipt(root, ["docs"]);
    writeFileSync(join(root, "build", "graph.json"), '{"nodes":42}');
    const res = validateCheckReceipt(stateAtC(), SESSION, receipt, root);
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a malformed generatedPaths list degrades to no exclusions, not a rejection", () => {
  const root = repo();
  try {
    const dir = join(root, ".codexclaw", "evidence", SESSION);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "test-receipt.json");
    writeFileSync(
      path,
      JSON.stringify({
        kind: "test",
        sourceIdentity: captureSourceIdentity(root, { excludeCodexclawArtifacts: true }),
        command: "npm test",
        exitCode: 0,
        createdAt: new Date().toISOString(),
        ownerSessionId: SESSION,
        checkEpoch: EPOCH,
        generatedPaths: [42, "", null],
      }),
    );
    // Unchanged tree: the receipt is still usable, so a bad list did not reject it.
    assert.equal(validateCheckReceipt(stateAtC(), SESSION, path, root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
