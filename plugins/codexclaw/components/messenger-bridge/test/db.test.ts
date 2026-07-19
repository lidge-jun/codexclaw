/** db.test.ts — bridge state substrate: schema, invariants, persistence. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openBridgeDb } from "../src/db.ts";

function tempCwd(): string {
  return mkdtempSync(join(tmpdir(), "bridge-db-test-"));
}

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

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("schema v1 creates and reopen persists state", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    db.setChannelToken("telegram", "tok-123");
    db.close();

    const reopened = openBridgeDb(cwd);
    assert.equal(reopened.getChannel("telegram")?.token, "tok-123");
    reopened.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("bridge.db file mode is 600", { skip: process.platform === "win32" }, () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const mode = statSync(join(cwd, ".codexclaw", "bridge.db")).mode & 0o777;
    assert.equal(mode, 0o600);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("single-active channel invariant", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    db.setChannelToken("telegram", "t");
    db.setChannelToken("discord", "d");

    db.setActiveChannel("telegram");
    assert.equal(db.getActiveChannel()?.kind, "telegram");

    db.setActiveChannel("discord");
    assert.equal(db.getActiveChannel()?.kind, "discord");
    assert.equal(db.getChannel("telegram")?.active, 0);

    db.setActiveChannel(null);
    assert.equal(db.getActiveChannel(), null);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("activating a channel without a saved token throws and rolls back", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    db.setChannelToken("telegram", "t");
    db.setActiveChannel("telegram");
    assert.throws(() => db.setActiveChannel("discord"), /no token saved/);
    // rollback keeps the previous active channel
    assert.equal(db.getActiveChannel()?.kind, "telegram");
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("allowlist add/check/list/remove", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    assert.equal(db.isAllowed("telegram", "111"), false);
    db.addAllowlist("telegram", "111", "jun");
    assert.equal(db.isAllowed("telegram", "111"), true);
    assert.equal(db.isAllowed("discord", "111"), false);
    // idempotent upsert refreshes label
    db.addAllowlist("telegram", "111", "jun-2");
    const rows = db.listAllowlist("telegram");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.label, "jun-2");
    db.removeAllowlist("telegram", "111");
    assert.equal(db.isAllowed("telegram", "111"), false);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("binding get-or-create is idempotent per (kind, chatId)", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const first = db.getOrCreateBinding("telegram", "42", "/tmp/w");
    const again = db.getOrCreateBinding("telegram", "42", "/tmp/other");
    assert.equal(first.id, again.id);
    assert.equal(again.workdir, "/tmp/w");

    const other = db.getOrCreateBinding("discord", "42", "/tmp/w");
    assert.notEqual(other.id, first.id);

    db.setBindingThread(first.id, "thread-abc");
    assert.equal(db.getBinding(first.id)?.thread_id, "thread-abc");
    db.clearBindingThread(first.id);
    assert.equal(db.getBinding(first.id)?.thread_id, null);

    db.setBindingStatus(first.id, "running");
    assert.equal(db.getBinding(first.id)?.status, "running");
    assert.equal(db.listBindings().length, 2);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("binding get-or-create isolates plain chat and forum topics", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const plain = db.getOrCreateBinding("telegram", "42", "/tmp/plain");
    const topic1 = db.getOrCreateBinding("telegram", "42", "/tmp/topic1", "1");
    const topic2 = db.getOrCreateBinding("telegram", "42", "/tmp/topic2", "2");

    assert.notEqual(plain.id, topic1.id);
    assert.notEqual(topic1.id, topic2.id);
    assert.equal(db.getOrCreateBinding("telegram", "42", "/tmp/other").id, plain.id);
    assert.equal(db.getOrCreateBinding("telegram", "42", "/tmp/other", "1").id, topic1.id);
    assert.equal(plain.topic_id, null);
    assert.equal(topic1.topic_id, "1");
    assert.equal(topic2.topic_id, "2");
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("agent bindings isolate topics for the same agent and chat", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const plain = db.getOrCreateAgentBinding(agent.id, "telegram", "42", "/tmp/plain");
    const topic = db.getOrCreateAgentBinding(agent.id, "telegram", "42", "/tmp/topic", "9");

    assert.notEqual(plain.id, topic.id);
    assert.equal(db.getOrCreateAgentBinding(agent.id, "telegram", "42", "/tmp/other").id, plain.id);
    assert.equal(db.getOrCreateAgentBinding(agent.id, "telegram", "42", "/tmp/other", "9").id, topic.id);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("listBindingsForChat returns all topic rows for the current chat and agent newest first", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const plain = db.getOrCreateAgentBinding(agent.id, "telegram", "42", "/tmp/plain");
    const topic1 = db.getOrCreateAgentBinding(agent.id, "telegram", "42", "/tmp/topic1", "1");
    const topic2 = db.getOrCreateAgentBinding(agent.id, "telegram", "42", "/tmp/topic2", "2");
    db.getOrCreateAgentBinding(agent.id, "telegram", "43", "/tmp/other", "1");
    db.getOrCreateBinding("telegram", "42", "/tmp/legacy", "1");

    const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
    raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-07T00:00:00.000Z", plain.id);
    raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-07T00:02:00.000Z", topic1.id);
    raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-07T00:01:00.000Z", topic2.id);
    raw.close();

    assert.deepEqual(db.listBindingsForChat("telegram", "42", agent.id).map((row) => row.id), [
      topic1.id,
      topic2.id,
      plain.id,
    ]);
    assert.deepEqual(db.listBindingsForChat("telegram", "42", null).map((row) => row.agent_id), [null]);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("job lifecycle: create, patch, list ordering + preview caps", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const binding = db.getOrCreateBinding("telegram", "7", "/tmp/w");
    const jobId = db.createJob(binding.id, "x".repeat(900));
    assert.equal(db.getJob(jobId)?.prompt_preview.length, 500);
    assert.equal(db.getJob(jobId)?.state, "queued");

    db.updateJob(jobId, { state: "running", started_at: "2026-07-03T00:00:00Z", thread_id: "th-1" });
    assert.equal(db.getJob(jobId)?.state, "running");

    db.updateJob(jobId, { state: "done", result_preview: "y".repeat(900), ended_at: "2026-07-03T00:01:00Z" });
    const done = db.getJob(jobId);
    assert.equal(done?.state, "done");
    assert.equal(done?.result_preview?.length, 500);

    const second = db.createJob(binding.id, "next");
    const jobs = db.listJobs(binding.id, 10);
    assert.equal(jobs[0]?.id, second);
    assert.equal(jobs[1]?.id, jobId);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("setBindingWorkdir repoints the exec cwd for one binding only", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const a = db.getOrCreateBinding("telegram", "1", "/tmp/a");
    const b = db.getOrCreateBinding("telegram", "2", "/tmp/b");
    db.setBindingWorkdir(a.id, "/tmp/elsewhere");
    assert.equal(db.getBinding(a.id)?.workdir, "/tmp/elsewhere");
    assert.equal(db.getBinding(b.id)?.workdir, "/tmp/b");
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("resetBindingSession clears only the remembered Codex thread", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const binding = db.getOrCreateBinding("telegram", "1", "/tmp/a");
    db.setBindingThread(binding.id, "thread-abc");
    db.setBindingStatus(binding.id, "running");

    db.resetBindingSession(binding.id);

    const reset = db.getBinding(binding.id);
    assert.equal(reset?.thread_id, null);
    assert.equal(reset?.workdir, "/tmp/a");
    assert.equal(reset?.status, "running");
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("deleteBindingCascade removes jobs + binding, leaves others intact", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const doomed = db.getOrCreateBinding("telegram", "10", "/tmp/w");
    const kept = db.getOrCreateBinding("telegram", "11", "/tmp/w");
    db.createJob(doomed.id, "bye");
    const keptJob = db.createJob(kept.id, "stay");

    db.deleteBindingCascade(doomed.id);

    assert.equal(db.getBinding(doomed.id), null);
    assert.equal(db.listJobs(doomed.id, 10).length, 0);
    assert.equal(db.getBinding(kept.id)?.id, kept.id);
    assert.equal(db.listJobs(kept.id, 10)[0]?.id, keptJob);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("agent pairing codes store only hashes and consume once before expiry", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const other = db.createAgent("telegram-2", "telegram", "tok2");
    const code = "raw-code-secret";
    const hash = sha256Hex(code);
    const expiresAt = db.createAgentPairingCode(agent.id, hash, 60);
    assert.ok(expiresAt > Date.now());

    const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
    const stored = raw.prepare("SELECT code_hash, expires_at, consumed_at FROM agent_pairing_codes").get() as {
      code_hash: string;
      expires_at: number;
      consumed_at: number | null;
    };
    raw.close();
    assert.equal(stored.code_hash, hash);
    assert.notEqual(stored.code_hash, code);
    assert.equal(stored.consumed_at, null);

    assert.equal(db.consumeAgentPairingCode(other.id, hash), false);
    assert.equal(db.consumeAgentPairingCode(agent.id, hash), true);
    assert.equal(db.consumeAgentPairingCode(agent.id, hash), false);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("expired pairing codes are rejected naturally by the consume CAS", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const hash = sha256Hex("expired-code");
    db.createAgentPairingCode(agent.id, hash, -1);
    assert.equal(db.consumeAgentPairingCode(agent.id, hash), false);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("sweepExpiredPairingCodes drops consumed and expired rows, keeps live ones", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.createAgentPairingCode(agent.id, sha256Hex("expired"), -1);
    db.createAgentPairingCode(agent.id, sha256Hex("consumed"), 60);
    db.createAgentPairingCode(agent.id, sha256Hex("live"), 60);
    assert.equal(db.consumeAgentPairingCode(agent.id, sha256Hex("consumed")), true);

    assert.equal(db.sweepExpiredPairingCodes(), 2);

    const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
    const rows = raw.prepare("SELECT code_hash FROM agent_pairing_codes").all() as Array<{ code_hash: string }>;
    raw.close();
    assert.deepEqual(rows.map((row) => row.code_hash), [sha256Hex("live")]);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("deleteAgent removes owned pairing codes", () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const doomed = db.createAgent("telegram-1", "telegram", "tok");
    const kept = db.createAgent("telegram-2", "telegram", "tok2");
    db.createAgentPairingCode(doomed.id, sha256Hex("doomed"), 60);
    db.createAgentPairingCode(kept.id, sha256Hex("kept"), 60);

    db.deleteAgent(doomed.id);

    const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
    const rows = raw.prepare("SELECT agent_id FROM agent_pairing_codes ORDER BY agent_id").all() as Array<{ agent_id: number }>;
    raw.close();
    assert.deepEqual(rows.map((row) => row.agent_id), [kept.id]);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});
