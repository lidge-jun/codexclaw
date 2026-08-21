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
  // Pinned to linux: the win32 shape of this rung is asserted in the wp06 case below.
  const help = selectRepoMapCommand(["--help"], {}, deps, "linux");
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
  const bare = selectRepoMapCommand(["."], {}, { ...deps, hasUv: false, hasVenv: false }, "linux");
  assert.equal(bare.cmd, "python3");
  assert.ok(bare.args.includes("-B"));
  // Venv location honors CODEXCLAW_HOME and defaults under ~/.codexclaw.
  // Expected paths are built with join() to match the platform output of the
  // production helper (win32 join() yields backslash separators).
  assert.equal(
    repoMapVenvPython({}, "/h", "linux"),
    join("/h", ".codexclaw", "venvs", "repomap", "bin", "python3"),
  );
  assert.equal(
    repoMapVenvPython({ CODEXCLAW_HOME: "/custom" }, "/h", "linux"),
    join("/custom", "venvs", "repomap", "bin", "python3"),
  );
});

test("wp06: the venv interpreter is Scripts\\python.exe on win32 and bin/python3 on linux", async () => {
  const mod = await import(pathToFileURL(join(repoRoot, "bin", "codexclaw.mjs")).href + "?venv-shape");
  const { repoMapVenvPython } = mod;
  // Windows venvs never lay down bin/python3. With the POSIX-only path, hasVenv was
  // always false on Windows, so a CODEXCLAW_MAP_BOOTSTRAP=1 run built a venv, missed
  // its pip, and rmSync'd the venv it had just created.
  assert.equal(
    repoMapVenvPython({}, "/h", "win32"),
    join("/h", ".codexclaw", "venvs", "repomap", "Scripts", "python.exe"),
  );
  assert.equal(
    repoMapVenvPython({ CODEXCLAW_HOME: "/custom" }, "/h", "win32"),
    join("/custom", "venvs", "repomap", "Scripts", "python.exe"),
  );
  assert.equal(
    repoMapVenvPython({}, "/h", "linux"),
    join("/h", ".codexclaw", "venvs", "repomap", "bin", "python3"),
  );
  // runRepoMap derives venvDir as dirname(dirname(venvPython)); both shapes must
  // still point at .../venvs/repomap so the bootstrap writes the right directory.
  for (const platform of ["win32", "linux"]) {
    const py = repoMapVenvPython({}, "/h", platform);
    assert.equal(dirname(dirname(py)), join("/h", ".codexclaw", "venvs", "repomap"));
  }
});

test("wp06: the final interpreter rung is py -3 on win32 and python3 on linux", async () => {
  const mod = await import(pathToFileURL(join(repoRoot, "bin", "codexclaw.mjs")).href + "?py-rung");
  const { selectRepoMapCommand } = mod;
  const deps = {
    scriptPath: "/s/repomap.py",
    reqsPath: "/s/requirements.txt",
    venvPython: "/h/.codexclaw/venvs/repomap/bin/python3",
    hasUv: false,
    hasVenv: false,
  };
  // Bare "python3" on Windows is the Microsoft Store stub: a real executable that
  // exits 9009 without running Python, so it never surfaces as ENOENT.
  const win = selectRepoMapCommand(["."], {}, deps, "win32");
  assert.equal(win.cmd, "py");
  assert.deepEqual(win.args.slice(0, 3), ["-3", "-B", "/s/repomap.py"]);

  const linux = selectRepoMapCommand(["."], {}, deps, "linux");
  assert.equal(linux.cmd, "python3");
  assert.ok(linux.args.includes("-B"));
  assert.ok(!linux.args.includes("-3"), "the py launcher flag must not leak onto POSIX");

  // The env override still outranks the py rung on win32.
  const override = selectRepoMapCommand(["."], { CODEXCLAW_PYTHON: "C:\\py\\python.exe" }, deps, "win32");
  assert.equal(override.cmd, "C:\\py\\python.exe");

  // --help stays dep-free on both platforms, and stays runnable on win32.
  assert.equal(selectRepoMapCommand(["--help"], {}, deps, "linux").cmd, "python3");
  assert.equal(selectRepoMapCommand(["--help"], {}, deps, "win32").cmd, "py");
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
