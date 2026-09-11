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
 */
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { chmodSync, mkdirSync, existsSync } from "node:fs";
import { openDbReadOnly, openDbReadWrite,           } from "./sqlite.js";

export const INDEX_SCHEMA_VERSION = "2";

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
 *
 * Appended to SCHEMA instead of bumping INDEX_SCHEMA_VERSION: a version bump
 * would drop and re-parse the whole corpus (measured 12GB / 1.2M messages),
 * whereas CREATE TABLE IF NOT EXISTS lets an existing index gain the table on
 * its next read-write open. openIndexReadOnly never runs schema statements, so
 * every reader must tolerate the table being absent.
 */
const HIT_COUNTS_DDL = `
CREATE TABLE IF NOT EXISTS recall_hit_counts (
  ref TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT NOT NULL
);
`;

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
  repo_key TEXT
);
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

/** Open (creating directories/schema as needed) the sidecar index read-write. */
export function openIndex(path        )       {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* non-POSIX filesystem */ }
  const db = openDbReadWrite(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()

               ;
  if (!row) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(INDEX_SCHEMA_VERSION);
  } else if (row.value !== INDEX_SCHEMA_VERSION) {
    // Cache semantics: an old schema is dropped and rebuilt, never migrated.
    db.exec("DROP TRIGGER IF EXISTS msgs_ai; DROP TRIGGER IF EXISTS msgs_ad;");
    db.exec("DROP TABLE IF EXISTS msgs_fts; DROP TABLE IF EXISTS msgs_tri;");
    db.exec("DROP TABLE IF EXISTS msgs; DROP TABLE IF EXISTS files; DROP TABLE IF EXISTS meta;");
    db.exec("DROP TABLE IF EXISTS recall_hit_counts;");
    db.exec(SCHEMA);
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(INDEX_SCHEMA_VERSION);
  }
  ensureRepoKeyColumn(db);
  for (const file of [path, `${path}-wal`, `${path}-shm`]) {
    try { chmodSync(file, 0o600); } catch { /* sidecar absent or non-POSIX */ }
  }
  return db;
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
 * Add files.repo_key to an index built before wp4, in place.
 *
 * Bumping INDEX_SCHEMA_VERSION would drop and re-parse the whole corpus
 * (measured 12GB / 1.2M messages) to gain one nullable column, so this follows
 * the recall_hit_counts precedent instead: the version string stays "2" and an
 * existing index gains the column on its next read-write open.
 *
 * SQLite has no `ADD COLUMN IF NOT EXISTS` (3.53.0 answers `near "EXISTS":
 * syntax error`) and a duplicate ADD COLUMN is a hard error, so the PRAGMA
 * guard is the migration test. openIndexReadOnly runs no DDL at all, which is
 * why every reader must tolerate the column being absent.
 */
export function ensureRepoKeyColumn(db      )       {
  try {
    if (!filesHasColumn(db, "repo_key")) db.exec("ALTER TABLE files ADD COLUMN repo_key TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_files_repo_key ON files(repo_key)");
  } catch {
    // A read-only or concurrently-migrated index keeps working without the
    // column: scoping degrades to the cwd prefix, nothing throws.
  }
}

/**
 * Open an EXISTING index strictly read-only — no mkdir, no schema writes, no
 * WAL pragma. This is the path for `--no-refresh` queries, `--status`, and
 * read-only filesystems (sandboxes): a queryable stale index beats a raw scan.
 */
export function openIndexReadOnly(path        )       {
  if (!existsSync(path)) throw new Error(`no index at ${path}`);
  return openDbReadOnly(path);
}








// ─── recall_hit_counts accessors ────────────────────────────────────────────
// Storage only: how often a ref was injected, never what that should cost. The
// penalty policy lives in hook.ts so the search core cannot grow a dependency
// on it. Both accessors tolerate a missing table — an index created before this
// table existed only gains it on its next read-write open.

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

export function indexStatus(db      , path        )              {
  const files = (db.prepare("SELECT COUNT(*) AS n FROM files").get()                 ).n;
  const msgs = (db.prepare("SELECT COUNT(*) AS n FROM msgs").get()                 ).n;
  const last = db.prepare("SELECT value FROM meta WHERE key = 'last_ingest_at'").get()

               ;
  return { path, files, msgs, lastIngestAt: last?.value ?? null };
}
