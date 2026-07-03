/**
 * api-compat.ts — GUI API parity routes for cxc serve (messenger-bridge Phase 1).
 *
 * The dashboard's fetch surface (gui/src/api.ts) expects GET/POST
 * /api/subagents, GET /api/catalog, GET /api/provider — today provided only by
 * the Vite dev middleware. When cxc serve hosts the built GUI statically those
 * routes must exist or role saves silently fail (A-audit finding 2).
 *
 * Source of truth for the route semantics: gui/src/server/middleware.ts +
 * gui/src/server/handlers.ts. This module mirrors them over the already
 * COMPILED component dists (relative .js specifiers survive the build's
 * .ts→.js rewrite untouched and resolve identically from src/ and dist/).
 * Phase 6 unifies the GUI dev middleware onto this module.
 */
import { spawnSync } from "node:child_process";
// Compiled component dists — runtime-typed, so minimal local shapes below.
import { readConfig, setRole, ROLES } from "../../subagent-config/dist/store.js";
import { buildCatalog } from "../../subagent-config/dist/catalog.js";
import { detectOcx } from "../../provider-bridge/dist/detect.js";
import type { ApiRoute, ApiResponse } from "./server.ts";

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
      const out =
        res.status === 0 && typeof res.stdout === "string"
          ? res.stdout.split("\n")[0]?.trim()
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

/** Map provider detection to the catalog's provider input — mirrored from gui/src/server/handlers.ts. */
function providerToCatalogInput(status: ProviderStatusShape): Record<string, unknown> {
  if (status.mode === "provider") {
    // ocx-synced models surface via the native config cache, not a live call.
    return { mode: "provider", ocxModels: undefined };
  }
  return { mode: status.mode === "error" ? "error" : "native" };
}

function getSubagentsRoute(cwd: string): ApiResponse {
  return { status: 200, body: readConfig(cwd) };
}

function postSubagentsRoute(cwd: string, body: unknown): ApiResponse {
  if (!body || typeof body !== "object") return { status: 400, body: { error: "missing body" } };
  const b = body as Record<string, unknown>;
  const role = b.role as (typeof ROLES)[number];
  if (!ROLES.includes(role)) {
    return { status: 400, body: { error: `unknown role "${String(b.role)}"` } };
  }
  const patch: Record<string, unknown> = {};
  if (b.mode !== undefined) patch.mode = b.mode;
  if (b.model !== undefined) patch.model = b.model;
  if (b.promptOverride !== undefined) patch.promptOverride = b.promptOverride;
  try {
    return { status: 200, body: setRole(cwd, role, patch) };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

function getCatalogRoute(): ApiResponse {
  const status = detectOcx(detectDeps()) as ProviderStatusShape;
  const catalog = buildCatalog({ providerStatus: providerToCatalogInput(status) });
  return { status: 200, body: catalog };
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
      handler: (ctx) => getSubagentsRoute(ctx.cwd),
    },
    {
      method: "POST",
      path: "/api/subagents",
      handler: (ctx, body) => postSubagentsRoute(ctx.cwd, body),
    },
    { method: "GET", path: "/api/catalog", handler: () => getCatalogRoute() },
    { method: "GET", path: "/api/provider", handler: () => getProviderRoute() },
  ];
}
