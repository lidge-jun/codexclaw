import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readSettings, setRole, resetRole, resolveSpawnConfig, projectConfigTrustToken, globalStorePath } from '../src/store.ts';

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), 'cxc-scope-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'project');
  mkdirSync(cwd);
  return { cwd, env: { ...process.env, CODEX_HOME: join(root, 'codex'), CODEXCLAW_HOME: join(root, 'cxc') }, root };
}

test('role precedence, explicit null, reset, sparse writes, and project independence', t => {
  const { cwd, env, root } = fixture(t);
  assert.deepEqual(Object.values(readSettings(cwd, 'project', env).sources), ['session', 'session', 'session', 'session']);
  setRole(cwd, 'explorer', { mode: 'model', model: 'global-model', effort: 'high' }, 'global', env);
  assert.equal(readSettings(cwd, 'project', env).sources.explorer, 'global');
  assert.equal(resolveSpawnConfig(cwd, 'explorer', env).effort, 'high');
  setRole(cwd, 'reviewer', { effort: 'low' }, 'project', env);
  const path = join(cwd, '.codexclaw/subagents.json');
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(path, 'utf8')).roles), ['reviewer']);
  setRole(cwd, 'explorer', { effort: null }, 'project', env);
  assert.equal(readSettings(cwd, 'project', env).roles.explorer.model, 'global-model');
  assert.equal(resolveSpawnConfig(cwd, 'explorer', env).effort, null);
  setRole(cwd, 'explorer', { model: 'new-global', effort: 'xhigh' }, 'global', env);
  assert.equal(readSettings(cwd, 'project', env).roles.explorer.model, 'global-model');
  const other = join(root, 'other'); mkdirSync(other);
  assert.equal(readSettings(other, 'project', env).roles.explorer.model, 'new-global');
  resetRole(cwd, 'explorer', 'project', env);
  assert.equal(readSettings(cwd, 'project', env).roles.explorer.effort, 'xhigh');
  resetRole(cwd, 'explorer', 'global', env);
  assert.equal(readSettings(cwd, 'project', env).sources.explorer, 'session');
  assert.equal(readSettings(cwd, 'project', env).roles.reviewer.effort, 'low');
});

test('existing complete role configs mask global settings without migration', t => {
  const { cwd, env } = fixture(t);
  setRole(cwd, 'executor', { mode: 'model', model: 'terra', effort: null }, 'project', env);
  const path = join(cwd, '.codexclaw/subagents.json');
  const original = readFileSync(path, 'utf8');
  setRole(cwd, 'executor', { effort: 'high' }, 'global', env);
  assert.equal(resolveSpawnConfig(cwd, 'executor', env).model, 'terra');
  assert.equal(resolveSpawnConfig(cwd, 'executor', env).effort, null);
  assert.equal(readFileSync(path, 'utf8'), original);
});

test('untrusted tracked project falls back to global; project trust still binds bytes', t => {
  const { cwd, env } = fixture(t);
  execFileSync('git', ['init', '-q', cwd]);
  setRole(cwd, 'executor', { mode: 'model', model: 'global' }, 'global', env);
  setRole(cwd, 'executor', { model: 'project' }, 'project', env);
  execFileSync('git', ['-C', cwd, 'add', '-f', '.codexclaw/subagents.json']);
  assert.equal(resolveSpawnConfig(cwd, 'executor', env).model, 'global');
  assert.equal(readSettings(cwd, 'project', env).sources.executor, 'global');
  assert.equal(readSettings(cwd, 'project', env).overrides.executor, true);
  assert.match(resolveSpawnConfig(cwd, 'executor', env).trustWarning!, /ignored Git-tracked/);
  const trusted = { ...env, CODEXCLAW_TRUST_PROJECT_SUBAGENTS: projectConfigTrustToken(cwd)! };
  assert.equal(resolveSpawnConfig(cwd, 'executor', trusted).model, 'project');
  setRole(cwd, 'executor', { model: 'changed' }, 'project', env);
  assert.equal(resolveSpawnConfig(cwd, 'executor', trusted).model, 'global');
});

test('scoped writes preserve unrelated data and reject invalid effort/scope without changing bytes', t => {
  const { cwd, env } = fixture(t);
  setRole(cwd, 'explorer', { effort: 'low' }, 'global', env);
  const path = globalStorePath(env);
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  raw.extra = { keep: true }; raw.roles.future = { custom: 1 };
  writeFileSync(path, JSON.stringify(raw));
  setRole(cwd, 'reviewer', { effort: null }, 'global', env);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')).extra, raw.extra);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')).roles.future, raw.roles.future);
  const before = readFileSync(path, 'utf8');
  assert.throws(() => setRole(cwd, 'explorer', { effort: 'bad' as never }, 'global', env), /invalid effort/);
  assert.throws(() => setRole(cwd, 'explorer', {}, 'bad' as never, env), /invalid scope/);
  assert.equal(readFileSync(path, 'utf8'), before);
});

test('legacy all-default roles remain explicit overrides until reset', t => {
  const { cwd, env } = fixture(t);
  const role = { mode: 'default', model: null, effort: null, promptOverride: null };
  mkdirSync(join(cwd, '.codexclaw'));
  writeFileSync(join(cwd, '.codexclaw/subagents.json'), JSON.stringify({ roles: { explorer: role, reviewer: role, executor: role } }));
  setRole(cwd, 'explorer', { effort: 'high' }, 'global', env);
  assert.equal(readSettings(cwd, 'project', env).sources.explorer, 'project');
  assert.equal(readSettings(cwd, 'project', env).roles.explorer.effort, null);
  resetRole(cwd, 'explorer', 'project', env);
  assert.equal(readSettings(cwd, 'project', env).sources.explorer, 'global');
});

test('malformed persisted state is not overwritten during an edit or reset', t => {
  const { cwd, env } = fixture(t);
  setRole(cwd, 'explorer', { effort: 'low' }, 'global', env);
  const path = globalStorePath(env);
  writeFileSync(path, '{broken');
  assert.throws(() => setRole(cwd, 'reviewer', { effort: null }, 'global', env), /cannot update/);
  assert.throws(() => resetRole(cwd, 'explorer', 'global', env), /cannot update/);
  assert.equal(readFileSync(path, 'utf8'), '{broken');
});

test('architect inherits without migrating legacy files and preserves sibling overrides', t => {
  const { cwd, env } = fixture(t);
  setRole(cwd, 'reviewer', { mode: 'model', model: 'reviewer-local', effort: 'low' }, 'project', env);
  const path = join(cwd, '.codexclaw/subagents.json');
  const before = readFileSync(path, 'utf8');
  assert.equal(resolveSpawnConfig(cwd, 'architect', env).usesMainModel, true);
  assert.equal(readFileSync(path, 'utf8'), before);
  setRole(cwd, 'architect', { mode: 'model', model: 'architect-global', effort: 'high' }, 'global', env);
  assert.equal(resolveSpawnConfig(cwd, 'architect', env).model, 'architect-global');
  setRole(cwd, 'architect', { model: 'architect-project', promptOverride: 'design only', effort: null }, 'project', env);
  assert.equal(resolveSpawnConfig(cwd, 'architect', env).model, 'architect-project');
  assert.equal(resolveSpawnConfig(cwd, 'architect', env).effort, null);
  assert.equal(resolveSpawnConfig(cwd, 'reviewer', env).model, 'reviewer-local');
  resetRole(cwd, 'architect', 'project', env);
  assert.equal(resolveSpawnConfig(cwd, 'architect', env).model, 'architect-global');
  assert.equal(readSettings(cwd, 'project', env).overrides.architect, false);
  resetRole(cwd, 'architect', 'global', env);
  assert.equal(resolveSpawnConfig(cwd, 'architect', env).model, null);
  assert.equal(readFileSync(path, 'utf8'), before);
});
