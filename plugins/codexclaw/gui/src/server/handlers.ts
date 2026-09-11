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
import { getSettings, updateSettings, settingsResponse } from "../../../components/subagent-config/src/settings-api.ts";
import { readCatalog } from "../../../components/subagent-config/src/live-catalog.ts";
import { detectOcx, type DetectDeps, type ProviderStatus } from "../../../components/provider-bridge/src/detect.ts";
import {
  MULTI_AGENT_V2_STATUS_CONTEXT,
  readMultiAgentV2State,
  setMultiAgentV2State,
  type MultiAgentV2Deps,
} from "../../../components/config-guard/src/multi-agent-v2.ts";

export interface ApiResult {
  status: number;
  body: unknown;
}

/** Shared with cxc serve, including effort and scoped defaults. */
export function getSubagents(cwd: string, scope?: unknown): ApiResult {
  return settingsResponse(() => getSettings(cwd, scope));
}
export function postSubagents(cwd: string, body: unknown): ApiResult {
  return settingsResponse(() => updateSettings(cwd, body));
}

/** Shared live discovery for Vite and the installed serve path. */
export async function getCatalog(forceRefresh = false, reader = readCatalog): Promise<ApiResult> {
  return { status: 200, body: await reader({ forceRefresh }) };
}

/** GET /api/provider -> provider status for the link bar. */
export function getProvider(detectDeps?: DetectDeps): ApiResult {
  const status = detectDeps ? detectOcx(detectDeps) : { mode: "native" as const, reason: "no detector wired" };
  const s = status as ProviderStatus;
  const port = s.mode === "provider" ? s.status.port : null;
  return { status: 200, body: { mode: s.mode, port } };
}

/** GET /api/multi-agent -> current v1/v2 surface. */
export function getMultiAgentSurface(deps?: MultiAgentV2Deps): ApiResult {
  if (!deps) {
    return {
      status: 200,
      body: { version: "v1", v2Enabled: false, ...MULTI_AGENT_V2_STATUS_CONTEXT },
    };
  }
  return { status: 200, body: readMultiAgentV2State(deps) };
}

/** POST /api/multi-agent -> set v1/v2 surface through `codex features`. */
export function postMultiAgentSurface(deps: MultiAgentV2Deps | undefined, body: unknown): ApiResult {
  if (!deps) return { status: 503, body: { error: "codex feature runner unavailable" } };
  if (!body || typeof body !== "object") return { status: 400, body: { error: "missing body" } };
  const version = (body as Record<string, unknown>).version;
  if (version !== "v1" && version !== "v2") {
    return { status: 400, body: { error: 'version must be "v1" or "v2"' } };
  }
  try {
    return { status: 200, body: { ok: true, ...setMultiAgentV2State(deps, version) } };
  } catch (err) {
    return { status: 502, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}
