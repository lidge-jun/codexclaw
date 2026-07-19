/** db-migration.test.ts — v1→v2→v3 upgrade of an existing database file. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBridgeDb } from "../src/db.ts";

/** Windows CI: NTFS can briefly refuse recursive removal while SQLite
 *  handles finish closing — retry with a short synchronous backoff. */
function rmRfRetry(path: string): void {
  const gate = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 1; ; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt >= 5) throw err;
      Atomics.wait(gate, 0, 0, 100);
    }
  }
}

/** Hand-build a REAL v1 shape — a genuine v1 file always has all four
 *  SCHEMA_V1 tables (they are created in one exec), and v4 rebuilds bindings,
 *  so a channels-only fixture is not a valid v1 database. */
test("migrates a legacy v1 database to current without losing rows", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bridge-migrate-test-"));
  try {
    mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
    const file = join(cwd, ".codexclaw", "bridge.db");
    const raw = new DatabaseSync(file);
    raw.exec(`
      CREATE TABLE channels (
        kind TEXT PRIMARY KEY,
        token TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE allowlist (
        channel_kind TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        added_at TEXT NOT NULL,
        PRIMARY KEY (channel_kind, chat_id)
      );
      CREATE TABLE bindings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_kind TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        thread_id TEXT,
        workdir TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'default',
        status TEXT NOT NULL DEFAULT 'idle',
        updated_at TEXT NOT NULL,
        UNIQUE (channel_kind, chat_id)
      );
      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        binding_id INTEGER NOT NULL,
        prompt_preview TEXT NOT NULL,
        result_preview TEXT,
        state TEXT NOT NULL DEFAULT 'queued',
        thread_id TEXT,
        error TEXT,
        started_at TEXT,
        ended_at TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO channels (kind, token, active, updated_at)
      VALUES ('telegram', 'legacy-tok', 1, '2026-01-01T00:00:00Z');
      PRAGMA user_version = 1;
    `);
    raw.close();

    const db = openBridgeDb(cwd);
    // v1 row survived
    assert.equal(db.getChannel("telegram")?.token, "legacy-tok");
    // v2 column usable
    assert.equal(db.isHandshakeOpen("telegram"), false);
    db.openHandshake("telegram", 60);
    assert.equal(db.isHandshakeOpen("telegram"), true);
    // v3 column usable
    assert.equal(db.getPollOffset("telegram"), 0);
    db.setPollOffset("telegram", 4242);
    assert.equal(db.getPollOffset("telegram"), 4242);
    db.close();

    // reopen: user_version is now 3, no re-migration, offset persists
    const reopened = openBridgeDb(cwd);
    assert.equal(reopened.getPollOffset("telegram"), 4242);
    reopened.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("handshake window expires by wall clock", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bridge-hs-test-"));
  try {
    const db = openBridgeDb(cwd);
    db.setChannelToken("telegram", "t");
    db.openHandshake("telegram", -1); // already expired
    assert.equal(db.isHandshakeOpen("telegram"), false);
    db.openHandshake("telegram", 60);
    assert.equal(db.isHandshakeOpen("telegram"), true);
    db.closeHandshake("telegram");
    assert.equal(db.isHandshakeOpen("telegram"), false);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("v6: binding effort/topic_id + agent full_access/webhook_url defaults and setters", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bridge-v6-test-"));
  try {
    const db = openBridgeDb(cwd);
    const binding = db.getOrCreateBinding("telegram", "42", cwd);
    assert.equal(binding.effort, "default");
    assert.equal(binding.topic_id, null);
    db.setBindingModel(binding.id, "gpt-5.5");
    db.setBindingEffort(binding.id, "xhigh");
    const after = db.getOrCreateBinding("telegram", "42", cwd);
    assert.equal(after.model, "gpt-5.5");
    assert.equal(after.effort, "xhigh");

    const agent = db.createAgent("tg-x", "telegram", "tok");
    assert.equal(agent.full_access, 1);
    assert.equal(agent.webhook_url, "");
    const patched = db.updateAgent(agent.id, { full_access: 0, webhook_url: "https://x.example/hook" });
    assert.equal(patched?.full_access, 0);
    assert.equal(patched?.webhook_url, "https://x.example/hook");
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("v8: agents.thread_mode defaults to 'thread' and accepts 'plain'", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bridge-v8-test-"));
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("tg-mode", "telegram", "tok");
    assert.equal(agent.thread_mode, "thread", "default thread_mode should be 'thread'");

    const patched = db.updateAgent(agent.id, { thread_mode: "plain" });
    assert.equal(patched?.thread_mode, "plain");

    const reverted = db.updateAgent(agent.id, { thread_mode: "thread" });
    assert.equal(reverted?.thread_mode, "thread");

    // CHECK constraint rejects invalid values
    assert.throws(() => {
      db.updateAgent(agent.id, { thread_mode: "bogus" as any });
    }, /CHECK/i);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});
