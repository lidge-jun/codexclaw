/**
 * server.ts — cxc serve HTTP server (messenger-bridge Phase 1).
 *
 * One loopback port serving: the built GUI (static, SPA fallback), a JSON API
 * (route registry — later phases append routes without touching this file),
 * and /api/health. Static resolution is confined to guiDir (path-traversal
 * guard). No third-party deps: node:http only.
 */
import { createServer,                                                        } from "node:http";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { apiCompatRoutes } from "./api-compat.js";
import { connectRoutes } from "./connect-routes.js";
import { agentRoutes } from "./agent-routes.js";











/** The subset of BridgeController the API routes use (kept structural to avoid a cycle). */



































/** Component-root README.md, valid from both src/ and compiled dist/. */
export function defaultReadmePath()         {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "README.md");
}

const CONTENT_TYPES                         = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

const GUI_MISSING_PAGE =
  "codexclaw serve: GUI build missing.\nRun: npm run build (in plugins/codexclaw/gui), then reload.\n";

function healthRoute()           {
  return {
    method: "GET",
    path: "/api/health",
    handler: (ctx) => ({
      status: 200,
      body: {
        ok: true,
        version: ctx.version,
        activeChannel: ctx.db.getActiveChannel()?.kind ?? null,
      },
    }),
  };
}

/** Base route set: health + GUI API parity + channel connect/manage + agents. */
export function baseRoutes()             {
  return [
    healthRoute(),
    ...apiCompatRoutes(),
    ...connectRoutes(),
    ...agentRoutes(),
    ...observabilityRoutes(),
    ...bindingManagementRoutes(),
  ];
}

function observabilityRoutes()             {
  return [
    {
      method: "GET",
      path: "/api/metrics",
      handler: (ctx) => {
        const snap = ctx.controller?.metricsSnapshot?.();
        return { status: 200, body: snap ?? { error: "metrics not available" } };
      },
    },
    {
      method: "GET",
      path: "/api/events",
      handler: (ctx, _body, url) => {
        const n = Number.parseInt(url.searchParams.get("n") ?? "50", 10);
        const events = ctx.controller?.recentEvents?.(Number.isFinite(n) ? n : 50) ?? [];
        return { status: 200, body: { events } };
      },
    },
    {
      method: "GET",
      path: "/api/agents/statuses",
      handler: (ctx) => {
        const statuses = ctx.controller?.agentStatuses?.();
        if (!statuses) return { status: 501, body: { error: "agent statuses not available" } };
        return { status: 200, body: { statuses } };
      },
    },
  ];
}

function bindingManagementRoutes()             {
  return [
    {
      method: "POST",
      path: "/api/bindings/reset",
      handler: (ctx, body) => {
        const id = parseBindingId(body);
        if (id === null) return { status: 400, body: { error: "id must be a number" } };
        if (!ctx.db.getBinding(id)) return { status: 404, body: { error: "binding not found" } };
        ctx.db.resetBindingSession(id);
        return { status: 200, body: { ok: true, binding: ctx.db.getBinding(id) } };
      },
    },
    {
      method: "POST",
      path: "/api/bindings/cwd",
      handler: (ctx, body) => {
        const id = parseBindingId(body);
        if (id === null) return { status: 400, body: { error: "id must be a number" } };
        if (!ctx.db.getBinding(id)) return { status: 404, body: { error: "binding not found" } };
        const raw = parseCwd(body);
        if (raw === null) return { status: 400, body: { error: "cwd must be a non-empty string" } };
        const real = resolveDirectory(raw);
        if (!real) return { status: 400, body: { error: `not a directory: ${raw}` } };
        ctx.db.setBindingWorkdir(id, real);
        ctx.db.resetBindingSession(id);
        return { status: 200, body: { ok: true, binding: ctx.db.getBinding(id) } };
      },
    },
  ];
}

function parseBindingId(body         )                {
  const value = (body                                  )?.id;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function parseCwd(body         )                {
  const value = (body                                  )?.cwd;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveDirectory(input        )                {
  const expanded = input === "~" ? homedir() : input.startsWith("~/") ? join(homedir(), input.slice(2)) : input;
  try {
    const real = realpathSync(resolve(expanded));
    return statSync(real).isDirectory() ? real : null;
  } catch {
    return null;
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Local-only guard against a malicious web page driving the loopback API
 * (CSRF / DNS-rebinding). Even though the socket binds 127.0.0.1, a browser on
 * this machine can still issue cross-origin requests to it.
 *  - Host header must resolve to loopback (defeats DNS rebinding).
 *  - Mutating requests must be JSON (blocks CORS "simple request" CSRF, which
 *    can't set application/json) AND carry x-codexclaw-local (a custom header
 *    forces a CORS preflight the server never answers → cross-origin blocked).
 * Returns an error string when the request must be rejected, else null.
 */
function localGuard(req                 )                {
  const host = (req.headers.host ?? "").split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]" && host !== "") {
    return "bad host";
  }
  if (MUTATING.has(req.method ?? "")) {
    const ct = String(req.headers["content-type"] ?? "");
    if (!ct.includes("application/json")) return "content-type must be application/json";
    if (req.headers["x-codexclaw-local"] !== "1") return "missing x-codexclaw-local header";
  }
  return null;
}

function sendJson(res                , status        , body         )       {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req                 )                   {
  return new Promise((resolvePromise, rejectPromise) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        rejectPromise(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolvePromise(null);
      try {
        resolvePromise(JSON.parse(raw));
      } catch {
        rejectPromise(new Error("invalid JSON body"));
      }
    });
    req.on("error", rejectPromise);
  });
}

function serveStatic(res                , guiDir        , pathname        )       {
  const root = resolve(guiDir);
  const indexFile = join(root, "index.html");
  const requested = normalize(pathname).replace(/^([/\\])+/, "");
  const candidate = resolve(root, requested === "" ? "index.html" : requested);
  const inside = candidate === root || candidate.startsWith(root + sep);

  if (inside && existsSync(candidate) && statSync(candidate).isFile()) {
    const type = CONTENT_TYPES[extname(candidate)] ?? "application/octet-stream";
    const data = readFileSync(candidate);
    res.writeHead(200, { "content-type": type, "content-length": data.length });
    res.end(data);
    return;
  }
  // SPA fallback: any non-file path serves the app shell.
  if (existsSync(indexFile)) {
    const data = readFileSync(indexFile);
    res.writeHead(200, { "content-type": CONTENT_TYPES[".html"], "content-length": data.length });
    res.end(data);
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(GUI_MISSING_PAGE);
}

export function createBridgeServer(opts                     )         {
  const ctx         = {
    db: opts.db,
    cwd: opts.cwd,
    version: opts.version,
    controller: opts.controller,
  };
  const routes             = [...baseRoutes(), ...(opts.extraRoutes ?? [])];

  return createServer((req, res) => {
    void handle(req, res).catch((err         ) => {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) sendJson(res, 500, { error: message });
      else res.end();
    });
  });

  async function handle(req                 , res                )                {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname.startsWith("/webhook/telegram/")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "method not allowed" });
        return;
      }
      const secret = webhookSecret(pathname);
      const handled = await ctx.controller?.handleTelegramWebhook?.(secret, req, res);
      if (!handled && !res.writableEnded) sendJson(res, 404, { error: "telegram webhook not found" });
      return;
    }

    if (pathname.startsWith("/api/")) {
      const rejection = localGuard(req);
      if (rejection) {
        sendJson(res, 403, { error: `forbidden: ${rejection}` });
        return;
      }
      const route = routes.find((r) => r.method === req.method && r.path === pathname);
      if (!route) {
        sendJson(res, 404, { error: `no route: ${req.method} ${pathname}` });
        return;
      }
      let body          = null;
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        try {
          body = await readBody(req);
        } catch (err) {
          sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
          return;
        }
      }
      const result = await route.handler(ctx, body, url);
      sendJson(res, result.status, result.body);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    // Docs route: exact match, fixed file, ahead of the SPA fallback which
    // would otherwise swallow it with index.html.
    if (pathname === "/readme") {
      const readmeFile = opts.readmePath ?? defaultReadmePath();
      if (existsSync(readmeFile) && statSync(readmeFile).isFile()) {
        const data = readFileSync(readmeFile);
        res.writeHead(200, { "content-type": "text/markdown; charset=utf-8", "content-length": data.length });
        res.end(req.method === "HEAD" ? undefined : data);
      } else {
        sendJson(res, 404, { error: "readme not found" });
      }
      return;
    }
    serveStatic(res, opts.guiDir, pathname);
  }
}

function webhookSecret(pathname        )         {
  const raw = pathname.slice("/webhook/telegram/".length).split("/", 1)[0] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
