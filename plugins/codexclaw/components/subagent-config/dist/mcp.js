#!/usr/bin/env node
/**
 * subagent-config — MCP server + config store.
 *
 * Responsibility (full feature, Phase 2 / devlog 032):
 *  - Persist per-role subagent config: default-model vs multi-model mapping,
 *    and per-role prompt overrides (store: .codexclaw/subagents.json).
 *  - Expose the config to the codexclaw GUI and as MCP tools.
 *  - When ocx is present, source the available model catalog from it.
 *
 * Phase 1 scope: a MINIMAL but spec-compliant stdio MCP server that completes
 * the JSON-RPC `initialize` handshake and advertises ZERO tools. This keeps the
 * `.mcp.json` reference honest — the process actually handshakes instead of
 * exiting immediately — while the real config store + tools land in Phase 2.
 * Zero third-party deps: newline-delimited JSON-RPC over stdin/stdout (node:* only).
 */
import { createInterface } from "node:readline";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "codexclaw-subagent-config", version: "0.1.0" };

function send(message         )       {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id         , result         )       {
  send({ jsonrpc: "2.0", id, result });
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
      reply(id, { tools: [] });
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
