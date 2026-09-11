/**
 * index-search.ts — chat search served from the sidecar FTS index.
 *
 * Matching parity with the scan path (substring, case-insensitive):
 *   - words of >=3 chars use the trigram FTS table (substring semantics for ASCII
 *     and CJK alike; the WP2 spike verified 2-char CJK words return nothing);
 *   - shorter words fall back to LIKE over msgs.text (indexed table, still far
 *     smaller than raw JSONL);
 *   - AND intersects per-word id sets, OR unions them (scan-path semantics);
 *   - a relaxed plan (query-words.ts MatchPlan) puts only its REQUIRED groups in
 *     SQL and leaves the optional quota to the JS predicate, so SQL is a
 *     candidate generator and `textMatches` is the authority.
 * Filters (synthetic/source/cwd/role/days/tools) compile to SQL.
 *
 * Ordering has two modes. "recent" is the original pure ts-DESC query with
 * limit+1 truncation detection. "relevance" (the default) fuses two ranking
 * lanes over the same candidate set with reciprocal rank fusion and adds a
 * bounded recency term. Both modes apply the SAME match predicate, so ranking
 * can never widen or narrow what counts as a hit; when a query matches more
 * than the limit they differ only in WHICH matches fill the page (best vs
 * newest), which is the entire point of the change. Below the limit the two
 * return set-equal results — pinned by the index.test.ts oracle.
 */
import type { RwDb } from "./sqlite.ts";
import type { ChatHit, ChatSearchResult } from "./chat-search.ts";
import type { RolloutSource } from "./rollout.ts";
import { FOLD_CWD_CASE } from "./rollout.ts";
import { loadThreadMeta, type ThreadMetaResult } from "./threads-db.ts";
import { stateDbPath } from "./paths.ts";
import { filesHasColumn } from "./index-db.ts";
import { normalizeRepoKey, repoKeysEqual } from "./repo-key.ts";
import { planMatches, allGroups, type MatchPlan, type QueryGroup } from "./query-words.ts";

/** Result ordering: fused relevance (default) or the original pure recency. */
export type ChatOrder = "relevance" | "recent";

export type IndexQueryOptions = {
  /** compiled match plan; the sole definition of what counts as a hit. */
  plan: MatchPlan;
  limit: number;
  contextN: number;
  cutoffIso: string | null;
  role: string | null;
  cwd: string | null;
  source: RolloutSource | "all";
  includeSynthetic: boolean;
  includeTools: boolean;
  home: string;
  order?: ChatOrder;
  /**
   * Normalized git remote of the requested --cwd. When set, a file recorded
   * under a DIFFERENT path but the same remote counts as in-scope: a managed
   * worktree and its main checkout are one project.
   */
  repoKey?: string | null;
  /** clock override for deterministic recency scoring in tests. */
  nowMs?: number;
};

/**
 * Query options plus the two facts that can only be answered against the open
 * database: whether this index has the wp4 column at all, and which threads
 * share the requested remote (the read-only path's substitute for that column).
 */
type ResolvedQuery = IndexQueryOptions & {
  repoThreadIds: string[];
  hasRepoKeyColumn: boolean;
};

/**
 * Bound on the thread-id IN list. SQLite's parameter limit is far higher
 * (32,766), and this machine's largest project has ~1,500 threads, so the cap
 * only exists so a pathological state db cannot build an unbounded statement.
 */
const MAX_REPO_THREAD_IDS = 5_000;

// ─── Ranking constants ──────────────────────────────────────────────────────

/**
 * Reciprocal rank fusion, cli-jaw's parameters (indexing.ts): k=60, BM25 lane
 * weighted 1.0 and the trigram lane 0.8. Sign convention follows memory-search,
 * not cli-jaw: HIGHER IS BETTER everywhere in this repo.
 */
export const RRF_K = 60;
export const LANE_WEIGHT_FTS = 1.0;
export const LANE_WEIGHT_TRI = 0.8;

/**
 * Recency is a tie-breaker, never the driver, and its size is derived rather
 * than guessed: a maximally fresh message gains exactly ONE adjacent-rank gap
 * at the head of the BM25 lane, `w/((k+1)(k+2))`. Since a hit that leads in
 * both lanes leads by more than that, recency can only reorder hits the lanes
 * consider near-equivalent. Measured against the fixture corpus, a 30-day-old
 * dense match still outranks a 1-hour-old passing mention.
 */
export const RECENCY_WEIGHT = LANE_WEIGHT_FTS / ((RRF_K + 1) * (RRF_K + 2));
export const RECENCY_HALF_LIFE_HOURS = 24 * 7;

/** Candidate/lane depth: enough headroom that filters cannot starve the limit. */
function poolSize(limit: number): number {
  return Math.min(500, Math.max(100, limit * 10));
}

/**
 * Depth for a plan whose WHERE clause carries no word condition at all — a
 * relaxed query with no required symbol, where the JS predicate is the only
 * thing narrowing the corpus. It has to look deeper before throwing rows away.
 */
const RELAXED_POOL = 2_000;

/** Lane/sweep depth for this plan. */
function planPoolSize(plan: MatchPlan, limit: number): number {
  const base = poolSize(limit);
  const noWordSql = !plan.anyMode && plan.required.length === 0 && plan.optional.length > 0;
  return noWordSql ? Math.max(base, RELAXED_POOL) : base;
}

/** Optional lead words fed to a lane when the plan has no required group. */
const MAX_OPTIONAL_LANE_WORDS = 6;

/**
 * Which words rank the lanes and how they join. Lane membership is NOT the
 * match test, so a lane only needs a cheap, selective approximation: the
 * required leads ANDed when there are any, otherwise an OR over the longest-
 * serviceable optional leads (a lane MATCH over nine ORed Korean words costs
 * more than it ranks). Group leads only — the word the user typed is the one
 * whose BM25 rank is worth having.
 */
function laneQuery(plan: MatchPlan): { words: string[]; anyMode: boolean } {
  const lead = (g: QueryGroup) => g[0]?.text ?? "";
  const nonEmpty = (w: string) => w !== "";
  if (plan.anyMode) return { words: allGroups(plan).map(lead).filter(nonEmpty), anyMode: true };
  if (plan.required.length > 0) return { words: plan.required.map(lead).filter(nonEmpty), anyMode: false };
  return {
    words: plan.optional
      .map(lead)
      .filter((w) => [...w].length >= 3)
      .slice(0, MAX_OPTIONAL_LANE_WORDS),
    anyMode: true,
  };
}

/** RRF contribution of one lane; ranks are 0-based, the formula is 1-based. */
export function rrfScore(rank: number | undefined, weight: number): number {
  return rank === undefined ? 0 : weight / (RRF_K + rank + 1);
}

/** Exponential recency term in [0, RECENCY_WEIGHT]; future stamps clamp to age 0. */
export function recencyScore(tsMs: number | null, nowMs: number): number {
  if (tsMs === null || !Number.isFinite(tsMs)) return 0;
  const ageHours = Math.max(0, (nowMs - tsMs) / 3_600_000);
  return RECENCY_WEIGHT * Math.exp((-Math.LN2 * ageHours) / RECENCY_HALF_LIFE_HOURS);
}

/** FTS5 MATCH treats bare tokens as syntax; quote each word (embedded quotes doubled). */
function ftsQuote(word: string): string {
  return `"${word.replace(/"/g, '""')}"`;
}

function escapeLike(word: string): string {
  return word.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Thread ids whose recorded remote matches `repoKey`.
 *
 * This is what makes same-project federation work on a read-only index: the
 * files table there predates the repo_key column and cannot be altered, but
 * the Codex state db already stores git_origin_url per thread, and files rows
 * carry thread_id. Empty when no key was requested or none matched.
 */
function sameOriginThreadIds(meta: ThreadMetaResult, repoKey: string | null): string[] {
  if (!repoKey) return [];
  const ids: string[] = [];
  for (const [id, thread] of meta.byId) {
    if (repoKeysEqual(repoKey, normalizeRepoKey(thread.gitOriginUrl))) {
      ids.push(id);
      if (ids.length >= MAX_REPO_THREAD_IDS) break;
    }
  }
  return ids;
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

/** One OR-group: any member present satisfies it. */
function groupCondition(group: QueryGroup, params: unknown[]): string {
  if (group.length === 0) return "1";
  return `(${group.map((t) => wordCondition(t.text, params)).join(" OR ")})`;
}

/**
 * The candidate WHERE clause: word matching plus every filter, shared by both
 * ordering modes so ranking can never widen or narrow recall.
 *
 * Only the plan's REQUIRED groups enter SQL. The optional groups are a quota,
 * not a requirement, and ANDing them here would re-impose exactly the AND the
 * relaxation exists to break; ORing them would widen the candidate set for no
 * gain. When there is no required group the word clause is omitted entirely and
 * `textMatches` narrows the sweep instead.
 */
function candidateFilter(opts: ResolvedQuery, withWords = true): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const conds: string[] = [];
  if (withWords) {
    if (opts.plan.anyMode) {
      const groups = allGroups(opts.plan);
      if (groups.length > 0) {
        conds.push(`(${groups.map((g) => groupCondition(g, params)).join(" OR ")})`);
      }
    } else if (opts.plan.required.length > 0) {
      conds.push(`(${opts.plan.required.map((g) => groupCondition(g, params)).join(" AND ")})`);
    }
  }
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
    // Separator-aware prefix: exact cwd, or a child path under it on either
    // separator style — /repo must never match /repo2.
    const parts = [
      // macOS folds path case (see rollout.ts FOLD_CWD_CASE); elsewhere the
      // exact comparison stays byte-exact as before.
      FOLD_CWD_CASE ? "lower(f.cwd) = lower(?)" : "f.cwd = ?",
      "f.cwd LIKE ? ESCAPE '\\'",
      "f.cwd LIKE ? ESCAPE '\\'",
    ];
    // Backslash separator must itself be escaped under ESCAPE '\': pattern "\\%".
    params.push(opts.cwd, `${escapeLike(opts.cwd)}/%`, `${escapeLike(opts.cwd)}\\\\%`);
    if (opts.repoKey && opts.hasRepoKeyColumn) {
      parts.push("(f.repo_key IS NOT NULL AND f.repo_key = ?)");
      params.push(opts.repoKey);
    }
    if (opts.repoThreadIds.length > 0) {
      // The read-only path (--no-refresh) can never have run the ALTER, so the
      // same-origin thread ids from the state db stand in for the column.
      parts.push(`f.thread_id IN (${opts.repoThreadIds.map(() => "?").join(",")})`);
      params.push(...opts.repoThreadIds);
    }
    conds.push(`(${parts.join(" OR ")})`);
  }
  return { where: conds.length > 0 ? conds.join(" AND ") : "1", params };
}

/**
 * Scan-path semantics, in JS, on every row that could become a hit. Applied
 * here instead of re-running the trigram subqueries in SQL — same answer, and
 * it drops ~250ms on the 12GB index because the expensive MATCH is not
 * evaluated twice. It is also the only place the optional quota is enforced.
 */
function textMatches(text: string, plan: MatchPlan): boolean {
  return planMatches(text.toLowerCase(), plan);
}

const ROW_COLUMNS = `SELECT m.id, m.path, m.ord, m.ts, m.role, m.match_field, m.text,
      f.thread_id, f.cwd, f.source
    FROM msgs m JOIN files f ON f.path = m.path
    WHERE `;

type IndexRow = Record<string, unknown>;

/**
 * Rank one FTS lane by BM25. Both lanes are ordered by relevance rather than
 * rowid: rowid order is ingest order, which would smuggle "oldest first" into
 * the fusion. A lane that errors (MATCH syntax, missing table on an old index)
 * degrades to empty so the other lane and the recency term still rank.
 */
function laneRanks(db: RwDb, table: "msgs_fts" | "msgs_tri", words: string[], anyMode: boolean, k: number): Map<number, number> {
  const ranks = new Map<number, number>();
  if (words.length === 0) return ranks;
  const expr = words.map(ftsQuote).join(anyMode ? " OR " : " AND ");
  try {
    const rows = db
      .prepare(`SELECT rowid AS id FROM ${table} WHERE ${table} MATCH ? ORDER BY bm25(${table}) LIMIT ?`)
      .all(expr, k) as IndexRow[];
    rows.forEach((r, i) => ranks.set(Number(r.id), i));
  } catch {
    // lane unavailable — fusion proceeds without it.
  }
  return ranks;
}

/**
 * Fused ordering. Candidates come from two directions so neither bias wins:
 * the lanes contribute their best matches at any age, and a ts-DESC sweep
 * contributes recent matches even when no lane can score them (2-char CJK
 * queries run on LIKE alone and reach this path with both lanes empty, which
 * degenerates cleanly to the old recency order).
 */
function rankedRows(db: RwDb, opts: ResolvedQuery): { rows: IndexRow[]; truncated: boolean } {
  const k = planPoolSize(opts.plan, opts.limit);
  const nowMs = opts.nowMs ?? Date.now();
  const lane = laneQuery(opts.plan);
  const triWords = lane.words.filter((w) => [...w].length >= 3);
  const ftsRanks = laneRanks(db, "msgs_fts", lane.words, lane.anyMode, k);
  const triRanks = laneRanks(db, "msgs_tri", triWords, lane.anyMode, k);

  const byId = new Map<number, IndexRow>();
  const laneIds = [...new Set([...ftsRanks.keys(), ...triRanks.keys()])];
  if (laneIds.length > 0) {
    const bare = candidateFilter(opts, false);
    const holes = laneIds.map(() => "?").join(",");
    const rows = db
      .prepare(`${ROW_COLUMNS}${bare.where} AND m.id IN (${holes})`)
      .all(...bare.params, ...laneIds) as IndexRow[];
    for (const r of rows) {
      // Lane membership is not the match test: FTS tokenization is coarser than
      // the scan path's substring rule ("releases" tokenizes away from
      // "release"). Re-checking here keeps index/scan parity exact.
      if (textMatches(String(r.text), opts.plan)) byId.set(Number(r.id), r);
    }
  }
  // Top-up sweep. Only runs when the lanes could not fill the page: a query no
  // lane can serve (2-char CJK on the LIKE path), or one whose lane candidates
  // were mostly eliminated by filters. Skipping it when the lanes already
  // deliver is what keeps ranked latency close to the plain recency query.
  if (byId.size < opts.limit + 1) {
    const full = candidateFilter(opts);
    const recent = db
      .prepare(`${ROW_COLUMNS}${full.where} ORDER BY m.ts DESC LIMIT ?`)
      .all(...full.params, k) as IndexRow[];
    for (const r of recent) {
      const id = Number(r.id);
      // The sweep bypasses the lanes, so it needs the predicate too: a relaxed
      // plan puts no word condition in SQL, and an unfiltered sweep would top
      // the page up with the newest messages in the corpus.
      if (!byId.has(id) && textMatches(String(r.text), opts.plan)) byId.set(id, r);
    }
  }

  const scored = [...byId.entries()].map(([id, row]) => {
    const tsMs = Date.parse(String(row.ts));
    const score =
      rrfScore(ftsRanks.get(id), LANE_WEIGHT_FTS) +
      rrfScore(triRanks.get(id), LANE_WEIGHT_TRI) +
      recencyScore(Number.isNaN(tsMs) ? null : tsMs, nowMs);
    return { id, row, score };
  });
  // Deterministic total order: score, then newest, then insertion id.
  scored.sort((a, b) => b.score - a.score || (a.row.ts < b.row.ts ? 1 : a.row.ts > b.row.ts ? -1 : 0) || a.id - b.id);
  const truncated = scored.length > opts.limit;
  return { rows: scored.slice(0, opts.limit).map((s) => ({ ...s.row, score: s.score })), truncated };
}

export function queryIndex(db: RwDb, opts: IndexQueryOptions): ChatSearchResult {
  const started = Date.now();
  const warnings: string[] = [];
  // Thread metadata is loaded up front now: it enriches the hits below AND
  // supplies the same-origin thread ids the cwd filter needs.
  const threadMeta: ThreadMetaResult = loadThreadMeta(stateDbPath(opts.home));
  const query: ResolvedQuery = {
    ...opts,
    repoKey: opts.repoKey ?? null,
    hasRepoKeyColumn: filesHasColumn(db, "repo_key"),
    repoThreadIds: sameOriginThreadIds(threadMeta, opts.repoKey ?? null),
  };
  let rows: IndexRow[];
  let truncated: boolean;
  if ((query.order ?? "relevance") === "recent") {
    const { where, params } = candidateFilter(query);
    // A pool, not limit+1: the optional quota lives in JS, so rows have to pass
    // the predicate before the page is cut. Without this, "recent" ordering on
    // a relaxed query degrades into "the newest limit+1 messages there are".
    const pool = db
      .prepare(`${ROW_COLUMNS}${where} ORDER BY m.ts DESC LIMIT ?`)
      .all(...params, planPoolSize(query.plan, query.limit)) as IndexRow[];
    rows = pool.filter((r) => textMatches(String(r.text), query.plan)).slice(0, query.limit + 1);
    truncated = rows.length > query.limit;
    if (truncated) rows.length = query.limit;
  } else {
    const ranked = rankedRows(db, query);
    rows = ranked.rows;
    truncated = ranked.truncated;
  }
  if (truncated) warnings.push(`truncated at limit ${query.limit} — raise --limit or narrow the query`);
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
      ...(typeof r.score === "number" ? { score: r.score } : {}),
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
