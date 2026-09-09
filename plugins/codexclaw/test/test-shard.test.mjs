// Sharding contract of scripts/test.mjs: deterministic partition, no gaps, no overlap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expandPatterns, parseShard, shardFiles, splitArgs, toPosix } from "../scripts/test.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

function packageTestPatterns() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const script = pkg.scripts.test;
  assert.match(script, /scripts\/test\.mjs/, "package.json test script must go through scripts/test.mjs");
  return (script.match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1));
}

test("parseShard accepts i/n within range and rejects everything else", () => {
  assert.deepEqual(parseShard("1/2"), { index: 1, total: 2 });
  assert.deepEqual(parseShard("6/6"), { index: 6, total: 6 });
  for (const bad of ["0/2", "3/2", "2", "a/b", "", undefined, "1/0", "-1/2"]) {
    assert.throws(() => parseShard(bad), /--shard/);
  }
});

test("splitArgs strips --shard in both spellings and keeps patterns in order", () => {
  assert.deepEqual(splitArgs(["a/*.mjs", "--shard", "2/3", "b/*.ts"]), { patterns: ["a/*.mjs", "b/*.ts"], shard: { index: 2, total: 3 } });
  assert.deepEqual(splitArgs(["--shard=1/1", "x.mjs"]), { patterns: ["x.mjs"], shard: { index: 1, total: 1 } });
  assert.deepEqual(splitArgs(["x.mjs"]), { patterns: ["x.mjs"], shard: null });
});

test("shardFiles partitions a sorted list: union is the whole, shards are disjoint, order is separator-agnostic", () => {
  const posix = ["z/1.test.mjs", "a/3.test.mjs", "m/2.test.mjs", "a/1.test.mjs", "q/9.test.mjs"];
  const windows = posix.map((f) => f.replaceAll("/", "\\"));
  for (const total of [1, 2, 3, 5]) {
    const shards = Array.from({ length: total }, (_, i) => shardFiles(posix, i + 1, total));
    const union = shards.flat();
    assert.equal(union.length, posix.length, "no gaps and no duplicates for n=" + total);
    assert.deepEqual([...new Set(union)].sort(), [...posix].sort());
    for (let i = 0; i < total; i++) {
      assert.deepEqual(shards[i], shardFiles(windows, i + 1, total), "Windows separators must not change the assignment");
    }
  }
  assert.throws(() => shardFiles(posix, 6, 6), /empty/);
  assert.equal(toPosix("a\\b\\c.mjs"), "a/b/c.mjs");
});

test("the real package.json patterns expand to a non-empty, stable list that two shards cover exactly", () => {
  const patterns = packageTestPatterns();
  assert.ok(patterns.length >= 5, "expected the multi-pattern test script, got " + patterns.length);
  for (const pattern of patterns) {
    assert.ok(expandPatterns([pattern], repoRoot).length > 0, "pattern matches nothing: " + pattern);
  }
  const all = expandPatterns(patterns, repoRoot);
  assert.ok(all.length > 100, "suite is smaller than expected: " + all.length);
  assert.deepEqual(all, [...all].sort(), "expansion is sorted");
  assert.deepEqual(all, expandPatterns(patterns, repoRoot), "expansion is deterministic");
  const s1 = shardFiles(all, 1, 2);
  const s2 = shardFiles(all, 2, 2);
  assert.equal(s1.length + s2.length, all.length);
  assert.deepEqual([...s1, ...s2].sort(), all);
  assert.equal(s1.filter((f) => s2.includes(f)).length, 0);
});

