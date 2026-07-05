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
import { openBridgeDb, type AgentRow, type BridgeDb } from "../src/db.ts";
import { AgentService } from "../src/agent-service.ts";
import { HeartbeatScheduler } from "../src/heartbeat.ts";

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
  const scheduler = new HeartbeatScheduler({
    db,
    service: () => service,
    workdir: cwd,
    now: () => nowRef.t,
    send: async (agent: AgentRow, chatId: string, text: string) => {
      sent.push({ agent: agent.name, chatId, text });
    },
  });
  return { db, scheduler, sent, cwd };
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
