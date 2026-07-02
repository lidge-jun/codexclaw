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



import { loadThreadMeta,                       } from "./threads-db.js";
import { stateDbPath } from "./paths.js";















/** FTS5 MATCH treats bare tokens as syntax; quote each word (embedded quotes doubled). */
function ftsQuote(word        )         {
  return `"${word.replace(/"/g, '""')}"`;
}

function escapeLike(word        )         {
  return word.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** One per-word id-set condition: trigram MATCH for >=3 chars, LIKE fallback below. */
function wordCondition(word        , params           )         {
  if ([...word].length >= 3) {
    params.push(ftsQuote(word));
    return "m.id IN (SELECT rowid FROM msgs_tri WHERE msgs_tri MATCH ?)";
  }
  params.push(`%${escapeLike(word)}%`);
  return "lower(m.text) LIKE ? ESCAPE '\\'";
}

export function queryIndex(db      , opts                   )                   {
  const started = Date.now();
  const warnings           = [];
  const params            = [];
  const conds           = [];

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

  const rows = db.prepare(sql).all(...params)                                  ;
  const truncated = rows.length > opts.limit;
  if (truncated) rows.length = opts.limit;
  if (truncated) warnings.push(`truncated at limit ${opts.limit} — raise --limit or narrow the query`);

  const threadMeta                   = loadThreadMeta(stateDbPath(opts.home));
  if (threadMeta.warning) warnings.push(threadMeta.warning);

  const hits            = rows.map((r) => {
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

  const totalFiles = (db.prepare("SELECT COUNT(*) AS n FROM files").get()                 ).n;
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
  db      ,
  path        ,
  ord        ,
  n        ,
  includeSynthetic         ,
)                                                                      {
  const synthCond = includeSynthetic ? "" : " AND synthetic = 0";
  const before = db
    .prepare(`SELECT ts, role, text, ord FROM msgs WHERE path = ? AND ord < ?${synthCond} ORDER BY ord DESC LIMIT ?`)
    .all(path, ord, n)                                  ;
  const at = db
    .prepare("SELECT ts, role, text, ord FROM msgs WHERE path = ? AND ord = ?")
    .all(path, ord)                                  ;
  const after = db
    .prepare(`SELECT ts, role, text, ord FROM msgs WHERE path = ? AND ord > ?${synthCond} ORDER BY ord ASC LIMIT ?`)
    .all(path, ord, n)                                  ;
  const rows = [...before.reverse(), ...at, ...after];
  return rows.map((r) => ({
    ts: String(r.ts),
    role: String(r.role),
    text: String(r.text),
    isMatch: Number(r.ord) === ord,
  }));
}
