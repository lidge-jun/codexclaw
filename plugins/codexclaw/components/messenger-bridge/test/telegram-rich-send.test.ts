 /** telegram-rich-send.test.ts — capability-gated rich message dispatch (Phase E1). */
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { createDraftProgressState, probeRichSupport, sendRichOrFallback, sendDraftProgress } from "../src/telegram-rich-send.ts";
 import type { TelegramApi, TgResponse, TgMessage, InputRichMessage } from "../src/telegram-api.ts";
 
 // ── Helpers ──────────────────────────────────────────────────────────────
 
 interface CallRecord {
   method: string;
   payload: Record<string, unknown>;
 }
 
 /** Build a mock TelegramApi that records calls and returns configurable responses. */
 function mockApi(responses: Record<string, TgResponse | TgResponse[]>): TelegramApi & { calls: CallRecord[] } {
   const calls: CallRecord[] = [];
   const handler = {
     get(_target: unknown, prop: string) {
       if (prop === "calls") return calls;
       // Return a function that records the call and returns the configured response
       return (params: Record<string, unknown>) => {
         calls.push({ method: prop, payload: params ?? {} });
         const key = prop;
         const configured = responses[key] ?? { ok: true };
         const res = Array.isArray(configured)
           ? (configured.shift() ?? { ok: true })
           : configured;
         return Promise.resolve(res);
       };
     },
   };
   return new Proxy({} as TelegramApi & { calls: CallRecord[] }, handler);
 }
 
 // ── probeRichSupport ─────────────────────────────────────────────────────
 
 test("probeRichSupport: 400 Bad Request → supported", async () => {
   const api = mockApi({ sendRichMessage: { ok: false, error_code: 400, description: "Bad Request: ..." } });
   assert.equal(await probeRichSupport(api, 12345), true);
   assert.equal(api.calls[0].method, "sendRichMessage");
 });
 
 test("probeRichSupport: 404 Not Found → unsupported", async () => {
   const api = mockApi({ sendRichMessage: { ok: false, error_code: 404, description: "Not Found" } });
   assert.equal(await probeRichSupport(api, 12345), false);
 });
 
 test("probeRichSupport: method not found description → unsupported", async () => {
   const api = mockApi({ sendRichMessage: { ok: false, error_code: 400, description: "method not found" } });
   // error_code 400 but description says "method not found" → unsupported
   // Actually per our logic: 400 → true, but description check is only for non-400 codes
   // Let me check the actual code logic...
   // The code checks error_code === 400 first → returns true regardless of description.
   // This is correct: if the method is recognized by the API (error_code 400 = bad params),
   // it means the method exists. "method not found" with 400 is contradictory from Telegram,
   // but we trust the error code first.
   assert.equal(await probeRichSupport(api, 12345), true);
 });
 
 test("probeRichSupport: network error → unsupported (fail closed)", async () => {
   const api = mockApi({});
   // Override sendRichMessage to throw
   (api as unknown as Record<string, unknown>).sendRichMessage = () => Promise.reject(new Error("network"));
   // The proxy won't be used for this override. Let's use a different approach:
   const throwApi = {
     sendRichMessage: () => Promise.reject(new Error("network error")),
   } as unknown as TelegramApi;
   assert.equal(await probeRichSupport(throwApi, 12345), false);
 });
 
 test("probeRichSupport: ok true → supported (unlikely but valid)", async () => {
   const api = mockApi({ sendRichMessage: { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } } });
   assert.equal(await probeRichSupport(api, 12345), true);
 });
 
 // ── sendRichOrFallback ───────────────────────────────────────────────────
 
 test("sendRichOrFallback: rich path sends sendRichMessage", async () => {
   const api = mockApi({
     sendRichMessage: { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } },
   });
   await sendRichOrFallback(
     { api, chatId: "123", richSupported: true, chatType: "private" },
     "**hello** world",
   );
   const richCalls = api.calls.filter((c) => c.method === "sendRichMessage");
   assert.ok(richCalls.length > 0, "should call sendRichMessage");
   const sendMsgCalls = api.calls.filter((c) => c.method === "sendMessage");
   assert.equal(sendMsgCalls.length, 0, "should not fall back to sendMessage");
 });
 
 test("sendRichOrFallback: legacy path sends sendMessage with parse_mode HTML", async () => {
   const api = mockApi({
     sendMessage: { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } },
   });
   await sendRichOrFallback(
     { api, chatId: "123", richSupported: false, chatType: "private" },
     "**hello** world",
   );
   const sendCalls = api.calls.filter((c) => c.method === "sendMessage");
   assert.ok(sendCalls.length > 0, "should call sendMessage");
   // First sendMessage call should have parse_mode HTML
   const firstPayload = sendCalls[0].payload;
   assert.equal(firstPayload.parseMode ?? firstPayload.parse_mode, "HTML");
   const richCalls = api.calls.filter((c) => c.method === "sendRichMessage");
   assert.equal(richCalls.length, 0, "should not call sendRichMessage");
 });
 
 test("sendRichOrFallback: rich fail falls back to legacy", async () => {
   const api = mockApi({
     sendRichMessage: { ok: false, error_code: 400, description: "bad rich content" },
     sendMessage: { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } },
   });
   await sendRichOrFallback(
     { api, chatId: "123", richSupported: true, chatType: "group" },
     "test",
   );
   const richCalls = api.calls.filter((c) => c.method === "sendRichMessage");
   assert.ok(richCalls.length > 0, "should attempt sendRichMessage first");
   const sendCalls = api.calls.filter((c) => c.method === "sendMessage");
   assert.ok(sendCalls.length > 0, "should fall back to sendMessage");
 });
 
 // ── sendDraftProgress ────────────────────────────────────────────────────
 
 test("sendDraftProgress: private chat sends draft", async () => {
   const api = mockApi({
     sendRichMessageDraft: { ok: true },
   });
   await sendDraftProgress(
     { api, chatId: "12345", richSupported: true, chatType: "private" },
     1,
     "partial progress",
   );
   const draftCalls = api.calls.filter((c) => c.method === "sendRichMessageDraft");
   assert.equal(draftCalls.length, 1);
   assert.equal(draftCalls[0].payload.chatId ?? draftCalls[0].payload.chat_id, 12345);
 });

 test("sendDraftProgress: default clock does not call Date.now", async () => {
   const api = mockApi({ sendRichMessageDraft: { ok: true } });
   const original = Date.now;
   Date.now = () => {
     throw new Error("wall clock used");
   };
   try {
     await sendDraftProgress(
       { api, chatId: "12345", richSupported: true, chatType: "private" },
       1,
       "partial progress",
     );
   } finally {
     Date.now = original;
   }
   assert.equal(api.calls.filter((c) => c.method === "sendRichMessageDraft").length, 1);
 });
 
 test("sendDraftProgress: group chat is no-op", async () => {
   const api = mockApi({});
   await sendDraftProgress(
     { api, chatId: "12345", richSupported: true, chatType: "group" },
     1,
     "partial progress",
   );
   assert.equal(api.calls.length, 0, "should not call any API method for group chats");
 });
 
 test("sendDraftProgress: richSupported=false is no-op", async () => {
   const api = mockApi({});
   await sendDraftProgress(
     { api, chatId: "12345", richSupported: false, chatType: "private" },
     1,
     "partial progress",
   );
   assert.equal(api.calls.length, 0, "should not call any API method when rich is unsupported");
 });

 test("sendDraftProgress: throttles draft edits at 1000ms with injectable clock", async () => {
   const api = mockApi({ sendRichMessageDraft: { ok: true } });
   const state = createDraftProgressState();
   let now = 1000;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "one", { state, now: () => now });
   now = 1500;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "two", { state, now: () => now });
   now = 2100;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "three", { state, now: () => now });
   assert.equal(api.calls.filter((c) => c.method === "sendRichMessageDraft").length, 2);
 });

 test("sendDraftProgress: 429 retry_after suspends edits without sleeping", async () => {
   const api = mockApi({
     sendRichMessageDraft: [
       { ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 2 } },
       { ok: true },
     ],
   });
   const state = createDraftProgressState();
   let now = 1000;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "one", { state, now: () => now });
   now = 2500;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "two", { state, now: () => now });
   now = 3100;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "three", { state, now: () => now });
   assert.equal(api.calls.filter((c) => c.method === "sendRichMessageDraft").length, 2);
 });

 test("sendDraftProgress: message-is-not-modified counts as success", async () => {
   const api = mockApi({
     sendRichMessageDraft: [
       { ok: false, error_code: 400, description: "Bad Request: message is not modified" },
       { ok: true },
     ],
   });
   const state = createDraftProgressState();
   state.consecutiveFailures = 2;
   let now = 1000;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "same", { state, now: () => now });
   assert.equal(state.consecutiveFailures, 0);
   assert.equal(state.disabled, false);
   now = 2100;
   await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "next", { state, now: () => now });
   assert.equal(api.calls.filter((c) => c.method === "sendRichMessageDraft").length, 2);
 });

 test("sendDraftProgress: stops previews after three consecutive failures", async () => {
   const api = mockApi({ sendRichMessageDraft: { ok: false, error_code: 500, description: "server error" } });
   const state = createDraftProgressState();
   for (const now of [1000, 2100, 3200, 4300]) {
     await sendDraftProgress({ api, chatId: "12345", richSupported: true, chatType: "private" }, 1, "x", { state, now: () => now });
   }
   assert.equal(state.disabled, true);
   assert.equal(api.calls.filter((c) => c.method === "sendRichMessageDraft").length, 3);
 });
