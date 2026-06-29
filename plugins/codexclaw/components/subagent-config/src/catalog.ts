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
 */
import { existsSync, readFileSync } from "node:fs";

export const NATIVE_OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"] as const;

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

/** Read the Codex live catalog cache (CODEX_MODELS_CACHE_PATH) through the
 *  allowlist. Returns ids or null when absent/unreadable. */
export function readNativeCacheDefault(env: NodeJS.ProcessEnv = process.env): string[] | null {
  const path = env.CODEX_MODELS_CACHE_PATH;
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const list = Array.isArray(parsed) ? parsed : (parsed as { models?: unknown })?.models;
    if (!Array.isArray(list)) return null;
    const ids = list
      .map((m) => (typeof m === "string" ? m : typeof (m as { id?: unknown })?.id === "string" ? (m as { id: string }).id : null))
      .filter((x): x is string => typeof x === "string");
    // allowlist: only ship ids that are in the documented native set.
    const allowed = ids.filter((id) => (NATIVE_OPENAI_MODELS as readonly string[]).includes(id));
    return allowed.length ? allowed : null;
  } catch {
    return null;
  }
}

function nativeEntries(deps: CatalogDeps): CatalogEntry[] {
  const ids = (deps.readNativeCache ?? readNativeCacheDefault)() ?? [...NATIVE_OPENAI_MODELS];
  return ids.map((id) => ({ id, source: "native" as const, label: `${id} (native)` }));
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

  // ocx is active. If it exposes no catalog interface, report unsupported.
  if (status.ocxModels === undefined) {
    return { state: "unsupported-ocx-catalog", entries: native };
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
