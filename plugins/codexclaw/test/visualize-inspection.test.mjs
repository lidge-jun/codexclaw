import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const source = resolve('plugins/codexclaw/skills/dev-diagram-viewer/upstream/sync-check.sh');
const hasBash = spawnSync('bash', ['--version']).status === 0;
test('visualize inspection uses explicit root, version order, and failure states', { skip: !hasBash }, t => {
  const root = mkdtempSync(join(tmpdir(), 'cxc-visualize-test-'));
  try {
    copyFileSync(source, join(root, 'sync-check.sh'));
    const hash = createHash('sha256').update('current-contract').digest('hex');
    const tracking = join(root, 'visualize-upstream.md');
    writeFileSync(tracking, '- Current SHA-256: `' + hash + '`\n- Version: `1.0.10`\n');
    // A backslash is a native separator on Windows and a legal POSIX filename byte.
    // Both forms exercise checksum tools that escape backslashes in named-file output.
    const cache = join(root, 'override\\root');
    const add = (version, content) => {
      const dir = join(cache, version, 'skills', 'visualize');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), content);
    };
    const run = env => spawnSync('bash', [join(root, 'sync-check.sh')], {
      encoding: 'utf8', env: { ...process.env, HOME: join(root, 'unused-home'),
        CODEX_HOME: join(root, 'wrong-default'), CXC_VISUALIZE_ROOT: cache, ...env }
    });
    let result = run({});
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /installed SKILL.md not found/);
    add('1.0.9', 'older-contract');
    add('1.0.10', 'current-contract');
    result = run({});
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /version 1\.0\.10/);
    add('1.0.11', 'different-contract');
    result = run({});
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /drift detected/);
    const defaultRoot = join(root, 'codex-home');
    const homeRoot = join(root, 'home');
    for (const [base, version] of [[defaultRoot, '2.0.0'], [join(homeRoot, '.codex'), '3.0.0']]) {
      const dir = join(base, 'plugins', 'cache', 'openai-bundled', 'visualize', version, 'skills', 'visualize');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), 'current-contract');
    }
    // Explicit override still wins over a populated, different CODEX_HOME.
    result = run({ CODEX_HOME: defaultRoot, HOME: homeRoot });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /1\.0\.11/);
    for (const override of ['', undefined]) {
      result = run({ CXC_VISUALIZE_ROOT: override, CODEX_HOME: defaultRoot, HOME: homeRoot });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /version 2\.0\.0/);
    }
    for (const codexHome of ['', undefined]) {
      result = run({ CXC_VISUALIZE_ROOT: undefined, CODEX_HOME: codexHome, HOME: homeRoot });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /version 3\.0\.0/);
    }
    writeFileSync(tracking, '- Current SHA-256: `invalid`\n');
    result = run({});
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /stored SHA-256 is missing or invalid/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
