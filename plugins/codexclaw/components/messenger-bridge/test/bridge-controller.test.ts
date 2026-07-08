/**
 * bridge-controller.test.ts — v4 multi-adapter lifecycle (slice 50): one
 * adapter per enabled agent, diff-based reload, same-token guard, legacy
 * per-kind handshake shims. Offline: scripted telegram fetch + inert ws.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { openBridgeDb } from "../src/db.ts";
import { BridgeController } from "../src/bridge-controller.ts";
import type { WsLike } from "../src/discord-gateway.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_CODEX = join(here, "fixtures", "fake-codex.mjs");

/** Scripted telegram fetch keyed by bot token (from the URL): getMe +
 *  deleteWebhook/setWebhook resolve; getUpdates long-polls until aborted. */
function makeTgFetch(opts: { failSetWebhook?: boolean } = {}) {
  const byToken = new Map<string, { starts: number; webhooks: number; deleteDrops: unknown[] }>();
  const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
    const token = /\/bot([^/]+)\//.exec(url)?.[1] ?? "?";
    const method = url.split("/").pop() as string;
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const entry = byToken.get(token) ?? { starts: 0, webhooks: 0, deleteDrops: [] };
    byToken.set(token, entry);
    const reply = (body: unknown): Promise<Response> =>
      Promise.resolve({ json: () => Promise.resolve(body) } as Response);
    if (method === "getMe") return reply({ ok: true, result: { id: 1, username: `bot_${token}` } });
    if (method === "deleteWebhook") {
      entry.starts += 1; // one deleteWebhook per adapter start
      entry.deleteDrops.push(payload.drop_pending_updates);
      return reply({ ok: true, result: true });
    }
    if (method === "setWebhook") {
      entry.webhooks += 1;
      return reply(opts.failSetWebhook ? { ok: false, description: "set failed" } : { ok: true, result: true });
    }
    if (method === "getUpdates") {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted")));
      });
    }
    return reply({ ok: true, result: true });
  };
  return { fetchImpl, byToken };
}

const inertWs = (): WsLike => ({ send() {}, close() {}, addEventListener() {} });

function makeController(opts: { failSetWebhook?: boolean; codexBin?: string } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-ctrl-"));
  const db = openBridgeDb(cwd);
  const tg = makeTgFetch({ failSetWebhook: opts.failSetWebhook });
  const controller = new BridgeController({
    db,
    workdir: cwd,
    codexBin: opts.codexBin,
    telegramFetch: tg.fetchImpl as never,
    discordWsFactory: inertWs,
  });
  return { db, controller, tg };
}

interface FakeRes extends ServerResponse {
  status?: number;
  body?: string;
}

function fakeWebhookReq(secret: string, body: unknown): IncomingMessage {
  let sent = false;
  const req = new Readable({
    read() {
      if (sent) return;
      sent = true;
      this.push(JSON.stringify(body));
      this.push(null);
    },
  }) as IncomingMessage;
  req.url = `/webhook/telegram/${secret}`;
  req.headers = { "x-telegram-bot-api-secret-token": secret };
  return req;
}

function fakeWebhookRes(): FakeRes {
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

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20));
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await settle();
  }
  assert.fail(`timed out waiting for ${label}`);
}

test("reload runs one adapter per enabled agent, across kinds", async () => {
  const { db, controller, tg } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  const a2 = db.createAgent("telegram-2", "telegram", "tokB");
  const d1 = db.createAgent("discord-1", "discord", "tokC");
  db.setAgentEnabled(a1.id, true);
  db.setAgentEnabled(a2.id, true);
  db.setAgentEnabled(d1.id, true);

  await controller.reload();
  await settle();
  const statuses = controller.agentStatuses();
  assert.equal(statuses.length, 3);
  assert.deepEqual(new Set(statuses.map((s) => s.name)), new Set(["telegram-1", "telegram-2", "discord-1"]));
  assert.equal(tg.byToken.get("tokA")?.starts, 1);
  assert.equal(tg.byToken.get("tokB")?.starts, 1);
  assert.equal(controller.adapterStatus(), "3 running");

  controller.stop();
  assert.equal(controller.agentStatuses().length, 0);
  db.close();
});

test("controller exposes metrics snapshot and lifecycle events", async () => {
  const { db, controller } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.setAgentEnabled(a1.id, true);

  await controller.reload();
  await settle();

  const snap = controller.metricsSnapshot();
  assert.equal(snap.messagesReceived, 0);
  assert.equal(snap.turnsCompleted, 0);

  const actions = controller
    .recentEvents(10)
    .filter((e) => e.type === "lifecycle")
    .map((e) => e.payload.action);
  assert.ok(actions.includes("reload"));
  assert.ok(actions.includes("start"));

  controller.stop();
  assert.ok(
    controller
      .recentEvents(10)
      .filter((e) => e.type === "lifecycle")
      .some((e) => e.payload.action === "stop"),
  );
  db.close();
});

test("telegram webhook_url starts webhook mode instead of long polling", async () => {
  const { db, controller, tg } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.updateAgent(a1.id, { webhook_url: "https://bridge.example/webhook/telegram/secA" });
  db.setAgentEnabled(a1.id, true);

  await controller.reload();
  await settle();
  const statuses = controller.agentStatuses();
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].status, "webhook");
  assert.equal(tg.byToken.get("tokA")?.webhooks, 1);
  assert.equal(tg.byToken.get("tokA")?.starts, 0);

  controller.stop();
  db.close();
});

test("telegram webhook mode passes botUsername so group @mentions reach the queue", async () => {
  const { db, controller } = makeController({ codexBin: FAKE_CODEX });
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.updateAgent(a1.id, { webhook_url: "https://bridge.example/webhook/telegram/secA" });
  db.addAgentAllowlist(a1.id, "-500", "group");
  db.setAgentEnabled(a1.id, true);

  await controller.reload();
  await settle();
  const res = fakeWebhookRes();
  const handled = await controller.handleTelegramWebhook(
    "secA",
    fakeWebhookReq("secA", {
      update_id: 10,
      message: {
        message_id: 10,
        text: "@bot_tokA please work",
        chat: { id: -500, type: "supergroup" },
      },
    }),
    res,
  );

  assert.equal(handled, true);
  assert.equal(res.status, 200);
  const binding = db.listBindings().find((row) => row.agent_id === a1.id && row.chat_id === "-500");
  assert.ok(binding, "mention-gated webhook group message should create/use the binding");
  assert.equal(db.listJobs(binding.id, 1)[0]?.prompt_preview, "please work");
  await waitFor(() => db.listJobs(binding.id, 1)[0]?.state === "done", "webhook fake-codex turn completion");

  controller.stop();
  db.close();
});

test("changing telegram webhook_url restarts exactly that adapter", async () => {
  const { db, controller, tg } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.updateAgent(a1.id, { webhook_url: "https://bridge.example/webhook/telegram/secA" });
  db.setAgentEnabled(a1.id, true);
  await controller.reload();
  await settle();

  db.updateAgent(a1.id, { webhook_url: "https://bridge.example/webhook/telegram/secB" });
  await controller.reload();
  await settle();

  assert.equal(tg.byToken.get("tokA")?.webhooks, 2);
  assert.equal(controller.agentStatuses()[0]?.status, "webhook");
  controller.stop();
  db.close();
});

test("handleTelegramWebhook rejects wrong path secrets uniformly (no naive-compare oracle)", async () => {
  const { db, controller } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.updateAgent(a1.id, { webhook_url: "https://bridge.example/webhook/telegram/secA" });
  db.setAgentEnabled(a1.id, true);
  await controller.reload();
  await settle();

  const req = { headers: {} } as never;
  const res = { writableEnded: false } as never;
  // Wrong secret of different length AND wrong secret of matching length both
  // fall through to the server's uniform 404 (handled=false), never the handler.
  assert.equal(await controller.handleTelegramWebhook("nope", req, res), false);
  assert.equal(await controller.handleTelegramWebhook("secB", req, res), false);

  controller.stop();
  db.close();
});

test("webhook registration failure deletes webhook without dropping updates and falls back to polling", async () => {
  const { db, controller, tg } = makeController({ failSetWebhook: true });
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.updateAgent(a1.id, { webhook_url: "https://bridge.example/webhook/telegram/secA" });
  db.setAgentEnabled(a1.id, true);

  await controller.reload();
  await settle();

  const entry = tg.byToken.get("tokA");
  assert.equal(entry?.webhooks, 1);
  assert.ok(entry?.deleteDrops.includes(false), "fallback must call deleteWebhook(false)");
  assert.equal(controller.agentStatuses()[0]?.status, "running");
  assert.ok(controller.recentEvents(10).some((event) => event.type === "error"));

  controller.stop();
  db.close();
});

test("diff reload: disabling one agent stops ONLY it; others never restart", async () => {
  const { db, controller, tg } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  const a2 = db.createAgent("telegram-2", "telegram", "tokB");
  db.setAgentEnabled(a1.id, true);
  db.setAgentEnabled(a2.id, true);
  await controller.reload();
  await settle();
  assert.equal(controller.agentStatuses().length, 2);

  db.setAgentEnabled(a2.id, false);
  await controller.reload();
  await settle();
  const statuses = controller.agentStatuses();
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].name, "telegram-1");
  // telegram-1 was NOT restarted by the diff (still exactly one start)
  assert.equal(tg.byToken.get("tokA")?.starts, 1);

  controller.stop();
  db.close();
});

test("token change restarts exactly that agent's adapter", async () => {
  const { db, controller, tg } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.setAgentEnabled(a1.id, true);
  await controller.reload();
  await settle();
  db.updateAgent(a1.id, { token: "tokA2" });
  await controller.reload();
  await settle();
  assert.equal(tg.byToken.get("tokA2")?.starts, 1);
  assert.equal(controller.agentStatuses().length, 1);
  controller.stop();
  db.close();
});

test("same-kind duplicate token is skipped (would 409-fight)", async () => {
  const { db, controller } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  const a2 = db.createAgent("telegram-dup", "telegram", "tokA");
  db.setAgentEnabled(a1.id, true);
  db.setAgentEnabled(a2.id, true);
  await controller.reload();
  await settle();
  assert.equal(controller.agentStatuses().length, 1);
  controller.stop();
  db.close();
});

test("legacy handshake shim routes to the kind's first enabled agent and detects pairing", async () => {
  const { db, controller } = makeController();
  const a1 = db.createAgent("telegram-1", "telegram", "tokA");
  db.setAgentEnabled(a1.id, true);

  controller.openHandshake("telegram", 60);
  assert.equal(db.isAgentHandshakeOpen(a1.id), true);
  assert.deepEqual(controller.handshakeState("telegram"), { open: true, pairedChatId: null });

  // A /start admission lands in the AGENT allowlist.
  db.addAgentAllowlist(a1.id, "777");
  const paired = controller.handshakeState("telegram");
  assert.equal(paired.pairedChatId, "777");
  assert.equal(db.isAgentHandshakeOpen(a1.id), false); // one-shot close
  db.close();
});
