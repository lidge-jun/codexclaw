 # messenger_bridge — Phase E5: Observability & Diagnostics
 
 Status: P (plan) · class C2 · zero new runtime deps
 
 ## Loop-spec header
 
 - **Loop archetype:** spec-satisfaction
 - **Goal:** Production visibility: metrics API, structured event log, health monitoring.
 - **Non-goals:** External webhook notifications, GUI badges (frontend work).
 - **Verifier:** `npm test` + `npm run build`
 
 ## Previous cycle (LOOP-CONTINUITY-01)
 
 E4 shipped: /context, reply-to-context, streaming edits. 722/722.
 
 ## Diff-level plan
 
 ### NEW `src/metrics.ts`
 
 In-memory metrics collector (SQLite-backed persistence is E5+ follow-up):
 
 ```typescript
 export class BridgeMetrics {
   private counters: Map<string, number>
   private timings: number[]  // response times in ms
 
   recordMessage(agentId: number | null): void
   recordTurnComplete(agentId: number | null, durationMs: number): void
   recordError(agentId: number | null): void
   recordRateLimit(platform: "telegram" | "discord"): void
 
   snapshot(): MetricsSnapshot
 }
 
 export interface MetricsSnapshot {
   messagesReceived: number;
   turnsCompleted: number;
   errors: number;
   rateLimits: { telegram: number; discord: number };
   avgResponseTimeMs: number | null;
   perAgent: Map<number, { messages: number; turns: number; errors: number }>;
 }
 ```
 
 ### NEW `src/event-log.ts`
 
 Structured event logger writing to a JSONL file:
 
 ```typescript
 export class EventLog {
   constructor(opts: { path: string; maxSizeBytes?: number; maxFiles?: number })
   log(event: BridgeEvent): void
   recent(n: number): BridgeEvent[]
   close(): void
 }
 
 export type BridgeEvent =
   | { type: "message_received"; agentId: number | null; chatId: string; platform: string; ts: string }
   | { type: "turn_complete"; agentId: number | null; durationMs: number; ts: string }
   | { type: "error"; agentId: number | null; message: string; ts: string }
   | { type: "rate_limit"; platform: string; retryAfterMs: number; ts: string }
   | { type: "reconnect"; platform: string; ts: string }
   | { type: "circuit_breaker"; platform: string; state: string; ts: string }
 ```
 
 Log rotation: when file exceeds maxSizeBytes (default 50MB), rotate to .1, .2 etc (max 3).
 
 ### MODIFY `src/server.ts` (or add routes)
 
 - `/api/metrics` → returns `BridgeMetrics.snapshot()` as JSON
 - `/api/events` → returns `EventLog.recent(50)` as JSON
 - `/api/health` → enhanced with circuit breaker state + metrics summary
 
 ### MODIFY `src/bridge-controller.ts`
 
 - Create BridgeMetrics and EventLog instances in BridgeController constructor.
 - Expose `metrics()` and `eventLog()` accessors.
 - Pass metrics to adapters via options (or controller reference).
 
 ### NEW `test/metrics.test.ts`
 
 - BridgeMetrics: record messages/turns/errors, snapshot returns correct counts,
   avg response time calculation, per-agent breakdown.
 
 ### NEW `test/event-log.test.ts`
 
 - EventLog: writes JSONL, recent() returns last N, rotation triggers at size limit.
 
 ## Scope boundary
 
 - **IN:** BridgeMetrics, EventLog, /api/metrics, /api/events, health enhancement.
 - **OUT:** SQLite-backed metrics persistence, GUI badges, external webhooks.
