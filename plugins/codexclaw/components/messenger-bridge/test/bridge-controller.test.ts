/**
 * bridge-controller.test.ts — v4 multi-adapter lifecycle (slice 50): one
 * adapter per enabled agent, diff-based reload, same-token guard, legacy
 * per-kind handshake shims. Offline: scripted telegram fetch + inert ws.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBridgeDb } from "../src/db.ts";
import { BridgeController } from "../src/bridge-controller.ts";
import type { WsLike } from "../src/discord-gateway.ts";

/** Scripted telegram fetch keyed by bot token (from the URL): getMe +
 *  deleteWebhook resolve; getUpdates long-polls until aborted. */
function makeTgFetch() {
  const byToken = new Map<string, { starts: number }>();
  const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
    const token = /\/bot([^/]+)\//.exec(url)?.[1] ?? "?";
    const method = url.split("/").pop() as string;
    const entry = byToken.get(token) ?? { starts: 0 };
    byToken.set(token, entry);
    const reply = (body: unknown): Promise<Response> =>
      Promise.resolve({ json: () => Promise.resolve(body) } as Response);
    if (method === "getMe") return reply({ ok: true, result: { id: 1, username: `bot_${token}` } });
    if (method === "deleteWebhook") {
      entry.starts += 1; // one deleteWebhook per adapter start
      return reply({ ok: true, result: true });
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

function makeController() {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-ctrl-"));
  const db = openBridgeDb(cwd);
  const tg = makeTgFetch();
  const controller = new BridgeController({
    db,
    workdir: cwd,
    telegramFetch: tg.fetchImpl as never,
    discordWsFactory: inertWs,
  });
  return { db, controller, tg };
}

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20));
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
