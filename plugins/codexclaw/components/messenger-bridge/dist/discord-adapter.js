/**
 * discord-adapter.ts — Discord bridge over the gateway + REST (Phase 4).
 *
 * Same contract as the Telegram adapter: gate each message (own-bot skip →
 * allowlist → non-empty), run it through the Phase 2 AgentService, and reply.
 * Discord has no cheap message-edit status UX like Telegram, so progress is a
 * single typing trigger + the final chunked answer. A `!start` message pairs a
 * channel when a handshake window is open (Discord bots can't see a native
 * /start, so we use a text trigger).
 *
 * v4 agent scoping: with `agent` set, handshake/allowlist/bindings are scoped to
 * that agent, and guild messages honor the agent's mention_only toggle (mention
 * = `<@botId>` or nickname form `<@!botId>`, from the gateway READY user id).
 */


import { DiscordApi, chunkDiscordMessage,                } from "./discord-api.js";
import {
  DiscordGateway,


} from "./discord-gateway.js";




















const START_TRIGGER = "!cxc start";

export function createDiscordAdapter(opts                       )                 {
  const api = new DiscordApi(opts.token, opts.fetchImpl);
  const log = opts.log ?? (() => {});
  const agentId = opts.agent?.id ?? null;
  let gateway                        = null;
  let warnedNoBotId = false;
  // Bounded dedupe of recently-seen message ids — the gateway can redeliver a
  // MESSAGE_CREATE on RESUME, and a full-permission exec must not run twice
  // (security review finding 4).
  const seenIds = new Set        ();
  const seenOrder           = [];

  const isAllowedChat = (channelId        ) =>
    agentId === null ? opts.db.isAllowed("discord", channelId) : opts.db.isAgentAllowed(agentId, channelId);
  const isHandshakeOpen = () =>
    agentId === null ? opts.db.isHandshakeOpen("discord") : opts.db.isAgentHandshakeOpen(agentId);
  const admitChannel = (channelId        ) => {
    if (agentId === null) {
      opts.db.addAllowlist("discord", channelId, "");
      opts.db.closeHandshake("discord");
    } else {
      opts.db.addAgentAllowlist(agentId, channelId, "");
      opts.db.closeAgentHandshake(agentId);
    }
  };
  /** Legacy has no mention gate on Discord; agents follow the live card toggle. */
  const mentionRequired = () =>
    agentId === null ? false : (opts.db.getAgent(agentId)?.mention_only ?? 1) === 1;

  function alreadySeen(id        )          {
    if (!id) return false;
    if (seenIds.has(id)) return true;
    seenIds.add(id);
    seenOrder.push(id);
    if (seenOrder.length > 512) {
      const evicted = seenOrder.shift();
      if (evicted) seenIds.delete(evicted);
    }
    return false;
  }

  /** Guild-channel mention gate + strip. Returns null when gated out. */
  function gateAndStripMention(msg                     , text        )                {
    if (!msg.guildId) return text; // DMs always respond
    const botId = gateway?.botUserId() ?? null;
    if (!botId) {
      // READY payload lacked the user id — cannot detect mentions; respond-all
      // (documented fallback, audit rev-2 fix #2) and say so once.
      if (mentionRequired() && !warnedNoBotId) {
        warnedNoBotId = true;
        log("[discord] mention_only is on but the bot user id is unknown — responding to all messages");
      }
      return text;
    }
    // Nickname mentions arrive as <@!id> (audit rev-2 fix #3).
    const hasMention = new RegExp(`<@!?${botId}>`).test(text);
    if (mentionRequired() && !hasMention) return null;
    return text.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();
  }

  async function handleMessage(msg                     )                {
    if (msg.isBot) return; // never react to bots (incl. our own echoes)
    if (alreadySeen(msg.id)) return; // duplicate gateway delivery
    const channelId = msg.channelId;
    const rawText = msg.content.trim();

    if (rawText === START_TRIGGER) {
      await handleStart(channelId);
      return;
    }
    if (!isAllowedChat(channelId)) return; // silent ignore
    const text = gateAndStripMention(msg, rawText);
    if (text === null || !text) return;

    void api.triggerTyping(channelId);
    const result = await opts.agentService.handleIncoming({
      kind: "discord",
      chatId: channelId,
      text,
      workdir: opts.workdir,
      agentId: agentId ?? undefined,
    });

    if (result.ok && result.text) {
      for (const chunk of chunkDiscordMessage(result.text)) {
        await api.sendMessage(channelId, chunk);
      }
      log(`[discord] out ${channelId}: ${result.text.slice(0, 60)}`);
    } else {
      await api.sendMessage(channelId, `❌ ${result.error ?? "no response"}`);
    }
  }

  async function handleStart(channelId        )                {
    if (isAllowedChat(channelId)) {
      await api.sendMessage(channelId, "codexclaw: already connected ✅");
      return;
    }
    if (isHandshakeOpen()) {
      // Atomic close on first pair (security review finding 2).
      admitChannel(channelId);
      await api.sendMessage(channelId, "codexclaw: connected ✅ send me a message.");
      log(`[discord] handshake paired channel ${channelId}`);
    }
    // else silent (no oracle)
  }

  return {
    async start() {
      gateway = new DiscordGateway({
        token: opts.token,
        wsFactory: opts.wsFactory,
        log,
        onMessage: (msg) =>
          void handleMessage(msg).catch((err) =>
            log(`[discord] handle error: ${(err         ).message}`),
          ),
      });
      gateway.connect();
      log("[discord] gateway connecting");
    },
    stop() {
      gateway?.stop();
      // Shared AgentService shutdown is owned by BridgeController.stop()
      // (audit rev-2 fix #1) — one agent stopping must not kill the others.
    },
    status: () => gateway?.status() ?? "idle",
  };
}
