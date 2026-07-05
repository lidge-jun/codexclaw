 /**
  * rate-limit.ts — shared rate-limit + circuit-breaker utilities (Phase E3).
  *
  * Used by both Telegram and Discord adapters to handle API rate limits (429)
  * and transient failures gracefully.
  */
 
 export interface RateLimitInfo {
   retryAfterMs: number;
 }
 
 /** Extract retry_after from a Telegram 429 response body. */
 export function parseTelegramRateLimit(res: {
   error_code?: number;
   parameters?: { retry_after?: number };
 }): RateLimitInfo | null {
   if (res.error_code !== 429) return null;
   const seconds = res.parameters?.retry_after;
   if (typeof seconds !== "number" || seconds <= 0) return { retryAfterMs: 1000 };
   return { retryAfterMs: seconds * 1000 };
 }
 
 /** Extract rate limit info from Discord response headers. */
 export function parseDiscordRateLimit(status: number, headers: {
   get(name: string): string | null;
 }): RateLimitInfo | null {
   if (status !== 429) {
     const remaining = headers.get("x-ratelimit-remaining");
     if (remaining !== null && Number(remaining) <= 0) {
       const resetAfter = headers.get("x-ratelimit-reset-after");
       const ms = resetAfter ? Number(resetAfter) * 1000 : 1000;
       return { retryAfterMs: ms };
     }
     return null;
   }
   const retryAfter = headers.get("retry-after");
   const ms = retryAfter ? Number(retryAfter) * 1000 : 1000;
   return { retryAfterMs: Number.isFinite(ms) && ms > 0 ? ms : 1000 };
 }
 
 /** Async sleep that respects an AbortSignal. */
 export function rateLimitSleep(ms: number, signal?: AbortSignal): Promise<void> {
   return new Promise((resolve, reject) => {
     if (signal?.aborted) {
       reject(new Error("aborted"));
       return;
     }
     const timer = setTimeout(resolve, ms);
     (timer as { unref?: () => void }).unref?.();
     signal?.addEventListener("abort", () => {
       clearTimeout(timer);
       reject(new Error("aborted"));
     }, { once: true });
   });
 }
 
 export type CircuitState = "closed" | "open" | "half-open";
 
 export interface CircuitBreakerOptions {
   /** Number of consecutive failures before tripping. Default: 5. */
   threshold?: number;
   /** Cooldown in ms before trying again (half-open). Default: 30000. */
   cooldownMs?: number;
   log?: (msg: string) => void;
 }
 
 /**
  * Circuit breaker: trips after N consecutive failures, auto-resets after cooldown.
  * - closed: normal operation
  * - open: tripped, all sends skip
  * - half-open: cooldown elapsed, next call is a test
  */
 export class CircuitBreaker {
   private failures = 0;
   private lastFailure = 0;
   private threshold: number;
   private cooldownMs: number;
   private log: (msg: string) => void;
 
   constructor(opts: CircuitBreakerOptions = {}) {
     this.threshold = opts.threshold ?? 5;
     this.cooldownMs = opts.cooldownMs ?? 30_000;
     this.log = opts.log ?? (() => {});
   }
 
   recordSuccess(): void {
     if (this.failures > 0) {
       this.log("[circuit] recovered — closing");
     }
     this.failures = 0;
   }
 
   recordFailure(): void {
     this.failures += 1;
     this.lastFailure = Date.now();
     if (this.failures >= this.threshold) {
       this.log(`[circuit] tripped after ${this.failures} consecutive failures`);
     }
   }
 
   isOpen(): boolean {
     return this.state() === "open";
   }
 
   state(): CircuitState {
     if (this.failures < this.threshold) return "closed";
     const elapsed = Date.now() - this.lastFailure;
     if (elapsed >= this.cooldownMs) return "half-open";
     return "open";
   }
 }
