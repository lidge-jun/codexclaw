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
} as const;

// Intents: GUILD_MESSAGES (1<<9) | DIRECT_MESSAGES (1<<12) | MESSAGE_CONTENT (1<<15).
// MESSAGE_CONTENT is privileged — must be enabled in the bot's dev-portal settings.
export const INTENTS = (1 << 9) | (1 << 12) | (1 << 15);

export interface DiscordMessageEvent {
  id: string;
  content: string;
  channelId: string;
  authorId: string;
  isBot: boolean;
  guildId: string | null;
}

export interface WsLike {
  send(data: string): void;
  close(code?: number): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: (ev: unknown) => void): void;
}

export type WsFactory = (url: string) => WsLike;

export interface DiscordGatewayOptions {
  token: string;
  onMessage: (msg: DiscordMessageEvent) => void;
  wsFactory?: WsFactory;
  log?: (line: string) => void;
  now?: () => number;
  jitter?: () => number;
}

type GatewayState = "idle" | "connecting" | "ready" | "resuming" | "stopped";

export class DiscordGateway {
  private token: string;
  private onMessage: (msg: DiscordMessageEvent) => void;
  private makeWs: WsFactory;
  private log: (line: string) => void;
  private jitter: () => number;

  private ws: WsLike | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private seq: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private state: GatewayState = "idle";
  private acked = true;
  private stopped = false;
  private reconnecting = false;

  constructor(opts: DiscordGatewayOptions) {
    this.token = opts.token;
    this.onMessage = opts.onMessage;
    this.makeWs = opts.wsFactory ?? ((url: string) => new WebSocket(url) as unknown as WsLike);
    this.log = opts.log ?? (() => {});
    this.jitter = opts.jitter ?? Math.random;
  }

  status(): GatewayState {
    return this.state;
  }

  connect(url = GATEWAY_URL): void {
    if (this.stopped) return;
    this.state = this.sessionId ? "resuming" : "connecting";
    const ws = this.makeWs(url);
    this.ws = ws;
    ws.addEventListener("message", (ev) => this.onWsMessage(ev));
    ws.addEventListener("close", () => this.onWsClose());
    ws.addEventListener("error", () => this.log("[discord] ws error"));
    // A fresh socket is live; clear the guard set by reconnect().
    this.reconnecting = false;
  }

  stop(): void {
    this.stopped = true;
    this.state = "stopped";
    this.clearHeartbeat();
    this.ws?.close(1000);
    this.ws = null;
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendOp(op: number, d: unknown): void {
    this.ws?.send(JSON.stringify({ op, d }));
  }

  private startHeartbeat(intervalMs: number): void {
    this.clearHeartbeat();
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
    const first = setTimeout(() => {
      beat();
      this.heartbeatTimer = setInterval(beat, intervalMs);
      this.heartbeatTimer.unref?.();
    }, firstDelay);
    first.unref?.();
  }

  private identify(): void {
    this.sendOp(OP.IDENTIFY, {
      token: this.token,
      intents: INTENTS,
      properties: { os: "linux", browser: "codexclaw", device: "codexclaw" },
    });
  }

  private resume(): void {
    this.sendOp(OP.RESUME, {
      token: this.token,
      session_id: this.sessionId,
      seq: this.seq,
    });
  }

  private reconnect(): void {
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
    // Prefer resume if we have a session; connect() picks the state.
    this.connect(this.resumeUrl ?? GATEWAY_URL);
  }

  private onWsClose(): void {
    this.clearHeartbeat();
    if (this.stopped || this.reconnecting) return;
    this.log("[discord] ws closed — reconnecting");
    this.reconnect();
  }

  private onWsMessage(ev: unknown): void {
    const raw = (ev as { data?: unknown }).data ?? ev;
    let payload: { op: number; d?: unknown; s?: number | null; t?: string | null };
    try {
      payload = JSON.parse(typeof raw === "string" ? raw : String(raw));
    } catch {
      return;
    }
    if (typeof payload.s === "number") this.seq = payload.s;

    switch (payload.op) {
      case OP.HELLO: {
        const interval = (payload.d as { heartbeat_interval: number }).heartbeat_interval;
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

  private onDispatch(type: string, d: unknown): void {
    if (type === "READY") {
      const data = d as { session_id: string; resume_gateway_url?: string };
      this.sessionId = data.session_id;
      this.resumeUrl = data.resume_gateway_url
        ? `${data.resume_gateway_url}/?v=10&encoding=json`
        : null;
      this.state = "ready";
      this.log("[discord] ready");
      return;
    }
    if (type === "RESUMED") {
      this.state = "ready";
      return;
    }
    if (type === "MESSAGE_CREATE") {
      const m = d as {
        id?: string;
        content?: string;
        channel_id?: string;
        guild_id?: string;
        author?: { id?: string; bot?: boolean };
      };
      this.onMessage({
        id: m.id ?? "",
        content: m.content ?? "",
        channelId: m.channel_id ?? "",
        authorId: m.author?.id ?? "",
        isBot: Boolean(m.author?.bot),
        guildId: m.guild_id ?? null,
      });
    }
  }
}
