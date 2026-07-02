/**
 * ingest.ts — incremental ingest of rollout JSONL files into the sidecar index.
 *
 * Change detection is (mtime_ms, size) per file against the files table. Active
 * session files grow by appends, so a grown file re-parses ONLY the appended
 * byte range (from the stored complete-line boundary) — this keeps
 * refresh-on-query at milliseconds even while multi-MB sessions are live.
 * Shrunk or rewritten files fall back to full re-parse; the AFTER DELETE/INSERT
 * triggers keep both FTS tables in sync. ~/.codex is only ever read.
 *
 * Byte offsets are byte offsets (not JS string lengths): boundaries come from
 * Buffer scans so multi-byte UTF-8 (Korean) cannot corrupt the resume point.
 */
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { listRolloutFiles, readRolloutMeta, parseRollout } from "./rollout.js";


/** Tool outputs dominate corpus bytes; cap them to bound index size. */
export const TOOL_TEXT_CAP = 8_192;












/** Offset just past the last complete line (0 when the buffer has no newline). */
function completeLineBoundary(buf        )         {
  const nl = buf.lastIndexOf(0x0a);
  return nl === -1 ? 0 : nl + 1;
}

function readSlice(path        , from        , to        )         {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(to - from);
    const n = readSync(fd, buf, 0, to - from, from);
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

export function ingest(home        , db      , days = 0)               {
  const started = Date.now();
  const onDisk = listRolloutFiles(home, days);
  const known = new Map                   ();
  for (const row of db
    .prepare("SELECT path, mtime_ms, size, bytes_ingested, last_ord FROM files")
    .all()                                  ) {
    known.set(String(row.path), {
      mtime_ms: Number(row.mtime_ms),
      size: Number(row.size),
      bytes_ingested: Number(row.bytes_ingested),
      last_ord: Number(row.last_ord),
    });
  }

  const result               = {
    scanned: onDisk.length,
    ingested: 0,
    appended: 0,
    pruned: 0,
    msgs: 0,
    elapsedMs: 0,
  };
  const delMsgs = db.prepare("DELETE FROM msgs WHERE path = ?");
  const delFile = db.prepare("DELETE FROM files WHERE path = ?");
  const insFile = db.prepare(
    "INSERT OR REPLACE INTO files (path, mtime_ms, size, thread_id, cwd, source, date, bytes_ingested, last_ord)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insMsg = db.prepare(
    "INSERT INTO msgs (path, ord, ts, role, match_field, synthetic, text) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const insertEntries = (path        , entries                                 , startOrd        )         => {
    let ord = startOrd;
    for (const e of entries) {
      const text =
        e.matchField === "tool_log" && e.text.length > TOOL_TEXT_CAP ? e.text.slice(0, TOOL_TEXT_CAP) : e.text;
      insMsg.run(path, ord, e.ts, e.role, e.matchField, e.synthetic ? 1 : 0, text);
      ord += 1;
      result.msgs += 1;
    }
    return ord;
  };

  const seen = new Set        ();
  for (const file of onDisk) {
    seen.add(file.path);
    let st                                   ;
    try {
      st = statSync(file.path);
    } catch {
      continue;
    }
    const prev = known.get(file.path);
    const mtimeMs = Math.floor(st.mtimeMs);
    if (prev && prev.mtime_ms === mtimeMs && prev.size === st.size) continue;
    // Concurrent-append safety: stat is taken BEFORE the read, so a write landing
    // between them stores a stat older than the content we indexed — the next
    // refresh sees the mismatch and re-ingests (self-healing, never silently stale).
    // Partial trailing lines are excluded by the complete-line boundary and picked
    // up on the next refresh.

    const canAppend = prev !== undefined && prev.bytes_ingested > 0 && st.size > prev.size;
    db.exec("BEGIN");
    try {
      const meta = readRolloutMeta(file.path);
      if (canAppend) {
        // Grown file: parse only the appended complete lines.
        const slice = readSlice(file.path, prev.bytes_ingested, st.size);
        const boundary = completeLineBoundary(slice);
        const entries = boundary > 0 ? parseRollout(slice.subarray(0, boundary).toString("utf8"), true) : [];
        const lastOrd = insertEntries(file.path, entries, prev.last_ord);
        insFile.run(
          file.path,
          mtimeMs,
          st.size,
          meta.threadId,
          meta.cwd,
          meta.source,
          file.date,
          prev.bytes_ingested + boundary,
          lastOrd,
        );
        result.appended += 1;
      } else {
        // New, shrunk, or rewritten file: full re-parse of complete lines only,
        // so the boundary and the ingested entries always agree (no dup on resume).
        const buf = readFileSync(file.path);
        const boundary = completeLineBoundary(buf);
        const entries = boundary > 0 ? parseRollout(buf.subarray(0, boundary).toString("utf8"), true) : [];
        delMsgs.run(file.path);
        const lastOrd = insertEntries(file.path, entries, 0);
        insFile.run(file.path, mtimeMs, st.size, meta.threadId, meta.cwd, meta.source, file.date, boundary, lastOrd);
        result.ingested += 1;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  // Prune index entries whose source file vanished (full scans only — a
  // days-scoped refresh must not treat out-of-window files as deleted).
  if (days === 0) {
    for (const path of known.keys()) {
      if (seen.has(path)) continue;
      db.exec("BEGIN");
      try {
        delMsgs.run(path);
        delFile.run(path);
        db.exec("COMMIT");
        result.pruned += 1;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    }
  }

  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_ingest_at', ?)").run(
    new Date().toISOString(),
  );
  result.elapsedMs = Date.now() - started;
  return result;
}
