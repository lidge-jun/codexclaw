/**
 * capability-lock.test.ts — capability lock tests (issue #16).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateLock,
  readCapabilityLock,
  checkAgainstLock,
  DEFAULT_STABLE_LOCK,
  LOCK_SCHEMA_VERSION,
} from "../src/capability-lock.ts";

test("DEFAULT_STABLE_LOCK passes validation", () => {
  const errors = validateLock(DEFAULT_STABLE_LOCK);
  assert.deepEqual(errors, []);
});

test("validateLock rejects null", () => {
  const errors = validateLock(null);
  assert.ok(errors.length > 0);
});

test("validateLock rejects wrong schemaVersion", () => {
  const errors = validateLock({ schemaVersion: 99, entries: [] });
  assert.ok(errors.some(e => e.includes("schemaVersion")));
});

test("validateLock rejects missing entries", () => {
  const errors = validateLock({ schemaVersion: LOCK_SCHEMA_VERSION });
  assert.ok(errors.some(e => e.includes("entries")));
});

test("validateLock rejects malformed entry", () => {
  const errors = validateLock({
    schemaVersion: LOCK_SCHEMA_VERSION,
    entries: [{ name: "", required: "yes", channel: "beta", usage: "" }],
  });
  assert.ok(errors.length >= 3, "should report name, required, channel, usage errors");
});

test("validateLock accepts well-formed entries", () => {
  const errors = validateLock({
    schemaVersion: LOCK_SCHEMA_VERSION,
    entries: [
      { name: "exec_command", required: true, channel: "stable", usage: "shell" },
      { name: "goal_api", required: false, channel: "canary", usage: "goals" },
    ],
  });
  assert.deepEqual(errors, []);
});

test("readCapabilityLock returns error for missing file", () => {
  const result = readCapabilityLock("/nonexistent/lock.json");
  assert.ok("error" in result);
  assert.match(result.error, /not found/);
});

test("readCapabilityLock returns error for unparseable file", () => {
  const dir = mkdtempSync(join(tmpdir(), "caplock-"));
  const path = join(dir, "lock.json");
  writeFileSync(path, "NOT JSON");
  const result = readCapabilityLock(path);
  assert.ok("error" in result);
  assert.match(result.error, /unparseable/);
});

test("readCapabilityLock returns error for invalid schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "caplock-"));
  const path = join(dir, "lock.json");
  writeFileSync(path, JSON.stringify({ schemaVersion: 99, entries: [] }));
  const result = readCapabilityLock(path);
  assert.ok("error" in result);
  assert.match(result.error, /schemaVersion/);
});

test("readCapabilityLock returns lock for valid file", () => {
  const dir = mkdtempSync(join(tmpdir(), "caplock-"));
  const path = join(dir, "lock.json");
  writeFileSync(path, JSON.stringify(DEFAULT_STABLE_LOCK));
  const result = readCapabilityLock(path);
  assert.ok("lock" in result);
  assert.equal(result.lock.schemaVersion, LOCK_SCHEMA_VERSION);
});

test("checkAgainstLock returns missing required capabilities", () => {
  const available = new Set(["exec_command", "apply_patch"]);
  const missing = checkAgainstLock(DEFAULT_STABLE_LOCK, available);
  // plugin_hooks is required but not in the set
  assert.ok(missing.some(m => m.name === "plugin_hooks"));
  // exec_command and apply_patch are available, should not be missing
  assert.ok(!missing.some(m => m.name === "exec_command"));
  assert.ok(!missing.some(m => m.name === "apply_patch"));
});

test("checkAgainstLock returns empty when all required are present", () => {
  const available = new Set(["exec_command", "apply_patch", "plugin_hooks"]);
  const missing = checkAgainstLock(DEFAULT_STABLE_LOCK, available);
  assert.deepEqual(missing, []);
});

test("checkAgainstLock skips optional capabilities", () => {
  const available = new Set(["exec_command", "apply_patch", "plugin_hooks"]);
  const missing = checkAgainstLock(DEFAULT_STABLE_LOCK, available);
  // web_search, browser, spawn_agent, create_task, goal_api are optional
  assert.ok(!missing.some(m => m.name === "web_search"));
  assert.ok(!missing.some(m => m.name === "goal_api"));
});

test("LOCK_SCHEMA_VERSION is 1", () => {
  assert.equal(LOCK_SCHEMA_VERSION, 1);
});

