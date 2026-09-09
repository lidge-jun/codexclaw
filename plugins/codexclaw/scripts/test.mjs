#!/usr/bin/env node
/**
 * Test runner wrapper. Keeps integration tests from writing operator CXC settings
 * or catalog caches by pointing CODEXCLAW_HOME at a scratch directory, and
 * optionally runs one shard of the file list:
 *
 *   node plugins/codexclaw/scripts/test.mjs [--shard i/n] <glob>...
 *
 * Sharding expands the globs here (node:test would otherwise expand them), sorts
 * the POSIX-normalized paths, and keeps every file whose index % n === i - 1, so
 * shards partition the suite deterministically on every OS. Node's own
 * --test-shard is a different splitter and is not used.
 */
import { globSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function parseShard(value) {
  const m = /^([1-9][0-9]*)\/([1-9][0-9]*)$/.exec(String(value ?? ''));
  if (!m) throw new Error('--shard expects i/n with 1 <= i <= n, got ' + JSON.stringify(value));
  const index = Number(m[1]);
  const total = Number(m[2]);
  if (index > total) throw new Error('--shard index ' + index + ' exceeds total ' + total);
  return { index, total };
}

export function toPosix(path) {
  return String(path).replaceAll('\\', '/');
}

/** Expand test globs into a sorted, de-duplicated, POSIX-normalized file list. */
export function expandPatterns(patterns, cwd = process.cwd()) {
  const files = new Set();
  for (const pattern of patterns) {
    for (const file of globSync(pattern, { cwd })) files.add(toPosix(file));
  }
  return [...files].sort();
}

/** Round-robin partition over the sorted list; every file lands in exactly one shard. */
export function shardFiles(files, index, total) {
  const sorted = [...files].map(toPosix).sort();
  const picked = sorted.filter((_, i) => i % total === index - 1);
  if (sorted.length > 0 && picked.length === 0) {
    throw new Error('shard ' + index + '/' + total + ' is empty for ' + sorted.length + ' files; lower n');
  }
  return picked;
}

export function splitArgs(argv) {
  const patterns = [];
  let shard = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--shard') {
      shard = parseShard(argv[++i]);
    } else if (a.startsWith('--shard=')) {
      shard = parseShard(a.slice('--shard='.length));
    } else {
      patterns.push(a);
    }
  }
  return { patterns, shard };
}

function main() {
  const { patterns, shard } = splitArgs(process.argv.slice(2));
  const targets = shard ? shardFiles(expandPatterns(patterns), shard.index, shard.total) : patterns;
  if (shard) {
    console.error('[test.mjs] shard ' + shard.index + '/' + shard.total + ': ' + targets.length + ' files');
  }
  const home = mkdtempSync(join(tmpdir(), 'cxc-test-home-'));
  try {
    const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...targets], {
      stdio: 'inherit', env: { ...process.env, CODEXCLAW_HOME: home },
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally { rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

