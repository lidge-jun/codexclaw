/**
 * discord-adapter.ts — Discord bridge over the gateway + REST (Phase 4).
 *
 * Same contract as the Telegram adapter: gate each message (own-bot skip →
 * allowlist → non-empty), run it through the Phase 2 AgentService, and reply.
 * Discord has no cheap message-edit status UX like Telegram, so progress is a
 * single typing trigger + the final chunked answer. A `!start` message pairs a
 * channel when a handshake window is open (Discord bots can't see a native
 * /start, so we use a text trigger).
 */
import type { BridgeDb } from "./db.ts";
import type { AgentService } from "./agent-service.ts";
import { DiscordApi, chunkDiscordMessage, type FetchImpl } from "./discord-api.ts";
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

export function createDiscordAdapter(opts: DiscordAdapterOptions): DiscordAdapter {
  const api = new DiscordApi(opts.token, opts.fetchImpl);
  const log = opts.log ?? (() => {});
  let gateway: DiscordGateway | null = null;
  // Bounded dedupe of recently-seen message ids — the gateway can redeliver a
  // MESSAGE_CREATE on RESUME, and a full-permission exec must not run twice
  // (security review finding 4).
  const seenIds = new Set<string>();
  const seenOrder: string[] = [];

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

  async function handleMessage(msg: DiscordMessageEvent): Promise<void> {
    if (msg.isBot) return; // never react to bots (incl. our own echoes)
    if (alreadySeen(msg.id)) return; // duplicate gateway delivery
    const channelId = msg.channelId;
    const text = msg.content.trim();

    if (text === START_TRIGGER) {
      await handleStart(channelId);
      return;
    }
    if (!opts.db.isAllowed("discord", channelId)) return; // silent ignore
    if (!text) return;

    void api.triggerTyping(channelId);
    const result = await opts.agentService.handleIncoming({
      kind: "discord",
      chatId: channelId,
      text,
      workdir: opts.workdir,
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

  async function handleStart(channelId: string): Promise<void> {
    if (opts.db.isAllowed("discord", channelId)) {
      await api.sendMessage(channelId, "codexclaw: already connected ✅");
      return;
    }
    if (opts.db.isHandshakeOpen("discord")) {
      opts.db.addAllowlist("discord", channelId, "");
      // Atomic close on first pair (security review finding 2).
      opts.db.closeHandshake("discord");
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
      opts.agentService.shutdown();
    },
    status: () => gateway?.status() ?? "idle",
  };
}
