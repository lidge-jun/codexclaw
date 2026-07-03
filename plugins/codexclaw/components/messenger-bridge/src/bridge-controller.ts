/**
 * bridge-controller.ts — owns the live messenger adapter lifecycle.
 *
 * v4 (slice 50): agents are the single runtime source of truth. One adapter per
 * ENABLED agent (each agent brings its own bot token), all running concurrently.
 * reload() is diff-based: it stops only adapters whose agent vanished, was
 * disabled, or changed token/kind, and starts the missing ones — enabling agent B
 * never bounces agent A. One AgentService is shared by every adapter; its
 * child-process shutdown is owned HERE (stop()), never by an individual adapter.
 *
 * Legacy compat: the BridgeControllerLike per-kind handshake surface routes to
 * the first enabled agent of that kind, so the pre-agent GUI keeps working.
 */
import type { AgentRow, BridgeDb, ChannelKind } from "./db.ts";
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

interface RunningAdapter {
  adapter: ChannelAdapter;
  kind: ChannelKind;
  token: string;
  name: string;
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

export interface AgentStatus {
  agentId: number;
  name: string;
  kind: ChannelKind;
  status: string;
}

export class BridgeController {
  private opts: BridgeControllerOptions;
  private db: BridgeDb;
  private log: (line: string) => void;
  private adapters = new Map<number, RunningAdapter>();
  private agentService: AgentService | null = null;
  // Per-agent pairing baselines for the legacy polling wizard.
  private allowlistBaseline = new Map<number, number>();
  // Serializes reload(): two concurrent API calls must not interleave the
  // stop/start diff (Map corruption, double-started pollers).
  private reloadChain: Promise<void> = Promise.resolve();

  constructor(opts: BridgeControllerOptions) {
    this.opts = opts;
    this.db = opts.db;
    this.log = opts.log ?? (() => {});
  }

  /** Shared AgentService accessor (heartbeat scheduler rides the same queues
   *  and child registry). Created lazily, same instance reload() uses. */
  service(): AgentService {
    if (!this.agentService) {
      this.agentService = new AgentService({ db: this.db, codexBin: this.opts.codexBin });
    }
    return this.agentService;
  }

  /** Legacy shim: kind of the first running adapter (insertion order), or null. */
  activeKind(): ChannelKind | null {
    for (const entry of this.adapters.values()) return entry.kind;
    return null;
  }

  /** Legacy shim: single adapter → its own status; several → a count summary. */
  adapterStatus(): string {
    const entries = [...this.adapters.values()];
    if (entries.length === 0) return "stopped";
    if (entries.length === 1) return entries[0].adapter.status();
    return `${entries.length} running`;
  }

  /** Per-agent status list (slice-60 GUI surface). */
  agentStatuses(): AgentStatus[] {
    return [...this.adapters.entries()].map(([agentId, entry]) => ({
      agentId,
      name: entry.name,
      kind: entry.kind,
      status: entry.adapter.status(),
    }));
  }

  /** Diff-based reload, serialized: concurrent calls queue behind each other. */
  reload(): Promise<void> {
    const run = this.reloadChain.then(() => this.doReload());
    this.reloadChain = run.catch(() => {}); // keep the chain alive on failure
    return run;
  }

  /** Desired = enabled agents with tokens (unique token per kind — a duplicate
   *  would 409-fight its twin on the same bot). */
  private async doReload(): Promise<void> {
    if (!this.agentService) {
      this.agentService = new AgentService({ db: this.db, codexBin: this.opts.codexBin });
    }
    const desired = new Map<number, AgentRow>();
    const seenTokens = new Set<string>();
    for (const agent of this.db.listAgents()) {
      if (agent.enabled !== 1 || agent.token.length === 0) continue;
      const tokenKey = `${agent.kind}:${agent.token}`;
      if (seenTokens.has(tokenKey)) {
        this.log(`[bridge] agent "${agent.name}" shares a token with a running ${agent.kind} agent — skipped (would 409-fight)`);
        continue;
      }
      seenTokens.add(tokenKey);
      desired.set(agent.id, agent);
    }

    // Stop stale adapters (gone / disabled / token or kind changed).
    for (const [id, entry] of this.adapters) {
      const want = desired.get(id);
      if (!want || want.kind !== entry.kind || want.token !== entry.token) {
        entry.adapter.stop();
        this.adapters.delete(id);
        this.log(`[bridge] stopped adapter for agent ${entry.name}`);
      }
    }

    // Start missing adapters (sequential — deterministic logs).
    for (const [id, agent] of desired) {
      if (this.adapters.has(id)) continue;
      const adapter: ChannelAdapter =
        agent.kind === "telegram"
          ? createTelegramAdapter({
              db: this.db,
              token: agent.token,
              workdir: this.opts.workdir,
              agentService: this.agentService,
              agent: { id },
              fetchImpl: this.opts.telegramFetch,
              log: this.log,
            })
          : createDiscordAdapter({
              db: this.db,
              token: agent.token,
              workdir: this.opts.workdir,
              agentService: this.agentService,
              agent: { id },
              fetchImpl: this.opts.discordFetch,
              wsFactory: this.opts.discordWsFactory,
              log: this.log,
            });
      this.adapters.set(id, { adapter, kind: agent.kind, token: agent.token, name: agent.name });
      await adapter.start();
      this.log(`[bridge] ${agent.kind} adapter started for agent ${agent.name}`);
    }

    if (this.adapters.size === 0) {
      this.log("[bridge] no enabled agent with a token — idle");
    }
  }

  stop(): void {
    for (const entry of this.adapters.values()) entry.adapter.stop();
    this.adapters.clear();
    // Shared-service shutdown lives here, not in any adapter (rev-2 fix #1).
    this.agentService?.shutdown();
    this.agentService = null;
  }

  /** First enabled agent of a kind — target of the legacy per-kind shims. */
  private firstAgentOfKind(kind: ChannelKind): AgentRow | null {
    const agents = this.db.listAgents().filter((a) => a.kind === kind);
    return agents.find((a) => a.enabled === 1) ?? agents[0] ?? null;
  }

  /** Legacy shim: open a pairing window on the kind's first agent. */
  openHandshake(kind: ChannelKind, seconds: number): void {
    const agent = this.firstAgentOfKind(kind);
    if (agent) {
      this.allowlistBaseline.set(agent.id, this.db.listAgentAllowlist(agent.id).length);
      this.db.openAgentHandshake(agent.id, seconds);
      return;
    }
    // No agent of this kind yet — legacy channel window (GUI-only/dev mode).
    this.db.openHandshake(kind, seconds);
  }

  /** Legacy shim: poll pairing state of the kind's first agent. */
  handshakeState(kind: ChannelKind): HandshakeState {
    const agent = this.firstAgentOfKind(kind);
    if (!agent) {
      return { open: this.db.isHandshakeOpen(kind), pairedChatId: null };
    }
    const open = this.db.isAgentHandshakeOpen(agent.id);
    const baseline = this.allowlistBaseline.get(agent.id) ?? 0;
    const current = this.db.listAgentAllowlist(agent.id);
    const paired = current.length > baseline ? (current[current.length - 1]?.chat_id ?? null) : null;
    if (paired) {
      // One-shot: close the window once a pair lands.
      this.db.closeAgentHandshake(agent.id);
      this.allowlistBaseline.set(agent.id, current.length);
    }
    return { open: open && !paired, pairedChatId: paired };
  }
}
