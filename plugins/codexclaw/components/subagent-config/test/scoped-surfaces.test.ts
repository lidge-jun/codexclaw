import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setRole } from '../src/store.ts';

function fixture(t: { after: (fn: () => void) => void }) {
  const cwd = mkdtempSync(join(tmpdir(), 'cxc-surfaces-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, CODEX_HOME: join(cwd, 'codex'), CODEXCLAW_HOME: join(cwd, 'cxc') };
  return { cwd, env };
}
const script = (name: string) => fileURLToPath(new URL(`../dist/${name}.js`, import.meta.url));

test('compiled hook injects global model and effort for v1 and v2; full forks stay untouched', t => {
  const { cwd, env } = fixture(t);
  setRole(cwd, 'explorer', { mode: 'model', model: 'fixture-global', effort: 'high' }, 'global', env);
  for (const tool_input of [{ agent_type: 'explorer', message: 'Explore files' }, { task_name: 'explore', fork_turns: 'none', message: 'Explore files' }]) {
    const result = spawnSync(process.execPath, [script('spawn-attach-hook'), 'hook', 'pre-tool-use'], { cwd, env, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', session_id: 'test-root', cwd, tool_input }) });
    assert.equal(result.status, 0, result.stderr);
    const input = JSON.parse(result.stdout).hookSpecificOutput.updatedInput;
    assert.equal(input.model, 'fixture-global');
    assert.equal(input.reasoning_effort, 'high');
  }
  const result = spawnSync(process.execPath, [script('spawn-attach-hook'), 'hook', 'pre-tool-use'], { cwd, env, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', session_id: 'test-root', cwd, tool_input: { agent_type: 'explorer', fork_context: true, message: 'Explore files' } }) });
  assert.equal(result.status, 0, result.stderr);
  const input = JSON.parse(result.stdout).hookSpecificOutput.updatedInput;
  assert.equal(input.model, undefined);
  assert.equal(input.reasoning_effort, undefined);
});

test('CLI global set/get/reset and project override use the same persisted roles', t => {
  const { cwd, env } = fixture(t);
  const cli = (...args: string[]) => {
    const r = spawnSync(process.execPath, [script('cli'), 'subagents', ...args], { cwd, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr); return JSON.parse(r.stdout);
  };
  assert.equal(cli('set', 'reviewer', '--effort', 'high', '--global').effort, 'high');
  assert.equal(cli('get', 'reviewer').effort, 'high');
  assert.equal(cli('set', 'reviewer', '--clear-effort').effort, null);
  assert.equal(cli('get', 'reviewer', '--global').effort, 'high');
  assert.equal(cli('reset', 'reviewer').effort, 'high');
  assert.equal(cli('reset', 'reviewer', '--global').effort, null);
});

test('compiled MCP honors scope and reset; rejects invalid effort/scope/reset combinations', t => {
  const { cwd, env } = fixture(t);
  const args = [
    ['subagents_set', { role: 'reviewer', scope: 'global', effort: 'high' }],
    ['subagents_get', {}],
    ['subagents_set', { role: 'reviewer', effort: null }],
    ['subagents_get', { scope: 'global' }],
    ['subagents_set', { role: 'reviewer', inherit: true }],
    ['subagents_set', { role: 'reviewer', scope: 'global', effort: 'invalid' }],
    ['subagents_set', { role: 'reviewer', scope: 'bad', effort: 'low' }],
    ['subagents_set', { role: 'reviewer', inherit: true, effort: null }],
    ['subagents_set', { role: 'reviewer', scope: 'global', inherit: true }],
  ];
  const input = args.map(([name, arguments_], id) => JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: arguments_ } })).join('\n') + '\n';
  const r = spawnSync(process.execPath, [script('mcp')], { cwd, env, input, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const replies = r.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(replies.length, args.length);
  const config = (n: number) => JSON.parse(replies[n].result.content[0].text);
  assert.equal(config(1).sources.reviewer, 'global');
  assert.equal(config(2).roles.reviewer.effort, null);
  assert.equal(config(3).roles.reviewer.effort, 'high');
  assert.equal(config(4).roles.reviewer.effort, 'high');
  for (const n of [5, 6, 7]) assert.equal(replies[n].result.isError, true);
  assert.equal(config(8).sources.reviewer, 'session');
});
