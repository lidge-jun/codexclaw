/**
 * footprint.ts — on-disk footprint of everything codexclaw keeps under
 * `$CODEXCLAW_HOME ?? ~/.codexclaw`, by area. The size/health metric behind
 * `cxc memory status` and the `memory-footprint` doctor check.
 *
 * The walk is synchronous but capped in entries, uses lstat (symlinks are never
 * followed), and reads no file contents, so it stays cheap on any store.
 */
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The whole codexclaw store should stay under this; above it doctor warns. */
export const FOOTPRINT_WARN_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 200_000;

export const FOOTPRINT_AREAS = ["recall", "projects", "backups", "skill-cache", "sessions", "other"]         ;











function areaOf(top        )                {
  return (FOOTPRINT_AREAS                     ).includes(top) && top !== "other" ? (top                 ) : "other";
}

export function measureFootprint(root        , opts                          = {})            {
  const areas = Object.fromEntries(FOOTPRINT_AREAS.map((a) => [a, 0]))                                 ;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  let files = 0;
  let seen = 0;
  let truncated = false;
  const pending                                                     = [{ dir: root, area: null }];
  while (pending.length > 0 && !truncated) {
    const { dir, area } = pending.pop() ;
    let names          ;
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (seen >= maxEntries) {
        truncated = true;
        break;
      }
      seen += 1;
      const path = join(dir, name);
      let info;
      try {
        info = lstatSync(path);
      } catch {
        continue;
      }
      const here = area ?? areaOf(name);
      if (info.isDirectory()) pending.push({ dir: path, area: here });
      else if (info.isFile()) {
        files += 1;
        areas[here] += info.size;
      }
    }
  }
  const totalBytes = Object.values(areas).reduce((n, b) => n + b, 0);
  return { root, totalBytes, areas, files, truncated };
}

export function formatBytes(bytes        )         {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KiB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MiB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GiB";
}

/** One line: total plus every non-empty area, largest first. */
export function formatFootprint(fp           )         {
  const parts = Object.entries(fp.areas)
    .filter(([, b]) => b > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([area, b]) => area + " " + formatBytes(b));
  const total = formatBytes(fp.totalBytes) + (fp.truncated ? "+" : "");
  return parts.length === 0 ? total : total + " (" + parts.join(", ") + ")";
}
