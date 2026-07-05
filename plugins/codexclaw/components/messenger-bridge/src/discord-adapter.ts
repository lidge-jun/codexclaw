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
import type { BridgeDb } from "./db.ts";
import type { AgentService } from "./agent-service.ts";
import {
  DISCORD_EMBED_TOTAL_MAX,
  DISCORD_MAX_MESSAGE,
  DiscordApi,
  chunkDiscordMessage,
  chunkEmbedDescription,
  type DiscordEmbed,
  type FetchImpl,
} from "./discord-api.ts";
import {
  DiscordGateway,
  type DiscordMessageEvent,
  type WsFactory,
} from "./discord-gateway.ts";

export interface DiscordAdapterOptions {
  db: BridgeDb;
  token: string;
  workdir: string;
  agentService: AgentService;
  /** When set, the adapter is scoped to this named agent (v4): per-agent
   *  handshake, allowlist, mention gate, and bindings. Absent = legacy. */
  agent?: { id: number };
  fetchImpl?: FetchImpl;
  wsFactory?: WsFactory;
  log?: (line: string) => void;
}

export interface DiscordAdapter {
  start: () => Promise<void>;
  stop: () => void;
  status: () => string;
}

const START_TRIGGER = "!cxc start";
const CODE_FENCE_RE = /```/;

export function createDiscordAdapter(opts: DiscordAdapterOptions): DiscordAdapter {
  const api = new DiscordApi(opts.token, opts.fetchImpl);
  const log = opts.log ?? (() => {});
  const agentId = opts.agent?.id ?? null;
  let gateway: DiscordGateway | null = null;
  let warnedNoBotId = false;
  // Bounded dedupe of recently-seen message ids — the gateway can redeliver a
  // MESSAGE_CREATE on RESUME, and a full-permission exec must not run twice
  // (security review finding 4).
  const seenIds = new Set<string>();
  const seenOrder: string[] = [];

  const isAllowedChat = (channelId: string) =>
    agentId === null ? opts.db.isAllowed("discord", channelId) : opts.db.isAgentAllowed(agentId, channelId);
  const isHandshakeOpen = () =>
    agentId === null ? opts.db.isHandshakeOpen("discord") : opts.db.isAgentHandshakeOpen(agentId);
  const admitChannel = (channelId: string) => {
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

  function alreadySeen(id: string): boolean {
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
  function gateAndStripMention(msg: DiscordMessageEvent, text: string): string | null {
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

  function splitEmbedReply(text: string): { summary: string; body: string } {
    const firstFence = text.indexOf("```");
    const beforeFence = text.slice(0, firstFence).trim();
    const firstParagraph = beforeFence.split(/\n\s*\n/, 1)[0]?.trim() ?? "";
    const summarySource =
      firstParagraph.length <= DISCORD_MAX_MESSAGE ? firstParagraph : beforeFence.slice(0, 200).trim();
    const summary = (summarySource || "codexclaw output").slice(0, DISCORD_MAX_MESSAGE);
    const bodyStart = text.startsWith(summary) ? summary.length : firstFence;
    const body = text.slice(bodyStart).trim();
    return { summary, body };
  }

  function embedBatches(descriptions: string[]): DiscordEmbed[][] {
    const batches: DiscordEmbed[][] = [];
    let batch: DiscordEmbed[] = [];
    let total = 0;
    for (const description of descriptions) {
      if (batch.length > 0 && (batch.length >= 10 || total + description.length > DISCORD_EMBED_TOTAL_MAX)) {
        batches.push(batch);
        batch = [];
        total = 0;
      }
      batch.push({ description });
      total += description.length;
    }
    if (batch.length > 0) batches.push(batch);
    return batches;
  }

  async function sendCodeFenceEmbedReply(channelId: string, text: string): Promise<boolean> {
    const { summary, body } = splitEmbedReply(text);
    const descriptions = chunkEmbedDescription(body);
    if (descriptions.length === 0) return false;
    for (const [index, embeds] of embedBatches(descriptions).entries()) {
      const sent = await api.sendEmbed(channelId, index === 0 ? summary : "", embeds);
      if (!sent.ok) {
        log(`[discord] embed send failed ${channelId}: ${sent.error ?? sent.status}`);
        return false;
      }
    }
    return true;
  }

  async function handleMessage(msg: DiscordMessageEvent): Promise<void> {
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
      const sentAsEmbed =
        result.text.length > DISCORD_MAX_MESSAGE && CODE_FENCE_RE.test(result.text)
          ? await sendCodeFenceEmbedReply(channelId, result.text)
          : false;
      for (const chunk of sentAsEmbed ? [] : chunkDiscordMessage(result.text)) {
        await api.sendMessage(channelId, chunk);
      }
      log(`[discord] out ${channelId}: ${result.text.slice(0, 60)}`);
    } else {
      await api.sendMessage(channelId, `❌ ${result.error ?? "no response"}`);
    }
  }

  async function handleStart(channelId: string): Promise<void> {
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
            log(`[discord] handle error: ${(err as Error).message}`),
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
