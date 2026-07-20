import assert from "node:assert/strict";
import test from "node:test";
import type { TelegramApi, TgMessage, TgResponse } from "../src/telegram-api.ts";
import { createTelegramTurnLifecycleManager } from "../src/telegram-turn-lifecycle.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function message(id: number, chatId = 7, topicId?: number): TgMessage {
  return { message_id: id, chat: { id: chatId, type: "supergroup", is_forum: true }, message_thread_id: topicId };
}

function fakeApi(options: {
  chats?: TgResponse<NonNullable<Awaited<ReturnType<TelegramApi["getChat"]>>["result"]>>[];
  pin?: TgResponse<boolean>;
  unpin?: TgResponse<boolean>;
} = {}) {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chats = [...(options.chats ?? [{ ok: true, result: { id: 7, type: "supergroup" } }])];
  const api = {
    async getChat(...args: unknown[]) { calls.push({ op: "get", args }); return chats.shift() ?? { ok: true, result: { id: 7, type: "supergroup" } }; },
    async pinChatMessage(...args: unknown[]) { calls.push({ op: "pin", args }); return options.pin ?? { ok: true, result: true }; },
    async unpinChatMessage(...args: unknown[]) { calls.push({ op: "unpin", args }); return options.unpin ?? { ok: true, result: true }; },
  } as unknown as TelegramApi;
  return { api, calls };
}

test("clear preflight silently pins and exact-id unpins once", async () => {
  const { api, calls } = fakeApi();
  const lease = createTelegramTurnLifecycleManager({ api }).begin(message(42));
  await Promise.all([lease.finish(), lease.finish()]);
  assert.deepEqual(calls, [
    { op: "get", args: [7] },
    { op: "pin", args: [{ chatId: 7, messageId: 42, disableNotification: true }] },
    { op: "unpin", args: [7, 42] },
  ]);
});

test("pre-existing trigger and another pre-existing pin are never mutated", async () => {
  const { api, calls } = fakeApi({ chats: [
    { ok: true, result: { id: 7, type: "supergroup", pinned_message: message(1) } },
    { ok: true, result: { id: 8, type: "supergroup", pinned_message: message(99, 8) } },
  ] });
  const manager = createTelegramTurnLifecycleManager({ api });
  await Promise.all([manager.begin(message(1)).finish(), manager.begin(message(2, 8)).finish()]);
  assert.deepEqual(calls.map((c) => c.op), ["get", "get"]);
});

test("failed preflight, pin, and unpin are absorbed", async () => {
  const logs: string[] = [];
  const { api, calls } = fakeApi({ chats: [{ ok: false, description: "denied" }] });
  await createTelegramTurnLifecycleManager({ api, log: (line) => logs.push(line) }).begin(message(1)).finish();
  assert.deepEqual(calls.map((c) => c.op), ["get"]);
  assert.equal(logs.length, 1);

  const failed = fakeApi({ pin: { ok: false, description: "no permission" } });
  await createTelegramTurnLifecycleManager({ api: failed.api }).begin(message(2)).finish();
  assert.deepEqual(failed.calls.map((c) => c.op), ["get", "pin"]);

  const unpin = fakeApi({ unpin: { ok: false, description: "gone" } });
  await createTelegramTurnLifecycleManager({ api: unpin.api }).begin(message(3)).finish();
  assert.deepEqual(unpin.calls.at(-1), { op: "unpin", args: [7, 3] });
});

test("chat-wide FIFO spans topics and pending finish never activates", async () => {
  const firstGet = deferred<TgResponse<{ id: number; type: string }>>();
  const calls: string[] = [];
  const api = {
    getChat: async () => { calls.push("get"); return calls.length === 1 ? firstGet.promise : { ok: true, result: { id: 7, type: "supergroup" } }; },
    pinChatMessage: async ({ messageId }: { messageId: number }) => { calls.push(`pin:${messageId}`); return { ok: true, result: true }; },
    unpinChatMessage: async (_chatId: number, messageId: number) => { calls.push(`unpin:${messageId}`); return { ok: true, result: true }; },
  } as unknown as TelegramApi;
  const manager = createTelegramTurnLifecycleManager({ api });
  const a = manager.begin(message(1, 7, 10));
  const b = manager.begin(message(2, 7, 20));
  await b.finish();
  assert.deepEqual(calls, ["get"]);
  firstGet.resolve({ ok: true, result: { id: 7, type: "supergroup" } });
  await a.finish();
  assert.deepEqual(calls, ["get", "pin:1", "unpin:1"]);
});

test("cleanupAll closes admission and awaits active preflight without promoting pending", async () => {
  const get = deferred<TgResponse<{ id: number; type: string }>>();
  const calls: string[] = [];
  const api = {
    getChat: async () => { calls.push("get"); return get.promise; },
    pinChatMessage: async ({ messageId }: { messageId: number }) => { calls.push(`pin:${messageId}`); return { ok: true, result: true }; },
    unpinChatMessage: async (_chatId: number, messageId: number) => { calls.push(`unpin:${messageId}`); return { ok: true, result: true }; },
  } as unknown as TelegramApi;
  const manager = createTelegramTurnLifecycleManager({ api });
  manager.begin(message(1));
  manager.begin(message(2));
  const cleanup = manager.cleanupAll();
  get.resolve({ ok: true, result: { id: 7, type: "supergroup" } });
  await Promise.all([cleanup, manager.cleanupAll(), manager.begin(message(3)).finish()]);
  assert.deepEqual(calls, ["get", "pin:1", "unpin:1"]);
});
