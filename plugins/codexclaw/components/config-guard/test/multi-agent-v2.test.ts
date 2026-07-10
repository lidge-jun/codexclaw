import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isMultiAgentV2Enabled,
  readMultiAgentV2State,
  setMultiAgentV2State,
} from "../src/multi-agent-v2.ts";
import type { CodexRunner } from "../src/features.ts";

function setup() {
  const home = mkdtempSync(join(tmpdir(), "cxc-mav2-"));
  return { home, configPath: join(home, "config.toml") };
}

function fakeCodex(configPath: string) {
  const calls: string[][] = [];
  const run: CodexRunner = (args) => {
    calls.push([...args]);
    if (args[0] === "features" && args[1] === "enable" && args[2] === "multi_agent_v2") {
      writeFileSync(configPath, "[features]\nmulti_agent_v2 = true\n", "utf8");
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (args[0] === "features" && args[1] === "disable" && args[2] === "multi_agent_v2") {
      writeFileSync(configPath, "[features]\nmulti_agent_v2 = false\n", "utf8");
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "unknown command", exitCode: 1 };
  };
  return { run, calls };
}

test("isMultiAgentV2Enabled reads table, scalar, inline, and missing forms", () => {
  const { home, configPath } = setup();

  writeFileSync(configPath, "[features.multi_agent_v2]\nenabled = true\n", "utf8");
  assert.equal(isMultiAgentV2Enabled(configPath), true);

  writeFileSync(configPath, "[features]\nmulti_agent_v2 = true\n", "utf8");
  assert.equal(isMultiAgentV2Enabled(configPath), true);

  writeFileSync(configPath, "[features]\nmulti_agent_v2 = { enabled = true, max_concurrent_threads_per_session = 4 }\n", "utf8");
  assert.equal(isMultiAgentV2Enabled(configPath), true);

  writeFileSync(configPath, "[features]\nmulti_agent_v2 = false\n", "utf8");
  assert.deepEqual(readMultiAgentV2State({ run: fakeCodex(configPath).run, codexHome: home, configPath }), {
    version: "v1",
    v2Enabled: false,
    appliesTo: "flag-fallback models only",
    catalogPinned: {
      v2: ["gpt-5.6-sol", "gpt-5.6-terra"],
      v1: ["gpt-5.6-luna"],
    },
    effectiveFrom: "new sessions",
  });
});

test("setMultiAgentV2State toggles through codex features and preserves table settings", () => {
  const { home, configPath } = setup();
  writeFileSync(
    configPath,
    [
      "[features.multi_agent_v2]",
      "enabled = false",
      "max_concurrent_threads_per_session = 7",
      "",
    ].join("\n"),
    "utf8",
  );
  const fake = fakeCodex(configPath);

  const enabled = setMultiAgentV2State({ run: fake.run, codexHome: home, configPath }, "v2");
  assert.deepEqual(enabled, {
    version: "v2",
    v2Enabled: true,
    changed: true,
    appliesTo: "flag-fallback models only",
    catalogPinned: {
      v2: ["gpt-5.6-sol", "gpt-5.6-terra"],
      v1: ["gpt-5.6-luna"],
    },
    effectiveFrom: "new sessions",
  });
  assert.deepEqual(fake.calls, [["features", "enable", "multi_agent_v2"]]);
  assert.match(readFileSync(configPath, "utf8"), /\[features\.multi_agent_v2\]\nenabled = true\nmax_concurrent_threads_per_session = 7/);

  const disabled = setMultiAgentV2State({ run: fake.run, codexHome: home, configPath }, "v1");
  assert.equal(disabled.version, "v1");
  assert.equal(disabled.v2Enabled, false);
  assert.equal(disabled.changed, true);
  assert.equal(disabled.appliesTo, "flag-fallback models only");
  assert.equal(disabled.effectiveFrom, "new sessions");
  assert.deepEqual(fake.calls[1], ["features", "disable", "multi_agent_v2"]);
  assert.match(readFileSync(configPath, "utf8"), /\[features\.multi_agent_v2\]\nenabled = false\nmax_concurrent_threads_per_session = 7/);
});
