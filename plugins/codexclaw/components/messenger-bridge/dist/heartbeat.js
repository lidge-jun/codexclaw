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


import { TelegramApi } from "./telegram-api.js";
import { markdownToTelegramHtml, chunkTelegramMessage, stripTelegramHtml } from "./telegram-format.js";
import { DiscordApi, chunkDiscordMessage } from "./discord-api.js";
















const DEFAULT_TICK_MS = 60_000;
const SILENT_RE = /HEARTBEAT_OK/;

/** Default forwarder: same rendering the adapters use. */
async function defaultSend(agent          , chatId        , text        )                {
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
          opts                           ;
          log                        ;
          now              ;
          send               ;
          timer                                        = null;
          lastRun = new Map                ();
          inFlight = new Set        ();

  constructor(opts                           ) {
    this.opts = opts;
    this.log = opts.log ?? (() => {});
    this.now = opts.now ?? Date.now;
    this.send = opts.send ?? defaultSend;
  }

  start()       {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.opts.tickMs ?? DEFAULT_TICK_MS);
    this.timer.unref?.();
  }

  stop()       {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One master tick: evaluate every agent's gates; run the due ones. */
  async tick()                {
    let agents            ;
    try {
      agents = this.opts.db.listAgents();
    } catch (err) {
      // Racing a shutdown's db.close() — drop the tick, never crash serve.
      this.log(`[heartbeat] tick skipped: ${(err         ).message}`);
      return;
    }
    for (const agent of agents) {
      try {
        await this.tickAgent(agent);
      } catch (err) {
        this.log(`[heartbeat] ${agent.name}: ${(err         ).message}`);
      }
    }
  }

          async tickAgent(agent          )                {
    const { db } = this.opts;
    if (agent.enabled !== 1) return;
    if (agent.heartbeat_minutes <= 0) return;
    if (agent.heartbeat_prompt.trim().length === 0) return;
    if (agent.auto_send !== 1) return; // result would go nowhere — skip the spend
    if (this.inFlight.has(agent.id)) return;

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
      await this.send(agent, chatId, text);
      this.log(`[heartbeat] ${agent.name}: forwarded ${text.slice(0, 60)}`);
    } finally {
      this.inFlight.delete(agent.id);
    }
  }
}
