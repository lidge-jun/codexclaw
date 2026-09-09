/**
 * hit-count.test.ts — WP5 repeat-injection penalty.
 *
 * Two halves. The policy half drives buildCwdContext with an in-memory store so
 * the reordering rules are pinned without touching sqlite. The storage half uses
 * a real sidecar index in an isolated temp home to pin the two properties the
 * roadmap made non-negotiable: the schema version does not move, and deleting
 * the table returns ranking to neutral.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCwdContext,
  hitCountPenalty,
  FULL_BUDGET,
  type HitCountStore,
  type RecallContextDeps,
} from "../src/hook.ts";
import { searchChat } from "../src/chat-search.ts";
import { buildCodexHome } from "./fixtures.ts";
import type { ChatHit, ChatSearchResult } from "../src/chat-search.ts";
import type { CwdSession } from "../src/cwd-context.ts";
import {
  INDEX_SCHEMA_VERSION,
  bumpHitCounts,
  hitCountRef,
  openIndex,
  openIndexReadOnly,
  readHitCounts,
} from "../src/index-db.ts";

const CWD = "/repo/current";

/** Newest-first candidates, one per thread, titled by their letter. */
function hits(...names: string[]): ChatHit[] {
  return names.map((name, i) => ({
    ts: new Date(Date.parse("2026-09-09T00:00:00Z") - i * 3_600_000).toISOString(),
    role: "user",
    text: name,
    title: name,
    threadId: name,
    cwd: CWD,
    gitBranch: null,
    source: "main" as const,
    file: `${name}.jsonl`,
    matchField: "content" as const,
    context: [],
  }));
}

function searchReturning(chatHits: ChatHit[]): RecallContextDeps["searchChat"] {
  return (() => ({
    hits: chatHits,
    warnings: [],
    scannedFiles: chatHits.length,
    matchedFiles: chatHits.length,
    totalFiles: chatHits.length,
    elapsedMs: 1,
    mode: "scan",
  } satisfies ChatSearchResult)) as never;
}

/** In-memory store whose `bumped` list records exactly what the injection wrote. */
function memoryStore(counts: Record<string, number>): HitCountStore & { bumped: string[] } {
  const bumped: string[] = [];
  return {
    bumped,
    read: (refs) => new Map(refs.filter((r) => r in counts).map((r) => [r, counts[r]!])),
    bump: (refs) => void bumped.push(...refs),
    close: () => {},
  };
}

/** Injected thread names, in the order the context lists them. */
function injected(context: string): string[] {
  return [...context.matchAll(/\u2022 \[[\d-]+\] "([^"]+)"/g)].map((m) => m[1]!);
}

test("penalty is zero below the threshold, then half a position per repeat", () => {
  assert.equal(hitCountPenalty(0), 0);
  assert.equal(hitCountPenalty(2), 0, "a thread may recur across a working day for free");
  assert.equal(hitCountPenalty(3), 0.5);
  assert.equal(hitCountPenalty(4), 1);
  assert.equal(hitCountPenalty(9), 3.5);
});

test("no store means the neutral time order — the property that survives deletion", () => {
  const context = buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c", "d", "e", "f")),
  });
  assert.deepEqual(injected(context), ["a", "b", "c", "d", "e"]);
});

test("an empty history ranks identically to having no store at all", () => {
  const context = buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c", "d", "e", "f")),
    openHitCounts: () => memoryStore({}),
  });
  assert.deepEqual(injected(context), ["a", "b", "c", "d", "e"]);
});

test("a repeatedly injected thread sinks, and enough repeats push it off the page", () => {
  const sunk = buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c", "d", "e", "f")),
    // 7 injections = 2.5 positions of penalty, so `a` lands between `c` and `d`.
    openHitCounts: () => memoryStore({ "thread:a": 7 }),
  });
  assert.deepEqual(injected(sunk), ["b", "c", "a", "d", "e"]);

  const dropped = buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c", "d", "e", "f")),
    // 13 injections outweigh the whole candidate list; `f` takes the free slot.
    openHitCounts: () => memoryStore({ "thread:a": 13 }),
  });
  assert.deepEqual(injected(dropped), ["b", "c", "d", "e", "f"]);
});

test("only the threads actually injected are counted", () => {
  const store = memoryStore({});
  buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c", "d", "e", "f")),
    openHitCounts: () => store,
  });
  assert.deepEqual(store.bumped, ["thread:a", "thread:b", "thread:c", "thread:d", "thread:e"]);
  assert.ok(!store.bumped.includes("thread:f"), "a candidate that lost its slot is not charged");
});

test("an injection that produces nothing records nothing", () => {
  let opened = 0;
  const context = buildCwdContext(CWD, {
    // Hits exist but all belong to another CWD, so nothing is injected.
    searchChat: searchReturning(hits("a").map((h) => ({ ...h, cwd: "/repo/other" }))),
    openHitCounts: () => {
      opened += 1;
      return memoryStore({});
    },
  });
  assert.equal(context, "");
  assert.equal(opened, 0, "no injection, no history — an idle project cannot accumulate counts");
});

test("a store that cannot open leaves the injection intact and unpenalized", () => {
  const absent = buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c")),
    openHitCounts: () => null,
  });
  assert.deepEqual(injected(absent), ["a", "b", "c"]);

  const thrown = buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c")),
    openHitCounts: () => {
      throw new Error("sidecar locked");
    },
  });
  assert.deepEqual(injected(thrown), ["a", "b", "c"]);
});

test("refs fall back to the rollout file when a hit has no thread id", () => {
  assert.equal(hitCountRef("abc", "x.jsonl"), "thread:abc");
  assert.equal(hitCountRef(null, "x.jsonl"), "file:x.jsonl");
});

// ─── the enumerated path (the one SessionStart actually takes) ──────────────
// listCwdSessions is preferred over the basename search whenever an index
// exists, so a penalty that only reached the fallback would be dead code on
// every real machine. These pin it on the live path.

/** Newest-first enumerated sessions, one per thread, titled by their letter. */
function sessions(...names: string[]): CwdSession[] {
  return names.map((name, i) => ({
    path: `${name}.jsonl`,
    threadId: name,
    date: `2026-09-${String(9 - i).padStart(2, "0")}`,
    excerpt: name,
  }));
}

const throwingSearch = (() => {
  throw new Error("searchChat must not run when direct enumeration succeeds");
}) as never;

test("the enumerated path demotes repeats too, not just the search fallback", () => {
  const all = sessions("a", "b", "c", "d", "e", "f");
  const sunk = buildCwdContext(CWD, {
    searchChat: throwingSearch,
    listCwdSessions: (_cwd, topN) => all.slice(0, topN),
    // 7 injections = 2.5 positions, so `a` lands between `c` and `d`.
    openHitCounts: () => memoryStore({ "thread:a": 7 }),
  });
  assert.deepEqual(injected(sunk), ["b", "c", "a", "d", "e"]);
});

test("demotion widens the enumeration pool only when a history store exists", () => {
  // Nothing below the cut means nothing to promote into it, so the pool has to
  // be wider than topN — but only when the penalty can actually use the extra.
  const asked: number[] = [];
  const listCwdSessions = (_cwd: string, topN: number) => {
    asked.push(topN);
    return sessions("a", "b", "c", "d", "e", "f", "g", "h", "i", "j").slice(0, topN);
  };
  buildCwdContext(CWD, { searchChat: throwingSearch, listCwdSessions });
  assert.deepEqual(asked, [FULL_BUDGET.topN], "no store: enumeration cost is unchanged");

  asked.length = 0;
  const promoted = buildCwdContext(CWD, {
    searchChat: throwingSearch,
    listCwdSessions,
    openHitCounts: () => memoryStore({ "thread:a": 40 }),
  });
  assert.deepEqual(asked, [FULL_BUDGET.topN * 2]);
  assert.deepEqual(injected(promoted), ["b", "c", "d", "e", "f"], "the pool supplied the promotion");
});

test("a session with nothing to show is never charged an injection", () => {
  const store = memoryStore({});
  const context = buildCwdContext(CWD, {
    searchChat: throwingSearch,
    listCwdSessions: () => [
      { path: "a.jsonl", threadId: "a", date: "2026-09-09", excerpt: "" },
      { path: "b.jsonl", threadId: "b", date: "2026-09-08", excerpt: "b" },
    ],
    openHitCounts: () => store,
  });
  assert.deepEqual(injected(context), ["b"]);
  assert.deepEqual(store.bumped, ["thread:b"], "an unrendered session was never seen, so never counted");
});

test("one history serves both paths: the same session refs either way", () => {
  // A thread must not shed its count by arriving through the other door, which
  // holds only because both paths key on hitCountRef(threadId, file|path).
  const enumerated = memoryStore({});
  buildCwdContext(CWD, {
    searchChat: throwingSearch,
    listCwdSessions: (_cwd, topN) => sessions("a", "b", "c").slice(0, topN),
    openHitCounts: () => enumerated,
  });
  const searched = memoryStore({});
  buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c")),
    openHitCounts: () => searched,
  });
  assert.deepEqual(enumerated.bumped, searched.bumped);
});

// ─── storage: real sidecar index ────────────────────────────────────────────

let home: string;
let idx: string;

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-hits-"));
  idx = join(home, "recall", "index.sqlite");
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("the table arrives without moving the schema version", () => {
  assert.equal(INDEX_SCHEMA_VERSION, "2", "a bump re-parses the entire corpus (12GB measured)");
  const db = openIndex(idx);
  try {
    const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
      | { value: string }
      | undefined;
    assert.equal(version?.value, "2");
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recall_hit_counts'")
      .get();
    assert.ok(table, "CREATE TABLE IF NOT EXISTS added it in place");
  } finally {
    db.close();
  }
});

test("counts accumulate and are readable back", () => {
  const db = openIndex(idx);
  try {
    bumpHitCounts(db, ["thread:a", "thread:b"], "2026-09-09T00:00:00Z");
    bumpHitCounts(db, ["thread:a"], "2026-09-09T01:00:00Z");
    const counts = readHitCounts(db, ["thread:a", "thread:b", "thread:missing"]);
    assert.equal(counts.get("thread:a"), 2);
    assert.equal(counts.get("thread:b"), 1);
    assert.equal(counts.has("thread:missing"), false);
    const row = db
      .prepare("SELECT last_hit_at FROM recall_hit_counts WHERE ref = 'thread:a'")
      .get() as { last_hit_at: string };
    assert.equal(row.last_hit_at, "2026-09-09T01:00:00Z", "the stamp tracks the latest injection");
  } finally {
    db.close();
  }
});

test("dropping the table returns ranking to neutral instead of failing", () => {
  const drop = openIndex(idx);
  try {
    drop.exec("DROP TABLE recall_hit_counts");
  } finally {
    drop.close();
  }

  // A read-only handle never runs schema statements, so it sees the table gone —
  // the same situation as an index built before this table existed.
  const ro = openIndexReadOnly(idx);
  try {
    assert.deepEqual(readHitCounts(ro, ["thread:a"]), new Map(), "absent table reads as no history");
  } finally {
    ro.close();
  }

  const neutral = buildCwdContext(CWD, {
    searchChat: searchReturning(hits("a", "b", "c", "d", "e", "f")),
    openHitCounts: () => {
      const db = openIndexReadOnly(idx);
      return {
        read: (refs: string[]) => readHitCounts(db, refs),
        bump: () => {},
        close: () => db.close(),
      };
    },
  });
  assert.deepEqual(injected(neutral), ["a", "b", "c", "d", "e"], "history erased, order restored");

  // The next read-write open recreates it empty, so counting resumes from zero.
  const again = openIndex(idx);
  try {
    assert.deepEqual(readHitCounts(again, ["thread:a"]), new Map());
    bumpHitCounts(again, ["thread:a"], "2026-09-09T02:00:00Z");
    assert.equal(readHitCounts(again, ["thread:a"]).get("thread:a"), 1);
  } finally {
    again.close();
  }
});

test("explicit chat search is unaffected by injection history", () => {
  const corpus = mkdtempSync(join(tmpdir(), "recall-hits-explicit-"));
  const path = join(corpus, "sidecar", "index.sqlite");
  try {
    buildCodexHome(corpus);
    const run = () => searchChat("trigram", { home: corpus, indexPath: path, source: "all" });
    const before = run().hits.map((h) => `${h.ts}|${h.file}`);
    assert.ok(before.length > 1, "the fixture corpus must give the ranking something to order");

    // Saturate the history for every thread the query returns. If the penalty
    // could reach the search core at all, this is the input that would move it.
    const db = openIndex(path);
    try {
      const refs = run().hits.map((h) => hitCountRef(h.threadId, h.file));
      for (let i = 0; i < 20; i += 1) bumpHitCounts(db, refs, "2026-09-09T00:00:00Z");
    } finally {
      db.close();
    }

    assert.deepEqual(run().hits.map((h) => `${h.ts}|${h.file}`), before);
  } finally {
    rmSync(corpus, { recursive: true, force: true });
  }
});
