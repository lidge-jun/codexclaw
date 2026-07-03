/**
 * agent-store.test.ts — v4 named-agent schema: migration, seed, CRUD, cascade
 * (plan: devlog/_plan/260703_gui_production_hardening/40_phase4-agent-entity.md rev 3).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BridgeDb } from "../src/db.ts";

function tmpFile(): string {
  return join(mkdtempSync(join(tmpdir(), "cxc-agents-")), "bridge.db");
}

/** Build a REAL v3-shaped file (v1 schema + v2/v3 alters + fixture rows). */
function buildV3Fixture(file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`
CREATE TABLE channels (
  kind TEXT PRIMARY KEY CHECK (kind IN ('telegram','discord')),
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
ALTER TABLE channels ADD COLUMN handshake_open_until TEXT;
ALTER TABLE channels ADD COLUMN poll_offset INTEGER NOT NULL DEFAULT 0;
INSERT INTO channels (kind, token, active, updated_at, poll_offset) VALUES ('telegram', 'tg-token-123', 1, '2026-07-01T00:00:00Z', 42);
INSERT INTO allowlist (channel_kind, chat_id, label, added_at) VALUES ('telegram', '8231', 'jun', '2026-07-01T00:00:00Z');
INSERT INTO bindings (id, channel_kind, chat_id, thread_id, workdir, updated_at) VALUES (7, 'telegram', '8231', 'thread-abc', '/tmp/w', '2026-07-01T00:00:00Z');
INSERT INTO jobs (binding_id, prompt_preview, state, created_at) VALUES (7, 'hello', 'done', '2026-07-01T00:00:00Z');
PRAGMA user_version = 3;
`);
  db.close();
}

test("v4 fresh db: agents + agent_allowlist tables exist, version 4", () => {
  const db = new BridgeDb(tmpFile());
  assert.deepEqual(db.listAgents(), []);
  const agent = db.createAgent("telegram-1", "telegram", "tok");
  assert.equal(agent.name, "telegram-1");
  assert.equal(agent.effort, "default");
  assert.equal(agent.auto_send, 1);
  assert.equal(agent.mention_only, 1);
  assert.equal(agent.heartbeat_minutes, 0);
  db.close();
});

test("v3 -> v4 migration: seed agent from token-bearing channel, copy allowlist, backfill bindings, jobs intact", () => {
  const file = tmpFile();
  buildV3Fixture(file);
  const db = new BridgeDb(file); // triggers ONLY v4
  const agents = db.listAgents();
  assert.equal(agents.length, 1);
  const a = agents[0];
  assert.equal(a.name, "telegram-1");
  assert.equal(a.kind, "telegram");
  assert.equal(a.token, "tg-token-123");
  assert.equal(a.enabled, 1);
  assert.equal(a.poll_offset, 42);
  // allowlist copied (legacy row untouched)
  assert.equal(db.isAgentAllowed(a.id, "8231"), true);
  assert.equal(db.isAllowed("telegram", "8231"), true);
  // binding backfilled with preserved id, jobs still join
  const binding = db.getBinding(7);
  assert.ok(binding);
  assert.equal(binding?.agent_id, a.id);
  assert.equal(binding?.thread_id, "thread-abc");
  assert.equal(db.listJobs(7).length, 1);
  db.close();
});

test("negative (audit fix #7): two same-kind agents bind the SAME chat without colliding; same agent stays idempotent", () => {
  const db = new BridgeDb(tmpFile());
  const a1 = db.createAgent("telegram-1", "telegram", "t1");
  const a2 = db.createAgent("telegram-2", "telegram", "t2");
  const b1 = db.getOrCreateAgentBinding(a1.id, "telegram", "999", "/tmp/w");
  const b2 = db.getOrCreateAgentBinding(a2.id, "telegram", "999", "/tmp/w");
  assert.notEqual(b1.id, b2.id); // legacy UNIQUE(channel_kind, chat_id) would have rejected this
  const b1again = db.getOrCreateAgentBinding(a1.id, "telegram", "999", "/tmp/w");
  assert.equal(b1again.id, b1.id);
  // legacy flow rows (agent_id NULL) still deduped by the partial index semantics
  const legacy = db.getOrCreateBinding("telegram", "999", "/tmp/w");
  const legacyAgain = db.getOrCreateBinding("telegram", "999", "/tmp/w");
  assert.equal(legacy.id, legacyAgain.id);
  db.close();
});

test("updateAgent: column-allowlisted patch; effort CHECK enforced at DDL", () => {
  const db = new BridgeDb(tmpFile());
  const a = db.createAgent("discord-1", "discord", "d1");
  const updated = db.updateAgent(a.id, { model: "gpt-5.5", effort: "high", mention_only: 0, heartbeat_minutes: 30, heartbeat_prompt: "check inbox" });
  assert.equal(updated?.model, "gpt-5.5");
  assert.equal(updated?.effort, "high");
  assert.equal(updated?.mention_only, 0);
  assert.equal(updated?.heartbeat_minutes, 30);
  assert.throws(() => db.updateAgent(a.id, { effort: "turbo" })); // DDL CHECK backstop
  assert.throws(() => db.createAgent("discord-1", "discord", "x")); // UNIQUE name
  db.close();
});

test("deleteAgent: refuses while enabled; cascade removes allowlist+bindings+jobs, legacy rows survive", () => {
  const file = tmpFile();
  buildV3Fixture(file);
  const db = new BridgeDb(file);
  const a = db.listAgents()[0];
  assert.throws(() => db.deleteAgent(a.id), /disable it first/);
  db.setAgentEnabled(a.id, false);
  db.addAgentAllowlist(a.id, "extra-chat");
  db.deleteAgent(a.id);
  assert.equal(db.getAgent(a.id), null);
  assert.equal(db.isAgentAllowed(a.id, "8231"), false);
  assert.equal(db.getBinding(7), null); // agent-owned binding gone
  assert.equal(db.listJobs(7).length, 0); // its jobs gone
  assert.equal(db.isAllowed("telegram", "8231"), true); // LEGACY allowlist untouched
  db.close();
});

test("per-agent handshake window opens, reports, closes", () => {
  const db = new BridgeDb(tmpFile());
  const a = db.createAgent("telegram-1", "telegram", "t");
  assert.equal(db.isAgentHandshakeOpen(a.id), false);
  db.openAgentHandshake(a.id, 60);
  assert.equal(db.isAgentHandshakeOpen(a.id), true);
  db.closeAgentHandshake(a.id);
  assert.equal(db.isAgentHandshakeOpen(a.id), false);
  db.close();
});

test("downgrade shape: v4 bindings still serves v3-style queries (explicit-column INSERT, SELECT *)", () => {
  const file = tmpFile();
  buildV3Fixture(file);
  const db = new BridgeDb(file);
  // v3-code shape: lookup-first + explicit columns without agent_id
  const row = db.getOrCreateBinding("telegram", "new-chat", "/tmp/w2");
  assert.equal(row.agent_id, null);
  assert.equal(row.workdir, "/tmp/w2");
  db.setBindingThread(row.id, "t-1");
  assert.equal(db.getBinding(row.id)?.thread_id, "t-1");
  db.close();
});
