import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const cli = join(repoRoot, "bin", "codexclaw.mjs");

test("top-level CLI usage advertises disable", () => {
  const out = execFileSync("node", [cli, "help"], { cwd: repoRoot, encoding: "utf8" });
  assert.match(out, /<[^>\n]*\bdisable\b[^>\n]*>/);
});
