/** discord-adapter.test.ts — REST chunking + adapter gating over injected fetch/ws. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chunkDiscordMessage } from "../src/discord-api.ts";
import { createDiscordAdapter } from "../src/discord-adapter.ts";
import { OP, type WsLike } from "../src/discord-gateway.ts";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";

test("chunkDiscordMessage splits at 2000 and preserves content", () => {
  assert.deepEqual(chunkDiscordMessage("short"), ["short"]);
  const long = "line\n".repeat(600); // 3000 chars
  const chunks = chunkDiscordMessage(long);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(c.length <= 2000);
  assert.equal(chunks.join("\n").replace(/\n+/g, "\n"), long.replace(/\n+/g, "\n"));
});

class FakeWs implements WsLike {
  private listeners = new Map<string, (ev: unknown) => void>();
  send(): void {}
  close(): void {
    this.listeners.get("close")?.({});
  }
  addEventListener(type: string, listener: (ev: unknown) => void): void {
    this.listeners.set(type, listener);
  }
  emit(frame: Record<string, unknown>): void {
    this.listeners.get("message")?.({ data: JSON.stringify(frame) });
  }
}

function stubAgent(impl: (req: IncomingRequest) => Promise<IncomingResult>): AgentService {
  return { handleIncoming: impl, shutdown() {} } as unknown as AgentService;
}

function makeRestFetch() {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
    const path = url.replace(/^https:\/\/discord\.com\/api\/v10/, "");
    posts.push({ path, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {} });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: "1" }), text: () => Promise.resolve("") } as Response);
  };
  return { fetchImpl, posts };
}

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "discord-adapter-test-"));
  return { db: openBridgeDb(cwd), cwd };
}

async function settle() {
  await new Promise((r) => setTimeout(r, 20));
}

let msgSeq = 1;
function drive(ws: FakeWs, msg: Record<string, unknown>) {
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 999999 } });
  ws.emit({ op: OP.DISPATCH, t: "READY", s: 1, d: { session_id: "s" } });
  ws.emit({ op: OP.DISPATCH, t: "MESSAGE_CREATE", s: 2, d: { id: `auto-${msgSeq++}`, ...msg } });
}

test("allowlisted channel message drives the agent and replies", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const seen: string[] = [];
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async (req) => {
        seen.push(req.text);
        return { ok: true, text: "discord reply" };
      }),
    });
    await adapter.start();
    drive(ws, { content: "hey bot", channel_id: "chan-1", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();

    assert.deepEqual(seen, ["hey bot"]);
    assert.ok(posts.some((p) => p.path.includes("/messages") && p.body.content === "discord reply"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("bot-authored and non-allowlisted messages are ignored", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl } = makeRestFetch();
    let ws!: FakeWs;
    let called = false;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async () => {
        called = true;
        return { ok: true, text: "x" };
      }),
    });
    await adapter.start();
    drive(ws, { content: "from a bot", channel_id: "chan-1", author: { id: "b", bot: true } });
    drive(ws, { content: "from elsewhere", channel_id: "other", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();
    assert.equal(called, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("duplicate MESSAGE_CREATE (same id) runs the agent only once", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl } = makeRestFetch();
    let ws!: FakeWs;
    let calls = 0;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async () => {
        calls += 1;
        return { ok: true, text: "ok" };
      }),
    });
    await adapter.start();
    ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 999999 } });
    ws.emit({ op: OP.DISPATCH, t: "READY", s: 1, d: { session_id: "s" } });
    const dup = { id: "dup-1", content: "hi", channel_id: "chan-1", author: { id: "u", bot: false } };
    ws.emit({ op: OP.DISPATCH, t: "MESSAGE_CREATE", s: 2, d: dup });
    ws.emit({ op: OP.DISPATCH, t: "MESSAGE_CREATE", s: 3, d: dup }); // gateway resume redelivery
    await settle();
    adapter.stop();
    assert.equal(calls, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("!cxc start pairs a channel when the handshake window is open", async () => {
  const { db, cwd } = tempDb();
  try {
    db.setChannelToken("discord", "T");
    const { fetchImpl } = makeRestFetch();
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async () => ({ ok: true, text: "" })),
    });
    await adapter.start();
    drive(ws, { content: "!cxc start", channel_id: "chan-x", author: { id: "u", bot: false } });
    await settle();
    assert.equal(db.isAllowed("discord", "chan-x"), false); // window closed

    db.openHandshake("discord", 60);
    ws.emit({ op: OP.DISPATCH, t: "MESSAGE_CREATE", s: 3, d: { content: "!cxc start", channel_id: "chan-x", author: { id: "u", bot: false } } });
    await settle();
    adapter.stop();
    assert.equal(db.isAllowed("discord", "chan-x"), true); // window open → paired
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
