/**
 * win-paths.ts - platform-parameterized path identity and home redaction.
 *
 * Adopted from opencodex `user-identity.ts:447` / `log-guard/path-safety.ts:43-73`:
 * Windows paths are case-insensitive and `realpathSync.native` expands 8.3 short
 * components, so "the same directory" has several legal spellings. POSIX paths
 * have exactly one, and folding case there would merge two real directories.
 */
import { realpathSync } from "node:fs";

/** True when two paths name the same location on `platform`. */
export function samePathIdentity(
  left        ,
  right        ,
  platform                  = process.platform,
)          {
  return platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

/** Escape a literal for embedding in a RegExp. */
export function escapeRegExp(value        )         {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every spelling of one directory that could appear in text: both separator
 * forms, plus the OS-canonical (8.3-expanded) form when it differs.
 *
 * `realpathSync.native` is the piece that catches `C:\Users\SUPER~1`, which no amount
 * of case folding would match (001 1.2).
 */
export function homePathVariants(
  homeDir        ,
  platform                  = process.platform,
  realpath                        = (p) => realpathSync.native(p),
)           {
  const trimmed = homeDir.trim();
  if (trimmed.length === 0) return [];
  const seen = new Set        ();
  const add = (v        ) => {
    if (v.length > 0) seen.add(v);
  };
  const both = (v        ) => {
    add(v.split("\\").join("/"));
    add(v.split("/").join("\\"));
  };
  both(trimmed);
  if (platform === "win32") {
    try {
      both(realpath(trimmed));
    } catch {
      // An unreadable home is not a redaction failure; the literal forms stand.
    }
  }
  // Longest first, so C:/Users/x/AppData never redacts before C:/Users/x would
  // have, leaving a dangling suffix.
  return [...seen].sort((a, b) => b.length - a.length);
}
