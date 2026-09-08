/**
 * api-compat.ts — GUI API parity routes for cxc serve (messenger-bridge Phase 1).
 *
 * The dashboard's fetch surface (gui/src/api.ts) expects GET/POST
 * /api/subagents, GET /api/catalog, GET /api/provider — today provided only by
 * the Vite dev middleware. When cxc serve hosts the built GUI statically those
 * routes must exist or role saves silently fail (A-audit finding 2).
 *
 * Subagent settings semantics are shared with the Vite handlers through
 * subagent-config/settings-api. Other routes mirror them over the already
 * COMPILED component dists (relative .js specifiers survive the build's
 * .ts→.js rewrite untouched and resolve identically from src/ and dist/).
 * Phase 6 unifies the GUI dev middleware onto this module.
 */
import { spawnSync } from "node:child_process";
// Compiled component dists — runtime-typed, so minimal local shapes below.
import { getSettings, updateSettings, settingsResponse } from "../../subagent-config/dist/settings-api.js";
import { readCatalog } from "../../subagent-config/dist/live-catalog.js";
import { detectOcx } from "../../provider-bridge/dist/detect.js";
import type { ApiRoute, ApiResponse } from "./server.ts";
import { splitLines } from "./text-lines.ts";

interface ProviderStatusShape {
  mode: "native" | "provider" | "error";
  status?: { port?: number | null };
}

/** Real ocx detection deps (detect-only) — mirrored from gui/src/server/middleware.ts. */
function detectDeps(): Record<string, unknown> {
  return {
    which: (cmd: string) => {
      const res = spawnSync(
        process.platform === "win32" ? "where" : "command",
        process.platform === "win32" ? [cmd] : ["-v", cmd],
        { encoding: "utf8", shell: process.platform !== "win32" },
      );
      // where.exe emits CRLF; the trailing .trim() saved this by accident.
      const out =
        res.status === 0 && typeof res.stdout === "string"
          ? splitLines(res.stdout)[0]?.trim() ?? ""
          : null;
      return out && out.length > 0 ? out : null;
    },
    runStatus: (ocxPath: string) => {
      const res = spawnSync(ocxPath, ["status", "--json"], {
        encoding: "utf8",
        timeout: 8000,
      });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
  };
}

async function getCatalogRoute(forceRefresh = false): Promise<ApiResponse> {
  return { status: 200, body: await readCatalog({ forceRefresh }) };
}

function getProviderRoute(): ApiResponse {
  const status = detectOcx(detectDeps()) as ProviderStatusShape;
  const port = status.mode === "provider" ? (status.status?.port ?? null) : null;
  return { status: 200, body: { mode: status.mode, port } };
}

/** Routes mirroring the Vite dev middleware, mounted by createBridgeServer. */
export function apiCompatRoutes(): ApiRoute[] {
  return [
    {
      method: "GET",
      path: "/api/subagents",
      handler: (ctx, _body, url) => settingsResponse(() => getSettings(ctx.cwd, url.searchParams.get("scope") ?? undefined)),
    },
    {
      method: "POST",
      path: "/api/subagents",
      handler: (ctx, body) => settingsResponse(() => updateSettings(ctx.cwd, body)),
    },
    { method: "GET", path: "/api/catalog", handler: (_ctx, _body, url) => getCatalogRoute(url.searchParams.get("refresh") === "1") },
    { method: "GET", path: "/api/provider", handler: () => getProviderRoute() },
  ];
}
