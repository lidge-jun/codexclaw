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
import { mkdirSync } from "node:fs";
import { openDbReadWrite,           } from "./sqlite.js";

export const INDEX_SCHEMA_VERSION = "2";

export function codexclawHome(env                                     = process.env)         {
  const fromEnv = env["CODEXCLAW_HOME"];
  return fromEnv && fromEnv.trim() !== "" ? fromEnv : join(homedir(), ".codexclaw");
}

export function indexPath(env                                     = process.env)         {
  return join(codexclawHome(env), "recall", "index.sqlite");
}

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
  last_ord INTEGER NOT NULL DEFAULT 0
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
`;

/** Open (creating directories/schema as needed) the sidecar index read-write. */
export function openIndex(path        )       {
  mkdirSync(dirname(path), { recursive: true });
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
    db.exec(SCHEMA);
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(INDEX_SCHEMA_VERSION);
  }
  return db;
}








export function indexStatus(db      , path        )              {
  const files = (db.prepare("SELECT COUNT(*) AS n FROM files").get()                 ).n;
  const msgs = (db.prepare("SELECT COUNT(*) AS n FROM msgs").get()                 ).n;
  const last = db.prepare("SELECT value FROM meta WHERE key = 'last_ingest_at'").get()

               ;
  return { path, files, msgs, lastIngestAt: last?.value ?? null };
}
