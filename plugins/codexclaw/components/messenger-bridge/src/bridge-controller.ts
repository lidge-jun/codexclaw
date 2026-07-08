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
import { join } from "node:path";
import type { AgentRow, BridgeDb, ChannelKind } from "./db.ts";
import { AgentService } from "./agent-service.ts";
import { createTelegramAdapter } from "./telegram-adapter.ts";
import { createDiscordAdapter } from "./discord-adapter.ts";
import { TelegramApi, type FetchImpl as TgFetch } from "./telegram-api.ts";
import type { FetchImpl as DcFetch } from "./discord-api.ts";
import type { WsFactory } from "./discord-gateway.ts";
import { EventLog, type BridgeEvent } from "./event-log.ts";
import { BridgeMetrics, type MetricsSnapshot } from "./metrics.ts";
import {
  createWebhookHandler,
  registerWebhook,
  safeEqual,
  telegramWebhookSecretFromUrl,
  type TelegramWebhookHandler,
} from "./telegram-webhook.ts";
import type { IncomingMessage, ServerResponse } from "node:http";

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
  mode: "poll" | "webhook";
  webhookUrl: string;
  webhookSecret?: string;
  webhookHandler?: TelegramWebhookHandler;
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
  private metrics = new BridgeMetrics();
  private events: EventLog;
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
    this.events = new EventLog({ path: join(opts.workdir, ".codexclaw", "bridge-events.jsonl") });
  }

  /** Shared AgentService accessor (heartbeat scheduler rides the same queues
   *  and child registry). Created lazily, same instance reload() uses. */
  service(): AgentService {
    if (!this.agentService) {
      this.agentService = new AgentService({
        db: this.db,
        codexBin: this.opts.codexBin,
        metrics: this.metrics,
        events: this.events,
      });
    }
    return this.agentService;
  }

  metricsSnapshot(): MetricsSnapshot {
    return this.metrics.snapshot();
  }

  recentEvents(n: number): BridgeEvent[] {
    return this.events.recent(Math.max(0, Math.min(n, 200)));
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
    this.recordLifecycle("reload");
    if (!this.agentService) {
      this.agentService = new AgentService({
        db: this.db,
        codexBin: this.opts.codexBin,
        metrics: this.metrics,
        events: this.events,
      });
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
      const wantWebhookUrl = want?.kind === "telegram" ? want.webhook_url : "";
      if (!want || want.kind !== entry.kind || want.token !== entry.token || wantWebhookUrl !== entry.webhookUrl) {
        entry.adapter.stop();
        this.adapters.delete(id);
        this.recordLifecycle("stop", `${entry.kind}:${entry.name}`);
        this.log(`[bridge] stopped adapter for agent ${entry.name}`);
      }
    }

    // Start missing adapters (sequential — deterministic logs).
    for (const [id, agent] of desired) {
      if (this.adapters.has(id)) continue;
      const entry = await this.buildAdapterEntry(agent);
      this.adapters.set(id, entry);
      try {
        await entry.adapter.start();
      } catch (err) {
        this.adapters.delete(id);
        this.recordError(id, err instanceof Error ? err.message : String(err));
        throw err;
      }
      this.recordLifecycle("start", `${agent.kind}:${agent.name}`);
      this.log(`[bridge] ${agent.kind} adapter started for agent ${agent.name}`);
    }

    if (this.adapters.size === 0) {
      this.log("[bridge] no enabled agent with a token — idle");
    }
  }

  private async buildAdapterEntry(agent: AgentRow): Promise<RunningAdapter> {
    if (agent.kind === "telegram") {
      const webhookUrl = agent.webhook_url.trim();
      if (webhookUrl) {
        const api = new TelegramApi(agent.token, this.opts.telegramFetch);
        const secret = telegramWebhookSecretFromUrl(webhookUrl);
        if (secret) {
          try {
            await registerWebhook(api, webhookUrl, secret);
            const botUsername = await fetchTelegramBotUsername(api, agent.name, this.log);
            return {
              adapter: createWebhookAdapter(),
              kind: agent.kind,
              token: agent.token,
              name: agent.name,
              mode: "webhook",
              webhookUrl,
              webhookSecret: secret,
              webhookHandler: createWebhookHandler({
                api,
                db: this.db,
                agentService: this.agentService as AgentService,
                secretToken: secret,
                agentId: agent.id,
                workdir: this.opts.workdir,
                botUsername,
                log: this.log,
              }),
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await api.deleteWebhook(false);
            this.recordLifecycle("reload", `webhook registration failed for ${agent.name}; falling back to long-poll`);
            this.recordError(agent.id, message);
            this.log(`[bridge] telegram webhook registration failed for ${agent.name}: ${message}; falling back to long-poll`);
          }
        } else {
          const message = `invalid telegram webhook URL for ${agent.name}`;
          this.recordLifecycle("reload", `${message}; falling back to long-poll`);
          this.recordError(agent.id, message);
          this.log(`[bridge] ${message}; falling back to long-poll`);
        }
      }
      return {
        adapter: createTelegramAdapter({
          db: this.db,
          token: agent.token,
          workdir: this.opts.workdir,
          agentService: this.agentService as AgentService,
          agent: { id: agent.id },
          fetchImpl: this.opts.telegramFetch,
          log: this.log,
          deleteWebhookDropPending: webhookUrl ? false : undefined,
        }),
        kind: agent.kind,
        token: agent.token,
        name: agent.name,
        mode: "poll",
        webhookUrl,
      };
    }

    return {
      adapter: createDiscordAdapter({
        db: this.db,
        token: agent.token,
        workdir: this.opts.workdir,
        agentService: this.agentService as AgentService,
        agent: { id: agent.id },
        fetchImpl: this.opts.discordFetch,
        wsFactory: this.opts.discordWsFactory,
        log: this.log,
      }),
      kind: agent.kind,
      token: agent.token,
      name: agent.name,
      mode: "poll",
      webhookUrl: "",
    };
  }

  async handleTelegramWebhook(secret: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    for (const entry of this.adapters.values()) {
      // Constant-time path-secret gate: a naive !== here would be a timing
      // oracle in front of the handler's own timingSafeEqual checks.
      if (entry.kind !== "telegram" || entry.mode !== "webhook") continue;
      if (!safeEqual(secret, entry.webhookSecret ?? "")) continue;
      await entry.webhookHandler?.(req, res);
      return true;
    }
    return false;
  }

  stop(): void {
    for (const entry of this.adapters.values()) {
      entry.adapter.stop();
      this.recordLifecycle("stop", `${entry.kind}:${entry.name}`);
    }
    this.adapters.clear();
    // Shared-service shutdown lives here, not in any adapter (rev-2 fix #1).
    this.agentService?.shutdown();
    this.agentService = null;
  }

  private recordLifecycle(action: "start" | "stop" | "reload", detail?: string): void {
    const payload = detail === undefined ? { action } : { action, detail };
    this.events.log({ type: "lifecycle", payload, ts: new Date().toISOString() });
  }

  private recordError(agentId: number | null, message: string): void {
    this.metrics.recordError(agentId);
    this.events.log({ type: "error", agentId, message, ts: new Date().toISOString() });
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

function createWebhookAdapter(): ChannelAdapter {
  let running = false;
  return {
    async start() {
      running = true;
    },
    stop() {
      running = false;
    },
    status: () => (running ? "webhook" : "stopped"),
  };
}

async function fetchTelegramBotUsername(
  api: TelegramApi,
  agentName: string,
  log: (line: string) => void,
): Promise<string | null> {
  try {
    const me = await api.getMe();
    if (me.ok) return me.result?.username ?? null;
    log(`[bridge] telegram webhook getMe failed for ${agentName}: ${me.description ?? me.error_code ?? "unknown"}`);
    return null;
  } catch (err) {
    log(`[bridge] telegram webhook getMe failed for ${agentName}: ${(err as Error).message}`);
    return null;
  }
}
