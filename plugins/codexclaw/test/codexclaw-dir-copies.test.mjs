import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

test("issue255: project-local directory helpers remain byte-identical across independently built components", () => {
  const components = join(dirname(fileURLToPath(import.meta.url)), "..", "components");
  const names = ["pabcd-state", "cxc-ops", "bg-wake", "subagent-config", "messenger-bridge"];
  const copies = names.map((name) => readFileSync(join(components, name, "src", "codexclaw-dir.ts")));
  for (let i = 1; i < copies.length; i++) assert.deepEqual(copies[i], copies[0], names[i]);
});
