#!/usr/bin/env node
/**
 * subagent-config — MCP server + config store.
 *
 * Responsibility (full feature, Phase 2 / devlog 032):
 *  - Persist per-role subagent config: default-model vs multi-model mapping,
 *    and per-role prompt overrides (store: .codexclaw/subagents.json).
 *  - Expose the config to the codexclaw GUI and as MCP tools.
 *  - Model catalog uses read-only OCX discovery and a shared CXC cache.
 *    When OCX is absent, the configured Codex catalog is read instead.
 *
 * Current scope: a spec-compliant stdio MCP server that completes the JSON-RPC
 * `initialize` handshake and advertises the subagent config/catalog tools below.
 * Zero third-party deps: newline-delimited JSON-RPC over stdin/stdout (node:* only).
 */
import { createInterface } from "node:readline";
import { realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROLES, EFFORTS,                                                       } from "./store.js";
import { getSettings, updateSettings } from "./settings-api.js";
import { nativeCatalogPath } from "./catalog.js";
import { readCatalog,                                       } from "./live-catalog.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "codexclaw-subagent-config", version: "0.1.1" };

function send(message         )       {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id         , result         )       {
  send({ jsonrpc: "2.0", id, result });
}

const TOOLS = [
  {
    name: "subagents_get",
    description: "Read the per-role subagent config (explorer/reviewer/executor/architect): mode, model, effort, promptOverride, source and scope. Project defaults to global, then original session.",
    inputSchema: { type: "object", properties: { scope: { type: "string", enum: ["project", "global"] } }, additionalProperties: false },
  },
  {
    name: "subagents_set",
    description:
      "Update one role's subagent config. mode is 'default' (main model) or 'model' (requires a model id); effort is a reasoning-effort override (null inherits the parent session's effort).",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["project", "global"] },
        inherit: { type: "boolean", description: "Remove this entire role override and inherit the next scope; do not combine with role settings." },
        role: { type: "string", enum: [...ROLES] },
        mode: { type: "string", enum: ["default", "model"] },
        model: { type: ["string", "null"] },
        effort: { type: ["string", "null"], enum: [...EFFORTS, null] },
        fallback: {
          type: ["object", "null"],
          description: "Optional first fallback. Null clears; omitted nested effort inherits existing fallback effort or session effort.",
          properties: { model: { type: "string", minLength: 1 }, effort: { type: ["string", "null"], enum: [...EFFORTS, null] } },
          additionalProperties: false,
        },
        promptOverride: { type: ["string", "null"] },
      },
      required: ["role"],
      additionalProperties: false,
    },
  },
  {
    name: "catalog_list",
    description: "List selectable models: Codex-native entries first, then ocx-backed entries when ocx is active.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function toolResult(id         , payload         )       {
  reply(id, { content: [{ type: "text", text: JSON.stringify(payload) }] });
}

function toolError(id         , message        )       {
  reply(id, { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true });
}

const NATIVE_CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STALE_PROBE_MS = 5_000;

function catalogIsAuthoritative(catalog             , now        , env                   )          {
  if (catalog.status !== "fresh") return false;
  if (catalog.source === "ocx") return true;
  const path = nativeCatalogPath(env);
  if (!path) return false;
  try {
    const age = now - statSync(path).mtimeMs;
    return age >= 0 && age <= NATIVE_CATALOG_MAX_AGE_MS;
  } catch { return false; }
}







function decorateSubagentsGet(settings                  , catalog                    , now = Date.now(), env                    = process.env) {
  const authoritative = catalog !== null && catalogIsAuthoritative(catalog, now, env);
  const roles = {}                                   ;
  for (const role of ROLES) {
    const config = settings.roles[role];
    const spawnArgs                             = {};
    if (config.mode === "model" && config.model) spawnArgs.model = config.model;
    if (config.effort !== null) spawnArgs.reasoning_effort = config.effort;
    const staleModel = config.mode === "model" && config.model && authoritative
      ? !catalog .entries.some(entry => entry.id === config.model)
      : null;
    let staleReason                    ;
    if (staleModel === null) {
      staleReason = config.mode !== "model" ? "role uses the default model"
        : catalog === null ? "catalog read timed out after 5000 ms"
        : catalog.status === "stale" ? "catalog is last-success cache"
        : "catalog unavailable";
    }
    roles[role] = { ...config, spawnArgs, staleModel, ...(staleReason ? { staleReason } : {}) };
  }
  return { ...settings, roles };
}

export async function handleToolCall(
  id         ,
  params                                                        ,
  readCatalogImpl                                                     = readCatalog,
)                {
  const cwd = process.cwd();
  const args = params.arguments ?? {};
  if (params.name === "subagents_get" || params.name === "subagents_set") {
    try {
      if (params.name === "subagents_get") {
        const settings = getSettings(cwd, args.scope);
        const catalog = await Promise.race([
          readCatalogImpl({ forceRefresh: true }).catch(()              => ({ state: "unavailable", entries: [], status: "unavailable", source: "ocx", fetchedAt: null })),
          new Promise      ((resolve) => { const timer = setTimeout(() => resolve(null), STALE_PROBE_MS); timer.unref?.(); }),
        ]);
        toolResult(id, decorateSubagentsGet(settings, catalog));
      } else {
        toolResult(id, updateSettings(cwd, args));
      }
    } catch (err) {
      toolError(id, err instanceof Error ? err.message : String(err));
    }
    return;
  }
  if (params.name === "catalog_list") {
    // Read-only OCX discovery may update the shared catalog cache.
    // Model and effort preferences are never changed by discovery.
    toolResult(id, await readCatalog());
    return;
  }
  toolError(id, `unknown tool: ${String(params.name)}`);
}

async function handle(msg                                   )                {
  const { id, method } = msg;
  switch (method) {
    case "initialize":
      reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    case "tools/list":
      reply(id, { tools: TOOLS });
      return;
    case "tools/call":
      await handleToolCall(id, (msg                                                                       ).params ?? {});
      return;
    case "ping":
      reply(id, {});
      return;
    default:
      // Notifications (no id) are fire-and-forget; requests get a method-not-found error.
      if (id !== undefined) {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
      }
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rl = createInterface({ input: process.stdin });
  // Requests run one at a time so replies keep request order now that
  // subagents_get awaits a catalog read, and stdin EOF waits for them to finish.
  let queue                = Promise.resolve();
  rl.on("line", (line        ) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg                                   ;
    try {
      msg = JSON.parse(trimmed)                                     ;
    } catch {
      return; // Malformed line: ignore rather than crash the long-lived server.
    }
    queue = queue.then(() => handle(msg)).catch(() => { /* malformed requests do not crash stdio */ });
  });
  rl.on("close", () => { void queue.then(() => process.exit(0)); });
}
