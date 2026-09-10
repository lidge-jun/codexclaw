/**
 * format-freshness.test.ts — wp6 item 3: the memory search text output carries
 * an age per hit and points a superseded hit at the newer record of the same
 * topic. Labels only: ranking belongs to memory-search's rankAndTrim, and this
 * suite pins that the formatter never reorders what it was handed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ageDays, formatMemoryResult, newerRelpath } from "../src/format.ts";
import type { MemoryHit, MemorySearchResult } from "../src/memory-search.ts";

const NOW = Date.parse("2026-09-10T00:00:00Z");
const DAY = 86_400_000;

function hit(
  partial: Partial<MemoryHit> & Pick<MemoryHit, "relpath" | "excerpt" | "updatedAt">,
): MemoryHit {
  return {
    origin: "file",
    kind: "handbook",
    threadId: null,
    startLine: 1,
    cwd: null,
    score: 1,
    ...partial,
  };
}

function resultOf(hits: MemoryHit[]): MemorySearchResult {
  return { hits, warnings: [], scannedFiles: hits.length, elapsedMs: 1 };
}

test("ageDays: ISO stamps become whole days, anything unusable stays unlabeled", () => {
  assert.equal(ageDays(new Date(NOW - 3 * DAY).toISOString(), NOW), 3);
  assert.equal(ageDays(new Date(NOW - 3 * DAY - 1000).toISOString(), NOW), 3, "floors, not rounds");
  assert.equal(ageDays(new Date(NOW).toISOString(), NOW), 0);
  assert.equal(ageDays(new Date(NOW + 5 * DAY).toISOString(), NOW), 0, "a future stamp is not negative");
  assert.equal(ageDays(null, NOW), null);
  assert.equal(ageDays("not a date", NOW), null);
});

test("a hit without a timestamp carries no age label", () => {
  const text = formatMemoryResult(
    resultOf([hit({ relpath: "MEMORY.md", excerpt: "no stamp here", updatedAt: null })]),
    NOW,
  );
  assert.doesNotMatch(text, /\[age:/);
  assert.match(text, /MEMORY\.md/);
});

test("the older same-topic hit points at the newer relpath, and order is unchanged", () => {
  const older = hit({
    relpath: "rollout_summaries/old.md",
    excerpt: "2.49.0 provenance check",
    updatedAt: new Date(NOW - 14 * DAY).toISOString(),
    score: 9,
  });
  const newer = hit({
    relpath: "MEMORY.md",
    excerpt: "2.49.0 provenance verified",
    updatedAt: new Date(NOW - 1 * DAY).toISOString(),
    score: 3,
  });
  // Ranking already put the older, higher-scoring hit first; that is the case
  // the label exists for.
  const hits = [older, newer];
  assert.equal(newerRelpath(older, hits), "MEMORY.md");
  assert.equal(newerRelpath(newer, hits), null);

  const before = hits.map((h) => h.relpath);
  const text = formatMemoryResult(resultOf(hits), NOW);
  assert.deepEqual(hits.map((h) => h.relpath), before, "format must not reorder or mutate hits");
  const first = text.indexOf("rollout_summaries/old.md");
  const second = text.indexOf("MEMORY.md");
  assert.ok(first >= 0 && second > first, "the rendered order follows the input order");
  assert.match(text, /\[age: 14d\]/);
  assert.match(text, /\[age: 1d\]/);
  assert.match(text, /\[newer: MEMORY\.md\]/);
  assert.equal((text.match(/\[newer:/g) ?? []).length, 1, "only the superseded hit is labelled");
});

test("hits that share no distinctive token are not called corrections of each other", () => {
  const alpha = hit({
    relpath: "a.md",
    excerpt: "alpha notes about the intake form",
    updatedAt: new Date(NOW - 30 * DAY).toISOString(),
  });
  const beta = hit({
    relpath: "b.md",
    excerpt: "beta notes about the outbox",
    updatedAt: new Date(NOW - 2 * DAY).toISOString(),
  });
  assert.equal(newerRelpath(alpha, [alpha, beta]), null);
  assert.doesNotMatch(formatMemoryResult(resultOf([alpha, beta]), NOW), /\[newer:/);
});

test("a newer hit in the SAME file is a longer record, not a correction", () => {
  const first = hit({
    relpath: "MEMORY.md",
    excerpt: "2.49.0 provenance check",
    updatedAt: new Date(NOW - 9 * DAY).toISOString(),
  });
  const second = hit({
    relpath: "MEMORY.md",
    excerpt: "2.49.0 provenance rerun",
    updatedAt: new Date(NOW - 1 * DAY).toISOString(),
    startLine: 40,
  });
  assert.equal(newerRelpath(first, [first, second]), null);
});

test("the existing envelope survives: header, location, excerpt, delimiter, warnings", () => {
  const text = formatMemoryResult(
    {
      hits: [
        hit({
          relpath: "MEMORY.md",
          excerpt: "wp6 recall labels",
          updatedAt: new Date(NOW - 2 * DAY).toISOString(),
          startLine: 12,
          cwd: "/repo/current",
        }),
      ],
      warnings: ["index is stale"],
      scannedFiles: 4,
      elapsedMs: 7,
    },
    NOW,
  );
  assert.match(text, /^# 1 memory hits \(4 files scanned, 7ms\)/);
  assert.match(text, /\(file\/handbook\) MEMORY\.md:12 \[2026-09-08T00:00:00\.000Z\] \{\/repo\/current\} \[age: 2d\]/);
  assert.match(text, /^wp6 recall labels$/m);
  assert.match(text, /^---$/m);
  assert.match(text, /index is stale/);

  const empty = formatMemoryResult(resultOf([]), NOW);
  assert.match(empty, /^# 0 memory hits/);
  assert.match(empty, /\(no matches\)/);
});
