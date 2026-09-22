import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { recordHookInvocation, readHookObservations, HOOK_OBSERVATION_MAX_AGE_MS } from '../../../scripts/hook-observation.mjs';
import { runHookExecutionCheck } from '../src/doctor.ts';

const plugin = fileURLToPath(new URL('../../../', import.meta.url));
const helper = pathToFileURL(join(plugin, 'scripts/hook-observation.mjs')).href;
function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'hook-observation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const codexHome = join(root, 'home');
  const pluginRoot = join(root, 'plugin');
  const entrypoint = join(pluginRoot, 'components/cxc-ops/src/cli.ts');
  mkdirSync(join(pluginRoot, '.codex-plugin'), { recursive: true });
  mkdirSync(resolve(entrypoint, '..'), { recursive: true });
  writeFileSync(join(pluginRoot, '.codex-plugin/plugin.json'), '{"version":"1.2.3"}');
  writeFileSync(entrypoint, '// fixture');
  const previousHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  t.after(() => { if (previousHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previousHome; });
  const options = { codexHome, pluginRoot, sessionId: 'session-one', agentId: null };
  const raw = (agentId: string | null = null) => JSON.stringify({ session_id: options.sessionId,
    ...(agentId === null ? {} : { agent_id: agentId }), prompt: 'PRIVATE PROMPT', tool_input: { secret: 'PRIVATE SECRET' } });
  const record = (agentId: string | null = null, event = 'session-start') => recordHookInvocation(raw(agentId), 'cxc-ops', event, entrypoint);
  const files = () => readdirSync(codexHome, { recursive: true }).filter(p => p.toString().endsWith('.json')).map(p => join(codexHome, String(p)));
  return { root, entrypoint, options, raw, record, files };
}

test('invalid identities, malformed and oversized inputs produce no evidence', t => {
  const f = fixture(t);
  for (const raw of ['{', '{}', 'null', '[]', '{"session_id":2}', '{"session_id":"s","agent_id":""}',
    '{"session_id":"s","agent_type":"executor"}', '{"session_id":"s\\n"}',
    JSON.stringify({ session_id: 's', prompt: 'x'.repeat(4 * 1024 * 1024) })]) {
    assert.equal(recordHookInvocation(raw, 'cxc-ops', 'stop', f.entrypoint), false);
  }
  assert.equal(readHookObservations(f.options).observations.length, 0);
});

test('metadata-only latest records isolate root, children, sessions and ingress events', t => {
  const f = fixture(t);
  assert.equal(f.record(), true);
  assert.equal(f.record(), true);
  assert.equal(f.record('child-a'), true);
  assert.equal(f.record(null, 'post-compact'), true);
  assert.equal(f.files().length, 3);
  const root = readHookObservations(f.options);
  assert.deepEqual(root.observations.map(r => r.event), ['post-compact', 'session-start']);
  assert.equal(readHookObservations({ ...f.options, agentId: 'child-a' }).observations.length, 1);
  assert.equal(readHookObservations({ ...f.options, sessionId: 'other' }).observations.length, 0);
  assert.equal(readHookObservations({ ...f.options, agentId: 'child-b' }).observations.length, 0);
  for (const path of f.files()) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /PRIVATE|prompt|tool_input|secret/);
    assert.equal(JSON.parse(text).outcome, 'invoked');
  }
});

test('corrupt, stale, future, actor, schema, root, version and digest mismatches are unverified', t => {
  const f = fixture(t);
  assert.equal(f.record(), true);
  const path = f.files()[0];
  const original = JSON.parse(readFileSync(path, 'utf8'));
  const now = Date.parse(original.observedAt);
  for (const patch of [
    { schemaVersion: 2 }, { outcome: 'success' }, { sessionId: 'foreign' }, { agentId: 'child' },
    { pluginRoot: '/foreign' }, { pluginVersion: 'old' }, { manifestDigest: '0'.repeat(64) },
    { entrypointDigest: '0'.repeat(64) }, { entrypoint: '../escape.ts' }, { component: '../escape' },
    { observedAt: 'nonsense' }, { observedAt: new Date(now + 1).toISOString() },
    { observedAt: new Date(now - HOOK_OBSERVATION_MAX_AGE_MS - 1).toISOString() },
  ]) {
    writeFileSync(path, JSON.stringify({ ...original, ...patch }));
    const result = readHookObservations({ ...f.options, now });
    assert.equal(result.observations.length, 0, JSON.stringify(patch));
    assert.equal(result.ignored, 1);
  }
  for (const text of ['{', 'x'.repeat(9000)]) {
    writeFileSync(path, text);
    assert.equal(readHookObservations(f.options).ignored, 1);
  }
  writeFileSync(path, JSON.stringify(original));
  assert.equal(readHookObservations({ ...f.options, now }).observations.length, 1);
  writeFileSync(f.entrypoint, '// changed target');
  assert.equal(readHookObservations({ ...f.options, now }).observations.length, 0);
});

test('manifest changes invalidate evidence, and missing session stays unknown', t => {
  const f = fixture(t);
  f.record();
  writeFileSync(join(f.options.pluginRoot, '.codex-plugin/plugin.json'), '{"version":"1.2.3","hooks":[]}');
  assert.equal(readHookObservations(f.options).observations.length, 0);
  assert.equal(runHookExecutionCheck(f.options.pluginRoot, { ...f.options, sessionId: null }).severity, 'WARN');
});

test('storage failure is silent and never changes handler output or status', t => {
  const f = fixture(t);
  writeFileSync(f.options.codexHome, 'not a directory');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {recordHookInvocation} from ${JSON.stringify(helper)}; recordHookInvocation(process.env.PAYLOAD,"cxc-ops","stop",process.env.ENTRY); process.stdout.write("original\\n"); process.exitCode=7;`],
    { encoding: 'utf8', env: { ...process.env, ENTRY: f.entrypoint, PAYLOAD: f.raw() } });
  assert.equal(result.status, 7);
  assert.equal(result.stdout, 'original\n');
  assert.equal(result.stderr, '');
  assert.equal(readHookObservations(f.options).observations.length, 0);
});

test('concurrent actor writes preserve independent latest records without partial JSON', async t => {
  const f = fixture(t);
  await Promise.all(Array.from({ length: 8 }, (_, i) => new Promise<void>((done, fail) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      `import {recordHookInvocation} from ${JSON.stringify(helper)}; for(let i=0;i<10;i++) if(!recordHookInvocation(process.env.PAYLOAD,"cxc-ops","stop",process.env.ENTRY)) process.exitCode=1;`],
      { env: { ...process.env, ENTRY: f.entrypoint, PAYLOAD: f.raw(i ? `child-${i}` : null) }, stdio: 'pipe' });
    let error = ''; child.stderr.on('data', c => error += c);
    child.on('error', fail); child.on('close', code => code === 0 ? done() : fail(new Error(error || `exit ${code}`)));
  })));
  assert.equal(f.files().length, 8);
  for (let i = 0; i < 8; i++) assert.equal(readHookObservations({ ...f.options, agentId: i ? `child-${i}` : null }).observations.length, 1);
});

test('doctor separates observed invocation from unknown declaration coverage and enforcement', t => {
  const f = fixture(t);
  assert.equal(runHookExecutionCheck(f.options.pluginRoot, f.options).severity, 'WARN');
  f.record('child-a');
  assert.equal(runHookExecutionCheck(f.options.pluginRoot, f.options).severity, 'WARN');
  f.record();
  const check = runHookExecutionCheck(f.options.pluginRoot, f.options);
  assert.equal(check.severity, 'PASS');
  assert.match(check.evidence, /cxc-ops\/session-start/);
  assert.match(check.evidence, /handler results remain unknown/);
  assert.match(check.evidence, /not host attestations/);
});

test('source CLI ingress records invocation; importing handler code alone does not', t => {
  const f = fixture(t);
  const source = join(plugin, 'components/cxc-ops/src/cli.ts');
  const env = { ...process.env, CODEX_HOME: f.options.codexHome };
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(source).href)});`], { env, encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(readHookObservations({ ...f.options, pluginRoot: plugin }).observations.length, 0);
  const result = spawnSync(process.execPath, [source, 'hook', 'post-compact'], { env, encoding: 'utf8', input: f.raw(), cwd: f.root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(readHookObservations({ ...f.options, pluginRoot: plugin }).observations.length, 1);
});

test('all eight actual source ingress paths observe child identity without promoting root coverage', t => {
  const f = fixture(t);
  const entries = [
    ['pabcd-state/src/cli.ts', 'post-compact'],
    ['cxc-ops/src/cli.ts', 'post-compact'],
    ['recall/src/cli.ts', 'post-compact'],
    ['bg-wake/src/cli.ts', 'stop'],
    ['config-guard/src/cli.ts', 'session-start'],
    ['provider-bridge/src/cli.ts', 'session-start'],
    ['subagent-config/src/spawn-attach-hook.ts', 'pre-tool-use'],
    ['subagent-config/src/fallback-dispatch-cli.ts', 'session-start'],
  ];
  const env = { ...process.env, PATH: join(f.root, 'empty-path'), CODEX_HOME: f.options.codexHome,
    CODEXCLAW_HOME: join(f.root, 'cxc-home'), CXC_BGWAKE: 'off' };
  const input = JSON.stringify({ session_id: f.options.sessionId, agent_id: 'child-a', agent_type: 'executor',
    cwd: f.root, hook_event_name: 'PreToolUse', tool_name: 'read_file', tool_input: {} });
  for (const [entry, event] of entries) {
    const result = spawnSync(process.execPath, [join(plugin, 'components', entry), 'hook', event],
      { env, encoding: 'utf8', input, cwd: f.root, timeout: 10000 });
    assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
    assert.equal(result.stderr, '', entry);
  }
  const found = readHookObservations({ ...f.options, pluginRoot: plugin, agentId: 'child-a' });
  assert.deepEqual(found.observations.map(r => r.entrypoint).sort(), entries.map(([entry]) => `components/${entry}`).sort());
  assert.equal(readHookObservations({ ...f.options, pluginRoot: plugin }).observations.length, 0);
});

test('malformed/oversized input and unavailable store preserve existing real CLI output', t => {
  const f = fixture(t);
  const source = join(plugin, 'components/provider-bridge/src/cli.ts');
  const env = { ...process.env, PATH: join(f.root, 'empty-path'), CODEX_HOME: f.options.codexHome };
  const invoke = (input: string) => spawnSync(process.execPath, [source, 'hook', 'session-start'],
    { env, encoding: 'utf8', input, timeout: 10000 });
  const baseline = invoke('{}');
  for (const input of ['{', JSON.stringify({ session_id: 'session-one', prompt: 'x'.repeat(4 * 1024 * 1024) })]) {
    const actual = invoke(input);
    assert.equal(actual.status, baseline.status);
    assert.equal(actual.stdout, baseline.stdout);
    assert.equal(actual.stderr, baseline.stderr);
  }
  writeFileSync(f.options.codexHome, 'not a directory');
  const unavailable = invoke(f.raw());
  assert.equal(unavailable.status, 0);
  assert.equal(unavailable.stdout, baseline.stdout);
  assert.equal(unavailable.stderr, baseline.stderr);
});
