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
import { memoriesDbPath } from "./paths.ts";
import { openDbReadOnly } from "./sqlite.ts";

export type MemoryStatusState = "ok" | "unavailable" | "unsupported";

export interface MemoryJobCounts {
  kind: string;
  status: string;
  count: number;
}

export interface MemoryStatus {
  state: MemoryStatusState;
  /** Collector identity, including when the store could not be read. */
  observationSource: "jobs-db";
  /** Job history cannot establish the current extraction route or startup guard. */
  effectiveExtractionRoute: "unknown";
  startupGuardDecision: "unknown";
  /** Why the snapshot is not `ok`. Empty when it is. */
  detail: string;
  /** The file actually read, so a reader can tell which schema version answered. */
  storePath: string | null;
  jobs: MemoryJobCounts[];
  /** status='error' AND retry_remaining=0: the host will not retry these on its own. */
  exhausted: number;
  /** Coarse buckets derived from last_error, for operator triage. */
  exhaustedByCause: Record<string, number>;
  /** Newest finished_at across successful jobs, epoch seconds, or null. */
  lastSuccessAt: number | null;
  /** Newest finished_at across all jobs, epoch seconds, or null. */
  lastFinishedAt: number | null;
}

/**
 * Bucket a host error string. The host's wording is not a stable contract, so these are
 * deliberately coarse and fall through to "other" rather than asserting a cause we
 * cannot support. A context-window failure matters most: retrying it unchanged repeats
 * the same failure, so it must not be reported as ordinary transient breakage.
 */
export function classifyMemoryError(raw: string | null | undefined): string {
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
} as const;

function unsupported(storePath: string | null, detail: string): MemoryStatus {
  return {
    ...OBSERVATION_LIMITS,
    state: "unsupported",
    detail,
    storePath,
    jobs: [],
    exhausted: 0,
    exhaustedByCause: {},
    lastSuccessAt: null,
    lastFinishedAt: null,
  };
}

/** Collect the snapshot. Never throws: an unreadable store is a reported state. */
export function collectMemoryStatus(home: string): MemoryStatus {
  let storePath: string | null = null;
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
      exhaustedByCause: {},
      lastSuccessAt: null,
      lastFinishedAt: null,
    };
  }

  try {
    const columns = db.prepare("PRAGMA table_info(jobs)").all() as Array<{ name?: unknown }>;
    if (columns.length === 0) return unsupported(storePath, "no jobs table in this store");
    const present = new Set(columns.map((c) => String(c.name ?? "")));
    const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
    if (missing.length > 0) {
      return unsupported(storePath, "jobs table is missing column(s): " + missing.join(", "));
    }

    const jobs = (db.prepare("SELECT kind, status, COUNT(*) AS count FROM jobs GROUP BY kind, status ORDER BY kind, status").all() as Array<Record<string, unknown>>).map(
      (row) => ({ kind: String(row.kind), status: String(row.status), count: Number(row.count) }),
    );

    const exhaustedRows = db
      .prepare("SELECT last_error FROM jobs WHERE status = 'error' AND retry_remaining = 0")
      .all() as Array<Record<string, unknown>>;
    const exhaustedByCause: Record<string, number> = {};
    for (const row of exhaustedRows) {
      const cause = classifyMemoryError(row.last_error as string | null);
      exhaustedByCause[cause] = (exhaustedByCause[cause] ?? 0) + 1;
    }

    const lastSuccess = db.prepare("SELECT MAX(finished_at) AS at FROM jobs WHERE status = 'done'").get() as Record<string, unknown> | undefined;
    const lastFinished = db.prepare("SELECT MAX(finished_at) AS at FROM jobs").get() as Record<string, unknown> | undefined;
    const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

    return {
      ...OBSERVATION_LIMITS,
      state: "ok",
      detail: "",
      storePath,
      jobs,
      exhausted: exhaustedRows.length,
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

function ageLabel(at: number | null, now: number): string {
  if (at === null) return "never";
  const seconds = Math.max(0, now - at);
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

/** Human-readable rendering for `cxc memory status`. */
export function formatMemoryStatus(status: MemoryStatus, now = Math.floor(Date.now() / 1000)): string {
  const scope = `  observation: ${status.observationSource}; effective extraction route: ${status.effectiveExtractionRoute}; startup guard decision: ${status.startupGuardDecision} (job history does not establish the current route or guard decision)`;
  if (status.state !== "ok") {
    return "memory pipeline: " + status.state + " — " + status.detail + "\n" + scope + "\n";
  }
  const lines: string[] = [];
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
  }
  return lines.join("\n") + "\n";
}

/**
 * One bounded line for SessionStart, or "" when there is nothing worth saying.
 * Silence on a healthy pipeline is the point (issue #185): a banner that always fires
 * is a banner nobody reads.
 */
export function memoryStatusNotice(status: MemoryStatus, now = Math.floor(Date.now() / 1000), staleAfterSeconds = 172800): string {
  if (status.state === "unsupported") {
    return "memory pipeline: unsupported store schema — " + status.detail;
  }
  if (status.state === "unavailable") return "";
  const parts: string[] = [];
  if (status.lastSuccessAt === null) {
    if (status.jobs.length > 0) parts.push("no successful extraction recorded yet");
  } else if (now - status.lastSuccessAt > staleAfterSeconds) {
    parts.push("last successful extraction " + ageLabel(status.lastSuccessAt, now));
  }
  if (status.exhausted > 0) parts.push(status.exhausted + " job(s) exhausted their retries");
  if (parts.length === 0) return "";
  return "memory pipeline: " + parts.join("; ") + " (cxc memory status)";
}
