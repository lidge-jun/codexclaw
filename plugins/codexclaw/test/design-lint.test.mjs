// design-lint.test.mjs — dev-design ui-lint / copy-lint fixtures (static mode).
// Good fixtures and the dev-visualizer assets must produce no FAIL; bad fixtures must
// produce their expected rule ids. Render mode is exercised only when playwright-core can
// be imported, and then only asserts it never reports a pass when it did not run.
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "skills", "dev-design", "scripts");
const fx = join(scripts, "fixtures");
const { lintStatic } = await import(pathToFileURL(join(scripts, "ui-lint.mjs")).href);
const { lintCopy } = await import(pathToFileURL(join(scripts, "copy-lint.mjs")).href);

const run = (name, file) => {
  const text = readFileSync(file, "utf8");
  return [...lintStatic(name, text), ...lintCopy(name, text, { year: 2026 })];
};
const ids = (fs, level) => new Set(fs.filter((f) => !level || f.level === level).map((f) => f.id));

const BAD = {
  "left-accent-card.html": ["FE-SIDE-ACCENT-01"],
  "color-only-edge.html": ["FE-SIDE-ACCENT-01"],
  "rtl-inline-start.html": ["FE-SIDE-ACCENT-01"],
  "colored-buttons.html": ["FE-COLOR-RESTRAINT-01"],
  "brand-two-hues.html": ["FE-COLOR-RESTRAINT-01"],
  "gradient-text.html": ["FE-GRADIENT-TEXT-01", "FE-GRADIENT-02"],
  "transition-all.html": ["FE-AI-TELL-01"],
  "ai-residue-copy.html": ["copy-residue", "copy-default-cast", "copy-invented-figure", "copy-stale-year", "copy-meta", "copy-em-dash", "copy-stock-phrase"],
  "korean-translationese.html": ["copy-translationese-ko", "copy-imperative-chain-ko", "copy-honorific-overuse-ko", "copy-hype-word"],
};

for (const [name, expected] of Object.entries(BAD)) {
  test(`design-lint bad/${name} reports ${expected.join(", ")}`, () => {
    const got = ids(run(name, join(fx, "bad", name)));
    for (const id of expected) assert.ok(got.has(id), `${name}: expected ${id}, got ${[...got].join(", ")}`);
  });
}

for (const name of readdirSync(join(fx, "good"))) {
  test(`design-lint good/${name} has no FAIL or WARN`, () => {
    const fs = run(name, join(fx, "good", name)).filter((f) => f.level !== "INFO");
    assert.deepEqual(fs, [], JSON.stringify(fs, null, 1));
  });
}

test("design-lint: owner-register devices are not flagged", () => {
  const fs = run("korean-hero.html", join(fx, "good", "korean-hero.html"));
  for (const id of ["copy-contrast", "copy-two-fragment", "copy-imperative-chain-ko"]) assert.ok(!ids(fs).has(id), id);
});

test("design-lint: dev-visualizer assets pass (no FAIL)", () => {
  const dir = join(here, "..", "skills", "dev-visualizer", "assets");
  for (const n of readdirSync(dir).filter((n) => n.endsWith(".html"))) {
    const fails = run(n, join(dir, n)).filter((f) => f.level === "FAIL");
    assert.deepEqual(fails, [], `${n}: ${JSON.stringify(fails)}`);
  }
});

test("design-lint: every reported id is defined in dev-design references", () => {
  const refs = join(here, "..", "skills", "dev-design", "references");
  const corpus = ["build/anti-slop.md", "build/color-system.md", "build/slop-consensus-2026.md", "build/anti-slop-enforcement.md", "build/visual-audit-loop.md", "copy/copy-tells.md"].map((p) => readFileSync(join(refs, p), "utf8")).join("\n");
  const seen = new Set();
  for (const dir of ["bad", "good"]) for (const n of readdirSync(join(fx, dir))) for (const f of run(n, join(fx, dir, n))) seen.add(f.id);
  for (const id of seen) assert.ok(corpus.includes(id), `undefined rule id ${id}`);
  for (const id of ["FE-VISUAL-AUDIT-02", "FE-TYPO-FLOOR-01", "FE-COLOR-CONTRAST-01"]) assert.ok(corpus.includes(id) || readFileSync(join(refs, "build/color-system.md"), "utf8").includes(id), id);
});

test("design-lint CLI exit codes: 1 on FAIL, 0 on clean, 3 on missing input", () => {
  const ui = join(scripts, "ui-lint.mjs");
  assert.equal(spawnSync(process.execPath, [ui, join(fx, "bad", "left-accent-card.html")]).status, 1);
  assert.equal(spawnSync(process.execPath, [ui, join(fx, "good", "neutral-buttons.html")]).status, 0);
  assert.equal(spawnSync(process.execPath, [ui, join(fx, "nope.html")]).status, 3);
  const cp = join(scripts, "copy-lint.mjs");
  assert.equal(spawnSync(process.execPath, [cp, "--year", "2026", join(fx, "bad", "korean-translationese.html")]).status, 2);
  const js = spawnSync(process.execPath, [ui, "--json", join(fx, "bad", "colored-buttons.html")], { encoding: "utf8" });
  assert.ok(JSON.parse(js.stdout).findings.some((f) => f.id === "FE-COLOR-RESTRAINT-01"));
});

test("design-lint --render: hover contrast and rails, or NOT_RUN with exit 3", () => {
  const ui = join(scripts, "ui-lint.mjs");
  const good = spawnSync(process.execPath, [ui, "--render", join(fx, "good", "neutral-buttons.html")], { encoding: "utf8", timeout: 120000 });
  if (/NOT_RUN/.test(good.stdout)) { assert.equal(good.status, 3); return; }
  assert.equal(good.status, 0, good.stdout);
  const bad = spawnSync(process.execPath, [ui, "--render", "--json", join(fx, "render-only-hover-contrast.html"), join(fx, "bad", "left-accent-card.html")], { encoding: "utf8", timeout: 120000 });
  const got = JSON.parse(bad.stdout).findings.filter((f) => f.line === 0).map((f) => f.id);
  assert.ok(got.includes("FE-COLOR-CONTRAST-01"), bad.stdout);
  assert.ok(got.includes("FE-SIDE-ACCENT-01"), bad.stdout);
});
