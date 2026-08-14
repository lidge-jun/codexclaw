// Shipped skill-catalog and public badge synchronization.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const skillsDir = join(pluginRoot, "skills");
const skillsReadme = join(skillsDir, "README.md");

function shippedSkillFolders() {
  return readdirSync(skillsDir)
    .filter((name) => {
      const dir = join(skillsDir, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"));
    })
    .sort();
}

function catalogFolders() {
  const body = readFileSync(skillsReadme, "utf8");
  const match = body.match(
    /<!-- skill-catalog:start -->\n([\s\S]*?)\n<!-- skill-catalog:end -->/,
  );
  assert.ok(match, "skills/README.md is missing the machine-checked catalog block");

  const entries = match[1]
    .split("\n")
    .map((line) => /^- `([a-z0-9][a-z0-9-]*)\/`$/.exec(line.trim())?.[1] ?? null)
    .filter((name) => name !== null);

  assert.equal(
    entries.length,
    match[1].split("\n").filter((line) => line.trim()).length,
    "catalog block contains a line that is not a folder entry",
  );
  return entries;
}

function badgeCount(body, kind) {
  const match = body.match(new RegExp(`img\\.shields\\.io/badge/${kind}-(\\d+)-`));
  assert.ok(match, `README badge for ${kind} is missing or not numeric`);
  return Number(match[1]);
}

test("shipped skill catalog is sorted and contains no duplicates", () => {
  const catalog = catalogFolders();
  assert.deepEqual(catalog, [...new Set(catalog)].sort());
});

test("shipped skill catalog exactly matches on-disk SKILL.md folders", () => {
  assert.deepEqual(catalogFolders(), shippedSkillFolders());
});

test("top-level README skill and hook badges match the shipped payload", () => {
  const skillCount = shippedSkillFolders().length;
  const manifest = JSON.parse(
    readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
  );
  assert.ok(Array.isArray(manifest.hooks), "plugin manifest hooks must be an array");

  const body = readFileSync(join(repoRoot, "README.md"), "utf8");
  assert.equal(badgeCount(body, "skills"), skillCount, "README.md skill badge drift");
  assert.equal(
    badgeCount(body, "hooks"),
    manifest.hooks.length,
    "README.md hook badge drift",
  );
});
