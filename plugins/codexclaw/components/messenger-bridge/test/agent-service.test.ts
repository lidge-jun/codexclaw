/** agent-service.test.ts — db+queue+runner glue via the fake codex bin. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openBridgeDb } from "../src/db.ts";
import { AgentService, buildReseedBlock } from "../src/agent-service.ts";
import type { JobRow } from "../src/db.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-codex.mjs");
chmodSync(FAKE, 0o755);

function tempCwd(): string {
  return mkdtempSync(join(tmpdir(), "bridge-agent-test-"));
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
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("handleIncoming: failure records error state on the job", async () => {
  const cwd = tempCwd();
  try {
    await withMode("fail", async () => {
      const db = openBridgeDb(cwd);
      const svc = new AgentService({ db, codexBin: FAKE });
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
      db.close();
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
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
    rmSync(cwd, { recursive: true, force: true });
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
