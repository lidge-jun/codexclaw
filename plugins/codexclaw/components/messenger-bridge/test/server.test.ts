/** server.test.ts — bridge HTTP server: health, static, traversal guard, GUI API parity. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { openBridgeDb, type BridgeDb } from "../src/db.ts";
import { createBridgeServer, type BridgeControllerLike } from "../src/server.ts";
import { parseServeArgs } from "../src/cli.ts";

interface Harness {
  cwd: string;
  db: BridgeDb;
  server: Server;
  base: string;
}

async function startHarness(withGui = true, controller?: BridgeControllerLike, readmePath?: string): Promise<Harness> {
  const cwd = mkdtempSync(join(tmpdir(), "bridge-server-test-"));
  const guiDir = join(cwd, "gui-dist");
  if (withGui) {
    mkdirSync(join(guiDir, "assets"), { recursive: true });
    writeFileSync(join(guiDir, "index.html"), "<html><body>codexclaw shell</body></html>");
    writeFileSync(join(guiDir, "assets", "app.js"), "console.log('app')");
  }
  const db = openBridgeDb(cwd);
  const server = createBridgeServer({ db, cwd, guiDir, version: "0.1.0-test", controller, readmePath });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { cwd, db, server, base: `http://127.0.0.1:${port}` };
}

async function stopHarness(h: Harness): Promise<void> {
  await new Promise<void>((resolve) => h.server.close(() => resolve()));
  h.db.close();
  rmSync(h.cwd, { recursive: true, force: true });
}

function post(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-codexclaw-local": "1" },
    body: JSON.stringify(body),
  });
}

test("GET /api/health returns ok + activeChannel", async () => {
  const h = await startHarness();
  try {
    const res = await fetch(`${h.base}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; version: string; activeChannel: string | null };
    assert.equal(body.ok, true);
    assert.equal(body.version, "0.1.0-test");
    assert.equal(body.activeChannel, null);

    h.db.setChannelToken("telegram", "t");
    h.db.setActiveChannel("telegram");
    const res2 = await fetch(`${h.base}/api/health`);
    const body2 = (await res2.json()) as { activeChannel: string | null };
    assert.equal(body2.activeChannel, "telegram");
  } finally {
    await stopHarness(h);
  }
});

test("unknown /api route 404s with JSON", async () => {
  const h = await startHarness();
  try {
    const res = await fetch(`${h.base}/api/nope`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /no route/);
  } finally {
    await stopHarness(h);
  }
});

test("POST /webhook/telegram/:secret dispatches before the /api route table", async () => {
  const seen: Array<{ secret: string; header: string | string[] | undefined }> = [];
  const controller: BridgeControllerLike = {
    async reload() {},
    stop() {},
    activeKind: () => null,
    adapterStatus: () => "stopped",
    openHandshake() {},
    handshakeState: () => ({ open: false, pairedChatId: null }),
    handleTelegramWebhook: async (secret, req, res) => {
      seen.push({ secret, header: req.headers["x-telegram-bot-api-secret-token"] });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return true;
    },
  };
  const h = await startHarness(true, controller);
  try {
    const res = await fetch(`${h.base}/webhook/telegram/s3`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "s3" },
      body: JSON.stringify({ update_id: 1 }),
    });
    assert.equal(res.status, 200);
    assert.equal(seen[0]?.secret, "s3");
    assert.equal(seen[0]?.header, "s3");
  } finally {
    await stopHarness(h);
  }
});

test("static serving + SPA fallback + traversal guard", async () => {
  const h = await startHarness();
  try {
    const index = await fetch(`${h.base}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /codexclaw shell/);

    const asset = await fetch(`${h.base}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type") ?? "", /javascript/);

    // SPA fallback: unknown path returns the shell, not 404
    const spa = await fetch(`${h.base}/channels`);
    assert.match(await spa.text(), /codexclaw shell/);

    // traversal attempts never escape guiDir (fetch normalizes ../, so use encoded form)
    const traversal = await fetch(`${h.base}/..%2f..%2f..%2fetc%2fpasswd`);
    assert.equal(traversal.status, 200);
    assert.match(await traversal.text(), /codexclaw shell/);
  } finally {
    await stopHarness(h);
  }
});

test("/readme serves the component README ahead of the SPA fallback", async () => {
  const readmeDir = mkdtempSync(join(tmpdir(), "bridge-readme-test-"));
  const readmeFile = join(readmeDir, "README.md");
  writeFileSync(readmeFile, "# codexclaw messenger bridge\n\ndocs body\n");
  const h = await startHarness(true, undefined, readmeFile);
  try {
    const res = await fetch(`${h.base}/readme`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/markdown/);
    assert.match(await res.text(), /# codexclaw messenger bridge/);
  } finally {
    await stopHarness(h);
    rmSync(readmeDir, { recursive: true, force: true });
  }
});

test("/readme returns 404 when the file is missing", async () => {
  const h = await startHarness(true, undefined, join(tmpdir(), "nope", "README.md"));
  try {
    const res = await fetch(`${h.base}/readme`);
    assert.equal(res.status, 404);
  } finally {
    await stopHarness(h);
  }
});

test("missing GUI build serves degraded message", async () => {
  const h = await startHarness(false);
  try {
    const res = await fetch(`${h.base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /GUI build missing/);
  } finally {
    await stopHarness(h);
  }
});

test("GUI API parity: subagents GET defaults + POST persists", async () => {
  const h = await startHarness();
  try {
    const res = await fetch(`${h.base}/api/subagents`);
    assert.equal(res.status, 200);
    const config = (await res.json()) as { roles: Record<string, { mode: string }> };
    assert.equal(config.roles.explorer?.mode, "default");

    const post = await fetch(`${h.base}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-codexclaw-local": "1" },
      body: JSON.stringify({ role: "explorer", mode: "model", model: "gpt-5.5" }),
    });
    assert.equal(post.status, 200);
    const saved = JSON.parse(
      readFileSync(join(h.cwd, ".codexclaw", "subagents.json"), "utf8"),
    ) as { roles: Record<string, { mode: string; model: string | null }> };
    assert.equal(saved.roles.explorer?.mode, "model");
    assert.equal(saved.roles.explorer?.model, "gpt-5.5");

    const bad = await fetch(`${h.base}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-codexclaw-local": "1" },
      body: JSON.stringify({ role: "nope" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    await stopHarness(h);
  }
});

test("GUI API parity: catalog + provider respond 200", async () => {
  const h = await startHarness();
  try {
    const catalog = await fetch(`${h.base}/api/catalog`);
    assert.equal(catalog.status, 200);
    const catalogBody = (await catalog.json()) as { entries?: unknown[]; state?: string };
    assert.ok(Array.isArray(catalogBody.entries));

    const provider = await fetch(`${h.base}/api/provider`);
    assert.equal(provider.status, 200);
    const providerBody = (await provider.json()) as { mode: string };
    assert.ok(["native", "provider", "error"].includes(providerBody.mode));
  } finally {
    await stopHarness(h);
  }
});

test("local guard rejects CSRF-shaped mutating requests", async () => {
  const h = await startHarness();
  try {
    // Missing x-codexclaw-local header (a cross-origin page can't set it).
    const noHeader = await fetch(`${h.base}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "explorer", mode: "default" }),
    });
    assert.equal(noHeader.status, 403);

    // Simple-request content-type (form) is rejected even with a body.
    const simpleCt = await fetch(`${h.base}/api/subagents`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-codexclaw-local": "1" },
      body: JSON.stringify({ role: "explorer" }),
    });
    assert.equal(simpleCt.status, 403);

    // GET is not gated by the header (read-only).
    assert.equal((await fetch(`${h.base}/api/health`)).status, 200);
  } finally {
    await stopHarness(h);
  }
});

test("new agent pairing routes require local guard headers", async () => {
  const h = await startHarness();
  try {
    const pairing = await fetch(`${h.base}/api/agents/pairing-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1 }),
    });
    const send = await fetch(`${h.base}/api/agents/test-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, chatId: "42" }),
    });

    assert.equal(pairing.status, 403);
    assert.equal(send.status, 403);
  } finally {
    await stopHarness(h);
  }
});

test("observability routes delegate to the live controller", async () => {
  const controller: BridgeControllerLike = {
    async reload() {},
    stop() {},
    activeKind: () => null,
    adapterStatus: () => "stopped",
    openHandshake() {},
    handshakeState: () => ({ open: false, pairedChatId: null }),
    agentStatuses: () => [{ agentId: 1, name: "telegram-1", kind: "telegram", status: "running" }],
    metricsSnapshot: () => ({
      messagesReceived: 2,
      turnsCompleted: 1,
      errors: 0,
      rateLimits: { telegram: 0, discord: 0 },
      avgResponseTimeMs: 42,
      perAgent: { "1": { messages: 2, turns: 1, errors: 0 } },
    }),
    recentEvents: () => [{ type: "lifecycle", payload: { action: "reload" }, ts: "t1" }],
  };
  const h = await startHarness(true, controller);
  try {
    const statuses = (await (await fetch(`${h.base}/api/agents/statuses`)).json()) as {
      statuses: Array<{ status: string }>;
    };
    assert.equal(statuses.statuses[0]?.status, "running");

    const metrics = (await (await fetch(`${h.base}/api/metrics`)).json()) as { messagesReceived: number };
    assert.equal(metrics.messagesReceived, 2);

    const events = (await (await fetch(`${h.base}/api/events?n=5`)).json()) as { events: Array<{ type: string }> };
    assert.equal(events.events[0]?.type, "lifecycle");
  } finally {
    await stopHarness(h);
  }
});

test("agent statuses route returns JSON error without a live controller", async () => {
  const h = await startHarness();
  try {
    const res = await fetch(`${h.base}/api/agents/statuses`);
    assert.equal(res.status, 501);
    assert.match(((await res.json()) as { error: string }).error, /not available/);
  } finally {
    await stopHarness(h);
  }
});

test("binding reset and cwd routes validate and mutate bindings", async () => {
  const h = await startHarness();
  try {
    const binding = h.db.getOrCreateBinding("telegram", "42", h.cwd);
    h.db.setBindingThread(binding.id, "thread-abc");

    const reset = await post(h.base, "/api/bindings/reset", { id: binding.id });
    assert.equal(reset.status, 200);
    assert.equal(h.db.getBinding(binding.id)?.thread_id, null);

    h.db.setBindingThread(binding.id, "thread-def");
    const nextDir = join(h.cwd, "next");
    mkdirSync(nextDir);
    const cwdRes = await post(h.base, "/api/bindings/cwd", { id: binding.id, cwd: nextDir });
    assert.equal(cwdRes.status, 200);
    assert.equal(h.db.getBinding(binding.id)?.workdir, realpathSync(nextDir));
    assert.equal(h.db.getBinding(binding.id)?.thread_id, null);

    const badCwd = await post(h.base, "/api/bindings/cwd", { id: binding.id, cwd: join(h.cwd, "missing") });
    assert.equal(badCwd.status, 400);
    const badId = await post(h.base, "/api/bindings/reset", { id: "42" });
    assert.equal(badId.status, 400);
  } finally {
    await stopHarness(h);
  }
});

test("parseServeArgs: defaults, overrides, validation", () => {
  assert.deepEqual(parseServeArgs([], "/base"), { port: 7717, cwd: "/base" });
  assert.deepEqual(parseServeArgs(["--port", "8080", "--cwd", "sub"], "/base"), {
    port: 8080,
    cwd: "/base/sub",
  });
  assert.throws(() => parseServeArgs(["--port", "abc"], "/base"), /invalid --port/);
});
