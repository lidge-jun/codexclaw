 /**
  * metrics.ts — in-memory bridge metrics collector (Phase E5).
  *
  * Tracks messages received, turns completed, errors, rate limits, and response
  * times. Per-agent breakdown. No persistence (follow-up for SQLite backing).
  */
 
 export interface AgentMetrics {
   messages: number;
   turns: number;
   errors: number;
 }
 
 export interface MetricsSnapshot {
   messagesReceived: number;
   turnsCompleted: number;
   errors: number;
   rateLimits: { telegram: number; discord: number };
   avgResponseTimeMs: number | null;
   perAgent: Record<string, AgentMetrics>;
 }
 
 export class BridgeMetrics {
   private messages = 0;
   private turns = 0;
   private errorCount = 0;
   private rateLimitsTg = 0;
   private rateLimitsDc = 0;
   private timings: number[] = [];
   private agents = new Map<number, AgentMetrics>();
 
   private agentEntry(agentId: number | null): AgentMetrics | null {
     if (agentId === null) return null;
     let entry = this.agents.get(agentId);
     if (!entry) {
       entry = { messages: 0, turns: 0, errors: 0 };
       this.agents.set(agentId, entry);
     }
     return entry;
   }
 
   recordMessage(agentId: number | null): void {
     this.messages += 1;
     const a = this.agentEntry(agentId);
     if (a) a.messages += 1;
   }
 
   recordTurnComplete(agentId: number | null, durationMs: number): void {
     this.turns += 1;
     this.timings.push(durationMs);
     // Keep last 1000 timings for rolling average
     if (this.timings.length > 1000) this.timings.shift();
     const a = this.agentEntry(agentId);
     if (a) a.turns += 1;
   }
 
   recordError(agentId: number | null): void {
     this.errorCount += 1;
     const a = this.agentEntry(agentId);
     if (a) a.errors += 1;
   }
 
   recordRateLimit(platform: "telegram" | "discord"): void {
     if (platform === "telegram") this.rateLimitsTg += 1;
     else this.rateLimitsDc += 1;
   }
 
   snapshot(): MetricsSnapshot {
     const avg =
       this.timings.length > 0
         ? Math.round(this.timings.reduce((s, t) => s + t, 0) / this.timings.length)
         : null;
     const perAgent: Record<string, AgentMetrics> = {};
     for (const [id, entry] of this.agents) {
       perAgent[String(id)] = { ...entry };
     }
     return {
       messagesReceived: this.messages,
       turnsCompleted: this.turns,
       errors: this.errorCount,
       rateLimits: { telegram: this.rateLimitsTg, discord: this.rateLimitsDc },
       avgResponseTimeMs: avg,
       perAgent,
     };
   }
 }
