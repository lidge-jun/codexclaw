/**
 * ranking.test.ts — WP1 kind-priority + recency-half-life ranking for memory
 * search. Pure-function tests pin the constants; the integration test builds an
 * ISOLATED temp home (reviewer warning #3: never mutate the shared fixture
 * home's mtimes) and controls file mtimes with utimesSync.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  searchMemory,
  kindOfRelpath,
  recencyBoost,
  finalScore,
  KIND_PRIORITY,
  HALF_LIFE_HOURS,
} from "../src/memory-search.ts";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-07-07T00:00:00Z");

test("kindOfRelpath: classifies every Codex memory artifact", () => {
  assert.equal(kindOfRelpath("memory_summary.md"), "summary");
  assert.equal(kindOfRelpath("MEMORY.md"), "handbook");
  assert.equal(kindOfRelpath("raw_memories.md"), "raw");
  assert.equal(kindOfRelpath("skills/deploy/SKILL.md"), "skill");
  assert.equal(kindOfRelpath("extensions/notes.md"), "extension");
  assert.equal(kindOfRelpath("rollout_summaries/abc.md"), "rollout");
  assert.equal(kindOfRelpath("random.md"), "other");
  assert.equal(kindOfRelpath("anything", "stage1"), "stage1");
});

test("recencyBoost: half-life decay, infinite kinds, clamps and stale penalty", () => {
  // Curated kinds never decay and never gain.
  assert.equal(recencyBoost("summary", NOW - 1000 * HOUR, NOW), 0);
  assert.equal(recencyBoost("handbook", NOW - 1000 * HOUR, NOW), 0);
  assert.equal(recencyBoost("skill", NOW - 1000 * HOUR, NOW), 0);
  // Fresh rollout gets the full +1.5; one half-life later exactly half.
  assert.equal(recencyBoost("rollout", NOW, NOW), 1.5);
  const oneHalfLife = recencyBoost("rollout", NOW - HALF_LIFE_HOURS.rollout * HOUR, NOW);
  assert.ok(Math.abs(oneHalfLife - 0.75) < 1e-9, `half-life midpoint, got ${oneHalfLife}`);
  // Future timestamps clamp to age 0 (reviewer warning #4), staying in range.
  assert.equal(recencyBoost("rollout", NOW + 500 * HOUR, NOW), 1.5);
  // Unknown timestamp: no boost either way.
  assert.equal(recencyBoost("stage1", null, NOW), 0);
  // Stale rollout beyond 2x half-life goes negative and is capped at -2.
  const stale = recencyBoost("rollout", NOW - HALF_LIFE_HOURS.rollout * 5 * HOUR, NOW);
  assert.ok(stale < 0, `stale rollout must be penalized, got ${stale}`);
  const ancient = recencyBoost("rollout", NOW - HALF_LIFE_HOURS.rollout * 100 * HOUR, NOW);
  assert.ok(ancient >= -2.0 && ancient < -1.9, `penalty caps near -2, got ${ancient}`);
});

test("finalScore: kind priority separates equal text scores", () => {
  const t = 6; // same text relevance everywhere
  const old = NOW - 24 * 365 * HOUR;
  const summary = finalScore(t, "summary", old, NOW);
  const handbook = finalScore(t, "handbook", old, NOW);
  const skill = finalScore(t, "skill", old, NOW);
  const rollout = finalScore(t, "rollout", old, NOW);
  assert.ok(summary > handbook && handbook > skill && skill > rollout);
  const expectedGap = KIND_PRIORITY.summary - (KIND_PRIORITY.rollout - 2.0);
  assert.ok(Math.abs(summary - rollout - expectedGap) < 1e-9, `gap ${summary - rollout} != ${expectedGap}`);
});

test("integration: summary/handbook outrank stale rollouts; fresh rollouts outrank old ones", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-rank-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(join(mem, "rollout_summaries"), { recursive: true });
    const body = "zebra ranking checkpoint\n";
    const files: Array<[string, number]> = [
      ["memory_summary.md", NOW - 24 * 90 * HOUR], // old but curated
      ["MEMORY.md", NOW - 24 * 90 * HOUR],
      ["rollout_summaries/fresh.md", NOW - 2 * HOUR],
      ["rollout_summaries/stale.md", NOW - 24 * 60 * HOUR], // ~8.6x half-life
    ];
    for (const [rel, mtime] of files) {
      const p = join(mem, rel);
      writeFileSync(p, body);
      utimesSync(p, new Date(mtime), new Date(mtime));
    }
    const r = searchMemory("zebra ranking", { home, nowMs: NOW });
    const order = r.hits.map((h) => h.relpath);
    assert.deepEqual(order, [
      "memory_summary.md",
      "MEMORY.md",
      "rollout_summaries/fresh.md",
      "rollout_summaries/stale.md",
    ]);
    const kinds = r.hits.map((h) => h.kind);
    assert.deepEqual(kinds, ["summary", "handbook", "rollout", "rollout"]);
    // Scores are strictly descending and the JSON-visible score IS the sort key.
    for (let i = 1; i < r.hits.length; i++) assert.ok(r.hits[i - 1].score > r.hits[i].score);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
