/**
 * maintenance.ts — the idle-gated background pass that keeps the recall index
 * inside its budget without waiting for someone to search.
 *
 * Before this, the budget was enforced only by ingest, which runs on a search or
 * `cxc chat index`. An index nobody queried (including an old 410 MB v2 file)
 * stayed oversized indefinitely.
 *
 * When it runs (pattern from oh-my-openagent `memory-maintenance.ts`):
 *  - Only from SessionStart. A host where no session starts does no memory work.
 *  - At most once per `MAINTENANCE_INTERVAL_MS` (12 h) across all processes: the
 *    stamp is `recall/maintenance.json`, read before anything is spawned.
 *  - Only when an index already exists; a hook never materializes the cache.
 *  - One runner at a time: the hook claims `recall/maintenance.lock`
 *    create-exclusively before spawning, the pass releases it when done, and a
 *    lock older than 30 minutes is treated as a crashed runner.
 *  - Off the hot path: the hook spawns a detached, unref'd child and returns;
 *    the child waits `DEFAULT_DELAY_MS` (30 s) so it never competes with startup.
 *
 * What it does: migrate an older index, refresh it (ingest enforces the budget
 * and truncates the WAL), and record the result and footprint in the stamp. On an
 * oversized store the first pass is the one-time compaction; later passes are a
 * directory listing plus stats when nothing changed.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { codexclawHome, indexDiskBytes, openIndex } from "./index-db.ts";
import { ingest } from "./ingest.ts";
import { resolveIndexBudget, type IndexBudget } from "./index-budget.ts";
import { measureFootprint, type Footprint } from "./footprint.ts";

export const MAINTENANCE_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const DEFAULT_DELAY_MS = 30_000;
export const LOCK_STALE_MS = 30 * 60 * 1000;

export interface MaintenancePaths {
  index: string;
  stamp: string;
  lock: string;
  root: string;
}

export function maintenancePaths(indexPathValue: string, env: Record<string, string | undefined> = process.env): MaintenancePaths {
  const dir = dirname(indexPathValue);
  return { index: indexPathValue, stamp: join(dir, "maintenance.json"), lock: join(dir, "maintenance.lock"), root: codexclawHome(env) };
}

export interface MaintenanceStamp {
  at: string;
  ok: boolean;
  detail: string;
  beforeBytes: number;
  afterBytes: number;
  ingested: number;
  evicted: number;
  footprintBytes: number;
}

export function readStamp(paths: MaintenancePaths): MaintenanceStamp | null {
  try {
    return JSON.parse(readFileSync(paths.stamp, "utf8")) as MaintenanceStamp;
  } catch {
    return null;
  }
}

/** Due when no stamp exists or the last pass is older than the interval. */
export function maintenanceDue(paths: MaintenancePaths, nowMs: number, intervalMs = MAINTENANCE_INTERVAL_MS): boolean {
  const stamp = readStamp(paths);
  if (!stamp) return true;
  const at = Date.parse(stamp.at);
  return Number.isNaN(at) || nowMs - at >= intervalMs;
}

/** Create-exclusive claim returning its token; takes over a lock older than LOCK_STALE_MS. */
export function claimLock(paths: MaintenancePaths, nowMs: number): string | null {
  mkdirSync(dirname(paths.lock), { recursive: true });
  const token = randomUUID();
  const body = JSON.stringify({ token, pid: process.pid, at: new Date(nowMs).toISOString() });
  try {
    writeFileSync(paths.lock, body, { flag: "wx" });
    return token;
  } catch {
    try {
      if (nowMs - lockClaimedAt(paths) <= LOCK_STALE_MS) return null;
      rmSync(paths.lock, { force: true });
      writeFileSync(paths.lock, body, { flag: "wx" });
      return token;
    } catch {
      return null;
    }
  }
}

/** When the current lock was claimed: its recorded time, else its mtime. */
function lockClaimedAt(paths: MaintenancePaths): number {
  try {
    const at = Date.parse(String((JSON.parse(readFileSync(paths.lock, "utf8")) as { at?: unknown }).at));
    if (!Number.isNaN(at)) return at;
  } catch {
    /* unreadable: fall back to the file time */
  }
  return statSync(paths.lock).mtimeMs;
}

/** True when the lock on disk carries this token (the hook handed it to us). */
export function holdsLock(paths: MaintenancePaths, token: string): boolean {
  try {
    return (JSON.parse(readFileSync(paths.lock, "utf8")) as { token?: unknown }).token === token;
  } catch {
    return false;
  }
}

export function releaseLock(paths: MaintenancePaths): void {
  rmSync(paths.lock, { force: true });
}

export type ScheduleOutcome = "scheduled" | "not-due" | "no-index" | "busy" | "failed";

export type SpawnFn = (command: string, args: string[]) => void;

const defaultSpawn: SpawnFn = (command, args) => {
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => { /* fail-soft: the lock goes stale and the next start retries */ });
  child.unref();
};

/**
 * SessionStart entry. Stats and one create-exclusive write at most; never opens
 * the database. The claimed lock is handed to the child, which releases it.
 */
export function scheduleMaintenance(
  paths: MaintenancePaths,
  cliPath: string,
  opts: { nowMs?: number; spawn?: SpawnFn } = {},
): ScheduleOutcome {
  const nowMs = opts.nowMs ?? Date.now();
  try {
    if (!existsSync(paths.index)) return "no-index";
    if (!maintenanceDue(paths, nowMs)) return "not-due";
    const token = claimLock(paths, nowMs);
    if (token === null) return "busy";
    try {
      (opts.spawn ?? defaultSpawn)(process.execPath, [cliPath, "chat", "maintain", "--lock-token", token]);
    } catch {
      releaseLock(paths);
      return "failed";
    }
    return "scheduled";
  } catch {
    return "failed";
  }
}

function writeStamp(paths: MaintenancePaths, stamp: MaintenanceStamp): void {
  const tmp = paths.stamp + "." + process.pid + ".tmp";
  writeFileSync(tmp, JSON.stringify(stamp, null, 2) + "\n");
  renameSync(tmp, paths.stamp);
}

export interface RunMaintenanceOptions {
  home: string;
  nowMs?: number;
  budget?: IndexBudget;
  /** The token of a lock the caller already holds (the scheduled child). */
  lockToken?: string;
}

/** The pass itself. Always releases the lock it holds; never throws. */
export function runMaintenance(paths: MaintenancePaths, opts: RunMaintenanceOptions): MaintenanceStamp | null {
  const nowMs = opts.nowMs ?? Date.now();
  if (opts.lockToken !== undefined ? !holdsLock(paths, opts.lockToken) : claimLock(paths, nowMs) === null) return null;
  const beforeBytes = indexDiskBytes(paths.index);
  let stamp: MaintenanceStamp = {
    at: new Date(nowMs).toISOString(), ok: true, detail: "", beforeBytes, afterBytes: beforeBytes, ingested: 0, evicted: 0, footprintBytes: 0,
  };
  try {
    if (!existsSync(paths.index)) {
      stamp = { ...stamp, detail: "no index" };
    } else {
      const db = openIndex(paths.index);
      try {
        const r = ingest(opts.home, db, 0, { budget: opts.budget ?? resolveIndexBudget(), nowMs });
        stamp = { ...stamp, ingested: r.ingested + r.appended, evicted: r.evicted };
      } finally {
        db.close();
      }
      stamp.afterBytes = indexDiskBytes(paths.index);
    }
  } catch (err) {
    stamp = { ...stamp, ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    try {
      const fp: Footprint = measureFootprint(paths.root);
      stamp.footprintBytes = fp.totalBytes;
      writeStamp(paths, stamp);
    } catch {
      /* stamp is best-effort; the lock still goes */
    }
    releaseLock(paths);
  }
  return stamp;
}

/** Child entry for `cxc chat maintain`: wait off the startup path, then run. */
export async function runScheduledMaintenance(paths: MaintenancePaths, home: string, lockToken: string | undefined, delayMs = DEFAULT_DELAY_MS): Promise<number> {
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  const stamp = runMaintenance(paths, { home, lockToken });
  return stamp && stamp.ok ? 0 : 1;
}
