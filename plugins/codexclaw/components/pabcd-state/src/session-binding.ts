import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const nodeRequire = createRequire(import.meta.url);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Native protocol SessionSource + state::extract::enum_to_string: unit
// variants are lowercase strings; custom/internal/subagent are JSON objects.
const ROOT_SOURCES = new Set(["cli", "vscode", "exec", "mcp"]);

export type NativeSessionResult =
  | { ok: true; sessionId: string; cwd: string; dbPath: string }
  | { ok: false; error: string };

/**
 * Canonical absolute path. JS `realpathSync` THROWS on the Windows
 * extended-length prefix that Codex stores in the native thread DB:
 * `realpathSync("\\\\?\\C:\\...")` fails with
 * `EISDIR: illegal operation on a directory, lstat 'C:'` because it parses the
 * prefix as a path segment. `realpathSync.native` resolves that shape. Measured on
 * a Windows desktop install: 159 of 159 `threads.cwd` rows carried the prefix, so
 * this is the normal shape, not an edge case (#134). Native additionally expands
 * 8.3 short names, which is why `session-source.ts` already keeps its own copy of
 * this helper.
 *
 * Deliberately private and duplicated rather than shared: `session-source.ts`
 * does not export its copy, and `worktree-guard.ts` `canonicalize()` must NOT be
 * reused here because it walks a missing path up to its nearest existing ancestor
 * and RETURNS a string instead of throwing, which would silently reclassify a
 * missing cwd as a mismatch and break the fail-closed contract below.
 */
function canonical(path: string): string {
  return realpathSync.native(path);
}

/** CLI-only corroboration. Never use as a hook's identity resolver: subagent
 * hook session_id is the root ID, unlike the child's native CODEX_THREAD_ID.
 * Protects accidental cross-session writes, not hostile same-user DB/env edits.
 */
export function resolveNativeSession(cwd: string, env: NodeJS.ProcessEnv = process.env): NativeSessionResult {
  const sessionId = env.CODEX_THREAD_ID;
  if (sessionId === undefined) {
    return { ok: false, error: "CODEX_THREAD_ID is absent. Run this command inside the native Codex session." };
  }
  if (sessionId.length !== 36 || !UUID.test(sessionId)) {
    return { ok: false, error: "CODEX_THREAD_ID must be an unmodified native UUID." };
  }

  let canonicalCwd: string;
  try {
    canonicalCwd = canonical(cwd);
    if (!lstatSync(canonicalCwd).isDirectory()) throw new Error();
  } catch {
    return { ok: false, error: "Cannot resolve the working directory. Run from the native session's directory." };
  }

  let dbPath: string;
  try {
    const home = env.CODEX_SQLITE_HOME || env.CODEX_HOME || join(homedir(), ".codex");
    const candidates = readdirSync(home)
      .filter(name => /^state_[0-9]+\.sqlite$/.test(name))
      .map(name => ({ name, version: BigInt(name.slice(6, -7)) }))
      .sort((a, b) => a.version > b.version ? -1 : a.version < b.version ? 1 : a.name.localeCompare(b.name));
    if (candidates.length === 0) {
      return { ok: false, error: "Native state database is missing. Check CODEX_SQLITE_HOME or CODEX_HOME." };
    }
    dbPath = resolve(home, candidates[0].name);
    if (!lstatSync(dbPath).isFile()) {
      return { ok: false, error: "Newest native state database must be a regular file, not a symlink or directory." };
    }
  } catch {
    return { ok: false, error: "Cannot locate the native state database. Check CODEX_SQLITE_HOME or CODEX_HOME." };
  }

  try {
    // Match goal-active's lazy ESM convention; never create/migrate a native DB.
    const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const row = db.prepare("SELECT id, cwd, archived, source FROM threads WHERE id = ?").get(sessionId);
      if (!row || row.id !== sessionId) {
        return { ok: false, error: "Native session row is missing. Run inside the intended Codex session." };
      }
      if (row.archived !== 0) {
        return { ok: false, error: "Native session is archived or has an invalid archive flag." };
      }
      if (typeof row.source !== "string" || !ROOT_SOURCES.has(row.source)) {
        return { ok: false, error: "Native source is not a supported root session; subagent, unknown and malformed sources cannot bind." };
      }
      if (typeof row.cwd !== "string" || !isAbsolute(row.cwd)) {
        return { ok: false, error: "Native session has an invalid working directory." };
      }
      try {
        if (canonical(row.cwd) !== canonicalCwd) {
          return { ok: false, error: "Working directory does not match the native session. Run from its exact directory." };
        }
      } catch {
        return { ok: false, error: "Cannot resolve the native session's working directory." };
      }
      return { ok: true, sessionId, cwd: canonicalCwd, dbPath };
    } finally {
      db.close();
    }
  } catch {
    // Never render SQLite exceptions (which may include private values), and
    // never try an older database after the newest schema/open/query fails.
    return { ok: false, error: "Cannot read the newest native state database or its threads schema. Check database access and Node SQLite support." };
  }
}
