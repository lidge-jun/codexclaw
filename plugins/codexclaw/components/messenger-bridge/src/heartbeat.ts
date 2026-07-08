/**
 * heartbeat.ts — per-agent periodic tasks (slice 70).
 *
 * One MASTER interval; every tick reads the agents table fresh and runs an
 * agent's heartbeat prompt through the SHARED AgentService when every gate
 * holds — the gates fail CLOSED because this is an autonomous token-spending
 * loop: enabled · minutes>0 · prompt non-empty · auto_send on (off = the result
 * would go nowhere, so no run at all) · ≥1 paired chat · due by wall clock ·
 * target binding not mid-turn. Replies containing HEARTBEAT_OK (or starting
 * with [SILENT]) are recorded in jobs but never forwarded — cli-jaw's
 * heartbeat convention.
 */
import type { AgentRow, BridgeDb } from "./db.ts";
import type { AgentService } from "./agent-service.ts";
import { TelegramApi } from "./telegram-api.ts";
import { markdownToTelegramHtml, chunkTelegramMessage, stripTelegramHtml } from "./telegram-format.ts";
import { DiscordApi, chunkDiscordMessage } from "./discord-api.ts";

export type HeartbeatSend = (agent: AgentRow, chatId: string, text: string) => Promise<void>;

export interface HeartbeatSchedulerOptions {
  db: BridgeDb;
  /** Shared AgentService accessor (BridgeController.service()). */
  service: () => AgentService;
  workdir: string;
  log?: (line: string) => void;
  /** Master tick period (default 60s). */
  tickMs?: number;
  now?: () => number;
  /** Result forwarder; defaults to the real messenger APIs. */
  send?: HeartbeatSend;
}

const DEFAULT_TICK_MS = 60_000;
const SILENT_RE = /HEARTBEAT_OK/;
const DISCORD_THREAD_IDLE_MS = 24 * 60 * 60 * 1000;

/** Default forwarder: same rendering the adapters use. */
async function defaultSend(agent: AgentRow, chatId: string, text: string): Promise<void> {
  if (agent.kind === "telegram") {
    const api = new TelegramApi(agent.token);
    const html = markdownToTelegramHtml(text);
    for (const chunk of chunkTelegramMessage(html)) {
      const sent = await api.sendMessage({ chatId, text: chunk, parseMode: "HTML" });
      if (!sent.ok) await api.sendMessage({ chatId, text: stripTelegramHtml(chunk) });
    }
    return;
  }
  const api = new DiscordApi(agent.token);
  for (const chunk of chunkDiscordMessage(text)) {
    await api.sendMessage(chatId, chunk);
  }
}

export class HeartbeatScheduler {
  private opts: HeartbeatSchedulerOptions;
  private log: (line: string) => void;
  private now: () => number;
  private send: HeartbeatSend;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRun = new Map<number, number>();
  private inFlight = new Set<number>();

  constructor(opts: HeartbeatSchedulerOptions) {
    this.opts = opts;
    this.log = opts.log ?? (() => {});
    this.now = opts.now ?? Date.now;
    this.send = opts.send ?? defaultSend;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.opts.tickMs ?? DEFAULT_TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One master tick: evaluate every agent's gates; run the due ones. */
  async tick(): Promise<void> {
    let agents: AgentRow[];
    try {
      agents = this.opts.db.listAgents();
    } catch (err) {
      // Racing a shutdown's db.close() — drop the tick, never crash serve.
      this.log(`[heartbeat] tick skipped: ${(err as Error).message}`);
      return;
    }
    for (const agent of agents) {
      try {
        await this.tickAgent(agent);
      } catch (err) {
        this.log(`[heartbeat] ${agent.name}: ${(err as Error).message}`);
      }
    }
  }

  private async tickAgent(agent: AgentRow): Promise<void> {
    const { db } = this.opts;
    if (agent.enabled !== 1) return;
    if (agent.heartbeat_minutes <= 0) return;
    if (agent.heartbeat_prompt.trim().length === 0) return;
    if (agent.auto_send !== 1) return; // result would go nowhere — skip the spend
    if (this.inFlight.has(agent.id)) return;
    if (agent.full_access !== 1) {
      // Heartbeats are autonomous; without full access there is no live user turn
      // to approve, so skip instead of creating an invisible pending approval.
      this.log(`[heartbeat] ${agent.name}: approval required — skipped`);
      return;
    }

    const paired = db.listAgentAllowlist(agent.id);
    if (paired.length === 0) return;
    const chatId = paired[0].chat_id;

    const last = this.lastRun.get(agent.id) ?? 0;
    if (this.now() - last < agent.heartbeat_minutes * 60_000) return;

    // Skip-if-busy: no read-only getter exists; a missing row is created idle
    // by design (plan rev-2 fix #4).
    const binding = db.getOrCreateAgentBinding(agent.id, agent.kind, chatId, this.opts.workdir);
    if (binding.status === "running") {
      this.log(`[heartbeat] ${agent.name}: busy — skipped`);
      return;
    }

    this.lastRun.set(agent.id, this.now());
    this.inFlight.add(agent.id);
    try {
      const result = await this.opts.service().handleIncoming({
        kind: agent.kind,
        chatId,
        text: agent.heartbeat_prompt,
        workdir: this.opts.workdir,
        agentId: agent.id,
      });
      if (!result.ok) {
        this.log(`[heartbeat] ${agent.name}: turn failed — ${result.error ?? "unknown"}`);
        return;
      }
      const text = (result.text ?? "").trim();
      if (!text || SILENT_RE.test(text) || text.startsWith("[SILENT]")) {
        this.log(`[heartbeat] ${agent.name}: silent`);
        return; // recorded in jobs, never forwarded
      }
      for (const entry of paired) {
        await this.send(agent, entry.chat_id, text);
      }
      this.log(`[heartbeat] ${agent.name}: forwarded to ${paired.length} chat(s) ${text.slice(0, 60)}`);
    } finally {
      this.inFlight.delete(agent.id);
    }
  }
}

export interface DiscordThreadSweepOptions {
  db: BridgeDb;
  log?: (line: string) => void;
  tickMs?: number;
  idleMs?: number;
  now?: () => number;
  apiFactory?: (token: string) => Pick<DiscordApi, "archiveThread">;
}

export class DiscordThreadSweepScheduler {
  private opts: DiscordThreadSweepOptions;
  private log: (line: string) => void;
  private now: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;

  constructor(opts: DiscordThreadSweepOptions) {
    this.opts = opts;
    this.log = opts.log ?? (() => {});
    this.now = opts.now ?? Date.now;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.opts.tickMs ?? DEFAULT_TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const cutoff = new Date(this.now() - (this.opts.idleMs ?? DISCORD_THREAD_IDLE_MS)).toISOString();
      const rows = this.opts.db.listIdleDiscordTaskThreadBindings(cutoff);
      for (const binding of rows) {
        await this.sweepBinding(binding.id);
      }
    } catch (err) {
      this.log(`[discord-sweep] tick skipped: ${(err as Error).message}`);
    } finally {
      this.inFlight = false;
    }
  }

  private async sweepBinding(bindingId: number): Promise<void> {
    const binding = this.opts.db.getBinding(bindingId);
    if (!binding) return;
    if (binding.status === "running") return;
    // CAS reservation: a turn starting between the idle listing and the archive
    // REST call must win. 'sweeping' rows are re-listed next tick if we abort.
    if (!this.opts.db.reserveBindingForSweep(binding.id)) return;
    const token = binding.agent_id === null
      ? (this.opts.db.getChannel("discord")?.token ?? "")
      : (this.opts.db.getAgent(binding.agent_id)?.token ?? "");
    if (token) {
      const api = this.opts.apiFactory ? this.opts.apiFactory(token) : new DiscordApi(token);
      const archived = await api.archiveThread(binding.chat_id);
      if (!archived.ok) this.log(`[discord-sweep] archive failed ${binding.chat_id}: ${archived.error ?? archived.status}`);
      // A turn may have grabbed the binding while the REST call was in flight:
      // compensate by unarchiving so the running turn can keep replying.
      const during = this.opts.db.getBinding(binding.id);
      if (during && during.status === "running") {
        const restored = await api.archiveThread(binding.chat_id, false);
        if (!restored.ok) this.log(`[discord-sweep] unarchive compensation failed ${binding.chat_id}: ${restored.error ?? restored.status}`);
        return;
      }
    }
    const fresh = this.opts.db.getBinding(binding.id);
    if (!fresh || fresh.status === "running") return;
    this.opts.db.deleteBindingCascade(fresh.id);
    if (fresh.agent_id === null) this.opts.db.removeAllowlist("discord", fresh.chat_id);
    else this.opts.db.removeAgentAllowlist(fresh.agent_id, fresh.chat_id);
    this.log(`[discord-sweep] cleaned idle task thread ${fresh.chat_id}`);
  }
}
