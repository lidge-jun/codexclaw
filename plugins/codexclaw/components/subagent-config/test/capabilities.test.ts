/**
 * capabilities.test.ts — runtime capability resolution tests (issue #7).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectSpawnSurface,
  detectToolCapabilities,
  resolveConcurrency,
  resolveCapabilities,
} from "../src/capabilities.ts";

// --- spawn surface ---

test("detectSpawnSurface: defaults to v2", () => {
  assert.equal(detectSpawnSurface({}), "v2");
});

test("detectSpawnSurface: CODEXCLAW_SPAWN_V1=1 forces v1", () => {
  assert.equal(detectSpawnSurface({ CODEXCLAW_SPAWN_V1: "1" }), "v1");
});

test("detectSpawnSurface: CODEXCLAW_SPAWN_V1=0 stays v2", () => {
  assert.equal(detectSpawnSurface({ CODEXCLAW_SPAWN_V1: "0" }), "v2");
});

test("detectSpawnSurface: a V1-only tool list selects v1", () => {
  assert.equal(detectSpawnSurface({}, ["spawn_agent", "wait_agent", "send_input", "close_agent"]), "v1");
});

test("detectSpawnSurface: a V2-only tool list selects v2", () => {
  assert.equal(detectSpawnSurface({}, ["spawn_agent", "followup_task", "send_message"]), "v2");
});

test("detectSpawnSurface: the V2 namespace is concatenated without punctuation", () => {
  assert.equal(detectSpawnSurface({}, ["collaborationspawn_agent", "collaborationfollowup_task"]), "v2");
  assert.equal(detectSpawnSurface({}, ["collaboration.followup_task"]), "v2");
  assert.equal(detectSpawnSurface({}, ["collaboration_followup_task"]), "v2");
});

test("detectSpawnSurface: a namespaced V1 catalog still selects v1", () => {
  assert.equal(detectSpawnSurface({}, ["multi_agent_v1.send_input", "multi_agent_v1.close_agent"]), "v1");
  // The model-facing catalog form measured live in Codex Desktop on 2026-09-13.
  assert.equal(detectSpawnSurface({}, ["multi_agent_v1__spawn_agent", "multi_agent_v1__close_agent"]), "v1");
});

test("detectSpawnSurface: shared tools prove nothing, so the default stands", () => {
  // spawn_agent and wait_agent are registered by both families.
  assert.equal(detectSpawnSurface({}, ["spawn_agent", "wait_agent"]), "v2");
});

test("detectSpawnSurface: an empty list is no evidence, not a V1 signal", () => {
  assert.equal(detectSpawnSurface({}, []), "v2");
});

test("detectSpawnSurface: the env override beats a V2 tool list", () => {
  assert.equal(detectSpawnSurface({ CODEXCLAW_SPAWN_V1: "1" }, ["followup_task"]), "v1");
});

test("detectToolCapabilities: a namespaced V2 name still resolves", () => {
  const caps = detectToolCapabilities(["collaborationfollowup_task"]);
  assert.equal(caps.followup_task.available, true);
  assert.equal(caps.followup_task.source, "native");
  assert.equal(caps.spawn_agent.available, false);
});

test("resolveCapabilities: forwards the tool list to surface detection", () => {
  const caps = resolveCapabilities({ env: {}, exposedTools: ["spawn_agent", "send_input", "close_agent"] });
  assert.equal(caps.spawnSurface, "v1");
});
// --- tool capabilities ---

test("detectToolCapabilities: no tool list -> all available (fail-open)", () => {
  const caps = detectToolCapabilities();
  assert.equal(caps.web_search.available, true);
  assert.equal(caps.browser.available, true);
  assert.equal(caps.spawn_agent.available, true);
  assert.equal(caps.web_search.source, null);
});

test("detectToolCapabilities: explicit list marks absent tools unavailable", () => {
  const caps = detectToolCapabilities(["web_search", "apply_patch"]);
  assert.equal(caps.web_search.available, true);
  assert.equal(caps.web_search.source, "native");
  assert.equal(caps.browser.available, false);
  assert.equal(caps.spawn_agent.available, false);
});

test("detectToolCapabilities: empty list marks all unavailable", () => {
  const caps = detectToolCapabilities([]);
  assert.equal(caps.web_search.available, false);
  assert.equal(caps.followup_task.available, false);
});

// --- concurrency ---

test("resolveConcurrency: defaults to 4 agents, 3 searches", () => {
  const limits = resolveConcurrency({});
  assert.equal(limits.maxConcurrentAgents, 4);
  assert.equal(limits.maxConcurrentSearches, 3);
});

test("resolveConcurrency: env overrides", () => {
  const limits = resolveConcurrency({
    CODEXCLAW_MAX_AGENTS: "8",
    CODEXCLAW_MAX_SEARCHES: "1",
  });
  assert.equal(limits.maxConcurrentAgents, 8);
  assert.equal(limits.maxConcurrentSearches, 1);
});

test("resolveConcurrency: malformed env values fall back to defaults", () => {
  const limits = resolveConcurrency({
    CODEXCLAW_MAX_AGENTS: "not-a-number",
    CODEXCLAW_MAX_SEARCHES: "-5",
  });
  assert.equal(limits.maxConcurrentAgents, 4);
  assert.equal(limits.maxConcurrentSearches, 3);
});

// --- full resolve ---

test("resolveCapabilities: integrates all subsystems", () => {
  const caps = resolveCapabilities({
    env: { CODEXCLAW_SPAWN_V1: "1" },
    exposedTools: ["web_search", "exec_command"],
    modelIds: ["gpt-5.5", "gpt-5.4"],
    ocxActive: true,
  });
  assert.equal(caps.spawnSurface, "v1");
  assert.equal(caps.tools.web_search.available, true);
  assert.equal(caps.tools.browser.available, false);
  assert.equal(caps.ocxActive, true);
  assert.deepEqual(caps.modelIds, ["gpt-5.5", "gpt-5.4"]);
  assert.equal(caps.concurrency.maxConcurrentAgents, 4);
});

test("resolveCapabilities: defaults produce a valid snapshot", () => {
  const caps = resolveCapabilities({ env: {} });
  assert.equal(caps.spawnSurface, "v2");
  assert.equal(caps.ocxActive, false);
  assert.deepEqual(caps.modelIds, []);
  assert.equal(caps.tools.web_search.available, true); // fail-open
});

test("resolveCapabilities: unsupported state (no tools, no models)", () => {
  const caps = resolveCapabilities({
    env: {},
    exposedTools: [],
    modelIds: [],
    ocxActive: false,
  });
  assert.equal(caps.tools.web_search.available, false);
  assert.equal(caps.tools.spawn_agent.available, false);
  assert.deepEqual(caps.modelIds, []);
});
