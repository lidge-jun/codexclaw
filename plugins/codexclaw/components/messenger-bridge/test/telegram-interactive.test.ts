/** telegram-interactive.test.ts — callback encoding, pickers, and router behavior. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBridgeDb } from "../src/db.ts";
import {
  buildEffortPicker,
  buildModelPicker,
  decodeCallback,
  encodeCallback,
  handleCallback,
  loadModelCatalog,
} from "../src/telegram-interactive.ts";
import type { TelegramApi, TgCallbackQuery } from "../src/telegram-api.ts";

interface Call {
  method: string;
  payload: unknown[];
}

function mockApi(): TelegramApi & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    answerCallbackQuery: async (...payload: unknown[]) => {
      calls.push({ method: "answerCallbackQuery", payload });
      return { ok: true, result: true };
    },
    sendMessage: async (...payload: unknown[]) => {
      calls.push({ method: "sendMessage", payload });
      return { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } };
    },
    editMessageText: async (...payload: unknown[]) => {
      calls.push({ method: "editMessageText", payload });
      return { ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } };
    },
  } as unknown as TelegramApi & { calls: Call[] };
}

function callback(data: string): TgCallbackQuery {
  return {
    id: "cb-1",
    from: { id: 9 },
    data,
    message: { message_id: 10, chat: { id: 500, type: "private" } },
  };
}

function allowAgent(agentId: number) {
  return { agentId, isAllowedChat: (chatId: string) => chatId === "500" };
}

test("encodeCallback/decodeCallback round-trip and enforce Telegram's 64-byte cap", () => {
  const encoded = encodeCallback({ type: "effort_select", payload: "12:xhigh" });
  assert.equal(encoded, "e:12:xhigh");
  assert.deepEqual(decodeCallback(encoded), { type: "effort_select", payload: "12:xhigh" });
  assert.throws(() => encodeCallback({ type: "model_select", payload: "x".repeat(70) }), /64 bytes/);
});

test("pickers emit compact callback_data", () => {
  const modelKeyboard = buildModelPicker([{ id: "gpt-5.5", label: "gpt-5.5" }], "gpt-5.5", 123);
  const effortKeyboard = buildEffortPicker("high", 123);
  const allButtons = [...modelKeyboard.flat(), ...effortKeyboard.flat()];
  assert.ok(allButtons.every((button) => Buffer.byteLength(button.callback_data ?? "", "utf8") <= 64));
  assert.equal(decodeCallback(modelKeyboard[0][0].callback_data ?? "")?.type, "model_select");
  assert.equal(decodeCallback(effortKeyboard[0][0].callback_data ?? "")?.type, "effort_select");
  assert.equal(modelKeyboard[0][0].text, "* gpt-5.5");
  assert.equal(effortKeyboard.flat().find((button) => button.text.includes("high"))?.text, "* high");
  assert.ok(allButtons.every((button) => !button.text.includes("✅")));
});

test("handleCallback updates model and always answers the callback", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "tg-interactive-test-"));
  const db = openBridgeDb(cwd);
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "500", cwd);
    const firstModel = loadModelCatalog()[0]?.id;
    assert.ok(firstModel, "model catalog should not be empty");
    const api = mockApi();

    await handleCallback(api, callback(encodeCallback({ type: "model_select", payload: `${binding.id}:0` })), db, allowAgent(agent.id));

    assert.equal(db.getAgent(agent.id)?.model, "default");
    assert.equal(db.getBinding(binding.id)?.model, firstModel);
    assert.ok(api.calls.some((call) => call.method === "sendMessage"));
    assert.ok(api.calls.some((call) => call.method === "answerCallbackQuery"));
  } finally {
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleCallback updates effort and answers unknown callbacks", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "tg-interactive-test-"));
  const db = openBridgeDb(cwd);
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "500", cwd);
    const api = mockApi();

    await handleCallback(api, callback(encodeCallback({ type: "effort_select", payload: `${binding.id}:minimal` })), db, allowAgent(agent.id));
    await handleCallback(api, callback("unknown"), db, allowAgent(agent.id));

    assert.equal(db.getAgent(agent.id)?.effort, "default");
    assert.equal(db.getBinding(binding.id)?.effort, "minimal");
    const answers = api.calls.filter((call) => call.method === "answerCallbackQuery");
    assert.equal(answers.length, 2);
  } finally {
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleCallback routes approval buttons and leaves unpaired clicks unresolved", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "tg-interactive-test-"));
  const db = openBridgeDb(cwd);
  try {
    const api = mockApi();
    const approved = callback(encodeCallback({ type: "approve", payload: "ap_1:allow-always" }));
    let resolved: unknown[] | null = null;

    await handleCallback(api, approved, db, {
      agentId: null,
      isAllowedChat: (chatId) => chatId === "500",
      resolveApproval: (id, decision, chatId) => {
        resolved = [id, decision, chatId];
        return "resolved";
      },
    });

    assert.deepEqual(resolved, ["ap_1", "allow-always", "500"]);
    assert.equal(api.calls.at(-1)?.payload[1], "Approval allow-always");

    const deniedApi = mockApi();
    let called = false;
    await handleCallback(deniedApi, approved, db, {
      agentId: null,
      isAllowedChat: () => false,
      resolveApproval: () => {
        called = true;
        return "resolved";
      },
    });
    assert.equal(called, false);
    assert.equal(deniedApi.calls.at(-1)?.payload[1], "This chat is not paired");
  } finally {
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleCallback gates mode_select by binding chat and agent", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "tg-interactive-test-"));
  const db = openBridgeDb(cwd);
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "500");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "500", cwd);
    const otherBinding = db.getOrCreateAgentBinding(agent.id, "telegram", "501", cwd);
    const deniedApi = mockApi();

    await handleCallback(
      deniedApi,
      callback(encodeCallback({ type: "mode_select", payload: `${otherBinding.id}:plain` })),
      db,
      allowAgent(agent.id),
    );
    assert.equal(db.getAgent(agent.id)?.thread_mode, "thread");
    assert.equal(deniedApi.calls.at(-1)?.payload[1], "This action belongs to another agent");

    const api = mockApi();
    await handleCallback(
      api,
      callback(encodeCallback({ type: "mode_select", payload: `${binding.id}:plain` })),
      db,
      allowAgent(agent.id),
    );
    assert.equal(db.getAgent(agent.id)?.thread_mode, "plain");
    assert.ok(api.calls.some((call) => call.method === "editMessageText"));
    assert.equal(api.calls.at(-1)?.payload[1], "Mode set");
  } finally {
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleCallback answers malformed mode_select payloads without mutating", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "tg-interactive-test-"));
  const db = openBridgeDb(cwd);
  try {
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.addAgentAllowlist(agent.id, "500");
    const api = mockApi();

    await handleCallback(api, callback(encodeCallback({ type: "mode_select", payload: "not-a-binding" })), db, allowAgent(agent.id));

    assert.equal(db.getAgent(agent.id)?.thread_mode, "thread");
    assert.equal(api.calls.at(-1)?.payload[1], "Invalid mode selection");
  } finally {
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
});
