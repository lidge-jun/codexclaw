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

import { AgentService } from "./agent-service.js";
import { createTelegramAdapter } from "./telegram-adapter.js";
import { createDiscordAdapter } from "./discord-adapter.js";








































export class BridgeController {
          opts                         ;
          db          ;
          log                        ;
          adapters = new Map                        ();
          agentService                      = null;
  // Per-agent pairing baselines for the legacy polling wizard.
          allowlistBaseline = new Map                ();

  constructor(opts                         ) {
    this.opts = opts;
    this.db = opts.db;
    this.log = opts.log ?? (() => {});
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

  /** Diff-based reload: desired = enabled agents with tokens (unique token per
   *  kind — a duplicate would 409-fight its twin on the same bot). */
  async reload()                {
    if (!this.agentService) {
      this.agentService = new AgentService({ db: this.db, codexBin: this.opts.codexBin });
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
      if (!want || want.kind !== entry.kind || want.token !== entry.token) {
        entry.adapter.stop();
        this.adapters.delete(id);
        this.log(`[bridge] stopped adapter for agent ${entry.name}`);
      }
    }

    // Start missing adapters (sequential — deterministic logs).
    for (const [id, agent] of desired) {
      if (this.adapters.has(id)) continue;
      const adapter                 =
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

  stop()       {
    for (const entry of this.adapters.values()) entry.adapter.stop();
    this.adapters.clear();
    // Shared-service shutdown lives here, not in any adapter (rev-2 fix #1).
    this.agentService?.shutdown();
    this.agentService = null;
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
