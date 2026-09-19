import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDbReadWrite, openDbReadOnly } from "../src/sqlite.ts";
import { requeueExhaustedMemoryJobs, formatRequeue, TRANSIENT_CAUSES } from "../src/memory-requeue.ts";

const COLUMNS = [
  "kind TEXT NOT NULL",
  "job_key TEXT NOT NULL",
  "status TEXT NOT NULL",
  "retry_remaining INTEGER NOT NULL",
  "retry_at INTEGER",
  "last_error TEXT",
  "input_watermark INTEGER",
  "last_success_watermark INTEGER",
];

function makeHome(rows: Array<Record<string, unknown>>, columns = COLUMNS): string {
  const home = mkdtempSync(join(tmpdir(), "cxc-requeue-"));
  const db = openDbReadWrite(join(home, "memories_1.sqlite"));
  db.exec("CREATE TABLE jobs (" + columns.join(", ") + ")");
  for (const row of rows) {
    const keys = Object.keys(row);
    db.prepare("INSERT INTO jobs (" + keys.join(", ") + ") VALUES (" + keys.map(() => "?").join(", ") + ")").run(
      ...keys.map((k) => row[k] as never),
    );
  }
  db.close();
  return home;
}

function readJobs(home: string): Array<Record<string, unknown>> {
  const db = openDbReadOnly(join(home, "memories_1.sqlite"));
  try {
    return db.prepare("SELECT kind, job_key, status, retry_remaining, retry_at, last_error, input_watermark FROM jobs ORDER BY job_key").all() as Array<Record<string, unknown>>;
  } finally {
    db.close();
  }
}

const exhausted = (key: string, err: string) => ({
  kind: "memory_stage1", job_key: key, status: "error", retry_remaining: 0, retry_at: 999,
  last_error: err, input_watermark: 10, last_success_watermark: 5,
});

test("#188: a dry run selects transient causes, writes nothing, and says so", () => {
  const home = makeHome([exhausted("a", "stream closed early"), exhausted("b", "context window exceeded")]);
  try {
    const before = readJobs(home);
    const r = requeueExhaustedMemoryJobs(home);
    assert.equal(r.state, "ok");
    assert.equal(r.applied, false);
    assert.equal(r.changed, 0);
    assert.deepEqual(r.selected.map((c) => c.jobKey), ["a"]);
    assert.equal(r.skippedByCause["context-window"], 1);
    assert.deepEqual(readJobs(home), before, "a dry run must not touch the store");
    assert.match(formatRequeue(r), /dry run/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#188: apply restores retries and clears backoff while preserving evidence", () => {
  const home = makeHome([exhausted("a", "429 rate limit")]);
  try {
    const r = requeueExhaustedMemoryJobs(home, { apply: true, retries: 2 });
    assert.equal(r.applied, true);
    assert.equal(r.changed, 1);
    const [row] = readJobs(home);
    assert.equal(row.retry_remaining, 2);
    assert.equal(row.retry_at, null, "backoff must be cleared or the host waits on a stale time");
    assert.equal(row.status, "error", "status is the host's to change, not ours");
    assert.equal(row.last_error, "429 rate limit", "error evidence must survive");
    assert.equal(row.input_watermark, 10, "watermarks must survive");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#188: context-window rows need an explicit opt-in", () => {
  const home = makeHome([exhausted("a", "context window exceeded")]);
  try {
    assert.equal(requeueExhaustedMemoryJobs(home).selected.length, 0);
    const optIn = requeueExhaustedMemoryJobs(home, { includeContextWindow: true });
    assert.deepEqual(optIn.selected.map((c) => c.cause), ["context-window"]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#188: rows that are not exhausted errors are never selected", () => {
  const home = makeHome([
    { kind: "memory_stage1", job_key: "done", status: "done", retry_remaining: 0, retry_at: null, last_error: null, input_watermark: 1, last_success_watermark: 1 },
    { kind: "memory_stage1", job_key: "running", status: "running", retry_remaining: 0, retry_at: null, last_error: null, input_watermark: 1, last_success_watermark: 1 },
    { kind: "memory_stage1", job_key: "retryable", status: "error", retry_remaining: 2, retry_at: 5, last_error: "capacity", input_watermark: 1, last_success_watermark: 1 },
    exhausted("target", "capacity"),
  ]);
  try {
    const r = requeueExhaustedMemoryJobs(home, { apply: true });
    assert.deepEqual(r.selected.map((c) => c.jobKey), ["target"]);
    assert.equal(r.changed, 1);
    const rows = readJobs(home);
    assert.equal(rows.find((x) => x.job_key === "running")?.retry_remaining, 0, "a running job must not be clobbered");
    assert.equal(rows.find((x) => x.job_key === "retryable")?.retry_at, 5, "a row the host can still retry is left alone");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#188: kind and limit bound the selection", () => {
  const home = makeHome([
    exhausted("a", "capacity"),
    exhausted("b", "capacity"),
    { ...exhausted("c", "capacity"), kind: "memory_consolidate_global" },
  ]);
  try {
    assert.deepEqual(
      requeueExhaustedMemoryJobs(home, { kind: "memory_stage1" }).selected.map((c) => c.jobKey),
      ["a", "b"],
    );
    assert.equal(requeueExhaustedMemoryJobs(home, { limit: 1 }).selected.length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#188: an unsupported schema reports rather than writing", () => {
  const home = makeHome([], ["kind TEXT NOT NULL", "status TEXT NOT NULL"]);
  try {
    const r = requeueExhaustedMemoryJobs(home, { apply: true });
    assert.equal(r.state, "unsupported");
    assert.equal(r.applied, false);
    assert.match(r.detail, /retry_remaining/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#188: a missing store is unavailable and writes nothing", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-requeue-none-"));
  try {
    const r = requeueExhaustedMemoryJobs(home, { apply: true });
    assert.equal(r.state, "unavailable");
    assert.equal(r.applied, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("#188: context-window is deliberately absent from the transient set", () => {
  assert.equal(TRANSIENT_CAUSES.has("context-window"), false);
  for (const c of ["capacity", "incomplete-response", "stream-closed"]) assert.ok(TRANSIENT_CAUSES.has(c), c);
});
