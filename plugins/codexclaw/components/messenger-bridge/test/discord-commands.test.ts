/** discord-commands.test.ts - slash command registry and handlers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COMMANDS,
  matchCommand,
  registerGlobalCommands,
} from "../src/discord-commands.ts";
import { DiscordApi } from "../src/discord-api.ts";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";
import type { Interaction, InteractionContext } from "../src/discord-interactions.ts";

interface ApiCall {
  path: string;
  method: string;
  body: unknown;
}

function response(body: unknown = { id: "ok" }): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
  } as unknown as Response;
}

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "discord-commands-test-"));
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

function interaction(name: string, options: Array<{ name: string; value: string }> = []): Interaction {
  return {
    id: `i-${name}`,
    token: `tok-${name}`,
    type: 2,
    channel_id: "chan-1",
    data: {
      name,
      options: options.map((option) => ({ name: option.name, type: 3, value: option.value })),
    },
  };
}

function stubAgent(impl: (req: IncomingRequest) => Promise<IncomingResult>): AgentService {
  return { handleIncoming: impl, cancelTurn: () => false, shutdown() {} } as unknown as AgentService;
}

function makeCtx(db: BridgeDb, cwd: string, agentService?: AgentService): InteractionContext & { edits: unknown[]; sends: unknown[] } {
  const edits: unknown[] = [];
  const sends: unknown[] = [];
  return {
    db,
    agentService: agentService ?? stubAgent(async () => ({ ok: true, text: "unused" })),
    api: {
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
    } as unknown as DiscordApi,
    applicationId: "app-1",
    workdir: cwd,
    edits,
    sends,
  };
}

test("COMMANDS exposes the native Discord command surface", () => {
  assert.deepEqual(COMMANDS.map((command) => command.name), [
    "ask",
    "review",
    "status",
    "sessions",
    "jobs",
    "agent",
    "model",
    "new",
    "stop",
    "effort",
    "mode",
    "cwd",
    "help",
  ]);
  assert.equal(matchCommand("ask")?.description, "Run a Codex turn in this chat");
  assert.match(matchCommand("model")?.options?.[0]?.description ?? "", /\[id\|list\|reset\]/);
  assert.match(matchCommand("cwd")?.options?.[0]?.description ?? "", /\[path\|reset\]/);
  assert.equal(matchCommand("missing"), null);
});

test("registerGlobalCommands PUTs application command JSON", async () => {
  const calls: ApiCall[] = [];
  const api = new DiscordApi("T", async (url, init) => {
    calls.push({
      path: url.replace(/^https:\/\/discord\.com\/api\/v10/, ""),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return response([]);
  });
  await registerGlobalCommands(api, "app-1");
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].path, "/applications/app-1/commands");
  const body = calls[0].body as Array<{
    name: string;
    options?: Array<{ name: string; required?: boolean; choices?: Array<{ value: string }> }>;
  }>;
  assert.ok(body.some((command) => command.name === "ask" && command.options?.[0]?.name === "prompt"));
  assert.ok(body.some((command) => command.name === "mode" && command.options?.[0]?.name === "value"));
  assert.ok(body.some((command) => command.name === "effort" && command.options?.[0]?.choices?.some((choice: { value: string }) => choice.value === "reset")));
});

test("/ask runs AgentService.handleIncoming and edits the deferred reply", async () => {
  const { db, cwd } = tempDb();
  try {
    db.addAllowlist("discord", "chan-1", "");
    const seen: IncomingRequest[] = [];
    const ctx = makeCtx(db, cwd, stubAgent(async (req) => {
      seen.push(req);
      return { ok: true, text: "answer text" };
    }));
    await matchCommand("ask")!.handler(interaction("ask", [{ name: "prompt", value: "ship it" }]), ctx);
    assert.equal(seen[0].text, "ship it");
    assert.equal(seen[0].chatId, "chan-1");
    assert.match(JSON.stringify(ctx.edits[0]), /Working/);
    assert.deepEqual(ctx.sends, [{ content: "answer text" }]);
    assert.match(JSON.stringify(ctx.edits[1]), /Final answer sent as a fresh message/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/review wires runner events and failed durable delivery overrides the terminal outcome", async () => {
  const { db, cwd } = tempDb();
  try {
    let incoming: IncomingRequest | undefined;
    const finished: Array<{ ok: boolean; error?: string }> = [];
    const ctx = makeCtx(db, cwd, stubAgent(async (req) => {
      incoming = req;
      req.onEvent?.({ kind: "status", label: "reviewing" });
      return { ok: true, text: "review result" };
    }));
    ctx.createInteractionProgress = () => ({
      start: async () => {},
      onEvent: () => {},
      finish: async (result) => { finished.push(result); },
    });
    ctx.api.sendMessage = async () => ({ ok: false, status: 500, error: "delivery failed" });
    await matchCommand("review")!.handler(interaction("review", [{ name: "target", value: "change" }]), ctx);
    assert.match(incoming?.text ?? "", /Review this and report findings first/);
    assert.equal(typeof incoming?.onEvent, "function");
    assert.deepEqual(finished, [{ ok: false, error: "delivery failed" }]);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("interaction turn finishes progress when the runner rejects", async () => {
  const { db, cwd } = tempDb();
  try {
    const finished: Array<{ ok: boolean; error?: string }> = [];
    const ctx = makeCtx(db, cwd, stubAgent(async () => { throw new Error("runner exploded"); }));
    ctx.createInteractionProgress = () => ({
      start: async () => {},
      onEvent: () => {},
      finish: async (result) => { finished.push(result); },
    });
    await matchCommand("ask")!.handler(interaction("ask", [{ name: "prompt", value: "go" }]), ctx);
    assert.deepEqual(finished, [{ ok: false, error: "runner exploded" }]);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/cwd updates an existing directory and clears the binding thread", async () => {
  const { db, cwd } = tempDb();
  const target = mkdtempSync(join(tmpdir(), "discord-cwd-target-"));
  try {
    const binding = db.getOrCreateBinding("discord", "chan-1", cwd);
    db.setBindingThread(binding.id, "thread-old");
    const ctx = makeCtx(db, cwd);
    await matchCommand("cwd")!.handler(interaction("cwd", [{ name: "path", value: target }]), ctx);
    const updated = db.getOrCreateBinding("discord", "chan-1", cwd);
    assert.equal(updated.workdir, realpathSync(target));
    assert.equal(updated.thread_id, null);
    assert.match(JSON.stringify(ctx.edits[0]), /Workdir set/);
  } finally {
    db.close();
    rmRfRetry(cwd);
    rmRfRetry(target);
  }
});

test("/effort stores valid effort on the interaction binding", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("discord-1", "discord", "T");
    const ctx = makeCtx(db, cwd);
    ctx.agentId = agent.id;
    await matchCommand("effort")!.handler(interaction("effort", [{ name: "value", value: "xhigh" }]), ctx);
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "chan-1", cwd);
    assert.equal(db.getAgent(agent.id)?.effort, "default");
    assert.equal(binding.effort, "xhigh");
    assert.match(JSON.stringify(ctx.edits[0]), /Effort set to xhigh/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/effort reset routes through the gateway reserved subarg", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("discord-1", "discord", "T");
    db.updateAgent(agent.id, { effort: "high" });
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "chan-1", cwd);
    db.setBindingEffort(binding.id, "xhigh");
    const ctx = makeCtx(db, cwd);
    ctx.agentId = agent.id;
    await matchCommand("effort")!.handler(interaction("effort", [{ name: "value", value: "reset" }]), ctx);

    assert.equal(db.getBinding(binding.id)?.effort, "default");
    assert.match(JSON.stringify(ctx.edits[0]), /Effort reset to high/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/model list uses a capped Discord embed instead of the picker path", async () => {
  const { db, cwd } = tempDb();
  try {
    const ctx = makeCtx(db, cwd);
    await matchCommand("model")!.handler(interaction("model", [{ name: "value", value: "list" }]), ctx);
    const edit = ctx.edits[0] as { embeds?: Array<{ title?: string; fields?: unknown[] }> };

    assert.equal(edit.embeds?.[0]?.title, "Available Models");
    assert.ok((edit.embeds?.[0]?.fields?.length ?? 0) <= 25);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("bare /mode edits the reply with mode buttons", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("discord-1", "discord", "T");
    db.updateAgent(agent.id, { thread_mode: "plain" });
    const ctx = makeCtx(db, cwd);
    ctx.agentId = agent.id;
    await matchCommand("mode")!.handler(interaction("mode"), ctx);
    assert.match(JSON.stringify(ctx.edits[0]), /mode_select:plain/);
    assert.match(JSON.stringify(ctx.edits[0]), /\* Plain/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/sessions uses the gateway Discord embed path", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("discord-1", "discord", "T");
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "chan-1", cwd);
    db.setBindingThread(binding.id, "thread-123456789");
    const ctx = makeCtx(db, cwd);
    ctx.agentId = agent.id;
    await matchCommand("sessions")!.handler(interaction("sessions"), ctx);
    assert.match(JSON.stringify(ctx.edits[0]), /Sessions/);
    assert.match(JSON.stringify(ctx.edits[0]), /thread-1/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});
