 /** event-log.test.ts — structured event logger tests (Phase E5). */
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import { EventLog, type BridgeEvent } from "../src/event-log.ts";
 
 function tempDir(): string {
   return mkdtempSync(join(tmpdir(), "evlog-"));
 }
 
 test("EventLog: writes JSONL and recent() returns events", () => {
   const dir = tempDir();
   try {
     const path = join(dir, "events.jsonl");
     const log = new EventLog({ path });
     const ev: BridgeEvent = { type: "message_received", agentId: 1, chatId: "c1", platform: "telegram", ts: new Date().toISOString() };
     log.log(ev);
     log.log({ type: "error", agentId: null, message: "boom", ts: new Date().toISOString() });
 
     const recent = log.recent(10);
     assert.equal(recent.length, 2);
     assert.equal(recent[0].type, "message_received");
     assert.equal(recent[1].type, "error");
 
     // File should have 2 lines
     const content = readFileSync(path, "utf8").trim().split("\n");
     assert.equal(content.length, 2);
     assert.equal(JSON.parse(content[0]).type, "message_received");
 
     log.close();
   } finally {
     rmSync(dir, { recursive: true, force: true });
   }
 });
 
 test("EventLog: recent() returns at most N events", () => {
   const dir = tempDir();
   try {
     const path = join(dir, "events.jsonl");
     const log = new EventLog({ path });
     for (let i = 0; i < 10; i++) {
       log.log({ type: "reconnect", platform: "discord", ts: `t${i}` });
     }
     assert.equal(log.recent(3).length, 3);
     assert.equal(log.recent(3)[0].ts, "t7");
     log.close();
   } finally {
     rmSync(dir, { recursive: true, force: true });
   }
 });

 test("EventLog: accepts turn_started and lifecycle events", () => {
   const dir = tempDir();
   try {
     const path = join(dir, "events.jsonl");
     const log = new EventLog({ path });
     log.log({ type: "turn_started", agentId: 7, chatId: "c1", platform: "telegram", ts: "t1" });
     log.log({ type: "lifecycle", payload: { action: "reload", detail: "manual" }, ts: "t2" });

     const recent = log.recent(2);
     assert.equal(recent[0]?.type, "turn_started");
     assert.equal(recent[1]?.type, "lifecycle");
     assert.deepEqual(recent[1], { type: "lifecycle", payload: { action: "reload", detail: "manual" }, ts: "t2" });
     log.close();
   } finally {
     rmSync(dir, { recursive: true, force: true });
   }
 });

 test("EventLog: rotation on size limit", () => {
   const dir = tempDir();
   try {
     const path = join(dir, "events.jsonl");
     // Tiny max size to trigger rotation quickly
     const log = new EventLog({ path, maxSizeBytes: 100, maxFiles: 2 });
     for (let i = 0; i < 20; i++) {
       log.log({ type: "reconnect", platform: "telegram", ts: `ts-${i}-${"x".repeat(20)}` });
     }
     // After rotation, .1 should exist
     assert.ok(existsSync(`${path}.1`), "rotated file .1 should exist");
     log.close();
   } finally {
     rmSync(dir, { recursive: true, force: true });
   }
 });
 
 test("EventLog: close() prevents further writes", () => {
   const dir = tempDir();
   try {
     const path = join(dir, "events.jsonl");
     const log = new EventLog({ path });
     log.log({ type: "reconnect", platform: "discord", ts: "t1" });
     log.close();
     log.log({ type: "reconnect", platform: "discord", ts: "t2" });
     assert.equal(log.recent(10).length, 1); // only 1, not 2
   } finally {
     rmSync(dir, { recursive: true, force: true });
   }
 });
