/**
 * repo-map-smoke.test.mjs — fixture smoke run for `cxc map` (260706_repo_map).
 *
 * Runs the vendored RepoMapper against tiny TS/Python/Rust fixtures and asserts the
 * known symbols surface in the ranked map. Skips cleanly when the optional Python
 * deps are not installed (the tool itself degrades to an install hint).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const fixturesDir = join(here, "fixtures", "repo-map");
const python = process.env.CODEXCLAW_PYTHON || "python3";

function depsAvailable() {
  // Mirror the dispatcher bootstrap ladder: uv makes deps resolvable on demand,
  // otherwise the interpreter itself must already have the imports.
  if (!spawnSync("uv", ["--version"], { stdio: "ignore" }).error) return true;
  const res = spawnSync(python, ["-c", "import grep_ast, networkx, diskcache"], { encoding: "utf8" });
  return res.status === 0;
}

test("cxc map surfaces fixture symbols across TS/Python/Rust", (t) => {
  if (process.env.CODEXCLAW_SKIP_REPOMAP_SMOKE === "1") {
    t.skip("CODEXCLAW_SKIP_REPOMAP_SMOKE=1 (CI runners preinstall uv; avoid live dependency resolve)");
    return;
  }
  if (!depsAvailable()) {
    t.skip("python deps not installed; cxc map degrades to install hint");
    return;
  }
  const cacheDir = mkdtempSync(join(tmpdir(), "repomap-cache-"));
  try {
    const res = spawnSync(
      process.execPath,
      [join(repoRoot, "bin", "codexclaw.mjs"), "map", fixturesDir, "--budget", "1024"],
      { encoding: "utf8", cwd: repoRoot, env: { ...process.env, CODEXCLAW_REPOMAP_CACHE: cacheDir } },
    );
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /alphaFn/);
    assert.match(res.stdout, /gamma_helper/);
    assert.match(res.stdout, /epsilon_run/);
    const strays = readdirSync(repoRoot).filter((f) => f.startsWith(".repomap.tags.cache"));
    assert.deepEqual(strays, [], "stray upstream cache dir created in cwd");
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
});
