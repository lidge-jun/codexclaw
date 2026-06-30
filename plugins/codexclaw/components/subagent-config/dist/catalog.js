/**
 * catalog.ts — selectable model catalog (L25 / 250-252).
 *
 * Source = Codex-native catalog (always) + ocx-backed models (when ocx is
 * detected and exposes a catalog). Native entries come first; entries are
 * deduplicated by stable model id keeping the native one. No network fetch, no
 * vendored ocx files, no selected-model persistence (L24 owns that).
 *
 * Native source: the Codex live catalog cache at CODEX_MODELS_CACHE_PATH, read
 * through an allowlist. When the cache is absent/unreadable, fall back to the
 * documented NATIVE_OPENAI_MODELS set (opencodex src/codex-catalog.ts:44).
 *
 * Slug parity (L9.2 / 092): the LIVE Codex catalog keys each entry by `slug`
 * (bare like "gpt-5.5", or routed "provider/model"), not `id` (opencodex
 * codex-catalog.ts:152,183). The cache reader therefore accepts BOTH `id` and
 * `slug`, and dedup compares on the resolved key so a native slug and an ocx id
 * for the same model collapse, native kept first.
 */
import { existsSync, readFileSync } from "node:fs";

export const NATIVE_OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"]         ;
















/** Provider status as exposed by the L23 bridge (subset this loop needs). */















/** Resolve a raw catalog entry's stable key: a bare string, else its `id`, else
 *  its `slug` (the live Codex catalog keys natives by slug, not id). */
function entryKey(m         )                {
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    const rec = m                                    ;
    if (typeof rec.id === "string" && rec.id.length > 0) return rec.id;
    if (typeof rec.slug === "string" && rec.slug.length > 0) return rec.slug;
  }
  return null;
}

/** Read the Codex live catalog cache (CODEX_MODELS_CACHE_PATH) through the
 *  allowlist. Reads each entry by `id` OR `slug` (live catalog uses slug).
 *  Returns ids or null when absent/unreadable. */
export function readNativeCacheDefault(env                    = process.env)                  {
  const path = env.CODEX_MODELS_CACHE_PATH;
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"))           ;
    const list = Array.isArray(parsed) ? parsed : (parsed                        )?.models;
    if (!Array.isArray(list)) return null;
    const ids = list.map(entryKey).filter((x)              => typeof x === "string");
    // allowlist: only ship ids that are in the documented native set. Dedup
    // preserves first-seen order so a slug+id duplicate yields one entry.
    const seen = new Set        ();
    const allowed = ids.filter(
      (id) => (NATIVE_OPENAI_MODELS                     ).includes(id) && !seen.has(id) && (seen.add(id), true),
    );
    return allowed.length ? allowed : null;
  } catch {
    return null;
  }
}

function nativeEntries(deps             )                 {
  const ids = (deps.readNativeCache ?? readNativeCacheDefault)() ?? [...NATIVE_OPENAI_MODELS];
  return ids.map((id) => ({ id, source: "native"         , label: `${id} (native)` }));
}

/**
 * Build the merged catalog. Native first, ocx appended, dedup by id keeping
 * native. ocx present-but-no-catalog -> unsupported-ocx-catalog state.
 */
export function buildCatalog(deps              = {})          {
  const native = nativeEntries(deps);
  const status = deps.providerStatus;

  if (!status || status.mode !== "provider") {
    return { state: "native-catalog", entries: native };
  }

  // ocx is active. If it exposes no catalog interface, report unsupported.
  if (status.ocxModels === undefined) {
    return { state: "unsupported-ocx-catalog", entries: native };
  }

  const seen = new Set(native.map((e) => e.id));
  const ocx                 = [];
  for (const id of status.ocxModels) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (seen.has(id)) continue; // dedup, native wins
    seen.add(id);
    ocx.push({ id, source: "ocx", label: `${id} (ocx)` });
  }
  return { state: "ocx-active", entries: [...native, ...ocx] };
}
