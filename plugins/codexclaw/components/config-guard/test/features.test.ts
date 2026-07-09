import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECLARED_FEATURES,
  featuresToEnable,
  parseFeaturesList,
  readDeclaredState,
  type CodexRunner,
} from "../src/features.ts";

// Realistic `codex features list` output: the FULL feature table, sorted by name, printed as
// three whitespace-padded columns `{name}  {stage}  {true|false}` (codex-rs cli/src/main.rs:1427).
// Critically it includes sibling keys whose names contain a declared key as a substring:
//   - multi_agent_mode (removed, false)         sorts AFTER multi_agent (stable, true)
//   - plugin_hooks    (removed, false)          contains "hooks" (stable, true)
// A substring/`includes` parser would let these clobber the real value — this fixture locks
// in the exact-first-field behavior.
const REAL_FEATURES_LIST = [
  "default_mode_request_user_input  under-development  false",
  "goals                            stable             true",
  "hooks                            stable             true",
  "multi_agent                      stable             true",
  "multi_agent_mode                 removed            false",
  "multi_agent_v2                   under-development  true",
  "plugin_hooks                     removed            false",
  "web_search                       stable             true",
].join("\n");

test("DECLARED_FEATURES is exactly the 5 codexclaw flags, incl. multi_agent_v2 (260709 dev2 switch)", () => {
  assert.deepEqual([...DECLARED_FEATURES], [
    "multi_agent",
    "multi_agent_v2",
    "goals",
    "hooks",
    "default_mode_request_user_input",
  ]);
  assert.ok(DECLARED_FEATURES.includes("multi_agent_v2" as (typeof DECLARED_FEATURES)[number]));
});

test("parseFeaturesList reads the real name/stage/bool table by exact first field", () => {
  const m = parseFeaturesList(REAL_FEATURES_LIST);
  assert.equal(m.get("multi_agent"), true);
  assert.equal(m.get("multi_agent_v2"), true);
  assert.equal(m.get("goals"), true);
  assert.equal(m.get("hooks"), true);
  assert.equal(m.get("default_mode_request_user_input"), false);
});

test("regression: sibling keys (multi_agent_mode/plugin_hooks) do NOT clobber declared flags", () => {
  // multi_agent_mode=false must not flip multi_agent=true; plugin_hooks=false must not flip hooks=true.
  const m = parseFeaturesList(REAL_FEATURES_LIST);
  assert.equal(m.get("multi_agent"), true, "multi_agent must stay true despite multi_agent_mode false");
  assert.equal(m.get("hooks"), true, "hooks must stay true despite plugin_hooks false");
  // The sibling keys are not declared, so they are never recorded for our purposes.
  assert.equal(m.has("multi_agent_mode"), false);
  assert.equal(m.has("plugin_hooks"), false);
});

test("readDeclaredState maps the real listing to exactly the 5 declared flags", () => {
  const run: CodexRunner = () => ({ stdout: REAL_FEATURES_LIST, stderr: "", exitCode: 0 });
  const state = readDeclaredState(run);
  assert.equal(state.size, 5);
  assert.equal(state.get("multi_agent"), true);
  assert.equal(state.get("multi_agent_v2"), true);
  assert.equal(state.get("goals"), true);
  assert.equal(state.get("hooks"), true);
  assert.equal(state.get("default_mode_request_user_input"), false);
});

test("readDeclaredState treats unseen flags as disabled", () => {
  const run: CodexRunner = () => ({
    stdout: "multi_agent  stable  true",
    stderr: "",
    exitCode: 0,
  });
  const state = readDeclaredState(run);
  assert.equal(state.get("multi_agent"), true);
  assert.equal(state.get("goals"), false);
  assert.equal(state.get("multi_agent_v2"), false);
  assert.equal(state.size, 5);
});

test("readDeclaredState throws on nonzero exit", () => {
  const run: CodexRunner = () => ({ stdout: "", stderr: "boom", exitCode: 1 });
  assert.throws(() => readDeclaredState(run), /features list failed/);
});

test("featuresToEnable returns only not-already-true flags", () => {
  const state = new Map<string, boolean>([
    ["multi_agent", true],
    ["multi_agent_v2", true],
    ["goals", true],
    ["hooks", false],
    ["default_mode_request_user_input", false],
  ]);
  assert.deepEqual(featuresToEnable(state), ["hooks", "default_mode_request_user_input"]);
});

test("featuresToEnable on the real all-enabled-but-soft state enables only the soft flag", () => {
  // With the corrected parser, a dev2 machine (multi_agent/v2/goals/hooks true, dmrui false) must
  // yield ONLY default_mode_request_user_input to enable — no redundant multi_agent/hooks writes.
  const run: CodexRunner = () => ({ stdout: REAL_FEATURES_LIST, stderr: "", exitCode: 0 });
  const state = readDeclaredState(run);
  assert.deepEqual(featuresToEnable(state), ["default_mode_request_user_input"]);
});
