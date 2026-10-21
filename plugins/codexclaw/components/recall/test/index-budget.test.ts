/**
 * index-budget.test.ts — the recall index stays inside its byte budget (261022).
 *
 * Everything here is deterministic: corpus text comes from a seeded generator,
 * file mtimes are set explicitly, and no test waits on a clock.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync, utimesSync, truncateSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openIndex, indexDiskBytes, usedDbBytes, IndexMigrationPendingError, INDEX_SCHEMA_VERSION } from "../src/index-db.ts";
import { ingest } from "../src/ingest.ts";
import {
  DEFAULT_INDEX_MAX_MB,
  evictToBudget,
  recallIndexHealth,
  recallIndexNotice,
  resolveIndexBudget,
  type IndexBudget,
} from "../src/index-budget.ts";
import { pruneInertMemoryJobs, MIN_PRUNE_AGE_DAYS } from "../src/memory-prune.ts";
import { handleSessionStart, SESSION_START_CHAR_BUDGET } from "../src/hook.ts";
import { searchChat } from "../src/chat-search.ts";
import { main as cliMain } from "../src/cli.ts";

const MB = 1024 * 1024;
/** shm is 32KB; the WAL is truncated after every changing ingest. */
const DISK_SLACK = 64 * 1024;

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EN = ["index", "budget", "session", "rollout", "trigram", "memory", "vacuum", "eviction", "recall", "inject", "sqlite", "page", "token", "hook", "agent", "branch", "merge", "test", "deploy", "cache"];
const KO = ["메모리", "인덱스", "세션", "검색", "예산", "압축", "주입", "기록", "테스트", "배포"];

function sentence(next: () => number, chars: number): string {
  const words: string[] = [];
  let len = 0;
  while (len < chars) {
    const pool = next() < 0.25 ? KO : EN;
    const w = pool[Math.floor(next() * pool.length)]! + (next() < 0.5 ? String(Math.floor(next() * 5000)) : "");
    words.push(w);
    len += w.length + 1;
  }
  return words.join(" ");
}

function line(obj: unknown): string {
  return JSON.stringify(obj) + "\n";
}

/**
 * Write `sessions` rollouts with `msgs` messages each. Session i is older than
 * session i+1 by date directory, filename and mtime alike.
 */
function buildHistory(root: string, sessions: number, msgs: number, msgChars: number): string[] {
  const next = rng(42);
  const paths: string[] = [];
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < sessions; i += 1) {
    const t = new Date(base + i * 6 * 3_600_000);
    const y = String(t.getUTCFullYear());
    const m = String(t.getUTCMonth() + 1).padStart(2, "0");
    const d = String(t.getUTCDate()).padStart(2, "0");
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const dir = join(root, "sessions", y, m, d);
    mkdirSync(dir, { recursive: true });
    const id = "019f0000-0000-7000-8000-" + String(i).padStart(12, "0");
    const iso = t.toISOString();
    let body = line({ timestamp: iso, type: "session_meta", payload: { id, timestamp: iso, cwd: "/proj/budget", originator: "codex-tui", cli_version: "0.130.0" } });
    for (let k = 0; k < msgs; k += 1) {
      const role = k % 2 === 0 ? "user" : "assistant";
      body += line({
        timestamp: iso,
        type: "response_item",
        payload: { type: "message", role, content: [{ type: role === "assistant" ? "output_text" : "input_text", text: "s" + i + " " + sentence(next, msgChars) }] },
      });
    }
    const path = join(dir, "rollout-" + y + "-" + m + "-" + d + "T" + hh + "-00-00-" + id + ".jsonl");
    writeFileSync(path, body);
    const mtime = (base + i * 6 * 3_600_000) / 1000;
    utimesSync(path, mtime, mtime);
    paths.push(path);
  }
  return paths;
}

function evictedOf(db: ReturnType<typeof openIndex>, path: string): number {
  return Number((db.prepare("SELECT evicted FROM files WHERE path = ?").get(path) as { evicted: number }).evicted);
}

test("default budget stays well under the 100 MB product limit, and overrides are bounded", () => {
  assert.equal(DEFAULT_INDEX_MAX_MB, 48);
  assert.ok(resolveIndexBudget({}).maxBytes < 100 * MB);
  assert.equal(resolveIndexBudget({ CODEXCLAW_RECALL_MAX_MB: "20" }).maxBytes, 20 * MB);
  assert.equal(resolveIndexBudget({ CODEXCLAW_RECALL_MAX_MB: "1" }).maxBytes, 4 * MB, "clamped to the minimum");
  assert.equal(resolveIndexBudget({ CODEXCLAW_RECALL_MAX_MB: "lots" }).maxBytes, 48 * MB, "garbage is ignored");
});

test("a large synthetic history is indexed newest-first and stays under budget on disk", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-budget-"));
  try {
    // ~17 MB of raw message text: several times the 3 MB budget.
    const paths = buildHistory(root, 160, 70, 1500);
    const idx = join(root, "sidecar", "index.sqlite");
    const budget: IndexBudget = { maxBytes: 3 * MB, lowWater: 0.8 };
    const db = openIndex(idx);
    try {
      const first = ingest(root, db, 0, { budget });
      assert.equal(first.scanned, 160);
      assert.ok(first.evicted > 100, "most of the history is kept as metadata only, got " + first.evicted);
      assert.ok(indexDiskBytes(idx) <= budget.maxBytes + DISK_SLACK, "disk " + indexDiskBytes(idx));
      assert.ok(usedDbBytes(db) <= budget.maxBytes);

      // Every session keeps its files row; only message text is budgeted.
      const files = Number((db.prepare("SELECT COUNT(*) AS n FROM files").get() as { n: number }).n);
      assert.equal(files, 160);
      assert.equal(evictedOf(db, paths[159]!), 0, "the newest session is searchable");
      assert.equal(evictedOf(db, paths[0]!), 1, "the oldest session is trimmed");

      // Idle refresh: nothing changed, so nothing is parsed, evicted or written.
      const second = ingest(root, db, 0, { budget });
      assert.deepEqual([second.ingested, second.appended, second.pruned, second.evicted], [0, 0, 0, 0]);

      // A trimmed session that becomes active again is indexed again, and the
      // budget makes room by trimming whatever is now least recently active.
      appendFileSync(paths[0]!, line({ timestamp: "2026-03-01T00:00:00.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "revived quokka session" }] } }));
      const later = Date.UTC(2026, 5, 1) / 1000;
      utimesSync(paths[0]!, later, later);
      const third = ingest(root, db, 0, { budget });
      assert.equal(third.ingested, 1);
      assert.equal(evictedOf(db, paths[0]!), 0);
      const hit = db.prepare("SELECT COUNT(*) AS n FROM msgs_tri WHERE msgs_tri MATCH ?").get('"quokka"') as { n: number };
      assert.equal(Number(hit.n), 1);
      assert.ok(indexDiskBytes(idx) <= budget.maxBytes + DISK_SLACK);
    } finally {
      db.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an oversized index is compacted under budget, evicting the least recently active sessions", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-evict-"));
  try {
    const paths = buildHistory(root, 60, 60, 1200);
    const idx = join(root, "sidecar", "index.sqlite");
    const db = openIndex(idx);
    try {
      ingest(root, db, 0, { budget: null });
      const unbounded = indexDiskBytes(idx);
      const budget: IndexBudget = { maxBytes: Math.floor(unbounded / 3), lowWater: 0.8 };
      assert.ok(unbounded > budget.maxBytes * 2, "sanity: the index starts far over budget");

      const result = evictToBudget(db, budget);
      assert.ok(result.evictedFiles > 0);
      assert.ok(result.afterBytes <= budget.maxBytes * budget.lowWater, "stopped at the low-water mark");
      assert.ok(indexDiskBytes(idx) <= budget.maxBytes + DISK_SLACK, "pages went back to the filesystem: " + indexDiskBytes(idx));

      const kept = (db.prepare("SELECT path FROM files WHERE evicted = 0").all() as Array<{ path: string }>).map((r) => r.path);
      const firstKept = Math.min(...kept.map((p) => paths.indexOf(p)));
      for (let i = firstKept; i < paths.length; i += 1) assert.equal(evictedOf(db, paths[i]!), 0, "contiguous newest block kept");
      for (let i = 0; i < firstKept; i += 1) assert.equal(evictedOf(db, paths[i]!), 1);
      const orphans = db.prepare("SELECT COUNT(*) AS n FROM msgs m JOIN files f ON f.path = m.path WHERE f.evicted = 1").get() as { n: number };
      assert.equal(Number(orphans.n), 0, "no message text survives eviction");
      const integrity = db.prepare("INSERT INTO msgs_tri(msgs_tri) VALUES('integrity-check')");
      integrity.run();

      // Under budget: a second call measures once and does nothing.
      assert.equal(evictToBudget(db, budget).evictedFiles, 0);
    } finally {
      db.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeV2Index(path: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  const raw = new DatabaseSync(path);
  raw.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  raw.exec("INSERT INTO meta VALUES ('schema_version', '2')");
  raw.exec("CREATE TABLE msgs (id INTEGER PRIMARY KEY, path TEXT, text TEXT)");
  const ins = raw.prepare("INSERT INTO msgs (path, text) VALUES (?, ?)");
  const next = rng(7);
  raw.exec("BEGIN");
  for (let i = 0; i < 2000; i += 1) ins.run("/old/" + (i % 40), sentence(next, 1000));
  raw.exec("COMMIT");
  raw.exec("CREATE TABLE recall_hit_counts (ref TEXT PRIMARY KEY, hit_count INTEGER NOT NULL DEFAULT 0, last_hit_at TEXT NOT NULL)");
  raw.exec("INSERT INTO recall_hit_counts VALUES ('thread:keep', 4, '2026-10-01T00:00:00Z')");
  raw.close();
}

test("a v2 index is replaced by an empty v3 index once, keeping injection history; hooks never migrate", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-migrate-v3-"));
  try {
    const idx = join(root, "recall", "index.sqlite");
    writeV2Index(idx);
    const before = indexDiskBytes(idx);
    assert.ok(before > 1 * MB);

    assert.throws(() => openIndex(idx, { migrate: false }), IndexMigrationPendingError);

    // A live lock means another process is migrating: refuse rather than race it.
    writeFileSync(idx + ".migrate.lock", "1");
    assert.throws(() => openIndex(idx), IndexMigrationPendingError);
    // A stale lock (crashed migrator) is taken over.
    const old = Date.UTC(2026, 0, 1) / 1000;
    utimesSync(idx + ".migrate.lock", old, old);

    const db = openIndex(idx);
    try {
      const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string };
      assert.equal(version.value, INDEX_SCHEMA_VERSION);
      assert.equal(Number((db.prepare("PRAGMA auto_vacuum").get() as { auto_vacuum: number }).auto_vacuum), 2);
      const hits = db.prepare("SELECT hit_count FROM recall_hit_counts WHERE ref = 'thread:keep'").get() as { hit_count: number };
      assert.equal(Number(hits.hit_count), 4);
      assert.equal(Number((db.prepare("SELECT COUNT(*) AS n FROM msgs").get() as { n: number }).n), 0);
    } finally {
      db.close();
    }
    assert.ok(indexDiskBytes(idx) < 256 * 1024, "the old corpus is gone from disk: " + indexDiskBytes(idx));
    assert.equal(existsSync(idx + ".migrate.lock"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("health is a stat-only read and the SessionStart notice fires only over budget", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-health-"));
  try {
    const idx = join(root, "index.sqlite");
    assert.equal(recallIndexNotice(recallIndexHealth(idx)), "", "absent index is silent");
    writeFileSync(idx, "");
    truncateSync(idx, 410 * MB); // sparse: the size of the index this unit was written for
    const budget = resolveIndexBudget({});
    const health = recallIndexHealth(idx, budget);
    assert.equal(health.overBudget, true);
    assert.match(recallIndexNotice(health), /recall index 410\.0 MB exceeds its 48\.0 MB budget/);
    truncateSync(idx, 40 * MB);
    assert.equal(recallIndexNotice(recallIndexHealth(idx, budget)), "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the recall SessionStart envelope stays inside its character budget", () => {
  const huge = "x".repeat(5000);
  for (const source of ["startup", "compact"]) {
    const out = handleSessionStart(huge, undefined, source, { memoryNotice: huge, dedicatedTools: false });
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
    const cap = source === "compact" ? SESSION_START_CHAR_BUDGET.compact : SESSION_START_CHAR_BUDGET.full;
    assert.ok(ctx.length <= cap, source + " envelope " + ctx.length + " > " + cap);
    assert.match(ctx, /\[cxc-recall\] [a-z]+: recover gaps before asking/, "the recall pointer always survives");
  }
  // Ordinary notices still get through untouched.
  const normal = handleSessionStart("idx ok", undefined, undefined, { memoryNotice: "memory pipeline: 3 job(s) exhausted their retries in the last 7 days (cxc memory status)", dedicatedTools: false });
  assert.match(normal, /3 job\(s\) exhausted/);
  assert.match(normal, /Index: idx ok/);
});

test("memory prune removes only exhausted stage-1 jobs the host can never claim again", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-memprune-"));
  try {
    const now = 400 * 86_400;
    const db = new DatabaseSync(join(home, "memories_1.sqlite"));
    db.exec("CREATE TABLE jobs (kind TEXT NOT NULL, job_key TEXT NOT NULL, status TEXT NOT NULL, finished_at INTEGER, retry_remaining INTEGER NOT NULL, last_error TEXT, PRIMARY KEY (kind, job_key))");
    const ins = db.prepare("INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?)");
    ins.run("memory_stage1", "inert", "error", now - 120 * 86_400, 0, "context window exceeded");
    ins.run("memory_stage1", "recent", "error", now - 30 * 86_400, 0, "context window exceeded");
    ins.run("memory_stage1", "retrying", "error", now - 120 * 86_400, 2, "429");
    ins.run("memory_stage1", "done", "done", now - 120 * 86_400, 3, null);
    ins.run("memory_stage1", "undated", "error", null, 0, "x");
    ins.run("memory_consolidate_global", "global", "error", now - 120 * 86_400, 0, "x");
    db.close();

    const dry = pruneInertMemoryJobs(home, { nowSeconds: now });
    assert.equal(dry.state, "ok");
    assert.equal(dry.candidates, 1);
    assert.equal(dry.applied, false);

    const tooYoung = pruneInertMemoryJobs(home, { nowSeconds: now, olderThanDays: 10 });
    assert.equal(tooYoung.olderThanDays, MIN_PRUNE_AGE_DAYS, "never below the host's own age clamp");

    const applied = pruneInertMemoryJobs(home, { nowSeconds: now, apply: true });
    assert.equal(applied.deleted, 1);
    const check = new DatabaseSync(join(home, "memories_1.sqlite"), { readOnly: true });
    const left = (check.prepare("SELECT job_key FROM jobs ORDER BY job_key").all() as Array<{ job_key: string }>).map((r) => r.job_key);
    check.close();
    assert.deepEqual(left, ["done", "global", "recent", "retrying", "undated"]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("an index already over budget makes room before admitting new sessions (review #306)", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-preevict-"));
  try {
    const paths = buildHistory(root, 60, 60, 1200);
    const idx = join(root, "sidecar", "index.sqlite");
    const db = openIndex(idx);
    try {
      // Build the first 59 sessions unbounded, then lower the budget far below that.
      const newest = paths[59]!;
      const keep = readFileSync(newest);
      rmSync(newest);
      ingest(root, db, 0, { budget: null });
      writeFileSync(newest, keep);
      const later = Date.UTC(2026, 6, 1) / 1000;
      utimesSync(newest, later, later);
      const budget: IndexBudget = { maxBytes: Math.floor(indexDiskBytes(idx) / 3), lowWater: 0.8 };

      ingest(root, db, 0, { budget });
      assert.equal(evictedOf(db, newest), 0, "the newest session is searchable, not parked as metadata");
      assert.ok(indexDiskBytes(idx) <= budget.maxBytes + DISK_SLACK);
    } finally {
      db.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the trimmed-history warning follows last activity, not the rollout's creation date (review #306)", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-trimwarn-"));
  try {
    const paths = buildHistory(root, 40, 40, 1200);
    const idx = join(root, "sidecar", "index.sqlite");
    const db = openIndex(idx);
    try {
      ingest(root, db, 0, { budget: null });
      // A January rollout appended to yesterday, then evicted.
      const now = Date.now();
      db.prepare("UPDATE files SET evicted = 1, mtime_ms = ? WHERE path = ?").run(now - 86_400_000, paths[0]!);
      db.prepare("UPDATE files SET evicted = 0, mtime_ms = ? WHERE path != ?").run(Date.UTC(2026, 0, 1), paths[0]!);
    } finally {
      db.close();
    }
    const recent = searchChat("budget", { home: root, indexPath: idx, days: 7, noRefresh: true });
    assert.ok(recent.warnings.some((w) => /trimmed from the index/.test(w)), JSON.stringify(recent.warnings));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cxc chat index --compact --status compacts instead of only reporting (review #306)", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-compact-status-"));
  const previous = process.env["CODEXCLAW_RECALL_MAX_MB"];
  const write = process.stdout.write.bind(process.stdout);
  try {
    buildHistory(root, 60, 60, 1200);
    const idx = join(root, "sidecar", "index.sqlite");
    const db = openIndex(idx);
    ingest(root, db, 0, { budget: null });
    db.close();
    assert.ok(indexDiskBytes(idx) > 4 * MB, "sanity: the index starts over a 4 MB budget");
    process.env["CODEXCLAW_RECALL_MAX_MB"] = "4";
    (process.stdout as unknown as { write: (s: string) => boolean }).write = () => true;
    const code = cliMain(["chat", "index", "--compact", "--status", "--index-path", idx, "--home", root]);
    (process.stdout as unknown as { write: typeof write }).write = write;
    assert.equal(code, 0);
    assert.ok(indexDiskBytes(idx) <= 4 * MB + DISK_SLACK, "compacted to " + indexDiskBytes(idx));
  } finally {
    (process.stdout as unknown as { write: typeof write }).write = write;
    if (previous === undefined) delete process.env["CODEXCLAW_RECALL_MAX_MB"];
    else process.env["CODEXCLAW_RECALL_MAX_MB"] = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
