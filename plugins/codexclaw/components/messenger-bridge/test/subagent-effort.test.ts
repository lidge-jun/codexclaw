/** cxc serve API persistence contract, including a fresh server process. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

async function startServer(cwd: string) {
  const serverModule = new URL("../src/server.ts", import.meta.url).href;
  const dbModule = new URL("../src/db.ts", import.meta.url).href;
  const script = `
    import { createBridgeServer } from ${JSON.stringify(serverModule)};
    import { openBridgeDb } from ${JSON.stringify(dbModule)};
    const cwd = process.argv[1];
    const db = openBridgeDb(cwd);
    const server = createBridgeServer({ cwd, db, version: 'effort-test' });
    server.listen(0, '127.0.0.1', () => console.log(server.address().port));
    process.on('SIGTERM', () => server.close(() => { db.close(); process.exit(0); }));
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script, cwd], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CODEX_HOME: join(cwd, "test-codex-home"), CODEXCLAW_HOME: join(cwd, "test-cxc-home") } });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  const exit = once(child, "exit");
  const stop = async () => { child.kill(); await exit; };
  try {
    const ready = once(child.stdout, "data", { signal: AbortSignal.timeout(10_000) });
    const [data] = await Promise.race([ready, exit.then(() => { throw new Error(`server exited before listening: ${stderr}`); })]);
    const port = Number(String(data).trim());
    assert.ok(port > 0, `invalid server port: ${String(data)} ${stderr}`);
    return { base: `http://127.0.0.1:${port}`, stop };
  } catch (err) { await stop(); throw err; }
}

function post(base: string, body: unknown) {
  return fetch(`${base}/api/subagents`, {
    method: "POST", headers: { "content-type": "application/json", "x-codexclaw-local": "1" }, body: JSON.stringify(body),
  });
}

test("serve persists effort across GET and process restart, preserves models, accepts null and rejects invalid values", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-effort-"));
  let server = await startServer(cwd);
  try {
    const models = { explorer: "fixture-luna", reviewer: "fixture-sol", executor: "fixture-terra" };
    for (const [role, model] of Object.entries(models)) {
      assert.equal((await post(server.base, { role, mode: "model", model, promptOverride: `${role} prompt` })).status, 200);
    }
    const initial = await (await fetch(`${server.base}/api/subagents`)).json();
    const snapshot = (effort: string | null) => ({
      ...initial, roles: { ...initial.roles, explorer: { ...initial.roles.explorer, effort } },
    });
    // These are isolated fixture values, never user preferences.
    for (const effort of ["low", "medium", "high", "xhigh"]) {
      const res = await post(server.base, { role: "explorer", effort });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), snapshot(effort));
      assert.deepEqual(await (await fetch(`${server.base}/api/subagents`)).json(), snapshot(effort));
    }
    const storePath = join(cwd, ".codexclaw/subagents.json");
    assert.deepEqual(JSON.parse(readFileSync(storePath, "utf8")), { roles: snapshot("xhigh").roles });
    await server.stop();
    server = await startServer(cwd);
    assert.deepEqual(await (await fetch(`${server.base}/api/subagents`)).json(), snapshot("xhigh"));
    // An omitted effort must preserve the saved value.
    assert.deepEqual(await (await post(server.base, { role: "explorer", model: models.explorer })).json(), snapshot("xhigh"));
    for (const effort of ["invalid", "", "HIGH", 3, false, {}, []]) {
      const before = readFileSync(storePath, "utf8");
      const res = await post(server.base, { role: "explorer", effort, promptOverride: "must not be saved" });
      assert.equal(res.status, 400, JSON.stringify(effort));
      assert.match((await res.json()).error, /invalid effort/);
      assert.equal(readFileSync(storePath, "utf8"), before);
    }
    const reset = await post(server.base, { role: "explorer", effort: null });
    assert.equal(reset.status, 200);
    assert.deepEqual(await reset.json(), snapshot(null));
    await server.stop();
    server = await startServer(cwd);
    assert.deepEqual(await (await fetch(`${server.base}/api/subagents`)).json(), snapshot(null));
  } finally { await server.stop(); rmSync(cwd, { recursive: true, force: true }); }
});

test('serve global defaults and project overrides survive restart; reset restores the next scope', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cxc-global-api-'));
  let server = await startServer(cwd);
  const get = async (scope = 'project') => (await fetch(`${server.base}/api/subagents?scope=${scope}`)).json();
  try {
    assert.equal((await get()).sources.explorer, 'session');
    for (const effort of ['low', 'medium', 'high', 'xhigh', null]) {
      const res = await post(server.base, { scope: 'global', role: 'explorer', mode: 'model', model: 'global-luna', effort });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).roles.explorer.effort, effort);
      await server.stop(); server = await startServer(cwd);
      assert.equal((await get()).roles.explorer.effort, effort);
      assert.equal((await get()).sources.explorer, 'global');
    }
    await post(server.base, { role: 'explorer', model: 'project-luna', effort: null });
    await post(server.base, { scope: 'global', role: 'explorer', effort: 'high' });
    await server.stop(); server = await startServer(cwd);
    const local = await get();
    assert.equal(local.roles.explorer.model, 'project-luna');
    assert.equal(local.roles.explorer.effort, null);
    assert.equal(local.sources.explorer, 'project');
    assert.equal((await get('global')).roles.explorer.effort, 'high');
    const globalPath = join(cwd, 'test-cxc-home/subagents.json');
    const before = readFileSync(globalPath, 'utf8');
    for (const body of [
      { scope: 'global', effort: 'invalid' }, { scope: 'global', effort: {} },
      { scope: '../escape', effort: 'low' }, { scope: null, effort: 'low' },
      { scope: 'global', inherit: 'yes' }, { scope: 'global', inherit: true, effort: 'low' },
    ]) {
      assert.equal((await post(server.base, { role: 'explorer', ...body })).status, 400);
      assert.equal(readFileSync(globalPath, 'utf8'), before);
    }
    assert.equal((await fetch(`${server.base}/api/subagents?scope=bad`)).status, 400);
    assert.equal((await post(server.base, { role: 'explorer', inherit: true })).status, 200);
    assert.equal((await get()).roles.explorer.effort, 'high');
    assert.equal((await post(server.base, { scope: 'global', role: 'explorer', inherit: true })).status, 200);
    await server.stop(); server = await startServer(cwd);
    assert.equal((await get()).sources.explorer, 'session');
    assert.equal((await get()).roles.explorer.effort, null);
  } finally { await server.stop(); rmSync(cwd, { recursive: true, force: true }); }
});
