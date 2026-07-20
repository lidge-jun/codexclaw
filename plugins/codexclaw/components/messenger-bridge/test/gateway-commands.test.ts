/** gateway-commands.test.ts — platform-neutral command effects. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";
import { AgentService as RealAgentService } from "../src/agent-service.ts";
import { createApprovalStore, type ApprovalRequest } from "../src/approval-relay.ts";
import { dispatchGatewayCommand } from "../src/gateway-commands.ts";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "gateway-commands-test-"));
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

function stubAgent(impl?: (req: IncomingRequest) => Promise<IncomingResult>, cancel = false): AgentService {
  return {
    handleIncoming: impl ?? (async () => ({ ok: true, text: "unused" })),
    cancelTurn: () => cancel,
    shutdown() {},
  } as unknown as AgentService;
}

test("dispatchGatewayCommand updates model and effort on the binding", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    const base = { bindingId: binding.id, db, agentService: stubAgent(), agentId: agent.id };

    assert.equal((await dispatchGatewayCommand("missing", { ...base, args: "" })), null);
    assert.equal((await dispatchGatewayCommand("model", { ...base, args: "gpt-test" }))?.text, "Model set to gpt-test");
    assert.equal((await dispatchGatewayCommand("effort", { ...base, args: "high" }))?.text, "Effort set to high");

    const updated = db.getBinding(binding.id);
    assert.equal(updated?.model, "gpt-test");
    assert.equal(updated?.effort, "high");
    assert.equal(db.getAgent(agent.id)?.model, "default");
    assert.equal(db.getAgent(agent.id)?.effort, "default");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/model reserved subargs list/reset are handled before verbatim model storage", async () => {
  const { db, cwd } = tempDb();
  const cache = join(cwd, "models.json");
  const previous = process.env.CODEX_MODELS_CACHE_PATH;
  process.env.CODEX_MODELS_CACHE_PATH = cache;
  writeFileSync(cache, JSON.stringify({ models: [{ slug: "gpt-5.5" }, { slug: "anthropic/claude-sonnet-5" }] }));
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.updateAgent(agent.id, { model: "agent-model" });
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    db.setBindingModel(binding.id, "gpt-custom");
    const base = { bindingId: binding.id, db, agentService: stubAgent(), agentId: agent.id, args: "" };

    const list = await dispatchGatewayCommand("model", { ...base, args: "list" });
    assert.match(list?.text ?? "", /Available models/);
    assert.match(list?.telegramHtml ?? "", /anthropic\/claude-sonnet-5/);
    assert.ok((list?.telegramHtmlChunks as string[]).every((chunk) => chunk.length <= 4096));
    assert.ok(list?.discordEmbed?.fields?.some((field) => field.name === "openai"));
    assert.equal(db.getBinding(binding.id)?.model, "gpt-custom");

    const reset = await dispatchGatewayCommand("model", { ...base, args: "reset" });
    assert.equal(reset?.text, "Model reset to agent-model");
    assert.equal(db.getBinding(binding.id)?.model, "default");
  } finally {
    if (previous === undefined) delete process.env.CODEX_MODELS_CACHE_PATH;
    else process.env.CODEX_MODELS_CACHE_PATH = previous;
    db.close();
    rmRfRetry(cwd);
  }
});

test("/model list emits provider continuation fields before Discord cap overflow", async () => {
  const { db, cwd } = tempDb();
  const cache = join(cwd, "models-oversized.json");
  const previous = process.env.CODEX_MODELS_CACHE_PATH;
  process.env.CODEX_MODELS_CACHE_PATH = cache;
  const bigProviderIds = Array.from({ length: 24 }, (_, i) => `aaa/model-${String(i).padStart(2, "0")}-continuation-${"x".repeat(15)}`);
  const overflowProviderIds = Array.from({ length: 35 }, (_, i) => `p${String(i).padStart(2, "0")}/m`);
  writeFileSync(cache, JSON.stringify({ models: [...bigProviderIds, ...overflowProviderIds].map((slug) => ({ slug })) }));
  try {
    const binding = db.getOrCreateBinding("discord", "chan", cwd);
    const result = await dispatchGatewayCommand("model", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: null,
      args: "list",
    });
    const embed = result?.discordEmbed;
    const serialized = JSON.stringify(embed);

    assert.ok(embed?.fields?.some((field) => field.name === "aaa (2/3)"));
    for (const id of bigProviderIds) {
      assert.match(serialized, new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.ok(embed?.fields?.some((field) => /^\+\d+ more$/.test(field.name)));
    assert.ok((embed?.fields?.length ?? 0) <= 25);
  } finally {
    if (previous === undefined) delete process.env.CODEX_MODELS_CACHE_PATH;
    else process.env.CODEX_MODELS_CACHE_PATH = previous;
    db.close();
    rmRfRetry(cwd);
  }
});

test("/effort reset stores default and reports the effective agent effort", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.updateAgent(agent.id, { effort: "high" });
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    db.setBindingEffort(binding.id, "xhigh");

    const result = await dispatchGatewayCommand("effort", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: agent.id,
      args: "reset",
    });

    assert.equal(result?.text, "Effort reset to high");
    assert.equal(db.getBinding(binding.id)?.effort, "default");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/cwd reset validates and restores the bridge default workdir", async () => {
  const { db, cwd } = tempDb();
  const other = mkdtempSync(join(tmpdir(), "gateway-cwd-other-"));
  try {
    const binding = db.getOrCreateBinding("discord", "chan", cwd);
    db.setBindingWorkdir(binding.id, other);
    db.setBindingThread(binding.id, "thread-old");

    const result = await dispatchGatewayCommand("cwd", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: null,
      args: "reset",
      defaultWorkdir: cwd,
    });

    assert.equal(result?.text, `Workdir reset: ${realpathSync(cwd)} (session reset)`);
    assert.equal(db.getBinding(binding.id)?.workdir, realpathSync(cwd));
    assert.equal(db.getBinding(binding.id)?.thread_id, null);

    const missing = await dispatchGatewayCommand("cwd", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: null,
      args: "reset",
      defaultWorkdir: join(cwd, "missing"),
    });
    assert.match(missing?.text ?? "", /Not a directory/);
  } finally {
    db.close();
    rmRfRetry(other);
    rmRfRetry(cwd);
  }
});

test("retry uses the binding channel, chat, workdir, and agent scope", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    db.createJob(binding.id, "try again");
    const seen: IncomingRequest[] = [];
    let approvalForwarded: ApprovalRequest | null = null;
    const onEvent: NonNullable<IncomingRequest["onEvent"]> = () => {};
    const result = await dispatchGatewayCommand("retry", {
      bindingId: binding.id,
      db,
      agentId: agent.id,
      args: "",
      onApprovalRequest: async (request) => {
        approvalForwarded = request;
      },
      onEvent,
      agentService: stubAgent(async (req) => {
        seen.push(req);
        await req.onApprovalRequest?.({
          id: "ap_retry",
          bindingId: binding.id,
          promptHash: "hash",
          workdir: cwd,
          expiresAt: 123,
        });
        return { ok: true, text: "retried" };
      }),
    });

    assert.equal(result?.text, "retried");
    assert.equal(seen[0].kind, "telegram");
    assert.equal(seen[0].chatId, "100");
    assert.equal(seen[0].text, "try again");
    assert.equal(seen[0].workdir, cwd);
    assert.equal(seen[0].topicId, null);
    assert.equal(seen[0].agentId, agent.id);
    assert.equal(typeof seen[0].onApprovalRequest, "function");
    assert.equal(seen[0].onEvent, onEvent);
    assert.equal(approvalForwarded?.id, "ap_retry");
    assert.deepEqual(result?.data, { retriedJobId: 1, ok: true });

    seen.length = 0;
    await dispatchGatewayCommand("retry", {
      bindingId: binding.id,
      db,
      agentId: agent.id,
      args: "",
      agentService: stubAgent(async (req) => {
        seen.push(req);
        return { ok: false, error: "failed" };
      }),
    });
    assert.equal(seen[0].onEvent, undefined);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/approve text fallback resolves only the current binding's pending approval", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "100");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    const other = db.getOrCreateAgentBinding(agent.id, "telegram", "101", cwd);
    const store = createApprovalStore(600_000, { autoExpire: false, idFactory: () => "ap_text" });
    const svc = new RealAgentService({ db, approvalStore: store });
    store.request({ bindingId: binding.id, promptHash: "hash", workdir: cwd });

    const wrong = await dispatchGatewayCommand("approve", {
      bindingId: other.id,
      db,
      agentId: agent.id,
      args: "ap_text allow-once",
      agentService: svc,
    });
    assert.match(wrong?.text ?? "", /another chat/);
    assert.equal(store.pending.has("ap_text"), true);

    const ok = await dispatchGatewayCommand("approve", {
      bindingId: binding.id,
      db,
      agentId: agent.id,
      args: "ap_text allow-once",
      agentService: svc,
    });
    assert.equal(ok?.text, "Approval ap_text: allow-once");
    assert.equal(store.pending.has("ap_text"), false);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/approve text fallback validates usage and decision", async () => {
  const { db, cwd } = tempDb();
  try {
    const binding = db.getOrCreateBinding("discord", "chan", cwd);
    const result = await dispatchGatewayCommand("approve", {
      bindingId: binding.id,
      db,
      agentId: null,
      args: "ap_text maybe",
      agentService: stubAgent(),
    });
    assert.match(result?.text ?? "", /Usage/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/approve list shows id workdir prompt hash and expiry without prompt preview", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    const store = createApprovalStore(125_000, {
      autoExpire: false,
      now: () => 1_000,
      idFactory: () => "ap_list",
    });
    const svc = new RealAgentService({ db, approvalStore: store });
    store.request({ bindingId: binding.id, promptHash: "abcdef1234567890", workdir: cwd });

    const result = await dispatchGatewayCommand("approve", {
      bindingId: binding.id,
      db,
      agentId: agent.id,
      args: "list",
      agentService: svc,
      now: () => new Date(1_000),
    });

    assert.match(result?.text ?? "", /ap_list/);
    assert.match(result?.text ?? "", /abcdef12/);
    assert.match(result?.text ?? "", /expires-in 02:05/);
    assert.match(result?.text ?? "", new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(result?.text ?? "", /preview|prompt:/i);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/sessions renders chat bindings with Telegram HTML and Discord embed", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const plain = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    const topic = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd, "3");
    db.setBindingThread(topic.id, "thread-abcdefghi");
    db.setBindingStatus(topic.id, "running");
    const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
    raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-07T00:00:00.000Z", plain.id);
    raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-07T00:01:00.000Z", topic.id);
    raw.close();

    const result = await dispatchGatewayCommand("sessions", {
      bindingId: plain.id,
      db,
      agentId: agent.id,
      args: "",
      agentService: stubAgent(),
      now: () => new Date("2026-07-07T00:02:00.000Z"),
    });

    assert.match(result?.text ?? "", /topic 3/);
    assert.match(result?.telegramHtml ?? "", /<b>Sessions<\/b>/);
    assert.equal(result?.discordEmbed?.fields?.[0]?.name, "topic 3");
    assert.match(result?.discordEmbed?.fields?.[0]?.value ?? "", /thread-a/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/jobs validates limits and caps the list at 15", async () => {
  const { db, cwd } = tempDb();
  try {
    const binding = db.getOrCreateBinding("discord", "chan", cwd);
    for (let i = 0; i < 20; i += 1) {
      const id = db.createJob(binding.id, `prompt ${i}`);
      db.updateJob(id, {
        state: "done",
        thread_id: `thread-${i}`,
        started_at: "2026-07-07T00:00:00.000Z",
        ended_at: "2026-07-07T00:00:02.000Z",
      });
    }
    const bad = await dispatchGatewayCommand("jobs", {
      bindingId: binding.id,
      db,
      agentId: null,
      args: "0",
      agentService: stubAgent(),
    });
    assert.match(bad?.text ?? "", /Usage/);

    const capped = await dispatchGatewayCommand("jobs", {
      bindingId: binding.id,
      db,
      agentId: null,
      args: "99",
      agentService: stubAgent(),
    });
    assert.equal((capped?.data?.jobs as unknown[]).length, 15);
    assert.equal(capped?.discordEmbed?.fields?.length, 15);
    assert.match(capped?.telegramHtml ?? "", /<b>Recent jobs<\/b>/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/agent summarizes named agents and explains legacy bindings", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("dc-1", "discord", "tok");
    db.addAgentAllowlist(agent.id, "chan");
    db.updateAgent(agent.id, { enabled: 1, heartbeat_minutes: 5, thread_mode: "plain" });
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "chan", cwd);
    const result = await dispatchGatewayCommand("agent", {
      bindingId: binding.id,
      db,
      agentId: agent.id,
      args: "",
      agentService: stubAgent(),
    });
    assert.match(result?.text ?? "", /thread_mode: plain/);
    assert.match(result?.text ?? "", /allowlist: 1/);
    assert.equal(result?.discordEmbed?.title, "Agent dc-1");

    // Security: the result object must never carry the bot token or webhook url.
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("tok"), "bot token leaked in /agent result");
    assert.ok(!serialized.includes("webhook_url"), "raw webhook_url field leaked in /agent result");

    const legacy = db.getOrCreateBinding("discord", "legacy", cwd);
    const legacyResult = await dispatchGatewayCommand("agent", {
      bindingId: legacy.id,
      db,
      agentId: null,
      args: "",
      agentService: stubAgent(),
    });
    assert.match(legacyResult?.text ?? "", /named agent/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

// ── /mode (A-4) ──────────────────────────────────────────

test("/mode shows current thread mode with explanation", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("dc-1", "discord", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "500", cwd);
    const result = await dispatchGatewayCommand("mode", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: agent.id,
      args: "",
    });
    assert.ok(result);
    assert.ok(result.text.includes("thread"), "should show current mode");
    assert.equal(result.data?.mode, "thread");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/mode sets thread_mode to plain and back", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("dc-2", "discord", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "501", cwd);
    const set = await dispatchGatewayCommand("mode", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: agent.id,
      args: "plain",
    });
    assert.ok(set);
    assert.equal(set.data?.mode, "plain");
    assert.equal(db.getAgent(agent.id)?.thread_mode, "plain");

    const revert = await dispatchGatewayCommand("mode", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: agent.id,
      args: "thread",
    });
    assert.ok(revert);
    assert.equal(revert.data?.mode, "thread");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/mode rejects invalid values", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("dc-3", "discord", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "discord", "502", cwd);
    const result = await dispatchGatewayCommand("mode", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: agent.id,
      args: "bogus",
    });
    assert.ok(result);
    assert.ok(result.text.includes("must be"), "should report valid values");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/mode requires a named agent", async () => {
  const { db, cwd } = tempDb();
  try {
    const binding = db.getOrCreateBinding("discord", "503", cwd);
    const result = await dispatchGatewayCommand("mode", {
      bindingId: binding.id,
      db,
      agentService: stubAgent(),
      agentId: null,
      args: "",
    });
    assert.ok(result);
    assert.ok(result.text.includes("named agent"), "should report agent requirement");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

// ── buildHelpEntries structure tests (A-5) ──────────────

import { buildHelpEntries, GATEWAY_COMMANDS } from "../src/gateway-commands.ts";
import { buildCommandDefs } from "../src/telegram-commands.ts";
import { COMMANDS as DC_COMMANDS } from "../src/discord-commands.ts";

test("buildHelpEntries(telegram) includes every gateway command + platform-only commands", () => {
  const tgDefs = buildCommandDefs();
  const gatewayNames = new Set(GATEWAY_COMMANDS.map((c) => c.name));
  const tgOnly = tgDefs
    .filter((d) => !gatewayNames.has(d.name) && d.name !== "help")
    .map((d) => ({ name: d.name, description: d.description }));
  const entries = buildHelpEntries("telegram", tgOnly);
  const names = new Set(entries.map((e) => e.name));

  // Every gateway command must appear
  for (const cmd of GATEWAY_COMMANDS) {
    assert.ok(names.has(cmd.name), `missing gateway command: ${cmd.name}`);
  }
  // Every TG-only command must appear
  for (const def of tgOnly) {
    assert.ok(names.has(def.name), `missing TG-only command: ${def.name}`);
  }
  // /mode must be present
  assert.ok(names.has("mode"), "/mode missing from help");
});

test("buildHelpEntries(discord) includes every gateway command + platform-only commands", () => {
  const gatewayNames = new Set(GATEWAY_COMMANDS.map((c) => c.name));
  const dcOnly = DC_COMMANDS
    .filter((c) => !gatewayNames.has(c.name) && c.name !== "help")
    .map((c) => ({ name: c.name, description: c.description }));
  const entries = buildHelpEntries("discord", dcOnly);
  const names = new Set(entries.map((e) => e.name));

  for (const cmd of GATEWAY_COMMANDS) {
    assert.ok(names.has(cmd.name), `missing gateway command: ${cmd.name}`);
  }
  for (const def of dcOnly) {
    assert.ok(names.has(def.name), `missing DC-only command: ${def.name}`);
  }
  assert.ok(names.has("mode"), "/mode missing from help");
});

test("buildHelpEntries entries have non-empty section and description", () => {
  const entries = buildHelpEntries("telegram");
  for (const entry of entries) {
    assert.ok(entry.section, `${entry.name} has no section`);
    assert.ok(entry.description, `${entry.name} has no description`);
    assert.ok(entry.name, "entry has no name");
  }
  assert.match(entries.find((entry) => entry.name === "model")?.description ?? "", /\/model \[id\|list\|reset\]/);
  assert.match(entries.find((entry) => entry.name === "effort")?.description ?? "", /\/effort \[level\|reset\]/);
  assert.match(entries.find((entry) => entry.name === "approve")?.description ?? "", /\/approve \[list\|id choice\]/);
});
