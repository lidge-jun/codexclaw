import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = resolve('plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs');
test('BUG-R1: missing PDF tools are BLOCKED, never PASS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'report-export-'));
  try {
    const pdf = join(dir, 'input.pdf');
    writeFileSync(pdf, '%PDF-1.7\n% Fixture only tests dependency preflight.\n%%EOF\n');
    const result = spawnSync(process.execPath, [cli, '--qa-only', pdf, '--json'], {
      encoding: 'utf8', env: { ...process.env, PATH: dir }, timeout: 10000
    });
    assert.equal(result.status, 3, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.verdict, 'BLOCKED');
    assert.ok(report.notRun.length > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const args of [['--made-up'], ['--chrome'], ['--qa-only']]) {
  test('reject invalid arguments: ' + args.join(' '), () => {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown option|requires a path|usage:/);
  });
}
test('export cannot overwrite its HTML input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'report-export-'));
  try {
    const input = join(dir, 'report.html');
    writeFileSync(input, '<p>preserve this source</p>');
    const r = spawnSync(process.execPath, [cli, input, input], {encoding:'utf8',timeout:10000});
    assert.equal(r.status, 1);
    assert.match(r.stderr, /paths must differ/);
  } finally { rmSync(dir, { recursive:true,force:true }); }
});
