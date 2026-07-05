/**
 * cache.ts — TTL cache for source catalogs (WP3 / 040). Lives under
 * `$CODEXCLAW_HOME ?? ~/.codexclaw` (recall index-db convention): this is a
 * deletable DERIVED cache, never project state, so it does not go in the
 * project-local .codexclaw/ session dir. Fail-open: on network failure a stale
 * cache is served with a one-line warning on stderr.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h

export function cacheDir(env                                     = process.env)         {
  const home = env.CODEXCLAW_HOME && env.CODEXCLAW_HOME.trim() !== "" ? env.CODEXCLAW_HOME : homedir();
  const base = env.CODEXCLAW_HOME && env.CODEXCLAW_HOME.trim() !== "" ? home : join(home, ".codexclaw");
  return join(base, "skill-cache");
}






/**
 * Fetch-through cache: fresh file within TTL -> cached text; otherwise fetch
 * and rewrite. A fetch failure falls back to any existing (stale) file.
 */
export async function cachedFetchText(
  key        ,
  fetcher                       ,
  opts                                                      = {},
)                       {
  const dir = opts.dir ?? cacheDir();
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const file = join(dir, `${key}.cache`);

  if (!opts.refresh) {
    try {
      const age = Date.now() - statSync(file).mtimeMs;
      if (age < ttl) return { text: readFileSync(file, "utf8"), stale: false };
    } catch {
      /* miss */
    }
  }

  try {
    const text = await fetcher();
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, text);
    return { text, stale: false };
  } catch (err) {
    try {
      const text = readFileSync(file, "utf8");
      process.stderr.write(
        `skill-search: network fetch failed for ${key}; serving stale cache (${err instanceof Error ? err.message : String(err)})\n`,
      );
      return { text, stale: true };
    } catch {
      throw err;
    }
  }
}
