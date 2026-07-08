/**
 * agent-routes.test.ts — /api/agents CRUD surface (slice 40): stubbed token
 * validator, token-leak guard, effort enum, enable/delete guards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BridgeDb } from "../src/db.ts";
import { agentRoutes } from "../src/agent-routes.ts";
import type { ApiCtx, ApiRoute } from "../src/server.ts";

function makeCtx(): ApiCtx & { dbPath: string } {
  const dbPath = join(mkdtempSync(join(tmpdir(), "cxc-ar-")), "bridge.db");
  const db = new BridgeDb(dbPath);
  return { db, dbPath, cwd: "/tmp", version: "test" };
}

const okValidate = async () => ({ ok: true, username: "bot" });
const failValidate = async () => ({ ok: false, error: "401: Unauthorized" });

function route(routes: ApiRoute[], method: string, path: string): ApiRoute {
  const r = routes.find((x) => x.method === method && x.path === path);
  assert.ok(r, `route ${method} ${path} missing`);
  return r as ApiRoute;
}

const URL0 = new URL("http://localhost/");

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("create -> list: agent appears with hasToken, token never serialized", async () => {
  const ctx = makeCtx();
  const routes = agentRoutes({ validate: okValidate });
  const created = await route(routes, "POST", "/api/agents").handler(
    ctx,
    { name: "telegram-1", kind: "telegram", token: "SECRET-TOKEN-XYZ" },
    URL0,
  );
  assert.equal(created.status, 200);
  const listed = await route(routes, "GET", "/api/agents").handler(ctx, null, URL0);
  const json = JSON.stringify(listed.body) + JSON.stringify(created.body);
  assert.ok(!json.includes("SECRET-TOKEN-XYZ"), "raw token leaked in a response");
  const agents = (listed.body as { agents: Array<Record<string, unknown>> }).agents;
  assert.equal(agents.length, 1);
  assert.equal(agents[0].hasToken, true);
  assert.equal(agents[0].enabled, false);
  assert.equal(agents[0].fullAccess, true);
  assert.equal(agents[0].webhookUrl, "");
});

test("create: invalid token -> 400 with the validator error; duplicate name -> 400", async () => {
  const ctx = makeCtx();
  const bad = await route(agentRoutes({ validate: failValidate }), "POST", "/api/agents").handler(
    ctx,
    { name: "a", kind: "telegram", token: "x" },
    URL0,
  );
  assert.equal(bad.status, 400);
  assert.match(String((bad.body as { error?: string }).error), /Unauthorized/);

  const routes = agentRoutes({ validate: okValidate });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "dup", kind: "discord", token: "t" }, URL0);
  const dup = await route(routes, "POST", "/api/agents").handler(ctx, { name: "dup", kind: "discord", token: "t" }, URL0);
  assert.equal(dup.status, 400);
});

test("update: effort enum rejected, valid patch applied, autoSend/mentionOnly map to 0/1", async () => {
  const ctx = makeCtx();
  const routes = agentRoutes({ validate: okValidate });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "a1", kind: "telegram", token: "t" }, URL0);
  const id = ctx.db.getAgentByName("a1")!.id;

  const badEffort = await route(routes, "POST", "/api/agents/update").handler(ctx, { id, effort: "turbo" }, URL0);
  assert.equal(badEffort.status, 400);

  const ok = await route(routes, "POST", "/api/agents/update").handler(
    ctx,
    {
      id,
      model: "anthropic/claude-sonnet-5",
      effort: "xhigh",
      autoSend: false,
      mentionOnly: false,
      fullAccess: false,
      webhookUrl: "https://bridge.example/webhook/telegram/sec",
      heartbeatMinutes: 15,
      heartbeatPrompt: "status?",
    },
    URL0,
  );
  assert.equal(ok.status, 200);
  const agent = (ok.body as { agent: Record<string, unknown> }).agent;
  assert.equal(agent.model, "anthropic/claude-sonnet-5");
  assert.equal(agent.effort, "xhigh");
  assert.equal(agent.autoSend, false);
  assert.equal(agent.mentionOnly, false);
  assert.equal(agent.fullAccess, false);
  assert.equal(agent.webhookUrl, "https://bridge.example/webhook/telegram/sec");
  assert.equal(agent.heartbeatMinutes, 15);

  const badHb = await route(routes, "POST", "/api/agents/update").handler(ctx, { id, heartbeatMinutes: -5 }, URL0);
  assert.equal(badHb.status, 400);
  const badWebhook = await route(routes, "POST", "/api/agents/update").handler(ctx, { id, webhookUrl: "http://bad.example/hook" }, URL0);
  assert.equal(badWebhook.status, 400);

  // threadMode: enum-validated at the route, CHECK-backed in the DB.
  const badMode = await route(routes, "POST", "/api/agents/update").handler(ctx, { id, threadMode: "bogus" }, URL0);
  assert.equal(badMode.status, 400);
  const okMode = await route(routes, "POST", "/api/agents/update").handler(ctx, { id, threadMode: "plain" }, URL0);
  assert.equal(okMode.status, 200);
  assert.equal((okMode.body as { agent: { threadMode: string } }).agent.threadMode, "plain");
});

test("enable requires a token; delete refuses while enabled then succeeds", async () => {
  const ctx = makeCtx();
  const routes = agentRoutes({ validate: okValidate });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "a1", kind: "telegram", token: "t" }, URL0);
  const id = ctx.db.getAgentByName("a1")!.id;

  const on = await route(routes, "POST", "/api/agents/enable").handler(ctx, { id, enabled: true }, URL0);
  assert.equal(on.status, 200);
  const delWhileEnabled = await route(routes, "POST", "/api/agents/delete").handler(ctx, { id }, URL0);
  assert.equal(delWhileEnabled.status, 400);
  await route(routes, "POST", "/api/agents/enable").handler(ctx, { id, enabled: false }, URL0);
  const del = await route(routes, "POST", "/api/agents/delete").handler(ctx, { id }, URL0);
  assert.equal(del.status, 200);
  assert.equal(ctx.db.getAgent(id), null);
});

test("handshake open/status via routes; unknown agent -> 400", async () => {
  const ctx = makeCtx();
  const routes = agentRoutes({ validate: okValidate });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "a1", kind: "telegram", token: "t" }, URL0);
  const id = ctx.db.getAgentByName("a1")!.id;

  const open = await route(routes, "POST", "/api/agents/handshake/open").handler(ctx, { id, seconds: 60 }, URL0);
  assert.equal(open.status, 200);
  const status = await route(routes, "GET", "/api/agents/handshake/status").handler(
    ctx,
    null,
    new URL(`http://localhost/api/agents/handshake/status?id=${id}`),
  );
  assert.equal((status.body as { open: boolean }).open, true);
  const missing = await route(routes, "GET", "/api/agents/handshake/status").handler(
    ctx,
    null,
    new URL("http://localhost/api/agents/handshake/status?id=9999"),
  );
  assert.equal(missing.status, 400);
});

test("pairing-link mints a Telegram deep link and stores only the code hash", async () => {
  const ctx = makeCtx();
  const routes = agentRoutes({ validate: async () => ({ ok: true, username: "cxcbot" }) });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "tg", kind: "telegram", token: "tok" }, URL0);
  const id = ctx.db.getAgentByName("tg")!.id;

  const res = await route(routes, "POST", "/api/agents/pairing-link").handler(ctx, { id, seconds: 9999 }, URL0);

  assert.equal(res.status, 200);
  const body = res.body as { ok: boolean; url: string; code: string; expiresAt: number };
  assert.equal(body.ok, true);
  assert.match(body.code, /^[A-Za-z0-9_-]{22,}$/);
  assert.equal(body.url, `https://t.me/cxcbot?start=${body.code}`);
  assert.ok(body.expiresAt <= Date.now() + 3600_000 + 1000);

  const raw = new DatabaseSync(ctx.dbPath);
  const stored = raw.prepare("SELECT code_hash FROM agent_pairing_codes").get() as { code_hash: string };
  raw.close();
  assert.equal(stored.code_hash, sha256Hex(body.code));
  assert.ok(!JSON.stringify(stored).includes(body.code));
});

test("pairing-link rejects Discord agents", async () => {
  const ctx = makeCtx();
  const routes = agentRoutes({ validate: okValidate });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "dc", kind: "discord", token: "tok" }, URL0);
  const id = ctx.db.getAgentByName("dc")!.id;

  const res = await route(routes, "POST", "/api/agents/pairing-link").handler(ctx, { id }, URL0);

  assert.equal(res.status, 400);
});

test("test-send uses explicit chatId or newest allowlist target via stubbed factories", async () => {
  const ctx = makeCtx();
  const calls: Array<{ kind: string; chatId: string; text: string }> = [];
  const routes = agentRoutes({
    validate: okValidate,
    telegramApiFactory: () => ({
      sendMessage: async (payload) => {
        calls.push({ kind: "telegram", chatId: payload.chatId, text: payload.text });
        return { ok: true, result: { message_id: 1, chat: { id: Number(payload.chatId), type: "private" } } };
      },
    }),
    discordApiFactory: () => ({
      sendMessage: async (chatId, text) => {
        calls.push({ kind: "discord", chatId, text });
        return { ok: true, status: 200, data: { id: "m1" } };
      },
    }),
  });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "tg", kind: "telegram", token: "tok" }, URL0);
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "dc", kind: "discord", token: "tok2" }, URL0);
  const tg = ctx.db.getAgentByName("tg")!.id;
  const dc = ctx.db.getAgentByName("dc")!.id;
  ctx.db.addAgentAllowlist(tg, "old");
  ctx.db.addAgentAllowlist(tg, "new");
  ctx.db.addAgentAllowlist(dc, "chan-1");
  const raw = new DatabaseSync(ctx.dbPath);
  raw.prepare("UPDATE agent_allowlist SET added_at = ? WHERE agent_id = ? AND chat_id = ?").run("2026-07-07T00:00:00.000Z", tg, "old");
  raw.prepare("UPDATE agent_allowlist SET added_at = ? WHERE agent_id = ? AND chat_id = ?").run("2026-07-07T00:01:00.000Z", tg, "new");
  raw.close();

  const implicit = await route(routes, "POST", "/api/agents/test-send").handler(ctx, { id: tg }, URL0);
  const explicit = await route(routes, "POST", "/api/agents/test-send").handler(ctx, { id: dc, chatId: "chan-1" }, URL0);
  const unpaired = await route(routes, "POST", "/api/agents/test-send").handler(ctx, { id: dc, chatId: "chan-nope" }, URL0);

  assert.equal(implicit.status, 200);
  assert.equal((implicit.body as { chatId: string }).chatId, "new");
  assert.equal(explicit.status, 200);
  assert.equal(unpaired.status, 400);
  assert.deepEqual(calls, [
    { kind: "telegram", chatId: "new", text: "codexclaw bridge connected — this chat is ready." },
    { kind: "discord", chatId: "chan-1", text: "codexclaw bridge connected — this chat is ready." },
  ]);
});

test("test-send returns 400 without an explicit or paired target and on send failure", async () => {
  const ctx = makeCtx();
  const routes = agentRoutes({
    validate: okValidate,
    telegramApiFactory: () => ({
      sendMessage: async () => ({ ok: false, description: "nope" }),
    }),
  });
  await route(routes, "POST", "/api/agents").handler(ctx, { name: "tg", kind: "telegram", token: "tok" }, URL0);
  const id = ctx.db.getAgentByName("tg")!.id;

  const noTarget = await route(routes, "POST", "/api/agents/test-send").handler(ctx, { id }, URL0);
  ctx.db.addAgentAllowlist(id, "500");
  const failed = await route(routes, "POST", "/api/agents/test-send").handler(ctx, { id }, URL0);

  assert.equal(noTarget.status, 400);
  assert.equal(failed.status, 400);
});
