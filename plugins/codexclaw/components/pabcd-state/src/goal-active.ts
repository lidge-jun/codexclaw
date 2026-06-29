/**
 * goal-active.ts — read-only native goal-mode detection (L11.1 / 111).
 *
 * Q-GM-1-f RESOLVED: codexclaw does NOT own a goal marker. Goal-active state is
 * read from codex's native goal DB: `$CODEX_HOME/goals_1.sqlite` (override with
 * $CODEX_SQLITE_HOME), table `thread_goals` keyed by `thread_id` (= the hook
 * payload `session_id`). Ground truth:
 *  - codex-rs/state/src/lib.rs:82  GOALS_DB_FILENAME = "goals_1.sqlite"
 *  - codex-rs/state/src/lib.rs:79  SQLITE_HOME_ENV   = "CODEX_SQLITE_HOME"
 *  - codex-rs/state/src/runtime.rs goals_db_path = codex_home.join(filename)
 *  - state/goals_migrations/0001_thread_goals.sql: PK thread_id, status enum
 *
 * Status mapping (111): only `active` counts as goal-mode-active for interview
 * suppression. paused/blocked/complete/usage_limited/budget_limited do NOT
 * suppress interview. Result:
 *  - "active"     row exists with status === 'active'
 *  - "inactive"   no DB / no row / non-active status (interview allowed)
 *  - "unreadable" DB present but the row cannot be read/parsed (caller fails CLOSED)
 *
 * READ-ONLY: never writes to codex's DB.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

export type GoalActiveStatus = "active" | "inactive" | "unreadable";

export const GOALS_DB_FILENAME = "goals_1.sqlite";

/** Resolve the codex goals DB dir: $CODEX_SQLITE_HOME, else $CODEX_HOME, else ~/.codex. */
export function resolveGoalsDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.CODEX_SQLITE_HOME || env.CODEX_HOME || join(homedir(), ".codex");
  return join(home, GOALS_DB_FILENAME);
}

export interface GoalActiveDeps {
  env?: NodeJS.ProcessEnv;
  /** injectable DB path for tests (defaults to resolveGoalsDbPath). */
  dbPath?: string;
  /** injectable sqlite opener for tests; defaults to node:sqlite DatabaseSync. */
  openDb?: (path: string) => { prepare: (sql: string) => { get: (...params: unknown[]) => unknown }; close: () => void };
}

function defaultOpenDb(path: string): { prepare: (sql: string) => { get: (...p: unknown[]) => unknown }; close: () => void } {
  // node:sqlite is experimental but available in Node 22+/24. Use createRequire
  // so this resolves under ESM; environments without it fall back to "unreadable".
  const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  return new DatabaseSync(path, { readOnly: true }) as unknown as {
    prepare: (sql: string) => { get: (...p: unknown[]) => unknown };
    close: () => void;
  };
}

/**
 * Look up goal-active status for a thread_id (= session_id). Missing DB ->
 * "inactive" (codex not using goals). Present DB but a read/parse failure on the
 * row -> "unreadable" (caller must fail CLOSED = treat as active for suppression).
 */
export function getGoalActiveStatus(threadId: string, deps: GoalActiveDeps = {}): GoalActiveStatus {
  const dbPath = deps.dbPath ?? resolveGoalsDbPath(deps.env);
  if (!threadId || !existsSync(dbPath)) return "inactive";

  const openDb = deps.openDb ?? defaultOpenDb;
  let db: ReturnType<typeof defaultOpenDb> | null = null;
  try {
    db = openDb(dbPath);
    const row = db.prepare("SELECT status FROM thread_goals WHERE thread_id = ?").get(threadId);
    if (row === undefined || row === null) return "inactive"; // no goal for this thread
    const status = (row as { status?: unknown }).status;
    if (typeof status !== "string") return "unreadable"; // present but unparsable -> fail closed
    return status === "active" ? "active" : "inactive";
  } catch {
    // DB present but unreadable (locked, schema drift, sqlite unavailable) -> fail closed.
    return "unreadable";
  } finally {
    try {
      db?.close();
    } catch {
      // best-effort close
    }
  }
}

/** Goal mode suppresses interview when active OR unreadable (fail-closed, R-9). */
export function suppressesInterview(status: GoalActiveStatus): boolean {
  return status === "active" || status === "unreadable";
}
