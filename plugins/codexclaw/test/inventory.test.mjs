// Inventory source-of-truth generator: set-based drift detection.
//
// The old gate compared cardinality only, so an equal-count manifest substitution
// passed a green gate. Each fixture below drives one drift class and asserts the
// specific violation text, so a check that silently stops observing fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyBlocks,
  canonicalJson,
  check,
  checkSets,
  collectInventory,
  inventoryHash,
  readPublished,
} from "../scripts/inventory.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

// Copy the payload plus repo-root docs into a scratch tree we can safely corrupt.
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), "cxc-inventory-"));
  const plugin = join(dir, "plugins", "codexclaw");
  cpSync(pluginRoot, plugin, { recursive: true });
  for (const f of ["README.md", "README.ko.md", "README.zh.md", "package.json"]) {
    cpSync(join(repoRoot, f), join(dir, f));
  }
  return { dir, plugin };
}

function manifestPath(plugin) {
  return join(plugin, ".codex-plugin", "plugin.json");
}

function patchManifest(plugin, fn) {
  const p = manifestPath(plugin);
  const json = JSON.parse(readFileSync(p, "utf8"));
  fn(json);
  writeFileSync(p, JSON.stringify(json, null, 2));
}

test("clean tree: sets agree and check passes", () => {
  const result = check({ pluginRoot, repoRoot });
  assert.equal(
    result.ok,
    true,
    "expected a clean tree to pass, got: " + result.violations.join(" | "),
  );
});

test("inventory stores identities, never a commit sha or test count", () => {
  const inv = collectInventory(pluginRoot, repoRoot);
  const serialized = canonicalJson(inv);
  assert.equal(inv.tests, undefined, "inventory must not carry a test count");
  assert.equal(inv.generatedFrom, undefined, "inventory must not carry commit provenance");
  assert.ok(!/"(commit|sha|measuredCommit|measuredAt)"/.test(serialized));
  assert.equal(inv.skillCount, undefined);
  assert.equal(inv.hookCount, undefined);
  assert.ok(inv.skills.length > 0 && inv.hooks.length > 0 && inv.components.length > 0);
});

test("hook file on disk but absent from the manifest is a violation", () => {
  const { dir, plugin } = scratch();
  try {
    cpSync(
      join(plugin, "hooks", "stop-checking-pabcd-continuation.json"),
      join(plugin, "hooks", "zz-drift-fixture.json"),
    );
    const { ok, violations } = checkSets(plugin, dir);
    assert.equal(ok, false);
    assert.ok(
      violations.some((v) => v.includes("not declared in manifest: zz-drift-fixture.json")),
      violations.join(" | "),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manifest declaring a missing hook file is a violation", () => {
  const { dir, plugin } = scratch();
  try {
    patchManifest(plugin, (j) => j.hooks.push("./hooks/nonexistent-ghost.json"));
    const { ok, violations } = checkSets(plugin, dir);
    assert.equal(ok, false);
    assert.ok(
      violations.some((v) => v.includes("missing on disk: nonexistent-ghost.json")),
      violations.join(" | "),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("equal-count manifest substitution is caught (the cardinality gate missed it)", () => {
  const { dir, plugin } = scratch();
  try {
    const before = JSON.parse(readFileSync(manifestPath(plugin), "utf8")).hooks.length;
    patchManifest(plugin, (j) => {
      const i = j.hooks.indexOf("./hooks/stop-checking-pabcd-continuation.json");
      j.hooks[i] = "./hooks/session-start-bootstrapping-pabcd-state.json";
    });
    const after = JSON.parse(readFileSync(manifestPath(plugin), "utf8")).hooks.length;
    assert.equal(after, before, "fixture must keep the count identical to be meaningful");

    const { ok, violations } = checkSets(plugin, dir);
    assert.equal(ok, false, "equal-count substitution must not pass");
    assert.ok(
      violations.some((v) => v.startsWith("duplicate manifest hook entries:")),
      violations.join(" | "),
    );
    assert.ok(
      violations.some((v) =>
        v.includes("not declared in manifest: stop-checking-pabcd-continuation.json"),
      ),
      violations.join(" | "),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("published counts disagreeing across surfaces is an error", () => {
  const { dir } = scratch();
  try {
    const p = join(dir, "README.ko.md");
    writeFileSync(p, readFileSync(p, "utf8").replace("badge/skills-28-", "badge/skills-27-"));
    const { violations } = readPublished(dir);
    assert.ok(
      violations.some((v) => v.startsWith("skills disagrees across surfaces:")),
      violations.join(" | "),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyBlocks rewrites a stale badge and reports the drifted file", () => {
  const { dir } = scratch();
  try {
    const p = join(dir, "README.md");
    writeFileSync(p, readFileSync(p, "utf8").replace("badge/hooks-23-", "badge/hooks-18-"));
    const inv = collectInventory(pluginRoot, dir);
    const drifted = applyBlocks(inv, { write: false, repoRoot: dir });
    assert.deepEqual(drifted, ["README.md"]);
    applyBlocks(inv, { write: true, repoRoot: dir });
    assert.match(readFileSync(p, "utf8"), /badge\/hooks-23-/);
    assert.deepEqual(applyBlocks(inv, { write: false, repoRoot: dir }), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("inventory hash is stable and changes with content", () => {
  const inv = collectInventory(pluginRoot, repoRoot);
  const h1 = inventoryHash(inv);
  assert.match(h1, /^sha256:[0-9a-f]{64}$/);
  assert.equal(h1, inventoryHash(collectInventory(pluginRoot, repoRoot)));
  const mutated = { ...inv, skills: inv.skills.slice(0, -1) };
  assert.notEqual(h1, inventoryHash(mutated));
});

// The tests badge is the only published count that cannot be derived from the payload,
// so readPublished() can only prove the three READMEs agree with EACH OTHER. A wrong
// value written to all three is self-consistent and passed the old check: that is how
// 2,026 survived three releases and surfaced as a release-gate blocker instead of a CI
// failure. check({ expectedTests }) is the comparison against a real measurement.
function rewriteTestsBadge(dir, count) {
  const pretty = count.toLocaleString("en-US").replace(/,/g, "%2C");
  for (const f of ["README.md", "README.ko.md", "README.zh.md"]) {
    const p = join(dir, f);
    const body = readFileSync(p, "utf8").replace(
      /(badge\/tests-)([\d%C,]+)(_passing)/g,
      (_m, a, _b, c) => a + pretty + c,
    );
    writeFileSync(p, body);
  }
}

test("a self-consistent but wrong tests badge fails against a measured total", () => {
  const { dir, plugin } = scratch();
  try {
    rewriteTestsBadge(dir, 1234);

    // Premise: the mutation is invisible to the surface-agreement check, so the
    // assertion below cannot pass through the pre-existing violation.
    const { counts, violations } = readPublished(dir);
    assert.equal(counts.tests, 1234);
    assert.deepEqual(violations, [], "all three surfaces must still agree");

    const bare = check({ pluginRoot: plugin, repoRoot: dir });
    assert.equal(bare.ok, true, "bare check must ignore the tests count: " + bare.violations.join(" | "));

    const measured = check({ pluginRoot: plugin, repoRoot: dir, expectedTests: 4321 });
    assert.equal(measured.ok, false);
    assert.ok(
      measured.violations.some((v) =>
        v.includes("published tests=1234") && v.includes("measured suite reported 4321"),
      ),
      measured.violations.join(" | "),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a tests badge equal to the measured total passes", () => {
  const { dir, plugin } = scratch();
  try {
    rewriteTestsBadge(dir, 4321);
    const result = check({ pluginRoot: plugin, repoRoot: dir, expectedTests: 4321 });
    assert.equal(result.ok, true, result.violations.join(" | "));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
