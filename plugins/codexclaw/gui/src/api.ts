/**
 * api.ts — codexclaw GUI API client.
 *
 * The GUI reads/writes ONLY through codexclaw endpoints; it never shells out to
 * ocx and has no hard dependency on the opencodex dashboard at localhost:10100.
 * In MVP the dashboard runs without a backend wired, so these calls degrade to
 * safe defaults (ocx-absent, default roles) instead of throwing — the app shell
 * must load with no console errors when nothing is available.
 */
export type RoleMode = "default" | "model";

export interface RoleConfig {
  mode: RoleMode;
  model: string | null;
  promptOverride: string | null;
}

export interface SubagentsConfig {
  roles: { explorer: RoleConfig; reviewer: RoleConfig; executor: RoleConfig };
}

export interface CatalogEntry {
  id: string;
  source: "native" | "ocx";
  label: string;
}

export interface ProviderState {
  mode: "native" | "provider" | "error";
  port: number | null;
}

const defaultRole = (): RoleConfig => ({ mode: "default", model: null, promptOverride: null });

export const defaultConfig = (): SubagentsConfig => ({
  roles: { explorer: defaultRole(), reviewer: defaultRole(), executor: defaultRole() },
});

/**
 * Backend base URL. In MVP there is no codexclaw backend wired, so this is
 * empty and the client returns local defaults WITHOUT issuing a request — that
 * keeps the ocx-absent shell free of 404 console noise. A later loop sets
 * `VITE_CXC_API` to a real base to enable live reads.
 */
const API_BASE: string = (import.meta.env?.VITE_CXC_API as string | undefined) ?? "";

async function getJson<T>(path: string, fallback: T): Promise<T> {
  // No backend configured (MVP) -> use the safe default, do not fetch.
  if (!API_BASE) return fallback;
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    // No backend wired (MVP) or network blocked -> safe default, no throw.
    return fallback;
  }
}

export const api = {
  getSubagents: () => getJson<SubagentsConfig>("/api/subagents", defaultConfig()),
  getCatalog: () =>
    getJson<{ state: string; entries: CatalogEntry[] }>("/api/catalog", {
      state: "native-catalog",
      entries: [
        { id: "gpt-5.5", source: "native", label: "gpt-5.5 (native)" },
        { id: "gpt-5.4", source: "native", label: "gpt-5.4 (native)" },
      ],
    }),
  getProvider: () => getJson<ProviderState>("/api/provider", { mode: "native", port: null }),
};
