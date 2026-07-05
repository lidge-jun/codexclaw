 /** metrics.test.ts — BridgeMetrics unit tests (Phase E5). */
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { BridgeMetrics } from "../src/metrics.ts";
 
 test("BridgeMetrics: starts at zero", () => {
   const m = new BridgeMetrics();
   const s = m.snapshot();
   assert.equal(s.messagesReceived, 0);
   assert.equal(s.turnsCompleted, 0);
   assert.equal(s.errors, 0);
   assert.equal(s.avgResponseTimeMs, null);
 });
 
 test("BridgeMetrics: records messages and turns", () => {
   const m = new BridgeMetrics();
   m.recordMessage(1);
   m.recordMessage(1);
   m.recordMessage(null);
   m.recordTurnComplete(1, 500);
   m.recordTurnComplete(1, 1000);
   const s = m.snapshot();
   assert.equal(s.messagesReceived, 3);
   assert.equal(s.turnsCompleted, 2);
   assert.equal(s.avgResponseTimeMs, 750);
 });
 
 test("BridgeMetrics: per-agent breakdown", () => {
   const m = new BridgeMetrics();
   m.recordMessage(1);
   m.recordMessage(2);
   m.recordError(1);
   m.recordTurnComplete(2, 100);
   const s = m.snapshot();
   assert.equal(s.perAgent["1"].messages, 1);
   assert.equal(s.perAgent["1"].errors, 1);
   assert.equal(s.perAgent["2"].turns, 1);
 });
 
 test("BridgeMetrics: rate limit counting", () => {
   const m = new BridgeMetrics();
   m.recordRateLimit("telegram");
   m.recordRateLimit("telegram");
   m.recordRateLimit("discord");
   const s = m.snapshot();
   assert.equal(s.rateLimits.telegram, 2);
   assert.equal(s.rateLimits.discord, 1);
 });
