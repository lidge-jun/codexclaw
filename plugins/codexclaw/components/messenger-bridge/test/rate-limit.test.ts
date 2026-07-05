 /** rate-limit.test.ts — circuit breaker + rate-limit parsing (Phase E3). */
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import {
   CircuitBreaker,
   parseTelegramRateLimit,
   parseDiscordRateLimit,
   rateLimitSleep,
 } from "../src/rate-limit.ts";
 
 // ── parseTelegramRateLimit ────────────────────────────────────────────────
 
 test("parseTelegramRateLimit: 429 with retry_after", () => {
   const info = parseTelegramRateLimit({ error_code: 429, parameters: { retry_after: 5 } });
   assert.ok(info);
   assert.equal(info.retryAfterMs, 5000);
 });
 
 test("parseTelegramRateLimit: 429 without retry_after defaults to 1000ms", () => {
   const info = parseTelegramRateLimit({ error_code: 429 });
   assert.ok(info);
   assert.equal(info.retryAfterMs, 1000);
 });
 
 test("parseTelegramRateLimit: non-429 returns null", () => {
   assert.equal(parseTelegramRateLimit({ error_code: 400 }), null);
   assert.equal(parseTelegramRateLimit({}), null);
 });
 
 // ── parseDiscordRateLimit ─────────────────────────────────────────────────
 
 test("parseDiscordRateLimit: 429 with Retry-After header", () => {
   const headers = { get: (name: string) => name === "retry-after" ? "3" : null };
   const info = parseDiscordRateLimit(429, headers);
   assert.ok(info);
   assert.equal(info.retryAfterMs, 3000);
 });
 
 test("parseDiscordRateLimit: remaining=0 with reset-after header", () => {
   const headers = {
     get: (name: string) => {
       if (name === "x-ratelimit-remaining") return "0";
       if (name === "x-ratelimit-reset-after") return "2";
       return null;
     },
   };
   const info = parseDiscordRateLimit(200, headers);
   assert.ok(info);
   assert.equal(info.retryAfterMs, 2000);
 });
 
 test("parseDiscordRateLimit: normal response returns null", () => {
   const headers = { get: () => null };
   assert.equal(parseDiscordRateLimit(200, headers), null);
 });
 
 // ── CircuitBreaker ────────────────────────────────────────────────────────
 
 test("CircuitBreaker: starts closed", () => {
   const cb = new CircuitBreaker({ threshold: 3, cooldownMs: 100 });
   assert.equal(cb.state(), "closed");
   assert.equal(cb.isOpen(), false);
 });
 
 test("CircuitBreaker: trips after threshold failures", () => {
   const cb = new CircuitBreaker({ threshold: 3, cooldownMs: 100 });
   cb.recordFailure();
   cb.recordFailure();
   assert.equal(cb.state(), "closed");
   cb.recordFailure();
   assert.equal(cb.state(), "open");
   assert.equal(cb.isOpen(), true);
 });
 
 test("CircuitBreaker: success resets failure count", () => {
   const cb = new CircuitBreaker({ threshold: 3, cooldownMs: 100 });
   cb.recordFailure();
   cb.recordFailure();
   cb.recordSuccess();
   assert.equal(cb.state(), "closed");
   cb.recordFailure();
   assert.equal(cb.state(), "closed"); // only 1 failure after reset
 });
 
 test("CircuitBreaker: half-open after cooldown", async () => {
   const cb = new CircuitBreaker({ threshold: 2, cooldownMs: 50 });
   cb.recordFailure();
   cb.recordFailure();
   assert.equal(cb.state(), "open");
   await new Promise((r) => setTimeout(r, 60));
   assert.equal(cb.state(), "half-open");
 });
 
 test("CircuitBreaker: recovery from half-open", async () => {
   const cb = new CircuitBreaker({ threshold: 2, cooldownMs: 50 });
   cb.recordFailure();
   cb.recordFailure();
   await new Promise((r) => setTimeout(r, 60));
   assert.equal(cb.state(), "half-open");
   cb.recordSuccess();
   assert.equal(cb.state(), "closed");
 });
 
 // ── rateLimitSleep ────────────────────────────────────────────────────────
 
 test("rateLimitSleep: resolves after delay", async () => {
   const start = Date.now();
   await rateLimitSleep(50);
   assert.ok(Date.now() - start >= 40); // ~50ms with some tolerance
 });
 
 test("rateLimitSleep: aborts on signal", async () => {
   const ac = new AbortController();
   const p = rateLimitSleep(10_000, ac.signal);
   setTimeout(() => ac.abort(), 10);
   await assert.rejects(p, /aborted/i);
 });
