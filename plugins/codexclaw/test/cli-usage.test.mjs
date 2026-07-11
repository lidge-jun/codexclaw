import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const cli = join(repoRoot, "bin", "codexclaw.mjs");

test("top-level CLI usage advertises disable", () => {
  const out = execFileSync("node", [cli, "help"], { cwd: repoRoot, encoding: "utf8" });
  assert.match(out, /disable \| uninstall/);
  assert.match(out, /PABCD \/ loop/);
  assert.match(out, /cxc orchestrate --help/);
});

test("top-level CLI help flags render multi-section help", () => {
  for (const flag of ["--help", "-h"]) {
    const res = spawnSync("node", [cli, flag], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage:/);
    assert.match(res.stdout, /orchestrate <verb>/);
    assert.match(res.stdout, /chat search/);
    assert.match(res.stdout, /skill search\|show/);
  }
});

test("top-level CLI unknown command fails with recovery hint", () => {
  const res = spawnSync("node", [cli, "nope"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /unknown command 'nope'/);
  assert.match(res.stderr, /cxc --help/);
});

test("top-level CLI delegates orchestrate help", () => {
  const res = spawnSync("node", [cli, "orchestrate", "--help"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /cxc orchestrate/);
  assert.match(res.stdout, /Mutating verbs/);
});
