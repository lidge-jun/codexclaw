/**
 * heartbeat.test.ts — slice 70: fail-closed gates, silence convention,
 * interval discipline. Fake codex bin + captured send, manual tick().
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openBridgeDb, type AgentRow, type BridgeDb } from "../src/db.ts";
import { AgentService } from "../src/agent-service.ts";
import { DiscordThreadSweepScheduler, HeartbeatScheduler } from "../src/heartbeat.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-codex.mjs");
chmodSync(FAKE, 0o755);

interface Sent {
  agent: string;
  chatId: string;
  text: string;
}

function setup(nowRef: { t: number }) {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-hb-"));
  const db = openBridgeDb(cwd);
  const service = new AgentService({ db, codexBin: FAKE });
  const sent: Sent[] = [];
  const logs: string[] = [];
  const scheduler = new HeartbeatScheduler({
    db,
    service: () => service,
    workdir: cwd,
    now: () => nowRef.t,
    log: (line) => logs.push(line),
    send: async (agent: AgentRow, chatId: string, text: string) => {
      sent.push({ agent: agent.name, chatId, text });
    },
  });
  return { db, scheduler, sent, cwd, logs };
}

function makeHbAgent(db: BridgeDb, name: string, opts?: { autoSend?: number; minutes?: number; paired?: boolean }) {
  const agent = db.createAgent(name, "telegram", "tok-" + name);
  db.updateAgent(agent.id, {
    heartbeat_minutes: opts?.minutes ?? 5,
    heartbeat_prompt: "anything to report?",
    auto_send: opts?.autoSend ?? 1,
  });
  db.setAgentEnabled(agent.id, true);
  if (opts?.paired !== false) db.addAgentAllowlist(agent.id, "chat-" + name);
  return db.getAgent(agent.id)!;
}

test("due agent runs its prompt and forwards the reply to the paired chat", async () => {
  const nowRef = { t: 10 * 60_000 };
  const { db, scheduler, sent } = setup(nowRef);
  const agent = makeHbAgent(db, "hb1");
  process.env.FAKE_CODEX_MODE = "ok";
  await scheduler.tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, "chat-hb1");
  assert.match(sent[0].text, /reply to: anything to report\?/);
  // recorded through the normal jobs pipeline
  const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "chat-hb1", "/x");
  assert.equal(db.listJobs(binding.id, 5).length, 1);
  db.close();
});

test("interval discipline: not due again until N minutes pass", async () => {
  const nowRef = { t: 10 * 60_000 };
  const { db, scheduler, sent } = setup(nowRef);
  makeHbAgent(db, "hb1", { minutes: 5 });
  process.env.FAKE_CODEX_MODE = "ok";
  await scheduler.tick();
  nowRef.t += 60_000; // +1min — not due
  await scheduler.tick();
  assert.equal(sent.length, 1);
  nowRef.t += 5 * 60_000; // now due again
  await scheduler.tick();
  assert.equal(sent.length, 2);
  db.close();
});

test("gates fail closed: auto_send off, unpaired, disabled, zero minutes — no run at all", async () => {
  const nowRef = { t: 10 * 60_000 };
  const { db, scheduler, sent, cwd } = setup(nowRef);
  makeHbAgent(db, "no-autosend", { autoSend: 0 });
  makeHbAgent(db, "unpaired", { paired: false });
  const off = makeHbAgent(db, "disabled");
  db.setAgentEnabled(off.id, false);
  makeHbAgent(db, "zero-min", { minutes: 0 });
  process.env.FAKE_CODEX_MODE = "ok";
  await scheduler.tick();
  assert.equal(sent.length, 0);
  // and no jobs were created for any of them (no hidden spend)
  for (const a of db.listAgents()) {
    const binding = db.getOrCreateAgentBinding(a.id, a.kind, "probe", cwd);
    assert.equal(db.listJobs(binding.id, 5).length, 0);
  }
  db.close();
});

test("HEARTBEAT_OK reply is recorded but never forwarded", async () => {
  const nowRef = { t: 10 * 60_000 };
  const { db, scheduler, sent } = setup(nowRef);
  const agent = db.createAgent("hb-silent", "telegram", "tok");
  db.updateAgent(agent.id, { heartbeat_minutes: 5, heartbeat_prompt: "HEARTBEAT_OK" });
  db.setAgentEnabled(agent.id, true);
  db.addAgentAllowlist(agent.id, "c1");
  // fake codex echoes "reply to: <prompt>" — prompt contains HEARTBEAT_OK,
  // so the reply matches the silence convention.
  process.env.FAKE_CODEX_MODE = "ok";
  await scheduler.tick();
  assert.equal(sent.length, 0);
  const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "c1", "/x");
  assert.equal(db.listJobs(binding.id, 5).length, 1); // run happened, forward suppressed
  db.close();
});

test("busy binding skips the tick without consuming the schedule slot", async () => {
  const nowRef = { t: 10 * 60_000 };
  const { db, scheduler, sent, cwd } = setup(nowRef);
  const agent = makeHbAgent(db, "hb-busy");
  // binding.workdir now drives the exec cwd (telegram_cwd_sessions phase 1),
  // so the fixture must point at a real directory.
  const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "chat-hb-busy", cwd);
  db.setBindingStatus(binding.id, "running");
  process.env.FAKE_CODEX_MODE = "ok";
  await scheduler.tick();
  assert.equal(sent.length, 0);
  // becomes idle → next tick runs (slot was not burned)
  db.setBindingStatus(binding.id, "idle");
  await scheduler.tick();
  assert.equal(sent.length, 1);
  db.close();
});

test("heartbeat skips full_access=0 agents instead of creating hidden approvals", async () => {
  const nowRef = { t: 10 * 60_000 };
  const { db, scheduler, sent, logs } = setup(nowRef);
  const agent = makeHbAgent(db, "hb-needs-approval");
  db.updateAgent(agent.id, { full_access: 0 });
  process.env.FAKE_CODEX_MODE = "ok";
  await scheduler.tick();
  assert.equal(sent.length, 0);
  assert.equal(db.listBindings().length, 0);
  assert.ok(logs.some((line) => line.includes("approval required")));
  db.close();
});

test("DiscordThreadSweepScheduler archives and removes idle task-thread bindings", async () => {
  const nowRef = { t: Date.parse("2026-07-07T12:00:00Z") };
  const { db, cwd } = setup(nowRef);
  const agent = db.createAgent("dc-1", "discord", "tok-dc");
  db.addAgentAllowlist(agent.id, "thread-old", "task-thread");
  db.addAgentAllowlist(agent.id, "thread-fresh", "task-thread");
  const oldBinding = db.getOrCreateAgentBinding(agent.id, "discord", "thread-old", cwd);
  const freshBinding = db.getOrCreateAgentBinding(agent.id, "discord", "thread-fresh", cwd);
  const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
  raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-06T10:59:59.000Z", oldBinding.id);
  raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-06T12:30:00.000Z", freshBinding.id);
  raw.close();

  const archived: string[] = [];
  const sweep = new DiscordThreadSweepScheduler({
    db,
    now: () => nowRef.t,
    apiFactory: () => ({
      archiveThread: async (channelId: string) => {
        archived.push(channelId);
        return { ok: true, status: 200, data: { id: channelId, archived: true } };
      },
    }),
  });
  await sweep.tick();

  assert.deepEqual(archived, ["thread-old"]);
  assert.equal(db.getBinding(oldBinding.id), null);
  assert.equal(db.getBinding(freshBinding.id)?.id, freshBinding.id);
  assert.equal(db.isAgentAllowed(agent.id, "thread-old"), false);
  assert.equal(db.isAgentAllowed(agent.id, "thread-fresh"), true);
  db.close();
});

test("DiscordThreadSweepScheduler preserves backdated running task threads until idle", async () => {
  const nowRef = { t: Date.parse("2026-07-07T12:00:00Z") };
  const { db, cwd } = setup(nowRef);
  const agent = db.createAgent("dc-running", "discord", "tok-dc");
  db.addAgentAllowlist(agent.id, "thread-running", "task-thread");
  const binding = db.getOrCreateAgentBinding(agent.id, "discord", "thread-running", cwd);
  const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
  raw.prepare("UPDATE bindings SET status = 'running', updated_at = ? WHERE id = ?")
    .run("2026-07-06T10:59:59.000Z", binding.id);
  raw.close();

  const archived: string[] = [];
  const sweep = new DiscordThreadSweepScheduler({
    db,
    now: () => nowRef.t,
    apiFactory: () => ({
      archiveThread: async (channelId: string) => {
        archived.push(channelId);
        return { ok: true, status: 200, data: { id: channelId, archived: true } };
      },
    }),
  });
  await sweep.tick();

  assert.deepEqual(archived, []);
  assert.equal(db.getBinding(binding.id)?.status, "running");
  assert.equal(db.isAgentAllowed(agent.id, "thread-running"), true);

  const rawIdle = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
  rawIdle.prepare("UPDATE bindings SET status = 'idle', updated_at = ? WHERE id = ?")
    .run("2026-07-06T10:59:59.000Z", binding.id);
  rawIdle.close();
  await sweep.tick();

  assert.deepEqual(archived, ["thread-running"]);
  assert.equal(db.getBinding(binding.id), null);
  assert.equal(db.isAgentAllowed(agent.id, "thread-running"), false);
  db.close();
});

test("DiscordThreadSweepScheduler compensates when a turn starts mid-archive (unarchive, no delete)", async () => {
  const nowRef = { t: Date.parse("2026-07-07T12:00:00Z") };
  const { db, cwd } = setup(nowRef);
  const agent = db.createAgent("dc-race", "discord", "tok-dc");
  db.addAgentAllowlist(agent.id, "thread-race", "task-thread");
  const binding = db.getOrCreateAgentBinding(agent.id, "discord", "thread-race", cwd);
  const raw = new DatabaseSync(join(cwd, ".codexclaw", "bridge.db"));
  raw.prepare("UPDATE bindings SET updated_at = ? WHERE id = ?").run("2026-07-06T10:59:59.000Z", binding.id);
  raw.close();

  const calls: Array<{ channelId: string; archived: boolean }> = [];
  const sweep = new DiscordThreadSweepScheduler({
    db,
    now: () => nowRef.t,
    apiFactory: () => ({
      archiveThread: async (channelId: string, archivedFlag = true) => {
        calls.push({ channelId, archived: archivedFlag });
        if (archivedFlag) {
          // A turn grabs the binding while the archive REST call is in flight.
          db.setBindingStatus(binding.id, "running");
        }
        return { ok: true, status: 200, data: { id: channelId, archived: archivedFlag } };
      },
    }),
  });
  await sweep.tick();

  // Compensating unarchive fired, binding survived with its running turn.
  assert.deepEqual(calls, [
    { channelId: "thread-race", archived: true },
    { channelId: "thread-race", archived: false },
  ]);
  assert.equal(db.getBinding(binding.id)?.status, "running");
  assert.equal(db.isAgentAllowed(agent.id, "thread-race"), true);
  db.close();
});
