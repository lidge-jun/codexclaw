// Keep the human-facing skill catalog aligned with the lazy-loaded on-disk tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const skillsDir = join(pluginRoot, "skills");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function skillDirectories() {
  return readdirSync(skillsDir)
    .filter((name) => {
      const dir = join(skillsDir, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"));
    })
    .sort();
}

test("skill README names every on-disk SKILL.md directory", () => {
  const readme = readFileSync(join(skillsDir, "README.md"), "utf8");
  const missing = skillDirectories().filter((name) => {
    const token = new RegExp(`\\\`${escapeRegex(name)}(?:/)?\\\``);
    return !token.test(readme);
  });

  assert.deepEqual(
    missing,
    [],
    `skills/README.md omits skill directories: ${missing.join(", ")}`,
  );
});

test("skill README has no bullet for a missing skill directory", () => {
  const readme = readFileSync(join(skillsDir, "README.md"), "utf8");
  const actual = new Set(skillDirectories());
  const listed = [...readme.matchAll(/^- `([a-z0-9-]+)\/`/gm)].map((match) => match[1]);
  const phantom = listed.filter((name) => !actual.has(name));

  assert.deepEqual(
    phantom,
    [],
    `skills/README.md names missing skill directories: ${phantom.join(", ")}`,
  );
});
