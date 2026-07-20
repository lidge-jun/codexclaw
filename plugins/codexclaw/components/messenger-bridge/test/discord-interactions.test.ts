/** discord-interactions.test.ts - interaction callback routing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleInteraction, type Interaction, type InteractionContext } from "../src/discord-interactions.ts";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import type { DiscordApi } from "../src/discord-api.ts";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "discord-interactions-test-"));
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

function stubAgent(impl: (req: IncomingRequest) => Promise<IncomingResult>): AgentService {
  return { handleIncoming: impl, cancelTurn: () => false, shutdown() {} } as unknown as AgentService;
}

function approvalAgent(status: "resolved" | "not_found" | "unauthorized", seen: unknown[]): AgentService {
  return {
    handleIncoming: async () => ({ ok: true, text: "unused" }),
    cancelTurn: () => false,
    resolveApproval: (input: unknown) => {
      seen.push(input);
      return status;
    },
    shutdown() {},
  } as unknown as AgentService;
}

function makeApi() {
  const callbacks: unknown[] = [];
  const edits: unknown[] = [];
  const sends: unknown[] = [];
  const api = {
    createInteractionResponse: async (_id: string, _token: string, response: unknown) => {
      callbacks.push(response);
      return { ok: true, status: 200 };
    },
    editOriginalInteractionResponse: async (_appId: string, _token: string, data: unknown) => {
      edits.push(data);
      return { ok: true, status: 200, data: { id: "m" } };
    },
    sendMessage: async (_channelId: string, content: string) => {
      sends.push({ content });
      return { ok: true, status: 200, data: { id: "fresh" } };
    },
    sendFile: async (_channelId: string, content: string, files: unknown[]) => {
      sends.push({ content, files });
      return { ok: true, status: 200, data: { id: "fresh-file" } };
    },
    editMessage: async () => ({ ok: true, status: 200, data: { id: "progress" } }),
  } as unknown as DiscordApi;
  return { api, callbacks, edits, sends };
}

function makeCtx(db: BridgeDb, cwd: string, agentService?: AgentService): InteractionContext & { edits: unknown[]; callbacks: unknown[]; sends: unknown[] } {
  const { api, callbacks, edits, sends } = makeApi();
  return {
    db,
    agentService: agentService ?? stubAgent(async () => ({ ok: true, text: "unused" })),
    api,
    applicationId: "app-1",
    workdir: cwd,
    callbacks,
    edits,
    sends,
  };
}

test("PING responds with pong type 1", async () => {
  const { db, cwd } = tempDb();
  try {
    const ctx = makeCtx(db, cwd);
    await handleInteraction({ id: "ping", token: "tok", type: 1, channel_id: "" }, ctx);
    assert.deepEqual(ctx.callbacks, [{ type: 1 }]);
    assert.deepEqual(ctx.edits, []);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("failed defer prevents command execution", async () => {
  const { db, cwd } = tempDb();
  try {
    let called = false;
    const ctx = makeCtx(db, cwd, stubAgent(async () => {
      called = true;
      return { ok: true, text: "should not run" };
    }));
    ctx.api.createInteractionResponse = async () => ({ ok: false, status: 401, error: "defer rejected" });
    await assert.rejects(
      handleInteraction({
        id: "defer-fail",
        token: "token",
        type: 2,
        channel_id: "chan-1",
        data: { name: "ask", options: [{ name: "prompt", type: 3, value: "hello" }] },
      }, ctx),
      /defer rejected/,
    );
    assert.equal(called, false);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("component error edit failure is logged once without recursion", async () => {
  const { db, cwd } = tempDb();
  try {
    const logs: string[] = [];
    const ctx = makeCtx(db, cwd);
    let edits = 0;
    ctx.log = (line) => logs.push(line);
    ctx.api.editOriginalInteractionResponse = async () => {
      edits += 1;
      return { ok: false, status: 500, error: "edit rejected" };
    };
    await handleInteraction({
      id: "component-edit-fail",
      token: "token",
      type: 3,
      channel_id: "chan-1",
      data: { custom_id: "unknown" },
    }, ctx);
    assert.equal(edits, 2);
    assert.match(logs.join("\n"), /error edit failed: edit rejected/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("APPLICATION_COMMAND defers before running the matched command", async () => {
  const { db, cwd } = tempDb();
  try {
    const seen: IncomingRequest[] = [];
    const ctx = makeCtx(db, cwd, stubAgent(async (req) => {
      seen.push(req);
      return { ok: true, text: "answer" };
    }));
    const interaction: Interaction = {
      id: "i1",
      token: "tok1",
      type: 2,
      channel_id: "chan-1",
      data: { name: "ask", options: [{ name: "prompt", type: 3, value: "hello" }] },
    };
    await handleInteraction(interaction, ctx);
    assert.deepEqual(ctx.callbacks, [{ type: 5 }]);
    assert.equal(seen[0].text, "hello");
    assert.match(JSON.stringify(ctx.edits[0]), /Working/);
    assert.deepEqual(ctx.sends, [{ content: "answer" }]);
    assert.match(JSON.stringify(ctx.edits[1]), /Final answer sent as a fresh message/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("MESSAGE_COMPONENT model_select updates a named agent after deferring", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("discord-1", "discord", "T");
    const ctx = makeCtx(db, cwd);
    ctx.agentId = agent.id;
    await handleInteraction({
      id: "i2",
      token: "tok2",
      type: 3,
      channel_id: "chan-1",
      data: { custom_id: "model_select", values: ["gpt-5.5"] },
    }, ctx);
    assert.deepEqual(ctx.callbacks, [{ type: 5 }]);
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "chan-1", cwd);
    assert.equal(db.getAgent(agent.id)?.model, "default");
    assert.equal(binding.model, "gpt-5.5");
    assert.match(JSON.stringify(ctx.edits[0]), /Model set to gpt-5.5/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("MESSAGE_COMPONENT retry replays the latest prompt preview", async () => {
  const { db, cwd } = tempDb();
  try {
    const binding = db.getOrCreateBinding("discord", "chan-1", cwd);
    db.createJob(binding.id, "last prompt");
    const seen: IncomingRequest[] = [];
    const events: unknown[] = [];
    const finishes: unknown[] = [];
    const ctx = makeCtx(db, cwd, stubAgent(async (req) => {
      seen.push(req);
      req.onEvent?.({ kind: "status", label: "retrying" });
      return { ok: true, text: "retry result" };
    }));
    ctx.createInteractionProgress = () => ({
      start: async () => {},
      onEvent: (event) => events.push(event),
      finish: async (result) => { finishes.push(result); },
    });
    await handleInteraction({
      id: "i3",
      token: "tok3",
      type: 3,
      channel_id: "chan-1",
      data: { custom_id: "retry" },
    }, ctx);
    assert.equal(seen[0].text, "last prompt");
    assert.deepEqual(events, [{ kind: "status", label: "retrying" }]);
    assert.deepEqual(finishes, [{ ok: true, error: undefined }]);
    assert.deepEqual(ctx.sends, [{ content: "retry result" }]);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("unknown APPLICATION_COMMAND edits the deferred reply with an error", async () => {
  const { db, cwd } = tempDb();
  try {
    const ctx = makeCtx(db, cwd);
    await handleInteraction({
      id: "i4",
      token: "tok4",
      type: 2,
      channel_id: "chan-1",
      data: { name: "wat" },
    }, ctx);
    assert.deepEqual(ctx.callbacks, [{ type: 5 }]);
    assert.match(JSON.stringify(ctx.edits[0]), /Unknown bridge command/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("MESSAGE_COMPONENT approval buttons resolve through AgentService", async () => {
  const { db, cwd } = tempDb();
  try {
    const seen: unknown[] = [];
    const ctx = makeCtx(db, cwd, approvalAgent("resolved", seen));
    ctx.agentId = 12;
    await handleInteraction({
      id: "i5",
      token: "tok5",
      type: 3,
      channel_id: "chan-1",
      data: { custom_id: "approval:ap_1:allow-once" },
    }, ctx);
    assert.deepEqual(ctx.callbacks, [{ type: 5 }]);
    assert.deepEqual(seen, [{ id: "ap_1", decision: "allow-once", chatId: "chan-1", agentId: 12 }]);
    assert.match(JSON.stringify(ctx.edits[0]), /Approval allow-once/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("MESSAGE_COMPONENT mode_select updates the current agent thread mode", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("discord-1", "discord", "T");
    const ctx = makeCtx(db, cwd);
    ctx.agentId = agent.id;
    await handleInteraction({
      id: "i-mode",
      token: "tok-mode",
      type: 3,
      channel_id: "chan-1",
      data: { custom_id: "mode_select:plain" },
    }, ctx);
    assert.deepEqual(ctx.callbacks, [{ type: 5 }]);
    assert.equal(db.getAgent(agent.id)?.thread_mode, "plain");
    assert.match(JSON.stringify(ctx.edits[0]), /Mode set to plain/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("MESSAGE_COMPONENT unauthorized approval returns an ack without resolving", async () => {
  const { db, cwd } = tempDb();
  try {
    const seen: unknown[] = [];
    const ctx = makeCtx(db, cwd, approvalAgent("unauthorized", seen));
    await handleInteraction({
      id: "i6",
      token: "tok6",
      type: 3,
      channel_id: "other-chan",
      data: { custom_id: "approval:ap_2:deny" },
    }, ctx);
    assert.equal(seen.length, 1);
    assert.match(JSON.stringify(ctx.edits[0]), /another chat/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});
