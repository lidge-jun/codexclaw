/**
 * scouting-bundle.test.ts — scouting bundle tests (issue #20).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  redactPaths,
  scanForSecrets,
  generateBundle,
  validateBundleSecurity,
  BUNDLE_SCHEMA_VERSION,
  SECRET_SENTINELS,
} from "../src/scouting-bundle.ts";

test("redactPaths replaces home directory with ~", () => {
  const result = redactPaths("/Users/jun/.codex/config.toml", "/Users/jun");
  assert.equal(result, "~/.codex/config.toml");
});

test("redactPaths handles Windows-style paths", () => {
  const result = redactPaths("C:\\Users\\jun\\.codex", "C:\\Users\\jun");
  assert.match(result, /~/);
  assert.doesNotMatch(result, /jun/);
});

test("scanForSecrets detects GitHub PAT", () => {
  const secrets = scanForSecrets("token=ghp_abcdefghijklmnopqrstuvwxyz0123456789");
  assert.ok(secrets.length > 0);
});

test("scanForSecrets detects OpenAI key", () => {
  const secrets = scanForSecrets("key=sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVW");
  assert.ok(secrets.length > 0);
});

test("scanForSecrets detects private key header", () => {
  const secrets = scanForSecrets("-----BEGIN RSA PRIVATE KEY-----");
  assert.ok(secrets.length > 0);
});

test("scanForSecrets returns empty for clean text", () => {
  const secrets = scanForSecrets("This is clean diagnostic text with no secrets.");
  assert.deepEqual(secrets, []);
});

test("generateBundle produces valid schema", () => {
  const root = mkdtempSync(join(tmpdir(), "bundle-"));
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "test", version: "0.0.1", hooks: [] }));
  mkdirSync(join(root, "skills", "dev", "agents"), { recursive: true });
  writeFileSync(join(root, "skills", "dev", "SKILL.md"), "---\nname: dev\n---");
  const bundle = generateBundle({ pluginRoot: root, homeDir: "/fake/home" });
  assert.equal(bundle.schemaVersion, BUNDLE_SCHEMA_VERSION);
  assert.ok(bundle.sections.length > 0);
  assert.ok(bundle.generatedAt);
});

test("generateBundle does not include raw prompts or source bodies", () => {
  const root = mkdtempSync(join(tmpdir(), "bundle-"));
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "test", version: "0.0.1" }));
  const bundle = generateBundle({ pluginRoot: root, homeDir: "/fake" });
  const text = JSON.stringify(bundle);
  // Should not contain full file contents or prompts
  assert.doesNotMatch(text, /import\s+{/);
  assert.doesNotMatch(text, /function\s+\w+/);
});

test("validateBundleSecurity passes for clean bundle", () => {
  const bundle = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    generatedAt: "2026-08-15",
    platform: "darwin",
    nodeVersion: "v22",
    sections: [{ name: "test", content: "clean data" }],
  };
  const result = validateBundleSecurity(bundle);
  assert.equal(result.safe, true);
  assert.deepEqual(result.violations, []);
});

test("validateBundleSecurity fails when secrets present", () => {
  const bundle = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    generatedAt: "2026-08-15",
    platform: "darwin",
    nodeVersion: "v22",
    sections: [{ name: "bad", content: "token=ghp_abcdefghijklmnopqrstuvwxyz0123456789" }],
  };
  const result = validateBundleSecurity(bundle);
  assert.equal(result.safe, false);
  assert.ok(result.violations.length > 0);
});

test("SECRET_SENTINELS covers at least 5 patterns", () => {
  assert.ok(SECRET_SENTINELS.length >= 5);
});

test("BUNDLE_SCHEMA_VERSION is 1", () => {
  assert.equal(BUNDLE_SCHEMA_VERSION, 1);
});

// --- wp05 Windows path handling (040) ---

test("redactPaths is case-insensitive on win32", () => {
  // defect #3: tools lowercase paths freely, and the bundle is meant to be shareable.
  const result = redactPaths("c:\\users\\jun\\.codex", "C:\\Users\\jun", "win32");
  assert.doesNotMatch(result, /jun/);
  assert.match(result, /~/);
});

test("redactPaths stays case-SENSITIVE on posix", () => {
  // Folding case here would merge two genuinely different POSIX directories.
  const result = redactPaths("/Users/JUN/x", "/Users/jun", "linux");
  assert.match(result, /JUN/);
});

test("redactPaths handles regex metacharacters in the home path", () => {
  const result = redactPaths("C:\\Users\\a+b(1)\\.codex", "C:\\Users\\a+b(1)", "win32");
  assert.equal(result, "~\\.codex");
});

test("an empty homeDir is a no-op, not a shredder", () => {
  // defect #1: "".split("") used to explode the string into "p~l~u~g~i~n".
  const result = redactPaths("plugin", "");
  assert.equal(result, "plugin");
  assert.notEqual(result, "p~l~u~g~i~n");
});

test("the longest variant wins", () => {
  const result = redactPaths("C:/Users/x/AppData and C:/Users/x", "C:/Users/x", "win32");
  assert.equal(result, "~/AppData and ~");
});

test("generateBundle with no HOME set produces readable sections", () => {
  // 002 B3: on Windows HOME is unset, which used to shred every redacted section.
  const priorHome = process.env.HOME;
  delete process.env.HOME;
  try {
    const root = mkdtempSync(join(tmpdir(), "bundle-nohome-"));
    mkdirSync(join(root, ".codex-plugin"), { recursive: true });
    writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "codexclaw", version: "0.0.1", hooks: [] }));
    const bundle = generateBundle({ pluginRoot: root });
    for (const section of bundle.sections) {
      assert.doesNotMatch(section.content, /(~.){5}/, `section ${section.name} is character-shredded`);
    }
  } finally {
    if (priorHome !== undefined) process.env.HOME = priorHome;
  }
});

