/** telegram-api.test.ts — Telegram Bot API client payloads. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { TelegramApi } from "../src/telegram-api.ts";

test("setWebhook sends secret_token and allowed update types", async () => {
  const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
  const api = new TelegramApi("TOKEN", async (url, init) => {
    calls.push({
      method: url.split("/").pop() ?? "",
      body: init?.body ? JSON.parse(String(init.body)) : {},
    });
    return { json: async () => ({ ok: true, result: true }) } as Response;
  });

  const res = await api.setWebhook("https://bridge.example/webhook/telegram/s3", "s3");
  assert.equal(res.ok, true);
  assert.equal(calls[0].method, "setWebhook");
  assert.deepEqual(calls[0].body, {
    url: "https://bridge.example/webhook/telegram/s3",
    secret_token: "s3",
    allowed_updates: ["message", "callback_query"],
  });
});

test("sendDocument uploads in-memory files as multipart", async () => {
  const calls: Array<{ method: string; headers: Record<string, string>; body: string }> = [];
  const api = new TelegramApi("TOKEN", async (url, init) => {
    calls.push({
      method: url.split("/").pop() ?? "",
      headers: init?.headers as Record<string, string>,
      body: new TextDecoder().decode(init?.body as Uint8Array),
    });
    return { json: async () => ({ ok: true, result: { message_id: 1, chat: { id: 1, type: "private" } } }) } as Response;
  });

  const res = await api.sendDocument({
    chatId: 500,
    document: { name: "codex-output.txt", content: "hello file" },
    caption: "output",
  });

  assert.equal(res.ok, true);
  assert.equal(calls[0].method, "sendDocument");
  assert.match(calls[0].headers["content-type"], /^multipart\/form-data; boundary=codexclaw-/);
  assert.match(calls[0].body, /name="chat_id"\r\n\r\n500/);
  assert.match(calls[0].body, /filename="codex-output\.txt"/);
  assert.match(calls[0].body, /hello file/);
});
