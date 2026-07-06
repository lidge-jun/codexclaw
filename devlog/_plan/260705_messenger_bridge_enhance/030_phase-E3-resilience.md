 # messenger_bridge — Phase E3: Resilience & Rate Limiting
 
 Status: P (plan) · class C2 · zero new runtime deps
 
 ## Loop-spec header
 
 - **Loop archetype:** spec-satisfaction
 - **Goal:** Survive API rate limits and transient failures without data loss.
 - **Non-goals:** Webhook mode, per-user rate limiting (E6).
 - **Verifier:** `npm test` + `npm run build`
 - **Stop condition:** all tests pass, rate-limit + circuit-breaker logic verified
 
 ## Previous cycle (LOOP-CONTINUITY-01)
 
 E2 shipped: slash commands, callback_query, allowed_updates widened. 709/709.
 
 ## Diff-level plan
 
 ### NEW `src/rate-limit.ts`
 
 Shared rate-limit + circuit-breaker utilities (used by both adapters):
 
 ```typescript
 /** Parse Telegram 429 retry_after or Discord X-RateLimit-* headers. */
 export interface RateLimitInfo {
   retryAfterMs: number;
 }
 
 /** Extract retry_after from a Telegram 429 response. */
 export function parseTelegramRateLimit(res: { error_code?: number; parameters?: { retry_after?: number } }): RateLimitInfo | null
 
 /** Extract rate limit info from Discord response headers. */
 export function parseDiscordRateLimit(headers: Record<string, string>): RateLimitInfo | null
 
 /** Circuit breaker: trips after N consecutive failures, auto-resets after cooldown. */
 export class CircuitBreaker {
   constructor(opts: { threshold: number; cooldownMs: number; log?: (msg: string) => void })
   recordSuccess(): void
   recordFailure(): void
   isOpen(): boolean  // true = tripped, should not send
   state(): "closed" | "open" | "half-open"
 }
 
 /** Async sleep respecting an abort signal. */
 export function rateLimitSleep(ms: number, signal?: AbortSignal): Promise<void>
 ```
 
 ### MODIFY `src/telegram-api.ts`
 
 - In `call()`: if response has `error_code === 429`, extract `parameters.retry_after`
   from the JSON body, wait that many seconds, then retry once. Log the backoff.
 - Add `parameters?: { retry_after?: number }` to `TgResponse`.
 
 ### MODIFY `src/discord-api.ts`
 
 - In `call()`: parse `X-RateLimit-Remaining` and `Retry-After` headers from the
   response. If remaining=0 or status=429, wait `Retry-After` seconds then retry once.
   Log the backoff.
 
 ### MODIFY `src/discord-gateway.ts`
 
 - In `reconnect()`: add jittered backoff delay (1s-5s base, 2x exponential, max 30s).
   Currently reconnects instantly — add graduated delay for close codes 4000-4014.
   Reset backoff counter on successful READY.
 
 ### MODIFY `src/telegram-adapter.ts`
 
 - Add CircuitBreaker instance. On send failures (sendMessage/sendRichMessage), record
   failure. On success, record success. If circuit is open, skip send and log warning.
 
 ### MODIFY `src/discord-adapter.ts`
 
 - Add CircuitBreaker instance. Same pattern as Telegram.
 
 ### MODIFY `src/server.ts` (or `src/connect-routes.ts`)
 
 - `/api/health` response: add `circuitBreaker` field with per-adapter state.
 
 ### NEW `test/rate-limit.test.ts`
 
 - CircuitBreaker: trips after N failures, auto-resets after cooldown, half-open on
   first success after cooldown.
 - parseTelegramRateLimit: extracts retry_after from 429 responses.
 - parseDiscordRateLimit: extracts from headers.
 - rateLimitSleep: resolves after delay, aborts on signal.
 
 ## Scope boundary
 
 - **IN:** 429 retry, circuit breaker, Discord reconnect jitter, health endpoint enhancement.
 - **OUT:** Webhook mode, per-user rate limiting, send queues.
