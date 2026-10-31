/**
 * memory-prune.ts — delete dead-lettered memory_stage1 jobs the host can never run again.
 *
 * The host claims a stage-1 extraction job only for threads updated within
 * `memories.max_rollout_age_days` (default 10, clamped to at most 90), and it skips a
 * row whose `retry_remaining` is 0 forever (codex-rs state/src/runtime/memories.rs,
 * claim_stage1_jobs_for_startup / try_claim_stage1_job). An exhausted row whose job
 * finished more than 90 days ago therefore does nothing except sit in the table and
 * inflate the "exhausted" count. If its thread is later resumed, the host simply
 * claims a fresh job for the updated thread, which is the behaviour a resumed
 * thread should get anyway.
 *
 * Same safety properties as memory-requeue.ts: dry run by default, narrow predicate
 * re-checked inside the write transaction, schema guard, never touches running,
 * done or consolidation rows.
 */
import { existsSync } from "node:fs";
import { memoriesDbPath } from "./paths.js";
import { openDbReadOnly, openDbReadWrite } from "./sqlite.js";

/** The host's own upper clamp on max_rollout_age_days. Pruning younger rows could resurrect them. */
export const MIN_PRUNE_AGE_DAYS = 90;
const STAGE1_KIND = "memory_stage1";
const REQUIRED_COLUMNS = ["kind", "job_key", "status", "retry_remaining", "finished_at"];
const PREDICATE = "kind = ? AND status = 'error' AND retry_remaining = 0 AND finished_at IS NOT NULL AND finished_at < ?";




















export function pruneInertMemoryJobs(home        , options               = {})              {
  const requested = Number.isFinite(options.olderThanDays) ? Math.floor(options.olderThanDays          ) : MIN_PRUNE_AGE_DAYS;
  const olderThanDays = Math.max(MIN_PRUNE_AGE_DAYS, requested);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const cutoff = now - olderThanDays * 86_400;
  const shell = (state                      , detail        , storePath               )              => ({
    state, detail, storePath, applied: false, candidates: 0, deleted: 0, olderThanDays,
  });
  let storePath                = null;
  try {
    storePath = memoriesDbPath(home);
  } catch {
    storePath = null;
  }
  if (!storePath || !existsSync(storePath)) return shell("unavailable", "no memories store found under " + home, null);

  let candidates = 0;
  let readDb;
  try {
    readDb = openDbReadOnly(storePath);
  } catch (err) {
    return shell("unavailable", "could not open " + storePath + ": " + (err instanceof Error ? err.message : String(err)), storePath);
  }
  try {
    const columns = readDb.prepare("PRAGMA table_info(jobs)").all()                             ;
    if (columns.length === 0) return shell("unsupported", "no jobs table in this store", storePath);
    const present = new Set(columns.map((c) => String(c.name ?? "")));
    const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
    if (missing.length > 0) return shell("unsupported", "jobs table is missing column(s): " + missing.join(", "), storePath);
    candidates = Number((readDb.prepare("SELECT COUNT(*) AS n FROM jobs WHERE " + PREDICATE).get(STAGE1_KIND, cutoff)                 ).n);
  } catch (err) {
    return shell("unsupported", "could not read the jobs table: " + (err instanceof Error ? err.message : String(err)), storePath);
  } finally {
    try { readDb.close(); } catch { /* ignore */ }
  }

  const base              = { ...shell("ok", "", storePath), candidates };
  if (!options.apply || candidates === 0) return base;
  let writeDb;
  try {
    writeDb = openDbReadWrite(storePath);
  } catch (err) {
    return { ...base, state: "unavailable", detail: "could not open for writing: " + (err instanceof Error ? err.message : String(err)) };
  }
  try {
    writeDb.exec("BEGIN IMMEDIATE");
    const info = writeDb.prepare("DELETE FROM jobs WHERE " + PREDICATE).run(STAGE1_KIND, cutoff);
    writeDb.exec("COMMIT");
    return { ...base, applied: true, deleted: Number(info.changes ?? 0) };
  } catch (err) {
    try { writeDb.exec("ROLLBACK"); } catch { /* nothing to undo */ }
    return { ...base, state: "unavailable", detail: "prune failed and was rolled back: " + (err instanceof Error ? err.message : String(err)) };
  } finally {
    try { writeDb.close(); } catch { /* ignore */ }
  }
}

export function formatPrune(result             )         {
  if (result.state !== "ok") return "memory prune: " + result.state + " — " + result.detail + "\n";
  const lines = [
    "memory prune: " + result.storePath,
    "  exhausted stage-1 jobs finished over " + result.olderThanDays + " days ago: " + result.candidates,
    result.applied ? "  deleted: " + result.deleted : "  dry run — nothing written (pass --apply)",
  ];
  return lines.join("\n") + "\n";
}
