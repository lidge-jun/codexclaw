/**
 * threads-db.ts — read-only metadata enrichment from Codex's state_<N>.sqlite.
 *
 * The threads table is owned by the Codex runtime (sqlx-migrated, WAL, live).
 * We open it strictly readOnly and degrade to an empty map with a warning when
 * anything fails — search must keep working from the JSONL files alone.
 */
import { openDbReadOnly } from "./sqlite.js";

/** Back-compat alias kept for memory-search; see sqlite.ts for the lazy loader. */
export const openReadOnlyDb = openDbReadOnly;


















export function loadThreadMeta(dbPath               )                   {
  const empty = new Map                    ();
  if (!dbPath) return { byId: empty, warning: "state db not found (metadata enrichment off)" };
  let db                                           = null;
  try {
    db = openReadOnlyDb(dbPath);
    // git_origin_url is present on the live Codex state db but not on older
    // stores (or hand-built test fixtures), where prepare() throws. Falling
    // back to the original column list keeps every other field working there
    // instead of degrading the whole map to empty.
    let rows                                ;
    try {
      rows = db
        .prepare("SELECT id, title, cwd, git_branch, git_origin_url, updated_at_ms FROM threads")
        .all()                                  ;
    } catch {
      rows = db
        .prepare("SELECT id, title, cwd, git_branch, updated_at_ms FROM threads")
        .all()                                  ;
    }
    const byId = new Map                    ();
    for (const r of rows) {
      if (typeof r.id !== "string") continue;
      byId.set(r.id, {
        title: typeof r.title === "string" ? r.title : "",
        cwd: typeof r.cwd === "string" ? r.cwd : "",
        gitBranch: typeof r.git_branch === "string" ? r.git_branch : null,
        gitOriginUrl:
          typeof r.git_origin_url === "string" && r.git_origin_url.trim() !== "" ? r.git_origin_url : null,
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
