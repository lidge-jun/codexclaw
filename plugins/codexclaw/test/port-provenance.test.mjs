// Port provenance manifest integrity (issue #8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const manifestPath = join(pluginRoot, "port-provenance.json");

function loadManifest() {
  const body = readFileSync(manifestPath, "utf8");
  return JSON.parse(body);
}

function shippedSkillFolders() {
  const skillsDir = join(pluginRoot, "skills");
  return readdirSync(skillsDir)
    .filter((name) => {
      const dir = join(skillsDir, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"));
    })
    .sort();
}

test("port-provenance.json is valid JSON with required schema", () => {
  const manifest = loadManifest();
  assert.ok(manifest.entries, "entries array is missing");
  assert.ok(Array.isArray(manifest.entries), "entries is not an array");
  assert.ok(manifest.entries.length > 0, "entries is empty");
});

test("every shipped skill folder has a provenance entry", () => {
  const manifest = loadManifest();
  const documented = manifest.entries.map((e) => e.skill).sort();
  const shipped = shippedSkillFolders();
  assert.deepEqual(documented, shipped, "provenance entries do not match shipped skills");
});

test("every entry has required fields and valid status", () => {
  const manifest = loadManifest();
  const validStatuses = ["adapted", "extension", "local-only", "deprecated-redirect"];
  for (const entry of manifest.entries) {
    assert.ok(entry.skill, "entry missing skill name");
    assert.ok(entry.destination, "entry " + entry.skill + " missing destination");
    assert.ok(validStatuses.includes(entry.status), entry.skill + " has invalid status: " + entry.status);
    if (entry.status === "deprecated-redirect") {
      assert.ok(entry.redirectTo, entry.skill + " is deprecated but missing redirectTo");
    }
    if (entry.status === "local-only") {
      assert.ok(entry.owner, entry.skill + " is local-only but missing owner");
    }
  }
});

test("every destination path exists on disk", () => {
  const manifest = loadManifest();
  for (const entry of manifest.entries) {
    const fullPath = join(pluginRoot, "..", "..", entry.destination);
    assert.ok(existsSync(fullPath), entry.skill + " destination does not exist: " + entry.destination);
  }
});

test("deprecated redirects point to existing skills", () => {
  const manifest = loadManifest();
  const skillNames = new Set(manifest.entries.map((e) => e.skill));
  for (const entry of manifest.entries) {
    if (entry.status === "deprecated-redirect" && entry.redirectTo) {
      assert.ok(skillNames.has(entry.redirectTo), entry.skill + " redirectTo " + entry.redirectTo + " does not exist");
    }
  }
});
