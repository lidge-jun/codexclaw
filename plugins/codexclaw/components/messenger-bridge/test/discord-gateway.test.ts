/** discord-gateway.test.ts — opcode lifecycle driven by a fake WebSocket. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscordGateway, OP, INTENTS, type DiscordGatewayOptions, type WsLike } from "../src/discord-gateway.ts";
import type { DiscordMessageEvent } from "../src/discord-gateway.ts";
import type { Interaction } from "../src/discord-interactions.ts";

interface Sent {
  op: number;
  d: unknown;
}

class FakeWs implements WsLike {
  sent: Sent[] = [];
  closed = false;
  private listeners = new Map<string, (ev: unknown) => void>();

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Sent);
  }
  close(): void {
    this.closed = true;
    this.listeners.get("close")?.({});
  }
  addEventListener(type: string, listener: (ev: unknown) => void): void {
    this.listeners.set(type, listener);
  }
  /** Simulate the server pushing a gateway frame. */
  emit(frame: Record<string, unknown>): void {
    this.listeners.get("message")?.({ data: JSON.stringify(frame) });
  }
}

function makeGateway(
  onMessage: (m: DiscordMessageEvent) => void = () => {},
  opts: Partial<Pick<DiscordGatewayOptions, "onInteraction" | "onReady">> = {},
) {
  let ws: FakeWs | null = null;
  const gw = new DiscordGateway({
    token: "tok",
    onMessage,
    ...opts,
    jitter: () => 0, // fire the first heartbeat immediately
    wsFactory: () => {
      ws = new FakeWs();
      return ws;
    },
  });
  return { gw, getWs: () => ws as FakeWs };
}

test("Hello → identify with the right intents, then READY", () => {
  const { gw, getWs } = makeGateway();
  gw.connect();
  const ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 41250 } });

  const identify = ws.sent.find((s) => s.op === OP.IDENTIFY);
  assert.ok(identify, "should send Identify");
  const d = identify!.d as { token: string; intents: number; properties: Record<string, string> };
  assert.equal(d.token, "tok");
  assert.equal(d.intents, INTENTS);
  assert.equal(d.properties.browser, "codexclaw");

  ws.emit({ op: OP.DISPATCH, t: "READY", s: 1, d: { session_id: "sess-1" } });
  assert.equal(gw.status(), "ready");
  gw.stop();
});

test("READY captures application.id and exposes it through onReady + getter", () => {
  const ready: Array<{ botUserId: string | null; applicationId: string | null }> = [];
  const { gw, getWs } = makeGateway(() => {}, { onReady: (data) => ready.push(data) });
  gw.connect();
  const ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  ws.emit({
    op: OP.DISPATCH,
    t: "READY",
    s: 1,
    d: { session_id: "sess-1", user: { id: "bot-1" }, application: { id: "app-1" } },
  });
  assert.equal(gw.botUserId(), "bot-1");
  assert.equal(gw.applicationId(), "app-1");
  assert.deepEqual(ready, [{ botUserId: "bot-1", applicationId: "app-1" }]);
  gw.stop();
});

test("heartbeat carries the last sequence number", () => {
  const { gw, getWs } = makeGateway();
  gw.connect();
  const ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  ws.emit({ op: OP.DISPATCH, t: "READY", s: 5, d: { session_id: "s" } });
  ws.emit({ op: OP.HEARTBEAT, d: null }); // server-requested immediate beat
  const hb = ws.sent.find((s) => s.op === OP.HEARTBEAT);
  assert.ok(hb);
  assert.equal(hb!.d, 5);
  gw.stop();
});

test("MESSAGE_CREATE dispatch surfaces a normalized event", () => {
  const seen: DiscordMessageEvent[] = [];
  const { gw, getWs } = makeGateway((m) => seen.push(m));
  gw.connect();
  const ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  ws.emit({
    op: OP.DISPATCH,
    t: "MESSAGE_CREATE",
    s: 2,
    d: { id: "m1", content: "hello", channel_id: "c1", guild_id: "g1", author: { id: "u1", bot: false } },
  });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], {
    id: "m1",
    content: "hello",
    channelId: "c1",
    authorId: "u1",
    isBot: false,
    guildId: "g1",
    messageReference: null,
    attachments: [],
  });
  gw.stop();
});

test("MESSAGE_CREATE dispatch includes normalized attachments", () => {
  const seen: DiscordMessageEvent[] = [];
  const { gw, getWs } = makeGateway((m) => seen.push(m));
  gw.connect();
  const ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  ws.emit({
    op: OP.DISPATCH,
    t: "MESSAGE_CREATE",
    s: 2,
    d: {
      id: "m1",
      content: "see file",
      channel_id: "c1",
      author: { id: "u1", bot: false },
      attachments: [{ id: "a1", filename: "note.txt", url: "https://cdn.example/note.txt", content_type: "text/plain", size: 5 }],
    },
  });
  assert.deepEqual(seen[0].attachments, [
    { id: "a1", filename: "note.txt", url: "https://cdn.example/note.txt", content_type: "text/plain", size: 5 },
  ]);
  gw.stop();
});

test("INTERACTION_CREATE dispatch surfaces the raw interaction", () => {
  const seen: Interaction[] = [];
  const { gw, getWs } = makeGateway(() => {}, { onInteraction: (interaction) => seen.push(interaction) });
  gw.connect();
  const ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  ws.emit({
    op: OP.DISPATCH,
    t: "INTERACTION_CREATE",
    s: 2,
    d: { id: "i1", type: 2, token: "tok", channel_id: "c1", data: { name: "ask" } },
  });
  assert.deepEqual(seen, [{ id: "i1", type: 2, token: "tok", channel_id: "c1", data: { name: "ask" } }]);
  gw.stop();
});

test("invalid session (d=false) drops session and re-identifies on reconnect", () => {
  const { gw, getWs } = makeGateway();
  gw.connect();
  let ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  ws.emit({ op: OP.DISPATCH, t: "READY", s: 1, d: { session_id: "sess-1" } });

  ws.emit({ op: OP.INVALID_SESSION, d: false });
  // reconnect() opened a fresh socket; the new Hello should re-IDENTIFY (not resume)
  ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  assert.ok(ws.sent.some((s) => s.op === OP.IDENTIFY), "re-identify after invalid session");
  assert.ok(!ws.sent.some((s) => s.op === OP.RESUME));
  gw.stop();
});

test("reconnect after READY resumes with session id + seq", () => {
  const { gw, getWs } = makeGateway();
  gw.connect();
  let ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  ws.emit({ op: OP.DISPATCH, t: "READY", s: 3, d: { session_id: "sess-9" } });

  ws.emit({ op: OP.RECONNECT, d: null });
  ws = getWs();
  ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 30 } });
  const resume = ws.sent.find((s) => s.op === OP.RESUME);
  assert.ok(resume, "should resume");
  const d = resume!.d as { session_id: string; seq: number };
  assert.equal(d.session_id, "sess-9");
  assert.equal(d.seq, 3);
  gw.stop();
});
