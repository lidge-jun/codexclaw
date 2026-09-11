import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { codexclawApiMiddleware } from '../src/server/middleware.ts';
import { resolveSpawnConfig } from '../../components/subagent-config/src/store.ts';

test('Vite scoped query, effort persistence and trust metadata match spawn resolution; global CSRF rejected', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cxc-vite-scope-'));
  const saved = { CODEXCLAW_ROOT: process.env.CODEXCLAW_ROOT, CODEX_HOME: process.env.CODEX_HOME, CODEXCLAW_HOME: process.env.CODEXCLAW_HOME };
  process.env.CODEXCLAW_ROOT = cwd;
  process.env.CODEX_HOME = join(cwd, 'codex');
  process.env.CODEXCLAW_HOME = join(cwd, 'cxc');
  const middleware = codexclawApiMiddleware();
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404).end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  const post = (body: unknown, headers = { 'content-type': 'application/json', 'x-codexclaw-local': '1' }) => fetch(`${base}/api/subagents`, { method: 'POST', headers, body: JSON.stringify(body) });
  try {
    const global = await post({ scope: 'global', role: 'explorer', effort: 'high' });
    assert.equal(global.status, 200);
    const get = await fetch(`${base}/api/subagents?scope=global`);
    assert.equal(get.status, 200);
    assert.equal((await get.json()).roles.explorer.effort, 'high');
    assert.equal((await fetch(`${base}/api/subagents?scope=bad`)).status, 400);
    const globalPath = join(cwd, 'cxc/subagents.json');
    const before = readFileSync(globalPath, 'utf8');
    assert.equal((await post({ scope: 'global', role: 'explorer', effort: 'low' }, { 'content-type': 'application/json', 'x-codexclaw-local': '' })).status, 403);
    assert.equal((await post({ scope: 'global', role: 'explorer', effort: 'bad' })).status, 400);
    assert.equal(readFileSync(globalPath, 'utf8'), before);
    await post({ role: 'explorer', effort: null });
    execFileSync('git', ['init', '-q', cwd]);
    execFileSync('git', ['-C', cwd, 'add', '-f', '.codexclaw/subagents.json']);
    const effective = await (await fetch(`${base}/api/subagents`)).json();
    assert.equal(effective.sources.explorer, 'global');
    assert.equal(effective.roles.explorer.effort, resolveSpawnConfig(cwd, 'explorer').effort);
    assert.equal(effective.trustWarning, resolveSpawnConfig(cwd, 'explorer').trustWarning);
    assert.equal(effective.overrides.explorer, true);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(cwd, { recursive: true, force: true });
  }
});
