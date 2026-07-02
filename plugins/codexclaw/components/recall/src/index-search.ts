/**
 * index-search.ts — chat search served from the sidecar FTS index.
 *
 * Matching parity with the scan path (substring, case-insensitive):
 *   - words of >=3 chars use the trigram FTS table (substring semantics for ASCII
 *     and CJK alike; the WP2 spike verified 2-char CJK words return nothing);
 *   - shorter words fall back to LIKE over msgs.text (indexed table, still far
 *     smaller than raw JSONL);
 *   - AND intersects per-word id sets, OR unions them (scan-path semantics).
 * Filters (synthetic/source/cwd/role/days/tools) compile to SQL; ordering is
 * recency-first; limit+1 detects truncation.
 */
import type { RwDb } from "./sqlite.ts";
import type { ChatHit, ChatSearchResult } from "./chat-search.ts";
import type { RolloutSource } from "./rollout.ts";
import { loadThreadMeta, type ThreadMetaResult } from "./threads-db.ts";
import { stateDbPath } from "./paths.ts";

export type IndexQueryOptions = {
  words: string[];
  anyMode: boolean;
  limit: number;
  contextN: number;
  cutoffIso: string | null;
  role: string | null;
  cwd: string | null;
  source: RolloutSource | "all";
  includeSynthetic: boolean;
  includeTools: boolean;
  home: string;
};

/** FTS5 MATCH treats bare tokens as syntax; quote each word (embedded quotes doubled). */
function ftsQuote(word: string): string {
  return `"${word.replace(/"/g, '""')}"`;
}

function escapeLike(word: string): string {
  return word.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** One per-word id-set condition: trigram MATCH for >=3 chars, LIKE fallback below. */
function wordCondition(word: string, params: unknown[]): string {
  if ([...word].length >= 3) {
    params.push(ftsQuote(word));
    return "m.id IN (SELECT rowid FROM msgs_tri WHERE msgs_tri MATCH ?)";
  }
  params.push(`%${escapeLike(word)}%`);
  return "lower(m.text) LIKE ? ESCAPE '\\'";
}

export function queryIndex(db: RwDb, opts: IndexQueryOptions): ChatSearchResult {
  const started = Date.now();
  const warnings: string[] = [];
  const params: unknown[] = [];
  const conds: string[] = [];

  const wordConds = opts.words.map((w) => wordCondition(w, params));
  conds.push(`(${wordConds.join(opts.anyMode ? " OR " : " AND ")})`);
  if (!opts.includeSynthetic) conds.push("m.synthetic = 0");
  if (!opts.includeTools) conds.push("m.match_field = 'content'");
  if (opts.role) {
    conds.push("m.role = ?");
    params.push(opts.role);
  }
  if (opts.cutoffIso) {
    conds.push("m.ts >= ?");
    params.push(opts.cutoffIso);
  }
  if (opts.source !== "all") {
    conds.push("f.source = ?");
    params.push(opts.source);
  }
  if (opts.cwd) {
    conds.push("f.cwd LIKE ? ESCAPE '\\'");
    params.push(`${escapeLike(opts.cwd)}%`);
  }

  const sql = `SELECT m.id, m.path, m.ord, m.ts, m.role, m.match_field, m.text,
      f.thread_id, f.cwd, f.source
    FROM msgs m JOIN files f ON f.path = m.path
    WHERE ${conds.join(" AND ")}
    ORDER BY m.ts DESC
    LIMIT ?`;
  params.push(opts.limit + 1);

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  const truncated = rows.length > opts.limit;
  if (truncated) rows.length = opts.limit;
  if (truncated) warnings.push(`truncated at limit ${opts.limit} — raise --limit or narrow the query`);

  const threadMeta: ThreadMetaResult = loadThreadMeta(stateDbPath(opts.home));
  if (threadMeta.warning) warnings.push(threadMeta.warning);

  const hits: ChatHit[] = rows.map((r) => {
    const threadId = typeof r.thread_id === "string" ? r.thread_id : null;
    const tm = threadId ? threadMeta.byId.get(threadId) : undefined;
    return {
      ts: String(r.ts),
      role: String(r.role),
      text: String(r.text),
      matchField: r.match_field === "tool_log" ? "tool_log" : "content",
      threadId,
      title: tm?.title || null,
      cwd: typeof r.cwd === "string" ? r.cwd : null,
      gitBranch: tm?.gitBranch ?? null,
      source: r.source === "subagent" ? "subagent" : "main",
      file: String(r.path),
      context:
        opts.contextN > 0
          ? contextFromIndex(db, String(r.path), Number(r.ord), opts.contextN, opts.includeSynthetic)
          : [],
    };
  });

  const totalFiles = (db.prepare("SELECT COUNT(*) AS n FROM files").get() as { n: number }).n;
  const matchedFiles = new Set(hits.map((h) => h.file)).size;
  return {
    hits,
    warnings,
    scannedFiles: totalFiles,
    matchedFiles,
    totalFiles,
    elapsedMs: Date.now() - started,
    mode: "index",
  };
}

function contextFromIndex(
  db: RwDb,
  path: string,
  ord: number,
  n: number,
  includeSynthetic: boolean,
): Array<{ ts: string; role: string; text: string; isMatch: boolean }> {
  const synthCond = includeSynthetic ? "" : " AND synthetic = 0";
  const before = db
    .prepare(`SELECT ts, role, text, ord FROM msgs WHERE path = ? AND ord < ?${synthCond} ORDER BY ord DESC LIMIT ?`)
    .all(path, ord, n) as Array<Record<string, unknown>>;
  const at = db
    .prepare("SELECT ts, role, text, ord FROM msgs WHERE path = ? AND ord = ?")
    .all(path, ord) as Array<Record<string, unknown>>;
  const after = db
    .prepare(`SELECT ts, role, text, ord FROM msgs WHERE path = ? AND ord > ?${synthCond} ORDER BY ord ASC LIMIT ?`)
    .all(path, ord, n) as Array<Record<string, unknown>>;
  const rows = [...before.reverse(), ...at, ...after];
  return rows.map((r) => ({
    ts: String(r.ts),
    role: String(r.role),
    text: String(r.text),
    isMatch: Number(r.ord) === ord,
  }));
}
