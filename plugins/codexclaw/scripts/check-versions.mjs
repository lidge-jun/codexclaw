#!/usr/bin/env node
/**
 * check-versions.mjs — assert the payload does not claim a version other than the
 * one being released.
 *
 * Without this, `v0.2.0` could ship an archive whose package.json, plugin manifest
 * and component packages all still say `0.2.0-beta.1`.
 *
 * The comparison is SemVer core+prerelease. Build metadata is permitted on the
 * plugin manifest and inventory (the release contract regenerates `+codex.<stamp>`),
 * and never affects precedence, so a literal string equality check would make the
 * legitimate release impossible.
 *
 *   node plugins/codexclaw/scripts/check-versions.mjs 0.2.0
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(PLUGIN_ROOT, "..", "..");

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Core + prerelease, with build metadata dropped. Null when malformed. */
export function precedenceOf(raw) {
  const m = SEMVER_RE.exec(String(raw ?? "").trim());
  if (!m) return null;
  return m[1] + "." + m[2] + "." + m[3] + (m[4] ? "-" + m[4] : "");
}

export function hasBuildMetadata(raw) {
  return String(raw ?? "").includes("+");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Collect every version surface: [label, path, value, metadataAllowed]. */
export function collectSurfaces(repoRoot = REPO_ROOT, pluginRoot = PLUGIN_ROOT) {
  const surfaces = [];
  surfaces.push(["package.json", join(repoRoot, "package.json"), readJson(join(repoRoot, "package.json")).version, false]);

  const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
  surfaces.push(["plugin.json", manifestPath, readJson(manifestPath).version, true]);

  const componentsDir = join(pluginRoot, "components");
  for (const folder of readdirSync(componentsDir).sort()) {
    const pkg = join(componentsDir, folder, "package.json");
    if (existsSync(pkg)) {
      surfaces.push(["components/" + folder, pkg, readJson(pkg).version, false]);
    }
  }

  const inventoryPath = join(pluginRoot, "inventory.json");
  if (existsSync(inventoryPath)) {
    const inv = readJson(inventoryPath);
    surfaces.push(["inventory.plugin.packageVersion", inventoryPath, inv.plugin?.packageVersion, false]);
    surfaces.push(["inventory.plugin.manifestVersion", inventoryPath, inv.plugin?.manifestVersion, true]);
  }
  return surfaces;
}

export function checkVersions(releaseVersion, repoRoot = REPO_ROOT, pluginRoot = PLUGIN_ROOT) {
  const violations = [];
  const target = precedenceOf(releaseVersion);
  if (!target) return { ok: false, violations: ["release version is not valid semver: " + releaseVersion] };

  for (const [label, path, value, metadataAllowed] of collectSurfaces(repoRoot, pluginRoot)) {
    if (value === undefined || value === null) {
      violations.push(label + ": no version found");
      continue;
    }
    const actual = precedenceOf(value);
    if (!actual) {
      violations.push(label + ": not valid semver: " + value);
      continue;
    }
    if (actual !== target) {
      violations.push(label + ": declares " + value + ", release is " + releaseVersion);
      continue;
    }
    if (!metadataAllowed && hasBuildMetadata(value)) {
      violations.push(label + ": build metadata is not allowed here (" + value + ")");
    }
  }
  return { ok: violations.length === 0, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: check-versions.mjs <release-version>");
    process.exit(1);
  }
  const result = checkVersions(version);
  if (result.ok) {
    console.log("[codexclaw versions] OK — every surface declares " + version);
    process.exit(0);
  }
  console.error("[codexclaw versions] FAIL — " + result.violations.length + " mismatch(es):");
  for (const v of result.violations) console.error("  - " + v);
  process.exit(1);
}
