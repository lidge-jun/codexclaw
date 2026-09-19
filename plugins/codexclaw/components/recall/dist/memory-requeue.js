/**
 * memory-requeue.ts — selectively return dead-lettered memory extraction jobs to the
 * host's retry queue.
 *
 * Issue #188: 52 jobs sat at `status='error'` with `retry_remaining=0`. The host will
 * not pick those up again on its own, and no operator command existed to do it.
 *
 * The honest limitation, designed in rather than discovered later: most of those jobs
 * failed because the input did not fit the model's context window. Restoring their retry
 * allowance without changing the extraction condition makes them fail the same way and
 * spends quota doing it. So causes are classified, transient ones are the default
 * selection, and asking for the context-window ones requires saying so explicitly.
 *
 * Safety properties this module must keep:
 *  - DRY RUN BY DEFAULT. Nothing is written unless the caller passes `apply`.
 *  - NARROW PREDICATE. Only rows still matching `status='error' AND retry_remaining=0`
 *    are touched, re-checked inside the write transaction. Running, done and
 *    consolidation rows are never selected.
 *  - PRESERVE EVIDENCE. `last_error`, `input_watermark` and `last_success_watermark`
 *    are left alone. This restores an allowance; it does not rewrite history.
 *  - SCHEMA GUARD. An unfamiliar schema reports unsupported instead of writing.
 */
import { existsSync } from "node:fs";
import { memoriesDbPath } from "./paths.js";
import { openDbReadOnly, openDbReadWrite } from "./sqlite.js";
import { classifyMemoryError } from "./memory-status.js";

/** Causes worth retrying unchanged: the failure was about the moment, not the input. */
export const TRANSIENT_CAUSES = new Set(["capacity", "incomplete-response", "stream-closed", "unknown", "other"]);




































const REQUIRED_COLUMNS = ["kind", "job_key", "status", "retry_remaining", "last_error"];

function shell(state                        , detail        , storePath               , retries        )                {
  return { state, detail, storePath, applied: false, selected: [], skippedByCause: {}, changed: 0, retries };
}

export function requeueExhaustedMemoryJobs(home        , options                 = {})                {
  const retries = Number.isFinite(options.retries) && (options.retries          ) > 0 ? Math.floor(options.retries          ) : 3;
  let storePath                = null;
  try {
    storePath = memoriesDbPath(home);
  } catch {
    storePath = null;
  }
  if (!storePath || !existsSync(storePath)) return shell("unavailable", "no memories store found under " + home, null, retries);

  // Selection is read-only. The write connection is opened only when applying, so a
  // dry run cannot take a write lock on the operator's live database.
  let readDb;
  try {
    readDb = openDbReadOnly(storePath);
  } catch (err) {
    return shell("unavailable", "could not open " + storePath + ": " + (err instanceof Error ? err.message : String(err)), storePath, retries);
  }

  let selected                     = [];
  const skippedByCause                         = {};
  try {
    const columns = readDb.prepare("PRAGMA table_info(jobs)").all()                             ;
    if (columns.length === 0) return shell("unsupported", "no jobs table in this store", storePath, retries);
    const present = new Set(columns.map((c) => String(c.name ?? "")));
    const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
    if (missing.length > 0) return shell("unsupported", "jobs table is missing column(s): " + missing.join(", "), storePath, retries);

    const rows = readDb
      .prepare("SELECT kind, job_key, last_error FROM jobs WHERE status = 'error' AND retry_remaining = 0 ORDER BY kind, job_key")
      .all()                                  ;

    for (const row of rows) {
      const kind = String(row.kind);
      const cause = classifyMemoryError(row.last_error                 );
      const wantedKind = !options.kind || options.kind === kind;
      const wantedCause = TRANSIENT_CAUSES.has(cause) || (options.includeContextWindow === true && cause === "context-window");
      if (wantedKind && wantedCause) selected.push({ kind, jobKey: String(row.job_key), cause });
      else skippedByCause[cause] = (skippedByCause[cause] ?? 0) + 1;
    }
    if (Number.isFinite(options.limit) && (options.limit          ) >= 0) selected = selected.slice(0, options.limit          );
  } catch (err) {
    return shell("unsupported", "could not read the jobs table: " + (err instanceof Error ? err.message : String(err)), storePath, retries);
  } finally {
    try {
      readDb.close();
    } catch {
      /* ignore */
    }
  }

  const base                = { state: "ok", detail: "", storePath, applied: false, selected, skippedByCause, changed: 0, retries };
  if (!options.apply || selected.length === 0) return base;

  let writeDb;
  try {
    writeDb = openDbReadWrite(storePath);
  } catch (err) {
    return { ...base, state: "unavailable", detail: "could not open for writing: " + (err instanceof Error ? err.message : String(err)) };
  }
  try {
    writeDb.exec("BEGIN IMMEDIATE");
    // The predicate is repeated here on purpose. Between selection and this write the
    // host may have picked a row up; re-checking means a running job is never clobbered.
    const update = writeDb.prepare(
      "UPDATE jobs SET retry_remaining = ?, retry_at = NULL WHERE kind = ? AND job_key = ? AND status = 'error' AND retry_remaining = 0",
    );
    let changed = 0;
    for (const candidate of selected) {
      const info = update.run(retries, candidate.kind, candidate.jobKey);
      changed += Number(info.changes ?? 0);
    }
    writeDb.exec("COMMIT");
    return { ...base, applied: true, changed };
  } catch (err) {
    try {
      writeDb.exec("ROLLBACK");
    } catch {
      /* the commit already failed; nothing further to undo */
    }
    return { ...base, state: "unavailable", detail: "requeue failed and was rolled back: " + (err instanceof Error ? err.message : String(err)) };
  } finally {
    try {
      writeDb.close();
    } catch {
      /* ignore */
    }
  }
}

export function formatRequeue(result               )         {
  if (result.state !== "ok") return "memory requeue: " + result.state + " — " + result.detail + "\n";
  const lines           = [];
  lines.push("memory requeue: " + result.storePath);
  const byCause                         = {};
  for (const c of result.selected) byCause[c.cause] = (byCause[c.cause] ?? 0) + 1;
  const causes = Object.entries(byCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + "=" + v).join(", ");
  lines.push("  selected: " + result.selected.length + (causes ? " [" + causes + "]" : ""));
  const skipped = Object.entries(result.skippedByCause).sort((a, b) => b[1] - a[1]);
  if (skipped.length > 0) {
    lines.push("  left alone: " + skipped.map(([k, v]) => k + "=" + v).join(", "));
    if (result.skippedByCause["context-window"]) {
      lines.push("    context-window failures repeat unless the extraction input changes; --include-context-window overrides");
    }
  }
  lines.push(result.applied ? "  applied: " + result.changed + " row(s) given " + result.retries + " retries" : "  dry run — nothing written (pass --apply)");
  return lines.join("\n") + "\n";
}
