/**
 * agent-routes.ts — named-agent CRUD API (slice 40).
 *
 * Exact-path routes over the v4 agents/agent_allowlist tables. Tokens are
 * validated on create/change via the shared validator (injectable for tests)
 * and NEVER returned by any route — responses expose `hasToken` only, matching
 * /api/channels. Runtime adapter reload for enabled agents lands in slice 50;
 * until then `enable` only flips the flag.
 */
import { createHash, randomBytes } from "node:crypto";

import { AGENT_EFFORTS, AGENT_THREAD_MODES,                                                  } from "./db.js";
import { validateToken,                      } from "./token-validate.js";
import { TelegramApi } from "./telegram-api.js";
import { DiscordApi } from "./discord-api.js";

const PAIRING_LINK_DEFAULT_SECONDS = 600;
const PAIRING_LINK_MAX_SECONDS = 3600;
const TEST_SEND_MESSAGE = "codexclaw bridge connected — this chat is ready.";
const MAX_AGENT_NAME_LENGTH = 128;
const MAX_WEBHOOK_URL_LENGTH = 2048;
const MAX_HEARTBEAT_PROMPT_LENGTH = 4096;
const MAX_TOKEN_LENGTH = 512;

function bad(message        )              {
  return { status: 400, body: { error: message } };
}

function parseKind(value         )                     {
  return value === "telegram" || value === "discord" ? value : null;
}

/** Public agent shape: everything on the card, minus the raw token. */
export function publicAgent(ctx        , a          )                          {
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
    fullAccess: a.full_access === 1,
    webhookUrl: a.webhook_url,
    threadMode: a.thread_mode,
    heartbeatMinutes: a.heartbeat_minutes,
    heartbeatPrompt: a.heartbeat_prompt,
    allowlistCount: ctx.db.listAgentAllowlist(a.id).length,
    updatedAt: a.updated_at,
  };
}







export function agentRoutes(deps                  = {})             {
  const validate = deps.validate ?? validateToken;
  const telegramApiFactory = deps.telegramApiFactory ?? ((token        ) => new TelegramApi(token));
  const discordApiFactory = deps.discordApiFactory ?? ((token        ) => new DiscordApi(token));

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
        const b = (body ?? {})                           ;
        const name = typeof b.name === "string" ? b.name.trim() : "";
        const kind = parseKind(b.kind);
        const token = typeof b.token === "string" ? b.token.trim() : "";
        if (!name) return bad("name required");
        if (name.length > MAX_AGENT_NAME_LENGTH) return bad(`name must be at most ${MAX_AGENT_NAME_LENGTH} characters`);
        if (!kind) return bad("kind must be telegram or discord");
        if (!token) return bad("token required");
        if (token.length > MAX_TOKEN_LENGTH) return bad(`token must be at most ${MAX_TOKEN_LENGTH} characters`);
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
        const b = (body ?? {})                           ;
        const id = typeof b.id === "number" ? b.id : Number.NaN;
        if (Number.isNaN(id)) return bad("id required");
        const agent = ctx.db.getAgent(id);
        if (!agent) return bad(`no agent ${id}`);

        const patch             = {};
        if (b.name !== undefined) {
          const name = typeof b.name === "string" ? b.name.trim() : "";
          if (!name) return bad("name must be a non-empty string");
          if (name.length > MAX_AGENT_NAME_LENGTH) return bad(`name must be at most ${MAX_AGENT_NAME_LENGTH} characters`);
          const clash = ctx.db.getAgentByName(name);
          if (clash && clash.id !== id) return bad(`agent "${name}" already exists`);
          patch.name = name;
        }
        if (b.model !== undefined) {
          if (typeof b.model !== "string" || b.model.length === 0) return bad("model must be a non-empty string");
          patch.model = b.model;
        }
        if (b.effort !== undefined) {
          if (typeof b.effort !== "string" || !(AGENT_EFFORTS                     ).includes(b.effort)) {
            return bad(`effort must be one of ${AGENT_EFFORTS.join(", ")}`);
          }
          patch.effort = b.effort;
        }
        if (b.autoSend !== undefined) patch.auto_send = b.autoSend ? 1 : 0;
        if (b.mentionOnly !== undefined) patch.mention_only = b.mentionOnly ? 1 : 0;
        if (b.fullAccess !== undefined) patch.full_access = b.fullAccess ? 1 : 0;
        if (b.webhookUrl !== undefined) {
          const webhookUrl = typeof b.webhookUrl === "string" ? b.webhookUrl.trim() : "";
          if (webhookUrl.length > MAX_WEBHOOK_URL_LENGTH) {
            return bad(`webhookUrl must be at most ${MAX_WEBHOOK_URL_LENGTH} characters`);
          }
          if (webhookUrl) {
            try {
              const parsed = new URL(webhookUrl);
              if (parsed.protocol !== "https:") return bad("webhookUrl must be https:// or empty");
              if (parsed.username || parsed.password) {
                return bad("webhook URL must not contain embedded credentials");
              }
            } catch {
              return bad("webhookUrl must be https:// or empty");
            }
          }
          patch.webhook_url = webhookUrl;
        }
        if (b.heartbeatMinutes !== undefined) {
          const minutes = typeof b.heartbeatMinutes === "number" ? b.heartbeatMinutes : Number.NaN;
          if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
            return bad("heartbeatMinutes must be an integer 0-1440 (0 = off)");
          }
          patch.heartbeat_minutes = minutes;
        }
        if (b.heartbeatPrompt !== undefined) {
          if (typeof b.heartbeatPrompt !== "string") return bad("heartbeatPrompt must be a string");
          if (b.heartbeatPrompt.length > MAX_HEARTBEAT_PROMPT_LENGTH) {
            return bad(`heartbeatPrompt must be at most ${MAX_HEARTBEAT_PROMPT_LENGTH} characters`);
          }
          patch.heartbeat_prompt = b.heartbeatPrompt;
        }
        if (b.token !== undefined) {
          const token = typeof b.token === "string" ? b.token.trim() : "";
          if (!token) return bad("token must be a non-empty string");
          if (token.length > MAX_TOKEN_LENGTH) return bad(`token must be at most ${MAX_TOKEN_LENGTH} characters`);
          const result = await validate(agent.kind, token);
          if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
          patch.token = token;
        }
        if (b.threadMode !== undefined) {
          if (typeof b.threadMode !== "string" || !(AGENT_THREAD_MODES                     ).includes(b.threadMode)) {
            return bad(`threadMode must be one of ${AGENT_THREAD_MODES.join(", ")}`);
          }
          patch.thread_mode = b.threadMode;
        }

        const updated = ctx.db.updateAgent(id, patch);
        // A token change on a RUNNING agent must restart its adapter; the
        // diff-based reload touches only that adapter.
        if ((patch.token !== undefined || patch.webhook_url !== undefined) && agent.enabled === 1) {
          await ctx.controller?.reload();
        }
        return { status: 200, body: { ok: true, agent: updated ? publicAgent(ctx, updated) : null } };
      },
    },
    {
      method: "POST",
      path: "/api/agents/delete",
      handler: (ctx, body) => {
        const b = (body ?? {})                           ;
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
        const b = (body ?? {})                           ;
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
        const b = (body ?? {})                           ;
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
    {
      method: "POST",
      path: "/api/agents/pairing-link",
      handler: async (ctx, body) => {
        const b = (body ?? {})                           ;
        const id = typeof b.id === "number" ? b.id : Number.NaN;
        if (Number.isNaN(id)) return bad("id required");
        const agent = ctx.db.getAgent(id);
        if (!agent) return bad(`no agent ${id}`);
        if (agent.kind !== "telegram") return bad("pairing-link is only supported for telegram agents");
        if (!agent.token) return bad("agent has no token — set one first");
        const seconds = typeof b.seconds === "number" && b.seconds > 0
          ? Math.min(Math.floor(b.seconds), PAIRING_LINK_MAX_SECONDS)
          : PAIRING_LINK_DEFAULT_SECONDS;
        const result = await validate(agent.kind, agent.token);
        if (!result.ok || !result.username) {
          return bad(result.ok ? "telegram getMe did not return a username" : result.error);
        }

        const code = randomBytes(16).toString("base64url");
        const hash = sha256Hex(code);
        const expiresAt = ctx.db.createAgentPairingCode(agent.id, hash, seconds);
        return {
          status: 200,
          body: {
            ok: true,
            url: `https://t.me/${result.username}?start=${code}`,
            code,
            expiresAt,
          },
        };
      },
    },
    {
      method: "POST",
      path: "/api/agents/test-send",
      handler: async (ctx, body) => {
        const b = (body ?? {})                           ;
        const id = typeof b.id === "number" ? b.id : Number.NaN;
        if (Number.isNaN(id)) return bad("id required");
        const agent = ctx.db.getAgent(id);
        if (!agent) return bad(`no agent ${id}`);
        const explicit = typeof b.chatId === "string" && b.chatId.trim() ? b.chatId.trim() : null;
        // An explicit chatId must already be paired: without this check the
        // local API could push messages into arbitrary chats/channels.
        if (explicit && !ctx.db.isAgentAllowed(agent.id, explicit)) {
          return bad(`chat ${explicit} is not paired with agent ${agent.id}`);
        }
        const target = explicit ?? ctx.db.listAgentAllowlist(agent.id).at(-1)?.chat_id;
        if (!target) return bad("chatId required when the agent has no paired chats");
        try {
          if (agent.kind === "telegram") {
            const sent = await telegramApiFactory(agent.token).sendMessage({ chatId: target, text: TEST_SEND_MESSAGE });
            if (!sent.ok) return bad(sent.description ?? "telegram send failed");
          } else {
            const sent = await discordApiFactory(agent.token).sendMessage(target, TEST_SEND_MESSAGE);
            if (!sent.ok) return bad(sent.error ?? "discord send failed");
          }
        } catch (err) {
          return bad(err instanceof Error ? err.message : String(err));
        }
        return { status: 200, body: { ok: true, chatId: target } };
      },
    },
  ];
}

function sha256Hex(value        )         {
  return createHash("sha256").update(value).digest("hex");
}
