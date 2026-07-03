import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultConfig,
  readConfig,
  writeConfig,
  setRole,
  resolveSpawnConfig,
  validateRolePatch,
  ROLES,
} from "../src/store.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-subagents-"));
}

test("AC1: missing subagents.json -> all roles default/null/null", () => {
  const cwd = tmp();
  const cfg = readConfig(cwd);
  for (const role of ROLES) {
    assert.equal(cfg.roles[role].mode, "default");
    assert.equal(cfg.roles[role].model, null);
    assert.equal(cfg.roles[role].promptOverride, null);
  }
});

test("AC2: set reviewer mode:model persists and reads back exactly", () => {
  const cwd = tmp();
  setRole(cwd, "reviewer", { mode: "model", model: "gpt-5.5", promptOverride: "Be adversarial." });
  const cfg = readConfig(cwd);
  assert.equal(cfg.roles.reviewer.mode, "model");
  assert.equal(cfg.roles.reviewer.model, "gpt-5.5");
  assert.equal(cfg.roles.reviewer.promptOverride, "Be adversarial.");
  // other roles untouched
  assert.equal(cfg.roles.explorer.mode, "default");
});

test("AC3 / spawn-honor: model-mode role spawns with its model; default roles inherit main", () => {
  const cwd = tmp();
  setRole(cwd, "executor", { mode: "model", model: "claude-opus" });
  const exec = resolveSpawnConfig(cwd, "executor");
  assert.equal(exec.usesMainModel, false);
  assert.equal(exec.model, "claude-opus");
  const explorer = resolveSpawnConfig(cwd, "explorer");
  assert.equal(explorer.usesMainModel, true);
  assert.equal(explorer.model, null);
});

test("validation: invalid mode rejected with clear message", () => {
  assert.match(validateRolePatch({ mode: "turbo" as never }) ?? "", /invalid mode/);
  assert.equal(validateRolePatch({ mode: "default" }), null);
});

test("validation: mode:model without a model id rejected", () => {
  assert.match(validateRolePatch({ mode: "model", model: null }) ?? "", /requires a non-empty model/);
  assert.throws(() => setRole(tmp(), "reviewer", { mode: "model" }), /requires a non-empty model/);
});

test("default-mode invariant: switching back to default clears the model", () => {
  const cwd = tmp();
  setRole(cwd, "reviewer", { mode: "model", model: "m1" });
  setRole(cwd, "reviewer", { mode: "default" });
  assert.equal(readConfig(cwd).roles.reviewer.model, null);
});

test("malformed file -> defaults, never throws", () => {
  const cwd = tmp();
  mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
  writeFileSync(join(cwd, ".codexclaw", "subagents.json"), "{ not json ]");
  const cfg = readConfig(cwd);
  assert.deepEqual(cfg, defaultConfig());
});

test("partial/invalid role values normalized per-field (model-mode missing model -> default)", () => {
  const cwd = tmp();
  mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
  writeFileSync(
    join(cwd, ".codexclaw", "subagents.json"),
    JSON.stringify({ roles: { reviewer: { mode: "model", model: 123, promptOverride: 7 } } }),
  );
  const r = readConfig(cwd).roles.reviewer;
  assert.equal(r.mode, "default"); // model:123 invalid -> fail safe to default
  assert.equal(r.model, null);
  assert.equal(r.promptOverride, null); // non-string -> null, never fabricated
});

test("promptOverride accepts null and never fabricates text", () => {
  const cwd = tmp();
  setRole(cwd, "explorer", { promptOverride: null });
  assert.equal(readConfig(cwd).roles.explorer.promptOverride, null);
});

test("atomic write leaves no orphan .tmp", () => {
  const cwd = tmp();
  setRole(cwd, "reviewer", { mode: "model", model: "m1" });
  const files = readdirSync(join(cwd, ".codexclaw"));
  assert.ok(!files.some((f) => f.endsWith(".tmp")), `orphan tmp left: ${files.join(",")}`);
  assert.ok(existsSync(join(cwd, ".codexclaw", "subagents.json")));
});

test("merged validation: {mode:'model'} alone passes when the role already has a model", () => {
  const cwd = tmp();
  setRole(cwd, "reviewer", { mode: "model", model: "gpt-5.4" });
  const cfg = setRole(cwd, "reviewer", { mode: "model" }); // bare re-assert: must not throw
  assert.equal(cfg.roles.reviewer.mode, "model");
  assert.equal(cfg.roles.reviewer.model, "gpt-5.4");
});

test("merged validation: fresh default role still rejects bare {mode:'model'}", () => {
  assert.throws(() => setRole(tmp(), "explorer", { mode: "model" }), /requires a non-empty model/);
});

test("merged validation: default->model round-trip needs an explicit model again (default cleared it)", () => {
  const cwd = tmp();
  setRole(cwd, "reviewer", { mode: "model", model: "m1" });
  setRole(cwd, "reviewer", { mode: "default" }); // invariant nulls model
  assert.throws(() => setRole(cwd, "reviewer", { mode: "model" }), /requires a non-empty model/);
  const cfg = setRole(cwd, "reviewer", { mode: "model", model: "m2" });
  assert.equal(cfg.roles.reviewer.model, "m2");
});
