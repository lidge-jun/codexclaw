/**
 * discord-gateway.ts — minimal Discord gateway client over global WebSocket (Phase 4).
 *
 * Zero deps (no discord.js). Handles the gateway lifecycle: Hello→heartbeat
 * loop, Identify, READY, MESSAGE_CREATE dispatch, and Reconnect/Invalid-Session
 * recovery (resume vs re-identify). The WebSocket constructor is injectable so
 * tests drive a fake socket with no network.
 *
 * Opcodes + intents pinned to Discord API v10 (verified against
 * discord.com/developers/docs, 2026-07-03).
 */


export const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

export const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
}         ;

// Intents: GUILD_MESSAGES (1<<9) | DIRECT_MESSAGES (1<<12) | MESSAGE_CONTENT (1<<15).
// MESSAGE_CONTENT is privileged — must be enabled in the bot's dev-portal settings.
export const INTENTS = (1 << 9) | (1 << 12) | (1 << 15);







































export class DiscordGateway {
          token        ;
          onMessage                                    ;
          onInteraction                                             ;
          onReady                                                                                      ;
          makeWs           ;
          log                        ;
          jitter              ;

          ws                = null;
          heartbeatTimer                                        = null;
          firstHeartbeatTimer                                       = null;
          connectionGeneration = 0;
          seq                = null;
          sessionId                = null;
          resumeUrl                = null;
          state               = "idle";
          acked = true;
          stopped = false;
          reconnecting = false;
          reconnectAttempts = 0;
          botId                = null;
          appId                = null;

  constructor(opts                       ) {
    this.token = opts.token;
    this.onMessage = opts.onMessage;
    this.onInteraction = opts.onInteraction ?? null;
    this.onReady = opts.onReady ?? null;
    this.makeWs = opts.wsFactory ?? ((url        ) => new WebSocket(url)                     );
    this.log = opts.log ?? (() => {});
    this.jitter = opts.jitter ?? Math.random;
  }

  status()               {
    return this.state;
  }

  /** Bot user id from READY, or null before the first READY. */
  botUserId()                {
    return this.botId;
  }

  /** Discord application id from READY application.id, or null before READY. */
  applicationId()                {
    return this.appId;
  }

  connect(url = GATEWAY_URL)       {
    if (this.stopped) return;
    this.state = this.sessionId ? "resuming" : "connecting";
    const ws = this.makeWs(url);
    const generation = ++this.connectionGeneration;
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      if (this.ws === ws && this.connectionGeneration === generation) this.onWsMessage(ev);
    });
    ws.addEventListener("close", () => this.onWsClose(ws, generation));
    ws.addEventListener("error", () => {
      if (this.ws === ws && this.connectionGeneration === generation) this.log("[discord] ws error");
    });
    // A fresh socket is live; clear the guard set by reconnect().
    this.reconnecting = false;
  }

  stop()       {
    this.stopped = true;
    this.state = "stopped";
    this.clearHeartbeat();
    this.connectionGeneration += 1;
    this.ws?.close(1000);
    this.ws = null;
  }

          clearHeartbeat()       {
    if (this.firstHeartbeatTimer) {
      clearTimeout(this.firstHeartbeatTimer);
      this.firstHeartbeatTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

          sendOp(op        , d         )       {
    this.ws?.send(JSON.stringify({ op, d }));
  }

          startHeartbeat(intervalMs        )       {
    this.clearHeartbeat();
    if (!Number.isFinite(intervalMs) || intervalMs <= 0 || intervalMs > 3_600_000) {
      this.log(`[discord] invalid heartbeat interval ${String(intervalMs)} — reconnecting`);
      void this.reconnect();
      return;
    }
    this.acked = true;
    // First beat after a jittered fraction of the interval (per docs).
    const firstDelay = Math.floor(intervalMs * this.jitter());
    const beat = () => {
      if (!this.acked) {
        // Missed ACK → zombie connection; reconnect.
        this.log("[discord] heartbeat not acked — reconnecting");
        this.reconnect();
        return;
      }
      this.acked = false;
      this.sendOp(OP.HEARTBEAT, this.seq);
    };
    this.firstHeartbeatTimer = setTimeout(() => {
      this.firstHeartbeatTimer = null;
      beat();
      if (this.stopped || this.reconnecting || !this.ws) return;
      this.heartbeatTimer = setInterval(beat, intervalMs);
      this.heartbeatTimer.unref?.();
    }, firstDelay);
    this.firstHeartbeatTimer.unref?.();
  }

          identify()       {
    this.sendOp(OP.IDENTIFY, {
      token: this.token,
      intents: INTENTS,
      properties: { os: "linux", browser: "codexclaw", device: "codexclaw" },
    });
  }

          resume()       {
    this.sendOp(OP.RESUME, {
      token: this.token,
      session_id: this.sessionId,
      seq: this.seq,
    });
  }

          async reconnect()                {
    if (this.stopped || this.reconnecting) return;
    this.reconnecting = true;
    this.clearHeartbeat();
    // Null our ref BEFORE closing so the synchronous close event (fake sockets)
    // sees reconnecting=true and does not re-enter reconnect().
    const old = this.ws;
    this.ws = null;
    try {
      old?.close(4000);
    } catch {
      /* already closed */
    }
    if (this.stopped) return;
    const baseDelayMs = 1000;
    const maxDelayMs = 30000;
    const delayMs = Math.min(baseDelayMs * 2 ** this.reconnectAttempts * this.jitter(), maxDelayMs);
    this.reconnectAttempts += 1;
    if (delayMs > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, delayMs);
        timer.unref?.();
      });
    }
    if (this.stopped) return;
    // Prefer resume if we have a session; connect() picks the state.
    this.connect(this.resumeUrl ?? GATEWAY_URL);
  }

          onWsClose(socket        , generation        )       {
    if (this.ws !== socket || this.connectionGeneration !== generation) return;
    this.clearHeartbeat();
    if (this.stopped || this.reconnecting) return;
    this.log("[discord] ws closed — reconnecting");
    this.reconnect();
  }

          onWsMessage(ev         )       {
    const raw = (ev                      ).data ?? ev;
    let payload                                                                   ;
    try {
      payload = JSON.parse(typeof raw === "string" ? raw : String(raw));
    } catch {
      return;
    }
    if (typeof payload.s === "number") this.seq = payload.s;

    switch (payload.op) {
      case OP.HELLO: {
        const interval = (payload.d                                  ).heartbeat_interval;
        this.startHeartbeat(interval);
        if (this.sessionId) this.resume();
        else this.identify();
        break;
      }
      case OP.HEARTBEAT_ACK:
        this.acked = true;
        break;
      case OP.HEARTBEAT:
        // Server asked for an immediate heartbeat.
        this.sendOp(OP.HEARTBEAT, this.seq);
        break;
      case OP.RECONNECT:
        this.reconnect();
        break;
      case OP.INVALID_SESSION:
        // d=false → session unrecoverable; drop it and re-identify fresh.
        if (payload.d === false) {
          this.sessionId = null;
          this.seq = null;
        }
        this.reconnect();
        break;
      case OP.DISPATCH:
        this.onDispatch(payload.t ?? "", payload.d);
        break;
    }
  }

          onDispatch(type        , d         )       {
    if (type === "READY") {
      const data = d




       ;
      this.sessionId = data.session_id;
      this.resumeUrl = validateDiscordResumeUrl(data.resume_gateway_url);
      this.botId = typeof data.user?.id === "string" ? data.user.id : null;
      // READY application.id is the authoritative application id for slash-command registration.
      this.appId = typeof data.application?.id === "string" ? data.application.id : null;
      this.state = "ready";
      this.reconnectAttempts = 0;
      this.onReady?.({ botUserId: this.botId, applicationId: this.appId });
      this.log("[discord] ready");
      return;
    }
    if (type === "RESUMED") {
      this.state = "ready";
      return;
    }
    if (type === "INTERACTION_CREATE") {
      this.onInteraction?.(d               );
      return;
    }
    if (type === "MESSAGE_CREATE") {
      const m = d













       ;
      this.onMessage({
        id: m.id ?? "",
        content: m.content ?? "",
        channelId: m.channel_id ?? "",
        authorId: m.author?.id ?? "",
        isBot: Boolean(m.author?.bot),
        guildId: m.guild_id ?? null,
        messageReference: m.message_reference ? {
          messageId: m.message_reference.message_id ?? null,
          channelId: m.message_reference.channel_id ?? null,
        } : null,
        attachments: (m.attachments ?? [])
          .filter((attachment) => attachment.url && attachment.filename)
          .map((attachment) => ({
            id: attachment.id ?? "",
            filename: attachment.filename ?? "attachment.bin",
            url: attachment.url ?? "",
            content_type: attachment.content_type,
            size: attachment.size,
          })),
      });
    }
  }
}

/** Accept only Discord-owned WSS resume endpoints before sending a bot token. */
export function validateDiscordResumeUrl(raw                    )                {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "wss:" || url.username || url.password) return null;
    if (host !== "gateway.discord.gg" && !host.endsWith(".discord.gg")) return null;
    if (url.port && url.port !== "443") return null;
    url.search = "?v=10&encoding=json";
    return url.toString();
  } catch {
    return null;
  }
}
