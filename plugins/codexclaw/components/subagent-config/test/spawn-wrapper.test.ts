/**
 * spawn-wrapper.test.ts — L9.1 production spawn payload builder.
 *
 * Proves the wrapper consumes resolveSpawnConfig at spawn time: model override
 * applied, default inherits (no model key), promptOverride replaces TOML body,
 * agent_type mapping, real TOML parse, and total/fail-safe behavior.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { setRole } from "../src/store.ts";
import {
  ROLE_AGENT_TYPE,
  parseRoleToml,
  readRoleToml,
  buildSpawnPayload,
  resolveSpawnPayload,
} from "../src/spawn-wrapper.ts";
import { resolveSpawnConfig } from "../src/store.ts";

const here = dirname(fileURLToPath(import.meta.url));
// Real shipped role TOMLs: plugins/codexclaw/agents/*.toml.
const AGENTS_DIR = resolve(here, "..", "..", "..", "agents");

function tmp() {
  return mkdtempSync(join(tmpdir(), "cxc-spawn-"));
}

test("agent_type mapping: explorer/reviewer -> explorer, executor -> worker", () => {
  assert.equal(ROLE_AGENT_TYPE.explorer, "explorer");
  assert.equal(ROLE_AGENT_TYPE.reviewer, "explorer");
  assert.equal(ROLE_AGENT_TYPE.executor, "worker");
});

test("parseRoleToml reads model sentinel + triple-quoted developer_instructions", () => {
  const text = [
    'name = "x"',
    'model = "default"   # comment',
    'developer_instructions = """',
    "Role: tester.",
    "Body line with `backtick` and ## marker.",
    '"""',
  ].join("\n");
  const f = parseRoleToml(text);
  assert.equal(f.model, "default");
  assert.match(f.developerInstructions, /Role: tester\./);
  assert.match(f.developerInstructions, /backtick/);
  assert.ok(!f.developerInstructions.includes('"""'));
});

test("readRoleToml reads a real shipped role TOML body", () => {
  const f = readRoleToml(AGENTS_DIR, "explorer");
  assert.match(f.developerInstructions, /read-only codebase explorer/i);
});

test("readRoleToml on a missing file returns safe defaults (never throws)", () => {
  const f = readRoleToml(tmp(), "explorer");
  assert.equal(f.model, null);
  assert.equal(f.developerInstructions, "");
});

test("buildSpawnPayload: model override is applied for a model-mode resolution", () => {
  const payload = buildSpawnPayload({
    role: "reviewer",
    task: "review the diff",
    resolution: { role: "reviewer", model: "grok-4", usesMainModel: false, promptOverride: null },
    developerInstructions: "Role: reviewer.",
  });
  assert.equal(payload.agent_type, "explorer");
  assert.equal(payload.model, "grok-4");
  assert.match(payload.message, /Role: reviewer\./);
  assert.match(payload.message, /TASK: review the diff/);
});

test("buildSpawnPayload: default mode OMITS the model key (inherit main model)", () => {
  const payload = buildSpawnPayload({
    role: "explorer",
    task: "find X",
    resolution: { role: "explorer", model: null, usesMainModel: true, promptOverride: null },
    developerInstructions: "Role: explorer.",
  });
  assert.equal(payload.agent_type, "explorer");
  assert.ok(!("model" in payload), "default mode must not set a model key");
});

test("buildSpawnPayload: promptOverride REPLACES the TOML developer_instructions", () => {
  const payload = buildSpawnPayload({
    role: "executor",
    task: "apply patch",
    resolution: { role: "executor", model: null, usesMainModel: true, promptOverride: "CUSTOM PROMPT" },
    developerInstructions: "Role: executor (TOML body).",
  });
  assert.equal(payload.agent_type, "worker");
  assert.match(payload.message, /CUSTOM PROMPT/);
  assert.ok(!payload.message.includes("TOML body"), "override must replace the TOML body");
});

test("buildSpawnPayload: empty prompt + empty task still yields a TASK: message", () => {
  const payload = buildSpawnPayload({
    role: "explorer",
    task: "",
    resolution: { role: "explorer", model: null, usesMainModel: true, promptOverride: null },
    developerInstructions: "",
  });
  assert.equal(payload.message, "TASK: ");
});

test("resolveSpawnPayload: end-to-end uses persisted store config + real TOML", () => {
  const cwd = tmp();
  // configure a model for reviewer in the store
  setRole(cwd, "reviewer", { mode: "model", model: "model-reviewer" });
  const payload = resolveSpawnPayload(cwd, "reviewer", "audit this", AGENTS_DIR);
  assert.equal(payload.agent_type, "explorer");
  assert.equal(payload.model, "model-reviewer");
  assert.match(payload.message, /adversarial reviewer/i); // from the real reviewer.toml
  assert.match(payload.message, /TASK: audit this/);

  // default role omits model and inherits the main model
  const def = resolveSpawnPayload(cwd, "explorer", "find Y", AGENTS_DIR);
  assert.ok(!("model" in def));
  assert.equal(resolveSpawnConfig(cwd, "explorer").usesMainModel, true);
});
