/** agent-service.test.ts — db+queue+runner glue via the fake codex bin. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openBridgeDb } from "../src/db.ts";
import { AgentService, buildReseedBlock } from "../src/agent-service.ts";
import { createApprovalStore } from "../src/approval-relay.ts";
import type { JobRow } from "../src/db.ts";
import { EventLog } from "../src/event-log.ts";
import { BridgeMetrics } from "../src/metrics.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-codex.mjs");
chmodSync(FAKE, 0o755);

function tempCwd(): string {
  return mkdtempSync(join(tmpdir(), "bridge-agent-test-"));
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

function withMode(mode: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.env.FAKE_CODEX_MODE;
  process.env.FAKE_CODEX_MODE = mode;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.FAKE_CODEX_MODE;
    else process.env.FAKE_CODEX_MODE = prev;
  });
}

test("handleIncoming: success persists thread id + job transitions to done", async () => {
  const cwd = tempCwd();
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const svc = new AgentService({ db, codexBin: FAKE });
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "100",
        text: "hello?",
        workdir: cwd,
      });
      assert.equal(res.ok, true);
      assert.match(String(res.text), /reply to: hello\?/);

      const binding = db.getOrCreateBinding("telegram", "100", cwd);
      assert.equal(binding.thread_id, "thread-fresh-1");
      assert.equal(binding.status, "idle");
      const jobs = db.listJobs(binding.id, 10);
      assert.equal(jobs[0]?.state, "done");
      assert.ok((jobs[0]?.result_preview ?? "").length > 0);
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("handleIncoming: optional metrics and event log record the turn lifecycle", async () => {
  const cwd = tempCwd();
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const metrics = new BridgeMetrics();
      const events = new EventLog({ path: join(cwd, "events.jsonl") });
      const svc = new AgentService({ db, codexBin: FAKE, metrics, events });
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "100",
        text: "hello?",
        workdir: cwd,
      });
      assert.equal(res.ok, true);

      const snap = metrics.snapshot();
      assert.equal(snap.messagesReceived, 1);
      assert.equal(snap.turnsCompleted, 1);
      assert.equal(snap.errors, 0);
      assert.deepEqual(events.recent(3).map((e) => e.type), [
        "message_received",
        "turn_started",
        "turn_complete",
      ]);
      events.close();
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("handleIncoming: failure records error state on the job", async () => {
  const cwd = tempCwd();
  try {
    await withMode("fail", async () => {
      const db = openBridgeDb(cwd);
      const metrics = new BridgeMetrics();
      const events = new EventLog({ path: join(cwd, "events.jsonl") });
      const svc = new AgentService({ db, codexBin: FAKE, metrics, events });
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "101",
        text: "x",
        workdir: cwd,
      });
      assert.equal(res.ok, false);
      assert.equal(res.error, "model refused");
      const binding = db.getOrCreateBinding("telegram", "101", cwd);
      const jobs = db.listJobs(binding.id, 10);
      assert.equal(jobs[0]?.state, "error");
      assert.equal(binding.status, "idle");
      assert.equal(metrics.snapshot().errors, 1);
      assert.equal(events.recent(1)[0]?.type, "error");
      events.close();
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("handleIncoming: second message resumes the same binding thread", async () => {
  const cwd = tempCwd();
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const svc = new AgentService({ db, codexBin: FAKE });
      await svc.handleIncoming({ kind: "telegram", chatId: "7", text: "one", workdir: cwd });
      const binding1 = db.getOrCreateBinding("telegram", "7", cwd);
      const firstThread = binding1.thread_id;
      assert.ok(firstThread);

      await svc.handleIncoming({ kind: "telegram", chatId: "7", text: "two", workdir: cwd });
      const binding2 = db.getBinding(binding1.id);
      // fake resume echoes the resumed session id back as thread id
      assert.ok(binding2?.thread_id);
      const jobs = db.listJobs(binding1.id, 10);
      assert.equal(jobs.length, 2);
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("handleIncoming: topicId creates isolated bindings and job history", async () => {
  const cwd = tempCwd();
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const svc = new AgentService({ db, codexBin: FAKE });
      await svc.handleIncoming({ kind: "telegram", chatId: "7", topicId: "1", text: "one", workdir: cwd });
      await svc.handleIncoming({ kind: "telegram", chatId: "7", topicId: "2", text: "two", workdir: cwd });

      const topic1 = db.getOrCreateBinding("telegram", "7", cwd, "1");
      const topic2 = db.getOrCreateBinding("telegram", "7", cwd, "2");
      assert.notEqual(topic1.id, topic2.id);
      assert.equal(db.listJobs(topic1.id, 10).length, 1);
      assert.equal(db.listJobs(topic2.id, 10).length, 1);
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("buildReseedBlock: summarizes recent jobs oldest-first with header", () => {
  const jobs: JobRow[] = [
    { prompt_preview: "q2", result_preview: "a2" } as JobRow,
    { prompt_preview: "q1", result_preview: "a1" } as JobRow,
  ];
  const block = buildReseedBlock(jobs);
  assert.match(block, /\[context re-seed\]/);
  // jobs come newest-first; block reverses to oldest-first
  assert.ok(block.indexOf("q1") < block.indexOf("q2"));
  assert.equal(buildReseedBlock([]), "");
});

test("binding workdir wins over the adapter workdir on the next turn", async () => {
  const cwd = tempCwd();
  const otherDir = tempCwd();
  const prevEcho = process.env.FAKE_CODEX_ECHO_CWD;
  process.env.FAKE_CODEX_ECHO_CWD = "1";
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const svc = new AgentService({ db, codexBin: FAKE });
      const binding = db.getOrCreateBinding("telegram", "77", cwd);
      db.setBindingWorkdir(binding.id, otherDir);
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "77",
        text: "where am I?",
        workdir: cwd,
      });
      assert.equal(res.ok, true);
      // macOS tmpdir is a symlink (/var -> /private/var); compare realpaths.
      assert.equal(String(res.text), `cwd: ${realpathSync(otherDir)}`);
      db.close();
    });
  } finally {
    if (prevEcho === undefined) delete process.env.FAKE_CODEX_ECHO_CWD;
    else process.env.FAKE_CODEX_ECHO_CWD = prevEcho;
    rmRfRetry(cwd);
    rmRfRetry(otherDir);
  }
});

test("untouched binding still execs in the adapter workdir (regression)", async () => {
  const cwd = tempCwd();
  const prevEcho = process.env.FAKE_CODEX_ECHO_CWD;
  process.env.FAKE_CODEX_ECHO_CWD = "1";
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const svc = new AgentService({ db, codexBin: FAKE });
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "78",
        text: "home base",
        workdir: cwd,
      });
      assert.equal(res.ok, true);
      assert.equal(String(res.text), `cwd: ${realpathSync(cwd)}`);
      db.close();
    });
  } finally {
    if (prevEcho === undefined) delete process.env.FAKE_CODEX_ECHO_CWD;
    else process.env.FAKE_CODEX_ECHO_CWD = prevEcho;
    rmRfRetry(cwd);
  }
});

test("agent-bound run applies the agent card's model + effort on the next turn", async () => {
  const cwd = tempCwd();
  const prevEcho = process.env.FAKE_CODEX_ECHO_ARGS;
  process.env.FAKE_CODEX_ECHO_ARGS = "1";
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const agent = db.createAgent("telegram-1", "telegram", "tok");
      db.updateAgent(agent.id, { model: "gpt-9-test", effort: "xhigh" });
      const svc = new AgentService({ db, codexBin: FAKE });
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "42",
        text: "ping",
        workdir: cwd,
        agentId: agent.id,
      });
      assert.equal(res.ok, true);
      assert.match(String(res.text), /-m gpt-9-test/);
      assert.match(String(res.text), /-c model_reasoning_effort=xhigh/);
      // and the binding is agent-scoped
      const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "42", cwd);
      assert.equal(binding.agent_id, agent.id);
      assert.equal(binding.thread_id, "thread-fresh-1");
      db.close();
    });
  } finally {
    if (prevEcho === undefined) delete process.env.FAKE_CODEX_ECHO_ARGS;
    else process.env.FAKE_CODEX_ECHO_ARGS = prevEcho;
    rmRfRetry(cwd);
  }
});

test("binding model+effort override agent card, which overrides service defaults", async () => {
  const cwd = tempCwd();
  const prevEcho = process.env.FAKE_CODEX_ECHO_ARGS;
  process.env.FAKE_CODEX_ECHO_ARGS = "1";
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const agent = db.createAgent("telegram-1", "telegram", "tok");
      const svc = new AgentService({ db, codexBin: FAKE, model: "service-model" });

      const fromService = await svc.handleIncoming({
        kind: "telegram", chatId: "svc", text: "ping", workdir: cwd, agentId: agent.id,
      });
      assert.equal(fromService.ok, true);
      assert.match(String(fromService.text), /-m service-model/);
      assert.ok(!/model_reasoning_effort/.test(String(fromService.text)));

      db.updateAgent(agent.id, { model: "agent-model", effort: "high" });
      const fromAgent = await svc.handleIncoming({
        kind: "telegram", chatId: "agent", text: "ping", workdir: cwd, agentId: agent.id,
      });
      assert.equal(fromAgent.ok, true);
      assert.match(String(fromAgent.text), /-m agent-model/);
      assert.match(String(fromAgent.text), /-c model_reasoning_effort=high/);

      const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "binding", cwd);
      db.setBindingModel(binding.id, "binding-model");
      db.setBindingEffort(binding.id, "xhigh");
      const fromBinding = await svc.handleIncoming({
        kind: "telegram", chatId: "binding", text: "ping", workdir: cwd, agentId: agent.id,
      });
      assert.equal(fromBinding.ok, true);
      assert.match(String(fromBinding.text), /-m binding-model/);
      assert.match(String(fromBinding.text), /-c model_reasoning_effort=xhigh/);
      db.close();
    });
  } finally {
    if (prevEcho === undefined) delete process.env.FAKE_CODEX_ECHO_ARGS;
    else process.env.FAKE_CODEX_ECHO_ARGS = prevEcho;
    rmRfRetry(cwd);
  }
});

test("cancelTurn terminates the active child for one binding", async () => {
  const cwd = tempCwd();
  try {
    await withMode("slow", async () => {
      const db = openBridgeDb(cwd);
      const svc = new AgentService({ db, codexBin: FAKE, timeoutMs: 30_000 });
      const binding = db.getOrCreateBinding("telegram", "stop-me", cwd);
      let sawThread = () => {};
      const threadSeen = new Promise<void>((resolve) => {
        sawThread = resolve;
      });

      const pending = svc.handleIncoming({
        kind: "telegram",
        chatId: "stop-me",
        text: "please stop",
        workdir: cwd,
        onEvent: (event) => {
          if (event.kind === "thread") sawThread();
        },
      });
      await threadSeen;

      assert.equal(svc.cancelTurn(binding.id), true);
      const result = await pending;
      assert.equal(result.ok, false);
      assert.match(String(result.error), /codex exited|timed out|signal/i);
      assert.equal(svc.cancelTurn(binding.id), false);
      assert.equal(db.getBinding(binding.id)?.status, "idle");
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("agent with default model+effort adds no -m/-c flags", async () => {
  const cwd = tempCwd();
  const prevEcho = process.env.FAKE_CODEX_ECHO_ARGS;
  process.env.FAKE_CODEX_ECHO_ARGS = "1";
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const agent = db.createAgent("telegram-1", "telegram", "tok");
      const svc = new AgentService({ db, codexBin: FAKE });
      const res = await svc.handleIncoming({
        kind: "telegram", chatId: "43", text: "ping", workdir: cwd, agentId: agent.id,
      });
      assert.equal(res.ok, true);
      assert.ok(!/-m /.test(String(res.text)));
      assert.ok(!/model_reasoning_effort/.test(String(res.text)));
      db.close();
    });
  } finally {
    if (prevEcho === undefined) delete process.env.FAKE_CODEX_ECHO_ARGS;
    else process.env.FAKE_CODEX_ECHO_ARGS = prevEcho;
    rmRfRetry(cwd);
  }
});

test("full_access=0 gate allow-once runs one turn without flipping the agent", async () => {
  const cwd = tempCwd();
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const agent = db.createAgent("telegram-1", "telegram", "tok");
      db.updateAgent(agent.id, { full_access: 0 });
      db.addAgentAllowlist(agent.id, "42");
      const approvals = createApprovalStore(600_000, { autoExpire: false, idFactory: () => "ap_once" });
      const svc = new AgentService({ db, codexBin: FAKE, approvalStore: approvals });
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "42",
        text: "needs approval",
        workdir: cwd,
        agentId: agent.id,
        onApprovalRequest: async (req) => {
          assert.equal(req.id, "ap_once");
          assert.equal(svc.resolveApproval({ id: req.id, decision: "allow-once", bindingId: req.bindingId, agentId: agent.id }), "resolved");
        },
      });

      assert.equal(res.ok, true);
      assert.equal(db.getAgent(agent.id)?.full_access, 0);
      const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "42", cwd);
      assert.equal(db.listJobs(binding.id, 10)[0]?.state, "done");
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("full_access=0 gate allow-always flips the agent and records lifecycle", async () => {
  const cwd = tempCwd();
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const events = new EventLog({ path: join(cwd, "events.jsonl") });
      const agent = db.createAgent("telegram-1", "telegram", "tok");
      db.updateAgent(agent.id, { full_access: 0 });
      db.addAgentAllowlist(agent.id, "42");
      const approvals = createApprovalStore(600_000, { autoExpire: false, idFactory: () => "ap_always" });
      const svc = new AgentService({ db, codexBin: FAKE, approvalStore: approvals, events });
      const res = await svc.handleIncoming({
        kind: "telegram",
        chatId: "42",
        text: "needs approval forever",
        workdir: cwd,
        agentId: agent.id,
        onApprovalRequest: async (req) => {
          assert.equal(svc.resolveApproval({ id: req.id, decision: "allow-always", bindingId: req.bindingId, agentId: agent.id }), "resolved");
        },
      });

      assert.equal(res.ok, true);
      assert.equal(db.getAgent(agent.id)?.full_access, 1);
      assert.ok(events.recent(10).some((event) => event.type === "lifecycle"));
      events.close();
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("full_access=0 gate deny and timeout fail closed without running", async () => {
  const cwd = tempCwd();
  try {
    await withMode("ok", async () => {
      const db = openBridgeDb(cwd);
      const agent = db.createAgent("telegram-1", "telegram", "tok");
      db.updateAgent(agent.id, { full_access: 0 });
      db.addAgentAllowlist(agent.id, "42");

      const denyStore = createApprovalStore(600_000, { autoExpire: false, idFactory: () => "ap_deny" });
      const denySvc = new AgentService({ db, codexBin: FAKE, approvalStore: denyStore });
      const denied = await denySvc.handleIncoming({
        kind: "telegram",
        chatId: "42",
        text: "deny me",
        workdir: cwd,
        agentId: agent.id,
        onApprovalRequest: async (req) => {
          assert.equal(denySvc.resolveApproval({ id: req.id, decision: "deny", bindingId: req.bindingId, agentId: agent.id }), "resolved");
        },
      });
      assert.equal(denied.ok, false);
      assert.match(String(denied.error), /denied/);

      let now = 1_000;
      const timeoutStore = createApprovalStore(500, {
        autoExpire: false,
        now: () => now,
        idFactory: () => "ap_timeout",
      });
      const timeoutSvc = new AgentService({ db, codexBin: FAKE, approvalStore: timeoutStore });
      let requested = false;
      const pending = timeoutSvc.handleIncoming({
        kind: "telegram",
        chatId: "42",
        text: "timeout me",
        workdir: cwd,
        agentId: agent.id,
        onApprovalRequest: async () => {
          requested = true;
        },
      });
      await waitForCondition(() => requested, "approval request");
      now = 1_501;
      assert.equal(timeoutSvc.cleanupApprovals(now).length, 1);
      const timedOut = await pending;
      assert.equal(timedOut.ok, false);
      assert.match(String(timedOut.error), /timed out/);

      const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "42", cwd);
      assert.equal(db.getBinding(binding.id)?.thread_id, null);
      db.close();
    });
  } finally {
    rmRfRetry(cwd);
  }
});

test("resolveApproval rejects unauthorized binding attempts and leaves request pending", async () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    db.updateAgent(agent.id, { full_access: 0 });
    db.addAgentAllowlist(agent.id, "42");
    const approvals = createApprovalStore(600_000, { autoExpire: false, idFactory: () => "ap_auth" });
    const svc = new AgentService({ db, codexBin: FAKE, approvalStore: approvals });
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "42", cwd);
    const other = db.getOrCreateAgentBinding(agent.id, "telegram", "43", cwd);
    approvals.request({ bindingId: binding.id, promptHash: "hash", workdir: cwd });

    assert.equal(svc.resolveApproval({ id: "ap_auth", decision: "allow-once", bindingId: other.id, agentId: agent.id }), "unauthorized");
    assert.equal(approvals.pending.has("ap_auth"), true);
    assert.equal(svc.resolveApproval({ id: "ap_auth", decision: "allow-once", bindingId: binding.id, agentId: agent.id }), "resolved");
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

test("listPendingApprovals filters by binding/agent and prunes expired requests", async () => {
  const cwd = tempCwd();
  try {
    const db = openBridgeDb(cwd);
    const agent = db.createAgent("telegram-1", "telegram", "tok");
    const otherAgent = db.createAgent("telegram-2", "telegram", "tok2");
    const binding = db.getOrCreateAgentBinding(agent.id, "telegram", "42", cwd);
    const otherBinding = db.getOrCreateAgentBinding(otherAgent.id, "telegram", "43", cwd);
    let now = 1_000;
    let nextId = 0;
    const approvals = createApprovalStore(100, {
      autoExpire: false,
      now: () => now,
      idFactory: () => `ap_${++nextId}`,
    });
    const svc = new AgentService({ db, codexBin: FAKE, approvalStore: approvals });
    approvals.request({ bindingId: binding.id, promptHash: "hash-a", workdir: cwd });
    approvals.request({ bindingId: otherBinding.id, promptHash: "hash-b", workdir: cwd });

    assert.deepEqual(svc.listPendingApprovals({ agentId: agent.id }).map((req) => req.id), ["ap_1"]);
    assert.deepEqual(svc.listPendingApprovals({ bindingId: otherBinding.id }).map((req) => req.id), ["ap_2"]);

    now = 1_101;
    assert.deepEqual(svc.listPendingApprovals(), []);
    assert.equal(approvals.pending.size, 0);
    db.close();
  } finally {
    rmRfRetry(cwd);
  }
});

async function waitForCondition(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`timed out waiting for ${label}`);
}
