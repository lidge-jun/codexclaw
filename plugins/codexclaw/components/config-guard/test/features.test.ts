import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECLARED_FEATURES,
  featuresToEnable,
  parseFeaturesList,
  readDeclaredState,
  type CodexRunner,
} from "../src/features.ts";

test("DECLARED_FEATURES is exactly the 4 codexclaw flags, no multi_agent_v2", () => {
  assert.deepEqual([...DECLARED_FEATURES], [
    "multi_agent",
    "goals",
    "hooks",
    "default_mode_request_user_input",
  ]);
  assert.ok(!DECLARED_FEATURES.includes("multi_agent_v2" as never));
});

test("parseFeaturesList reads enabled/disabled tokens", () => {
  const out = [
    "multi_agent        stable             enabled",
    "goals              stable             enabled",
    "hooks              stable             enabled",
    "default_mode_request_user_input  under-development  disabled",
  ].join("\n");
  const m = parseFeaturesList(out);
  assert.equal(m.get("multi_agent"), true);
  assert.equal(m.get("goals"), true);
  assert.equal(m.get("hooks"), true);
  assert.equal(m.get("default_mode_request_user_input"), false);
});

test("readDeclaredState treats unseen flags as disabled", () => {
  const run: CodexRunner = () => ({ stdout: "multi_agent enabled", stderr: "", exitCode: 0 });
  const state = readDeclaredState(run);
  assert.equal(state.get("multi_agent"), true);
  assert.equal(state.get("goals"), false);
  assert.equal(state.size, 4);
});

test("readDeclaredState throws on nonzero exit", () => {
  const run: CodexRunner = () => ({ stdout: "", stderr: "boom", exitCode: 1 });
  assert.throws(() => readDeclaredState(run), /features list failed/);
});

test("featuresToEnable returns only not-already-true flags", () => {
  const state = new Map<string, boolean>([
    ["multi_agent", true],
    ["goals", true],
    ["hooks", false],
    ["default_mode_request_user_input", false],
  ]);
  assert.deepEqual(featuresToEnable(state), ["hooks", "default_mode_request_user_input"]);
});
