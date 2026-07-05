/**
 * agent-routes.ts — named-agent CRUD API (slice 40).
 *
 * Exact-path routes over the v4 agents/agent_allowlist tables. Tokens are
 * validated on create/change via the shared validator (injectable for tests)
 * and NEVER returned by any route — responses expose `hasToken` only, matching
 * /api/channels. Runtime adapter reload for enabled agents lands in slice 50;
 * until then `enable` only flips the flag.
 */
import type { ApiCtx, ApiResponse, ApiRoute } from "./server.ts";
import { AGENT_EFFORTS, type AgentPatch, type AgentRow, type ChannelKind } from "./db.ts";
import { validateToken, type ValidateTokenFn } from "./token-validate.ts";

function bad(message: string): ApiResponse {
  return { status: 400, body: { error: message } };
}

function parseKind(value: unknown): ChannelKind | null {
  return value === "telegram" || value === "discord" ? value : null;
}

/** Public agent shape: everything on the card, minus the raw token. */
export function publicAgent(ctx: ApiCtx, a: AgentRow): Record<string, unknown> {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    hasToken: a.token.length > 0,
    enabled: a.enabled === 1,
    model: a.model,
    effort: a.effort,
    autoSend: a.auto_send === 1,
    mentionOnly: a.mention_only === 1,
    heartbeatMinutes: a.heartbeat_minutes,
    heartbeatPrompt: a.heartbeat_prompt,
    allowlistCount: ctx.db.listAgentAllowlist(a.id).length,
    updatedAt: a.updated_at,
  };
}

export interface AgentRoutesDeps {
  validate?: ValidateTokenFn;
}

export function agentRoutes(deps: AgentRoutesDeps = {}): ApiRoute[] {
  const validate = deps.validate ?? validateToken;

  return [
    {
      method: "GET",
      path: "/api/agents",
      handler: (ctx) => ({
        status: 200,
        body: { agents: ctx.db.listAgents().map((a) => publicAgent(ctx, a)) },
      }),
    },
    {
      method: "POST",
      path: "/api/agents",
      handler: async (ctx, body) => {
        const b = (body ?? {}) as Record<string, unknown>;
        const name = typeof b.name === "string" ? b.name.trim() : "";
        const kind = parseKind(b.kind);
        const token = typeof b.token === "string" ? b.token.trim() : "";
        if (!name) return bad("name required");
        if (!kind) return bad("kind must be telegram or discord");
        if (!token) return bad("token required");
        if (ctx.db.getAgentByName(name)) return bad(`agent "${name}" already exists`);
        const result = await validate(kind, token);
        if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
        const agent = ctx.db.createAgent(name, kind, token);
        return {
          status: 200,
          body: {
            ok: true,
            agent: publicAgent(ctx, agent),
            username: result.username ?? null,
            botId: result.botId ?? null,
          },
        };
      },
    },
    {
      method: "POST",
      path: "/api/agents/update",
      handler: async (ctx, body) => {
        const b = (body ?? {}) as Record<string, unknown>;
        const id = typeof b.id === "number" ? b.id : Number.NaN;
        if (Number.isNaN(id)) return bad("id required");
        const agent = ctx.db.getAgent(id);
        if (!agent) return bad(`no agent ${id}`);

        const patch: AgentPatch = {};
        if (b.name !== undefined) {
          const name = typeof b.name === "string" ? b.name.trim() : "";
          if (!name) return bad("name must be a non-empty string");
          const clash = ctx.db.getAgentByName(name);
          if (clash && clash.id !== id) return bad(`agent "${name}" already exists`);
          patch.name = name;
        }
        if (b.model !== undefined) {
          if (typeof b.model !== "string" || b.model.length === 0) return bad("model must be a non-empty string");
          patch.model = b.model;
        }
        if (b.effort !== undefined) {
          if (typeof b.effort !== "string" || !(AGENT_EFFORTS as readonly string[]).includes(b.effort)) {
            return bad(`effort must be one of ${AGENT_EFFORTS.join(", ")}`);
          }
          patch.effort = b.effort;
        }
        if (b.autoSend !== undefined) patch.auto_send = b.autoSend ? 1 : 0;
        if (b.mentionOnly !== undefined) patch.mention_only = b.mentionOnly ? 1 : 0;
        if (b.heartbeatMinutes !== undefined) {
          const minutes = typeof b.heartbeatMinutes === "number" ? b.heartbeatMinutes : Number.NaN;
          if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
            return bad("heartbeatMinutes must be an integer 0-1440 (0 = off)");
          }
          patch.heartbeat_minutes = minutes;
        }
        if (b.heartbeatPrompt !== undefined) {
          if (typeof b.heartbeatPrompt !== "string") return bad("heartbeatPrompt must be a string");
          patch.heartbeat_prompt = b.heartbeatPrompt;
        }
        if (b.token !== undefined) {
          const token = typeof b.token === "string" ? b.token.trim() : "";
          if (!token) return bad("token must be a non-empty string");
          const result = await validate(agent.kind, token);
          if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
          patch.token = token;
        }

        const updated = ctx.db.updateAgent(id, patch);
        // A token change on a RUNNING agent must restart its adapter; the
        // diff-based reload touches only that adapter.
        if (patch.token !== undefined && agent.enabled === 1) await ctx.controller?.reload();
        return { status: 200, body: { ok: true, agent: updated ? publicAgent(ctx, updated) : null } };
      },
    },
    {
      method: "POST",
      path: "/api/agents/delete",
      handler: (ctx, body) => {
        const b = (body ?? {}) as Record<string, unknown>;
        const id = typeof b.id === "number" ? b.id : Number.NaN;
        if (Number.isNaN(id)) return bad("id required");
        try {
          ctx.db.deleteAgent(id);
        } catch (err) {
          return bad(err instanceof Error ? err.message : String(err));
        }
        return { status: 200, body: { ok: true } };
      },
    },
    {
      method: "POST",
      path: "/api/agents/enable",
      handler: async (ctx, body) => {
        const b = (body ?? {}) as Record<string, unknown>;
        const id = typeof b.id === "number" ? b.id : Number.NaN;
        const enabled = Boolean(b.enabled);
        if (Number.isNaN(id)) return bad("id required");
        const agent = ctx.db.getAgent(id);
        if (!agent) return bad(`no agent ${id}`);
        if (enabled && agent.token.length === 0) return bad("agent has no token — set one first");
        ctx.db.setAgentEnabled(id, enabled);
        // Slice 50: reload is diff-based — it starts/stops ONLY this agent's
        // adapter, so live reload is safe now (the slice-40 objection was the
        // legacy whole-bounce, which no longer exists).
        await ctx.controller?.reload();
        return { status: 200, body: { ok: true, enabled } };
      },
    },
    {
      method: "POST",
      path: "/api/agents/handshake/open",
      handler: (ctx, body) => {
        const b = (body ?? {}) as Record<string, unknown>;
        const id = typeof b.id === "number" ? b.id : Number.NaN;
        if (Number.isNaN(id)) return bad("id required");
        if (!ctx.db.getAgent(id)) return bad(`no agent ${id}`);
        const seconds = typeof b.seconds === "number" && b.seconds > 0 ? Math.min(b.seconds, 600) : 120;
        ctx.db.openAgentHandshake(id, seconds);
        return { status: 200, body: { ok: true, id, seconds } };
      },
    },
    {
      method: "GET",
      path: "/api/agents/handshake/status",
      handler: (ctx, _body, url) => {
        const id = Number.parseInt(url.searchParams.get("id") ?? "", 10);
        if (Number.isNaN(id)) return bad("id query param required");
        if (!ctx.db.getAgent(id)) return bad(`no agent ${id}`);
        // Pairing detection = allowlistCount growth (the GUI snapshots a baseline
        // before opening the window); adapter-side /start admission lands in 50.
        return {
          status: 200,
          body: {
            open: ctx.db.isAgentHandshakeOpen(id),
            allowlistCount: ctx.db.listAgentAllowlist(id).length,
          },
        };
      },
    },
  ];
}
