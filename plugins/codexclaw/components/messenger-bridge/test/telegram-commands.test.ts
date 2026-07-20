/** telegram-commands.test.ts — Telegram command registry and bridge command handlers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentService, IncomingRequest, IncomingResult } from "../src/agent-service.ts";
import type { ApprovalRequest } from "../src/approval-relay.ts";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import {
  buildCommandDefs,
  findCommandDef,
  parseCommand,
  registerTelegramCommands,
  type CommandContext,
} from "../src/telegram-commands.ts";
import type { TelegramApi, TgMessage } from "../src/telegram-api.ts";

function tempDb(): { db: BridgeDb; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "tg-commands-test-"));
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

function stubAgentService(impl?: (req: IncomingRequest) => Promise<IncomingResult>): AgentService {
  return {
    handleIncoming: impl ?? (async () => ({ ok: true, text: "unused" })),
    cancelTurn: () => false,
    registerApprovalCleanup: () => true,
    shutdown() {},
  } as unknown as AgentService;
}

function fakeApi(): TelegramApi {
  return {
    deleteForumTopic: async () => ({ ok: true, result: true }),
  } as unknown as TelegramApi;
}

function baseCtx(db: BridgeDb, cwd: string, overrides: Partial<CommandContext> = {}): CommandContext {
  const msg: TgMessage = { message_id: 1, text: "", chat: { id: 100, type: "private" } };
  return {
    chatId: "100",
    args: "",
    db,
    agentService: stubAgentService(),
    binding: null,
    agentId: null,
    workdir: cwd,
    api: fakeApi(),
    msg,
    pendingDeletes: new Map(),
    deleteTtlMs: 60_000,
    isAllowedChat: () => true,
    isHandshakeOpen: () => false,
    admitChat: () => {},
    removeChat: () => {},
    setPaused: () => {},
    log: () => {},
    ...overrides,
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("parseCommand handles args, bot suffixes, and non-command text", () => {
  assert.deepEqual(parseCommand("/model gpt-5.5"), { command: "model", args: "gpt-5.5" });
  assert.deepEqual(parseCommand("/status@cxcbot"), { command: "status", args: "" });
  assert.equal(parseCommand("hello /status"), null);
});

test("registerTelegramCommands is built from the command registry", async () => {
  let commands: Array<{ command: string; description: string }> = [];
  const api = {
    setMyCommands: async (next: Array<{ command: string; description: string }>) => {
      commands = next;
      return { ok: true, result: true };
    },
  } as unknown as TelegramApi;

  await registerTelegramCommands(api);
  assert.deepEqual(
    commands.map((cmd) => cmd.command),
    buildCommandDefs().map((def) => def.name),
  );
  assert.ok(commands.some((cmd) => cmd.command === "new"));
  assert.ok(commands.some((cmd) => cmd.command === "effort"));
  assert.ok(commands.some((cmd) => cmd.command === "sessions"));
  assert.ok(commands.some((cmd) => cmd.command === "jobs"));
  assert.ok(commands.some((cmd) => cmd.command === "agent"));
  assert.ok(commands.some((cmd) => cmd.command === "toolprogress"));
  assert.ok(commands.some((cmd) => cmd.command === "model" && /list/.test(cmd.description) && /reset/.test(cmd.description)));
  assert.ok(commands.some((cmd) => cmd.command === "cwd" && /reset/.test(cmd.description)));
});

test("/start deep-link admits a chat without an open window", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.createAgentPairingCode(agent.id, sha256Hex("pair-code"), 60);
    let admitted = "";
    const logs: string[] = [];

    const result = await findCommandDef("start")!.handler(baseCtx(db, cwd, {
      agentId: agent.id,
      args: "pair-code extra",
      isAllowedChat: () => false,
      isHandshakeOpen: () => false,
      admitChat: (chatId) => {
        admitted = chatId;
        db.addAgentAllowlist(agent.id, chatId);
      },
      log: (line) => logs.push(line),
    }));

    assert.equal(admitted, "100");
    assert.equal(db.isAgentAllowed(agent.id, "100"), true);
    assert.match(result?.text ?? "", /connected/);
    assert.deepEqual(logs, ["[tg] deep-link paired chat 100"]);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("bare /start still requires the existing pairing window", async () => {
  const { db, cwd } = tempDb();
  try {
    let admitted = false;
    const closed = await findCommandDef("start")!.handler(baseCtx(db, cwd, {
      isAllowedChat: () => false,
      isHandshakeOpen: () => false,
      admitChat: () => {
        admitted = true;
      },
    }));
    assert.equal(closed, null);
    assert.equal(admitted, false);

    const opened = await findCommandDef("start")!.handler(baseCtx(db, cwd, {
      isAllowedChat: () => false,
      isHandshakeOpen: () => true,
      admitChat: () => {
        admitted = true;
      },
    }));
    assert.match(opened?.text ?? "", /connected/);
    assert.equal(admitted, true);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/new clears the binding thread without changing the workdir", async () => {
  const { db, cwd } = tempDb();
  try {
    const binding = db.getOrCreateBinding("telegram", "100", cwd);
    db.setBindingThread(binding.id, "thread-1");

    const result = await findCommandDef("new")!.handler(baseCtx(db, cwd));
    assert.equal(db.getBinding(binding.id)?.thread_id, null);
    assert.equal(db.getBinding(binding.id)?.workdir, cwd);
    assert.match(result?.text ?? "", /fresh conversation/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/effort validates the enum and updates the binding override", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    const bad = await findCommandDef("effort")!.handler(baseCtx(db, cwd, { agentId: agent.id, args: "turbo" }));
    assert.match(bad?.text ?? "", /effort must be one of/);

    const ok = await findCommandDef("effort")!.handler(baseCtx(db, cwd, { agentId: agent.id, args: "xhigh" }));
    assert.equal(db.getAgent(agent.id)?.effort, "default");
    assert.equal(db.getBinding(binding.id)?.effort, "xhigh");
    assert.equal(ok?.text, "Effort set to xhigh");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/cwd reset uses the command context workdir as the default", async () => {
  const { db, cwd } = tempDb();
  const other = mkdtempSync(join(tmpdir(), "tg-cwd-other-"));
  try {
    const binding = db.getOrCreateBinding("telegram", "100", cwd);
    db.setBindingWorkdir(binding.id, other);
    const result = await findCommandDef("cwd")!.handler(baseCtx(db, cwd, { args: "reset" }));

    assert.equal(result?.text, `Workdir reset: ${realpathSync(cwd)} (session reset)`);
    assert.equal(db.getBinding(binding.id)?.workdir, realpathSync(cwd));
  } finally {
    db.close();
    rmRfRetry(other);
    rmRfRetry(cwd);
  }
});

test("plain-mode forum commands operate on the chat-level binding while thread mode keeps topic binding", async () => {
  const { db, cwd } = tempDb();
  try {
    const plainAgent = db.createAgent("telegram-plain", "telegram", "tok-plain");
    db.updateAgent(plainAgent.id, { thread_mode: "plain", model: "agent-plain" });
    const plainChat = db.getOrCreateAgentBinding(plainAgent.id, "telegram", "100", cwd, null);
    const plainTopic = db.getOrCreateAgentBinding(plainAgent.id, "telegram", "100", cwd, "9");
    db.setBindingModel(plainChat.id, "chat-model");
    db.setBindingModel(plainTopic.id, "topic-model");
    const forumMsg: TgMessage = {
      message_id: 1,
      text: "/model reset",
      chat: { id: 100, type: "supergroup", is_forum: true },
      is_topic_message: true,
      message_thread_id: 9,
    };

    const plainResult = await findCommandDef("model")!.handler(baseCtx(db, cwd, {
      agentId: plainAgent.id,
      args: "reset",
      msg: forumMsg,
    }));

    assert.equal(plainResult?.text, "Model reset to agent-plain");
    assert.equal(db.getBinding(plainChat.id)?.model, "default");
    assert.equal(db.getBinding(plainTopic.id)?.model, "topic-model");

    const threadAgent = db.createAgent("telegram-thread", "telegram", "tok-thread");
    db.updateAgent(threadAgent.id, { thread_mode: "thread", model: "agent-thread" });
    const threadChat = db.getOrCreateAgentBinding(threadAgent.id, "telegram", "100", cwd, null);
    const threadTopic = db.getOrCreateAgentBinding(threadAgent.id, "telegram", "100", cwd, "9");
    db.setBindingModel(threadChat.id, "chat-thread-model");
    db.setBindingModel(threadTopic.id, "topic-thread-model");

    const threadResult = await findCommandDef("model")!.handler(baseCtx(db, cwd, {
      agentId: threadAgent.id,
      args: "reset",
      msg: forumMsg,
    }));

    assert.equal(threadResult?.text, "Model reset to agent-thread");
    assert.equal(db.getBinding(threadChat.id)?.model, "chat-thread-model");
    assert.equal(db.getBinding(threadTopic.id)?.model, "default");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("bare /mode shows a Telegram picker with the current mode marked", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.updateAgent(agent.id, { thread_mode: "plain" });
    db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    const result = await findCommandDef("mode")!.handler(baseCtx(db, cwd, { agentId: agent.id }));
    assert.match(result?.text ?? "", /Current mode: plain/);
    assert.equal(result?.keyboard?.[0]?.length, 2);
    assert.match(result?.keyboard?.[0]?.[1]?.text ?? "", /^\* Plain/);
    assert.match(result?.keyboard?.[0]?.[1]?.callback_data ?? "", /^o:\d+:plain$/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/toolprogress uses the named-agent picker and persists explicit values", async () => {
  const { db, cwd } = tempDb();
  try {
    const agent = db.createAgent("telegram-progress", "telegram", "tok");
    db.getOrCreateAgentBinding(agent.id, "telegram", "100", cwd);
    const query = await findCommandDef("toolprogress")!.handler(baseCtx(db, cwd, { agentId: agent.id }));
    assert.match(query?.text ?? "", /Current tool progress: new/);
    assert.equal(query?.keyboard?.flat().length, 4);
    assert.match(query?.keyboard?.flat()[1]?.callback_data ?? "", /^p:\d+:new$/);
    for (const mode of ["off", "new", "all", "verbose"]) {
      const result = await findCommandDef("toolprogress")!.handler(baseCtx(db, cwd, { agentId: agent.id, args: mode }));
      assert.equal(result?.text, `Tool progress set to ${mode}`);
      assert.equal(db.getAgent(agent.id)?.tool_progress, mode);
    }
    const invalid = await findCommandDef("toolprogress")!.handler(baseCtx(db, cwd, { agentId: agent.id, args: "sometimes" }));
    assert.match(invalid?.text ?? "", /must be one of/);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/stop reports when there is no running turn", async () => {
  const { db, cwd } = tempDb();
  try {
    const result = await findCommandDef("stop")!.handler(baseCtx(db, cwd));
    assert.equal(result?.text, "No running turn for this chat.");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/retry replays the last stored prompt through AgentService", async () => {
  const { db, cwd } = tempDb();
  try {
    const binding = db.getOrCreateBinding("telegram", "100", cwd);
    db.createJob(binding.id, "please retry me");
    const seen: IncomingRequest[] = [];
    const result = await findCommandDef("retry")!.handler(
      baseCtx(db, cwd, {
        agentService: stubAgentService(async (req) => {
          seen.push(req);
          return { ok: true, text: "retried answer" };
        }),
      }),
    );

    assert.equal(seen[0]?.text, "please retry me");
    assert.equal(result?.text, "retried answer");
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});

test("/retry sends Telegram approval cards through the command context", async () => {
  const { db, cwd } = tempDb();
  try {
    const msg: TgMessage = {
      message_id: 1,
      text: "/retry",
      chat: { id: 100, type: "supergroup", is_forum: true },
      is_topic_message: true,
      message_thread_id: 9,
    };
    const binding = db.getOrCreateBinding("telegram", "100", cwd, "9");
    db.createJob(binding.id, "please retry me");
    const approval: ApprovalRequest = {
      id: "ap_tg_retry",
      bindingId: binding.id,
      promptHash: "hash-tg",
      workdir: cwd,
      expiresAt: 123,
    };
    const sent: unknown[] = [];
    const cleaned: unknown[] = [];
    const cleanups: Array<() => void | Promise<void>> = [];
    const api = {
      deleteForumTopic: async () => ({ ok: true, result: true }),
      sendMessageWithKeyboard: async (params: unknown) => {
        sent.push(params);
        return { ok: true, result: { message_id: 77, chat: msg.chat } };
      },
      editMessageReplyMarkup: async (chatId: string, messageId: number) => {
        cleaned.push({ chatId, messageId });
        return { ok: true, result: { message_id: messageId, chat: msg.chat } };
      },
    } as unknown as TelegramApi;
    const service = {
      handleIncoming: async (req: IncomingRequest) => {
        await req.onApprovalRequest?.(approval);
        return { ok: false, error: "approval required" };
      },
      cancelTurn: () => false,
      registerApprovalCleanup: (_id: string, cleanup: () => void | Promise<void>) => {
        cleanups.push(cleanup);
        return true;
      },
      shutdown() {},
    } as unknown as AgentService;

    const result = await findCommandDef("retry")!.handler(
      baseCtx(db, cwd, { msg, agentService: service, api }),
    );

    assert.match(result?.text ?? "", /approval required/);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], {
      chatId: "100",
      text: [
        "Approval required before Codex can run.",
        "id: ap_tg_retry",
        "prompt: hash-tg",
        `cwd: ${cwd}`,
        "fallback: /approve ap_tg_retry allow-once",
      ].join("\n"),
      messageThreadId: 9,
      inlineKeyboard: [
        [
          { text: "Allow once", callback_data: "a:ap_tg_retry:allow-once" },
          { text: "Allow always", callback_data: "a:ap_tg_retry:allow-always" },
        ],
        [{ text: "Deny", callback_data: "d:ap_tg_retry:deny" }],
      ],
    });
    assert.equal(cleanups.length, 1);
    await cleanups[0]();
    assert.deepEqual(cleaned, [{ chatId: "100", messageId: 77 }]);
  } finally {
    db.close();
    rmRfRetry(cwd);
  }
});
