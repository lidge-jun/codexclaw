/**
 * index-freshness.test.ts — #144: --status / banner compare source JSONL
 * read-only, and last_ingest_at only advances when ingest changed rows.
 *
 * Every mutating test owns its own mkdtemp home (Amendment B.2). Never
 * point --home or --index-path at a real Codex home.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome, dateParts, THREAD_ARCHIVED, THREAD_MAIN } from "./fixtures.ts";
import { searchChat } from "../src/chat-search.ts";
import { main as cliMain, indexStatusLine } from "../src/cli.ts";
import { handleSessionStart } from "../src/hook.ts";
import { openIndex, indexStatus } from "../src/index-db.ts";
import { ingest, measureIndexFreshness } from "../src/ingest.ts";

const SENTINEL = "2000-01-01T00:00:00.000Z";
const NEW_THREAD = "019f0000-0000-7000-8000-00000000ffff";

function withHome(fn: (home: string, idx: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), "recall-fresh-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    buildCodexHome(home);
    fn(home, idx);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

function ingestHome(home: string, idx: string): void {
  const db = openIndex(idx);
  try {
    ingest(home, db, 0);
  } finally {
    db.close();
  }
}

function mainRolloutPath(home: string): string {
  const today = dateParts(0);
  return join(
    home,
    "sessions",
    today.y,
    today.m,
    today.d,
    `rollout-${today.y}-${today.m}-${today.d}T01-00-00-${THREAD_MAIN}.jsonl`,
  );
}

function archivedRolloutPath(home: string): string {
  const arch = dateParts(10);
  return join(
    home,
    "archived_sessions",
    `rollout-${arch.y}-${arch.m}-${arch.d}T05-00-00-${THREAD_ARCHIVED}.jsonl`,
  );
}

function growMainRollout(home: string): void {
  const file = mainRolloutPath(home);
  const today = dateParts(0);
  const line =
    JSON.stringify({
      timestamp: today.iso,
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "grown freshness canary" }],
      },
    }) + "\n";
  writeFileSync(file, readFileSync(file, "utf8") + line);
  const bumped = new Date(Date.now() + 2_000);
  utimesSync(file, bumped, bumped);
}

function writeNewRollout(home: string): void {
  const today = dateParts(0);
  const dir = join(home, "sessions", today.y, today.m, today.d);
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T04-00-00-${NEW_THREAD}.jsonl`),
    JSON.stringify({
      timestamp: today.iso,
      type: "session_meta",
      payload: { id: NEW_THREAD, cwd: "/proj/alpha", originator: "codex-tui" },
    }) +
      "\n" +
      JSON.stringify({
        timestamp: today.iso,
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "brand new freshness file" }],
        },
      }) +
      "\n",
  );
}

function plantSentinel(idx: string): void {
  const db = openIndex(idx);
  try {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_ingest_at', ?)").run(SENTINEL);
  } finally {
    db.close();
  }
}

function captureStdout(fn: () => number): { code: number; text: string } {
  const captured: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.push(s);
    return true;
  };
  try {
    return { code: fn(), text: captured.join("") };
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
  }
}

test("measureIndexFreshness: a grown file is stale even when the path count is unchanged", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    growMainRollout(home);
    const db = openIndex(idx);
    try {
      const fresh = measureIndexFreshness(home, db, 0);
      assert.equal(fresh.sourceFiles, fresh.indexedFiles);
      assert.equal(fresh.changedFiles, 1);
      assert.equal(fresh.missingFiles, 0);
      assert.equal(fresh.staleFiles, 1);
      assert.equal(fresh.truncated, false);
    } finally {
      db.close();
    }
  });
});

test("measureIndexFreshness: a new JSONL path counts as missing/stale", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    writeNewRollout(home);
    const db = openIndex(idx);
    try {
      const fresh = measureIndexFreshness(home, db, 0);
      assert.equal(fresh.sourceFiles, fresh.indexedFiles + 1);
      assert.equal(fresh.missingFiles, 1);
      assert.equal(fresh.staleFiles, 1);
    } finally {
      db.close();
    }
  });
});

test("measureIndexFreshness: a vanished source file counts as extra/stale", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    rmSync(archivedRolloutPath(home));
    const db = openIndex(idx);
    try {
      const fresh = measureIndexFreshness(home, db, 0);
      assert.equal(fresh.extraFiles, 1);
      assert.equal(fresh.staleFiles, 1);
      assert.equal(fresh.sourceFiles, fresh.indexedFiles - 1);
    } finally {
      db.close();
    }
  });
});

test("ingest: no-op does not advance last_ingest_at", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    plantSentinel(idx);
    const db = openIndex(idx);
    try {
      const second = ingest(home, db, 0);
      assert.equal(second.ingested + second.appended + second.pruned, 0);
      const stamp = db.prepare("SELECT value FROM meta WHERE key = 'last_ingest_at'").get() as
        | { value: string }
        | undefined;
      assert.equal(stamp?.value, SENTINEL);
    } finally {
      db.close();
    }
  });
});

test("ingest: a real append advances last_ingest_at", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    plantSentinel(idx);
    growMainRollout(home);
    const db = openIndex(idx);
    try {
      const again = ingest(home, db, 0);
      assert.equal(again.appended, 1);
      const stamp = db.prepare("SELECT value FROM meta WHERE key = 'last_ingest_at'").get() as
        | { value: string }
        | undefined;
      assert.notEqual(stamp?.value, SENTINEL);
    } finally {
      db.close();
    }
  });
});

test("cli --status is read-only and reports source/stale", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    const dbBefore = openIndex(idx);
    let stampBefore: string | null;
    let filesBefore: number;
    try {
      const status = indexStatus(dbBefore, idx);
      stampBefore = status.lastIngestAt;
      filesBefore = status.files;
    } finally {
      dbBefore.close();
    }
    growMainRollout(home);
    const textRun = captureStdout(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status"]) as number,
    );
    assert.equal(textRun.code, 0);
    assert.match(textRun.text, /source files: \d+/);
    assert.match(textRun.text, /stale: 1/);
    const jsonRun = captureStdout(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status", "--json"]) as number,
    );
    assert.equal(jsonRun.code, 0);
    const report = JSON.parse(jsonRun.text) as {
      staleFiles: number;
      changedFiles: number;
      sourceFiles: number;
      files: number;
    };
    assert.equal(report.staleFiles, 1);
    assert.equal(report.changedFiles, 1);
    assert.equal(report.sourceFiles, report.files);
    const dbAfter = openIndex(idx);
    try {
      const status = indexStatus(dbAfter, idx);
      assert.equal(status.lastIngestAt, stampBefore);
      assert.equal(status.files, filesBefore);
    } finally {
      dbAfter.close();
    }
  });
});

test("cli --status --json after a full ingest reports staleFiles 0", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    const jsonRun = captureStdout(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status", "--json"]) as number,
    );
    assert.equal(jsonRun.code, 0);
    const report = JSON.parse(jsonRun.text) as { staleFiles: number; sourceFiles: number; files: number };
    assert.equal(report.staleFiles, 0);
    assert.equal(report.sourceFiles, report.files);
  });
});

test("searchChat noRefresh reports grown-file staleFiles > 0", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    growMainRollout(home);
    const r = searchChat("trigram", { home, indexPath: idx, noRefresh: true });
    assert.equal(r.mode, "index");
    assert.equal(r.index?.readOnly, true);
    assert.equal(r.index?.sourceFiles, r.index?.files);
    assert.equal(r.index?.staleFiles, 1);
  });
});

test("indexStatusLine names source and stale; SessionStart interpolates it", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    growMainRollout(home);
    const line = indexStatusLine(home, idx);
    assert.match(line, /\d+ source, 1 stale/);
    const parsed = JSON.parse(
      handleSessionStart(line, undefined, undefined, { dedicatedTools: false }),
    ) as { hookSpecificOutput: { additionalContext: string } };
    assert.match(parsed.hookSpecificOutput.additionalContext, /Index: .*1 stale/);
  });
});

test("measureIndexFreshness: a bounded scan reports truncated as a lower bound", () => {
  withHome((home, idx) => {
    ingestHome(home, idx);
    growMainRollout(home);
    const db = openIndex(idx);
    try {
      const bounded = measureIndexFreshness(home, db, 0, { budget: { maxStats: 0, maxMs: 50 } });
      assert.equal(bounded.truncated, true);
      assert.equal(bounded.changedFiles, 0, "maxStats 0 must not stat any overlapping file");
      const exact = measureIndexFreshness(home, db, 0);
      assert.equal(exact.truncated, false);
      assert.equal(exact.changedFiles, 1);
      assert.ok(bounded.staleFiles <= exact.staleFiles);
    } finally {
      db.close();
    }
  });
});
