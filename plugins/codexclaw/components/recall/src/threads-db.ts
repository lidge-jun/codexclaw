/**
 * threads-db.ts — read-only metadata enrichment from Codex's state_<N>.sqlite.
 *
 * The threads table is owned by the Codex runtime (sqlx-migrated, WAL, live).
 * We open it strictly readOnly and degrade to an empty map with a warning when
 * anything fails — search must keep working from the JSONL files alone.
 */
import { openDbReadOnly } from "./sqlite.ts";

/** Back-compat alias kept for memory-search; see sqlite.ts for the lazy loader. */
export const openReadOnlyDb = openDbReadOnly;

export type ThreadMeta = {
  title: string;
  cwd: string;
  gitBranch: string | null;
  updatedAtMs: number | null;
};

export type ThreadMetaResult = {
  byId: Map<string, ThreadMeta>;
  warning: string | null;
};

export function loadThreadMeta(dbPath: string | null): ThreadMetaResult {
  const empty = new Map<string, ThreadMeta>();
  if (!dbPath) return { byId: empty, warning: "state db not found (metadata enrichment off)" };
  let db: ReturnType<typeof openReadOnlyDb> | null = null;
  try {
    db = openReadOnlyDb(dbPath);
    const rows = db
      .prepare("SELECT id, title, cwd, git_branch, updated_at_ms FROM threads")
      .all() as Array<Record<string, unknown>>;
    const byId = new Map<string, ThreadMeta>();
    for (const r of rows) {
      if (typeof r.id !== "string") continue;
      byId.set(r.id, {
        title: typeof r.title === "string" ? r.title : "",
        cwd: typeof r.cwd === "string" ? r.cwd : "",
        gitBranch: typeof r.git_branch === "string" ? r.git_branch : null,
        updatedAtMs: typeof r.updated_at_ms === "number" ? r.updated_at_ms : null,
      });
    }
    return { byId, warning: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { byId: empty, warning: `state db unreadable (${msg})` };
  } finally {
    db?.close();
  }
}
