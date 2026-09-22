import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDbReadWrite } from "../src/sqlite.ts";
import {
  collectMemoryStatus,
  classifyMemoryError,
  formatMemoryStatus,
  memoryStatusNotice,
  type MemoryStatus,
} from "../src/memory-status.ts";
import { handleSessionStart } from "../src/hook.ts";
import { buildCwdContextResult } from "../src/hook.ts";
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

function assertObservationLimits(status: MemoryStatus): void {
  assert.equal(status.observationSource, "jobs-db");
  assert.equal(status.effectiveExtractionRoute, "unknown");
  assert.equal(status.startupGuardDecision, "unknown");
}

const observationCases = [
  { name: "empty", state: "ok", exit: 0 },
  { name: "success", state: "ok", exit: 0 },
  { name: "quota", state: "ok", exit: 0 },
  { name: "missing", state: "unavailable", exit: 1 },
  { name: "unsupported", state: "unsupported", exit: 0 },
  { name: "corrupt", state: "unsupported", exit: 0 },
  { name: "open-failure", state: "unavailable", exit: 1 },
] as const;

for (const scenario of observationCases) {
  test(`#191: ${scenario.name} jobs-db snapshot preserves unknown route/guard through the source CLI`, () => {
    const rows = scenario.name === "success"
      ? [{ kind: "memory_stage1", job_key: "a", status: "done", finished_at: 2000, retry_remaining: 3, last_error: null }]
      : scenario.name === "quota"
        ? [{ kind: "memory_stage1", job_key: "a", status: "error", finished_at: 2000, retry_remaining: 0, last_error: "429 quota exceeded" }]
        : [];
    const noDatabase = scenario.name === "missing" || scenario.name === "corrupt" || scenario.name === "open-failure";
    const home = makeHome(noDatabase ? null : rows,
      scenario.name === "unsupported" ? { columns: ["kind TEXT", "status TEXT"] } : {});
    try {
      const store = join(home, "memories_1.sqlite");
      if (scenario.name === "corrupt") writeFileSync(store, "this is not a database");
      if (scenario.name === "open-failure") mkdirSync(store);
      const beforeFiles = readdirSync(home).sort();
      const beforeStore = scenario.name === "missing" || scenario.name === "open-failure" ? null : readFileSync(store);
      const status = collectMemoryStatus(home);
      assert.equal(status.state, scenario.state);
      assertObservationLimits(status);
      if (scenario.name === "success" || scenario.name === "empty") {
        assert.equal(memoryStatusNotice(status, 2100), "", "unknown observations must not create a startup warning");
      }
      if (scenario.name === "quota") assert.deepEqual(status.exhaustedByCause, { capacity: 1 });

      const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
      for (const json of [true, false]) {
        const child = spawnSync(process.execPath, [cli, "memory", "status", "--home", home, ...(json ? ["--json"] : [])], {
          cwd: home,
          env: { ...process.env, CODEX_HOME: home },
          encoding: "utf8",
          timeout: 10_000,
        });
        assert.ifError(child.error);
        assert.equal(child.status, scenario.exit, child.stderr);
        if (json) {
          const output = JSON.parse(child.stdout);
          assert.equal(output.state, scenario.state);
          assertObservationLimits(output);
          assert.deepEqual(output, status);
        } else {
          assert.match(child.stdout, /observation: jobs-db; effective extraction route: unknown; startup guard decision: unknown/);
          assert.match(child.stdout, /job history does not establish the current route or guard decision/);
          if (scenario.state !== "ok") assert.match(child.stdout, new RegExp(`memory pipeline: ${scenario.state}`));
          if (scenario.name === "empty") assert.match(child.stdout, /jobs: none recorded/);
        }
      }
      assert.deepEqual(readdirSync(home).sort(), beforeFiles, "status must not create files");
      if (beforeStore) assert.deepEqual(readFileSync(store), beforeStore, "status must not modify the store");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
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

test("#190: an empty project and a broken index are different outcomes", () => {
  const empty = buildCwdContextResult("/nonexistent/project/path", {
    searchChat: () => ({ hits: [], scanned: 0, truncated: false }) as never,
    listCwdSessions: () => [],
  } as never);
  assert.equal(empty.outcome, "empty");
  assert.equal(empty.text, "");

  const broken = buildCwdContextResult("/nonexistent/project/path", {
    searchChat: () => {
      throw new Error("index is corrupt");
    },
    listCwdSessions: () => {
      throw new Error("index is corrupt");
    },
  } as never);
  assert.equal(broken.outcome, "unavailable");
  assert.match(broken.detail, /index is corrupt/);
  assert.equal(broken.text, "", "an unavailable index still injects no recall block");
});
