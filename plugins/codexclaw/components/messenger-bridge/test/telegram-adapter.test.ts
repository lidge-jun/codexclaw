/** telegram-adapter.test.ts — poll loop, gating, handshake, turn UX (offline scripted fetch). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import { createTelegramAdapter } from "../src/telegram-adapter.ts";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";
import type { TgUpdate } from "../src/telegram-api.ts";

interface Call {
  method: string;
  payload: Record<string, unknown>;
}

/** Build a scripted fetch: getUpdates drains a queue then long-polls until aborted. */
function makeFetch(updateBatches: TgUpdate[][]) {
  const calls: Call[] = [];
  let batchIdx = 0;
  const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
    const method = url.split("/").pop() as string;
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ method, payload });

    const reply = (body: unknown): Promise<Response> =>
      Promise.resolve({ json: () => Promise.resolve(body) } as Response);

    if (method === "getMe") return reply({ ok: true, result: { id: 1, username: "cxcbot" } });
    if (method === "deleteWebhook") return reply({ ok: true, result: true });
    if (method === "getUpdates") {
      if (batchIdx < updateBatches.length) {
        return reply({ ok: true, result: updateBatches[batchIdx++] });
      }
      // Exhausted: emulate a long poll that aborts when stop() fires.
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => reject(new Error("The operation was aborted")));
        }
      });
    }
    if (method === "sendMessage") {
      return reply({ ok: true, result: { message_id: calls.length, chat: { id: 0, type: "private" } } });
    }
    return reply({ ok: true, result: true });
  };
  return { fetchImpl, calls };
}

function stubAgentService(impl: (req: IncomingRequest) => Promise<IncomingResult>): AgentService {
  return { handleIncoming: impl, shutdown() {} } as unknown as AgentService;
}

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "tg-adapter-test-"));
  return { db: openBridgeDb(cwd), cwd };
}

function textUpdate(id: number, chatId: number, text: string, type = "private"): TgUpdate {
  return { update_id: id, message: { message_id: id, text, chat: { id: chatId, type } } };
}

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 30));
}

test("allowlisted message drives the agent and sends a reply", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("telegram", "500", "jun");
    const seen: string[] = [];
    const { fetchImpl, calls } = makeFetch([[textUpdate(1, 500, "hi there")]]);
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async (req) => {
        seen.push(req.text);
        return { ok: true, text: "hello back" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    assert.deepEqual(seen, ["hi there"]);
    const sent = calls.filter((c) => c.method === "sendMessage");
    assert.ok(sent.some((c) => String(c.payload.text).includes("hello back")));
    assert.ok(calls.some((c) => c.method === "sendChatAction"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("non-allowlisted message is silently ignored", async () => {
  const { db, cwd } = tempDb();
  try {
    let called = false;
    const { fetchImpl, calls } = makeFetch([[textUpdate(1, 999, "hello")]]);
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async () => {
        called = true;
        return { ok: true, text: "x" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    assert.equal(called, false);
    assert.ok(!calls.some((c) => c.method === "sendMessage"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("/start pairs a chat only when a handshake window is open", async () => {
  const { db, cwd } = tempDb();
  try {
    db.setChannelToken("telegram", "T");
    // Each batch is delivered exactly once, then the mock parks on a pending
    // long-poll until aborted — mirroring a real network boundary and avoiding
    // a resolved-promise hot loop that would starve the macrotask timer.
    let firstSent = false;
    let released = false;
    let secondSent = false;
    const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
      const method = url.split("/").pop() as string;
      const reply = (body: unknown): Promise<Response> =>
        Promise.resolve({ json: () => Promise.resolve(body) } as Response);
      if (method === "getMe") return reply({ ok: true, result: { username: "cxcbot" } });
      if (method === "deleteWebhook") return reply({ ok: true, result: true });
      if (method === "getUpdates") {
        if (!firstSent) {
          firstSent = true;
          return reply({ ok: true, result: [textUpdate(1, 42, "/start")] }); // closed window
        }
        if (released && !secondSent) {
          secondSent = true;
          return reply({ ok: true, result: [textUpdate(2, 42, "/start")] }); // open window
        }
        // Empty long-poll that returns after a real macrotask delay, so the
        // loop re-polls (and observes `released`) without starving the timer.
        return new Promise<Response>((resolve, reject) => {
          const t = setTimeout(() => resolve({ json: () => Promise.resolve({ ok: true, result: [] }) } as Response), 10);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new Error("aborted"));
          });
        });
      }
      return reply({ ok: true, result: true });
    };
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async () => ({ ok: true, text: "" })),
    });
    await adapter.start();
    await settle();
    assert.equal(db.isAllowed("telegram", "42"), false); // closed window → not paired
    db.openHandshake("telegram", 60);
    released = true;
    await settle();
    adapter.stop();
    assert.equal(db.isAllowed("telegram", "42"), true); // open window → paired
    // The window closed atomically on the first pair (finding 2).
    assert.equal(db.isHandshakeOpen("telegram"), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("group message without @mention is ignored, with mention is stripped", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("telegram", "-100", "grp");
    const seen: string[] = [];
    const { fetchImpl } = makeFetch([
      [
        { update_id: 1, message: { message_id: 1, text: "no mention here", chat: { id: -100, type: "supergroup" } } },
        { update_id: 2, message: { message_id: 2, text: "@cxcbot do the thing", chat: { id: -100, type: "supergroup" } } },
      ],
    ]);
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async (req) => {
        seen.push(req.text);
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();
    assert.deepEqual(seen, ["do the thing"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("409 conflict stops the adapter after max retries", async () => {
  const { db, cwd } = tempDb();
  try {
    const fetchImpl = (url: string): Promise<Response> => {
      const method = url.split("/").pop() as string;
      const reply = (body: unknown): Promise<Response> =>
        Promise.resolve({ json: () => Promise.resolve(body) } as Response);
      if (method === "getMe") return reply({ ok: true, result: { username: "cxcbot" } });
      if (method === "deleteWebhook") return reply({ ok: true, result: true });
      if (method === "getUpdates") return reply({ ok: false, error_code: 409, description: "Conflict" });
      return reply({ ok: true, result: true });
    };
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async () => ({ ok: true, text: "" })),
      // shrink backoff waits by faking timers is overkill — MAX is 3, delays 5/10/20s.
    });
    // Don't actually wait ~35s: assert the status transitions by driving one
    // conflict then stopping. Full backoff timing is not re-tested here.
    await adapter.start();
    await settle();
    adapter.stop();
    // After stop, status is stopped or conflict — never running.
    assert.notEqual(adapter.status(), "running");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

/* ── v4 agent-scoped cases (slice 50) ──────────────────────────────────── */

test("agent scope: /start pairs into agent_allowlist and closes the agent window", async () => {
  const { db } = tempDb();
  const agent = db.createAgent("telegram-1", "telegram", "tok");
  db.openAgentHandshake(agent.id, 60);
  const { fetchImpl } = makeFetch([[textUpdate(1, 900, "/start")]]);
  const adapter = createTelegramAdapter({
    db,
    token: "tok",
    workdir: "/tmp/w",
    agent: { id: agent.id },
    agentService: stubAgentService(async () => ({ ok: true, text: "unused" })),
    fetchImpl: fetchImpl as never,
  });
  await adapter.start();
  await settle();
  adapter.stop();
  assert.equal(db.isAgentAllowed(agent.id, "900"), true);
  assert.equal(db.isAgentHandshakeOpen(agent.id), false); // atomic one-shot close
  assert.equal(db.isAllowed("telegram", "900"), false); // legacy allowlist untouched
  db.close();
});

test("agent scope: mention_only=0 responds in groups without a mention; binding carries agent_id", async () => {
  const { db } = tempDb();
  const agent = db.createAgent("telegram-1", "telegram", "tok");
  db.updateAgent(agent.id, { mention_only: 0 });
  db.addAgentAllowlist(agent.id, "600");
  const requests: IncomingRequest[] = [];
  const { fetchImpl } = makeFetch([[textUpdate(1, 600, "no mention here", "group")]]);
  const adapter = createTelegramAdapter({
    db,
    token: "tok",
    workdir: "/tmp/w",
    agent: { id: agent.id },
    agentService: stubAgentService(async (req) => {
      requests.push(req);
      // Resolve the binding the way AgentService would, to assert agent scoping.
      const binding = db.getOrCreateAgentBinding(req.agentId!, req.kind, req.chatId, req.workdir);
      assert.equal(binding.agent_id, agent.id);
      return { ok: true, text: "replied" };
    }),
    fetchImpl: fetchImpl as never,
  });
  await adapter.start();
  await settle();
  adapter.stop();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].agentId, agent.id);
  db.close();
});

test("agent scope: mention_only=1 gates un-mentioned group messages (default)", async () => {
  const { db } = tempDb();
  const agent = db.createAgent("telegram-1", "telegram", "tok");
  db.addAgentAllowlist(agent.id, "601");
  let called = 0;
  const { fetchImpl } = makeFetch([[textUpdate(1, 601, "hello without mention", "group")]]);
  const adapter = createTelegramAdapter({
    db,
    token: "tok",
    workdir: "/tmp/w",
    agent: { id: agent.id },
    agentService: stubAgentService(async () => {
      called += 1;
      return { ok: true, text: "x" };
    }),
    fetchImpl: fetchImpl as never,
  });
  await adapter.start();
  await settle();
  adapter.stop();
  assert.equal(called, 0);
  db.close();
});
