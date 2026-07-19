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
import { homedir } from "node:os";
import { join } from "node:path";

export const NATIVE_OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.6-luna"] as const;

export type ModelSource = "native" | "ocx";

export interface CatalogEntry {
  id: string;
  source: ModelSource;
  label: string;
}

export type CatalogState = "native-catalog" | "ocx-active" | "unsupported-ocx-catalog";

export interface Catalog {
  state: CatalogState;
  entries: CatalogEntry[];
}

/** Provider status as exposed by the L23 bridge (subset this loop needs). */
export interface ProviderCatalogInput {
  /** "provider" when ocx is detected + status readable; else native. */
  mode: "provider" | "native" | "error";
  /** ocx-backed model ids, when the provider exposes a catalog. undefined when
   *  ocx is present but exposes no catalog interface (-> unsupported state). */
  ocxModels?: string[];
}

export interface CatalogDeps {
  /** read + allowlist the Codex live catalog cache; returns ids or null. */
  readNativeCache?: () => string[] | null;
  /** provider status (from the L23 bridge). */
  providerStatus?: ProviderCatalogInput;
}

/** Resolve a raw catalog entry's stable key: a bare string, else its `id`, else
 *  its `slug` (the live Codex catalog keys natives by slug, not id). */
function entryKey(m: unknown): string | null {
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    const rec = m as { id?: unknown; slug?: unknown };
    if (typeof rec.id === "string" && rec.id.length > 0) return rec.id;
    if (typeof rec.slug === "string" && rec.slug.length > 0) return rec.slug;
  }
  return null;
}

/** A routed catalog slug is the `provider/model` form opencodex syncs into the
 *  Codex cache (e.g. "kiro/claude-opus-4.6"). Bare ids (no slash) are native. */
function isRoutedSlug(key: string): boolean {
  return key.includes("/");
}

/** Read the Codex live catalog cache (CODEX_MODELS_CACHE_PATH) through the
 *  allowlist. Reads each entry by `id` OR `slug` (live catalog uses slug).
 *  Returns ids or null when absent/unreadable.
 *
 *  L20/WP4: the cache is the codex config catalog, which opencodex SYNCS its
 *  routed `provider/model` slugs into. codexclaw reads that config (it never
 *  calls ocx directly). So the allowlist admits BOTH the documented native ids
 *  AND any routed slug (contains "/") — dropping routed slugs would hide exactly
 *  the ocx-synced models the subagent config is meant to select. */
export function readNativeCacheDefault(env: NodeJS.ProcessEnv = process.env): string[] | null {
  // Resolve like opencodex (codex-paths.ts:30): explicit override, else
  // $CODEX_HOME/models_cache.json, else ~/.codex/models_cache.json. Nothing in
  // `cxc serve` sets CODEX_MODELS_CACHE_PATH, so the homedir default is what
  // makes the ocx-synced routed slugs actually load in practice.
  const path =
    env.CODEX_MODELS_CACHE_PATH ??
    join(env.CODEX_HOME ?? join(homedir(), ".codex"), "models_cache.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const list = Array.isArray(parsed) ? parsed : (parsed as { models?: unknown })?.models;
    if (!Array.isArray(list)) return null;
    const ids = list.map(entryKey).filter((x): x is string => typeof x === "string");
    // allowlist: ship documented native ids AND routed provider/model slugs
    // (the ocx-synced entries). Dedup preserves first-seen order so a slug+id
    // duplicate yields one entry.
    const seen = new Set<string>();
    const allowed = ids.filter(
      (id) =>
        ((NATIVE_OPENAI_MODELS as readonly string[]).includes(id) || isRoutedSlug(id)) &&
        !seen.has(id) &&
        (seen.add(id), true),
    );
    return allowed.length ? allowed : null;
  } catch {
    return null;
  }
}

function nativeEntries(deps: CatalogDeps): CatalogEntry[] {
  const ids = (deps.readNativeCache ?? readNativeCacheDefault)() ?? [...NATIVE_OPENAI_MODELS];
  // Entries from the codex config cache: bare ids are native; routed `provider/model`
  // slugs were synced in by opencodex, so label them as ocx-origin even though they
  // arrive through the native cache (codexclaw never calls ocx directly).
  return ids.map((id) =>
    isRoutedSlug(id)
      ? ({ id, source: "ocx" as const, label: `${id} (ocx)` })
      : ({ id, source: "native" as const, label: `${id} (native)` }),
  );
}

/**
 * Build the merged catalog. Native first, ocx appended, dedup by id keeping
 * native. ocx present-but-no-catalog -> unsupported-ocx-catalog state.
 */
export function buildCatalog(deps: CatalogDeps = {}): Catalog {
  const native = nativeEntries(deps);
  const status = deps.providerStatus;

  if (!status || status.mode !== "provider") {
    return { state: "native-catalog", entries: native };
  }

  // ocx is active. If it exposes no catalog interface, the cache-sync channel may
  // still have delivered routed slugs (opencodex syncs them into the codex models
  // cache) — reporting "unsupported" would be a lie when ocx entries are present.
  if (status.ocxModels === undefined) {
    const hasOcxEntries = native.some((e) => e.source === "ocx");
    return { state: hasOcxEntries ? "ocx-active" : "unsupported-ocx-catalog", entries: native };
  }

  const seen = new Set(native.map((e) => e.id));
  const ocx: CatalogEntry[] = [];
  for (const id of status.ocxModels) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (seen.has(id)) continue; // dedup, native wins
    seen.add(id);
    ocx.push({ id, source: "ocx", label: `${id} (ocx)` });
  }
  return { state: "ocx-active", entries: [...native, ...ocx] };
}
