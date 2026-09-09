import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROLES, readConfig, setRole, resetRole, defaultRole } from "../src/store.ts";
import { parseSubagentsArgs, runSubagents } from "../src/cli.ts";
import { updateSettings } from "../src/settings-api.ts";

for (const role of ROLES) test(`${role}: fallback stores independently, follows scopes and clears`, () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-fallback-config-"));
  const env = { CODEXCLAW_HOME: join(cwd, "global") };
  setRole(cwd, role, { mode: "model", model: "primary/a", effort: "high", fallback: { model: "secondary/b", effort: "low" } }, "global", env);
  assert.deepEqual(readConfig(cwd, "project", env).roles[role].fallback, { model: "secondary/b", effort: "low" });
  setRole(cwd, role, { fallback: { effort: null } }, "project", env);
  assert.equal(readConfig(cwd, "project", env).roles[role].effort, "high");
  assert.deepEqual(readConfig(cwd, "project", env).roles[role].fallback, { model: "secondary/b", effort: null });
  setRole(cwd, role, { fallback: null }, "project", env);
  assert.equal(readConfig(cwd, "project", env).roles[role].fallback, null);
  resetRole(cwd, role, "project", env);
  assert.equal(readConfig(cwd, "project", env).roles[role].fallback?.effort, "low");
});
test("invalid fallback updates preserve file bytes; exact provider IDs stay distinct", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-fallback-invalid-"));
  const env = { CODEXCLAW_HOME: join(cwd, "global") };
  setRole(cwd, "executor", { mode: "model", model: "xai/grok-4.6", fallback: { model: "cursor/grok-4.6", effort: null } }, "project", env);
  const path = join(cwd, ".codexclaw/subagents.json"); const before = readFileSync(path, "utf8");
  for (const fallback of [{ model: "xai/grok-4.6" }, { model: " " }, { model: 42 }, { effort: "bogus" }, []]) {
    assert.throws(() => setRole(cwd, "executor", { fallback } as never, "project", env));
    assert.equal(readFileSync(path, "utf8"), before);
  }
  setRole(cwd, "executor", { mode: "default", fallback: { model: "xai/grok-4.6" } }, "project", env);
  assert.equal(readConfig(cwd, "project", env).roles.executor.fallback?.model, "xai/grok-4.6");
});
test("legacy JSON has no fallback, and effort-only creation without model is rejected", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-fallback-old-")); const env = { CODEXCLAW_HOME: join(cwd, "global") };
  setRole(cwd, "executor", { mode: "default" }, "project", env);
  writeFileSync(join(cwd, ".codexclaw/subagents.json"), JSON.stringify({ roles: { executor: { mode: "model", model: "old/model", effort: "high" } } }));
  assert.equal(readConfig(cwd, "project", env).roles.executor.fallback, null);
  assert.equal(defaultRole().fallback, null);
  assert.throws(() => setRole(cwd, "executor", { fallback: { effort: "low" } }, "project", env), /model/);
});
test("CLI and settings API roundtrip fallback and reject conflicting clear", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-fallback-cli-config-"));
  const parsed = parseSubagentsArgs(["set", "executor", "--fallback-model", "cursor/grok-4.6", "--fallback-effort", "low"]);
  assert.equal(runSubagents(parsed, cwd).code, 0);
  const updated = updateSettings(cwd, { role: "executor", fallback: { effort: null } });
  assert.deepEqual(updated.roles.executor.fallback, { model: "cursor/grok-4.6", effort: null });
  assert.ok(parseSubagentsArgs(["set", "executor", "--clear-fallback", "--fallback-model", "x"]).error);
  assert.ok(parseSubagentsArgs(["set", "executor", "--fallback-model", "x", "--clear-fallback"]).error);
  assert.equal(parseSubagentsArgs(["set", "executor", "--fallback-model", "--global"]).scope, undefined);
  assert.equal(runSubagents(parseSubagentsArgs(["set", "executor", "--clear-fallback"]), cwd).code, 0);
  assert.equal(readConfig(cwd).roles.executor.fallback, null);
});
