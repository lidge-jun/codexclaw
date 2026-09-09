/** Native catalog parsing and pure catalog composition. Live OCX discovery lives in live-catalog.ts. */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export const NATIVE_OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.6-luna"] as const;

export type ModelSource = "native" | "ocx";

export interface CatalogEntry {
  id: string;
  reasoningEfforts?: string[] | null;
  source: ModelSource;
  label: string;
}

export type CatalogState = "native-catalog" | "ocx-active" | "unsupported-ocx-catalog" | "unavailable";

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

/** Root-level TOML path only: never read a similarly named key inside a table. */
export function nativeCatalogPath(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CODEX_MODELS_CACHE_PATH?.trim()) return env.CODEX_MODELS_CACHE_PATH;
  const home = env.CODEX_HOME?.trim() || join(homedir(), ".codex");
  try {
    const lines = readFileSync(join(home, "config.toml"), "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (/^\s*\[/.test(line)) break;
      if (!/^\s*(?:model_catalog_json|"model_catalog_json"|'model_catalog_json')\s*=/.test(line)) continue;
      const match = /^\s*(?:model_catalog_json|"model_catalog_json"|'model_catalog_json')\s*=\s*("(?:\\.|[^"\\])*"|'[^']*')\s*(?:#.*)?$/.exec(line);
      if (!match) return null;
      const value: string = match[1].startsWith("'") ? match[1].slice(1, -1) : JSON.parse(match[1]);
      if (!value.trim()) return null;
      const expanded = value.startsWith("~/") || value.startsWith("~\\") ? join(homedir(), value.slice(2)) : value;
      return isAbsolute(expanded) ? expanded : resolve(home, expanded);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null;
  }
  return join(home, "models_cache.json");
}

export function reasoningEfforts(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return [...new Set(raw.flatMap(value => {
    const effort = typeof value === "string" ? value : value && typeof value === "object" ? (value as { effort?: unknown }).effort : undefined;
    return typeof effort === "string" && effort.length > 0 ? [effort] : [];
  }))];
}

export function readNativeCatalog(env: NodeJS.ProcessEnv = process.env, accountSelectorsOnly = false): CatalogEntry[] | null {
  const path = nativeCatalogPath(env);
  if (!path || !existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const list = Array.isArray(parsed) ? parsed : (parsed as { models?: unknown } | null)?.models;
    if (!Array.isArray(list)) return null;
    const seen = new Set<string>();
    return list.flatMap(raw => {
      const id = entryKey(raw);
      const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      if (accountSelectorsOnly && (row.opencodex_catalog_kind !== "account-selector-v1" || !id || id.split("/").length !== 2 || id.split("/").some(part => !part))) return [];
      if (!id?.trim() || seen.has(id) || row.disabled === true || row.visibility === "hide") return [];
      seen.add(id);
      const source: ModelSource = isRoutedSlug(id) ? "ocx" : "native";
      return [{ id, source, label: typeof row.display_name === "string" && row.display_name.trim() ? row.display_name : id, reasoningEfforts: reasoningEfforts(row.reasoningEfforts ?? row.supported_reasoning_levels) }];
    });
  } catch { return null; }
}

/** Legacy ID-only reader retained for pure consumers and fixtures. */
export function readNativeCacheDefault(env: NodeJS.ProcessEnv = process.env): string[] | null {
  return readNativeCatalog(env)?.map(entry => entry.id) ?? null;
}

function nativeEntries(deps: CatalogDeps): CatalogEntry[] {
  const ids = (deps.readNativeCache ?? readNativeCacheDefault)() ?? [];
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
    return { state: native.length ? "native-catalog" : "unavailable", entries: native };
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
