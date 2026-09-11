/**
 * middleware.ts — Vite dev-server connect middleware exposing the codexclaw
 * dashboard API over the compiled handlers. Node-side only; the browser never
 * shells out to ocx. Routes:
 *   GET  /api/subagents   GET /api/catalog   GET /api/provider   GET /api/multi-agent
 *   POST /api/subagents   POST /api/multi-agent
 */
import type { Connect } from "vite";
import {
  getSubagents,
  postSubagents,
  getCatalog,
  getProvider,
  getMultiAgentSurface,
  postMultiAgentSurface,
} from "./handlers.ts";
import { detectOcx } from "../../../components/provider-bridge/src/detect.ts";
import { commandInvocation, resolveWindowsCommand } from "../../../components/cxc-ops/src/win-exec.ts";
import { resolveCodexInvocation } from "../../../components/cxc-ops/src/codex-bin.ts";
import { resolveCodexHome } from "../../../components/config-guard/src/cli.ts";
import type { CodexRunner } from "../../../components/config-guard/src/features.ts";
import { spawnSync } from "node:child_process";
import { splitLines } from "./text-lines.ts";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  BodyTooLargeError,
  localRequestRejection,
  readBoundedJson,
} from "../../../components/messenger-bridge/src/local-http.ts";

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
  // ~/.codexclaw is codexclaw's own GLOBAL store (recall index, skill cache), not a
  // project. Without this exclusion any start dir outside a repo walks up to the
  // filesystem root and resolves the user's entire home directory as the project.
  // The compare is case-insensitive on win32: a start dir spelled "c:\users\me\..."
  // walks up to "c:\users\me", which an exact compare would not match against the
  // canonical "C:\Users\me" - and the exclusion would silently not apply.
  const home = homedir();
  const isHome = (candidate: string): boolean =>
    process.platform === "win32"
      ? candidate.toLowerCase() === home.toLowerCase()
      : candidate === home;
  let firstCodexclaw: string | null = null;
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (firstCodexclaw === null && !isHome(dir) && existsSync(join(dir, ".codexclaw"))) firstCodexclaw = dir;
    const parent = dirname(dir);
    if (parent === dir) return firstCodexclaw ?? start; // filesystem root reached
    dir = parent;
  }
}

// Real ocx detection deps for the dev server (detect-only).
function detectDeps() {
  return {
    which: (cmd: string) => {
      if (process.platform === "win32") {
        // #131: `where ocx` lists the extensionless npm sh shim FIRST, and that file is
        // not an executable image, so spawning it ENOENTs. Resolve PATH+PATHEXT directly
        // instead of parsing `where` stdout — resolveWindowsCommand reads PATH/PATHEXT
        // case-insensitively and retries lowercased extensions, which a `where` parse
        // cannot do. Returns its input unchanged on a miss, which maps to null here.
        // Same shape as provider-bridge/src/cli.ts; this is the GUI copy of that bug.
        const resolved = resolveWindowsCommand(cmd, process.env);
        return resolved === cmd ? null : resolved;
      }
      const res = spawnSync("command", ["-v", cmd], { encoding: "utf8", shell: true });
      const out = res.status === 0 && typeof res.stdout === "string" ? splitLines(res.stdout)[0]?.trim() ?? "" : null;
      return out && out.length > 0 ? out : null;
    },
    runStatus: (ocxPath: string) => {
      // #131 second half: after CVE-2024-27980 a shell-less `.cmd` spawn is EINVAL.
      // commandInvocation routes only `.cmd`/`.bat` through ComSpec and escapes cmd
      // metacharacters; `shell: true` would not escape them.
      const inv = commandInvocation(ocxPath, ["status", "--json"]);
      const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 8000, ...inv.options });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
  };
}

function codexFeatureDeps() {
  const run: CodexRunner = (args) => {
    const command = process.env.CODEX_CLI_PATH?.trim() || "codex";
    // A bare name skips PATHEXT, and an npm-installed `codex.cmd` is EINVAL shell-less.
    // resolveCodexInvocation also detects the Microsoft Store WindowsApps alias, which
    // exits EPERM without running. On a miss it does NOT pass the input through: it
    // falls back to a cmd-shell invocation (cxc-ops/src/codex-bin.ts:120).
    const inv = resolveCodexInvocation(command, [...args]);
    const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 15000, ...inv.options });
    return {
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
      exitCode: typeof res.status === "number" ? res.status : 1,
    };
  };
  return { run, codexHome: resolveCodexHome(process.env) };
}

function send(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function codexclawApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const url = requestUrl.pathname;
    const cwd = resolveProjectRoot();
    if (!url.startsWith("/api/")) return next();

    const rejection = localRequestRejection(req);
    if (rejection) return send(res, 403, { error: `forbidden: ${rejection}` });

    if (url === "/api/subagents" && req.method === "GET") {
      const r = getSubagents(cwd, requestUrl.searchParams.get("scope") ?? undefined);
      return send(res, r.status, r.body);
    }
    if (url === "/api/subagents" && req.method === "POST") {
      void readBoundedJson(req)
        .then((body) => {
          const r = postSubagents(cwd, body);
          send(res, r.status, r.body);
        })
        .catch((err: unknown) => send(res, err instanceof BodyTooLargeError ? 413 : 400, {
          error: err instanceof Error ? err.message : String(err),
        }));
      return;
    }
    if (url === "/api/catalog" && req.method === "GET") {
      void getCatalog(requestUrl.searchParams.get("refresh") === "1")
        .then(r => send(res, r.status, r.body))
        .catch(() => send(res, 500, { error: "Model catalog unavailable" }));
      return;
    }
    if (url === "/api/provider" && req.method === "GET") {
      const r = getProvider(detectDeps());
      return send(res, r.status, r.body);
    }
    if (url === "/api/multi-agent" && req.method === "GET") {
      const r = getMultiAgentSurface(codexFeatureDeps());
      return send(res, r.status, r.body);
    }
    if (url === "/api/multi-agent" && req.method === "POST") {
      void readBoundedJson(req)
        .then((body) => {
          const r = postMultiAgentSurface(codexFeatureDeps(), body);
          send(res, r.status, r.body);
        })
        .catch((err: unknown) => send(res, err instanceof BodyTooLargeError ? 413 : 400, {
          error: err instanceof Error ? err.message : String(err),
        }));
      return;
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
