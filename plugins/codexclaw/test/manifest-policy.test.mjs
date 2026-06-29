// codexclaw manifest + skill-policy + role-config coverage (node:test, .mjs).
// Closes WP0 audit gaps: S3 implicit-invocation policy (only `dev` is implicit),
// S5 role TOML validity, and L3 PreToolUse goal-budget hook manifest registration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");

function readImplicit(yamlPath) {
  // tiny line scan — avoids a yaml dep for one boolean field
  const body = readFileSync(yamlPath, "utf8");
  const m = body.match(/allow_implicit_invocation:\s*(true|false)/);
  return m ? m[1] === "true" : null;
}

test("S3: only `dev` skill is implicit; all routers + pabcd are on-demand", () => {
  const skillsDir = join(pluginRoot, "skills");
  const implicit = [];
  for (const name of readdirSync(skillsDir)) {
    const sd = join(skillsDir, name);
    if (!statSync(sd).isDirectory()) continue;
    const yaml = join(sd, "agents", "openai.yaml");
    assert.ok(existsSync(yaml), `skill ${name} missing agents/openai.yaml`);
    const val = readImplicit(yaml);
    assert.notEqual(val, null, `skill ${name} openai.yaml has no allow_implicit_invocation`);
    if (val) implicit.push(name);
  }
  assert.deepEqual(implicit, ["dev"], `exactly one implicit skill (dev) expected, got: ${implicit.join(",")}`);
});

test("L3: PreToolUse goal-budget hook is registered in the plugin manifest", () => {
  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const goalHook = manifest.hooks.find((h) => h.includes("pre-tool-use-guarding-goal-budget"));
  assert.ok(goalHook, "pre-tool-use-guarding-goal-budget hook not in manifest.hooks");
  const hookJson = JSON.parse(readFileSync(join(pluginRoot, goalHook), "utf8"));
  const flat = JSON.stringify(hookJson);
  assert.match(flat, /PreToolUse/, "hook is not a PreToolUse hook");
  assert.match(flat, /goal[- ]budget|pre-tool-use/i, "hook does not target the goal-budget guard");
  // R-10: the PreToolUse entry must narrow to ^create_goal$ (omo parity), not fire on every tool.
  const entry = hookJson.hooks.PreToolUse[0];
  assert.equal(entry.matcher, "^create_goal$", "PreToolUse goal-budget hook must match only ^create_goal$");
});

test("S5: each role TOML is spawn-valid (name + description + default model + instructions)", () => {
  const agentsDir = join(pluginRoot, "agents");
  for (const role of ["explorer", "reviewer", "executor"]) {
    const toml = readFileSync(join(agentsDir, `${role}.toml`), "utf8");
    assert.match(toml, new RegExp(`name\\s*=\\s*"${role}"`), `${role}.toml name mismatch`);
    assert.match(toml, /description\s*=\s*"/, `${role}.toml missing description`);
    assert.match(toml, /model\s*=\s*"default"/, `${role}.toml must inherit default model in Phase 1`);
    assert.match(toml, /developer_instructions\s*=\s*"""/, `${role}.toml missing developer_instructions`);
    assert.ok(!/read_only\s*=\s*true/.test(toml), `${role}.toml must not hardcode read_only (B-opt2 inline)`);
  }
});
