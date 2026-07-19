/** telegram-webhook.test.ts — Telegram webhook ingress security, dedup, and enqueue. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import { TelegramApi } from "../src/telegram-api.ts";
import { createWebhookHandler, telegramWebhookSecretFromUrl } from "../src/telegram-webhook.ts";

interface FakeRes extends ServerResponse {
  status?: number;
  body?: string;
}

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "tg-webhook-test-"));
  return { db: openBridgeDb(cwd), cwd };
}

/** Windows CI: NTFS can briefly refuse recursive removal while SQLite
 *  handles finish closing — retry with a short synchronous backoff. */
function rmRfRetry(path: string): void {
  const gate = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 1; ; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt >= 5) throw err;
      Atomics.wait(gate, 0, 0, 100);
    }
  }
}

function fakeReq(path: string, body: unknown, headerSecret = "s3"): IncomingMessage {
  let sent = false;
  const req = new Readable({
    read() {
      if (sent) return;
      sent = true;
      this.push(JSON.stringify(body));
      this.push(null);
    },
  }) as IncomingMessage;
  req.url = path;
  req.headers = { "x-telegram-bot-api-secret-token": headerSecret };
  return req;
}

function fakeRes(): FakeRes {
  return {
    writeHead(status: number) {
      this.status = status;
      return this;
    },
    end(payload?: string | Buffer) {
      this.body = payload ? String(payload) : "";
      return this;
    },
  } as FakeRes;
}

function fakeApi(): TelegramApi & { sent: Array<{ method: string; payload: unknown }> } {
  const sent: Array<{ method: string; payload: unknown }> = [];
  return {
    sent,
    sendMessage: async (payload: unknown) => {
      sent.push({ method: "sendMessage", payload });
      return { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } };
    },
    sendRichMessage: async (payload: unknown) => {
      sent.push({ method: "sendRichMessage", payload });
      return { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } };
    },
    sendRichMessageDraft: async (payload: unknown) => {
      sent.push({ method: "sendRichMessageDraft", payload });
      return { ok: true, result: true };
    },
    sendChatAction: async (chatId: string, messageThreadId?: number) => {
      sent.push({ method: "sendChatAction", payload: { chatId, messageThreadId } });
      return { ok: true, result: true };
    },
    sendDocument: async (payload: unknown) => {
      sent.push({ method: "sendDocument", payload });
      return { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } };
    },
    sendMessageWithKeyboard: async (payload: unknown) => {
      sent.push({ method: "sendMessageWithKeyboard", payload });
      return { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } };
    },
    editMessageReplyMarkup: async (...payload: unknown[]) => {
      sent.push({ method: "editMessageReplyMarkup", payload });
      return { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } };
    },
    answerCallbackQuery: async () => ({ ok: true, result: true }),
    setWebhook: async () => ({ ok: true, result: true }),
  } as unknown as TelegramApi & { sent: Array<{ method: string; payload: unknown }> };
}

function stubAgent(result: Promise<IncomingResult>): AgentService & { enqueued: IncomingRequest[] } {
  const enqueued: IncomingRequest[] = [];
  return {
    enqueued,
    enqueueIncoming: (req: IncomingRequest) => {
      enqueued.push(req);
      return { bindingId: 1, jobId: 1, result };
    },
    handleIncoming: async () => result,
    cancelTurn: () => false,
    shutdown() {},
  } as unknown as AgentService & { enqueued: IncomingRequest[] };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

test("telegramWebhookSecretFromUrl extracts only Telegram webhook URLs", () => {
  assert.equal(telegramWebhookSecretFromUrl("https://x.test/webhook/telegram/secret"), "secret");
  assert.equal(telegramWebhookSecretFromUrl("https://x.test/nope/secret"), null);
  assert.equal(telegramWebhookSecretFromUrl("not a url"), null);
});

test("webhook rejects when either path or header secret is wrong", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const handler = createWebhookHandler({
      api: fakeApi(),
      db,
      agentService: stubAgent(Promise.resolve({ ok: true, text: "unused" })),
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
    });

    const badPath = fakeRes();
    await handler(fakeReq("/webhook/telegram/wrong", { update_id: 1 }), badPath);
    assert.equal(badPath.status, 403);

    const badHeader = fakeRes();
    await handler(fakeReq("/webhook/telegram/s3", { update_id: 1 }, "wrong"), badHeader);
    assert.equal(badHeader.status, 403);
    assert.equal(db.getAgent(agent.id)?.poll_offset, 0);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook dedups by agent poll_offset and does not enqueue duplicates", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.setAgentPollOffset(agent.id, 10);
    db.addAgentAllowlist(agent.id, "500");
    const svc = stubAgent(Promise.resolve({ ok: true, text: "unused" }));
    const res = fakeRes();
    await createWebhookHandler({
      api: fakeApi(),
      db,
      agentService: svc,
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
    })(fakeReq("/webhook/telegram/s3", {
      update_id: 9,
      message: { message_id: 9, text: "hello", chat: { id: 500, type: "private" } },
    }), res);

    assert.equal(res.status, 200);
    assert.match(res.body ?? "", /duplicate/);
    assert.equal(svc.enqueued.length, 0);
    assert.equal(db.getAgent(agent.id)?.poll_offset, 10);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook responds 200 after enqueue without waiting for turn completion", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "500");
    let resolveTurn = (_result: IncomingResult) => {};
    const turn = new Promise<IncomingResult>((resolve) => {
      resolveTurn = resolve;
    });
    const svc = stubAgent(turn);
    const api = fakeApi();
    const res = fakeRes();

    await createWebhookHandler({
      api,
      db,
      agentService: svc,
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
    })(fakeReq("/webhook/telegram/s3", {
      update_id: 11,
      message: { message_id: 11, text: "hello", chat: { id: 500, type: "private" } },
    }), res);

    assert.equal(res.status, 200);
    assert.equal(db.getAgent(agent.id)?.poll_offset, 12);
    assert.equal(svc.enqueued.length, 1);
    assert.equal(svc.enqueued[0].text, "hello");
    assert.deepEqual(api.sent, [{ method: "sendChatAction", payload: { chatId: "500", messageThreadId: undefined } }]);

    resolveTurn({ ok: true, text: "answer" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(api.sent[1].method, "sendRichMessage");
    assert.match(JSON.stringify(api.sent[1].payload), /answer/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook dispatches /sessions through command definitions", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "500");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "500", cwd);
    db.setBindingThread(binding.id, "thread-abcdefghi");
    const api = fakeApi();
    const res = fakeRes();

    await createWebhookHandler({
      api,
      db,
      agentService: stubAgent(Promise.resolve({ ok: true, text: "unused" })),
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
    })(fakeReq("/webhook/telegram/s3", {
      update_id: 12,
      message: { message_id: 12, text: "/sessions", chat: { id: 500, type: "private" } },
    }), res);

    assert.equal(res.status, 200);
    assert.equal(api.sent[0]?.method, "sendMessage");
    assert.match(JSON.stringify(api.sent[0]?.payload), /<b>Sessions<\/b>/);
    assert.match(JSON.stringify(api.sent[0]?.payload), /HTML/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook /start deep-link admits a chat without an open window", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.createAgentPairingCode(agent.id, sha256Hex("pair-code"), 60);
    const api = fakeApi();
    const res = fakeRes();

    await createWebhookHandler({
      api,
      db,
      agentService: stubAgent(Promise.resolve({ ok: true, text: "unused" })),
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
    })(fakeReq("/webhook/telegram/s3", {
      update_id: 20,
      message: { message_id: 20, text: "/start pair-code", chat: { id: 700, type: "private" } },
    }), res);
    await settle();

    assert.equal(res.status, 200);
    assert.equal(db.isAgentAllowed(agent.id, "700"), true);
    assert.match(JSON.stringify(api.sent), /connected/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook /start rejects expired and already-consumed deep-link codes", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.createAgentPairingCode(agent.id, sha256Hex("expired"), -1);
    db.createAgentPairingCode(agent.id, sha256Hex("once"), 60);
    const handler = createWebhookHandler({
      api: fakeApi(),
      db,
      agentService: stubAgent(Promise.resolve({ ok: true, text: "unused" })),
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
    });

    const expired = fakeRes();
    await handler(fakeReq("/webhook/telegram/s3", {
      update_id: 21,
      message: { message_id: 21, text: "/start expired", chat: { id: 701, type: "private" } },
    }), expired);
    await settle();
    assert.equal(db.isAgentAllowed(agent.id, "701"), false);

    const first = fakeRes();
    await handler(fakeReq("/webhook/telegram/s3", {
      update_id: 22,
      message: { message_id: 22, text: "/start once", chat: { id: 702, type: "private" } },
    }), first);
    await settle();
    assert.equal(db.isAgentAllowed(agent.id, "702"), true);

    const second = fakeRes();
    await handler(fakeReq("/webhook/telegram/s3", {
      update_id: 23,
      message: { message_id: 23, text: "/start once", chat: { id: 703, type: "private" } },
    }), second);
    await settle();
    assert.equal(db.isAgentAllowed(agent.id, "703"), false);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook unpaired bare /start does not pre-create a binding", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const res = fakeRes();

    await createWebhookHandler({
      api: fakeApi(),
      db,
      agentService: stubAgent(Promise.resolve({ ok: true, text: "unused" })),
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
    })(fakeReq("/webhook/telegram/s3", {
      update_id: 24,
      message: { message_id: 24, text: "/start", chat: { id: 704, type: "private" } },
    }), res);
    await settle();

    assert.equal(res.status, 200);
    assert.equal(db.isAgentAllowed(agent.id, "704"), false);
    assert.deepEqual(db.listBindingsForChat("telegram", "704", agent.id), []);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook private turns use draft progress and formatted final output", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "500");
    let resolveTurn = (_result: IncomingResult) => {};
    const turn = new Promise<IncomingResult>((resolve) => {
      resolveTurn = resolve;
    });
    const svc = stubAgent(turn);
    const api = fakeApi();
    const res = fakeRes();

    await createWebhookHandler({
      api,
      db,
      agentService: svc,
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
      richSupported: true,
    })(fakeReq("/webhook/telegram/s3", {
      update_id: 12,
      message: { message_id: 12, text: "hello", chat: { id: 500, type: "private" } },
    }), res);

    assert.equal(res.status, 200);
    svc.enqueued[0].onEvent?.({ kind: "thinking", text: "checking" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(api.sent.map((entry) => entry.method), ["sendChatAction", "sendRichMessageDraft"]);

    resolveTurn({ ok: true, text: "answer" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(api.sent.at(-1)?.method, "sendRichMessage");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("webhook forum topic messages pass topicId and message_thread_id", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "-500");
    const svc = stubAgent(Promise.resolve({ ok: true, text: "answer" }));
    const api = fakeApi();
    const res = fakeRes();

    await createWebhookHandler({
      api,
      db,
      agentService: svc,
      secretToken: "s3",
      agentId: agent.id,
      workdir: cwd,
      botUsername: "cxcbot",
    })(fakeReq("/webhook/telegram/s3", {
      update_id: 13,
      message: {
        message_id: 13,
        text: "@cxcbot work here",
        chat: { id: -500, type: "supergroup", is_forum: true },
        is_topic_message: true,
        message_thread_id: 44,
      },
    }), res);

    assert.equal(res.status, 200);
    assert.equal(svc.enqueued[0]?.topicId, "44");
    assert.deepEqual(api.sent[0], { method: "sendChatAction", payload: { chatId: "-500", messageThreadId: 44 } });
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});
