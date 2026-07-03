/**
 * packaging.test.mjs — L19 (E8) dist packaging contract.
 *
 * The codexclaw package is `private: true` and ships by repo clone/symlink: the Codex
 * plugin loads each component's compiled dist cli/mcp entry directly, so the committed
 * repo IS the install artifact. `.gitignore` ignores dist wholesale and runtime files are
 * force-added; this test fails if any dist file transitively loaded by a runtime
 * entrypoint is NOT git-tracked (i.e. would be missing from a fresh clone).
 *
 * Entrypoint roots (Aquinas A-gate, 2026-06-30): every dist file Codex executes directly.
 *  - the 5 component cli.js entries (bin/codexclaw.mjs spawns these; hooks invoke pabcd-state
 *    + provider-bridge cli.js)
 *  - subagent-config mcp.js (.mcp.json MCP server entry)
 * pabcd-state hook.js is reached transitively from cli.js, not a direct root.
 * rescan-coordinator.js is intentionally NOT a runtime file (L17 directive-reachable helper),
 * so it must NOT appear in the runtime graph — if it ever does, this test will demand it ship.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

/** Runtime entrypoint dist files Codex executes directly. */
const ENTRYPOINTS = [
  "components/config-guard/dist/cli.js",
  "components/cxc-ops/dist/cli.js",
  "components/messenger-bridge/dist/cli.js",
  "components/pabcd-state/dist/cli.js",
  "components/provider-bridge/dist/cli.js",
  "components/recall/dist/cli.js",
  "components/subagent-config/dist/cli.js",
  "components/subagent-config/dist/mcp.js",
].map((p) => join(pluginRoot, p));

/** Whole-file scan for static relative import/export specifiers (multi-line safe). */
function relativeSpecifiers(text) {
  const out = new Set();
  // matches: import ... from "./x.js" | export ... from "./x.js" | import("./x.js")
  const re = /(?:from|import)\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

/** Transitively resolve every dist file reachable from the entrypoints. */
function resolveRuntimeGraph(entrypoints) {
  const seen = new Set();
  const stack = [...entrypoints];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    if (!existsSync(file)) {
      throw new Error(`runtime graph references a missing file: ${file}`);
    }
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const spec of relativeSpecifiers(text)) {
      stack.push(resolve(dirname(file), spec));
    }
  }
  return seen;
}

function isTracked(absPath) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", relative(repoRoot, absPath)], {
      cwd: repoRoot, stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

test("L19: every runtime entrypoint dist file exists", () => {
  for (const ep of ENTRYPOINTS) {
    assert.ok(existsSync(ep), `missing runtime entrypoint: ${relative(repoRoot, ep)}`);
  }
});

test("L19: every dist file reachable from a runtime entrypoint is git-tracked (ships on clone)", () => {
  const graph = resolveRuntimeGraph(ENTRYPOINTS);
  const untracked = [...graph].filter((f) => !isTracked(f)).map((f) => relative(repoRoot, f)).sort();
  assert.deepEqual(untracked, [], `untracked runtime dist files (would be missing from a fresh clone):\n${untracked.join("\n")}`);
});

test("L19: the runtime graph reaches the known transitive modules (walker sanity)", () => {
  const graph = new Set([...resolveRuntimeGraph(ENTRYPOINTS)].map((f) => relative(pluginRoot, f)));
  // hook.js is reached via pabcd-state/dist/cli.js; interview-ledger via hook.js.
  assert.ok(graph.has("components/pabcd-state/dist/hook.js"), "hook.js must be in the runtime graph");
  assert.ok(graph.has("components/pabcd-state/dist/interview-ledger.js"), "interview-ledger.js must be reached");
  assert.ok(graph.has("components/pabcd-state/dist/orchestrate-cli.js"), "orchestrate-cli.js must be reached");
});
