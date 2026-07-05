import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheDir, cachedFetchText } from "../src/cache.ts";

test("cacheDir honors CODEXCLAW_HOME and defaults to ~/.codexclaw", () => {
  assert.equal(cacheDir({ CODEXCLAW_HOME: "/tmp/cxh" }), join("/tmp/cxh", "skill-cache"));
  assert.ok(cacheDir({}).endsWith(join(".codexclaw", "skill-cache")));
});

test("fresh cache within TTL is served without fetching", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-skc-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "k.cache"), "cached");
  let fetched = 0;
  const res = await cachedFetchText("k", async () => { fetched++; return "net"; }, { dir });
  assert.equal(res.text, "cached");
  assert.equal(fetched, 0);
});

test("expired cache refetches and rewrites", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-skc-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "k.cache");
  writeFileSync(file, "old");
  const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
  utimesSync(file, past, past);
  const res = await cachedFetchText("k", async () => "new", { dir });
  assert.equal(res.text, "new");
  assert.equal(readFileSync(file, "utf8"), "new");
});

test("network failure falls back to stale cache; total miss rethrows", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-skc-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "k.cache");
  writeFileSync(file, "stale");
  const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
  utimesSync(file, past, past);
  const res = await cachedFetchText("k", async () => { throw new Error("offline"); }, { dir });
  assert.equal(res.text, "stale");
  assert.equal(res.stale, true);
  await assert.rejects(
    cachedFetchText("missing", async () => { throw new Error("offline"); }, { dir }),
    /offline/,
  );
});
