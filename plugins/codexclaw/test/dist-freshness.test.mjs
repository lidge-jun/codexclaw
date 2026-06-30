// dist-freshness.test.mjs - F1 (L20-WP10). Proves the COMMITTED dist/ matches the
// CURRENT src/ without running a build. build.test.mjs only proves post-build
// idempotency (build twice -> identical), which says nothing about whether the dist
// a fresh clone ships is in sync with src. Here we recompute each expected dist file
// in-memory via build.mjs's pure `compileSource` and assert byte-equality with the
// committed file. A stale or missing committed dist file fails CI. This is read-only
// (no rmSync / no rebuild), so it is immune to the C10 shared-dist contention.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { COMPONENTS, componentsRoot, listTsFiles, compileSource } from "../scripts/build.mjs";

// The committed install artifact is the set of git-TRACKED dist files (dist is
// gitignored wholesale, runtime files force-added; e.g. rescan-coordinator.js is
// intentionally untracked). Freshness is only meaningful for files that actually ship,
// so we gate on tracked status.
function isTracked(absPath) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", absPath], { stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

test("F1: committed dist/ is in sync with src/ (no stale or missing compiled file)", () => {
  const stale = [];
  const missing = [];
  let checked = 0;
  for (const name of COMPONENTS) {
    const srcDir = join(componentsRoot, name, "src");
    if (!existsSync(srcDir)) continue;
    for (const srcFile of listTsFiles(srcDir).sort()) {
      const rel = relative(srcDir, srcFile).replace(/\.ts$/, ".js");
      const distFile = join(componentsRoot, name, "dist", rel);
      // only hold TRACKED dist files to the freshness contract (untracked = doesn't ship)
      if (!isTracked(distFile)) continue;
      const expected = compileSource(readFileSync(srcFile, "utf8"));
      if (!existsSync(distFile)) {
        missing.push(`${name}/dist/${rel}`);
        continue;
      }
      if (readFileSync(distFile, "utf8") !== expected) {
        stale.push(`${name}/dist/${rel}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 0, "no tracked dist files were checked — freshness test would be a no-op");
  assert.deepEqual(missing, [], `committed dist files missing (run \`npm run build\` + commit dist):\n${missing.join("\n")}`);
  assert.deepEqual(stale, [], `committed dist files STALE vs src (run \`npm run build\` + commit dist):\n${stale.join("\n")}`);
});
