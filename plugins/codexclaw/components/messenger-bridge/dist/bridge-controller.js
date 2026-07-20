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

import { AgentService } from "./agent-service.js";
import { createTelegramAdapter } from "./telegram-adapter.js";
import { createDiscordAdapter } from "./discord-adapter.js";
import { TelegramApi,                           } from "./telegram-api.js";


import { EventLog,                  } from "./event-log.js";
import { BridgeMetrics,                      } from "./metrics.js";
import {
  createWebhookHandler,
  registerWebhook,
  safeEqual,
  telegramWebhookSecretFromUrl,

} from "./telegram-webhook.js";











































export class BridgeController {
          opts                         ;
          db          ;
          log                        ;
          metrics = new BridgeMetrics();
          events          ;
          adapters = new Map                        ();
          agentService                      = null;
  // Per-agent pairing baselines for the legacy polling wizard.
          allowlistBaseline = new Map                ();
  // Serializes reload(): two concurrent API calls must not interleave the
  // stop/start diff (Map corruption, double-started pollers).
          reloadChain                = Promise.resolve();

  constructor(opts                         ) {
    this.opts = opts;
    this.db = opts.db;
    this.log = opts.log ?? (() => {});
    this.events = new EventLog({ path: join(opts.workdir, ".codexclaw", "bridge-events.jsonl") });
  }

  /** Shared AgentService accessor (heartbeat scheduler rides the same queues
   *  and child registry). Created lazily, same instance reload() uses. */
  service()               {
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

  metricsSnapshot()                  {
    return this.metrics.snapshot();
  }

  recentEvents(n        )                {
    return this.events.recent(Math.max(0, Math.min(n, 200)));
  }

  /** Legacy shim: kind of the first running adapter (insertion order), or null. */
  activeKind()                     {
    for (const entry of this.adapters.values()) return entry.kind;
    return null;
  }

  /** Legacy shim: single adapter → its own status; several → a count summary. */
  adapterStatus()         {
    const entries = [...this.adapters.values()];
    if (entries.length === 0) return "stopped";
    if (entries.length === 1) return entries[0].adapter.status();
    return `${entries.length} running`;
  }

  /** Per-agent status list (slice-60 GUI surface). */
  agentStatuses()                {
    return [...this.adapters.entries()].map(([agentId, entry]) => ({
      agentId,
      name: entry.name,
      kind: entry.kind,
      status: entry.adapter.status(),
    }));
  }

  /** Diff-based reload, serialized: concurrent calls queue behind each other. */
  reload()                {
    const run = this.reloadChain.then(() => this.doReload());
    this.reloadChain = run.catch(() => {}); // keep the chain alive on failure
    return run;
  }

  /** Desired = enabled agents with tokens (unique token per kind — a duplicate
   *  would 409-fight its twin on the same bot). */
          async doReload()                {
    this.recordLifecycle("reload");
    if (!this.agentService) {
      this.agentService = new AgentService({
        db: this.db,
        codexBin: this.opts.codexBin,
        metrics: this.metrics,
        events: this.events,
      });
    }
    const desired = new Map                  ();
    const seenTokens = new Set        ();
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
        await entry.adapter.drain();
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

          async buildAdapterEntry(agent          )                          {
    if (agent.kind === "telegram") {
      const webhookUrl = agent.webhook_url.trim();
      if (webhookUrl) {
        const api = new TelegramApi(agent.token, this.opts.telegramFetch);
        const secret = telegramWebhookSecretFromUrl(webhookUrl);
        if (secret) {
          try {
            await registerWebhook(api, webhookUrl, secret);
            const botUsername = await fetchTelegramBotUsername(api, agent.name, this.log);
            const webhookHandler = createWebhookHandler({
              api,
              db: this.db,
              agentService: this.agentService                ,
              secretToken: secret,
              agentId: agent.id,
              workdir: this.opts.workdir,
              botUsername,
              log: this.log,
            });
            return {
              adapter: createWebhookAdapter(() => webhookHandler.cleanup()),
              kind: agent.kind,
              token: agent.token,
              name: agent.name,
              mode: "webhook",
              webhookUrl,
              webhookSecret: secret,
              webhookHandler,
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
          agentService: this.agentService                ,
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
        agentService: this.agentService                ,
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

  async handleTelegramWebhook(secret        , req                 , res                )                   {
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

  async stop()                {
    const entries = [...this.adapters.values()];
    for (const entry of entries) {
      entry.adapter.stop();
      this.recordLifecycle("stop", `${entry.kind}:${entry.name}`);
    }
    this.adapters.clear();
    // Close queues and terminate children only after every ingress is closed.
    this.agentService?.shutdown();
    await Promise.allSettled(entries.map((entry) => entry.adapter.drain()));
    this.agentService = null;
  }

          recordLifecycle(action                             , detail         )       {
    const payload = detail === undefined ? { action } : { action, detail };
    this.events.log({ type: "lifecycle", payload, ts: new Date().toISOString() });
  }

          recordError(agentId               , message        )       {
    this.metrics.recordError(agentId);
    this.events.log({ type: "error", agentId, message, ts: new Date().toISOString() });
  }

  /** First enabled agent of a kind — target of the legacy per-kind shims. */
          firstAgentOfKind(kind             )                  {
    const agents = this.db.listAgents().filter((a) => a.kind === kind);
    return agents.find((a) => a.enabled === 1) ?? agents[0] ?? null;
  }

  /** Legacy shim: open a pairing window on the kind's first agent. */
  openHandshake(kind             , seconds        )       {
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
  handshakeState(kind             )                 {
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

function createWebhookAdapter(cleanup                     )                 {
  let running = false;
  let cleanupPromise                       = null;
  return {
    async start() {
      running = true;
    },
    stop() {
      running = false;
      cleanupPromise ??= cleanup();
      void cleanupPromise;
    },
    async drain(timeoutMs = 3_000) {
      cleanupPromise ??= cleanup();
      let timer                                           ;
      await Promise.race([cleanupPromise, new Promise      ((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      })]);
      if (timer) clearTimeout(timer);
    },
    status: () => (running ? "webhook" : "stopped"),
  };
}

async function fetchTelegramBotUsername(
  api             ,
  agentName        ,
  log                        ,
)                         {
  try {
    const me = await api.getMe();
    if (me.ok) return me.result?.username ?? null;
    log(`[bridge] telegram webhook getMe failed for ${agentName}: ${me.description ?? me.error_code ?? "unknown"}`);
    return null;
  } catch (err) {
    log(`[bridge] telegram webhook getMe failed for ${agentName}: ${(err         ).message}`);
    return null;
  }
}
