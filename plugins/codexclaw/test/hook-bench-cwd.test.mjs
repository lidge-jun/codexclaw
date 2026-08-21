/**
 * hook-bench-cwd.test.mjs - defect #14: the bench must not build a /tmp path (wp08).
 *
 * The harness hard-coded /tmp for both the fixture payload cwd and spawnSync's cwd.
 * spawnSync throws ENOENT on a missing cwd, so the bench failed outright on a Windows
 * box without a C:\tmp and wp10 could not measure anything. Importing the helpers is
 * safe because the bench body now sits behind a main-module guard.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixturePayload, benchEnv } from "../scripts/hook-bench.mjs";

const EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SubagentStop", "PostCompact"];

test("hook-bench builds no hard-coded /tmp path", () => {
  const benchCwd = mkdtempSync(join(tmpdir(), "cxc-bench-cwd-test-"));
  try {
    for (const event of EVENTS) {
      const payload = JSON.parse(fixturePayload(event, benchCwd));
      assert.equal(payload.cwd, benchCwd, event + " must use the caller-provided cwd");
      assert.ok(payload.cwd.startsWith(tmpdir()), event + " cwd must live under tmpdir()");
      assert.equal(payload.cwd, benchCwd, event + " must not rebuild a literal /tmp/bench-cwd");
    }
  } finally {
    rmSync(benchCwd, { recursive: true, force: true });
  }
});

test("every fixture payload keeps its event-specific shape", () => {
  const benchCwd = mkdtempSync(join(tmpdir(), "cxc-bench-shape-"));
  try {
    assert.equal(JSON.parse(fixturePayload("UserPromptSubmit", benchCwd)).prompt, "fix the bug");
    assert.equal(JSON.parse(fixturePayload("PreToolUse", benchCwd)).tool_name, "exec_command");
    for (const event of EVENTS) {
      assert.equal(JSON.parse(fixturePayload(event, benchCwd)).hook_event_name, event);
    }
  } finally {
    rmSync(benchCwd, { recursive: true, force: true });
  }
});

test("the bench env sets USERPROFILE alongside HOME", () => {
  const tmpHome = join(tmpdir(), "cxc-bench-home-probe");
  const env = benchEnv(tmpHome);
  assert.equal(env.HOME, tmpHome);
  assert.equal(env.USERPROFILE, tmpHome, "Windows resolves the home from USERPROFILE");
  assert.equal(env.CODEX_HOME, join(tmpHome, ".codex"));
  assert.equal(env.CODEX_SQLITE_HOME, join(tmpHome, ".codex"));
});
