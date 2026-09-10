import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const skillMd = readFileSync(join(pluginRoot, "skills", "recall", "SKILL.md"), "utf8");
const cliTs = readFileSync(join(pluginRoot, "components", "recall", "src", "cli.ts"), "utf8");

function flagsIn(text) {
  return [...new Set(text.match(/--[a-z0-9-]+/g) || [])].sort();
}

test("recall SKILL.md Commands fence lists every cli.ts USAGE flag", () => {
  const usage = cliTs.slice(cliTs.indexOf("const USAGE"), cliTs.indexOf("].join"));
  const fence = /## Commands\n\n```\n([\s\S]*?)\n```/.exec(skillMd);
  assert.ok(fence, "SKILL.md has no Commands fence");
  const usageFlags = flagsIn(usage);
  const skillFlags = flagsIn(fence[1]);
  const missing = usageFlags.filter((f) => !skillFlags.includes(f));
  assert.deepEqual(missing, [], `USAGE flags missing from SKILL synopsis: ${missing.join(" ")}`);
});

test("recall SKILL.md no longer claims empty answers are impossible", () => {
  assert.doesNotMatch(skillMd, /empty answer is never the outcome/i);
  assert.doesNotMatch(skillMd, /never modify anything/i);
  assert.match(skillMd, /0 \(full history\) for memory/);
  assert.match(skillMd, /chat index only/i);
  assert.match(skillMd, /Do not use `--any` on a long/);
});
