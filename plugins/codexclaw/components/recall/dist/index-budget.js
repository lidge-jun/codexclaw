/**
 * index-budget.ts — keep the recall sidecar index under a byte budget.
 *
 * The index is a derived cache of ~/.codex rollouts, which are never touched, so
 * holding it to a budget loses nothing permanently: an evicted session's messages
 * stay searchable through `cxc chat search --scan` over the raw JSONL. What the
 * index keeps is what recall can inject or answer instantly: the newest
 * sessions, measured by last activity (file mtime).
 *
 * Policy (devlog/_plan/261022_memory_size_budget):
 *  - The budget is on live database bytes, (page_count - freelist_count) *
 *    page_size, which is exact and costs three pragma reads. Text-size estimates
 *    were rejected: the bytes-per-character ratio differs between Korean and
 *    English text and between the word and trigram indexes.
 *  - Hysteresis: eviction starts above maxBytes and stops at lowWater * maxBytes,
 *    so an index sitting at the budget does not evict on every refresh.
 *  - Eviction drops a whole session's messages and keeps its files row, marked
 *    evicted, so the session list and change detection still see it.
 *  - After a batch both FTS indexes are optimized (FTS5 deletes add tombstones
 *    and would otherwise grow the index), then incremental_vacuum returns the
 *    freed pages to the filesystem and the WAL is checkpointed and truncated.
 *  - Nothing runs unless an ingest changed something or the index is over
 *    budget, so an idle machine does no index work at all.
 */
import { indexDiskBytes, usedDbBytes } from "./index-db.js";


/** Default ceiling for the whole index. The hard product limit is 100 MB. */
export const DEFAULT_INDEX_MAX_MB = 48;
/** Smallest budget an override may set; below this the newest day rarely fits. */
export const MIN_INDEX_MAX_MB = 4;
export const DEFAULT_LOW_WATER = 0.8;
/** Injection history older than this no longer affects ranking and is dropped. */
export const HIT_COUNT_RETENTION_DAYS = 90;
/** Bound on eviction rounds in one call; each round re-measures. */
const MAX_EVICTION_ROUNDS = 8;






/** `CODEXCLAW_RECALL_MAX_MB` overrides the default; anything unparsable is ignored. */
export function resolveIndexBudget(env                                     = process.env)              {
  const raw = env["CODEXCLAW_RECALL_MAX_MB"];
  const mb = raw !== undefined && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_INDEX_MAX_MB;
  const clamped = Math.max(MIN_INDEX_MAX_MB, mb);
  return { maxBytes: Math.floor(clamped * 1024 * 1024), lowWater: DEFAULT_LOW_WATER };
}









/** Optimize both FTS indexes, release free pages, truncate the WAL. */
export function compactIndex(db      )       {
  db.exec("INSERT INTO msgs_fts(msgs_fts) VALUES('optimize')");
  db.exec("INSERT INTO msgs_tri(msgs_tri) VALUES('optimize')");
  db.exec("PRAGMA incremental_vacuum");
  checkpointIndex(db);
}

/** Checkpoint and truncate the WAL. Busy readers make this a no-op, never an error. */
export function checkpointIndex(db      )       {
  try {
    db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
  } catch {
    /* a concurrent reader holds the WAL; the next writer checkpoints */
  }
}

function pruneHitCounts(db      , nowMs        )       {
  const cutoff = new Date(nowMs - HIT_COUNT_RETENTION_DAYS * 86_400_000).toISOString();
  try {
    db.prepare("DELETE FROM recall_hit_counts WHERE last_hit_at < ?").run(cutoff);
  } catch {
    /* table absent */
  }
}

/**
 * Evict the least recently active sessions until the index is back under
 * lowWater * maxBytes. A no-op (one measurement) when already under maxBytes.
 */
export function evictToBudget(db      , budget             , nowMs = Date.now())                 {
  const beforeBytes = usedDbBytes(db);
  const result                 = { evictedFiles: 0, beforeBytes, afterBytes: beforeBytes };
  if (beforeBytes <= budget.maxBytes) return result;

  pruneHitCounts(db, nowMs);
  const target = Math.floor(budget.maxBytes * budget.lowWater);
  const live = db.prepare("SELECT path, text_bytes FROM files WHERE evicted = 0 ORDER BY mtime_ms ASC, path ASC");
  const delMsgs = db.prepare("DELETE FROM msgs WHERE path = ?");
  const mark = db.prepare("UPDATE files SET evicted = 1, text_bytes = 0, bytes_ingested = 0, last_ord = 0 WHERE path = ?");
  let used = beforeBytes;
  for (let round = 0; round < MAX_EVICTION_ROUNDS && used > target; round += 1) {
    const rows = live.all()                                               ;
    if (rows.length === 0) break;
    const totalText = rows.reduce((n, r) => n + Number(r.text_bytes), 0);
    // Index bytes scale with stored text, so evict the same fraction of text
    // that the index is over target, with a margin so one round usually ends it.
    const needText = Math.ceil(totalText * ((used - target) / used) * 1.1);
    const victims           = [];
    let freed = 0;
    for (const row of rows) {
      victims.push(String(row.path));
      freed += Number(row.text_bytes);
      if (freed >= needText) break;
    }
    db.exec("BEGIN");
    try {
      for (const path of victims) {
        delMsgs.run(path);
        mark.run(path);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    result.evictedFiles += victims.length;
    compactIndex(db);
    used = usedDbBytes(db);
  }
  result.afterBytes = used;
  return result;
}










/** Stat-only health read: never opens the database, safe for SessionStart. */
export function recallIndexHealth(path        , budget              = resolveIndexBudget())                    {
  const diskBytes = indexDiskBytes(path);
  return {
    path,
    exists: diskBytes > 0,
    diskBytes,
    budgetBytes: budget.maxBytes,
    // The WAL may legitimately hold a few MB between checkpoints.
    overBudget: diskBytes > budget.maxBytes + 8 * 1024 * 1024,
  };
}

export function formatMb(bytes        )         {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** One SessionStart line when the index is over budget, else "". */
export function recallIndexNotice(health                   )         {
  if (!health.exists || !health.overBudget) return "";
  return "recall index " + formatMb(health.diskBytes) + " exceeds its " + formatMb(health.budgetBytes) + " budget (cxc chat index compacts it)";
}
