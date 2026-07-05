 /**
  * metrics.ts — in-memory bridge metrics collector (Phase E5).
  *
  * Tracks messages received, turns completed, errors, rate limits, and response
  * times. Per-agent breakdown. No persistence (follow-up for SQLite backing).
  */
















 export class BridgeMetrics {
           messages = 0;
           turns = 0;
           errorCount = 0;
           rateLimitsTg = 0;
           rateLimitsDc = 0;
           timings           = [];
           agents = new Map                      ();

           agentEntry(agentId               )                      {
     if (agentId === null) return null;
     let entry = this.agents.get(agentId);
     if (!entry) {
       entry = { messages: 0, turns: 0, errors: 0 };
       this.agents.set(agentId, entry);
     }
     return entry;
   }

   recordMessage(agentId               )       {
     this.messages += 1;
     const a = this.agentEntry(agentId);
     if (a) a.messages += 1;
   }

   recordTurnComplete(agentId               , durationMs        )       {
     this.turns += 1;
     this.timings.push(durationMs);
     // Keep last 1000 timings for rolling average
     if (this.timings.length > 1000) this.timings.shift();
     const a = this.agentEntry(agentId);
     if (a) a.turns += 1;
   }

   recordError(agentId               )       {
     this.errorCount += 1;
     const a = this.agentEntry(agentId);
     if (a) a.errors += 1;
   }

   recordRateLimit(platform                        )       {
     if (platform === "telegram") this.rateLimitsTg += 1;
     else this.rateLimitsDc += 1;
   }

   snapshot()                  {
     const avg =
       this.timings.length > 0
         ? Math.round(this.timings.reduce((s, t) => s + t, 0) / this.timings.length)
         : null;
     const perAgent                               = {};
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
