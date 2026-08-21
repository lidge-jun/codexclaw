/**
 * crlf-config.test.ts - a Windows-authored config.toml must parse identically (wp08).
 *
 * config.toml is foreign input: the user's editor decides its line endings, so
 * every shipped TOML shape is asserted twice, once per EOL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMultiAgentV2Enabled, readMultiAgentV2State } from "../src/multi-agent-v2.ts";
import type { CodexRunner } from "../src/features.ts";

const SHAPES: Array<{ name: string; toml: string; enabled: boolean }> = [
  { name: "table form", toml: "[features.multi_agent_v2]\nenabled = true\n", enabled: true },
  { name: "table form disabled", toml: "[features.multi_agent_v2]\nenabled = false\n", enabled: false },
  { name: "scalar form", toml: "[features]\nmulti_agent_v2 = true\n", enabled: true },
  { name: "inline form", toml: "[features]\nmulti_agent_v2 = { enabled = true }\n", enabled: true },
  {
    name: "table followed by another table",
    toml: "[features.multi_agent_v2]\nenabled = true\n\n[other]\nkey = 1\n",
    enabled: true,
  },
  { name: "no features table", toml: "[model]\nname = \"gpt\"\n", enabled: false },
];

const noopRun: CodexRunner = () => ({ stdout: "", stderr: "", exitCode: 0 });

function writeConfig(text: string): string {
  const home = mkdtempSync(join(tmpdir(), "cxc-crlf-cfg-"));
  const path = join(home, "config.toml");
  writeFileSync(path, text, "utf8");
  return path;
}

for (const shape of SHAPES) {
  test("a CRLF config.toml parses identically to LF: " + shape.name, () => {
    const lf = writeConfig(shape.toml);
    const crlf = writeConfig(shape.toml.replace(/\n/g, "\r\n"));

    assert.equal(isMultiAgentV2Enabled(lf), shape.enabled, "LF baseline");
    assert.equal(isMultiAgentV2Enabled(crlf), isMultiAgentV2Enabled(lf), "CRLF must agree with LF");
    assert.deepEqual(
      readMultiAgentV2State({ run: noopRun, codexHome: "", configPath: crlf }),
      readMultiAgentV2State({ run: noopRun, codexHome: "", configPath: lf }),
      "the reported state must not depend on line endings",
    );
  });
}

test("a CRLF table body does not leak a CR into the parsed value", () => {
  // The table-header regex's \s happened to eat the CR, so this fixture is the
  // one that proves the fix rather than the accident (002 B9).
  const crlf = writeConfig("[features.multi_agent_v2]\r\nenabled = true\r\n[other]\r\n");
  assert.equal(isMultiAgentV2Enabled(crlf), true);
});
