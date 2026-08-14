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

