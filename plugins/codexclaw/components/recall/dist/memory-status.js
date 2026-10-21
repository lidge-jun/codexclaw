/**
 * memory-status.ts — read-only health snapshot of the host's native memory pipeline.
 *
 * Issue #187: nothing exposed whether extraction was running, stalled, or dead. The
 * recall component reported only its own chat index, so a pipeline that had stopped
 * days earlier looked identical to a healthy one.
 *
 * Three rules this module does not break:
 *  - READ-ONLY. It opens the store read-only and creates nothing. Requeue lives
 *    elsewhere and is a separate, explicitly authorised action.
 *  - NAME THE STORE. The host supports more than one memories schema version and can
 *    dual-write. Reporting counts without saying which file they came from would be a
 *    confident answer about the wrong database, so the snapshot carries `storePath`
 *    and reports `unsupported` rather than guessing.
 *  - DO NOT INVENT A BACKLOG. Host eligibility depends on source, age, idle time,
 *    memory mode and current-thread exclusion, none of which are visible here. A
 *    session without a job is not necessarily "pending", so no such number is emitted.
 */
import { existsSync } from "node:fs";
import { memoriesDbPath } from "./paths.js";
import { openDbReadOnly } from "./sqlite.js";



































/**
 * Bucket a host error string. The host's wording is not a stable contract, so these are
 * deliberately coarse and fall through to "other" rather than asserting a cause we
 * cannot support. A context-window failure matters most: retrying it unchanged repeats
 * the same failure, so it must not be reported as ordinary transient breakage.
 */
export function classifyMemoryError(raw                           )         {
  const text = String(raw ?? "").toLowerCase();
  if (!text) return "unknown";
  if (text.includes("context") && (text.includes("window") || text.includes("length") || text.includes("exceed"))) {
    return "context-window";
  }
  if (text.includes("rate limit") || text.includes("quota") || text.includes("429") || text.includes("capacity")) {
    return "capacity";
  }
  if (text.includes("incomplete")) return "incomplete-response";
  if (text.includes("stream") && text.includes("close")) return "stream-closed";
  return "other";
}

const REQUIRED_COLUMNS = ["kind", "status", "retry_remaining", "last_error", "finished_at"];
const OBSERVATION_LIMITS = {
  observationSource: "jobs-db",
  effectiveExtractionRoute: "unknown",
  startupGuardDecision: "unknown",
}         ;

function unsupported(storePath               , detail        )               {
  return {
    ...OBSERVATION_LIMITS,
    state: "unsupported",
    detail,
    storePath,
    jobs: [],
    exhausted: 0,
    exhaustedRecent: 0,
    exhaustedInert: 0,
    exhaustedByCause: {},
    lastSuccessAt: null,
    lastFinishedAt: null,
  };
}

/** SessionStart only reports exhaustion this recent; older piles live in `cxc memory status`. */
export const EXHAUSTED_NOTICE_WINDOW_SECONDS = 7 * 86_400;
const INERT_AGE_SECONDS = 90 * 86_400;

/** Collect the snapshot. Never throws: an unreadable store is a reported state. */
export function collectMemoryStatus(home        , now = Math.floor(Date.now() / 1000))               {
  let storePath                = null;
  try {
    storePath = memoriesDbPath(home);
  } catch {
    storePath = null;
  }
  if (!storePath || !existsSync(storePath)) {
    return {
      ...OBSERVATION_LIMITS,
      state: "unavailable",
      detail: "no memories store found under " + home,
      storePath: null,
      jobs: [],
      exhausted: 0,
      exhaustedRecent: 0,
      exhaustedInert: 0,
      exhaustedByCause: {},
      lastSuccessAt: null,
      lastFinishedAt: null,
    };
  }

  let db;
  try {
    db = openDbReadOnly(storePath);
  } catch (err) {
    return {
      ...OBSERVATION_LIMITS,
      state: "unavailable",
      detail: "could not open " + storePath + ": " + (err instanceof Error ? err.message : String(err)),
      storePath,
      jobs: [],
      exhausted: 0,
      exhaustedRecent: 0,
      exhaustedInert: 0,
      exhaustedByCause: {},
      lastSuccessAt: null,
      lastFinishedAt: null,
    };
  }

  try {
    const columns = db.prepare("PRAGMA table_info(jobs)").all()                             ;
    if (columns.length === 0) return unsupported(storePath, "no jobs table in this store");
    const present = new Set(columns.map((c) => String(c.name ?? "")));
    const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
    if (missing.length > 0) {
      return unsupported(storePath, "jobs table is missing column(s): " + missing.join(", "));
    }

    const jobs = (db.prepare("SELECT kind, status, COUNT(*) AS count FROM jobs GROUP BY kind, status ORDER BY kind, status").all()                                  ).map(
      (row) => ({ kind: String(row.kind), status: String(row.status), count: Number(row.count) }),
    );

    const exhaustedRows = db
      .prepare("SELECT kind, last_error, finished_at FROM jobs WHERE status = 'error' AND retry_remaining = 0")
      .all()                                  ;
    const exhaustedByCause                         = {};
    let exhaustedRecent = 0;
    let exhaustedInert = 0;
    for (const row of exhaustedRows) {
      const cause = classifyMemoryError(row.last_error                 );
      exhaustedByCause[cause] = (exhaustedByCause[cause] ?? 0) + 1;
      const finished = row.finished_at === null || row.finished_at === undefined ? null : Number(row.finished_at);
      // A row with no finish time cannot be dated, so it is treated as recent.
      if (finished === null || now - finished <= EXHAUSTED_NOTICE_WINDOW_SECONDS) exhaustedRecent += 1;
      if (finished !== null && String(row.kind) === "memory_stage1" && now - finished > INERT_AGE_SECONDS) exhaustedInert += 1;
    }

    const lastSuccess = db.prepare("SELECT MAX(finished_at) AS at FROM jobs WHERE status = 'done'").get()                                       ;
    const lastFinished = db.prepare("SELECT MAX(finished_at) AS at FROM jobs").get()                                       ;
    const num = (value         )                => (value === null || value === undefined ? null : Number(value));

    return {
      ...OBSERVATION_LIMITS,
      state: "ok",
      detail: "",
      storePath,
      jobs,
      exhausted: exhaustedRows.length,
      exhaustedRecent,
      exhaustedInert,
      exhaustedByCause,
      lastSuccessAt: num(lastSuccess?.at),
      lastFinishedAt: num(lastFinished?.at),
    };
  } catch (err) {
    return unsupported(storePath, "could not read the jobs table: " + (err instanceof Error ? err.message : String(err)));
  } finally {
    try {
      db.close();
    } catch {
      /* closing a read-only handle must not change the reported state */
    }
  }
}

function ageLabel(at               , now        )         {
  if (at === null) return "never";
  const seconds = Math.max(0, now - at);
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

/** Human-readable rendering for `cxc memory status`. */
export function formatMemoryStatus(status              , now = Math.floor(Date.now() / 1000))         {
  const scope = `  observation: ${status.observationSource}; effective extraction route: ${status.effectiveExtractionRoute}; startup guard decision: ${status.startupGuardDecision} (job history does not establish the current route or guard decision)`;
  if (status.state !== "ok") {
    return "memory pipeline: " + status.state + " — " + status.detail + "\n" + scope + "\n";
  }
  const lines           = [];
  lines.push("memory pipeline: " + status.storePath);
  lines.push(scope);
  if (status.jobs.length === 0) lines.push("  jobs: none recorded");
  for (const job of status.jobs) lines.push("  " + job.kind + " " + job.status + ": " + job.count);
  lines.push("  last success: " + ageLabel(status.lastSuccessAt, now));
  if (status.exhausted > 0) {
    const causes = Object.entries(status.exhaustedByCause)
      .sort((a, b) => b[1] - a[1])
      .map(([cause, count]) => cause + "=" + count)
      .join(", ");
    lines.push("  exhausted (host will not retry): " + status.exhausted + " [" + causes + "]");
    lines.push("    finished in the last 7 days: " + status.exhaustedRecent);
    if (status.exhaustedInert > 0) {
      lines.push("    inert (stage-1, finished over 90 days ago): " + status.exhaustedInert + " — cxc memory prune removes them");
    }
  }
  return lines.join("\n") + "\n";
}

/**
 * One bounded line for SessionStart, or "" when there is nothing worth saying.
 * Silence on a healthy pipeline is the point (issue #185): a banner that always fires
 * is a banner nobody reads.
 *
 * Exhaustion is reported only for jobs that finished inside the notice window. A
 * standing pile (298 rows on one machine) repeated the same count into every session
 * without anything changing; it stays visible in `cxc memory status`.
 */
export function memoryStatusNotice(status              , now = Math.floor(Date.now() / 1000), staleAfterSeconds = 172800)         {
  if (status.state === "unsupported") {
    return "memory pipeline: unsupported store schema — " + status.detail;
  }
  if (status.state === "unavailable") return "";
  const parts           = [];
  if (status.lastSuccessAt === null) {
    if (status.jobs.length > 0) parts.push("no successful extraction recorded yet");
  } else if (now - status.lastSuccessAt > staleAfterSeconds) {
    parts.push("last successful extraction " + ageLabel(status.lastSuccessAt, now));
  }
  if (status.exhaustedRecent > 0) parts.push(status.exhaustedRecent + " job(s) exhausted their retries in the last 7 days");
  if (parts.length === 0) return "";
  return "memory pipeline: " + parts.join("; ") + " (cxc memory status)";
}
