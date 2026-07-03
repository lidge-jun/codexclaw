/**
 * connect-routes.ts — channel connect/manage API for the GUI wizard (Phase 5).
 *
 * Exact-path routes (the server matches on pathname; `kind` travels in the body
 * or query). Flow the wizard drives: validate+save token → activate (reloads
 * the live adapter) → open a handshake window → poll status until a chat pairs.
 * Plus read models: channels list, bindings, per-binding jobs.
 *
 * Handshake progress is exposed as polling (not SSE) — simpler, testable, and
 * the window is short-lived; the GUI polls status every ~1s.
 */


import { validateToken } from "./token-validate.js";

const KINDS                = ["telegram", "discord"];

function parseKind(value         )                     {
  return value === "telegram" || value === "discord" ? value : null;
}

function bad(message        )              {
  return { status: 400, body: { error: message } };
}

/* ── legacy-API-over-agents shims (slice 50) ─────────────────────────────────
 * Agents are the runtime source of truth; these keep the pre-agent GUI alive:
 * the per-kind flow maps onto the FIRST agent of that kind ("<kind>-1"). */

function agentsOfKind(ctx        , kind             )             {
  return ctx.db.listAgents().filter((a) => a.kind === kind);
}

/** First free "<kind>-N" name (a user may have taken "<kind>-1" for another kind). */
function freeAgentName(ctx        , kind             )         {
  for (let n = 1; ; n += 1) {
    const name = `${kind}-${n}`;
    if (!ctx.db.getAgentByName(name)) return name;
  }
}

/** Ensure a shim agent exists for the kind, carrying the given token. */
function ensureKindAgent(ctx        , kind             , token        )           {
  const existing = agentsOfKind(ctx, kind)[0];
  if (existing) {
    if (existing.token !== token) {
      return ctx.db.updateAgent(existing.id, { token }) ?? existing;
    }
    return existing;
  }
  return ctx.db.createAgent(freeAgentName(ctx, kind), kind, token);
}

export function connectRoutes()             {
  return [
    {
      method: "POST",
      path: "/api/connect/validate",
      handler: async (ctx, body) => {
        const b = (body ?? {})                           ;
        const kind = parseKind(b.kind);
        const token = typeof b.token === "string" ? b.token.trim() : "";
        if (!kind) return bad("kind must be telegram or discord");
        if (!token) return bad("token required");
        const result = await validateToken(kind, token);
        if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
        ctx.db.setChannelToken(kind, token);
        // Shim: keep the kind's first agent carrying the same token so the
        // agent-based runtime picks it up on activate.
        ensureKindAgent(ctx, kind, token);
        return { status: 200, body: { ok: true, username: result.username ?? null } };
      },
    },
    {
      method: "POST",
      path: "/api/connect/activate",
      handler: async (ctx, body) => {
        const kind = parseKind((body                           )?.kind);
        if (!kind) return bad("kind must be telegram or discord");
        const channel = ctx.db.getChannel(kind);
        if (!channel?.token) return bad(`no token saved for ${kind}`);
        ctx.db.setActiveChannel(kind); // legacy table stays coherent
        // Shim: the runtime runs on agents — enable the kind's first agent,
        // creating it from the channel token when missing (covers direct
        // setChannelToken paths that never hit /validate).
        const agent = ensureKindAgent(ctx, kind, channel.token);
        ctx.db.setAgentEnabled(agent.id, true);
        await ctx.controller?.reload();
        return { status: 200, body: { ok: true, active: kind, status: ctx.controller?.adapterStatus() ?? "n/a" } };
      },
    },
    {
      method: "POST",
      path: "/api/connect/deactivate",
      handler: async (ctx) => {
        ctx.db.setActiveChannel(null);
        // Legacy semantic: "turn the messenger off" — disable every agent.
        for (const agent of ctx.db.listAgents()) {
          if (agent.enabled === 1) ctx.db.setAgentEnabled(agent.id, false);
        }
        await ctx.controller?.reload();
        return { status: 200, body: { ok: true, active: null } };
      },
    },
    {
      method: "POST",
      path: "/api/connect/handshake/open",
      handler: (ctx, body) => {
        const b = (body ?? {})                           ;
        const kind = parseKind(b.kind);
        if (!kind) return bad("kind must be telegram or discord");
        const seconds = typeof b.seconds === "number" && b.seconds > 0 ? Math.min(b.seconds, 600) : 120;
        if (ctx.controller) ctx.controller.openHandshake(kind, seconds);
        else ctx.db.openHandshake(kind, seconds);
        return { status: 200, body: { ok: true, kind, seconds } };
      },
    },
    {
      method: "GET",
      path: "/api/connect/handshake/status",
      handler: (ctx, _body, url) => {
        const kind = parseKind(url.searchParams.get("kind"));
        if (!kind) return bad("kind query param required");
        const state = ctx.controller
          ? ctx.controller.handshakeState(kind)
          : { open: ctx.db.isHandshakeOpen(kind), pairedChatId: null };
        return { status: 200, body: state };
      },
    },
    {
      method: "GET",
      path: "/api/channels",
      handler: (ctx) => {
        const channels = KINDS.map((kind) => {
          const ch = ctx.db.getChannel(kind);
          const agents = agentsOfKind(ctx, kind);
          // Agents are the runtime source: a kind is "active" when any of its
          // agents is enabled; counts come from agent allowlists (falling back
          // to the legacy table when the kind has no agents yet).
          const active = agents.some((a) => a.enabled === 1);
          const allowlistCount =
            agents.length > 0
              ? agents.reduce((sum, a) => sum + ctx.db.listAgentAllowlist(a.id).length, 0)
              : ctx.db.listAllowlist(kind).length;
          return {
            kind,
            hasToken: agents.some((a) => a.token.length > 0) || Boolean(ch?.token),
            active,
            allowlistCount,
          };
        });
        return {
          status: 200,
          body: {
            channels,
            activeKind: ctx.controller?.activeKind() ?? ctx.db.getActiveChannel()?.kind ?? null,
            adapterStatus: ctx.controller?.adapterStatus() ?? "n/a",
          },
        };
      },
    },
    {
      method: "GET",
      path: "/api/bindings",
      handler: (ctx) => ({ status: 200, body: { bindings: ctx.db.listBindings() } }),
    },
    {
      method: "GET",
      path: "/api/bindings/jobs",
      handler: (ctx, _body, url) => {
        const id = Number.parseInt(url.searchParams.get("id") ?? "", 10);
        if (Number.isNaN(id)) return bad("id query param required");
        return { status: 200, body: { jobs: ctx.db.listJobs(id, 20) } };
      },
    },
  ];
}
