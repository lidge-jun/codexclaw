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
  // 260714 wp2: plan scaffold verb rides the PABCD/loop section.
  assert.match(out, /plan init <slug> \[--phases N\]/);
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

// #47: the top-level help points at the sibling commands, and following that
// pointer failed — --help was an unknown verb on loop/scan/receipt, and
// --version was an unknown command. These run the REAL binary, because the
// defect was in the argv dispatch rather than in any parser under test.
// 260829 wp5: `config` joins the contract — it is a new verb with nested subcommands,
// which is exactly the shape most likely to exit 2 on --help unnoticed.
for (const command of ["loop", "scan", "receipt", "config"]) {
  test(`${command} --help exits 0 with usage, like orchestrate`, () => {
    for (const flag of ["--help", "-h"]) {
      const res = spawnSync("node", [cli, command, flag], { cwd: repoRoot, encoding: "utf8" });
      assert.equal(res.status, 0, `${command} ${flag} exited ${res.status}: ${res.stderr}`);
      assert.match(res.stdout, /Usage:/);
      assert.match(res.stdout, new RegExp(`cxc ${command}`));
    }
  });
}

// There are TWO entry points — bin/codexclaw.mjs and plugins/codexclaw/bin/cxc.mjs —
// and fixing only one is exactly the mistake this case exists to catch.
test("--version prints the plugin version from both entry points", () => {
  const entries = [cli, join(repoRoot, "plugins", "codexclaw", "bin", "cxc.mjs")];
  for (const entry of entries) {
    for (const flag of ["--version", "-v", "version"]) {
      const res = spawnSync("node", [entry, flag], { cwd: repoRoot, encoding: "utf8" });
      assert.equal(res.status, 0, `${entry} ${flag} exited ${res.status}: ${res.stderr}`);
      assert.match(res.stdout.trim(), /^\d+\.\d+\.\d+/);
    }
  }
});

test("top-level CLI delegates orchestrate help", () => {
  const res = spawnSync("node", [cli, "orchestrate", "--help"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /cxc orchestrate/);
  assert.match(res.stdout, /Mutating verbs/);
});
