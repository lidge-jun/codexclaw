/**
 * agent-routes.test.ts — /api/agents CRUD surface (slice 40): stubbed token
 * validator, token-leak guard, effort enum, enable/delete guards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BridgeDb } from "../src/db.ts";
import { agentRoutes } from "../src/agent-routes.ts";
import type { ApiCtx, ApiRoute } from "../src/server.ts";

function makeCtx(): ApiCtx {
  const db = new BridgeDb(join(mkdtempSync(join(tmpdir(), "cxc-ar-")), "bridge.db"));
  return { db, cwd: "/tmp", version: "test" };
}

const okValidate = async () => ({ ok: true, username: "bot" });
const failValidate = async () => ({ ok: false, error: "401: Unauthorized" });

function route(routes: ApiRoute[], method: string, path: string): ApiRoute {
  const r = routes.find((x) => x.method === method && x.path === path);
  assert.ok(r, `route ${method} ${path} missing`);
  return r as ApiRoute;
}

const URL0 = new URL("http://localhost/");

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
    { id, model: "anthropic/claude-sonnet-5", effort: "xhigh", autoSend: false, mentionOnly: false, heartbeatMinutes: 15, heartbeatPrompt: "status?" },
    URL0,
  );
  assert.equal(ok.status, 200);
  const agent = (ok.body as { agent: Record<string, unknown> }).agent;
  assert.equal(agent.model, "anthropic/claude-sonnet-5");
  assert.equal(agent.effort, "xhigh");
  assert.equal(agent.autoSend, false);
  assert.equal(agent.mentionOnly, false);
  assert.equal(agent.heartbeatMinutes, 15);

  const badHb = await route(routes, "POST", "/api/agents/update").handler(ctx, { id, heartbeatMinutes: -5 }, URL0);
  assert.equal(badHb.status, 400);
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
