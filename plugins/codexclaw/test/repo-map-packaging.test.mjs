/**
 * repo-map-packaging.test.mjs — vendored RepoMapper packaging contract (260706_repo_map).
 *
 * The repo-map skill ships a vendored Python script (no TS component, no dist build).
 * This test pins the vendoring contract: required files present, attribution intact,
 * no server file (philosophy no-server rule), load-bearing dependency pins, and a
 * dep-free `cxc map --help` (lazy imports keep argparse reachable without deps).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const skillDir = join(pluginRoot, "skills", "repo-map");
const scriptsDir = join(skillDir, "scripts");

test("vendored python modules exist", () => {
  for (const f of ["repomap.py", "repomap_class.py", "importance.py", "scm.py", "utils.py"]) {
    assert.ok(existsSync(join(scriptsDir, f)), `missing scripts/${f}`);
  }
});

test("MIT license and attribution notice are present", () => {
  const license = readFileSync(join(scriptsDir, "LICENSE"), "utf8");
  assert.match(license, /MIT/);
  const notice = readFileSync(join(scriptsDir, "NOTICE.md"), "utf8");
  assert.match(notice, /RepoMapper/);
  assert.match(notice, /Aider/);
});

test("requirements pin the working parser stack and exclude fastmcp", () => {
  const reqs = readFileSync(join(scriptsDir, "requirements.txt"), "utf8");
  assert.doesNotMatch(reqs, /fastmcp/);
  assert.match(reqs, /tree-sitter-language-pack==0\.9\.0/);
  assert.match(reqs, /tree-sitter==0\.25\.1/);
  assert.match(reqs, /grep-ast==0\.9\.0/);
});

test("no server file is vendored (no-server philosophy)", () => {
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else assert.notEqual(entry, "repomap_server.py", `server file vendored at ${p}`);
    }
  };
  walk(skillDir);
});

test("tags queries cover the fixture-verified languages", () => {
  const queryDirs = [
    join(scriptsDir, "queries", "tree-sitter-language-pack"),
    join(scriptsDir, "queries", "tree-sitter-languages"),
  ].filter(existsSync);
  assert.ok(queryDirs.length > 0, "no queries dirs vendored");
  const all = queryDirs.flatMap((d) => readdirSync(d));
  for (const scm of ["typescript-tags.scm", "python-tags.scm", "rust-tags.scm"]) {
    assert.ok(all.includes(scm), `missing ${scm} in vendored queries`);
  }
});

test("cxc map --help exits 0 without python deps", () => {
  const res = spawnSync(process.execPath, [join(repoRoot, "bin", "codexclaw.mjs"), "map", "--help"], {
    encoding: "utf8",
  });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /usage/i);
  assert.match(res.stdout, /cxc map/, "help text must name the real entry point");
  assert.ok(
    !existsSync(join(scriptsDir, "__pycache__")),
    "map run must not write __pycache__ into the vendored skill dir (-B guard)",
  );
});

test("dispatcher spawns python with -B (no bytecode in vendored dir)", () => {
  const dispatcher = readFileSync(join(repoRoot, "bin", "codexclaw.mjs"), "utf8");
  assert.match(dispatcher, /spawnSync\(python, \["-B", repoMapScript/, "runRepoMap must pass -B");
});

test("find_src_files skips compiled-output dirs", () => {
  const script = readFileSync(join(scriptsDir, "repomap.py"), "utf8");
  for (const dir of ["'dist'", "'build'", "'target'", "'out'", "'coverage'"]) {
    assert.ok(script.includes(dir), `skip set must contain ${dir}`);
  }
});

test("skill manifest surface is present and bounded", () => {
  const skillMd = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  assert.ok(skillMd.split("\n").length <= 500, "SKILL.md exceeds 500 lines");
  assert.ok(existsSync(join(skillDir, "agents", "openai.yaml")), "agents/openai.yaml missing");
});
