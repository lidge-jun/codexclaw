/**
 * bridge-controller.ts — owns the live messenger adapter lifecycle (Phase 5).
 *
 * cxc serve creates one controller. It starts the active channel's adapter on
 * boot and lets the connect API reload it when the active channel or its token
 * changes — without restarting the whole server. It also tracks handshake
 * pairing so the connect wizard can poll for "a chat pressed /start".
 */
import type { BridgeDb, ChannelKind } from "./db.ts";
import { AgentService } from "./agent-service.ts";
import { createTelegramAdapter } from "./telegram-adapter.ts";
import { createDiscordAdapter } from "./discord-adapter.ts";
import type { FetchImpl as TgFetch } from "./telegram-api.ts";
import type { FetchImpl as DcFetch } from "./discord-api.ts";
import type { WsFactory } from "./discord-gateway.ts";

interface ChannelAdapter {
  start: () => Promise<void>;
  stop: () => void;
  status: () => string;
}

export interface BridgeControllerOptions {
  db: BridgeDb;
  workdir: string;
  log?: (line: string) => void;
  codexBin?: string;
  // Injectable transports for tests (default to real fetch/WebSocket).
  telegramFetch?: TgFetch;
  discordFetch?: DcFetch;
  discordWsFactory?: WsFactory;
}

export interface HandshakeState {
  open: boolean;
  pairedChatId: string | null;
}

export class BridgeController {
  private opts: BridgeControllerOptions;
  private db: BridgeDb;
  private log: (line: string) => void;
  private adapter: ChannelAdapter | null = null;
  private adapterKind: ChannelKind | null = null;
  private agentService: AgentService | null = null;
  private allowlistBaseline = new Map<ChannelKind, number>();

  constructor(opts: BridgeControllerOptions) {
    this.opts = opts;
    this.db = opts.db;
    this.log = opts.log ?? (() => {});
  }

  activeKind(): ChannelKind | null {
    return this.adapterKind;
  }

  adapterStatus(): string {
    return this.adapter?.status() ?? "stopped";
  }

  /** Stop any running adapter and start the one for the active channel. */
  async reload(): Promise<void> {
    this.stop();
    const active = this.db.getActiveChannel();
    if (!active?.token) {
      this.log("[bridge] no active channel with a token — idle");
      return;
    }
    this.agentService = new AgentService({ db: this.db, codexBin: this.opts.codexBin });
    if (active.kind === "telegram") {
      this.adapter = createTelegramAdapter({
        db: this.db,
        token: active.token,
        workdir: this.opts.workdir,
        agentService: this.agentService,
        fetchImpl: this.opts.telegramFetch,
        log: this.log,
      });
    } else {
      this.adapter = createDiscordAdapter({
        db: this.db,
        token: active.token,
        workdir: this.opts.workdir,
        agentService: this.agentService,
        fetchImpl: this.opts.discordFetch,
        wsFactory: this.opts.discordWsFactory,
        log: this.log,
      });
    }
    this.adapterKind = active.kind;
    await this.adapter.start();
    this.log(`[bridge] ${active.kind} adapter started`);
  }

  stop(): void {
    this.adapter?.stop();
    this.adapter = null;
    this.adapterKind = null;
    this.agentService = null;
  }

  /** Open a pairing window and snapshot the allowlist so we can detect a new pair. */
  openHandshake(kind: ChannelKind, seconds: number): void {
    this.allowlistBaseline.set(kind, this.db.listAllowlist(kind).length);
    this.db.openHandshake(kind, seconds);
  }

  handshakeState(kind: ChannelKind): HandshakeState {
    const open = this.db.isHandshakeOpen(kind);
    const baseline = this.allowlistBaseline.get(kind) ?? 0;
    const current = this.db.listAllowlist(kind);
    const paired = current.length > baseline ? (current[current.length - 1]?.chat_id ?? null) : null;
    if (paired) {
      // One-shot: close the window once a pair lands.
      this.db.closeHandshake(kind);
      this.allowlistBaseline.set(kind, current.length);
    }
    return { open: open && !paired, pairedChatId: paired };
  }
}
