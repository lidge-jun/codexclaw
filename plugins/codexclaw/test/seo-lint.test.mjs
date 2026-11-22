// seo-lint.test.mjs — dev-design seo-lint fixtures (SEO-*/GEO-*). Static, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "skills", "dev-design", "scripts");
const fx = join(scripts, "fixtures", "seo");
const { lintSeo, lintRobots, lintSitemap, visibleText } = await import(pathToFileURL(join(scripts, "seo-lint.mjs")).href);
const read = (...p) => readFileSync(join(fx, ...p), "utf8");
const ids = (fs, level) => new Set(fs.filter((f) => !level || f.level === level).map((f) => f.id));

test("seo-lint bad page: FAIL only for objective breakage, the rest advisory", () => {
  const fs = lintSeo("bad.html", read("bad", "index.html"));
  assert.deepEqual([...ids(fs, "FAIL")].sort(), ["SEO-JSONLD-01", "SEO-META-01"], "FAIL = no title, broken JSON-LD, invisible FAQ");
  assert.ok(fs.filter((f) => f.level === "FAIL" && f.id === "SEO-META-01").every((f) => /title/.test(f.message)));
  const warn = ids(fs, "WARN");
  for (const id of ["SEO-STRUCTURE-01", "GEO-VISIBLE-01", "GEO-AGENT-01"]) assert.ok(warn.has(id), `expected WARN ${id}, got ${[...warn]}`);
});

test("seo-lint good page has no FAIL or WARN", () => {
  const fs = lintSeo("good.html", read("good", "index.html")).filter((f) => f.level !== "INFO");
  assert.deepEqual(fs, [], JSON.stringify(fs, null, 1));
});

test("seo-lint robots: blocking a search bot fails, training opt-out passes, retired tokens noted", () => {
  const bad = lintRobots("robots.txt", read("bad", "robots.txt"));
  assert.ok(bad.some((f) => f.level === "FAIL" && /OAI-SearchBot/.test(f.message)));
  assert.ok(bad.some((f) => f.level === "INFO" && /anthropic-ai/.test(f.message)));
  assert.deepEqual(lintRobots("robots.txt", read("good", "robots.txt")).filter((f) => f.level !== "INFO"), []);
  assert.ok(lintRobots("r", "User-agent: *\nDisallow: /\n").some((f) => f.level === "FAIL" && /Googlebot/.test(f.message)));
});

test("seo-lint sitemap: lastmod required, changefreq/priority noted", () => {
  assert.ok(lintSitemap("s", read("bad", "sitemap.xml")).some((f) => f.level === "WARN"));
  assert.deepEqual(lintSitemap("s", read("good", "sitemap.xml")), []);
});

test("seo-lint: JSON-LD facts must be visible; visible text ignores hidden and script content", () => {
  const html = (body) => `<html lang="en"><head><title>t</title><script type="application/ld+json">{"@type":"Product","name":"Tallow Desk","offers":{"price":"480"}}</script></head><body><main><h1>x</h1>${body}</main></body></html>`;
  assert.ok(lintSeo("a", html("<p>nothing</p>")).some((f) => f.id === "GEO-VISIBLE-01" && /price/.test(f.message)));
  assert.ok(!lintSeo("b", html("<p>Tallow Desk costs $480.</p>")).some((f) => f.id === "GEO-VISIBLE-01"));
  assert.equal(visibleText(`<p>a</p><div hidden>b</div><script>c</script>`), "a");
});

test("seo-lint every id is defined in seo-baseline.md", () => {
  const ref = readFileSync(join(here, "..", "skills", "dev-design", "references", "build", "seo-baseline.md"), "utf8");
  const all = [...lintSeo("b", read("bad", "index.html")), ...lintRobots("r", read("bad", "robots.txt")), ...lintSitemap("s", read("bad", "sitemap.xml"))];
  for (const id of ids(all)) assert.ok(ref.includes(id), `undefined id ${id}`);
});

test("seo-lint CLI exit codes: 1 on FAIL, 0 on clean, 3 on missing input", () => {
  const cli = join(scripts, "seo-lint.mjs");
  assert.equal(spawnSync(process.execPath, [cli, join(fx, "bad")]).status, 1);
  assert.equal(spawnSync(process.execPath, [cli, join(fx, "good")]).status, 0);
  assert.equal(spawnSync(process.execPath, [cli, join(fx, "nope.html")]).status, 3);
});
