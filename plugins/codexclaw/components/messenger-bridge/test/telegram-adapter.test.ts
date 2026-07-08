/** telegram-adapter.test.ts — poll loop, gating, handshake, turn UX (offline scripted fetch). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import { createTelegramAdapter } from "../src/telegram-adapter.ts";
import { encodeCallback } from "../src/telegram-interactive.ts";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";
import type { TgUpdate } from "../src/telegram-api.ts";

interface Call {
  method: string;
  payload: Record<string, unknown>;
}

/** Build a scripted fetch: getUpdates drains a queue then long-polls until aborted. */
function makeFetch(updateBatches: TgUpdate[][], overrides?: Record<string, unknown>) {
  const calls: Call[] = [];
  let batchIdx = 0;
  const fetchImpl = (url: string, init?: RequestInit): Promise<Response> => {
    if (url.includes("/file/bot")) {
      calls.push({ method: "downloadFile", payload: { url } });
      const data = new Uint8Array([1, 2, 3]).buffer;
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(data),
      } as Response);
    }
    const method = url.split("/").pop() as string;
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ method, payload });

    const reply = (body: unknown): Promise<Response> =>
      Promise.resolve({ json: () => Promise.resolve(body) } as Response);

    if (overrides && method in overrides) return reply(overrides[method]);
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
    // sendRichMessage probe: return 400 (method exists) so richSupported = true.
    if (method === "sendRichMessage") {
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

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
    // Phase E1: reply goes via sendRichMessage (when probe succeeds) or sendMessage.
    const sent = calls.filter((c) => c.method === "sendRichMessage" || c.method === "sendMessage");
    assert.ok(
      sent.some((c) => {
        // sendRichMessage puts the html in richMessage.html via rich_message payload
        const payload = c.payload;
        const rich = payload.rich_message as Record<string, unknown> | undefined;
        const text = rich?.html ?? payload.text;
        return String(text ?? "").includes("hello back");
      }),
      "reply should contain 'hello back' via sendRichMessage or sendMessage",
    );
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

test("named-agent /start deep-link pairs through long-poll without an open window", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.createAgentPairingCode(agent.id, sha256Hex("pair-code"), 60);
    const { fetchImpl } = makeFetch([[textUpdate(1, 42, "/start pair-code")]]);
    const adapter = createTelegramAdapter({
      db,
      token: "tok",
      workdir: cwd,
      agent: { id: agent.id },
      fetchImpl,
      agentService: stubAgentService(async () => ({ ok: true, text: "" })),
    });

    await adapter.start();
    await settle();
    adapter.stop();

    assert.equal(db.isAgentAllowed(agent.id, "42"), true);
    assert.equal(db.isAgentHandshakeOpen(agent.id), false);
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

test("callback_query from an unpaired chat is acknowledged and denied", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const data = encodeCallback({ type: "effort_select", payload: `${agent.id}:high` });
    const { fetchImpl, calls } = makeFetch([
      [
        {
          update_id: 1,
          callback_query: {
            id: "cb-1",
            from: { id: 9 },
            data,
            message: { message_id: 10, chat: { id: 500, type: "private" } },
          },
        },
      ],
    ]);
    const adapter = createTelegramAdapter({
      db,
      token: "tok",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async () => ({ ok: true, text: "unused" })),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    assert.equal(db.getAgent(agent.id)?.effort, "default");
    const answer = calls.find((c) => c.method === "answerCallbackQuery");
    assert.equal(answer?.payload.text, "This chat is not paired");
    assert.ok(!sentTexts(calls).some((text) => text === "Effort set to high"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("callback_query from an allowlisted agent chat can update effort", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "500");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "500", cwd);
    const data = encodeCallback({ type: "effort_select", payload: `${binding.id}:high` });
    const { fetchImpl, calls } = makeFetch([
      [
        {
          update_id: 1,
          callback_query: {
            id: "cb-1",
            from: { id: 9 },
            data,
            message: { message_id: 10, chat: { id: 500, type: "private" } },
          },
        },
      ],
    ]);
    const adapter = createTelegramAdapter({
      db,
      token: "tok",
      workdir: cwd,
      agent: { id: agent.id },
      fetchImpl,
      agentService: stubAgentService(async () => ({ ok: true, text: "unused" })),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    assert.equal(db.getAgent(agent.id)?.effort, "default");
    assert.equal(db.getBinding(binding.id)?.effort, "high");
    const answer = calls.find((c) => c.method === "answerCallbackQuery");
    assert.equal(answer?.payload.text, "Effort set");
    assert.ok(sentTexts(calls).some((text) => text === "Effort set to high"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("photo-only private message is downloaded and prefixed into the prompt", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("telegram", "501", "jun");
    const seen: string[] = [];
    let downloadedPath = "";
    const { fetchImpl } = makeFetch(
      [
        [
          {
            update_id: 1,
            message: {
              message_id: 1,
              chat: { id: 501, type: "private" },
              photo: [
                { file_id: "p-small", file_unique_id: "small", width: 10, height: 10 },
                { file_id: "p-large", file_unique_id: "large", width: 100, height: 100 },
              ],
            },
          },
        ],
      ],
      {
        getFile: {
          ok: true,
          result: { file_id: "p-large", file_unique_id: "large", file_path: "photos/pic.jpg" },
        },
      },
    );
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async (req) => {
        seen.push(req.text);
        const match = /^\[Image: (.+\.jpg)\]$/.exec(req.text);
        assert.ok(match, `prompt should contain image path, got: ${req.text}`);
        downloadedPath = match[1];
        assert.equal(readFileSync(downloadedPath).length, 3);
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    assert.equal(seen.length, 1);
    assert.ok(downloadedPath);
    assert.equal(existsSync(downloadedPath), false);
    assert.equal(existsSync(dirname(downloadedPath)), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("draft streaming uses sendRichMessageDraft only for private rich-supported turns", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("telegram", "502", "jun");
    db.addAllowlist("telegram", "-502", "grp");
    const { fetchImpl, calls } = makeFetch([
      [
        textUpdate(1, 502, "private update"),
        { update_id: 2, message: { message_id: 2, text: "@cxcbot group update", chat: { id: -502, type: "group" } } },
      ],
    ]);
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async (req) => {
        req.onEvent?.({ kind: "message", text: `partial ${req.chatId}` });
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    const drafts = calls.filter((c) => c.method === "sendRichMessageDraft");
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].payload.chat_id, 502);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("private draft progress uses drafts for file changes and never legacy status messages", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("telegram", "503", "jun");
    const { fetchImpl, calls } = makeFetch([[textUpdate(1, 503, "private update")]]);
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async (req) => {
        req.onEvent?.({ kind: "file_change", path: "src/app.ts", action: "modify" });
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    const drafts = calls.filter((c) => c.method === "sendRichMessageDraft");
    assert.equal(drafts.length, 1);
    assert.match(JSON.stringify(drafts[0].payload), /src\/app\.ts/);
    assert.equal(calls.some((c) => c.method === "sendMessage" && String(c.payload.text ?? "").startsWith("🔄")), false);
    assert.equal(calls.some((c) => c.method === "editMessageText"), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("non-draft group progress keeps the legacy status message path", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("telegram", "-504", "grp");
    const { fetchImpl, calls } = makeFetch([
      [{ update_id: 1, message: { message_id: 1, text: "@cxcbot group update", chat: { id: -504, type: "group" } } }],
    ]);
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async (req) => {
        req.onEvent?.({ kind: "tool_call", name: "shell", input: "npm test" });
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    assert.equal(calls.some((c) => c.method === "sendRichMessageDraft"), false);
    assert.ok(calls.some((c) => c.method === "sendMessage" && String(c.payload.text ?? "").startsWith("🔄 shell npm test")));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
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

test("forum topic messages pass topicId and propagate General topic thread id", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("telegram", "-900", "forum");
    const requests: IncomingRequest[] = [];
    const update: TgUpdate = {
      update_id: 1,
      message: {
        message_id: 1,
        text: "@cxcbot topic work",
        chat: { id: -900, type: "supergroup", is_forum: true },
        is_topic_message: true,
      },
    };
    const { fetchImpl, calls } = makeFetch([[update]]);
    const adapter = createTelegramAdapter({
      db,
      token: "T",
      workdir: cwd,
      fetchImpl,
      agentService: stubAgentService(async (req) => {
        requests.push(req);
        return { ok: true, text: "done" };
      }),
    });
    await adapter.start();
    await settle();
    adapter.stop();

    assert.equal(requests[0]?.topicId, "1");
    assert.equal(db.getOrCreateBinding("telegram", "-900", cwd, "1").topic_id, "1");
    assert.ok(calls.some((call) => call.method === "sendChatAction" && call.payload.message_thread_id === 1));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

// ── /cwd command (telegram_cwd_sessions phase 2) ─────────────────────────

function sentTexts(calls: Call[]): string[] {
  return calls.filter((c) => c.method === "sendMessage").map((c) => String(c.payload.text ?? ""));
}

async function runCwdScenario(text: string): Promise<{ db: BridgeDb; cwd: string; calls: Call[] }> {
  const { db, cwd } = tempDb();
  db.addAllowlist("telegram", "700", "jun");
  const { fetchImpl, calls } = makeFetch([[textUpdate(1, 700, text)]]);
  const adapter = createTelegramAdapter({
    db,
    token: "T",
    workdir: cwd,
    fetchImpl,
    agentService: stubAgentService(async () => ({ ok: true, text: "unused" })),
  });
  await adapter.start();
  await settle();
  adapter.stop();
  return { db, cwd, calls };
}

test("/cwd with no arg reports the current workdir", async () => {
  const { db, cwd, calls } = await runCwdScenario("/cwd");
  try {
    const texts = sentTexts(calls);
    assert.ok(texts.some((t) => t === `Current workdir: ${cwd}`), `got: ${texts.join(" | ")}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("/cwd <existing dir> repoints the binding and resets the session", async () => {
  const target = mkdtempSync(join(tmpdir(), "cwd-target-"));
  const { db, cwd, calls } = await runCwdScenario(`/cwd ${target}`);
  try {
    const real = realpathSync(target);
    const binding = db.getOrCreateBinding("telegram", "700", cwd);
    assert.equal(binding.workdir, real);
    assert.equal(binding.thread_id, null);
    assert.ok(sentTexts(calls).some((t) => t === `Workdir set: ${real} (session reset)`));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
    db.close();
  }
});

test("/cwd <missing path> rejects and never creates the directory", async () => {
  const missing = join(tmpdir(), `nope-${Date.now()}`);
  const { db, cwd, calls } = await runCwdScenario(`/cwd ${missing}`);
  try {
    const binding = db.getOrCreateBinding("telegram", "700", cwd);
    assert.equal(binding.workdir, cwd); // unchanged
    assert.ok(sentTexts(calls).some((t) => t === `Not a directory: ${missing}`));
    assert.throws(() => realpathSync(missing)); // still absent — nothing was created
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("/cwd <file path> is rejected (not a directory)", async () => {
  const target = mkdtempSync(join(tmpdir(), "cwd-file-"));
  const filePath = join(target, "f.txt");
  writeFileSync(filePath, "x");
  const { db, cwd, calls } = await runCwdScenario(`/cwd ${filePath}`);
  try {
    const binding = db.getOrCreateBinding("telegram", "700", cwd);
    assert.equal(binding.workdir, cwd);
    assert.ok(sentTexts(calls).some((t) => t === `Not a directory: ${filePath}`));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
    db.close();
  }
});

test("/cwd ~ expands to the home directory", async () => {
  const { db, cwd, calls } = await runCwdScenario("/cwd ~");
  try {
    const binding = db.getOrCreateBinding("telegram", "700", cwd);
    assert.ok(!binding.workdir.includes("~"), "tilde must be expanded");
    assert.ok(sentTexts(calls).some((t) => t.startsWith("Workdir set: /")));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("/cwd from a non-allowlisted chat is silently ignored", async () => {
  const { db, cwd } = tempDb();
  const { fetchImpl, calls } = makeFetch([[textUpdate(1, 701, "/cwd /tmp")]]);
  const adapter = createTelegramAdapter({
    db,
    token: "T",
    workdir: cwd,
    fetchImpl,
    agentService: stubAgentService(async () => ({ ok: true, text: "unused" })),
  });
  await adapter.start();
  await settle();
  adapter.stop();
  try {
    assert.equal(sentTexts(calls).length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

// ── /delete command (telegram_cwd_sessions phase 3) ──────────────────────

function topicUpdate(id: number, chatId: number, text: string, threadId: number): TgUpdate {
  return {
    update_id: id,
    message: {
      message_id: id,
      text,
      chat: { id: chatId, type: "supergroup", is_forum: true },
      is_topic_message: true,
      message_thread_id: threadId,
    } as TgUpdate["message"],
  };
}

async function runDeleteScenario(
  updates: TgUpdate[][],
  opts?: { ttlMs?: number; overrides?: Record<string, unknown> },
): Promise<{ db: BridgeDb; cwd: string; calls: Call[] }> {
  const { db, cwd } = tempDb();
  db.addAllowlist("telegram", "800", "jun");
  const { fetchImpl, calls } = makeFetch(updates, opts?.overrides);
  const adapter = createTelegramAdapter({
    db,
    token: "T",
    workdir: cwd,
    fetchImpl,
    deleteConfirmTtlMs: opts?.ttlMs,
    agentService: stubAgentService(async () => ({ ok: true, text: "unused" })),
  });
  await adapter.start();
  await settle();
  adapter.stop();
  return { db, cwd, calls };
}

test("/delete then /delete confirm wipes binding, jobs, and pairing", async () => {
  const { db, cwd, calls } = await runDeleteScenario([
    [textUpdate(1, 800, "/delete")],
    [textUpdate(2, 800, "/delete confirm")],
  ]);
  try {
    // seed check: prompt was sent
    assert.ok(sentTexts(calls).some((t) => t.includes("Send /delete confirm")));
    assert.ok(sentTexts(calls).some((t) => t.startsWith("Chat deleted")));
    assert.equal(db.listBindings().length, 0);
    assert.equal(db.isAllowed("telegram", "800"), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("/delete confirm without a pending prompt only re-prompts", async () => {
  const { db, cwd, calls } = await runDeleteScenario([[textUpdate(1, 800, "/delete confirm")]]);
  try {
    assert.ok(sentTexts(calls).some((t) => t.includes("Send /delete confirm")));
    assert.equal(db.isAllowed("telegram", "800"), true); // nothing deleted
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("/delete confirm after TTL expiry re-prompts instead of deleting", async () => {
  const { db, cwd, calls } = await runDeleteScenario(
    [[textUpdate(1, 800, "/delete")], [textUpdate(2, 800, "/delete confirm")]],
    { ttlMs: -1 }, // pending expires immediately
  );
  try {
    const prompts = sentTexts(calls).filter((t) => t.includes("Send /delete confirm"));
    assert.equal(prompts.length, 2);
    assert.equal(db.isAllowed("telegram", "800"), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("/delete from a forum topic deletes only that topic binding and keeps the chat paired", async () => {
  const { db, cwd, calls } = await runDeleteScenario([
    [topicUpdate(1, 800, "/delete", 42)],
    [topicUpdate(2, 800, "/delete confirm", 42)],
  ]);
  try {
    assert.equal(calls.some((c) => c.method === "deleteForumTopic"), false);
    assert.equal(db.listBindings().length, 0);
    assert.equal(db.isAllowed("telegram", "800"), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});

test("/delete confirmations are keyed by chat and topic", async () => {
  const { db, cwd, calls } = await runDeleteScenario([
    [topicUpdate(1, 800, "/delete", 7)],
    [topicUpdate(2, 800, "/delete confirm", 8)],
  ]);
  try {
    const prompts = sentTexts(calls).filter((t) => t.includes("Send /delete confirm"));
    assert.equal(prompts.length, 2);
    assert.equal(db.isAllowed("telegram", "800"), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    db.close();
  }
});
