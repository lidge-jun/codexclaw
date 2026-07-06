/**
 * middleware.ts — Vite dev-server connect middleware exposing the codexclaw
 * dashboard API over the compiled handlers. Node-side only; the browser never
 * shells out to ocx. Routes:
 *   GET  /api/subagents   GET /api/catalog   GET /api/provider
 *   POST /api/subagents   (role patch)
 */
import type { Connect } from "vite";
import {
  getSubagents,
  postSubagents,
  getCatalog,
  getProvider,
} from "./handlers.ts";
import { detectOcx } from "../../../components/provider-bridge/src/detect.ts";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Resolve the PROJECT root whose `.codexclaw/` this dashboard manages. The vite dev
 * server runs from `plugins/codexclaw/gui/`, so bare `process.cwd()` would silently
 * read/write `gui/.codexclaw/` — a store no spawn-time hook ever looks at (the hook
 * resolves against the codex session cwd). Resolution order: CODEXCLAW_ROOT override,
 * else the nearest ancestor with `.git/` (the real project boundary — hook-state
 * `.codexclaw/` dirs can appear at incidental depths, e.g. plugins/codexclaw/, and
 * must not capture the walk), else the nearest ancestor with `.codexclaw/`, else the
 * start dir.
 */
export function resolveProjectRoot(start: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): string {
  const override = typeof env.CODEXCLAW_ROOT === "string" ? env.CODEXCLAW_ROOT.trim() : "";
  if (override.length > 0) return override;
  let firstCodexclaw: string | null = null;
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (firstCodexclaw === null && existsSync(join(dir, ".codexclaw"))) firstCodexclaw = dir;
    const parent = dirname(dir);
    if (parent === dir) return firstCodexclaw ?? start; // filesystem root reached
    dir = parent;
  }
}

// Real ocx detection deps for the dev server (detect-only).
function detectDeps() {
  return {
    which: (cmd: string) => {
      const res = spawnSync(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? [cmd] : ["-v", cmd], {
        encoding: "utf8",
        shell: process.platform !== "win32",
      });
      const out = res.status === 0 && typeof res.stdout === "string" ? res.stdout.split("\n")[0]?.trim() : null;
      return out && out.length > 0 ? out : null;
    },
    runStatus: (ocxPath: string) => {
      const res = spawnSync(ocxPath, ["status", "--json"], { encoding: "utf8", timeout: 8000 });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
  };
}

function send(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function codexclawApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? "";
    const cwd = resolveProjectRoot();
    if (!url.startsWith("/api/")) return next();

    if (url === "/api/subagents" && req.method === "GET") {
      const r = getSubagents(cwd);
      return send(res, r.status, r.body);
    }
    if (url === "/api/subagents" && req.method === "POST") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        let body: unknown = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          return send(res, 400, { error: "invalid JSON body" });
        }
        const r = postSubagents(cwd, body);
        send(res, r.status, r.body);
      });
      return;
    }
    if (url === "/api/catalog" && req.method === "GET") {
      const r = getCatalog(detectDeps());
      return send(res, r.status, r.body);
    }
    if (url === "/api/provider" && req.method === "GET") {
      const r = getProvider(detectDeps());
      return send(res, r.status, r.body);
    }
    return next();
  };
}

// Vite plugin wrapper.
export function codexclawApiPlugin() {
  return {
    name: "codexclaw-api",
    configureServer(server: { middlewares: { use: (fn: Connect.NextHandleFunction) => void } }) {
      server.middlewares.use(codexclawApiMiddleware());
    },
  };
}

// silence unused import in type-only builds
void detectOcx;
