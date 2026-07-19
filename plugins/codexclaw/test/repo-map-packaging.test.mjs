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
import { fileURLToPath, pathToFileURL } from "node:url";

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

test("dispatcher bootstrap ladder: help bypass, env override, uv rung, venv rung, -B everywhere", async () => {
  const mod = await import(pathToFileURL(join(repoRoot, "bin", "codexclaw.mjs")).href + "?ladder");
  const { selectRepoMapCommand, repoMapVenvPython } = mod;
  const deps = {
    scriptPath: "/s/repomap.py",
    reqsPath: "/s/requirements.txt",
    venvPython: "/h/.codexclaw/venvs/repomap/bin/python3",
    hasUv: true,
    hasVenv: true,
  };
  // Rung 0: --help stays dep-free bare python even with uv+venv available.
  const help = selectRepoMapCommand(["--help"], {}, deps);
  assert.equal(help.cmd, "python3");
  assert.ok(help.args.includes("-B"));
  // Rung 1: env override beats uv and venv.
  const envSel = selectRepoMapCommand(["."], { CODEXCLAW_PYTHON: "/opt/py" }, deps);
  assert.equal(envSel.cmd, "/opt/py");
  assert.ok(envSel.args.includes("-B"));
  // Rung 2: uv run with pinned requirements.
  const uvSel = selectRepoMapCommand(["."], {}, deps);
  assert.equal(uvSel.cmd, "uv");
  assert.ok(uvSel.args.includes("--with-requirements"));
  assert.ok(uvSel.args.includes("/s/requirements.txt"));
  assert.ok(uvSel.args.includes("-B"));
  // Rung 3: venv python when uv absent.
  const venvSel = selectRepoMapCommand(["."], {}, { ...deps, hasUv: false });
  assert.equal(venvSel.cmd, deps.venvPython);
  assert.ok(venvSel.args.includes("-B"));
  // Rung 4: bare python3 fallback (repomap.py degrades to exit-3 hint).
  const bare = selectRepoMapCommand(["."], {}, { ...deps, hasUv: false, hasVenv: false });
  assert.equal(bare.cmd, "python3");
  assert.ok(bare.args.includes("-B"));
  // Venv location honors CODEXCLAW_HOME and defaults under ~/.codexclaw.
  assert.equal(repoMapVenvPython({}, "/h"), "/h/.codexclaw/venvs/repomap/bin/python3");
  assert.equal(
    repoMapVenvPython({ CODEXCLAW_HOME: "/custom" }, "/h"),
    "/custom/venvs/repomap/bin/python3",
  );
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
