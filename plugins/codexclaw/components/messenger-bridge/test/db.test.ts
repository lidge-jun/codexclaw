/** db.test.ts — bridge state substrate: schema, invariants, persistence. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBridgeDb } from "../src/db.ts";

function tempCwd(): string {
  return mkdtempSync(join(tmpdir(), "bridge-db-test-"));
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
  }
});
