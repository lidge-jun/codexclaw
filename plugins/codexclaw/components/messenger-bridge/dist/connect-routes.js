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
        ctx.db.setActiveChannel(kind);
        await ctx.controller?.reload();
        return { status: 200, body: { ok: true, active: kind, status: ctx.controller?.adapterStatus() ?? "n/a" } };
      },
    },
    {
      method: "POST",
      path: "/api/connect/deactivate",
      handler: async (ctx) => {
        ctx.db.setActiveChannel(null);
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
          return {
            kind,
            hasToken: Boolean(ch?.token),
            active: ch?.active === 1,
            allowlistCount: ctx.db.listAllowlist(kind).length,
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
