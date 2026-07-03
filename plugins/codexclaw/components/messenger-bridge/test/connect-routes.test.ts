/** connect-routes.test.ts — channel connect/manage API over the real server + a stub controller. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { openBridgeDb, type BridgeDb, type ChannelKind } from "../src/db.ts";
import { createBridgeServer, type BridgeControllerLike } from "../src/server.ts";

/** A controller stub that records reloads and simulates a pairing. */
class StubController implements BridgeControllerLike {
  reloads = 0;
  active: ChannelKind | null = null;
  private db: BridgeDb;
  private baseline = 0;
  constructor(db: BridgeDb) {
    this.db = db;
  }
  async reload() {
    this.reloads += 1;
    this.active = this.db.getActiveChannel()?.kind ?? null;
  }
  stop() {}
  activeKind() {
    return this.active;
  }
  adapterStatus() {
    return this.active ? "running" : "stopped";
  }
  openHandshake(kind: ChannelKind, seconds: number) {
    this.baseline = this.db.listAllowlist(kind).length;
    this.db.openHandshake(kind, seconds);
  }
  handshakeState(kind: ChannelKind) {
    const list = this.db.listAllowlist(kind);
    const paired = list.length > this.baseline ? (list[list.length - 1]?.chat_id ?? null) : null;
    return { open: this.db.isHandshakeOpen(kind) && !paired, pairedChatId: paired };
  }
}

interface H {
  cwd: string;
  db: BridgeDb;
  server: Server;
  base: string;
  controller: StubController;
}

async function start(): Promise<H> {
  const cwd = mkdtempSync(join(tmpdir(), "connect-routes-test-"));
  const db = openBridgeDb(cwd);
  const controller = new StubController(db);
  const server = createBridgeServer({ db, cwd, guiDir: join(cwd, "gui"), version: "t", controller });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { cwd, db, server, base: `http://127.0.0.1:${port}`, controller };
}

async function stop(h: H) {
  await new Promise<void>((r) => h.server.close(() => r()));
  h.db.close();
  rmSync(h.cwd, { recursive: true, force: true });
}

function post(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-codexclaw-local": "1" },
    body: JSON.stringify(body),
  });
}

test("validate rejects unknown kind and missing token", async () => {
  const h = await start();
  try {
    assert.equal((await post(h.base, "/api/connect/validate", { kind: "sms", token: "x" })).status, 400);
    assert.equal((await post(h.base, "/api/connect/validate", { kind: "telegram" })).status, 400);
  } finally {
    await stop(h);
  }
});

test("validate saves the token when the transport confirms it", async () => {
  const h = await start();
  try {
    // Inject a telegram getMe success by monkeypatching global fetch for api.telegram.org.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (String(url).includes("api.telegram.org")) {
        return { json: async () => ({ ok: true, result: { id: 1, username: "cxcbot" } }) } as Response;
      }
      return realFetch(url as string, init);
    }) as typeof fetch;
    try {
      const res = await post(h.base, "/api/connect/validate", { kind: "telegram", token: "good" });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { ok: boolean; username: string };
      assert.equal(body.ok, true);
      assert.equal(body.username, "cxcbot");
      assert.equal(h.db.getChannel("telegram")?.token, "good");
    } finally {
      globalThis.fetch = realFetch;
    }
  } finally {
    await stop(h);
  }
});

test("activate requires a saved token then reloads the controller", async () => {
  const h = await start();
  try {
    assert.equal((await post(h.base, "/api/connect/activate", { kind: "discord" })).status, 400);
    h.db.setChannelToken("discord", "tok");
    const res = await post(h.base, "/api/connect/activate", { kind: "discord" });
    assert.equal(res.status, 200);
    assert.equal(h.controller.reloads, 1);
    assert.equal(h.db.getActiveChannel()?.kind, "discord");
    assert.equal(h.controller.activeKind(), "discord");
  } finally {
    await stop(h);
  }
});

test("deactivate clears active channel and reloads", async () => {
  const h = await start();
  try {
    h.db.setChannelToken("telegram", "t");
    h.db.setActiveChannel("telegram");
    const res = await post(h.base, "/api/connect/deactivate", {});
    assert.equal(res.status, 200);
    assert.equal(h.db.getActiveChannel(), null);
    assert.equal(h.controller.reloads, 1);
  } finally {
    await stop(h);
  }
});

test("handshake open → status pairs when allowlist grows", async () => {
  const h = await start();
  try {
    h.db.setChannelToken("telegram", "t");
    await post(h.base, "/api/connect/handshake/open", { kind: "telegram", seconds: 60 });
    let status = await (await fetch(`${h.base}/api/connect/handshake/status?kind=telegram`)).json();
    assert.equal((status as { open: boolean }).open, true);
    assert.equal((status as { pairedChatId: string | null }).pairedChatId, null);

    // Simulate the adapter pairing a chat via /start.
    h.db.addAllowlist("telegram", "12345", "");
    status = await (await fetch(`${h.base}/api/connect/handshake/status?kind=telegram`)).json();
    assert.equal((status as { pairedChatId: string | null }).pairedChatId, "12345");
  } finally {
    await stop(h);
  }
});

test("channels + bindings read models", async () => {
  const h = await start();
  try {
    h.db.setChannelToken("telegram", "t");
    h.db.setActiveChannel("telegram");
    h.db.getOrCreateBinding("telegram", "77", h.cwd);

    const channels = (await (await fetch(`${h.base}/api/channels`)).json()) as {
      channels: Array<{ kind: string; hasToken: boolean; active: boolean }>;
      activeKind: string;
    };
    const tg = channels.channels.find((c) => c.kind === "telegram");
    assert.equal(tg?.hasToken, true);
    assert.equal(tg?.active, true);
    assert.equal(channels.activeKind, "telegram");

    const bindings = (await (await fetch(`${h.base}/api/bindings`)).json()) as {
      bindings: Array<{ chat_id: string }>;
    };
    assert.equal(bindings.bindings[0]?.chat_id, "77");
  } finally {
    await stop(h);
  }
});
