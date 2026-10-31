/**
 * index-db.ts — sidecar FTS index for instant full-history chat recall.
 *
 * The index is a rebuildable DERIVED CACHE owned by codexclaw. It lives outside
 * ~/.codex (source of truth, never written) at $CODEXCLAW_HOME ?? ~/.codexclaw,
 * under recall/index.sqlite. Deleting it costs only a rebuild.
 *
 * Sync model: msgs is the content table; msgs_fts (unicode61) and msgs_tri
 * (trigram, CJK-capable) are external-content FTS5 tables kept in lockstep by
 * triggers — the documented FTS5 pattern that cannot desync on plain
 * INSERT/DELETE (verified with integrity-check in the WP2 spike).
 *
 * Size (261022 memory size budget): the index is held under a byte budget
 * (index-budget.ts). Schema v3 records per-file text bytes and an eviction flag,
 * and is created with auto_vacuum=INCREMENTAL so pages freed by eviction are
 * returned to the filesystem instead of sitting in the freelist forever. Both FTS
 * tables stay detail=full: the trigram lane answers multi-character substring
 * queries, which FTS5 refuses as phrase queries under detail=column/none.
 */
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { chmodSync, mkdirSync, existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import { openDbReadOnly, openDbReadWrite,           } from "./sqlite.js";

export const INDEX_SCHEMA_VERSION = "3";

export function codexclawHome(env                                     = process.env)         {
  const fromEnv = env["CODEXCLAW_HOME"];
  return fromEnv && fromEnv.trim() !== "" ? fromEnv : join(homedir(), ".codexclaw");
}

export function indexPath(env                                     = process.env)         {
  return join(codexclawHome(env), "recall", "index.sqlite");
}

/**
 * How often a thread has already been auto-injected into a session. Written and
 * read by the hook path ALONE (hook.ts) so explicit `cxc chat/memory search`
 * stays deterministic; nothing in the search core touches this table.
 */
const HIT_COUNTS_DDL = `
CREATE TABLE IF NOT EXISTS recall_hit_counts (
  ref TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT NOT NULL
);
`;

/**
 * files.text_bytes is the UTF-8 size of the text this file contributed to msgs;
 * files.evicted marks a session whose messages were dropped by the size budget.
 * An evicted row keeps its metadata (cwd, thread, date, fingerprint) so the
 * SessionStart session list and freshness checks still see it, and so an
 * unchanged evicted file is not parsed again on the next refresh.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  mtime_ms INTEGER NOT NULL,
  size INTEGER NOT NULL,
  thread_id TEXT,
  cwd TEXT,
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  bytes_ingested INTEGER NOT NULL DEFAULT 0,
  last_ord INTEGER NOT NULL DEFAULT 0,
  repo_key TEXT,
  text_bytes INTEGER NOT NULL DEFAULT 0,
  evicted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_files_repo_key ON files(repo_key);
CREATE INDEX IF NOT EXISTS idx_files_evict ON files(evicted, mtime_ms);
CREATE TABLE IF NOT EXISTS msgs (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  ord INTEGER NOT NULL,
  ts TEXT NOT NULL,
  role TEXT NOT NULL,
  match_field TEXT NOT NULL,
  synthetic INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msgs_path ON msgs(path);
CREATE INDEX IF NOT EXISTS idx_msgs_ts ON msgs(ts DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS msgs_fts USING fts5(
  text, content='msgs', content_rowid='id', tokenize='unicode61'
);
CREATE VIRTUAL TABLE IF NOT EXISTS msgs_tri USING fts5(
  text, content='msgs', content_rowid='id', tokenize='trigram'
);
CREATE TRIGGER IF NOT EXISTS msgs_ai AFTER INSERT ON msgs BEGIN
  INSERT INTO msgs_fts(rowid, text) VALUES (new.id, new.text);
  INSERT INTO msgs_tri(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS msgs_ad AFTER DELETE ON msgs BEGIN
  INSERT INTO msgs_fts(msgs_fts, rowid, text) VALUES ('delete', old.id, old.text);
  INSERT INTO msgs_tri(msgs_tri, rowid, text) VALUES ('delete', old.id, old.text);
END;
${HIT_COUNTS_DDL}`;

/** WAL is truncated back to this after each checkpoint, so it cannot keep a burst's size. */
export const WAL_SIZE_LIMIT_BYTES = 4 * 1024 * 1024;

/** Thrown by openIndex({ migrate: false }) when the file still has an older schema. */
export class IndexMigrationPendingError extends Error {
  constructor(path        , found        ) {
    super(`recall index at ${path} has schema ${found}; cxc chat index migrates it`);
    this.name = "IndexMigrationPendingError";
  }
}










function storedVersion(db      )                {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()                                   ;
    return row && typeof row.value === "string" ? row.value : null;
  } catch {
    return null; // no meta table: a brand-new or foreign file
  }
}

function hasUserTables(db      )          {
  const row = db.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type = 'table'").get()                 ;
  return Number(row.n) > 0;
}



function readAllHitCounts(db      )           {
  try {
    return (db.prepare("SELECT ref, hit_count, last_hit_at FROM recall_hit_counts").all()                                  ).map((r) => ({
      ref: String(r.ref),
      hit_count: Number(r.hit_count),
      last_hit_at: String(r.last_hit_at),
    }));
  } catch {
    return [];
  }
}

function restoreHitCounts(db      , rows          )       {
  if (rows.length === 0) return;
  const stmt = db.prepare("INSERT OR REPLACE INTO recall_hit_counts (ref, hit_count, last_hit_at) VALUES (?, ?, ?)");
  db.exec("BEGIN");
  try {
    for (const r of rows) stmt.run(r.ref, r.hit_count, r.last_hit_at);
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
  }
}

function initFresh(db      )       {
  // auto_vacuum only takes effect when set before the first table exists.
  db.exec("PRAGMA auto_vacuum = INCREMENTAL");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(INDEX_SCHEMA_VERSION);
}

function lockPath(path        )         {
  return `${path}.migrate.lock`;
}

/** Create-exclusive lock so two processes cannot migrate (and delete) the same file. */
function acquireMigrationLock(path        , now = Date.now())          {
  const lock = lockPath(path);
  try {
    writeFileSync(lock, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    try {
      // A crashed migrator leaves its lock behind; ten minutes is far past any real one.
      if (now - statSync(lock).mtimeMs > 600_000) {
        rmSync(lock, { force: true });
        writeFileSync(lock, String(process.pid), { flag: "wx" });
        return true;
      }
    } catch {
      /* someone else holds it */
    }
    return false;
  }
}

/**
 * Replace an older-schema index with an empty v3 one, keeping the injection
 * history. The cache is derived, so the file is deleted rather than migrated in
 * place: dropping 400 MB of tables walks every page (2.2s measured), and a
 * multi-GB index would take far longer, while unlinking is O(1) and leaves no
 * freelist behind. Where the file cannot be unlinked (Windows with another
 * reader open) the tables are dropped and the file vacuumed in place instead.
 */
function migrate(path        , old      )       {
  const hits = readAllHitCounts(old);
  old.close();
  let removed = false;
  try {
    for (const file of [`${path}-wal`, `${path}-shm`, path]) rmSync(file, { force: true });
    removed = !existsSync(path);
  } catch {
    removed = false;
  }
  const db = openDbReadWrite(path);
  if (!removed) {
    db.exec("DROP TRIGGER IF EXISTS msgs_ai; DROP TRIGGER IF EXISTS msgs_ad;");
    db.exec("DROP TABLE IF EXISTS msgs_fts; DROP TABLE IF EXISTS msgs_tri;");
    db.exec("DROP TABLE IF EXISTS msgs; DROP TABLE IF EXISTS files; DROP TABLE IF EXISTS meta;");
    db.exec("DROP TABLE IF EXISTS recall_hit_counts;");
    db.exec("PRAGMA auto_vacuum = INCREMENTAL");
    db.exec("VACUUM");
  }
  initFresh(db);
  restoreHitCounts(db, hits);
  return db;
}

/** Open (creating directories/schema as needed) the sidecar index read-write. */
export function openIndex(path        , opts                   = {})       {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* non-POSIX filesystem */ }
  let db = openDbReadWrite(path);
  db.exec("PRAGMA busy_timeout = 5000");
  const version = storedVersion(db);
  if (version === null && !hasUserTables(db)) {
    initFresh(db);
  } else if (version !== INDEX_SCHEMA_VERSION) {
    if (opts.migrate === false || !acquireMigrationLock(path)) {
      db.close();
      throw new IndexMigrationPendingError(path, version ?? "unknown");
    }
    try {
      // Re-open and re-read under the lock: another process may have finished
      // first, and this handle could still point at the file it replaced.
      db.close();
      db = openDbReadWrite(path);
      const again = storedVersion(db);
      if (again === null && !hasUserTables(db)) initFresh(db);
      else if (again !== INDEX_SCHEMA_VERSION) db = migrate(path, db);
    } finally {
      rmSync(lockPath(path), { force: true });
    }
    db.exec("PRAGMA busy_timeout = 5000");
  }
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`PRAGMA journal_size_limit = ${WAL_SIZE_LIMIT_BYTES}`);
  db.exec(SCHEMA);
  for (const file of [path, `${path}-wal`, `${path}-shm`]) {
    try { chmodSync(file, 0o600); } catch { /* sidecar absent or non-POSIX */ }
  }
  return db;
}

/** Delete the index outright (`cxc chat index --rebuild`); the next open starts empty. */
export function resetIndex(path        )       {
  const db = existsSync(path) ? openDbReadWrite(path) : null;
  const hits = db ? readAllHitCounts(db) : [];
  db?.close();
  for (const file of [`${path}-wal`, `${path}-shm`, path]) rmSync(file, { force: true });
  const fresh = openIndex(path);
  try {
    restoreHitCounts(fresh, hits);
  } finally {
    fresh.close();
  }
}

/** Whether the files table already carries `name` (false on any read failure). */
export function filesHasColumn(db      , name        )          {
  try {
    const cols = db.prepare("PRAGMA table_info(files)").all()                             ;
    return cols.some((c) => String(c.name) === name);
  } catch {
    return false;
  }
}

/**
 * Open an EXISTING index strictly read-only — no mkdir, no schema writes, no
 * WAL pragma. This is the path for `--no-refresh` queries, `--status`, and
 * read-only filesystems (sandboxes): a queryable stale index beats a raw scan.
 * It also reads a v2 index that has not been migrated yet, so every reader must
 * tolerate the v3 columns being absent.
 */
export function openIndexReadOnly(path        )       {
  if (!existsSync(path)) throw new Error(`no index at ${path}`);
  return openDbReadOnly(path);
}















// ─── recall_hit_counts accessors ────────────────────────────────────────────

/** Stable ref for a chat hit: its thread when known, else its rollout file. */
export function hitCountRef(threadId               , file        )         {
  return threadId ? `thread:${threadId}` : `file:${file}`;
}

/** Injection counts for the given refs; refs never injected are simply absent. */
export function readHitCounts(db      , refs          )                      {
  const counts = new Map                ();
  if (refs.length === 0) return counts;
  try {
    const holes = refs.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT ref, hit_count FROM recall_hit_counts WHERE ref IN (${holes})`)
      .all(...refs)                                             ;
    for (const row of rows) counts.set(String(row.ref), Number(row.hit_count));
  } catch {
    // Table absent (pre-existing index opened read-only) — no history, no penalty.
  }
  return counts;
}

/** Increment the injection count for each ref, stamping when it last happened. */
export function bumpHitCounts(db      , refs          , atIso        )       {
  if (refs.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO recall_hit_counts (ref, hit_count, last_hit_at) VALUES (?, 1, ?)
     ON CONFLICT(ref) DO UPDATE SET hit_count = hit_count + 1, last_hit_at = excluded.last_hit_at`,
  );
  for (const ref of refs) stmt.run(ref, atIso);
}

/** Live bytes the database holds, excluding free pages. */
export function usedDbBytes(db      )         {
  const pages = Number((db.prepare("PRAGMA page_count").get()                          ).page_count);
  const free = Number((db.prepare("PRAGMA freelist_count").get()                              ).freelist_count);
  const size = Number((db.prepare("PRAGMA page_size").get()                         ).page_size);
  return Math.max(0, pages - free) * size;
}

/** Bytes the index occupies on disk (main file + WAL + shm); 0 when absent. */
export function indexDiskBytes(path        )         {
  let total = 0;
  for (const file of [path, `${path}-wal`, `${path}-shm`]) {
    try {
      total += statSync(file).size;
    } catch {
      /* absent */
    }
  }
  return total;
}

export function indexStatus(db      , path        )              {
  const files = (db.prepare("SELECT COUNT(*) AS n FROM files").get()                 ).n;
  const msgs = (db.prepare("SELECT COUNT(*) AS n FROM msgs").get()                 ).n;
  const last = db.prepare("SELECT value FROM meta WHERE key = 'last_ingest_at'").get()

               ;
  const evictedFiles = filesHasColumn(db, "evicted")
    ? Number((db.prepare("SELECT COUNT(*) AS n FROM files WHERE evicted = 1").get()                 ).n)
    : 0;
  let dbBytes = 0;
  try {
    dbBytes = usedDbBytes(db);
  } catch {
    dbBytes = 0;
  }
  return {
    path,
    files,
    msgs,
    lastIngestAt: last?.value ?? null,
    evictedFiles,
    dbBytes,
    diskBytes: indexDiskBytes(path),
    schemaVersion: storedVersion(db),
  };
}
