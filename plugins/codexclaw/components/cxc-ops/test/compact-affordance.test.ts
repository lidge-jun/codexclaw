import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as affordance from "../src/map-affordance.ts";
import { runReset } from "../src/reset.ts";
import { supportsSymlinks, symlinkDirSync } from "../test-support/symlink-support.ts";

process.env.CODEXCLAW_CXC = "cxc";
const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const payload = (cwd: string, event: string, session = "parent", extra = {}) =>
  JSON.stringify({ cwd, session_id: session, hook_event_name: event, ...extra });
const temp = () => mkdtempSync(join(tmpdir(), "cxc-compact-affordance-"));

test("PostCompact returns no unsupported event-specific context", () => {
  const cwd = temp();
  try { assert.equal(affordance.runPostCompactAffordance(payload(cwd, "PostCompact")), ""); }
  finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("compact hint is emitted once at the next root prompt, without FSM files", () => {
  const cwd = temp();
  try {
    assert.equal(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit")), "");
    assert.equal(existsSync(join(cwd, ".codexclaw")), false);
    affordance.runPostCompactAffordance(payload(cwd, "PostCompact"));
    affordance.runPostCompactAffordance(payload(cwd, "PostCompact"));
    const dir = join(cwd, ".codexclaw", "affordance-recovery");
    assert.equal(readdirSync(dir).length, 1);
    const out = JSON.parse(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit")));
    assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.match(out.hookSpecificOutput.additionalContext, /User questions:.*request_user_input_async/);
    assert.equal(out.hookSpecificOutput.additionalContext.split("User questions:").length - 1, 1);
    assert.equal(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit")), "");
    assert.deepEqual(readdirSync(join(cwd, ".codexclaw")), ["affordance-recovery"]);
    assert.deepEqual(readdirSync(dir), []);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("child enqueue and consume cannot steal the parent recovery marker", () => {
  const cwd = temp();
  try {
    for (const extra of [{ agent_id: "child" }, { agent_type: "worker" }]) {
      assert.equal(affordance.runPostCompactAffordance(payload(cwd, "PostCompact", "parent", extra)), "");
      assert.equal(existsSync(join(cwd, ".codexclaw")), false);
    }
    affordance.runPostCompactAffordance(payload(cwd, "PostCompact"));
    for (const extra of [{ agent_id: "child" }, { agent_type: "worker" }]) {
      assert.equal(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit", "parent", extra)), "");
      assert.equal(readdirSync(join(cwd, ".codexclaw", "affordance-recovery")).length, 1);
    }
    assert.notEqual(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit")), "");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("malformed identity and a different session or workspace do not consume", () => {
  const cwd = temp(), other = temp();
  try {
    for (const raw of ["", "{", "null", "[]", JSON.stringify({ cwd }),
      payload("relative", "PostCompact"), payload(cwd, "PostCompact", "")]) {
      assert.equal(affordance.runPostCompactAffordance(raw), "");
    }
    assert.equal(existsSync(join(cwd, ".codexclaw")), false);
    affordance.runPostCompactAffordance(payload(cwd, "PostCompact"));
    for (const raw of ["{", payload(cwd, "PostCompact"), payload(cwd, "UserPromptSubmit", "other"), payload(other, "UserPromptSubmit")]) {
      assert.equal(affordance.runUserPromptAffordance(raw), "");
    }
    assert.notEqual(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit")), "");
  } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); }
});

test("explicit state reset clears pending affordances", () => {
  const cwd = temp();
  try {
    affordance.runPostCompactAffordance(payload(cwd, "PostCompact"));
    runReset(cwd, "state");
    assert.equal(existsSync(join(cwd, ".codexclaw", "affordance-recovery")), false);
    assert.equal(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit")), "");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("symlinked state or recovery directory is not followed", t => {
  if (!supportsSymlinks().dir) { t.skip("directory symlinks unavailable"); return; }
  for (const nested of [false, true]) {
    const cwd = temp(), outside = temp();
    try {
      const state = join(cwd, ".codexclaw");
      if (nested) mkdirSync(state);
      symlinkDirSync(outside, nested ? join(state, "affordance-recovery") : state);
      assert.equal(affordance.runPostCompactAffordance(payload(cwd, "PostCompact")), "");
      assert.equal(affordance.runUserPromptAffordance(payload(cwd, "UserPromptSubmit")), "");
      assert.deepEqual(readdirSync(outside), []);
    } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
  }
});

test("compiled CLI and one registered hook file wire the two-event lifecycle", () => {
  const cwd = temp();
  try {
    const hook = JSON.parse(readFileSync(join(plugin, "hooks/post-compact-injecting-bg-terminal-affordance.json"), "utf8"));
    assert.match(hook.hooks.UserPromptSubmit[0].hooks[0].command, /cxc-ops\/dist\/cli.js.*hook user-prompt-submit/);
    const cli = join(plugin, "components/cxc-ops/dist/cli.js");
    const run = (verb: string, event: string) => spawnSync(process.execPath, [cli, "hook", verb],
      { input: payload(cwd, event), encoding: "utf8", timeout: 10000 });
    const compact = run("post-compact", "PostCompact");
    assert.equal(compact.status, 0, compact.stderr); assert.equal(compact.stdout, "");
    const prompt = run("user-prompt-submit", "UserPromptSubmit");
    assert.equal(prompt.status, 0, prompt.stderr);
    assert.equal(JSON.parse(prompt.stdout).hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.equal(run("user-prompt-submit", "UserPromptSubmit").stdout, "");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
