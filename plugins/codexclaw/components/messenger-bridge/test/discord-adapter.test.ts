/** discord-adapter.test.ts — REST chunking + adapter gating over injected fetch/ws. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DiscordApi, chunkDiscordMessage } from "../src/discord-api.ts";
import { createDiscordAdapter } from "../src/discord-adapter.ts";
import { OP, type WsLike } from "../src/discord-gateway.ts";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";
import type { ApprovalRequest } from "../src/approval-relay.ts";

test("chunkDiscordMessage splits at 2000 and preserves content", () => {
  assert.deepEqual(chunkDiscordMessage("short"), ["short"]);
  const long = "line\n".repeat(600); // 3000 chars
  const chunks = chunkDiscordMessage(long);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(c.length <= 2000);
  assert.equal(chunks.join("\n").replace(/\n+/g, "\n"), long.replace(/\n+/g, "\n"));
});

test("DiscordApi new REST helpers use expected paths and multipart body", async () => {
  const calls: Array<{ path: string; method: string; headers: Record<string, string>; body: unknown }> = [];
  const api = new DiscordApi("T", async (url, init) => {
    calls.push({
      path: url.replace(/^https:\/\/discord\.com\/api\/v10/, ""),
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string>,
      body: init?.body,
    });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ id: "ok", name: "thread" }),
      text: () => Promise.resolve(""),
    } as unknown as Response;
  });

  await api.createInteractionResponse("i1", "tok", { type: 1 });
  await api.editOriginalInteractionResponse("app", "tok", { content: "done" });
  await api.registerGlobalCommands("app", [{ name: "ask" }]);
  await api.startThread("chan", "Thread", "msg");
  await api.startForumThread("forum", "Forum Thread", { content: "seed" }, ["tag-1"]);
  await api.archiveThread("thread-ok");
  await api.editMessage("chan", "msg", "edited", [{ description: "embed" }]);
  await api.sendFile("chan", "file attached", [{ name: "note.txt", data: "hello", contentType: "text/plain" }]);

  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
    "POST /interactions/i1/tok/callback",
    "PATCH /webhooks/app/tok/messages/@original",
    "PUT /applications/app/commands",
    "POST /channels/chan/messages/msg/threads",
    "POST /channels/forum/threads",
    "PATCH /channels/thread-ok",
    "PATCH /channels/chan/messages/msg",
    "POST /channels/chan/messages",
  ]);
  assert.deepEqual(JSON.parse(String(calls[4].body)), {
    name: "Forum Thread",
    auto_archive_duration: 60,
    message: { content: "seed" },
    applied_tags: ["tag-1"],
  });
  assert.deepEqual(JSON.parse(String(calls[5].body)), { archived: true });
  assert.match(calls[7].headers["content-type"], /^multipart\/form-data; boundary=codexclaw-/);
  assert.match(new TextDecoder().decode(calls[7].body as Uint8Array), /payload_json/);
  assert.match(new TextDecoder().decode(calls[7].body as Uint8Array), /note\.txt/);
});

test("DiscordApi redacts interaction and webhook tokens from error strings", async () => {
  const api = new DiscordApi("T", async () => ({
    ok: false,
    status: 401,
    headers: { get: () => null },
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("unauthorized"),
  }) as unknown as Response);

  const interaction = await api.createInteractionResponse("i1", "interaction-secret", { type: 1 });
  assert.equal(interaction.ok, false);
  assert.match(interaction.error ?? "", /\/interactions\/i1\/\*\*\*\/callback/);
  assert.doesNotMatch(interaction.error ?? "", /interaction-secret/);

  const webhook = await api.editOriginalInteractionResponse("app-1", "webhook-secret", { content: "x" });
  assert.equal(webhook.ok, false);
  assert.match(webhook.error ?? "", /\/webhooks\/app-1\/\*\*\*\/messages\/@original/);
  assert.doesNotMatch(webhook.error ?? "", /webhook-secret/);
});

test("DiscordApi suppresses notifications only when explicitly requested", async () => {
  const bodies: unknown[] = [];
  const api = new DiscordApi("T", async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return {
      ok: true, status: 200, headers: { get: () => null },
      json: () => Promise.resolve({ id: "ok" }), text: () => Promise.resolve(""),
    } as unknown as Response;
  });
  await api.sendMessage("chan", "progress", { suppressNotifications: true });
  await api.sendEmbed("chan", "", [{ description: "progress" }], undefined, { suppressNotifications: true });
  await api.sendMessage("chan", "final");
  assert.deepEqual(bodies, [
    { content: "progress", flags: 4096 },
    { content: "", embeds: [{ description: "progress" }], flags: 4096 },
    { content: "final" },
  ]);
});

test("DiscordApi sendFile retries multipart 429 retry_after once", async () => {
  let calls = 0;
  const api = new DiscordApi("T", async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 429,
        headers: { get: () => null },
        json: () => Promise.resolve({ retry_after: 0 }),
        text: () => Promise.resolve("rate limited"),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ id: "ok" }),
      text: () => Promise.resolve(""),
    } as unknown as Response;
  });

  const res = await api.sendFile("chan", "attached", [{ name: "note.txt", data: "hello" }]);
  assert.equal(res.ok, true);
  assert.equal(calls, 2);
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
  return { handleIncoming: impl, registerApprovalCleanup: () => true, shutdown() {} } as unknown as AgentService;
}

function makeRestFetch(responseFor?: (call: { path: string; method: string; body: unknown }) => Response | undefined) {
  const posts: Array<{ path: string; method: string; body: unknown }> = [];
  const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
    if (url.startsWith("https://cdn.example/")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode("hello").buffer),
      } as Response);
    }
    const path = url.replace(/^https:\/\/discord\.com\/api\/v10/, "");
    const body = init?.body instanceof Uint8Array
      ? init.body
      : init?.body
        ? JSON.parse(String(init.body))
        : {};
    const call = { path, method: init?.method ?? "GET", body };
    posts.push(call);
    const custom = responseFor?.(call);
    if (custom) return Promise.resolve(custom);
    const data = path.includes("/threads")
      ? { id: "thread-1", name: "thread" }
      : path === "/users/@me"
        ? { id: "app-fallback", username: "bot" }
        : { id: "1" };
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(""),
    } as unknown as Response);
  };
  return { fetchImpl, posts };
}

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "discord-adapter-test-"));
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

async function settle() {
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
    const progress = posts.find((p) => p.path === "/channels/chan-1/messages" && Array.isArray((p.body as { embeds?: unknown[] }).embeds));
    assert.ok(progress, "turn should create a progress embed message");
    assert.ok(posts.some((p) => p.path === "/channels/chan-1/messages/1" && p.method === "PATCH"), "progress embed should be edited");
    const reply = posts.find((p) => p.path === "/channels/chan-1/messages" && (p.body as { content?: string }).content === "discord reply");
    assert.ok(reply, "final reply should be a fresh Discord message");
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
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
    await settle();
    db.close();
    rmRfRetry(cwd);
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
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("message attachments are downloaded, prefixed into prompt, and cleaned up", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl } = makeRestFetch();
    let ws!: FakeWs;
    let downloadedPath = "";
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async (req) => {
        const match = /^\[File: (.+note\.txt)\]\nplease inspect$/.exec(req.text);
        assert.ok(match, `prompt should include attachment prefix, got: ${req.text}`);
        downloadedPath = match[1];
        assert.equal(readFileSync(downloadedPath, "utf8"), "hello");
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    drive(ws, {
      id: "with-attachment",
      content: "please inspect",
      channel_id: "chan-1",
      author: { id: "u", bot: false },
      attachments: [{ id: "a1", filename: "note.txt", url: "https://cdn.example/note.txt", content_type: "text/plain", size: 5 }],
    });
    await settle();
    await waitFor(() => Boolean(downloadedPath) && !existsSync(downloadedPath), "attachment temp file cleanup");
    adapter.stop();

    assert.ok(downloadedPath);
    assert.equal(existsSync(downloadedPath), false);
    assert.equal(existsSync(dirname(downloadedPath)), false);
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("gateway progress edits one status embed and sanitizes mentions", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async (req) => {
        req.onEvent?.({ kind: "tool_call", phase: "started", callId: "tool-1", name: "check", input: "@everyone <@123>" });
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    drive(ws, { content: "work", channel_id: "chan-1", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();

    const edits = posts.filter((p) => p.path === "/channels/chan-1/messages/1" && p.method === "PATCH");
    assert.ok(edits.length >= 1);
    const body = JSON.stringify(edits.map((edit) => edit.body));
    assert.match(body, /\[everyone\]/);
    assert.doesNotMatch(body, /@everyone|<@123>/);
    const progressSend = posts.find((p) => p.path === "/channels/chan-1/messages" && JSON.stringify(p.body).includes("Starting turn"));
    assert.equal((progressSend?.body as { flags?: number } | undefined)?.flags, 4096);
    const finalSend = posts.find((p) => p.path === "/channels/chan-1/messages" && (p.body as { content?: string }).content === "done");
    assert.equal((finalSend?.body as { flags?: number } | undefined)?.flags, undefined);
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("gateway progress edit throttle honors the 1200ms boundary with injected clock", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    let now = 1000;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      now: () => now,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async (req) => {
        req.onEvent?.({ kind: "tool_call", phase: "started", callId: "first", name: "first", input: "" });
        await new Promise((resolve) => setImmediate(resolve));
        now = 2199;
        req.onEvent?.({ kind: "tool_call", phase: "started", callId: "too-soon", name: "too-soon", input: "" });
        await new Promise((resolve) => setImmediate(resolve));
        now = 2200;
        req.onEvent?.({ kind: "tool_call", phase: "started", callId: "boundary", name: "boundary", input: "" });
        await new Promise((resolve) => setImmediate(resolve));
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    drive(ws, { content: "work", channel_id: "chan-1", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();

    const edits = posts.filter((p) => p.path === "/channels/chan-1/messages/1" && p.method === "PATCH");
    const body = JSON.stringify(edits.map((edit) => edit.body));
    assert.match(body, /first/);
    assert.match(body, /boundary/);
    assert.doesNotMatch(body, /too-soon/);
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("long gateway final output is sent as a Discord file attachment", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async () => ({ ok: true, text: "line\n".repeat(101) })),
    });
    await adapter.start();
    drive(ws, { content: "long output please", channel_id: "chan-1", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();

    const multipart = posts.find((p) => p.path === "/channels/chan-1/messages" && p.body instanceof Uint8Array);
    assert.ok(multipart, "long final output should use multipart sendFile");
    assert.match(new TextDecoder().decode(multipart?.body as Uint8Array), /codex-output-1\.txt/);
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("!cxc retry sends Discord approval cards through the text command path", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const binding = db.getOrCreateBinding("discord", "chan-1", cwd);
    db.createJob(binding.id, "last prompt");
    const approval: ApprovalRequest = {
      id: "ap_dc_retry",
      bindingId: binding.id,
      promptHash: "hash-dc",
      workdir: cwd,
      expiresAt: 123,
    };
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async (req) => {
        assert.equal(req.text, "last prompt");
        await req.onApprovalRequest?.(approval);
        return { ok: false, error: "approval required" };
      }),
    });
    await adapter.start();
    drive(ws, { content: "!cxc retry", channel_id: "chan-1", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();

    const approvalPost = posts.find((p) =>
      p.path === "/channels/chan-1/messages" &&
      JSON.stringify(p.body).includes("approval:ap_dc_retry:allow-once")
    );
    assert.ok(approvalPost, "text retry should send an actionable approval card");
    assert.match(JSON.stringify(approvalPost?.body), /Approval required before Codex can run/);
    const denial = posts.find((p) =>
      p.path === "/channels/chan-1/messages" && (p.body as { content?: string }).content === "❌ approval required"
    );
    assert.ok(denial, "retry command should still report the gated turn result");
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("!cxc retry sends its result before finishing progress with the real outcome", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const binding = db.getOrCreateBinding("discord", "chan-1", cwd);
    db.createJob(binding.id, "last prompt");
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async (req) => {
        req.onEvent?.({ kind: "tool_call", phase: "started", callId: "retrying", name: "retrying", input: "" });
        return { ok: true, text: "retried answer" };
      }),
    });
    await adapter.start();
    drive(ws, { content: "!cxc retry", channel_id: "chan-1", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();

    const resultAt = posts.findIndex((post) =>
      post.path === "/channels/chan-1/messages" && (post.body as { content?: string }).content === "retried answer"
    );
    const doneAt = posts.findIndex((post) =>
      post.method === "PATCH" && JSON.stringify(post.body).includes("Done: Final answer sent as a fresh message.")
    );
    assert.ok(posts.some((post) => post.method === "PATCH" && JSON.stringify(post.body).includes("retrying")));
    assert.ok(resultAt >= 0 && doneAt > resultAt);
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("!cxc retry finishes as error for failed turns and failed result delivery", async () => {
  for (const scenario of ["turn", "send"] as const) {
    const { db, cwd } = tempDb();
    try {
      db.addAllowlist("discord", "chan-1", "");
      const binding = db.getOrCreateBinding("discord", "chan-1", cwd);
      db.createJob(binding.id, "last prompt");
      const { fetchImpl, posts } = makeRestFetch((call) => {
        if (scenario !== "send" || (call.body as { content?: string }).content !== "retried answer") return undefined;
        return {
          ok: false,
          status: 500,
          headers: { get: () => null },
          json: () => Promise.resolve({}),
          text: () => Promise.resolve("send failed"),
        } as unknown as Response;
      });
      let ws!: FakeWs;
      const adapter = createDiscordAdapter({
        db,
        token: "T",
        workdir: cwd,
        fetchImpl,
        wsFactory: () => (ws = new FakeWs()),
        agentService: stubAgent(async () => scenario === "turn"
          ? { ok: false, error: "turn failed" }
          : { ok: true, text: "retried answer" }),
      });
      await adapter.start();
      drive(ws, { content: "!cxc retry", channel_id: "chan-1", author: { id: "u", bot: false } });
      await settle();
      adapter.stop();

      const finalEdit = posts.filter((post) => post.method === "PATCH").at(-1);
      assert.match(JSON.stringify(finalEdit?.body), /Error:/, scenario);
      assert.doesNotMatch(JSON.stringify(finalEdit?.body), /Done:/, scenario);
    } finally {
      await settle();
      db.close();
      rmRfRetry(cwd);
    }
  }
});

test("!cxc retry still finishes progress when dispatch throws", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const binding = db.getOrCreateBinding("discord", "chan-1", cwd);
    db.createJob(binding.id, "last prompt");
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async () => { throw new Error("dispatch exploded"); }),
    });
    await adapter.start();
    drive(ws, { content: "!cxc retry", channel_id: "chan-1", author: { id: "u", bot: false } });
    await settle();
    adapter.stop();

    const finalEdit = posts.filter((post) => post.method === "PATCH").at(-1);
    assert.match(JSON.stringify(finalEdit?.body), /Error: dispatch exploded/);
    assert.equal(posts.some((post) => (post.body as { content?: string }).content === "retried answer"), false);
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});


test("READY application id registers global slash commands", async () => {
  const { db, cwd } = tempDb();
  try {
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async () => ({ ok: true, text: "unused" })),
    });
    await adapter.start();
    ws.emit({ op: OP.HELLO, d: { heartbeat_interval: 999999 } });
    ws.emit({
      op: OP.DISPATCH,
      t: "READY",
      s: 1,
      d: { session_id: "s", user: { id: "bot-1" }, application: { id: "app-ready" } },
    });
    await settle();
    adapter.stop();

    const readyRegistration = posts.find((p) => p.path === "/applications/app-ready/commands");
    assert.ok(readyRegistration, "READY application.id should drive command registration");
    assert.ok(JSON.stringify(readyRegistration?.body).includes('"ask"'));
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("allowed slash interactions defer before getMe fallback", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const calls: Array<{ path: string; body: unknown }> = [];
    const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
      const path = url.replace(/^https:\/\/discord\.com\/api\/v10/, "");
      calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : {} });
      const data = path === "/users/@me" ? { id: "app-fallback", username: "bot" } : { id: "m" };
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(""),
      } as unknown as Response);
    };
    let ws!: FakeWs;
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async () => ({ ok: true, text: "ack-safe" })),
    });
    await adapter.start();
    ws.emit({
      op: OP.DISPATCH,
      t: "INTERACTION_CREATE",
      s: 1,
      d: {
        id: "i-ack",
        type: 2,
        token: "interaction-token",
        channel_id: "chan-1",
        data: { name: "ask", options: [{ name: "prompt", type: 3, value: "hello" }] },
      },
    });
    await settle();
    adapter.stop();

    assert.equal(calls[0]?.path, "/interactions/i-ack/interaction-token/callback");
    assert.deepEqual(calls[0]?.body, { type: 5 });
    assert.equal(calls[1]?.path, "/users/@me");
    assert.ok(calls.some((call) => call.path === "/webhooks/app-fallback/interaction-token/messages/@original"));
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("failed native interaction defer prevents turn execution", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const { fetchImpl, posts } = makeRestFetch((call) => {
      if (call.path.includes("/interactions/i-defer-fail/") && call.path.endsWith("/callback")) {
        return {
          ok: false,
          status: 401,
          headers: { get: () => null },
          json: () => Promise.resolve({}),
          text: () => Promise.resolve("defer rejected"),
        } as unknown as Response;
      }
      return undefined;
    });
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
        return { ok: true, text: "must not run" };
      }),
    });
    await adapter.start();
    ws.emit({
      op: OP.DISPATCH,
      t: "INTERACTION_CREATE",
      s: 1,
      d: {
        id: "i-defer-fail",
        type: 2,
        token: "interaction-token",
        channel_id: "chan-1",
        data: { name: "ask", options: [{ name: "prompt", type: 3, value: "hello" }] },
      },
    });
    await settle();
    adapter.stop();
    assert.equal(called, false);
    assert.equal(posts.some((call) => call.path === "/users/@me"), false);
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});

test("guild messages start a reply thread and send the final embed there", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "parent-chan", "");
    const { fetchImpl, posts } = makeRestFetch();
    let ws!: FakeWs;
    const requests: IncomingRequest[] = [];
    const adapter = createDiscordAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      wsFactory: () => (ws = new FakeWs()),
      agentService: stubAgent(async (req) => {
        requests.push(req);
        return { ok: true, text: "thread reply" };
      }),
    });
    await adapter.start();
    drive(ws, {
      id: "msg-thread",
      content: "please work in a thread",
      channel_id: "parent-chan",
      guild_id: "guild-1",
      author: { id: "u", bot: false },
    });
    await settle();
    adapter.stop();

    assert.ok(posts.some((p) => p.path === "/channels/parent-chan/messages/msg-thread/threads"));
    assert.equal(requests[0].chatId, "thread-1");
    assert.equal(db.isAllowed("discord", "thread-1"), true);
    assert.ok(posts.some((p) => p.path === "/channels/thread-1/messages" && Array.isArray((p.body as { embeds?: unknown[] }).embeds)), "thread should receive progress embed");
    const threadReply = posts.find((p) => p.path === "/channels/thread-1/messages" && (p.body as { content?: string }).content === "thread reply");
    assert.ok(threadReply, "fresh reply should be sent to the created thread");
    assert.ok(posts.some((p) => p.path === "/channels/thread-1" && p.method === "PATCH" && (p.body as { archived?: boolean }).archived === true));
  } finally {
    await settle();
    db.close();
    rmRfRetry(cwd);
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
    await settle();
    db.close();
    rmRfRetry(cwd);
  }
});
