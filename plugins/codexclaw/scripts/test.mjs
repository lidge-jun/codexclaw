#!/usr/bin/env node
/** Keep integration tests from writing operator CXC settings or catalog caches. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const home = mkdtempSync(join(tmpdir(), 'cxc-test-home-'));
try {
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, CODEXCLAW_HOME: home },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
