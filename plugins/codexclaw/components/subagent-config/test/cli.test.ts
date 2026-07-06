/**
 * cli.test.ts — L9.3 `cxc subagents` operator surface.
 *
 * Proves the parse + run over the SAME store the MCP/GUI use: list/get/set
 * roundtrip, validation surfaced as errors, prompt set/clear, and help.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseSubagentsArgs, runSubagents } from "../src/cli.ts";
import { readConfig } from "../src/store.ts";

function tmp() {
  return mkdtempSync(join(tmpdir(), "cxc-subcli-"));
}

test("parse: empty/list/help/get/set shapes", () => {
  assert.equal(parseSubagentsArgs([]).action, "list");
  assert.equal(parseSubagentsArgs(["list"]).action, "list");
  assert.equal(parseSubagentsArgs(["help"]).action, "help");
  assert.deepEqual(parseSubagentsArgs(["get", "reviewer"]), { action: "get", role: "reviewer" });
  const set = parseSubagentsArgs(["set", "executor", "--mode", "model", "--model", "m1"]);
  assert.equal(set.action, "set");
  assert.deepEqual(set.patch, { mode: "model", model: "m1" });
});

test("parse: unknown role / bad mode / no-op set are errors", () => {
  assert.match(parseSubagentsArgs(["get", "nope"]).error ?? "", /unknown role/);
  assert.match(parseSubagentsArgs(["set", "reviewer", "--mode", "weird"]).error ?? "", /--mode must be/);
  assert.match(parseSubagentsArgs(["set", "reviewer"]).error ?? "", /requires at least one/);
});

test("run: list returns all three roles defaulted", () => {
  const cwd = tmp();
  const res = runSubagents(parseSubagentsArgs(["list"]), cwd);
  assert.equal(res.code, 0);
  const cfg = JSON.parse(res.output);
  for (const role of ["explorer", "reviewer", "executor"]) {
    assert.equal(cfg.roles[role].mode, "default");
  }
});

test("run: set persists to the store and get reads it back", () => {
  const cwd = tmp();
  const setRes = runSubagents(parseSubagentsArgs(["set", "reviewer", "--mode", "model", "--model", "grok-4"]), cwd);
  assert.equal(setRes.code, 0);
  // persisted to the real store file
  assert.equal(readConfig(cwd).roles.reviewer.model, "grok-4");
  const getRes = runSubagents(parseSubagentsArgs(["get", "reviewer"]), cwd);
  const role = JSON.parse(getRes.output);
  assert.equal(role.mode, "model");
  assert.equal(role.model, "grok-4");
});

test("run: --prompt sets and --clear-prompt clears the override", () => {
  const cwd = tmp();
  runSubagents(parseSubagentsArgs(["set", "executor", "--prompt", "be terse"]), cwd);
  assert.equal(readConfig(cwd).roles.executor.promptOverride, "be terse");
  runSubagents(parseSubagentsArgs(["set", "executor", "--clear-prompt"]), cwd);
  assert.equal(readConfig(cwd).roles.executor.promptOverride, null);
});

test("run: --effort sets, --clear-effort clears, invalid effort rejected at parse", () => {
  const cwd = tmp();
  runSubagents(parseSubagentsArgs(["set", "explorer", "--effort", "high"]), cwd);
  assert.equal(readConfig(cwd).roles.explorer.effort, "high");
  runSubagents(parseSubagentsArgs(["set", "explorer", "--clear-effort"]), cwd);
  assert.equal(readConfig(cwd).roles.explorer.effort, null);

  const bad = parseSubagentsArgs(["set", "explorer", "--effort", "turbo"]);
  assert.match(bad.error ?? "", /--effort must be/);
});

test("run: store validation error surfaces as a non-zero exit", () => {
  const cwd = tmp();
  // mode model with no model id is rejected by the store validator.
  const res = runSubagents({ action: "set", role: "reviewer", patch: { mode: "model" } }, cwd);
  assert.equal(res.code, 1);
  assert.match(res.output, /requires a non-empty model id/);
});
