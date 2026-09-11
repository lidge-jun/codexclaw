import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, defaultConfig, getSubagentSettings, setSubagentRole, type SubagentsConfig } from '../src/api.ts';

const settings = (): SubagentsConfig => ({ ...defaultConfig(), scope: 'global', sources: { explorer: 'session', reviewer: 'session', executor: 'session', architect: 'session' }, overrides: { explorer: false, reviewer: false, executor: false, architect: false } });

test('client selects scope explicitly and preserves null effort on the wire', async t => {
  const captured: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    captured.push({ url, init }); return new Response(JSON.stringify(settings()), { status: 200 });
  });
  assert.equal((await getSubagentSettings('global')).scope, 'global');
  assert.equal(captured[0].url, '/api/subagents?scope=global');
  assert.equal((await setSubagentRole('explorer', { effort: null }, settings(), 'global')).ok, true);
  assert.deepEqual(JSON.parse(captured[1].init!.body as string), { role: 'explorer', effort: null, scope: 'global' });
  assert.equal((captured[1].init!.headers as Record<string, string>)['x-codexclaw-local'], '1');
  await setSubagentRole('explorer', { inherit: true }, settings(), 'global');
  assert.deepEqual(JSON.parse(captured[2].init!.body as string), { role: 'explorer', inherit: true, scope: 'global' });
});

test('client surfaces load/save failure and rejects missing or wrong scope metadata', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'invalid effort' }), { status: 400 }));
  await assert.rejects(getSubagentSettings('global'), /invalid effort/);
  assert.deepEqual(await api.getSubagents(), defaultConfig(), "legacy dashboard calls retain their non-throwing fallback");
  const fallback = settings();
  const result = await setSubagentRole('explorer', { effort: null }, fallback, 'global');
  assert.equal(result.ok, false); assert.equal(result.config, fallback); assert.equal(result.error, 'invalid effort');
  mock.mock.mockImplementation(async () => new Response(JSON.stringify(defaultConfig())));
  await assert.rejects(getSubagentSettings(), /Invalid scoped settings response/);
  assert.equal((await setSubagentRole('explorer', { effort: null }, fallback, 'global')).ok, false);
  mock.mock.mockImplementation(async () => new Response(JSON.stringify(settings())));
  await assert.rejects(getSubagentSettings('project'), /Invalid scoped settings response/);
});

test('client loads and saves architect and rejects incomplete architect metadata while preserving original settings', async t => {
  const original = settings();
  original.roles.architect = { mode: 'model', model: 'gpt-5.6-luna', effort: null, promptOverride: 'keep original architect prompt' };
  original.sources = { ...original.sources!, architect: 'global' };
  original.overrides = { ...original.overrides!, architect: true };
  const captured: Array<{ url: string; init?: RequestInit }> = [];
  const mock = t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    captured.push({ url, init });
    return new Response(JSON.stringify(original), { status: 200 });
  });
  const loaded = await getSubagentSettings('global');
  assert.equal(loaded.roles.architect.model, 'gpt-5.6-luna');
  assert.equal(loaded.sources?.architect, 'global');
  assert.equal(loaded.overrides?.architect, true);
  const saved = await setSubagentRole('architect', { promptOverride: 'architect prompt' }, original, 'global');
  assert.equal(saved.ok, true);
  assert.equal(JSON.parse(captured[1].init!.body as string).role, 'architect');
  assert.equal(saved.config.roles.architect.promptOverride, 'keep original architect prompt');
  mock.mock.mockImplementation(async () => new Response(JSON.stringify({
    ...original,
    sources: { explorer: 'session', reviewer: 'session', executor: 'session' },
    overrides: { explorer: false, reviewer: false, executor: false },
    roles: { explorer: original.roles.explorer, reviewer: original.roles.reviewer, executor: original.roles.executor },
  })));
  await assert.rejects(getSubagentSettings('global'), /Invalid scoped settings response/);
  const rejected = await setSubagentRole('architect', { promptOverride: 'should not apply' }, original, 'global');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.config, original);
  assert.equal(rejected.config.roles.architect.promptOverride, 'keep original architect prompt');
  assert.equal(rejected.error, 'Invalid scoped settings response. Reload and try again.');
});

test('catalog refresh uses explicit query and failures never fabricate selectable models', async t => {
  let requested = '';
  const mock = t.mock.method(globalThis, 'fetch', async (url: string) => {
    requested = url;
    return new Response(JSON.stringify({ state:'ocx-active',status:'fresh',source:'ocx',fetchedAt:'2026-09-08T00:00:00Z',entries:[{id:'fixture/native-new',source:'ocx',label:'new',reasoningEfforts:['low']}] }));
  });
  const catalog=await api.getCatalog(true);
  assert.equal(requested,'/api/catalog?refresh=1');
  assert.deepEqual(catalog.entries[0].reasoningEfforts,['low']);
  mock.mock.mockImplementation(async()=>new Response('failed',{status:503}));
  const failure=await api.getCatalog();
  assert.equal(failure.status,'unavailable');
  assert.deepEqual(failure.entries,[]);
});
