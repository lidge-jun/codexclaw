import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDbReadWrite } from "../src/sqlite.ts";
import {
  collectMemoryStatus,
  classifyMemoryError,
  formatMemoryStatus,
  memoryStatusNotice,
} from "../src/memory-status.ts";
import { handleSessionStart } from "../src/hook.ts";
import { memoryPipelineNotice } from "../src/cli.ts";

function makeHome(rows: Array<Record<string, unknown>> | null, opts: { columns?: string[] } = {}): string {
  const home = mkdtempSync(join(tmpdir(), "cxc-memstatus-"));
  if (rows === null) return home; // no store at all
  const db = openDbReadWrite(join(home, "memories_1.sqlite"));
  const columns = opts.columns ?? [
    "kind TEXT NOT NULL",
    "job_key TEXT NOT NULL",
    "status TEXT NOT NULL",
    "finished_at INTEGER",
    "retry_remaining INTEGER NOT NULL",
    "last_error TEXT",
  ];
  db.exec("CREATE TABLE jobs (" + columns.join(", ") + ")");
  for (const row of rows) {
    const keys = Object.keys(row);
    db.prepare(
      "INSERT INTO jobs (" + keys.join(", ") + ") VALUES (" + keys.map(() => "?").join(", ") + ")",
    ).run(...keys.map((k) => row[k] as never));
  }
  db.close();
  return home;
}

test("#187: a healthy store reports per-kind counts and the newest success", () => {
  const home = makeHome([
    { kind: "memory_stage1", job_key: "a", status: "done", finished_at: 1000, retry_remaining: 3, last_error: null },
    { kind: "memory_stage1", job_key: "b", status: "done", finished_at: 2000, retry_remaining: 3, last_error: null },
    { kind: "memory_consolidate_global", job_key: "c", status: "done", finished_at: 1500, retry_remaining: 3, last_error: null },
  ]);
  try {
    const status = collectMemoryStatus(home);
    assert.equal(status.state, "ok");
    assert.equal(status.exhausted, 0);
    assert.equal(status.lastSuccessAt, 2000);
    assert.deepEqual(
      status.jobs.map((j) => j.kind + "/" + j.status + "=" + j.count).sort(),
      ["memory_consolidate_global/done=1", "memory_stage1/done=2"],
    );
    assert.match(status.storePath ?? "", /memories_1\.sqlite$/);
    // A healthy pipeline says nothing at SessionStart.
    assert.equal(memoryStatusNotice(status, 2100), "");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#187: only retry_remaining=0 errors count as exhausted, bucketed by cause", () => {
  const home = makeHome([
    { kind: "memory_stage1", job_key: "a", status: "error", finished_at: 10, retry_remaining: 0, last_error: "context window exceeded" },
    { kind: "memory_stage1", job_key: "b", status: "error", finished_at: 11, retry_remaining: 0, last_error: "429 rate limit" },
    { kind: "memory_stage1", job_key: "c", status: "error", finished_at: 12, retry_remaining: 2, last_error: "transient" },
  ]);
  try {
    const status = collectMemoryStatus(home);
    assert.equal(status.exhausted, 2, "the retryable error must not be counted");
    assert.deepEqual(status.exhaustedByCause, { "context-window": 1, capacity: 1 });
    assert.match(formatMemoryStatus(status), /exhausted \(host will not retry\): 2/);
    assert.match(memoryStatusNotice(status, 99999999), /2 job\(s\) exhausted their retries/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#187: a missing store is unavailable, not an empty pipeline", () => {
  const home = makeHome(null);
  try {
    const status = collectMemoryStatus(home);
    assert.equal(status.state, "unavailable");
    assert.equal(status.storePath, null);
    // Unavailable must stay silent rather than claim the project has no memories.
    assert.equal(memoryStatusNotice(status), "");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#187: an unfamiliar schema reports unsupported instead of guessing", () => {
  const home = makeHome([], { columns: ["kind TEXT NOT NULL", "status TEXT NOT NULL"] });
  try {
    const status = collectMemoryStatus(home);
    assert.equal(status.state, "unsupported");
    assert.match(status.detail, /missing column\(s\)/);
    assert.match(status.detail, /retry_remaining/);
    assert.match(memoryStatusNotice(status), /unsupported store schema/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#187: a corrupt store file is unavailable, never a throw", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-memstatus-bad-"));
  writeFileSync(join(home, "memories_1.sqlite"), "this is not a database");
  try {
    const status = collectMemoryStatus(home);
    assert.ok(status.state !== "ok", "a corrupt store must not report ok");
    assert.equal(status.exhausted, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#185: staleness is reported only past the budget, and says how stale", () => {
  const home = makeHome([
    { kind: "memory_stage1", job_key: "a", status: "done", finished_at: 1000, retry_remaining: 3, last_error: null },
  ]);
  try {
    const status = collectMemoryStatus(home);
    assert.equal(memoryStatusNotice(status, 1000 + 3600), "", "fresh enough to stay silent");
    assert.match(memoryStatusNotice(status, 1000 + 172800 + 1), /last successful extraction/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#187: error classification is coarse and falls through rather than asserting a cause", () => {
  assert.equal(classifyMemoryError("context window exceeded"), "context-window");
  assert.equal(classifyMemoryError("input context length is too long"), "context-window");
  assert.equal(classifyMemoryError("429 Too Many Requests"), "capacity");
  assert.equal(classifyMemoryError("over quota"), "capacity");
  assert.equal(classifyMemoryError("incomplete response from model"), "incomplete-response");
  assert.equal(classifyMemoryError("stream closed before completion"), "stream-closed");
  assert.equal(classifyMemoryError("something nobody has seen"), "other");
  assert.equal(classifyMemoryError(null), "unknown");
  assert.equal(classifyMemoryError(""), "unknown");
});

test("#185: SessionStart carries the notice when supplied and stays unchanged when empty", () => {
  const withNotice = handleSessionStart("idx", undefined, undefined, {
    memoryNotice: "memory pipeline: 52 job(s) exhausted their retries (cxc memory status)",
    dedicatedTools: false,
  });
  assert.match(withNotice, /52 job\(s\) exhausted their retries/);

  const silent = handleSessionStart("idx", undefined, undefined, { memoryNotice: "", dedicatedTools: false });
  assert.doesNotMatch(silent, /memory pipeline/);

  // The SessionStart contract requires the briefing to end on the recall pointer, so
  // the warning must precede the session notice rather than trail it.
  const idxWarn = withNotice.indexOf("memory pipeline");
  const idxRecall = withNotice.lastIndexOf("recall");
  assert.ok(idxWarn < idxRecall, "the memory warning must not displace the trailing recall pointer");
});

test("#185: memoryPipelineNotice is fail-soft on a home with no store", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-memnotice-"));
  try {
    assert.equal(memoryPipelineNotice(home), "");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
