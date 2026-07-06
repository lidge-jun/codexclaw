/**
 * handlers.ts — node-side API handlers for the codexclaw dashboard (L27).
 *
 * Pure-ish request handlers over the L24 store, L25 catalog, and L23 provider
 * detection. The GUI talks to these via a Vite dev middleware; React never
 * shells out to ocx and never edits Codex global config. Handlers are exported
 * so they can be unit-tested with an injectable cwd.
 *
 * Imports the component TS sources directly (Node 24 strips types) so tests and
 * the dev middleware do not require a prior dist build.
 */
import {
  readConfig,
  setRole,
  ROLES,
  type RoleName,
  type SubagentsConfig,
} from "../../../components/subagent-config/src/store.ts";
import { buildCatalog, type Catalog, type ProviderCatalogInput } from "../../../components/subagent-config/src/catalog.ts";
import { detectOcx, type DetectDeps, type ProviderStatus } from "../../../components/provider-bridge/src/detect.ts";

export interface ApiResult {
  status: number;
  body: unknown;
}

/** GET /api/subagents -> current config (defaults when file missing). */
export function getSubagents(cwd: string): ApiResult {
  return { status: 200, body: readConfig(cwd) };
}

/** POST /api/subagents -> apply a role patch and return the updated config.
 *  Body: { role, mode?, model?, promptOverride? }. */
export function postSubagents(cwd: string, body: unknown): ApiResult {
  if (!body || typeof body !== "object") return { status: 400, body: { error: "missing body" } };
  const b = body as Record<string, unknown>;
  const role = b.role as RoleName;
  if (!ROLES.includes(role)) return { status: 400, body: { error: `unknown role "${String(b.role)}"` } };
  const patch: Record<string, unknown> = {};
  if (b.mode !== undefined) patch.mode = b.mode;
  if (b.model !== undefined) patch.model = b.model;
  if (b.effort !== undefined) patch.effort = b.effort;
  if (b.promptOverride !== undefined) patch.promptOverride = b.promptOverride;
  try {
    const updated: SubagentsConfig = setRole(cwd, role, patch);
    return { status: 200, body: updated };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

/** Map provider detection to the catalog's provider input. */
function providerToCatalogInput(status: ProviderStatus): ProviderCatalogInput {
  if (status.mode === "provider") {
    // The bridge is detect-only: it exposes proxy status, not a live model list.
    // ocx models are NOT fetched here — opencodex syncs its routed `provider/model`
    // entries into the Codex config cache, and buildCatalog() reads them from there
    // (the native-cache source). So `ocxModels` stays undefined on this provider
    // input; the ocx-synced models still surface via the native cache, not a live call.
    return { mode: "provider", ocxModels: undefined };
  }
  return { mode: status.mode === "error" ? "error" : "native" };
}

/** GET /api/catalog -> merged model catalog (native + ocx when available). */
export function getCatalog(detectDeps?: DetectDeps): ApiResult {
  const status = detectDeps ? detectOcx(detectDeps) : { mode: "native" as const, reason: "no detector wired" };
  const catalog: Catalog = buildCatalog({ providerStatus: providerToCatalogInput(status as ProviderStatus) });
  return { status: 200, body: catalog };
}

/** GET /api/provider -> provider status for the link bar. */
export function getProvider(detectDeps?: DetectDeps): ApiResult {
  const status = detectDeps ? detectOcx(detectDeps) : { mode: "native" as const, reason: "no detector wired" };
  const s = status as ProviderStatus;
  const port = s.mode === "provider" ? s.status.port : null;
  return { status: 200, body: { mode: s.mode, port } };
}
