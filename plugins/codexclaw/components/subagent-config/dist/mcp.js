#!/usr/bin/env node
/**
 * subagent-config — MCP server + config store.
 *
 * Responsibility (full feature, Phase 2 / devlog 032):
 *  - Persist per-role subagent config: default-model vs multi-model mapping,
 *    and per-role prompt overrides (store: .codexclaw/subagents.json).
 *  - Expose the config to the codexclaw GUI and as MCP tools.
 *  - Model catalog comes from the Codex config cache (CODEX_MODELS_CACHE_PATH).
 *    opencodex SYNCS its routed `provider/model` models into that codex config, so
 *    ocx-backed models appear in the catalog WITHOUT codexclaw calling ocx directly
 *    (detect-only boundary). `catalog_list` reads that cache via buildCatalog().
 *
 * Current scope: a spec-compliant stdio MCP server that completes the JSON-RPC
 * `initialize` handshake and advertises the subagent config/catalog tools below.
 * Zero third-party deps: newline-delimited JSON-RPC over stdin/stdout (node:* only).
 */
import { createInterface } from "node:readline";
import { readConfig, setRole, ROLES, EFFORTS,               } from "./store.js";
import { buildCatalog } from "./catalog.js";

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
    description: "Read the per-role subagent config (explorer/reviewer/executor): mode, model, promptOverride.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "subagents_set",
    description:
      "Update one role's subagent config. mode is 'default' (main model) or 'model' (requires a model id); effort is a reasoning-effort override (null inherits the parent session's effort).",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", enum: [...ROLES] },
        mode: { type: "string", enum: ["default", "model"] },
        model: { type: ["string", "null"] },
        effort: { type: ["string", "null"], enum: [...EFFORTS, null] },
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

function callTool(id         , params                                                        )       {
  const cwd = process.cwd();
  const args = params.arguments ?? {};
  if (params.name === "subagents_get") {
    toolResult(id, readConfig(cwd));
    return;
  }
  if (params.name === "subagents_set") {
    const role = args.role            ;
    if (!ROLES.includes(role)) {
      toolError(id, `unknown role "${String(args.role)}"`);
      return;
    }
    const patch                          = {};
    if (args.mode !== undefined) patch.mode = args.mode;
    if (args.model !== undefined) patch.model = args.model;
    if (args.effort !== undefined) patch.effort = args.effort;
    if (args.promptOverride !== undefined) patch.promptOverride = args.promptOverride;
    try {
      toolResult(id, setRole(cwd, role, patch));
    } catch (err) {
      toolError(id, err instanceof Error ? err.message : String(err));
    }
    return;
  }
  if (params.name === "catalog_list") {
    // Catalog read from the Codex config cache (native + ocx-synced routed slugs).
    // L24 owns selection persistence; this never writes and never calls ocx directly.
    toolResult(id, buildCatalog());
    return;
  }
  toolError(id, `unknown tool: ${String(params.name)}`);
}

function handle(msg                                   )       {
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
      callTool(id, (msg                                                                       ).params ?? {});
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

const rl = createInterface({ input: process.stdin });
rl.on("line", (line        ) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handle(JSON.parse(trimmed)                                     );
  } catch {
    // Malformed line: ignore rather than crash the long-lived server.
  }
});
rl.on("close", () => process.exit(0));
