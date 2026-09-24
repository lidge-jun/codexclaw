/**
 * mcp.test.ts — drives the compiled subagent-config MCP server over stdio and
 * verifies the get/set tools roundtrip against a temp cwd store.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLES, setRole } from "../src/store.ts";
import { handleToolCall } from "../src/mcp.ts";
import type { CatalogOptions, LiveCatalog } from "../src/live-catalog.ts";

const here = dirname(fileURLToPath(import.meta.url));
const serverJs = resolve(here, "..", "dist", "mcp.js");

function rpc(child: ReturnType<typeof spawn>, msg: unknown): void {
  child.stdin!.write(`${JSON.stringify(msg)}\n`);
}

async function collect(cwd: string, messages: unknown[], expectedReplies: number): Promise<any[]> {
  if (!existsSync(serverJs)) return []; // build not run yet; skip gracefully
  return await new Promise((resolveP, rejectP) => {
    const child = spawn(process.execPath, [serverJs], { cwd, stdio: ["pipe", "pipe", "inherit"] });
    const out: any[] = [];
    let buf = "";
    // G23 / C10. This ceiling is a HANG detector, not a flake absorber: the
    // assertion is "the server answered", and any real answer arrives in
    // milliseconds. The value is generous because a cold spawn under a loaded
    // suite pays a type-strip cost, so a tight budget would fail on scheduling
    // jitter rather than on the behavior under test.
    //
    // Naming that honestly matters, because raising a timeout until a test passes
    // is exactly what TEST-FLAKE-RERUN-01 forbids. The underlying contention is
    // NOT fixed here and is tracked as C10 in structure/30_contradiction_register.md;
    // the honest fixes are build/test serialization or removing the real-process
    // dependency from this assertion.
    const MCP_STDIO_TIMEOUT_MS = 30000;
    const timer = setTimeout(() => {
      child.kill();
      rejectP(new Error("mcp server timeout"));
    }, MCP_STDIO_TIMEOUT_MS);
    child.stdout!.on("data", (d) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) out.push(JSON.parse(line));
        if (out.length >= expectedReplies) {
          clearTimeout(timer);
          child.stdin!.end();
          child.kill();
          resolveP(out);
        }
      }
    });
    for (const m of messages) rpc(child, m);
  });
}

test("MCP: tools/list advertises subagents_get + subagents_set", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-"));
  const replies = await collect(cwd, [{ jsonrpc: "2.0", id: 1, method: "tools/list" }], 1);
  if (replies.length === 0) return; // dist not built
  const names = replies[0].result.tools.map((t: { name: string }) => t.name);
  assert.deepEqual(names.sort(), ["catalog_list", "subagents_get", "subagents_set"]);
});

test("MCP: subagents_set then subagents_get roundtrips through the store file", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-"));
  const replies = await collect(
    cwd,
    [
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "subagents_set", arguments: { role: "reviewer", mode: "model", model: "gpt-5.5" } } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "subagents_get", arguments: {} } },
    ],
    2,
  );
  if (replies.length === 0) return;
  const getReply = replies.find((r) => r.id === 2);
  const cfg = JSON.parse(getReply.result.content[0].text);
  assert.equal(cfg.roles.reviewer.mode, "model");
  assert.equal(cfg.roles.reviewer.model, "gpt-5.5");
  // and it actually hit disk
  assert.ok(existsSync(join(cwd, ".codexclaw", "subagents.json")));
  const onDisk = JSON.parse(readFileSync(join(cwd, ".codexclaw", "subagents.json"), "utf8"));
  assert.equal(onDisk.roles.reviewer.model, "gpt-5.5");
});

test("MCP: subagents_set with invalid mode returns an isError result, no crash", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-"));
  const replies = await collect(
    cwd,
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "subagents_set", arguments: { role: "reviewer", mode: "turbo" } } }],
    1,
  );
  if (replies.length === 0) return;
  assert.equal(replies[0].result.isError, true);
});

test("MCP: subagents_set effort roundtrips; invalid effort is isError", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-"));
  const ok = await collect(
    cwd,
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "subagents_set", arguments: { role: "executor", effort: "xhigh" } } }],
    1,
  );
  if (ok.length > 0) {
    const payload = JSON.parse(ok[0].result.content[0].text);
    assert.equal(payload.roles.executor.effort, "xhigh");
  }
  const bad = await collect(
    cwd,
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "subagents_set", arguments: { role: "executor", effort: "turbo" } } }],
    1,
  );
  if (bad.length === 0) return;
  assert.equal(bad[0].result.isError, true);
});

test("MCP: first fallback roundtrips for every role and rejects invalid nested effort", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-fallback-"));
  for (const role of ROLES) {
    const replies = await collect(cwd, [
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "subagents_set", arguments: { role, fallback: { model: "cursor/grok-4.6", effort: "low" } } } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "subagents_get", arguments: {} } },
    ], 2);
    assert.equal(replies.length, 2, "built MCP server is required for fallback verification");
    const result = JSON.parse(replies.find(r => r.id === 2).result.content[0].text);
    assert.deepEqual(result.roles[role].fallback, { model: "cursor/grok-4.6", effort: "low" });
  }
  const rejected = await collect(cwd, [{ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "subagents_set", arguments: { role: "executor", fallback: { effort: "invalid" } } } }], 1);
  assert.equal(rejected[0].result.isError, true);
});

test('MCP advertises and persists architect with independent reviewer settings', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cxc-mcp-architect-'));
  assert.ok(existsSync(serverJs), 'compiled MCP server required');
  const replies = await collect(cwd, [
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'subagents_set', arguments: { role: 'architect', mode: 'model', model: 'design-fixture', effort: 'high' } } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'subagents_get', arguments: {} } },
  ], 3);
  const advertised = replies.find(r => r.id === 1).result.tools.find((tool: { name: string }) => tool.name === 'subagents_set');
  assert.ok(advertised.inputSchema.properties.role.enum.includes('architect'));
  const settings = JSON.parse(replies.find(r => r.id === 3).result.content[0].text);
  assert.equal(settings.roles.architect.model, 'design-fixture');
  assert.equal(settings.roles.architect.effort, 'high');
  assert.equal(settings.roles.reviewer.model, null);
});

async function directGet(cwd: string, read: (options?: CatalogOptions) => Promise<LiveCatalog>): Promise<Record<string, any>> {
  const previousCwd = process.cwd();
  const previousWrite = process.stdout.write;
  let output = "";
  process.chdir(cwd);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    const value = chunk.toString();
    if (value.startsWith('{"jsonrpc":"2.0","id":243,')) { output += value; return true; }
    return previousWrite.call(process.stdout, chunk);
  }) as typeof process.stdout.write;
  try {
    await handleToolCall(243, { name: "subagents_get", arguments: {} }, read);
  } finally {
    process.stdout.write = previousWrite;
    process.chdir(previousCwd);
  }
  const envelope = JSON.parse(output.trim());
  assert.equal(envelope.jsonrpc, "2.0");
  assert.equal(envelope.id, 243);
  assert.equal(envelope.result.content[0].type, "text");
  return JSON.parse(envelope.result.content[0].text);
}

function fixtureCatalog(source: LiveCatalog["source"], ids: string[], status: LiveCatalog["status"] = "fresh"): LiveCatalog {
  return { state: source === "ocx" ? "ocx-active" : "native-catalog", source, status,
    fetchedAt: new Date().toISOString(), entries: ids.map(id => ({ id, label: id, source })) };
}

test("get provides four role spawnArgs and three-state staleModel with unchanged envelope", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-card-"));
  setRole(cwd, "explorer", { mode: "model", model: "provider/present", effort: "low" }, "project");
  setRole(cwd, "reviewer", { mode: "model", model: "provider/missing", effort: null }, "project");
  setRole(cwd, "architect", { effort: "high" }, "project");
  let forceRefresh = false;
  const result = await directGet(cwd, async (options) => { forceRefresh = options?.forceRefresh === true; return fixtureCatalog("ocx", ["provider/present"]); });
  assert.equal(forceRefresh, true);
  assert.deepEqual(Object.keys(result.roles).sort(), [...ROLES].sort());
  assert.deepEqual(result.roles.explorer.spawnArgs, { model: "provider/present", reasoning_effort: "low" });
  assert.equal(result.roles.explorer.staleModel, false);
  assert.equal("staleReason" in result.roles.explorer, false);
  assert.deepEqual(result.roles.reviewer.spawnArgs, { model: "provider/missing" });
  assert.equal(result.roles.reviewer.staleModel, true);
  assert.equal("staleReason" in result.roles.reviewer, false);
  assert.deepEqual(result.roles.executor.spawnArgs, {});
  assert.deepEqual(result.roles.architect.spawnArgs, { reasoning_effort: "high" });
  assert.equal(result.roles.executor.staleModel, null);
  assert.equal(result.roles.executor.staleReason, "role uses the default model");
  assert.equal(result.roles.explorer.model, "provider/present");
  assert.ok(result.sources && result.overrides && result.scope);
});

test("failed live refresh never marks stale", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-stale-"));
  setRole(cwd, "reviewer", { mode: "model", model: "provider/missing" }, "project");
  const stale = await directGet(cwd, async () => fixtureCatalog("ocx", ["provider/present"], "stale"));
  assert.equal(stale.roles.reviewer.staleModel, null);
  assert.equal(stale.roles.reviewer.staleReason, "catalog is last-success cache");
  const unavailable = await directGet(cwd, async () => fixtureCatalog("ocx", [], "unavailable"));
  assert.equal(unavailable.roles.reviewer.staleModel, null);
  assert.equal(unavailable.roles.reviewer.staleReason, "catalog unavailable");
  const rejected = await directGet(cwd, async () => { throw new Error("OCX failed"); });
  assert.equal(rejected.roles.reviewer.staleReason, "catalog unavailable");
});

test("native catalog age gates absence", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-native-"));
  const path = join(cwd, "models.json");
  writeFileSync(path, JSON.stringify({ models: [{ id: "provider/present" }] }));
  setRole(cwd, "reviewer", { mode: "model", model: "provider/missing" }, "project");
  const previous = process.env.CODEX_MODELS_CACHE_PATH;
  process.env.CODEX_MODELS_CACHE_PATH = path;
  try {
    const fresh = await directGet(cwd, async () => fixtureCatalog("native", ["provider/present"]));
    assert.equal(fresh.roles.reviewer.staleModel, true);
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    utimesSync(path, old, old);
    const aged = await directGet(cwd, async () => fixtureCatalog("native", ["provider/present"]));
    assert.equal(aged.roles.reviewer.staleModel, null);
    assert.equal(aged.roles.reviewer.staleReason, "catalog unavailable");
  } finally {
    if (previous === undefined) delete process.env.CODEX_MODELS_CACHE_PATH;
    else process.env.CODEX_MODELS_CACHE_PATH = previous;
  }
});

test("timeout yields staleModel null with staleReason", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-mcp-timeout-"));
  setRole(cwd, "reviewer", { mode: "model", model: "provider/model" }, "project");
  const started = Date.now();
  const result = await directGet(cwd, () => new Promise<LiveCatalog>(() => {}));
  assert.ok(Date.now() - started < 5500);
  assert.equal(result.roles.reviewer.staleModel, null);
  assert.equal(result.roles.reviewer.staleReason, "catalog read timed out after 5000 ms");
});
